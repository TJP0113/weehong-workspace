/* Translates the whole interface in place. Every Chinese UI string in the source is listed in dict.json
   (with {0}-style placeholders for values), so the page is written in Chinese and switched to English or
   Malay here, after React renders. Data people enter (customer names, notes) and AutoCount part names are
   left as they are. Elements with translate="no" or class "notranslate" are skipped. */
import DICT from './dict.json';
import { getPrefs } from './prefs';

type Lang = 'zh' | 'en' | 'ms';
const CJK = /[一-鿿]/;
const D = DICT as unknown as Record<string, [string, string]>;

const exact = new Map<string, [string, string]>();
const patterns: { re: RegExp; out: [string, string]; w: number; dot: boolean }[] = [];
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*');
for (const [k, v] of Object.entries(D)) {
  if (!/\{\d\}/.test(k)) { exact.set(k.trim(), v); continue; }
  const parts = k.trim().split(/\{\d\}/);
  patterns.push({ re: new RegExp('^' + parts.map(esc).join('(.*?)') + '$', 's'), out: v, w: parts.join('').replace(/\s/g, '').length + (parts[0].trim() ? 0.5 : 0), dot: k.includes('·') });
}
patterns.sort((a, b) => b.w - a.w);

const cache: Record<string, Map<string, string>> = { en: new Map(), ms: new Map() };
export function tr(s: string, lang: Lang = getPrefs().lang as Lang, depth = 0): string {
  if (lang === 'zh' || !s || !CJK.test(s)) return s;
  const c = cache[lang];
  const hit = c.get(s);
  if (hit !== undefined) return hit;
  const li = lang === 'en' ? 0 : 1;
  const lead = s.match(/^\s*/)![0];
  const trail = s.match(/\s*$/)![0];
  const core = s.trim();
  let out: string | null = null;
  const ex = exact.get(core);
  if (ex) out = ex[li];
  if (out === null && depth < 4) {
    for (const p of patterns) {
      const m = core.match(p.re);
      // a short pattern like "{0} 天" must not swallow "星期四 · 今天"; such strings are split at " · " below
      // short patterns ("{0} 天", "{0} 验车{1}") are only trusted when every gap translates cleanly,
      // so "星期四 · 今天" or "收起近期验车日程" fall through to longer patterns or to splitting at " · "
      if (m && p.w < 2.5 && m.slice(1).some((x) => (!p.dot && x.includes('·')) || CJK.test(tr(x, lang, depth + 1)))) continue;
      if (m) { out = p.out[li].replace(/\{(\d)\}/g, (_, i) => tr(m[Number(i) + 1], lang, depth + 1)); break; }
    }
  }
  if (out === null && depth < 4) {
    const segs = core.split(/(\s*·\s*|，|、|：|；)/);
    if (segs.length > 1) {
      const sep: Record<string, string> = { '，': ', ', '、': ', ', '：': ': ', '；': '; ' };
      out = segs.map((x, i) => (i % 2 ? sep[x] ?? (x.includes('·') ? x : x) : tr(x, lang, depth + 1))).join('');
    }
  }
  const res = lead + (out ?? core) + trail;
  if (c.size > 5000) c.clear();
  c.set(s, res);
  return res;
}

/* ---------- applying it to the page ---------- */
const orig = new WeakMap<Text, string>();
const written = new WeakMap<Text, string>();
const attrOrig = new WeakMap<Element, Record<string, [string, string]>>();
const ATTRS = ['placeholder', 'aria-label', 'title'];
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'PRE']);
let lang: Lang = 'zh';

function origOf(n: Text) {
  if (written.has(n) && written.get(n) === n.data) return orig.get(n)!;
  orig.set(n, n.data);
  written.delete(n);
  return n.data;
}
function write(n: Text, v: string) {
  if (n.data !== v) n.data = v;
  written.set(n, v);
}
const skipped = (el: Element) => SKIP.has(el.tagName) || (el as HTMLElement).isContentEditable || !!el.closest('[translate="no"],.notranslate');

function joinRoot(el: Element) {
  // a heading split with <br>, e.g. 交通<br>运输, is translated as one phrase "交通|运输"
  const segs: Text[][] = [[]];
  const walk = (n: Node) => n.childNodes.forEach((c) => {
    if (c.nodeType === 3) segs[segs.length - 1].push(c as Text);
    else if ((c as Element).tagName === 'BR') segs.push([]);
    else walk(c);
  });
  walk(el);
  const key = segs.map((s) => s.map(origOf).join('')).join('|');
  const out = lang === 'zh' ? key : tr(key, lang);
  const parts = out === key && lang !== 'zh' ? segs.map((s) => tr(s.map(origOf).join(''), lang)) : out.split('|');
  segs.forEach((s, i) => s.forEach((n, j) => write(n, j === 0 ? parts[i] ?? '' : (lang === 'zh' ? origOf(n) : ''))));
  if (lang === 'zh') segs.forEach((s) => s.forEach((n) => write(n, origOf(n))));
}

function processEl(el: Element) {
  const formField = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
  if (!formField && skipped(el)) return;
  if (formField) { attrs(el); return; }
  const jr = el.closest('[data-i18n-join]');
  if (jr) { joinRoot(jr); return; }
  // runs of neighbouring text nodes are translated together ("第 ", "3", " 天" → "Day 3")
  let run: Text[] = [];
  const flush = () => {
    if (!run.length) return;
    const o = run.map(origOf);
    if (lang === 'zh') run.forEach((n, i) => write(n, o[i]));
    else if (run.length === 1) write(run[0], tr(o[0], lang));
    else {
      const all = o.join('');
      const t = tr(all, lang);
      if (t !== all) run.forEach((n, i) => write(n, i === 0 ? t : ''));
      else run.forEach((n, i) => write(n, tr(o[i], lang)));
    }
    run = [];
  };
  el.childNodes.forEach((c) => { if (c.nodeType === 3) run.push(c as Text); else flush(); });
  flush();
  attrs(el);
}

function attrs(el: Element) {
  for (const a of ATTRS) {
    if (!el.hasAttribute(a)) continue;
    const rec = attrOrig.get(el) || {};
    const cur = el.getAttribute(a)!;
    if (!rec[a] || rec[a][1] !== cur) rec[a] = [cur, cur];
    const v = lang === 'zh' ? rec[a][0] : tr(rec[a][0], lang);
    rec[a][1] = v;
    attrOrig.set(el, rec);
    if (cur !== v) el.setAttribute(a, v);
  }
}

function processTree(root: Element) {
  processEl(root);
  root.querySelectorAll('*').forEach(processEl);
}

let titleOrig = '';
function all() {
  processTree(document.body);
  if (!titleOrig) titleOrig = document.title;
  document.title = lang === 'zh' ? titleOrig : tr(titleOrig, lang);
}

let started = false;
export function setTranslateLang(l: string) {
  const next = (['zh', 'en', 'ms'].includes(l) ? l : 'zh') as Lang;
  if (next === lang && started) return;
  lang = next;
  if (started) all();
}

export function startAutoTranslate() {
  if (started) return;
  started = true;
  lang = (getPrefs().lang as Lang) || 'zh';
  const pending = new Set<Element>();
  let scheduled = false;
  const run = () => {
    scheduled = false;
    const els = [...pending];
    pending.clear();
    els.forEach((el) => { if (el.isConnected) processTree(el); });
  };
  const obs = new MutationObserver((muts) => {
    for (const m of muts) {
      const t = m.type === 'characterData' ? m.target.parentElement : (m.target as Element);
      if (!t || t.nodeType !== 1) continue;
      if (m.type === 'characterData' && written.get(m.target as Text) === (m.target as Text).data) continue;
      if (m.type === 'attributes') { const rec = attrOrig.get(t); if (rec && rec[m.attributeName!]?.[1] === t.getAttribute(m.attributeName!)) continue; }
      pending.add(t);
    }
    if (pending.size && !scheduled) { scheduled = true; queueMicrotask(run); }
  });
  window.addEventListener('prefs-changed', () => setTranslateLang(getPrefs().lang));
  obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  all();
}
