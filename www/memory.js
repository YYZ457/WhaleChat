/* 记忆系统 v2：分层记忆 + 本地检索（无需额外 API）
 *
 *  ┌ 稳定层（放在系统提示词开头，命中 DeepSeek 前缀缓存，便宜）
 *  │   人设 · 说话示例 · 关系档案 · 核心记忆（置顶/重要）
 *  └ 动态层（每轮插在最新一条消息前）
 *      此刻（时间、隔了多久没聊、纪念日） · 相关记忆 · 相关往事 · 以前聊过的相关片段
 *
 * 检索：中文二元组 + BM25，全部在手机本地计算。
 */
const Mem = (() => {
  const CATS = ['基本信息', '喜好', '生活', '情绪健康', '关系与约定', '重要日子', 'TA的设定', '雷区', '其他'];

  /* ---------------- 分词 + BM25 ---------------- */
  const STOP = new Set(['我们', '你们', '他们', '什么', '一个', '这个', '那个', '没有', '就是', '可以', '还是', '然后', '因为', '所以', '如果', '但是', '不是', '自己', '知道', '觉得', '怎么', '现在', '时候', '一下', '一些', '这样', '那样', '的话', '真的', '有点', '还有', '已经', '为什么', '的时', '了吗', '了，', '是不']);
  function tokens(s) {
    s = (s || '').toLowerCase();
    const out = [];
    const re = /[a-z0-9]+|[㐀-鿿]+/g;
    let m;
    while ((m = re.exec(s))) {
      const w = m[0];
      if (/^[a-z0-9]/.test(w)) { if (w.length > 1) out.push(w); continue; }
      if (w.length === 1) { out.push(w); continue; }
      for (let i = 0; i < w.length - 1; i++) { const bg = w.slice(i, i + 2); if (!STOP.has(bg)) out.push(bg); }
    }
    return out;
  }

  class Index {
    constructor(docs) {
      this.docs = docs;
      this.df = new Map();
      this.tf = [];
      let total = 0;
      for (const d of docs) {
        const t = new Map();
        for (const w of tokens(d.text)) t.set(w, (t.get(w) || 0) + 1);
        this.tf.push(t);
        d.len = [...t.values()].reduce((a, b) => a + b, 0) || 1;
        total += d.len;
        for (const w of t.keys()) this.df.set(w, (this.df.get(w) || 0) + 1);
      }
      this.avg = total / (docs.length || 1);
    }
    search(query, { k = 5, kinds, exclude, minScore = 0, minHits = 2 } = {}) {
      const q = [...new Set(tokens(query))];
      if (!q.length) return [];
      const N = this.docs.length;
      const res = [];
      for (let i = 0; i < N; i++) {
        const d = this.docs[i];
        if (kinds && !kinds.includes(d.kind)) continue;
        if (exclude && exclude(d)) continue;
        const tf = this.tf[i];
        let s = 0, hits = 0;
        for (const w of q) {
          const f = tf.get(w);
          if (!f) continue;
          hits++;
          const df = this.df.get(w);
          const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
          s += idf * (f * 2.2) / (f + 1.2 * (0.25 + 0.75 * d.len / this.avg));
        }
        if (hits >= Math.min(minHits, q.length) && s > minScore) res.push({ d, s });
      }
      res.sort((a, b) => b.s - a.s);
      return res.slice(0, k);
    }
  }

  /* ---------------- 语料 ---------------- */
  let cache = null;
  let version = 0;
  const touch = () => { version++; };

  function chunksOf(conv) {
    const out = [];
    const ms = conv.messages.filter(m => m.content && !m.error);
    for (let i = 0; i < ms.length; i += 4) {
      const part = ms.slice(i, i + 4);
      const text = part.map(m => `${m.role === 'user' ? '我' : 'TA'}：${m.content.replace(/\s+/g, ' ').slice(0, 220)}`).join('\n');
      out.push({ kind: 'chunk', text, convId: conv.id, title: conv.title, ts: part[0].ts || conv.createdAt, idx: conv.messages.indexOf(part[part.length - 1]), dateKnown: conv.origin !== 'deepseek-app' });
    }
    return out;
  }

  function corpus({ convs, memories, episodes }) {
    if (cache && cache.version === version) return cache.index;
    const docs = [];
    memories.forEach(m => docs.push({ kind: 'mem', text: m.text + ' ' + (m.cat || ''), mem: m }));
    episodes.forEach(e => docs.push({ kind: 'ep', text: `${e.title} ${e.summary}`, ep: e }));
    convs.forEach(c => docs.push(...chunksOf(c)));
    const index = new Index(docs);
    cache = { version, index };
    return index;
  }

  /* ---------------- 时间与纪念日 ---------------- */
  const pad = n => String(n).padStart(2, '0');
  function nowText(d = new Date()) {
    const w = '日一二三四五六'[d.getDay()];
    const h = d.getHours();
    const part = h < 5 ? '凌晨' : h < 9 ? '早上' : h < 12 ? '上午' : h < 14 ? '中午' : h < 18 ? '下午' : h < 23 ? '晚上' : '深夜';
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 星期${w} ${part}${pad(h)}:${pad(d.getMinutes())}`;
  }
  function gapText(ms) {
    const h = ms / 36e5;
    if (h < 6) return '';
    if (h < 24) return `距离你们上一次聊天过去了大约 ${Math.round(h)} 小时。`;
    const d = Math.round(h / 24);
    return `距离你们上一次聊天已经过去了 ${d} 天${d >= 3 ? '，可以自然地表达一下想念或关心对方这几天过得怎么样' : ''}。`;
  }
  function parseMD(date) {
    const m = String(date || '').match(/(?:(\d{4})-)?(\d{1,2})-(\d{1,2})/);
    return m ? { y: m[1] ? +m[1] : null, mo: +m[2], d: +m[3] } : null;
  }
  function specialDays(memories, now = new Date()) {
    const out = [];
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (const m of memories) {
      const p = parseMD(m.date);
      if (!p) continue;
      let next = new Date(today.getFullYear(), p.mo - 1, p.d);
      if (next < today) next = new Date(today.getFullYear() + 1, p.mo - 1, p.d);
      const days = Math.round((next - today) / 864e5);
      const years = p.y ? next.getFullYear() - p.y : null;
      if (days === 0) out.push(`今天就是：${m.text}${years ? `（第 ${years} 年）` : ''}`);
      else if (days <= 3) out.push(`再过 ${days} 天是：${m.text}`);
    }
    return out;
  }
  const fmtDate = ts => { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

  /* ---------------- 每轮准备 ---------------- */
  const CORE_LIMIT = 60;
  function isCore(m, total) { return m.pinned || (m.imp || 2) >= 3 || total <= CORE_LIMIT; }

  /**
   * @returns {{ core: Array, dynamic: string }}
   *   core：放进稳定系统提示词的记忆（顺序固定，利于缓存）
   *   dynamic：插在最新消息前的「此刻」块
   */
  function prepare({ S, conv, convs, memories, episodes, lastUserAt }) {
    const total = memories.length;
    const core = S.memoryOn ? memories.filter(m => isCore(m, total)).slice(0, CORE_LIMIT + 40) : [];
    const lines = [];
    lines.push(`【此刻】现在是 ${nowText()}。` + (lastUserAt ? gapText(Date.now() - lastUserAt) : ''));
    if (S.memoryOn) {
      const sd = specialDays(memories);
      if (sd.length) lines.push('【特别的日子】\n' + sd.map(s => '- ' + s).join('\n'));
    }
    if (S.memoryOn && S.recallOn !== false) {
      const msgs = conv.messages;
      const lastUser = [...msgs].reverse().find(m => m.role === 'user');
      const lastAsst = [...msgs].reverse().find(m => m.role === 'assistant' && m.content);
      const q = (lastUser ? lastUser.content.slice(0, 400) : '') + ' ' + (lastAsst ? lastAsst.content.slice(-120) : '');
      if (q.trim()) {
        const idx = corpus({ convs, memories, episodes });
        const coreSet = new Set(core);
        const live = conv.summarizedUpto || 0;
        const mem = idx.search(q, { k: 6, kinds: ['mem'], exclude: d => coreSet.has(d.mem), minScore: 1.5 });
        const eps = idx.search(q, { k: 3, kinds: ['ep'], minScore: 2.5 });
        const chunks = idx.search(q, { k: 3, kinds: ['chunk'], minScore: 4, minHits: 3, exclude: d => d.convId === conv.id && d.idx >= live });
        if (mem.length) lines.push('【此刻可能想起的事】\n' + mem.map(r => '- ' + r.d.mem.text).join('\n'));
        if (eps.length) lines.push('【相关的往事】\n' + eps.map(r => `- ${r.d.ep.dateKnown === false ? '' : `(${fmtDate(r.d.ep.ts)}) `}${r.d.ep.title}：${r.d.ep.summary}`).join('\n'));
        if (chunks.length) lines.push('【以前聊过的相关片段】\n' + chunks.map(r => `(${r.d.dateKnown ? fmtDate(r.d.ts) + ' · ' : ''}${r.d.title})\n${r.d.text}`).join('\n---\n'));
      }
    }
    if (lines.length > 1 || S.memoryOn) lines.push('（以上是你自然记得的背景：用得上就像真的记得一样自然地提起，用不上就不提；不要说「根据记录/记忆显示」。）');
    return { core, dynamic: lines.join('\n\n') };
  }

  /* ---------------- 记忆操作 ---------------- */
  function normalize(m) {
    return { id: m.id || uid(), text: String(m.text || '').trim(), cat: CATS.includes(m.cat) ? m.cat : '其他', imp: Math.min(3, Math.max(1, Number(m.imp) || 2)), date: m.date || '', pinned: !!m.pinned, ts: m.ts || Date.now(), auto: m.auto };
  }
  /** 把模型返回的增删改应用到记忆列表；alias 是给模型看的短编号 → 真实 id */
  function applyOps(memories, ops, alias) {
    const byId = new Map(memories.map(m => [m.id, m]));
    const resolve = a => alias.get(String(a).replace(/^m/i, '')) || alias.get(String(a));
    let added = 0, changed = 0;
    for (const u of ops.update || []) {
      const m = byId.get(resolve(u.id));
      if (!m || !u.text) continue;
      Object.assign(m, normalize({ ...m, ...u, id: m.id, pinned: m.pinned }), { ts: Date.now() });
      changed++;
    }
    for (const d of ops.delete || []) { const id = resolve(d); const m = byId.get(id); if (m && !m.pinned) { byId.delete(id); changed++; } }
    const list = [...byId.values()];
    const seen = new Set(list.map(m => m.text));
    for (const a of ops.add || []) {
      const item = normalize(typeof a === 'string' ? { text: a } : a);
      if (!item.text || seen.has(item.text)) continue;
      item.auto = true; seen.add(item.text); list.push(item); added++;
    }
    return { memories: list, added, changed };
  }
  function aliasList(memories) {
    const alias = new Map();
    const text = memories.map((m, i) => { alias.set(String(i + 1), m.id); return `m${i + 1}. [${m.cat}${m.imp >= 3 ? '·重要' : ''}${m.date ? '·' + m.date : ''}] ${m.text}`; }).join('\n');
    return { alias, text: text || '（暂无）' };
  }

  return { CATS, tokens, Index, prepare, touch, applyOps, aliasList, normalize, specialDays, nowText, fmtDate };
})();
