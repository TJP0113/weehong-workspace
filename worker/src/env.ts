export interface Env {
  KV: KVNamespace;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_SERVICE_ACCOUNT: string;
  APP_URL: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  AUTOCOUNT_BASE_URL?: string;
  AUTOCOUNT_AUTH_PATH?: string;
  AUTOCOUNT_ITEMS_PATH?: string;
  AUTOCOUNT_DEBTORS_PATH?: string;
  AUTOCOUNT_MACHINE_GROUPS?: string;
  AUTOCOUNT_API_KEY?: string;
  AUTOCOUNT_USERNAME?: string;
  AUTOCOUNT_PASSWORD?: string;
}

export const nowIso = () => new Date().toISOString();
/** Malaysia time (UTC+8) date string, YYYY-MM-DD */
export const myDate = (d = new Date()) => new Date(d.getTime() + 8 * 3600e3).toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
