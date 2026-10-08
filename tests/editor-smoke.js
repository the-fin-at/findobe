async page => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    window.mockWrites = [];
    window.mockDocument = {id:1, name:'demo.html', path:'/test/demo.html', text:'<!doctype html>\r\n<html lang="de"><head><meta charset="utf-8"><style>body{font:18px system-ui}</style></head><body><h1>Testtitel</h1><p>Originaltext mit Äpfeln.</p><script>window.untrustedRan=true;<\/script></body></html>'};
    window.__TAURI__ = {core:{invoke:async (cmd, args) => {
      if (cmd === 'open_document') return window.mockDocument;
      if (cmd === 'save_document') {if(window.mockFailure) throw 'Datei extern verändert'; window.mockWrites.push(args); return {name:window.mockDocument.name,path:window.mockDocument.path};}
      if (cmd === 'read_resource') throw 'unavailable';
      if (cmd === 'export_pdf') {window.mockPrint = args; return;}
      if (cmd === 'release_document') return;
      throw new Error('Unexpected command: ' + cmd);
    }},event:{listen:async()=>()=>{}}};
  });
  await page.goto('http://127.0.0.1:17893');
  await page.locator('#btnOpen').click();
  await page.locator('body.file-loaded').waitFor();
  const h = page.frameLocator('#hviewer');
  await h.locator('p').click({position:{x:70,y:12}});
  await h.locator('[contenteditable]').fill('Korrigierter Text mit Äpfeln.');
  await h.locator('[contenteditable]').press('Enter');
  await page.locator('#btnSave').click();
  await page.waitForFunction(() => window.mockWrites.length === 1);
  const html = await page.evaluate(() => window.mockWrites[0].content);
  if (!html.includes('Korrigierter Text mit Äpfeln.') || !html.includes('<script>window.untrustedRan=true;') || !html.includes('\r\n')) throw new Error('HTML source preservation failed');
  if (await h.locator('script').count()) throw new Error('Source script was not removed from preview');
  await page.locator('#btnExpPdf').click();
  const print = await page.evaluate(() => window.mockPrint);
  if (!print.html.includes('Korrigierter Text') || /<script/i.test(print.html)) throw new Error('PDF payload failed');
  await page.evaluate(() => {window.mockDocument={id:2,name:'demo.md',path:'/test/demo.md',text:'# Testtitel\r\n\r\nOriginaltext\r\n\r\n| Name | Wert |\r\n| --- | --- |\r\n| Eins | Zwei |\r\n'};});
  await page.locator('#btnOpen').click();
  await page.getByRole('button',{name:'Quelltext',exact:true}).click();
  const md = page.locator('#markdownEditor .cm-content');
  await md.fill('# Testtitel\n\nMarkdown geändert\n\n| Name | Wert |\n| --- | --- |\n| Eins | Zwei |\n');
  await page.locator('#btnSave').click();
  await page.waitForFunction(() => window.mockWrites.length === 2);
  const markdown = await page.evaluate(() => window.mockWrites[1].content);
  if (markdown !== '# Testtitel\r\n\r\nMarkdown geändert\r\n\r\n| Name | Wert |\r\n| --- | --- |\r\n| Eins | Zwei |\r\n') throw new Error('Markdown roundtrip failed: ' + JSON.stringify(markdown));
  await md.fill('Noch nicht gesichert');
  await page.locator('#btnOpen').click();
  await page.locator('#unsavedDialog[open]').waitFor();
  await page.getByRole('button', {name:'Abbrechen',exact:true}).click();
  if (!await md.innerText().then(t=>t.includes('Noch nicht gesichert'))) throw new Error('Cancel lost content');
  await page.evaluate(() => {window.mockFailure=true;});
  await page.locator('#btnSave').click();
  await page.locator('#errorbar').filter({hasText:'extern verändert'}).waitFor();
  if (!await page.evaluate(() => isDirty())) throw new Error('Failed save cleared unsaved state');
  if (errors.length) throw new Error(errors.join('\n'));
  return {htmlSourcePreserved:true,markdownRoundtrip:true,pdfPayload:true,unsavedGuard:true,saveFailureRetainsChanges:true,errors};
}
