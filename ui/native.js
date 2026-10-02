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
let activeDocument = null, working = false, openingDocument = false, resourceCache = new Map();
const call = (command, args = {}) => native.core.invoke(command, args);
let htmlView = 'edit', previewScroll = 0;
let markdownEditor = null, markdownView = 'write';
const markdownPreview = $('#markdownPreview');
// Native Markdown uses one continuous editor; no legacy text-span rendering.
mRender = () => {};
function renderMarkdownPreview() {
  markdownPreview.srcdoc = safePreview(mExportHtml(), {readOnly:true});
}
function setMarkdownView(view) {
  if (working || mode !== 'md' || !markdownEditor) return;
  markdownView = view;
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
  if (working || !activeDocument || !await flushEdits()) return false;
  if (typeof saveAs !== 'boolean') saveAs = false;
  if (!saveAs && !isDirty()) { flash('Alles gespeichert'); return true; }
  setWorking(true, 'Speichere Dokument…');
  try {
    const mods = mode === 'pdf' ? collectMods() : null;
    const inc = mods?.size ? await buildIncrement(fileBytes, mods, model) : null;
    const bytes = mode === 'pdf' ? (inc?.bytes || fileBytes) : null;
    const content = bytes ? encodeBinary(bytes) : currentContent();
    const saved = await call('save_document', {id:activeDocument.id, content, saveAs});
    if (!saved) return false;
    Object.assign(activeDocument, saved);
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
  if ($('#deleteSectionDialog').open || $('#unsavedDialog').open) return false;
  if (working || !await flushEdits()) return false;
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
  setWorking(true, 'Aktualisiere PDF…');
  try { return await originalPdfApplyEdit(...args); }
  finally { setWorking(false); }
};
const originalClosePdfEdit = closeEditBox;
let pdfCommit = null;
closeEditBox = async apply => {
  if (pdfCommit) return pdfCommit;
  pdfCommit = originalClosePdfEdit(apply);
  try { return await pdfCommit; }
  finally { pdfCommit = null; }
};
const originalPdfSetZoom = setZoom;
setZoom = async z => { if (!working && await flushEdits()) await originalPdfSetZoom(z); };
const originalPdfFitZoom = fitZoom;
fitZoom = async rerender => {
  if (editState || pdfCommit) { await closeEditBox(true); if (editState) return; }
  return originalPdfFitZoom(rerender);
};
async function loadNative(opened) {
  const old = activeDocument;
  const bytes = opened.encoding === 'base64' ? Uint8Array.from(atob(opened.text), c => c.charCodeAt(0)) : new TextEncoder().encode(opened.text);
  const h = {name:opened.name, getFile:async () => new File([bytes], opened.name)};
  resourceCache = /\.pdf$/i.test(opened.name) ? new Map() : await cacheResources(opened.text, opened.id);
  if (/\.html?$/i.test(opened.name)) await hLoadBytes(h, bytes);
  else if (/\.pdf$/i.test(opened.name)) await loadPdfBytes(h, bytes);
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
  if (working || openingDocument) return;
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
  if (working || !activeDocument || !await flushEdits()) return;
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
  if (tabHost && tabHost.shortcut(e)) return;
  if (!(e.metaKey || e.ctrlKey)) return;
  const key = e.key.toLowerCase();
  if (document.querySelector('dialog[open]') && /^(z|y|o|p|s|f)$/.test(key)) {
    e.preventDefault(); e.stopImmediatePropagation(); return;
  }
  if (mode === 'md' && markdownEditor && (key === 'z' || key === 'y')) {
    if (e.target.closest?.('.cm-search') && e.target.matches('input,textarea')) {
      e.stopImmediatePropagation(); return;
    }
    e.preventDefault(); e.stopImmediatePropagation();
    if (markdownView !== 'preview') {
      if (key === 'y' || e.shiftKey) markdownEditor.redo(); else markdownEditor.undo();
    }
    return;
  }
  if (mode === 'md' && key === 'f') {
    e.preventDefault(); e.stopImmediatePropagation(); findOpen(); return;
  }
  if (htmlView === 'preview' && (key === 'z' || key === 'y')) {
    // Preview is read-only, including editor shortcuts while a toolbar button has focus.
    e.preventDefault(); e.stopImmediatePropagation(); return;
  }
  if (key === 'o' || key === 's' || key === 'p') {
    e.preventDefault(); e.stopImmediatePropagation();
    if (key === 'o') openPicker(); else if (key === 'p') exportPdf(); else save(e.shiftKey);
  } else if (key === 'f' && htmlView === 'preview') {
    e.preventDefault(); e.stopImmediatePropagation(); findOpen();
  }
}
window.addEventListener('keydown', nativeShortcut, true);
for (const frame of [hViewer, mViewer]) frame.addEventListener('load', () => {
  reflectDocument();
  const doc = frame.contentDocument;
  if (!doc) return;
  doc.addEventListener('keydown', e => {
    if (tabHost && tabHost.shortcut(e)) return;
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
  isBusy: () => working || openingDocument || !!document.querySelector('dialog[open]'),
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
    info: () => ({...activeDocument, text:undefined, mode, editingPdf:mode === 'pdf' && !!editState, dirty:isDirty(), blocked:working || openingDocument || !!document.querySelector('dialog[open]')}),
    flush: flushEdits,
    save: saveAs => save(saveAs),
    undo: async () => { if (await flushEdits()) await pdfUndo(); },
    redo: async () => { if (await flushEdits()) await pdfRedo(); },
    search: () => findOpen(),
    exportPdf: () => exportPdf(),
    activate: async () => {
      markdownEditor?.measure();
      if (mode === 'pdf') {
        setWorking(true, 'Passe PDF-Ansicht an…');
        try { if (fitMode) await fitZoom(true); }
        catch (err) { showError(String(err)); }
        finally { setWorking(false); }
      }
    },
    dispose: () => { isDirty = () => false; markdownEditor?.destroy(); }
  };
}
