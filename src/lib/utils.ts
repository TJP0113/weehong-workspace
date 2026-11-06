import type { StatusDef, Tone } from './types';

export const now = () => new Date().toISOString();
export const today = () => localDate(new Date());
export const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const addDays = (iso: string, n: number) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return localDate(d); };
export const addMonths = (iso: string, n: number) => { const d = new Date(iso + 'T00:00:00'); d.setMonth(d.getMonth() + n); return localDate(d); };
export const daysBetween = (a: string, b: string) => Math.round((new Date(b.slice(0, 10) + 'T00:00:00').getTime() - new Date(a.slice(0, 10) + 'T00:00:00').getTime()) / 864e5);
export const daysSince = (iso?: string) => (iso ? Math.max(0, daysBetween(iso.slice(0, 10), today())) : 0);

const WD = ['日', '一', '二', '三', '四', '五', '六'];
export const fmtDate = (iso?: string) => (iso ? iso.slice(0, 10) : '—');
export const fmtMD = (iso?: string) => (iso ? `${Number(iso.slice(5, 7))}月${Number(iso.slice(8, 10))}日` : '—');
export const fmtWeekday = (iso: string) => `星期${WD[new Date(iso.slice(0, 10) + 'T00:00:00').getDay()]}`;
export const fmtTime = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const diff = daysBetween(localDate(d), today());
  if (diff === 0) return `今天 ${hm}`;
  if (diff === 1) return `昨天 ${hm}`;
  return `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`;
};
export const relDay = (iso?: string) => {
  if (!iso) return '';
  const n = daysBetween(today(), iso);
  if (n === 0) return '今天';
  if (n === 1) return '明天';
  if (n === -1) return '昨天';
  return n > 0 ? `${n} 天后` : `${-n} 天前`;
};

export const TONES: Record<Tone, { bg: string; ink: string; dot: string }> = {
  blue: { bg: 'var(--blue-bg)', ink: 'var(--blue-ink)', dot: 'var(--blue)' },
  green: { bg: 'var(--green-bg)', ink: 'var(--green-ink)', dot: 'var(--green)' },
  amber: { bg: 'var(--amber-bg)', ink: 'var(--amber-ink)', dot: 'var(--amber)' },
  red: { bg: 'var(--red-bg)', ink: 'var(--red-ink)', dot: 'var(--red)' },
  grey: { bg: 'var(--grey-bg)', ink: 'var(--grey-ink)', dot: 'var(--grey)' },
};
export const statusOf = (statuses: StatusDef[], key?: string): StatusDef =>
  statuses.find((s) => s.key === key) ?? { key: key || '', label: key || '—', tone: 'grey', owner: 'admin' };

export const mapsDirUrl = (origin: string, stops: string[], destination = origin) => {
  const e = encodeURIComponent;
  const wp = stops.slice(0, 9).map(e).join('%7C');
  return `https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${e(origin)}&destination=${e(destination)}${wp ? `&waypoints=${wp}` : ''}`;
};

export const uid = () => Math.random().toString(36).slice(2, 10);
export const initial = (name?: string) => (name || '?').slice(0, 1);
export const pad = (n: number, w = 4) => String(n).padStart(w, '0');
export const includesAny = (hay: (string | undefined)[], q: string) => {
  const s = q.trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return true;
  return hay.some((h) => (h || '').toLowerCase().replace(/\s+/g, '').includes(s));
};
