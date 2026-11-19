import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { DarkCard, DarkZone, DSearch, DSeg, FSelect, GlassStat, LimeAdd, PageHero, Ring, usePaged } from '../components/glass';
import { Loading, Modal, useUi } from '../components/ui';
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
  const [view, setView] = useState<'machines' | 'orders'>('machines');
  const [tab, setTab] = useState('');
  const [src, setSrc] = useState('');
  const [kind, setKind] = useState('');
  const [q, setQ] = useState('');
  const [newOrder, setNewOrder] = useState(false);
  const all = machines || [];
  const n = (st: string) => all.filter((m) => m.status === st).length;
  const t0 = today();
  const due = all.filter((m) => m.provider === 'own' && m.nextMaintenance && daysBetween(t0, m.nextMaintenance) <= 30).sort((a, b) => (a.nextMaintenance! > b.nextMaintenance! ? 1 : -1));
  const ending = all.filter((m) => m.status === 'rented' && m.rentEnd && daysBetween(t0, m.rentEnd) >= 0 && daysBetween(t0, m.rentEnd) <= 7).sort((a, b) => (a.rentEnd! > b.rentEnd! ? 1 : -1));
  const list = all.filter((m) => (!tab || m.status === tab) && (!src || m.provider === src) && (!kind || m.kind === kind) && includesAny([m.code, m.name, m.serial, m.client, m.kind], q))
    .sort((a, b) => ((a.status === 'rented' ? a.rentEnd || '9' : '9' + a.code) > (b.status === 'rented' ? b.rentEnd || '9' : '9' + b.code) ? 1 : -1));
  const { shown, pager, reset } = usePaged(list, 12);
  const kinds = [...new Set(all.map((m) => m.kind).filter(Boolean))] as string[];
  const thisMonth = due.filter((m) => m.nextMaintenance!.slice(0, 7) === t0.slice(0, 7)).length;
  return (
    <>
      <PageHero label="机械租赁"
        kicker={<span className="datechip">共 {all.length} 台机械 · 资料来自 AutoCount</span>}
        title={<>租出<br /><b>{n('rented')}</b> 台</>}
        actions={can('rent.order') && <button className="btn" type="button" onClick={() => setNewOrder(true)}><Icon name="plus" />新租赁订单</button>}
        left={<>
          <AutoCountBanner />
          <GlassStat title="机队状况" items={[
            { n: n('rented'), unit: '台', label: '在出租', onClick: () => { setView('machines'); setTab('rented'); reset(); }, on: tab === 'rented' },
            { n: n('idle'), unit: '台', label: '在闲置', onClick: () => { setView('machines'); setTab('idle'); reset(); }, on: tab === 'idle' },
            { n: n('repair'), unit: '台', label: '在维修', tone: n('repair') ? 'amber' : undefined, onClick: () => { setView('machines'); setTab('repair'); reset(); }, on: tab === 'repair' },
          ]}>
            <div className="fleetbar" aria-hidden="true">{[['rented', '#0B1A30'], ['idle', '#D2F45C'], ['repair', '#F0A43A']].map(([k, c]) => <i key={k} style={{ flex: n(k) || 0.0001, background: c }} />)}</div>
          </GlassStat>
        </>}
        side={<>
          <section className="card" aria-label="7 天内到期">
            <h2>7 天内到期</h2>
            {ending.length === 0 ? <p className="k" style={{ margin: 0 }}>7 天内没有租期到期的机械</p> : ending.map((m) => (
              <div key={m.code} style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 8, borderTop: '1px solid var(--sep)' }}>
                <b className="bigone num" style={{ width: 40, fontSize: '1.9rem' }}>{daysBetween(t0, m.rentEnd!)}</b>
                <div className="two" style={{ flex: 1 }}><b className="ell">{m.code} · {m.name}</b><span className="ell">{m.client} · {fmtMD(m.rentEnd)}</span></div>
                {can('rent.renew') && <Link className="btn sm" to={`/rentals/${m.code}`}>续租</Link>}
              </div>
            ))}
          </section>
          <section className="card" aria-label="本月保养">
            <h2>本月保养</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div className="ring light" style={{ background: `conic-gradient(#0B1A30 ${due.length ? Math.round(((due.length - thisMonth) / Math.max(1, due.length)) * 100) : 100}%, rgba(255,255,255,0.55) 0)` }}><span><b>{thisMonth}</b><small>台</small></span></div>
              <div className="two"><b>本月还要保养 {thisMonth} 台</b><span>30 天内共 {due.length} 台 · 供应商机械由供应商负责</span></div>
            </div>
          </section>
        </>}
      />
      <DarkZone label="机械与订单" bar={<>
        <DSeg value={view} onChange={setView} tabs={[{ k: 'machines', l: '机械', n: all.length }, { k: 'orders', l: '租赁订单', n: (orders || []).length }, ]} />
        {view === 'machines' && <>
          <FSelect label="状态" value={tab} onChange={(v) => { setTab(v); reset(); }} all="状态：全部" options={Object.entries(M_STATUS).map(([k, [l]]) => ({ v: k, l }))} />
          <FSelect label="种类" value={kind} onChange={(v) => { setKind(v); reset(); }} all="全部种类" options={kinds.map((k) => ({ v: k, l: k }))} />
          <FSelect label="来源" value={src} onChange={(v) => { setSrc(v); reset(); }} all="全部来源" options={[{ v: 'own', l: '本公司' }, { v: 'supplier', l: '供应商' }]} />
          <DSearch value={q} onChange={(v) => { setQ(v); reset(); }} placeholder="代号、系列号码、租赁公司" />
        </>}
        {can('rent.order') && <LimeAdd onClick={() => setNewOrder(true)} label="新租赁订单" />}
        {view === 'machines' && pager}
      </>}>
        {!machines || !orders ? <Loading /> : view === 'machines' ? (
          shown.length === 0 ? <p className="kd" style={{ margin: 0 }}>没有符合的机械</p> : <>
            <div className="wgrid">
              {shown.map((m) => {
                const rented = m.status === 'rented' && m.rentStart && m.rentEnd;
                const total = rented ? Math.max(1, daysBetween(m.rentStart!, m.rentEnd!)) : 1;
                const left = rented ? daysBetween(t0, m.rentEnd!) : 0;
                const soon = rented && left <= 7;
                const st = M_STATUS[m.status] || ['—', 'grey'];
                return (
                  <DarkCard key={m.code} plate={m.code} title={m.name} sub={`${m.kind || ''} · ${m.client || m.location || '公司场地'}`}
                    chips={[soon ? '快到期' : '', m.provider === 'own' ? '本公司' : `供应商${m.supplierName ? ` · ${m.supplierName}` : ''}`, m.rate && RATE_LABEL[m.rate] ? `按${RATE_LABEL[m.rate]}` : '']}
                    dot={`var(--${st[1]})`} meta={`${st[0]}${rented ? ` · 到 ${fmtMD(m.rentEnd)}` : m.location ? ` · ${m.location}` : ''}`}
                    ring={rented ? <Ring pct={(left / total) * 100} big={left} small="天" color={soon ? '#F0A43A' : undefined} /> : <Ring pct={0} big={st[0].replace('在', '')} small="状态" />}
                    alert={!!soon}>
                    <div className="chips">
                      <Link className="btn" style={{ flex: 1 }} to={`/rentals/${m.code}`}>{m.status === 'rented' && can('rent.renew') ? '续租 / 详情' : '查看详情'}</Link>
                      {m.provider === 'own' && <Link className="btn ghost" to={`/worksheets/new?machine=${m.code}&type=maintenance`}>开保养工作表</Link>}
                    </div>
                  </DarkCard>
                );
              })}
            </div>
            <p className="kd" style={{ margin: 0 }}>机械代号、名称、种类、系列号码、提供方、租赁公司名来自 AutoCount（只读）；状态、地点、租期、性质和保养由本系统记录。</p>
          </>
        ) : (
          orders.length === 0 ? <p className="kd" style={{ margin: 0 }}>没有进行中的订单</p> : (
            <div className="wgrid">
              {orders.map((o) => (
                <DarkCard key={o.id} plate={o.machineCode} title={o.client} sub={`${o.no} · ${o.machineName}`}
                  chips={[`${fmtMD(o.start)} 起`, `按${RATE_LABEL[o.rate]}`, o.mechanicName ? `检查：${o.mechanicName}` : '未委派维修员']}
                  dot="var(--blue)" meta={`现在：${ORDER_STEPS[o.step] || ''}`}
                  ring={<Ring pct={(o.step / (ORDER_STEPS.length - 1)) * 100} big={`${o.step + 1}/${ORDER_STEPS.length}`} small="步骤" />}
                  to={`/rentals/${o.machineCode}`} />
              ))}
            </div>
          )
        )}
      </DarkZone>
      {newOrder && machines && <NewOrderDialog machines={machines} onClose={() => setNewOrder(false)} />}
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
