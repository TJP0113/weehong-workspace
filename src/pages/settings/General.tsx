import { useState } from 'react';
import { useUi } from '../../components/ui';
import { useApp } from '../../lib/app';
import { store } from '../../lib/store';
import type { GeneralSettings } from '../../lib/types';
import { ReadOnlyNote } from './Settings';

const list = (s: string) => s.split(/[\n,，]/).map((x) => x.trim()).filter(Boolean);

export default function General() {
  const { general, can } = useApp();
  const { toast } = useUi();
  const edit = can('settings.edit');
  const [g, setG] = useState<GeneralSettings>(general);
  const [vehicles, setVehicles] = useState(general.vehicles.join('\n'));
  const [kinds, setKinds] = useState(general.machineKinds.join('，'));
  const [cats, setCats] = useState(general.partCategories.join('\n'));
  const save = async () => {
    await store.set('settings/general', { ...g, vehicles: list(vehicles), machineKinds: list(kinds), partCategories: list(cats) }, true);
    toast('已保存');
  };
  return (
    <section className="card">
      <h2>公司与车辆</h2>
      {!edit && <ReadOnlyNote />}
      <div className="grid2">
        <div className="field"><label htmlFor="g-n">公司名称（打印用）</label><input id="g-n" className="input" disabled={!edit} value={g.companyName} onChange={(e) => setG({ ...g, companyName: e.target.value })} /></div>
        <div className="field"><label htmlFor="g-p">公司电话</label><input id="g-p" className="input" disabled={!edit} value={g.companyPhone || ''} onChange={(e) => setG({ ...g, companyPhone: e.target.value })} /></div>
        <div className="field" style={{ gridColumn: '1 / -1' }}><label htmlFor="g-a">公司地址（打印用）</label><input id="g-a" className="input" disabled={!edit} value={g.companyAddress || ''} onChange={(e) => setG({ ...g, companyAddress: e.target.value })} /></div>
        <div className="field" style={{ gridColumn: '1 / -1' }}><label htmlFor="g-d">仓库地址（运输路线的起点和终点）</label><input id="g-d" className="input" disabled={!edit} value={g.depotAddress} onChange={(e) => setG({ ...g, depotAddress: e.target.value })} placeholder="可直接贴 Google Maps 上的地址" /></div>
        <div className="field"><label htmlFor="g-v">运输车辆（一行一辆）</label><textarea id="g-v" className="input" rows={4} disabled={!edit} value={vehicles} onChange={(e) => setVehicles(e.target.value)} placeholder={'公司货车 JQT 2210\n拖车 JRB 5503'} /></div>
        <div className="field"><label htmlFor="g-c">零件快速勾选分类（一行一个）</label><textarea id="g-c" className="input" rows={4} disabled={!edit} value={cats} onChange={(e) => setCats(e.target.value)} /></div>
        <div className="field" style={{ gridColumn: '1 / -1' }}><label htmlFor="g-k">机械种类（用逗号分开）</label><input id="g-k" className="input" disabled={!edit} value={kinds} onChange={(e) => setKinds(e.target.value)} /></div>
      </div>
      {edit && <button className="btn" style={{ alignSelf: 'flex-start' }} type="button" onClick={save}>保存</button>}
    </section>
  );
}
