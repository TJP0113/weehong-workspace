import type { FieldDef, GeneralSettings, Permissions, PositionGroup, StatusDef } from './types';

export const DEFAULT_FIELDS: FieldDef[] = [
  { id: 'customer', label: '顾客公司名', type: 'customer', required: true, enabled: true, role: 'customer', editors: ['admin', 'warehouse'] },
  { id: 'plate', label: '车牌', type: 'text', required: false, enabled: true, role: 'plate', editors: ['admin', 'warehouse'] },
  { id: 'model', label: '机械型号', type: 'text', required: true, enabled: true, role: 'model', editors: ['admin', 'warehouse'] },
  { id: 'mileage', label: '里程数', type: 'number', unit: '公里', required: false, enabled: true, role: 'mileage', editors: ['admin', 'warehouse', 'mechanic'] },
  { id: 'date', label: '送修日期', type: 'date', required: true, enabled: true, role: 'date', editors: ['admin', 'warehouse'] },
  { id: 'serial', label: '系列号', type: 'text', required: false, enabled: true, role: 'serial', editors: ['admin', 'warehouse'] },
];

/** Keys of the first seven are used by the workflow; labels, colours and owners can be changed. */
export const DEFAULT_STATUSES: StatusDef[] = [
  { key: 'pending', label: '待维修', tone: 'grey', owner: 'mechanic', system: true },
  { key: 'repairing', label: '维修中', tone: 'blue', owner: 'mechanic', system: true },
  { key: 'waiting_parts', label: '等待零件', tone: 'amber', owner: 'warehouse', system: true },
  { key: 'repaired', label: '维修完成', tone: 'green', owner: 'clerk', system: true },
  { key: 'clerk', label: '文员处理中', tone: 'blue', owner: 'clerk', system: true },
  { key: 'review', label: '待管理员检查', tone: 'amber', owner: 'admin', system: true },
  { key: 'closed', label: '已结案', tone: 'green', owner: 'admin', system: true },
];

/** next step for the "下一步" button: [next status, button text] */
export const NEXT_STEP: Record<string, [string, string]> = {
  pending: ['repairing', '开始维修'],
  repairing: ['repaired', '维修完成，交给文员'],
  waiting_parts: ['repairing', '零件已到，继续维修'],
  repaired: ['clerk', '开始处理（开单等）'],
  clerk: ['review', '处理完成，交管理员检查'],
};

export const DEFAULT_POSITIONS: PositionGroup[] = [
  { id: 'fb', name: '前 / 后', en: 'Front / Rear', options: ['前', '后'] },
  { id: 'lr', name: '左 / 右', en: 'LH / RH', options: ['左', '右'] },
  { id: 'tl', name: '上 / 下 / 旁通', en: 'Top / Low / By Pass', options: ['上', '下', '旁通'] },
  { id: 'pn', name: '正极 / 负极', en: '+ / −', options: ['正极', '负极'] },
];

export const DEFAULT_GENERAL: GeneralSettings = {
  companyName: 'WEE HONG',
  companyAddress: '',
  companyPhone: '',
  depotAddress: 'Johor Bahru, Johor',
  vehicles: [],
  machineKinds: ['挖掘机', '叉车', '吊车', '发电机', '压路机', '推土机', '照明塔'],
  partCategories: ['Repair Wheel Brake', 'Repair', '电器与冷却'],
  overdueDays: 5,
};

export const DEFAULT_PERMISSIONS: Permissions = {
  'ws.create': ['admin', 'warehouse'],
  'ws.parts': ['admin', 'warehouse'],
  'ws.entry': ['admin', 'mechanic', 'clerk'],
  'ws.status': ['admin', 'mechanic', 'clerk'],
  'ws.review': ['admin'],
  'rent.order': ['admin'],
  'rent.ship': ['admin', 'clerk'],
  'rent.renew': ['admin', 'clerk'],
  'inspection.edit': ['admin', 'clerk'],
  'transport.edit': ['admin', 'clerk'],
  'settings.edit': ['admin'],
  'users.edit': ['admin'],
};
