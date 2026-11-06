import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useApp } from '../../lib/app';
import Display from './Display';
import Fields from './Fields';
import General from './General';
import Integrations from './Integrations';
import Positions from './Positions';
import Statuses from './Statuses';
import Users from './Users';

const ITEMS = [
  ['fields', '工作表字段'], ['positions', '零件位置区分'], ['statuses', '工作状态'], ['users', '人员与角色'],
  ['general', '公司与车辆'], ['display', '显示与语言'], ['integrations', '连接与整合'],
];

export default function Settings() {
  const { can } = useApp();
  const admin = can('settings.edit') || can('users.edit');
  return (
    <>
      <h1>设置</h1>
      <div className="row">
        <nav aria-label="设置分类" className="card" style={{ flex: '1 1 200px', maxWidth: '100%', padding: 8, gap: 2, borderRadius: 20 }}>
          {ITEMS.filter(([k]) => admin || k === 'display').map(([k, l]) => (
            <NavLink key={k} to={`/settings/${k}`} className={({ isActive }) => `nav ${isActive ? 'on' : ''}`} style={{ minHeight: 44, padding: '0 12px' }}>{l}</NavLink>
          ))}
        </nav>
        <div className="col" style={{ flex: '999 1 640px', gap: 20 }}>
          <Routes>
            <Route index element={<Navigate to={admin ? 'fields' : 'display'} replace />} />
            <Route path="fields" element={<Fields />} />
            <Route path="positions" element={<Positions />} />
            <Route path="statuses" element={<Statuses />} />
            <Route path="users" element={<Users />} />
            <Route path="general" element={<General />} />
            <Route path="display" element={<Display />} />
            <Route path="integrations" element={<Integrations />} />
          </Routes>
        </div>
      </div>
    </>
  );
}

export function ReadOnlyNote() {
  return <p className="small muted" style={{ margin: 0 }}>只有管理员可以修改这里的设置。</p>;
}
