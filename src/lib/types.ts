export type Role = 'admin' | 'warehouse' | 'mechanic' | 'clerk';

export const ROLES: { key: Role; label: string }[] = [
  { key: 'admin', label: '管理员' },
  { key: 'warehouse', label: '货仓管理员' },
  { key: 'mechanic', label: '维修员' },
  { key: 'clerk', label: '文员' },
];
export const roleLabel = (r?: string) => ROLES.find((x) => x.key === r)?.label ?? r ?? '';

export type Tone = 'blue' | 'green' | 'amber' | 'red' | 'grey';

export interface Staff {
  id: string; // email (lower case)
  email: string;
  name: string;
  role: Role;
  phone?: string;
  active: boolean;
  lastLogin?: string;
}

export type FieldType = 'text' | 'number' | 'date' | 'select' | 'customer';
export type FieldRole = 'plate' | 'customer' | 'model' | 'serial' | 'mileage' | 'date' | '';
export interface FieldDef {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  enabled: boolean;
  options?: string[];
  unit?: string;
  role?: FieldRole; // used for lists, search and print
  editors?: Role[];
}

export interface StatusDef {
  key: string;
  label: string;
  tone: Tone;
  owner: Role; // whose to-do list it lands in
  system?: boolean;
}

export interface PositionGroup {
  id: string;
  name: string;
  en?: string;
  options: string[];
}

export interface Part {
  id: string; // item code
  code: string;
  name: string;
  spec?: string;
  unit?: string;
  stock?: number;
  groups?: string[]; // position group ids
  category?: string;
  lastUsedIn?: string;
  syncedAt?: string;
}

export type WorksheetType = 'repair' | 'service' | 'inspection' | 'prerental' | 'maintenance';
export const WS_TYPES: { key: WorksheetType; label: string; hint: string }[] = [
  { key: 'repair', label: '维修', hint: '一般故障维修' },
  { key: 'service', label: '保养', hint: '定期保养' },
  { key: 'inspection', label: '验车保养', hint: '保养后送去验车' },
  { key: 'prerental', label: '出租前检查', hint: '机械出租前检查' },
  { key: 'maintenance', label: '每月保养', hint: '租赁机械每月保养' },
];
export const wsTypeLabel = (t?: string) => WS_TYPES.find((x) => x.key === t)?.label ?? '';

export interface Worksheet {
  id: string;
  no: string;
  type: WorksheetType;
  status: string;
  statusSince: string;
  fields: Record<string, string>;
  plate?: string;
  customer?: string;
  model?: string;
  serial?: string;
  mileage?: string;
  description?: string;
  assignee?: string;
  assigneeName?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  source?: { kind: 'inspection' | 'rental' | 'maintenance'; id: string; label: string };
  machineCode?: string;
  partsCount?: number;
  waitingParts?: number;
  photos?: { url: string; path: string; at: string; by: string }[];
  review?: { result: 'pass' | 'reject'; note?: string; by: string; at: string };
  driveUrl?: string;
  archived?: boolean;
}

export interface WsPart {
  id: string;
  code: string;
  name: string;
  position?: string;
  qty: number;
  unit?: string;
  note?: string;
  state: 'issued' | 'waiting';
}

export interface WsEntry {
  id: string;
  text: string;
  by: string;
  byName: string;
  role: Role;
  at: string;
}

export interface WsLog {
  id: string;
  from?: string;
  to: string;
  by: string;
  byName: string;
  at: string;
  note?: string;
}

export type MachineStatus = 'rented' | 'idle' | 'repair';
export type RentRate = 'day' | 'week' | 'month' | 'year';
export const RATE_LABEL: Record<RentRate, string> = { day: '天', week: '周', month: '月', year: '年' };

export interface Machine {
  id: string;
  code: string;
  name: string;
  kind: string;
  serial?: string;
  provider: 'own' | 'supplier';
  supplierName?: string;
  status: MachineStatus;
  location?: string;
  client?: string;
  rentStart?: string;
  rentEnd?: string;
  rate?: RentRate;
  nextMaintenance?: string;
  syncedAt?: string;
}

export interface Renewal {
  id: string;
  from: string;
  to: string;
  rate: RentRate;
  note?: string;
  by: string;
  at: string;
}

export interface RentalOrder {
  id: string;
  no: string;
  client: string;
  machineCode: string;
  machineName: string;
  start: string;
  end: string;
  rate: RentRate;
  location: string;
  step: number; // 1 = 检查+工作表, 2 = 开单+运输, 3 = 交机, 4 = 完成
  mechanic?: string;
  mechanicName?: string;
  worksheetId?: string;
  note?: string;
  log: { step: number; at: string; byName: string; note?: string }[];
  createdAt: string;
}

export type InspectionResult = 'unbooked' | 'booked' | 'pass' | 'fail';
export interface Inspection {
  id: string;
  plate: string;
  customer: string;
  model?: string;
  receivedAt: string;
  worksheetId?: string;
  date?: string;
  place?: string;
  result: InspectionResult;
  note?: string;
  attempt: number;
  prevId?: string;
  history?: { date: string; result: 'pass' | 'fail'; note?: string }[];
  createdAt: string;
}

export interface TripStop {
  kind: string;
  place: string;
  address: string;
  task?: string;
  contact?: string;
  done?: boolean;
}
export interface Trip {
  id: string;
  no: string;
  date: string;
  time?: string;
  title: string;
  driver?: string;
  driverName?: string;
  vehicle?: string;
  status: 'planned' | 'active' | 'done';
  stops: TripStop[];
  createdAt: string;
}

export interface AppNotification {
  id: string;
  to: string; // email or role:xxx
  title: string;
  body?: string;
  href?: string;
  tone?: Tone;
  createdAt: string;
  readBy?: string[];
  pushed?: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
}

export interface GeneralSettings {
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  depotAddress: string;
  vehicles: string[];
  machineKinds: string[];
  partCategories: string[];
  overdueDays: number;
}

export type Perm =
  | 'ws.create'
  | 'ws.parts'
  | 'ws.entry'
  | 'ws.status'
  | 'ws.review'
  | 'rent.order'
  | 'rent.ship'
  | 'rent.renew'
  | 'inspection.edit'
  | 'transport.edit'
  | 'settings.edit'
  | 'users.edit';

export const PERM_GROUPS: { group: string; items: { key: Perm; label: string }[] }[] = [
  {
    group: '工作表',
    items: [
      { key: 'ws.create', label: '创建工作表' },
      { key: 'ws.parts', label: '编辑零件清单' },
      { key: 'ws.entry', label: '输入维修事项' },
      { key: 'ws.status', label: '更新工作状态' },
      { key: 'ws.review', label: '检查工作表、结案' },
    ],
  },
  {
    group: '机械租赁 · 验车 · 运输',
    items: [
      { key: 'rent.order', label: '接收订单、委派维修员' },
      { key: 'rent.ship', label: '开单完成、安排运输' },
      { key: 'rent.renew', label: '续租' },
      { key: 'inspection.edit', label: '登记验车、记录结果' },
      { key: 'transport.edit', label: '安排运输行程' },
    ],
  },
  {
    group: '设置',
    items: [
      { key: 'settings.edit', label: '工作表字段、零件位置、状态、公司资料' },
      { key: 'users.edit', label: '人员与角色' },
    ],
  },
];

export type Permissions = Record<Perm, Role[]>;
