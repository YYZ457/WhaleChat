/* 鲸语 —— 主界面逻辑 */
(() => {
const $ = s => document.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v);
  }
  kids.flat().forEach(k => k != null && e.append(k));
  return e;
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const Cap = window.Capacitor;
const isNative = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
const P = (Cap && Cap.Plugins) || {};
const DSI = isNative ? P.DeepSeekImport : null;

/* ---------------- 图标 ---------------- */
const I = {
  logo: (s = 64) => `<svg width="${s}" height="${s * 0.75}" viewBox="8 8 92 69"><defs><linearGradient id="wg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6b8bff"/><stop offset="1" stop-color="#3b57ee"/></linearGradient></defs><path fill="url(#wg)" d="M12 56C12 38 28 28 46 30C60 31 70 40 76 48C79 44 80 38 79 33C74 31 70 26 70 20C76 21 81 25 83 28C85 23 90 19 96 19C95 26 90 31 85 34C84 46 76 62 58 70C44 76 24 76 16 68C13 65 12 60 12 56Z"/><path fill="#fff" d="M15 61C28 70 48 70 66 58C58 70 44 75 30 73C22 71 17 67 15 61Z"/><circle cx="30" cy="47" r="3.6" fill="#1b2559"/><circle cx="31.3" cy="45.8" r="1.2" fill="#fff"/><ellipse cx="38" cy="56" rx="3.6" ry="2.2" fill="#ff9db5" opacity=".75"/><path d="M34 23c0-4 1.5-7 4-9M40 22c1.5-3 4-5 7-6M28 22c-1-3-3-5-5.5-6" stroke="#6b8bff" stroke-width="3" stroke-linecap="round" fill="none"/></svg>`,
  plus: '<svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="currentColor" stroke-width="2"><circle cx="15" cy="15" r="13"/><path d="M15 9v12M9 15h12" stroke-linecap="round"/></svg>',
  close: '<svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="currentColor" stroke-width="2"><circle cx="15" cy="15" r="13"/><path d="m10.5 10.5 9 9m0-9-9 9" stroke-linecap="round"/></svg>',
  voice: '<svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="15" cy="15" r="13"/><circle cx="11" cy="15" r="1.3" fill="currentColor" stroke="none"/><path d="M15 11.5a5 5 0 0 1 0 7M18.5 8.5a9.5 9.5 0 0 1 0 13"/></svg>',
  send: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5"/></svg>',
  stop: '<svg width="14" height="14" viewBox="0 0 14 14"><rect width="14" height="14" rx="3" fill="currentColor"/></svg>',
  muted: '<svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11v6h4.5l6 5V6l-6 5z"/><path d="M19 11.5a4 4 0 0 1 .4 5M22 8.5a8.5 8.5 0 0 1 .6 11"/><path d="M4 4l20 20"/></svg>',
  sound: '<svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11v6h4.5l6 5V6l-6 5z"/><path d="M19 11.5a4 4 0 0 1 .4 5M22 8.5a8.5 8.5 0 0 1 .6 11"/></svg>',
  copy: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><rect x="8" y="8" width="13" height="13" rx="3"/><path d="M16 8V6a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v7a3 3 0 0 0 3 3h2"/></svg>',
  regen: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.3-5.6L20 8.7"/><path d="M20 3.5v5.2h-5.2"/></svg>',
  speak: '<svg width="18" height="18" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11v6h4.5l6 5V6l-6 5z"/><path d="M19 11.5a4 4 0 0 1 .4 5M22 8.5a8.5 8.5 0 0 1 .6 11"/></svg>',
  chev: '<svg class="chev" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5 7 7-7 7"/></svg>',
  back: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5-7 7 7 7"/></svg>',
  down: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  think: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(45 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(-45 12 12)"/></svg>',
  globeSm: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19M12 2.5c2.8 2.8 4 6 4 9.5s-1.2 6.7-4 9.5c-2.8-2.8-4-6-4-9.5s1.2-6.7 4-9.5z"/></svg>',
  right: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
  dots: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
  list: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="5.5" cy="7" r="2.2"/><circle cx="5.5" cy="17" r="2.2"/><path d="M11 7h9M11 17h9"/></svg>',
  trash: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/></svg>',
  // 设置页图标
  key: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4.5"/><path d="m11.2 11.8 8.3-8.3M16.5 6.5l2.5 2.5M14 9l2 2"/></svg>',
  data: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><ellipse cx="11" cy="5.5" rx="7.5" ry="3"/><path d="M3.5 5.5v12c0 1.7 3.4 3 7.5 3M18.5 5.5V11M3.5 11.5c0 1.7 3.4 3 7.5 3"/><circle cx="18" cy="17.5" r="2.2"/><path d="M18 13.8v1.5M18 19.7v1.5M14.3 17.5h1.5M20.2 17.5h1.5"/></svg>',
  globe: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19M12 2.5c2.8 2.8 4 6 4 9.5s-1.2 6.7-4 9.5c-2.8-2.8-4-6-4-9.5s1.2-6.7 4-9.5z"/></svg>',
  moon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12.5 4.5a8 8 0 1 0 7 11 7 7 0 0 1-7-11z"/><path d="M15 3h3l-3 3.5h3M19.5 7.5h2l-2 2.5h2"/></svg>',
  font: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><text x="1" y="19" font-size="11" font-weight="600" font-family="sans-serif">A</text><text x="9" y="19" font-size="17" font-weight="600" font-family="sans-serif">A</text></svg>',
  magic: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round"><path d="m11 3 1.9 4.4 4.7.5-3.5 3.2 1 4.6L11 13.3l-4.1 2.4 1-4.6L4.4 7.9l4.7-.5z"/><path d="m15.5 15.5 5 5"/></svg>',
  heart: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M12 20s-7.5-4.6-9-9.4C2 7.3 4.2 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3 0 5.2 2.8 4.2 6.1C19.5 15.4 12 20 12 20z"/></svg>',
  layers: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="m12 3 9 4.8-9 4.8-9-4.8z"/><path d="m3 12.3 9 4.8 9-4.8M3 16.6l9 4.8 9-4.8"/></svg>',
  info: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="9.5"/><path d="M12 11v6M12 7.5v.2"/></svg>',
  help: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="9.5"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.6v.6M12 17v.2"/></svg>',
  user: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="8" r="4"/><path d="M4 20.5c1-4 4.2-6 8-6s7 2 8 6" stroke-linecap="round"/></svg>',
};

/* ---------------- 状态 ---------------- */
const DEFAULTS = {
  apiKey: '', baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash', customModel: '',
  effort: 'high', temperature: 1.3, maxTokens: '',
  deepThink: false, webSearch: false, theme: 'system', fontSize: 16,
  userName: '', aiName: '', persona: '', avatar: '',
  memoryOn: true, autoMemory: true, memEvery: 8, recallOn: true, styleExamples: [], lastUserAt: 0, memSinceProfile: 0,
  autoCompact: true, compactAt: 64000, keepRecent: 16,
  ttsAuto: false, ttsVoice: '', ttsRate: 1,
  onboarded: false,
};
let S = { ...DEFAULTS };
let memories = [];
let episodes = [];             // 往事回忆 { id, convId, ts, title, summary, dateKnown }
let profile = { text: '', ts: 0 }; // 关系档案
let convs = [];
let cur = null;               // 当前对话对象（null = 新对话）
let busy = null;              // { ctrl } 生成中
let attachments = [];         // { type:'image', url } | { type:'file', name, text }
let showCount = 60;
const bgJobs = new Set();

const saveSettings = () => DB.set('settings', S);
const saveMem = () => { Mem.touch(); return DB.set('memories', memories); };
const saveEpisodes = () => { Mem.touch(); return DB.set('episodes', episodes); };
const saveProfile = () => DB.set('profile', profile);
const effectiveModel = () => S.model === 'custom' ? (S.customModel || 'deepseek-flash') : S.model;

/* ---------------- 工具 ---------------- */
let toastTimer;
function toast(msg, ms = 2200) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}
async function copyText(s) {
  try { await navigator.clipboard.writeText(s); }
  catch (e) { const ta = el('textarea', {}, ); ta.value = s; document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
  toast('已复制');
}
/* Markdown：代码块带语言标题 + 复制按钮 + 高亮 */
const LANG_ALIAS = { js: 'javascript', ts: 'typescript', py: 'python', sh: 'bash', shell: 'bash', zsh: 'bash', html: 'xml', vue: 'xml', svg: 'xml', yml: 'yaml', 'c++': 'cpp', 'c#': 'csharp', md: 'markdown', kt: 'kotlin', rs: 'rust' };
marked.use({ gfm: true, breaks: true, renderer: {
  code(tok) {
    const raw = (tok.lang || '').trim().split(/\s+/)[0];
    const lang = raw.toLowerCase();
    const hl = window.hljs && hljs.getLanguage(LANG_ALIAS[lang] || lang);
    let body;
    try { body = hl ? hljs.highlight(tok.text, { language: LANG_ALIAS[lang] || lang, ignoreIllegals: true }).value : esc(tok.text); }
    catch (e) { body = esc(tok.text); }
    return `<div class="codeblock"><div class="cb-head"><span>${esc(raw || 'text')}</span><button class="cb-copy" type="button">${I.copy}<span>复制</span></button></div><pre><code class="hljs">${body}</code></pre></div>`;
  },
} });
function renderMd(s) {
  try { return DOMPurify.sanitize(marked.parse(s || ''), { ADD_ATTR: ['data-n', 'target'] }); }
  catch (e) { return esc(s).replace(/\n/g, '<br>'); }
}
/* 把联网搜索的引用标记插入正文（按 Unicode 码点位置） */
function withCitations(m) {
  const ann = m.citations;
  if (!ann || !ann.length || !m.sources) return m.content;
  const cps = Array.from(m.content);
  const at = {};
  for (const a of ann) {
    const c = a.url_citation || a;
    const n = m.sources.findIndex(x => x.url === c.url) + 1;
    if (!n || c.end_index == null) continue;
    (at[c.end_index] = at[c.end_index] || new Set()).add(n);
  }
  const keys = Object.keys(at).map(Number).sort((a, b) => b - a);
  for (const k of keys) {
    // 避免插进代码块或链接里：只在码点位置处插入
    const tag = [...at[k]].sort((a, b) => a - b).slice(0, 3).map(n => `<sup class="cite" data-n="${n}">${n}</sup>`).join('');
    cps.splice(Math.min(k, cps.length), 0, tag);
  }
  return cps.join('');
}
const fmtK = n => n >= 10000 ? (n / 1000).toFixed(0) + 'k' : n;

/* 叠层：sheet / dialog */
const layer = $('#layer');
const stack = [];
function pushLayer(node, onClose) {
  const mask = el('div', { class: 'mask' });
  const entry = { node, mask, onClose };
  mask.addEventListener('click', () => closeLayer(entry));
  layer.append(mask, node);
  stack.push(entry);
  requestAnimationFrame(() => { mask.classList.add('show'); node.classList.add('show'); });
  return entry;
}
function closeLayer(entry) {
  entry = entry || stack[stack.length - 1];
  if (!entry) return;
  const i = stack.indexOf(entry); if (i >= 0) stack.splice(i, 1);
  entry.mask.classList.remove('show'); entry.node.classList.remove('show');
  setTimeout(() => { entry.mask.remove(); entry.node.remove(); }, 260);
  entry.onClose && entry.onClose();
}
function sheet(title, items) {
  const box = el('div', { class: 'sheet' }, el('div', { class: 'grab' }), title ? el('div', { class: 'sheet-title' }, title) : null);
  const g = el('div', { class: 'group' });
  items.filter(Boolean).forEach(it => g.append(el('button', { class: 'row' + (it.danger ? ' danger' : ''), onclick: () => { closeLayer(entry); it.action(); } },
    it.icon ? el('span', { html: it.icon }) : null, el('span', { class: 'lbl' }, it.label))));
  box.append(g, el('button', { class: 'btn ghost', onclick: () => closeLayer(entry) }, '取消'));
  const entry = pushLayer(box);
}
function dialog({ title, text, input, textarea, value = '', placeholder = '', ok = '确定', cancel = '取消', danger = false }) {
  return new Promise(resolve => {
    let field = null;
    if (input || textarea) {
      field = el(textarea ? 'textarea' : 'input', { placeholder });
      field.value = value;
    }
    let done = false;
    const finish = v => { if (done) return; done = true; closeLayer(entry); resolve(v); };
    const box = el('div', { class: 'dialog' },
      title ? el('h3', {}, title) : null,
      text ? el('p', { html: text }) : null,
      field,
      el('div', { class: 'acts' },
        cancel ? el('button', { onclick: () => finish(null) }, cancel) : null,
        el('button', { class: danger ? 'danger' : 'primary', onclick: () => finish(field ? field.value : true) }, ok)));
    const entry = pushLayer(box, () => { if (!done) { done = true; resolve(null); } });
    if (field) setTimeout(() => field.focus(), 250);
  });
}

/* ---------------- 主题 / 字号 ---------------- */
function applyTheme() {
  const root = document.documentElement;
  if (S.theme === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', S.theme);
  root.style.setProperty('--fs', S.fontSize + 'px');
  const dark = S.theme === 'dark' || (S.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  try { P.SystemBars && P.SystemBars.setStyle({ style: dark ? 'DARK' : 'LIGHT' }); } catch (e) {}
}
{ const mq = matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener ? mq.addEventListener('change', applyTheme) : mq.addListener(applyTheme); }

/* ---------------- 侧边栏 ---------------- */
const app = $('#app');
function openSide() { renderList(); app.classList.add('side-open'); }
// 宽屏（平板、折叠屏展开）侧边栏常驻
const wideMQ = matchMedia('(min-width: 840px)');
wideMQ.addEventListener ? wideMQ.addEventListener('change', () => renderList()) : wideMQ.addListener(() => renderList());
// 「回到底部」按钮跟随输入框高度，避免大字体/附件时被挡住
if (window.ResizeObserver) new ResizeObserver(() => { document.documentElement.style.setProperty('--cw', $('#composerWrap').offsetHeight + 'px'); }).observe($('#composerWrap'));
function closeSide() { app.classList.remove('side-open'); }
$('#menuBtn').onclick = openSide;
$('#mainMask').onclick = closeSide;
// 左右滑动手势
(() => {
  let x0 = null, y0 = 0;
  document.addEventListener('touchstart', e => { if (stack.length || document.querySelector('.page.show')) return; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  document.addEventListener('touchend', e => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) > 70 && Math.abs(dy) < 60) {
      if (dx > 0 && !app.classList.contains('side-open') && x0 < 60) openSide();
      if (dx < 0 && app.classList.contains('side-open')) closeSide();
    }
    x0 = null;
  }, { passive: true });
})();

function dayGroup(ts) {
  const d0 = new Date(); d0.setHours(0, 0, 0, 0);
  const t = d0.getTime();
  if (ts >= t) return '今天';
  if (ts >= t - 864e5) return '昨天';
  if (ts >= t - 7 * 864e5) return '7 天内';
  if (ts >= t - 30 * 864e5) return '30 天内';
  const d = new Date(ts);
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}
function renderList() {
  const q = $('#searchInput').value.trim().toLowerCase();
  const box = $('#convList');
  box.innerHTML = '';
  let list = convs.slice().sort((a, b) => b.updatedAt - a.updatedAt);
  const snippets = {};
  if (q) {
    list = list.filter(c => {
      if (c.title.toLowerCase().includes(q)) return true;
      const m = c.messages.find(m => !m.hidden && (m.content || '').toLowerCase().includes(q));
      if (m) { const i = m.content.toLowerCase().indexOf(q); snippets[c.id] = m.content.slice(Math.max(0, i - 8), i + 30); return true; }
      return false;
    });
  }
  if (!list.length) {
    box.append(el('div', { class: 'empty-list', html: q ? '没有找到相关对话' : '还没有对话<br>可以在「设置 → 数据管理」里导入原来的聊天记录' }));
    return;
  }
  let last = null, first = true;
  const hl = s => q ? esc(s).replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), m => `<mark>${m}</mark>`) : esc(s);
  for (const c of list) {
    const g = dayGroup(c.updatedAt);
    if (g !== last) {
      box.append(el('div', { class: 'group-label' }, g, first ? el('button', { html: I.list, 'aria-label': '管理', onclick: manageAll }) : null));
      last = g; first = false;
    }
    const item = el('div', { class: 'conv' + (cur && cur.id === c.id ? ' active' : '') },
      el('div', { class: 't' },
        el('div', { html: hl(c.title) + (c.source === 'imported' ? '<span class="import-tag">导入</span>' : '') }),
        snippets[c.id] ? el('div', { class: 'snippet', html: hl(snippets[c.id]) }) : null),
      el('button', { class: 'more', html: I.dots, onclick: e => { e.stopPropagation(); convMenu(c); } }));
    item.onclick = () => { openConv(c.id); closeSide(); };
    let pressT;
    item.addEventListener('touchstart', () => { pressT = setTimeout(() => { pressT = null; convMenu(c); }, 550); }, { passive: true });
    item.addEventListener('touchend', () => clearTimeout(pressT));
    item.addEventListener('touchmove', () => clearTimeout(pressT), { passive: true });
    item.addEventListener('contextmenu', e => { e.preventDefault(); convMenu(c); });
    box.append(item);
  }
}
$('#searchInput').addEventListener('input', renderList);

function convMenu(c) {
  sheet(c.title, [
    { label: '重命名', action: async () => { const v = await dialog({ title: '重命名', input: true, value: c.title }); if (v && v.trim()) { c.title = v.trim(); await DB.putConv(c); renderList(); renderHeader(); } } },
    { label: '查看 / 编辑上下文回顾', action: () => openSummaryPage(c) },
    { label: '整理这段对话的记忆', action: () => wakeFlow([c]) },
    { label: '删除', danger: true, action: async () => {
      if (await dialog({ title: '删除对话', text: '删除后无法恢复（已提取的长期记忆会保留）', ok: '删除', danger: true })) {
        await DB.delConv(c.id); convs = convs.filter(x => x.id !== c.id);
        if (cur && cur.id === c.id) newChat(); renderList();
      } } },
  ]);
}
function manageAll() {
  sheet('对话管理', [
    { label: '导入原来的聊天记录', action: () => { closeSide(); openSettings(); openImportPage(); } },
    { label: '删除全部对话', danger: true, action: clearAllConvs },
  ]);
}
async function clearAllConvs() {
  if (!await dialog({ title: '删除全部对话？', text: '所有对话都会被删除且无法恢复。<br>长期记忆和设置会保留。', ok: '全部删除', danger: true })) return;
  await DB.clearConvs(); convs = []; newChat(); renderList(); toast('已删除');
}

function renderSideFoot() {
  const av = $('#sideAvatar');
  av.innerHTML = S.avatar ? `<img src="${S.avatar}" alt="">` : esc((S.userName || '我').slice(0, 1));
  $('#sideName').textContent = S.userName || '未设置昵称';
}
$('#openSettings').onclick = () => openSettings();
$('#sideAvatar').onclick = () => openSettings();
$('#sideName').onclick = () => openSettings();

/* ---------------- 对话区 ---------------- */
const scroller = $('#scroller');
const msgBox = $('#messages');
function renderHeader() {
  if (wideMQ.matches) renderList();
  $('#chatTitle').innerHTML = cur ? esc(cur.title) : '';
  $('#ttsBtn').innerHTML = S.ttsAuto ? I.sound : I.muted;
}
function renderWelcome() {
  const has = !cur || !cur.messages.length;
  $('#welcome').classList.toggle('hidden', !has);
  if (has) {
    $('#welcomeLogo').innerHTML = I.logo(60);
    const companion = !!(S.persona || '').trim();
    $('#welcomeText').textContent = companion ? `${timeGreet()}${S.userName ? '，' + S.userName : ''}` : convs.length ? '欢迎回来，想从哪里开始？' : '你好，我能帮什么忙吗？';
    const acts = $('#welcomeActs'); acts.innerHTML = '';
    if (companion && S.apiKey) acts.append(el('button', { class: 'w-act primary', onclick: greet }, `让${S.aiName || 'TA'}先开口`));
    const pend = pendingConvs().filter(c => c.source === 'imported');
    if (S.memoryOn && pend.length) acts.append(el('button', { class: 'w-act', onclick: openWakePage }, `还有 ${pend.length} 段导入的对话没整理成记忆，继续整理`));
  }
}
function timeGreet() {
  const h = new Date().getHours();
  return h < 5 ? '夜深了' : h < 11 ? '早上好' : h < 14 ? '中午好' : h < 18 ? '下午好' : h < 23 ? '晚上好' : '夜深了';
}
/* TA 先开口：发一条不显示的提示，让 TA 根据时间、上次聊天和记忆主动说话 */
async function greet() {
  if (!await ensureKey() || busy) return;
  maybeMemorize(cur);
  cur = { id: uid(), title: `${S.aiName || 'TA'}来找你了`, createdAt: Date.now(), updatedAt: Date.now(), messages: [], summary: '', summarizedUpto: 0, memCursor: 0, source: 'local', needTitle: true };
  convs.push(cur);
  cur.messages.push({ id: uid(), role: 'user', hidden: true, ts: Date.now(),
    content: '（我刚打开聊天窗口，还没有说话。请你先开口：结合现在的时间、我们上一次聊天的内容和你记得的关于我的事，自然地跟我说一两句话，就像你一直在等我。不要提到这条提示。）' });
  await DB.putConv(cur);
  renderHeader(); renderMessages(); generate();
}
function nearBottom() { return scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 80; }
let follow = true;
function toBottom(smooth) { follow = true; scroller.scrollTo({ top: scroller.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }); }
let lastTop = 0;
scroller.addEventListener('scroll', () => {
  const st = scroller.scrollTop;
  if (st < lastTop - 4) follow = false;      // 用户往上翻 → 停止跟随
  if (nearBottom()) follow = true;
  lastTop = st;
  $('#toBottomBtn').classList.toggle('hidden', nearBottom());
}, { passive: true });
$('#toBottomBtn').onclick = () => toBottom(true);

function renderMessages() {
  renderWelcome();
  msgBox.innerHTML = '';
  if (!cur) return;
  const n = cur.messages.length;
  const from = Math.max(0, n - showCount);
  if (from > 0) msgBox.append(el('button', { class: 'load-more', onclick: () => { const h = scroller.scrollHeight; showCount += 80; renderMessages(); scroller.scrollTop = scroller.scrollHeight - h; } }, `加载更早的 ${Math.min(80, from)} 条消息`));
  if (cur.background && from === 0) msgBox.append(el('div', { class: 'divider' }, el('button', { onclick: () => openSummaryPage(cur) }, '已附带导入的聊天记录作为上下文')));
  for (let i = from; i < n; i++) {
    if (cur.summary && cur.summarizedUpto === i && i > 0) {
      msgBox.append(el('div', { class: 'divider' }, el('button', { onclick: () => openSummaryPage(cur) }, '以上内容已整理为上下文回顾 · 查看')));
    }
    if (!cur.messages[i].hidden) msgBox.append(msgNode(cur.messages[i], i));
  }
}

const fileIcon = kind => ({ PDF: '#e5484d', Word: '#3b6fe8', PPT: '#ef7d32', Excel: '#21a366' }[kind] || '#8a8f98');
function fileChip(f) {
  if (typeof f === 'string') f = { name: f, kind: Files.kindOf(f) };
  return el('div', { class: 'fchip' },
    el('div', { class: 'ficon', style: `background:${fileIcon(f.kind)}` }, (f.kind || '').slice(0, 4)),
    el('div', { class: 'fmeta' }, el('div', { class: 'fname' }, f.name), el('div', { class: 'fsize' }, [f.kind, f.size].filter(Boolean).join(' · '))));
}

/* 助手消息：搜索条 / 思考过程 / 正文 —— 流式时原地更新，避免整块重绘 */
function fillAssistant(node, m, live) {
  const parts = node._p || (node._p = {});
  // 联网搜索
  if (m.search) {
    if (!parts.search) {
      parts.search = el('button', { class: 'search-bar', onclick: () => showSources(m) });
      node.prepend(parts.search);
    }
    const n = (m.sources || []).length;
    parts.search.innerHTML = m.search.status === 'searching'
      ? `${I.globeSm}<span class="sb-t">正在搜索：${esc((m.search.queries || []).join('、') || '…')}</span>`
      : `${I.globeSm}<span class="sb-t">${n ? `已搜索到 ${n} 个网页` : '未搜索到相关网页'}</span>${n ? I.right : ''}`;
  }
  // 深度思考
  if (m.reasoning) {
    if (!parts.think) {
      parts.thinkHead = el('button', { class: 'think-head' });
      parts.thinkBody = el('div', { class: 'think-body md' });
      parts.think = el('div', { class: 'think' + (m.thinkCollapsed ? ' collapsed' : '') }, parts.thinkHead, parts.thinkBody);
      parts.thinkHead.onclick = () => { parts.think.classList.toggle('collapsed'); m.thinkCollapsed = parts.think.classList.contains('collapsed'); };
      node.insertBefore(parts.think, parts.md || null);
    }
    const thinking = live && !m.content;
    parts.thinkHead.innerHTML = `<span>${thinking ? '思考中…' : `已深度思考${m.thinkSecs ? `（用时 ${m.thinkSecs} 秒）` : ''}`}</span>${I.down}`;
    parts.thinkBody.innerHTML = renderMd(m.reasoning);
  }
  // 正文
  if (!parts.md) { parts.md = el('div', { class: 'md' }); node.append(parts.md); }
  parts.md.classList.toggle('cursor', !!live);
  parts.md.innerHTML = renderMd(live ? m.content : withCitations(m));
}

function msgNode(m, i, live = false) {
  if (m.role === 'user') {
    const col = el('div', { class: 'col' });
    const imgs = m.showImages || m.images;
    if (imgs && imgs.length) col.append(el('div', { class: 'imgs' }, imgs.map(u => el('img', { src: u, alt: '', onclick: () => viewImage(u) }))));
    if (m.files && m.files.length) col.append(el('div', { class: 'files' }, m.files.map(fileChip)));
    if (m.files ? m.displayText : m.content) col.append(el('div', { class: 'bubble' }, m.displayText || m.content));
    const node = el('div', { class: 'msg user', 'data-i': i }, col);
    let pt;
    node.addEventListener('touchstart', () => { pt = setTimeout(() => userMsgMenu(m, i), 550); }, { passive: true });
    node.addEventListener('touchend', () => clearTimeout(pt));
    node.addEventListener('touchmove', () => clearTimeout(pt), { passive: true });
    node.addEventListener('contextmenu', e => { e.preventDefault(); userMsgMenu(m, i); });
    return node;
  }
  const node = el('div', { class: 'msg assistant', 'data-i': i });
  fillAssistant(node, m, live);
  if (m.error) node.append(el('div', { class: 'msg-error' }, m.error));
  if (!live) {
    const isLast = cur && i === cur.messages.length - 1;
    node.append(el('div', { class: 'msg-actions' },
      el('button', { html: I.copy, 'aria-label': '复制', onclick: () => copyText(m.content) }),
      isLast ? el('button', { html: I.regen, 'aria-label': '重新生成', onclick: regenerate }) : null,
      el('button', { html: I.speak, 'aria-label': '朗读', onclick: () => speak(m.content, true) })));
  }
  return node;
}

function showSources(m) {
  if (!m.sources || !m.sources.length) return;
  const box = el('div', { class: 'sheet' }, el('div', { class: 'grab' }), el('div', { class: 'sheet-title' }, `搜索结果 · ${m.sources.length} 个网页`));
  if (m.search && m.search.queries && m.search.queries.length) box.append(el('div', { class: 'note', style: 'padding:0 8px 10px' }, '搜索：' + m.search.queries.join('、')));
  const g = el('div', { class: 'group' });
  m.sources.forEach((x, i) => g.append(el('a', { class: 'src', href: x.url, target: '_blank', rel: 'noopener' },
    el('div', { class: 'src-top' }, x.site_icon ? el('img', { src: x.site_icon, alt: '', onerror: 'this.remove()' }) : null, el('span', {}, `${i + 1}. ${x.site_name || new URL(x.url).hostname}`), x.published_at ? el('span', { class: 'src-date' }, x.published_at.slice(0, 10)) : null),
    el('div', { class: 'src-title' }, x.title || x.url),
    x.snippet ? el('div', { class: 'src-snip' }, x.snippet) : null)));
  box.append(g);
  const entry = pushLayer(box);
}
function viewImage(u) {
  const box = el('div', { class: 'dialog', style: 'padding:8px;width:min(94vw,560px)' }, el('img', { src: u, style: 'width:100%;border-radius:14px;display:block' }));
  pushLayer(box);
}
// 代码块复制、引用角标点击
msgBox.addEventListener('click', e => {
  const b = e.target.closest('.cb-copy');
  if (b) { const code = b.closest('.codeblock').querySelector('code').textContent; copyText(code); const sp = b.querySelector('span'); sp.textContent = '已复制'; setTimeout(() => sp.textContent = '复制', 1500); return; }
  const c = e.target.closest('.cite');
  if (c) {
    const i = Number(c.closest('.msg').dataset.i);
    const m = cur && cur.messages[i];
    const src = m && m.sources && m.sources[Number(c.dataset.n) - 1];
    if (src) window.open(src.url, '_blank');
  }
});

function userMsgMenu(m, i) {
  if (busy) return;
  sheet(null, [
    { label: '复制', action: () => copyText(m.content) },
    { label: '编辑并重新发送', action: async () => {
      const v = await dialog({ title: '编辑消息', textarea: true, value: m.displayText || m.content, ok: '发送' });
      if (v == null || !v.trim()) return;
      cur.messages = cur.messages.slice(0, i);
      if ((cur.summarizedUpto || 0) > i) { cur.summarizedUpto = 0; cur.summary = ''; }
      await DB.putConv(cur); renderMessages();
      if (m.files) {
        const tail = m.displayText || '请阅读以上文件。';
        cur.messages.push({ ...m, id: uid(), content: m.content.slice(0, m.content.length - tail.length) + v.trim(), displayText: v.trim(), ts: Date.now() });
        await DB.putConv(cur); renderMessages(); toBottom(); generate();
      } else send(v.trim(), m.images ? m.images.map(u => ({ type: 'image', url: u })) : []);
    } },
  ]);
}

async function openConv(id) {
  if (busy) stopGen();
  maybeMemorize(cur);
  cur = convs.find(c => c.id === id) || null;
  showCount = 60;
  renderHeader(); renderMessages(); toBottom();
}
function newChat() {
  if (busy) stopGen();
  maybeMemorize(cur);
  cur = null; attachments = []; renderAttach();
  renderHeader(); renderMessages(); closeSide();
}
$('#newChatBtn').onclick = newChat;

/* ---------------- 输入区 ---------------- */
const input = $('#input');
function autosize() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 180) + 'px'; }
input.addEventListener('input', () => { autosize(); updateAction(); });
input.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !('ontouchstart' in window)) { e.preventDefault(); onAction(); }
});
function updateAction() {
  const b = $('#actionBtn');
  if (busy) { b.className = 'round-btn stop'; b.innerHTML = I.stop; b.setAttribute('aria-label', '停止'); return; }
  const has = input.value.trim() || attachments.length;
  b.className = 'round-btn' + (has ? ' send' : '');
  b.innerHTML = has ? I.send : I.voice;
  b.setAttribute('aria-label', has ? '发送' : '语音输入');
}
function onAction() {
  if (busy) return stopGen();
  const t = input.value.trim();
  if (!t && !attachments.length) return voiceInput();
  input.value = ''; autosize();
  const att = attachments; attachments = []; renderAttach(); togglePanel(false);
  send(t, att);
}
$('#actionBtn').onclick = onAction;

function renderChips() {
  $('#thinkChip').classList.toggle('on', !!S.deepThink);
  $('#searchChip').classList.toggle('on', !!S.webSearch);
}
$('#thinkChip').onclick = () => { S.deepThink = !S.deepThink; saveSettings(); renderChips(); };
$('#searchChip').onclick = () => { S.webSearch = !S.webSearch; saveSettings(); renderChips(); if (S.webSearch && effectiveModel() !== 'deepseek-flash') toast('联网搜索使用 Flash 模型'); };

function togglePanel(force) {
  const p = $('#attachPanel');
  const show = force == null ? p.classList.contains('hidden') : force;
  p.classList.toggle('hidden', !show);
  $('#plusBtn').innerHTML = show ? I.close : I.plus;
}
$('#plusBtn').onclick = () => togglePanel();
document.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => {
  ({ camera: $('#pickCamera'), album: $('#pickAlbum'), file: $('#pickFile') })[b.dataset.pick].click();
});

function shrinkImage(file, max = 1280) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      res(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}
async function onPickImages(e) {
  for (const f of e.target.files) { try { attachments.push({ type: 'image', url: await shrinkImage(f) }); } catch (err) { toast('图片读取失败'); } }
  e.target.value = ''; renderAttach(); togglePanel(false);
}
$('#pickCamera').onchange = onPickImages;
$('#pickAlbum').onchange = onPickImages;
$('#pickFile').onchange = async e => {
  const list = [...e.target.files]; e.target.value = ''; togglePanel(false);
  for (const f of list) {
    if (/^image\//.test(f.type)) { try { attachments.push({ type: 'image', url: await shrinkImage(f) }); } catch (err) { toast('图片读取失败'); } continue; }
    if (f.size > 50e6) { toast(`${f.name} 太大了（最大 50MB）`); continue; }
    const ph = { type: 'file', name: f.name, kind: Files.kindOf(f.name), size: Files.fmtSize(f.size), loading: '解析中…' };
    attachments.push(ph); renderAttach();
    try {
      const r = await Files.read(f, msg => { ph.loading = msg; renderAttach(); });
      Object.assign(ph, r, { loading: null });
      if (r.note) toast(r.note, 3000);
    } catch (err) {
      attachments.splice(attachments.indexOf(ph), 1);
      toast(`${f.name}：${err.message}`, 3500);
    }
    renderAttach();
  }
};
function renderAttach() {
  const s = $('#attachStrip');
  s.innerHTML = '';
  s.classList.toggle('hidden', !attachments.length);
  attachments.forEach((a, i) => s.append(el('div', { class: 'att' },
    a.type === 'image' ? el('img', { src: a.url }) : (() => { const c = fileChip(a); if (a.loading) c.querySelector('.fsize').textContent = a.loading; return c; })(),
    el('button', { class: 'x', onclick: () => { attachments.splice(i, 1); renderAttach(); } }, '×'))));
  updateAction();
}

/* 语音输入 */
function voiceInput() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { input.focus(); toast('可以点输入法上的麦克风进行语音输入'); return; }
  const r = new SR(); r.lang = 'zh-CN'; r.interimResults = true;
  const base = input.value;
  toast('正在听…', 8000);
  r.onresult = e => { input.value = base + Array.from(e.results).map(x => x[0].transcript).join(''); autosize(); updateAction(); };
  r.onend = () => toast('识别结束', 800);
  r.onerror = () => toast('语音识别不可用，请使用输入法语音');
  r.start();
}

/* 朗读 */
function cleanForSpeech(s) { return (s || '').replace(/```[\s\S]*?```/g, '代码略').replace(/[#*_`>|~-]+/g, ' ').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); }
async function speak(text, manual) {
  text = cleanForSpeech(text).trim();
  if (!text) return;
  if (P.TextToSpeech) {
    try { await P.TextToSpeech.stop(); await P.TextToSpeech.speak({ text, lang: 'zh-CN', rate: Number(S.ttsRate) || 1, ...(S.ttsVoice !== '' && !isNaN(S.ttsVoice) ? { voice: Number(S.ttsVoice) } : {}) }); }
    catch (e) { manual && toast('朗读失败：' + e.message); }
    return;
  }
  if (!('speechSynthesis' in window)) { manual && toast('当前设备不支持朗读'); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN'; u.rate = Number(S.ttsRate) || 1;
  const v = speechSynthesis.getVoices().find(v => v.name === S.ttsVoice);
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}
function stopSpeak() { try { P.TextToSpeech ? P.TextToSpeech.stop() : speechSynthesis.cancel(); } catch (e) {} }
$('#ttsBtn').onclick = () => { S.ttsAuto = !S.ttsAuto; saveSettings(); renderHeader(); if (!S.ttsAuto) stopSpeak(); toast(S.ttsAuto ? '已开启自动朗读' : '已关闭自动朗读'); };

/* ---------------- 发送 / 生成 ---------------- */
function statusLine(text) {
  let s = $('#statusLine');
  if (!text) { s && s.remove(); return; }
  if (!s) { s = el('div', { class: 'status-line', id: 'statusLine' }); msgBox.append(s); }
  s.textContent = text; toBottom();
}

async function ensureKey() {
  if (S.apiKey) return true;
  openOnboarding();
  return false;
}

async function send(text, att = []) {
  if (!await ensureKey()) { input.value = text; autosize(); updateAction(); return; }
  if (att.some(a => a.loading)) { toast('文件还在解析，请稍等'); input.value = text; autosize(); attachments = att; renderAttach(); return; }
  const shown = att.filter(a => a.type === 'image').map(a => a.url);
  const files = att.filter(a => a.type === 'file');
  const images = shown.concat(...files.map(f => f.images || []));
  let content = text;
  if (files.length) content = files.map(f => f.text ? `【文件：${f.name}】\n${f.text}` : `【文件：${f.name}】（扫描件，内容见图片）`).join('\n\n') + '\n\n' + (text || '请阅读以上文件。');
  if (!cur) {
    cur = { id: uid(), title: text.slice(0, 18) || (files[0] && files[0].name) || '新对话', createdAt: Date.now(), updatedAt: Date.now(), messages: [], summary: '', summarizedUpto: 0, memCursor: 0, source: 'local', needTitle: true };
    convs.push(cur);
  }
  cur.messages.push({ id: uid(), role: 'user', content, displayText: files.length ? text : undefined, files: files.length ? files.map(f => ({ name: f.name, kind: f.kind, size: f.size })) : undefined, images: images.length ? images : undefined, showImages: files.some(f => f.images) ? shown : undefined, ts: Date.now() });
  cur.updatedAt = Date.now();
  await DB.putConv(cur);
  renderHeader(); renderMessages(); toBottom();
  generate();
}

async function regenerate() {
  if (busy || !cur) return;
  const last = cur.messages[cur.messages.length - 1];
  if (last && last.role === 'assistant') cur.messages.pop();
  renderMessages();
  generate();
}

function stopGen() { if (busy) busy.ctrl.abort(); }

async function generate() {
  const conv = cur;
  const ctrl = new AbortController();
  busy = { ctrl }; updateAction();
  try {
    // 智能压缩：上下文过长时，先把较早的对话整理成回顾
    if (S.autoCompact && Brain.liveTokens(conv) > Number(S.compactAt)) {
      statusLine('对话有点长了，正在整理较早的内容…');
      try {
        await Brain.compact(S, conv, { signal: ctrl.signal, onProgress: (i, n) => n > 1 && statusLine(`正在整理较早的对话（${i + 1}/${n}）…`) });
        await DB.putConv(conv);
        if (cur === conv) renderMessages();
      } catch (e) { if (ctrl.signal.aborted) throw e; toast('整理上下文失败，将直接发送'); }
      statusLine('');
    }
    const hasImg = conv.messages.slice(-4).some(m => m.images && m.images.length);
    const search = !!S.webSearch;
    let model = effectiveModel();
    if ((hasImg || search) && model !== 'deepseek-flash') { model = 'deepseek-flash'; toast(search ? '联网搜索仅支持 Flash，本条改用 Flash' : '当前模型不支持图片，本条改用 Flash'); }
    Mem.touch();
    const mctx = Mem.prepare({ S, conv, convs, memories: S.memoryOn ? memories : [], episodes: S.memoryOn ? episodes : [], lastUserAt: S.lastUserAt });
    const messages = Brain.buildMessages(S, conv, { ...mctx, profile });
    S.lastUserAt = Date.now(); saveSettings();
    const m = { id: uid(), role: 'assistant', content: '', reasoning: '', ts: Date.now(), model };
    if (search) m.search = { status: 'searching', queries: [] };
    conv.messages.push(m);
    const idx = conv.messages.length - 1;
    const node = msgNode(m, idx, true);
    if (cur === conv) { msgBox.append(node); toBottom(); }
    const t0 = Date.now(); let tThinkEnd = 0;
    let timer = 0, lastPaint = 0;
    const paint = () => {
      timer = 0; lastPaint = Date.now();
      if (cur !== conv || !node.isConnected) return;
      fillAssistant(node, m, true);
      if (follow) scroller.scrollTop = scroller.scrollHeight;
    };
    const schedule = () => { if (!timer) timer = setTimeout(() => requestAnimationFrame(paint), Math.max(0, 60 - (Date.now() - lastPaint))); };
    const res = await Brain.stream(S, {
      messages, model, thinking: !!S.deepThink, search, signal: ctrl.signal,
      onDelta: (c, r) => {
        m.content = c; m.reasoning = r;
        if (c && !tThinkEnd) tThinkEnd = Date.now();
        if (m.search && c) m.search.status = 'done';
        schedule();
      },
      onTool: ev => {
        if (!m.search) return;
        const call = ev.call || {};
        if (ev.type === 'call_started' && call.action) { m.search.status = 'searching'; m.search.queries = (m.search.queries || []).concat(call.action.queries || []); }
        if (ev.type === 'call_completed') { m.sources = (m.sources || []).concat(call.sources || []); m.search.status = 'done'; }
        schedule();
      },
    });
    if (m.search) {
      m.search.status = 'done';
      if (res.toolCalls) {
        const all = [];
        res.toolCalls.forEach(st => (st.calls || []).forEach(c => (c.sources || []).forEach(x => { if (!all.some(y => y.url === x.url)) all.push(x); })));
        m.sources = all.map(x => ({ url: x.url, title: x.title, snippet: x.snippet, site_name: x.site_name, site_icon: x.site_icon, published_at: x.published_at }));
      }
      if (res.annotations) m.citations = res.annotations.map(a => { const c = a.url_citation || a; return { url: c.url, end_index: c.end_index }; });
    }
    m.content = res.content; m.reasoning = res.reasoning || undefined;
    if (m.reasoning) m.thinkSecs = Math.max(1, Math.round(((tThinkEnd || Date.now()) - t0) / 1000));
    if (res.finish === 'length') m.error = '回复达到长度上限被截断';
    if (res.usage) conv.lastUsage = res.usage;
  } catch (e) {
    const last = conv.messages[conv.messages.length - 1];
    if (ctrl.signal.aborted) {
      if (last && last.role === 'assistant' && !last.content && !last.reasoning) conv.messages.pop();
    } else {
      const msg = e.message === 'Failed to fetch' ? '网络连接失败，请检查网络' : e.message;
      if (last && last.role === 'assistant') last.error = msg;
      else conv.messages.push({ id: uid(), role: 'assistant', content: '', error: msg, ts: Date.now() });
    }
  } finally {
    busy = null; updateAction(); statusLine('');
    conv.updatedAt = Date.now();
    await DB.putConv(conv);
    if (cur === conv) { const f = follow, st = scroller.scrollTop; renderMessages(); if (f) toBottom(); else scroller.scrollTop = st; }
    const last = conv.messages[conv.messages.length - 1];
    if (last && last.role === 'assistant' && last.content && !last.error) {
      if (S.ttsAuto) speak(last.content);
      afterReply(conv);
    }
  }
}

async function afterReply(conv) {
  // 自动起标题
  if (conv.needTitle) {
    conv.needTitle = false;
    Brain.makeTitle(S, conv.messages.filter(m => !m.hidden).slice(0, 2).map(m => m.content).join('\n')).then(async t => {
      if (t) { conv.title = t; await DB.putConv(conv); renderHeader(); }
    }).catch(() => { conv.needTitle = true; });
  }
  // 自动记忆
  if (S.memoryOn && S.autoMemory && conv.messages.length - (conv.memCursor || 0) >= Number(S.memEvery)) memorize(conv);
}
function maybeMemorize(conv) {
  if (conv && S.memoryOn && S.autoMemory && S.apiKey && conv.source !== 'imported' && conv.messages.slice(conv.memCursor || 0).filter(m => m.content && !m.hidden).length >= 2) memorize(conv);
}
/* 把一段新对话「消化」成长期记忆 + 往事回忆 */
async function digestSlice(conv, slice, signal) {
  const date = conv.origin === 'deepseek-app' ? '' : Mem.fmtDate(slice[0].ts || conv.createdAt);
  const r = await Brain.digest(S, memories, slice, { signal, date });
  const res = Mem.applyOps(memories, r.ops, r.alias);
  memories = res.memories;
  if (r.episode) episodes.push({ id: uid(), convId: conv.id, ts: slice[0].ts || conv.createdAt, title: String(r.episode.title).slice(0, 30), summary: String(r.episode.summary).slice(0, 400), dateKnown: conv.origin !== 'deepseek-app' });
  S.memSinceProfile = (S.memSinceProfile || 0) + res.added + res.changed + (r.episode ? 1 : 0);
  return res;
}
async function memorize(conv) {
  if (bgJobs.has(conv.id)) return;
  bgJobs.add(conv.id);
  const end = conv.messages.length;
  const slice = conv.messages.slice(conv.memCursor || 0, end).filter(m => m.content && !m.hidden);
  try {
    if (slice.length) {
      const r = await digestSlice(conv, slice);
      await saveMem(); await saveEpisodes(); saveSettings();
      if (r.added) toast(`💭 记住了 ${r.added} 件新的事`);
      if (memories.length > 150) { memories = (await Brain.consolidate(S, memories)).memories; await saveMem(); }
      if (S.memSinceProfile >= 12) refreshProfile().catch(() => {});
    }
    conv.memCursor = end; await DB.putConv(conv);
  } catch (e) { console.warn('memory', e); }
  finally { bgJobs.delete(conv.id); }
}
async function refreshProfile(signal) {
  if (!memories.length && !episodes.length) return;
  const text = await Brain.updateProfile(S, memories, episodes, profile.text, { signal });
  if (text) { profile = { text: text.trim(), ts: Date.now() }; await saveProfile(); S.memSinceProfile = 0; saveSettings(); }
}

/* ---------------- 页面框架 ---------------- */
const pages = [];
function page(title, build, { right } = {}) {
  const body = el('div', { class: 'page-body' });
  const nativeAppend = body.append.bind(body);
  body.append = (...xs) => nativeAppend(...xs.flat().filter(x => x != null && x !== false));
  const pg = el('div', { class: 'page' },
    el('div', { class: 'page-head' }, el('button', { class: 'back', html: I.back, 'aria-label': '返回', onclick: () => closePage(pg) }), el('h2', {}, title), right || null),
    body);
  pg._refresh = () => { const st = body.scrollTop; body.innerHTML = ''; build(body, pg); body.scrollTop = st; };
  pg._refresh();
  document.body.append(pg);
  pages.push(pg);
  requestAnimationFrame(() => requestAnimationFrame(() => pg.classList.add('show')));
  return pg;
}
function closePage(pg) {
  pg = pg || pages[pages.length - 1];
  if (!pg) return;
  pages.splice(pages.indexOf(pg), 1);
  pg.classList.remove('show');
  setTimeout(() => pg.remove(), 280);
  pg._onClose && pg._onClose();
  pages.forEach(x => x._refresh());
}
const secTitle = t => el('div', { class: 'sec-title' }, t);
const row = (icon, label, val, onclick, extra = {}) => el('button', { class: 'row' + (extra.danger ? ' danger' : '') + (onclick ? '' : ' static'), onclick },
  icon ? el('span', { html: icon }) : null,
  el('span', { class: 'lbl', html: esc(label) + (extra.sub ? `<small>${extra.sub}</small>` : '') }),
  val != null ? el('span', { class: 'val' }, val) : null,
  onclick && !extra.noChev ? el('span', { html: I.chev }) : null);
const switchRow = (label, sub, get, set) => {
  const cb = el('input', { type: 'checkbox' }); cb.checked = !!get();
  cb.onchange = () => set(cb.checked);
  return el('label', { class: 'row' }, el('span', { class: 'lbl', html: esc(label) + (sub ? `<small>${sub}</small>` : '') }), el('span', { class: 'switch' }, cb, el('span')));
};
const field = (label, inputEl, note) => el('div', { class: 'field' }, el('label', {}, label), inputEl, note ? el('div', { class: 'note', style: 'padding:6px 0 0' , html: note }) : null);
function bindInput(type, key, opts = {}) {
  const i = el(type === 'textarea' ? 'textarea' : 'input', { type: type === 'textarea' ? undefined : type, placeholder: opts.placeholder || '', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
  i.value = S[key] ?? '';
  i.onchange = () => { S[key] = type === 'number' ? (i.value === '' ? '' : Number(i.value)) : i.value; saveSettings(); opts.after && opts.after(); };
  return i;
}
function seg(options, get, set) {
  const box = el('div', { class: 'seg' });
  options.forEach(([v, label]) => box.append(el('button', { class: get() === v ? 'on' : '', onclick: () => { set(v); box.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.textContent === label)); } }, label)));
  return box;
}

/* ---------------- 设置 ---------------- */
function openSettings() {
  closeSide();
  page('设置', body => {
    const model = effectiveModel();
    body.append(
      secTitle('账户'),
      el('div', { class: 'group' },
        row(I.key, 'API 接入', S.apiKey ? model.replace('deepseek-', '') : '未设置', openApiPage),
        row(I.data, '数据管理', null, openDataPage)),
      secTitle('应用'),
      el('div', { class: 'group' },
        row(I.globe, '语言', '中文（简体中文）', () => toast('目前仅支持简体中文')),
        row(I.moon, '外观', { system: '跟随系统', light: '浅色', dark: '深色' }[S.theme], openThemePage),
        row(I.font, '字体大小', null, openFontPage),
        row(I.magic, '个性化', null, openPersonaPage)),
      secTitle('陪伴'),
      el('div', { class: 'group' },
        row(I.heart, '记忆', S.memoryOn ? (pendingConvs().length ? `${pendingConvs().length} 段待整理` : '已开启') : '已关闭', openMemoryPage),
        row(I.layers, '上下文与智能压缩', S.autoCompact ? '自动' : '已关闭', openContextPage)),
      secTitle('语音'),
      el('div', { class: 'group' }, row(I.speak.replace(/18/g, '24'), '朗读音色', null, openVoicePage)),
      secTitle('关于'),
      el('div', { class: 'group' },
        row(I.info, '版本', '1.4', null),
        row(I.help, '使用说明', null, openHelpPage)),
    );
  });
}

function openApiPage() {
  page('API 接入', body => {
    const keyIn = bindInput('password', 'apiKey', { placeholder: 'sk-...' });
    const show = el('button', { style: 'color:var(--blue-text);font-size:14px;flex:none', onclick: () => { keyIn.type = keyIn.type === 'password' ? 'text' : 'password'; } }, '显示');
    const status = el('div', { class: 'note' });
    const modelSel = el('select');
    [['deepseek-flash', 'DeepSeek V4.1 Flash（默认 · 快 · 支持图片）'], ['deepseek-v4-pro', 'DeepSeek V4 Pro（更聪明 · 较贵）'], ['custom', '自定义模型名']].forEach(([v, l]) => modelSel.append(el('option', { value: v }, l)));
    modelSel.value = S.model;
    const custom = bindInput('text', 'customModel', { placeholder: '例如 deepseek-chat' });
    const customF = field('自定义模型名', custom);
    customF.classList.toggle('hidden', S.model !== 'custom');
    modelSel.onchange = () => { S.model = modelSel.value; saveSettings(); customF.classList.toggle('hidden', S.model !== 'custom'); };
    const test = el('button', { class: 'btn' }, '一键接入（测试并保存）');
    test.onclick = async () => {
      S.apiKey = keyIn.value.trim(); saveSettings();
      if (!S.apiKey) return toast('请先粘贴 API Key');
      test.disabled = true; status.textContent = '正在连接…';
      try {
        const b = await Brain.balance(S);
        const info = (b.balance_infos || [])[0];
        status.innerHTML = `✅ 连接成功${info ? `，余额 <b>${info.total_balance} ${info.currency}</b>` : ''}${b.is_available === false ? '（余额不足，请充值）' : ''}`;
        S.onboarded = true; saveSettings();
      } catch (e) { status.textContent = '❌ ' + (e.message === 'Failed to fetch' ? '网络连接失败' : e.message); }
      test.disabled = false;
    };
    const paste = el('button', { style: 'color:var(--blue-text);font-size:14px;flex:none', onclick: async () => {
      try { const t = (await navigator.clipboard.readText()).trim(); if (t) { keyIn.value = t; S.apiKey = t; saveSettings(); toast('已粘贴'); } } catch (e) { toast('无法读取剪贴板，请手动粘贴'); }
    } }, '粘贴');
    body.append(
      el('div', { class: 'note', html: '在 <a href="https://platform.deepseek.com/api_keys" target="_blank" style="color:var(--blue-text)">platform.deepseek.com</a> 登录后创建 API Key（以 sk- 开头），复制后粘贴到下面。Key 只保存在你的手机上。' }),
      secTitle('API Key'),
      el('div', { class: 'group' }, el('div', { class: 'field' }, el('div', { class: 'inline' }, keyIn, paste, show))),
      test, status,
      secTitle('模型'),
      el('div', { class: 'group' }, field('对话模型', modelSel), customF,
        field('深度思考强度', seg([['low', '低'], ['high', '高'], ['max', '最高']], () => S.effort, v => { S.effort = v; saveSettings(); })),
        field('温度（非思考模式）', bindInput('number', 'temperature', { placeholder: '1.3' }), '官方建议：日常对话 1.3，创意写作/角色扮演 1.5，越高越有个性、越低越稳定'),
        field('单次回复最大长度（tokens，可留空）', bindInput('number', 'maxTokens', { placeholder: '默认' }))),
      secTitle('高级'),
      el('div', { class: 'group' }, field('API 地址', bindInput('text', 'baseUrl', { placeholder: 'https://api.deepseek.com' }), '兼容 OpenAI 格式的中转地址也可以填在这里')),
    );
  });
}

function openThemePage() {
  page('外观', body => {
    body.append(el('div', { style: 'height:12px' }), el('div', { class: 'group' }, ...[['system', '跟随系统'], ['light', '浅色'], ['dark', '深色']].map(([v, l]) =>
      row(null, l, S.theme === v ? '✓' : '', () => { S.theme = v; saveSettings(); applyTheme(); closePage(); }, { noChev: true }))));
  });
}
function openFontPage() {
  page('字体大小', body => {
    const demo = el('div', { class: 'group', style: 'padding:16px 18px;line-height:1.75;margin-top:12px' }, '预览：今天也要好好吃饭哦，我会一直在这里陪你。');
    demo.style.fontSize = S.fontSize + 'px';
    body.append(demo, el('div', { style: 'height:16px' }),
      seg([[14, '小'], [16, '标准'], [18, '大'], [20, '特大']], () => S.fontSize, v => { S.fontSize = v; saveSettings(); applyTheme(); demo.style.fontSize = v + 'px'; }));
  });
}

/* 人设卡：把 TA 的样子做成一张卡片，而不是一大段文字 */
function personaInfo() {
  const c = S.personaCard || {};
  return { name: S.aiName || c.name || '', userName: S.userName || c.userName || '', relation: c.relation || '', traits: c.traits || [], catchphrases: c.catchphrases || [], greeting: c.greeting || '', persona: S.persona || '', examples: S.styleExamples || [] };
}
function personaCard(p, { editable } = {}) {
  const name = p.name || 'TA';
  const card = el('div', { class: 'pcard' },
    el('div', { class: 'pc-top' },
      el('div', { class: 'pc-av' }, name.slice(0, 1)),
      el('div', { class: 'pc-id' }, el('div', { class: 'pc-name' }, name), el('div', { class: 'pc-rel' }, p.relation || (p.userName ? `叫你「${p.userName}」` : '')))),
    p.greeting ? el('div', { class: 'pc-greet' }, p.greeting) : null,
    p.traits.length ? el('div', { class: 'pc-tags' }, p.traits.map(t => el('span', {}, t))) : null,
    (p.userName || p.catchphrases.length) ? el('div', { class: 'pc-kv' },
      p.userName ? el('div', {}, el('span', {}, 'TA 叫你'), el('b', {}, p.userName)) : null,
      p.catchphrases.length ? el('div', {}, el('span', {}, '口头禅'), el('b', {}, p.catchphrases.map(c => `「${c}」`).join(' '))) : null) : null,
    p.examples.length ? el('div', { class: 'pc-chat' }, p.examples.slice(0, 3).flatMap(e => [el('div', { class: 'pc-u' }, e.user), el('div', { class: 'pc-a' }, e.ai)])) : null,
    p.persona ? el('details', { class: 'pc-more' }, el('summary', {}, 'TA 的完整设定'), el('div', { class: 'pc-text' }, p.persona)) : null);
  return card;
}
function openPersonaPage() {
  page('个性化', (body, pg) => {
    const av = el('div', { class: 'avatar', style: 'width:56px;height:56px;font-size:22px', html: S.avatar ? `<img src="${S.avatar}">` : esc((S.userName || '我').slice(0, 1)) });
    const p = personaInfo();
    const has = !!p.persona;
    const editPersona = async () => { const v = await dialog({ title: 'TA 的设定', textarea: true, value: S.persona, placeholder: '用几句话说说 TA 是谁、你们是什么关系、TA 说话的样子……', ok: '保存' }); if (v != null) { S.persona = v.trim(); saveSettings(); pg._refresh(); } };
    body.append(
      secTitle('TA'),
      has ? personaCard(p) : el('div', { class: 'pcard empty' },
        el('div', { class: 'pc-av' }, '?'),
        el('div', { style: 'font-weight:600;margin-top:10px' }, '还没有设定 TA 的样子'),
        el('div', { class: 'note', style: 'text-align:center;padding:4px 0 0' }, '可以从你们以前的聊天里自动还原，也可以自己写')),
      el('div', { class: 'group', style: 'margin-top:12px' },
        row(I.magic, has ? '从聊天记录重新还原' : '从聊天记录还原 TA', null, () => restorePersonaFlow(), { sub: '读一遍你们以前的对话，找回 TA 的语气和口头禅' }),
        row(null, 'TA 的名字', S.aiName || '未设置', async () => { const v = await dialog({ title: 'TA 的名字', input: true, value: S.aiName, placeholder: '例如：阿屿' }); if (v != null) { S.aiName = v.trim(); saveSettings(); pg._refresh(); } }),
        row(null, has ? '修改设定' : '自己写设定', null, editPersona),
        switchRow('像真人一样聊天', '回复长短跟着你走，不列清单，不说客服话', () => S.companionStyle !== false, v => { S.companionStyle = v; saveSettings(); })),
      secTitle('你'),
      el('div', { class: 'group' },
        el('button', { class: 'row', onclick: () => $('#pickAvatar').click() }, av, el('span', { class: 'lbl' }, '头像'), el('span', { html: I.chev })),
        row(null, 'TA 怎么叫你', S.userName || '未设置', async () => { const v = await dialog({ title: 'TA 怎么叫你', input: true, value: S.userName, placeholder: '例如：小朋友、宝宝' }); if (v != null) { S.userName = v.trim(); saveSettings(); renderSideFoot(); pg._refresh(); } })),
    );
  });
}

async function restorePersonaFlow(list) {
  if (!await ensureKey()) return;
  list = (list || convs).filter(c => c.messages.length >= 2);
  if (!list.length) return toast('还没有聊天记录，先导入原来的对话吧');
  const box = el('div', { class: 'dialog' }, el('h3', {}, '正在回想 TA 的样子…'), el('p', {}, '读一遍 TA 以前说过的话，大约需要半分钟'));
  const entry = pushLayer(box);
  try {
    const r = await Brain.restorePersona(S, list.slice().sort((a, b) => b.messages.length - a.messages.length).slice(0, 40));
    closeLayer(entry);
    openPersonaReview(r, list);
  } catch (e) { closeLayer(entry); toast('失败：' + e.message, 3000); }
}
function openPersonaReview(r, list) {
  page('是 TA 吗？', (body, pg) => {
    body.append(
      el('div', { class: 'note', style: 'text-align:center' }, '根据你们以前的聊天还原的。不像的地方可以改，确认后才会生效。'),
      personaCard({ ...r, examples: r.examples || [] }),
      el('button', { class: 'btn', onclick: () => {
        S.persona = r.persona; S.styleExamples = r.examples;
        S.personaCard = { name: r.name, userName: r.userName, relation: r.relation, traits: r.traits, catchphrases: r.catchphrases, greeting: r.greeting };
        if (r.name) S.aiName = r.name;
        const nameChanged = r.userName && !S.userName;
        if (nameChanged) S.userName = r.userName;
        saveSettings(); renderSideFoot(); renderWelcome(); closePage();
        if (nameChanged && profile.text) rebuildSummary(pages.find(x => x.querySelector('.mem-sum'))); toast(`${r.name || 'TA'}回来了`, 2500);
      } }, '就是 TA'),
      el('button', { class: 'btn ghost', onclick: async () => { const v = await dialog({ title: '改一改 TA 的设定', textarea: true, value: r.persona, ok: '好了' }); if (v != null) { r.persona = v.trim(); pg._refresh(); } } }, '我来改一改'),
      el('button', { class: 'btn ghost', onclick: () => { closePage(); restorePersonaFlow(list); } }, '不太像，重新还原'));
  });
}

$('#pickAvatar').onchange = async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  S.avatar = await shrinkImage(f, 200); saveSettings(); renderSideFoot();
  const top = pages[pages.length - 1]; top && top._refresh();
};

/* 记忆：只展示 TA 整理好的摘要；想改什么直接用一句话告诉 TA */
function pendingConvs() { return convs.filter(c => c.messages.slice(c.memCursor || 0).filter(m => m.content && !m.hidden).length >= 2); }
function convMemState(c) {
  const vis = c.messages.filter(m => m.content && !m.hidden).length;
  const left = c.messages.slice(c.memCursor || 0).filter(m => m.content && !m.hidden).length;
  if (left < 2) return { done: true, label: '已整理' };
  if (left < vis) return { done: false, label: `整理了 ${Math.round((1 - left / vis) * 100)}%` };
  return { done: false, label: '还没整理' };
}
function summarySections(text) {
  const out = []; let curSec = null;
  String(text || '').split('\n').forEach(line => {
    const h = line.match(/^\s*#{1,3}\s*(.+?)\s*$/);
    if (h) { curSec = { title: h[1], lines: [] }; out.push(curSec); return; }
    if (!line.trim()) return;
    if (!curSec) { curSec = { title: '', lines: [] }; out.push(curSec); }
    curSec.lines.push(line.trim());
  });
  return out.filter(x => x.lines.length);
}
let profBusy = null;
const memAsk = { draft: '', reply: '', busy: false };
function openMemoryPage() {
  memAsk.reply = '';
  const pg = page('记忆', body => {
    const pend = pendingConvs();
    const ai = S.aiName || 'TA';
    // 进度：还有对话没整理
    if (S.memoryOn && pend.length) body.append(el('button', { class: 'mem-banner', onclick: openWakePage },
      el('div', {}, el('b', {}, `还有 ${pend.length} 段对话没整理`), el('small', {}, `整理后${ai}会记得里面的事`)), el('span', { class: 'go' }, '继续整理')));
    else if (S.memoryOn && !memories.length && convs.length) body.append(el('button', { class: 'mem-banner', onclick: openWakePage },
      el('div', {}, el('b', {}, `让${ai}读一遍你们的聊天`), el('small', {}, '整理出记忆摘要，以后每次聊天都会记得')), el('span', { class: 'go' }, '开始')));

    // 记忆摘要
    const card = el('div', { class: 'mem-sum' });
    const secs = summarySections(profile.text);
    if (profBusy) card.append(el('div', { class: 'mem-empty' }, `${ai}正在整理记忆…`));
    else if (secs.length) {
      card.append(el('div', { class: 'mem-sum-head' }, `${ai}记得的你`, profile.ts ? el('small', {}, `${Mem.agoText(profile.ts).replace(/ \d.*$/, '')}更新`) : null));
      secs.forEach(x => card.append(el('div', { class: 'mem-sec' }, x.title ? el('div', { class: 'mem-sec-t' }, x.title) : null, el('div', { class: 'mem-sec-b' }, x.lines.map(l => el('div', {}, l))))));
    } else card.append(el('div', { class: 'mem-empty' }, memories.length ? '记忆摘要还没生成' : `${ai}还不太了解你。多聊聊天，或者直接在下面告诉${ai}。`));
    body.append(card);
    if (!secs.length && memories.length && !profBusy && S.apiKey) rebuildSummary(pg);

    // 一句话告诉 TA（状态放在页面外，摘要刷新时不丢）
    const ta = el('textarea', { rows: 2, placeholder: `告诉${ai}要记住、修改或忘掉的事` });
    ta.value = memAsk.draft; ta.oninput = () => { memAsk.draft = ta.value; };
    const go = el('button', { class: 'mem-send' + (memAsk.busy ? ' busy' : ''), html: I.send });
    go.disabled = memAsk.busy;
    go.onclick = async () => {
      const v = ta.value.trim(); if (!v) return ta.focus();
      if (!await ensureKey()) return;
      memAsk.busy = true; memAsk.reply = '…'; pg._refresh();
      try {
        const r = await Brain.editMemory(S, memories, v);
        memories = r.memories; await saveMem();
        if (r.forget.length) {
          // 往事和旧聊天片段里相关的内容也不再想起
          episodes = episodes.filter(e => !r.forget.some(w => (e.title + e.summary).includes(w))); await saveEpisodes();
          S.forgetWords = [...new Set([...(S.forgetWords || []), ...r.forget])].slice(-50); saveSettings();
        }
        memAsk.reply = r.reply || '好，记下了。'; memAsk.draft = '';
        await rebuildSummary(pg, true);
      } catch (e) { memAsk.reply = '没改成：' + e.message; }
      memAsk.busy = false; pg.isConnected && pg._refresh();
    };
    const tips = ['记住我的生日是 ', '别再提 ', '我最近 ', '忘掉关于 '];
    body.append(el('div', { class: 'mem-ask' }, el('div', { class: 'mem-ask-box' }, ta, go),
      el('div', { class: 'mem-tips' }, tips.map(t => el('button', { onclick: () => { ta.value = memAsk.draft = t; ta.focus(); } }, t.trim() + '…')))),
      memAsk.reply ? el('div', { class: 'mem-reply' }, memAsk.reply) : null);

    body.append(
      el('div', { class: 'group', style: 'margin-top:16px' },
        row(I.layers, '往事回忆', `${episodes.length} 段`, openEpisodesPage, { sub: '你们一起经历过的事' }),
        row(I.data, '整理聊天记录', pend.length ? `${pend.length} 段待整理` : '都整理好了', openWakePage)),
      secTitle('设置'),
      el('div', { class: 'group' },
        switchRow('启用记忆', null, () => S.memoryOn, v => { S.memoryOn = v; saveSettings(); }),
        switchRow('聊天时自动记住', '聊几句就自动记下值得记住的事', () => S.autoMemory, v => { S.autoMemory = v; saveSettings(); }),
        switchRow('想起以前聊过的事', '聊到相关话题时自动想起来（在手机上检索，不额外花钱）', () => S.recallOn !== false, v => { S.recallOn = v; saveSettings(); })),
      memories.length || episodes.length ? el('button', { class: 'btn ghost', style: 'color:var(--danger)', onclick: async () => { if (await dialog({ title: '清空全部记忆？', text: `${ai}会忘掉记住的所有事和往事回忆`, ok: '清空', danger: true })) { memories = []; episodes = []; profile = { text: '', ts: 0 }; convs.forEach(c => { c.memCursor = 0; }); await DB.putConvs(convs); saveMem(); saveEpisodes(); saveProfile(); pg._refresh(); } } }, '清空全部记忆') : null);
  });
}
async function rebuildSummary(pg, force) {
  if (profBusy) { await profBusy; if (!force) return; }
  profBusy = (async () => {
    pg && pg._refresh();
    try { if (memories.length > 150) { memories = (await Brain.consolidate(S, memories)).memories; await saveMem(); } await refreshProfile(); }
    catch (e) { if (force) toast('摘要更新失败：' + e.message); }
  })();
  await profBusy; profBusy = null;
  pg && pg.isConnected && pg._refresh();
}
function openEpisodesPage() {
  const pg = page('往事回忆', body => {
    body.append(el('div', { class: 'note' }, '每段对话都会被记成一小段往事。聊到相关的话题时，TA 会自然地想起来。'), el('div', { style: 'height:10px' }));
    const g = el('div', { class: 'group' });
    if (!episodes.length) g.append(el('div', { class: 'empty-list' }, '还没有往事。聊一会儿，或者整理一下聊天记录。'));
    episodes.slice().sort((a, b) => b.ts - a.ts).slice(0, 400).forEach(e => g.append(el('div', { class: 'mem-item' },
      el('div', { class: 'tx', html: `<b>${esc(e.title)}</b>${e.dateKnown === false ? '' : `<span style="color:var(--fg3);font-size:12px"> · ${Mem.fmtDate(e.ts)}</span>`}<br><span style="color:var(--fg2);font-size:14px">${esc(e.summary)}</span>` }),
      el('button', { class: 'del', html: I.trash, onclick: () => { episodes = episodes.filter(x => x !== e); saveEpisodes(); pg._refresh(); } }))));
    body.append(g);
  });
}
/* 整理聊天记录：每段对话的进度一目了然，选中继续 */
function openWakePage() {
  const sel = new Set(convs.filter(c => !convMemState(c).done).map(c => c.id));
  page('整理聊天记录', (body, pg) => {
    const list = convs.filter(c => c.messages.some(m => m.content && !m.hidden)).sort((a, b) => (b.source === 'imported') - (a.source === 'imported') || b.updatedAt - a.updatedAt);
    const doneN = list.filter(c => convMemState(c).done).length;
    body.append(
      el('div', { class: 'wake-head' },
        el('div', { class: 'wake-num' }, `${doneN}`, el('small', {}, ` / ${list.length}`)),
        el('div', {}, el('b', {}, '段对话已整理'), el('small', {}, '整理过的部分不会重复花钱，中途退出下次接着来'))),
      el('div', { class: 'progress', style: 'margin:0 4px 14px' }, el('div', { style: `width:${list.length ? doneN / list.length * 100 : 0}%` })));
    const g = el('div', { class: 'group' });
    if (!list.length) g.append(el('div', { class: 'empty-list' }, '还没有聊天记录'));
    list.forEach(c => {
      const st = convMemState(c);
      const cb = el('input', { type: 'checkbox' }); cb.checked = sel.has(c.id);
      cb.onchange = () => { cb.checked ? sel.add(c.id) : sel.delete(c.id); btn.textContent = label(); };
      g.append(el('label', { class: 'wake-row' }, cb,
        el('div', { class: 'lbl' }, el('div', { class: 'wt' }, c.title), el('small', {}, `${c.messages.filter(m => m.content && !m.hidden).length} 条${c.source === 'imported' ? ' · 导入' : ''}`)),
        el('span', { class: 'wake-st' + (st.done ? ' ok' : '') }, st.label)));
    });
    const label = () => sel.size ? `整理选中的 ${sel.size} 段` : '先选择要整理的对话';
    const btn = el('button', { class: 'btn', onclick: () => { const pick = convs.filter(c => sel.has(c.id)); if (!pick.length) return toast('先勾选要整理的对话'); wakeFlow(pick); } }, label());
    body.append(g, el('div', { class: 'sticky-act' }, btn));
  });
}

/* 唤醒记忆：批量消化对话 → 长期记忆 + 往事 + 关系档案（+ 还原人设） */
function wakeFlow(list) {
  list = list.filter(c => c.messages.some(m => m.content));
  if (!list.length) return toast('还没有可以整理的对话');
  const todo = list.map(c => ({ c, msgs: c.messages.slice(c.memCursor || 0).filter(m => m.content && !m.hidden) })).filter(x => x.msgs.length);
  const all = todo.length ? todo : list.map(c => ({ c, msgs: c.messages.filter(m => m.content && !m.hidden) }));
  const tokens = all.reduce((s, x) => s + x.msgs.reduce((a, m) => a + Brain.msgTokens(m), 0), 0);
  const yuan = Math.max(0.01, tokens * 1.6 / 1e6);
  let optMem = true, optPersona = !S.persona && list.some(c => c.source === 'imported');
  const cb = (get, set, label, sub) => { const i = el('input', { type: 'checkbox' }); i.checked = get(); i.onchange = () => set(i.checked); return el('label', { class: 'imp-item', style: 'padding:10px 0;border:0' }, i, el('div', { class: 'lbl' }, el('div', {}, label), el('small', {}, sub))); };
  const box = el('div', { class: 'dialog' },
    el('h3', {}, '整理聊天记录'),
    el('p', { html: `读一遍 ${all.length} 段对话（约 ${fmtK(tokens)} tokens），预计花费约 <b>¥${yuan.toFixed(2)}</b>。` }),
    cb(() => optMem, v => optMem = v, '记住你们的事', '整理成记忆摘要和往事回忆'),
    cb(() => optPersona, v => optPersona = v, '还原 TA 的说话方式', '分析 TA 原来的语气和人设'),
    el('p', { style: 'font-size:12px;margin-top:6px' }, '过程中请保持 App 在前台；中途退出下次可以接着整理。'),
    el('div', { class: 'acts' }, el('button', { onclick: () => closeLayer(entry) }, '取消'), el('button', { class: 'primary', onclick: () => { closeLayer(entry); runWake(all, { mem: optMem, persona: optPersona, list }); } }, '开始')));
  const entry = pushLayer(box);
}
async function runWake(jobs, { mem, persona, list }) {
  if (!await ensureKey()) return;
  const ctrl = new AbortController();
  const bar = el('div', { class: 'progress' }, el('div'));
  const txt = el('p', {}, '准备中…');
  const box = el('div', { class: 'dialog' }, el('h3', {}, '正在回忆你们的过去…'), txt, bar, el('div', { class: 'acts' }, el('button', { onclick: () => ctrl.abort() }, '停止')));
  const entry = pushLayer(box);
  const t0 = memories.length, e0 = episodes.length;
  let fatal = null, failed = 0;
  try {
    if (mem) {
      const tasks = jobs.map(x => ({ c: x.c, chunks: Brain.chunkMsgs(x.msgs, 12000) }));
      const total = tasks.reduce((a, t) => a + t.chunks.length, 0) || 1;
      let done = 0;
      const tick = () => { txt.textContent = `已回忆 ${done}/${total} 段 · 新增 ${memories.length - t0} 条记忆、${episodes.length - e0} 段往事`; bar.firstChild.style.width = (done / total * 100) + '%'; };
      tick();
      const queue = tasks.slice();
      const worker = async () => {
        while (queue.length && !ctrl.signal.aborted && !fatal) {
          const t = queue.shift();
          for (const ch of t.chunks) {
            if (ctrl.signal.aborted || fatal) return;
            let ok = false;
            for (let tryN = 0; tryN < 2 && !ok; tryN++) {
              try { await digestSlice(t.c, ch, ctrl.signal); ok = true; }
              catch (e) { if (ctrl.signal.aborted) return; if (/Key|余额/.test(e.message)) { fatal = e; return; } }
            }
            if (!ok) failed++;
            t.c.memCursor = t.c.messages.indexOf(ch[ch.length - 1]) + 1;
            await DB.putConv(t.c); await saveMem(); await saveEpisodes();
            done++; tick();
          }
        }
      };
      await Promise.all([worker(), worker(), worker()]);
      if (fatal) throw fatal;
      if (!ctrl.signal.aborted) {
        if (memories.length > 120) { txt.textContent = '正在合并重复的记忆…'; memories = (await Brain.consolidate(S, memories, { signal: ctrl.signal })).memories; await saveMem(); }
        txt.textContent = '正在写记忆摘要…';
        await refreshProfile(ctrl.signal);
      }
    }
    closeLayer(entry);
    if (!ctrl.signal.aborted) {
      const wp = pages.find(x => x.querySelector('.wake-head'));
      if (wp) closePage(wp);
      toast(mem ? `完成：新增 ${memories.length - t0} 条记忆、${episodes.length - e0} 段往事${failed ? `（${failed} 段失败，可再唤醒一次）` : ''}` : '完成', 3500);
      if (persona) await restorePersonaFlow(list);
    } else toast('已停止，下次可以接着整理');
  } catch (e) {
    closeLayer(entry);
    toast('出错了：' + e.message, 3500);
  }
  saveSettings();
  pages.forEach(x => x._refresh());
  renderWelcome();
}

/* 上下文与压缩 */
function openContextPage() {
  page('上下文与智能压缩', body => {
    const tk = cur ? Brain.liveTokens(cur) : 0;
    const thr = el('select');
    [[32000, '32k（省钱）'], [64000, '64k（推荐）'], [128000, '128k'], [256000, '256k'], [512000, '512k（最完整，较贵）']].forEach(([v, l]) => thr.append(el('option', { value: v }, l)));
    thr.value = S.compactAt; thr.onchange = () => { S.compactAt = Number(thr.value); saveSettings(); };
    body.append(
      el('div', { class: 'note', html: '对话太长时，App 会把<b>较早的</b>聊天整理成一份「回顾」（保留称呼、语气、约定、重要的事），最近的消息原样保留。这样 TA 不会忘记前面的内容，也能省下大量费用、回复更快。' }),
      el('div', { style: 'height:10px' }),
      el('div', { class: 'group' },
        switchRow('自动智能压缩', null, () => S.autoCompact, v => { S.autoCompact = v; saveSettings(); }),
        field('超过多少 tokens 时整理', thr),
        field('始终原样保留最近的消息条数', bindInput('number', 'keepRecent', { placeholder: '16' }))),
      secTitle('当前对话'),
      el('div', { class: 'group' },
        row(null, '当前上下文长度', cur ? `约 ${fmtK(tk)} tokens` : '无', null),
        cur ? row(null, '查看 / 编辑回顾', cur.summary ? '已有' : '暂无', () => openSummaryPage(cur)) : null,
        cur ? row(null, '立即压缩当前对话', null, () => compactNow(cur)) : null),
    );
  });
}
async function compactNow(conv) {
  if (!await ensureKey()) return;
  if (busy) return toast('请等待回复完成');
  const box = el('div', { class: 'dialog' }, el('h3', {}, '正在整理对话…'), el('p', {}, '请稍候'));
  const entry = pushLayer(box);
  try {
    const ok = await Brain.compact(S, conv, { force: true, onProgress: (i, n) => { box.querySelector('p').textContent = `第 ${i + 1}/${n} 部分`; } });
    await DB.putConv(conv);
    toast(ok ? '整理完成' : '内容还很短，不需要整理');
  } catch (e) { toast('失败：' + e.message, 3000); }
  closeLayer(entry);
  if (cur === conv) renderMessages();
  const top = pages[pages.length - 1]; top && top._refresh();
}
function openSummaryPage(conv) {
  page('上下文回顾', body => {
    const ta = el('textarea', { style: 'min-height:50vh' }); ta.value = conv.summary || '';
    ta.onchange = async () => { conv.summary = ta.value; if (!conv.summary.trim()) { conv.summary = ''; conv.summarizedUpto = 0; } await DB.putConv(conv); toast('已保存'); };
    body.append(
      el('div', { class: 'note', html: conv.summary ? `较早的 ${conv.summarizedUpto} 条消息已整理成下面的回顾，TA 会以此记得前面的内容。你可以直接修改它。` : '这段对话还没有被压缩过。' }),
      el('div', { style: 'height:10px' }),
      el('div', { class: 'group' }, el('div', { class: 'field' }, ta)));
    if (conv.background) {
      const bg = el('textarea', { style: 'min-height:30vh' }); bg.value = conv.background;
      bg.onchange = async () => { conv.background = bg.value; await DB.putConv(conv); toast('已保存'); };
      body.append(secTitle('附带的聊天记录（未整理）'), el('div', { class: 'group' }, el('div', { class: 'field' }, bg)));
    }
    body.append(el('button', { class: 'btn', onclick: () => compactNow(conv) }, '重新整理 / 立即压缩'));
  });
}

/* 语音 */
async function openVoicePage() {
  let voices = [];
  if (P.TextToSpeech) { try { voices = (await P.TextToSpeech.getSupportedVoices()).voices.map((v, i) => ({ id: String(i), name: v.name, lang: v.lang })); } catch (e) {} }
  else if ('speechSynthesis' in window) voices = speechSynthesis.getVoices().map(v => ({ id: v.name, name: v.name, lang: v.lang }));
  voices = voices.filter(v => /zh|cmn|yue/i.test(v.lang || '')).concat(voices.filter(v => !/zh|cmn|yue/i.test(v.lang || '')));
  page('朗读音色', body => {
    const sel = el('select'); sel.append(el('option', { value: '' }, '系统默认'));
    voices.forEach(v => sel.append(el('option', { value: v.id }, `${v.name}（${v.lang}）`)));
    sel.value = S.ttsVoice; sel.onchange = () => { S.ttsVoice = sel.value; saveSettings(); };
    body.append(el('div', { style: 'height:12px' }), el('div', { class: 'group' },
      field('音色', sel),
      field('语速', seg([[0.8, '慢'], [1, '正常'], [1.2, '快'], [1.5, '很快']], () => Number(S.ttsRate), v => { S.ttsRate = v; saveSettings(); })),
      switchRow('自动朗读回复', '也可以点主界面右上角的喇叭开关', () => S.ttsAuto, v => { S.ttsAuto = v; saveSettings(); renderHeader(); })),
      el('button', { class: 'btn', onclick: () => speak('你好呀，今天过得怎么样？我一直在这里等你。', true) }, '试听'),
      el('div', { class: 'note' }, '音色来自手机系统的语音引擎，可以在手机「设置 → 无障碍 → 文字转语音」里下载更多中文音色。'));
  });
}

function openHelpPage() {
  page('使用说明', body => {
    body.append(el('div', { class: 'group summary-box', html: `
<b>1. 接入 API</b>
设置 → API 接入，粘贴从 platform.deepseek.com 获取的 Key，点「一键接入」。

<b>2. 找回原来的聊天记录</b>
设置 → 数据管理 → 导入聊天记录。导入的对话可以直接点开<b>继续聊</b>，TA 会带着完整的上下文回复你。

<b>3. 让 TA 记得你</b>
导入时勾选「提取长期记忆」，或到 设置 → 长期记忆 → 从全部对话中整理记忆。之后无论开多少个新对话，TA 都记得你们之间的事。

<b>4. 很长的对话</b>
超过设定长度后，App 会自动把早期内容整理成「回顾」，最近的消息原样保留。回顾可以在对话列表 ··· 菜单里查看和修改。

<b>5. 人设</b>
设置 → 个性化，可以写下 TA 的名字、性格、你们的关系，让 TA 一直是原来的样子。

<b>6. 数据安全</b>
所有聊天、记忆和 Key 只存在你手机本地，只会发送给你填写的 API 地址。记得定期在「数据管理」里导出备份。` }));
  });
}

/* ---------------- 数据管理 / 导入 ---------------- */
function openDataPage() {
  page('数据管理', body => {
    const total = convs.reduce((s, c) => s + c.messages.length, 0);
    body.append(
      secTitle('导入'),
      el('div', { class: 'group' },
        row(null, '导入原来的聊天记录', '推荐', openImportPage, { sub: '一键导出 DeepSeek 全部对话，或选择导出文件' }),
        row(null, '粘贴聊天文本', null, pasteImport, { sub: '从别处复制的聊天内容，作为新对话的背景' })),
      secTitle('备份'),
      el('div', { class: 'group' },
        row(null, '导出全部数据', null, exportBackup, { sub: `${convs.length} 段对话 · ${total} 条消息 · ${memories.length} 条记忆` }),
        row(null, '从备份恢复', null, () => $('#pickBackup').click())),
      secTitle('危险操作'),
      el('div', { class: 'group' }, row(null, '删除全部对话', null, clearAllConvs, { danger: true, noChev: true })),
    );
  });
}

/* 导入入口：按门槛从低到高排列 */
function openImportPage() {
  page('导入原来的聊天记录', body => {
    const opt = (icon, title, sub, badge, onclick) => el('button', { class: 'imp-opt', onclick },
      el('div', { class: 'imp-ico', html: icon }),
      el('div', { class: 'lbl' }, el('div', { class: 'imp-t' }, title, badge ? el('span', { class: 'badge' }, badge) : null), el('div', { class: 'imp-s', html: sub })),
      el('span', { html: I.chev }));
    body.append(el('div', { class: 'note' }, '导入后的对话可以直接点开接着聊，TA 还会记住你们的事、找回原来的说话方式。'), el('div', { style: 'height:12px' }));
    if (DSI) {
      body.append(opt(I.globe, '登录网页版，一键导出', '在鲸语里登录原来的 DeepSeek 账号，点「导出所有历史对话」，<b>全部对话</b>会自动导进来', '推荐', webExportFlow));
    } else {
      body.append(opt(I.globe, '用浏览器导出全部对话', '打开 chat.deepseek.com 登录 → 设置 → 数据管理 → 导出所有历史对话，再回来选择下载的 zip', '推荐', () => {
        window.open('https://chat.deepseek.com/', '_blank');
        setTimeout(() => toast('下载好 zip 后，回来点「我已经有导出文件」'), 800);
      }));
    }
    body.append(
      opt(I.data, '我已经有导出文件', '选择 deepseek_data-xxx.zip（也支持 json、ChatGPT 导出、鲸语备份）', null, () => $('#pickImport').click()),
      DSI ? opt(I.layers, '从 DeepSeek App 逐段导入', '网页版登录不上时用：自动翻阅 App 里的对话。需要开启一次系统权限', null, openDsImportPage) : null,
      opt(I.copy.replace(/18/g, '24'), '粘贴聊天文本', '把复制来的聊天内容贴进来，作为新对话的背景', null, pasteImport));
  });
}

async function webExportFlow() {
  try {
    const r = await DSI.openWebExport();
    if (!r || r.cancelled || !r.path) return;
    toast('正在读取导出文件…', 8000);
    const resp = await fetch(Cap.convertFileSrc(r.path));
    const blob = await resp.blob();
    const name = /\.(zip|json)$/i.test(r.name) ? r.name : (r.name || 'deepseek_data') + '.zip';
    const parsed = await Importer.parseFile(new File([blob], name, { type: blob.type || 'application/zip' }));
    DSI.deleteFile({ path: r.path }).catch(() => {});
    toast('读取完成', 600);
    if (parsed.backup) return restoreBackup(parsed.backup);
    if (!parsed.convs || !parsed.convs.length) return toast('导出文件里没有找到对话', 3000);
    previewImport(parsed.convs);
  } catch (e) { toast('导入失败：' + e.message, 3500); }
}

$('#pickImport').onchange = async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  toast('正在读取…', 10000);
  try {
    const r = await Importer.parseFile(f);
    toast('读取完成', 600);
    if (r.backup) return restoreBackup(r.backup);
    if (r.background) return importBackground(r.background, f.name.replace(/\.\w+$/, ''));
    if (!r.convs.length) return toast('文件里没有找到对话');
    previewImport(r.convs);
  } catch (err) { toast('读取失败：' + err.message, 3500); }
};

function previewImport(list) {
  list.sort((a, b) => b.updatedAt - a.updatedAt);
  const existing = new Set(convs.map(c => c.origId).filter(Boolean));
  const picked = new Set(list.map((c, i) => i).filter(i => !existing.has(list[i].origId)));
  let doMem = true;
  let pq = '';
  const pg = page(`选择要导入的对话`, body => {
    const all = el('input', { type: 'checkbox' }); all.checked = picked.size === list.length;
    all.onchange = () => { list.forEach((c, i) => all.checked ? picked.add(i) : picked.delete(i)); pg._refresh(); };
    const g = el('div', { class: 'group' });
    list.forEach((c, i) => {
      if (pq && !c.title.toLowerCase().includes(pq)) return;
      const cb = el('input', { type: 'checkbox' }); cb.checked = picked.has(i);
      cb.onchange = () => { cb.checked ? picked.add(i) : picked.delete(i); btn.textContent = `导入 ${picked.size} 段对话`; };
      const d = new Date(c.updatedAt);
      g.append(el('label', { class: 'imp-item' }, cb, el('div', { class: 'lbl' }, el('div', {}, c.title),
        el('small', {}, `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} · ${c.messages.length} 条消息${existing.has(c.origId) ? ' · 已导入过' : ''}`))));
    });
    const btn = el('button', { class: 'btn' }, `导入 ${picked.size} 段对话`);
    btn.onclick = async () => {
      const chosen = list.filter((c, i) => picked.has(i));
      if (!chosen.length) return toast('请至少选择一段');
      const made = chosen.map(c => ({ id: uid(), title: c.title, createdAt: c.createdAt, updatedAt: c.updatedAt, messages: c.messages, summary: '', summarizedUpto: 0, memCursor: 0, source: 'imported', origId: c.origId }));
      await DB.putConvs(made); convs = convs.concat(made);
      closePage(pg); toast(`已导入 ${made.length} 段对话`, 2500);
      renderList(); renderWelcome();
      if (doMem && S.apiKey) wakeFlow(made);
      else if (doMem) toast('设置好 API Key 后，可在「长期记忆」里唤醒记忆', 3500);
    };
    body.append(
      el('div', { style: 'height:8px' }),
      el('div', { class: 'group' },
        el('label', { class: 'row' }, el('span', { class: 'lbl' }, `全选（共 ${list.length} 段）`), all),
        switchRow('导入后唤醒记忆', '让 TA 记得你们的过去，并还原 TA 原来的说话方式', () => doMem, v => { doMem = v; })),
      btn, el('div', { style: 'height:14px' }),
      list.length > 12 ? (() => { const q = el('input', { type: 'search', placeholder: `在 ${list.length} 段对话中搜索标题…`, style: 'width:100%;border:0;outline:none;background:var(--group);border-radius:14px;height:44px;padding:0 16px;font-size:15px;margin-bottom:10px;color:var(--fg)' }); q.value = pq; q.oninput = () => { pq = q.value.trim().toLowerCase(); const st = document.activeElement === q; pg._refresh(); if (st) { const n = pg.querySelector('input[type=search]'); n && (n.focus(), n.setSelectionRange(n.value.length, n.value.length)); } }; return q; })() : null,
      g);
  });
}

async function pasteImport() {
  const v = await dialog({ title: '粘贴聊天文本', textarea: true, placeholder: '粘贴之前的聊天内容。\n如果是「我：… / TA：…」这样的格式，会被识别为对话。', ok: '导入' });
  if (!v || !v.trim()) return;
  const r = Importer.parseText(v, '粘贴的对话');
  if (r.convs) {
    const c = r.convs[0];
    const conv = { id: uid(), title: c.title, createdAt: c.createdAt, updatedAt: c.updatedAt, messages: c.messages, summary: '', summarizedUpto: 0, memCursor: 0, source: 'imported' };
    await DB.putConv(conv); convs.push(conv);
    toast(`识别到 ${c.messages.length} 条消息，已导入`);
    closePage(); closePage(); openConv(conv.id);
  } else importBackground(r.background, '延续之前的聊天');
}
async function importBackground(text, title) {
  const conv = { id: uid(), title: title || '延续之前的聊天', createdAt: Date.now(), updatedAt: Date.now(), messages: [], background: text, summary: '', summarizedUpto: 0, memCursor: 0, source: 'local' };
  await DB.putConv(conv); convs.push(conv);
  while (pages.length) closePage();
  openConv(conv.id);
  toast('已作为这段新对话的背景，直接开始聊吧', 3000);
}

async function exportBackup() {
  const data = { app: 'whalechat', version: 2, exportedAt: Date.now(), settings: { ...S, apiKey: '' }, memories, episodes, profile, convs };
  const json = JSON.stringify(data);
  const d = new Date();
  const name = `鲸语备份-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;
  if (isNative && P.Filesystem && P.Share) {
    try {
      const w = await P.Filesystem.writeFile({ path: name, data: json, directory: 'CACHE', encoding: 'utf8' });
      await P.Share.share({ title: name, url: w.uri, dialogTitle: '保存备份' });
    } catch (e) { if (!/cancel/i.test(e.message)) toast('导出失败：' + e.message); }
    return;
  }
  const a = el('a', { href: URL.createObjectURL(new Blob([json], { type: 'application/json' })), download: name });
  document.body.append(a); a.click(); a.remove();
  toast('备份已下载（不含 API Key）');
}
$('#pickBackup').onchange = async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try { const d = JSON.parse(await f.text()); if (d.app !== 'whalechat') throw new Error('不是鲸语的备份文件'); restoreBackup(d); }
  catch (err) { toast('恢复失败：' + err.message); }
};
async function restoreBackup(d) {
  if (!await dialog({ title: '从备份恢复', text: `备份包含 ${d.convs.length} 段对话、${(d.memories || []).length} 条记忆。<br>将与现有数据合并（相同对话会被覆盖）。`, ok: '恢复' })) return;
  await DB.putConvs(d.convs);
  const ids = new Set(d.convs.map(c => c.id));
  convs = convs.filter(c => !ids.has(c.id)).concat(d.convs);
  const known = new Set(memories.map(m => m.text));
  memories = memories.concat((d.memories || []).filter(m => !known.has(m.text)).map(Mem.normalize)); await saveMem();
  if (d.episodes) { const ids = new Set(episodes.map(e => e.id)); episodes = episodes.concat(d.episodes.filter(e => !ids.has(e.id))); await saveEpisodes(); }
  if (d.profile && d.profile.text && !profile.text) { profile = d.profile; await saveProfile(); }
  const key = S.apiKey;
  if (d.settings) { S = { ...DEFAULTS, ...d.settings, apiKey: key || d.settings.apiKey || '' }; saveSettings(); applyTheme(); renderChips(); renderSideFoot(); }
  toast('恢复完成'); renderList(); renderWelcome();
  const top = pages[pages.length - 1]; top && top._refresh();
}


/* ---------------- 从 DeepSeek App 导入（安卓） ---------------- */
function openDsImportPage() {
  const pg = page('从 DeepSeek App 导入', body => {
    const stepRow = (n, title, sub, right) => el('div', { class: 'row static', style: 'align-items:flex-start;padding-top:14px;padding-bottom:14px' },
      el('span', { class: 'step-n' }, String(n)),
      el('span', { class: 'lbl', html: `${esc(title)}<small>${sub}</small>` }), right || null);
    const statusBox = el('span', { class: 'val' }, '检查中…');
    const mainBtn = el('button', { class: 'btn' }, '开始导入');
    const warn = el('div', { class: 'note hidden' });
    body.append(
      el('div', { class: 'note', html: '不需要电脑，也不需要网页。鲸语会借助系统的「无障碍」功能，自动翻阅 DeepSeek App 里的对话并保存下来，导入后可以直接接着聊。' }),
      el('div', { style: 'height:10px' }),
      el('div', { class: 'group' },
        stepRow(1, '开启「鲸语导出助手」', '只需要开一次，在系统设置里找到它并打开', statusBox),
        stepRow(2, '打开想导入的对话', '点下面的按钮会自动跳到 DeepSeek，进入你想搬过来的那段对话'),
        stepRow(3, '点悬浮面板上的「导出这段对话」', '助手会自动滑动、逐屏读取。<b>期间请不要触碰屏幕</b>，很长的对话可能需要几分钟'),
        stepRow(4, '点「回到鲸语」', '对话会自动出现在列表里。想导多段就点「再导一段」')),
      mainBtn, warn,
      secTitle('开关是灰色的、打不开？'),
      el('div', { class: 'group' },
        el('div', { class: 'summary-box', style: 'font-size:14px', html: '这是安卓对「不是从应用商店安装的 App」的保护。请先打开鲸语的 <b>应用信息</b> → 右上角 <b>⋮</b> → <b>允许受限制的设置</b>，再回来开启。<br>小米、华为、OPPO、vivo 等手机如果在列表里找不到，可以在 设置 → 无障碍 → <b>已下载的应用 / 已安装的服务</b> 里找「鲸语导出助手」。' }),
        row(null, '打开鲸语的应用信息', null, () => DSI.openAppDetails())),
      el('div', { class: 'note', html: '🔒 导出助手<b>只读取 DeepSeek App</b> 的聊天内容，只在你点「导出」时工作，读到的内容只保存在这台手机上，不会上传。全部导入完以后，可以在系统设置里把它关掉。' }),
      el('div', { class: 'note', html: '目前只能读到文字：图片、发送时间和重新生成过的其他版本无法导出。' }),
    );
    DSI.status().then(st => {
      statusBox.textContent = st.serviceEnabled ? '✓ 已开启' : '未开启';
      statusBox.style.color = st.serviceEnabled ? 'var(--blue-text)' : '';
      if (!st.deepseekInstalled) { warn.classList.remove('hidden'); warn.textContent = '⚠️ 没有在这台手机上找到 DeepSeek App。'; }
      mainBtn.textContent = st.serviceEnabled ? '开始导入' : '第 1 步：去开启导出助手';
      mainBtn.onclick = async () => {
        if (!st.serviceEnabled) {
          const ok = await dialog({ title: '开启导出助手', text: '接下来会打开系统的无障碍设置。<br>请找到 <b>鲸语导出助手</b>，打开开关并确认。<br><br>如果开关是灰色的，请看本页下方的说明。', ok: '去开启' });
          if (ok) DSI.openAccessibilitySettings().catch(() => toast('请手动打开 设置 → 无障碍'));
          return;
        }
        if (!st.deepseekInstalled) return toast('没有找到 DeepSeek App');
        try { await DSI.start(); } catch (e) { toast(e.message === 'DEEPSEEK_NOT_INSTALLED' ? '没有找到 DeepSeek App' : '启动失败：' + e.message); }
      };
    }).catch(e => { statusBox.textContent = '不可用'; warn.classList.remove('hidden'); warn.textContent = '当前版本不支持：' + e.message; });
  });
  pg._dsPage = true;
}

let dsImporting = false;
async function checkDsPending() {
  if (!DSI || dsImporting) return;
  dsImporting = true;
  try {
    const { items } = await DSI.getPending();
    if (!items || !items.length) return;
    const made = [];
    for (const it of items) {
      const msgs = [];
      for (const t of it.turns || []) {
        const role = t.role === 'user' ? 'user' : 'assistant';
        const last = msgs[msgs.length - 1];
        if (last && last.role === role) { last.content += '\n\n' + (t.content || ''); if (t.reasoning) last.reasoning = (last.reasoning ? last.reasoning + '\n' : '') + t.reasoning; continue; }
        msgs.push({ id: uid(), role, content: t.content || '', reasoning: t.reasoning || undefined, thinkSecs: t.thinkSecs ? Math.round(t.thinkSecs) : undefined, ts: it.exportedAt, imported: true });
      }
      if (!msgs.length) continue;
      made.push({ id: uid(), title: it.title || 'DeepSeek 对话', createdAt: it.exportedAt, updatedAt: it.exportedAt, messages: msgs, summary: '', summarizedUpto: 0, memCursor: 0, source: 'imported', origin: 'deepseek-app' });
    }
    if (made.length) { await DB.putConvs(made); convs = convs.concat(made); }
    await DSI.clearPending({ ids: items.map(i => i.id) });
    if (!made.length) return;
    while (pages.length) closePage();
    while (stack.length) closeLayer();
    openConv(made[made.length - 1].id);
    renderList();
    const n = made.reduce((a, c) => a + c.messages.length, 0);
    const want = await dialog({
      title: made.length > 1 ? `已导入 ${made.length} 段对话` : '导入成功',
      text: `${made.length > 1 ? '' : `「${esc(made[0].title)}」<br>`}共 ${n} 条消息，可以直接接着聊了。<br><br>要不要「唤醒记忆」？TA 会记住你们的事，并找回原来的说话方式。`,
      ok: '唤醒记忆', cancel: '以后再说',
    });
    if (want) wakeFlow(made);
  } catch (e) { toast('导入失败：' + e.message, 3500); }
  finally { dsImporting = false; }
}
if (DSI) {
  DSI.addListener('exported', () => { if (!document.hidden) checkDsPending(); });
  if (P.App) P.App.addListener('resume', () => {
    checkDsPending();
    const top = pages[pages.length - 1]; if (top && top._dsPage) top._refresh();
  });
}

/* ---------------- 首次使用引导 ---------------- */
function openOnboarding() {
  const keyIn = el('input', { type: 'text', placeholder: '粘贴 API Key（sk-...）', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
  keyIn.value = S.apiKey || '';
  const st = el('p', { style: 'min-height:1.6em;margin:8px 0 0' });
  const go = el('button', { class: 'primary' }, '一键接入');
  const box = el('div', { class: 'dialog' },
    el('div', { style: 'display:grid;place-items:center;margin-bottom:6px', html: I.logo(52) }),
    el('h3', {}, '接入 DeepSeek'),
    el('p', { html: '在 <a href="https://platform.deepseek.com/api_keys" target="_blank" style="color:var(--blue-text)">platform.deepseek.com</a> 创建 API Key，复制后粘贴到这里。<br>Key 只保存在你的手机上。' }),
    keyIn, st,
    el('div', { class: 'acts' }, el('button', { onclick: () => closeLayer(entry) }, '稍后'), go),
    el('button', { style: 'display:block;margin:14px auto 0;color:var(--blue-text);font-size:14px', onclick: () => { closeLayer(entry); openSettings(); openImportPage(); } }, '我想先导入原来的聊天记录 →'));
  go.onclick = async () => {
    const k = keyIn.value.trim();
    if (!k) return toast('请先粘贴 API Key');
    go.disabled = true; st.textContent = '正在连接…';
    try {
      S.apiKey = k;
      const b = await Brain.balance(S);
      S.onboarded = true; saveSettings();
      const info = (b.balance_infos || [])[0];
      toast(`接入成功${info ? `，余额 ${info.total_balance} ${info.currency}` : ''}`, 2500);
      closeLayer(entry);
      if (input.value.trim()) onAction();
    } catch (e) { S.apiKey = ''; st.textContent = '❌ ' + (e.message === 'Failed to fetch' ? '网络连接失败' : e.message); go.disabled = false; }
  };
  const entry = pushLayer(box);
}

/* ---------------- 返回键（安卓） ---------------- */
function handleBack() {
  if (stack.length) { closeLayer(); return true; }
  if (pages.length) { closePage(); return true; }
  if (app.classList.contains('side-open')) { closeSide(); return true; }
  if (!$('#attachPanel').classList.contains('hidden')) { togglePanel(false); return true; }
  return false;
}
if (P.App) P.App.addListener('backButton', () => { if (!handleBack()) P.App.minimizeApp ? P.App.minimizeApp() : P.App.exitApp(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') handleBack(); });

/* ---------------- 启动 ---------------- */
async function boot() {
  DB.persist();
  S = { ...DEFAULTS, ...(await DB.get('settings') || {}) };
  memories = (await DB.get('memories') || []).map(Mem.normalize);
  episodes = await DB.get('episodes') || [];
  profile = await DB.get('profile') || { text: '', ts: 0 };
  convs = await DB.allConvs();
  applyTheme(); renderChips(); renderSideFoot(); renderHeader(); renderMessages(); togglePanel(false); updateAction();
  if (!S.apiKey && !S.onboarded) setTimeout(openOnboarding, 400);
  checkDsPending();
  if ('serviceWorker' in navigator && !isNative && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
}
document.addEventListener('visibilitychange', () => { if (document.hidden) maybeMemorize(cur); });
boot();
})();
