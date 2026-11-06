import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Banner, ExpandList, Loading, Stat, Two, useUi } from '../components/ui';
import { useApp } from '../lib/app';
import { DEMO } from '../lib/firebase';
import { callApi } from '../lib/notify';
import { useCollection, useDoc } from '../lib/store';
import type { Part } from '../lib/types';
import { fmtTime, includesAny } from '../lib/utils';

export function useAutoCountStatus() {
  const s = useDoc<{ autocount?: { configured?: boolean; lastRun?: string; lastSuccess?: string; lastError?: string; counts?: Record<string, number> } }>('settings/integrations');
  return s?.autocount;
}

export function AutoCountBanner() {
  const ac = useAutoCountStatus();
  if (!ac || DEMO) return null;
  if (!ac.configured) return <Banner tone="blue" title="AutoCount 还没连接">零件和机械资料要从 AutoCount 同步。请按部署说明设定 AutoCount 连接。</Banner>;
  if (ac.lastError && (!ac.lastSuccess || ac.lastRun! > ac.lastSuccess)) return <Banner tone="amber" title="AutoCount 同步失败">最后成功同步是 {ac.lastSuccess ? fmtTime(ac.lastSuccess) : '从未'}，零件库存可能不是最新。装有 AutoCount 的电脑可能关机了。（{ac.lastError}）</Banner>;
  return null;
}

export default function Parts() {
  const { positions, can } = useApp();
  const { toast } = useUi();
  const parts = useCollection<Part>('parts', { orderBy: ['name', 'asc'] });
  const ac = useAutoCountStatus();
  const [tab, setTab] = useState<'all' | 'pos' | 'none'>('all');
  const [q, setQ] = useState('');
  const [syncing, setSyncing] = useState(false);
  const list = (parts || []).filter((p) => (tab === 'all' || (tab === 'pos' ? (p.groups || []).length : !(p.groups || []).length)) && includesAny([p.code, p.name, p.spec], q));
  const posName = (p: Part) => (p.groups || []).map((g) => positions.find((x) => x.id === g)?.name).filter(Boolean).join(' · ');
  const sync = async () => {
    setSyncing(true);
    try { const r = await callApi('/api/autocount/sync'); toast(`同步完成：${r.parts ?? 0} 项零件`); } catch (e: any) { toast(e.message); }
    setSyncing(false);
  };
  return (
    <>
      <div className="pagehead">
        <div><h1>零件库</h1><p>零件全部来自 AutoCount{ac?.lastSuccess ? `（最近同步 ${fmtTime(ac.lastSuccess)}）` : ''}；前后、左右等位置区分在本系统设定</p></div>
        <div className="chips">
          <button className="btn ghost" type="button" disabled={syncing} onClick={sync}><Icon name="sync" />{syncing ? '同步中…' : '立即同步'}</button>
          {can('settings.edit') && <Link className="btn" to="/settings/positions"><Icon name="set" />设定位置区分</Link>}
        </div>
      </div>
      <AutoCountBanner />
      {parts && (
        <div className="stats">
          <Stat n={`${parts.length} 项`} label="AutoCount 零件" />
          <Stat n={`${parts.filter((p) => (p.groups || []).length).length} 项`} label="已设位置区分" />
          <Stat n={`${parts.filter((p) => p.stock === 0).length} 项`} label="AutoCount 库存为 0" tone={parts.some((p) => p.stock === 0) ? 'amber' : undefined} />
        </div>
      )}
      <section className="card tight">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', padding: '10px 10px 14px' }}>
          <div className="seg" role="tablist">
            {(['all', 'pos', 'none'] as const).map((k) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{{ all: '全部', pos: '有位置区分', none: '无位置区分' }[k]}</button>)}
          </div>
          <label className="searchbox" style={{ maxWidth: 320, height: 40 }}><Icon name="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索编号或名称" aria-label="搜索零件" /></label>
        </div>
        {!parts ? <Loading /> : (
          <ExpandList rows={list} cols="minmax(0,2fr) minmax(0,1.3fr) minmax(0,0.8fr)" head={['零件', '位置区分', '库存']}
            summary={(p) => <>
              <Two a={p.name} b={p.code} />
              <span className="ell">{posName(p) ? <span className="tag">{posName(p)}</span> : <span className="muted small">无</span>}</span>
              <span className="num" style={{ fontWeight: 600, color: p.stock === 0 ? 'var(--amber-ink)' : undefined }}>{p.stock ?? '—'} {p.unit}</span>
            </>}
            detail={(p) => <>
              <dl className="dgrid"><div><dt>规格</dt><dd>{p.spec || '—'}</dd></div><div><dt>单位</dt><dd>{p.unit || '—'}</dd></div><div><dt>快速勾选分类</dt><dd>{p.category || '—'}</dd></div><div><dt>同步时间</dt><dd>{fmtTime(p.syncedAt)}</dd></div></dl>
              {can('settings.edit') && <div className="chips"><Link className="btn ghost sm" to="/settings/positions">设定位置区分</Link></div>}
            </>}
          />
        )}
        <p className="small muted" style={{ margin: '14px 16px 2px' }}>零件只能从 AutoCount 同步，不在本系统新增。位置区分只存在本系统，不会改动 AutoCount 资料。</p>
      </section>
    </>
  );
}
