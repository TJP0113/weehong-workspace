import { addDays, myDate, nowIso, type Env } from './env';
import { addDoc, deleteDoc, getDoc, patchDoc, query } from './firestore';
import { serviceToken } from './google';

/** Sends pop-up notifications (phone + computer) for notification docs that haven't been pushed yet. */
export async function sendPending(env: Env) {
  const pending = await query(env, 'notifications', [['pushed', 'EQUAL', false]], 50);
  if (!pending.length) return 0;
  const users = await query(env, 'users', [['active', 'EQUAL', true]]);
  const tokens = await query(env, 'pushTokens');
  const fcm = await serviceToken(env);
  let sent = 0;
  for (const n of pending) {
    await patchDoc(env, `notifications/${n.id}`, { pushed: true });
    const to: string = n.to || '';
    const kind = n.kind || 'mine';
    const recipients = (to.endsWith('@role') ? users.filter((u: any) => u.role === to.replace('@role', '')) : users.filter((u: any) => u.id === to))
      .filter((u: any) => !u.notify || u.notify[kind] !== false);
    for (const t of tokens.filter((x: any) => recipients.some((u: any) => u.id === x.email))) {
      const link = `${env.APP_URL}${n.href || '/'}`;
      const r = await fetch(`https://fcm.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/messages:send`, {
        method: 'POST',
        headers: { authorization: `Bearer ${fcm}`, 'content-type': 'application/json' },
        body: JSON.stringify({ message: {
          token: t.token,
          notification: { title: n.title, body: n.body || '' },
          data: { title: n.title, body: n.body || '', href: n.href || '/' },
          webpush: { fcm_options: { link }, notification: { icon: `${env.APP_URL}/icon-192.png`, badge: `${env.APP_URL}/icon-192.png`, tag: n.id, renotify: true }, headers: { Urgency: 'high' } },
        } }),
      });
      if (r.ok) sent++;
      else if (r.status === 404 || r.status === 400) await deleteDoc(env, `pushTokens/${t.id}`); // token no longer valid
    }
  }
  return sent;
}

export async function testPush(env: Env, email: string) {
  await addDoc(env, 'notifications', { to: email, title: '测试通知', body: '如果你看到这个弹窗，手机或电脑通知已经设定好了', href: '/', tone: 'green', kind: 'mine', createdAt: nowIso(), readBy: [], pushed: false });
  return sendPending(env);
}

const note = (env: Env, to: string, title: string, body: string, href: string, tone: string, kind: string) =>
  addDoc(env, 'notifications', { to, title, body, href, tone, kind, createdAt: nowIso(), readBy: [], pushed: false });

/** Every morning (08:00 Malaysia time): overdue, due today, rentals ending, daily summary. */
export async function dailyReminders(env: Env) {
  const today = myDate();
  const general: any = (await getDoc(env, 'settings/general')) || {};
  const overdueDays = general.overdueDays || 5;
  const open = await query(env, 'worksheets', [['status', 'NOT_EQUAL', 'closed']]);
  const old = open.filter((w: any) => w.statusSince && (Date.now() - Date.parse(w.statusSince)) / 864e5 > overdueDays);
  for (const w of old.slice(0, 10)) await note(env, 'admin@role', `${w.no} 已超过 ${overdueDays} 天未推进`, `${w.customer || ''} ${w.plate || ''}`, `/worksheets/${w.id}`, 'red', 'overdue');

  const insp = await query(env, 'inspections', [['date', 'EQUAL', today]]);
  for (const i of insp) await note(env, 'clerk@role', `今天验车：${i.plate}`, `${i.customer}${i.place ? ` · ${i.place}` : ''}`, `/inspections/${i.id}`, 'amber', 'due');

  const machines = await query(env, 'machines');
  for (const m of machines) {
    if (m.provider === 'own' && m.nextMaintenance && m.nextMaintenance <= addDays(today, 1) && m.nextMaintenance >= today) {
      await note(env, 'mechanic@role', `${m.code} ${m.nextMaintenance === today ? '今天' : '明天'}要每月保养`, m.status === 'rented' ? `派人到现场：${m.location}` : `公司内保养 · ${m.location || ''}`, `/rentals/${m.code}`, 'amber', 'due');
    }
    if (m.status === 'rented' && m.rentEnd && (m.rentEnd === addDays(today, 3) || m.rentEnd === today)) {
      await note(env, 'clerk@role', `${m.code} 租期${m.rentEnd === today ? '今天' : ' 3 天后'}到期`, `${m.client} · 可问顾客是否续租`, `/rentals/${m.code}`, 'amber', 'due');
    }
  }
  const trips = await query(env, 'trips', [['date', 'EQUAL', today]]);
  for (const t of trips) if (t.driver) await note(env, t.driver, `今天的行程 ${t.no}`, `${(t.stops || []).length} 个地点 · 点开查看 Google Maps 路线`, '/transport', 'blue', 'trip');

  const byRole: Record<string, number> = {
    mechanic: open.filter((w: any) => ['pending', 'repairing'].includes(w.status)).length,
    clerk: open.filter((w: any) => ['repaired', 'clerk'].includes(w.status)).length,
    admin: open.filter((w: any) => w.status === 'review').length,
    warehouse: open.filter((w: any) => w.status === 'waiting_parts').length,
  };
  const label: Record<string, string> = { mechanic: '张工作表待维修', clerk: '张工作表等你处理', admin: '张工作表等你检查', warehouse: '张工作表在等零件' };
  for (const [r, n] of Object.entries(byRole)) if (n) await note(env, `${r}@role`, `早安，今天有 ${n} ${label[r]}`, '点开看“我的工作”', '/', 'blue', 'digest');
}
