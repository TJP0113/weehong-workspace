import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useMyNotifications, useOpenWorksheets } from '../components/Layout';
import { Empty, Loading, Pill, Stat, useUi } from '../components/ui';
import { useApp } from '../lib/app';
import { enablePush } from '../lib/notify';
import { store, useCollection } from '../lib/store';
import type { Inspection, Machine, Part, RentalOrder, Tone, Trip, Worksheet } from '../lib/types';
import { daysBetween, daysSince, fmtMD, fmtTime, fmtWeekday, statusOf, today } from '../lib/utils';

interface Todo { tone: Tone; tag: string; title: string; sub: string; cta: string; href: string }

export default function Home() {
  const { staff, role, statuses, general } = useApp();
  const { toast } = useUi();
  const open = useOpenWorksheets();
  const insp = useCollection<Inspection>('inspections', { where: [['result', 'in', ['booked', 'unbooked']]] });
  const orders = useCollection<RentalOrder>('rentalOrders', { where: [['step', '<=', 3]] });
  const trips = useCollection<Trip>('trips', { where: [['date', '==', today()]] });
  const machines = useCollection<Machine>('machines');
  const parts = useCollection<Part>('parts', { where: [['stock', '==', 0]] });
  const { rows: notes, unread } = useMyNotifications();
  const [pushMsg, setPushMsg] = useState('');

  useEffect(() => { if (location.hash === '#notifications') document.getElementById('notifications')?.scrollIntoView(); }, []);

  const data = useMemo(() => {
    if (!open || !insp || !orders || !trips || !machines || !parts) return null;
    const t0 = today();
    const st = (k: string) => statusOf(statuses, k);
    const overdue = open.filter((w) => daysSince(w.statusSince) > general.overdueDays);
    const ws = (w: Worksheet, cta: string, tone: Tone = 'blue', tag?: string): Todo => ({
      tone, tag: tag || st(w.status).label, title: `${w.no} · ${w.plate || w.model || ''}`,
      sub: `${w.customer || ''} · ${st(w.status).label}第 ${daysSince(w.statusSince) + 1} 天${w.waitingParts ? ' · 有零件待料' : ''}`, cta, href: `/worksheets/${w.id}`,
    });
    const todos: Todo[] = [];
    const stats: { n: string; label: string; tone?: 'amber' | 'red'; href?: string }[] = [];
    const inspToday = insp.filter((i) => i.date === t0);
    const myTrips = trips.filter((x) => x.status !== 'done' && (x.driver === staff!.id || role === 'admin' || role === 'clerk'));
    if (role === 'mechanic') {
      const mine = open.filter((w) => ['pending', 'repairing', 'waiting_parts'].includes(w.status) && (!w.assignee || w.assignee === staff!.id));
      mine.sort((a, b) => (a.status === 'repairing' ? -1 : 1) - (b.status === 'repairing' ? -1 : 1));
      const soon = insp.filter((i) => i.date && daysBetween(t0, i.date) <= 1 && mine.some((w) => w.id === i.worksheetId));
      soon.forEach((i) => { const w = mine.find((x) => x.id === i.worksheetId)!; todos.push({ ...ws(w, '继续维修', 'amber', '注意'), sub: `${fmtMD(i.date)} 验车，要在之前完成` }); });
      mine.filter((w) => !soon.some((i) => i.worksheetId === w.id)).forEach((w) => todos.push(ws(w, w.status === 'pending' ? '开始维修' : '继续维修', daysSince(w.statusSince) > general.overdueDays ? 'red' : 'blue')));
      myTrips.filter((x) => x.driver === staff!.id).forEach((x) => todos.push({ tone: 'blue', tag: '行程', title: `${x.no} · ${x.title}`, sub: `${x.stops.length} 个地点 · ${x.vehicle || ''}`, cta: '打开路线', href: '/transport' }));
      stats.push({ n: `${mine.length} 张`, label: '我负责的工作表' }, { n: `${soon.length} 张`, label: '明天前要验车', tone: soon.length ? 'amber' : undefined }, { n: `${myTrips.filter((x) => x.driver === staff!.id).length} 趟`, label: '今天的运输行程', href: '/transport' });
    } else if (role === 'warehouse') {
      const waiting = open.filter((w) => w.status === 'waiting_parts');
      const unbooked = insp.filter((i) => !i.worksheetId);
      const pre = orders.filter((o) => o.step === 1 && !o.worksheetId);
      pre.forEach((o) => todos.push({ tone: 'amber', tag: '新', title: `${o.machineCode} 出租前检查`, sub: `${o.no} · ${o.client} · 需要开工作表`, cta: '新建工作表', href: `/worksheets/new?rental=${o.id}` }));
      unbooked.forEach((i) => todos.push({ tone: 'amber', tag: '新', title: `${i.plate} · ${i.customer}`, sub: '验车车辆还没有保养工作表', cta: '新建工作表', href: `/worksheets/new?inspection=${i.id}` }));
      waiting.forEach((w) => todos.push(ws(w, '查看待料零件', 'amber')));
      parts.slice(0, 3).forEach((p) => todos.push({ tone: 'amber', tag: '库存', title: `${p.name} 库存为 0`, sub: `${p.code} · AutoCount`, cta: '查看零件库', href: '/parts' }));
      stats.push({ n: `${pre.length + unbooked.length} 辆`, label: '等建工作表', tone: pre.length + unbooked.length ? 'amber' : undefined }, { n: `${parts.length} 项`, label: 'AutoCount 库存为 0', tone: parts.length ? 'amber' : undefined, href: '/parts' }, { n: `${open.length} 张`, label: '进行中的工作表', href: '/board' });
    } else if (role === 'clerk') {
      const mine = open.filter((w) => ['repaired', 'clerk'].includes(w.status));
      inspToday.forEach((i) => todos.push({ tone: 'amber', tag: '今天验车', title: `${i.plate} · ${i.customer}`, sub: '验完记录结果', cta: '记录验车结果', href: `/inspections/${i.id}` }));
      mine.forEach((w) => todos.push(ws(w, '处理工作表', w.status === 'repaired' ? 'amber' : 'blue')));
      orders.filter((o) => o.step === 2).forEach((o) => todos.push({ tone: 'blue', tag: '租赁', title: `${o.no} · ${o.machineCode} 交机`, sub: `${o.client} · ${fmtMD(o.start)} 交机 · 开单并安排运输`, cta: '处理订单', href: `/rentals/${o.machineCode}` }));
      const ending = machines.filter((m) => m.status === 'rented' && m.rentEnd && daysBetween(t0, m.rentEnd) <= 7 && daysBetween(t0, m.rentEnd) >= 0);
      ending.forEach((m) => todos.push({ tone: 'amber', tag: '到期', title: `${m.code} 租期 ${fmtMD(m.rentEnd)} 到期`, sub: `${m.client} · 可问顾客是否续租`, cta: '续租', href: `/rentals/${m.code}` }));
      stats.push({ n: `${mine.length} 张`, label: '维修完成，等你处理', tone: mine.length ? 'amber' : undefined }, { n: `${inspToday.length} 辆`, label: '今天验车', tone: inspToday.length ? 'amber' : undefined, href: '/inspections' }, { n: `${orders.filter((o) => o.step === 2).length} 单`, label: '待安排运输', href: '/rentals' });
    } else {
      const toReview = open.filter((w) => w.status === 'review');
      overdue.forEach((w) => todos.push(ws(w, '查看工作表', 'red', '超时')));
      toReview.forEach((w) => todos.push(ws(w, '开始检查', 'amber')));
      orders.filter((o) => o.step === 1 && !o.mechanic).forEach((o) => todos.push({ tone: 'blue', tag: '订单', title: `${o.no} · ${o.client}`, sub: '还没委派维修员', cta: '委派', href: `/rentals/${o.machineCode}` }));
      stats.push({ n: `${toReview.length} 张`, label: '等你检查', tone: toReview.length ? 'amber' : undefined }, { n: `${overdue.length} 张`, label: `超过 ${general.overdueDays} 天未推进`, tone: overdue.length ? 'red' : undefined, href: '/board' }, { n: `${open.length} 张`, label: '进行中的工作表', href: '/board' });
    }
    return { todos, stats, summary: todos.length ? `有 ${todos.length} 件事要处理` : '目前没有待处理的事' };
  }, [open, insp, orders, trips, machines, parts, role, staff, statuses, general.overdueDays]);

  const markAll = async () => {
    await Promise.all(unread.map((n) => store.update(`notifications/${n.id}`, { readBy: [...(n.readBy || []), staff!.id] })));
    toast('已全部标为已读');
  };
  const hour = new Date().getHours();
  const hello = hour < 12 ? '早安' : hour < 18 ? '午安' : '晚安';

  return (
    <>
      <div className="pagehead">
        <div><h1>{hello}，{staff!.name}</h1><p>{fmtMD(today())} {fmtWeekday(today())} · {data?.summary ?? '载入中'}</p></div>
        {role !== 'mechanic' && (role === 'admin' || role === 'warehouse') && <Link className="btn" to="/worksheets/new"><Icon name="plus" />新建工作表</Link>}
      </div>
      {data ? <div className="stats">{data.stats.map((s) => <Stat key={s.label} {...s} />)}</div> : <Loading n={1} />}
      <div className="row">
        <section className="card grow" aria-labelledby="todo">
          <h2 id="todo">现在要处理</h2>
          {!data ? <Loading /> : data.todos.length === 0 ? <Empty title="都处理完了" sub="新的工作会在这里出现，也会弹窗通知你" /> : data.todos.map((t, i) => (
            <article key={i} className="sub" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px 16px', borderLeft: `4px solid var(--${t.tone === 'grey' ? 'line' : t.tone})`, borderRadius: 16, padding: 16 }}>
              <div className="col" style={{ flex: '1 1 240px', gap: 4 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}><Pill tone={t.tone}>{t.tag}</Pill><b style={{ fontSize: '1.05rem' }}>{t.title}</b></div>
                <span className="muted">{t.sub}</span>
              </div>
              <Link className="btn" to={t.href}>{t.cta}</Link>
            </article>
          ))}
        </section>
        <section id="notifications" className="card aside" aria-labelledby="nt">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <h2 id="nt">通知{unread.length ? `（${unread.length}）` : ''}</h2>
            {unread.length > 0 && <button className="btn ghost sm" type="button" onClick={markAll}>全部标为已读</button>}
          </div>
          {!notes ? <Loading n={2} /> : notes.length === 0 ? <p className="muted">没有通知</p> : notes.map((n) => {
            const isNew = !(n.readBy || []).includes(staff!.id);
            return (
              <Link key={n.id} to={n.href || '/'} onClick={() => isNew && store.update(`notifications/${n.id}`, { readBy: [...(n.readBy || []), staff!.id] })} style={{ display: 'flex', gap: 12, padding: 12, borderRadius: 14, background: isNew ? 'var(--accent-soft)' : 'transparent', textDecoration: 'none' }}>
                <span style={{ width: 10, height: 10, marginTop: 6, borderRadius: '50%', flex: 'none', background: `var(--${n.tone === 'grey' || !n.tone ? 'grey' : n.tone})` }} />
                <span className="col" style={{ gap: 3 }}><span style={{ fontWeight: isNew ? 600 : 400 }}>{n.title}</span>{n.body && <span className="small muted">{n.body}</span>}<span className="small muted">{fmtTime(n.createdAt)}</span></span>
              </Link>
            );
          })}
          <div className="sub col" style={{ gap: 8 }}>
            <span className="small">在这台手机或电脑上接收弹窗通知和提示音</span>
            <button className="btn ghost sm" type="button" onClick={async () => setPushMsg(await enablePush(staff!.id).catch((e) => e.message))}><Icon name="bell" />开启弹窗通知</button>
            {pushMsg && <span className="small muted">{pushMsg}</span>}
          </div>
        </section>
      </div>
    </>
  );
}
