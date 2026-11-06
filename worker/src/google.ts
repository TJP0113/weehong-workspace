import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from 'jose';
import type { Env } from './env';

/* ---------- service account (Firestore + push) ---------- */
let cached: { token: string; exp: number } | null = null;

export async function serviceToken(env: Env): Promise<string> {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  const key = await importPKCS8(sa.private_key, 'RS256');
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/cloud-platform' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(sa.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const j: any = await r.json();
  if (!r.ok) throw new Error(`service token: ${JSON.stringify(j)}`);
  cached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return cached.token;
}

/* ---------- verify the app user's Firebase ID token ---------- */
const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
export async function verifyIdToken(env: Env, token: string): Promise<string> {
  const { payload } = await jwtVerify(token, JWKS, { issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`, audience: env.FIREBASE_PROJECT_ID });
  const email = String((payload as any).email || '').toLowerCase();
  if (!email || !(payload as any).email_verified) throw new Error('账号没有验证的电邮');
  return email;
}

/* ---------- OAuth for Google Drive + Calendar (a company Google account) ---------- */
export const OAUTH_SCOPES = ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/calendar', 'openid', 'email'];

export function authUrl(env: Env, redirectUri: string, state: string) {
  const p = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID!, redirect_uri: redirectUri, response_type: 'code', scope: OAUTH_SCOPES.join(' '), access_type: 'offline', prompt: 'consent', state });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

export async function exchangeCode(env: Env, code: string, redirectUri: string) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID!, client_secret: env.GOOGLE_CLIENT_SECRET!, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
  });
  const j: any = await r.json();
  if (!r.ok) throw new Error(j.error_description || j.error || 'Google 授权失败');
  return j as { access_token: string; refresh_token?: string; id_token?: string; expires_in: number };
}

let userCached: { token: string; exp: number } | null = null;
/** Access token for the connected company Google account (Drive + Calendar). null = not connected. */
export async function userToken(env: Env): Promise<string | null> {
  if (userCached && userCached.exp > Date.now() + 60_000) return userCached.token;
  const refresh = await env.KV.get('google_refresh_token');
  if (!refresh || !env.GOOGLE_CLIENT_ID) return null;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ refresh_token: refresh, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET!, grant_type: 'refresh_token' }),
  });
  const j: any = await r.json();
  if (!r.ok) throw new Error(`Google 连接已失效，请到“设置 · 连接与整合”重新连接（${j.error || r.status}）`);
  userCached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return userCached.token;
}

export async function gfetch(token: string, url: string, init: RequestInit = {}) {
  const r = await fetch(url, { ...init, headers: { authorization: `Bearer ${token}`, ...(init.headers || {}) } });
  if (!r.ok && r.status !== 404 && r.status !== 409) throw new Error(`${init.method || 'GET'} ${url.split('?')[0]} → ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r;
}
