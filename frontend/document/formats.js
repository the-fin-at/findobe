import DOMPurify from 'dompurify';
import mammoth from 'mammoth/mammoth.browser';
import JSZip from 'jszip';
import {docxStyleOptions} from './docx-styles.js';
import {marked} from 'marked';
import TurndownService from 'turndown';
import {gfm} from 'turndown-plugin-gfm';
import * as D from 'docx';
import pdfMake from 'pdfmake/build/pdfmake';
import {defaultLayout,emptyDocument,readPackage,textOf,clone} from './model.js';
export const extension = name => name.split('.').pop().toLowerCase();
export const encode = bytes => {let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);};
export const decode = text => Uint8Array.from(atob(text),c=>c.charCodeAt(0));
const esc = s => String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const children = e => [...e.children];
async function zipRead(bytes) {
  const zip=await JSZip.loadAsync(bytes);const entries=Object.values(zip.files);
  if(entries.length>2000||entries.reduce((n,f)=>n+(f._data?.uncompressedSize||0),0)>60*1024*1024)throw Error('Office-Datei entpackt zu groß.');
  return zip;
}
export async function cleanHtml(html,readResource) {
  const clean=DOMPurify.sanitize(html,{FORBID_TAGS:['script','style','iframe','object','embed','form','input','button'],FORBID_ATTR:['style','srcset','onerror'],ADD_ATTR:['data-id']});
  const doc=new DOMParser().parseFromString(clean,'text/html');const warnings=[];
  for(const a of doc.querySelectorAll('a'))if(!/^(https?:|mailto:|#)/i.test(a.getAttribute('href')||'')){a.replaceWith(...a.childNodes);warnings.push('Ein nicht unterstütztes Linkziel wurde entfernt.');}
  for(const img of doc.images) {
    const src=img.getAttribute('src')||'';
    if(!/^data:image\/(png|jpeg|gif|webp);base64,/i.test(src)) {
      try {if(!readResource||/^(?:[a-z][\w+.-]*:|[\/\\])/i.test(src))throw Error(); img.src=await readResource(decodeURIComponent(src));if(!/^data:image\/(png|jpeg|gif|webp);base64,/i.test(img.src))throw Error();}
      catch {img.replaceWith(doc.createTextNode('[Bild: '+(img.alt||src)+']'));warnings.push('Ein Bild konnte nicht eingebettet werden.');}
    }
  }
  return {html:doc.body.innerHTML,warnings};
}
export function sanitizePaste(html){const doc=new DOMParser().parseFromString(DOMPurify.sanitize(html,{FORBID_TAGS:['script','style','iframe','object','embed','form','input','button'],FORBID_ATTR:['style','srcset']}),'text/html');for(const a of doc.querySelectorAll('a'))if(!/^(https?:|mailto:|#)/i.test(a.getAttribute('href')||''))a.replaceWith(...a.childNodes);for(const img of doc.images)if(!/^data:image\/(png|jpeg|gif|webp);base64,/i.test(img.getAttribute('src')||''))img.replaceWith(doc.createTextNode('[Bild bitte über die Bildfunktion einfügen]'));return doc.body.innerHTML;}
export async function importFile(opened,readResource) {
  const ext=extension(opened.name), bytes=opened.encoding==='base64'?decode(opened.text):new TextEncoder().encode(opened.text);
  if(ext==='findobe')return {package:readPackage(opened.text),warnings:[]};
  let html='',warnings=[];
  if(ext==='docx') {
    const zip=await zipRead(bytes);if(!zip.file('word/document.xml'))throw Error('Ungültige DOCX-Datei.');
    const options=await docxStyleOptions(zip);
    const result=await mammoth.convertToHtml({arrayBuffer:await zip.generateAsync({type:'arraybuffer'})},{...options,externalFileAccess:false});
    html=result.value;warnings.push('Word-Datei importiert. Das Seitenlayout und spezielle Word-Funktionen können abweichen.');
    if(result.messages.some(m=>/Unrecognised .* style|was referenced but not defined/.test(m.message)))warnings.push('Einige Word-Formatvorlagen wurden vereinfacht übernommen.');
    if(result.messages.some(m=>!/Unrecognised .* style|was referenced but not defined/.test(m.message)))warnings.push('Einige Word-Elemente konnten nicht vollständig übernommen werden. Bitte den Inhalt prüfen.');
  } else if(ext==='odt') { const result=await importOdt(bytes);html=result.html;warnings=result.warnings; }
  else if(ext==='md'||ext==='markdown') { html=marked.parse(opened.text.replace(/^\uFEFF/,''));warnings.push('Markdown wird in Dokumentbausteine umgewandelt; die ursprüngliche Schreibweise wird nicht erhalten.'); }
  else if(ext==='txt')html=opened.text.replace(/^\uFEFF/,'').split(/\r?\n/).map(p=>'<p>'+esc(p)+'</p>').join('');
  else if(ext==='html'||ext==='htm') {html=opened.text;warnings.push('HTML-Inhalte werden übernommen; freie CSS-Layouts und interaktive Elemente werden nicht übernommen.');}
  else throw Error('Dieses Format kann nicht in ein gemeinsames Dokument importiert werden.');
  const result=await cleanHtml(html,readResource);return {html:result.html,warnings:[...new Set([...warnings,...result.warnings])]};
}
async function importOdt(bytes) {
  const zip=await zipRead(bytes);if(!zip.file('content.xml'))throw Error('Ungültige ODT-Datei.');
  const parser=new DOMParser(),xml=parser.parseFromString(await zip.file('content.xml').async('string'),'application/xml');
  if(xml.querySelector('parsererror'))throw Error('Beschädigtes ODT-XML.');
  const ns='urn:oasis:names:tc:opendocument:xmlns:text:1.0', attr=(e,k)=>e.getAttributeNS(ns,k)||'',styles=new Map();
  const numbered=new Set();for(const st of xml.getElementsByTagNameNS('*','list-style'))if(st.getElementsByTagNameNS('*','list-level-style-number').length)numbered.add(st.getAttributeNS('urn:oasis:names:tc:opendocument:xmlns:style:1.0','name'));
  const styleDocs=[xml];if(zip.file('styles.xml'))styleDocs.push(parser.parseFromString(await zip.file('styles.xml').async('string'),'application/xml'));
  for(const x of styleDocs)for(const s of x.getElementsByTagNameNS('*','style')) {
    const props=s.getElementsByTagNameNS('*','text-properties')[0], styleNS='urn:oasis:names:tc:opendocument:xmlns:style:1.0';
    styles.set(s.getAttributeNS(styleNS,'name'),{bold:props?.getAttributeNS('urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0','font-weight')==='bold',underline:props?.getAttributeNS(styleNS,'text-underline-style')==='solid'});
  }
  async function render(e) {
    if(e.nodeType===3)return esc(e.textContent);if(e.nodeType!==1)return '';
    const inside=async()=> (await Promise.all([...e.childNodes].map(render))).join('');const tag=e.localName;
    if(tag==='covered-table-cell')return '';
    if(tag==='s')return ' '.repeat(Math.min(1000,Number(attr(e,'c'))||1));if(tag==='tab')return '\t';if(tag==='line-break')return '<br>';
    if(tag==='image') {const href=e.getAttributeNS('http://www.w3.org/1999/xlink','href');const file=zip.file(href);if(!file)return '[Bild nicht verfügbar]';const ext=extension(href);if(!['png','jpg','jpeg','gif','webp'].includes(ext))return '[Nicht unterstütztes Bild]';return '<img src="data:image/'+(ext==='jpg'?'jpeg':ext)+';base64,'+await file.async('base64')+'">';}
    const tags={p:'p',h:'h'+Math.max(1,Math.min(6,Number(attr(e,'outline-level'))||1)),list:'ul','list-item':'li',table:'table','table-row':'tr','table-cell':'td',a:'a',span:'span'};
    let content=await inside(),t=tags[tag];if(tag==='table-cell'&&e.parentElement?.parentElement?.localName==='table-header-rows')t='th';if(tag==='list'&&numbered.has(attr(e,'style-name')))t='ol';if(!t)return content;
    const st=styles.get(attr(e,'style-name'));if(st?.bold)content='<strong>'+content+'</strong>';if(st?.underline)content='<u>'+content+'</u>';
    const tableNS='urn:oasis:names:tc:opendocument:xmlns:table:1.0';
    const extra=tag==='table-cell'?' colspan="'+Math.min(100,Number(e.getAttributeNS(tableNS,'number-columns-spanned'))||1)+'" rowspan="'+Math.min(100,Number(e.getAttributeNS(tableNS,'number-rows-spanned'))||1)+'"':tag==='a'?' href="'+esc(e.getAttributeNS('http://www.w3.org/1999/xlink','href'))+'"':'';
    return '<'+t+extra+'>'+content+'</'+t+'>';
  }
  const body=xml.getElementsByTagNameNS('urn:oasis:names:tc:opendocument:xmlns:office:1.0','text')[0];if(!body)throw Error('ODT enthält kein Textdokument.');
  return {html:await render(body),warnings:['ODT wird als bearbeitbarer Inhalt importiert; komplexe Stile, Seitenlayout und Felder können abweichen.']};
}
export function htmlDocument(editor,doc) {
  const a=doc.attrs||{},l=a.layout||defaultLayout();return '<!doctype html><html lang="de"><head><meta charset="utf-8"><title>'+esc(a.title)+'</title><style>'+printCss(l)+'</style></head><body><header>'+esc(l.header)+'</header><main>'+editor.getHTML()+'</main><footer>'+esc(l.footer)+'</footer></body></html>';
}
export function printCss(l) {return `@page{size:${l.size==='LETTER'?'letter':'A4'} ${l.orientation};margin:${l.margin}pt}body{font:11pt/1.45 Arial,sans-serif;color:#1B1612;margin:0}*{box-sizing:border-box;font-style:normal!important}h1{font-size:26pt}h2{font-size:19pt}h3{font-size:15pt}p{margin:0 0 8pt}h1,h2,h3,h4,h5,h6{break-after:avoid}table{border-collapse:collapse;width:100%;margin:10pt 0}td,th{border:1px solid #C9C3BC;padding:7pt;vertical-align:top}th{background:#F4EFE9}tr{break-inside:avoid}img{max-width:100%;height:auto}blockquote{border-left:2pt solid #9D5035;padding-left:12pt}pre{white-space:pre-wrap;background:#F4EFE9;padding:8pt}header,footer{font-size:9pt;color:#6D6863}header{margin-bottom:16pt}footer{margin-top:16pt}a{color:#9D5035}`;}
export async function exportFile(format,editor,pkg) {
  const doc=pkg.document,warnings=[];if(format!=='findobe'&&(doc.attrs.comments.length||doc.attrs.proposals.length))warnings.push('Kommentare, Vorschläge und Verlauf bleiben ausschließlich in der Findobe-Arbeitsdatei.');
  if(format==='findobe')return {content:JSON.stringify(pkg,null,2)+'\n',warnings};
  if(format==='html')return {content:htmlDocument(editor,doc),warnings};
  if(format==='txt')return {content:textOf(doc)+'\n',warnings:[...warnings,'Text enthält keine Gestaltung oder Bilder.']};
  if(format==='md') {const td=new TurndownService({headingStyle:'atx',codeBlockStyle:'fenced'});td.use(gfm);return {content:td.turndown(editor.getHTML())+'\n',warnings:[...warnings,'Markdown erhält keine Seitenlayouts und nicht alle Textformatierungen.']};}
  const compatible=['docx','pdf'].includes(format)?await rasterCompatible(doc):doc;
  const bytes=format==='docx'?await exportDocx(compatible):format==='odt'?await exportOdt(doc):format==='pdf'?await exportPdf(compatible):null;
  if(!bytes)throw Error('Unbekanntes Ausgabeformat.');return {content:encode(bytes),encoding:'base64',warnings};
}
async function rasterCompatible(doc){const copy=clone(doc);async function visit(n){if(n.type==='image'&&!/^data:image\/(png|jpeg);/i.test(n.attrs.src)){const img=new Image();img.src=n.attrs.src;await img.decode();if(img.naturalWidth*img.naturalHeight>32000000)throw Error('Bild zu groß für den Export.');const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;canvas.getContext('2d').drawImage(img,0,0);n.attrs.src=canvas.toDataURL('image/png');}for(const c of n.content||[])await visit(c);}await visit(copy);return copy;}
function runs(node) {
  return (node.content||[]).flatMap(n=>{
    if(n.type==='hardBreak')return [new D.TextRun({break:1})];if(n.type!=='text')return runs(n);
    const m=new Map((n.marks||[]).map(m=>[m.type,m.attrs||{}])),t=m.get('textStyle')||{};
    const run=new D.TextRun({font:m.has('code')?'Courier New':t.fontFamily,text:n.text,bold:m.has('bold'),italics:false,strike:m.has('strike'),underline:m.has('underline')?{}:undefined,color:t.color?.replace('#',''),size:t.fontSize?Math.round(parseFloat(t.fontSize)*2):undefined});
    return m.has('link')&&!m.get('link').href.startsWith('#')?[new D.ExternalHyperlink({children:[run],link:m.get('link').href})]:[run];
  });
}
async function exportDocx(doc) {
  async function blocks(nodes,list=null) {const out=[];for(const n of nodes||[]) {
    if(n.type==='table') {const rows=[];for(const r of n.content) {const cells=[];for(const c of r.content)cells.push(new D.TableCell({children:await blocks(c.content),margins:{top:100,bottom:100,left:120,right:120},columnSpan:c.attrs?.colspan||1,rowSpan:c.attrs?.rowspan||1,shading:c.type==='tableHeader'?{fill:'F4EFE9'}:undefined}));rows.push(new D.TableRow({children:cells,tableHeader:r.content.every(c=>c.type==='tableHeader')}));}out.push(new D.Table({rows,width:{size:100,type:D.WidthType.PERCENTAGE}}));}
    else if(n.type==='bulletList'||n.type==='orderedList') {out.push(...await blocks(n.content,n.type));}
    else if(n.type==='listItem'||n.type==='blockquote')out.push(...await blocks(n.content,list));
    else if(n.type==='image') {const bytes=decode(n.attrs.src.split(',')[1]),kind=n.attrs.src.match(/^data:image\/(\w+)/)[1];if(!['png','jpeg','gif'].includes(kind))throw Error('DOCX-Export unterstützt PNG, JPEG und GIF. Bitte WebP-Bilder ersetzen.');const img=new Image();img.src=n.attrs.src;await img.decode();const width=Math.min(img.naturalWidth,450);out.push(new D.Paragraph({children:[new D.ImageRun({data:bytes,type:kind==='jpeg'?'jpg':kind,transformation:{width,height:width*img.naturalHeight/img.naturalWidth}})]}));}
    else if(n.type==='horizontalRule')out.push(new D.Paragraph({border:{bottom:{style:D.BorderStyle.SINGLE,size:6,color:'C9C3BC'}}}));
    else out.push(new D.Paragraph({children:runs(n),heading:n.type==='heading'?D.HeadingLevel['HEADING_'+n.attrs.level]:undefined,alignment:n.attrs?.textAlign,bullet:list==='bulletList'?{level:0}:undefined,numbering:list==='orderedList'?{reference:'findobe-numbering',level:0}:undefined,spacing:{after:160},keepNext:n.type==='heading'}));
  }return out.length?out:[new D.Paragraph('')];}
  const l=doc.attrs.layout,margin=Math.round(l.margin*20),size=l.size==='LETTER'?{width:12240,height:15840}:{width:11906,height:16838};
  const file=new D.Document({title:doc.attrs.title,creator:'FinDobe',styles:{default:{document:{run:{font:'Arial',size:22,italics:false,color:'1B1612'},paragraph:{spacing:{line:300}}},heading1:{run:{font:'Arial',size:52,bold:true,color:'1B1612'},paragraph:{spacing:{before:240,after:180}}},heading2:{run:{font:'Arial',size:38,bold:true,color:'1B1612'},paragraph:{spacing:{before:200,after:160}}},heading3:{run:{font:'Arial',size:30,bold:true,color:'1B1612'},paragraph:{spacing:{before:160,after:120}}}}},numbering:{config:[{reference:'findobe-numbering',levels:[{level:0,format:D.LevelFormat.DECIMAL,text:'%1.',alignment:D.AlignmentType.LEFT,style:{paragraph:{indent:{left:720,hanging:260}}}}]}]},sections:[{properties:{page:{size:{...size,orientation:l.orientation==='landscape'?D.PageOrientation.LANDSCAPE:D.PageOrientation.PORTRAIT},margin:{top:margin,bottom:margin,left:margin,right:margin}}},headers:{default:new D.Header({children:[new D.Paragraph(l.header)]})},footers:{default:new D.Footer({children:[new D.Paragraph({children:[new D.TextRun(l.footer+(l.pageNumbers?' · ':'')),...(l.pageNumbers?[new D.TextRun({children:[D.PageNumber.CURRENT]})]:[])]})]})},children:await blocks(doc.content)}]});
  return new Uint8Array(await D.Packer.toArrayBuffer(file));
}
export function tableGrid(table){
  const rows=[],pending=[];let width=0;
  for(let r=0;r<table.content.length;r++){
    const row=rows[r]||[];let col=0;
    for(const cell of table.content[r].content){while(row[col])col++;const cs=cell.attrs?.colspan||1,rs=cell.attrs?.rowspan||1;row[col]={cell,origin:true};for(let rr=r;rr<r+rs;rr++){rows[rr] ||= [];for(let cc=col;cc<col+cs;cc++){if(rr===r&&cc===col)continue;rows[rr][cc]={cell,origin:false};}}col+=cs;}
    rows[r]=row;width=Math.max(width,row.length);
  }
  if(rows.length>table.content.length)throw Error('Tabellenzelle reicht über die letzte Zeile hinaus.');
  return {width,rows:rows.map(row=>Array.from({length:width},(_,i)=>row[i]||null))};
}
async function exportOdt(doc) {
  const zip=new JSZip(),images=[],dimensions=new Map(),inlineStyles=new Map();
  async function measure(n){if(n.type==='image'){const im=new Image();im.src=n.attrs.src;await im.decode();const width=Math.min(im.naturalWidth,450);dimensions.set(n.attrs.src,{width:width/37.8,height:width*im.naturalHeight/im.naturalWidth/37.8});}for(const c of n.content||[])await measure(c);}await measure(doc);
  function inline(n) {if(n.type==='text'){let s=esc(n.text).replace(/ {2,}/g,x=>'<text:s text:c="'+x.length+'"/>').replace(/\n/g,'<text:line-break/>').replace(/\t/g,'<text:tab/>');for(const m of n.marks||[]) {if(m.type==='bold')s='<text:span text:style-name="Bold">'+s+'</text:span>';if(m.type==='underline')s='<text:span text:style-name="Underline">'+s+'</text:span>';if(m.type==='strike')s='<text:span text:style-name="Strike">'+s+'</text:span>';if(m.type==='code')s='<text:span text:style-name="Mono">'+s+'</text:span>';if(m.type==='textStyle'){const key=JSON.stringify(m.attrs),name='Inline'+inlineStyles.size;if(!inlineStyles.has(key))inlineStyles.set(key,{name,attrs:m.attrs});s='<text:span text:style-name="'+inlineStyles.get(key).name+'">'+s+'</text:span>';}if(m.type==='link')s='<text:a xlink:href="'+esc(m.attrs.href)+'">'+s+'</text:a>';}return s;}if(n.type==='hardBreak')return '<text:line-break/>';return (n.content||[]).map(inline).join('');}
  function block(n) {
    if(n.type==='heading')return '<text:h text:style-name="H'+n.attrs.level+'" text:outline-level="'+n.attrs.level+'">'+inline(n)+'</text:h>';
    if(n.type==='table'){const grid=tableGrid(n);const rows=grid.rows.map(r=>'<table:table-row>'+r.map(slot=>!slot||!slot.origin?'<table:covered-table-cell/>':'<table:table-cell table:style-name="'+(slot.cell.type==='tableHeader'?'HeaderCell':'Cell')+'" office:value-type="string" table:number-columns-spanned="'+(slot.cell.attrs?.colspan||1)+'" table:number-rows-spanned="'+(slot.cell.attrs?.rowspan||1)+'">'+slot.cell.content.map(block).join('')+'</table:table-cell>').join('')+'</table:table-row>');const header=n.content[0]?.content.every(c=>c.type==='tableHeader');return '<table:table><table:table-column table:number-columns-repeated="'+grid.width+'"/>'+(header?'<table:table-header-rows>'+rows.shift()+'</table:table-header-rows>':'')+rows.join('')+'</table:table>';}
    if(n.type==='bulletList'||n.type==='orderedList')return '<text:list text:style-name="'+(n.type==='orderedList'?'Numbered':'Bullets')+'">'+n.content.map(c=>'<text:list-item>'+c.content.map(block).join('')+'</text:list-item>').join('')+'</text:list>';
    if(n.type==='blockquote')return n.content.map(block).join('');
    if(n.type==='image') {const mime=n.attrs.src.match(/^data:([^;]+)/)[1],ext=mime.split('/')[1],path='Pictures/'+images.length+'.'+ext;images.push({path,mime,bytes:decode(n.attrs.src.split(',')[1])});return '<text:p><draw:frame draw:name="Bild'+images.length+'" text:anchor-type="as-char" svg:width="'+dimensions.get(n.attrs.src).width+'cm" svg:height="'+dimensions.get(n.attrs.src).height+'cm"><draw:image xlink:href="'+path+'" xlink:type="simple" xlink:show="embed"/></draw:frame></text:p>';}
    return '<text:p text:style-name="P'+(n.attrs?.textAlign||'left')+'">'+inline(n)+'</text:p>';
  }
  const body=doc.content.map(block).join(''),ns='xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" xmlns:xlink="http://www.w3.org/1999/xlink"';
  const l=doc.attrs.layout;
  zip.file('mimetype','application/vnd.oasis.opendocument.text',{compression:'STORE'});
  const auto=Array.from({length:6},(_,i)=>'<style:style style:name="H'+(i+1)+'" style:family="paragraph"><style:paragraph-properties fo:margin-top="0.3cm" fo:margin-bottom="0.2cm" fo:keep-with-next="always"/><style:text-properties fo:font-size="'+[26,19,15,13,12,11][i]+'pt" fo:font-weight="bold" fo:color="#1B1612"/></style:style>').join('')+['left','center','right','justify'].map(a=>'<style:style style:name="P'+a+'" style:family="paragraph"><style:paragraph-properties fo:text-align="'+(a==='left'?'start':a==='right'?'end':a)+'"/></style:style>').join('')+['Cell','HeaderCell'].map(a=>'<style:style style:name="'+a+'" style:family="table-cell"><style:table-cell-properties fo:padding="0.15cm" fo:border="0.5pt solid #C9C3BC"'+(a==='HeaderCell'?' fo:background-color="#F4EFE9"':'')+'/></style:style>').join('')+'<style:style style:name="Strike" style:family="text"><style:text-properties style:text-line-through-style="solid"/></style:style><style:style style:name="Mono" style:family="text"><style:text-properties fo:font-family="Courier New"/></style:style>'+[...inlineStyles.values()].map(st=>'<style:style style:name="'+st.name+'" style:family="text"><style:text-properties'+(st.attrs.color?' fo:color="'+esc(st.attrs.color)+'"':'')+(st.attrs.fontSize?' fo:font-size="'+esc(st.attrs.fontSize)+'"':'')+'/></style:style>').join('');
  zip.file('content.xml','<?xml version="1.0" encoding="UTF-8"?><office:document-content '+ns+' office:version="1.3"><office:automatic-styles>'+auto+'<style:style style:name="Bold" style:family="text"><style:text-properties fo:font-weight="bold"/></style:style><style:style style:name="Underline" style:family="text"><style:text-properties style:text-underline-style="solid"/></style:style><text:list-style style:name="Bullets"><text:list-level-style-bullet text:level="1" text:bullet-char="•"/></text:list-style><text:list-style style:name="Numbered"><text:list-level-style-number text:level="1" style:num-format="1"/></text:list-style></office:automatic-styles><office:body><office:text>'+body+'</office:text></office:body></office:document-content>');
  zip.file('styles.xml','<?xml version="1.0"?><office:document-styles '+ns+' office:version="1.3"><office:styles><style:default-style style:family="paragraph"><style:paragraph-properties fo:margin-bottom="0.2cm"/><style:text-properties fo:font-family="Arial" fo:font-size="11pt" fo:font-style="normal"/></style:default-style></office:styles><office:automatic-styles><style:page-layout style:name="Page"><style:page-layout-properties fo:page-width="'+(l.orientation==='landscape'?(l.size==='LETTER'?'27.94':'29.7'):(l.size==='LETTER'?'21.59':'21'))+'cm" fo:page-height="'+(l.orientation==='landscape'?(l.size==='LETTER'?'21.59':'21'):(l.size==='LETTER'?'27.94':'29.7'))+'cm" fo:margin="'+l.margin+'pt"/></style:page-layout></office:automatic-styles><office:master-styles><style:master-page style:name="Standard" style:page-layout-name="Page"><style:header><text:p>'+esc(l.header)+'</text:p></style:header><style:footer><text:p>'+esc(l.footer)+(l.pageNumbers?' <text:page-number/>':'')+'</text:p></style:footer></style:master-page></office:master-styles></office:document-styles>');
  for(const im of images)zip.file(im.path,im.bytes);
  zip.file('META-INF/manifest.xml','<?xml version="1.0"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>'+images.map(im=>'<manifest:file-entry manifest:full-path="'+im.path+'" manifest:media-type="'+im.mime+'"/>').join('')+'</manifest:manifest>');
  return zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
}
let fontsReady;
async function initPdfFonts() {
  fontsReady ||= (async()=>{const files=['AlbertSans-Regular.ttf','AlbertSans-SemiBold.ttf','GeistMono-Regular.ttf'];const vfs={};for(const name of files){const r=await fetch('assets/document-fonts/'+name);if(!r.ok)throw Error('PDF-Schrift konnte nicht geladen werden.');vfs[name]=encode(new Uint8Array(await r.arrayBuffer()));}pdfMake.addVirtualFileSystem(vfs);pdfMake.addFonts({Albert:{normal:files[0],bold:files[1],italics:files[0],bolditalics:files[1]},Mono:{normal:files[2],bold:files[2],italics:files[2],bolditalics:files[2]}});})();return fontsReady;
}
async function exportPdf(doc) {
  await initPdfFonts();
  function inline(n) {return (n.content||[]).flatMap(c=>{if(c.type==='hardBreak')return [{text:'\n'}];if(c.type!=='text')return inline(c);const m=new Map((c.marks||[]).map(m=>[m.type,m.attrs||{}]));return [{text:c.text,bold:m.has('bold'),decoration:m.has('underline')?'underline':m.has('strike')?'lineThrough':undefined,color:m.get('textStyle')?.color,font:m.has('code')?'Mono':undefined,fontSize:m.get('textStyle')?.fontSize?parseFloat(m.get('textStyle').fontSize)*(m.get('textStyle').fontSize.endsWith('px')?.75:1):undefined,link:m.get('link')?.href?.startsWith('#')?undefined:m.get('link')?.href}];});}
  function block(n) {
    if(n.type==='table') {const grid=tableGrid(n),body=grid.rows.map(row=>row.map(slot=>!slot||!slot.origin?{}:{stack:slot.cell.content.map(block),colSpan:slot.cell.attrs?.colspan||1,rowSpan:slot.cell.attrs?.rowspan||1,fillColor:slot.cell.type==='tableHeader'?'#F4EFE9':undefined,margin:[4,4,4,4]}));return {table:{widths:Array(grid.width).fill('*'),headerRows:n.content[0]?.content.every(c=>c.type==='tableHeader')?1:0,body},layout:'lightHorizontalLines',margin:[0,8,0,12]};}
    if(n.type==='bulletList'||n.type==='orderedList')return {[n.type==='bulletList'?'ul':'ol']:n.content.map(c=>({stack:c.content.map(block)})),margin:[0,2,0,10]};
    if(n.type==='blockquote')return {stack:n.content.map(block),margin:[16,4,0,10]};
    if(n.type==='image')return {image:n.attrs.src,fit:[460,320],margin:[0,8,0,12]};
    if(n.type==='horizontalRule')return {canvas:[{type:'line',x1:0,y1:0,x2:450,y2:0,lineColor:'#C9C3BC'}],margin:[0,8,0,8]};
    return {text:inline(n),font:n.type==='codeBlock'?'Mono':undefined,fontSize:n.type==='heading'?[26,19,15,13,12,11][n.attrs.level-1]:11,bold:n.type==='heading',alignment:n.attrs?.textAlign||'left',margin:[0,n.type==='heading'?12:0,0,8],headlineLevel:n.type==='heading'?n.attrs.level:undefined};
  }
  const l=doc.attrs.layout;
  const pdf=pdfMake.createPdf({info:{title:doc.attrs.title,creator:'FinDobe'},pageSize:l.size==='LETTER'?'LETTER':'A4',pageOrientation:l.orientation,pageMargins:[l.margin,l.margin+20,l.margin,l.margin+20],defaultStyle:{font:'Albert',fontSize:11,color:'#1B1612',lineHeight:1.25},header:{text:l.header,fontSize:9,color:'#6D6863',margin:[l.margin,24,l.margin,0]},footer:(p,total)=>({text:[l.footer,...(l.pageNumbers?[' · '+p+' / '+total]:[])].join(''),alignment:'right',fontSize:9,color:'#6D6863',margin:[l.margin,8,l.margin,0]}),content:doc.content.map(block),pageBreakBefore:node=>!!node.headlineLevel&&node.pageNumbers?.length>1});
  return new Uint8Array(await pdf.getBuffer());
}
