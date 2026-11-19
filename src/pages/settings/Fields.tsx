import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { Switch, useUi } from '../../components/ui';
import { useApp } from '../../lib/app';
import { store } from '../../lib/store';
import { ROLES, type FieldDef, type FieldRole, type FieldType, type Role } from '../../lib/types';
import { uid } from '../../lib/utils';
import { ReadOnlyNote } from './Settings';

const TYPES: [FieldType, string][] = [['text', '文字'], ['number', '数字'], ['date', '日期'], ['select', '下拉选单'], ['customer', '顾客名单']];
const ROLE_TAG: [FieldRole, string][] = [['', '无'], ['plate', '车牌'], ['customer', '顾客'], ['model', '型号'], ['serial', '系列号'], ['mileage', '里程'], ['date', '日期']];

export default function Fields() {
  const { fields, can } = useApp();
  const { toast } = useUi();
  const edit = can('settings.edit');
  const [form, setForm] = useState<FieldDef | null>(null);
  const save = async (list: FieldDef[], msg = '已保存') => { await store.set('settings/fields', { list }); toast(msg); };
  const move = (i: number, d: number) => { const l = [...fields]; const j = i + d; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; save(l, '已调整顺序'); };
  const patch = (id: string, p: Partial<FieldDef>) => save(fields.map((f) => (f.id === id ? { ...f, ...p } : f)));
  return (
    <div className="row">
      <section className="card grow" style={{ flexBasis: 480 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }}>
          <div className="col" style={{ gap: 6 }}><h2>工作表字段</h2><p className="small muted" style={{ margin: 0 }}>货仓管理员建立工作表时要填写的资料。停用的字段，旧工作表仍保留资料。</p></div>
          {edit && <button className="btn" type="button" onClick={() => setForm({ id: uid(), label: '', type: 'text', required: false, enabled: true, role: '', editors: ['admin', 'warehouse'] })}><Icon name="plus" />新增字段</button>}
        </div>
        {!edit && <ReadOnlyNote />}
        <div className="lhead" style={{ gridTemplateColumns: '64px minmax(0,1.4fr) minmax(0,1fr) 52px 52px 40px' }}><span>顺序</span><span>字段名称</span><span>类型</span><span>必填</span><span>启用</span><span /></div>
        {fields.map((f, i) => (
          <div key={f.id} className="sub" style={{ display: 'grid', gridTemplateColumns: '64px minmax(0,1.4fr) minmax(0,1fr) 52px 52px 40px', gap: 12, alignItems: 'center', opacity: f.enabled ? 1 : 0.55 }}>
            <span style={{ display: 'flex', gap: 2 }}>{edit && <><button className="iconbtn" style={{ width: 30, height: 30, borderRadius: 8 }} type="button" aria-label={`上移 ${f.label}`} onClick={() => move(i, -1)}><Icon name="up" size={14} /></button><button className="iconbtn" style={{ width: 30, height: 30, borderRadius: 8 }} type="button" aria-label={`下移 ${f.label}`} onClick={() => move(i, 1)}><Icon name="down" size={14} /></button></>}</span>
            <span className="two"><b className="ell">{f.label}</b><span className="ell">{f.role ? `用作：${ROLE_TAG.find((r) => r[0] === f.role)?.[1]}` : ''}{f.unit ? ` · 单位 ${f.unit}` : ''}</span></span>
            <span className="tag" style={{ justifySelf: 'start' }}>{TYPES.find((t) => t[0] === f.type)?.[1]}</span>
            {edit ? <Switch on={f.required} label={`${f.label} 必填`} onChange={(v) => patch(f.id, { required: v })} /> : <span>{f.required ? '是' : '否'}</span>}
            {edit ? <Switch on={f.enabled} label={`${f.label} 启用`} onChange={(v) => patch(f.id, { enabled: v })} /> : <span>{f.enabled ? '是' : '否'}</span>}
            {edit && <button className="iconbtn" style={{ width: 36, height: 36 }} type="button" aria-label={`编辑 ${f.label}`} onClick={() => setForm(f)}><Icon name="edit" size={14} /></button>}
          </div>
        ))}
      </section>
      {form && (
        <section className="card aside" style={{ border: '1px solid var(--line)' }}>
          <h2>{fields.some((f) => f.id === form.id) ? '编辑字段' : '新增字段'}</h2>
          <div className="field"><label htmlFor="fl">字段名称</label><input id="fl" className="input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="例如：引擎号码" /></div>
          <div className="field"><span className="lbl">字段类型</span><div className="grid2" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8 }}>{TYPES.map(([k, l]) => <button key={k} type="button" className={`choice ${form.type === k ? 'on' : ''}`} aria-pressed={form.type === k} onClick={() => setForm({ ...form, type: k })}>{l}</button>)}</div></div>
          {form.type === 'select' && <div className="field"><label htmlFor="fo">选项（用逗号分开）</label><input id="fo" className="input" value={(form.options || []).join('，')} onChange={(e) => setForm({ ...form, options: e.target.value.split(/[,，]/).map((x) => x.trim()).filter(Boolean) })} /></div>}
          {form.type === 'number' && <div className="field"><label htmlFor="fu">单位（选填）</label><input id="fu" className="input" value={form.unit || ''} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="例如：公里" /></div>}
          <div className="field"><label htmlFor="fr">用作（列表、搜索和打印会用到）</label><select id="fr" className="input" value={form.role || ''} onChange={(e) => setForm({ ...form, role: e.target.value as FieldRole })}>{ROLE_TAG.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>必填</span><Switch on={form.required} label="必填" onChange={(v) => setForm({ ...form, required: v })} /></div>
          <div className="field"><span className="lbl">谁可以修改</span><div className="chips">{ROLES.map((r) => { const on = (form.editors || []).includes(r.key); return <button key={r.key} type="button" aria-pressed={on} className={`choice ${on ? 'on' : ''}`} onClick={() => setForm({ ...form, editors: on ? (form.editors || []).filter((x) => x !== r.key) : [...(form.editors || []), r.key as Role] })}>{r.label}</button>; })}</div></div>
          <div style={{ display: 'flex', gap: 10 }}><button className="btn ghost" style={{ flex: 1 }} type="button" onClick={() => setForm(null)}>取消</button><button className="btn" style={{ flex: 2 }} type="button" disabled={!form.label.trim()} onClick={async () => { const exists = fields.some((f) => f.id === form.id); await save(exists ? fields.map((f) => (f.id === form.id ? form : f)) : [...fields, form]); setForm(null); }}>保存字段</button></div>
        </section>
      )}
    </div>
  );
}
