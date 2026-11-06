import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Loading, Pill } from '../components/ui';
import { useApp } from '../lib/app';
import { useCollection } from '../lib/store';
import type { Inspection, Machine, Part, Tone, Trip, Worksheet } from '../lib/types';
import { fmtDate, includesAny, statusOf } from '../lib/utils';
import { RESULT } from './Inspections';
import { M_STATUS } from './Rentals';

interface Hit { title: string; sub: string; status: string; tone: Tone; href: string }

export default function Search() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  useEffect(() => { setQ(params.get('q') || ''); }, [params]);
  const { statuses } = useApp();
  const ws = useCollection<Worksheet>('worksheets', { orderBy: ['updatedAt', 'desc'], limit: 500 });
  const insp = useCollection<Inspection>('inspections');
  const machines = useCollection<Machine>('machines');
  const trips = useCollection<Trip>('trips', { orderBy: ['date', 'desc'], limit: 200 });
  const parts = useCollection<Part>('parts');
  const term = params.get('q') || '';
  const ready = ws && insp && machines && trips && parts;
  const groups: { name: string; items: Hit[] }[] = ready && term.trim() ? [
    { name: '工作表', items: ws.filter((w) => includesAny([w.no, w.plate, w.customer, w.model, w.serial], term)).map((w) => { const s = statusOf(statuses, w.status); return { title: `${w.no} · ${w.plate || w.model || ''}`, sub: `${w.customer || ''} · ${fmtDate(w.createdAt)}${w.assigneeName ? ` · ${w.assigneeName}` : ''}`, status: s.label, tone: s.tone, href: `/worksheets/${w.id}` }; }) },
    { name: '验车服务', items: insp.filter((i) => includesAny([i.plate, i.customer], term)).map((i) => ({ title: `${i.plate} · 第 ${i.attempt || 1} 次验车`, sub: `${i.customer} · ${i.date ? `预约 ${i.date}` : '未预约'}`, status: RESULT[i.result][0], tone: RESULT[i.result][1], href: `/inspections/${i.id}` })) },
    { name: '机械', items: machines.filter((m) => includesAny([m.code, m.name, m.serial, m.client], term)).map((m) => ({ title: `${m.code} · ${m.name}`, sub: `${m.kind}${m.client ? ` · ${m.client}` : ''}`, status: M_STATUS[m.status][0], tone: M_STATUS[m.status][1], href: `/rentals/${m.code}` })) },
    { name: '交通运输', items: trips.filter((t) => includesAny([t.no, t.title, t.driverName, ...t.stops.map((s) => `${s.place} ${s.task}`)], term)).map((t) => ({ title: `${t.no} · ${t.title}`, sub: `${t.driverName || '未指派'} · ${t.date}`, status: { planned: '待出发', active: '进行中', done: '已完成' }[t.status], tone: (t.status === 'done' ? 'green' : t.status === 'active' ? 'blue' : 'grey') as Tone, href: '/transport' })) },
    { name: '零件', items: parts.filter((p) => includesAny([p.code, p.name], term)).map((p) => ({ title: `${p.name}`, sub: `${p.code} · 库存 ${p.stock ?? '—'} ${p.unit || ''}`, status: p.stock === 0 ? '库存为 0' : 'AutoCount', tone: (p.stock === 0 ? 'amber' : 'grey') as Tone, href: '/parts' })) },
  ].filter((g) => g.items.length) : [];
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  return (
    <>
      <form className="col" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); setParams({ q }); }}>
        <label className="searchbox" style={{ maxWidth: 'none', height: 60, border: '1.5px solid var(--accent)' }}>
          <Icon name="search" size={20} />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} aria-label="全局搜索" style={{ fontSize: '1.2rem', fontWeight: 600 }} placeholder="车牌、机械代号、工作表号、顾客、零件" />
          {term && ready && <span className="small muted">{total} 个结果</span>}
        </label>
        <span className="small muted">可以搜车牌、机械代号、工作表号、顾客公司、零件名称</span>
      </form>
      {!ready ? <Loading /> : !term.trim() ? null : total === 0 ? <div className="empty">找不到「{term}」</div> : groups.map((g) => (
        <section key={g.name} className="card" style={{ gap: 8 }}>
          <h2>{g.name} <span className="muted" style={{ fontWeight: 400 }}>{g.items.length}</span></h2>
          {g.items.slice(0, 20).map((it, i) => (
            <Link key={i} to={it.href} className="sub" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto 16px', alignItems: 'center', gap: 12, minHeight: 56, textDecoration: 'none' }}>
              <span className="two"><b className="ell">{it.title}</b><span className="ell">{it.sub}</span></span>
              <Pill tone={it.tone}>{it.status}</Pill>
              <Icon name="right" />
            </Link>
          ))}
        </section>
      ))}
    </>
  );
}
