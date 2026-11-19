import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AddPartDialog } from '../components/AddPartDialog';
import { FieldInput } from '../components/FieldInput';
import { Icon } from '../components/Icon';
import { TRUCK_PHOTO } from '../components/TruckArt';
import { Empty, ExpandList, Fold, Loading, Pill, useUi } from '../components/ui';
import { addEntry, addPhoto, changeStatus, recountParts, review } from '../lib/actions';
import { useApp } from '../lib/app';
import { NEXT_STEP } from '../lib/defaults';
import { store, useCollection, useDoc } from '../lib/store';
import { roleLabel, wsTypeLabel, type Worksheet, type WsEntry, type WsLog, type WsPart } from '../lib/types';
import { daysSince, fmtDate, fmtTime, initial, statusOf } from '../lib/utils';

const FLOW = ['pending', 'repairing', 'clerk', 'review', 'closed'];
const FLOW_LABEL = ['建表', '维修中', '文员处理', '管理员检查', '结案'];

export default function WorksheetDetail() {
  const { id } = useParams();
  const ws = useDoc<Worksheet>(`worksheets/${id}`);
  const parts = useCollection<WsPart>(`worksheets/${id}/parts`);
  const entries = useCollection<WsEntry>(`worksheets/${id}/entries`, { orderBy: ['at', 'desc'] });
  const logs = useCollection<WsLog>(`worksheets/${id}/logs`, { orderBy: ['at', 'desc'] });
  const { staff, role, can, statuses, fields } = useApp();
  const { toast, confirm } = useUi();
  const [text, setText] = useState('');
  const [adding, setAdding] = useState(false);
  const [editInfo, setEditInfo] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [reviewNote, setReviewNote] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (ws === undefined) return <Loading />;
  if (ws === null) return <Empty title="找不到这张工作表" action={<Link className="btn ghost sm" to="/worksheets">回到工作表</Link>} />;

  const s = statusOf(statuses, ws.status);
  const closed = ws.status === 'closed';
  const flowIdx = Math.max(0, FLOW.indexOf(ws.status === 'waiting_parts' ? 'repairing' : ws.status === 'repaired' ? 'clerk' : ws.status));
  const next = NEXT_STEP[ws.status];
  const nextOwner = next ? statusOf(statuses, next[0]).owner : null;
  const canNext = !!next && can('ws.status') && (role === 'admin' || s.owner === role || (ws.status === 'waiting_parts' && role === 'mechanic'));
  const enabled = fields.filter((f) => f.enabled);
  const canEditField = (fid: string) => !closed && (role === 'admin' || (fields.find((f) => f.id === fid)?.editors || []).includes(role!));

  const doNext = async () => {
    if (!next) return;
    setBusy(true);
    const undo = await changeStatus(ws, next[0], staff!, statuses);
    setBusy(false);
    toast(`已改为「${statusOf(statuses, next[0]).label}」，已通知${roleLabel(nextOwner || '')}`, undo);
  };
  const setWaiting = async (on: boolean) => {
    const undo = await changeStatus(ws, on ? 'waiting_parts' : 'repairing', staff!, statuses, on ? '等待零件' : '零件已到');
    toast(on ? '已改为等待零件，已通知货仓管理员' : '已改回维修中', undo);
  };
  const doReview = async (pass: boolean) => {
    if (pass && !(await confirm({ title: `确认结案 ${ws.no}？`, body: '结案后工作表不能再修改，PDF 会存到 Google Drive。', ok: '确认结案' }))) return;
    if (!pass && !reviewNote.trim()) { toast('退回请写上原因'); return; }
    await review(ws, staff!, pass, reviewNote.trim());
    setReviewNote('');
    toast(pass ? '已结案' : '已退回给维修员');
  };
  const saveInfo = async () => {
    const merged = { ...ws.fields, ...vals };
    const byRole = (r: string) => { const f = fields.find((x) => x.role === r); return f ? merged[f.id] || '' : ''; };
    await store.update(`worksheets/${ws.id}`, { fields: merged, plate: byRole('plate'), customer: byRole('customer'), model: byRole('model'), serial: byRole('serial'), mileage: byRole('mileage'), updatedAt: new Date().toISOString() });
    setEditInfo(false);
    toast('已保存资料');
  };
  const send = async () => {
    if (!text.trim()) return;
    await addEntry(ws.id, staff!, text.trim());
    setText('');
  };
  const onPhoto = async (f?: File) => {
    if (!f) return;
    if (!navigator.onLine) { toast('现在没有网络，照片要等连上网后再上传'); return; }
    toast('照片上传中…');
    try { await addPhoto(ws, staff!, f); toast('照片已上传'); } catch (e: any) { toast(`上传失败：${e.message}`); }
  };

  const nextBlock = (
    <div className="card" style={{ border: '1px solid var(--line)', gap: 10 }}>
      <span className="k">下一步</span>
      {ws.status === 'review' && can('ws.review') ? (
        <>
          <textarea className="input" rows={2} value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder="检查意见（退回时必填）" aria-label="检查意见" />
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn ghost" style={{ flex: 1 }} type="button" onClick={() => doReview(false)}>退回维修</button>
            <button className="btn" style={{ flex: 2 }} type="button" onClick={() => doReview(true)}>检查通过，结案</button>
          </div>
        </>
      ) : closed ? (
        <span>已结案{ws.review ? ` · ${ws.review.by} ${fmtDate(ws.review.at)}` : ''}</span>
      ) : canNext ? (
        <>
          <button className="btn big" type="button" disabled={busy} onClick={doNext}>{next![1]}</button>
          {nextOwner && <span className="small muted">会通知{roleLabel(nextOwner)}（手机和电脑弹窗）</span>}
        </>
      ) : (
        <span className="muted small">目前由{roleLabel(s.owner)}处理</span>
      )}
      {ws.status === 'repairing' && (role === 'mechanic' || role === 'admin' || role === 'warehouse') && <button className="btn ghost sm" type="button" onClick={() => setWaiting(true)}>零件还没到，改为等待零件</button>}
    </div>
  );

  return (
    <>
      <div className="wshead noprint">
        <Link className="iconbtn" to="/board" aria-label="回到工作表看板"><Icon name="left" /></Link>
        <span className="gchip num">{ws.no}</span>
        <span className="gchip">{wsTypeLabel(ws.type)}</span>
        <span className="gchip dark"><i style={{ background: `var(--${s.tone})` }} />{s.label}</span>
        {ws.source && <Link className="gchip" to={ws.source.kind === 'inspection' ? `/inspections/${ws.source.id}` : `/rentals/${ws.machineCode || ''}`}><Icon name={ws.source.kind === 'inspection' ? 'insp' : 'rent'} size={14} />{ws.source.label} ›</Link>}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <a className="iconbtn" href={`/worksheets/${ws.id}/print`} target="_blank" rel="noreferrer" aria-label="打印 / PDF" title="打印 / PDF"><Icon name="print" /></a>
          {ws.driveUrl && <a className="iconbtn" href={ws.driveUrl} target="_blank" rel="noreferrer" aria-label="Google Drive 文件夹" title="Google Drive 文件夹"><Icon name="folder" /></a>}
        </span>
      </div>

      <section className="hero" aria-label="工作表概要">
        <div className="hero-text">
          <span className="k">{[ws.customer, ws.model, `建立于 ${fmtDate(ws.createdAt)} · ${ws.createdByName || ''}`].filter(Boolean).join(' · ')}</span>
          <h1 className="plate-big">{ws.plate ? ws.plate.split(/\s+/).map((x, i) => <span key={i} style={{ display: 'block' }}>{x}</span>) : (ws.model || ws.no)}</h1>
          <div className="chips">
            <div className="infochip"><span>维修员</span><b>{ws.assigneeName || '未派工'}</b></div>
            <div className={`infochip ${daysSince(ws.statusSince) > 5 && !closed ? 'red' : ''}`}><span>{s.label}</span><b>第 {daysSince(ws.statusSince) + 1} 天</b></div>
            <div className={`infochip ${ws.waitingParts ? 'amber' : ''}`}><span>零件</span><b>{parts?.length ?? 0} 项{ws.waitingParts ? ` · ${ws.waitingParts} 待料` : ''}</b></div>
            <div className="infochip"><span>维修事项</span><b>{entries?.length ?? 0} 条</b></div>
          </div>
        </div>
        <div className="hero-photo"><img src={TRUCK_PHOTO} alt="" width={1280} height={487} /></div>
      </section>

      <section className="card flow" aria-label="工作表流程">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><b>流程</b><span className="k num">{Math.min(flowIdx + 1, FLOW.length)} / {FLOW.length}</span></div>
        <ol>
          {FLOW.map((k, i) => {
            const cur = i === flowIdx && !closed;
            const done = i < flowIdx || closed;
            return <li key={k} className={cur ? 'cur' : done ? 'done' : ''} aria-current={cur ? 'step' : undefined}><i /><span>{FLOW_LABEL[i]}</span></li>;
          })}
        </ol>
      </section>

      <div className="row">
        <div className="col grow" style={{ gap: 20 }}>

          <section className="card tight" aria-labelledby="parts-h">
            <Fold />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 12px 10px' }}>
              <h2 id="parts-h">零件清单</h2>
              {can('ws.parts') && !closed && <button className="btn ghost sm" type="button" onClick={() => setAdding(true)}><Icon name="plus" />加入零件</button>}
            </div>
            {!parts ? <Loading /> : (
              <ExpandList rows={parts} cols="minmax(0,2.2fr) minmax(0,0.7fr) minmax(0,0.8fr)" head={['零件 · 位置', '数量', '状态']}
                empty={<p className="muted" style={{ padding: '0 14px' }}>还没有零件</p>}
                summary={(p) => <>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}><span className="ell" style={{ fontWeight: 500 }}>{p.name}</span>{p.position && <span className="tag">{p.position}</span>}</span>
                  <span>{p.qty} {p.unit || ''}</span>
                  <span>{p.state === 'waiting' ? <Pill tone="amber">待料</Pill> : <Pill tone="green">已领料</Pill>}</span>
                </>}
                detail={(p) => <>
                  <dl className="dgrid"><div><dt>编号</dt><dd className="num">{p.code}</dd></div><div><dt>来源</dt><dd>AutoCount</dd></div>{p.note && <div><dt>备注</dt><dd>{p.note}</dd></div>}</dl>
                  {can('ws.parts') && !closed && (
                    <div className="chips">
                      <button className="btn ghost sm" type="button" onClick={async () => { const q = prompt('数量', String(p.qty)); if (q && Number(q) > 0) await store.update(`worksheets/${ws.id}/parts/${p.id}`, { qty: Number(q) }); }}>修改数量</button>
                      <button className="btn ghost sm" type="button" onClick={async () => { const st = p.state === 'waiting' ? 'issued' : 'waiting'; await store.update(`worksheets/${ws.id}/parts/${p.id}`, { state: st }); await recountParts(ws.id, parts.map((x) => (x.id === p.id ? { ...x, state: st } : x))); }}>{p.state === 'waiting' ? '标为已领料' : '标为待料'}</button>
                      <button className="btn ghost sm" type="button" onClick={async () => {
                        await store.remove(`worksheets/${ws.id}/parts/${p.id}`);
                        await recountParts(ws.id, parts.filter((x) => x.id !== p.id));
                        toast(`已移除 ${p.name}`, async () => { const { id: _i, ...rest } = p; await store.add(`worksheets/${ws.id}/parts`, rest); await recountParts(ws.id, parts); });
                      }}>移除</button>
                    </div>
                  )}
                </>}
              />
            )}
          </section>

          <section className="card" aria-labelledby="log-h">
            <Fold />
            <h2 id="log-h">维修事项</h2>
            {can('ws.entry') && !closed && (
              <form onSubmit={(e) => { e.preventDefault(); send(); }} style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'var(--card2)', borderRadius: 14, padding: '6px 6px 6px 14px', border: '1px solid var(--line)' }}>
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="输入维修事项…" aria-label="新增维修事项" style={{ flex: 1, minWidth: 0, height: 44, background: 'transparent', border: 0, outline: 'none', fontSize: '1rem' }} />
                <button className="iconbtn" type="button" aria-label="拍照或上传照片" onClick={() => fileRef.current?.click()}><Icon name="camera" /></button>
                <button className="btn" type="submit">新增</button>
              </form>
            )}
            {!entries ? <Loading n={2} /> : entries.length === 0 ? <p className="muted">还没有维修事项</p> : entries.map((e) => (
              <article key={e.id} className="sub" style={{ display: 'flex', gap: 12 }}>
                <div className="avatar sm">{initial(e.byName)}</div>
                <div className="col" style={{ gap: 4 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'baseline' }}><b>{e.byName}</b><span className="small muted">{roleLabel(e.role)} · {fmtTime(e.at)}</span></div>
                  <p style={{ margin: 0, lineHeight: 1.6, color: 'var(--ink2)', whiteSpace: 'pre-wrap' }}>{e.text}</p>
                </div>
              </article>
            ))}
          </section>

          <section className="card" aria-labelledby="st-h">
            <Fold />
            <h2 id="st-h">状态记录</h2>
            {(logs || []).map((l) => (
              <div key={l.id} style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }} className="small">
                <span className="muted num" style={{ minWidth: 110 }}>{fmtTime(l.at)}</span>
                <span>{l.byName}：{l.from ? `${statusOf(statuses, l.from).label} → ` : ''}<b>{statusOf(statuses, l.to).label}</b>{l.note ? ` · ${l.note}` : ''}</span>
              </div>
            ))}
            {ws.review && <div className="sub small"><b>检查结果：</b>{ws.review.result === 'pass' ? '通过' : '退回'}{ws.review.note ? ` · ${ws.review.note}` : ''} · {ws.review.by}</div>}
          </section>
        </div>

        <aside className="col aside" style={{ gap: 16 }}>
          <section className="card" aria-labelledby="car-h">
            <Fold />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <h2 id="car-h">车辆资料</h2>
              {ws.plate && <span className="plate">{ws.plate}</span>}
            </div>
            {editInfo ? (
              <div className="col" style={{ gap: 12 }}>
                {enabled.map((f) => <FieldInput key={f.id} f={f} value={vals[f.id] ?? ws.fields[f.id] ?? ''} disabled={!canEditField(f.id)} onChange={(v) => setVals({ ...vals, [f.id]: v })} />)}
                <div style={{ display: 'flex', gap: 8 }}><button className="btn ghost sm" type="button" onClick={() => { setEditInfo(false); setVals({}); }}>取消</button><button className="btn sm" type="button" onClick={saveInfo}>保存</button></div>
              </div>
            ) : (
              <dl className="kv">
                {enabled.map((f) => <div key={f.id} className={f.role === 'customer' ? 'full' : ''}><dt>{f.label}</dt><dd className="num">{ws.fields[f.id] ? `${ws.fields[f.id]}${f.unit ? ` ${f.unit}` : ''}` : '—'}</dd></div>)}
              </dl>
            )}
            <div className="chips">
              {!editInfo && enabled.some((f) => canEditField(f.id)) && <button className="btn ghost sm" type="button" onClick={() => setEditInfo(true)}><Icon name="edit" />修改资料</button>}
              <a className="btn ghost sm" href={`/worksheets/${ws.id}/print`} target="_blank" rel="noreferrer"><Icon name="print" />打印 / PDF</a>
              {ws.plate && <Link className="btn ghost sm" to={`/search?q=${encodeURIComponent(ws.plate)}`}><Icon name="clock" />历史维修</Link>}
            </div>
            <div className="col" style={{ gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3>维修照片 <span className="muted" style={{ fontWeight: 400 }}>({ws.photos?.length || 0})</span></h3>
                {ws.driveUrl && <a className="small" href={ws.driveUrl} target="_blank" rel="noreferrer">在 Google Drive 查看 ›</a>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                {(ws.photos || []).map((p) => <a key={p.path} href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt={`维修照片 ${fmtTime(p.at)}`} style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 10, display: 'block' }} /></a>)}
                {!closed && <button type="button" aria-label="拍照或上传照片" onClick={() => fileRef.current?.click()} style={{ aspectRatio: '4 / 3', borderRadius: 10, border: '1px dashed var(--line)', background: 'transparent', color: 'var(--ink3)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Icon name="camera" size={20} /></button>}
              </div>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { onPhoto(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
          </section>
          {!canNext && nextBlock}
        </aside>
      </div>
      {canNext && !closed && (
        <div className="actionbar noprint" role="region" aria-label="下一步">
          <span className="hint">{nextOwner ? `按下去会通知${roleLabel(nextOwner)}（手机和电脑弹窗）` : '下一步'}</span>
          {ws.status === 'repairing' && (role === 'mechanic' || role === 'admin' || role === 'warehouse') && <button className="btn ghost" type="button" onClick={() => setWaiting(true)}>等待零件</button>}
          <button className="btn" type="button" disabled={busy} onClick={doNext}>{next![1]}<Icon name="right" /></button>
        </div>
      )}
      {adding && parts && <AddPartDialog title={`${ws.no} · ${ws.plate || ws.model || ''}`} onClose={() => setAdding(false)} onAdd={async (ls) => {
        await Promise.all(ls.map((l) => store.add(`worksheets/${ws.id}/parts`, l)));
        await recountParts(ws.id, [...parts, ...ls.map((l, i) => ({ ...l, id: `n${i}` }))]);
        toast(`已加入 ${ls.length} 行零件`);
      }} />}
    </>
  );
}
