import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { DarkCard, DarkZone, DGrid, DSearch, DSeg, GlassStat, LimeAdd, PageHero, PROGRESS, Ring, usePaged } from '../components/glass';
import { Fold, Loading, Modal, useUi } from '../components/ui';
import { useApp } from '../lib/app';
import { notify } from '../lib/notify';
import { store, useCollection } from '../lib/store';
import type { Inspection, Tone, Worksheet } from '../lib/types';
import { daysBetween, fmtDate, fmtMD, includesAny, now, relDay, statusOf, today } from '../lib/utils';

export const RESULT: Record<string, [string, Tone]> = { unbooked: ['未预约', 'grey'], booked: ['待验车', 'blue'], pass: ['通过', 'green'], fail: ['不通过', 'red'] };

export function useInspectionActions() {
  const { staff } = useApp();
  const { toast } = useUi();
  return {
    async book(i: Inspection, date: string, place?: string) {
      await store.update(`inspections/${i.id}`, { date, place: place ?? i.place ?? '', result: 'booked' });
      toast(`已预约 ${date} 验车，已加入 Google 日历`);
    },
    async record(i: Inspection, pass: boolean, note: string) {
      const history = [...(i.history || []), { date: i.date || today(), result: pass ? 'pass' : 'fail', note }];
      if (pass) await store.update(`inspections/${i.id}`, { result: 'pass', note: note || '通过，可以交车', history });
      else await store.update(`inspections/${i.id}`, { result: 'unbooked', note: `不通过：${note}`, history, attempt: (i.attempt || 1) + 1, date: '' });
      if (!pass) await notify({ role: 'warehouse' }, `${i.plate} 验车不通过`, `${note} · 需要再开工作表维修`, `/inspections/${i.id}`, 'red');
      await notify({ role: 'admin' }, `${i.plate} 验车${pass ? '通过' : '不通过'}`, `${i.customer}${note ? ` · ${note}` : ''} · ${staff!.name}`, `/inspections/${i.id}`, pass ? 'green' : 'red');
      toast(pass ? '已记录：通过' : '已记录：不通过，已通知货仓管理员开工作表');
    },
  };
}

export default function Inspections() {
  const { can, statuses } = useApp();
  const rows = useCollection<Inspection>('inspections');
  const wss = useCollection<Worksheet>('worksheets', { where: [['type', '==', 'inspection']] });
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [add, setAdd] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [resultFor, setResultFor] = useState<Inspection | null>(null);
  const [bookFor, setBookFor] = useState<Inspection | null>(null);
  const t0 = today();
  const all = rows || [];
  const failed = (x: Inspection) => (x.history || []).some((h) => h.result === 'fail') && x.result !== 'pass';
  const n = (r: string) => all.filter((x) => x.result === r).length;
  const sorted = [...all].sort((a, b) => ((a.date || '9999') > (b.date || '9999') ? 1 : -1));
  const list = sorted.filter((x) => (tab === 'all' || (tab === 'fail' ? failed(x) : x.result === tab)) && includesAny([x.plate, x.customer, x.model], q));
  const { shown, pager, reset } = usePaged(list, 12);
  const wsOf = (i: Inspection) => (wss || []).find((w) => w.id === i.worksheetId);
  const upcoming = sorted.filter((x) => x.result === 'booked' && x.date && x.date >= t0).slice(0, 4);
  const pick = (k: string) => { setTab(k); reset(); };
  return (
    <>
      <PageHero label="验车服务"
        kicker={<span className="datechip">顾客车辆先保养，再由我们送去验车</span>}
        title={<>验车<br />服务</>}
        actions={can('inspection.edit') && <button className="btn" type="button" onClick={() => setAdd(true)}><Icon name="plus" />登记验车</button>}
        left={
          <section className="card" aria-label="近期验车日程">
            <Fold />
            <div className="col" style={{ gap: 2 }}><h2>近期验车日程</h2><span className="k">已同步到 Google 日历</span></div>
            {!rows ? <Loading n={1} /> : upcoming.length === 0 ? <p className="k" style={{ margin: 0 }}>没有已预约的验车</p> : upcoming.map((i) => {
              const w = wsOf(i);
              const ready = w && ['repaired', 'clerk', 'review', 'closed'].includes(w.status);
              return (
                <Link key={i.id} to={`/inspections/${i.id}`} className="sub" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', padding: '10px 12px' }}>
                  <div style={{ width: 40, textAlign: 'center' }}><b style={{ fontSize: '1.3rem', fontWeight: 300, color: i.date === t0 ? 'var(--amber-ink)' : undefined }}>{Number(i.date!.slice(8))}</b><div className="small muted">{relDay(i.date) === '今天' ? '今天' : `${Number(i.date!.slice(5, 7))} 月`}</div></div>
                  <div className="two"><b className="ell">{i.plate} · {i.customer}</b><span className="ell" style={{ color: ready ? 'var(--green-ink)' : w?.status === 'waiting_parts' ? 'var(--amber-ink)' : undefined }}>{!w ? '还没有保养工作表' : ready ? '保养完成，可以验车' : `保养${statusOf(statuses, w.status).label}`}</span></div>
                </Link>
              );
            })}
          </section>
        }
        side={<GlassStat title="验车概况" items={[
          { n: n('booked'), unit: '辆', label: '待验车', onClick: () => pick('booked'), on: tab === 'booked' },
          { n: n('unbooked'), unit: '辆', label: '未预约', tone: n('unbooked') ? 'amber' : undefined, onClick: () => pick('unbooked'), on: tab === 'unbooked' },
          { n: n('pass'), unit: '辆', label: '已通过', onClick: () => pick('pass'), on: tab === 'pass' },
          { n: all.filter(failed).length, unit: '辆', label: '需复验', tone: all.some(failed) ? 'red' : undefined, onClick: () => pick('fail'), on: tab === 'fail' },
        ]} />}
      />
      <DarkZone label="验车车辆" bar={<>
        <DSeg value={tab} onChange={pick} tabs={[{ k: 'all', l: '全部', n: all.length }, { k: 'booked', l: '待验车', n: n('booked') }, { k: 'unbooked', l: '未预约', n: n('unbooked') }, { k: 'pass', l: '已通过', n: n('pass') }]} />
        <DSearch value={q} onChange={(v) => { setQ(v); reset(); }} placeholder="车牌或顾客" />
        {can('inspection.edit') && <LimeAdd onClick={() => setAdd(true)} label="登记验车" />}
        {pager}
      </>}>
        {!rows || !wss ? <Loading /> : shown.length === 0 ? <p className="kd" style={{ margin: 0 }}>没有符合的车辆</p> : (
          <div className="wgrid">
            {shown.map((i) => {
              const w = wsOf(i);
              const pct = w ? PROGRESS[w.status] ?? 0 : 0;
              const left = i.date ? daysBetween(t0, i.date) : null;
              const res = failed(i) ? (i.result === 'booked' ? '待复验' : '不通过') : RESULT[i.result][0];
              const tone = failed(i) ? 'red' : RESULT[i.result][1];
              return (
                <DarkCard key={i.id} plate={i.plate} title={i.customer} sub={`${i.model || ''} · 送车 ${fmtMD(i.receivedAt)}`}
                  chips={[res, i.date ? `${fmtMD(i.date)} 验车${left === 0 ? ' · 今天' : left !== null && left > 0 ? ` · 还有 ${left} 天` : ''}` : '未预约日期', (i.attempt || 1) > 1 ? `第 ${i.attempt} 次` : '']}
                  dot={`var(--${tone})`} meta={w ? `保养${statusOf(statuses, w.status).label} · ${w.no}` : '还没有保养工作表'}
                  ring={i.result === 'pass' ? <Ring pct={100} big="通过" small="验车" /> : <Ring pct={pct} big={`${pct}%`} small="保养" color={failed(i) ? '#FF8A8F' : undefined} />}
                  alert={failed(i)} open={openId === i.id} onToggle={() => setOpenId(openId === i.id ? null : i.id)}>
                  <DGrid rows={[['送车日期', fmtDate(i.receivedAt)], ['验车地点', i.place || '—'], ['保养工作表', w ? <Link to={`/worksheets/${w.id}`}>{w.no}</Link> : '还没开'], ['备注', i.note || '—']]} />
                  <div className="chips">
                    {can('inspection.edit') && i.result === 'booked' && <button className="btn" type="button" onClick={() => setResultFor(i)}>记录结果</button>}
                    {can('inspection.edit') && i.result === 'unbooked' && <button className="btn" type="button" onClick={() => setBookFor(i)}>预约日期</button>}
                    {!w && can('ws.create') && <Link className="btn ghost" to={`/worksheets/new?inspection=${i.id}`}>开保养工作表</Link>}
                    {i.result === 'unbooked' && failed(i) && can('ws.create') && <Link className="btn ghost" to={`/worksheets/new?inspection=${i.id}`}>开维修工作表</Link>}
                    <Link className="btn ghost" to={`/inspections/${i.id}`}>流程详情</Link>
                  </div>
                </DarkCard>
              );
            })}
          </div>
        )}
      </DarkZone>
      {add && <AddInspection onClose={() => setAdd(false)} />}
      {resultFor && <ResultDialog i={resultFor} onClose={() => setResultFor(null)} />}
      {bookFor && <BookDialog i={bookFor} onClose={() => setBookFor(null)} />}
    </>
  );
}

function AddInspection({ onClose }: { onClose: () => void }) {
  const { toast } = useUi();
  const [f, setF] = useState({ plate: '', customer: '', model: '', receivedAt: today(), date: '', place: '' });
  const set = (k: string, v: string) => setF({ ...f, [k]: v });
  const save = async () => {
    await store.add('inspections', { ...f, plate: f.plate.trim().toUpperCase(), result: f.date ? 'booked' : 'unbooked', note: '', attempt: 1, history: [], createdAt: now() });
    await notify({ role: 'warehouse' }, `${f.plate.toUpperCase()} 送来保养后验车`, `${f.customer} · 请开验车保养工作表`, '/inspections');
    toast('已登记，已通知货仓管理员开工作表');
    onClose();
  };
  return (
    <Modal title="登记验车" sub="顾客把车送来保养，再由我们负责送去验车" onClose={onClose}>
      <div className="grid2">
        <div className="field"><label htmlFor="i-p">车牌</label><input id="i-p" className="input" value={f.plate} onChange={(e) => set('plate', e.target.value)} /></div>
        <div className="field"><label htmlFor="i-c">顾客公司</label><input id="i-c" className="input" value={f.customer} onChange={(e) => set('customer', e.target.value)} /></div>
        <div className="field"><label htmlFor="i-m">车型</label><input id="i-m" className="input" value={f.model} onChange={(e) => set('model', e.target.value)} /></div>
        <div className="field"><label htmlFor="i-r">送车日期</label><input id="i-r" type="date" className="input" value={f.receivedAt} onChange={(e) => set('receivedAt', e.target.value)} /></div>
        <div className="field"><label htmlFor="i-d">验车日期（可之后再预约）</label><input id="i-d" type="date" className="input" value={f.date} onChange={(e) => set('date', e.target.value)} /></div>
        <div className="field"><label htmlFor="i-pl">验车地点（选填）</label><input id="i-pl" className="input" value={f.place} onChange={(e) => set('place', e.target.value)} /></div>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="btn ghost" type="button" onClick={onClose}>取消</button><button className="btn" type="button" disabled={!f.plate || !f.customer} onClick={save}>登记</button></div>
    </Modal>
  );
}

export function ResultDialog({ i, onClose }: { i: Inspection; onClose: () => void }) {
  const { record } = useInspectionActions();
  const [pass, setPass] = useState<boolean | null>(null);
  const [note, setNote] = useState('');
  return (
    <Modal title={`记录验车结果 · ${i.plate}`} sub={`${i.customer} · ${fmtMD(i.date)} · 第 ${i.attempt || 1} 次`} onClose={onClose}>
      <div className="grid2"><button type="button" className={`choice ${pass === true ? 'on' : ''}`} style={{ minHeight: 64 }} onClick={() => setPass(true)}>通过</button><button type="button" className={`choice ${pass === false ? 'on' : ''}`} style={{ minHeight: 64, ...(pass === false ? { borderColor: 'var(--red)', background: 'var(--red-bg)' } : {}) }} onClick={() => setPass(false)}>不通过</button></div>
      <div className="field"><label htmlFor="res-n">{pass === false ? '不通过的原因（必填）' : '备注（选填）'}</label><input id="res-n" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={pass === false ? '例如：刹车效能不足' : ''} /></div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="btn ghost" type="button" onClick={onClose}>取消</button><button className="btn" type="button" disabled={pass === null || (pass === false && !note.trim())} onClick={async () => { await record(i, pass!, note.trim()); onClose(); }}>保存结果</button></div>
    </Modal>
  );
}

export function BookDialog({ i, onClose }: { i: Inspection; onClose: () => void }) {
  const { book } = useInspectionActions();
  const [date, setDate] = useState('');
  const [place, setPlace] = useState(i.place || '');
  return (
    <Modal title={`预约验车 · ${i.plate}`} sub={i.customer} onClose={onClose}>
      <div className="grid2"><div className="field"><label htmlFor="b-d">验车日期</label><input id="b-d" type="date" min={today()} className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div><div className="field"><label htmlFor="b-p">验车地点（选填）</label><input id="b-p" className="input" value={place} onChange={(e) => setPlace(e.target.value)} /></div></div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="btn ghost" type="button" onClick={onClose}>取消</button><button className="btn" type="button" disabled={!date} onClick={async () => { await book(i, date, place); onClose(); }}>预约</button></div>
    </Modal>
  );
}
