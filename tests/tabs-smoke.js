async page => {
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    if(window!==window.top)return;
    window.files={
      '/one/note.md':'\uFEFF# Erste Notiz\r\n\r\nOriginal A.\n'+Array.from({length:160},(_,i)=>'Absatz '+i+'\r\n\r\n').join(''),
      '/two/note.md':'# Zweite Notiz\n\nOriginal B.\n',
      '/layout.html':'<!doctype html><html><head><style>h1{color:rgb(140,106,76)}</style></head><body><h1>HTML Titel</h1><p>Absatz</p><script>window.untrustedRan=true;<\/script></body></html>'
    };
    window.handles=new Map(); window.writes=[]; window.released=[]; window.listeners={}; window.pending=[];
    let serial=0;
    window.__TAURI__={core:{invoke:async(command,args={})=>{
      if(command==='take_pending_files')return pending.shift()??null;
      if(command==='open_document'||command==='open_path'){
        const path=args.path||window.nextPath; if(!path)return null;
        if(!(path in files))throw Error('Datei fehlt');
        const doc={id:++serial,name:path.split('/').pop(),path,text:files[path]};handles.set(doc.id,doc);return {...doc};
      }
      if(command==='release_document'){released.push(args.id);handles.delete(args.id);return;}
      if(command==='save_document'){
        if(window.failSave)throw Error('Test-Speicherfehler');
        if(args.saveAs&&window.cancelSaveAs)return null;
        const doc=handles.get(args.id);if(!doc)throw Error('Falsches Dokument');
        if(args.saveAs&&window.savePath){doc.path=savePath;doc.name=savePath.split('/').pop();}
        writes.push({...args,path:doc.path});files[doc.path]=args.content;
        return {name:doc.name,path:doc.path};
      }
      if(command==='read_resource')throw Error('Keine Ressourcen');
      if(command==='export_pdf'){window.exported=args;return;}
      if(command==='close_editor'){window.didClose=true;return;}
      throw Error('Unbekannt: '+command);
    }},event:{listen:async(name,fn)=>{listeners[name]=fn;return ()=>{};}}};
  });
  await page.goto('http://127.0.0.1:17893/tabs.html');
  const assert=async(fn,message)=>{if(!await page.evaluate(fn))throw Error(message);};
  const open=async(path)=>{await page.evaluate(path=>FinDobeTabs.open(path),path);};
  const select=async(i)=>page.locator('.tab-select').nth(i).click();
  const frame=()=>page.frameLocator('.document-frame:not([hidden])');
  const source=async()=>frame().getByRole('button',{name:'Quelltext',exact:true}).click();
  const type=async(text)=>{const el=frame().locator('.cm-content');await el.press('ControlOrMeta+End');await page.keyboard.insertText(text);};
  const close=async(i)=>page.locator('.tab-close').nth(i).click();
  const choose=async(value)=>page.locator('[data-close="'+value+'"]').click();
  await open('/one/note.md');await source();await type('Änderung A');
  await assert(()=>tabs[0].api.info().dirty,'First tab not dirty');
  const first=await page.evaluate(()=>tabs[0].frame.contentWindow.currentContent());
  await page.waitForFunction(()=>tabs[0].frame.contentDocument.querySelector('.cm-scroller').scrollTop>0);
  const scroll=await page.evaluate(()=>tabs[0].frame.contentDocument.querySelector('.cm-scroller').scrollTop);
  await open('/two/note.md');await source();await type('Änderung B');
  if(await page.locator('.document-tab.dirty').count()!==2)throw Error('Dirty dots missing');
  await select(0);
  await page.waitForFunction(expected=>Math.abs(tabs[0].frame.contentDocument.querySelector('.cm-scroller').scrollTop-expected)<2,scroll);
  await assert(()=>tabs[0].frame.contentWindow.currentContent().includes('Änderung A'),'Switch lost A');
  await frame().locator('.cm-content').press('ControlOrMeta+z');
  await assert(()=>!tabs[0].api.info().dirty&&tabs[1].api.info().dirty,'Undo crossed tabs');
  await frame().locator('.cm-content').press('ControlOrMeta+Shift+z');
  if(await page.evaluate(()=>tabs[0].frame.contentWindow.currentContent())!==first)throw Error('Redo/source bytes lost');
  await open('/one/note.md');
  await assert(()=>tabs.length===2&&active===tabs[0]&&handles.size===2&&released.length===1,'Duplicate file created tab or leaked handle');
  await page.locator('#btnSave').click();
  await assert(()=>writes.length===1&&writes[0].id===tabs[0].api.info().id&&writes[0].content.startsWith('\uFEFF')&&!tabs[0].api.info().dirty&&tabs[1].api.info().dirty,'Save targeted wrong tab');
  await open('/layout.html');
  const html=frame().frameLocator('#hviewer');
  await html.locator('h1').click({position:{x:40,y:20}});await html.locator('[contenteditable]').fill('HTML geändert');
  await select(1);await select(2);
  await frame().getByRole('button',{name:'Vorschau',exact:true}).click();
  await frame().frameLocator('#previewViewer').getByRole('heading',{name:'HTML geändert'}).waitFor();
  await select(0);await select(2);
  if(!await frame().locator('#previewWrap').isVisible())throw Error('HTML preview mode lost');
  const color=await frame().frameLocator('#previewViewer').locator('h1').evaluate(el=>getComputedStyle(el).color);
  if(color!=='rgb(140, 106, 76)')throw Error('HTML styles lost');
  if(await frame().frameLocator('#previewViewer').locator('script,[contenteditable]').count())throw Error('Unsafe preview');
  await page.locator('#btnExpPdf').click();
  await assert(()=>exported.html.includes('HTML geändert')&&!exported.html.includes('<script'),'Export wrong tab');
  await frame().frameLocator('#previewViewer').locator('h1').click();
  await page.keyboard.press('Control+Tab');
  await assert(()=>active===tabs[0],'Nested preview cycling failed');
  await page.keyboard.press('Control+Shift+Tab');
  await assert(()=>active===tabs[2],'Reverse cycle failed');
  await close(2);await choose('cancel');
  await assert(()=>tabs.length===3&&tabs[2].api.info().dirty,'Cancel lost tab');
  await page.evaluate(()=>{window.failSave=true;});
  await close(2);await choose('save');
  await frame().locator('#errorbar').filter({hasText:'Test-Speicherfehler'}).waitFor();
  await assert(()=>tabs.length===3&&active.api.info().dirty,'Failed save closed dirty tab');
  await page.evaluate(()=>{window.failSave=false;});
  await close(2);await choose('save');
  await page.waitForFunction(()=>tabs.length===2&&!busy);
  await assert(()=>writes.at(-1).path==='/layout.html'&&writes.at(-1).content.includes('HTML geändert')&&handles.size===2,'Save and close wrong document');
  await select(0);await type('noch A');
  await page.evaluate(()=>listeners['request-close']());
  await choose('discard');await choose('cancel');
  await assert(()=>!window.didClose&&tabs.length===2&&tabs.every(t=>t.api.info().dirty),'Cancel quitting partially discarded tabs');
  await close(0);await choose('cancel');
  await assert(()=>active===tabs[0],'Dirty inactive tab not activated');
  await page.evaluate(()=>{window.savePath='/one/renamed.md';});
  await page.evaluate(()=>{window.cancelSaveAs=true;});
  await page.locator('#btnSaveAs').click();
  await assert(()=>tabs[0].api.info().path==='/one/note.md'&&tabs[0].api.info().dirty,'Canceled save-as lost original or edits');
  await page.evaluate(()=>{window.cancelSaveAs=false;});
  await page.locator('#btnSaveAs').click();
  await page.getByRole('tab',{name:'renamed.md',exact:true}).waitFor();
  await assert(()=>tabs[0].api.info().path==='/one/renamed.md','Save-as failed to rename tab');
  await page.evaluate(()=>{pending.push(['/layout.html']);listeners['files-pending']();});
  await page.waitForFunction(()=>tabs.length===3&&!busy);
  await assert(()=>active.api.info().name==='layout.html'&&tabs[1].api.info().dirty,'Finder open replaced dirty tab');
  await open('/missing.md');
  await assert(()=>tabs.length===3&&handles.size===3,'Failed open leaked tab');
  await page.locator('#shellError').filter({hasText:'Datei fehlt'}).waitFor();
  await select(1);await frame().getByRole('button',{name:'Vorschau',exact:true}).click();
  await frame().frameLocator('#markdownPreview').getByRole('heading',{name:'Zweite Notiz'}).waitFor();
  await select(0);await select(1);
  if(!await frame().locator('#markdownPreview').isVisible())throw Error('Markdown preview mode lost');
  await page.screenshot({path:'.playwright-cli/tabs-desktop.png'});
  await page.setViewportSize({width:880,height:600});
  await assert(()=>document.documentElement.scrollWidth<=880,'Minimum width overflow');
  await page.screenshot({path:'.playwright-cli/tabs-compact.png'});
  await select(2);await page.locator('.tab-select').nth(2).press('ControlOrMeta+w');
  await page.waitForFunction(()=>tabs.length===2&&!busy);
  await close(1);await choose('discard');await page.waitForFunction(()=>tabs.length===1&&!busy);
  await close(0);await page.locator('#welcome').waitFor();
  await assert(()=>handles.size===0&&!active&&tabs.length===0,'Last close leaked state');
  await open('/two/note.md');await source();await type('final');
  await page.evaluate(()=>listeners['request-close']());await choose('save');
  await page.waitForFunction(()=>window.didClose);
  if(errors.length)throw Error(errors.join('\n'));
  return {tabs:true,independentUndo:true,duplicateOpen:true,saveRouting:true,htmlPreview:true,markdownPreview:true,shortcuts:true,closeCancelSaveDiscard:true,failedSaveRetained:true,quitCancelPreservesAll:true,finderOpen:true,saveAsRename:true,noHandleLeaks:true,errors};
}
