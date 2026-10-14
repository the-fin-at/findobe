import {Editor} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Doc from '@tiptap/extension-document';
import {TableKit} from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import {TextStyleKit} from '@tiptap/extension-text-style';
import UniqueID from '@tiptap/extension-unique-id';
import {Fragment} from '@tiptap/pm/model';
import {closeHistory} from '@tiptap/pm/history';
import {TextSelection} from '@tiptap/pm/state';
import {TableMap} from '@tiptap/pm/tables';
import {id,clone,same,emptyDocument,defaultLayout,normalizeIds,validateDocument,packageDocument,assertGuard,findNode,textOf,walk} from './model.js';
import {importFile,exportFile,extension,encode,sanitizePaste} from './formats.js';
const $=s=>document.querySelector(s), host=window.parent.FinDobeTabs;
const call=(command,args={})=>window.parent.__TAURI__.core.invoke(command,args);
let opened,editor,revision=0,history=[],baseline='',loading=false,working=false,notice=[],imported=false,autosaveTimer,layoutPending=false,titlePending=false;
const Document=Doc.extend({addAttributes(){return {title:{default:'Neues Dokument'},layout:{default:defaultLayout()},comments:{default:[]},proposals:{default:[]}};}});
const extensions=[Document,StarterKit.configure({document:false,italic:false,link:{openOnClick:false,autolink:false},trailingNode:false}),TableKit.configure({table:{resizable:true}}),Image.configure({allowBase64:true}),TextAlign.configure({types:['heading','paragraph']}),TextStyleKit,UniqueID.configure({types:['paragraph','heading','listItem','blockquote','codeBlock','bulletList','orderedList','horizontalRule','table','tableRow','tableCell','tableHeader','image']})];
// Italic is accepted from imports for semantic compatibility, displayed upright.
import Italic from '@tiptap/extension-italic';extensions.push(Italic);
function status(message,error=false) {$('#docStatus').textContent=message;$('#docStatus').classList.toggle('error',error);}
function changed(){host.changed();renderOutline();renderCollaboration();renderFields();clearTimeout(autosaveTimer);autosaveTimer=setTimeout(()=>host.cacheDraft(opened.id,snapshot()),300);status('Revision '+revision+' · '+(dirty()?'Ungespeichert':'Gespeichert'));}
function dirty(){return layoutPending||titlePending||imported||!!opened?.draft||JSON.stringify(editor?.getJSON())!==baseline;}
function snapshot(){return packageDocument(editor.getJSON(),revision,history);}
function transactionUpdate({transaction}) {
  if(loading||!transaction.docChanged)return;
  revision++;const actor=transaction.getMeta('findobeActor')||'Mensch';
  history.push({id:id(),revision,author:actor,at:new Date().toISOString(),summary:transaction.getMeta('findobeSummary')||'Dokument bearbeitet'});history=history.slice(-500);changed();
}
function renderFields(){
  const a=editor.getJSON().attrs;$('#docName').textContent=opened.name;if(!titlePending&&$('#docTitle').value!==a.title)$('#docTitle').value=a.title;
  const l=a.layout;if(!layoutPending){$('#pageSize').value=l.size;$('#orientation').value=l.orientation;$('#pageMargin').value=l.margin;$('#pageHeader').value=l.header;$('#pageFooter').value=l.footer;$('#pageNumbers').checked=l.pageNumbers;}
  $('#paper').style.maxWidth=l.orientation==='landscape'?'1123px':'794px';$('#paper').style.padding=Math.min(90,l.margin*1.333)+'px';$('#paperHeader').textContent=l.header;$('#paperFooter').textContent=l.footer;
  $('#importNotice').hidden=!notice.length;$('#importNotice').textContent=notice.join(' ');
}
function renderOutline(){const root=$('#outline');root.replaceChildren();editor.state.doc.descendants((n,pos)=>{if(n.type.name==='heading'){const b=document.createElement('button');b.textContent=n.textContent||'Leere Überschrift';b.style.paddingLeft=(n.attrs.level-1)*10+'px';b.onclick=()=>{editor.commands.focus();editor.commands.setTextSelection(pos+1);editor.commands.scrollIntoView();};root.append(b);}});}
function selectedTarget(){if(editor.state.selection.node?.attrs.id)return editor.state.selection.node.attrs.id;const {$from}=editor.state.selection;for(let d=$from.depth;d>0;d--){const n=$from.node(d);if(n.attrs.id)return n.attrs.id;}return editor.state.doc.firstChild?.attrs.id;}
function targetLink(target){const b=document.createElement('button');const node=findNode(editor.getJSON(),target);b.className='anchor';b.textContent=node?(textOf(node).slice(0,60)||node.type):'Baustein entfernt';b.onclick=()=>{let pos;editor.state.doc.descendants((n,p)=>{if(n.attrs.id===target)pos=p;});if(pos!==undefined){editor.commands.focus();editor.commands.setTextSelection(pos+1);editor.commands.scrollIntoView();}};return b;}
function control(label,fn){const b=document.createElement('button');b.textContent=label;b.type='button';b.onclick=()=>run(fn);return b;}
function renderCollaboration(){
  const a=editor.getJSON().attrs,root=$('#collaboration');root.replaceChildren();
  for(const c of a.comments){const box=document.createElement('article'),who=document.createElement('strong'),p=document.createElement('p');who.textContent=c.author+(c.resolved?' · Erledigt':'');p.textContent=c.text;box.append(who,targetLink(c.target),p,control(c.resolved?'Wieder öffnen':'Erledigen',()=>meta('comments',a.comments.map(x=>x.id===c.id?{...x,resolved:!x.resolved}:x),'Kommentar aktualisiert')));root.append(box);}
  for(const p of a.proposals){const box=document.createElement('article'),who=document.createElement('strong'),reason=document.createElement('p'),preview=document.createElement('pre');who.textContent=p.author+' · Vorschlag';reason.textContent=p.reason;preview.textContent=p.operations.map(o=>o.type+': '+(o.text||textOf(o.node||{})||o.target||'')).join('\n');box.append(who,reason,preview,control('Übernehmen',()=>accept(p.id)),control('Verwerfen',()=>meta('proposals',a.proposals.filter(x=>x.id!==p.id),'Vorschlag verworfen')));root.append(box);}
  if(!root.children.length){const p=document.createElement('p');p.textContent='Kommentare und Vorschläge von Menschen und Agenten erscheinen hier.';root.append(p);}
  $('#audit').replaceChildren(...history.slice(-30).reverse().map(h=>{const p=document.createElement('p');p.textContent=h.author+' · '+h.summary+' · r'+h.revision;return p;}));
}
function meta(key,value,summary,author='Mensch'){const tr=editor.state.tr;tr.setDocAttribute(key,value);validateDocument(tr.doc.toJSON());tr.setMeta('findobeActor',author).setMeta('findobeSummary',summary);editor.view.dispatch(closeHistory(tr));}
function locate(doc,target){let found;doc.descendants((n,pos)=>{if(n.attrs.id===target)found={node:n,pos};});if(!found)throw Error('Baustein nicht gefunden: '+target);return found;}
function prepare(request){
  const live=editor.getJSON();assertGuard(live,revision,request);const tr=editor.state.tr;
  for(const op of request.operations){
    const hit=op.target?locate(tr.doc,op.target):null;
    if(op.expected&&!same(hit?.node.toJSON(),op.expected))throw Error('Konflikt: Der betroffene Baustein wurde geändert.');
    if(op.type==='setMetadata'){if(!op.attrs||typeof op.attrs!=='object'||Array.isArray(op.attrs))throw Error('Metadaten fehlen.');for(const [key,value] of Object.entries(op.attrs)){if(!['title','layout'].includes(key))throw Error('Nur Titel und Seitenlayout können als Metadaten geändert werden.');tr.setDocAttribute(key,clone(value));}}
    else if(op.type==='setText') {if(!hit.node.isTextblock)throw Error('setText benötigt einen Absatz, eine Überschrift oder einen Codeblock.');if(typeof op.text!=='string')throw Error('Text fehlt.');const replacement=hit.node.type.create(hit.node.attrs,op.text?editor.schema.text(op.text):null,hit.node.marks);tr.replaceWith(hit.pos,hit.pos+hit.node.nodeSize,replacement);}
    else if(op.type==='replaceText'){if(!hit.node.isTextblock||!Number.isInteger(op.from)||!Number.isInteger(op.to)||op.from<0||op.to<op.from||op.to>hit.node.content.size||typeof op.text!=='string')throw Error('Ungültiger Textbereich.');const from=hit.pos+1+op.from,to=hit.pos+1+op.to;const marks=tr.doc.resolve(from).marks();tr.replaceWith(from,to,op.text?editor.schema.text(op.text,marks):Fragment.empty);}
    else if(op.type==='replace') {let json=clone(op.node);json.attrs={...json.attrs,id:hit.node.attrs.id};json=normalizeIds(json);const node=editor.schema.nodeFromJSON(json);node.check();const at=tr.doc.resolve(hit.pos);if(!at.parent.canReplaceWith(at.index(),at.index()+1,node.type))throw Error('Baustein passt nicht an diese Stelle.');tr.replaceWith(hit.pos,hit.pos+hit.node.nodeSize,node);}
    else if(op.type==='insertAfter'||op.type==='insertBefore'||op.type==='append') {const json=normalizeIds(clone(op.node));const node=editor.schema.nodeFromJSON(json);node.check();const pos=op.type==='append'?tr.doc.content.size:hit.pos+(op.type==='insertAfter'?hit.node.nodeSize:0);const at=tr.doc.resolve(pos);if(!at.parent.canReplaceWith(at.index(),at.index(),node.type))throw Error('Baustein passt nicht an diese Stelle.');tr.insert(pos,node);}
    else if(op.type==='delete'){const at=tr.doc.resolve(hit.pos);if(!at.parent.canReplace(at.index(),at.index()+1))throw Error('Dieser Baustein ist für die Dokumentstruktur erforderlich.');tr.delete(hit.pos,hit.pos+hit.node.nodeSize);}
    else throw Error('Unbekannte Änderungsoperation: '+op.type);
    // replaceWith may fit an incompatible node by restructuring; reject it rather than lose content.
    validateDocument(tr.doc.toJSON());tr.doc.check();tr.doc.descendants(n=>{if(n.type.name==='table'&&TableMap.get(n).problems?.length)throw Error('Tabellenstruktur ist ungültig.');});
  }
  return tr;
}
function apply(request,extra){
  validateActor(request);
  const tr=prepare(request);if(extra)tr.setDocAttribute(extra.key,extra.value);
  tr.setMeta('findobeActor',request.author||'Agent').setMeta('findobeSummary',request.summary||'Gezielte Änderung');editor.view.dispatch(closeHistory(tr));return read();
}
function propose(request){validateActor(request);const tr=prepare(request); // validates schema and every precondition without dispatching
  const operations=request.operations.map(op=>({...clone(op),...(op.target?{expected:findNode(editor.getJSON(),op.target)}:{})}));
  const p={id:id(),author:request.author||'Agent',reason:String(request.reason||'Änderungsvorschlag'),operations,expectedRevision:revision+1};
  meta('proposals',[...editor.getJSON().attrs.proposals,p],'Vorschlag hinterlassen',p.author);return {id:p.id,revision};
}
function accept(pid){const p=editor.getJSON().attrs.proposals.find(p=>p.id===pid);if(!p)throw Error('Vorschlag nicht gefunden.');
  // Recording the proposal increments revision. Block guards handle changes since then.
  apply({...p,expectedRevision:p.expectedRevision},{key:'proposals',value:editor.getJSON().attrs.proposals.filter(x=>x.id!==pid)});
}
function validateActor(request){if(request.author!==undefined&&(typeof request.author!=='string'||request.author.length>120))throw Error('Ungültiger Änderungsautor.');if(request.reason!==undefined&&(typeof request.reason!=='string'||request.reason.length>10000))throw Error('Ungültige Vorschlagsbegründung.');}
function read(request={}){const doc=editor.getJSON();if(request.target){const node=findNode(doc,request.target);if(!node)throw Error('Baustein nicht gefunden.');return {...info(),node:clone(node),text:textOf(node)};}if(request.summary)return {...info(),title:doc.attrs.title,layout:doc.attrs.layout,comments:doc.attrs.comments,proposals:doc.attrs.proposals,blocks:doc.content.map(n=>({id:n.attrs?.id,type:n.type,text:textOf(n).slice(0,180)}))};const pkg=snapshot(),nodes=[];walk(pkg.document,n=>{if(n.attrs?.id)nodes.push({id:n.attrs.id,type:n.type,text:textOf(n),node:n});});return {...info(),package:pkg,nodes};}
function info(){return {...opened,text:undefined,package:undefined,source:undefined,warnings:notice,mode:'structured',dirty:dirty(),blocked:working||!!document.querySelector('dialog[open]'),revision,imported};}
async function load(input){
  loading=true;opened=input;
  try {
    const importedFile=input.package?{package:input.package,warnings:input.warnings||[]}:input.draft&&!input.source?{package:packageDocument(emptyDocument()),warnings:[]}:await importFile(input.source||input,relative=>call('read_resource',{id:input.source?.id||input.id,relative}));
    notice=[...importedFile.warnings,...(input.source?.warnings||[])];imported=!input.draft&&extension(input.name)!=='findobe';
    editor=new Editor({element:$('#editor'),extensions,content:importedFile.package?.document||importedFile.html||emptyDocument(),enableContentCheck:!!importedFile.package,editorProps:{transformPastedHTML:sanitizePaste,attributes:{role:'textbox','aria-label':'Dokument bearbeiten','aria-multiline':'true'},handleDOMEvents:{drop:(view,event)=>{if(event.dataTransfer?.files.length){event.preventDefault();status('Bilder bitte über „Bild“ einfügen.');return true;}return false;}}},onUpdate:transactionUpdate,onSelectionUpdate:()=>{$('#blockStyle').value=editor.isActive('heading')?'h'+editor.getAttributes('heading').level:'p';}});
    let doc=normalizeIds(editor.getJSON());doc.attrs={...emptyDocument().attrs,...doc.attrs,title:importedFile.package?.document.attrs?.title||input.name.replace(/\.[^.]+$/,'')};validateDocument(doc);editor.schema.nodeFromJSON(doc).check();editor.commands.setContent(doc,{emitUpdate:false,errorOnInvalidContent:true});
    revision=importedFile.package?.revision||0;history=importedFile.package?.history||[];baseline=JSON.stringify(editor.getJSON());
    $('#docTitle').oninput=()=>{titlePending=true;host.changed();};
    $('#docTitle').onchange=()=>run(flushMetadata);
    renderOutline();renderCollaboration();renderFields();status(imported?'Importiert · Als Findobe-Arbeitsdatei speichern':'Bereit · Revision '+revision);
  } finally {loading=false;host.changed();}
}
async function save(saveAs=false,path){if(working)return false;try{flushMetadata();}catch(e){status(e.message,true);return false;}working=true;editor.setEditable(false);document.body.inert=true;host.changed();try {
  const pkg=snapshot();const content=JSON.stringify(pkg,null,2)+'\n';
  const result=await call('save_structured',{id:opened.id,content,saveAs:saveAs||imported||!!opened.draft,path:path||null});if(!result)return false;
  Object.assign(opened,result,{draft:false,encoding:'utf8'});imported=false;baseline=JSON.stringify(editor.getJSON());host.clearDraft(opened.id);renderFields();status('Gespeichert · Revision '+revision);return true;
} catch(e){status('Speichern fehlgeschlagen: '+e,true);return false;}finally{working=false;editor.setEditable(true);document.body.inert=false;host.changed();}}
async function exportDocument(format,path){if(working)throw Error('Dokument beschäftigt.');flushMetadata();working=true;editor.setEditable(false);document.body.inert=true;host.changed();try {
  const pkg=snapshot(),result=await exportFile(format,editor,pkg);
  const saved=await call('export_document',{id:opened.id,format,content:result.content,name:pkg.document.attrs.title,path:path||null});
  if(saved){notice=[...new Set([...notice,...result.warnings])];renderFields();status(format.toUpperCase()+' exportiert');}return {...saved,warnings:result.warnings};
}finally{working=false;editor.setEditable(true);document.body.inert=false;host.changed();}}
async function previewPdf(){if(working)throw Error('Dokument beschäftigt.');flushMetadata();working=true;editor.setEditable(false);document.body.inert=true;host.changed();let preview;try{const result=await exportFile('pdf',editor,snapshot());preview=await call('preview_pdf_document',{content:result.content,name:editor.getJSON().attrs.title});}finally{working=false;editor.setEditable(true);document.body.inert=false;host.changed();}await host.previewOpened(preview);return preview;}
async function run(fn){try{await fn();}catch(e){status(String(e.message||e),true);}}
for(const b of document.querySelectorAll('[data-command]')) {b.onmousedown=e=>e.preventDefault();b.onclick=()=>run(()=>editor.chain().focus()[b.dataset.command]().run());}
$('#blockStyle').onchange=()=>{const value=$('#blockStyle').value;value==='p'?editor.chain().focus().setParagraph().run():editor.chain().focus().setHeading({level:Number(value.slice(1))}).run();};
$('#textColor').oninput=()=>editor.chain().focus().setColor($('#textColor').value).run();
$('#textSize').onchange=()=>editor.chain().focus().setFontSize($('#textSize').value+'pt').run();
$('#insertTable').onclick=()=>editor.chain().focus().insertTable({rows:3,cols:3,withHeaderRow:true}).run();
$('#tableAction').onchange=()=>run(()=>{const v=$('#tableAction').value;$('#tableAction').value='';if(v)editor.chain().focus()[v]().run();});
$('#insertImage').onclick=()=>$('#imageInput').click();$('#imageInput').onchange=()=>run(async()=>{const file=$('#imageInput').files[0];if(!file)return;if(file.size>10*1024*1024)throw Error('Bild höchstens 10 MB.');if(!['image/png','image/jpeg','image/gif','image/webp'].includes(file.type))throw Error('PNG, JPEG, GIF oder WebP auswählen.');const src='data:'+file.type+';base64,'+encode(new Uint8Array(await file.arrayBuffer()));editor.chain().focus().setImage({src,alt:file.name}).run();$('#imageInput').value='';});
$('#insertLink').onclick=()=>{const dialog=$('#linkDialog');$('#linkUrl').value=editor.getAttributes('link').href||'';dialog.showModal();};
$('#linkApply').onclick=()=>run(()=>{const href=$('#linkUrl').value;if(href&&!/^(https?:|mailto:|#)/i.test(href))throw Error('Bitte ein HTTP-, HTTPS- oder Mail-Linkziel eingeben.');$('#linkDialog').close();const chain=editor.chain().focus().extendMarkRange('link');href?chain.setLink({href}).run():chain.unsetLink().run();});
function layoutFromFields(){return {size:$('#pageSize').value,orientation:$('#orientation').value,margin:Number($('#pageMargin').value),header:$('#pageHeader').value,footer:$('#pageFooter').value,pageNumbers:$('#pageNumbers').checked};}
function flushMetadata(){if(!editor)return;const attrs=editor.getJSON().attrs,next={...attrs,...(titlePending?{title:$('#docTitle').value}:{}),...(layoutPending?{layout:layoutFromFields()}: {})};validateDocument({...editor.getJSON(),attrs:next});const tr=editor.state.tr;let changed=false;for(const key of ['title','layout'])if(!same(attrs[key],next[key])){tr.setDocAttribute(key,next[key]);changed=true;}titlePending=false;layoutPending=false;if(changed){tr.setMeta('findobeActor','Mensch').setMeta('findobeSummary','Dokumenteigenschaften geändert');editor.view.dispatch(closeHistory(tr));}host.changed();}
for(const element of document.querySelectorAll('#pageSize,#orientation,#pageMargin,#pageHeader,#pageFooter,#pageNumbers'))element.addEventListener('input',()=>{layoutPending=true;host.changed();});
$('#layoutApply').onclick=()=>run(flushMetadata);
$('#addComment').onclick=()=>run(()=>{const text=$('#commentText').value.trim();if(!text)return;const target=selectedTarget();meta('comments',[...editor.getJSON().attrs.comments,{id:id(),target,text,author:'Mensch',resolved:false,at:new Date().toISOString()}],'Kommentar hinzugefügt');$('#commentText').value='';});
$('#previewPdf').onclick=()=>run(previewPdf);
$('#doExport').onclick=()=>run(()=>exportDocument($('#exportFormat').value));
$('#findInput').oninput=()=>search($('#findInput').value);
function search(query){$('#findBox').hidden=false;if(query===undefined){$('#findInput').focus();return;}if(!query)return;let found;editor.state.doc.descendants((n,p)=>{if(found||!n.isText)return;const i=n.text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());if(i>=0)found={from:p+i,to:p+i+query.length};});if(found){editor.commands.setTextSelection(found);editor.commands.scrollIntoView();}else status('Keine Textstelle gefunden.');}
$('#findClose').onclick=()=>{$('#findBox').hidden=true;editor.commands.focus();};
window.addEventListener('keydown',e=>host.shortcut(e),true);
window.FinDobeDocument={load,info,flush:async()=>{try{flushMetadata();return !working;}catch(e){status(e.message,true);return false;}},save,exportPdf:()=>exportDocument('pdf'),search,activate:async()=>{},deactivate:async()=>{clearTimeout(autosaveTimer);if(dirty())host.cacheDraft(opened.id,snapshot());},dispose:()=>{clearTimeout(autosaveTimer);editor?.destroy();},read,apply,propose,export:exportDocument,previewPdf,snapshot,undo:()=>editor.commands.undo(),redo:()=>editor.commands.redo(),
  agent:async request=>{if(working||editor.view.composing)throw Error('Dokument beschäftigt. Bitte erneut versuchen.');
    flushMetadata();
    if(request.method==='read')return read(request);
    if(request.method==='apply')return apply(request);
    if(request.method==='propose')return propose(request);
    if(request.method==='comment'){validateActor(request);if(!findNode(editor.getJSON(),request.target))throw Error('Kommentarziel nicht gefunden.');if(typeof request.text!=='string'||!request.text.trim()||request.text.length>10000)throw Error('Kommentartext ungültig.');meta('comments',[...editor.getJSON().attrs.comments,{id:id(),target:request.target,text:request.text,author:request.author||'Agent',resolved:false,at:new Date().toISOString()}],'Kommentar hinzugefügt',request.author||'Agent');return read();}
    if(request.method==='accept'){accept(request.proposalId);return read();}
    throw Error('Unbekannter Dokumentaufruf.');},
  testing:{editor:()=>editor,exportFile:format=>exportFile(format,editor,snapshot()),importFile,read:()=>read()}};
