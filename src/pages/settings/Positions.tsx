import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { Loading, Modal, useUi } from '../../components/ui';
import { useApp } from '../../lib/app';
import { store, useCollection } from '../../lib/store';
import type { Part, PositionGroup } from '../../lib/types';
import { includesAny, uid } from '../../lib/utils';
import { ReadOnlyNote } from './Settings';

export default function Positions() {
  const { positions, general, can } = useApp();
  const { toast } = useUi();
  const edit = can('settings.edit');
  const parts = useCollection<Part>('parts', { orderBy: ['name', 'asc'] });
  const [q, setQ] = useState('');
  const [g, setG] = useState<PositionGroup | null>(null);
  const saveGroups = async (list: PositionGroup[]) => { await store.set('settings/positions', { list }); toast('已保存'); };
  const toggle = (p: Part, gid: string) => {
    const on = (p.groups || []).includes(gid);
    store.update(`parts/${p.id}`, { groups: on ? (p.groups || []).filter((x) => x !== gid) : [...(p.groups || []), gid] });
  };
  const combos = (p: Part) => {
    let c: string[][] = [[]];
    (p.groups || []).forEach((id) => { const gr = positions.find((x) => x.id === id); if (gr) c = c.flatMap((x) => gr.options.map((o) => [...x, o])); });
    return (p.groups || []).length ? c.map((x) => x.join('')).join('、') : '无需选择';
  };
  const list = (parts || []).filter((p) => includesAny([p.code, p.name], q));
  const cols = `minmax(0,1.6fr) repeat(${positions.length}, 72px) minmax(0,1fr)`;
  return (
    <>
      <section className="card">
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }}>
          <div className="col" style={{ gap: 6 }}><h2>位置选项组</h2><p className="small muted" style={{ margin: 0 }}>AutoCount 没有区分前后左右，在这里补上。只存在本系统，不会改动 AutoCount 资料。</p></div>
          {edit && <button className="btn" type="button" onClick={() => setG({ id: uid(), name: '', options: [] })}><Icon name="plus" />新增选项组</button>}
        </div>
        {!edit && <ReadOnlyNote />}
        <div className="grid-auto">
          {positions.map((x) => (
            <div key={x.id} className="sub col" style={{ gap: 10, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><b>{x.name}</b>{edit && <button className="iconbtn" style={{ width: 32, height: 32 }} type="button" aria-label={`编辑 ${x.name}`} onClick={() => setG(x)}><Icon name="edit" size={14} /></button>}</div>
              <div className="chips">{x.options.map((o) => <span key={o} className="tag">{o}</span>)}</div>
              <span className="small muted">{x.en ? `${x.en} · ` : ''}用于 {(parts || []).filter((p) => (p.groups || []).includes(x.id)).length} 个零件</span>
            </div>
          ))}
        </div>
      </section>
      <section className="card tight">
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, padding: '12px 12px 14px' }}>
          <div className="col" style={{ gap: 6 }}><h2>为零件设定位置和分类</h2><p className="small muted" style={{ margin: 0 }}>勾选后，加入这个零件时就要选位置。分类用于新建工作表的快速勾选。</p></div>
          <label className="searchbox" style={{ maxWidth: 280, height: 40 }}><Icon name="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索 AutoCount 零件" aria-label="搜索零件" /></label>
        </div>
        {!parts ? <Loading /> : (
          <div>
            <div className="lhead" style={{ gridTemplateColumns: cols }}><span>零件 · 加入时可选</span>{positions.map((x) => <span key={x.id} style={{ textAlign: 'center' }}>{x.name}</span>)}<span>快速勾选分类</span></div>
            {list.map((p) => (
              <div key={p.id} className="lrow" style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, alignItems: 'center', padding: '8px 14px' }}>
                <span className="two"><b className="ell">{p.name}</b><span className="ell">{p.code} · {combos(p)}</span></span>
                {positions.map((x) => { const on = (p.groups || []).includes(x.id); return <button key={x.id} type="button" role="checkbox" aria-checked={on} aria-label={`${p.name} ${x.name}`} disabled={!edit} onClick={() => toggle(p, x.id)} className={`check ${on ? 'on' : ''}`} style={{ width: 40, height: 40, borderRadius: 10, justifySelf: 'center', cursor: edit ? 'pointer' : 'default' }}>{on && <Icon name="check" size={14} stroke={3} />}</button>; })}
                <select className="input" style={{ height: 40 }} aria-label={`${p.name} 分类`} disabled={!edit} value={p.category || ''} onChange={(e) => store.update(`parts/${p.id}`, { category: e.target.value })}><option value="">不分类</option>{general.partCategories.map((c) => <option key={c}>{c}</option>)}</select>
              </div>
            ))}
          </div>
        )}
      </section>
      {g && (
        <Modal title={positions.some((x) => x.id === g.id) ? '编辑选项组' : '新增选项组'} onClose={() => setG(null)}>
          <div className="field"><label htmlFor="gn">名称</label><input id="gn" className="input" value={g.name} onChange={(e) => setG({ ...g, name: e.target.value })} placeholder="例如：内 / 外" /></div>
          <div className="field"><label htmlFor="ge">英文（选填，打印用）</label><input id="ge" className="input" value={g.en || ''} onChange={(e) => setG({ ...g, en: e.target.value })} placeholder="例如：Inner / Outer" /></div>
          <div className="field"><label htmlFor="go">选项（用逗号分开）</label><input id="go" className="input" value={g.options.join('，')} onChange={(e) => setG({ ...g, options: e.target.value.split(/[,，]/).map((x) => x.trim()).filter(Boolean) })} placeholder="内，外" /></div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
            {positions.some((x) => x.id === g.id) ? <button className="btn ghost" type="button" onClick={async () => { await saveGroups(positions.filter((x) => x.id !== g.id)); setG(null); }}>删除这个选项组</button> : <span />}
            <div style={{ display: 'flex', gap: 10 }}><button className="btn ghost" type="button" onClick={() => setG(null)}>取消</button><button className="btn" type="button" disabled={!g.name || g.options.length < 2} onClick={async () => { await saveGroups(positions.some((x) => x.id === g.id) ? positions.map((x) => (x.id === g.id ? g : x)) : [...positions, g]); setG(null); }}>保存</button></div>
          </div>
        </Modal>
      )}
    </>
  );
}
