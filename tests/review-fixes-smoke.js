async page => {
  const errors=[], results={};
  page.on('pageerror', e=>errors.push(e.message));
  await page.addInitScript(()=>{
    if(window!==top)return;
    const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR1sAAAAASUVORK5CYII=';
    window.files={
      '/safe.html':'\uFEFF<!doctype html>\r\n<html><head><style>body{font:18px system-ui}</style></head><body><h1>Titel</h1><p>Originaltext</p><p>Zweiter Absatz</p><script>untrustedRan=true;<\/script></body></html>',
      '/note.md':'# Notiz\n',
      '/images/note.md':'# Bilder\n\n![vorhanden](old.png)\n',
      '/broken.pdf':{text:btoa('%PDF-1.7\nnot a valid PDF'),encoding:'base64'}
    };
    window.docs=new Map();window.calls=[];window.writes=[];window.maxSaves=0;window.inFlightSaves=0;
    window.saveDelay=0;window.cancelSaveAs=false;window.failSave=false;window.resourceDelay=0;let id=0;
    window.__TAURI__={core:{invoke:async(cmd,args={})=>{
      calls.push({cmd,args});
      if(cmd==='take_pending_files')return null;
      if(cmd==='open_path'){
        const f=files[args.path];if(!f)throw Error('Missing fixture');
        const d={id:++id,path:args.path,name:args.path.split('/').pop(),...(typeof f==='string'?{text:f,encoding:'utf8'}:f)};
        docs.set(d.id,d);return {...d};
      }
      if(cmd==='release_document'){docs.delete(args.id);return;}
      if(cmd==='save_document'){
        inFlightSaves++;maxSaves=Math.max(maxSaves,inFlightSaves);
        try {
          if(saveDelay)await new Promise(r=>setTimeout(r,saveDelay));
          if(failSave)throw Error('Datei extern verändert');
          if(args.saveAs&&cancelSaveAs)return null;
          const d=docs.get(args.id);
          if(args.saveAs&&window.savePath){d.path=savePath;d.name=savePath.split('/').pop();}
          files[d.path]=d.encoding==='base64'?{text:args.content,encoding:d.encoding}:args.content;
          writes.push({...args,path:d.path});return {path:d.path,name:d.name};
        }finally{inFlightSaves--;}
      }
      if(cmd==='read_resource'){
        if(resourceDelay)await new Promise(r=>setTimeout(r,resourceDelay));
        if(args.relative==='missing.png')throw Error('Missing resource');
        return docs.get(args.id).path.startsWith('/moved/')?png.replace('image/png','image/png;moved=true'):png;
      }
      if(cmd==='export_pdf'){window.exported=args;return;}
      throw Error(cmd);
    }},event:{listen:async()=>()=>{}}};
  });
  await page.goto('http://127.0.0.1:17893/tabs.html');
  const frame=()=>page.frameLocator('.document-frame:not([hidden])');
  const html=()=>frame().frameLocator('#hviewer');
  const wait=()=>page.waitForFunction(()=>!busy&&!active.api.info().blocked);
  const check=async(fn,message)=>{if(!await page.evaluate(fn))throw Error(message);};
  const editHtml=async(text)=>{
    await html().locator('p').first().click({position:{x:30,y:8}});
    await html().locator('[contenteditable]').fill(text);
    await html().locator('[contenteditable]').press('Enter');
  };
  await page.evaluate(()=>FinDobeTabs.open('/safe.html'));
  await html().locator('p').first().waitFor();
  const original=await page.evaluate(()=>files['/safe.html']);
  await editHtml('Geaendert');
  await page.evaluate(()=>{cancelSaveAs=true;});
  // Every focus boundary, including a still-open edit field, must route once.
  for(const location of ['body','input','outline','toolbar','preview']){
    console.log('F01 focus boundary: '+location);
    if(location==='preview')await frame().getByRole('button',{name:'Vorschau',exact:true}).click();
    if(location==='input'){
      await html().locator('p').first().click({position:{x:30,y:8}});
      await html().locator('[contenteditable]').fill('Offene Eingabe');
    }
    await page.evaluate(()=>{calls.length=0;});
    const target=location==='body'?html().locator('body')
      :location==='input'?html().locator('[contenteditable]')
      :location==='outline'?frame().locator('.outTabs button').first()
      :location==='toolbar'?page.locator('#btnSaveAs')
      :frame().frameLocator('#previewViewer').locator('body');
    await target.press('ControlOrMeta+Shift+s');await wait();
    await check(()=>calls.filter(c=>c.cmd==='save_document').length===1&&calls.find(c=>c.cmd==='save_document').args.saveAs===true,
      'F01: Save As routed twice from '+location);
    if(await page.evaluate(()=>files['/safe.html'])!==original)throw Error('Canceled Save As changed original');
    await check(()=>active.api.info().dirty,'Canceled Save As cleared dirty marker');
  }
  await frame().getByRole('button',{name:'Bearbeiten',exact:true}).click();
  await html().locator('body').press('ControlOrMeta+z');
  await html().locator('p').filter({hasText:'Geaendert'}).first().waitFor();
  await page.evaluate(()=>{cancelSaveAs=false;calls.length=0;});
  await html().locator('body').press('ControlOrMeta+s');await wait();
  await check(()=>calls.filter(c=>c.cmd==='save_document').length===1&&!calls.find(c=>c.cmd==='save_document').args.saveAs,
    'F01: ordinary Save routed twice');
  await editHtml('Concurrent save');
  await page.evaluate(async()=>{
    calls.length=0;saveDelay=80;const w=active.frame.contentWindow;
    await Promise.all([w.save(false),w.save(true),w.save(false)]);saveDelay=0;
  });
  await check(()=>maxSaves===1&&calls.filter(c=>c.cmd==='save_document').length===1,'Concurrent writes');
  await editHtml('Failed save');
  await page.evaluate(()=>{failSave=true;});await html().locator('body').press('ControlOrMeta+s');await wait();
  await check(()=>active.api.info().dirty,'Failed save cleared edits');
  await frame().locator('#errorbar[role="alert"]').filter({hasText:'extern'}).waitFor();
  await page.evaluate(()=>{failSave=false;});
  results.F01='Save/Save As once from 5 HTML focus boundaries; cancel, history, errors, concurrency';

  // Keyboard entry into the HTML text list, including native Space activation.
  const texts=frame().locator('.outTabs button').nth(1);
  console.log('F02 keyboard entry');
  await texts.focus();await texts.press('Enter');
  await frame().locator('.txtItem').first().waitFor();
  if(await texts.getAttribute('aria-pressed')!=='true')throw Error('HTML selected state missing');
  await frame().locator('.txtItem').first().focus();await frame().locator('.txtItem').first().press('Space');
  await html().locator('[contenteditable]').fill('Tastatur Titel');
  await html().locator('[contenteditable]').press('Escape');
  await html().getByRole('heading',{name:'Titel',exact:true}).waitFor();
  await frame().locator('.txtItem').first().press('Enter');
  await html().locator('[contenteditable]').press('Tab');
  await html().locator('[contenteditable]').fill('Tastatur Absatz');
  await html().locator('[contenteditable]').press('Enter');
  await html().getByText('Tastatur Absatz',{exact:true}).waitFor();
  results.F02='Enter/Space entry, Esc cancel, Tab next spot, Enter commit';

  // Generate two pages; history must preserve exact bytes, including Tz fitting.
  await page.evaluate(async()=>{
    console.log('F03/F04 PDF');
    const script=document.createElement('script');script.src='pdf-lib.js';document.head.append(script);await new Promise(r=>script.onload=r);
    const d=await PDFLib.PDFDocument.create(), f=await d.embedFont(PDFLib.StandardFonts.Helvetica);
    for(let i=0;i<2;i++){
      const p=d.addPage([595,842]);p.drawText('Original PDF Text',{x:60,y:750,size:22,font:f});
      p.drawText('Second line',{x:60,y:700,size:14,font:f});
    }
    const b=await d.save({useObjectStreams:false});files['/keyboard.pdf']={text:btoa(String.fromCharCode(...b)),encoding:'base64'};
    await FinDobeTabs.open('/keyboard.pdf');
  });
  await wait();
  const pdfBytes=()=>page.evaluate(async()=>active.frame.contentWindow.encodeBinary(await active.frame.contentWindow.currentBytes()));
  const pdfOriginal=await pdfBytes();
  const pdfEdit=async(index,text)=>{
    const spot=frame().locator('.titem').nth(index);await spot.focus();await spot.press('Enter');
    await frame().locator('#editBox').fill(text);await frame().locator('#editBox').press('Enter');await wait();
  };
  await check(()=>active.frame.contentDocument.querySelectorAll('.titem[tabindex="0"]').length===1,'PDF tab stops unbounded');
  await frame().locator('.titem').first().focus();await frame().locator('.titem').first().press('ArrowDown');
  await check(()=>active.frame.contentDocument.activeElement.getAttribute('aria-label').includes('Second line'),'PDF arrow navigation');
  await frame().locator('.titem').nth(1).press('Space');await frame().locator('#editBox').fill('Canceled');
  await frame().locator('#editBox').press('Escape');
  await check(()=>active.frame.contentDocument.activeElement.classList.contains('titem')&&!active.api.info().dirty,'PDF Esc focus/cancel');
  await pdfEdit(0,'Changed PDF Text');
  await check(()=>active.frame.contentDocument.activeElement.classList.contains('titem'),'PDF commit lost keyboard focus');
  await frame().locator('body').press('ControlOrMeta+z');await wait();
  if(await pdfBytes()!==pdfOriginal)throw Error('F04: Undo changed original PDF bytes');
  await check(()=>!active.api.info().dirty,'F04: Undo remained dirty');
  await frame().locator('body').press('ControlOrMeta+Shift+z');await wait();
  await page.locator('#btnSave').click();await wait();const saved=await pdfBytes();
  await frame().locator('body').press('ControlOrMeta+z');await wait();
  await check(()=>active.api.info().dirty,'Undo after Save must be dirty');
  await frame().locator('body').press('ControlOrMeta+Shift+z');await wait();
  if(await pdfBytes()!==saved)throw Error('Redo did not restore saved baseline');
  await check(()=>!active.api.info().dirty,'Redo to saved baseline stayed dirty');
  await pdfEdit(1,'Other line');await pdfEdit(2,'Page two text');
  await page.evaluate(()=>FinDobeTabs.open('/note.md'));
  await page.locator('.tab-select').nth(1).click();await wait();
  for(let i=0;i<2;i++){await frame().locator('body').press('ControlOrMeta+z');await wait();}
  if(await pdfBytes()!==saved)throw Error('Multi-page/tab Undo changed saved bytes');
  for(let i=0;i<2;i++){await frame().locator('body').press('ControlOrMeta+Shift+z');await wait();}
  await check(()=>active.api.info().dirty,'Multi-page redo missing');
  // Directly fit a correction: the complete inserted Tz wrapper is reversible.
  await page.evaluate(async()=>{
    const w=active.frame.contentWindow;await w.eval('applyEdit(model.pages[0],model.pages[0].items[0],"Fitted PDF Text",85)');
  });
  await frame().locator('body').press('ControlOrMeta+z');await wait();
  await frame().locator('body').press('ControlOrMeta+z');await wait();
  await frame().locator('body').press('ControlOrMeta+z');await wait();
  if(await pdfBytes()!==saved)throw Error('Fitted operator Undo failed');
  await frame().locator('.titem').first().focus();
  await page.evaluate(()=>active.frame.contentWindow.setZoom(1.2));await wait();
  await check(()=>active.frame.contentDocument.activeElement.classList.contains('titem'),'Zoom lost PDF focus');
  await page.screenshot({path:'test-results/review-pdf-keyboard.png'});
  // Locked spot stays discoverable, describes its reason, cannot start editing.
  await page.evaluate(()=>active.frame.contentWindow.eval('model.pages[0].items[0].editable=false;model.pages[0].items[0].ro="font";buildOverlay(model.pages[0])'));
  await frame().locator('.titem').first().focus();await frame().locator('.titem').first().press('Enter');
  if(await frame().locator('#editBox').count())throw Error('Locked PDF text became editable');
  if(!(await frame().locator('.titem').first().getAttribute('aria-label')).includes('Gesperrt'))throw Error('Locked reason inaccessible');
  results.F03='Named roving text spots; keyboard edit/cancel/navigation; focus after commit/zoom; locked reasons';
  results.F04='Byte equality before edits and at saved baseline; multi-page/tab/fitted undo/redo';

  await page.evaluate(()=>FinDobeTabs.open('/images/note.md'));
  await frame().getByRole('button',{name:'Quelltext',exact:true}).click();
  const editor=frame().locator('.cm-content');
  await editor.press('ControlOrMeta+End');await page.keyboard.insertText('\n![neu](new.png)\n![unicode](Grüße%20Bild.png)\n![fehlt](missing.png)\n![remote](https://blocked.invalid/x.png)\n![outside](../outside.png)\n');
  const md=await page.evaluate(()=>active.frame.contentWindow.currentContent());
  await page.evaluate(()=>{calls.length=0;});
  await frame().getByRole('button',{name:'Vorschau',exact:true}).click();
  const preview=()=>frame().frameLocator('#markdownPreview');
  await preview().locator('img[alt="neu"]').waitFor();
  await preview().locator('img[alt="unicode"]').waitFor();
  await check(()=>calls.some(c=>c.cmd==='read_resource'&&c.args.relative==='Grüße Bild.png'),'Unicode resource path');
  const loaded=await preview().locator('img[alt="neu"]').evaluate(el=>el.complete&&el.naturalWidth>0);
  if(!loaded)throw Error('F05: new image not loaded');
  await frame().locator('#resourceNotice').filter({hasText:'missing.png'}).waitFor();
  await check(()=>!calls.some(c=>c.cmd==='read_resource'&&(/outside|https:/.test(c.args.relative))),'Unsafe resource reached native reader');
  await page.locator('#btnExpPdf').click();await wait();
  await check(()=>exported.html.includes('alt="neu" src="data:')&&exported.html.includes("connect-src 'none'"),'F05: Export missing new image/CSP');
  if(await page.evaluate(()=>active.frame.contentWindow.currentContent())!==md)throw Error('Resource loading rewrote Markdown');
  await page.evaluate(()=>{savePath='/moved/note.md';});await page.locator('#btnSaveAs').click();await wait();
  await preview().locator('img[alt="neu"][src*="moved=true"]').waitFor();
  // Slow resources, concurrent refreshes, fast preview/source switching, another tab.
  await frame().getByRole('button',{name:'Quelltext',exact:true}).click();
  await editor.press('ControlOrMeta+End');await page.keyboard.insertText('\n![slow](slow.png)\n');
  await page.evaluate(()=>{resourceDelay=120;calls.length=0;});
  await frame().getByRole('button',{name:'Vorschau',exact:true}).click();
  await page.evaluate(()=>{const w=active.frame.contentWindow;w.renderMarkdownPreview();});
  await frame().getByRole('button',{name:'Quelltext',exact:true}).click();
  await page.locator('.tab-select').nth(2).click();
  await page.waitForTimeout(500);
  await check(()=>active.api.info().path==='/note.md','Resource completion changed active tab');
  await page.locator('.tab-select').last().click();await wait();
  await check(()=>active.frame.contentWindow.eval('markdownView')==='source','Stale preview changed view');
  await check(()=>calls.filter(c=>c.cmd==='read_resource'&&c.args.relative==='slow.png').length===1,'Duplicate resource requests');
  await page.evaluate(()=>{resourceDelay=0;});
  await frame().getByRole('button',{name:'Vorschau',exact:true}).click();
  await preview().locator('img[alt="slow"][src^="data:"]').waitFor();
  await page.screenshot({path:'test-results/review-markdown-resources.png'});
  results.F05='New/Unicode images in preview and export; errors, traversal/remote guards; moved base; dedup/stale/tab guard';
  // Malformed PDF leaves existing tabs and handles intact and has a clear error.
  const state=await page.evaluate(()=>({tabs:tabs.length,docs:docs.size}));
  await page.evaluate(()=>FinDobeTabs.open('/broken.pdf'));
  await page.locator('#shellError').filter({hasText:'beschädigt'}).waitFor();
  const after=await page.evaluate(()=>({tabs:tabs.length,docs:docs.size}));
  if(JSON.stringify(state)!==JSON.stringify(after))throw Error('Malformed PDF leaked handle/tab');
  results.malformedPdf='Clear alert, no tab/handle leak';

  // F06 measurement: still all-page canvases, but unchanged activation renders none.
  await page.evaluate(async()=>{
    const d=await PDFLib.PDFDocument.create(),f=await d.embedFont(PDFLib.StandardFonts.Helvetica);
    for(let i=0;i<25;i++)d.addPage([595,842]).drawText('Page '+i+' original',{x:60,y:750,size:22,font:f});
    const b=await d.save({useObjectStreams:false});files['/many.pdf']={text:btoa(String.fromCharCode(...b)),encoding:'base64'};
    await FinDobeTabs.open('/many.pdf');
    const w=active.frame.contentWindow;
    w.eval('window.renders=0;window.layouts=0;const measuredRender=renderPdfPage;renderPdfPage=async (...args)=>{window.renders++;return measuredRender(...args)};const measuredLayout=layoutPdfPages;layoutPdfPages=async (...args)=>{window.layouts++;return measuredLayout(...args)}');
  });
  await wait();
  const start=Date.now();
  await page.locator('.tab-select').nth(2).click();await page.locator('.tab-select').last().click();await wait();
  results.F06=await page.evaluate(()=>({layouts:active.frame.contentWindow.layouts,renders:active.frame.contentWindow.renders,dpr:devicePixelRatio,
    canvases:active.frame.contentDocument.querySelectorAll('canvas').length,
    canvasPixelBytes:[...active.frame.contentDocument.querySelectorAll('canvas')].reduce((sum,c)=>sum+c.width*c.height*4,0)}));
  results.F06.switchMs=Date.now()-start;
  if(results.F06.layouts!==0||results.F06.renders>6)throw Error('F06: unchanged tab activation rerendered layout/all pages');
  // Two fit/zoom requests must serialize/ignore duplicates without canvas errors.
  await page.evaluate(async()=>{
    const w=active.frame.contentWindow;await Promise.all([w.setZoom(1.15),w.setZoom(1.25)]);
  });await wait();
  if(errors.length)throw Error(errors.join('\n'));
  return {results,errors};
}
