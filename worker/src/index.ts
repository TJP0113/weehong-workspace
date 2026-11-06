import { syncAutoCount } from './autocount';
import { syncCalendar } from './calendar';
import { archiveClosed } from './drive';
import { nowIso, type Env } from './env';
import { getDoc, patchDoc } from './firestore';
import { authUrl, exchangeCode, verifyIdToken } from './google';
import { dailyReminders, sendPending, testPush } from './push';

const json = (env: Env, data: any, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...cors(env) } });
const cors = (env: Env) => ({ 'access-control-allow-origin': env.APP_URL, 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'POST, GET, OPTIONS' });

async function staffOf(env: Env, token: string | null, roles?: string[]) {
  if (!token) throw Object.assign(new Error('请先登录'), { status: 401 });
  const email = await verifyIdToken(env, token);
  const u: any = await getDoc(env, `users/${email}`);
  if (!u || !u.active) throw Object.assign(new Error('不在人员名单'), { status: 403 });
  if (roles && !roles.includes(u.role)) throw Object.assign(new Error('你的角色没有这个权限'), { status: 403 });
  return u;
}

async function googleStep(env: Env, name: string, fn: () => Promise<any>) {
  try { return await fn(); } catch (e: any) {
    console.error(name, e);
    await patchDoc(env, 'settings/integrations', { 'google.lastError': `${name}：${String(e.message || e).slice(0, 180)}` }).catch(() => {});
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors(env) });
    const bearer = req.headers.get('authorization')?.replace(/^Bearer /, '') || null;
    try {
      if (url.pathname === '/') return json(env, { ok: true, service: 'weehong-api', time: nowIso() });

      if (url.pathname === '/api/autocount/sync' && req.method === 'POST') {
        await staffOf(env, bearer, ['admin', 'warehouse']);
        return json(env, await syncAutoCount(env));
      }
      if (url.pathname === '/api/google/sync' && req.method === 'POST') {
        await staffOf(env, bearer, ['admin']);
        const events = await syncCalendar(env);
        const archived = await archiveClosed(env);
        return json(env, { events, archived });
      }
      if (url.pathname === '/api/push/test' && req.method === 'POST') {
        const u = await staffOf(env, bearer);
        return json(env, { sent: await testPush(env, u.id) });
      }

      // Connect a company Google account for Drive + Calendar (admin only)
      if (url.pathname === '/google/connect') {
        await staffOf(env, url.searchParams.get('token'), ['admin']);
        if (!env.GOOGLE_CLIENT_ID) return new Response('还没有设定 GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET', { status: 500 });
        const state = crypto.randomUUID();
        await env.KV.put(`oauth_state:${state}`, url.searchParams.get('return') || env.APP_URL, { expirationTtl: 600 });
        return Response.redirect(authUrl(env, `${url.origin}/google/callback`, state), 302);
      }
      if (url.pathname === '/google/callback') {
        const state = url.searchParams.get('state') || '';
        const back = await env.KV.get(`oauth_state:${state}`);
        if (!back) return new Response('授权已过期，请回到系统重新按“连接 Google 账号”', { status: 400 });
        const tok = await exchangeCode(env, url.searchParams.get('code') || '', `${url.origin}/google/callback`);
        if (!tok.refresh_token) return new Response('Google 没有给出长期授权，请到 Google 账号的“第三方应用”移除本系统后再连接一次', { status: 400 });
        await env.KV.put('google_refresh_token', tok.refresh_token);
        const email = tok.id_token ? JSON.parse(atob(tok.id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).email : '';
        await patchDoc(env, 'settings/integrations', { 'google.connected': true, 'google.email': email, 'google.lastError': '' });
        await googleStep(env, '日历同步', () => syncCalendar(env));
        return Response.redirect(back, 302);
      }
      return json(env, { error: 'not found' }, 404);
    } catch (e: any) {
      return json(env, { error: e.message || String(e) }, e.status || 500);
    }
  },

  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
    if (event.cron === '* * * * *') {
      ctx.waitUntil(sendPending(env).catch((e) => console.error('push', e)));
    } else if (event.cron === '*/15 * * * *') {
      ctx.waitUntil((async () => {
        await syncAutoCount(env).catch((e) => console.error('autocount', e));
        await googleStep(env, '日历同步', () => syncCalendar(env));
        await googleStep(env, 'Drive 存档', () => archiveClosed(env));
      })());
    } else if (event.cron === '0 0 * * *') {
      ctx.waitUntil(dailyReminders(env).then(() => sendPending(env)).catch((e) => console.error('daily', e)));
    }
  },
};
