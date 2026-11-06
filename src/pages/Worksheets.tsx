import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { ExpandList, Loading, StatusPill, Two } from '../components/ui';
import { useApp } from '../lib/app';
import { useCollection } from '../lib/store';
import { wsTypeLabel, type Worksheet } from '../lib/types';
import { daysSince, fmtDate, includesAny, statusOf } from '../lib/utils';

export default function Worksheets() {
  const { statuses, can } = useApp();
  const [tab, setTab] = useState<'open' | 'closed'>('open');
  const [q, setQ] = useState('');
  const rows = useCollection<Worksheet>('worksheets', tab === 'open' ? { where: [['status', '!=', 'closed']] } : { where: [['status', '==', 'closed']], orderBy: ['updatedAt', 'desc'], limit: 200 });
  const list = (rows || []).filter((w) => includesAny([w.no, w.plate, w.customer, w.model, w.serial], q)).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return (
    <>
      <div className="pagehead">
        <div><h1>工作表</h1><p>点一行展开；点工作表号打开详情</p></div>
        {can('ws.create') && <Link className="btn" to="/worksheets/new"><Icon name="plus" />新建工作表</Link>}
      </div>
      <section className="card tight">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', padding: '10px 10px 14px' }}>
          <div className="seg" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'open'} className={tab === 'open' ? 'on' : ''} onClick={() => setTab('open')}>进行中</button>
            <button type="button" role="tab" aria-selected={tab === 'closed'} className={tab === 'closed' ? 'on' : ''} onClick={() => setTab('closed')}>已结案</button>
          </div>
          <label className="searchbox" style={{ maxWidth: 320, height: 40 }}><Icon name="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索车牌、顾客、工作表号" aria-label="搜索工作表" /></label>
        </div>
        {!rows ? <Loading /> : (
          <ExpandList rows={list} cols="minmax(0,1fr) minmax(0,1.8fr) minmax(0,1fr) minmax(0,0.8fr)" head={['车牌 / 单号', '顾客 · 型号', '状态', '天数']}
            summary={(w) => {
              const s = statusOf(statuses, w.status);
              return <>
                <Two a={w.plate ? <span className="plate">{w.plate}</span> : w.no} b={w.plate ? w.no : wsTypeLabel(w.type)} />
                <Two a={w.customer} b={w.model} />
                <span><StatusPill s={s} /></span>
                <span className="num">{w.status === 'closed' ? fmtDate(w.updatedAt) : `${daysSince(w.statusSince)} 天`}</span>
              </>;
            }}
            detail={(w) => <>
              <dl className="dgrid">
                <div><dt>类型</dt><dd>{wsTypeLabel(w.type)}</dd></div>
                <div><dt>负责维修员</dt><dd>{w.assigneeName || '未派工'}</dd></div>
                <div><dt>零件</dt><dd>{w.partsCount || 0} 项{w.waitingParts ? `（${w.waitingParts} 项待料）` : ''}</dd></div>
                <div><dt>建立</dt><dd>{fmtDate(w.createdAt)} · {w.createdByName}</dd></div>
                {w.source && <div style={{ gridColumn: '1 / -1' }}><dt>来源</dt><dd>{w.source.label}</dd></div>}
              </dl>
              <div className="chips"><Link className="btn sm" to={`/worksheets/${w.id}`}>打开工作表</Link><a className="btn ghost sm" href={`/worksheets/${w.id}/print`} target="_blank" rel="noreferrer"><Icon name="print" />打印 / PDF</a></div>
            </>}
          />
        )}
      </section>
    </>
  );
}
