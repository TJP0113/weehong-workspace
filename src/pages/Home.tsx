import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { WsCard } from '../components/glass';
import { useMyNotifications, useOpenWorksheets } from '../components/Layout';
import { Empty, Loading, Pill, useUi } from '../components/ui';
import { useApp } from '../lib/app';
import { enablePush } from '../lib/notify';
import { store, useCollection } from '../lib/store';
import { wsTypeLabel, type Inspection, type Machine, type Part, type RentalOrder, type Tone, type Trip, type Worksheet } from '../lib/types';
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
  const closedWs = useCollection<Worksheet>('worksheets', { where: [['status', '==', 'closed']] });
  const [scope, setScope] = useState<'all' | 'mine' | 'late'>('all');
  const [tab, setTab] = useState<'todo' | 'ws' | 'notes' | null>(null);
  const [typeF, setTypeF] = useState('');
  const [whoF, setWhoF] = useState('');
  const [stF, setStF] = useState('');
  const [page, setPage] = useState(0);

  useEffect(() => { const h = () => { if (location.hash === '#notifications') { setTab('notes'); setTimeout(() => document.getElementById('worklist')?.scrollIntoView({ behavior: 'smooth' }), 50); } }; h(); window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h); }, []);

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
  const t0 = today();
  const ws = open || [];
  const isLate = (w: Worksheet) => daysSince(w.statusSince) > general.overdueDays;
  const isMine = (w: Worksheet) => w.assignee === staff!.id || statusOf(statuses, w.status).owner === role;
  const scoped = ws.filter((w) => (scope === 'mine' ? isMine(w) : scope === 'late' ? isLate(w) : true));
  const cnt = (k: string) => scoped.filter((w) => w.status === k).length;
  const late = ws.filter(isLate);

  // closed per weekday this week (Mon..Sat) and per month (last 12)
  const monday = (() => { const d = new Date(t0); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return d.toISOString().slice(0, 10); })();
  const week = Array.from({ length: 6 }, (_, i) => { const d = new Date(monday); d.setDate(d.getDate() + i); const k = d.toISOString().slice(0, 10); return (closedWs || []).filter((w) => w.statusSince?.slice(0, 10) === k).length; });
  const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(t0.slice(0, 7) + '-01'); d.setMonth(d.getMonth() - 11 + i); const k = d.toISOString().slice(0, 7); return (closedWs || []).filter((w) => w.statusSince?.slice(0, 7) === k).length; });
  const thisMonth = months[11];
  const lastMonth = months[10];
  const peak = Math.max(1, ...week);
  const pk = week.indexOf(Math.max(...week));
  const pts = week.map((n, i) => [i * 64, 100 - (n / peak) * 70] as const);
  const path = pts.map(([x, y], i) => (i === 0 ? `M${x} ${y}` : `C${pts[i - 1][0] + 32} ${pts[i - 1][1]} ${x - 32} ${y} ${x} ${y}`)).join(' ');

  // dark section
  const todos = data?.todos || [];
  const curTab = tab ?? 'ws';
  const people = [...new Set(ws.map((w) => w.assigneeName).filter(Boolean))] as string[];
  const list = scoped.filter((w) => (!typeF || w.type === typeF) && (!whoF || w.assigneeName === whoF) && (!stF || w.status === stF))
    .sort((a, b) => (a.statusSince > b.statusSince ? 1 : -1));
  const PER = 8;
  const pages = Math.max(1, Math.ceil(list.length / PER));
  const pg = Math.min(page, pages - 1);
  const shown = list.slice(pg * PER, pg * PER + PER);
  const types = [...new Set(ws.map((w) => w.type))];

  return (
    <>
      <section className="hero home-hero nophoto" aria-label="今天">
        <div className="hero-col">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <span className="datechip">{fmtMD(t0)} · {fmtWeekday(t0)}</span>
            <span className="k">{hello}，{staff!.name} · {data?.summary ?? '载入中'}</span>
          </div>
          <h1 data-i18n-join="">今日<br />工作</h1>
          {(role === 'admin' || role === 'warehouse') && <Link className="btn" style={{ alignSelf: 'flex-start' }} to="/worksheets/new"><Icon name="plus" />新建工作表</Link>}
          <section className="card" aria-label="本周结案趋势" style={{ maxWidth: 380 }}>
            <h2>本周结案趋势</h2>
            {Math.max(...week) === 0 ? <p className="k" style={{ margin: 0, padding: '18px 0' }}>本周还没有结案的工作表，结案后会显示每天的数量。</p> : <svg viewBox="-6 -4 332 114" width="100%" role="img" aria-label={`本周每天结案数：${week.join('、')}`}>
              <defs><pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2.4" height="7" fill="rgba(11,26,48,0.4)" /></pattern></defs>
              <path d={`${path} L320 110 L0 110Z`} fill="url(#hatch)" />
              <path d={path} fill="none" stroke="#0B1A30" strokeWidth="2" />
              <line x1={pts[pk][0]} y1={pts[pk][1]} x2={pts[pk][0]} y2="110" stroke="#0B1A30" strokeDasharray="3 3" />
              <rect x={Math.min(Math.max(pts[pk][0] - 24, 0), 272)} y={Math.max(pts[pk][1] - 30, -4)} width="48" height="22" rx="11" fill="#D2F45C" />
              <text x={Math.min(Math.max(pts[pk][0], 24), 296)} y={Math.max(pts[pk][1] - 15, 11)} textAnchor="middle" fontSize="12" fontWeight="700" fill="#0B1A30">{week[pk]} 张</text>
              <circle cx={pts[pk][0]} cy={pts[pk][1]} r="5" fill="#D2F45C" stroke="#0B1A30" strokeWidth="2" />
            </svg>}
            <div className="k" style={{ display: 'flex', justifyContent: 'space-between' }}>{['一', '二', '三', '四', '五', '六'].map((d, i) => <span key={d} style={i === pk ? { color: 'var(--ink)', fontWeight: 700 } : undefined}>{d}</span>)}</div>
          </section>
        </div>

        <div className="hero-col right">
          <section className="card" aria-label="进行中的工作表">
            <h2>进行中的工作表</h2>
            <div className="bignums">
              <div><b className="num">{cnt('pending')}</b><span>待维修</span></div>
              <div><b className="num">{cnt('repairing')}</b><span>维修中</span></div>
              <div className={cnt('waiting_parts') ? 'amber' : ''}><b className="num">{cnt('waiting_parts')}</b><span>等待零件</span></div>
              <div><b className="num">{scoped.filter((w) => ['repaired', 'clerk', 'review'].includes(w.status)).length}</b><span>文员 / 检查</span></div>
            </div>
            <div className="seg" role="tablist" aria-label="范围">
              {([['all', '全部'], ['mine', '我负责'], ['late', '超时']] as const).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={scope === k} className={scope === k ? 'on' : ''} style={{ flex: 1 }} onClick={() => { setScope(k); setPage(0); setTab('ws'); }}>{l}</button>)}
            </div>
          </section>
          <div className="duo">
            <section className="card" aria-label="超时">
              <h2>超时</h2>
              <b className="bigone num">{late.length}<small style={{ color: late.length ? 'var(--red-ink)' : undefined }}> 张</small></b>
              <div className="meter"><i style={{ width: `${ws.length ? (late.length / ws.length) * 100 : 0}%` }} /></div>
              <div className="k" style={{ display: 'flex', justifyContent: 'space-between' }}><span>超过 {general.overdueDays} 天</span><span>共 {ws.length} 张</span></div>
            </section>
            <section className="card" aria-label="本月结案">
              <h2>本月结案</h2>
              <b className="bigone num">{thisMonth}{lastMonth > 0 && <small style={{ color: thisMonth >= lastMonth ? 'var(--green-ink)' : 'var(--red-ink)' }}> {thisMonth >= lastMonth ? '+' : ''}{Math.round(((thisMonth - lastMonth) / lastMonth) * 100)}%</small>}</b>
              <div className="spark" aria-hidden="true">{months.map((n, i) => <i key={i} style={{ height: `${Math.max(8, (n / Math.max(1, ...months)) * 100)}%`, background: i === 11 ? '#0B1A30' : undefined }} />)}</div>
            </section>
          </div>
        </div>
      </section>

      <section className="darkzone" id="worklist" aria-label="工作列表">
        <div className="dzbar">
          <div className="dseg" role="tablist">
            <button type="button" role="tab" aria-selected={curTab === 'todo'} className={curTab === 'todo' ? 'on' : ''} onClick={() => setTab('todo')}>要处理 <span className="num">{todos.length}</span></button>
            <button type="button" role="tab" aria-selected={curTab === 'ws'} className={curTab === 'ws' ? 'on' : ''} onClick={() => setTab('ws')}>工作表 <span className="num">{list.length}</span></button>
            <button type="button" role="tab" aria-selected={curTab === 'notes'} className={curTab === 'notes' ? 'on' : ''} onClick={() => setTab('notes')}>通知{unread.length ? <span className="num red">{unread.length}</span> : null}</button>
          </div>
          {curTab === 'ws' && <>
            <label className="fpill"><span className="sr">类型</span><select value={typeF} onChange={(e) => { setTypeF(e.target.value); setPage(0); }}><option value="">全部类型</option>{types.map((t) => <option key={t} value={t}>{wsTypeLabel(t)}</option>)}</select><Icon name="chev" size={14} /></label>
            <label className="fpill"><span className="sr">维修员</span><select value={whoF} onChange={(e) => { setWhoF(e.target.value); setPage(0); }}><option value="">维修员：全部</option>{people.map((p) => <option key={p} value={p}>{p}</option>)}</select><Icon name="chev" size={14} /></label>
            <label className="fpill"><span className="sr">状态</span><select value={stF} onChange={(e) => { setStF(e.target.value); setPage(0); }}><option value="">状态：进行中</option>{statuses.filter((x) => x.key !== 'closed').map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select><Icon name="chev" size={14} /></label>
          </>}
          {curTab === 'notes' && unread.length > 0 && <button className="fpill" type="button" onClick={markAll}>全部标为已读</button>}
          {(role === 'admin' || role === 'warehouse') && <Link className="limebtn" to="/worksheets/new" aria-label="新建工作表" title="新建工作表"><Icon name="plus" size={18} stroke={2.4} /></Link>}
          {curTab === 'ws' && (
            <div className="pager">
              <span className="pgno num">{String(pg + 1).padStart(2, '0')}</span><span className="kd num">/ {String(pages).padStart(2, '0')}</span>
              <button className="dbtn" type="button" aria-label="上一页" disabled={pg === 0} onClick={() => setPage(pg - 1)}><Icon name="left" /></button>
              <button className="dbtn" type="button" aria-label="下一页" disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)}><Icon name="right" /></button>
            </div>
          )}
        </div>

        {curTab === 'todo' && (!data ? <Loading /> : todos.length === 0 ? <p className="kd" style={{ margin: 0 }}>都处理完了，新的工作会在这里出现，也会弹窗通知你。</p> : (
          <div className="wgrid">
            {todos.map((t, i) => (
              <article key={i} className="gdark">
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Pill tone={t.tone}>{t.tag}</Pill></div>
                <b style={{ fontSize: '1.08rem', lineHeight: 1.35 }}>{t.title}</b>
                <span className="kd">{t.sub}</span>
                <Link className="btn" to={t.href}>{t.cta}<Icon name="right" /></Link>
              </article>
            ))}
          </div>
        ))}

        {curTab === 'ws' && (!open ? <Loading /> : shown.length === 0 ? <p className="kd" style={{ margin: 0 }}>没有符合的工作表</p> : (
          <div className="wgrid">
            {shown.map((w) => <WsCard key={w.id} w={w} late={isLate(w)} />)}
          </div>
        ))}

        {curTab === 'notes' && (
          <div className="wgrid">
            {!notes ? <Loading n={2} /> : notes.length === 0 ? <p className="kd" style={{ margin: 0 }}>没有通知</p> : notes.map((n) => {
              const isNew = !(n.readBy || []).includes(staff!.id);
              return (
                <Link key={n.id} to={n.href || '/'} className="gdark" onClick={() => isNew && store.update(`notifications/${n.id}`, { readBy: [...(n.readBy || []), staff!.id] })} style={isNew ? { borderColor: 'rgba(210,244,92,0.5)' } : undefined}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><i style={{ width: 8, height: 8, borderRadius: '50%', background: `var(--${n.tone || 'grey'})` }} /><b style={{ fontWeight: isNew ? 700 : 500 }}>{n.title}</b></span>
                  {n.body && <span className="kd">{n.body}</span>}
                  <span className="kd">{fmtTime(n.createdAt)}</span>
                </Link>
              );
            })}
            <article className="gdark">
              <b>弹窗通知与提示音</b>
              <span className="kd">在这台手机或电脑上接收弹窗通知和提示音</span>
              <button className="btn ghost sm" type="button" onClick={async () => setPushMsg(await enablePush(staff!.id).catch((e) => e.message))}><Icon name="bell" />开启弹窗通知</button>
              {pushMsg && <span className="kd">{pushMsg}</span>}
            </article>
          </div>
        )}
      </section>
    </>
  );
}
