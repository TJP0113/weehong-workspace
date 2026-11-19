/* Building blocks for the liquid-glass page layout: a hero on the blue gradient, glass stat cards,
   and a dark work zone with filter pills, pager and expandable cards with progress rings. */
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../lib/app';
import { useCollection } from '../lib/store';
import { wsTypeLabel, type Worksheet, type WsPart } from '../lib/types';
import { daysSince, statusOf } from '../lib/utils';
import { Icon } from './Icon';
import { Fold } from './ui';

export function PageHero({ kicker, title, sub, actions, photo = false, left, side, label }: {
  kicker?: ReactNode; title: ReactNode; sub?: ReactNode; actions?: ReactNode; photo?: string | false; left?: ReactNode; side?: ReactNode; label?: string;
}) {
  return (
    <section className={`hero home-hero ${photo ? '' : 'nophoto'}`} aria-label={label}>
      <div className="hero-col">
        {kicker && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>{kicker}</div>}
        <h1>{title}</h1>
        {sub && <p className="hero-sub">{sub}</p>}
        {actions && <div className="chips">{actions}</div>}
        {left}
      </div>
      {photo && <div className="hero-photo"><img src={photo} alt="" width={1280} height={487} /></div>}
      {side && <div className="hero-col right">{side}</div>}
    </section>
  );
}

export interface StatItem { n: ReactNode; unit?: string; label: string; tone?: 'amber' | 'red' | 'green'; href?: string; onClick?: () => void; on?: boolean }
export function GlassStat({ title, items, children, label }: { title: string; items: StatItem[]; children?: ReactNode; label?: string }) {
  return (
    <section className="card" aria-label={label || title}>
      <Fold />
      <h2>{title}</h2>
      <div className="bignums">
        {items.map((x) => {
          const inner = <><b className="num">{x.n}{x.unit && <small style={{ fontSize: '0.85rem', fontWeight: 600, marginLeft: 3 }}>{x.unit}</small>}</b><span>{x.label}</span></>;
          const cls = `${x.tone || ''} ${x.on ? 'on' : ''}`;
          if (x.href) return <Link key={x.label} to={x.href} className={cls}>{inner}</Link>;
          if (x.onClick) return <button key={x.label} type="button" className={`bn ${cls}`} aria-pressed={!!x.on} onClick={x.onClick}>{inner}</button>;
          return <div key={x.label} className={cls}>{inner}</div>;
        })}
      </div>
      {children}
    </section>
  );
}

export function DarkZone({ bar, children, id, label }: { bar?: ReactNode; children: ReactNode; id?: string; label?: string }) {
  return (
    <section className="darkzone" id={id} aria-label={label}>
      {bar && <div className="dzbar">{bar}</div>}
      {children}
    </section>
  );
}

export function DSeg<K extends string>({ tabs, value, onChange, label }: { tabs: { k: K; l: string; n?: number; red?: boolean }[]; value: K; onChange: (k: K) => void; label?: string }) {
  return (
    <div className="dseg" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button key={t.k} type="button" role="tab" aria-selected={value === t.k} className={value === t.k ? 'on' : ''} onClick={() => onChange(t.k)}>
          {t.l}{t.n !== undefined && <span className={`num ${t.red && t.n ? 'red' : ''}`}>{t.n}</span>}
        </button>
      ))}
    </div>
  );
}

export function FSelect({ label, value, onChange, all, options }: { label: string; value: string; onChange: (v: string) => void; all: string; options: { v: string; l: string }[] }) {
  return (
    <label className="fpill"><span className="sr">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}><option value="">{all}</option>{options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select>
      <Icon name="chev" size={14} />
    </label>
  );
}

export function DSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="fpill dsearch"><Icon name="search" size={16} />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </label>
  );
}

export function LimeAdd({ to, onClick, label }: { to?: string; onClick?: () => void; label: string }) {
  const icon = <Icon name="plus" size={18} stroke={2.4} />;
  return to ? <Link className="limebtn" to={to} aria-label={label} title={label}>{icon}</Link> : <button className="limebtn" type="button" onClick={onClick} aria-label={label} title={label}>{icon}</button>;
}

export function usePaged<T>(list: T[], per = 8) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(list.length / per));
  const pg = Math.min(page, pages - 1);
  return { shown: list.slice(pg * per, pg * per + per), pager: <Pager page={pg} pages={pages} onChange={setPage} />, reset: () => setPage(0) };
}
export function Pager({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  return (
    <div className="pager">
      <span className="pgno num">{String(page + 1).padStart(2, '0')}</span><span className="kd num">/ {String(pages).padStart(2, '0')}</span>
      <button className="dbtn" type="button" aria-label="上一页" disabled={page === 0} onClick={() => onChange(page - 1)}><Icon name="left" /></button>
      <button className="dbtn" type="button" aria-label="下一页" disabled={page >= pages - 1} onClick={() => onChange(page + 1)}><Icon name="right" /></button>
    </div>
  );
}

export function Ring({ pct, big, small, color = '#D2F45C' }: { pct: number; big: ReactNode; small?: string; color?: string }) {
  return (
    <div className="ring" style={{ background: `conic-gradient(${color} ${Math.max(0, Math.min(100, pct))}%, rgba(255,255,255,0.1) 0)` }} role="img" aria-label={`${small || ''} ${typeof big === 'string' || typeof big === 'number' ? big : ''}`}>
      <span><b>{big}</b>{small && <small>{small}</small>}</span>
    </div>
  );
}

/** Dark expandable card: header, chips, status line and a ring; expands to show children. */
export function DarkCard({ plate, title, sub, chips, dot, meta, ring, open, onToggle, children, alert }: {
  plate?: string; title: ReactNode; sub?: ReactNode; chips?: ReactNode[]; dot?: string; meta?: ReactNode; ring?: ReactNode; open?: boolean; onToggle?: () => void; children?: ReactNode; alert?: boolean;
}) {
  return (
    <article className={`gdark wscard ${alert ? 'alert' : ''}`}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {plate && <span className="dplate">{plate}</span>}
        <div className="two" style={{ flex: 1 }}><b className="ell" style={{ fontSize: '1rem' }}>{title}</b>{sub && <span className="kd ell">{sub}</span>}</div>
        {onToggle && <button className="dbtn sm" type="button" aria-expanded={!!open} aria-label={open ? '收起' : '展开'} onClick={onToggle}><Icon name={open ? 'minus' : 'plus'} size={16} stroke={2.2} /></button>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div className="col" style={{ flex: 1, gap: 10 }}>
          {chips && chips.filter(Boolean).length > 0 && <div className="chips" style={{ gap: 6 }}>{chips.filter(Boolean).map((t, i) => <span key={i} className="dchip">{t}</span>)}</div>}
          {meta && <span className="kd" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{dot && <i style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flex: 'none' }} />}{meta}</span>}
        </div>
        {ring}
      </div>
      {open && children && <div className="col dmore">{children}</div>}
    </article>
  );
}

/** Dark key/value grid used inside an expanded dark card. */
export function DGrid({ rows }: { rows: [string, ReactNode][] }) {
  return <dl className="ddl">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
}

export const PROGRESS: Record<string, number> = { pending: 0, repairing: 40, waiting_parts: 30, repaired: 60, clerk: 75, review: 90, closed: 100 };

export function WsCard({ w, open, onToggle, late, extra }: { w: Worksheet; open: boolean; onToggle: () => void; late?: boolean; extra?: ReactNode }) {
  const { statuses } = useApp();
  const st = statusOf(statuses, w.status);
  const parts = useCollection<WsPart>(open ? `worksheets/${w.id}/parts` : null);
  const pct = PROGRESS[w.status] ?? 0;
  const closed = w.status === 'closed';
  return (
    <DarkCard
      plate={w.plate || w.machineCode || '—'} title={w.model || w.no}
      sub={`${w.customer || ''} · ${closed ? `已结案 ${w.statusSince?.slice(0, 10) || ''}` : `${st.label}第 ${daysSince(w.statusSince) + 1} 天`}`}
      chips={[wsTypeLabel(w.type), w.waitingParts && !closed ? `${w.waitingParts} 项待料` : '', w.source?.kind === 'inspection' ? w.source.label.replace(/^验车服务 · /, '') : '']}
      dot={late ? 'var(--red)' : `var(--${st.tone})`} meta={`${st.label} · ${w.assigneeName || '未派工'}`}
      ring={<Ring pct={pct} big={`${pct}%`} small="进度" />} open={open} onToggle={onToggle} alert={late}
    >
      {!parts ? <span className="kd">载入零件…</span> : parts.length === 0 ? <span className="kd">还没有零件</span> : parts.map((p) => (
        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: '0.9rem' }}>
          <span className="ell">{p.name} <span className="kd">{p.position || ''}{p.qty > 1 ? ` × ${p.qty}` : ''}</span></span>
          <span style={{ color: p.state === 'waiting' ? '#F0C77A' : '#7FD8AA', flex: 'none' }}>{p.state === 'waiting' ? '待料' : '已领料'}</span>
        </div>
      ))}
      <div className="chips">
        <Link className="btn" style={{ flex: 1 }} to={`/worksheets/${w.id}`}>打开工作表</Link>
        {extra}
      </div>
    </DarkCard>
  );
}
