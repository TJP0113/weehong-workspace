import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { API_URL, DEMO, app, auth, firebaseConfig, VAPID_KEY } from './firebase';
import { playSound } from './prefs';
import { store } from './store';
import type { Role, Tone } from './types';
import { now } from './utils';

/** to: an email address, or a role (everyone with that role gets it). */
export async function notify(to: string | { role: Role }, title: string, body: string, href: string, tone: Tone = 'blue', kind = 'mine') {
  const target = typeof to === 'string' ? to : `${to.role}@role`;
  await store.add('notifications', { to: target, title, body, href, tone, kind, createdAt: now(), readBy: [], pushed: false });
}

/** Registers this browser for pop-up notifications (phone and computer). */
export async function enablePush(email: string): Promise<string> {
  if (DEMO) { playSound(); return '示范模式：只播放提示音，不会真的弹出通知'; }
  if (!(await isSupported())) return '这个浏览器不支持弹窗通知。iPhone 请先把系统“加到主画面”，再从主画面打开。';
  if (!VAPID_KEY) return '还没有设定推送密钥（VITE_FIREBASE_VAPID_KEY）';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return '你没有允许通知，可在浏览器设置里重新开启';
  const reg = await registerSW();
  const token = await getToken(getMessaging(app!), { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
  await store.set(`pushTokens/${token.slice(-40)}`, { email, token, ua: navigator.userAgent.slice(0, 120), at: now() });
  return '已开启。新的通知会在手机或电脑弹出，并有提示音。';
}

/** While the system is open, show incoming pushes in-app and play the chosen sound. */
export async function listenForeground(onMsg: (title: string, body: string) => void) {
  if (DEMO || !(await isSupported()) || Notification.permission !== 'granted') return;
  onMessage(getMessaging(app!), (m) => {
    playSound();
    onMsg(m.notification?.title || m.data?.title || '', m.notification?.body || m.data?.body || '');
  });
}

/** Calls the Cloudflare Worker with the signed-in user's ID token. */
export async function callApi(path: string, body?: any) {
  if (DEMO) throw new Error('示范模式没有连接后端');
  if (!API_URL) throw new Error('还没有设定后端网址（VITE_API_URL）');
  const token = await auth!.currentUser!.getIdToken();
  const r = await fetch(API_URL + path, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body || {}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `请求失败 (${r.status})`);
  return j;
}
export async function apiRedirect(path: string) {
  const token = await auth!.currentUser!.getIdToken();
  window.location.href = `${API_URL}${path}?token=${encodeURIComponent(token)}&return=${encodeURIComponent(window.location.href)}`;
}

export async function registerSW() {
  if (!('serviceWorker' in navigator)) return undefined as any;
  return navigator.serviceWorker.register(`/firebase-messaging-sw.js?config=${encodeURIComponent(JSON.stringify(DEMO ? {} : firebaseConfig))}`);
}
