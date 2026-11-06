import { nowIso, type Env } from './env';
import { getDoc, listAll, patchDoc, query } from './firestore';
import { gfetch, userToken } from './google';

const DRIVE = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const esc = (s: any) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

async function folder(env: Env, token: string, name: string, parent?: string): Promise<string> {
  const key = `drive_folder:${parent || 'root'}:${name}`;
  const hit = await env.KV.get(key);
  if (hit) return hit;
  const r = await gfetch(token, DRIVE, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: parent ? [parent] : undefined }) });
  const j: any = await r.json();
  await env.KV.put(key, j.id);
  return j.id;
}

async function upload(token: string, meta: any, body: Blob | string, type: string) {
  const boundary = 'wh' + Math.random().toString(36).slice(2);
  const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${type}\r\n\r\n`;
  const blob = new Blob([head, body, `\r\n--${boundary}--`]);
  const r = await gfetch(token, `${UPLOAD}?uploadType=multipart&fields=id,webViewLink`, { method: 'POST', headers: { 'content-type': `multipart/related; boundary=${boundary}` }, body: blob });
  return (await r.json()) as { id: string; webViewLink: string };
}

function html(general: any, fieldsDef: any[], ws: any, parts: any[], entries: any[]) {
  const enabled = fieldsDef.filter((f: any) => f.enabled);
  return `<html><head><meta charset="utf-8"></head><body style="font-family:Arial,'Noto Sans SC',sans-serif">
<h2 style="margin:0">${esc(general.companyName)}</h2><p style="margin:0;color:#444">${esc([general.companyAddress, general.companyPhone].filter(Boolean).join(' · '))}</p>
<h1 style="margin:16px 0 4px">JOB SHEET 工作表 ${esc(ws.no)}</h1>
<table style="border-collapse:collapse;width:100%">${enabled.map((f: any) => `<tr><td style="padding:4px 8px;color:#444;width:30%">${esc(f.label)}</td><td style="padding:4px 8px"><b>${esc(ws.fields?.[f.id])}${f.unit && ws.fields?.[f.id] ? ' ' + esc(f.unit) : ''}</b></td></tr>`).join('')}</table>
<h3>零件 Parts</h3>
<table border="1" style="border-collapse:collapse;width:100%"><tr style="background:#eee"><th>√</th><th>Qty</th><th>Description</th><th>Remarks</th></tr>
${parts.map((p) => `<tr><td align="center">${p.state === 'issued' ? '✓' : ''}</td><td align="center">${esc(p.qty)}</td><td>${esc(p.name)}${p.position ? ` (${esc(p.position)})` : ''}</td><td>${esc([p.state === 'waiting' ? '待料' : '', p.note].filter(Boolean).join(' · '))}</td></tr>`).join('')}</table>
<h3>维修事项 Work Done</h3>
${entries.map((e) => `<p style="margin:4px 0">${esc(String(e.at).slice(5, 10))} ${esc(e.byName)}：${esc(e.text)}</p>`).join('')}
<p style="margin-top:24px;color:#555">维修员：${esc(ws.assigneeName || '')} · 检查：${esc(ws.review?.by || '')} ${esc(String(ws.review?.at || '').slice(0, 10))}</p>
</body></html>`;
}

/** Saves closed worksheets (PDF + photos) to Google Drive: 维修工作表系统 / 年 / 月 / 工作表号 */
export async function archiveClosed(env: Env) {
  const token = await userToken(env);
  if (!token) return 0;
  const integ: any = (await getDoc(env, 'settings/integrations')) || {};
  const opt = { drivePdf: true, drivePhotos: true, ...(integ.options || {}) };
  if (!opt.drivePdf && !opt.drivePhotos) return 0;
  const closed = (await query(env, 'worksheets', [['status', 'EQUAL', 'closed']])).filter((w: any) => !w.archived).slice(0, 5);
  if (!closed.length) return 0;
  const general: any = (await getDoc(env, 'settings/general')) || {};
  const fieldsDef: any[] = ((await getDoc(env, 'settings/fields')) as any)?.list || [];
  const rootId = await folder(env, token, '维修工作表系统');
  if (!integ.google?.folderUrl) await patchDoc(env, 'settings/integrations', { 'google.folderUrl': `https://drive.google.com/drive/folders/${rootId}` });
  for (const ws of closed) {
    const d = (ws.review?.at || ws.updatedAt || nowIso()).slice(0, 7);
    const y = await folder(env, token, d.slice(0, 4), rootId);
    const m = await folder(env, token, `${Number(d.slice(5, 7))}月`, y);
    const wf = await folder(env, token, `${ws.no} ${ws.plate || ws.model || ''}`.trim(), m);
    if (opt.drivePdf) {
      const p = await listAll(env, `worksheets/${ws.id}/parts`);
      const e = (await listAll(env, `worksheets/${ws.id}/entries`)).sort((a: any, b: any) => (a.at > b.at ? 1 : -1));
      const doc = await upload(token, { name: `${ws.no} 工作表`, mimeType: 'application/vnd.google-apps.document', parents: [wf] }, html(general, fieldsDef, ws, p, e), 'text/html; charset=UTF-8');
      const pdf = await gfetch(token, `${DRIVE}/${doc.id}/export?mimeType=application/pdf`);
      await upload(token, { name: `${ws.no}.pdf`, parents: [wf] }, await pdf.blob(), 'application/pdf');
    }
    if (opt.drivePhotos) {
      for (const [i, ph] of (ws.photos || []).entries()) {
        const img = await fetch(ph.url);
        if (img.ok) await upload(token, { name: `${ws.no}-照片${i + 1}.jpg`, parents: [wf] }, await img.blob(), img.headers.get('content-type') || 'image/jpeg');
      }
    }
    await patchDoc(env, `worksheets/${ws.id}`, { archived: true, driveUrl: `https://drive.google.com/drive/folders/${wf}` });
  }
  return closed.length;
}
