/* 文件解析：PDF / Word / PPT / Excel / 文本 → 文字（扫描版 PDF 转图片交给模型识图） */
const Files = (() => {
  const MAX_CHARS = 300000;
  const ext = n => (n.split('.').pop() || '').toLowerCase();
  const kindOf = name => {
    const e = ext(name);
    if (e === 'pdf') return 'PDF';
    if (['docx', 'doc'].includes(e)) return 'Word';
    if (['pptx', 'ppt'].includes(e)) return 'PPT';
    if (['xlsx', 'xls', 'csv'].includes(e)) return 'Excel';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'bmp'].includes(e)) return '图片';
    return e.toUpperCase() || '文件';
  };
  const fmtSize = b => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';

  let pdfjs;
  async function loadPdf() {
    if (!pdfjs) {
      pdfjs = await import('./vendor/pdfjs/pdf.min.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('vendor/pdfjs/pdf.worker.min.mjs', location.href).href;
    }
    return pdfjs;
  }

  async function readPdf(file, onProgress) {
    const lib = await loadPdf();
    const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), cMapUrl: new URL('vendor/pdfjs/cmaps/', location.href).href, cMapPacked: true, standardFontDataUrl: new URL('vendor/pdfjs/standard_fonts/', location.href).href }).promise;
    const pages = [];
    let chars = 0;
    for (let i = 1; i <= doc.numPages; i++) {
      onProgress && onProgress(`正在读取第 ${i}/${doc.numPages} 页`);
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      let line = '', out = '';
      let lastY = null;
      for (const it of tc.items) {
        const y = it.transform ? Math.round(it.transform[5]) : null;
        if (lastY !== null && y !== lastY) { out += line + '\n'; line = ''; }
        line += it.str; lastY = y;
        if (it.hasEOL) { out += line + '\n'; line = ''; lastY = null; }
      }
      out += line;
      pages.push(out.trim());
      chars += out.replace(/\s/g, '').length;
      if (chars > MAX_CHARS) break;
    }
    // 几乎没有文字 → 扫描件，渲染成图片
    if (chars < 8 * pages.length) {
      const images = [];
      const n = Math.min(doc.numPages, 10);
      for (let i = 1; i <= n; i++) {
        onProgress && onProgress(`扫描件，正在转换第 ${i}/${n} 页`);
        const page = await doc.getPage(i);
        const vp0 = page.getViewport({ scale: 1 });
        const scale = Math.min(2, 1400 / Math.max(vp0.width, vp0.height));
        const vp = page.getViewport({ scale });
        const c = document.createElement('canvas');
        c.width = Math.round(vp.width); c.height = Math.round(vp.height);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        await page.render({ canvasContext: ctx, viewport: vp, canvas: c }).promise;
        images.push(c.toDataURL('image/jpeg', 0.82));
      }
      return { text: '', images, note: doc.numPages > n ? `（扫描件共 ${doc.numPages} 页，只识别了前 ${n} 页）` : '' };
    }
    return { text: pages.map((t, i) => `--- 第 ${i + 1} 页 ---\n${t}`).join('\n\n') };
  }

  async function readDocx(file) {
    const r = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return { text: r.value.replace(/\n{3,}/g, '\n\n').trim() };
  }

  const xmlText = (xml, tag) => {
    const out = [];
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'g');
    let m;
    while ((m = re.exec(xml))) out.push(m[1]);
    return out;
  };
  const unxml = s => s.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const natural = (a, b) => Number((a.match(/(\d+)\.xml$/) || [0, 0])[1]) - Number((b.match(/(\d+)\.xml$/) || [0, 0])[1]);

  async function readPptx(file) {
    const zip = await JSZip.loadAsync(file);
    const slides = Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort(natural);
    const out = [];
    for (let i = 0; i < slides.length; i++) {
      const xml = await zip.file(slides[i]).async('string');
      const paras = xmlText(xml, 'a:p').map(p => xmlText(p, 'a:t').map(unxml).join('')).filter(Boolean);
      out.push(`--- 第 ${i + 1} 页幻灯片 ---\n${paras.join('\n')}`);
    }
    return { text: out.join('\n\n') };
  }

  async function readXlsx(file) {
    const zip = await JSZip.loadAsync(file);
    const ssXml = zip.file('xl/sharedStrings.xml') ? await zip.file('xl/sharedStrings.xml').async('string') : '';
    const shared = xmlText(ssXml, 'si').map(si => xmlText(si, 't').map(unxml).join(''));
    const wb = zip.file('xl/workbook.xml') ? await zip.file('xl/workbook.xml').async('string') : '';
    const names = [...wb.matchAll(/<sheet [^>]*name="([^"]+)"/g)].map(m => unxml(m[1]));
    const sheets = Object.keys(zip.files).filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort(natural);
    const out = [];
    let chars = 0;
    for (let i = 0; i < sheets.length && chars < MAX_CHARS; i++) {
      const xml = await zip.file(sheets[i]).async('string');
      const rows = [];
      for (const r of xml.match(/<row[\s\S]*?<\/row>/g) || []) {
        const cells = [];
        for (const c of r.match(/<c [^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) || []) {
          const t = (c.match(/ t="(\w+)"/) || [])[1];
          let v = (c.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
          if (t === 's' && v != null) v = shared[Number(v)];
          else if (t === 'inlineStr') v = xmlText(c, 't').map(unxml).join('');
          else if (v != null) v = unxml(v);
          cells.push(v == null ? '' : v);
        }
        if (cells.some(Boolean)) rows.push(cells.join('\t'));
      }
      const block = `--- 工作表：${names[i] || i + 1} ---\n${rows.join('\n')}`;
      chars += block.length; out.push(block);
    }
    return { text: out.join('\n\n') };
  }

  /* 返回 { kind, name, size, text, images, note } */
  async function read(file, onProgress) {
    const e = ext(file.name);
    const base = { kind: kindOf(file.name), name: file.name, size: fmtSize(file.size) };
    let r;
    if (e === 'pdf') r = await readPdf(file, onProgress);
    else if (e === 'docx') r = await readDocx(file);
    else if (e === 'pptx') r = await readPptx(file);
    else if (e === 'xlsx') r = await readXlsx(file);
    else if (['doc', 'ppt', 'xls'].includes(e)) throw new Error(`暂不支持旧版 .${e} 格式，请另存为 .${e}x 后再试`);
    else if (['zip', 'rar', '7z', 'apk', 'exe', 'mp3', 'mp4', 'mov'].includes(e)) throw new Error(`不支持 .${e} 文件`);
    else r = { text: await file.text() };
    if (r.text && r.text.length > MAX_CHARS) { r.text = r.text.slice(0, MAX_CHARS); r.note = '（文件太长，只读取了前 30 万字）'; }
    if (!r.text && !(r.images && r.images.length)) throw new Error('没有从文件中读到文字');
    return { ...base, ...r };
  }

  return { read, kindOf, fmtSize };
})();
