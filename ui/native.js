'use strict';
// The editor works on source-preserving text spans. Rust owns all file writes.
const tabHost = window.parent !== window && window.parent.FinDobeTabs;
const native = tabHost ? window.parent.__TAURI__ : window.__TAURI__;
if (tabHost) {
  document.body.classList.add('tab-document');
  const pdfTools = document.createElement('div');
  pdfTools.id = 'pdfToolbar'; pdfTools.className = 'pdfonly';
  for (const id of ['zoomOut','zoomVal','zoomIn','zoomFit']) pdfTools.append($('#'+id));
  $('#documentbar').after(pdfTools);
}
let activeDocument = null, working = false, openingDocument = false, actionPending = false, pdfViewPending = false, pdfHistoryPending = false, resourceCache = new Map();
const call = (command, args = {}) => native.core.invoke(command, args);
let htmlView = 'edit', previewScroll = 0;
let markdownEditor = null, markdownView = 'write';
const markdownPreview = $('#markdownPreview');
// Native Markdown uses one continuous editor; no legacy text-span rendering.
mRender = () => {};
async function renderMarkdownPreview() {
  const revision = ++markdownPreviewRevision, source = mExportHtml();
  await refreshResources(source);
  if (revision !== markdownPreviewRevision || markdownView !== 'preview' || mode !== 'md') return;
  markdownPreview.srcdoc = safePreview(source, {readOnly:true});
}
function setMarkdownView(view) {
  if (working || mode !== 'md' || !markdownEditor) return;
  markdownView = view;
  markdownPreviewRevision++;
  findCloseBar();
  if (view === 'preview') renderMarkdownPreview();
  else markdownEditor.setMode(view);
  reflectView();
  if (view !== 'preview') markdownEditor.focus();
}
markdownPreview.addEventListener('load', () => {
  const doc = markdownPreview.contentDocument;
  if (!doc) return;
  doc.addEventListener('keydown', nativeShortcut, true);
  doc.addEventListener('click', e => {
    const link = e.target.closest?.('a[href]');
    if (link) {
      e.preventDefault();
      const href = link.getAttribute('href');
      if (href.startsWith('#')) {try {doc.getElementById(decodeURIComponent(href.slice(1)))?.scrollIntoView();} catch {}}
    }
    if (e.target.matches('input,button')) e.preventDefault();
  }, true);
});
const previewViewer = $('#previewViewer');
const htmlEditHint = 'Text anklicken · Enter = Übernehmen · Tab = nächste Textstelle · Esc = Abbrechen · ' + KEY_SAVE + ' = Speichern';
function reflectView() {
  const md = mode === 'md' && !!activeDocument;
  $('#markdownToolbar').hidden = !md;
  $('#markdownWorkspace').hidden = !md;
  $('#markdownEditor').hidden = markdownView === 'preview';
  markdownPreview.hidden = markdownView !== 'preview';
  for (const button of document.querySelectorAll('[data-md-view]')) button.setAttribute('aria-pressed',String(button.dataset.mdView === markdownView));
  if (md) $('#hint').textContent = markdownView === 'preview'
    ? 'Vorschau · Nur lesen · ' + KEY_SAVE + ' = Speichern'
    : markdownView === 'source' ? 'Markdown-Quelltext · ' + KEY_SAVE + ' = Speichern'
    : 'Markdown schreiben · Syntax an der aktuellen Zeile sichtbar · ' + KEY_SAVE + ' = Speichern';
  const preview = mode === 'html' && htmlView === 'preview';
  $('#htmlViewSwitch').hidden = mode !== 'html' || !activeDocument;
  document.body.classList.toggle('html-preview', preview);
  $('#previewWrap').hidden = !preview;
  $('#hWrap').inert = preview;
  $('#btnEditView').setAttribute('aria-pressed', String(!preview));
  $('#btnPreviewView').setAttribute('aria-pressed', String(preview));
  if (mode === 'html') $('#hint').textContent = preview
    ? 'Vorschau · Originalgestaltung ohne Editierhilfen · Änderungen werden erst mit „Speichern“ gesichert'
    : htmlEditHint;
}
async function setHtmlView(view) {
  if (working || !activeDocument || mode !== 'html' || !await flushEdits()) return;
  if (view === htmlView) return;
  if (htmlView === 'preview') previewScroll = previewViewer.contentWindow?.scrollY || 0;
  findCloseBar();
  htmlView = view;
  if (view === 'preview') {
    // Render the current source, never the instrumented editing DOM.
    previewViewer.srcdoc = safePreview(hCurrentText(), {readOnly:true});
  }
  reflectView();
}
previewViewer.addEventListener('load', () => {
  const doc = previewViewer.contentDocument;
  if (!doc || !previewViewer.srcdoc) return;
  previewViewer.contentWindow.scrollTo(0, previewScroll);
  doc.addEventListener('click', e => {
    const link = e.target.closest?.('a[href]');
    if (!link) return;
    e.preventDefault();
    const href = link.getAttribute('href');
    if (href.startsWith('#')) {
      try { doc.getElementById(decodeURIComponent(href.slice(1)))?.scrollIntoView(); } catch (_) {}
    }
  }, true);
  doc.addEventListener('keydown', nativeShortcut, true);
});
const editorFindOpen = findOpen;
findOpen = () => {
  if (mode === 'md' && markdownEditor) {
    if (markdownView === 'preview') setMarkdownView('write');
    markdownEditor.search(); return;
  }
  if (htmlView === 'preview') setHtmlView('edit');
  editorFindOpen();
};

async function flushEdits() {
  if (mode === 'pdf') { await closeEditBox(true); return !editState; }
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
  publishTabState();
}
function publishTabState() {
  if (tabHost) tabHost.changed(window);
}
function reflectDocument() {
  if (!activeDocument) return;
  $('#fileName').textContent = activeDocument.name;
  $('#fileName').title = activeDocument.path;
  $('#fileType').textContent = mode === 'pdf' ? 'PDF' : mode === 'html' ? 'HTML' : /\.txt$/i.test(activeDocument.name) ? 'TEXT' : 'MARKDOWN';
  document.title = activeDocument.name + ' — FinDobe';
  syncSaveUi();
  reflectView();
  publishTabState();
}
syncSaveUi = () => {
  btnSave.textContent = 'Speichern';
  btnSave.title = 'Änderungen direkt in der geöffneten Datei speichern';
};
recentAdd = async () => {};
recentRender = async () => {};
savedStatusText = () => lastSaved ? '✓ Gespeichert · ' + lastSaved.toLocaleTimeString('de-AT', {hour:'2-digit', minute:'2-digit'}) : 'Keine Änderungen';

save = async function nativeSave(saveAs = false) {
  // Reserve before the first await: flush may itself await a PDF commit.
  if (working || actionPending || pdfViewPending || pdfHistoryPending || !activeDocument) return false;
  actionPending = true; publishTabState();
  try {
    if (!await flushEdits()) return false;
    if (typeof saveAs !== 'boolean') saveAs = false;
    if (!saveAs && !isDirty()) { flash('Alles gespeichert'); return true; }
    setWorking(true, 'Speichere Dokument…');
    const mods = mode === 'pdf' ? collectMods() : null;
    const inc = mods?.size ? await buildIncrement(fileBytes, mods, model) : null;
    const bytes = mode === 'pdf' ? (inc?.bytes || fileBytes) : null;
    const content = bytes ? encodeBinary(bytes) : currentContent();
    const saved = await call('save_document', {id:activeDocument.id, content, saveAs});
    if (!saved) return false;
    const moved = activeDocument.path !== saved.path;
    Object.assign(activeDocument, saved);
    if (moved) resetResourceCache(activeDocument.id);
    handle.name = saved.name;
    if (mode === 'html') {
      srcText = hCurrentText(); hBaseline = srcText;
      runs = scanHTML(srcText); decodeRuns(runs); alignRuns(hViewer.contentDocument);
    } else if (mode === 'pdf') {
      fileBytes = bytes;
      if (inc) { model.prev = inc.newStartxref; model.size = inc.newSize; }
      for (const p of model.pages) for (const stream of p.streams) { stream.origContent = stream.content; stream.modified = false; }
      pdfBaseDirty = false;
    } else mdOrig = mdText;
    lastSaved = new Date(); hideError(); updateStatus(); reflectDocument();
    if (moved && mode === 'md' && markdownView === 'preview') await renderMarkdownPreview();
    if (moved && mode === 'html') {
      await refreshResources(hCurrentText());
      if (htmlView === 'preview') previewViewer.srcdoc = safePreview(hCurrentText(), {readOnly:true});
    }
    return true;
  } catch (err) { showError('Speichern fehlgeschlagen: ' + err); return false; }
  finally { actionPending = false; setWorking(false); }
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
  if ($('#deleteSectionDialog').open || $('#unsavedDialog').open) return false;
  if (working || !await flushEdits()) return false;
  if (!isDirty()) return true;
  const choice = await askUnsaved();
  return choice === 'discard' || (choice === 'save' && await save());
}

// Each resource cache belongs to one document AND its current native path.
let resourceState = null, markdownPreviewRevision = 0;
function resetResourceCache(id) {
  resourceState = {id, cache:new Map(), pending:new Map()};
  resourceCache = resourceState.cache;
  markdownPreviewRevision++;
}
function resourceKey(value, base = '') {
  if (!value) return null;
  try {
    const decoded = decodeURIComponent(value.trim());
    if (/^(?:[a-z][\w+.-]*:|[\/\\]|#)/i.test(decoded) || decoded.includes('\0')) return null;
    // Keep a sentinel directory so ../ escaping the document root is rejected,
    // rather than normalized into an unrelated allowed resource.
    const resolved = new URL(decoded.replace(/\\/g, '/'), 'https://local.invalid/document/' + base);
    if (!resolved.pathname.startsWith('/document/')) return null;
    return decodeURIComponent(resolved.pathname.slice('/document/'.length));
  } catch { return null; }
}
async function cacheResources(text, state) {
  const failures = new Set(), visited = new Set();
  async function fetchOne(key, depth = 0) {
    if (!key || depth > 5 || visited.size >= 200) return;
    visited.add(key);
    if (state.cache.has(key)) return;
    if (state.pending.has(key)) {
      if (!await state.pending.get(key)) failures.add(key);
      return;
    }
    const request = (async () => {
      try {
        let data = await call('read_resource', {id:state.id, relative:key});
        if (/\.css$/i.test(key)) {
          let css = new TextDecoder().decode(Uint8Array.from(atob(data.split(',')[1]), c => c.charCodeAt(0)));
          for (const match of [...css.matchAll(/url\(\s*['"]?([^'"\)]+)['"]?\s*\)/g)]) {
            const child = resourceKey(match[1].trim(), key);
            // Avoid waiting on a CSS cycle in the same traversal.
            if (child && !visited.has(child)) await fetchOne(child, depth + 1);
            if (state.cache.has(child)) css = css.replace(match[0], 'url("' + state.cache.get(child) + '")');
          }
          data = cssDataUrl(css);
        }
        state.cache.set(key, data);
        return true;
      } catch { return false; }
    })();
    state.pending.set(key, request);
    try { if (!await request) failures.add(key); }
    finally { state.pending.delete(key); }
  }
  const doc = new DOMParser().parseFromString(text, 'text/html');
  const refs = [...doc.querySelectorAll('img[src],link[rel="stylesheet"][href],image[href]')]
    .map(el => el.getAttribute('src') || el.getAttribute('href'));
  for (const m of text.matchAll(/url\(\s*['"]?([^'"\)]+)['"]?\s*\)/g)) refs.push(m[1].trim());
  for (const ref of refs) {
    const key = resourceKey(ref);
    if (key) await fetchOne(key);
    else if (ref && !/^(?:data:|blob:|#)/i.test(ref)) failures.add(ref);
  }
  return failures;
}
async function refreshResources(source) {
  const state = resourceState;
  if (!state) return;
  const failures = await cacheResources(source, state);
  if (resourceState !== state) return;
  const bar = $('#resourceNotice');
  bar.hidden = !failures.size;
  bar.textContent = failures.size
    ? 'Einige Ressourcen konnten nicht geladen werden oder sind gesperrt: ' + [...failures].slice(0,5).join(', ')
      + '. Lokale Dateien müssen im Dokumentordner liegen.' : '';
}
function cssDataUrl(css) {
  const bytes = new TextEncoder().encode(css);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return 'data:text/css;base64,' + btoa(binary);
}
function resolveCssResources(css) {
  return css.replace(/url\(\s*['"]?([^'"\)]+)['"]?\s*\)/g, (all, url) => {
    const key = resourceKey(url.trim());
    return key && resourceCache.has(key) ? 'url("' + resourceCache.get(key) + '")' : all;
  });
}
function safePreview(source, {readOnly = false} = {}) {
  // WKWebView requires scripting enabled for parent-installed editing handlers.
  // Source code is sanitized first and a frame CSP prohibits document scripts.
  // DOMPurify removes style blocks containing tag-like text, even in CSS comments.
  // Keep CSS as separate data stylesheets, not raw HTML inserted after sanitizing.
  // The document CSP still blocks scripts and all remote CSS/image/font requests.
  const input = new DOMParser().parseFromString(source, 'text/html');
  const sheets = [];
  input.querySelectorAll('[data-fin-css]').forEach(el => el.removeAttribute('data-fin-css'));
  for (const style of input.querySelectorAll('style')) {
    if (style.namespaceURI !== 'http://www.w3.org/1999/xhtml') continue;
    style.setAttribute('data-fin-css', String(sheets.length));
    sheets.push(resolveCssResources(style.textContent));
    style.textContent = '';
  }
  const clean = DOMPurify.sanitize(input.documentElement.outerHTML, {WHOLE_DOCUMENT:true, ADD_TAGS:['link'],
    FORBID_TAGS:['script','iframe','object','embed','base','form','meta'], FORBID_ATTR:['srcdoc']});
  const doc = new DOMParser().parseFromString(clean, 'text/html');
  for (const style of doc.querySelectorAll('style[data-fin-css]')) {
    const css = sheets[Number(style.getAttribute('data-fin-css'))];
    if (css === undefined) { style.remove(); continue; }
    const link = doc.createElement('link');
    link.rel = 'stylesheet'; link.href = cssDataUrl(css);
    for (const attr of ['media','title']) if (style.hasAttribute(attr)) link.setAttribute(attr, style.getAttribute(attr));
    style.replaceWith(link);
  }
  if (readOnly) doc.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
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
    const replaced = resolveCssResources(css);
    if (attr) el.setAttribute(attr, replaced); else el.textContent = replaced;
  }
  const policy = doc.createElement('meta');
  policy.httpEquiv = 'Content-Security-Policy';
  policy.content = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline' data:; img-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'";
  doc.head.prepend(policy);
  return '<!doctype html>' + doc.documentElement.outerHTML;
}
window.prepareDocumentPreview = safePreview;

function encodeBinary(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
// All PDF mutations share one busy period, including Enter/blur commits.
const originalPdfApplyEdit = applyEdit;
applyEdit = async (...args) => {
  const restoreFocus = !!document.activeElement?.closest?.('.titem,#editBox');
  setWorking(true, 'Aktualisiere PDF…');
  try { return await originalPdfApplyEdit(...args); }
  finally { setWorking(false); if (restoreFocus) focusPdfItem(); }
};
const originalClosePdfEdit = closeEditBox;
let pdfCommit = null;
closeEditBox = async apply => {
  if (pdfCommit) return pdfCommit;
  pdfCommit = originalClosePdfEdit(apply);
  try { return await pdfCommit; }
  finally { pdfCommit = null; }
};
const originalPdfSetZoom = setZoom, originalPdfFitZoom = fitZoom;
async function changePdfView(action) {
  if (working || actionPending || pdfViewPending || pdfHistoryPending) return;
  if (tabHost && window.frameElement.hidden) return;
  const restoreFocus = !!document.activeElement?.closest?.('.titem,#editBox');
  pdfViewPending = true; publishTabState();
  try {
    if (!await flushEdits()) return;
    setWorking(true, 'Passe PDF-Ansicht an…');
    await action();
  } catch (err) { showError('PDF-Ansicht konnte nicht aktualisiert werden: ' + err); }
  finally { pdfViewPending = false; setWorking(false); if (restoreFocus) focusPdfItem(); }
}
setZoom = z => changePdfView(() => originalPdfSetZoom(z));
fitZoom = rerender => rerender ? changePdfView(() => originalPdfFitZoom(true)) : originalPdfFitZoom(false);
for (const name of ['pdfUndo','pdfRedo']) {
  const original = name === 'pdfUndo' ? pdfUndo : pdfRedo;
  const action = async () => {
    if (working || actionPending || pdfViewPending || pdfHistoryPending) return;
    const restoreFocus = !!document.activeElement?.closest?.('.titem,#editBox');
    pdfHistoryPending = true; setWorking(true, 'Aktualisiere PDF-Verlauf…');
    try { await original(); }
    finally { pdfHistoryPending = false; setWorking(false); if (restoreFocus) focusPdfItem(); }
  };
  if (name === 'pdfUndo') pdfUndo = action; else pdfRedo = action;
}
function mdHtmlForResources(text) { return mdParse(text).html; }
async function loadNative(opened) {
  const old = activeDocument;
  const bytes = opened.encoding === 'base64' ? Uint8Array.from(atob(opened.text), c => c.charCodeAt(0)) : new TextEncoder().encode(opened.text);
  const h = {name:opened.name, getFile:async () => new File([bytes], opened.name)};
  resetResourceCache(opened.id);
  if (!/\.pdf$/i.test(opened.name)) {
    const source = /\.html?$/i.test(opened.name) ? opened.text : mdHtmlForResources(opened.text);
    await refreshResources(source);
  }
  if (/\.html?$/i.test(opened.name)) await hLoadBytes(h, bytes);
  else if (/\.pdf$/i.test(opened.name)) {
    try { await loadPdfBytes(h, bytes); }
    catch (err) {
      console.error('PDF load failed', err);
      throw new Error('Diese PDF-Datei ist beschädigt oder hat eine nicht unterstützte Struktur. Bitte erneut als unverschlüsselte PDF exportieren.');
    }
  }
  else await mLoadBytes(h, bytes);
  if (handle !== h) { await call('release_document', {id:opened.id}); return; }
  markdownEditor?.destroy(); markdownEditor = null;
  markdownView = 'write'; markdownPreview.srcdoc = '';
  if (mode === 'md') markdownEditor = window.FinMarkdown.create($('#markdownEditor'), mdText, text => {
    mdText = text; updateStatus();
  });
  activeDocument = opened;
  htmlView = 'edit'; previewScroll = 0; previewViewer.srcdoc = '';
  if (old) await call('release_document', {id:old.id});
  if (mode === 'pdf') updateDocNotice(); else setNotice(null);
  reflectDocument(); updateStatus();
}
openPicker = async function nativeOpen(path) {
  if (tabHost) return tabHost.open(path);
  if (working || actionPending || pdfViewPending || pdfHistoryPending || openingDocument) return;
  openingDocument = true;
  try {
    if (!await mayLeave()) return;
    setWorking(true, 'Öffne Dokument…');
    const opened = typeof path === 'string' ? await call('open_path', {path}) : await call('open_document');
    if (opened) await loadNative(opened);
  } catch (err) { showError('Öffnen fehlgeschlagen: ' + err); }
  finally { setWorking(false); openingDocument = false; }
};

exportPdf = async () => {
  if (mode === 'pdf') return save(true);
  if (working || actionPending || pdfViewPending || pdfHistoryPending || !activeDocument) return;
  actionPending = true; publishTabState();
  try {
    if (!await flushEdits()) return;
    setWorking(true, 'Bereite PDF vor…');
    await refreshResources(mode === 'html' ? hCurrentText() : mExportHtml());
    const html = safePreview(mode === 'html' ? hCurrentText() : mExportHtml());
    await call('export_pdf', {html:injectPrintCss(html), name:exportBaseName()});
    setNotice(IS_MAC ? 'PDF-Export: Im Druckdialog unten „PDF“ → „Als PDF sichern…“ wählen.' : 'PDF-Export: Im Druckdialog „Microsoft Print to PDF“ auswählen und speichern.');
  } catch (err) { showError('PDF-Export fehlgeschlagen: ' + err); }
  finally { actionPending = false; setWorking(false); }
};
function onClick(selector, action) {
  $(selector).addEventListener('click', e => { e.preventDefault(); e.stopImmediatePropagation(); action(); }, true);
}
onClick('#btnOpen', () => openPicker());
onClick('#btnStartOpen', () => openPicker());
onClick('#btnSave', () => save());
onClick('#btnSaveAs', () => save(true));
onClick('#btnSearch', () => findOpen());
onClick('#btnExpPdf', () => exportPdf());
onClick('#btnEditView', () => setHtmlView('edit'));
onClick('#btnPreviewView', () => setHtmlView('preview'));
for (const button of document.querySelectorAll('[data-md-view]')) button.addEventListener('click', () => setMarkdownView(button.dataset.mdView));
window.confirmSectionDelete = h => new Promise(resolve => {
  const dialog = $('#deleteSectionDialog');
  if (dialog.open) { resolve(false); return; }
  const original = h;
  $('#deleteSectionName').textContent = '„' + h.textContent.trim() + '“';
  delHighlight(h);
  const finish = confirmed => {
    dialog.close(); dialog.onclick = null; dialog.oncancel = null;
    hideDelBtn(); resolve(confirmed && original.isConnected);
  };
  dialog.onclick = e => {
    const choice = e.target.closest('[data-delete-choice]')?.dataset.deleteChoice;
    if (choice) finish(choice === 'delete');
    else if (e.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) finish(false);
    }
  };
  dialog.oncancel = e => {e.preventDefault(); finish(false);};
  dialog.showModal(); dialog.querySelector('[data-delete-choice="cancel"]').focus();
});
// One short, non-blocking startup animation. No replay when switching documents.
document.fonts.ready.then(() => {
  if (!handle && !matchMedia('(prefers-reduced-motion: reduce)').matches) $('#startupTitle').classList.add('typing');
});
function nativeShortcut(e) {
  if (tabHost && tabHost.shortcut(e)) return true;
  if (!(e.metaKey || e.ctrlKey)) return;
  const key = e.key.toLowerCase();
  if (document.querySelector('dialog[open]') && /^(z|y|o|p|s|f)$/.test(key)) {
    e.preventDefault(); e.stopImmediatePropagation(); return true;
  }
  if (mode === 'md' && markdownEditor && (key === 'z' || key === 'y')) {
    if (e.target.closest?.('.cm-search') && e.target.matches('input,textarea')) {
      e.stopImmediatePropagation(); return true;
    }
    e.preventDefault(); e.stopImmediatePropagation();
    if (markdownView !== 'preview') {
      if (key === 'y' || e.shiftKey) markdownEditor.redo(); else markdownEditor.undo();
    }
    return true;
  }
  if (mode === 'md' && key === 'f') {
    e.preventDefault(); e.stopImmediatePropagation(); findOpen(); return true;
  }
  if (htmlView === 'preview' && (key === 'z' || key === 'y')) {
    // Preview is read-only, including editor shortcuts while a toolbar button has focus.
    e.preventDefault(); e.stopImmediatePropagation(); return true;
  }
  if (key === 'o' || key === 's' || key === 'p') {
    e.preventDefault(); e.stopImmediatePropagation();
    if (key === 'o') openPicker(); else if (key === 'p') exportPdf(); else save(e.shiftKey);
    return true;
  } else if (key === 'f' && htmlView === 'preview') {
    e.preventDefault(); e.stopImmediatePropagation(); findOpen(); return true;
  }
  return false;
}
window.handleDocumentShortcut = nativeShortcut;
window.addEventListener('keydown', nativeShortcut, true);
for (const frame of [hViewer, mViewer]) frame.addEventListener('load', () => {
  reflectDocument();
  const doc = frame.contentDocument;
  if (!doc) return;
  doc.addEventListener('keydown', nativeShortcut, true);
  doc.addEventListener('click', e => {
    const link = e.target.closest && e.target.closest('a[href]');
    if (link && !link.getAttribute('href').startsWith('#')) e.preventDefault();
  }, true);
});
if (native && !tabHost) {
  native.event.listen('request-close', async () => { if (await mayLeave()) await call('close_editor'); });
  native.event.listen('tauri://drag-drop', e => { overlayDrop.hidden = true; if (e.payload.paths?.length === 1) openPicker(e.payload.paths[0]); else showError('Bitte eine einzelne Datei ablegen.'); });
  native.event.listen('tauri://drag-enter', () => {overlayDrop.hidden = false;});
  native.event.listen('tauri://drag-leave', () => {overlayDrop.hidden = true;});
}
setNotice(null);
document.title = 'FinDobe · THE-FIN';
syncSaveUi();
if (native && !tabHost && window.FinDobeFileOpen) window.FinDobeFileOpen({
  listen: (event, handler) => native.event.listen(event, handler),
  takeNext: () => call('take_pending_files'),
  isBusy: () => working || actionPending || pdfViewPending || pdfHistoryPending || openingDocument || !!document.querySelector('dialog[open]'),
  open: path => openPicker(path),
  reportError: message => showError(message)
}).catch(error => showError('Dateiübergabe konnte nicht gestartet werden: ' + error));
if (tabHost) {
  const originalUpdateStatus = updateStatus;
  updateStatus = () => { originalUpdateStatus(); publishTabState(); };
  new MutationObserver(publishTabState).observe(document.body, {subtree:true,attributes:true,attributeFilter:['open']});
  window.FinDobeDocument = {
    async load(opened) {
      await loadNative(opened);
      if (!activeDocument) throw new Error($('#errorbar').textContent || 'Dokument konnte nicht geöffnet werden.');
    },
    info: () => ({...activeDocument, text:undefined, mode, editingPdf:mode === 'pdf' && !!editState, dirty:isDirty(), blocked:working || actionPending || pdfViewPending || pdfHistoryPending || openingDocument || !!document.querySelector('dialog[open]')}),
    flush: flushEdits,
    save: saveAs => save(saveAs),
    undo: async () => { if (await flushEdits()) await pdfUndo(); },
    redo: async () => { if (await flushEdits()) await pdfRedo(); },
    search: () => findOpen(),
    exportPdf: () => exportPdf(),
    activate: async () => {
      markdownEditor?.measure();
      if (mode === 'pdf') {
        pdfRenderingActive = true;
        if (fitMode) await fitZoom(true);
        await renderVisiblePdfPages();
      }
    },
    deactivate: async () => { if (mode === 'pdf') await suspendPdfRendering(); },
    dispose: () => {
      isDirty = () => false; markdownEditor?.destroy(); cancelPdfRendering(); pdfRenderingActive = false;
      if (model) for (const page of model.pages) releasePdfCanvas(page);
      pdfDoc?.destroy().catch(()=>{});
    }
  };
}
