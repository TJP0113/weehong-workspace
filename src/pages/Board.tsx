import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { DarkZone, DSeg, GlassStat, LimeAdd, PageHero } from '../components/glass';
import { useOpenWorksheets } from '../components/Layout';
import { Loading } from '../components/ui';
import { useApp } from '../lib/app';
import { daysSince, TONES } from '../lib/utils';

export default function Board() {
  const { statuses, general, staff, can } = useApp();
  const open = useOpenWorksheets();
  const [filter, setFilter] = useState<'all' | 'mine' | 'late'>('all');
  const cols = statuses.filter((s) => s.key !== 'closed');
  const all = open || [];
  const isLate = (d: number) => d > general.overdueDays;
  const rows = all.filter((w) => filter === 'all' || (filter === 'mine' ? w.assignee === staff!.id || w.createdBy === staff!.id : isLate(daysSince(w.statusSince))));
  const late = all.filter((w) => isLate(daysSince(w.statusSince))).length;
  const n = (keys: string[]) => all.filter((w) => keys.includes(w.status)).length;
  return (
    <>
      <PageHero label="工作表看板"
        kicker={<><span className="datechip">{all.length} 张进行中</span>{late > 0 && <span className="datechip warn">{late} 张超过 {general.overdueDays} 天未推进</span>}</>}
        title={<>工作表<br />看板</>}
        sub="每一栏是一个状态，卡片停留越久越靠前，超时会标红"
        actions={can('ws.create') && <Link className="btn" to="/worksheets/new"><Icon name="plus" />新建工作表</Link>}
        side={<GlassStat title="各阶段" items={[
          { n: n(['pending']), label: '待维修' },
          { n: n(['repairing']), label: '维修中' },
          { n: n(['waiting_parts']), label: '等待零件', tone: n(['waiting_parts']) ? 'amber' : undefined },
          { n: n(['repaired', 'clerk', 'review']), label: '文员 / 检查' },
        ]}>
          <div className="meter" title="超时比例"><i style={{ width: `${all.length ? (late / all.length) * 100 : 0}%`, background: late ? 'var(--red)' : undefined }} /></div>
          <div className="k" style={{ display: 'flex', justifyContent: 'space-between' }}><span>超时 {late} 张</span><span>共 {all.length} 张</span></div>
        </GlassStat>}
      />
      <DarkZone label="看板" bar={<>
        <DSeg label="筛选" value={filter} onChange={setFilter} tabs={[{ k: 'all', l: '全部', n: all.length }, { k: 'mine', l: '我负责的' }, { k: 'late', l: '超时', n: late, red: true }]} />
        {can('ws.create') && <LimeAdd to="/worksheets/new" label="新建工作表" />}
      </>}>
        {!open ? <Loading /> : (
          <div className="dkanban">
            {cols.map((s) => {
              const list = rows.filter((w) => w.status === s.key).sort((a, b) => (a.statusSince > b.statusSince ? 1 : -1));
              return (
                <section key={s.key} className="dcol" aria-label={s.label}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 4px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: TONES[s.tone].dot }} />
                    <h3 style={{ fontSize: '0.93rem', color: '#fff' }}>{s.label}</h3>
                    <span className="kd num" style={{ marginLeft: 'auto' }}>{list.length}</span>
                  </div>
                  {list.length === 0 && <span className="kd" style={{ padding: '6px 4px' }}>—</span>}
                  {list.map((w) => {
                    const d = daysSince(w.statusSince);
                    return (
                      <Link key={w.id} to={`/worksheets/${w.id}`} className={`dkcard ${isLate(d) ? 'alert' : ''}`}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                          <span className="dplate">{w.plate || w.machineCode || w.no}</span>
                          <span className="num" style={{ fontWeight: 700, fontSize: '0.87rem', color: isLate(d) ? '#FF8A8F' : 'rgba(241,244,249,0.7)' }}>{d} 天</span>
                        </div>
                        <b style={{ fontSize: '0.93rem', lineHeight: 1.35 }}>{w.customer}</b>
                        <span className="kd ell">{w.model}{w.assigneeName ? ` · ${w.assigneeName}` : ''}</span>
                      </Link>
                    );
                  })}
                </section>
              );
            })}
          </div>
        )}
      </DarkZone>
    </>
  );
}
