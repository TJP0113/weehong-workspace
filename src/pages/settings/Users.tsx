import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { ExpandList, Loading, Pill, Two, useUi } from '../../components/ui';
import { useApp } from '../../lib/app';
import { DEFAULT_PERMISSIONS } from '../../lib/defaults';
import { DEMO } from '../../lib/firebase';
import { store, useCollection } from '../../lib/store';
import { PERM_GROUPS, ROLES, roleLabel, type Perm, type Role, type Staff } from '../../lib/types';
import { fmtTime, initial } from '../../lib/utils';
import { ReadOnlyNote } from './Settings';

export default function Users() {
  const { can, permissions, staff: me } = useApp();
  const { toast, confirm } = useUi();
  const edit = can('users.edit');
  const users = useCollection<Staff>('users', { orderBy: ['name', 'asc'] });
  const [roleTab, setRoleTab] = useState<'all' | Role>('all');
  const [f, setF] = useState({ name: '', email: '', phone: '', role: 'mechanic' as Role });
  const [editing, setEditing] = useState<Staff | null>(null);
  if (!users) return <Loading />;
  const list = users.filter((u) => roleTab === 'all' || u.role === roleTab);
  const add = async () => {
    const email = f.email.trim().toLowerCase();
    if (users.some((u) => u.id === email)) { toast('这个账号已经在名单里'); return; }
    await store.set(`users/${email}`, { email, name: f.name.trim(), phone: f.phone.trim(), role: f.role, active: true });
    setF({ name: '', email: '', phone: '', role: 'mechanic' });
    toast(`已加入 ${f.name}，他现在可以用 Google 账号登录`);
  };
  const toggleActive = async (u: Staff) => {
    if (u.id === me!.id) { toast('不能停用自己'); return; }
    if (u.active && !(await confirm({ title: `停用 ${u.name}？`, body: '停用后无法登录，但过去的记录会保留。', ok: '停用', danger: true }))) return;
    await store.update(`users/${u.id}`, { active: !u.active });
    toast(u.active ? `已停用 ${u.name}` : `已启用 ${u.name}`, () => store.update(`users/${u.id}`, { active: u.active }));
  };
  const togglePerm = async (p: Perm, r: Role) => {
    const cur = permissions[p] || DEFAULT_PERMISSIONS[p];
    const next = cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r];
    if ((p === 'users.edit' || p === 'settings.edit') && r === 'admin' && !next.includes('admin')) { toast('管理员必须保留这项权限'); return; }
    await store.set('settings/permissions', { ...permissions, [p]: next });
  };
  return (
    <div className="row">
      <div className="col" style={{ flex: '999 1 560px', gap: 20 }}>
        <section className="card tight">
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, padding: '12px 12px 14px' }}>
            <div className="col" style={{ gap: 6 }}><h2>人员名单</h2><p className="small muted" style={{ margin: 0 }}>{users.filter((u) => u.active).length} 人使用中 · {users.filter((u) => !u.active).length} 人已停用。停用后无法登录，但过去的记录会保留。</p></div>
            <div className="seg" role="tablist">{([['all', '全部'], ...ROLES.map((r) => [r.key, r.label])] as [string, string][]).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={roleTab === k} className={roleTab === k ? 'on' : ''} onClick={() => setRoleTab(k as any)}>{l}</button>)}</div>
          </div>
          <ExpandList rows={list} cols="minmax(0,1.6fr) minmax(0,1fr) minmax(0,0.7fr)" head={['姓名', '角色', '状态']}
            summary={(u) => <>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, opacity: u.active ? 1 : 0.55 }}><span className="avatar sm">{initial(u.name)}</span><b className="ell">{u.name}</b></span>
              <span><span className="tag">{roleLabel(u.role)}</span></span>
              <span><Pill tone={u.active ? 'green' : 'grey'}>{u.active ? '使用中' : '已停用'}</Pill></span>
            </>}
            detail={(u) => editing?.id === u.id ? (
              <div className="grid2">
                <div className="field"><label htmlFor="eu-n">姓名</label><input id="eu-n" className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
                <div className="field"><label htmlFor="eu-p">电话</label><input id="eu-p" className="input" value={editing.phone || ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
                <div className="field" style={{ gridColumn: '1 / -1' }}><span className="lbl">角色</span><div className="chips">{ROLES.map((r) => <button key={r.key} type="button" className={`choice ${editing.role === r.key ? 'on' : ''}`} aria-pressed={editing.role === r.key} onClick={() => setEditing({ ...editing, role: r.key })}>{r.label}</button>)}</div></div>
                <div className="chips"><button className="btn ghost sm" type="button" onClick={() => setEditing(null)}>取消</button><button className="btn sm" type="button" onClick={async () => { await store.update(`users/${u.id}`, { name: editing.name, phone: editing.phone || '', role: editing.role }); setEditing(null); toast('已保存'); }}>保存</button></div>
              </div>
            ) : <>
              <dl className="dgrid"><div><dt>Google 账号</dt><dd style={{ wordBreak: 'break-all' }}>{u.email || u.id}</dd></div><div><dt>电话</dt><dd>{u.phone || '—'}</dd></div><div><dt>最近登录</dt><dd>{u.lastLogin ? fmtTime(u.lastLogin) : '还没登录'}</dd></div></dl>
              {edit && <div className="chips"><button className="btn ghost sm" type="button" onClick={() => setEditing(u)}><Icon name="edit" />编辑</button><button className="btn ghost sm" type="button" onClick={() => toggleActive(u)}>{u.active ? '停用' : '启用'}</button></div>}
            </>}
          />
        </section>
        <section className="card tight">
          <div className="col" style={{ gap: 6, padding: '12px 12px 14px' }}><h2>角色权限</h2><p className="small muted" style={{ margin: 0 }}>每个角色可以做什么。改动对该角色的所有人员生效。</p></div>
          {PERM_GROUPS.map((g) => (
            <div key={g.group}>
              <div style={{ padding: '14px 14px 6px', fontSize: '0.87rem', fontWeight: 600, color: 'var(--blue-ink)' }}>{g.group}</div>
              <div className="lhead" style={{ gridTemplateColumns: `minmax(0,2fr) repeat(4, 72px)` }}><span /> {ROLES.map((r) => <span key={r.key} style={{ textAlign: 'center' }}>{r.label}</span>)}</div>
              {g.items.map((it) => (
                <div key={it.key} className="lrow" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) repeat(4, 72px)', gap: 12, alignItems: 'center', padding: '6px 14px' }}>
                  <span>{it.label}</span>
                  {ROLES.map((r) => { const on = (permissions[it.key] || []).includes(r.key); return <button key={r.key} type="button" role="checkbox" aria-checked={on} aria-label={`${r.label}：${it.label}`} disabled={!edit} onClick={() => togglePerm(it.key, r.key)} className={`check ${on ? 'on' : ''}`} style={{ width: 36, height: 36, borderRadius: 10, justifySelf: 'center', cursor: edit ? 'pointer' : 'default' }}>{on && <Icon name="check" size={14} stroke={3} />}</button>; })}
                </div>
              ))}
            </div>
          ))}
        </section>
      </div>
      {edit ? (
        <section className="card aside" style={{ border: '1px solid var(--line)' }}>
          <h2>新增人员</h2>
          <div className="field"><label htmlFor="u-n">姓名</label><input id="u-n" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="例如：吴志强" /></div>
          <div className="field"><label htmlFor="u-e">Google 账号（电邮）</label><input id="u-e" className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="name@gmail.com 或公司 Google 邮箱" /></div>
          <div className="field"><label htmlFor="u-p">电话（选填）</label><input id="u-p" className="input" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          <div className="field"><span className="lbl">角色</span><div className="grid2" style={{ gap: 8 }}>{ROLES.map((r) => <button key={r.key} type="button" role="radio" aria-checked={f.role === r.key} className={`choice ${f.role === r.key ? 'on' : ''}`} onClick={() => setF({ ...f, role: r.key })}>{r.label}</button>)}</div></div>
          <p className="small muted" style={{ margin: 0, lineHeight: 1.6 }}>{DEMO ? '示范模式：新加的人员不能真的登录。' : '加入后，这位人员直接用这个 Google 账号登录，不需要另设密码。'}</p>
          <button className="btn" type="button" disabled={!f.name.trim() || !/@/.test(f.email)} onClick={add}>加入人员名单</button>
        </section>
      ) : <ReadOnlyNote />}
    </div>
  );
}
