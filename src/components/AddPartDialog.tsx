import { useMemo, useState } from 'react';
import { useApp } from '../lib/app';
import { useCollection } from '../lib/store';
import type { Part, WsPart } from '../lib/types';
import { includesAny } from '../lib/utils';
import { Icon } from './Icon';
import { Modal } from './ui';

export type NewLine = Omit<WsPart, 'id'>;

/** Builds the lines for one part: every combination of the chosen positions becomes one line. */
export function linesFor(part: Part, groups: { id: string; options: string[] }[], sel: Record<string, string[]>, qty: number, note = ''): NewLine[] | null {
  const gs = (part.groups || []).map((g) => groups.find((x) => x.id === g)).filter(Boolean) as { id: string; options: string[] }[];
  if (gs.some((g) => !(sel[g.id] || []).length)) return null;
  let combos: string[][] = [[]];
  gs.forEach((g) => { combos = combos.flatMap((c) => g.options.filter((o) => sel[g.id].includes(o)).map((o) => [...c, o])); });
  return combos.map((c) => ({ code: part.code, name: part.name, position: c.join(' · '), qty, unit: part.unit, note, state: (part.stock ?? 1) > 0 ? 'issued' : 'waiting' }));
}

export function PositionPicker({ part, sel, setSel }: { part: Part; sel: Record<string, string[]>; setSel: (s: Record<string, string[]>) => void }) {
  const { positions } = useApp();
  const gs = (part.groups || []).map((g) => positions.find((x) => x.id === g)).filter(Boolean) as typeof positions;
  if (!gs.length) return <p className="muted small" style={{ margin: 0 }}>此零件没有设定位置区分，直接加入。</p>;
  return (
    <div className="col" style={{ gap: 10 }}>
      {gs.map((g) => (
        <div key={g.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <span className="k" style={{ width: 100 }}>{g.name}</span>
          <div className="chips">
            {g.options.map((o) => {
              const on = (sel[g.id] || []).includes(o);
              return <button key={o} type="button" aria-pressed={on} className={`choice ${on ? 'on' : ''}`} style={{ minWidth: 64 }}
                onClick={() => setSel({ ...sel, [g.id]: on ? sel[g.id].filter((x) => x !== o) : g.options.filter((x) => x === o || (sel[g.id] || []).includes(x)) })}>{o}</button>;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function AddPartDialog({ title, onClose, onAdd }: { title: string; onClose: () => void; onAdd: (lines: NewLine[]) => Promise<void> | void }) {
  const { positions } = useApp();
  const parts = useCollection<Part>('parts');
  const [q, setQ] = useState('');
  const [pick, setPick] = useState<Part | null>(null);
  const [sel, setSel] = useState<Record<string, string[]>>({});
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const results = useMemo(() => (parts || []).filter((p) => includesAny([p.code, p.name, p.spec], q)).slice(0, 8), [parts, q]);
  const lines = pick ? linesFor(pick, positions, sel, qty, note) : null;
  return (
    <Modal title="加入零件" sub={`${title} · 零件来自 AutoCount`} onClose={onClose} wide>
      <label className="searchbox" style={{ maxWidth: 'none', height: 48 }}><Icon name="search" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索零件编号或名称" aria-label="搜索 AutoCount 零件" /></label>
      <div className="col" style={{ gap: 6 }}>
        {results.map((p) => {
          const on = pick?.id === p.id;
          return (
            <button key={p.id} type="button" aria-pressed={on} onClick={() => { setPick(p); setSel({}); }} className="choice" style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, textAlign: 'left', ...(on ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)' } : {}) }}>
              <span className="col" style={{ gap: 2, flex: 1 }}><b>{p.name}</b><span className="small muted">{p.code} · {p.spec}{(p.groups || []).length ? ` · 位置：${(p.groups || []).map((g) => positions.find((x) => x.id === g)?.name).join(' · ')}` : ''}</span></span>
              <span className="small" style={{ color: (p.stock ?? 0) > 0 ? 'var(--muted)' : 'var(--amber-ink)' }}>库存 {p.stock ?? '—'}</span>
            </button>
          );
        })}
        {parts && results.length === 0 && <p className="muted">找不到这个零件。零件只能从 AutoCount 同步，请先在 AutoCount 新增。</p>}
      </div>
      {pick && (
        <div className="sub col" style={{ gap: 12, padding: 16 }}>
          <b>选择位置 <span className="small muted" style={{ fontWeight: 400 }}>可多选，每个组合加入一行</span></b>
          <PositionPicker part={pick} sel={sel} setSel={setSel} />
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div className="field"><span className="lbl">每个位置的数量</span>
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--line)', borderRadius: 12, background: 'var(--input)' }}>
                <button type="button" className="iconbtn" style={{ border: 0, background: 'transparent' }} aria-label="减少" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
                <span style={{ minWidth: 36, textAlign: 'center', fontWeight: 600 }}>{qty}</span>
                <button type="button" className="iconbtn" style={{ border: 0, background: 'transparent' }} aria-label="增加" onClick={() => setQty(qty + 1)}>+</button>
              </div>
            </div>
            <div className="field" style={{ flex: '1 1 220px' }}><label htmlFor="pnote">备注（选填）</label><input id="pnote" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="例如：原厂件 / 顾客自备" /></div>
          </div>
          {lines ? <div className="col" style={{ gap: 4 }}>{lines.map((l, i) => <span key={i} className="small">· {l.name}{l.position ? `（${l.position}）` : ''} × {l.qty}{l.state === 'waiting' ? ' · 库存为 0，标为待料' : ''}</span>)}</div> : <span className="small" style={{ color: 'var(--amber-ink)' }}>每个区分至少选一项</span>}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="btn ghost" type="button" onClick={onClose}>取消</button>
        <button className="btn" type="button" disabled={!lines} onClick={async () => { await onAdd(lines!); onClose(); }}>加入 {lines?.length || 0} 行</button>
      </div>
    </Modal>
  );
}
