'use strict';
// A live document frame owns its complete editor state, history and scroll.
// The shell owns only tab lifetime and native open/close routing.
const tabs = [];
let active = null, busy = false, serial = 0;
const $ = selector => document.querySelector(selector);
const invoke = (command, args = {}) => window.__TAURI__.core.invoke(command, args);
const blocked = () => busy || !!active?.api?.info().blocked;
function error(message) { $('#shellError').textContent=String(message); $('#shellError').hidden=false; }
function render() {
  const locked = blocked();
  $('#tabbar').hidden = !tabs.length;
  $('#welcome').hidden = !!active;
  for (const button of document.querySelectorAll('#topbar button,#addTab,#btnStartOpen')) {
    button.disabled = locked || (!active && !['btnOpen','addTab','btnStartOpen'].includes(button.id));
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
  tab.frame=document.createElement('iframe'); tab.frame.className='document-frame'; tab.frame.id='document-'+id;
  tab.frame.setAttribute('role','tabpanel'); tab.frame.setAttribute('aria-labelledby',tab.select.id); tab.frame.hidden=true;
  return tab;
}
async function add(opened) {
  const existing=tabs.find(tab=>(tab.api?.info().path||tab.document.path)===opened.path);
  if(existing) { await invoke('release_document',{id:opened.id}); await activate(existing,true); return; }
  const tab=createTab(opened);
  try {
    const ready=new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('Editor konnte nicht geladen werden.')),20000);
      tab.frame.onload=()=>{clearTimeout(timer); const api=tab.frame.contentWindow.FinDobeDocument; api?resolve(api):reject(Error('Editor ist nicht bereit.'));};
      tab.frame.onerror=()=>{clearTimeout(timer);reject(Error('Editor konnte nicht geladen werden.'));};
    });
    tab.frame.src='index.html'; $('#documents').append(tab.frame);
    tab.api=await ready; await tab.api.load(opened);
    tabs.push(tab); $('#documentTabs').append(tab.item); await activate(tab,true);
    $('#tabAnnouncement').textContent=opened.name+' geöffnet';
  } catch(err) {
    tab.api?.dispose(); tab.frame.remove(); tab.item.remove();
    await invoke('release_document',{id:opened.id}); throw err;
  }
}
async function open(path) {
  if(blocked())return;
  if(active && !await active.api.flush())return;
  busy=true; render(); $('#shellError').hidden=true;
  try {
    const opened=await invoke(typeof path==='string'?'open_path':'open_document',typeof path==='string'?{path}:{});
    if(opened)await add(opened);
  } catch(err) { error('Öffnen fehlgeschlagen: '+err); }
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
    tab.api.dispose();tab.frame.remove();tab.item.remove();
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
window.FinDobeTabs={open,shortcut,changed:()=>render()};
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
  const events=window.__TAURI__.event;
  await events.listen('request-close',()=>void closeWindow());
  await events.listen('tauri://drag-drop',e=>{
    $('#shellDrop').hidden=true;
    if(e.payload.paths?.length===1)void open(e.payload.paths[0]);
    else error('Bitte eine einzelne Datei ablegen.');
  });
  await events.listen('tauri://drag-enter',()=>{$('#shellDrop').hidden=false;});
  await events.listen('tauri://drag-leave',()=>{$('#shellDrop').hidden=true;});
  await window.FinDobeFileOpen({listen:(event,handler)=>events.listen(event,handler),takeNext:()=>invoke('take_pending_files'),isBusy:blocked,open,reportError:error});
}
render();
document.fonts.ready.then(()=>{if(!tabs.length&&!matchMedia('(prefers-reduced-motion: reduce)').matches)$('#startupTitle').classList.add('typing');});
start().catch(err=>error('FinDobe konnte nicht gestartet werden: '+err));
