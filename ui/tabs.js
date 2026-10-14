'use strict';
// A live document frame owns its complete editor state, history and scroll.
// The shell owns only tab lifetime and native open/close routing.
const tabs = [];
let active = null, busy = false, serial = 0;
const $ = selector => document.querySelector(selector);
const invoke = (command, args = {}) => window.__TAURI__.core.invoke(command, args);
const blocked = () => busy || !!document.querySelector('dialog[open]') || !!active?.api?.info().blocked;
function error(message) { $('#shellError').textContent=String(message); $('#shellError').hidden=false; }
function render() {
  const locked = blocked();
  $('#tabbar').hidden = !tabs.length;
  $('#welcome').hidden = !!active;
  for (const button of document.querySelectorAll('#topbar button,#addTab,#btnStartOpen')) {
    button.disabled = locked || (!active && !['btnOpen','addTab','btnStartOpen','btnNew','btnStartNew','btnAgent'].includes(button.id));
  }
  for (const tab of tabs) {
    tab.frame.inert=busy;
    const info = tab.api?.info() || tab.document;
    tab.item.classList.toggle('selected',tab===active);
    tab.item.classList.toggle('dirty',!!info.dirty);
    tab.select.setAttribute('aria-selected',String(tab===active));
    tab.select.tabIndex = tab===active ? 0 : -1;
    tab.select.disabled=locked; tab.close.disabled=locked;
    tab.label.textContent=info.name;
    tab.select.setAttribute('aria-label',info.name+(info.dirty?' – ungespeichert':''));
    tab.item.title=info.path;
    tab.close.setAttribute('aria-label','Tab schließen: '+info.name);
    tab.frame.title=info.name;
  }
  $('#btnCollaborate').hidden = !active || active?.api?.info().mode === 'structured';
  $('#btnExpPdf').textContent = active?.api?.info().mode === 'pdf' ? 'PDF-Kopie speichern…' : 'Als PDF exportieren';
  document.title=active ? (active.api?.info().name || active.document.name)+' — FinDobe' : 'FinDobe · THE-FIN';
}
async function activate(tab, force=false) {
  if (!force && blocked()) return false;
  if (active && active!==tab) {
    if (!await active.api.flush()) return false;
    await active.api.deactivate();
  }
  active=tab;
  for (const item of tabs) item.frame.hidden=item!==tab;
  await tab?.api.activate();
  render();
  tab?.item.scrollIntoView({block:'nearest',inline:'nearest'});
  return true;
}
function createTab(opened) {
  const id=++serial;
  const tab={document:opened,api:null};
  tab.item=document.createElement('div'); tab.item.className='document-tab';
  tab.select=document.createElement('button'); tab.select.className='tab-select';
  tab.select.id='tab-'+id; tab.select.setAttribute('role','tab'); tab.select.setAttribute('aria-controls','document-'+id);
  tab.label=document.createElement('span'); tab.label.className='tab-name';
  const dot=document.createElement('span'); dot.className='tab-dirty'; dot.setAttribute('aria-hidden','true');
  tab.select.append(dot,tab.label);
  tab.close=document.createElement('button'); tab.close.className='tab-close'; tab.close.textContent='×';
  tab.item.append(tab.select,tab.close);
  tab.select.onclick=()=>activate(tab); tab.close.onclick=()=>void closeTab(tab);
  tab.select.onkeydown=async e=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)||blocked())return;
    e.preventDefault();
    const i=tabs.indexOf(tab), target=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
    if(await activate(tabs[target]))tabs[target].select.focus();
  };
  tab.frame=document.createElement('iframe'); tab.frame.className='document-frame'; tab.frame.id='document-'+id; tab.frame.title=opened.name;
  tab.frame.setAttribute('role','tabpanel'); tab.frame.setAttribute('aria-labelledby',tab.select.id); tab.frame.hidden=true;
  return tab;
}
async function add(opened) {
  const existing=tabs.find(tab=>(tab.api?.info().path||tab.document.path)===opened.path);
  if(existing) { await invoke('release_document',{id:opened.id}); await activate(existing,true); return; }
  const tab=createTab(opened), previous=active;
  try {
    // WKWebView can suspend PDF/font tasks in display:none frames. Load the
    // provisional editor visibly and restore the old document on failure.
    if(previous){await previous.api.deactivate();previous.frame.hidden=true;}
    tab.frame.hidden=false;tab.frame.inert=true;
    const ready=new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('Editor konnte nicht geladen werden.')),20000);
      tab.frame.onload=()=>{clearTimeout(timer); const api=tab.frame.contentWindow.FinDobeDocument; api?resolve(api):reject(Error('Editor ist nicht bereit.'));};
      tab.frame.onerror=()=>{clearTimeout(timer);reject(Error('Editor konnte nicht geladen werden.'));};
    });
    tab.frame.src=/\.(findobe|docx|odt)$/i.test(opened.name)||opened.package||opened.source?'document.html':'index.html'; $('#documents').append(tab.frame);
    tab.api=await ready; let loadTimer;try{await Promise.race([tab.api.load(opened),new Promise((_,reject)=>{loadTimer=setTimeout(()=>reject(Error('Dokument konnte nicht innerhalb von 45 Sekunden geladen werden.')),45000);})]);}finally{clearTimeout(loadTimer);}
    tabs.push(tab); $('#documentTabs').append(tab.item); await activate(tab,true);
    $('#tabAnnouncement').textContent=opened.name+' geöffnet';
  } catch(err) {
    tab.api?.dispose(); tab.frame.remove(); tab.item.remove();
    await invoke('release_document',{id:opened.id});
    if(previous){previous.frame.hidden=false;await previous.api.activate();}
    throw err;
  }
}
async function open(path, propagate=false) {
  if(blocked())return;
  if(active && !await active.api.flush())return;
  busy=true; render(); $('#shellError').hidden=true;
  try {
    const opened=await invoke(typeof path==='string'?'open_path':'open_document',typeof path==='string'?{path}:{});
    if(opened){await add(opened);return active.api.info();}
  } catch(err) { error('Öffnen fehlgeschlagen: '+err); if(propagate)throw err; }
  finally {busy=false;render();}
}
async function confirmClose(tab) {
  if(!await tab.api.flush())return false;
  if(!tab.api.info().dirty)return true;
  await activate(tab,true);
  const dialog=$('#closeTabDialog');
  $('#closeDescription').textContent='„'+tab.api.info().name+'“ enthält ungespeicherte Änderungen.';
  const choice=await new Promise(resolve=>{
    const finish=value=>{dialog.close();dialog.onclick=null;dialog.oncancel=null;resolve(value);};
    dialog.onclick=e=>{const value=e.target.dataset.close;if(value)finish(value);};
    dialog.oncancel=e=>{e.preventDefault();finish('cancel');};
    dialog.showModal(); dialog.querySelector('[data-close="cancel"]').focus();
  });
  return choice==='discard'||(choice==='save'&&await tab.api.save(false));
}
async function closeTab(tab) {
  if(blocked()||!tabs.includes(tab))return;
  busy=true;render();
  try {
    if(!await confirmClose(tab))return;
    await invoke('release_document',{id:tab.document.id});
    const index=tabs.indexOf(tab); tabs.splice(index,1);
    clearDraft(tab.document.id);tab.api.dispose();tab.frame.remove();tab.item.remove();
    if(active===tab){active=null;await activate(tabs[Math.min(index,tabs.length-1)]||null,true);}
  } catch(err){error('Tab konnte nicht geschlossen werden: '+err);}
  finally{busy=false;render();}
}
async function closeWindow() {
  if(blocked())return;
  busy=true;render();
  try {
    // Don't remove/discard any tab until every decision is confirmed.
    for(const tab of tabs)if(!await confirmClose(tab))return;
    for(const tab of tabs)await clearDraft(tab.document.id);
    await draftQueue;
    await invoke('close_editor');
  } catch(err){error('Beenden fehlgeschlagen: '+err);}
  finally{busy=false;render();}
}
async function action(method,...args) {
  if(blocked()||!active)return;
  busy=true;render();
  try {await active.api[method](...args);}catch(err){error(err);}
  finally{busy=false;render();}
}
function shortcut(e) {
  const key=e.key.toLowerCase();
  const cycle=e.ctrlKey&&key==='tab';
  if(!cycle&&!(e.metaKey||e.ctrlKey))return false;
  const pdfHistory=active?.api?.info().mode==='pdf'&&['z','y'].includes(key);
  if(pdfHistory&&e.target.matches?.('input,textarea,[contenteditable]'))return false;
  if(!cycle&&!pdfHistory&&!['o','s','p','w','f'].includes(key))return false;
  e.preventDefault();e.stopImmediatePropagation();
  if(blocked())return true;
  if(cycle&&tabs.length){const i=tabs.indexOf(active);activate(tabs[(i+(e.shiftKey?-1:1)+tabs.length)%tabs.length]);}
  else if(pdfHistory)void action(key==='y'||e.shiftKey?'redo':'undo');
  else if(key==='o')void open();
  else if(key==='w'){if(active)void closeTab(active);}
  else if(key==='s')void action('save',e.shiftKey);
  else if(key==='p')void action('exportPdf');
  else if(key==='f')void action('search');
  return true;
}
window.FinDobeTabs={open,shortcut,changed:()=>render(),cacheDraft,clearDraft,newDocument,convert,agent,previewOpened:async opened=>{if(blocked())throw Error('Editor beschäftigt.');busy=true;render();try{await add(opened);}finally{busy=false;render();}}};
window.addEventListener('keydown',shortcut,true);
// Keep a PDF input open until the clicked action can await its commit.
// Otherwise blur can disable the button between mousedown and click.
document.addEventListener('mousedown', e => {
  if(active?.api?.info().editingPdf && e.target.closest('button') && !e.target.closest('dialog')) e.preventDefault();
}, true);
for(const id of ['btnOpen','addTab','btnStartOpen'])$('#'+id).onclick=()=>void open();
$('#btnSave').onclick=()=>void action('save',false);
$('#btnSaveAs').onclick=()=>void action('save',true);
$('#btnExpPdf').onclick=()=>void action('exportPdf');
$('#btnSearch').onclick=()=>void action('search');
async function start() {
  await loadDrafts();
  const events=window.__TAURI__.event;
  let rpcQueue=Promise.resolve();
  await events.listen('agent-request',e=>{if(['list','describe','status'].includes(e.payload.request?.method)){void agent(e.payload.request).then(result=>invoke('agent_reply',{id:e.payload.id,response:{ok:true,result}}));return;}rpcQueue=rpcQueue.then(async()=>{try {const result=await agent(e.payload.request);await invoke('agent_reply',{id:e.payload.id,response:{ok:true,result}});}catch(err){await invoke('agent_reply',{id:e.payload.id,response:{ok:false,error:String(err.message||err)}});}}).catch(error);});
  await events.listen('request-close',()=>void closeWindow());
  await events.listen('tauri://drag-drop',e=>{
    $('#shellDrop').hidden=true;
    if(e.payload.paths?.length===1)void open(e.payload.paths[0]);
    else error('Bitte eine einzelne Datei ablegen.');
  });
  await events.listen('tauri://drag-enter',()=>{$('#shellDrop').hidden=false;});
  await events.listen('tauri://drag-leave',()=>{$('#shellDrop').hidden=true;});
  await window.FinDobeFileOpen({listen:(event,handler)=>events.listen(event,handler),takeNext:()=>invoke('take_pending_files'),isBusy:blocked,open,reportError:error});
  try{await invoke('agent_ready');}catch{}
}
const DRAFTS='findobe-drafts-v1',draftSession=crypto.randomUUID();
const draftKey=id=>draftSession+':'+id;
let draftStore={},draftQueue=Promise.resolve();
function drafts(){return draftStore;}
function renderRecovery(){$('#btnRecover').hidden=!Object.keys(draftStore).length;}
function persistDraft(key,name,content){draftQueue=draftQueue.then(()=>invoke('cache_draft',{key,name,content})).catch(err=>error('Entwurfssicherung fehlgeschlagen. Bitte das Dokument als Datei speichern: '+err));return draftQueue;}
function cacheDraft(id,pkg){const tab=tabs.find(t=>t.document.id===id);if(!tab)return;const key=draftKey(id);if(!tab.api.info().dirty){clearDraft(id);return;}const name=tab.api.info().name;draftStore[key]={name,at:Date.now(),package:pkg};renderRecovery();persistDraft(key,name,JSON.stringify(pkg));}
function clearDraft(id){const key=typeof id==='string'&&id.includes(':')?id:draftKey(id);delete draftStore[key];renderRecovery();return persistDraft(key,'',null);}
async function loadDrafts(){try{draftStore=await invoke('list_drafts');renderRecovery();}catch{}}
async function newDocument(pkg,source){
  if(blocked())throw Error('Editor beschäftigt.');if(active&&!await active.api.flush())return;
  busy=true;render();try {const opened=await invoke('new_document');if(pkg)opened.package=pkg;if(source)opened.source=source;await add(opened);return active.api.info();}finally{busy=false;render();}
}
async function convert(){if(!active||blocked())return;if(active.api.info().mode==='structured')return active.api.info();if(!await active.api.flush())return;const source=await active.api.toStructured();return newDocument(null,source);}
async function agent(request){
  if(!request||typeof request.method!=='string')throw Error('Methodenname fehlt.');
  if(request.method==='status')return {busy,active:active?.api.info(),error:$('#shellError').hidden?null:$('#shellError').textContent,frames:[...document.querySelectorAll('.document-frame')].map(f=>({name:f.title,hidden:f.hidden,state:f.contentWindow.FinDobeDocument?.info()}))};
  if(request.method==='describe')return {protocol:1,methods:['list','status','drafts','recover','new','open','convert','read','apply','propose','comment','accept','save','export','preview','close'],operations:['setMetadata','setText','replaceText','replace','insertBefore','insertAfter','append','delete'],formats:['findobe','docx','odt','html','md','txt','pdf'],guards:'expectedRevision or matching expected node on every target; read summary or target for smaller responses',collaboration:'live local editor; agent edits share history and conflict checks with human edits'};
  if(request.method==='drafts')return Object.entries(drafts()).map(([key,d])=>({key,name:d.name,at:d.at}));
  if(request.method==='list')return tabs.map(t=>t.api.info());
  if(blocked())throw Error('Editor beschäftigt oder Dialog geöffnet. Bitte erneut versuchen.');
  if(request.method==='recover'){const d=drafts()[request.key];if(!d)throw Error('Entwurf nicht gefunden.');const pkg=d.package||await invoke('read_draft',{key:request.key});const opened=await newDocument(pkg);await clearDraft(request.key);cacheDraft(opened.id,tabs.find(t=>t.document.id===opened.id).api.snapshot());return opened;}
  if(request.method==='new')return newDocument(request.package);
  if(request.method==='open'){if(typeof request.path!=='string')throw Error('Dateipfad fehlt.');const opened=await open(request.path,true);if(!opened)throw Error('Datei konnte nicht geöffnet werden; Hinweise im Editor prüfen.');return opened;}
  const tab=request.documentId===undefined?active:tabs.find(t=>t.document.id===request.documentId);if(!tab)throw Error('Dokument nicht geöffnet.');
  if(tab.api.info().blocked)throw Error('Dokument beschäftigt.');
  if(request.method==='close'){await closeTab(tab);return {closed:!tabs.includes(tab)};}
  if(request.method==='convert'){await activate(tab);return convert();}
  if(tab.api.info().mode!=='structured')throw Error('Bitte zuerst gemeinsam bearbeiten / convert aufrufen. Die Originaldatei bleibt erhalten.');
  if(request.method==='save'){if(!await tab.api.save(!!request.saveAs,request.path))throw Error('Speichern fehlgeschlagen oder abgebrochen. Hinweise im Editor prüfen.');return tab.api.info();}
  if(request.method==='preview')return tab.api.previewPdf();
  if(request.method==='export')return tab.api.export(request.format,request.path);
  return tab.api.agent(request);
}
$('#btnNew').onclick=$('#btnStartNew').onclick=()=>newDocument().catch(error);
$('#btnCollaborate').onclick=()=>convert().catch(error);
$('#btnAgent').onclick=async()=>{try{const c=await invoke('agent_connection');$('#agentConnection').textContent='Lokal auf Port '+c.port+'. Verbindungsdatei: '+c.manifest;$('#agentDialog').showModal();}catch(err){error(err);}};
$('#agentClose').onclick=()=>$('#agentDialog').close();
$('#btnRecover').onclick=()=>{const list=$('#recoveryList');list.replaceChildren();for(const [key,d] of Object.entries(drafts())){const row=document.createElement('div'),b=document.createElement('button'),discard=document.createElement('button');b.textContent=d.name+' · '+new Date(d.at).toLocaleString('de-AT');b.onclick=async()=>{try{$('#recoveryDialog').close();const pkg=d.package||await invoke('read_draft',{key});await newDocument(pkg);await clearDraft(key);cacheDraft(active.document.id,active.api.snapshot());}catch(e){error(e);}};discard.textContent='Entwurf entfernen';discard.onclick=()=>{clearDraft(key);row.remove();};row.append(b,discard);list.append(row);}$('#recoveryDialog').showModal();};
$('#recoveryClose').onclick=()=>$('#recoveryDialog').close();
renderRecovery();
render();
document.fonts.ready.then(()=>{if(!tabs.length&&!matchMedia('(prefers-reduced-motion: reduce)').matches)$('#startupTitle').classList.add('typing');});
start().catch(err=>error('FinDobe konnte nicht gestartet werden: '+err));
