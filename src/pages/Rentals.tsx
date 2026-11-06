import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { ExpandList, Loading, Modal, Pill, Stat, Two, useUi } from '../components/ui';
import { nextNo } from '../lib/actions';
import { useApp } from '../lib/app';
import { notify } from '../lib/notify';
import { store, useCollection } from '../lib/store';
import { RATE_LABEL, type Machine, type RentRate, type RentalOrder, type Staff, type Tone } from '../lib/types';
import { daysBetween, fmtDate, fmtMD, includesAny, now, today } from '../lib/utils';
import { AutoCountBanner } from './Parts';

export const M_STATUS: Record<string, [string, Tone]> = { rented: ['在出租', 'blue'], idle: ['在闲置', 'grey'], repair: ['在维修', 'amber'] };

export default function Rentals() {
  const { can } = useApp();
  const machines = useCollection<Machine>('machines', { orderBy: ['code', 'asc'] });
  const orders = useCollection<RentalOrder>('rentalOrders', { where: [['step', '<=', 3]] });
  const [tab, setTab] = useState('all');
  const [src, setSrc] = useState('all');
  const [q, setQ] = useState('');
  const [newOrder, setNewOrder] = useState(false);
  if (!machines || !orders) return <Loading />;
  const n = (s: string) => machines.filter((m) => m.status === s).length;
  const t0 = today();
  const due = machines.filter((m) => m.provider === 'own' && m.nextMaintenance && daysBetween(t0, m.nextMaintenance) <= 30).sort((a, b) => (a.nextMaintenance! > b.nextMaintenance! ? 1 : -1));
  const list = machines.filter((m) => (tab === 'all' || m.status === tab) && (src === 'all' || m.provider === src) && includesAny([m.code, m.name, m.serial, m.client, m.kind], q));
  return (
    <>
      <div className="pagehead">
        <div><h1>机械租赁管理</h1><p>公司有 {machines.length} 台机械，{n('rented')} 台正在外面出租 · 机械资料来自 AutoCount</p></div>
        {can('rent.order') && <button className="btn" type="button" onClick={() => setNewOrder(true)}><Icon name="plus" />新租赁订单</button>}
      </div>
      <AutoCountBanner />
      <div className="stats">
        <Stat n={`${n('rented')} 台`} label="在出租" />
        <Stat n={`${n('idle')} 台`} label="在闲置" />
        <Stat n={`${n('repair')} 台`} label="在维修" />
        <Stat n={`${due.filter((m) => m.nextMaintenance!.slice(0, 7) === t0.slice(0, 7)).length} 台`} label="本月要保养" tone={due.length ? 'amber' : undefined} />
      </div>
      <section className="card tight">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', padding: '10px 10px 14px' }}>
          <div className="seg" role="tablist">{[['all', `全部 ${machines.length}`], ['rented', `在出租 ${n('rented')}`], ['idle', `在闲置 ${n('idle')}`], ['repair', `在维修 ${n('repair')}`]].map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
          <div className="seg" role="group" aria-label="来源">{[['all', '全部来源'], ['own', '本公司'], ['supplier', '供应商']].map(([k, l]) => <button key={k} type="button" aria-pressed={src === k} className={src === k ? 'on' : ''} onClick={() => setSrc(k)}>{l}</button>)}</div>
          <label className="searchbox" style={{ maxWidth: 280, height: 40 }}><Icon name="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="代号、系列号码、租赁公司" aria-label="搜索机械" /></label>
        </div>
        <ExpandList rows={list} cols="minmax(0,1.4fr) minmax(0,0.9fr) minmax(0,1.6fr) minmax(0,0.9fr)" head={['机械', '状态', '租赁公司 · 地点', '租期至']}
          summary={(m) => <>
            <Two a={m.code} b={`${m.name} · ${m.kind}`} />
            <span><Pill tone={M_STATUS[m.status]?.[1]}>{M_STATUS[m.status]?.[0]}</Pill></span>
            <Two a={m.client || '—'} b={m.location} />
            <span className="num ell" style={{ color: m.rentEnd && daysBetween(t0, m.rentEnd) <= 7 && m.status === 'rented' ? 'var(--amber-ink)' : undefined }}>{m.status === 'rented' ? fmtDate(m.rentEnd) : '—'}</span>
          </>}
          detail={(m) => <>
            <dl className="dgrid">
              <div><dt>系列号码</dt><dd className="num">{m.serial || '—'}</dd></div>
              <div><dt>提供方</dt><dd><span className="tag">{m.provider === 'own' ? '本公司' : `供应商 · ${m.supplierName || ''}`}</span></dd></div>
              <div><dt>租赁期</dt><dd className="num">{m.status === 'rented' ? `${fmtDate(m.rentStart)} → ${fmtDate(m.rentEnd)}` : '—'}</dd></div>
              <div><dt>性质</dt><dd>{m.rate ? `按${RATE_LABEL[m.rate]}` : '—'}</dd></div>
              <div><dt>下次保养</dt><dd className="num">{m.provider === 'own' ? fmtDate(m.nextMaintenance) : '供应商负责'}</dd></div>
            </dl>
            <div className="chips">
              <Link className="btn sm" to={`/rentals/${m.code}`}>查看详情{m.status === 'rented' && can('rent.renew') ? ' / 续租' : ''}</Link>
              {m.provider === 'own' && <Link className="btn ghost sm" to={`/worksheets/new?machine=${m.code}&type=maintenance`}>开保养工作表</Link>}
            </div>
          </>}
        />
        <p className="small muted" style={{ margin: '14px 16px 2px' }}>机械代号、名称、种类、系列号码、提供方、租赁公司名来自 AutoCount（只读）；状态、地点、租期、性质和保养由本系统记录。</p>
      </section>
      <div className="row">
        <section className="card aside" style={{ flexBasis: 420 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}><h2>保养提醒（30 天内）</h2><span className="small muted">本公司机械每月一次 · 供应商机械由供应商负责</span></div>
          {due.length === 0 ? <p className="muted">30 天内没有要保养的机械</p> : due.map((m) => (
            <div key={m.code} className="sub" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 52, textAlign: 'center' }}><b style={{ fontSize: '1.2rem', color: daysBetween(t0, m.nextMaintenance!) <= 3 ? 'var(--amber-ink)' : undefined }}>{Number(m.nextMaintenance!.slice(8))}</b><div className="small muted">{Number(m.nextMaintenance!.slice(5, 7))} 月</div></div>
              <Two a={`${m.code} · ${m.name}`} b={`${M_STATUS[m.status][0]} · ${m.status === 'rented' ? `派人到现场 · ${m.location}` : `公司内保养 · ${m.location || ''}`}`} />
              <Link className="btn ghost sm" style={{ marginLeft: 'auto' }} to={`/worksheets/new?machine=${m.code}&type=maintenance`}>开保养工作表</Link>
            </div>
          ))}
        </section>
        <section className="card aside" style={{ flexBasis: 420 }}>
          <h2>进行中的租赁订单</h2>
          {orders.length === 0 ? <p className="muted">没有进行中的订单</p> : orders.map((o) => (
            <Link key={o.id} to={`/rentals/${o.machineCode}`} className="sub col" style={{ gap: 10, textDecoration: 'none' }}>
              <span className="small muted num">{o.no} · {fmtMD(o.createdAt)}</span>
              <b>{o.client}</b>
              <span className="small">{o.machineCode} {o.machineName} · {fmtMD(o.start)} 起 · 按{RATE_LABEL[o.rate]}</span>
              <OrderBar step={o.step} />
            </Link>
          ))}
        </section>
      </div>
      {newOrder && <NewOrderDialog machines={machines} onClose={() => setNewOrder(false)} />}
    </>
  );
}

export const ORDER_STEPS = ['接单', '检查 + 工作表', '开单 + 运输', '在出租'];
export function OrderBar({ step }: { step: number }) {
  return (
    <ol aria-label="订单进度" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
      {ORDER_STEPS.map((l, i) => <li key={l} className="col" style={{ gap: 6 }}><span style={{ height: 4, borderRadius: 2, background: i < step ? 'var(--green)' : i === step ? 'var(--accent)' : 'var(--line)' }} /><span className="small" style={{ color: i === step ? 'var(--ink)' : 'var(--muted)', fontWeight: i === step ? 600 : 400 }}>{l}</span></li>)}
    </ol>
  );
}

function NewOrderDialog({ machines, onClose }: { machines: Machine[]; onClose: () => void }) {
  const { staff } = useApp();
  const { toast } = useUi();
  const nav = useNavigate();
  const mechanics = useCollection<Staff>('users', { where: [['role', '==', 'mechanic'], ['active', '==', true]] });
  const idle = machines.filter((m) => m.status === 'idle');
  const [f, setF] = useState({ machine: idle[0]?.code || '', client: '', start: today(), end: '', rate: 'month' as RentRate, location: '', mechanic: '' });
  const ok = f.machine && f.client && f.start && f.end && f.location;
  const save = async () => {
    const m = machines.find((x) => x.code === f.machine)!;
    const mech = mechanics?.find((x) => x.id === f.mechanic);
    const no = await nextNo('RO');
    await store.add('rentalOrders', { no, client: f.client, machineCode: m.code, machineName: m.name, start: f.start, end: f.end, rate: f.rate, location: f.location, step: 1, mechanic: mech?.id || null, mechanicName: mech?.name || null, note: '', createdAt: now(), log: [{ step: 0, at: now(), byName: staff!.name, note: mech ? `委派${mech.name}检查 ${m.code}` : '' }] });
    await notify(mech ? mech.id : { role: 'mechanic' }, `${no} 出租前检查 ${m.code}`, `${f.client} · ${f.start} 起`, `/rentals/${m.code}`);
    await notify({ role: 'warehouse' }, `${no} 需要开出租前检查工作表`, `${m.code} ${m.name}`, `/rentals/${m.code}`);
    toast('已建立订单，已通知维修员和货仓管理员');
    onClose();
    nav(`/rentals/${m.code}`);
  };
  const set = (k: string, v: string) => setF({ ...f, [k]: v });
  return (
    <Modal title="新租赁订单" sub="接收客户订单，委派维修员检查机械" onClose={onClose}>
      <div className="grid2">
        <div className="field"><label htmlFor="o-m">机械（在闲置）</label><select id="o-m" className="input" value={f.machine} onChange={(e) => set('machine', e.target.value)}>{idle.map((m) => <option key={m.code} value={m.code}>{m.code} · {m.name}</option>)}</select></div>
        <div className="field"><label htmlFor="o-c">租赁公司</label><input id="o-c" className="input" value={f.client} onChange={(e) => set('client', e.target.value)} /></div>
        <div className="field"><label htmlFor="o-s">开始日期</label><input id="o-s" type="date" className="input" value={f.start} onChange={(e) => set('start', e.target.value)} /></div>
        <div className="field"><label htmlFor="o-e">结束日期</label><input id="o-e" type="date" className="input" value={f.end} onChange={(e) => set('end', e.target.value)} /></div>
        <div className="field"><span className="lbl">租赁性质</span><div className="chips">{(Object.keys(RATE_LABEL) as RentRate[]).map((r) => <button key={r} type="button" className={`choice ${f.rate === r ? 'on' : ''}`} aria-pressed={f.rate === r} onClick={() => set('rate', r)}>{RATE_LABEL[r]}</button>)}</div></div>
        <div className="field"><label htmlFor="o-l">地点</label><input id="o-l" className="input" value={f.location} onChange={(e) => set('location', e.target.value)} placeholder="客户工地地址" /></div>
        <div className="field" style={{ gridColumn: '1 / -1' }}><label htmlFor="o-me">委派维修员检查</label><select id="o-me" className="input" value={f.mechanic} onChange={(e) => set('mechanic', e.target.value)}><option value="">通知所有维修员</option>{(mechanics || []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
      </div>
      {idle.length === 0 && <p style={{ color: 'var(--amber-ink)', margin: 0 }}>目前没有在闲置的机械</p>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="btn ghost" type="button" onClick={onClose}>取消</button><button className="btn" type="button" disabled={!ok} onClick={save}>建立订单并通知</button></div>
    </Modal>
  );
}
