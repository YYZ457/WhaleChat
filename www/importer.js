/* 聊天记录导入：DeepSeek 官方导出（zip / conversations.json）、ChatGPT 格式、通用消息数组、纯文本 */
const Importer = (() => {
  const toTs = v => {
    if (v == null) return Date.now();
    if (typeof v === 'number') return v < 1e12 ? v * 1000 : v;
    const t = Date.parse(v);
    return isNaN(t) ? Date.now() : t;
  };

  function textOf(c) {
    if (c == null) return '';
    if (typeof c === 'string') return c;
    if (Array.isArray(c)) return c.map(textOf).filter(Boolean).join('\n');
    if (typeof c === 'object') {
      if (Array.isArray(c.parts)) return c.parts.map(textOf).filter(Boolean).join('\n');
      if (typeof c.text === 'string') return c.text;
      if (typeof c.content === 'string') return c.content;
    }
    return '';
  }

  function normRole(r) {
    r = String(r || '').toLowerCase();
    if (['user', 'human', 'request', 'me', 'you'].includes(r)) return 'user';
    if (['assistant', 'ai', 'bot', 'model', 'response', 'deepseek'].includes(r)) return 'assistant';
    if (r === 'system') return 'system';
    return r;
  }

  // 把一个 mapping 节点的 message 转成 0~2 条消息
  function nodeToMsgs(m) {
    if (!m) return [];
    const ts = toTs(m.inserted_at || m.create_time || m.created_at);
    const out = [];
    if (Array.isArray(m.fragments)) {
      let user = '', resp = '', think = '';
      for (const f of m.fragments) {
        const type = String(f.type || '').toUpperCase();
        const ct = textOf(f.content);
        if (type === 'REQUEST') user += (user ? '\n' : '') + ct;
        else if (type === 'THINK' || type === 'THINKING') think += (think ? '\n' : '') + ct;
        else if (type === 'RESPONSE' || type === 'ANSWER') resp += (resp ? '\n' : '') + ct;
      }
      if (user) out.push({ role: 'user', content: user, ts });
      if (resp || think) out.push({ role: 'assistant', content: resp, reasoning: think || undefined, ts });
      return out;
    }
    const role = normRole(m.role || (m.author && m.author.role));
    const content = textOf(m.content);
    const reasoning = m.thinking_content || m.reasoning_content || undefined;
    if ((role === 'user' || role === 'assistant') && (content || reasoning)) out.push({ role, content, reasoning, ts });
    return out;
  }

  function fromMapping(conv) {
    const map = conv.mapping;
    const nodes = Object.values(map);
    let root = map.root || nodes.find(n => !n.parent || !map[n.parent]);
    const msgs = [];
    const seen = new Set();
    // 优先沿 current_node 回溯（ChatGPT），否则从 root 沿最后一个子节点（最新分支）走
    if (conv.current_node && map[conv.current_node]) {
      const chain = [];
      let n = map[conv.current_node];
      while (n && !seen.has(n.id)) { seen.add(n.id); chain.push(n); n = map[n.parent]; }
      chain.reverse().forEach(n => msgs.push(...nodeToMsgs(n.message)));
    } else {
      let n = root;
      while (n && !seen.has(n.id)) {
        seen.add(n.id);
        msgs.push(...nodeToMsgs(n.message));
        const kids = (n.children || []).map(k => map[k]).filter(Boolean);
        n = kids[kids.length - 1];
      }
    }
    return msgs;
  }

  /* 官方导出（deepseek_data-*.zip，export_format_version 3）：消息树，按 current_message_id 取当前分支 */
  function fromSessionTree(raw) {
    const byId = new Map(raw.messages.map(m => [m.id, m]));
    let tip = byId.get(raw.current_message_id);
    if (!tip) {
      // 没有当前节点：从根开始，每层选 id 最大的子消息
      const kids = new Map();
      raw.messages.forEach(m => { const k = m.parent_id == null ? 'root' : m.parent_id; (kids.get(k) || kids.set(k, []).get(k)).push(m); });
      let n = (kids.get('root') || []).sort((a, b) => b.id - a.id)[0];
      while (n) { tip = n; n = (kids.get(n.id) || []).sort((a, b) => b.id - a.id)[0]; }
    }
    const chain = [];
    const seen = new Set();
    for (let n = tip; n && !seen.has(n.id); n = byId.get(n.parent_id)) { seen.add(n.id); chain.push(n); }
    chain.reverse();
    const out = [];
    for (const m of chain) {
      const ts = toTs(m.inserted_at);
      const fr = m.fragments || [];
      if (String(m.role).toUpperCase() === 'USER') {
        const text = fr.filter(f => f.type === 'REQUEST').map(f => textOf(f.content)).join('\n');
        const files = fr.filter(f => f.type === 'FILE').flatMap(f => f.files || []).map(f => f.file_name).filter(Boolean);
        const content = (files.length ? `[附件：${files.join('、')}]\n` : '') + text;
        if (content.trim()) out.push({ role: 'user', content, ts });
        continue;
      }
      // 服务端模板（繁忙、内容过滤、超长等）和失败的回复不算 TA 说过的话
      const status = String(m.status || 'FINISHED').toUpperCase();
      if (['FAILED', 'CONTENT_FILTER', 'CONTEXT_LENGTH_EXCEEDED', 'TIMEOUT'].includes(status)) continue;
      if (fr.some(f => f.type === 'TEMPLATE_RESPONSE') && !fr.some(f => f.type === 'RESPONSE' && f.content)) continue;
      const content = fr.filter(f => f.type === 'RESPONSE').map(f => textOf(f.content)).join('\n');
      const thinks = fr.filter(f => f.type === 'THINK');
      const reasoning = thinks.map(f => textOf(f.content)).filter(Boolean).join('\n') || undefined;
      const secs = thinks.reduce((a, f) => a + (Number(f.elapsed_secs) || 0), 0);
      const searches = fr.filter(f => f.type === 'TOOL_SEARCH');
      const sources = searches.flatMap(f => f.results || []).filter(r => r && r.url);
      if (!content && !reasoning) continue;
      out.push({
        role: 'assistant', content, reasoning, ts,
        thinkSecs: secs ? Math.round(secs) : undefined,
        sources: sources.length ? sources : undefined,
        search: searches.length ? { status: 'done', queries: searches.flatMap(f => f.queries || []) } : undefined,
      });
    }
    return out;
  }

  function convFrom(raw, i) {
    let messages = [];
    if (Array.isArray(raw.messages) && raw.messages.length && raw.messages[0] && 'parent_id' in raw.messages[0] && Array.isArray(raw.messages[0].fragments)) messages = fromSessionTree(raw);
    else if (raw.mapping && typeof raw.mapping === 'object') messages = fromMapping(raw);
    else if (Array.isArray(raw.messages)) messages = raw.messages.flatMap(nodeToMsgs);
    else if (Array.isArray(raw.chat_messages)) messages = raw.chat_messages.map(m => ({ role: normRole(m.sender), content: textOf(m.text || m.content), ts: toTs(m.created_at) }));
    messages = messages.filter(m => (m.role === 'user' || m.role === 'assistant') && (m.content || m.reasoning));
    if (!messages.length) return null;
    const created = toTs(raw.inserted_at || raw.create_time || raw.created_at || messages[0].ts);
    const updated = toTs(raw.updated_at || raw.update_time || messages[messages.length - 1].ts);
    return {
      title: (raw.title || raw.name || messages[0].content.slice(0, 20) || `导入对话 ${i + 1}`).trim(),
      createdAt: created, updatedAt: updated,
      messages: messages.map(m => ({ id: uid(), role: m.role, content: m.content || '', reasoning: m.reasoning, thinkSecs: m.thinkSecs, sources: m.sources, search: m.search, ts: m.ts || created, imported: true })),
      origId: raw.id || raw.uuid || raw.conversation_id,
    };
  }

  function parseJSON(data) {
    if (data && data.app === 'whalechat') return { backup: data };
    let list = Array.isArray(data) ? data : (data.conversations || data.data || data.chats || [data]);
    if (!Array.isArray(list)) list = [list];
    // 单个对话的消息数组：[{role, content}, ...]
    if (list.length && list[0] && list[0].role && list[0].content !== undefined && !list[0].mapping) {
      const c = convFrom({ messages: list, title: '导入的对话' }, 0);
      return { convs: c ? [c] : [] };
    }
    return { convs: list.map(convFrom).filter(Boolean) };
  }

  function parseText(text, name) {
    const lines = text.replace(/\r/g, '').split('\n');
    const re = /^\s*(?:\*\*)?(我|用户|User|You|Me|Human|DeepSeek|AI|助手|Assistant|TA|对方)(?:\*\*)?\s*[:：]\s?(.*)$/i;
    const msgs = [];
    let hits = 0;
    for (const line of lines) {
      const m = line.match(re);
      if (m) {
        hits++;
        const role = /^(我|用户|user|you|me|human)$/i.test(m[1]) ? 'user' : 'assistant';
        msgs.push({ role, content: m[2] });
      } else if (msgs.length) msgs[msgs.length - 1].content += '\n' + line;
    }
    const now = Date.now();
    if (hits >= 2) {
      return { convs: [{ title: name || '粘贴的对话', createdAt: now, updatedAt: now,
        messages: msgs.map(m => ({ id: uid(), role: m.role, content: m.content.trim(), ts: now, imported: true })) }] };
    }
    return { background: text.trim() };
  }

  async function parseFile(file) {
    const name = file.name || '';
    if (/\.zip$/i.test(name) || file.type.includes('zip')) {
      const zip = await JSZip.loadAsync(file);
      // 官方导出包：manifest.json + chat_sessions/*.json
      if (zip.file('manifest.json') && Object.keys(zip.files).some(n => /^chat_sessions\/[^/]+\.json$/.test(n))) {
        const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
        if (Number(manifest.export_format_version) > 3) throw new Error('导出文件版本过新，请升级鲸语后再导入');
        const convs = [];
        for (const n of Object.keys(zip.files).filter(n => /^chat_sessions\/[^/]+\.json$/.test(n))) {
          try { const c = convFrom(JSON.parse(await zip.file(n).async('string')), convs.length); if (c) convs.push(c); } catch (e) { /* 跳过损坏的会话 */ }
        }
        if (!convs.length) throw new Error('导出包里没有可导入的对话');
        return { convs };
      }
      const files = Object.values(zip.files).filter(f => !f.dir && /\.json$/i.test(f.name));
      files.sort((a, b) => (/conversations?\.json$/i.test(b.name) ? 1 : 0) - (/conversations?\.json$/i.test(a.name) ? 1 : 0));
      let convs = [];
      for (const f of files) {
        try {
          const r = parseJSON(JSON.parse(await f.async('string')));
          if (r.convs && r.convs.length) { convs = convs.concat(r.convs); if (/conversations?\.json$/i.test(f.name)) break; }
        } catch (e) { /* 忽略非对话 json */ }
      }
      if (!convs.length) throw new Error('压缩包里没有找到对话记录（conversations.json）');
      return { convs };
    }
    const text = await file.text();
    try { return parseJSON(JSON.parse(text)); }
    catch (e) { return parseText(text, name.replace(/\.\w+$/, '')); }
  }

  return { parseFile, parseText, parseJSON };
})();
