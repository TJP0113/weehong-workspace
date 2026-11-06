import { useState } from 'react';
import { Icon } from '../components/Icon';
import { useApp } from '../lib/app';
import { DEMO_USERS } from '../lib/demo';
import { DEMO } from '../lib/firebase';
import { resetDemo } from '../lib/store';
import { roleLabel } from '../lib/types';

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <section className="card" style={{ width: '100%', maxWidth: 460, padding: '40px 36px', gap: 24, border: '1px solid var(--line2)' }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--accent)', display: 'grid', placeItems: 'center', color: '#fff' }}><Icon name="wrench" size={26} /></div>
        {children}
      </section>
    </div>
  );
}

export default function Login() {
  const { signIn } = useApp();
  const [err, setErr] = useState('');
  if (DEMO) {
    return (
      <Frame>
        <div className="col" style={{ gap: 8 }}>
          <h1 style={{ fontSize: '1.75rem' }}>维修工作表系统 · 示范</h1>
          <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>还没有连接 Firebase，资料只存在这个浏览器里。选一个身份进入试用：</p>
        </div>
        <div className="col" style={{ gap: 8 }}>
          {DEMO_USERS.map((u) => (
            <button key={u.email} className="btn ghost" style={{ justifyContent: 'space-between', minHeight: 52 }} type="button" onClick={() => signIn(u.email)}>
              <span>{u.name}</span><span className="muted">{roleLabel(u.role)}</span>
            </button>
          ))}
        </div>
        <button className="btn ghost sm" type="button" onClick={() => { resetDemo(); location.reload(); }}>重置示范资料</button>
      </Frame>
    );
  }
  return (
    <Frame>
      <div className="col" style={{ gap: 8 }}>
        <h1 style={{ fontSize: '1.75rem' }}>登录维修工作表系统</h1>
        <p className="muted" style={{ margin: 0 }}>使用公司发给你的 Google 账号登录。</p>
      </div>
      <button className="btn big" type="button" style={{ background: '#fff', color: '#1A1A1D' }} onClick={() => signIn().catch((e) => setErr(e.message))}>
        <Icon name="user" size={20} /> 使用 Google 账号登录
      </button>
      {err && <p style={{ color: 'var(--red-ink)', margin: 0 }}>{err}</p>}
      <div className="sub" style={{ display: 'flex', gap: 12 }}>
        <Icon name="lock" size={18} style={{ marginTop: 2, color: 'var(--muted)' }} />
        <span className="small muted" style={{ lineHeight: 1.6 }}>只有管理员加入“人员名单”的 Google 账号才能登录。无法登录请联系管理员。</span>
      </div>
    </Frame>
  );
}

export function NoAccess() {
  const { authUser, signOut } = useApp();
  return (
    <Frame>
      <div className="col" style={{ gap: 8 }}>
        <h1 style={{ fontSize: '1.6rem' }}>这个账号还没有权限</h1>
        <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}><b style={{ color: 'var(--ink)' }}>{authUser?.email}</b> 不在人员名单里，或已被停用。请管理员到“设置 · 人员与角色”加入这个 Google 账号。</p>
      </div>
      <button className="btn ghost" type="button" onClick={() => signOut()}>换一个账号</button>
    </Frame>
  );
}
