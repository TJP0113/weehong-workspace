import { addDays, myDate, nowIso, type Env } from './env';
import { getDoc, patchDoc, query } from './firestore';
import { gfetch, userToken } from './google';

const CAL = 'https://www.googleapis.com/calendar/v3';

interface Ev { key: string; date: string; summary: string; description: string; colorId: string; link: string }

async function calendarId(env: Env, token: string) {
  let id = await env.KV.get('calendar_id');
  if (id) return id;
  const r = await gfetch(token, `${CAL}/calendars`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ summary: '机械保养与租期', timeZone: 'Asia/Kuala_Lumpur', description: '由维修工作表系统自动建立' }) });
  id = ((await r.json()) as any).id as string;
  await env.KV.put('calendar_id', id);
  await patchDoc(env, 'settings/integrations', { 'google.calendarUrl': `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(id)}` });
  return id;
}

/** event ids must be base32hex (a–v, 0–9) */
async function evId(key: string) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(key)));
  return 'wh' + Array.from(h).map((b) => (b % 32).toString(32)).join('');
}

export async function syncCalendar(env: Env) {
  const token = await userToken(env);
  if (!token) return 0;
  const integ: any = (await getDoc(env, 'settings/integrations')) || {};
  const o = { calMaint: true, calRentEnd: true, calInspection: true, calTrips: true, ...(integ.options || {}) };
  const from = addDays(myDate(), -7);
  const to = addDays(myDate(), 120);
  const inRange = (d?: string) => !!d && d >= from && d <= to;
  const ev: Ev[] = [];
  if (o.calMaint || o.calRentEnd) {
    for (const m of await query(env, 'machines')) {
      if (o.calMaint && m.provider === 'own' && inRange(m.nextMaintenance)) ev.push({ key: `maint:${m.code}:${m.nextMaintenance}`, date: m.nextMaintenance, summary: `保养 · ${m.code} ${m.name}`, description: m.status === 'rented' ? `派人到现场：${m.location}` : `公司内保养 · ${m.location || ''}`, colorId: '6', link: `/rentals/${m.code}` });
      if (o.calRentEnd && m.status === 'rented' && inRange(m.rentEnd)) ev.push({ key: `rentend:${m.code}`, date: m.rentEnd, summary: `租期结束 · ${m.code}`, description: `${m.name} · ${m.client} · 可续租`, colorId: '11', link: `/rentals/${m.code}` });
    }
  }
  if (o.calInspection) for (const i of await query(env, 'inspections', [['result', 'EQUAL', 'booked']])) if (inRange(i.date)) ev.push({ key: `insp:${i.id}`, date: i.date, summary: `${(i.attempt || 1) > 1 ? '复验' : '验车'} · ${i.plate}`, description: `${i.customer}${i.place ? ` · ${i.place}` : ''}`, colorId: '9', link: `/inspections/${i.id}` });
  if (o.calTrips) for (const t of await query(env, 'trips', [['date', 'GREATER_THAN_OR_EQUAL', from]])) if (inRange(t.date)) ev.push({ key: `trip:${t.id}`, date: t.date, summary: `运输 · ${t.title}`, description: `${t.driverName || '未指派'} · ${(t.stops || []).map((s: any) => s.place).join(' → ')}`, colorId: '8', link: '/transport' });
  for (const r of await query(env, 'rentalOrders', [['step', 'LESS_THAN_OR_EQUAL', 3]])) if (inRange(r.start)) ev.push({ key: `deliver:${r.id}`, date: r.start, summary: `交机 · ${r.machineCode} → ${r.client}`, description: `${r.machineName} · ${r.no}`, colorId: '10', link: `/rentals/${r.machineCode}` });

  const cal = await calendarId(env, token);
  const prev: Record<string, string> = JSON.parse((await env.KV.get('calendar_state')) || '{}');
  const next: Record<string, string> = {};
  let changed = 0;
  for (const e of ev) {
    const id = await evId(e.key);
    const body = { summary: e.summary, description: `${e.description}\n${env.APP_URL}${e.link}`, start: { date: e.date }, end: { date: addDays(e.date, 1) }, colorId: e.colorId, reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 15 * 60 }] } };
    const sig = JSON.stringify(body);
    next[id] = sig;
    if (prev[id] === sig) continue;
    const r = await gfetch(token, `${CAL}/calendars/${encodeURIComponent(cal)}/events`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, ...body }) });
    if (r.status === 409) await gfetch(token, `${CAL}/calendars/${encodeURIComponent(cal)}/events/${id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: sig });
    changed++;
  }
  for (const id of Object.keys(prev)) if (!next[id]) { await gfetch(token, `${CAL}/calendars/${encodeURIComponent(cal)}/events/${id}`, { method: 'DELETE' }); changed++; }
  await env.KV.put('calendar_state', JSON.stringify(next));
  await patchDoc(env, 'settings/integrations', { 'google.lastSync': nowIso(), 'google.lastError': '' });
  return changed;
}
