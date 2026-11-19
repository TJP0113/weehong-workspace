import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
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
  const loc = useLocation();
  const menuRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => { menuRef.current?.removeAttribute('open'); }, [loc.pathname]);
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

  const items: { to: string; label: string; n?: number; red?: boolean }[] = [
    { to: '/', label: '我的工作', n: counts.home, red: true },
    { to: '/board', label: '看板', n: counts.board, red: true },
    { to: '/worksheets', label: '工作表' },
    { to: '/inspections', label: '验车', n: counts.insp },
    { to: '/rentals', label: '租赁' },
    { to: '/transport', label: '运输', n: counts.route },
    { to: '/calendar', label: '日历' },
    { to: '/parts', label: '零件库' },
  ];

  return (
    <div className="shell" data-lang={prefs.lang}>
      <div className="bgphoto" aria-hidden="true" />
      <header className="topnav noprint">
        <Link to="/" className="brand" aria-label={`${general.companyName} · 我的工作`}>
          <img className="logo-dark" src="/logo-white.png" alt="WEE HONG" />
          <img className="logo-light" src="/logo-color.png" alt="WEE HONG" />
        </Link>
        <nav aria-label="主导航" className="tabs">
          {items.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.to === '/'} className={({ isActive }) => `tab ${isActive ? 'on' : ''}`}>
              {t(it.label)}
              {!!it.n && <span className={`count ${it.red ? 'red' : ''}`}>{it.n}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="tools">
          <form className="searchbox" role="search" onSubmit={(e) => { e.preventDefault(); nav(`/search?q=${encodeURIComponent(q)}`); }}>
            <Icon name="search" />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索车牌、工作表号、顾客" aria-label={t('搜索')} />
          </form>
          <Link className="iconbtn" to="/#notifications" aria-label={`通知，${unread.length} 项未读`}>
            <Icon name="bell" />{unread.length > 0 && <span className="badge">{unread.length}</span>}
          </Link>
          <NavLink className={({ isActive }) => `iconbtn ${isActive ? 'on' : ''}`} to="/settings" aria-label={t('设置')}><Icon name="set" /></NavLink>
          <details className="usermenu" ref={menuRef}>
            <summary aria-label={`${staff?.name || ''} · 账号`}><span className="avatar notranslate sm me-avatar">{initial(staff?.name)}</span></summary>
            <div className="menu">
              <div className="two"><b className="ell">{staff?.name}</b><span>{t(roleLabel(role || ''))}{DEMO ? ' · 示范' : ''}</span></div>
              <Link className="btn ghost sm" to="/settings/display"><Icon name="moon" />{t('显示与语言')}</Link>
              <button className="btn ghost sm" type="button" onClick={() => signOut()}><Icon name="logout" />{t('退出登录')}</button>
            </div>
          </details>
        </div>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}
