import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '../lib/app';
import { DEMO } from '../lib/firebase';
import { t } from '../lib/i18n';
import { listenForeground } from '../lib/notify';
import { playSound, usePrefs } from '../lib/prefs';
import { useCollection } from '../lib/store';
import type { AppNotification, Inspection, Trip, Worksheet } from '../lib/types';
import { roleLabel } from '../lib/types';
import { daysSince, initial, statusOf, today } from '../lib/utils';
import { Icon } from './Icon';
import { useUi } from './ui';

export function useMyNotifications() {
  const { staff } = useApp();
  const rows = useCollection<AppNotification>(staff ? 'notifications' : null, staff ? { where: [['to', 'in', [staff.id, `${staff.role}@role`]]], orderBy: ['createdAt', 'desc'], limit: 40 } : undefined);
  const unread = (rows || []).filter((n) => !(n.readBy || []).includes(staff?.id || ''));
  return { rows, unread };
}

export function useOpenWorksheets() {
  return useCollection<Worksheet>('worksheets', { where: [['status', '!=', 'closed']] });
}

export function Layout({ children }: { children: ReactNode }) {
  const { staff, role, statuses, general, signOut } = useApp();
  const [prefs] = usePrefs();
  const nav = useNavigate();
  const { toast } = useUi();
  const [q, setQ] = useState('');
  const open = useOpenWorksheets();
  const insp = useCollection<Inspection>('inspections', { where: [['date', '==', today()]] });
  const trips = useCollection<Trip>('trips', { where: [['date', '==', today()]] });
  const { rows: noteRows, unread } = useMyNotifications();

  const counts = useMemo(() => {
    const ws = open || [];
    const mine = ws.filter((w) => statusOf(statuses, w.status).owner === role && (role !== 'mechanic' || !w.assignee || w.assignee === staff?.id)).length;
    const overdue = ws.filter((w) => daysSince(w.statusSince) > general.overdueDays).length;
    return {
      home: mine,
      board: overdue,
      insp: (insp || []).filter((i) => i.result === 'booked').length,
      route: (trips || []).filter((x) => x.status !== 'done').length,
    };
  }, [open, insp, trips, role, statuses, staff?.id, general.overdueDays]);

  // sound + toast when a new notification arrives while the system is open
  const seen = useRef<number | null>(null);
  useEffect(() => {
    if (!noteRows) return;
    if (seen.current !== null && unread.length > seen.current) {
      playSound();
      toast(unread[0]?.title || '有新通知');
    }
    seen.current = unread.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unread.length, noteRows === null]);
  useEffect(() => { listenForeground((title) => toast(title)); }, [toast]);

  const groups: { g: string; items: { to: string; icon: string; label: string; n?: number; red?: boolean }[] }[] = [
    { g: '日常工作', items: [
      { to: '/', icon: 'home', label: '我的工作', n: counts.home, red: true },
      { to: '/board', icon: 'board', label: '工作表看板', n: counts.board, red: true },
      { to: '/worksheets', icon: 'ws', label: '工作表' },
      { to: '/inspections', icon: 'insp', label: '验车服务', n: counts.insp },
      { to: '/rentals', icon: 'rent', label: '机械租赁' },
      { to: '/transport', icon: 'route', label: '交通运输', n: counts.route },
      { to: '/calendar', icon: 'cal', label: '日历' },
    ] },
    { g: '资料', items: [{ to: '/parts', icon: 'parts', label: '零件库' }] },
    { g: '系统', items: [{ to: '/settings', icon: 'set', label: '设置' }] },
  ];

  return (
    <div className="shell" data-lang={prefs.lang}>
      <aside className="side">
        <Link to="/" className="brand" aria-label={`${general.companyName} · 我的工作`}>
          <img className="logo-dark" src="/logo-white.png" alt="WEE HONG" />
          <img className="logo-light" src="/logo-color.png" alt="WEE HONG" />
        </Link>
        <div className="me">
          <div className="avatar">{initial(staff?.name)}</div>
          <div className="two" style={{ flex: 1 }}><b className="ell">{staff?.name}</b><span>{t(roleLabel(role || ''))}{DEMO ? ' · 示范' : ''}</span></div>
          <button className="iconbtn" type="button" aria-label={t('退出登录')} title={t('退出登录')} onClick={() => signOut()}><Icon name="logout" /></button>
        </div>
        <nav aria-label="主导航" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {groups.map((grp) => (
            <div key={grp.g} style={{ display: 'contents' }}>
              <span className="navg">{t(grp.g)}</span>
              {grp.items.map((it) => (
                <NavLink key={it.to} to={it.to} end={it.to === '/'} className={({ isActive }) => `nav ${isActive ? 'on' : ''}`}>
                  <span className="ico"><Icon name={it.icon} /></span>
                  <span className="label">{t(it.label)}</span>
                  {!!it.n && <span className={`count ${it.red ? 'red' : ''}`}>{it.n}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <main className="main">
        <header className="topbar noprint">
          <form className="searchbox" role="search" onSubmit={(e) => { e.preventDefault(); nav(`/search?q=${encodeURIComponent(q)}`); }}>
            <Icon name="search" />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索车牌、机械代号、工作表号、顾客" aria-label={t('搜索')} />
          </form>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link className="iconbtn" to="/settings/display" aria-label="显示与语言"><Icon name="moon" /></Link>
            <Link className="iconbtn" to="/#notifications" aria-label={`通知，${unread.length} 项未读`}>
              <Icon name="bell" />{unread.length > 0 && <span className="badge">{unread.length}</span>}
            </Link>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
