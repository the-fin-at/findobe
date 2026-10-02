async page => {
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    if(window!==top)return;
    window.writes=[];window.docs=new Map();window.files={};let id=0;
    window.__TAURI__={core:{invoke:async(cmd,args={})=>{
      if(cmd==='take_pending_files')return null;
      if(cmd==='open_path'){const d={id:++id,path:args.path,name:args.path.split('/').pop(),...files[args.path]};docs.set(id,d);return {...d};}
      if(cmd==='release_document'){docs.delete(args.id);return;}
      if(cmd==='save_document'){
        if(window.failSave)throw Error('Datei extern verändert');
        if(args.saveAs&&window.cancelSave)return null;
        const d=docs.get(args.id); if(args.saveAs){d.path='/copy.pdf';d.name='copy.pdf';}
        files[d.path]={text:args.content,encoding:d.encoding};writes.push({...args,path:d.path});return {name:d.name,path:d.path};
      }
      if(cmd==='read_resource')throw Error('Unavailable');
      throw Error('Unexpected '+cmd);
    }},event:{listen:async()=>()=>{}}};
  });
  await page.goto('http://127.0.0.1:17893/tabs.html');
  await page.evaluate(async()=>{
    const script=document.createElement('script');script.src='pdf-lib.js';document.head.append(script);await new Promise(r=>script.onload=r);
    const doc=await PDFLib.PDFDocument.create();const font=await doc.embedFont(PDFLib.StandardFonts.Helvetica);
    const p=doc.addPage([595,842]);p.drawText('Original PDF Text',{x:60,y:750,size:22,font});p.drawText('Zweite Zeile bleibt gleich.',{x:60,y:700,size:14,font});
    const bytes=await doc.save({useObjectStreams:false});
    files['/test.pdf']={text:btoa(String.fromCharCode(...bytes)),encoding:'base64'};
    files['/note.md']={text:'# Notiz\n\nUnveraendert',encoding:'utf8'};
    await FinDobeTabs.open('/test.pdf');
  });
  const frame=()=>page.frameLocator('.document-frame:not([hidden])');
  await frame().locator('canvas').waitFor();
  await page.waitForFunction(()=>!busy&&!active.api.info().blocked);
  // Click the actual text overlay, then save with the input still open.
  const hits=frame().locator('.overlay > div');
  await hits.first().click(); await frame().locator('#editBox').fill('Geaenderter PDF Text');
  await page.locator('#btnSave').click();
  await page.waitForFunction(()=>writes.length===1&&!active.api.info().dirty&&!active.api.info().blocked);
  const text=async()=>page.evaluate(async()=>{
    const w=active.frame.contentWindow;return w.eval('(async()=>{const p=await pdfDoc.getPage(1);return (await p.getTextContent()).items.map(i=>i.str).join(" ")})()');
  });
  if(!(await text()).includes('Geaenderter PDF Text'))throw Error('Rendered saved text missing');
  await hits.first().click();await frame().locator('#editBox').fill('Noch ein PDF Text');await frame().locator('#editBox').press('Enter');
  await page.waitForFunction(()=>active.api.info().dirty&&!active.api.info().blocked);
  await page.evaluate(()=>FinDobeTabs.open('/note.md'));
  await page.locator('.tab-select').first().click();
  await page.waitForFunction(()=>active.api.info().mode==='pdf'&&!active.api.info().blocked);
  if(!(await text()).includes('Noch ein PDF Text'))throw Error('Tab switch lost PDF edit');
  await frame().locator('body').press('ControlOrMeta+z');
  await page.waitForFunction(()=>!busy&&!active.api.info().blocked);
  if(!(await text()).includes('Geaenderter PDF Text'))throw Error('Undo failed');
  await frame().locator('body').press('ControlOrMeta+Shift+z');
  await page.waitForFunction(()=>!busy&&!active.api.info().blocked);
  await page.evaluate(()=>{failSave=true;});await page.locator('#btnSave').click();
  await frame().locator('#errorbar').filter({hasText:'extern'}).waitFor();
  if(!await page.evaluate(()=>active.api.info().dirty))throw Error('Failed save cleared edits');
  await page.evaluate(()=>{failSave=false;cancelSave=true;});await page.locator('#btnSaveAs').click();
  await page.waitForFunction(()=>!busy&&!active.api.info().blocked);
  if(!await page.evaluate(()=>active.api.info().dirty))throw Error('Cancelled save cleared edits');
  await page.evaluate(()=>{cancelSave=false;});await page.locator('#btnSaveAs').click();
  await page.waitForFunction(()=>writes.length===2&&!active.api.info().dirty).catch(async e=>{console.log(await page.evaluate(()=>({writes:writes.map(w=>({path:w.path,length:w.content.length})),info:active.api.info(),error:active.frame.contentDocument.querySelector('#errorbar').textContent,busy})));throw e;});
  await page.evaluate(()=>FinDobeTabs.open('/copy.pdf'));
  if(await page.locator('.document-tab').count()!==2)throw Error('Duplicate save-as tab');
  await page.locator('.tab-close').first().click();
  await page.waitForFunction(()=>tabs.length===1);
  await page.evaluate(()=>FinDobeTabs.open('/copy.pdf'));
  if(!(await text()).includes('Noch ein PDF Text'))throw Error('Reopen lost saved bytes');
  const output=await page.evaluate(()=>files['/copy.pdf'].text);
  await page.screenshot({path:'/tmp/findobe-pdf-editor.png',fullPage:true});
  await frame().locator('.overlay > div').first().click();
  await frame().locator('#editBox').fill('Nicht verfuegbar 😀');
  await page.locator('#btnSave').click();
  await frame().locator('#editErr').waitFor();
  if(await page.evaluate(()=>writes.length)!==2)throw Error('Unsupported glyph was saved');
  await page.locator('.tab-select').first().click();
  if(!await page.evaluate(()=>active.api.info().mode==='pdf'))throw Error('Invalid edit lost during tab switch');
  await frame().locator('#editBox').press('Escape');
  await page.evaluate(async()=>{
    const d=await PDFLib.PDFDocument.create();d.addPage([595,842]);const b=await d.save();
    files['/scan.pdf']={text:btoa(String.fromCharCode(...b)),encoding:'base64'};
    await FinDobeTabs.open('/scan.pdf');
  });
  await frame().locator('#noticebar').filter({hasText:'kein bearbeitbarer Text'}).waitFor();
  if(errors.length)throw Error(errors.join('\n'));
  return {output,checks:'Edit, save from open input, tabs, undo/redo, failed/cancelled save, Save As, reopen'};
}
