import { notify } from './notify';
import { store } from './store';
import type { FieldDef, Role, Staff, StatusDef, Worksheet, WorksheetType, WsPart } from './types';
import { now, pad, statusOf } from './utils';

export async function nextNo(prefix: 'WS' | 'RO' | 'T') {
  const y = new Date().getFullYear();
  const n = await store.nextNumber(`${prefix}-${y}`);
  return prefix === 'T' ? `T-${y}-${pad(n)}` : `${prefix}-${y}-${pad(n)}`;
}

const byRole = (fields: FieldDef[], values: Record<string, string>, role: string) => {
  const f = fields.find((x) => x.role === role);
  return f ? values[f.id] || '' : '';
};

export async function createWorksheet(opts: {
  staff: Staff; fields: FieldDef[]; values: Record<string, string>; type: WorksheetType; description?: string;
  parts: Omit<WsPart, 'id'>[]; source?: Worksheet['source']; machineCode?: string; assignee?: Staff | null;
}) {
  const { staff, fields, values } = opts;
  const no = await nextNo('WS');
  const t = now();
  const id = await store.add('worksheets', {
    no, type: opts.type, status: 'pending', statusSince: t, fields: values,
    plate: byRole(fields, values, 'plate'), customer: byRole(fields, values, 'customer'), model: byRole(fields, values, 'model'),
    serial: byRole(fields, values, 'serial'), mileage: byRole(fields, values, 'mileage'),
    description: opts.description || '', createdBy: staff.id, createdByName: staff.name, createdAt: t, updatedAt: t,
    assignee: opts.assignee?.id || null, assigneeName: opts.assignee?.name || null,
    source: opts.source || null, machineCode: opts.machineCode || null,
    partsCount: opts.parts.length, waitingParts: opts.parts.filter((p) => p.state === 'waiting').length, photos: [],
  } as any);
  await Promise.all(opts.parts.map((p) => store.add(`worksheets/${id}/parts`, p)));
  await store.add(`worksheets/${id}/logs`, { to: 'pending', by: staff.id, byName: staff.name, at: t });
  if (opts.description) await store.add(`worksheets/${id}/entries`, { text: opts.description, by: staff.id, byName: staff.name, role: staff.role, at: t });
  const who = opts.assignee ? opts.assignee.id : { role: 'mechanic' as Role };
  await notify(who, `新工作表 ${no}`, `${byRole(fields, values, 'customer')} · ${byRole(fields, values, 'plate') || byRole(fields, values, 'model')}`, `/worksheets/${id}`);
  return id;
}

export async function changeStatus(ws: Worksheet, to: string, staff: Staff, statuses: StatusDef[], note?: string) {
  const t = now();
  const patch: any = { status: to, statusSince: t, updatedAt: t };
  if (to === 'repairing' && !ws.assignee && staff.role === 'mechanic') { patch.assignee = staff.id; patch.assigneeName = staff.name; }
  await store.update(`worksheets/${ws.id}`, patch);
  await store.add(`worksheets/${ws.id}/logs`, { from: ws.status, to, by: staff.id, byName: staff.name, at: t, note: note || '' });
  const s = statusOf(statuses, to);
  const target = s.owner === 'mechanic' && (patch.assignee || ws.assignee) ? (patch.assignee || ws.assignee) : { role: s.owner };
  if (to !== 'closed' && (typeof target !== 'string' || target !== staff.id)) {
    await notify(target, `${ws.no} 轮到你处理`, `${staff.name} 把状态改为「${s.label}」· ${ws.customer || ''} ${ws.plate || ''}`, `/worksheets/${ws.id}`, s.tone);
  }
  return () => undoStatus(ws, staff);
}

async function undoStatus(ws: Worksheet, staff: Staff) {
  await store.update(`worksheets/${ws.id}`, { status: ws.status, statusSince: ws.statusSince, updatedAt: now(), assignee: ws.assignee || null, assigneeName: ws.assigneeName || null });
  await store.add(`worksheets/${ws.id}/logs`, { to: ws.status, by: staff.id, byName: staff.name, at: now(), note: '撤销上一步' });
}

export async function review(ws: Worksheet, staff: Staff, pass: boolean, note: string) {
  const t = now();
  const to = pass ? 'closed' : 'repairing';
  await store.update(`worksheets/${ws.id}`, { status: to, statusSince: t, updatedAt: t, review: { result: pass ? 'pass' : 'reject', note, by: staff.name, at: t } });
  await store.add(`worksheets/${ws.id}/logs`, { from: ws.status, to, by: staff.id, byName: staff.name, at: t, note: pass ? '检查通过，结案' : `退回：${note}` });
  if (pass && ws.type === 'maintenance' && ws.machineCode) {
    const d = new Date(); d.setMonth(d.getMonth() + 1);
    await store.update(`machines/${ws.machineCode}`, { nextMaintenance: d.toISOString().slice(0, 10) });
  }
  if (!pass) await notify(ws.assignee || { role: 'mechanic' }, `${ws.no} 被退回`, note || '管理员检查不通过', `/worksheets/${ws.id}`, 'red');
}

export async function addEntry(wsId: string, staff: Staff, text: string) {
  const t = now();
  await store.add(`worksheets/${wsId}/entries`, { text, by: staff.id, byName: staff.name, role: staff.role, at: t });
  await store.update(`worksheets/${wsId}`, { updatedAt: t });
}

export async function recountParts(wsId: string, parts: WsPart[]) {
  await store.update(`worksheets/${wsId}`, { partsCount: parts.length, waitingParts: parts.filter((p) => p.state === 'waiting').length, updatedAt: now() });
}

export async function addPhoto(ws: Worksheet, staff: Staff, file: File) {
  const path = `worksheets/${ws.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
  const small = await shrink(file);
  const url = await store.upload(path, small);
  const photos = [...(ws.photos || []), { url, path, at: now(), by: staff.name }];
  await store.update(`worksheets/${ws.id}`, { photos, updatedAt: now() });
}

/** Phone photos are large; resize to max 1600px before upload. */
async function shrink(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) return file;
  try {
    const img = await createImageBitmap(file);
    const k = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((res) => c.toBlob((b) => res(b || file), 'image/jpeg', 0.82));
  } catch {
    return file;
  }
}
