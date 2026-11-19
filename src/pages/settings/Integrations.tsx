import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { Banner, Pill, Switch, useUi } from '../../components/ui';
import { useApp } from '../../lib/app';
import { API_URL, DEMO } from '../../lib/firebase';
import { apiRedirect, callApi } from '../../lib/notify';
import { store, useDoc } from '../../lib/store';
import { fmtTime } from '../../lib/utils';

interface Integ {
  autocount?: { configured?: boolean; lastRun?: string; lastSuccess?: string; lastError?: string; counts?: Record<string, number> };
  google?: { connected?: boolean; email?: string; folderUrl?: string; calendarUrl?: string; lastSync?: string; lastError?: string };
  options?: { drivePdf?: boolean; drivePhotos?: boolean; calMaint?: boolean; calRentEnd?: boolean; calInspection?: boolean; calTrips?: boolean };
}

export default function Integrations() {
  const { can } = useApp();
  const { toast } = useUi();
  const d = useDoc<Integ>('settings/integrations');
  const [busy, setBusy] = useState('');
  const edit = can('settings.edit');
  const ac = d?.autocount;
  const g = d?.google;
  const o = { drivePdf: true, drivePhotos: true, calMaint: true, calRentEnd: true, calInspection: true, calTrips: true, ...(d?.options || {}) };
  const setOpt = (k: keyof typeof o, v: boolean) => store.set('settings/integrations', { options: { ...o, [k]: v } }, true);
  const run = async (key: string, path: string, ok: string) => {
    setBusy(key);
    try { await callApi(path); toast(ok); } catch (e: any) { toast(e.message); }
    setBusy('');
  };
  const card = (title: string, sub: string, icon: string, status: React.ReactNode, children: React.ReactNode) => (
    <section className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--card)', display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={icon} size={20} /></span>
        <div className="col" style={{ gap: 3, flex: 1 }}><h2 style={{ fontSize: '1.05rem' }}>{title}</h2><span className="k">{sub}</span></div>
        {status}
      </div>
      {children}
    </section>
  );
  const row = (k: string, v: React.ReactNode) => <div className="sub" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '10px 14px' }}><span className="k">{k}</span><span style={{ fontWeight: 600, textAlign: 'right' }}>{v}</span></div>;
  const sw = (k: keyof typeof o, l: string) => <div className="sub" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '8px 14px' }}><span>{l}</span><Switch on={o[k]} label={l} onChange={(v) => edit && setOpt(k, v)} /></div>;
  return (
    <>
      {DEMO && <Banner tone="blue" title="示范模式">这里的连接要部署到 Firebase 和 Cloudflare 之后才能使用。</Banner>}
      {!DEMO && !API_URL && <Banner tone="amber" title="还没设定后端网址">请在 Cloudflare Pages 的环境变量加入 VITE_API_URL（Worker 网址），重新部署。</Banner>}
      <div className="grid2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, alignItems: 'start' }}>
        {card('Google 登录', '员工用 Google 账号登录系统', 'user', <Pill tone="green">已启用</Pill>, <>
          {row('登录方式', '只限 Google 账号')}
          {row('谁可以登录', '人员名单中的账号')}
        </>)}
        {card('Google Drive', '结案时保存工作表 PDF 和维修照片', 'folder', <Pill tone={g?.connected ? 'green' : 'grey'}>{g?.connected ? '已连接' : '未连接'}</Pill>, <>
          {g?.connected && row('Google 账号', g.email)}
          {row('保存位置', '维修工作表系统 / 年 / 月')}
          {sw('drivePdf', '结案时保存工作表 PDF')}
          {sw('drivePhotos', '维修照片复制到 Drive')}
          {g?.lastError && <span className="small" style={{ color: 'var(--red-ink)' }}>上次出错：{g.lastError}</span>}
          <div className="chips">
            {edit && !DEMO && <button className="btn sm" type="button" onClick={() => apiRedirect('/google/connect')}>{g?.connected ? '重新连接 Google' : '连接 Google 账号'}</button>}
            {g?.folderUrl && <a className="btn ghost sm" href={g.folderUrl} target="_blank" rel="noreferrer">打开文件夹</a>}
          </div>
        </>)}
        {card('Google 日历', '保养、租期、验车、运输自动排进日历', 'cal', <Pill tone={g?.connected ? 'green' : 'grey'}>{g?.connected ? '已连接' : '未连接'}</Pill>, <>
          {row('日历', '机械保养与租期')}
          {sw('calMaint', '每月保养日')}
          {sw('calRentEnd', '租期结束日')}
          {sw('calInspection', '验车日期')}
          {sw('calTrips', '交通运输行程')}
          {g?.lastSync && row('最近同步', fmtTime(g.lastSync))}
          <div className="chips">
            {g?.connected && <button className="btn ghost sm" type="button" disabled={busy === 'cal'} onClick={() => run('cal', '/api/google/sync', '已同步到 Google 日历')}><Icon name="sync" />立即同步</button>}
            {g?.calendarUrl && <a className="btn ghost sm" href={g.calendarUrl} target="_blank" rel="noreferrer">在 Google 日历中打开</a>}
          </div>
          <span className="small muted">连接 Google 账号后会自动建立日历，可在 Google 日历里再共享给员工。</span>
        </>)}
        {card('AutoCount', '同步零件、机械、顾客资料', 'sync', <Pill tone={!ac?.configured ? 'grey' : ac.lastError && (!ac.lastSuccess || ac.lastRun! > ac.lastSuccess) ? 'amber' : 'green'}>{!ac?.configured ? '未设定' : ac.lastError && (!ac.lastSuccess || ac.lastRun! > ac.lastSuccess) ? '同步失败' : '已连接'}</Pill>, <>
          {row('连接方式', 'AOTG API（经 Cloudflare Worker）')}
          {row('同步频率', '每 15 分钟')}
          {row('最近成功同步', ac?.lastSuccess ? fmtTime(ac.lastSuccess) : '—')}
          {ac?.counts && row('上次同步', `零件 ${ac.counts.parts ?? 0} · 机械 ${ac.counts.machines ?? 0} · 顾客 ${ac.counts.customers ?? 0}`)}
          {ac?.lastError && <span className="small" style={{ color: 'var(--amber-ink)' }}>上次出错：{ac.lastError}</span>}
          <div className="chips"><button className="btn ghost sm" type="button" disabled={busy === 'ac'} onClick={() => run('ac', '/api/autocount/sync', '同步完成')}><Icon name="sync" />立即同步</button></div>
          <span className="small muted">AutoCount 的 API Key 只放在 Cloudflare Worker 的机密变量里，不放在网页。</span>
        </>)}
        {card('弹窗通知', '手机和电脑的推送通知', 'bell', <Pill tone="green">Firebase Cloud Messaging</Pill>, <>
          <span className="small muted">每个人在“显示与语言”页按“开启弹窗通知”，就会在那台设备收到通知。</span>
          <div className="chips"><button className="btn ghost sm" type="button" disabled={busy === 'push'} onClick={() => run('push', '/api/push/test', '已发送测试通知，几秒内会弹出')}>发送测试通知给自己</button></div>
        </>)}
      </div>
    </>
  );
}
