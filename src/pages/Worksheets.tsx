import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { DarkZone, DSearch, DSeg, FSelect, GlassStat, LimeAdd, PageHero, usePaged, WsCard } from '../components/glass';
import { Loading } from '../components/ui';
import { useApp } from '../lib/app';
import { useCollection } from '../lib/store';
import { WS_TYPES, type Worksheet } from '../lib/types';
import { daysSince, includesAny, today } from '../lib/utils';

export default function Worksheets() {
  const { can, general } = useApp();
  const [tab, setTab] = useState<'open' | 'closed'>('open');
  const [q, setQ] = useState('');
  const [typeF, setTypeF] = useState('');
  const openRows = useCollection<Worksheet>('worksheets', { where: [['status', '!=', 'closed']] });
  const closedRows = useCollection<Worksheet>('worksheets', { where: [['status', '==', 'closed']], orderBy: ['updatedAt', 'desc'], limit: 200 });
  const rows = tab === 'open' ? openRows : closedRows;
  const list = (rows || []).filter((w) => (!typeF || w.type === typeF) && includesAny([w.no, w.plate, w.customer, w.model, w.serial], q)).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  const { shown, pager, reset } = usePaged(list, 12);
  const isLate = (w: Worksheet) => w.status !== 'closed' && daysSince(w.statusSince) > general.overdueDays;
  const month = today().slice(0, 7);
  const o = openRows || [];
  return (
    <>
      <PageHero label="工作表"
        kicker={<span className="datechip">点卡片打开工作表</span>}
        title={<>全部<br />工作表</>}
        actions={can('ws.create') && <Link className="btn" to="/worksheets/new"><Icon name="plus" />新建工作表</Link>}
        side={<GlassStat title="概况" items={[
          { n: o.length, unit: '张', label: '进行中', onClick: () => { setTab('open'); reset(); }, on: tab === 'open' },
          { n: o.filter((w) => w.waitingParts).length, unit: '张', label: '有零件待料', tone: o.some((w) => w.waitingParts) ? 'amber' : undefined },
          { n: o.filter(isLate).length, unit: '张', label: '超时', tone: o.some(isLate) ? 'red' : undefined },
          { n: (closedRows || []).filter((w) => w.updatedAt?.slice(0, 7) === month).length, unit: '张', label: '本月结案', onClick: () => { setTab('closed'); reset(); }, on: tab === 'closed' },
        ]} />}
      />
      <DarkZone label="工作表列表" bar={<>
        <DSeg value={tab} onChange={(k) => { setTab(k); reset(); }} tabs={[{ k: 'open', l: '进行中', n: o.length }, { k: 'closed', l: '已结案' }]} />
        <FSelect label="类型" value={typeF} onChange={(v) => { setTypeF(v); reset(); }} all="全部类型" options={WS_TYPES.map((t) => ({ v: t.key, l: t.label }))} />
        <DSearch value={q} onChange={(v) => { setQ(v); reset(); }} placeholder="搜索车牌、顾客、工作表号" />
        {can('ws.create') && <LimeAdd to="/worksheets/new" label="新建工作表" />}
        {pager}
      </>}>
        {!rows ? <Loading /> : shown.length === 0 ? <p className="kd" style={{ margin: 0 }}>没有符合的工作表</p> : (
          <div className="wgrid">
            {shown.map((w) => <WsCard key={w.id} w={w} late={isLate(w)} />)}
          </div>
        )}
      </DarkZone>
    </>
  );
}
