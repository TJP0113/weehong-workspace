import { useState } from 'react';
import { Pill, useUi } from '../../components/ui';
import { useApp } from '../../lib/app';
import { store } from '../../lib/store';
import { ROLES, type Role, type StatusDef, type Tone } from '../../lib/types';
import { ReadOnlyNote } from './Settings';

const TONES: [Tone, string][] = [['grey', '灰 · 未开始'], ['blue', '蓝 · 进行中'], ['amber', '橙 · 需要注意'], ['green', '绿 · 完成'], ['red', '红 · 问题']];

export default function Statuses() {
  const { statuses, general, can } = useApp();
  const { toast } = useUi();
  const edit = can('settings.edit');
  const [list, setList] = useState<StatusDef[]>(statuses);
  const [days, setDays] = useState(general.overdueDays);
  const set = (i: number, p: Partial<StatusDef>) => setList(list.map((s, j) => (j === i ? { ...s, ...p } : s)));
  return (
    <section className="card">
      <div className="col" style={{ gap: 6 }}><h2>工作状态</h2><p className="small muted" style={{ margin: 0 }}>可以改名称、颜色和由谁处理。流程顺序固定：待维修 → 维修中（可改为等待零件）→ 维修完成 → 文员处理中 → 待管理员检查 → 已结案。</p></div>
      {!edit && <ReadOnlyNote />}
      {list.map((s, i) => (
        <div key={s.key} className="sub" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr) minmax(0,1fr) auto', gap: 12, alignItems: 'center' }}>
          <input className="input" aria-label="状态名称" value={s.label} disabled={!edit} onChange={(e) => set(i, { label: e.target.value })} />
          <select className="input" aria-label="颜色" value={s.tone} disabled={!edit} onChange={(e) => set(i, { tone: e.target.value as Tone })}>{TONES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <select className="input" aria-label="由谁处理" value={s.owner} disabled={!edit} onChange={(e) => set(i, { owner: e.target.value as Role })}>{ROLES.map((r) => <option key={r.key} value={r.key}>由{r.label}处理</option>)}</select>
          <Pill tone={s.tone}>{s.label}</Pill>
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <label htmlFor="od">同一个状态停留超过</label>
        <input id="od" className="input" style={{ width: 80 }} type="number" min={1} value={days} disabled={!edit} onChange={(e) => setDays(Number(e.target.value) || 5)} />
        <span>天，标为超时并提醒管理员</span>
      </div>
      {edit && <button className="btn" style={{ alignSelf: 'flex-start' }} type="button" onClick={async () => { await store.set('settings/statuses', { list }); await store.update('settings/general', { overdueDays: days }); toast('已保存'); }}>保存</button>}
    </section>
  );
}
