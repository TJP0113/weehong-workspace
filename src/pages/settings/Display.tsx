import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { Switch } from '../../components/ui';
import { useApp } from '../../lib/app';
import { enablePush } from '../../lib/notify';
import { store } from '../../lib/store';
import { NOTIFY_KINDS, playSound, usePrefs, type Lang, type SoundKind, type Theme } from '../../lib/prefs';

export default function Display() {
  const [p, set] = usePrefs();
  const { staff } = useApp();
  const [msg, setMsg] = useState('');
  const ring = (on: boolean) => ({ borderColor: on ? 'var(--accent)' : 'var(--line)', borderWidth: 2 });
  return (
    <div className="grid2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, alignItems: 'start' }}>
      <section className="card">
        <div className="col" style={{ gap: 4 }}><h2>主题</h2><span className="k">每人自己选，只影响自己的画面</span></div>
        <div role="radiogroup" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10 }}>
          {([['dark', '深色', 'linear-gradient(135deg,#0A0A0B 50%,#1C1C20 50%)'], ['light', '浅色', 'linear-gradient(135deg,#F4F4F2 50%,#FFFFFF 50%)'], ['system', '跟随系统', 'linear-gradient(90deg,#0A0A0B 50%,#F4F4F2 50%)']] as [Theme, string, string][]).map(([k, l, bg]) => (
            <button key={k} type="button" role="radio" aria-checked={p.theme === k} onClick={() => set({ theme: k })} className="choice col" style={{ gap: 10, padding: 10, ...ring(p.theme === k) }}>
              <span style={{ height: 56, borderRadius: 10, background: bg, border: '1px solid var(--line)' }} /><span style={{ fontWeight: p.theme === k ? 700 : 400 }}>{l}</span>
            </button>
          ))}
        </div>
        <span className="small muted">车间光线强时建议用浅色，减少反光</span>
      </section>
      <section className="card">
        <div className="col" style={{ gap: 4 }}><h2>文字大小</h2><span className="k">大字模式会放大全部文字和按钮</span></div>
        <div className="grid2" style={{ gap: 10 }}>
          {[[false, '标准', 15], [true, '大字', 18]].map(([v, l, px]) => (
            <button key={String(v)} type="button" role="radio" aria-checked={p.large === v} onClick={() => set({ large: v as boolean })} className="choice col" style={{ alignItems: 'flex-start', gap: 6, padding: 14, ...ring(p.large === v) }}>
              <span style={{ fontSize: px as number, fontWeight: 600 }}>维修事项 Aa</span><span className="k">{l as string}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="card">
        <div className="col" style={{ gap: 4 }}><h2>语言</h2><span className="k">导航和常用按钮会切换；零件名称保持 AutoCount 原文</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10 }}>
          {([['zh', '中文'], ['en', 'English'], ['ms', 'Bahasa Melayu']] as [Lang, string][]).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={p.lang === k} onClick={() => { set({ lang: k }); location.reload(); }} className="choice" style={{ minHeight: 52, ...ring(p.lang === k) }}>{l}</button>)}
        </div>
      </section>
      <section className="card">
        <div className="col" style={{ gap: 4 }}><h2>弹窗通知与提示音</h2><span className="k">手机和电脑都会弹出通知，即使没有打开系统</span></div>
        <button className="btn" type="button" onClick={async () => setMsg(await enablePush(staff!.id).catch((e) => e.message))}><Icon name="bell" />在这台设备开启弹窗通知</button>
        {msg && <span className="small muted">{msg}</span>}
        {NOTIFY_KINDS.map((n) => <div key={n.key} className="sub" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 14px' }}><span>{n.label}</span><Switch on={p.notify[n.key] !== false} label={n.label} onChange={(v) => { const notify = { ...p.notify, [n.key]: v }; set({ notify }); store.update(`users/${staff!.id}`, { notify }).catch(() => {}); }} /></div>)}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="k">提示音</span>
          {([['dingdong', '叮咚'], ['beep', '短促'], ['off', '静音']] as [SoundKind, string][]).map(([k, l]) => <button key={k} type="button" aria-pressed={p.sound === k} className={`choice ${p.sound === k ? 'on' : ''}`} style={{ minHeight: 40 }} onClick={() => { set({ sound: k }); playSound(k); }}>{l}</button>)}
          <button className="btn ghost sm" style={{ marginLeft: 'auto' }} type="button" onClick={() => playSound()}><Icon name="sound" />试听</button>
        </div>
        <span className="small muted">iPhone 要先在 Safari 按“分享 → 加到主画面”，从主画面打开后才能收到弹窗通知。</span>
      </section>
    </div>
  );
}
