import { useEffect, useState } from 'react';

export type Theme = 'dark' | 'light' | 'system';
export type Lang = 'zh' | 'en' | 'ms';
export type SoundKind = 'dingdong' | 'beep' | 'off';
export interface Prefs {
  theme: Theme;
  large: boolean;
  lang: Lang;
  sound: SoundKind;
  notify: Record<string, boolean>;
}
export const NOTIFY_KINDS = [
  { key: 'mine', label: '轮到我处理的工作表' },
  { key: 'overdue', label: '超时提醒' },
  { key: 'due', label: '验车、保养、租期到期' },
  { key: 'trip', label: '交通运输行程更新' },
  { key: 'digest', label: '每天早上的待办摘要' },
];
const KEY = 'weehong-prefs';
const DEF: Prefs = { theme: 'dark', large: false, lang: 'zh', sound: 'dingdong', notify: { mine: true, overdue: true, due: true, trip: true, digest: false } };

let current: Prefs = DEF;
try { current = { ...DEF, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { /* ignore */ }
const subs = new Set<(p: Prefs) => void>();

export function applyPrefs(p: Prefs = current) {
  const dark = p.theme === 'dark' || (p.theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.size = p.large ? 'large' : 'normal';
  document.documentElement.lang = p.lang === 'zh' ? 'zh-Hans' : p.lang;
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#0A0A0B' : '#F4F4F2');
}
export const getPrefs = () => current;
export function setPrefs(patch: Partial<Prefs>) {
  current = { ...current, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* ignore */ }
  applyPrefs(current);
  subs.forEach((s) => s(current));
}
export function usePrefs(): [Prefs, (p: Partial<Prefs>) => void] {
  const [p, set] = useState(current);
  useEffect(() => { subs.add(set); return () => { subs.delete(set); }; }, []);
  return [p, setPrefs];
}

let ctx: AudioContext | null = null;
export function playSound(kind: SoundKind = current.sound) {
  if (kind === 'off') return;
  try {
    ctx = ctx || new (window.AudioContext || (window as any).webkitAudioContext)();
    const tones = kind === 'dingdong' ? [[880, 0, 0.35], [660, 0.22, 0.5]] : [[1200, 0, 0.12]];
    tones.forEach(([f, start, dur]) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      const t = ctx!.currentTime + start;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(ctx!.destination);
      o.start(t);
      o.stop(t + dur + 0.05);
    });
  } catch { /* audio blocked */ }
}
