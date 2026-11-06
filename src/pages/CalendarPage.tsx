import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Loading } from '../components/ui';
import { useCollection, useDoc } from '../lib/store';
import type { Inspection, Machine, RentalOrder, Trip } from '../lib/types';
import { fmtWeekday, localDate, today } from '../lib/utils';

type Kind = '保养' | '验车' | '租期结束' | '出租交机' | '运输';
const COLORS: Record<Kind, [string, string]> = {
  保养: ['var(--amber-bg)', 'var(--amber-ink)'],
  验车: ['var(--blue-bg)', 'var(--blue-ink)'],
  租期结束: ['var(--red-bg)', 'var(--red-ink)'],
  出租交机: ['var(--green-bg)', 'var(--green-ink)'],
  运输: ['var(--grey-bg)', 'var(--ink2)'],
};
interface Ev { date: string; kind: Kind; title: string; detail: string; href: string }

export function useEvents() {
  const machines = useCollection<Machine>('machines');
  const insp = useCollection<Inspection>('inspections', { where: [['result', '==', 'booked']] });
  const orders = useCollection<RentalOrder>('rentalOrders', { where: [['step', '<=', 3]] });
  const trips = useCollection<Trip>('trips', { where: [['date', '>=', localDate(new Date(Date.now() - 40 * 864e5))]] });
  return useMemo(() => {
    if (!machines || !insp || !orders || !trips) return null;
    const ev: Ev[] = [];
    machines.forEach((m) => {
      if (m.provider === 'own' && m.nextMaintenance) ev.push({ date: m.nextMaintenance, kind: '保养', title: `${m.code} 每月保养`, detail: `${m.name} · ${m.status === 'rented' ? `派人到现场：${m.location}` : `公司内保养 · ${m.location || ''}`}`, href: `/rentals/${m.code}` });
      if (m.status === 'rented' && m.rentEnd) ev.push({ date: m.rentEnd, kind: '租期结束', title: `${m.code} 租期结束`, detail: `${m.name} · ${m.client} · 可续租`, href: `/rentals/${m.code}` });
    });
    insp.forEach((i) => i.date && ev.push({ date: i.date, kind: '验车', title: `${i.plate} ${(i.attempt || 1) > 1 ? '复验' : '验车'}`, detail: `${i.customer} · ${i.model || ''}${i.place ? ` · ${i.place}` : ''}`, href: `/inspections/${i.id}` }));
    orders.forEach((o) => ev.push({ date: o.start, kind: '出租交机', title: `${o.machineCode} 交机给${o.client}`, detail: `${o.machineName} · ${o.no}`, href: `/rentals/${o.machineCode}` }));
    trips.forEach((t) => ev.push({ date: t.date, kind: '运输', title: `${t.no} ${t.title}`, detail: `${t.driverName || '未指派'} · ${t.stops.length} 个地点${t.time ? ` · ${t.time}` : ''}`, href: '/transport' }));
    return ev;
  }, [machines, insp, orders, trips]);
}

export default function CalendarPage() {
  const events = useEvents();
  const google = useDoc<{ google?: { connected?: boolean; calendarUrl?: string } }>('settings/integrations');
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [sel, setSel] = useState(today());
  const [off, setOff] = useState<Kind[]>([]);
  if (!events) return <Loading />;
  const shown = events.filter((e) => !off.includes(e.kind));
  const start = new Date(month); start.setDate(1 - start.getDay());
  const weeks = Math.ceil((month.getDay() + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7);
  const cells = Array.from({ length: weeks * 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return localDate(d); });
  const agenda = shown.filter((e) => e.date === sel);
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const t0 = today();
  return (
    <>
      <div className="pagehead">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h1>日历</h1>
          <button className="iconbtn" type="button" aria-label="上个月" onClick={() => shift(-1)}><Icon name="left" /></button>
          <b style={{ minWidth: 120, textAlign: 'center', fontSize: '1.1rem' }}>{month.getFullYear()} 年 {month.getMonth() + 1} 月</b>
          <button className="iconbtn" type="button" aria-label="下个月" onClick={() => shift(1)}><Icon name="right" /></button>
          <button className="btn ghost sm" type="button" onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); setSel(t0); }}>今天</button>
        </div>
        <a className="btn ghost" href={google?.google?.calendarUrl || 'https://calendar.google.com'} target="_blank" rel="noreferrer"><Icon name="ext" />在 Google 日历中打开</a>
      </div>
      <div className="chips" role="group" aria-label="显示的事件类型">
        {(Object.keys(COLORS) as Kind[]).map((k) => {
          const on = !off.includes(k);
          return <button key={k} type="button" aria-pressed={on} onClick={() => setOff(on ? [...off, k] : off.filter((x) => x !== k))} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 40, padding: '0 14px', borderRadius: 999, border: `1.5px solid ${on ? COLORS[k][1] : 'var(--line)'}`, background: on ? COLORS[k][0] : 'transparent', color: on ? 'var(--ink)' : 'var(--muted)', cursor: 'pointer' }}><span style={{ width: 10, height: 10, borderRadius: 3, background: COLORS[k][1] }} />{k}<span className="muted">{events.filter((e) => e.kind === k && e.date.slice(0, 7) === localDate(month).slice(0, 7)).length}</span></button>;
        })}
      </div>
      <div className="row">
        <section className="card grow" style={{ padding: 16, gap: 8 }} aria-label="月历">
          <div className="cal">{['日', '一', '二', '三', '四', '五', '六'].map((d) => <span key={d} className="k" style={{ textAlign: 'center' }}>{d}</span>)}</div>
          <div className="cal">
            {cells.map((d) => {
              const evs = shown.filter((e) => e.date === d);
              const out = d.slice(0, 7) !== localDate(month).slice(0, 7);
              return (
                <button key={d} type="button" aria-pressed={d === sel} aria-label={`${d}，${evs.length} 项安排`} onClick={() => setSel(d)} className={`calcell ${out ? 'out' : ''} ${d === sel ? 'sel' : ''} ${d === t0 ? 'today' : ''}`}>
                  <span className="d">{Number(d.slice(8))}</span>
                  {evs.slice(0, 3).map((e, i) => <span key={i} className="ev" style={{ background: COLORS[e.kind][0], color: COLORS[e.kind][1] }}>{e.title}</span>)}
                  {evs.length > 3 && <span className="small muted" style={{ paddingLeft: 4 }}>还有 {evs.length - 3} 项</span>}
                  <span className="dots">{evs.map((e, i) => <i key={i} style={{ background: COLORS[e.kind][1] }} />)}</span>
                </button>
              );
            })}
          </div>
        </section>
        <section className="card aside" aria-label="当日安排">
          <div className="col" style={{ gap: 4 }}><h2>{Number(sel.slice(5, 7))}月{Number(sel.slice(8))}日 {fmtWeekday(sel)}{sel === t0 ? ' · 今天' : ''}</h2><span className="k">{agenda.length} 项安排</span></div>
          {agenda.length === 0 ? <p className="empty" style={{ margin: 0 }}>这一天没有安排</p> : agenda.map((e, i) => (
            <article key={i} className="sub col" style={{ gap: 8 }}>
              <span className="tag" style={{ alignSelf: 'flex-start', background: COLORS[e.kind][0], color: COLORS[e.kind][1], fontWeight: 600 }}>{e.kind}</span>
              <b>{e.title}</b>
              <span className="small" style={{ color: 'var(--ink3)', lineHeight: 1.5 }}>{e.detail}</span>
              <Link className="small" to={e.href}>打开 ›</Link>
            </article>
          ))}
        </section>
      </div>
    </>
  );
}
