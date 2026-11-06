import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Empty, Loading, Modal, Pill, useUi } from '../components/ui';
import { nextNo } from '../lib/actions';
import { useApp } from '../lib/app';
import { notify } from '../lib/notify';
import { store, useCollection } from '../lib/store';
import type { Staff, Tone, Trip, TripStop } from '../lib/types';
import { addDays, fmtMD, fmtWeekday, mapsDirUrl, now, today } from '../lib/utils';

const ST: Record<Trip['status'], [string, Tone]> = { planned: ['待出发', 'grey'], active: ['进行中', 'blue'], done: ['已完成', 'green'] };
const KINDS = ['取货', '送货', '交机', '回收机械', '现场保养', '送验车', '其他'];

export default function Transport() {
  const { general, can, staff } = useApp();
  const { toast } = useUi();
  const [params, setParams] = useSearchParams();
  const t0 = today();
  const [tab, setTab] = useState<'week' | 'today' | 'done'>('week');
  const trips = useCollection<Trip>('trips', tab === 'done' ? { where: [['status', '==', 'done']], orderBy: ['date', 'desc'], limit: 50 } : { where: [['date', '>=', tab === 'today' ? t0 : addDays(t0, -1)], ['date', '<=', tab === 'today' ? t0 : addDays(t0, 7)]] });
  const [sel, setSel] = useState<string | null>(null);
  const [newTrip, setNewTrip] = useState<TripStop | null | false>(false);
  const [addStop, setAddStop] = useState(false);

  useEffect(() => {
    if (params.get('new')) {
      setNewTrip({ kind: params.get('new') || '其他', place: params.get('place') || '', address: params.get('address') || '', task: params.get('task') || '', contact: '' });
      setParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = (trips || []).filter((x) => tab === 'done' || x.status !== 'done').sort((a, b) => (a.date + (a.time || '') > b.date + (b.time || '') ? 1 : -1));
  const cur = list.find((x) => x.id === sel) || list[0];
  const edit = can('transport.edit');
  const save = (stops: TripStop[]) => store.update(`trips/${cur!.id}`, { stops });
  const move = (i: number, d: number) => {
    const s = [...cur!.stops];
    const j = i + d;
    if (j < 0 || j >= s.length) return;
    [s[i], s[j]] = [s[j], s[i]];
    save(s);
  };
  const isDriver = cur && cur.driver === staff!.id;

  return (
    <>
      <div className="pagehead">
        <div><h1>交通运输</h1><p>安排员工去多个地点取货、送货、交机或现场保养，按顺序用 Google Maps 导航</p></div>
        {edit && <button className="btn" type="button" onClick={() => setNewTrip(null)}><Icon name="plus" />新增行程</button>}
      </div>
      <div className="row">
        <section className="card aside" style={{ padding: 14, flexBasis: 300 }}>
          <div className="seg" role="tablist">{(['week', 'today', 'done'] as const).map((k) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} style={{ flex: 1 }} onClick={() => { setTab(k); setSel(null); }}>{{ week: '本周', today: '今天', done: '已完成' }[k]}</button>)}</div>
          {!trips ? <Loading /> : list.length === 0 ? <p className="muted">没有行程</p> : list.map((x) => {
            const on = x.id === cur?.id;
            return (
              <button key={x.id} type="button" aria-pressed={on} onClick={() => setSel(x.id)} className="col" style={{ gap: 8, padding: 14, borderRadius: 16, border: `1.5px solid ${on ? 'var(--accent)' : 'var(--line2)'}`, background: on ? 'var(--accent-soft)' : 'var(--card)', textAlign: 'left', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span className="small muted num">{x.no} · {fmtMD(x.date)} {x.date === t0 ? '今天' : fmtWeekday(x.date)}</span><Pill tone={ST[x.status][1]}>{ST[x.status][0]}</Pill></div>
                <b>{x.title}</b>
                <span className="small muted">{x.driverName || '未指派'} · {x.vehicle || '—'} · {x.stops.length} 个地点</span>
              </button>
            );
          })}
        </section>

        {cur ? (
          <section className="card grow">
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }}>
              <div className="col" style={{ gap: 4 }}><span className="small muted num">{cur.no} · {fmtMD(cur.date)} {fmtWeekday(cur.date)}{cur.time ? ` · ${cur.time} 出发` : ''}</span><h2 style={{ fontSize: '1.4rem' }}>{cur.title}</h2></div>
              <Pill tone={ST[cur.status][1]}>{ST[cur.status][0]}</Pill>
            </div>
            <div className="stats">
              <div className="sub col" style={{ flex: '1 1 160px', gap: 4 }}><span className="k">负责员工</span><b>{cur.driverName || '未指派'}</b></div>
              <div className="sub col" style={{ flex: '1 1 160px', gap: 4 }}><span className="k">车辆</span><b>{cur.vehicle || '—'}</b></div>
              <div className="sub col" style={{ flex: '1 1 160px', gap: 4 }}><span className="k">起点 / 终点</span><b className="ell">{general.depotAddress}</b></div>
            </div>
            <div className="row">
              <div className="col" style={{ flex: '1 1 360px', gap: 10 }}>
                <h3>路线 · {cur.stops.length} 个地点</h3>
                <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {cur.stops.map((s, i) => (
                    <li key={i} className="sub" style={{ display: 'flex', gap: 12, opacity: s.done ? 0.6 : 1 }}>
                      <span style={{ width: 28, height: 28, borderRadius: '50%', background: s.done ? 'var(--green)' : 'var(--accent)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: '0.87rem', fontWeight: 700, flex: 'none' }}>{s.done ? <Icon name="check" size={14} stroke={3} /> : i + 1}</span>
                      <div className="col" style={{ flex: 1, gap: 4 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}><span className="tag">{s.kind}</span><b>{s.place}</b></div>
                        {s.task && <span className="small" style={{ color: 'var(--ink3)' }}>{s.task}</span>}
                        <span className="small muted">{s.address}{s.contact ? ` · ${s.contact}` : ''}</span>
                        {(isDriver || edit) && cur.status !== 'done' && <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }} type="button" onClick={() => save(cur.stops.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}>{s.done ? '改回未完成' : '这一站完成'}</button>}
                      </div>
                      {edit && cur.status !== 'done' && (
                        <div className="col" style={{ gap: 4 }}>
                          <button className="iconbtn" style={{ width: 36, height: 36, borderRadius: 8 }} type="button" aria-label={`上移 ${s.place}`} onClick={() => move(i, -1)}><Icon name="up" /></button>
                          <button className="iconbtn" style={{ width: 36, height: 36, borderRadius: 8 }} type="button" aria-label={`下移 ${s.place}`} onClick={() => move(i, 1)}><Icon name="down" /></button>
                          <button className="iconbtn" style={{ width: 36, height: 36, borderRadius: 8 }} type="button" aria-label={`移除 ${s.place}`} onClick={() => { const prev = cur.stops; save(cur.stops.filter((_, j) => j !== i)); toast(`已移除 ${s.place}`, () => save(prev)); }}><Icon name="trash" /></button>
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
                {edit && cur.status !== 'done' && <button className="btn ghost" style={{ borderStyle: 'dashed', minHeight: 48 }} type="button" onClick={() => setAddStop(true)}><Icon name="plus" />新增地点</button>}
                {cur.stops.length > 9 && <span className="small" style={{ color: 'var(--amber-ink)' }}>Google Maps 一次最多导航 9 个中途地点，超过的请分成两趟。</span>}
              </div>
              <div className="col" style={{ flex: '1 1 280px', gap: 10 }}>
                <div className="sub col" style={{ gap: 6, padding: 16 }}><b>路线按左边的顺序走</b><span className="small muted" style={{ lineHeight: 1.6 }}>用箭头调整地点顺序。打开 Google Maps 后会按这个顺序导航，距离、车程和路况都在 Google Maps 里看。</span></div>
                <a className="btn big" href={mapsDirUrl(general.depotAddress, cur.stops.filter((s) => !s.done).map((s) => s.address))} target="_blank" rel="noreferrer"><Icon name="ext" />在 Google Maps 打开路线</a>
                {edit && cur.driver && <button className="btn ghost" type="button" onClick={async () => { await notify(cur.driver!, `行程 ${cur.no}：${cur.title}`, `${fmtMD(cur.date)} ${cur.time || ''} · ${cur.stops.length} 个地点 · 点开看路线`, '/transport', 'blue', 'trip'); toast(`已发送给 ${cur.driverName}`); }}>发送给 {cur.driverName}</button>}
                {(isDriver || edit) && cur.status === 'planned' && <button className="btn ghost" type="button" onClick={() => store.update(`trips/${cur.id}`, { status: 'active' })}>出发</button>}
                {(isDriver || edit) && cur.status === 'active' && <button className="btn ghost" type="button" onClick={async () => { await store.update(`trips/${cur.id}`, { status: 'done' }); toast('行程已完成', () => store.update(`trips/${cur.id}`, { status: 'active' })); }}>整趟完成</button>}
                <span className="small muted">行程会自动加入 Google 日历</span>
              </div>
            </div>
          </section>
        ) : trips && <div className="grow"><Empty title="没有行程" sub="按“新增行程”安排员工去取货或送货" /></div>}
      </div>
      {newTrip !== false && <TripDialog first={newTrip} onClose={() => setNewTrip(false)} onCreated={(id) => { setTab('week'); setSel(id); }} />}
      {addStop && cur && <StopDialog onClose={() => setAddStop(false)} onAdd={(s) => save([...cur.stops, s])} />}
    </>
  );
}

function StopFields({ s, set }: { s: TripStop; set: (s: TripStop) => void }) {
  return (
    <div className="grid2">
      <div className="field" style={{ gridColumn: '1 / -1' }}><span className="lbl">类型</span><div className="chips">{KINDS.map((k) => <button key={k} type="button" className={`choice ${s.kind === k ? 'on' : ''}`} aria-pressed={s.kind === k} onClick={() => set({ ...s, kind: k })}>{k}</button>)}</div></div>
      <div className="field"><label htmlFor="s-p">地点名称</label><input id="s-p" className="input" value={s.place} onChange={(e) => set({ ...s, place: e.target.value })} placeholder="例如：大成机械" /></div>
      <div className="field"><label htmlFor="s-a">地址（Google Maps 用）</label><input id="s-a" className="input" value={s.address} onChange={(e) => set({ ...s, address: e.target.value })} placeholder="例如：Skudai, Johor" /></div>
      <div className="field"><label htmlFor="s-t">要做什么</label><input id="s-t" className="input" value={s.task || ''} onChange={(e) => set({ ...s, task: e.target.value })} /></div>
      <div className="field"><label htmlFor="s-c">联络人 / 电话</label><input id="s-c" className="input" value={s.contact || ''} onChange={(e) => set({ ...s, contact: e.target.value })} /></div>
    </div>
  );
}

function StopDialog({ onClose, onAdd }: { onClose: () => void; onAdd: (s: TripStop) => void }) {
  const [s, set] = useState<TripStop>({ kind: '取货', place: '', address: '', task: '', contact: '' });
  return (
    <Modal title="新增地点" onClose={onClose} wide>
      <StopFields s={s} set={set} />
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="btn ghost" type="button" onClick={onClose}>取消</button><button className="btn" type="button" disabled={!s.place || !s.address} onClick={() => { onAdd(s); onClose(); }}>加入路线</button></div>
    </Modal>
  );
}

function TripDialog({ first, onClose, onCreated }: { first: TripStop | null; onClose: () => void; onCreated: (id: string) => void }) {
  const { general } = useApp();
  const { toast } = useUi();
  const users = useCollection<Staff>('users', { where: [['active', '==', true]] });
  const [f, setF] = useState({ date: today(), time: '09:00', title: first ? `${first.kind} · ${first.place}` : '', driver: '', vehicle: general.vehicles[0] || '' });
  const [stop, setStop] = useState<TripStop>(first || { kind: '取货', place: '', address: '', task: '', contact: '' });
  const save = async () => {
    const d = users?.find((u) => u.id === f.driver);
    const no = await nextNo('T');
    const id = await store.add('trips', { no, ...f, driver: d?.id || null, driverName: d?.name || null, status: 'planned', stops: stop.place ? [stop] : [], createdAt: now() });
    if (d) await notify(d.id, `新行程 ${no}：${f.title}`, `${fmtMD(f.date)} ${f.time} · 点开看路线`, '/transport', 'blue', 'trip');
    toast(d ? `已建立行程，已通知 ${d.name}` : '已建立行程');
    onCreated(id);
    onClose();
  };
  return (
    <Modal title="新增行程" sub="之后可以再加更多地点" onClose={onClose} wide>
      <div className="grid2">
        <div className="field" style={{ gridColumn: '1 / -1' }}><label htmlFor="t-t">行程名称</label><input id="t-t" className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="例如：取零件 + 士乃现场保养" /></div>
        <div className="field"><label htmlFor="t-d">日期</label><input id="t-d" type="date" className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
        <div className="field"><label htmlFor="t-h">出发时间</label><input id="t-h" type="time" className="input" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></div>
        <div className="field"><label htmlFor="t-dr">负责员工</label><select id="t-dr" className="input" value={f.driver} onChange={(e) => setF({ ...f, driver: e.target.value })}><option value="">稍后指派</option>{(users || []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
        <div className="field"><label htmlFor="t-v">车辆</label>{general.vehicles.length ? <select id="t-v" className="input" value={f.vehicle} onChange={(e) => setF({ ...f, vehicle: e.target.value })}>{general.vehicles.map((v) => <option key={v}>{v}</option>)}</select> : <input id="t-v" className="input" value={f.vehicle} onChange={(e) => setF({ ...f, vehicle: e.target.value })} placeholder="可在“设置 · 公司与车辆”加入车辆" />}</div>
      </div>
      <h3>第一个地点</h3>
      <StopFields s={stop} set={setStop} />
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="btn ghost" type="button" onClick={onClose}>取消</button><button className="btn" type="button" disabled={!f.title || !f.date} onClick={save}>建立行程</button></div>
    </Modal>
  );
}
