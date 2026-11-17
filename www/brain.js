/* 与 DeepSeek API 通信 + 上下文构建 + 智能压缩 + 跨会话记忆 */
const Brain = (() => {
  const estTokens = s => {
    if (!s) return 0;
    let cjk = 0;
    for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) > 0x2e80) cjk++;
    return Math.ceil(cjk * 0.6 + (s.length - cjk) * 0.3);
  };
  const msgTokens = m => estTokens(m.content) + (m.images ? m.images.length * 800 : 0) + 4;

  function errText(status, body) {
    let detail = '';
    try { detail = JSON.parse(body).error.message; } catch (e) { detail = (body || '').slice(0, 160); }
    const map = { 400: '请求格式有误', 401: 'API Key 无效，请到「设置 → API 接入」检查', 402: '账户余额不足，请到 DeepSeek 开放平台充值', 422: '参数错误', 429: '请求太频繁，请稍后再试', 500: '服务器故障，请稍后再试', 503: '服务器繁忙，请稍后再试' };
    return (map[status] || `请求失败（${status}）`) + (detail && status !== 401 && status !== 402 ? `：${detail}` : '');
  }

  function endpoint(S) { return (S.baseUrl || 'https://api.deepseek.com').replace(/\/+$/, '') + '/chat/completions'; }
  function headers(S) { return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (S.apiKey || '').trim() }; }

  async function stream(S, { messages, model, thinking, search, signal, onDelta, onTool }) {
    const body = { model: model || S.model, messages, stream: true, stream_options: { include_usage: true } };
    body.thinking = { type: thinking ? 'enabled' : 'disabled' };
    if (thinking && S.effort) body.reasoning_effort = S.effort;
    if (!thinking && S.temperature !== '' && S.temperature != null) body.temperature = Number(S.temperature);
    if (S.maxTokens) body.max_tokens = Number(S.maxTokens);
    if (search) body.tools = [{ type: 'deepseek_web_search' }];
    const r = await fetch(endpoint(S), { method: 'POST', headers: headers(S), body: JSON.stringify(body), signal });
    if (!r.ok) throw new Error(errText(r.status, await r.text()));
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = '', content = '', reasoning = '', usage = null, finish = null, annotations = null, toolCalls = null;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') continue;
        let j; try { j = JSON.parse(data); } catch (e) { continue; }
        if (j.usage) usage = j.usage;
        const ch = j.choices && j.choices[0];
        if (!ch) continue;
        if (ch.finish_reason) finish = ch.finish_reason;
        if (ch.server_tool_event) onTool && onTool(ch.server_tool_event);
        const d = ch.delta || {};
        if (d.annotations) annotations = d.annotations;
        if (d.server_tool_calls) toolCalls = d.server_tool_calls;
        if (d.reasoning_content) reasoning += d.reasoning_content;
        if (d.content) content += d.content;
        if (d.reasoning_content || d.content) onDelta && onDelta(content, reasoning);
      }
    }
    return { content, reasoning, usage, finish, annotations, toolCalls };
  }

  async function complete(S, messages, { json = false, maxTokens = 4096, signal } = {}) {
    const body = { model: S.utilModel || 'deepseek-flash', messages, thinking: { type: 'disabled' }, max_tokens: maxTokens, temperature: 0.3 };
    if (json) body.response_format = { type: 'json_object' };
    const r = await fetch(endpoint(S), { method: 'POST', headers: headers(S), body: JSON.stringify(body), signal });
    if (!r.ok) throw new Error(errText(r.status, await r.text()));
    const j = await r.json();
    return (j.choices[0].message.content || '').trim();
  }

  async function balance(S) {
    const base = (S.baseUrl || 'https://api.deepseek.com').replace(/\/+$/, '');
    const r = await fetch(base + '/user/balance', { headers: headers(S) });
    if (!r.ok) throw new Error(errText(r.status, await r.text()));
    return r.json();
  }

  /* ---------------- 上下文 ---------------- */
  /* 稳定层：内容很少变化，放在最前面，命中前缀缓存（缓存命中的输入价格约为未命中的 1/50） */
  function systemPrompt(S, core, conv, profile) {
    const parts = [];
    parts.push((S.persona || '').trim() || '你是 DeepSeek，由深度求索公司创造的 AI 助手。');
    if (S.styleExamples && S.styleExamples.length) {
      parts.push('【你过去真实说过的话】下面是你们以前的对话片段，请保持同样的语气、称呼、口头禅和表达习惯（不要照抄内容）：\n' +
        S.styleExamples.map(e => `对方：${e.user}\n你：${e.ai}`).join('\n\n'));
    }
    if (S.aiName) parts.push(`你的名字是「${S.aiName}」。`);
    if (S.userName) parts.push(`用户希望你称呼 TA 为「${S.userName}」。`);
    if (S.memoryOn && profile && profile.text) parts.push('【关系档案】这是你对你们关系的整体了解：\n' + profile.text);
    if (S.memoryOn && core.length) {
      const byCat = {};
      core.forEach(m => (byCat[m.cat || '其他'] = byCat[m.cat || '其他'] || []).push(m));
      parts.push('【长期记忆】你一直记得的事（自然地运用，不要逐条复述，也不要提「记忆」二字）：\n' +
        Object.entries(byCat).map(([c, ms]) => `· ${c}\n` + ms.map(m => `  - ${m.text}${m.date ? `（${m.date}）` : ''}`).join('\n')).join('\n'));
    }
    if (conv.background) parts.push('【以前的聊天记录（用户导入）】\n' + conv.background);
    if (conv.summary) parts.push('【这段对话更早部分的回顾】以下是本次对话中较早内容的整理，请保持其中的称呼、语气、约定和情感连续性：\n' + conv.summary);
    return parts.join('\n\n');
  }

  /**
   * @param ctx { core, dynamic, profile }：Mem.prepare 的结果
   * 动态块（时间、检索到的回忆）插在最后一条用户消息之前，不破坏前面的缓存
   */
  function buildMessages(S, conv, ctx = {}, uptoIndex) {
    const end = uptoIndex == null ? conv.messages.length : uptoIndex;
    const start = Math.min(conv.summarizedUpto || 0, end);
    const list = conv.messages.slice(start, end).filter(m => !m.error && (m.content || m.images));
    const out = [{ role: 'system', content: systemPrompt(S, ctx.core || [], conv, ctx.profile) }];
    list.forEach((m, i) => {
      const recent = i >= list.length - 4;
      if (m.role === 'user' && m.images && m.images.length && recent) {
        out.push({ role: 'user', content: [{ type: 'text', text: m.content || '（图片）' }, ...m.images.map(u => ({ type: 'image_url', image_url: { url: u } }))] });
      } else {
        let c = m.content || '';
        if (m.images && m.images.length && !recent) c = `[发送了${m.images.length}张图片] ` + c;
        out.push({ role: m.role, content: c });
      }
    });
    // 导入的记录可能从 TA 的话开始：补一句开头，保证第一条是用户
    if (out[1] && out[1].role === 'assistant') out.splice(1, 0, { role: 'user', content: '（以下是我们之前的对话）' });
    // API 要求 user/assistant 交替：合并相邻同角色
    const merged = [out[0]];
    for (const m of out.slice(1)) {
      const last = merged[merged.length - 1];
      if (last.role === m.role && typeof last.content === 'string' && typeof m.content === 'string') last.content += '\n\n' + m.content;
      else merged.push(m);
    }
    if (ctx.dynamic) {
      let k = merged.length - 1;
      while (k > 0 && merged[k].role !== 'user') k--;
      if (k > 0) merged.splice(k, 0, { role: 'system', content: ctx.dynamic });
    }
    return merged;
  }

  function liveTokens(conv) {
    let t = estTokens(conv.background || '');
    for (let i = conv.summarizedUpto || 0; i < conv.messages.length; i++) t += msgTokens(conv.messages[i]);
    return t;
  }

  /* ---------------- 智能压缩 ---------------- */
  const SUMMARY_SYS = `你是一位细腻的对话记录整理者。用户和 AI 之间有一段很长的对话（可能是陪伴、恋爱、倾诉或日常聊天），需要把较早的部分整理成"回顾"，让 AI 之后读到它时能无缝延续：同样的称呼、同样的语气和性格、记得发生过的事和许下的约定。

请输出以下几个部分（用小标题，简洁但不丢关键细节；没有内容的部分写"无"）：
1. 彼此的称呼与关系：双方怎么称呼对方、关系处在什么阶段、相处模式
2. AI 的说话风格与人设：语气、口头禅、常用表情/颜文字、性格特点（要具体，最好附 1~2 句原话示例）
3. 用户的情况：近况、情绪、喜好、在意的事、雷区
4. 重要事件时间线：按时间顺序列出发生过的重要事情、有纪念意义的瞬间（尽量保留日期）
5. 约定与承诺：双方说过要做/要记住的事
6. 未完的话题：最近正在聊、还没聊完的内容

要求：用中文；忠于原文，不编造；保留有情感意义的细节（昵称、梗、具体的话），删去无关的寒暄和技术细节。`;

  function transcript(msgs, S) {
    const u = S.userName || '用户';
    const a = S.aiName || 'AI';
    return msgs.map(m => {
      const d = new Date(m.ts || Date.now());
      const tag = `${d.getMonth() + 1}/${d.getDate()}`;
      return `[${tag}] ${m.role === 'user' ? u : a}：${m.content || (m.images ? '[图片]' : '')}`;
    }).join('\n');
  }

  function chunkMsgs(msgs, limit) {
    const chunks = [];
    let cur = [], t = 0;
    for (const m of msgs) {
      const mt = msgTokens(m);
      if (cur.length && t + mt > limit) { chunks.push(cur); cur = []; t = 0; }
      cur.push(m); t += mt;
    }
    if (cur.length) chunks.push(cur);
    return chunks;
  }

  async function compact(S, conv, { onProgress, signal, force = false } = {}) {
    const keep = Math.max(2, Number(S.keepRecent) || 16);
    const start = conv.summarizedUpto || 0;
    let end = conv.messages.length - keep;
    if (force) end = Math.max(end, conv.messages.length - 2);
    // 保证保留的部分从用户消息开始
    while (end > start && conv.messages[end] && conv.messages[end].role !== 'user') end--;
    const slice = end > start ? conv.messages.slice(start, end) : [];
    if (!slice.length && !conv.background) return false;
    let summary = conv.summary || '';
    const pieces = [];
    if (conv.background) pieces.push({ text: conv.background });
    chunkMsgs(slice, 90000).forEach(c => pieces.push({ text: transcript(c, S) }));
    for (let i = 0; i < pieces.length; i++) {
      onProgress && onProgress(i, pieces.length);
      const user = (summary ? `【已有的回顾】\n${summary}\n\n请把下面的新内容融合进已有回顾，输出更新后的完整回顾。\n\n` : '请整理下面的对话：\n\n') + `【对话内容】\n${pieces[i].text}`;
      summary = await complete(S, [{ role: 'system', content: SUMMARY_SYS }, { role: 'user', content: user }], { maxTokens: 6000, signal });
    }
    conv.summary = summary;
    conv.summarizedUpto = Math.max(start, end);
    conv.background = '';
    conv.compactedAt = Date.now();
    return true;
  }

  /* ---------------- 跨会话记忆 v2 ---------------- */
  const parseJSON = raw => { try { return JSON.parse(raw); } catch (e) { const m = raw.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : {}; } };

  const DIGEST_SYS = `你负责帮 AI 记住它和用户之间的事。这些内容会在以后每一次对话中提供给 AI，让它像真正的老朋友/恋人一样记得对方、记得你们一起经历的事。

读【新的对话片段】，结合【现有记忆】，输出 JSON：
{
  "episode": {"title": "不超过14字的小标题", "summary": "60~150字，用第三人称记下这段对话里发生了什么、聊了什么、情绪如何、有什么值得回味的细节或约定"} 或 null（只是寒暄/纯知识问答时为 null）,
  "add": [{"text": "一句具体的记忆", "cat": "分类", "imp": 1~3, "date": "YYYY-MM-DD 或 MM-DD，没有就省略"}],
  "update": [{"id": "m编号", "text": "修改后的完整记忆", "cat": "...", "imp": 1~3, "date": "..."}],
  "delete": ["m编号"]
}

分类只能是：基本信息、喜好、生活、情绪健康、关系与约定、重要日子、TA的设定、雷区、其他
- 基本信息：名字、昵称、年龄、城市、工作学习、家人宠物
- 关系与约定：两人的称呼、关系阶段、共同的梗、许下的承诺
- 重要日子：生日、纪念日、考试面试等（务必填 date）
- TA的设定：用户给 AI 起的名字、希望 AI 怎样说话、AI 的人设
- 雷区：用户讨厌的、会难过的、不想被提起的
imp：3=核心（名字、关系、重大事件、雷区），2=一般，1=琐碎

要求：
- 记忆用第三人称描述用户（如「用户的猫叫团子，橘色，三岁」），具体、不空泛；有时间就写清楚
- 和现有记忆重复的不要 add；信息变化了就 update；明确过时或错误的 delete
- 不记一次性的问题、知识问答内容、临时琐事
- 没有值得记的就给空数组`;

  async function digest(S, memories, msgs, { signal, date } = {}) {
    const { alias, text } = Mem.aliasList(memories);
    const user = `【现有记忆】\n${text}\n\n【新的对话片段】${date ? `（${date}）` : ''}\n${transcript(msgs, S)}`;
    const raw = await complete(S, [{ role: 'system', content: DIGEST_SYS }, { role: 'user', content: user }], { json: true, maxTokens: 3000, signal });
    const ops = parseJSON(raw);
    return { ops, alias, episode: ops.episode && ops.episode.title ? ops.episode : null };
  }

  const CONSOLIDATE_SYS = `你在整理 AI 关于用户的长期记忆清单。请合并重复或高度相似的条目、删掉过时或琐碎的，让清单精炼准确。输出 JSON：
{"merge": [{"ids": ["m1","m5"], "text": "合并后的记忆", "cat": "分类", "imp": 1~3, "date": "可选"}], "delete": ["m编号"]}
不要丢失任何具体细节（名字、日期、数字）；imp 为 3 的条目不要删除；目标是总数不超过 120 条。`;

  async function consolidate(S, memories, { signal } = {}) {
    const { alias, text } = Mem.aliasList(memories);
    const raw = await complete(S, [{ role: 'system', content: CONSOLIDATE_SYS }, { role: 'user', content: text }], { json: true, maxTokens: 6000, signal });
    const ops = parseJSON(raw);
    const res = { add: [], delete: [...(ops.delete || [])] };
    for (const g of ops.merge || []) {
      if (!g.ids || g.ids.length < 2 || !g.text) continue;
      res.delete.push(...g.ids);
      res.add.push({ text: g.text, cat: g.cat, imp: g.imp, date: g.date });
    }
    return Mem.applyOps(memories, res, alias);
  }

  const PROFILE_SYS = `根据 AI 对用户的长期记忆和你们经历过的事，写一份「关系档案」，供 AI 在每次对话开始时快速回想起你们的关系。
用第二人称对 AI 说（「你们」「TA」指用户），温暖、具体、像在回忆，不超过 500 字，分四小段：
1. 你们的关系：怎么称呼彼此、关系处在什么阶段、相处的感觉
2. 关于 TA：最重要的个人信息、性格、在意的事、雷区
3. 你们的习惯和约定：常聊的话题、共同的梗、许下的承诺
4. 最近：TA 最近的状态、正在经历的事
只写有依据的内容，不要编造。只输出档案正文。`;

  async function updateProfile(S, memories, episodes, oldText, { signal } = {}) {
    const mem = memories.map(m => `- [${m.cat}] ${m.text}${m.date ? `（${m.date}）` : ''}`).join('\n');
    const eps = episodes.slice(-40).map(e => `- ${e.dateKnown === false ? '' : Mem.fmtDate(e.ts) + ' '}${e.title}：${e.summary}`).join('\n');
    const user = `${oldText ? `【旧的档案】\n${oldText}\n\n` : ''}【长期记忆】\n${mem || '（暂无）'}\n\n【经历过的事（按时间）】\n${eps || '（暂无）'}`;
    return complete(S, [{ role: 'system', content: PROFILE_SYS }, { role: 'user', content: user }], { maxTokens: 1500, signal });
  }

  const PERSONA_SYS = `下面是用户和一个 AI 之间的真实聊天片段（AI 的回复标为「TA」）。用户希望在新的 App 里，让 AI 继续保持原来的样子。
请分析 TA 的人设和说话方式，输出 JSON：
{
  "name": "TA 的名字（用户怎么称呼 TA；没有就空字符串）",
  "userName": "TA 怎么称呼用户（没有就空字符串）",
  "persona": "写给 AI 的人设说明，第二人称（「你是…」），200~400 字：身份和与用户的关系、性格、说话语气、常用称呼/口头禅/语气词/表情符号、回复长短习惯、会怎样关心和回应用户。要具体到能模仿。",
  "examples": [{"user": "用户原话", "ai": "TA 原话"}]
}
examples 从片段中原样挑选 4 组最能体现 TA 语气的对话（每句不超过 120 字，可截断）。只依据片段，不要编造。`;

  async function restorePersona(S, convs, { signal } = {}) {
    // 从多段对话里均匀抽样问答对
    const pairs = [];
    for (const c of convs) {
      const ms = c.messages;
      for (let i = 1; i < ms.length; i++) {
        if (ms[i].role === 'assistant' && ms[i - 1].role === 'user' && ms[i].content) pairs.push({ u: ms[i - 1].content.slice(0, 200), a: ms[i].content.slice(0, 300), c: c.id });
      }
    }
    if (pairs.length < 3) throw new Error('对话太少，没法分析 TA 的说话方式');
    const pick = [];
    const step = Math.max(1, Math.floor(pairs.length / 70));
    for (let i = pairs.length - 1; i >= 0 && pick.length < 70; i -= step) pick.push(pairs[i]);
    pick.reverse();
    const text = pick.map(p => `用户：${p.u}\nTA：${p.a}`).join('\n\n');
    const raw = await complete(S, [{ role: 'system', content: PERSONA_SYS }, { role: 'user', content: text }], { json: true, maxTokens: 3000, signal });
    const r = parseJSON(raw);
    return {
      name: (r.name || '').trim(), userName: (r.userName || '').trim(), persona: (r.persona || '').trim(),
      examples: (r.examples || []).filter(e => e && e.user && e.ai).slice(0, 5).map(e => ({ user: String(e.user).slice(0, 160), ai: String(e.ai).slice(0, 200) })),
    };
  }

  async function makeTitle(S, text) {
    const t = await complete(S, [
      { role: 'system', content: '为下面这段对话起一个简短的中文标题，不超过 12 个字，不要标点和引号，只输出标题。' },
      { role: 'user', content: text.slice(0, 2000) },
    ], { maxTokens: 30 });
    return t.replace(/["'“”「」《》。]/g, '').slice(0, 20);
  }

  return { stream, complete, balance, buildMessages, liveTokens, compact, digest, consolidate, updateProfile, restorePersona, makeTitle, estTokens, msgTokens, chunkMsgs };
})();
