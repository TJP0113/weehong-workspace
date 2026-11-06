import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Empty, Loading, Modal, Pill, useUi } from '../components/ui';
import { useApp } from '../lib/app';
import { notify } from '../lib/notify';
import { store, useCollection, useDoc } from '../lib/store';
import { RATE_LABEL, type Machine, type Renewal, type RentRate, type RentalOrder, type Worksheet } from '../lib/types';
import { addDays, addMonths, fmtDate, fmtTime, now, today } from '../lib/utils';
import { M_STATUS, ORDER_STEPS } from './Rentals';

export default function RentalDetail() {
  const { code } = useParams();
  const m = useDoc<Machine>(`machines/${code}`);
  const orders = useCollection<RentalOrder>('rentalOrders', { where: [['machineCode', '==', code]] });
  const renewals = useCollection<Renewal>(`machines/${code}/renewals`, { orderBy: ['at', 'desc'] });
  const maint = useCollection<Worksheet>('worksheets', { where: [['machineCode', '==', code]] });
  const { staff, can, role } = useApp();
  const { toast, confirm } = useUi();
  const [renew, setRenew] = useState(false);
  if (m === undefined || !orders) return <Loading />;
  if (m === null) return <Empty title="找不到这台机械" action={<Link className="btn ghost sm" to="/rentals">回到机械租赁</Link>} />;
  const active = orders.filter((o) => o.step <= 3).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
  const past = orders.filter((o) => o.step > 3).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const advance = async () => {
    if (!active) return;
    const step = active.step + 1;
    const log = [...(active.log || []), { step: active.step, at: now(), byName: staff!.name }];
    if (step === 4) {
      if (!(await confirm({ title: `确认 ${m.code} 已交机？`, body: `机械状态会改为“在出租”，地点改为 ${active.location}。`, ok: '确认已交机' }))) return;
      await store.update(`machines/${m.code}`, { status: 'rented', client: active.client, location: active.location, rentStart: active.start, rentEnd: active.end, rate: active.rate, nextMaintenance: m.provider === 'own' ? addMonths(active.start, 1) : '' });
    }
    await store.update(`rentalOrders/${active.id}`, { step, log });
    if (step === 2) await notify({ role: 'clerk' }, `${active.no} 检查完成，请开单并安排运输`, `${m.code} 交给 ${active.client} · ${fmtDate(active.start)}`, `/rentals/${m.code}`);
    toast(step === 4 ? '已改为在出租' : `已完成「${ORDER_STEPS[step - 1]}」`);
  };
  const canAdvance = active && ((active.step === 1 && (role === 'mechanic' || role === 'admin' || role === 'warehouse')) || (active.step >= 2 && can('rent.ship')));
  const actionText = active ? ['', '检查完成，交给文员', '已开单、运输已安排', '确认已交机'][active.step] : '';
  const setStatus = async (status: 'idle' | 'repair') => {
    const prev = { status: m.status, client: m.client || '', location: m.location || '', rentStart: m.rentStart || '', rentEnd: m.rentEnd || '' };
    await store.update(`machines/${m.code}`, status === 'idle' ? { status, client: '', location: '公司场地', rentStart: '', rentEnd: '' } : { status, location: '公司维修场' });
    toast(status === 'idle' ? '已结束租赁，改为在闲置' : '已改为在维修', () => store.update(`machines/${m.code}`, prev));
  };

  const stepState = (i: number) => (!active ? 'done' : i < active.step ? 'done' : i === active.step ? 'cur' : '');
  const stepWho = ['管理员', '维修员；货仓管理员开工作表', '文员 · 开单在系统外完成', '系统自动'];
  return (
    <>
      <Link className="back" to="/rentals"><Icon name="left" />机械租赁管理</Link>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px 16px' }}>
        <h1>{m.code} · {m.name}</h1>
        <Pill tone={M_STATUS[m.status][1]}>{M_STATUS[m.status][0]}</Pill>
      </div>
      <div className="row">
        <section className="card grow">
          {active ? (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }}>
                <div className="col" style={{ gap: 4 }}><h2>租赁订单 {active.no} · 流程进度</h2><span className="k">{active.client} · {fmtDate(active.start)} → {fmtDate(active.end)} · 按{RATE_LABEL[active.rate]} · {active.location}</span></div>
                <span className="small muted">{Math.min(active.step, 4)} / 4 步完成</span>
              </div>
              <ol className="steps">
                {ORDER_STEPS.map((l, i) => {
                  const st = stepState(i);
                  const lg = (active.log || []).find((x) => x.step === i);
                  return (
                    <li key={l} className={`step ${st}`}>
                      <div className="rail"><span className="dot">{st === 'done' ? <Icon name="check" size={14} stroke={3} /> : i + 1}</span><span className="bar" /></div>
                      <div className="body">
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><b style={{ fontSize: '1.05rem', color: st ? undefined : 'var(--muted)' }}>{l}</b><Pill tone={st === 'done' ? 'green' : st === 'cur' ? 'blue' : 'grey'}>{st === 'done' ? '已完成' : st === 'cur' ? '进行中' : '未开始'}</Pill></div>
                        <span className="small" style={{ color: 'var(--ink3)' }}>{i === 1 && active.mechanicName ? `维修员 · ${active.mechanicName}；货仓管理员开工作表` : stepWho[i]}</span>
                        {lg && <span className="small muted">{fmtTime(lg.at)} · {lg.byName}{lg.note ? ` · ${lg.note}` : ''}</span>}
                        {i === 1 && (active.worksheetId ? <Link className="small" to={`/worksheets/${active.worksheetId}`}>打开出租前检查工作表 ›</Link> : st === 'cur' && can('ws.create') && <Link className="btn ghost sm" style={{ alignSelf: 'flex-start' }} to={`/worksheets/new?rental=${active.id}`}>开出租前检查工作表</Link>)}
                        {i === 2 && st === 'cur' && can('transport.edit') && <Link className="btn ghost sm" style={{ alignSelf: 'flex-start' }} to={`/transport?new=交机&place=${encodeURIComponent(active.client)}&address=${encodeURIComponent(active.location)}&task=${encodeURIComponent(`${m.code} 交给 ${active.client}（${active.no}）`)}`}>安排运输行程</Link>}
                        {st === 'cur' && canAdvance && <button className="btn" style={{ alignSelf: 'flex-start', marginTop: 6 }} type="button" onClick={advance}>{actionText}</button>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </>
          ) : (
            <div className="col" style={{ gap: 10 }}>
              <h2>目前没有进行中的订单</h2>
              {m.status === 'rented' && <p className="muted" style={{ margin: 0 }}>正出租给 {m.client}，租期至 {fmtDate(m.rentEnd)}。</p>}
              <div className="chips">
                {m.status === 'rented' && can('rent.renew') && <button className="btn" type="button" onClick={() => setRenew(true)}>续租</button>}
                {m.status === 'rented' && can('rent.ship') && <button className="btn ghost" type="button" onClick={async () => { if (await confirm({ title: `结束 ${m.code} 的租赁？`, body: '机械会改为“在闲置”，地点改为公司场地。', ok: '结束租赁' })) setStatus('idle'); }}>结束租赁（已收回）</button>}
                {m.status !== 'repair' && can('rent.ship') && <button className="btn ghost" type="button" onClick={() => setStatus('repair')}>改为在维修</button>}
                {m.status === 'repair' && can('rent.ship') && <button className="btn ghost" type="button" onClick={() => setStatus('idle')}>修好了，改为在闲置</button>}
              </div>
            </div>
          )}
        </section>
        <div className="col aside" style={{ gap: 20 }}>
          <section className="card">
            <h2>机械资料 <span className="tag" style={{ marginLeft: 6, verticalAlign: 'middle' }}>AutoCount</span></h2>
            <dl className="kv">
              <div><dt>机械代号</dt><dd>{m.code}</dd></div><div><dt>种类</dt><dd>{m.kind}</dd></div>
              <div className="full"><dt>机械名称</dt><dd>{m.name}</dd></div>
              <div className="full"><dt>系列号码</dt><dd className="num">{m.serial || '—'}</dd></div>
              <div><dt>提供方</dt><dd>{m.provider === 'own' ? '本公司' : `供应商 · ${m.supplierName || ''}`}</dd></div>
              <div><dt>目前地点</dt><dd>{m.location || '—'}</dd></div>
              {m.status === 'rented' && <><div><dt>租赁公司</dt><dd>{m.client}</dd></div><div><dt>租期</dt><dd className="num">{fmtDate(m.rentStart)} → {fmtDate(m.rentEnd)}</dd></div></>}
            </dl>
          </section>
          <section className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}><h2>每月保养</h2><span className="small muted">{m.provider === 'own' ? `下次 ${fmtDate(m.nextMaintenance)}` : '供应商负责'}</span></div>
            {m.provider === 'own' && <Link className="btn ghost sm" style={{ alignSelf: 'flex-start' }} to={`/worksheets/new?machine=${m.code}&type=maintenance`}>开保养工作表</Link>}
            {(maint || []).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map((w) => <Link key={w.id} to={`/worksheets/${w.id}`} className="sub small" style={{ display: 'flex', justifyContent: 'space-between', textDecoration: 'none' }}><span>{fmtDate(w.createdAt)} · {w.type === 'prerental' ? '出租前检查' : '保养'}</span><span className="muted">{w.no} ›</span></Link>)}
          </section>
          <section className="card">
            <h2>租赁与续租记录</h2>
            {(renewals || []).map((r) => <div key={r.id} className="sub small col" style={{ gap: 2 }}><b>续租 · 按{RATE_LABEL[r.rate]}</b><span className="muted num">{r.from} → {r.to}{r.note ? ` · ${r.note}` : ''} · {r.by}</span></div>)}
            {past.map((o) => <div key={o.id} className="sub small col" style={{ gap: 2 }}><b>{o.client} · 按{RATE_LABEL[o.rate]}</b><span className="muted num">{o.no} · {o.start} → {o.end}</span></div>)}
            {!renewals?.length && !past.length && <p className="muted small">还没有记录</p>}
          </section>
        </div>
      </div>
      {renew && <RenewDialog m={m} onClose={() => setRenew(false)} />}
    </>
  );
}

function RenewDialog({ m, onClose }: { m: Machine; onClose: () => void }) {
  const { staff } = useApp();
  const { toast } = useUi();
  const from = m.rentEnd ? addDays(m.rentEnd, 1) : today();
  const [end, setEnd] = useState(addMonths(m.rentEnd || today(), 1));
  const [rate, setRate] = useState<RentRate>(m.rate === 'year' ? 'month' : m.rate || 'month');
  const [note, setNote] = useState('');
  const save = async () => {
    const prev = { rentEnd: m.rentEnd, rate: m.rate };
    const rid = await store.add(`machines/${m.code}/renewals`, { from, to: end, rate, note, by: staff!.name, at: now() });
    await store.update(`machines/${m.code}`, { rentEnd: end, rate });
    toast(`已续租至 ${end}`, async () => { await store.remove(`machines/${m.code}/renewals/${rid}`); await store.update(`machines/${m.code}`, prev); });
    onClose();
  };
  return (
    <Modal title="续租" sub={`${m.code} · ${m.name} · ${m.kind}`} onClose={onClose}>
      <dl className="kv sub" style={{ padding: 16 }}>
        <div><dt>租赁公司</dt><dd>{m.client}</dd></div><div><dt>地点</dt><dd>{m.location}</dd></div>
        <div><dt>目前租期</dt><dd className="num">{m.rentStart} → {m.rentEnd}</dd></div><div><dt>目前性质</dt><dd>{m.rate ? RATE_LABEL[m.rate] : '—'}</dd></div>
      </dl>
      <div className="grid2">
        <div className="field"><span className="lbl">续租开始</span><span className="input" style={{ display: 'flex', alignItems: 'center', color: 'var(--muted)' }}>{from}（接原结束日）</span></div>
        <div className="field"><label htmlFor="r-end">新的结束日期</label><input id="r-end" type="date" min={from} className="input" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
      </div>
      <div className="field"><span className="lbl">续租性质</span><div role="radiogroup" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>{(['day', 'week', 'month'] as RentRate[]).map((r) => <button key={r} type="button" role="radio" aria-checked={rate === r} className={`choice ${rate === r ? 'on' : ''}`} onClick={() => setRate(r)}>{RATE_LABEL[r]}</button>)}</div></div>
      <div className="field"><label htmlFor="r-note">备注（选填）</label><input id="r-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="例如：客户来电续租" /></div>
      <span className="small" style={{ color: 'var(--blue-ink)' }}>确认后，租期更新为 {m.rentStart} → {end}，Google 日历的到期日也会更新</span>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="btn ghost" type="button" onClick={onClose}>取消</button><button className="btn" type="button" disabled={!end || end < from} onClick={save}>确认续租</button></div>
    </Modal>
  );
}
