// Resolve the structural and emphasis properties that the editable model supports.
// Page geometry, arbitrary fonts and spacing still use FinDobe's document layout.
const NS='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const child=(e,name)=>[...(e?.children||[])].find(c=>c.namespaceURI===NS&&c.localName===name);
const val=e=>e?.getAttributeNS(NS,'val');
const emphasis=['b','i','u','strike'];
function parse(text){const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.querySelector('parsererror'))throw Error('Beschädigtes DOCX-XML.');return doc;}
function semantic(style){
  const outline=val(child(child(style,'pPr'),'outlineLvl'));
  if(outline!==undefined&&outline!==null)return /^\d+$/.test(outline)&&Number(outline)<6?'h'+(Number(outline)+1):'p';
  const name=(val(child(style,'name'))||style.getAttributeNS(NS,'styleId')||'').toLowerCase();
  if(/^(title|titel)$/.test(name))return 'h1';
  const heading=/^(?:heading|überschrift)\s*([1-6])$/.exec(name);if(heading)return 'h'+heading[1];
  if(/^(?:quote|intense quote|zitat|intensives zitat)$/.test(name))return 'blockquote';
}
export async function docxStyleOptions(zip){
  const styles=new Map(),resolved=new Map();
  if(zip.file('word/styles.xml')){
    for(const style of parse(await zip.file('word/styles.xml').async('string')).getElementsByTagNameNS(NS,'style')){
      const id=style.getAttributeNS(NS,'styleId');if(id&&!styles.has(id))styles.set(id,style);
    }
  }
  // Cyclic/missing inheritance is tolerated, with a plain paragraph fallback.
  function resolve(id,seen=new Set()){
    if(resolved.has(id))return resolved.get(id);
    const style=styles.get(id);if(!style||seen.has(id))return {emphasis:{}};
    const parent=resolve(val(child(style,'basedOn')),new Set([...seen,id]));
    const result={tag:semantic(style)||parent.tag,emphasis:{...parent.emphasis}};
    for(const key of emphasis){const property=child(child(style,'rPr'),key);if(property)result.emphasis[key]=property;}
    resolved.set(id,result);return result;
  }
  // Mammoth ignores inherited run properties. Materialize supported properties on
  // the in-memory ZIP only, while honoring explicit formatting on each run.
  for(const file of Object.values(zip.files).filter(f=>/^word\/(document|footnotes|endnotes)\.xml$/.test(f.name))){
    const doc=parse(await file.async('string'));
    for(const p of doc.getElementsByTagNameNS(NS,'p')){
      const paragraph=resolve(val(child(child(p,'pPr'),'pStyle')));
      const direct=child(child(p,'pPr'),'rPr');
      for(const run of p.getElementsByTagNameNS(NS,'r')){
        let props=child(run,'rPr');const character=resolve(val(child(props,'rStyle')));
        for(const key of emphasis){
          const inherited=character.emphasis[key]||child(direct,key)||paragraph.emphasis[key];
          if(inherited&&!child(props,key)){
            if(!props){props=doc.createElementNS(NS,'w:rPr');run.insertBefore(props,run.firstChild);}
            props.appendChild(doc.importNode(inherited,true));
          }
        }
      }
    }
    zip.file(file.name,new XMLSerializer().serializeToString(doc));
  }
  const styleMap=['u => u','strike => s',...Array.from({length:6},(_,i)=>`p.FinDobeHeading${i+1} => h${i+1}:fresh`),'p.FinDobeQuote => blockquote:fresh','p.FinDobeBody => p:fresh'];
  return {
    styleMap,
    transformDocument:document=>{
      function visit(element){
        if(element.type==='paragraph'&&styles.has(element.styleId)){
          const tag=resolve(element.styleId).tag;
          // Let Mammoth's list rules handle numbered paragraphs before fallback.
          element.styleId=tag?.startsWith('h')?'FinDobeHeading'+tag.slice(1):element.numbering?null:tag==='blockquote'?'FinDobeQuote':'FinDobeBody';
          element.styleName=null;
        }
        if(element.children)element.children.forEach(visit);
      }
      visit(document);return document;
    }
  };
}
