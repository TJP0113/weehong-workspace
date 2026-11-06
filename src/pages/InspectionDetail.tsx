import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Empty, Loading, Pill } from '../components/ui';
import { useApp } from '../lib/app';
import { useCollection, useDoc } from '../lib/store';
import type { Inspection, Worksheet } from '../lib/types';
import { fmtDate, fmtMD, statusOf } from '../lib/utils';
import { BookDialog, RESULT, ResultDialog } from './Inspections';

interface S { k: 'done' | 'fail' | 'cur' | ''; title: string; who: string; note?: string; when?: string; ws?: Worksheet }

export default function InspectionDetail() {
  const { id } = useParams();
  const i = useDoc<Inspection>(`inspections/${id}`);
  const wss = useCollection<Worksheet>(i?.plate ? 'worksheets' : null, { where: [['plate', '==', i?.plate || '']] });
  const { can, statuses } = useApp();
  const [dlg, setDlg] = useState<'result' | 'book' | null>(null);
  if (i === undefined || !wss) return <Loading />;
  if (i === null) return <Empty title="找不到这笔验车" action={<Link className="btn ghost sm" to="/inspections">回到验车服务</Link>} />;

  const linked = wss.filter((w) => w.source?.kind === 'inspection' && w.source.id === i.id || w.id === i.worksheetId).sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
  const done = (w?: Worksheet) => !!w && ['repaired', 'clerk', 'review', 'closed'].includes(w.status);
  const steps: S[] = [{ k: 'done', title: '顾客送车，登记验车', who: '文员', when: fmtDate(i.receivedAt) }];
  const first = linked[0];
  steps.push({ k: done(first) ? 'done' : first ? 'cur' : 'cur', title: '保养', who: first ? `维修员 · ${first.assigneeName || '未派工'}` : '货仓管理员开工作表', note: first ? statusOf(statuses, first.status).label : '还没有保养工作表', ws: first });
  (i.history || []).forEach((h, n) => {
    steps.push({ k: h.result === 'pass' ? 'done' : 'fail', title: n === 0 ? '验车' : '复验', who: '文员送验', note: h.result === 'pass' ? '通过' : `不通过：${h.note || ''}`, when: fmtDate(h.date) });
    if (h.result === 'fail') {
      const w = linked[n + 1];
      steps.push({ k: done(w) ? 'done' : 'cur', title: '再维修', who: w ? `维修员 · ${w.assigneeName || '未派工'}` : '货仓管理员开工作表', note: w ? statusOf(statuses, w.status).label : '还没开维修工作表', ws: w });
    }
  });
  const passed = i.result === 'pass';
  if (!passed) {
    const fails = (i.history || []).filter((h) => h.result === 'fail').length;
    steps.push({ k: i.result === 'booked' && steps.every((s) => s.k !== 'cur') ? 'cur' : '', title: fails ? '复验' : '验车', who: '文员送验', note: i.date ? `预约 ${fmtMD(i.date)}${i.place ? ` · ${i.place}` : ''}` : '还没预约日期' });
  }
  steps.push({ k: passed ? 'done' : '', title: '通过，交车', who: '文员通知顾客取车' });
  const firstCur = steps.findIndex((s) => s.k === 'cur');
  steps.forEach((s, n) => { if (s.k === 'cur' && n !== firstCur) s.k = ''; });
  const failed = (i.history || []).some((h) => h.result === 'fail');

  return (
    <>
      <Link className="back" to="/inspections"><Icon name="left" />验车服务</Link>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px 16px' }}>
        <span className="plate lg">{i.plate}</span>
        <h1 style={{ fontSize: '1.75rem' }}>{i.customer}{i.model ? ` · ${i.model}` : ''}</h1>
        <Pill tone={RESULT[i.result][1]}>{failed && i.result === 'booked' ? `待复验 · ${fmtMD(i.date)}` : RESULT[i.result][0]}</Pill>
      </div>
      <div className="row">
        <section className="card grow">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><div className="col" style={{ gap: 4 }}><h2>验车流程进度</h2><span className="k">{failed ? '曾经验车不通过，维修后复验' : '保养后送去验车'}</span></div><span className="small muted">{steps.filter((s) => s.k === 'done' || s.k === 'fail').length} / {steps.length} 步完成</span></div>
          <ol className="steps">
            {steps.map((s, n) => (
              <li key={n} className={`step ${s.k}`}>
                <div className="rail"><span className="dot">{s.k === 'done' ? <Icon name="check" size={14} stroke={3} /> : s.k === 'fail' ? <Icon name="x" size={14} stroke={3} /> : n + 1}</span><span className="bar" /></div>
                <div className="body">
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><b style={{ fontSize: '1.05rem', color: s.k ? undefined : 'var(--muted)' }}>{s.title}</b><Pill tone={s.k === 'done' ? 'green' : s.k === 'fail' ? 'red' : s.k === 'cur' ? 'blue' : 'grey'}>{s.k === 'done' ? '已完成' : s.k === 'fail' ? '不通过' : s.k === 'cur' ? '进行中' : '未开始'}</Pill></div>
                  <span className="small" style={{ color: 'var(--ink3)' }}>{s.who}</span>
                  {s.note && <span className="small" style={{ color: s.k === 'fail' ? 'var(--red-ink)' : 'var(--muted)' }}>{s.note}</span>}
                  {s.when && <span className="small muted num">{s.when}</span>}
                  {s.ws && <Link className="small" to={`/worksheets/${s.ws.id}`}>打开工作表 {s.ws.no} ›</Link>}
                  {s.k === 'cur' && !s.ws && (s.title === '保养' || s.title === '再维修') && can('ws.create') && <Link className="btn ghost sm" style={{ alignSelf: 'flex-start' }} to={`/worksheets/new?inspection=${i.id}`}>开工作表</Link>}
                </div>
              </li>
            ))}
          </ol>
        </section>
        <div className="col aside" style={{ gap: 16 }}>
          {can('inspection.edit') && i.result === 'booked' && <button className="btn big" type="button" onClick={() => setDlg('result')}>记录{failed ? '复验' : '验车'}结果</button>}
          {can('inspection.edit') && i.result === 'unbooked' && <button className="btn big" type="button" onClick={() => setDlg('book')}>预约{failed ? '复验' : '验车'}日期</button>}
          <section className="card">
            <h2>车辆资料</h2>
            <dl className="kv">
              <div className="full"><dt>顾客公司名</dt><dd>{i.customer}</dd></div>
              <div><dt>车牌</dt><dd>{i.plate}</dd></div><div><dt>车型</dt><dd>{i.model || '—'}</dd></div>
              <div><dt>送车日期</dt><dd className="num">{fmtDate(i.receivedAt)}</dd></div>
              {first?.mileage && <div><dt>里程数</dt><dd>{first.mileage} 公里</dd></div>}
            </dl>
          </section>
          <section className="card">
            <h2>验车记录</h2>
            {(i.history || []).map((h, n) => <div key={n} className="sub" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span className="small num">{fmtDate(h.date)} · 第 {n + 1} 次</span><Pill tone={h.result === 'pass' ? 'green' : 'red'}>{h.result === 'pass' ? '通过' : '不通过'}</Pill></div>)}
            {i.result === 'booked' && <div className="sub" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span className="small num">{fmtDate(i.date)} · 第 {i.attempt || 1} 次</span><Pill tone="blue">待验车</Pill></div>}
            {!(i.history || []).length && i.result !== 'booked' && <p className="muted small">还没有验车记录</p>}
          </section>
        </div>
      </div>
      {dlg === 'result' && <ResultDialog i={i} onClose={() => setDlg(null)} />}
      {dlg === 'book' && <BookDialog i={i} onClose={() => setDlg(null)} />}
    </>
  );
}
