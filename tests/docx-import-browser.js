import JSZip from 'jszip';
import mammoth from 'mammoth/mammoth.browser';
import {importFile,encode,decode} from '../frontend/document/formats.js';
const w='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const xml=body=>'<?xml version="1.0" encoding="UTF-8"?>'+body;
async function fixture(){
  const zip=new JSZip();
  zip.file('[Content_Types].xml',xml('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>'));
  zip.file('word/styles.xml',xml(`<w:styles xmlns:w="${w}">
    <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/></w:style>
    <w:style w:type="paragraph" w:styleId="Standard"><w:name w:val="Normal"/></w:style>
    <w:style w:type="paragraph" w:styleId="THEFINHinweisLabel"><w:name w:val="THE FIN Hinweis Label"/><w:basedOn w:val="Standard"/><w:rPr><w:b/></w:rPr></w:style>
    <w:style w:type="paragraph" w:styleId="THEFINKleinerHinweis"><w:name w:val="THE FIN Kleiner Hinweis"/><w:basedOn w:val="Standard"/></w:style>
    <w:style w:type="paragraph" w:styleId="THEFINAufzhlung1"><w:name w:val="THE FIN Aufzählung 1"/><w:basedOn w:val="Standard"/></w:style>
  </w:styles>`));
  const p=(style,text,extra='')=>`<w:p><w:pPr><w:pStyle w:val="${style}"/>${extra}</w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
  zip.file('word/document.xml',xml(`<w:document xmlns:w="${w}"><w:body>${p('Title','Angebot')}${p('THEFINHinweisLabel','Vorbereitet für:')}${p('THEFINKleinerHinweis','Hinweistext')}${p('THEFINAufzhlung1','Leistung','<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>')}</w:body></w:document>`));
  zip.file('word/numbering.xml',xml(`<w:numbering xmlns:w="${w}"><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`));
  zip.file('word/styles.xml',(await zip.file('word/styles.xml').async('string')).replace('</w:styles>',`
    <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:pPr><w:outlineLvl w:val="1"/></w:pPr></w:style>
    <w:style w:type="paragraph" w:styleId="CustomHeading"><w:name w:val="Eigene Überschrift"/><w:basedOn w:val="Heading2"/></w:style>
    <w:style w:type="paragraph" w:styleId="CycleA"><w:name w:val="Cycle A"/><w:basedOn w:val="CycleB"/></w:style>
    <w:style w:type="paragraph" w:styleId="CycleB"><w:name w:val="Cycle B"/><w:basedOn w:val="CycleA"/></w:style>
    <w:style w:type="character" w:styleId="CharacterBold"><w:name w:val="Eigener Fettdruck"/><w:rPr><w:b/></w:rPr></w:style>
  </w:styles>`));
  zip.file('word/document.xml',(await zip.file('word/document.xml').async('string')).replace('</w:body>',`
    ${p('CustomHeading','Unterabschnitt','<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>')}${p('CycleA','Zyklischer Stil')}
    <w:p><w:pPr><w:pStyle w:val="THEFINHinweisLabel"/></w:pPr><w:r><w:rPr><w:b w:val="0"/></w:rPr><w:t>Explizit normal</w:t></w:r><w:r><w:t>Weiter fett</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:rStyle w:val="CharacterBold"/></w:rPr><w:t>Zeichenstil</w:t></w:r></w:p>
  </w:body>`));
  return {name:'custom-styles.docx',encoding:'base64',text:encode(await zip.generateAsync({type:'uint8array'}))};
}
window.runDocxImportTests=async()=>{
  const result=await importFile(await fixture());
  const doc=new DOMParser().parseFromString(result.html,'text/html');
  const check=(ok,msg)=>{if(!ok)throw Error(msg+'; warnings: '+result.warnings.join(' '));};
  check(!result.warnings.some(m=>/Unrecognised paragraph style/.test(m)),'Custom Word styles produce raw import warnings');
  check(doc.querySelector('h1')?.textContent==='Angebot','Word title lost');
  check(doc.querySelector('strong')?.textContent==='Vorbereitet für:','Inherited bold label lost');
  check(doc.querySelector('ul li')?.textContent==='Leistung','Custom-styled list lost');
  check(doc.body.textContent.includes('Hinweistext'),'Fallback style loses text');
  check(doc.querySelector('h2')?.textContent==='Unterabschnitt','Custom heading inheritance lost');
  check(doc.body.textContent.includes('Zyklischer Stil'),'Cyclic style loses text');
  check([...doc.querySelectorAll('strong')].some(e=>e.textContent==='Weiter fett'),'Paragraph emphasis lost');
  check(![...doc.querySelectorAll('strong')].some(e=>e.textContent.includes('Explizit normal')),'Explicit bold override ignored');
  check([...doc.querySelectorAll('strong')].some(e=>e.textContent==='Zeichenstil'),'Character emphasis lost');
  let realFile;
  if(window.hasRealFile){
    const opened=await (await fetch('real-docx.json')).json();
    const imported=await importFile(opened);
    const original=await mammoth.extractRawText({arrayBuffer:decode(opened.text).buffer});
    const parsed=new DOMParser().parseFromString(imported.html,'text/html');
    const normalize=s=>s.replace(/\s/g,'');
    check(normalize(parsed.body.textContent)===normalize(original.value),'Real DOCX text changed during import');
    check(!imported.warnings.some(m=>/Unrecognised|Style ID/.test(m)),'Real DOCX still shows raw style warnings');
    check(parsed.querySelector('h1'),'Real DOCX title missing');
    realFile={textPreserved:true,headings:parsed.querySelectorAll('h1,h2,h3').length,lists:parsed.querySelectorAll('ul,ol').length,warnings:imported.warnings};
  }
  return {realFile,customStyles:true,title:true,inheritedBold:true,numbering:true,warnings:result.warnings};
};
