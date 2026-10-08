async page => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.testHtml = '<!doctype html>\r\n<html><head><style>/* Example: <body class="intern"> */ body{margin:0;background:rgb(245,241,232)}main{padding:40px;max-width:800px;margin:auto}h1{color:rgb(140,106,76);font:40px Arial}@media(max-width:600px){main{padding:12px}}</style></head><body><main><h1>Originaltitel</h1><p>Ein Absatz.</p><a href="https://example.invalid/">Externer Link</a></main><script>window.untrustedRan=true;<\/script></body></html>';
    window.mockDocument = {id:1,name:'layout.html',path:'/test/layout.html',text:window.testHtml};
    window.mockWrites = [];
    window.__TAURI__ = {core:{invoke:async (cmd,args) => {
      if(cmd==='open_document') return window.mockDocument;
      if(cmd==='release_document') return;
      if(cmd==='read_resource') throw 'unavailable';
      if(cmd==='save_document') {window.mockWrites.push(args.content);return {name:window.mockDocument.name,path:window.mockDocument.path};}
      if(cmd==='export_pdf') {window.mockPrint=args.html;return;}
      throw new Error(cmd);
    }},event:{listen:async()=>()=>{}}};
  });
  await page.goto('http://127.0.0.1:17893');
  await page.locator('#btnOpen').click();
  await page.locator('body.file-loaded').waitFor();
  const edit = page.frameLocator('#hviewer');
  const background = await edit.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor);
  if(background!=='rgb(245, 241, 232)') throw new Error('CSS comment removed document layout: '+background);
  await edit.locator('h1').click({position:{x:40,y:20}});
  await edit.locator('[contenteditable]').fill('Geänderter Titel');
  // Do not press Enter: switching view must commit the pending edit itself.
  await page.getByRole('button',{name:'Vorschau',exact:true}).click();
  const preview = page.frameLocator('#previewViewer');
  await preview.getByText('Geänderter Titel',{exact:true}).waitFor();
  if(await page.locator('#hWrap').isVisible()) throw new Error('Edit view still visible');
  if(await preview.locator('[contenteditable],script,.ve-edit,#ve-del').count()) throw new Error('Preview contains editor controls or scripts');
  const styles = await preview.locator('h1').evaluate(el=>({color:getComputedStyle(el).color,size:getComputedStyle(el).fontSize}));
  if(styles.color!=='rgb(140, 106, 76)'||styles.size!=='40px') throw new Error('Preview lost original styling');
  await preview.locator('h1').click();
  if(await preview.locator('[contenteditable]').count()) throw new Error('Preview became editable');
  await preview.getByText('Externer Link',{exact:true}).click();
  await preview.getByText('Geänderter Titel',{exact:true}).waitFor();
  if(!await page.evaluate(()=>isDirty())) throw new Error('View switch cleared dirty state');
  await page.getByRole('button',{name:'Vorschau',exact:true}).focus();
  await page.keyboard.press('Meta+z');
  if(!await page.evaluate(()=>hCurrentText().includes('Geänderter Titel'))) throw new Error('Preview shortcut changed hidden editor');
  await page.locator('#btnSave').click();
  const correct = await page.evaluate(()=>mockWrites.length===1&&mockWrites[0]===testHtml.replace('Originaltitel','Geänderter Titel'));
  if(!correct) throw new Error('Saving from preview changed source unexpectedly');
  await page.locator('#btnExpPdf').click();
  if(!await page.evaluate(()=>mockPrint.includes('Geänderter Titel')&&!mockPrint.includes('<script'))) throw new Error('PDF export mismatch');
  await page.getByRole('button',{name:'Bearbeiten',exact:true}).click();
  await edit.locator('h1').click({position:{x:40,y:20}});
  await edit.locator('[contenteditable]').fill('Zweite Änderung');
  await edit.locator('[contenteditable]').press('Enter');
  await page.getByRole('button',{name:'Vorschau',exact:true}).click();
  await preview.getByText('Zweite Änderung',{exact:true}).waitFor();
  await page.locator('#btnSave').click();
  await page.evaluate(()=>{window.mockDocument={id:2,name:'note.md',path:'/test/note.md',text:'# Markdown'};});
  await page.locator('#btnOpen').click();
  await page.locator('#markdownEditor .md-h1').filter({hasText:'Markdown'}).waitFor();
  if(await page.locator('#htmlViewSwitch').isVisible()||await page.locator('#previewWrap').isVisible()) throw new Error('HTML preview leaked into Markdown mode');
  if(errors.length) throw new Error(errors.join('\n'));
  return {cssCommentRegression:true,previewLayout:true,readOnly:true,unsavedChangesInPreview:true,sourcePreservingSave:true,returnToEdit:true,markdownReset:true,errors};
}
