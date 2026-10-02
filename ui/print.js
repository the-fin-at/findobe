'use strict';
(async () => {
  try {
    const invoke = window.__TAURI__.core.invoke;
    const html = await invoke('print_content');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script,iframe,object,embed,base,meta[http-equiv]').forEach(el => el.remove());
    for (const el of doc.querySelectorAll('*')) for (const attr of [...el.attributes]) if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
    // Copy styles and body attributes so the print result keeps the source layout.
    const stylesReady = [];
    for (const el of doc.head.querySelectorAll('style,link[rel="stylesheet"]')) {
      const copy = document.importNode(el, true);
      if (copy.tagName === 'LINK') stylesReady.push(new Promise(resolve => {
        copy.onload = resolve; copy.onerror = resolve; setTimeout(resolve, 4000);
      }));
      document.head.appendChild(copy);
    }
    for (const attr of [...doc.documentElement.attributes]) document.documentElement.setAttribute(attr.name, attr.value);
    for (const attr of [...doc.body.attributes]) document.body.setAttribute(attr.name, attr.value);
    document.body.innerHTML = doc.body.innerHTML;
    const screen = document.createElement('style');
    screen.textContent = '@media screen{body{padding:24px!important;margin:0 auto!important;max-width:1100px!important}#fin-print-toolbar{position:sticky;top:0;z-index:2147483647;background:#F5F1E8;border:1px solid #D3C6B4;border-radius:8px;padding:14px;margin-bottom:24px;font:13px system-ui;color:#25221D}#fin-print-toolbar button{margin-left:12px;padding:7px 14px;background:#25221D;color:#F5F1E8;border:0;border-radius:5px;cursor:pointer}}@media print{#fin-print-toolbar{display:none!important}}';
    document.head.appendChild(screen);
    const toolbar = document.createElement('div'); toolbar.id = 'fin-print-toolbar';
    toolbar.textContent = 'PDF-Export über den Systemdialog. Wähle dort „Als PDF sichern“ bzw. „Microsoft Print to PDF“.';
    const button = document.createElement('button'); button.textContent = 'PDF / Drucken';
    button.onclick = () => invoke('print_ready').catch(err => {toolbar.textContent = String(err);});
    toolbar.appendChild(button); document.body.prepend(toolbar);
    await Promise.all([...document.images].map(img => img.complete ? Promise.resolve() : new Promise(resolve => {img.onload = resolve; img.onerror = resolve; setTimeout(resolve, 4000);} )));
    await Promise.all(stylesReady);
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await invoke('print_ready');
  } catch (err) { document.body.textContent = 'PDF-Export fehlgeschlagen: ' + err; }
})();
