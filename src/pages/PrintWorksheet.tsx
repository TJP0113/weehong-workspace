import { Fragment, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useApp } from '../lib/app';
import { useCollection, useDoc } from '../lib/store';
import { wsTypeLabel, type Part, type Worksheet, type WsEntry, type WsPart } from '../lib/types';
import { fmtDate, today } from '../lib/utils';

const c: React.CSSProperties = { border: '1px solid #1A1A1A', padding: '6px 8px', fontSize: '12pt', verticalAlign: 'top' };
const h: React.CSSProperties = { ...c, fontSize: '11pt', fontWeight: 700, background: '#EFEFEF', textAlign: 'left' };

export default function PrintWorksheet() {
  const { id } = useParams();
  const { general, fields } = useApp();
  const ws = useDoc<Worksheet>(`worksheets/${id}`);
  const parts = useCollection<WsPart>(`worksheets/${id}/parts`);
  const entries = useCollection<WsEntry>(`worksheets/${id}/entries`, { orderBy: ['at', 'asc'] });
  const catalog = useCollection<Part>('parts');
  const ready = ws && parts && entries && catalog;
  useEffect(() => {
    document.documentElement.dataset.theme = 'light';
    if (ready) { const t = setTimeout(() => window.print(), 500); return () => clearTimeout(t); }
  }, [ready]);
  if (!ready) return <p style={{ padding: 40 }}>载入中…</p>;
  const groups = new Map<string, WsPart[]>();
  parts.forEach((p) => { const cat = catalog.find((x) => x.code === p.code)?.category || '其他'; groups.set(cat, [...(groups.get(cat) || []), p]); });
  const enabled = fields.filter((f) => f.enabled);
  return (
    <div className="print-page" style={{ maxWidth: 794, margin: '0 auto', padding: '40px 48px', fontFamily: "'Noto Sans SC', Arial, sans-serif", display: 'flex', flexDirection: 'column', gap: 16, minHeight: '100vh' }}>
      <div className="noprint" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}><button className="btn" type="button" onClick={() => window.print()}>打印 / 存成 PDF</button></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}><img src="/logo-color.png" alt="WEE HONG" style={{ height: 56 }} /><div><div style={{ fontSize: '18pt', fontWeight: 700 }}>{general.companyName}</div><div style={{ fontSize: '10.5pt', color: '#444' }}>{[general.companyAddress, general.companyPhone].filter(Boolean).join(' · ')}</div></div></div>
        <div style={{ textAlign: 'right' }}><div style={{ fontSize: '16pt', fontWeight: 700 }}>JOB SHEET 工作表</div><div style={{ fontSize: '12pt', fontWeight: 700 }}>{ws.no}</div><div style={{ fontSize: '10.5pt', color: '#444' }}>类型：{wsTypeLabel(ws.type)}</div></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '6px 28px' }}>
        {enabled.map((f) => <div key={f.id} style={{ display: 'flex', gap: 8, alignItems: 'baseline', borderBottom: '1px solid #1A1A1A', padding: '4px 0' }}><span style={{ fontSize: '10.5pt', color: '#444', whiteSpace: 'nowrap' }}>{f.label}</span><b style={{ fontSize: '12pt' }}>{ws.fields[f.id] || ''}{f.unit && ws.fields[f.id] ? ` ${f.unit}` : ''}</b></div>)}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={{ ...h, width: 40, textAlign: 'center' }}>√</th><th style={{ ...h, width: 56, textAlign: 'center' }}>Qty</th><th style={h}>Description</th><th style={{ ...h, width: 170 }}>Remarks</th></tr></thead>
        <tbody>
          {[...groups.entries()].map(([g, list]) => (
            <Fragment key={g}>
              <tr><td style={{ ...c, fontWeight: 700 }} colSpan={4}># {g.toUpperCase()}</td></tr>
              {list.map((p) => <tr key={p.id}><td style={{ ...c, textAlign: 'center' }}>{p.state === 'issued' ? '✓' : ''}</td><td style={{ ...c, textAlign: 'center' }}>{p.qty}</td><td style={c}>{p.name}{p.position ? ` (${p.position})` : ''}</td><td style={c}>{[p.state === 'waiting' ? '待料' : '', p.note].filter(Boolean).join(' · ')}</td></tr>)}
            </Fragment>
          ))}
          {parts.length === 0 && <tr><td style={c} colSpan={4}>（没有零件）</td></tr>}
        </tbody>
      </table>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <b style={{ fontSize: '12pt' }}>维修事项 Work Done</b>
        <div style={{ border: '1px solid #1A1A1A', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6, fontSize: '12pt', lineHeight: 1.5 }}>
          {entries.length ? entries.map((e) => <span key={e.id}>{fmtDate(e.at).slice(5)} {e.byName}：{e.text}</span>) : <span>&nbsp;</span>}
        </div>
      </div>
      <div style={{ marginTop: 'auto', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 24 }}>
        {[`维修员 Mechanic · ${ws.assigneeName || ''}`, '文员 Clerk', '检查 Checked by'].map((x) => <div key={x} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={{ height: 48, borderBottom: '1px solid #1A1A1A' }} /><span style={{ fontSize: '10.5pt' }}>{x}</span></div>)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5pt', color: '#555' }}><span>由维修工作表系统产生 · {today()}</span><span>{ws.no}</span></div>
    </div>
  );
}
