import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import type { StatusDef, Tone } from '../lib/types';
import { TONES } from '../lib/utils';

/* ---------- pills ---------- */
export function Pill({ tone = 'grey', children }: { tone?: Tone; children: ReactNode }) {
  const t = TONES[tone];
  return <span className="pill" style={{ background: t.bg, color: t.ink }}><i style={{ background: t.ink }} />{children}</span>;
}
export const StatusPill = ({ s }: { s: StatusDef }) => <Pill tone={s.tone}>{s.label}</Pill>;

/* ---------- stat cards ---------- */
export function Stat({ n, label, tone, href }: { n: ReactNode; label: string; tone?: 'amber' | 'red'; href?: string }) {
  const inner = <><b>{n}</b><span>{label}</span></>;
  return href ? <a className={`stat ${tone || ''}`} href={href}>{inner}</a> : <div className={`stat ${tone || ''}`}>{inner}</div>;
}

/* ---------- expandable one-line list ---------- */
export function ExpandList<T extends { id: string }>({ rows, cols, head, summary, detail, empty, initialOpen }: {
  rows: T[]; cols: string; head: ReactNode[]; summary: (r: T) => ReactNode; detail: (r: T) => ReactNode; empty?: ReactNode; initialOpen?: string;
}) {
  const [open, setOpen] = useState<string | undefined>(initialOpen);
  if (!rows.length) return <>{empty ?? <Empty title="没有资料" />}</>;
  return (
    <div role="list">
      <div className="lhead" aria-hidden="true" style={{ gridTemplateColumns: `${cols} 24px` }}>{head.map((h, i) => <span key={i}>{h}</span>)}<span /></div>
      {rows.map((r) => {
        const on = open === r.id;
        return (
          <div key={r.id} className={`lrow ${on ? 'open' : ''}`} role="listitem">
            <button className="lsum" type="button" aria-expanded={on} onClick={() => setOpen(on ? undefined : r.id)} style={{ gridTemplateColumns: `${cols} 24px` }}>
              {summary(r)}
              <span className="chev"><Icon name="chev" /></span>
            </button>
            {on && <div className="ldet">{detail(r)}</div>}
          </div>
        );
      })}
    </div>
  );
}

export function Two({ a, b, strong = true }: { a: ReactNode; b?: ReactNode; strong?: boolean }) {
  return <span className="two"><span className="ell" style={{ fontWeight: strong ? 600 : 400 }}>{a}</span>{b !== undefined && <span className="ell">{b}</span>}</span>;
}

/* ---------- empty / loading / banners ---------- */
export function Empty({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return <div className="empty"><Icon name="ws" size={32} stroke={1.5} /><b style={{ color: 'var(--ink)' }}>{title}</b>{sub && <span>{sub}</span>}{action}</div>;
}
export const Loading = ({ n = 3 }: { n?: number }) => <div className="col" aria-label="加载中">{Array.from({ length: n }, (_, i) => <div key={i} className="skel" />)}</div>;
export function Banner({ tone, title, children, action }: { tone: 'amber' | 'red' | 'blue'; title?: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className={`banner ${tone}`} role={tone === 'blue' ? 'status' : 'alert'}>
      <Icon name={tone === 'blue' ? 'bell' : 'warn'} size={20} stroke={2} style={{ marginTop: 2 }} />
      <div style={{ flex: 1 }}>{title && <b style={{ display: 'block', marginBottom: 2 }}>{title}</b>}{children}</div>
      {action}
    </div>
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className="switch" onClick={() => onChange(!on)}><span /></button>;
}

/* ---------- dialogs + toasts ---------- */
interface ConfirmOpts { title: string; body?: ReactNode; ok?: string; danger?: boolean }
interface Toast { id: number; text: string; undo?: () => void }
interface UiCtx {
  toast: (text: string, undo?: () => void) => void;
  confirm: (o: ConfirmOpts) => Promise<boolean>;
}
const Ctx = createContext<UiCtx>(null as any);
export const useUi = () => useContext(Ctx);

export function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dlg, setDlg] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const seq = useRef(0);
  const toast = useCallback((text: string, undo?: () => void) => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, text, undo }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), undo ? 6000 : 3500);
  }, []);
  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setDlg({ ...o, resolve })), []);
  const close = (v: boolean) => { dlg?.resolve(v); setDlg(null); };
  return (
    <Ctx.Provider value={{ toast, confirm }}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div className="toast" key={t.id} role="status">
            <Icon name="check" size={18} stroke={2.5} style={{ color: 'var(--green)' }} />
            <span>{t.text}</span>
            {t.undo && <button type="button" onClick={() => { t.undo!(); setToasts((x) => x.filter((y) => y.id !== t.id)); }}>撤销</button>}
          </div>
        ))}
      </div>
      {dlg && (
        <Modal title={dlg.title} onClose={() => close(false)}>
          {dlg.body && <div className="muted" style={{ lineHeight: 1.6 }}>{dlg.body}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn ghost" type="button" onClick={() => close(false)}>取消</button>
            <button className={`btn ${dlg.danger ? 'danger' : ''}`} type="button" onClick={() => close(true)} autoFocus>{dlg.ok || '确认'}</button>
          </div>
        </Modal>
      )}
    </Ctx.Provider>
  );
}

export function Modal({ title, sub, onClose, children, wide }: { title: string; sub?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`dialog ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div className="col" style={{ gap: 4 }}><h2>{title}</h2>{sub && <span className="k">{sub}</span>}</div>
          <button className="iconbtn" type="button" aria-label="关闭" onClick={onClose}><Icon name="x" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
