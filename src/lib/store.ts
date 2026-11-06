import {
  addDoc, collection, deleteDoc, doc, getDoc, limit as fbLimit, onSnapshot, orderBy as fbOrderBy, query,
  runTransaction, setDoc, updateDoc, where as fbWhere, type QueryConstraint,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useEffect, useState } from 'react';
import { DEMO, db, storage } from './firebase';
import { demoSeed } from './demo';

export type Op = '==' | '!=' | 'in' | '>=' | '<=' | 'array-contains';
export type Where = [string, Op, any];
export interface Q { where?: Where[]; orderBy?: [string, 'asc' | 'desc']; limit?: number }
export type Row<T> = T & { id: string };

export interface Store {
  watch<T>(path: string, q: Q | undefined, cb: (rows: Row<T>[]) => void): () => void;
  watchDoc<T>(path: string, cb: (d: Row<T> | null) => void): () => void;
  get<T>(path: string): Promise<Row<T> | null>;
  add(path: string, data: any): Promise<string>;
  set(path: string, data: any, merge?: boolean): Promise<void>;
  update(path: string, data: any): Promise<void>;
  remove(path: string): Promise<void>;
  nextNumber(counter: string): Promise<number>;
  upload(path: string, file: Blob): Promise<string>;
}

const clean = (o: any) => JSON.parse(JSON.stringify(o, (_k, v) => (v === undefined ? null : v)));

/* ---------------- Firestore ---------------- */
const firestoreStore: Store = {
  watch(path, q, cb) {
    const cons: QueryConstraint[] = [];
    q?.where?.forEach(([f, op, v]) => cons.push(fbWhere(f, op as any, v)));
    if (q?.orderBy) cons.push(fbOrderBy(q.orderBy[0], q.orderBy[1]));
    if (q?.limit) cons.push(fbLimit(q.limit));
    return onSnapshot(query(collection(db!, path), ...cons), (s) => cb(s.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))), (e) => console.error(path, e));
  },
  watchDoc(path, cb) {
    return onSnapshot(doc(db!, path), (d) => cb(d.exists() ? ({ id: d.id, ...(d.data() as any) }) : null), (e) => console.error(path, e));
  },
  async get(path) {
    const d = await getDoc(doc(db!, path));
    return d.exists() ? ({ id: d.id, ...(d.data() as any) }) : null;
  },
  async add(path, data) {
    return (await addDoc(collection(db!, path), clean(data))).id;
  },
  set: (path, data, merge = false) => setDoc(doc(db!, path), clean(data), { merge }),
  update: (path, data) => updateDoc(doc(db!, path), clean(data)),
  remove: (path) => deleteDoc(doc(db!, path)),
  async nextNumber(counter) {
    return runTransaction(db!, async (tx) => {
      const r = doc(db!, 'counters', counter);
      const s = await tx.get(r);
      const n = ((s.exists() ? (s.data() as any).n : 0) || 0) + 1;
      tx.set(r, { n });
      return n;
    });
  },
  async upload(path, file) {
    const r = ref(storage!, path);
    await uploadBytes(r, file);
    return getDownloadURL(r);
  },
};

/* ---------------- Demo (in the browser) ---------------- */
const KEY = 'weehong-demo-v1';
type Docs = Record<string, any>; // full path -> data
let docs: Docs = {};
try {
  const raw = DEMO ? localStorage.getItem(KEY) : null;
  docs = raw ? JSON.parse(raw) : DEMO ? demoSeed() : {};
} catch {
  docs = DEMO ? demoSeed() : {};
}
const listeners = new Set<() => void>();
const persist = () => {
  try { localStorage.setItem(KEY, JSON.stringify(docs)); } catch { /* storage full or blocked */ }
  listeners.forEach((l) => l());
};
const parentOf = (p: string) => p.split('/').slice(0, -1).join('/');
const idOf = (p: string) => p.split('/').pop()!;
const getField = (o: any, f: string) => f.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const match = (v: any, op: Op, x: any) => {
  switch (op) {
    case '==': return v === x;
    case '!=': return v !== x;
    case 'in': return (x as any[]).includes(v);
    case '>=': return v >= x;
    case '<=': return v <= x;
    case 'array-contains': return Array.isArray(v) && v.includes(x);
  }
};
const runQuery = (path: string, q?: Q) => {
  let rows = Object.entries(docs).filter(([p]) => parentOf(p) === path).map(([p, d]) => ({ id: idOf(p), ...d }));
  q?.where?.forEach(([f, op, x]) => { rows = rows.filter((r) => match(getField(r, f), op, x)); });
  if (q?.orderBy) {
    const [f, dir] = q.orderBy;
    rows.sort((a, b) => ((getField(a, f) ?? '') > (getField(b, f) ?? '') ? 1 : -1) * (dir === 'desc' ? -1 : 1));
  }
  if (q?.limit) rows = rows.slice(0, q.limit);
  return rows;
};
const rid = () => Math.random().toString(36).slice(2, 12);
const demoStore: Store = {
  watch(path, q, cb) {
    const fire = () => cb(runQuery(path, q) as any);
    listeners.add(fire);
    fire();
    return () => listeners.delete(fire);
  },
  watchDoc(path, cb) {
    const fire = () => cb(docs[path] ? ({ id: idOf(path), ...docs[path] }) : null);
    listeners.add(fire);
    fire();
    return () => listeners.delete(fire);
  },
  async get(path) { return docs[path] ? ({ id: idOf(path), ...docs[path] }) : null; },
  async add(path, data) { const id = rid(); docs[`${path}/${id}`] = clean(data); persist(); return id; },
  async set(path, data, merge = false) { docs[path] = merge ? { ...(docs[path] || {}), ...clean(data) } : clean(data); persist(); },
  async update(path, data) {
    const cur = { ...(docs[path] || {}) };
    Object.entries(clean(data)).forEach(([k, v]) => {
      if (k.includes('.')) {
        const ks = k.split('.');
        let o = cur;
        ks.slice(0, -1).forEach((kk) => { o[kk] = { ...(o[kk] || {}) }; o = o[kk]; });
        o[ks[ks.length - 1]] = v;
      } else cur[k] = v;
    });
    docs[path] = cur;
    persist();
  },
  async remove(path) { delete docs[path]; persist(); },
  async nextNumber(counter) { const p = `counters/${counter}`; const n = ((docs[p]?.n as number) || 0) + 1; docs[p] = { n }; persist(); return n; },
  async upload(_path, file) {
    return new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(file); });
  },
};

export const store: Store = DEMO ? demoStore : firestoreStore;
export const resetDemo = () => { docs = demoSeed(); persist(); };

/* ---------------- React hooks ---------------- */
export function useCollection<T>(path: string | null, q?: Q): Row<T>[] | null {
  const [rows, setRows] = useState<Row<T>[] | null>(null);
  const key = path + JSON.stringify(q || {});
  useEffect(() => {
    if (!path) { setRows([]); return; }
    setRows(null);
    return store.watch<T>(path, q, setRows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return rows;
}

export function useDoc<T>(path: string | null): Row<T> | null | undefined {
  const [d, setD] = useState<Row<T> | null | undefined>(undefined);
  useEffect(() => {
    if (!path) { setD(null); return; }
    setD(undefined);
    return store.watchDoc<T>(path, setD);
  }, [path]);
  return d;
}
