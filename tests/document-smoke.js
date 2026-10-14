async page => {
  const errors=[], remote=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:17893')&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))remote.push(r.url());});
  await page.addInitScript(()=>{if(window!==window.top)return;let serial=0;window.handles=new Map();window.files={};window.writes=[];window.listeners={};window.exports=[];
    window.__TAURI__={core:{invoke:async(command,args={})=>{
      if(command==='list_drafts')return JSON.parse(localStorage.getItem('findobe-drafts-v1')||'{}');
      if(command==='read_draft')return JSON.parse(localStorage.getItem('findobe-drafts-v1'))[args.key].package;
      if(command==='cache_draft'){const all=JSON.parse(localStorage.getItem('findobe-drafts-v1')||'{}');if(args.content)all[args.key]={name:args.name,at:Date.now(),package:JSON.parse(args.content)};else delete all[args.key];localStorage.setItem('findobe-drafts-v1',JSON.stringify(all));return;}
      if(command==='take_pending_files')return null;
      if(command==='new_document'){const doc={id:++serial,name:'Neues Dokument.findobe',path:'/draft-'+serial+'.findobe',text:'',encoding:'utf8',draft:true};handles.set(doc.id,doc);return {...doc};}
      if(command==='open_path'){if(!files[args.path])throw Error('Datei fehlt');const doc={id:++serial,name:args.path.split('/').pop(),path:args.path,...files[args.path]};handles.set(doc.id,doc);return {...doc};}
      if(command==='release_document'){handles.delete(args.id);return;}
      if(command==='save_structured'){if(window.failSave)throw Error('Speicherfehler');if(window.cancelSave)return null;const doc=handles.get(args.id);const path=args.path||'/saved-'+args.id+'.findobe';if([...handles.values()].some(x=>x.id!==args.id&&x.path===path))throw Error('Anderer Tab');writes.push({...args,path});files[path]={text:args.content,encoding:'utf8'};Object.assign(doc,{path,name:path.split('/').pop(),draft:false});return {path,name:doc.name};}
      if(command==='preview_pdf_document'){const doc={id:++serial,name:'Vorschau.pdf',path:'/preview-'+serial+'.pdf',text:args.content,encoding:'base64',draft:true};handles.set(doc.id,doc);return {...doc};}
      if(command==='export_document'){exports.push(args);const path=args.path||'/export.'+args.format;files[path]={text:args.content,encoding:['docx','odt','pdf'].includes(args.format)?'base64':'utf8'};return {path,name:path.split('/').pop()};}
      if(command==='agent_connection')return {port:12345,manifest:'local-test.json'};
      if(command==='read_resource')throw Error('Ressource fehlt');
      if(command==='agent_reply')return;
      throw Error('Unbekannt: '+command);
    }},event:{listen:async(name,fn)=>{listeners[name]=fn;return ()=>{};}}};
  });
  await page.addInitScript(()=>{if(window!==window.top&&/\.pdf$/i.test(window.frameElement?.title||''))window.requestAnimationFrame=()=>0;});
  await page.goto('http://127.0.0.1:17893/tabs.html');
  await page.locator('#btnNew').click();const frame=()=>page.frameLocator('.document-frame:not([hidden])');
  await frame().locator('.tiptap').waitFor();
  const rpc=req=>page.evaluate(req=>FinDobeTabs.agent(req),req);
  const expect=(v,msg)=>{if(!v)throw Error(msg);};
  let read=await rpc({method:'read'});expect(read.dirty,'New file not dirty');
  const initial=read.nodes.find(n=>n.type==='paragraph');
  const tinyPng=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=60;canvas.height=30;const ctx=canvas.getContext('2d');ctx.fillStyle='#9D5035';ctx.fillRect(0,0,60,30);return canvas.toDataURL('image/png');});
  const para=text=>({type:'paragraph',content:[{type:'text',text}]});
  const cell=text=>({type:'tableCell',content:[para(text)]});
  await rpc({method:'apply',expectedRevision:read.revision,author:'Testagent',operations:[
    {type:'setText',target:initial.id,text:'Grüße aus Österreich – Mensch und Agent.'},
    {type:'append',node:{type:'heading',attrs:{level:1},content:[{type:'text',text:'Gemeinsames Angebot'}]}},
    {type:'append',node:{type:'paragraph',content:[{type:'text',text:'Fetter Text',marks:[{type:'bold'}]},{type:'text',text:' und ein Link',marks:[{type:'link',attrs:{href:'https://example.org'}}]}]}},
    {type:'append',node:{type:'bulletList',content:[{type:'listItem',content:[para('Leistung eins')]},{type:'listItem',content:[para('Leistung zwei')]}]}},
    {type:'append',node:{type:'table',content:[{type:'tableRow',content:[{type:'tableHeader',content:[para('Leistung')]},{type:'tableHeader',content:[para('Preis')]}]},{type:'tableRow',content:[cell('Beratung'),cell('250 €')]}]}},
    {type:'append',node:{type:'image',attrs:{src:tinyPng,alt:'Testbild'}}}
  ]});
  await frame().getByRole('heading',{name:'Gemeinsames Angebot',exact:true}).waitFor();expect(await frame().locator('table').count()===1,'Table missing');
  read=await rpc({method:'read'});
  const staleRevision=read.revision,first=read.nodes.find(n=>n.id===initial.id),other=read.nodes.find(n=>n.type==='paragraph'&&n.text==='Beratung');
  // Real human keyboard edit alongside targeted agent mutation.
  await frame().locator('.tiptap p').first().click();await page.keyboard.press('Home');await page.keyboard.insertText('Mensch: ');
  let conflict=false;try{await rpc({method:'apply',expectedRevision:staleRevision,operations:[{type:'setText',target:first.id,text:'Veraltet'}]});}catch(e){conflict=String(e).includes('Konflikt');}expect(conflict,'Stale revision was not rejected');
  await rpc({method:'apply',expectedRevision:staleRevision,operations:[{type:'setText',target:other.id,expected:other.node,text:'Beratung ergänzt'}]});
  read=await rpc({method:'read'});expect(read.nodes.find(n=>n.id===initial.id).text.includes('Mensch:'),'Human edit lost');
  // A multi-operation failure must leave ALL content unchanged.
  let before=JSON.stringify(read.package.document);try{await rpc({method:'apply',expectedRevision:read.revision,operations:[{type:'setText',target:initial.id,text:'Teiländerung'},{type:'delete',target:'missing'}]});}catch{}
  expect(JSON.stringify((await rpc({method:'read'})).package.document)===before,'Partially applied invalid batch');
  await frame().getByRole('button',{name:'↶',exact:true}).click();expect((await rpc({method:'read'})).nodes.find(n=>n.id===other.id).text==='Beratung','Agent undo failed');
  await frame().getByRole('button',{name:'↷',exact:true}).click();expect((await rpc({method:'read'})).nodes.find(n=>n.id===other.id).text==='Beratung ergänzt','Agent redo failed');
  read=await rpc({method:'read'});await rpc({method:'comment',target:initial.id,text:'Bitte prüfen',author:'Testagent'});
  await frame().getByText('Bitte prüfen',{exact:true}).waitFor();
  read=await rpc({method:'read'});const proposal=await rpc({method:'propose',expectedRevision:read.revision,author:'Testagent',reason:'Klarer formulieren',operations:[{type:'setText',target:initial.id,text:'Freigegebener Text'}]});
  await frame().getByRole('button',{name:'Übernehmen',exact:true}).click();expect((await rpc({method:'read'})).nodes.find(n=>n.id===initial.id).text==='Freigegebener Text','Proposal accept failed');
  await frame().getByRole('button',{name:'↶',exact:true}).click();expect((await rpc({method:'read'})).package.document.attrs.proposals.length===1,'Proposal undo failed');
  await frame().getByRole('button',{name:'Übernehmen',exact:true}).click();
  // Metadata/layout participates in the same history.
  await frame().getByText('Seitenlayout',{exact:true}).click();await frame().locator('#pageHeader').fill('THE-FIN · Test');await frame().locator('#pageFooter').fill('Kundendokument');await frame().locator('#layoutApply').click();
  await frame().locator('#docTitle').fill('Angebot Österreich');await frame().locator('#docTitle').press('Tab');
  await rpc({method:'save',path:'/angebot.findobe'});read=await rpc({method:'read'});expect(!read.dirty,'Save did not clear dirty');
  const original=read.package;
  // All real format writers, then real parsers, then reopen editable copies.
  const formats={};for(const format of ['findobe','html','md','txt','docx','odt','pdf']) {
    await rpc({method:'export',format,path:'/roundtrip.'+format});
    if(format==='pdf'){formats[format]={export:true};continue;}
    await rpc({method:'open',path:'/roundtrip.'+format});
    if(['html','md','txt'].includes(format))await rpc({method:'convert'});
    const imported=await rpc({method:'read'});const text=imported.nodes.map(n=>n.text).join('\n');
    expect(text.includes('Freigegebener Text')&&text.includes('Gemeinsames Angebot')&&text.includes('Beratung ergänzt')&&text.includes('250 €'),format+' content lost');
    if(['findobe','html','docx','odt'].includes(format))expect(imported.nodes.some(n=>n.type==='table')&&imported.nodes.some(n=>n.type==='image'),format+' table/image lost');
    if(format==='findobe')expect(JSON.stringify(imported.package.document)===JSON.stringify(original.document),'Native roundtrip lost metadata or IDs');
    const p=imported.nodes.find(n=>n.type==='paragraph');await rpc({method:'apply',expectedRevision:imported.revision,operations:[{type:'setText',target:p.id,text:p.text+' · Wieder bearbeitet'}]});
    await rpc({method:'save',path:'/edited-'+format+'.findobe'});expect(!(await rpc({method:'read'})).dirty,format+' re-save failed');
    formats[format]={import:true,export:true,edit:true,save:true};
    await page.evaluate(()=>activate(tabs[0]));
  }
  await rpc({method:'preview',documentId:1});expect(await page.evaluate(()=>active.api.info().mode)==='pdf','In-app PDF preview missing');await page.locator('.tab-close').last().click();await page.evaluate(()=>activate(tabs[0]));
  // Native rich-text paste remains editable and doesn't load hostile resources.
  await frame().locator('.tiptap').click();await page.evaluate(()=>{const w=active.frame.contentWindow,e=w.FinDobeDocument.testing.editor();const html=e.options.editorProps.transformPastedHTML('<p style="color:rgb(10,20,30)">Sicherer Paste</p><img src="https://invalid.example/a.png"><a href="javascript:alert(1)">Link</a>');const transfer=new DataTransfer();transfer.setData('text/html',html);e.view.dom.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:transfer}));});
  read=await rpc({method:'read'});expect(read.nodes.some(n=>n.text.includes('Sicherer Paste')),'Paste missing');await frame().getByRole('button',{name:'↶',exact:true}).click();
  // Appended proposals can be accepted and incompatible inserts are rejected atomically.
  read=await rpc({method:'read'});const appended=await rpc({method:'propose',expectedRevision:read.revision,operations:[{type:'append',node:para('Angehängter Vorschlag')}]});await rpc({method:'accept',proposalId:appended.id});expect((await rpc({method:'read'})).nodes.some(n=>n.text==='Angehängter Vorschlag'),'Append proposal failed');await frame().getByRole('button',{name:'↶',exact:true}).click();await frame().getByRole('button',{name:'Verwerfen',exact:true}).click();
  read=await rpc({method:'read'});before=JSON.stringify(read.package.document);let incompatible=false;try{await rpc({method:'apply',expectedRevision:read.revision,operations:[{type:'append',node:cell('Unpassende Zelle')}]});}catch{incompatible=true;}expect(incompatible&&JSON.stringify((await rpc({method:'read'})).package.document)===before,'Incompatible insertion silently fitted');
  // Human layout inputs cannot be overwritten by a concurrent agent edit.
  await frame().locator('#pageHeader').fill('Menschlicher Entwurf');read=await rpc({method:'read'});expect(read.package.document.attrs.layout.header==='Menschlicher Entwurf','Pending human metadata lost');await rpc({method:'apply',expectedRevision:read.revision,operations:[{type:'setMetadata',attrs:{title:'Gemeinsam bearbeiteter Titel'}}]});expect(await frame().locator('#pageHeader').inputValue()==='Menschlicher Entwurf','Agent reset layout form');await frame().locator('#pageHeader').fill('THE-FIN · Test');await frame().locator('#layoutApply').click();
  // Export fixtures to disk using actual browser downloads, no base64 in logs.
  const artifacts=['docx','odt','pdf','html','md','txt','findobe'];for(const format of artifacts){const download=page.waitForEvent('download');await page.evaluate(format=>{const data=files['/roundtrip.'+format];const bytes=data.encoding==='base64'?Uint8Array.from(atob(data.text),c=>c.charCodeAt(0)):new TextEncoder().encode(data.text);const url=URL.createObjectURL(new Blob([bytes]));const a=document.createElement('a');a.href=url;a.download='roundtrip.'+format;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},format);await (await download).saveAs('test-results/documents/roundtrip.'+format);}
  // PDF text extraction into a new editable document.
  await rpc({method:'open',path:'/roundtrip.pdf'});await rpc({method:'convert'});read=await rpc({method:'read'});expect(read.nodes.map(n=>n.text).join('').includes('Freigegebener Text'),'PDF text import failed');expect(read.package.document.attrs.comments.length===0,'PDF fabricated comments');formats.pdf.importText=true;
  // Recovery, tab state, saving errors, active/inactive document IDs.
  await page.evaluate(()=>activate(tabs[0]));read=await rpc({method:'read'});await rpc({method:'apply',expectedRevision:read.revision,operations:[{type:'setText',target:initial.id,text:'Wiederherstellbarer Entwurf'}]});
  await page.waitForFunction(()=>Object.values(JSON.parse(localStorage.getItem('findobe-drafts-v1')||'{}')).some(d=>JSON.stringify(d).includes('Wiederherstellbarer Entwurf')));
  await page.evaluate(()=>{window.failSave=true;});let failed=false;try{await rpc({method:'save'});}catch{failed=true;}expect(failed&&(await rpc({method:'read'})).dirty,'Failed save lost edits');await page.evaluate(()=>{window.failSave=false;});
  await page.screenshot({path:'test-results/documents/editor-desktop.png'});await page.setViewportSize({width:880,height:600});expect(await page.evaluate(()=>document.documentElement.scrollWidth)<=880,'Shell overflows');expect(await frame().locator('body').evaluate(el=>el.scrollWidth)<=880,'Editor overflows');await page.screenshot({path:'test-results/documents/editor-compact.png'});
  await page.reload();await page.locator('#btnRecover').click();await page.locator('#recoveryList button').filter({hasText:'angebot.findobe'}).first().click();read=await rpc({method:'read'});expect(read.nodes.some(n=>n.text.includes('Wiederherstellbarer Entwurf'))&&read.dirty,'Draft recovery lost content');
  expect(!errors.length,'JS errors: '+errors.join('\n'));expect(!remote.length,'External requests: '+remote.join('\n'));
  return {formats,humanAgentCollaboration:true,staleConflict:true,blockGuard:true,atomicBatch:true,undoRedo:true,comments:true,proposals:true,nativeMetadataRoundtrip:true,layout:true,recovery:true,failedSavePreservesEdits:true,noExternalRequests:true,errors};
}
