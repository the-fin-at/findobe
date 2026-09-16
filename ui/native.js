'use strict';
// The editor works on source-preserving text spans. Rust owns all file writes.
const native = window.__TAURI__;
let activeDocument = null, working = false, resourceCache = new Map();
const call = (command, args = {}) => native.core.invoke(command, args);

function flushEdits() {
  if (mode === 'html') { if (editSpan) hEndEdit(true); return !editSpan; }
  if (mode === 'md') return mFlushPending();
  return true;
}
function currentContent() {
  if (mode === 'html') return (hasBOM ? '\uFEFF' : '') + hCurrentText();
  if (mode === 'md') return (mdBOM ? '\uFEFF' : '') + mdText;
  throw new Error('Bitte zuerst ein Dokument öffnen.');
}
function setWorking(value, message) {
  working = value;
  document.body.inert = value;
  busy(value ? message : null);
}
function reflectDocument() {
  if (!activeDocument) return;
  $('#fileName').textContent = activeDocument.name;
  $('#fileName').title = activeDocument.path;
  $('#fileType').textContent = mode === 'html' ? 'HTML' : /\.txt$/i.test(activeDocument.name) ? 'TEXT' : 'MARKDOWN';
  document.title = activeDocument.name + ' — FinDobe';
  syncSaveUi();
}
syncSaveUi = () => {
  btnSave.textContent = 'Speichern';
  btnSave.title = 'Änderungen direkt in der geöffneten Datei speichern';
};
recentAdd = async () => {};
recentRender = async () => {};
savedStatusText = () => lastSaved ? '✓ Gespeichert · ' + lastSaved.toLocaleTimeString('de-AT', {hour:'2-digit', minute:'2-digit'}) : 'Keine Änderungen';

save = async function nativeSave(saveAs = false) {
  if (working || !activeDocument || !flushEdits()) return false;
  if (typeof saveAs !== 'boolean') saveAs = false;
  const content = currentContent();
  if (!saveAs && !isDirty()) { flash('Alles gespeichert'); return true; }
  setWorking(true, 'Speichere Dokument…');
  try {
    const saved = await call('save_document', {id:activeDocument.id, content, saveAs});
    if (!saved) return false;
    Object.assign(activeDocument, saved);
    handle.name = saved.name;
    if (mode === 'html') {
      srcText = hCurrentText(); hBaseline = srcText;
      runs = scanHTML(srcText); decodeRuns(runs); alignRuns(hViewer.contentDocument);
    } else mdOrig = mdText;
    lastSaved = new Date(); hideError(); updateStatus(); reflectDocument();
    return true;
  } catch (err) { showError('Speichern fehlgeschlagen: ' + err); return false; }
  finally { setWorking(false); }
};

function askUnsaved() {
  return new Promise(resolve => {
    const dialog = $('#unsavedDialog');
    const choose = value => { dialog.close(); dialog.onclick = null; dialog.oncancel = null; resolve(value); };
    dialog.onclick = e => { if (e.target.dataset.choice) choose(e.target.dataset.choice); };
    dialog.oncancel = e => { e.preventDefault(); choose('cancel'); };
    dialog.showModal();
  });
}
async function mayLeave() {
  if (working || !flushEdits()) return false;
  if (!isDirty()) return true;
  const choice = await askUnsaved();
  return choice === 'discard' || (choice === 'save' && await save());
}

function resourceKey(value, base = '') {
  if (!value || /^(?:[a-z][\w+.-]*:|\/|#)/i.test(value)) return null;
  try {
    const resolved = new URL(value, 'https://local.invalid/' + base);
    return decodeURIComponent(resolved.pathname.slice(1));
  } catch { return null; }
}
async function cacheResources(text, id) {
  const cache = new Map(), pending = new Set();
  async function fetchOne(key, depth = 0) {
    if (!key || cache.has(key) || pending.has(key) || depth > 5 || pending.size > 200) return;
    pending.add(key);
    try {
      let data = await call('read_resource', {id, relative:key});
      if (/\.css$/i.test(key)) {
        let css = new TextDecoder().decode(Uint8Array.from(atob(data.split(',')[1]), c => c.charCodeAt(0)));
        const matches = [...css.matchAll(/url\(\s*['"]?([^'"\)]+)['"]?\s*\)/g)];
        for (const match of matches) {
          const child = resourceKey(match[1].trim(), key);
          await fetchOne(child, depth + 1);
          if (cache.has(child)) css = css.replace(match[0], 'url("' + cache.get(child) + '")');
        }
        const bytes = new TextEncoder().encode(css);
        let binary = '';
        for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        data = 'data:text/css;base64,' + btoa(binary);
      }
      cache.set(key, data);
    } catch (_) { /* An unavailable resource must not prevent editing the text. */ }
  }
  const doc = new DOMParser().parseFromString(text, 'text/html');
  const refs = [...doc.querySelectorAll('img[src],link[rel="stylesheet"][href],image[href]')]
    .map(el => resourceKey(el.getAttribute('src') || el.getAttribute('href')));
  for (const m of text.matchAll(/url\(\s*['"]?([^'"\)]+)['"]?\s*\)/g)) refs.push(resourceKey(m[1].trim()));
  for (const m of text.matchAll(/!\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) refs.push(resourceKey(m[1]));
  await Promise.all(refs.map(key => fetchOne(key)));
  return cache;
}
function safePreview(source) {
  // WKWebView requires scripting enabled for parent-installed editing handlers.
  // Source code is sanitized first and a frame CSP prohibits document scripts.
  const clean = DOMPurify.sanitize(source, {WHOLE_DOCUMENT:true, ADD_TAGS:['link'],
    FORBID_TAGS:['script','iframe','object','embed','base','form','meta'], FORBID_ATTR:['srcdoc']});
  const doc = new DOMParser().parseFromString(clean, 'text/html');
  doc.querySelectorAll('script,iframe,object,embed,base,meta[http-equiv],link[rel="import"]').forEach(el => el.remove());
  for (const el of doc.querySelectorAll('*')) {
    for (const attr of [...el.attributes]) {
      if (/^on/i.test(attr.name) || attr.name === 'srcdoc' || (['href','src','action','formaction','xlink:href'].includes(attr.name) && /^\s*javascript:/i.test(attr.value))) el.removeAttribute(attr.name);
    }
    for (const attr of ['src','href','xlink:href']) {
      const key = resourceKey(el.getAttribute(attr));
      if (key && resourceCache.has(key)) el.setAttribute(attr, resourceCache.get(key));
    }
    if (el.hasAttribute('srcset')) el.removeAttribute('srcset');
  }
  for (const el of doc.querySelectorAll('style,[style]')) {
    const attr = el.tagName === 'STYLE' ? null : 'style';
    const css = attr ? el.getAttribute(attr) : el.textContent;
    const replaced = css.replace(/url\(\s*['"]?([^'"\)]+)['"]?\s*\)/g, (all, url) => {
      const key = resourceKey(url.trim());
      return key && resourceCache.has(key) ? 'url("' + resourceCache.get(key) + '")' : all;
    });
    if (attr) el.setAttribute(attr, replaced); else el.textContent = replaced;
  }
  const policy = doc.createElement('meta');
  policy.httpEquiv = 'Content-Security-Policy';
  policy.content = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline' data:; img-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'";
  doc.head.prepend(policy);
  return '<!doctype html>' + doc.documentElement.outerHTML;
}
window.prepareDocumentPreview = safePreview;

async function loadNative(opened) {
  const old = activeDocument;
  const bytes = new TextEncoder().encode(opened.text);
  const h = {name:opened.name, getFile:async () => new File([bytes], opened.name)};
  resourceCache = await cacheResources(opened.text, opened.id);
  if (/\.html?$/i.test(opened.name)) await hLoadBytes(h, bytes);
  else await mLoadBytes(h, bytes);
  if (handle !== h) { await call('release_document', {id:opened.id}); return; }
  activeDocument = opened;
  if (old) await call('release_document', {id:old.id});
  setNotice(null); reflectDocument(); updateStatus();
}
openPicker = async function nativeOpen(path) {
  if (!await mayLeave()) return;
  setWorking(true, 'Öffne Dokument…');
  try {
    const opened = typeof path === 'string' ? await call('open_path', {path}) : await call('open_document');
    if (opened) await loadNative(opened);
  } catch (err) { showError('Öffnen fehlgeschlagen: ' + err); }
  finally { setWorking(false); }
};

exportPdf = async () => {
  if (working || !activeDocument || !flushEdits()) return;
  setWorking(true, 'Bereite PDF vor…');
  try {
    const html = safePreview(mode === 'html' ? hCurrentText() : mExportHtml());
    await call('export_pdf', {html:injectPrintCss(html), name:exportBaseName()});
    setNotice(IS_MAC ? 'PDF-Export: Im Druckdialog unten „PDF“ → „Als PDF sichern…“ wählen.' : 'PDF-Export: Im Druckdialog „Microsoft Print to PDF“ auswählen und speichern.');
  } catch (err) { showError('PDF-Export fehlgeschlagen: ' + err); }
  finally { setWorking(false); }
};
function onClick(selector, action) {
  $(selector).addEventListener('click', e => { e.preventDefault(); e.stopImmediatePropagation(); action(); }, true);
}
onClick('#btnOpen', () => openPicker());
onClick('#dropzoneBox', () => openPicker());
onClick('#btnSave', () => save());
onClick('#btnSaveAs', () => save(true));
onClick('#btnSearch', () => findOpen());
onClick('#btnExpPdf', () => exportPdf());
$('#dropzoneBox').tabIndex = 0;
$('#dropzoneBox').setAttribute('role', 'button');
$('#dropzoneBox').setAttribute('aria-label', 'Dokument öffnen');
$('#dropzoneBox').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') {e.preventDefault(); openPicker();} });
window.addEventListener('keydown', e => {
  if (!(e.metaKey || e.ctrlKey)) return;
  const key = e.key.toLowerCase();
  if (key === 'o' || key === 's' || key === 'p') {
    e.preventDefault(); e.stopImmediatePropagation();
    if (key === 'o') openPicker(); else if (key === 'p') exportPdf(); else save(e.shiftKey);
  }
}, true);
for (const frame of [hViewer, mViewer]) frame.addEventListener('load', () => {
  reflectDocument();
  const doc = frame.contentDocument;
  if (!doc) return;
  doc.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && /^(o|p|s)$/i.test(e.key)) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.key.toLowerCase() === 'o') openPicker(); else if (e.key.toLowerCase() === 'p') exportPdf(); else save(e.shiftKey);
    }
  }, true);
  doc.addEventListener('click', e => {
    const link = e.target.closest && e.target.closest('a[href]');
    if (link && !link.getAttribute('href').startsWith('#')) e.preventDefault();
  }, true);
});
if (native) {
  native.event.listen('request-close', async () => { if (await mayLeave()) await call('close_editor'); });
  native.event.listen('tauri://drag-drop', e => { overlayDrop.hidden = true; if (e.payload.paths?.length === 1) openPicker(e.payload.paths[0]); else showError('Bitte eine einzelne Datei ablegen.'); });
  native.event.listen('tauri://drag-enter', () => {overlayDrop.hidden = false;});
  native.event.listen('tauri://drag-leave', () => {overlayDrop.hidden = true;});
}
setNotice(null);
document.title = 'FinDobe · THE-FIN';
syncSaveUi();
