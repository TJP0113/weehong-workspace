import { DEFAULT_FIELDS, DEFAULT_GENERAL, DEFAULT_PERMISSIONS, DEFAULT_POSITIONS, DEFAULT_STATUSES } from './defaults';

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
const at = (offset: number, hh = 9, mm = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
};

export const DEMO_USERS = [
  { email: 'zhang@demo.local', name: '张经理', role: 'admin', phone: '012-771 2045' },
  { email: 'chen@demo.local', name: '陈文杰', role: 'warehouse', phone: '016-702 8813' },
  { email: 'huang@demo.local', name: '黄志明', role: 'mechanic', phone: '011-2340 5567' },
  { email: 'li@demo.local', name: '李家豪', role: 'mechanic', phone: '017-655 0921' },
  { email: 'lin@demo.local', name: '林美玲', role: 'clerk', phone: '012-889 3410' },
] as const;

export function demoSeed(): Record<string, any> {
  const D: Record<string, any> = {};
  DEMO_USERS.forEach((u) => { D[`users/${u.email}`] = { ...u, active: true }; });
  D['users/wang@demo.local'] = { email: 'wang@demo.local', name: '王建国', role: 'mechanic', phone: '013-560 2219', active: false };

  D['settings/fields'] = { list: DEFAULT_FIELDS };
  D['settings/statuses'] = { list: DEFAULT_STATUSES };
  D['settings/positions'] = { list: DEFAULT_POSITIONS };
  D['settings/permissions'] = DEFAULT_PERMISSIONS;
  D['settings/general'] = { ...DEFAULT_GENERAL, companyName: 'WEE HONG', depotAddress: 'Tebrau, Johor Bahru', vehicles: ['公司货车 JQT 2210', '拖车 JRB 5503'] };
  D['settings/integrations'] = {
    autocount: { configured: false, lastRun: null, lastSuccess: null, lastError: null },
    google: { connected: false },
  };

  ['宏利建筑工程', '恒发物流有限公司', '顺通货运', '联合运输', '新柔建筑', '南方机械租赁'].forEach((n, i) => {
    D[`customers/C${100 + i}`] = { name: n };
  });

  const parts: [string, string, string, string, number, string[], string][] = [
    ['TY-1100', 'Tyres', '10.00-20', '条', 16, ['fb'], 'Repair Wheel Brake'],
    ['TBN-0200', 'Tyres Bolt & Nut', 'M22', '套', 40, ['fb'], 'Repair Wheel Brake'],
    ['BD-0420', 'Brake Drum', 'Hino 300', '个', 4, ['fb'], 'Repair Wheel Brake'],
    ['BS-2200', 'Brake Shoes / Disc Pad', 'Hino 300 系列', '套', 14, ['fb'], 'Repair Wheel Brake'],
    ['BP-3100', 'Brake Pump', 'Hino 300 系列', '个', 12, ['fb', 'lr'], 'Repair Wheel Brake'],
    ['BPS-3101', 'Brake Pump Seal', '通用型', '个', 40, ['fb', 'lr'], 'Repair Wheel Brake'],
    ['WOS-0870', 'Wheel Oil Seal', '通用型', '个', 40, ['fb', 'lr'], 'Repair Wheel Brake'],
    ['WB-6205', 'Wheel Bearing', '6205-2RS', '个', 18, ['fb', 'lr'], 'Repair Wheel Brake'],
    ['BG-0001', 'Bearing Grease', '1 公斤', '罐', 9, [], 'Repair Wheel Brake'],
    ['BMP-0700', 'Brake Master Pump / Booster', 'Hino 300 / 500', '个', 0, [], 'Repair Wheel Brake'],
    ['BF-0010', 'Brake Fluid', 'DOT 3 · 1 公升', '瓶', 24, [], 'Repair Wheel Brake'],
    ['CP-0300', 'Top / Low Clutch Pump', '通用型', '个', 6, ['tl'], 'Repair'],
    ['CB-0310', 'Clutch Booster', 'Isuzu NPR', '个', 2, [], 'Repair'],
    ['CC-0320', 'Clutch Cover / Plate / Bearing', 'Isuzu NPR', '套', 3, [], 'Repair'],
    ['LS-1400', 'Leaf Spring', 'Isuzu NPR', '片', 0, ['fb', 'lr'], 'Repair'],
    ['AB-0900', 'Absorber', 'Fuso Canter', '支', 6, ['fb'], 'Repair'],
    ['TRE-0450', 'Tie Rod End', '通用型', '个', 8, [], 'Repair'],
    ['RC-0050', 'Radiator Coolant', '4 公升', '瓶', 20, [], '电器与冷却'],
    ['RH-0330', 'Radiator Hose', 'Scania P 系列', '条', 4, ['tl'], '电器与冷却'],
    ['ST-0100', 'Starter', 'Hino 300', '个', 2, [], '电器与冷却'],
    ['AL-0110', 'Alternator', 'Hino 300', '个', 1, [], '电器与冷却'],
    ['BAT-N70', 'New Battery', 'N70', '个', 5, [], '电器与冷却'],
    ['BT-0012', 'Battery Terminal', '铜质', '个', 50, ['pn'], '电器与冷却'],
    ['OF-4471', 'Oil Filter', '通用型 M20', '个', 36, [], 'Repair'],
    ['EO-1540', 'Engine Oil 15W-40', '18 公升装', '公升', 216, [], 'Repair'],
  ];
  parts.forEach(([code, name, spec, unit, stock, groups, category]) => {
    D[`parts/${code}`] = { code, name, spec, unit, stock, groups, category, syncedAt: at(0, 8, 30) };
  });

  const machines: any[] = [
    ['EX-01', 'Komatsu PC200-8', '挖掘机', 'KMTPC200C31270', 'own', '', 'rented', '新山 Taman Daya', '宏利建筑工程', -66, 114, 'month', 14],
    ['EX-02', 'Hitachi ZX200', '挖掘机', 'HCMDBG50C00418', 'own', '', 'repair', '公司维修场', '', 0, 0, '', 6],
    ['FL-03', 'Toyota 8FD25', '叉车', '8FD25-60214', 'own', '', 'rented', '巴西古当', '顺通货运', -22, 9, 'week', 8],
    ['GS-04', 'Denyo DCA-100', '发电机', 'DCA100-3381572', 'supplier', '大成机械', 'rented', '柔佛港', '联合运输', -5, 24, 'day', 0],
    ['CR-05', 'Tadano GR-250N', '吊车', 'GR250N-1-50633', 'supplier', '恒力吊车', 'idle', '公司场地', '', 0, 0, '', 0],
    ['RL-06', 'Sakai SV525', '压路机', 'SV525-31122', 'own', '', 'rented', '士乃', '宏利建筑工程', -250, 115, 'year', 2],
    ['EX-07', 'Kobelco SK200', '挖掘机', 'YN12-65390', 'own', '', 'idle', '公司场地', '', 0, 0, '', 24],
    ['BD-08', 'Caterpillar D6R', '推土机', 'CAT00D6RJ4WG01', 'supplier', '大成机械', 'rented', '哥打丁宜', '新柔建筑', -17, 74, 'month', 0],
    ['FL-09', 'Mitsubishi FD30', '叉车', 'F14E-56015', 'own', '', 'repair', '公司维修场', '', 0, 0, '', 19],
    ['LT-10', 'Atlas Copco HiLight V5+', '照明塔', 'HL5-AII-09481', 'own', '', 'rented', '柔佛港', '联合运输', -3, 3, 'day', 27],
  ];
  machines.forEach(([code, name, kind, serial, provider, supplierName, status, location, client, s, e, rate, maint]) => {
    D[`machines/${code}`] = {
      code, name, kind, serial, provider, supplierName, status, location, client,
      rentStart: status === 'rented' ? day(s) : '', rentEnd: status === 'rented' ? day(e) : '', rate,
      nextMaintenance: provider === 'own' ? day(maint) : '', syncedAt: at(0, 8, 30),
    };
  });
  D['machines/FL-03/renewals/r1'] = { from: day(-22), to: day(-8), rate: 'week', note: '首次租赁', by: '林美玲', at: at(-22) };

  // worksheets
  const ws = (id: string, no: string, o: any) => { D[`worksheets/${id}`] = { no, ...o }; };
  const f = (customer: string, plate: string, model: string, mileage: string, date: string, serial: string) => ({ customer, plate, model, mileage, date, serial });
  const base = (o: any) => ({
    ...o,
    customer: o.fields.customer, plate: o.fields.plate, model: o.fields.model, serial: o.fields.serial, mileage: o.fields.mileage,
    updatedAt: o.statusSince,
  });
  ws('w142', 'WS-2026-0142', base({ type: 'inspection', status: 'repairing', statusSince: at(-3, 10), fields: f('恒发物流有限公司', 'JHR 8821', 'Hino 300 · XZU710', '186420', day(-3), 'JHFXZU71-0021843'), description: '刹车有异声，验车前保养', assignee: 'huang@demo.local', assigneeName: '黄志明', createdBy: 'chen@demo.local', createdByName: '陈文杰', createdAt: at(-3, 9, 15), partsCount: 6, waitingParts: 1, source: { kind: 'inspection', id: 'i4', label: `验车服务 · 预约 ${day(4)} 验车` }, photos: [] }));
  ws('w148', 'WS-2026-0148', base({ type: 'service', status: 'pending', statusSince: at(-1, 15), fields: f('宏利建筑工程', 'JQT 5521', 'Isuzu NPR', '198200', day(-1), 'JAANPR75P-7108821'), description: '定期保养', createdBy: 'chen@demo.local', createdByName: '陈文杰', createdAt: at(-1, 15), partsCount: 3, waitingParts: 0 }));
  ws('w139', 'WS-2026-0139', base({ type: 'repair', status: 'repairing', statusSince: at(-6, 11), fields: f('联合运输', 'JMS 3307', 'Scania P360', '402118', day(-8), 'YS2P4X20005512'), description: '冷气不冷，风扇皮带有声', assignee: 'li@demo.local', assigneeName: '李家豪', createdBy: 'chen@demo.local', createdByName: '陈文杰', createdAt: at(-8, 9), partsCount: 4, waitingParts: 0 }));
  ws('w136', 'WS-2026-0136', base({ type: 'repair', status: 'waiting_parts', statusSince: at(-9, 14), fields: f('南方机械租赁', '', 'Komatsu PC200', '', day(-10), 'KMTPC200C30011'), description: '液压油管漏油', assignee: 'li@demo.local', assigneeName: '李家豪', createdBy: 'chen@demo.local', createdByName: '陈文杰', createdAt: at(-10, 9), partsCount: 7, waitingParts: 1 }));
  ws('w138', 'WS-2026-0138', base({ type: 'inspection', status: 'repaired', statusSince: at(-1, 16, 45), fields: f('顺通货运', 'JTA 1182', 'Isuzu FVR', '254300', day(-12), 'JALFVR34L-7000412'), description: '验车前保养', assignee: 'huang@demo.local', assigneeName: '黄志明', createdBy: 'chen@demo.local', createdByName: '陈文杰', createdAt: at(-12, 10), partsCount: 5, waitingParts: 0, source: { kind: 'inspection', id: 'i1', label: `验车服务 · 预约 ${day(0)} 验车` } }));
  ws('w135', 'WS-2026-0135', base({ type: 'repair', status: 'clerk', statusSince: at(-2, 10), fields: f('联合运输', 'JMS 9012', 'Volvo FH', '512090', day(-19), 'YV2RT40A0GA112233'), assignee: 'huang@demo.local', assigneeName: '黄志明', createdBy: 'chen@demo.local', createdByName: '陈文杰', createdAt: at(-19, 9), partsCount: 8, waitingParts: 0 }));
  ws('w133', 'WS-2026-0133', base({ type: 'repair', status: 'review', statusSince: at(-2, 15), fields: f('恒发物流有限公司', 'JHR 6604', 'Hino 500', '330456', day(-17), 'JHFFG8JL-0010022'), assignee: 'huang@demo.local', assigneeName: '黄志明', createdBy: 'chen@demo.local', createdByName: '陈文杰', createdAt: at(-17, 9), partsCount: 6, waitingParts: 0 }));
  ws('w151', 'WS-2026-0151', base({ type: 'inspection', status: 'repairing', statusSince: at(-6, 9), fields: f('宏利建筑工程', 'JQT 1408', 'Isuzu NPR', '212850', day(-15), 'JAANPR75P-7104412'), description: '验车不通过：刹车效能不足，更换刹车片后复验', assignee: 'huang@demo.local', assigneeName: '黄志明', createdBy: 'chen@demo.local', createdByName: '陈文杰', createdAt: at(-6, 9), partsCount: 2, waitingParts: 0, source: { kind: 'inspection', id: 'i2', label: `验车服务 · 复验 ${day(1)}` } }));
  ws('w150', 'WS-2026-0150', base({ type: 'prerental', status: 'repairing', statusSince: at(-1, 9), fields: f('新柔建筑', '', 'Kobelco SK200', '', day(-2), 'YN12-65390'), description: '出租前检查：液压系统、履带张紧、更换机油滤芯', assignee: 'li@demo.local', assigneeName: '李家豪', createdBy: 'chen@demo.local', createdByName: '陈文杰', createdAt: at(-2, 10, 15), partsCount: 2, waitingParts: 0, machineCode: 'EX-07', source: { kind: 'rental', id: 'ro31', label: 'RO-2026-031 · EX-07 出租前检查' } }));

  const wp = (wid: string, list: [string, string, string, number, string, 'issued' | 'waiting'][]) => list.forEach(([code, name, position, qty, unit, state], i) => {
    D[`worksheets/${wid}/parts/p${i}`] = { code, name, position, qty, unit, state, note: '' };
  });
  wp('w142', [
    ['BS-2200', 'Brake Shoes / Disc Pad', '前', 2, '套', 'issued'],
    ['BP-3100', 'Brake Pump', '前 · 左', 1, '个', 'issued'],
    ['BP-3100', 'Brake Pump', '前 · 右', 1, '个', 'issued'],
    ['WOS-0870', 'Wheel Oil Seal', '前 · 左', 1, '个', 'issued'],
    ['BMP-0700', 'Brake Master Pump / Booster', '', 1, '个', 'waiting'],
    ['BF-0010', 'Brake Fluid', '', 1, '瓶', 'issued'],
  ]);
  wp('w136', [['HY-PC2-11', '液压油管', '', 2, '条', 'waiting']]);
  const en = (wid: string, list: [number, string, string, string, string][]) => list.forEach(([o, by, byName, role, text], i) => {
    D[`worksheets/${wid}/entries/e${i}`] = { at: at(o, 9 + i), by, byName, role, text };
  });
  en('w142', [
    [-3, 'chen@demo.local', '陈文杰', 'warehouse', '建立工作表，列出保养与刹车零件。'],
    [-2, 'huang@demo.local', '黄志明', 'mechanic', '刹车总泵漏油，需要更换，零件已向供应商订货。'],
    [-2, 'lin@demo.local', '林美玲', 'clerk', '顾客来电要求顺便检查冷气，已转告维修员。'],
    [0, 'huang@demo.local', '黄志明', 'mechanic', '前轮刹车片磨损到极限，已更换两边。刹车油同时补充。'],
  ]);
  D['worksheets/w142/logs/l0'] = { to: 'pending', by: 'chen@demo.local', byName: '陈文杰', at: at(-3, 9, 15) };
  D['worksheets/w142/logs/l1'] = { from: 'pending', to: 'repairing', by: 'huang@demo.local', byName: '黄志明', at: at(-3, 10) };

  // inspections
  D['inspections/i1'] = { plate: 'JTA 1182', customer: '顺通货运', model: 'Isuzu FVR', receivedAt: day(-12), worksheetId: 'w138', date: day(0), result: 'booked', note: '今天验车', attempt: 1, createdAt: at(-12) };
  D['inspections/i2'] = { plate: 'JQT 1408', customer: '宏利建筑工程', model: 'Isuzu NPR', receivedAt: day(-15), worksheetId: 'w151', date: day(1), result: 'booked', note: '复验：上次刹车效能不足，已更换刹车片', attempt: 2, history: [{ date: day(-7), result: 'fail', note: '刹车效能不足' }], createdAt: at(-15) };
  D['inspections/i3'] = { plate: 'JMS 3307', customer: '联合运输', model: 'Scania P360', receivedAt: day(-9), worksheetId: 'w139', date: day(2), result: 'booked', note: '', attempt: 1, createdAt: at(-9) };
  D['inspections/i4'] = { plate: 'JHR 8821', customer: '恒发物流有限公司', model: 'Hino 300', receivedAt: day(-3), worksheetId: 'w142', date: day(4), result: 'booked', note: '', attempt: 1, createdAt: at(-3) };
  D['inspections/i5'] = { plate: 'JQT 5521', customer: '宏利建筑工程', model: 'Isuzu NPR', receivedAt: day(-1), worksheetId: 'w148', date: '', result: 'unbooked', note: '', attempt: 1, createdAt: at(-1) };
  D['inspections/i6'] = { plate: 'JHR 6604', customer: '恒发物流有限公司', model: 'Hino 500', receivedAt: day(-17), worksheetId: 'w133', date: day(-4), result: 'pass', note: '已交车', attempt: 1, history: [{ date: day(-4), result: 'pass' }], createdAt: at(-17) };

  // rentals
  D['rentalOrders/ro31'] = { no: 'RO-2026-031', client: '新柔建筑', machineCode: 'EX-07', machineName: 'Kobelco SK200', start: day(4), end: day(96), rate: 'month', location: '哥打丁宜 · 新柔建筑工地', step: 1, mechanic: 'li@demo.local', mechanicName: '李家豪', worksheetId: 'w150', note: '', createdAt: at(-2, 10), log: [{ step: 0, at: at(-2, 10, 15), byName: '张经理', note: '委派李家豪检查 EX-07' }] };
  D['rentalOrders/ro30'] = { no: 'RO-2026-030', client: '联合运输', machineCode: 'CR-05', machineName: 'Tadano GR-250N', start: day(1), end: day(15), rate: 'day', location: '柔佛港', step: 2, mechanic: 'huang@demo.local', mechanicName: '黄志明', note: '', createdAt: at(-4), log: [{ step: 0, at: at(-4), byName: '张经理' }, { step: 1, at: at(-2), byName: '黄志明', note: '检查完成' }] };

  // trips
  D['trips/t1'] = { no: 'T-0001', date: day(0), time: '09:00', title: '取零件 + 士乃现场保养 + 送货', driver: 'huang@demo.local', driverName: '黄志明', vehicle: '公司货车 JQT 2210', status: 'active', createdAt: at(-1), stops: [
    { kind: '取货', place: '大成机械（供应商）', address: 'Skudai, Johor', task: '取 Brake Master Pump（WS-0142 待料）', contact: '陈先生 012-345 6789' },
    { kind: '现场保养', place: '士乃工地 · RL-06', address: 'Senai, Johor', task: 'RL-06 每月保养', contact: '工地主管 016-221 0098' },
    { kind: '送货', place: '顺通货运', address: 'Kulai, Johor', task: '送回 WS-0138 拆下的旧零件', contact: '07-663 1200' },
  ] };
  D['trips/t2'] = { no: 'T-0002', date: day(1), time: '08:30', title: 'CR-05 交机 + 顺路取件', driver: 'li@demo.local', driverName: '李家豪', vehicle: '拖车 JRB 5503', status: 'planned', createdAt: at(-1), stops: [
    { kind: '交机', place: '联合运输 · 柔佛港', address: 'Pasir Gudang, Johor', task: 'CR-05 交给联合运输（RO-2026-030）', contact: '07-251 7788' },
    { kind: '取货', place: '零件行', address: 'Plentong, Johor', task: '取风扇皮带 ×2', contact: '07-355 4410' },
  ] };

  // notifications
  const n = (id: string, to: string, title: string, body: string, href: string, tone: string, o: number) => {
    D[`notifications/${id}`] = { to, title, body, href, tone, createdAt: at(o, 8 + Number(id.slice(1))), readBy: [], pushed: true };
  };
  n('n1', 'clerk@role', 'WS-2026-0138 轮到你处理', '黄志明已完成维修 · 顺通货运 · JTA 1182', '/worksheets/w138', 'blue', -1);
  n('n2', 'mechanic@role', 'JQT 1408 明天复验', '今天要完成 WS-2026-0151', '/worksheets/w151', 'amber', 0);
  n('n3', 'admin@role', '2 张工作表等你检查', 'WS-2026-0133', '/worksheets/w133', 'amber', 0);
  n('n4', 'warehouse@role', '2 项零件库存为 0', 'Leaf Spring、Brake Master Pump', '/parts', 'amber', 0);
  return D;
}
