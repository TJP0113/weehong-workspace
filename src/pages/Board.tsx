import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useOpenWorksheets } from '../components/Layout';
import { Loading } from '../components/ui';
import { useApp } from '../lib/app';
import { daysSince, TONES } from '../lib/utils';

export default function Board() {
  const { statuses, general, staff, can } = useApp();
  const open = useOpenWorksheets();
  const [filter, setFilter] = useState<'all' | 'mine' | 'late'>('all');
  const cols = statuses.filter((s) => s.key !== 'closed');
  const rows = (open || []).filter((w) => filter === 'all' || (filter === 'mine' ? w.assignee === staff!.id || w.createdBy === staff!.id : daysSince(w.statusSince) > general.overdueDays));
  const late = (open || []).filter((w) => daysSince(w.statusSince) > general.overdueDays).length;
  return (
    <>
      <div className="pagehead">
        <div><h1>工作表看板</h1><p>{open?.length ?? 0} 张进行中{late ? <> · <span style={{ color: 'var(--red-ink)' }}>{late} 张超过 {general.overdueDays} 天未推进</span></> : null}</p></div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div className="seg" role="group" aria-label="筛选">
            {(['all', 'mine', 'late'] as const).map((k) => <button key={k} type="button" className={filter === k ? 'on' : ''} aria-pressed={filter === k} onClick={() => setFilter(k)}>{{ all: '全部', mine: '我负责的', late: '超时' }[k]}</button>)}
          </div>
          {can('ws.create') && <Link className="btn" to="/worksheets/new"><Icon name="plus" />新建工作表</Link>}
        </div>
      </div>
      {!open ? <Loading /> : (
        <div className="kanban">
          {cols.map((s) => {
            const list = rows.filter((w) => w.status === s.key).sort((a, b) => (a.statusSince > b.statusSince ? 1 : -1));
            return (
              <section key={s.key} className="kcol" aria-label={s.label}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 4px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: TONES[s.tone].dot }} />
                  <h3 style={{ fontSize: '0.93rem' }}>{s.label}</h3>
                  <span className="k" style={{ marginLeft: 'auto' }}>{list.length}</span>
                </div>
                {list.map((w) => {
                  const d = daysSince(w.statusSince);
                  const isLate = d > general.overdueDays;
                  return (
                    <Link key={w.id} to={`/worksheets/${w.id}`} className="kcard" style={isLate ? { borderColor: 'var(--red-line)' } : undefined}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        {w.plate ? <span className="plate">{w.plate}</span> : <span className="small muted num">{w.no}</span>}
                        <span className="small" style={{ fontWeight: 600, color: isLate ? 'var(--red-ink)' : 'var(--muted)' }}>{d} 天</span>
                      </div>
                      <b style={{ fontSize: '0.93rem', lineHeight: 1.35 }}>{w.customer}</b>
                      {!w.plate && <span className="small muted ell">{w.model}</span>}
                    </Link>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
