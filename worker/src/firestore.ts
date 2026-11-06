import type { Env } from './env';
import { serviceToken } from './google';

/* Minimal Firestore REST client (service account, bypasses security rules). */

const base = (env: Env) => `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;

function enc(v: any): any {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
}
function dec(v: any): any {
  if (!v) return null;
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(dec);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, dec(x)]));
  return null;
}
export const fields = (o: Record<string, any>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, enc(v)]));
export const fromDoc = (d: any) => ({ id: d.name.split('/').pop(), _path: d.name.split('/documents/')[1], ...Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, dec(v)])) });

async function call(env: Env, url: string, init: RequestInit = {}) {
  const token = await serviceToken(env);
  const r = await fetch(url, { ...init, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers || {}) } });
  if (r.status === 404) return null;
  const j: any = await r.json();
  if (!r.ok) throw new Error(`Firestore ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}

export async function getDoc(env: Env, path: string) {
  const j = await call(env, `${base(env)}/${path}`);
  return j ? fromDoc(j) : null;
}

/** Merge-update only the given keys (dot paths allowed for nested maps). Creates the doc if missing. */
export async function patchDoc(env: Env, path: string, data: Record<string, any>) {
  const mask = Object.keys(data).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k.split('.').map((p) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(p) ? p : `\`${p}\``)).join('.'))}`).join('&');
  const nested: Record<string, any> = {};
  Object.entries(data).forEach(([k, v]) => {
    const ks = k.split('.');
    let o = nested;
    ks.slice(0, -1).forEach((x) => { o[x] = o[x] || {}; o = o[x]; });
    o[ks[ks.length - 1]] = v;
  });
  return call(env, `${base(env)}/${path}?${mask}`, { method: 'PATCH', body: JSON.stringify({ fields: fields(nested) }) });
}

export async function addDoc(env: Env, collection: string, data: Record<string, any>) {
  return call(env, `${base(env)}/${collection}`, { method: 'POST', body: JSON.stringify({ fields: fields(data) }) });
}

export async function deleteDoc(env: Env, path: string) {
  return call(env, `${base(env)}/${path}`, { method: 'DELETE' });
}

type Filter = [string, 'EQUAL' | 'NOT_EQUAL' | 'IN' | 'LESS_THAN_OR_EQUAL' | 'GREATER_THAN_OR_EQUAL', any];
export async function query(env: Env, collection: string, where: Filter[] = [], limit?: number) {
  const filters = where.map(([f, op, v]) => ({ fieldFilter: { field: { fieldPath: f }, op, value: enc(v) } }));
  const structuredQuery: any = { from: [{ collectionId: collection }] };
  if (filters.length === 1) structuredQuery.where = filters[0];
  if (filters.length > 1) structuredQuery.where = { compositeFilter: { op: 'AND', filters } };
  if (limit) structuredQuery.limit = limit;
  const j = await call(env, `${base(env)}:runQuery`, { method: 'POST', body: JSON.stringify({ structuredQuery }) });
  return (j || []).filter((x: any) => x.document).map((x: any) => fromDoc(x.document));
}

export async function listAll(env: Env, collection: string) {
  const out: any[] = [];
  let token = '';
  do {
    const j = await call(env, `${base(env)}/${collection}?pageSize=300${token ? `&pageToken=${token}` : ''}`);
    (j?.documents || []).forEach((d: any) => out.push(fromDoc(d)));
    token = j?.nextPageToken || '';
  } while (token);
  return out;
}

/** Upserts many docs, writing only the listed fields (others such as groups/category are kept). */
export async function upsertMany(env: Env, items: { path: string; data: Record<string, any> }[]) {
  const root = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  for (let i = 0; i < items.length; i += 400) {
    const writes = items.slice(i, i + 400).map(({ path, data }) => ({ update: { name: `${root}/${path}`, fields: fields(data) }, updateMask: { fieldPaths: Object.keys(data) } }));
    await call(env, `${base(env)}:commit`, { method: 'POST', body: JSON.stringify({ writes }) });
  }
}
