// The portable document contract. No UI or filesystem dependencies.
export const FORMAT = 'findobe';
export const VERSION = 1;
export const id = () => crypto.randomUUID();
export const clone = value => JSON.parse(JSON.stringify(value));
export const same = (a,b) => {if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.prototype.hasOwnProperty.call(b,k)&&same(a[k],b[k]));};
export const defaultLayout = () => ({size:'A4',orientation:'portrait',margin:56.7,header:'',footer:'',pageNumbers:true});
export const emptyDocument = () => ({type:'doc',attrs:{title:'Neues Dokument',layout:defaultLayout(),comments:[],proposals:[]},content:[{type:'paragraph',attrs:{id:id()}}]});
const types = new Set(['doc','paragraph','heading','text','hardBreak','bulletList','orderedList','listItem','blockquote','codeBlock','horizontalRule','table','tableRow','tableCell','tableHeader','image']);
const marks = new Set(['bold','italic','strike','underline','code','link','textStyle']);
export function walk(node, visit, parent=null) { visit(node,parent); for(const child of node.content||[]) walk(child,visit,node); }
export function textOf(node) { if(node.type==='text')return node.text; if(node.type==='hardBreak')return '\n'; return (node.content||[]).map(textOf).join(node.type==='doc'||node.type==='table'||node.type==='tableRow'?'\n':''); }
export function findNode(doc, target) { let found=null; walk(doc,n=>{if(n.attrs?.id===target)found=n;}); return found; }
export function normalizeIds(doc) {
  doc=clone(doc);
  const seen=new Set();walk(doc,n=>{if(n.type!=='doc'&&n.type!=='text'&&n.type!=='hardBreak') {n.attrs ||= {}; if(!n.attrs.id||seen.has(n.attrs.id))n.attrs.id=id();seen.add(n.attrs.id);}});return doc;
}
export function validateDocument(doc) {
  let count=0, ids=new Set();
  function check(n,depth=0) {
    if(depth>60||++count>50000)throw Error('Dokumentstruktur zu groß oder zu tief.');
    if(!n||typeof n!=='object'||!types.has(n.type))throw Error('Unbekannter Dokumentbaustein: '+n?.type);
    if(n.type==='text'&&(typeof n.text!=='string'||!n.text.length))throw Error('Ungültiger Textbaustein.');
    if(n.content!==undefined&&!Array.isArray(n.content))throw Error('Ungültiger Inhalt.');
    if(n.attrs?.id) {if(typeof n.attrs.id!=='string'||n.attrs.id.length>120||ids.has(n.attrs.id))throw Error('Doppelte oder ungültige Baustein-ID: '+n.type+' ('+typeof n.attrs.id+', '+String(n.attrs.id).slice(0,120)+')');ids.add(n.attrs.id);}
    if(n.type==='image'&&!/^data:image\/(png|jpeg|gif|webp);base64,[a-z\d+/=\s]+$/i.test(n.attrs?.src||''))throw Error('Bilder müssen eingebettete PNG-, JPEG-, GIF- oder WebP-Dateien sein.');
    for(const m of n.marks||[]) {
      if(!marks.has(m.type))throw Error('Unbekannte Textformatierung.');
      if(m.type==='link'&&!/^(https?:|mailto:|#)/i.test(m.attrs?.href||''))throw Error('Ungültiges Linkziel.');
      if(m.type==='textStyle')for(const [k,v] of Object.entries(m.attrs||{})) {
        if(k==='color'&&!/^#[a-f\d]{3,8}$/i.test(v||''))throw Error('Ungültige Textfarbe.');
        if(k==='fontSize'&&!/^\d{1,3}(\.\d+)?(pt|px)$/.test(v||''))throw Error('Ungültige Schriftgröße.');
        if(k==='fontFamily'&&!/^[a-z \d,-]{1,80}$/i.test(v||''))throw Error('Ungültige Schrift.');
      }
    }
    if(n.type==='heading'&&(!Number.isInteger(n.attrs?.level)||n.attrs.level<1||n.attrs.level>6))throw Error('Ungültige Überschrift.');
    if(n.attrs?.textAlign&&!['left','right','center','justify'].includes(n.attrs.textAlign))throw Error('Ungültige Ausrichtung.');
    for(const k of ['colspan','rowspan'])if(n.attrs?.[k]!==undefined&&(!Number.isInteger(n.attrs[k])||n.attrs[k]<1||n.attrs[k]>100))throw Error('Ungültige Tabellenzelle.');
    for(const c of n.content||[])check(c,depth+1);
  }
  check(doc); if(doc.type!=='doc')throw Error('Dokumentwurzel fehlt.');
  const a=doc.attrs||{};if(a.layout!==undefined&&(!a.layout||typeof a.layout!=='object'||Array.isArray(a.layout)))throw Error('Ungültiges Seitenlayout.');const layout=a.layout||defaultLayout();
  if(!['A4','LETTER'].includes(layout.size)||!['portrait','landscape'].includes(layout.orientation)||!Number.isFinite(layout.margin)||layout.margin<20||layout.margin>100)throw Error('Ungültiges Seitenlayout.');
  for(const k of ['header','footer'])if(typeof layout[k]!=='string'||layout[k].length>500)throw Error('Ungültige Kopf-/Fußzeile.');
  if(a.title!==undefined&&(typeof a.title!=='string'||a.title.length>500))throw Error('Ungültiger Dokumenttitel.');
  for(const k of ['comments','proposals'])if(a[k]!==undefined&&(!Array.isArray(a[k])||a[k].length>2000))throw Error('Ungültige Zusammenarbeit.');
  for(const c of a.comments||[])if(typeof c.id!=='string'||typeof c.target!=='string'||typeof c.text!=='string'||typeof c.author!=='string'||c.text.length>10000)throw Error('Ungültiger Kommentar.');
  for(const p of a.proposals||[])if(typeof p.id!=='string'||typeof p.author!=='string'||typeof p.reason!=='string'||!Array.isArray(p.operations)||p.operations.length>100)throw Error('Ungültiger Vorschlag.');
  return doc;
}
export function readPackage(text) {
  const p=JSON.parse(text.replace(/^\uFEFF/,''));
  if(p.format!==FORMAT||p.version!==VERSION)throw Error('Dieses Findobe-Dateiformat wird nicht unterstützt.');
  if(!Number.isSafeInteger(p.revision)||p.revision<0||!Array.isArray(p.history)||p.history.length>500)throw Error('Ungültiger Dokumentverlauf.');
  validateDocument(p.document);return p;
}
export function packageDocument(document,revision=0,history=[]) { validateDocument(document);return {format:FORMAT,version:VERSION,revision,document:clone(document),history:clone(history)}; }
export function assertGuard(doc, revision, request) {
  if(!Array.isArray(request.operations)||!request.operations.length||request.operations.length>100)throw Error('1–100 Änderungsoperationen erforderlich.');
  if(request.expectedRevision===revision)return;
  // A block precondition permits unrelated concurrent edits; all mutations need one.
  for(const op of request.operations) {
    const target=op.target;
    if(!target||!op.expected||!same(findNode(doc,target),op.expected))throw Error('Konflikt: Dokument wurde geändert. Bitte neu lesen und die Änderung erneut vorbereiten.');
  }
}
