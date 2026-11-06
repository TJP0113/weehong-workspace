import { nowIso, type Env } from './env';
import { listAll, patchDoc, upsertMany } from './firestore';

/*
 * AutoCount sync through AOTG (AutoCount On The Go) Web API.
 *
 * ⚠ AutoCount only publishes the full AOTG endpoint list on its own Swagger page. The paths, the login body
 * and the field names below are best guesses; once you have the AOTG documentation, adjust the three
 * AUTOCOUNT_*_PATH variables in wrangler.toml and, if needed, the `pick(...)` field names here.
 */

const pick = (o: any, ...keys: string[]) => { for (const k of keys) if (o?.[k] !== undefined && o[k] !== null) return o[k]; return undefined; };
const rows = (j: any): any[] => (Array.isArray(j) ? j : j?.data || j?.Data || j?.items || j?.Items || j?.result || j?.Result || []);
const safeId = (s: string) => s.replace(/\//g, '_').trim();

async function login(env: Env): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (env.AUTOCOUNT_API_KEY) headers['ApiKey'] = env.AUTOCOUNT_API_KEY;
  if (!env.AUTOCOUNT_AUTH_PATH) return headers;
  const r = await fetch(env.AUTOCOUNT_BASE_URL! + env.AUTOCOUNT_AUTH_PATH, {
    method: 'POST', headers,
    body: JSON.stringify({ ApiKey: env.AUTOCOUNT_API_KEY, apiKey: env.AUTOCOUNT_API_KEY, UserName: env.AUTOCOUNT_USERNAME, userName: env.AUTOCOUNT_USERNAME, Password: env.AUTOCOUNT_PASSWORD, password: env.AUTOCOUNT_PASSWORD }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`AOTG 登录失败 (${r.status})`);
  const token = pick(j, 'AccessToken', 'accessToken', 'access_token', 'token', 'Token') || pick(j?.data || {}, 'AccessToken', 'accessToken', 'token');
  if (!token) throw new Error('AOTG 登录没有返回 AccessToken');
  return { ...headers, authorization: `Bearer ${token}` };
}

async function getList(env: Env, path: string, headers: Record<string, string>) {
  const r = await fetch(env.AUTOCOUNT_BASE_URL! + path, { headers });
  if (!r.ok) throw new Error(`AOTG ${path} → ${r.status}`);
  return rows(await r.json());
}

export async function syncAutoCount(env: Env) {
  const status = (s: Record<string, any>) => patchDoc(env, 'settings/integrations', Object.fromEntries(Object.entries(s).map(([k, v]) => [`autocount.${k}`, v])));
  if (!env.AUTOCOUNT_BASE_URL) { await status({ configured: false }); return { skipped: true }; }
  const t = nowIso();
  try {
    const headers = await login(env);
    const machineGroups = (env.AUTOCOUNT_MACHINE_GROUPS || '').split(',').map((x) => x.trim().toUpperCase()).filter(Boolean);
    const items = await getList(env, env.AUTOCOUNT_ITEMS_PATH!, headers);
    const parts: { path: string; data: any }[] = [];
    const machinesIn: any[] = [];
    for (const it of items) {
      const code = String(pick(it, 'ItemCode', 'itemCode', 'code') || '').trim();
      if (!code) continue;
      const group = String(pick(it, 'ItemGroup', 'itemGroup', 'GroupCode') || '').toUpperCase();
      const name = String(pick(it, 'Description', 'description', 'ItemName', 'name') || code);
      if (machineGroups.includes(group)) { machinesIn.push({ it, code, name }); continue; }
      parts.push({ path: `parts/${safeId(code)}`, data: {
        code, name,
        spec: String(pick(it, 'Desc2', 'FurtherDescription', 'Specification', 'spec') || ''),
        unit: String(pick(it, 'BaseUOM', 'UOM', 'SalesUOM', 'uom') || ''),
        stock: Number(pick(it, 'BalQty', 'BalanceQty', 'Qty', 'StockBalance', 'balQty') ?? 0),
        syncedAt: t,
      } });
    }
    await upsertMany(env, parts);

    // Machines: keep the system's own fields (status, location, rental) and set defaults for new ones.
    const existing = new Set((await listAll(env, 'machines')).map((m: any) => m.id));
    await upsertMany(env, machinesIn.map(({ it, code, name }) => {
      const supplier = String(pick(it, 'MainSupplier', 'SupplierName', 'CreditorName', 'supplier') || '');
      const data: any = {
        code, name,
        kind: String(pick(it, 'ItemType', 'ItemCategory', 'Category', 'Brand') || '机械'),
        serial: String(pick(it, 'SerialNo', 'SerialNumber', 'Remark1', 'serial') || ''),
        provider: supplier ? 'supplier' : 'own', supplierName: supplier, syncedAt: t,
      };
      if (!existing.has(safeId(code))) Object.assign(data, { status: 'idle', location: '公司场地', client: '', rentStart: '', rentEnd: '', rate: '', nextMaintenance: '' });
      return { path: `machines/${safeId(code)}`, data };
    }));

    let customers = 0;
    if (env.AUTOCOUNT_DEBTORS_PATH) {
      const debtors = await getList(env, env.AUTOCOUNT_DEBTORS_PATH, headers);
      const list = debtors.map((d: any) => ({ code: String(pick(d, 'AccNo', 'DebtorCode', 'code') || ''), name: String(pick(d, 'CompanyName', 'Name', 'name') || '') })).filter((d) => d.code && d.name);
      await upsertMany(env, list.map((d) => ({ path: `customers/${safeId(d.code)}`, data: { name: d.name, phone: '' } })));
      customers = list.length;
    }
    const counts = { parts: parts.length, machines: machinesIn.length, customers };
    await status({ configured: true, lastRun: t, lastSuccess: t, lastError: '', counts });
    return counts;
  } catch (e: any) {
    await status({ configured: true, lastRun: t, lastError: String(e.message || e).slice(0, 200) });
    throw e;
  }
}
