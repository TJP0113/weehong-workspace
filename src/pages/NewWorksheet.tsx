import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AddPartDialog, linesFor, PositionPicker, type NewLine } from '../components/AddPartDialog';
import { FieldInput } from '../components/FieldInput';
import { Icon } from '../components/Icon';
import { Modal, useUi } from '../components/ui';
import { createWorksheet } from '../lib/actions';
import { useApp } from '../lib/app';
import { store, useCollection } from '../lib/store';
import { WS_TYPES, type Inspection, type Machine, type Part, type RentalOrder, type Staff, type Worksheet, type WorksheetType } from '../lib/types';
import { fmtDate, today } from '../lib/utils';

export default function NewWorksheet() {
  const { staff, fields, positions, general, can } = useApp();
  const nav = useNavigate();
  const { toast } = useUi();
  const [params] = useSearchParams();
  const enabled = fields.filter((f) => f.enabled);
  const plateField = enabled.find((f) => f.role === 'plate');
  const [lookup, setLookup] = useState('');
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    enabled.forEach((f) => { if (f.role === 'date') v[f.id] = today(); });
    return v;
  });
  const [type, setType] = useState<WorksheetType>('repair');
  const [desc, setDesc] = useState('');
  const [lines, setLines] = useState<NewLine[]>([]);
  const [cat, setCat] = useState(general.partCategories[0] || '');
  const [posFor, setPosFor] = useState<Part | null>(null);
  const [sel, setSel] = useState<Record<string, string[]>>({});
  const [search, setSearch] = useState(false);
  const [assignee, setAssignee] = useState('');
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<Worksheet['source']>();
  const [machineCode, setMachineCode] = useState<string>();

  const parts = useCollection<Part>('parts');
  const mechanics = useCollection<Staff>('users', { where: [['role', '==', 'mechanic'], ['active', '==', true]] });
  const key = lookup.trim().toUpperCase();
  const history = useCollection<Worksheet>(key.length >= 3 ? 'worksheets' : null, { where: [['plate', '==', key]], orderBy: ['createdAt', 'desc'], limit: 5 });
  const machine = useCollection<Machine>(key.length >= 2 ? 'machines' : null, { where: [['code', '==', key]] });

  // prefill from an inspection or a rental order
  useEffect(() => {
    const iid = params.get('inspection');
    const rid = params.get('rental');
    if (iid) store.get<Inspection>(`inspections/${iid}`).then((i) => {
      if (!i) return;
      setLookup(i.plate);
      setType('inspection');
      setSource({ kind: 'inspection', id: i.id, label: `验车服务 · ${i.date ? `预约 ${i.date} 验车` : '未预约验车日期'}` });
      fill({ plate: i.plate, customer: i.customer, model: i.model || '' });
    });
    if (rid) store.get<RentalOrder>(`rentalOrders/${rid}`).then(async (o) => {
      if (!o) return;
      const m = await store.get<Machine>(`machines/${o.machineCode}`);
      setLookup(o.machineCode);
      setType('prerental');
      setMachineCode(o.machineCode);
      setSource({ kind: 'rental', id: o.id, label: `${o.no} · ${o.machineCode} 出租前检查` });
      fill({ customer: o.client, model: m?.name || o.machineName, serial: m?.serial || '' });
      if (o.mechanic) setAssignee(o.mechanic);
    });
    const mc = params.get('machine');
    if (mc) store.get<Machine>(`machines/${mc}`).then((m) => {
      if (!m) return;
      setLookup(m.code);
      setMachineCode(m.code);
      setType((params.get('type') as WorksheetType) || 'maintenance');
      setSource({ kind: 'maintenance', id: m.code, label: `${m.code} 每月保养${m.status === 'rented' ? ` · 派人到现场：${m.location}` : ''}` });
      fill({ customer: m.client || '本公司', model: m.name, serial: m.serial || '' });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fill = (byRole: Record<string, string>) => setValues((v) => {
    const n = { ...v };
    enabled.forEach((f) => { if (f.role && byRole[f.role] !== undefined && byRole[f.role] !== '') n[f.id] = byRole[f.role]; });
    return n;
  });

  const found = history?.[0];
  const mFound = machine?.[0];
  const useFound = () => {
    if (found) { setValues((v) => ({ ...v, ...found.fields, ...(enabled.find((f) => f.role === 'date') ? { [enabled.find((f) => f.role === 'date')!.id]: today() } : {}), ...(enabled.find((f) => f.role === 'mileage') ? { [enabled.find((f) => f.role === 'mileage')!.id]: '' } : {}) })); }
    else if (mFound) { fill({ model: mFound.name, serial: mFound.serial || '', customer: mFound.client || '' }); setMachineCode(mFound.code); }
  };
  useEffect(() => { if (found || mFound) useFound(); else if (plateField && key) setValues((v) => ({ ...v, [plateField.id]: lookup })); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [found?.id, mFound?.id]);

  const catParts = useMemo(() => (parts || []).filter((p) => p.category === cat), [parts, cat]);
  const picked = (code: string) => lines.some((l) => l.code === code);
  const toggle = (p: Part) => {
    if (picked(p.code)) { setLines(lines.filter((l) => l.code !== p.code)); return; }
    if ((p.groups || []).length) { setPosFor(p); setSel({}); return; }
    setLines([...lines, ...linesFor(p, positions, {}, 1)!]);
  };
  const missing = enabled.filter((f) => f.required && !values[f.id]);

  const submit = async () => {
    setBusy(true);
    try {
      const a = mechanics?.find((m) => m.id === assignee) || null;
      const id = await createWorksheet({ staff: staff!, fields, values, type, description: desc, parts: lines, source, machineCode, assignee: a });
      if (source?.kind === 'inspection') await store.update(`inspections/${source.id}`, { worksheetId: id });
      if (source?.kind === 'rental') await store.update(`rentalOrders/${source.id}`, { worksheetId: id });
      toast('已建立工作表，并通知了维修员');
      nav(`/worksheets/${id}`);
    } catch (e: any) {
      toast(`建立失败：${e.message}`);
      setBusy(false);
    }
  };

  if (!can('ws.create')) return <p className="muted">你的角色没有建立工作表的权限。</p>;
  return (
    <>
      <Link className="back" to="/board"><Icon name="left" />返回</Link>
      <h1>新建工作表</h1>
      <div className="row">
        <div className="col grow" style={{ gap: 20 }}>
          <section className="card">
            <h2><span className="muted" style={{ marginRight: 8 }}>1</span>是哪辆车 / 哪台机械？</h2>
            <label className="searchbox" style={{ maxWidth: 'none', height: 56, border: '1.5px solid var(--accent)' }}>
              <Icon name="search" size={18} />
              <input value={lookup} onChange={(e) => setLookup(e.target.value)} placeholder="输入车牌或机械代号，例如 JQT 5521 / EX-07" aria-label="车牌或机械代号" style={{ fontSize: '1.15rem', fontWeight: 600, letterSpacing: '0.04em' }} />
              {(found || mFound) && <span className="small" style={{ color: 'var(--green-ink)' }}>已找到记录</span>}
            </label>
            {(found || mFound) && <span className="small" style={{ color: 'var(--green-ink)' }}>已自动带入{found ? '上次工作表' : '机械'}的资料，可修改</span>}
            <div className="row" style={{ gap: 16 }}>
              <div className="grid2" style={{ flex: '2 1 360px' }}>
                {enabled.map((f) => <FieldInput key={f.id} f={f} value={values[f.id] || ''} onChange={(v) => setValues({ ...values, [f.id]: v })} />)}
              </div>
              {history && history.length > 0 && (
                <div className="col" style={{ flex: '1 1 220px', gap: 8 }}>
                  <span className="k">这辆车的维修记录</span>
                  {history.map((h) => <Link key={h.id} to={`/worksheets/${h.id}`} className="sub small" style={{ display: 'flex', justifyContent: 'space-between', textDecoration: 'none' }}><span>{fmtDate(h.createdAt)} · {WS_TYPES.find((x) => x.key === h.type)?.label}</span><span className="muted">{h.no}</span></Link>)}
                </div>
              )}
            </div>
          </section>

          <section className="card">
            <h2><span className="muted" style={{ marginRight: 8 }}>2</span>工作表类型</h2>
            <div className="grid-auto" role="radiogroup" aria-label="工作表类型">
              {WS_TYPES.map((t) => (
                <button key={t.key} type="button" role="radio" aria-checked={type === t.key} className={`choice ${type === t.key ? 'on' : ''}`} onClick={() => setType(t.key)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, padding: 14, minHeight: 72, textAlign: 'left' }}>
                  <b>{t.label}</b><span className="small muted" style={{ fontWeight: 400 }}>{t.hint}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="card">
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
              <h2><span className="muted" style={{ marginRight: 8 }}>3</span>零件 · 按分类快速勾选</h2>
              <button className="btn ghost sm" type="button" onClick={() => setSearch(true)}><Icon name="search" />搜索其他零件</button>
            </div>
            <div className="chips" role="tablist">
              {general.partCategories.map((c) => {
                const n = lines.filter((l) => (parts || []).find((p) => p.code === l.code)?.category === c).length;
                return <button key={c} type="button" role="tab" aria-selected={cat === c} className={`choice ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c}{n ? `（${n}）` : ''}</button>;
              })}
            </div>
            <div className="grid-auto">
              {catParts.map((p) => {
                const on = picked(p.code);
                return (
                  <button key={p.id} type="button" role="checkbox" aria-checked={on} onClick={() => toggle(p)} className={`choice ${on ? 'on' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 52, textAlign: 'left', fontWeight: 400 }}>
                    <span className={`check ${on ? 'on' : ''}`}>{on && <Icon name="check" size={13} stroke={3.5} />}</span>
                    <span className="col" style={{ gap: 2, minWidth: 0 }}><span className="ell">{p.name}</span>
                      {(p.groups || []).length > 0 && <span className="small muted">选位置：{p.groups!.map((g) => positions.find((x) => x.id === g)?.name).join(' · ')}</span>}
                      {(p.stock ?? 1) === 0 && <span className="small" style={{ color: 'var(--amber-ink)' }}>库存为 0</span>}
                    </span>
                  </button>
                );
              })}
              {parts && catParts.length === 0 && <p className="muted small">这个分类还没有零件。到“设置 · 零件位置区分”给零件指定分类。</p>}
            </div>
          </section>
        </div>

        <aside className="col aside" style={{ gap: 16 }}>
          <section className="card">
            <h2>将建立</h2>
            <div className="col small" style={{ gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span className="k">车辆</span><b>{values[plateField?.id || ''] || lookup || '—'}</b></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span className="k">类型</span><b>{WS_TYPES.find((t) => t.key === type)?.label}</b></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span className="k">零件</span><b>{lines.length} 行</b></div>
              {source && <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span className="k">来源</span><b style={{ textAlign: 'right' }}>{source.label}</b></div>}
            </div>
            {lines.map((l, i) => (
              <div key={i} className="sub small" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '8px 10px' }}>
                <span>{l.name}{l.position ? `（${l.position}）` : ''} × {l.qty}</span>
                <button type="button" aria-label="移除" onClick={() => setLines(lines.filter((_, j) => j !== i))} style={{ border: 0, background: 'transparent', color: 'var(--muted)', cursor: 'pointer' }}><Icon name="x" size={14} /></button>
              </div>
            ))}
            <div className="field"><label htmlFor="assignee">派给维修员（选填）</label>
              <select id="assignee" className="input" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                <option value="">先不派工，通知所有维修员</option>
                {(mechanics || []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="field"><label htmlFor="desc">故障描述 / 顾客要求</label><textarea id="desc" className="input" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="例如：刹车有异声，顺便保养" /></div>
            {missing.length > 0 && <span className="small" style={{ color: 'var(--amber-ink)' }}>还没填：{missing.map((f) => f.label).join('、')}</span>}
            <button className="btn big" type="button" disabled={busy || missing.length > 0} onClick={submit}>{busy ? '建立中…' : '建立工作表并通知维修员'}</button>
            <span className="small muted">建立后状态为“待维修”，出现在工作表看板</span>
          </section>
        </aside>
      </div>

      {posFor && (
        <Modal title={posFor.name} sub="选择位置，可多选" onClose={() => setPosFor(null)}>
          <PositionPicker part={posFor} sel={sel} setSel={setSel} />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn ghost" type="button" onClick={() => setPosFor(null)}>取消</button>
            <button className="btn" type="button" disabled={!linesFor(posFor, positions, sel, 1)} onClick={() => { setLines([...lines, ...linesFor(posFor, positions, sel, 1)!]); setPosFor(null); }}>加入</button>
          </div>
        </Modal>
      )}
      {search && <AddPartDialog title="新工作表" onClose={() => setSearch(false)} onAdd={(ls) => setLines([...lines, ...ls])} />}
    </>
  );
}
