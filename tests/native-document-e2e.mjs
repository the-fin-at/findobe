import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {connect} from '../scripts/findobe-agent.mjs';
const root=resolve('test-results/native-documents-'+Date.now());await mkdir(root,{recursive:true});
const rawRpc=await connect(),owned=new Set();const rpc=async request=>{const result=await rawRpc(request);if(['new','open','convert','preview','recover'].includes(request.method)&&result?.id)owned.add(result.id);return result;};
assert.equal((await rpc({method:'list'})).length,0,'Bitte eine leere Testinstanz starten und FINDOBE_AGENT_MANIFEST auf deren Verbindung setzen.');
const checks=[];const check=(name,condition)=>{assert.ok(condition,name);checks.push(name);};
const para=text=>({type:'paragraph',content:[{type:'text',text}]});
const cell=text=>({type:'tableCell',content:[para(text)]});
let doc=await rpc({method:'new'});let read=await rpc({method:'read',documentId:doc.id});const first=read.nodes.find(n=>n.type==='paragraph');
await rpc({method:'apply',documentId:doc.id,expectedRevision:read.revision,author:'Nativer Testagent',operations:[{type:'setText',target:first.id,text:'Native Zusammenarbeit – Grüße aus Österreich.'},{type:'append',node:{type:'heading',attrs:{level:1},content:[{type:'text',text:'Angebot Mensch und Agent'}]}},{type:'append',node:{type:'table',content:[{type:'tableRow',content:[{type:'tableHeader',content:[para('Leistung')]},{type:'tableHeader',content:[para('Preis')]}]},{type:'tableRow',content:[cell('Beratung'),cell('250 €')]}]}}]});
read=await rpc({method:'read',documentId:doc.id});check('native-live-agent-apply',read.nodes.some(n=>n.text.includes('Native Zusammenarbeit')));
await rpc({method:'comment',documentId:doc.id,target:first.id,author:'Nativer Testagent',text:'Native Kommentarprüfung'});
read=await rpc({method:'read',documentId:doc.id});const native=join(root,'angebot.findobe');await rpc({method:'save',documentId:doc.id,path:native});const persisted=JSON.parse(await readFile(native,'utf8'));check('native-file-save',persisted.document.attrs.comments[0].text==='Native Kommentarprüfung');
const stale=read.revision;read=await rpc({method:'read',documentId:doc.id});await rpc({method:'apply',documentId:doc.id,expectedRevision:read.revision,operations:[{type:'setText',target:first.id,text:'Nach Agentenänderung'}]});
await assert.rejects(()=>rpc({method:'apply',documentId:doc.id,expectedRevision:stale,operations:[{type:'setText',target:first.id,text:'Veraltet'}]}),/Konflikt/);checks.push('native-stale-conflict');
await rpc({method:'save',documentId:doc.id});
for(const format of ['findobe','docx','odt','html','md','txt','pdf']){
  const path=join(root,'export.'+format);await rpc({method:'export',documentId:doc.id,format,path});check('native-'+format+'-export',(await stat(path)).size>40);
  const imported=await rpc({method:'open',path});if(format==='pdf')check('native-pdf-background-raster',imported.rasterPages>0);const editable=imported.mode==='structured'?imported:await rpc({method:'convert',documentId:imported.id});let fresh=await rpc({method:'read',documentId:editable.id});check('native-'+format+'-import',fresh.nodes.some(n=>n.text.includes('Nach Agentenänderung')));
  const block=fresh.nodes.find(n=>n.type==='paragraph');await rpc({method:'apply',documentId:editable.id,expectedRevision:fresh.revision,operations:[{type:'setText',target:block.id,text:'Wieder bearbeitet: '+format}]});const savedPath=join(root,'edited-'+format+'.findobe');await rpc({method:'save',documentId:editable.id,path:savedPath});check('native-'+format+'-edit-save',JSON.parse(await readFile(savedPath,'utf8')).document.content.some(n=>JSON.stringify(n).includes('Wieder bearbeitet')));
  await assert.rejects(()=>rpc({method:'export',documentId:doc.id,format,path}),/existiert bereits|geöffnet/);checks.push('native-'+format+'-overwrite-protected');
}
// Actual filesystem changes must be detected by Rust, not a browser stub.
await writeFile(native,'Extern verändert');read=await rpc({method:'read',documentId:doc.id});await rpc({method:'apply',documentId:doc.id,expectedRevision:read.revision,operations:[{type:'setText',target:first.id,text:'Dateikonflikt-Test'}]});
await assert.rejects(()=>rpc({method:'save',documentId:doc.id}),/Speichern fehlgeschlagen/);check('native-external-change-preserved',(await readFile(native,'utf8'))==='Extern verändert');
await rpc({method:'save',documentId:doc.id,path:join(root,'konflikt-kopie.findobe')});
// A larger document exercises real pagination and repeating table headers.
const long=await rpc({method:'new'});read=await rpc({method:'read',documentId:long.id});const rows=[{type:'tableRow',content:[{type:'tableHeader',content:[para('Position')]},{type:'tableHeader',content:[para('Beschreibung')]}]},...Array.from({length:95},(_,i)=>({type:'tableRow',content:[cell(String(i+1)),cell('Beratungsleistung '+(i+1)+' mit einer längeren Beschreibung und österreichischen Umlauten ä ö ü.')] }))];
await rpc({method:'apply',documentId:long.id,expectedRevision:read.revision,operations:[{type:'append',node:{type:'heading',attrs:{level:1},content:[{type:'text',text:'Mehrseitige Leistungsübersicht'}]}},{type:'append',node:{type:'table',content:rows}}]});
for(const format of ['pdf','docx','odt'])await rpc({method:'export',documentId:long.id,format,path:join(root,'mehrseitig.'+format)});
await rpc({method:'save',documentId:long.id,path:join(root,'mehrseitig.findobe')});checks.push('native-multipage-exports');
// Real preview and on-disk recovery, through the same native bridge.
const preview=await rpc({method:'preview',documentId:long.id});check('native-in-app-pdf-preview',(await rpc({method:'list'})).some(d=>d.id===preview.id&&d.mode==='pdf'));
const draft=await rpc({method:'new'});read=await rpc({method:'read',documentId:draft.id});const draftBlock=read.nodes.find(n=>n.type==='paragraph');await rpc({method:'apply',documentId:draft.id,expectedRevision:read.revision,operations:[{type:'setText',target:draftBlock.id,text:'Nativer Entwurf auf Festplatte'}]});
await new Promise(resolve=>setTimeout(resolve,700));const drafts=await rpc({method:'drafts'});const checkpoint=drafts.find(d=>d.key.endsWith(':'+draft.id));check('native-disk-checkpoint',!!checkpoint);
const recovered=await rpc({method:'recover',key:checkpoint.key});read=await rpc({method:'read',documentId:recovered.id});check('native-draft-recovery',read.nodes.some(n=>n.text==='Nativer Entwurf auf Festplatte'));
await rpc({method:'save',documentId:draft.id,path:join(root,'draft-original.findobe')});await rpc({method:'save',documentId:recovered.id,path:join(root,'draft-recovered.findobe')});
read=await rpc({method:'read',documentId:recovered.id,summary:true});check('native-small-read',read.blocks.length===1&&!read.package);
const target=read.blocks[0].id;read=await rpc({method:'read',documentId:recovered.id,target});check('native-targeted-read',read.node.attrs.id===target);
await rpc({method:'apply',documentId:recovered.id,expectedRevision:read.revision,operations:[{type:'replaceText',target,from:0,to:7,text:'Geprüfter'}]});read=await rpc({method:'read',documentId:recovered.id});check('native-inline-edit',read.nodes[0].text==='Geprüfter Entwurf auf Festplatte');
const proposal=await rpc({method:'propose',documentId:recovered.id,expectedRevision:read.revision,reason:'Native Vorschlagsprüfung',operations:[{type:'append',node:para('Übernommener Vorschlag')} ]});await rpc({method:'accept',documentId:recovered.id,proposalId:proposal.id});check('native-proposal-accept',(await rpc({method:'read',documentId:recovered.id})).nodes.some(n=>n.text==='Übernommener Vorschlag'));await rpc({method:'save',documentId:recovered.id});
await writeFile(join(root,'summary.json'),JSON.stringify({passed:true,checks},null,2)+'\n');console.log(JSON.stringify({passed:true,count:checks.length,root,checks},null,2));

for(const documentId of owned){const doc=(await rpc({method:'list'})).find(d=>d.id===documentId);if(doc&&!doc.dirty&&!doc.blocked)await rpc({method:'close',documentId});}
