
'use strict';
/* ================= Font-Modell =================
   Alles wird aus den ROHEN PDF-Objekten gelesen (pdf-lib nur lesend).
   pdf.js dient ausschließlich der Anzeige. */

const WINANSI_OVR = {128:0x20AC,130:0x201A,131:0x0192,132:0x201E,133:0x2026,134:0x2020,
  135:0x2021,136:0x02C6,137:0x2030,138:0x0160,139:0x2039,140:0x0152,142:0x017D,145:0x2018,
  146:0x2019,147:0x201C,148:0x201D,149:0x2022,150:0x2013,151:0x2014,152:0x02DC,153:0x2122,
  154:0x0161,155:0x203A,156:0x0153,158:0x017E,159:0x0178};
function winAnsiToUni(code){
  if(code>=32&&code<=126) return code;
  if(code in WINANSI_OVR) return WINANSI_OVR[code];
  if(code>=160&&code<=255) return code;
  return null;
}

/* Kompakte Adobe-Glyph-List-Teilmenge (deutsch/lateinisch) + uniXXXX-Namen */
const AGL = (() => {
  const m = {space:32,exclam:33,quotedbl:34,numbersign:35,dollar:36,percent:37,ampersand:38,
    quotesingle:39,parenleft:40,parenright:41,asterisk:42,plus:43,comma:44,hyphen:45,period:46,
    slash:47,colon:58,semicolon:59,less:60,equal:61,greater:62,question:63,at:64,bracketleft:91,
    backslash:92,bracketright:93,asciicircum:94,underscore:95,grave:96,braceleft:123,bar:124,
    braceright:125,asciitilde:126,exclamdown:0xA1,cent:0xA2,sterling:0xA3,currency:0xA4,yen:0xA5,
    brokenbar:0xA6,section:0xA7,dieresis:0xA8,copyright:0xA9,ordfeminine:0xAA,guillemotleft:0xAB,
    logicalnot:0xAC,registered:0xAE,macron:0xAF,degree:0xB0,plusminus:0xB1,acute:0xB4,mu:0xB5,
    paragraph:0xB6,periodcentered:0xB7,cedilla:0xB8,ordmasculine:0xBA,guillemotright:0xBB,
    onequarter:0xBC,onehalf:0xBD,threequarters:0xBE,questiondown:0xBF,multiply:0xD7,divide:0xF7,
    germandbls:0xDF,Euro:0x20AC,florin:0x0192,quoteleft:0x2018,quoteright:0x2019,
    quotesinglbase:0x201A,quotedblleft:0x201C,quotedblright:0x201D,quotedblbase:0x201E,
    dagger:0x2020,daggerdbl:0x2021,bullet:0x2022,ellipsis:0x2026,perthousand:0x2030,
    guilsinglleft:0x2039,guilsinglright:0x203A,trademark:0x2122,minus:0x2212,fi:0xFB01,fl:0xFB02,
    endash:0x2013,emdash:0x2014,OE:0x0152,oe:0x0153,Scaron:0x0160,scaron:0x0161,Zcaron:0x017D,
    zcaron:0x017E,Ydieresis:0x0178,circumflex:0x02C6,tilde:0x02DC,dotlessi:0x0131,nbspace:0xA0,
    softhyphen:0xAD,degreecelsius:0x2103};
  for(let i=0;i<26;i++){ m[String.fromCharCode(65+i)]=65+i; m[String.fromCharCode(97+i)]=97+i; }
  const dig=['zero','one','two','three','four','five','six','seven','eight','nine'];
  dig.forEach((n,i)=>m[n]=48+i);
  // Akzentbuchstaben Latin-1: <base><accent>-Namen generieren
  const acc={grave:0x300,acute:0x301,circumflex:0x302,tilde:0x303,dieresis:0x308,ring:0x30A,cedilla:0x327,caron:0x30C,breve:0x306,hungarumlaut:0x30B,macron:0x304,ogonek:0x328,slash:null,dotaccent:0x307};
  const composed='Agrave C0 Aacute C1 Acircumflex C2 Atilde C3 Adieresis C4 Aring C5 AE C6 Ccedilla C7 Egrave C8 Eacute C9 Ecircumflex CA Edieresis CB Igrave CC Iacute CD Icircumflex CE Idieresis CF Eth D0 Ntilde D1 Ograve D2 Oacute D3 Ocircumflex D4 Otilde D5 Odieresis D6 Oslash D8 Ugrave D9 Uacute DA Ucircumflex DB Udieresis DC Yacute DD Thorn DE agrave E0 aacute E1 acircumflex E2 atilde E3 adieresis E4 aring E5 ae E6 ccedilla E7 egrave E8 eacute E9 ecircumflex EA edieresis EB igrave EC iacute ED icircumflex EE idieresis EF eth F0 ntilde F1 ograve F2 oacute F3 ocircumflex F4 otilde F5 odieresis F6 oslash F8 ugrave F9 uacute FA ucircumflex FB udieresis FC yacute FD thorn FE ydieresis FF'.split(' ');
  for(let i=0;i<composed.length;i+=2) m[composed[i]]=parseInt(composed[i+1],16);
  void acc;
  return m;
})();
function glyphNameToUni(name){
  if(name in AGL) return AGL[name];
  let mm=/^uni([0-9A-Fa-f]{4,6})$/.exec(name) || /^u([0-9A-Fa-f]{4,6})$/.exec(name);
  if(mm) return parseInt(mm[1],16);
  if(name.length===1) return name.codePointAt(0);
  return null;
}

/* ---------- ToUnicode-CMap-Parser ---------- */
function parseCMap(text){
  const map=new Map();
  const hexRe=/<([0-9A-Fa-f\s]*)>|\[|\]/g;
  const hexVal=h=>parseInt(h.replace(/\s+/g,''),16);
  const hexStr=h=>{ h=h.replace(/\s+/g,''); if(h.length%4===2) h='00'+h; let s='';
    for(let i=0;i+3<h.length;i+=4) s+=String.fromCharCode(parseInt(h.slice(i,i+4),16));
    return s; };
  const incr=(s,k)=>{ if(!s.length) return s;
    return s.slice(0,-1)+String.fromCharCode(s.charCodeAt(s.length-1)+k); };
  let m;
  const secRe=/begin(bfchar|bfrange)([\s\S]*?)end\1/g;
  while((m=secRe.exec(text))){
    const kind=m[1], body=m[2];
    const toks=[]; let t;
    hexRe.lastIndex=0;
    while((t=hexRe.exec(body))) toks.push(t[0]==='['?'[':t[0]===']'?']':{h:t[1]});
    if(kind==='bfchar'){
      for(let i=0;i+1<toks.length;i+=2){
        if(toks[i].h===undefined||toks[i+1].h===undefined) break;
        map.set(hexVal(toks[i].h), hexStr(toks[i+1].h));
      }
    } else {
      let i=0;
      while(i<toks.length){
        if(toks[i].h===undefined||!toks[i+1]||toks[i+1].h===undefined) break;
        const lo=hexVal(toks[i].h), hi=hexVal(toks[i+1].h);
        if(toks[i+2]==='['){
          let j=i+3, c=lo;
          while(j<toks.length&&toks[j]!==']'){ if(toks[j].h!==undefined&&c<=hi) map.set(c++,hexStr(toks[j].h)); j++; }
          i=j+1;
        } else if(toks[i+2]&&toks[i+2].h!==undefined){
          const dst=hexStr(toks[i+2].h);
          for(let c=lo;c<=hi&&c-lo<65536;c++) map.set(c,incr(dst,c-lo));
          i+=3;
        } else break;
      }
    }
  }
  return map;
}

/* ---------- pdf-lib-Helfer ---------- */
const PL = () => PDFLib;
const isRef=v=>v instanceof PDFLib.PDFRef;
const isDict=v=>v instanceof PDFLib.PDFDict;
const isArr=v=>v instanceof PDFLib.PDFArray;
const isPNum=v=>v instanceof PDFLib.PDFNumber;
const isRawStream=v=>v instanceof PDFLib.PDFRawStream;
function plName(v){ return v ? String(v).replace(/^\//,'') : null; }
function plNum(v, dflt){ if(!v) return dflt;
  if(typeof v.asNumber==='function') return v.asNumber();
  const n=Number(String(v)); return isNaN(n)?dflt:n; }
function plLookup(ctx,v){ try{ return isRef(v) ? ctx.lookup(v) : v; }catch(_){ return null; } }
function decodeStreamBytes(ctx, streamObj){
  const s = plLookup(ctx, streamObj);
  if(!s) return null;
  try{
    if(isRawStream(s)){ const d=PL().decodePDFRawStream(s); return d.decode(); }
    if(typeof s.getContents==='function') return s.getContents();
  }catch(e){ return null; }
  return null;
}
const L1 = new TextDecoder('latin1');

/* ---------- Font bauen ---------- */
let measureCanvasCtx=null;
function cssFamilyFor(baseFont){
  const b=baseFont||'';
  const fam=/Courier|Mono/i.test(b)?'monospace':/Times|Serif|Georgia|Book|Roman/i.test(b)?'serif':'sans-serif';
  const bold=/Bold|Black|Heavy|[-,]B\b/i.test(b), ital=/Italic|Oblique/i.test(b);
  return {fam,bold,ital};
}
function buildFont(ctx, resName, ref){
  const N=PL().PDFName;
  const dict=plLookup(ctx,ref);
  const f={resName, ref, dict, composite:false, baseFont:'', subset:false, toUni:null,
    encMap:null, rev:new Map(), widthsFn:null, hasWidths:false, dw:1000,
    ascent:.76, descent:-.24, ro:null, cssFont:null};
  if(!isDict(dict)){ f.ro='font'; return f; }
  const subtype=plName(dict.get(N.of('Subtype')));
  f.baseFont=plName(dict.get(N.of('BaseFont')))||'';
  f.subset=/^[A-Z]{6}\+/.test(f.baseFont);
  f.cssFont=cssFamilyFor(f.baseFont);
  let fd=null;
  if(subtype==='Type0'){
    f.composite=true;
    const enc=dict.get(N.of('Encoding'));
    const encName=plName(enc);
    if(encName==='Identity-V') f.ro='vertical';
    else if(encName!=='Identity-H') f.ro='cmap';
    const dfArr=plLookup(ctx,dict.get(N.of('DescendantFonts')));
    const cid=dfArr&&plLookup(ctx,dfArr.get(0));
    if(cid){
      f.dw=plNum(plLookup(ctx,cid.get(N.of('DW'))),1000);
      const W=plLookup(ctx,cid.get(N.of('W')));
      const wm=new Map();
      if(isArr(W)){
        const a=W.asArray().map(x=>plLookup(ctx,x));
        for(let i=0;i<a.length;){
          const c=plNum(a[i],null);
          if(c===null){i++;continue;}
          if(isArr(a[i+1])){
            const ws=a[i+1].asArray();
            ws.forEach((w,k)=>wm.set(c+k,plNum(plLookup(ctx,w),f.dw)));
            i+=2;
          } else {
            const c2=plNum(a[i+1],c), w=plNum(a[i+2],f.dw);
            for(let cc=c;cc<=c2&&cc-c<65536;cc++) wm.set(cc,w);
            i+=3;
          }
        }
      }
      f.hasWidths=true;
      f.widthsFn=code=>wm.has(code)?wm.get(code):f.dw;
      fd=plLookup(ctx,cid.get(N.of('FontDescriptor')));
    } else f.ro=f.ro||'font';
  } else if(subtype==='Type3'){
    f.ro='type3';
  } else {
    const fc=plNum(plLookup(ctx,dict.get(N.of('FirstChar'))),0);
    const wArr=plLookup(ctx,dict.get(N.of('Widths')));
    if(isArr(wArr)){
      const ws=wArr.asArray().map(x=>plNum(plLookup(ctx,x),0));
      f.hasWidths=true;
      const mw=()=>{ const d=fd&&plNum(fd.get(N.of('MissingWidth')),0); return d||0; };
      f.widthsFn=code=>{ const w=ws[code-fc]; return (w===undefined||w===null)?mw():w; };
    }
    // Encoding: Name oder Dict mit BaseEncoding/Differences
    const encRaw=plLookup(ctx,dict.get(N.of('Encoding')));
    let base=null, diffs=null;
    if(isDict(encRaw)){
      base=plName(encRaw.get(N.of('BaseEncoding')));
      diffs=plLookup(ctx,encRaw.get(N.of('Differences')));
    } else base=plName(encRaw);
    if(base==='WinAnsiEncoding'||(!base&&(encRaw||diffs))||base==='StandardEncoding'||base==='MacRomanEncoding'){
      f.encMap=new Map();
      for(let c=0;c<256;c++){ const u=winAnsiToUni(c); if(u!=null) f.encMap.set(c,u); } // Näherung auch für Standard/MacRoman (Differences überschreiben)
      f.encApprox = base!=='WinAnsiEncoding';
    }
    if(isArr(diffs)){
      f.encMap=f.encMap||new Map();
      let cur=0;
      for(const it0 of diffs.asArray()){
        const it=plLookup(ctx,it0);
        if(isPNum(it)) cur=plNum(it,0);
        else { const u=glyphNameToUni(plName(it)||''); if(u!=null) f.encMap.set(cur,u); else f.encMap.delete(cur); cur++; }
      }
    }
    fd=plLookup(ctx,dict.get(N.of('FontDescriptor')));
  }
  if(isDict(fd)){
    const a=plNum(plLookup(ctx,fd.get(PL().PDFName.of('Ascent'))),760);
    const d=plNum(plLookup(ctx,fd.get(PL().PDFName.of('Descent'))),-240);
    if(a) f.ascent=Math.min(Math.max(a/1000,.4),1.4);
    if(d) f.descent=Math.max(Math.min(d/1000,0),-0.6);
  }
  // ToUnicode
  const tuBytes=decodeStreamBytes(ctx,dict.get(PL().PDFName.of('ToUnicode')));
  if(tuBytes) f.toUni=parseCMap(L1.decode(tuBytes));
  if(!f.toUni&&f.encMap){
    f.toUni=new Map();
    for(const [c,u] of f.encMap) f.toUni.set(c,String.fromCodePoint(u));
  }
  if(!f.toUni&&!f.ro) f.ro='font';
  // Umkehrabbildung Unicode -> Code
  if(f.toUni){
    for(const [c,s] of f.toUni){
      if(!s) continue;
      const k=s.normalize('NFC');
      if(k&&!f.rev.has(k)) f.rev.set(k,c);
    }
    if(!f.composite&&!f.subset&&f.encMap){
      for(const [c,u] of f.encMap){
        const k=String.fromCodePoint(u).normalize('NFC');
        if(!f.rev.has(k)) f.rev.set(k,c);
      }
    }
  }
  // Breiten-Fallback über Canvas (nur wenn keine Widths vorhanden, z. B. Base14 ohne Widths)
  if(!f.hasWidths&&!f.ro){
    if(!measureCanvasCtx) measureCanvasCtx=document.createElement('canvas').getContext('2d');
    f.approxWidths=true;
    f.measure=(text)=>{
      const c=f.cssFont;
      measureCanvasCtx.font=(c.ital?'italic ':'')+(c.bold?'700 ':'400 ')+'100px '+c.fam;
      return measureCanvasCtx.measureText(text).width*10; // pro 1000 Einheiten
    };
  }
  return f;
}

/* ---------- Decode / Encode ---------- */
function decodeShowBytes(font,u8){
  const codes=[];
  if(font.composite){ for(let i=0;i+1<u8.length;i+=2) codes.push((u8[i]<<8)|u8[i+1]); }
  else for(let i=0;i<u8.length;i++) codes.push(u8[i]);
  let text='', ok=true;
  for(const c of codes){
    const s=font.toUni?font.toUni.get(c):null;
    if(s===undefined||s===null){ ok=false; break; }
    text+=s;
  }
  return {codes, text: ok?text:null};
}
function encodeTextToCodes(font,text){
  const t=text.normalize('NFC');
  const codes=[]; const missing=new Set();
  for(let i=0;i<t.length;){
    let code=null,len=0;
    for(let l=Math.min(3,t.length-i);l>=1;l--){
      const k=t.slice(i,i+l);
      if(font.rev.has(k)){ code=font.rev.get(k); len=l; break; }
    }
    if(code===null){ missing.add(String.fromCodePoint(t.codePointAt(i))); i+=(t.codePointAt(i)>0xFFFF?2:1); }
    else { codes.push(code); i+=len; }
  }
  return {codes, missing:[...missing]};
}
function codesToBytes(font,codes){
  const out=new Uint8Array(codes.length*(font.composite?2:1));
  let j=0;
  for(const c of codes){
    if(font.composite){ out[j++]=(c>>8)&255; out[j++]=c&255; }
    else out[j++]=c&255;
  }
  return out;
}
function bytesToHexStr(u8){
  let s='<';
  for(const b of u8) s+=b.toString(16).padStart(2,'0');
  return s+'>';
}
/* Breite von Codes in Textraum-Einheiten (inkl. Größe, Tc, Tw, Tz) */
function codesAdvance(font,codes,size,Tc,Tw,Tz){
  let a=0;
  for(const c of codes){
    const w=font.widthsFn?font.widthsFn(c):500;
    a+=(w/1000)*size+Tc+((!font.composite&&c===32)?Tw:0);
  }
  return a*(Tz/100);
}

'use strict';
/* ================= Content-Stream-Parser =================
   Tokenisiert Content-Streams byte-genau (Positionen!), führt den Text-
   Grafikzustand und erzeugt klickbare Text-Items. Gespeichert wird später
   durch Byte-Splicing im dekomprimierten Stream – nie durch Re-Serialisierung. */

const WS=new Set([0,9,10,12,13,32]);
const DELIM=new Set('()<>[]{}/%'.split('').map(c=>c.charCodeAt(0)));

function tokenizeRun(bytes, onOp, onError){
  let p=0; const n=bytes.length;
  const isWs=b=>WS.has(b), isDelim=b=>DELIM.has(b);
  function skipWs(){ for(;;){ while(p<n&&isWs(bytes[p]))p++;
    if(p<n&&bytes[p]===37){ while(p<n&&bytes[p]!==10&&bytes[p]!==13)p++; } else break; } }
  function litString(){ // p auf '('
    const start=p; p++; const out=[]; let depth=1;
    while(p<n&&depth>0){
      let b=bytes[p];
      if(b===92){ // backslash
        const e=bytes[p+1];
        if(e===110){out.push(10);p+=2;}
        else if(e===114){out.push(13);p+=2;}
        else if(e===116){out.push(9);p+=2;}
        else if(e===98){out.push(8);p+=2;}
        else if(e===102){out.push(12);p+=2;}
        else if(e===40||e===41||e===92){out.push(e);p+=2;}
        else if(e>=48&&e<=55){ let v=0,k=0;p++;
          while(k<3&&p<n&&bytes[p]>=48&&bytes[p]<=55){v=v*8+(bytes[p]-48);p++;k++;}
          out.push(v&255);}
        else if(e===13){p+=2; if(bytes[p]===10)p++;}
        else if(e===10){p+=2;}
        else {out.push(e);p+=2;}
      }
      else if(b===40){depth++;out.push(b);p++;}
      else if(b===41){depth--;if(depth>0)out.push(b);p++;}
      else if(b===13){out.push(10);p++;if(bytes[p]===10)p++;}
      else {out.push(b);p++;}
    }
    return {kind:'str',bytes:new Uint8Array(out),start,end:p};
  }
  function hexString(){ // p auf '<'
    const start=p; p++; let hx='';
    while(p<n&&bytes[p]!==62){ const c=bytes[p];
      if((c>=48&&c<=57)||(c>=65&&c<=70)||(c>=97&&c<=102)) hx+=String.fromCharCode(c);
      p++; }
    p++; if(hx.length%2)hx+='0';
    const out=new Uint8Array(hx.length/2);
    for(let i=0;i<out.length;i++) out[i]=parseInt(hx.substr(i*2,2),16);
    return {kind:'hex',bytes:out,start,end:p};
  }
  function nameTok(){ const start=p; p++; let s='';
    while(p<n&&!isWs(bytes[p])&&!isDelim(bytes[p])){
      if(bytes[p]===35&&p+2<n){ s+=String.fromCharCode(parseInt(String.fromCharCode(bytes[p+1],bytes[p+2]),16)); p+=3; }
      else { s+=String.fromCharCode(bytes[p]); p++; } }
    return {kind:'name',name:s,start,end:p}; }
  function readToken(){
    skipWs(); if(p>=n) return null;
    const b=bytes[p], start=p;
    if(b===40) return litString();
    if(b===60){ if(bytes[p+1]===60){p+=2;return {kind:'<<',start,end:p};} return hexString(); }
    if(b===62){ if(bytes[p+1]===62){p+=2;return {kind:'>>',start,end:p};} p++; return readToken(); }
    if(b===91){p++;return {kind:'[',start,end:p};}
    if(b===93){p++;return {kind:']',start,end:p};}
    if(b===123||b===125){p++;return {kind:'brace',start,end:p};}
    if(b===47) return nameTok();
    if((b>=48&&b<=57)||b===43||b===45||b===46){
      let s=''; while(p<n&&!isWs(bytes[p])&&!isDelim(bytes[p])){s+=String.fromCharCode(bytes[p]);p++;}
      return {kind:'num',num:parseFloat(s)||0,start,end:p};
    }
    let s=''; while(p<n&&!isWs(bytes[p])&&!isDelim(bytes[p])){s+=String.fromCharCode(bytes[p]);p++;}
    if(s==='') {p++; return readToken();}
    return {kind:'op',name:s,start,end:p};
  }
  function skipDict(){ let depth=1;
    while(depth>0){ const t=readToken(); if(!t) return;
      if(t.kind==='<<')depth++; else if(t.kind==='>>')depth--; } }
  function readArray(){ const items=[];
    for(;;){ const t=readToken(); if(!t) break;
      if(t.kind===']') break;
      if(t.kind==='[') items.push({kind:'arr',items:readArray()});
      else if(t.kind==='<<'){skipDict();items.push({kind:'dict'});}
      else items.push(t); }
    return items; }
  function skipInlineImage(){ // nach 'ID': 1 Whitespace, dann binär bis EI
    if(p<n&&isWs(bytes[p]))p++;
    while(p<n){
      if(bytes[p]===69&&bytes[p+1]===73&&(p+2>=n||isWs(bytes[p+2])||isDelim(bytes[p+2]))&&(p===0||isWs(bytes[p-1]))){ p+=2; return; }
      p++;
    }
  }
  let operands=[], firstStart=null;
  try{
    for(;;){
      const t=readToken(); if(!t) break;
      if(t.kind==='op'){
        if(t.name==='ID'){ operands=[];firstStart=null; skipInlineImage(); continue; }
        onOp(t.name, operands, firstStart===null?t.start:firstStart, t.end);
        operands=[]; firstStart=null;
      } else if(t.kind==='['){
        const a={kind:'arr',items:readArray(),start:t.start};
        if(firstStart===null)firstStart=t.start;
        operands.push(a);
      } else if(t.kind==='<<'){
        if(firstStart===null)firstStart=t.start;
        skipDict(); operands.push({kind:'dict',start:t.start});
      } else {
        if(firstStart===null)firstStart=t.start;
        operands.push(t);
      }
      if(operands.length>64){operands=[];firstStart=null;} // Schutz
    }
  }catch(e){ if(onError) onError(e); }
}

/* ---------- Matrizen ---------- */
const M_ID=[1,0,0,1,0,0];
function mmul(a,b){ return [
  a[0]*b[0]+a[1]*b[2], a[0]*b[1]+a[1]*b[3],
  a[2]*b[0]+a[3]*b[2], a[2]*b[1]+a[3]*b[3],
  a[4]*b[0]+a[5]*b[2]+b[4], a[4]*b[1]+a[5]*b[3]+b[5] ]; }
function mapply(m,x,y){ return [m[0]*x+m[2]*y+m[4], m[1]*x+m[3]*y+m[5]]; }

/* ---------- Seiten-Parse: Items erzeugen ---------- */
const SPACING_ADJ_LIMIT=180; // TJ-Zahlen ab ~0.18em gelten als Positions-Spacing

function parsePageItems(page){
  const items=[];
  page.barriers=[];   // dünne vertikale Füllrechtecke = Tabellen-/Zellrahmen
  let err=null;
  const gs={ctm:M_ID.slice(),font:null,size:0,Tc:0,Tw:0,Tz:100,TL:0,Ts:0};
  const stack=[];
  let tm=M_ID.slice(), tlm=M_ID.slice(), inBT=false;
  let chain=null, pendingTd=null;

  const flush=()=>{
    if(!chain){pendingTd=null;return;}
    const els=chain.els;
    if(els.length){
      const first=els[0], last=els[els.length-1];
      let text='', codes=[], decodable=true, spacing=false;
      let maxEnd=0;
      for(const el of els){
        if(el.text===null) decodable=false; else { text+=el.text; codes.push(...el.codes); }
        if(el.spacing) spacing=true;
        maxEnd=Math.max(maxEnd, el.offset+el.adv);
      }
      const font=page.fonts.get(first.font);
      let ro=null;
      if(!font) ro='font';
      else if(font.ro) ro=font.ro;
      else if(!decodable) ro='decode';
      else if(spacing) ro='spacing';
      const form=(els.length===1&&chain.tdCount===0)?first.opName:'chain';
      items.push({
        id:items.length, pageIdx:page.index, streamIdx:first.streamIdx,
        range:[first.start,last.end], form:form==="'"?'quote':form==='"'?'dquote':form,
        text:decodable?text:null, codes, fontRes:first.font, size:first.size,
        Tc:first.Tc,Tw:first.Tw,Tz:first.Tz,
        base:first.base, adv:maxEnd, asc:font?font.ascent:.76, desc:font?font.descent:-.24,
        tdSum:[chain.tdX,chain.tdY], awacSrc:first.awacSrc||null,
        editable:!ro, ro, newText:null
      });
    }
    chain=null; pendingTd=null;
  };

  const showEl=(opName,segs,streamIdx,start,end,awacSrc)=>{
    const font=page.fonts.get(gs.font);
    let text='', codes=[], adv=0, spacing=false, decodable=!!font&&!font.ro;
    for(const sg of segs){
      if(sg.adj!==undefined){
        adv+=(-sg.adj/1000)*gs.size*(gs.Tz/100);
        if(Math.abs(sg.adj)>=SPACING_ADJ_LIMIT&&sg.notFirst) spacing=true;
        continue;
      }
      const d=font?decodeShowBytes(font,sg.bytes):{codes:[],text:null};
      if(d.text===null) decodable=false; else text+=d.text;
      codes.push(...d.codes);
      adv+=font&&font.widthsFn?codesAdvance(font,d.codes,gs.size,gs.Tc,gs.Tw,gs.Tz)
        :(font&&font.measure&&d.text?(font.measure(d.text)/1000)*gs.size*(gs.Tz/100):0);
    }
    const el={opName,streamIdx,start,end,font:gs.font,size:gs.size,Tc:gs.Tc,Tw:gs.Tw,Tz:gs.Tz,
      base:mmul(mmul([1,0,0,1,0,gs.Ts],tm),gs.ctm),
      text:decodable?text:null,codes,adv,spacing,awacSrc,offset:0};
    // Kette fortsetzen? (nur nach nahtlosem Td auf gleicher Basislinie)
    if(chain&&pendingTd&&chain.lastFont===gs.font&&chain.lastSize===gs.size){
      chain.tdX+=pendingTd.tx; chain.tdY+=pendingTd.ty;
      el.offset=chain.tdX;              // kumulierte Td-Summe = Position in der Zeile
      pendingTd=null;
      chain.els.push(el); chain.tdCount++;
    } else {
      flush();
      chain={els:[el],tdX:0,tdY:0,tdCount:0,lastFont:gs.font,lastSize:gs.size};
    }
    // Tm um den Advance des gezeigten Textes verschieben (Spec-Verhalten)
    tm=mmul([1,0,0,1,el.adv,0],tm);
  };

  const handle=(streamIdx)=>(op,ops,start,end)=>{
    const num=i=>ops[i]&&ops[i].kind==='num'?ops[i].num:0;
    switch(op){
      case 'q': stack.push({ctm:gs.ctm.slice(),font:gs.font,size:gs.size,Tc:gs.Tc,Tw:gs.Tw,Tz:gs.Tz,TL:gs.TL,Ts:gs.Ts}); flush(); break;
      case 'Q': { const s=stack.pop(); if(s){gs.ctm=s.ctm;gs.font=s.font;gs.size=s.size;gs.Tc=s.Tc;gs.Tw=s.Tw;gs.Tz=s.Tz;gs.TL=s.TL;gs.Ts=s.Ts;} flush(); break; }
      case 'cm': gs.ctm=mmul([num(0),num(1),num(2),num(3),num(4),num(5)],gs.ctm); flush(); break;
      case 'BT': tm=M_ID.slice(); tlm=M_ID.slice(); inBT=true; flush(); break;
      case 'ET': inBT=false; flush(); break;
      case 'Tf': gs.font=ops[0]&&ops[0].kind==='name'?ops[0].name:null; gs.size=num(1); flush(); break;
      case 'Td': {
        const tx=num(0), ty=num(1);
        tlm=mmul([1,0,0,1,tx,ty],tlm); tm=tlm.slice();
        if(chain&&ty===0&&!pendingTd){
          // Erwartet wäre der Advance des letzten Elements (Td ist relativ zum vorigen Td)
          const lastEl=chain.els[chain.els.length-1];
          const dev=Math.abs(tx-lastEl.adv);
          const tol=Math.max(0.15*gs.size*(gs.Tz/100),0.25);
          if(dev<=tol){ pendingTd={tx,ty,start,end}; break; }
        }
        flush(); break;
      }
      case 'TD': gs.TL=-num(1); {
        const tx=num(0),ty=num(1);
        tlm=mmul([1,0,0,1,tx,ty],tlm); tm=tlm.slice(); flush(); break; }
      case 'Tm': tlm=[num(0),num(1),num(2),num(3),num(4),num(5)]; tm=tlm.slice(); flush(); break;
      case 'T*': tlm=mmul([1,0,0,1,0,-gs.TL],tlm); tm=tlm.slice(); flush(); break;
      case 'TL': gs.TL=num(0); flush(); break;
      case 'Tc': gs.Tc=num(0); flush(); break;
      case 'Tw': gs.Tw=num(0); flush(); break;
      case 'Tz': gs.Tz=num(0)||100; flush(); break;
      case 'Ts': gs.Ts=num(0); flush(); break;
      case 're': { // Rechteck: dünne senkrechte Linien als Platz-Grenzen merken
        const x=num(0),y=num(1),w=num(2),h=num(3);
        const c=[[x,y],[x+w,y],[x,y+h],[x+w,y+h]].map(([px,py])=>mapply(gs.ctm,px,py));
        const xs=c.map(p=>p[0]),ys=c.map(p=>p[1]);
        const bw=Math.max(...xs)-Math.min(...xs), bh=Math.max(...ys)-Math.min(...ys);
        if(bw<=1.6&&bh>2.5) page.barriers.push({x:(Math.min(...xs)+Math.max(...xs))/2,y0:Math.min(...ys),y1:Math.max(...ys)});
        flush(); break;
      }
      case 'Tj': if(inBT&&ops[0]&&(ops[0].kind==='str'||ops[0].kind==='hex'))
          showEl('Tj',[{bytes:ops[0].bytes,start:ops[0].start,end:ops[0].end}],streamIdx,start,end);
        else flush();
        break;
      case 'TJ': {
        if(!inBT||!ops[0]||ops[0].kind!=='arr'){flush();break;}
        const segs=[]; let seen=false;
        for(const it of ops[0].items){
          if(it.kind==='num') segs.push({adj:it.num,notFirst:seen});
          else if(it.kind==='str'||it.kind==='hex'){ segs.push({bytes:it.bytes,start:it.start,end:it.end}); seen=true; }
        }
        showEl('TJ',segs,streamIdx,start,end);
        break;
      }
      case "'": {
        flush();
        tlm=mmul([1,0,0,1,0,-gs.TL],tlm); tm=tlm.slice();
        if(inBT&&ops[0]&&(ops[0].kind==='str'||ops[0].kind==='hex'))
          showEl("'",[{bytes:ops[0].bytes,start:ops[0].start,end:ops[0].end}],streamIdx,start,end);
        flush();
        break;
      }
      case '"': {
        flush();
        gs.Tw=num(0); gs.Tc=num(1);
        tlm=mmul([1,0,0,1,0,-gs.TL],tlm); tm=tlm.slice();
        const sOp=ops[2];
        if(inBT&&sOp&&(sOp.kind==='str'||sOp.kind==='hex')){
          const awac=L1.decode(page.streams[streamIdx].content.slice(ops[0].start,ops[1].end));
          showEl('"',[{bytes:sOp.bytes,start:sOp.start,end:sOp.end}],streamIdx,start,end,awac);
        }
        flush();
        break;
      }
      default: flush(); break;
    }
  };

  try{
    for(let si=0;si<page.streams.length;si++){
      tokenizeRun(page.streams[si].content, handle(si), e=>{err=e;});
    }
    flush();
  }catch(e){ err=e; }
  page.parseError=err?String(err&&err.message||err):null;
  return items;
}

'use strict';
/* ================= Zustand & Kern ================= */
let handle=null;
let fileBytes=null;        // aktuelle Dateibasis (Original bzw. letzter Speicherstand)
let libDoc=null;           // pdf-lib-Dokument (NUR lesend)
let pdfDoc=null;           // pdf.js-Dokument für die Anzeige (Arbeitsstand)
let model=null;
let zoom=1, fitMode=true;
let lastSaved=null;
let mode=null;             // 'pdf' | 'html' – aktiver Editor-Modus

const $=s=>document.querySelector(s);
const statusEl=$('#status'), btnSave=$('#btnSave'), btnOpen=$('#btnOpen');
const legacyOpen=$('#legacyOpen');
const overlayDrop=$('#dropOverlay'), pagesEl=$('#pages'), scroller=$('#scroller');

/* Brave stellt die File System Access API bei lokal geöffneten file://-Seiten
   nicht bereit. In diesem Fall wird über ein normales Dateifeld geöffnet und
   beim Speichern eine bearbeitete Kopie heruntergeladen. */
function makeDownloadHandle(file){
  return {kind:'file',name:file.name,downloadOnly:true,getFile:async()=>file};
}
function isDownloadMode(){ return !!(handle&&handle.downloadOnly); }
function syncSaveUi(){
  btnSave.textContent=isDownloadMode()?'Kopie speichern':'Speichern';
  btnSave.title=isDownloadMode()
    ?'Brave kann die lokale Originaldatei nicht direkt überschreiben. Die bearbeitete Datei wird als Kopie heruntergeladen.'
    :'Änderungen direkt in der geöffneten Datei speichern';
}
function savedStatusText(){
  if(lastSaved) return (isDownloadMode()?'✓ Kopie heruntergeladen um ':'✓ Gespeichert um ')
    +lastSaved.toLocaleTimeString('de-DE');
  return isDownloadMode()?'Brave-Modus · Original bleibt unverändert':'Keine Änderungen';
}
async function writeBackOrDownload(blob){
  if(!handle)throw new Error('Keine Datei geöffnet.');
  if(typeof handle.createWritable==='function'){
    if(handle.queryPermission&&(await handle.queryPermission({mode:'readwrite'}))!=='granted'){
      if(!handle.requestPermission||(await handle.requestPermission({mode:'readwrite'}))!=='granted')
        throw new Error('Schreibberechtigung wurde nicht erteilt.');
    }
    const w=await handle.createWritable();
    await w.write(blob);
    await w.close();
    return 'direct';
  }
  downloadBlob(blob,handle.name||'dokument');
  return 'download';
}

/* ---------- Plattform (Windows/macOS) ---------- */
const IS_MAC=/Mac|iP(hone|ad|od)/.test(navigator.platform||navigator.userAgent||'');
const KEY_SAVE=IS_MAC?'⌘S':'Strg+S';
if(IS_MAC){
  const h=$('#hint'); h.textContent=h.textContent.replace(/Strg\+/g,'⌘');
  const dz=$('#dropzoneBox'); if(dz)dz.innerHTML=dz.innerHTML.replace(/Strg\+/g,'⌘');
}

/* pdf.js-Worker offline aus eingebettetem Base64 */
(function(){
  try{
    const wb=Uint8Array.from(atob(WORKER_B64),c=>c.charCodeAt(0));
    pdfjsLib.GlobalWorkerOptions.workerSrc=URL.createObjectURL(new Blob([wb],{type:'text/javascript'}));
  }catch(e){ console.error('Worker-Setup fehlgeschlagen',e); }
})();

function busy(msg){ const b=$('#busy'); if(msg){b.textContent=msg;b.style.display='block';} else b.style.display='none'; }
function showError(msg){ const b=$('#errorbar'); b.textContent=msg; b.hidden=false; }
function hideError(){ $('#errorbar').hidden=true; }
function setNotice(msg){ const b=$('#noticebar'); if(msg){b.textContent=msg;b.hidden=false;} else b.hidden=true; }

function isDirty(){
  if(mode==='html') return changedRuns().length>0||srcText!==hBaseline;
  if(mode==='md') return mdText!==mdOrig;
  return !!model&&(pdfBaseDirty||model.pages.some(p=>p.streams.some(s=>s.modified)));
}
function updateStatus(){
  if(mode==='html'){ hUpdateStatus(); return; }
  if(mode==='md'){ mUpdateStatus(); return; }
  syncSaveUi();
  btnSave.disabled=!handle;
  if(!handle){statusEl.textContent='';return;}
  if(isDirty()){statusEl.textContent='● Ungespeicherte Änderungen';statusEl.className='dirty';}
  else {statusEl.textContent=savedStatusText();statusEl.className=lastSaved?'clean':'neutral';}
}
let flashTimer=null;
function flash(msg){ statusEl.textContent=msg; statusEl.className='neutral';
  clearTimeout(flashTimer); flashTimer=setTimeout(updateStatus,1800); }

/* ---------- Hilfen ---------- */
const ENC=new TextEncoder();
function fmtNum(n){ let v=Math.round(n*1e5)/1e5; if(Object.is(v,-0))v=0; return String(v); }
function bytesEqual(a,b){ if(a.length!==b.length)return false;
  for(let i=0;i<a.length;i++) if(a[i]!==b[i])return false; return true; }
function spliceBytes(content,repls){
  repls=[...repls].sort((a,b)=>a.start-b.start);
  let total=content.length;
  for(const r of repls) total+=r.bytes.length-(r.end-r.start);
  const out=new Uint8Array(total);
  let src=0,o=0;
  for(const r of repls){
    out.set(content.subarray(src,r.start),o); o+=r.start-src;
    out.set(r.bytes,o); o+=r.bytes.length;
    src=r.end;
  }
  out.set(content.subarray(src),o);
  return out;
}
async function deflateBytes(u8){
  const cs=new CompressionStream('deflate');
  const resp=new Response(new Blob([u8]).stream().pipeThrough(cs));
  return new Uint8Array(await resp.arrayBuffer());
}
function randomIdHex(){
  const a=new Uint8Array(16); crypto.getRandomValues(a);
  return '<'+[...a].map(b=>b.toString(16).padStart(2,'0')).join('').toUpperCase()+'>';
}
function decodePdfNameKey(pdfName){ // '/F#31' -> 'F1'
  let s=String(pdfName).replace(/^\//,'');
  return s.replace(/#([0-9A-Fa-f]{2})/g,(_,h)=>String.fromCharCode(parseInt(h,16)));
}

/* ---------- Datei öffnen ---------- */
function findStartxref(bytes){
  const tail=L1.decode(bytes.subarray(Math.max(0,bytes.length-2048)));
  let m,last=null; const re=/startxref\s+(\d+)/g;
  while((m=re.exec(tail)))last=m[1];
  return last?parseInt(last,10):null;
}
function detectXrefStream(bytes,off){
  if(off===null||off>=bytes.length)return false;
  let p=off; while(p<bytes.length&&WS.has(bytes[p]))p++;
  return L1.decode(bytes.subarray(p,p+4))!=='xref';
}
/* Autoritative Trailer-Metadaten (Size, ID) direkt aus den Originalbytes lesen –
   pdf-libs largestObjectNumber unterschlägt in ObjStm/XRef-Stream-Dateien die
   Struktur-Objekte (ObjStm, XRef-Stream) und wäre als Basis für eine neue
   Objektnummer gefährlich (Kollision -> zerstörte Datei). */
function parseTrailerMeta(bytes){
  const meta={size:null,idFirst:null};
  const off=findStartxref(bytes);
  if(off===null||off>=bytes.length)return meta;
  const isXS=detectXrefStream(bytes,off);
  let dictText='';
  if(isXS){
    const tail=L1.decode(bytes.subarray(off,Math.min(bytes.length,off+4096)));
    const a=tail.indexOf('<<'); const b=tail.indexOf('stream',a<0?0:a);
    if(a>=0) dictText=tail.slice(a,b<0?undefined:b);
  } else {
    const tail=L1.decode(bytes.subarray(off,Math.min(bytes.length,off+65536)));
    const tp=tail.indexOf('trailer');
    if(tp>=0){ const a=tail.indexOf('<<',tp); const b=tail.indexOf('>>',a);
      if(a>=0&&b>=0) dictText=tail.slice(a,b+2); }
  }
  const ms=/\/Size\s+(\d+)/.exec(dictText); if(ms) meta.size=parseInt(ms[1],10);
  const mid=/\/ID\s*\[\s*<([0-9A-Fa-f]*)>/.exec(dictText); if(mid) meta.idFirst='<'+mid[1]+'>';
  return meta;
}

/* Dispatcher: erkennt den Dateityp und startet den passenden Modus */
async function loadFromHandle(h){
  if(isDirty()&&!confirm('Ungespeicherte Änderungen verwerfen?'))return;
  if(typeof findCloseBar==='function')findCloseBar();
  let file;
  try{ file=await h.getFile(); }
  catch(err){ showError('Datei konnte nicht gelesen werden: '+err.message); return; }
  const bytes=new Uint8Array(await file.arrayBuffer());
  const head=L1.decode(bytes.subarray(0,1024));
  const name=(h.name||'').toLowerCase();
  const isPdf=head.includes('%PDF-')||name.endsWith('.pdf');
  const isMd=name.endsWith('.md')||name.endsWith('.markdown')||name.endsWith('.txt');
  const isHtml=name.endsWith('.html')||name.endsWith('.htm')
    ||/<(!doctype|html|head|body|meta|title|div|p|h[1-6]|span|table)[\s>]/i.test(head);
  if(isPdf) await loadPdfBytes(h,bytes);
  else if(isMd) await mLoadBytes(h,bytes);
  else if(isHtml) await hLoadBytes(h,bytes);
  else showError('Dateityp nicht erkannt – unterstützt werden HTML (.html/.htm), Markdown (.md), Text (.txt) und digitale PDFs (.pdf).');
  if(handle===h)recentAdd(h);   // v2.8: erfolgreich geladen → in „Zuletzt geöffnet“ merken
}

/* ---------- Zuletzt geöffnet (v2.8): File-Handles in IndexedDB, Wiederöffnen per Klick ----------
   Chrome fragt beim Wiederöffnen nach der Schreibberechtigung (User-Geste = der Klick). Fehlt IndexedDB
   oder lässt sich der Handle nicht ablegen (z. B. Datei gelöscht), bleibt die Liste einfach leer. */
const RECENT_MAX=8;
function recentDb(){
  return new Promise((res,rej)=>{
    if(!window.indexedDB){rej(new Error('kein IndexedDB'));return;}
    let rq;
    try{ rq=indexedDB.open('findobe',1); }catch(err){ rej(err); return; }
    rq.onupgradeneeded=()=>{ rq.result.createObjectStore('recent',{keyPath:'name'}); };
    rq.onsuccess=()=>res(rq.result); rq.onerror=()=>rej(rq.error); rq.onblocked=()=>rej(new Error('blockiert'));
  });
}
function idbReq(r){ return new Promise((res,rej)=>{ r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }
async function recentAll(){
  try{
    const db=await recentDb();
    const all=await idbReq(db.transaction('recent').objectStore('recent').getAll());
    db.close();
    return (all||[]).filter(e=>e&&e.handle&&e.name).sort((a,b)=>b.t-a.t);
  }catch(_){ return []; }
}
async function recentAdd(h){
  try{
    if(!h||h.downloadOnly||!h.name||typeof h.getFile!=='function')return;
    const db=await recentDb();
    const tx=db.transaction('recent','readwrite'), st=tx.objectStore('recent');
    st.put({name:h.name,handle:h,t:Date.now()});
    const all=await idbReq(st.getAll());
    (all||[]).sort((a,b)=>b.t-a.t).slice(RECENT_MAX).forEach(e=>st.delete(e.name));
    await new Promise(r=>{tx.oncomplete=r;tx.onerror=r;tx.onabort=r;});
    db.close();
  }catch(_){}
  recentRender();
}
async function recentRender(){
  const box=$('#recentList'); if(!box)return;
  const all=await recentAll();
  box.innerHTML='';
  if(!all.length||!window.showOpenFilePicker){box.hidden=true;return;}
  const cap=document.createElement('div'); cap.className='cap'; cap.textContent='Zuletzt geöffnet – Klick öffnet die Datei erneut'; box.appendChild(cap);
  for(const e of all){
    const b=document.createElement('button'); b.type='button';
    b.textContent=e.name;
    const wh=document.createElement('span'); wh.className='when';
    try{ wh.textContent=new Date(e.t).toLocaleString('de-DE',{dateStyle:'short',timeStyle:'short'}); }catch(_){ wh.textContent=''; }
    b.appendChild(wh);
    b.title='Erneut öffnen – der Browser fragt ggf. nach der Berechtigung zum Schreiben';
    b.addEventListener('click',async ev=>{
      ev.stopPropagation(); ev.preventDefault();
      const h=e.handle;
      try{
        if(h.requestPermission&&(await h.requestPermission({mode:'readwrite'}))!=='granted'){ flash('Berechtigung nicht erteilt'); return; }
      }catch(err){ showError('Datei nicht mehr erreichbar: '+(err&&err.message?err.message:err)); return; }
      await loadFromHandle(h);
    });
    box.appendChild(b);
  }
  box.hidden=false;
}
recentRender();

async function loadPdfBytes(h,bytes){
  busy('Lade PDF…');
  try{
    if(L1.decode(bytes.subarray(0,1024)).indexOf('%PDF-')===-1){
      showError('Das ist keine PDF-Datei.'); return;
    }
    let doc;
    try{
      doc=await PDFLib.PDFDocument.load(bytes,{updateMetadata:false,throwOnInvalidObject:false});
    }catch(e){
      const msg=String(e&&e.message||e);
      if(/encrypt/i.test(msg)||/EncryptedPDF/i.test(String(e&&e.constructor&&e.constructor.name))){
        showError('Diese PDF ist verschlüsselt (auch leere Besitzer-Passwörter zählen). Der Editor unterstützt nur unverschlüsselte PDFs. Empfehlung: Datei ohne Verschlüsselung neu erzeugen/exportieren.');
      } else showError('PDF konnte nicht analysiert werden: '+msg);
      return;
    }
    if(doc.isEncrypted){
      showError('Diese PDF ist verschlüsselt. Der Editor unterstützt nur unverschlüsselte PDFs.');
      return;
    }
    // HTML-/MD-Modus abbauen, PDF-Modus aktivieren
    mode='pdf';
    pdfHist=[]; pdfHistPos=-1; pdfBaseDirty=false;
    editSpan=null; editRun=null; hOverlay=null; runs=[]; nodeMap=new Map(); srcText=''; unmappedContent=0;
    if(hViewer.getAttribute('srcdoc')) hViewer.srcdoc='';
    hOutlineEl.innerHTML='';
    mdText=''; mdOrig=''; mEdit=null; mIns=null; mOutlineEl.innerHTML='';
    if(mViewer.getAttribute('srcdoc')) mViewer.srcdoc='';
    document.body.classList.add('mode-pdf');
    document.body.classList.remove('mode-html','mode-md');
    $('#hint').textContent='Textstelle anklicken · Enter = Übernehmen · Esc = Abbrechen · '+KEY_SAVE+' = Speichern';
    handle=h; fileBytes=bytes; libDoc=doc; lastSaved=null;
    buildModel(bytes);
    await setPreviewDoc(fileBytes);
    $('#fileName').textContent=h.name; $('#fileName').title=h.name;
    document.title=h.name+' – FinDobe v2.8';
    hideError();
    document.body.classList.add('file-loaded');
    try{
      if(h.queryPermission&&(await h.queryPermission({mode:'readwrite'}))!=='granted'&&h.requestPermission){
        await h.requestPermission({mode:'readwrite'});
      }
    }catch(_){}
    await initialRender();
    updateStatus();
  } finally { busy(null); }
}

function buildModel(bytes){
  const ctx=libDoc.context, N=PDFLib.PDFName;
  const ti=ctx.trailerInfo||{};
  const rootSrc=ti.Root?String(ti.Root):null;
  const infoSrc=ti.Info?String(ti.Info):null;
  const prev=findStartxref(bytes);
  const isXS=detectXrefStream(bytes,prev);
  // ID exakt aus den Bytes (nicht über pdf-libs String() -> würde Binärbytes verfälschen)
  const tmeta=parseTrailerMeta(bytes);
  const idFirstSrc=tmeta.idFirst;
  // wahre Objektzahl: Maximum aus pdf-lib und Trailer-/Size (Struktur-Objekte!)
  const trueSize=Math.max((ctx.largestObjectNumber||0)+1, tmeta.size||0);
  const streamUse=new Map(); // objNum -> Anzahl Seiten
  const pages=libDoc.getPages().map((pg,idx)=>{
    const node=pg.node;
    let cRaw=node.get(N.of('Contents'));
    let refs=[];
    const resolved=plLookup(ctx,cRaw);
    if(isRef(cRaw)&&resolved&&!isArr(resolved)) refs=[cRaw];
    else if(resolved&&isArr(resolved)) refs=resolved.asArray().filter(r=>isRef(r));
    const streams=[];
    let parseFail=null;
    for(const ref of refs){
      const raw=plLookup(ctx,ref);
      let content=null;
      try{ content=decodeStreamBytes(ctx,ref); }catch(e){ parseFail=String(e.message||e); }
      if(!content){ parseFail=parseFail||'Content-Stream nicht dekodierbar'; continue; }
      let dictExtra='';
      try{
        const skip=new Set(['/Filter','/DecodeParms','/Length','/DL']);
        raw.dict.entries().forEach(([k,v])=>{ const ks=String(k); if(!skip.has(ks)) dictExtra+=ks+' '+String(v)+' '; });
      }catch(_){}
      streams.push({ref,num:ref.objectNumber,gen:ref.generationNumber,dictExtra,
        content,origContent:content,modified:false});
      streamUse.set(ref.objectNumber,(streamUse.get(ref.objectNumber)||0)+1);
    }
    // Fonts der Seite
    const fonts=new Map();
    let res=null;
    try{ res=node.Resources?node.Resources():null; }catch(_){}
    if(res){
      const fd=plLookup(ctx,res.get(N.of('Font')));
      if(isDict(fd)){
        fd.entries().forEach(([k,v])=>{
          try{ fonts.set(decodePdfNameKey(k),buildFont(ctx,decodePdfNameKey(k),v)); }catch(_){}
        });
      }
    }
    // Text in Form-XObjects? (Kopf-/Fußzeilen etc. – nicht editierbar)
    let formText=false;
    try{
      const xo=res?plLookup(ctx,res.get(N.of('XObject'))):null;
      if(xo&&xo.constructor.name==='PDFDict'){
        for(const [,v] of xo.entries()){
          const s=plLookup(ctx,v);
          if(s&&s.dict&&plName(s.dict.get(N.of('Subtype')))==='Form'){
            const b=decodeStreamBytes(ctx,v);
            if(b&&/(^|[^A-Za-z])(Tj|TJ)([^A-Za-z]|$)/.test(L1.decode(b))) formText=true;
          }
        }
      }
    }catch(_){}
    return {index:idx,pdfLibPage:pg,streams,fonts,items:[],parseFail,formText,
      shared:false,wrap:null,canvas:null,overlay:null,viewport:null,editedMarks:[]};
  });
  for(const p of pages) p.shared=p.streams.some(s=>(streamUse.get(s.num)||0)>1);
  model={pages,rootSrc,infoSrc,idFirstSrc,size:trueSize,prev,isXS};
}

/* ---------- Ersetzung bauen ----------
   fitTz: optionale reduzierte Laufweite (horizontale Skalierung), um längeren
   Text ohne Überlappung in den vorhandenen Platz einzupassen. Wird als
   Tz-Paar (setzen/zurücksetzen) um den Show-Operator gelegt. */
function buildReplacement(item,font,fitTz){
  const {codes,missing}=encodeTextToCodes(font,item.pendingText);
  if(missing.length)return {missing};
  const hex=bytesToHexStr(codesToBytes(font,codes));
  const useTz=(fitTz&&Math.abs(fitTz-item.Tz)>0.01)?fitTz:null;
  let core;
  switch(item.form){
    case 'Tj': core=hex+' Tj'; break;
    case 'TJ': core='[ '+hex+' ] TJ'; break;
    case 'quote': core=hex+" '"; break;
    case 'dquote': core=(item.awacSrc||'0 0')+' '+hex+' "'; break;
    default: core=hex+' Tj'; break;
  }
  if(useTz) core=fmtNum(useTz)+' Tz '+core+' '+fmtNum(item.Tz)+' Tz';
  if(item.form!=='Tj'&&item.form!=='TJ'&&item.form!=='quote'&&item.form!=='dquote'){
    core+=' '+fmtNum(item.tdSum[0])+' '+fmtNum(item.tdSum[1])+' Td';
  }
  const tzEff=useTz||item.Tz;
  let newAdv;
  if(font.widthsFn) newAdv=codesAdvance(font,codes,item.size,item.Tc,item.Tw,tzEff);
  else if(font.measure) newAdv=(font.measure(item.pendingText)/1000)*item.size*(tzEff/100)+item.Tc*codes.length*(tzEff/100);
  else newAdv=item.adv;
  return {bytes:ENC.encode(core),codes,newAdv};
}

async function applyEdit(page,item,newText,fitTz){
  const font=page.fonts.get(item.fontRes);
  item.pendingText=newText;
  const rep=buildReplacement(item,font,fitTz);
  if(rep.missing)return rep;
  pdfCapture(page,item,newText,fitTz);
  const stream=page.streams[item.streamIdx];
  stream.content=spliceBytes(stream.content,[{start:item.range[0],end:item.range[1],bytes:rep.bytes}]);
  stream.modified=!bytesEqual(stream.content,stream.origContent);
  const o=mapply(item.base,0,0);
  page.editedMarks.push({x:o[0],y:o[1]});
  busy('Aktualisiere Vorschau…');
  try{
    await setPreviewDoc(await currentBytes());
    await rerenderPage(page);
  } finally { busy(null); }
  updateStatus();
  return {};
}

function collectMods(){
  const mods=new Map();
  for(const p of model.pages) for(const s of p.streams){
    if(s.modified&&!mods.has(s.num))
      mods.set(s.num,{num:s.num,gen:s.gen,dictExtra:s.dictExtra,content:s.content});
  }
  return mods;
}
async function currentBytes(){
  const mods=collectMods();
  if(!mods.size)return fileBytes;
  return (await buildIncrement(fileBytes,mods,model)).bytes;
}

/* ---------- Incremental Update anhängen ---------- */
async function buildIncrement(base,modsMap,m){
  const parts=[]; let off=base.length;
  parts.push(base);
  const push=x=>{const b=typeof x==='string'?ENC.encode(x):x;parts.push(b);off+=b.length;};
  push('\n');
  const list=[...modsMap.values()].sort((a,b)=>a.num-b.num);
  const canDeflate=typeof CompressionStream==='function';
  const offsets=new Map();
  for(const md of list){
    let content=md.content, filter='';
    if(canDeflate){ try{ content=await deflateBytes(content); filter='/Filter /FlateDecode '; }catch(_){ content=md.content; filter=''; } }
    offsets.set(md.num,off);
    push(md.num+' '+md.gen+' obj\n<< '+md.dictExtra+filter+'/Length '+content.length+' >>\nstream\n');
    push(content);
    push('\nendstream\nendobj\n');
  }
  const xrefOff=off;
  const idPart=m.idFirstSrc?' /ID [ '+m.idFirstSrc+' '+randomIdHex()+' ]':'';
  const infoPart=m.infoSrc?' /Info '+m.infoSrc:'';
  let newSize=m.size;
  if(!m.isXS){
    let x='xref\n';
    for(const md of list)
      x+=md.num+' 1\n'+String(offsets.get(md.num)).padStart(10,'0')+' '+String(md.gen).padStart(5,'0')+' n \n';
    x+='trailer\n<< /Size '+m.size+' /Root '+m.rootSrc+infoPart+idPart+' /Prev '+m.prev+' >>\nstartxref\n'+xrefOff+'\n%%EOF\n';
    push(x);
  } else {
    const xnum=m.size; newSize=m.size+1;
    const entries=list.map(md=>({n:md.num,o:offsets.get(md.num),g:md.gen}));
    entries.push({n:xnum,o:xrefOff,g:0});
    entries.sort((a,b)=>a.n-b.n);
    const rows=new Uint8Array(entries.length*7);
    entries.forEach((e,i)=>{ rows[i*7]=1;
      rows[i*7+1]=(e.o>>>24)&255;rows[i*7+2]=(e.o>>>16)&255;rows[i*7+3]=(e.o>>>8)&255;rows[i*7+4]=e.o&255;
      rows[i*7+5]=(e.g>>8)&255;rows[i*7+6]=e.g&255; });
    const index=entries.map(e=>e.n+' 1').join(' ');
    push(xnum+' 0 obj\n<< /Type /XRef /Size '+(xnum+1)+' /Index [ '+index+' ] /W [ 1 4 2 ] /Root '
      +m.rootSrc+infoPart+idPart+' /Prev '+m.prev+' /Length '+rows.length+' >>\nstream\n');
    push(rows);
    push('\nendstream\nendobj\nstartxref\n'+xrefOff+'\n%%EOF\n');
  }
  const total=new Uint8Array(off);
  let o2=0; for(const p of parts){ total.set(p,o2); o2+=p.length; }
  return {bytes:total,newStartxref:xrefOff,newSize};
}

/* ---------- Speichern ---------- */
async function save(){
  if(mode==='html') return hSave();
  if(mode==='md') return mSave();
  return savePdf();
}
async function savePdf(){
  if(!handle)return;
  if(typeof closeEditBox==='function') await closeEditBox(true);
  const mods=collectMods();
  if(!mods.size&&!pdfBaseDirty){ flash('Keine Änderungen zu speichern'); return; }
  busy('Speichere…');
  try{
    let inc=null, outBytes=fileBytes;
    if(mods.size){ inc=await buildIncrement(fileBytes,mods,model); outBytes=inc.bytes; }
    try{
      await writeBackOrDownload(new Blob([outBytes],{type:'application/pdf'}));
    }catch(err){
      showError('Speichern fehlgeschlagen: '+(err&&err.message?err.message:err));
      return;
    }
    hideError();
    fileBytes=outBytes;
    if(inc){ model.prev=inc.newStartxref; model.size=inc.newSize; }
    for(const p of model.pages)for(const s of p.streams){ s.origContent=s.content; s.modified=false; }
    pdfBaseDirty=false;
    lastSaved=new Date();
    updateStatus();
  } finally { busy(null); }
}

/* ---------- Export: jedes geladene Dokument als HTML oder PDF ---------- */
function exportBaseName(){
  const n=(handle&&handle.name)||'dokument';
  return n.replace(/\.[^.]+$/,'');
}
function downloadBlob(blob,filename){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1500);
}
function hCurrentText(){
  if(editSpan)hEndEdit(true);
  const changed=changedRuns().sort((a,b)=>a.start-b.start);
  let out='',pos=0;
  for(const r of changed){ out+=srcText.slice(pos,r.start)+hEncodeRun(r); pos=r.end; }
  out+=srcText.slice(pos);
  return out;
}
function mFlushPending(){
  if(mIns){ if(mIns.kind==='row')mInsRowCommit(false); else mInsCommitCurrent(false); }
  if(mEdit)mCommit();
  return !mIns&&!mEdit;   // false = durch Fehlerdialog blockiert
}
function mExportHtml(){
  const {html}=mdParse(mdText);
  // Editor-Instrumentierung (span.mr mit data-s/data-e) für den Export entfernen
  const tmp=document.createElement('div');
  tmp.innerHTML=html;
  for(const s of Array.from(tmp.querySelectorAll('span.mr'))){
    const p=s.parentNode;
    while(s.firstChild)p.insertBefore(s.firstChild,s);
    p.removeChild(s);
  }
  return '<!doctype html><html><head><meta charset="utf-8"><title>'+escHtml(exportBaseName())
    +'</title><style>'+MD_CSS+'</style></head><body>'+tmp.innerHTML+'</body></html>';
}
async function pdfExtractHtml(){
  busy('Extrahiere Text…');
  try{
    const secs=[];
    for(let i=1;i<=pdfDoc.numPages;i++){
      const pg=await pdfDoc.getPage(i);
      const tc=await pg.getTextContent();
      const lines=[]; let cur='',lastY=null;
      for(const it of tc.items){
        if(it.str===undefined)continue;
        const y=it.transform?Math.round(it.transform[5]):lastY;
        if(lastY!==null&&y!==null&&Math.abs(y-lastY)>2&&cur){ lines.push(cur); cur=''; }
        cur+=it.str;
        lastY=y;
        if(it.hasEOL){ lines.push(cur); cur=''; lastY=null; }
      }
      if(cur)lines.push(cur);
      const body=lines.map(l=>l.trim()).filter(Boolean)
        .map(l=>'<p>'+escHtml(l)+'</p>').join('\n');
      secs.push('<section class="page"><h2 class="pgno">Seite '+i+'</h2>\n'+body+'\n</section>');
    }
    return '<!doctype html><html><head><meta charset="utf-8"><title>'+escHtml(exportBaseName())+'</title><style>'
      +'body{font:15px/1.5 system-ui,"Segoe UI",sans-serif;color:#1e293b;max-width:52em;margin:0 auto;padding:2em 1.5em}'
      +'section.page{border-bottom:1px solid #cbd5e1;padding-bottom:1.5em;margin-bottom:1.5em}'
      +'h2.pgno{font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em}'
      +'p{margin:.35em 0}'
      +'</style></head><body>\n'+secs.join('\n')+'\n</body></html>';
  } finally { busy(null); }
}
async function exportHtml(){
  if(!handle)return;
  let html;
  if(mode==='html') html=hCurrentText();
  else if(mode==='md'){ if(!mFlushPending())return; html=mExportHtml(); }
  else { if(typeof closeEditBox==='function') await closeEditBox(true); html=await pdfExtractHtml(); }
  downloadBlob(new Blob([html],{type:'text/html'}),exportBaseName()+'.html');
  flash('HTML exportiert');
}
/* Druck-CSS: saubere Seitenumbrüche für den PDF-Export aus HTML/MD */
const PRINT_CSS='@page{size:A4;margin:20mm 18mm}'
  +'@media print{'
  +'html,body{height:auto !important}'
  +'h1,h2,h3,h4,h5,h6{break-after:avoid-page;page-break-after:avoid;break-inside:avoid;page-break-inside:avoid}'
  +'li,tr,pre,blockquote,figure,img{break-inside:avoid;page-break-inside:avoid}'
  +'p{orphans:3;widows:3}'
  +'table{border-collapse:collapse}'
  +'thead{display:table-header-group}'
  +'tfoot{display:table-footer-group}'
  +'img,svg,video,canvas{max-width:100% !important;height:auto !important}'
  +'}';
function injectPrintCss(html){
  const tag='<style data-findobe-print>'+PRINT_CSS+'</style>';
  if(/<\/head>/i.test(html))return html.replace(/<\/head>/i,tag+'</head>');
  const m=/<html[^>]*>/i.exec(html);
  if(m)return html.slice(0,m.index+m[0].length)+tag+html.slice(m.index+m[0].length);
  return tag+html;
}
function printHtml(html){
  html=injectPrintCss(html);
  const fr=document.createElement('iframe');
  fr.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(fr);
  fr.addEventListener('load',()=>{
    setTimeout(()=>{
      try{
        fr.contentWindow.addEventListener('afterprint',()=>{ setNotice(null); fr.remove(); });
        fr.contentWindow.focus();
        fr.contentWindow.print();
      }catch(e){ showError('PDF-Export fehlgeschlagen: '+(e&&e.message?e.message:e)); fr.remove(); }
    },50);
  });
  fr.srcdoc=html;
  setNotice('Im Druckdialog „Als PDF speichern“ wählen, um die PDF-Datei zu erzeugen.');
  setTimeout(()=>{ if(fr.isConnected){ setNotice(null); fr.remove(); } },120000);
}
async function exportPdf(){
  if(!handle)return;
  if(mode==='pdf'){
    if(typeof closeEditBox==='function') await closeEditBox(true);
    const bytes=await currentBytes();
    downloadBlob(new Blob([bytes],{type:'application/pdf'}),exportBaseName()+'.pdf');
    flash('PDF exportiert');
    return;
  }
  let html;
  if(mode==='html') html=hCurrentText();
  else { if(!mFlushPending())return; html=mExportHtml(); }
  printHtml(html);
}
$('#btnExpHtml').addEventListener('click',()=>{ exportHtml().catch(err=>showError('Export fehlgeschlagen: '+(err&&err.message?err.message:err))); });
$('#btnExpPdf').addEventListener('click',()=>{ exportPdf().catch(err=>showError('Export fehlgeschlagen: '+(err&&err.message?err.message:err))); });

/* ---------- Word-Export (.docx, ohne externe Library) ---------- */
/* DOCX-CORE-START — reine Funktionen (auch in Node testbar) */
const CRC_TBL=(()=>{const t=new Uint32Array(256);
  for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);t[n]=c;}
  return t;})();
function crc32(bytes){let c=0xFFFFFFFF;
  for(let i=0;i<bytes.length;i++)c=CRC_TBL[(c^bytes[i])&0xFF]^(c>>>8);
  return (c^0xFFFFFFFF)>>>0;}
function zipStore(entries){ // entries: [{name, data:Uint8Array}] — Methode "stored", keine Kompression
  const enc=new TextEncoder();
  const chunks=[],central=[];let off=0;
  for(const e of entries){
    const nm=enc.encode(e.name),d=e.data,crc=crc32(d);
    const lh=new Uint8Array(30+nm.length),v=new DataView(lh.buffer);
    v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0,true);v.setUint16(8,0,true);
    v.setUint16(10,0,true);v.setUint16(12,0,true);v.setUint32(14,crc,true);
    v.setUint32(18,d.length,true);v.setUint32(22,d.length,true);
    v.setUint16(26,nm.length,true);v.setUint16(28,0,true);
    lh.set(nm,30);
    chunks.push(lh,d);
    const ch=new Uint8Array(46+nm.length),cv=new DataView(ch.buffer);
    cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0,true);
    cv.setUint16(10,0,true);cv.setUint16(12,0,true);cv.setUint16(14,0,true);cv.setUint32(16,crc,true);
    cv.setUint32(20,d.length,true);cv.setUint32(24,d.length,true);cv.setUint16(28,nm.length,true);
    cv.setUint16(30,0,true);cv.setUint16(32,0,true);cv.setUint16(34,0,true);cv.setUint16(36,0,true);
    cv.setUint32(38,0,true);cv.setUint32(42,off,true);
    ch.set(nm,46);
    central.push(ch);
    off+=lh.length+d.length;
  }
  const cdSize=central.reduce((s,c)=>s+c.length,0);
  const eocd=new Uint8Array(22),ev=new DataView(eocd.buffer);
  ev.setUint32(0,0x06054b50,true);ev.setUint16(4,0,true);ev.setUint16(6,0,true);
  ev.setUint16(8,entries.length,true);ev.setUint16(10,entries.length,true);
  ev.setUint32(12,cdSize,true);ev.setUint32(16,off,true);ev.setUint16(20,0,true);
  const total=off+cdSize+22,out=new Uint8Array(total);let p=0;
  for(const c of chunks){out.set(c,p);p+=c.length;}
  for(const c of central){out.set(c,p);p+=c.length;}
  out.set(eocd,p);
  return out;
}
function xmlEsc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function docxRunXml(r){
  if(r.br)return '<w:r><w:br/></w:r>';
  if(!r.text)return '';
  const pr=[];
  if(r.b)pr.push('<w:b/>');
  if(r.i)pr.push('<w:i/>');
  if(r.u)pr.push('<w:u w:val="single"/>');
  if(r.code)pr.push('<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="20"/>');
  return '<w:r>'+(pr.length?'<w:rPr>'+pr.join('')+'</w:rPr>':'')
    +'<w:t xml:space="preserve">'+xmlEsc(r.text)+'</w:t></w:r>';
}
function docxParaXml(b){
  const pr=[];
  if(b.style)pr.push('<w:pStyle w:val="'+b.style+'"/>');
  if(b.list)pr.push('<w:numPr><w:ilvl w:val="'+Math.min(b.list.lvl,8)+'"/><w:numId w:val="'
    +(b.list.type==='num'?'2':'1')+'"/></w:numPr>');
  const runs=(b.runs||[]).map(docxRunXml).join('');
  return '<w:p>'+(pr.length?'<w:pPr>'+pr.join('')+'</w:pPr>':'')+runs+'</w:p>';
}
function docxTableXml(b){
  const bd='<w:tblBorders>'+['top','left','bottom','right','insideH','insideV']
    .map(s=>'<w:'+s+' w:val="single" w:sz="4" w:space="0" w:color="94A3B8"/>').join('')+'</w:tblBorders>';
  const nCols=Math.max(...b.rows.map(r=>r.length),1);
  const grid='<w:tblGrid>'+Array.from({length:nCols},()=>'<w:gridCol w:w="'
    +Math.floor(9072/nCols)+'"/>').join('')+'</w:tblGrid>';
  const rows=b.rows.map(row=>'<w:tr>'+row.map(cell=>
    '<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr>'
    +docxParaXml({runs:cell})+'</w:tc>').join('')+'</w:tr>').join('');
  return '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>'+bd+'</w:tblPr>'+grid+rows+'</w:tbl><w:p/>';
}
function docxFromBlocks(blocks){
  const enc=new TextEncoder();
  const W='xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const body=blocks.map(b=>{
    if(b.t==='table')return docxTableXml(b);
    if(b.t==='code')return b.lines.map(l=>docxParaXml({style:'Code',runs:[{text:l,code:true}]})).join('');
    return docxParaXml(b);
  }).join('');
  const docXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    +'<w:document '+W+'><w:body>'+body
    +'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>'
    +'<w:pgMar w:top="1417" w:right="1417" w:bottom="1134" w:left="1417" w:header="708" w:footer="708" w:gutter="0"/>'
    +'</w:sectPr></w:body></w:document>';
  const hd=(id,sz,before)=>'<w:style w:type="paragraph" w:styleId="Heading'+id+'">'
    +'<w:name w:val="heading '+id+'"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/>'
    +'<w:pPr><w:keepNext/><w:spacing w:before="'+before+'" w:after="120"/><w:outlineLvl w:val="'+(id-1)+'"/></w:pPr>'
    +'<w:rPr><w:b/><w:sz w:val="'+sz+'"/></w:rPr></w:style>';
  const stylesXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    +'<w:styles '+W+'>'
    +'<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault>'
    +'<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'
    +'<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>'
    +hd(1,'36','240')+hd(2,'30','200')+hd(3,'26','160')+hd(4,'24','120')+hd(5,'22','120')+hd(6,'22','120')
    +'<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/>'
    +'<w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/></w:pPr>'
    +'<w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="20"/></w:rPr></w:style>'
    +'<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/>'
    +'<w:pPr><w:ind w:left="720"/></w:pPr><w:rPr><w:i/><w:color w:val="475569"/></w:rPr></w:style>'
    +'</w:styles>';
  const lvl=(i,fmt,txt)=>'<w:lvl w:ilvl="'+i+'"><w:start w:val="1"/><w:numFmt w:val="'+fmt+'"/>'
    +'<w:lvlText w:val="'+txt+'"/><w:lvlJc w:val="left"/>'
    +'<w:pPr><w:ind w:left="'+(720*(i+1))+'" w:hanging="360"/></w:pPr></w:lvl>';
  let abs0='<w:abstractNum w:abstractNumId="0">',abs1='<w:abstractNum w:abstractNumId="1">';
  const bullets=['•','◦','▪'];
  for(let i=0;i<9;i++){
    abs0+=lvl(i,'bullet',bullets[i%3]);
    abs1+=lvl(i,'decimal','%'+(i+1)+'.');
  }
  abs0+='</w:abstractNum>';abs1+='</w:abstractNum>';
  const numberingXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    +'<w:numbering '+W+'>'+abs0+abs1
    +'<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>'
    +'<w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num></w:numbering>';
  const contentTypes='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    +'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    +'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    +'<Default Extension="xml" ContentType="application/xml"/>'
    +'<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
    +'<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
    +'<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>'
    +'</Types>';
  const relsRoot='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    +'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    +'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
    +'</Relationships>';
  const relsDoc='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    +'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    +'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
    +'<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>'
    +'</Relationships>';
  return zipStore([
    {name:'[Content_Types].xml',data:enc.encode(contentTypes)},
    {name:'_rels/.rels',data:enc.encode(relsRoot)},
    {name:'word/_rels/document.xml.rels',data:enc.encode(relsDoc)},
    {name:'word/document.xml',data:enc.encode(docXml)},
    {name:'word/styles.xml',data:enc.encode(stylesXml)},
    {name:'word/numbering.xml',data:enc.encode(numberingXml)}
  ]);
}
/* DOCX-CORE-END */

/* HTML-DOM → Blockmodell */
function domInlineRuns(node,fl,out){
  fl=fl||{};out=out||[];
  for(const ch of node.childNodes){
    if(ch.nodeType===3){ // Text
      const t=ch.nodeValue.replace(/\s+/g,' ');
      if(t)out.push({text:t,b:fl.b,i:fl.i,u:fl.u,code:fl.code});
      continue;
    }
    if(ch.nodeType!==1)continue;
    const tg=ch.tagName;
    if(tg==='BR'){out.push({br:true});continue;}
    if(tg==='UL'||tg==='OL'||tg==='TABLE'||tg==='PRE')continue; // Blöcke: macht domToBlocks
    const nf={b:fl.b||tg==='B'||tg==='STRONG',
      i:fl.i||tg==='I'||tg==='EM',
      u:fl.u||tg==='U'||tg==='A',
      code:fl.code||tg==='CODE'};
    domInlineRuns(ch,nf,out);
  }
  return out;
}
function domToBlocks(root,out,listCtx){
  out=out||[];
  for(const ch of root.childNodes){
    if(ch.nodeType===3){
      const t=ch.nodeValue.trim();
      if(t)out.push({t:'p',runs:[{text:ch.nodeValue.replace(/\s+/g,' ')}]});
      continue;
    }
    if(ch.nodeType!==1)continue;
    const tg=ch.tagName;
    if(/^H[1-6]$/.test(tg)){
      out.push({t:'p',style:'Heading'+tg[1],runs:domInlineRuns(ch)});
    }else if(tg==='P'){
      const runs=domInlineRuns(ch);
      if(runs.length)out.push({t:'p',runs,style:listCtx&&listCtx.quote?'Quote':undefined});
    }else if(tg==='UL'||tg==='OL'){
      const type=tg==='OL'?'num':'bullet';
      const lvl=listCtx&&listCtx.lvl!==undefined?listCtx.lvl+1:0;
      for(const li of ch.children){
        if(li.tagName!=='LI')continue;
        const runs=domInlineRuns(li);
        if(runs.length)out.push({t:'p',runs,list:{type,lvl}});
        for(const sub of li.children)
          if(sub.tagName==='UL'||sub.tagName==='OL'||sub.tagName==='TABLE'||sub.tagName==='PRE')
            domToBlocks({childNodes:[sub]},out,{lvl});
      }
    }else if(tg==='PRE'){
      out.push({t:'code',lines:ch.textContent.replace(/\n$/,'').split('\n')});
    }else if(tg==='TABLE'){
      const rows=[];
      for(const tr of ch.querySelectorAll('tr')){
        const row=[];
        for(const td of tr.children){
          if(td.tagName!=='TD'&&td.tagName!=='TH')continue;
          const runs=domInlineRuns(td);
          if(td.tagName==='TH')for(const r of runs)r.b=true;
          row.push(runs.length?runs:[{text:''}]);
        }
        if(row.length)rows.push(row);
      }
      if(rows.length)out.push({t:'table',rows});
    }else if(tg==='BLOCKQUOTE'){
      const before=out.length;
      domToBlocks(ch,out,{quote:true});
      for(let i=before;i<out.length;i++)if(out[i].t==='p'&&!out[i].style)out[i].style='Quote';
    }else if(tg==='HR'){
      out.push({t:'p',runs:[]});
    }else if(tg==='SCRIPT'||tg==='STYLE'){
      // überspringen
    }else{
      // Container (div/section/main/…) oder Inline-Wurzel
      const hasBlock=ch.querySelector&&ch.querySelector('h1,h2,h3,h4,h5,h6,p,ul,ol,pre,table,blockquote,div,section');
      if(hasBlock)domToBlocks(ch,out,listCtx);
      else{
        const runs=domInlineRuns(ch);
        if(runs.length)out.push({t:'p',runs,style:listCtx&&listCtx.quote?'Quote':undefined});
      }
    }
  }
  return out;
}
async function exportDocx(){
  if(!handle)return;
  let html;
  if(mode==='html') html=hCurrentText();
  else if(mode==='md'){ if(!mFlushPending())return; html=mExportHtml(); }
  else { if(typeof closeEditBox==='function') await closeEditBox(true); html=await pdfExtractHtml(); }
  busy('Erzeuge Word-Datei…');
  try{
    const doc=new DOMParser().parseFromString(html,'text/html');
    const blocks=domToBlocks(doc.body);
    if(!blocks.length)blocks.push({t:'p',runs:[{text:''}]});
    const bytes=docxFromBlocks(blocks);
    downloadBlob(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}),
      exportBaseName()+'.docx');
    flash('Word exportiert');
  } finally { busy(null); }
}
$('#btnExpDocx').addEventListener('click',()=>{ exportDocx().catch(err=>showError('Export fehlgeschlagen: '+(err&&err.message?err.message:err))); });

/* ---------- Suche (Strg+F / ⌘F) über alle Modi ---------- */
const findBar=$('#findbar'),findInput=$('#findInput'),findCountEl=$('#findCount');
let findMatches=[],findIdx=-1,findTimer=null;
function findIframe(){ return mode==='html'?hViewer:(mode==='md'?mViewer:null); }
function findEnsureStyle(doc){
  if(doc.getElementById('finFindStyle'))return;
  const st=doc.createElement('style');
  st.id='finFindStyle';
  st.textContent='::highlight(finfind){background:#fde047;color:#1e293b}'
    +'::highlight(finfindcur){background:#f97316;color:#fff}';
  (doc.head||doc.documentElement).appendChild(st);
}
function findClearMarks(){
  const fr=findIframe();
  if(fr&&fr.contentWindow&&fr.contentWindow.CSS&&fr.contentWindow.CSS.highlights){
    fr.contentWindow.CSS.highlights.delete('finfind');
    fr.contentWindow.CSS.highlights.delete('finfindcur');
  }
  if(model)for(const p of model.pages)for(const it of p.items)
    if(it.el)it.el.classList.remove('findhit','findcur');
}
function findReset(){ findClearMarks(); findMatches=[]; findIdx=-1; findCountEl.textContent=''; }
function findOpen(){ if(!handle)return; findBar.hidden=false; findInput.focus(); findInput.select(); if(findInput.value)findRun(); }
function findCloseBar(){ findBar.hidden=true; findReset(); }
function findRun(){
  findReset();
  const q=findInput.value;
  if(!q)return;
  const ql=findCase?q:q.toLowerCase();
  if(mode==='pdf'){
    if(!model)return;
    for(const p of model.pages)for(const it of p.items)
      if(typeof it.text==='string'&&(findCase?it.text:it.text.toLowerCase()).includes(ql))
        findMatches.push({item:it,page:p});
  }else{
    const fr=findIframe(),doc=fr&&fr.contentDocument;
    if(!doc||!doc.body)return;
    const w=doc.createTreeWalker(doc.body,NodeFilter.SHOW_TEXT,{acceptNode:n=>{
      const pe=n.parentElement;
      if(pe&&/^(SCRIPT|STYLE|NOSCRIPT)$/.test(pe.tagName))return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }});
    let node;
    while((node=w.nextNode())){
      const tl=findCase?node.nodeValue:node.nodeValue.toLowerCase();
      let i=0;
      while((i=tl.indexOf(ql,i))!==-1){
        const r=doc.createRange();
        r.setStart(node,i); r.setEnd(node,i+q.length);
        findMatches.push({range:r});
        i+=q.length;
      }
    }
    const win=fr.contentWindow;
    if(win.CSS&&win.CSS.highlights&&findMatches.length){
      findEnsureStyle(doc);
      win.CSS.highlights.set('finfind',new win.Highlight(...findMatches.map(m=>m.range)));
    }
  }
  if(findMatches.length)findStep(1);
  else findCountEl.textContent='0 Treffer';
}
function findStep(dir){
  if(!findMatches.length)return;
  const prev=findMatches[findIdx];
  if(prev&&prev.item&&prev.item.el)prev.item.el.classList.remove('findcur');
  findIdx=(findIdx+dir+findMatches.length)%findMatches.length;
  const m=findMatches[findIdx];
  if(m.range){
    const fr=findIframe(),win=fr.contentWindow;
    if(win.CSS&&win.CSS.highlights)win.CSS.highlights.set('finfindcur',new win.Highlight(m.range));
    if(typeof m.range.getBoundingClientRect==='function'){
      const rect=m.range.getBoundingClientRect();
      win.scrollTo({top:rect.top+win.scrollY-win.innerHeight/3});
    }
  }else{
    for(const x of findMatches)if(x.item.el)x.item.el.classList.add('findhit');
    if(m.item.el){ m.item.el.classList.add('findcur'); m.item.el.scrollIntoView({block:'center'}); }
    else if(m.page&&m.page.wrap)m.page.wrap.scrollIntoView({block:'start'});
  }
  findCountEl.textContent=(findIdx+1)+' / '+findMatches.length;
}
findInput.addEventListener('input',()=>{ clearTimeout(findTimer); findTimer=setTimeout(findRun,180); });
findInput.addEventListener('keydown',e=>{
  if(e.key==='Enter'){ e.preventDefault(); findMatches.length?findStep(e.shiftKey?-1:1):findRun(); }
  else if(e.key==='Escape'){ e.preventDefault(); findCloseBar(); }
});
$('#findNext').addEventListener('click',()=>findStep(1));
$('#findPrev').addEventListener('click',()=>findStep(-1));
$('#findClose').addEventListener('click',findCloseBar);
/* --- Ersetzen (nur HTML-Modus, byte-treu über das Run-Modell; v2.7) --- */
const replInput=$('#replInput'),findCaseBtn=$('#findCase');
let findCase=false;
findCaseBtn.addEventListener('click',()=>{
  findCase=!findCase;
  findCaseBtn.classList.toggle('on',findCase);
  findCaseBtn.title=findCase?'Groß-/Kleinschreibung wird beachtet':'Groß-/Kleinschreibung beachten';
  findRun();
});
function replAllInText(cur,q,rep){
  const hay=findCase?cur:cur.toLowerCase();
  const ndl=findCase?q:q.toLowerCase();
  let out='',pos=0,i=0,count=0;
  while((i=hay.indexOf(ndl,pos))!==-1){
    out+=cur.slice(pos,i)+rep;
    pos=i+ndl.length; count++;
  }
  out+=cur.slice(pos);
  return {out,count};
}
function hReplacePrep(){
  if(mode!=='html'){flash('Ersetzen gibt es nur im HTML-Modus');return null;}
  const q=findInput.value;
  if(!q){findInput.focus();return null;}
  hCommitAndFold();
  if(srcText!==hHist[hHistPos])hPushHist();   // offene Edits als eigenen Undo-Schritt sichern
  return q;
}
function hReplaceApply(){
  hFolding=true;
  try{ hFoldChanges(); }
  finally{ hFolding=false; }
  hPushHist();
  hBuildOutline();
  hUpdateStatus();
}
function hReplaceAll(){
  const q=hReplacePrep();
  if(q===null)return;
  const rep=replInput.value;
  let hits=0;
  for(const r of runs){
    if(r.ws||!r.node||!r.node.isConnected)continue;
    const cur=r.node.data;
    const res=replAllInText(cur,q,rep);
    if(res.count){ r.newDecoded=res.out; r.node.data=res.out; hits+=res.count; }
  }
  if(!hits){flash('Keine ersetzbaren Treffer');return;}
  hReplaceApply();
  findRun();
  flash(hits+' Stelle'+(hits===1?'':'n')+' ersetzt – '+KEY_SAVE+' schreibt in die Datei, '+(IS_MAC?'⌘Z':'Strg+Z')+' macht rückgängig');
}
function hReplaceOne(){
  if(mode!=='html'){flash('Ersetzen gibt es nur im HTML-Modus');return;}
  if(!findMatches.length||findIdx<0){findRun();return;}
  const m=findMatches[findIdx];
  if(!m.range)return;
  const node=m.range.startContainer,off=m.range.startOffset;
  const q=hReplacePrep();
  if(q===null)return;
  if(!node.isConnected){findRun();return;}   // Fold hat den Knoten ersetzt → Treffer neu aufbauen
  const run=nodeMap.get(node);
  if(!run){flash('Diese Textstelle ist nicht zuordenbar (gesperrt) – Treffer übersprungen');findStep(1);return;}
  const cur=node.data;
  const seg=cur.substr(off,q.length);
  if((findCase?seg:seg.toLowerCase())!==(findCase?q:q.toLowerCase())){findRun();return;}
  const rep=replInput.value;
  run.newDecoded=cur.slice(0,off)+rep+cur.slice(off+q.length);
  node.data=run.newDecoded;
  hReplaceApply();
  findRun();
  findSeekAfter(node,off+rep.length);
  flash('Ersetzt – '+KEY_SAVE+' schreibt in die Datei, '+(IS_MAC?'⌘Z':'Strg+Z')+' macht rückgängig');
}
function findSeekAfter(node,off){
  // Nach Einzel-Ersetzung zum nächsten Treffer hinter der ersetzten Stelle springen.
  if(!findMatches.length)return;
  for(let k=0;k<findMatches.length;k++){
    const r=findMatches[k].range;
    if(!r)continue;
    const c=r.startContainer;
    if(c===node){ if(r.startOffset>=off){ findIdx=k-1; findStep(1); return; } }
    else if(node.compareDocumentPosition&&(node.compareDocumentPosition(c)&4)){   // 4 = DOCUMENT_POSITION_FOLLOWING
      findIdx=k-1; findStep(1); return;
    }
  }
  findIdx=findMatches.length-1;   // hinter dem letzten Treffer → beim ersten weitermachen
  findStep(1);
}
$('#replAll').addEventListener('click',hReplaceAll);
$('#replOne').addEventListener('click',hReplaceOne);
replInput.addEventListener('keydown',e=>{
  if(e.key==='Enter'){ e.preventDefault(); hReplaceOne(); }
  else if(e.key==='Escape'){ e.preventDefault(); findCloseBar(); }
});
window.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&(e.key==='f'||e.key==='F')&&handle){ e.preventDefault(); findOpen(); }
});

/* ---------- Undo/Redo & Element-Löschen (Phase 2) ---------- */
const HIST_MAX=100;
let hBaseline='', hHist=[], hHistPos=0, hFolding=false;
let mdHist=[], mdHistPos=0;
let pdfHist=[], pdfHistPos=-1, pdfHistMuted=false;
let delBtn=null, delTarget=null;

/* --- HTML: Snapshot-Historie auf srcText-Ebene --- */
function hPushHist(){
  hHist.length=hHistPos+1;
  hHist.push(srcText);
  if(hHist.length>HIST_MAX)hHist.shift();
  hHistPos=hHist.length-1;
}
function hFoldChanges(){
  // Übernommene Run-Änderungen in srcText einarbeiten (byte-treues Splicing),
  // danach Runs neu scannen und gegen das unveränderte DOM ausrichten.
  const changed=changedRuns().sort((a,b)=>a.start-b.start);
  if(!changed.length)return;
  let out='',pos=0;
  for(const r of changed){ out+=srcText.slice(pos,r.start)+hEncodeRun(r); pos=r.end; }
  out+=srcText.slice(pos);
  srcText=out;
  runs=scanHTML(srcText); decodeRuns(runs); alignRuns(hViewer.contentDocument);
}
function hCommitAndFold(){
  hFolding=true;
  try{ if(editSpan)hEndEdit(true); hFoldChanges(); }
  finally{ hFolding=false; }
}
function hApplySnapshot(snap){
  srcText=snap;
  const sy=hViewer.contentWindow?hViewer.contentWindow.scrollY:0;
  hViewer.dataset.scrollY=String(sy||0);
  hViewer.srcdoc=window.prepareDocumentPreview?window.prepareDocumentPreview(snap):snap;
}
function hUndo(){
  if(hHistPos<=0){flash('Nichts rückgängig zu machen');return;}
  hHistPos--; hApplySnapshot(hHist[hHistPos]); flash('Rückgängig');
}
function hRedo(){
  if(hHistPos>=hHist.length-1){flash('Nichts zu wiederholen');return;}
  hHistPos++; hApplySnapshot(hHist[hHistPos]); flash('Wiederholen');
}

/* --- Markdown: Snapshot-Historie auf mdText-Ebene --- */
function mdPushHist(){
  mdHist.length=mdHistPos+1;
  mdHist.push(mdText);
  if(mdHist.length>HIST_MAX)mdHist.shift();
  mdHistPos=mdHist.length-1;
}
function mUndo(){
  if(mdHistPos<=0){flash('Nichts rückgängig zu machen');return;}
  mdHistPos--; mdText=mdHist[mdHistPos]; mRender(true); updateStatus(); flash('Rückgängig');
}
function mRedo(){
  if(mdHistPos>=mdHist.length-1){flash('Nichts zu wiederholen');return;}
  mdHistPos++; mdText=mdHist[mdHistPos]; mRender(true); updateStatus(); flash('Wiederholen');
}

/* --- PDF: Eintragshistorie, Wiederanwendung über den Edit-Pfad --- */
function pdfCapture(page,item,newText,fitTz){
  if(pdfHistMuted)return;
  const o=mapply(item.base,0,0);
  pdfHist.length=pdfHistPos+1;
  pdfHist.push({pi:page.index,x:o[0],y:o[1],prev:item.text,next:newText,tz:item.Tz,fitTz});
  if(pdfHist.length>HIST_MAX)pdfHist.shift();
  pdfHistPos=pdfHist.length-1;
}
function pdfFindItem(pi,x,y,text){
  const page=model&&model.pages[pi]; if(!page)return null;
  for(const it of page.items){
    const o=mapply(it.base,0,0);
    if(Math.abs(o[0]-x)<1&&Math.abs(o[1]-y)<1&&it.text===text)return {page,item:it};
  }
  return null;
}
async function pdfUndo(){
  if(pdfHistPos<0){flash('Nichts rückgängig zu machen');return;}
  const h=pdfHist[pdfHistPos];
  const f=pdfFindItem(h.pi,h.x,h.y,h.next);
  if(!f){flash('Rückgängig an dieser Stelle nicht mehr möglich');return;}
  pdfHistMuted=true;
  try{
    const r=await applyEdit(f.page,f.item,h.prev,h.tz);
    if(r.missing){showError('Zeichen nicht verfügbar: '+r.missing.join(' '));return;}
  } finally { pdfHistMuted=false; }
  pdfHistPos--; flash('Rückgängig'); updateDocNotice();
}
async function pdfRedo(){
  if(pdfHistPos>=pdfHist.length-1){flash('Nichts zu wiederholen');return;}
  const h=pdfHist[pdfHistPos+1];
  const f=pdfFindItem(h.pi,h.x,h.y,h.prev);
  if(!f){flash('Wiederholen an dieser Stelle nicht möglich');return;}
  pdfHistMuted=true;
  try{
    const r=await applyEdit(f.page,f.item,h.next,h.fitTz);
    if(r.missing){showError('Zeichen nicht verfügbar: '+r.missing.join(' '));return;}
  } finally { pdfHistMuted=false; }
  pdfHistPos++; flash('Wiederholen'); updateDocNotice();
}

/* --- Tastatur: Strg/Cmd+Z bzw. +Shift+Z / +Y --- */
function doUndo(){ if(mode==='html')hUndo(); else if(mode==='md')mUndo(); else pdfUndo().catch(err=>showError('Rückgängig fehlgeschlagen: '+(err&&err.message?err.message:err))); }
function doRedo(){ if(mode==='html')hRedo(); else if(mode==='md')mRedo(); else pdfRedo().catch(err=>showError('Wiederholen fehlgeschlagen: '+(err&&err.message?err.message:err))); }
function undoKeyHandler(e){
  if(!handle)return false;
  if(!(e.ctrlKey||e.metaKey))return false;
  if(editSpan||mEdit||mIns||editState)return false;        // natives Undo im aktiven Editierfeld
  if(document.activeElement===findInput)return false;
  const k=(e.key||'').toLowerCase();
  if(k==='z'&&!e.shiftKey){e.preventDefault();doUndo();return true;}
  if((k==='z'&&e.shiftKey)||k==='y'){e.preventDefault();doRedo();return true;}
  return false;
}
window.addEventListener('keydown',undoKeyHandler);

/* --- HTML: Elemente löschen (Absatz, Listenpunkt, Zeile …) --- */
let delExpanded=false,delHighlighted=null,delPrevOutline='',delPrevOffset='';
function delUnhighlight(){
  if(delHighlighted){
    try{ delHighlighted.style.outline=delPrevOutline; delHighlighted.style.outlineOffset=delPrevOffset; }catch(_){}
    delHighlighted=null;
  }
}
function delHighlight(el){
  delUnhighlight();
  if(!el)return;
  delHighlighted=el;
  delPrevOutline=el.style.outline; delPrevOffset=el.style.outlineOffset;
  el.style.outline='2px dashed rgba(220,38,38,.85)';
  el.style.outlineOffset='2px';
}
function delDescribe(el){
  const tag=el.tagName.toLowerCase();
  const names={li:'Listenpunkt',p:'Absatz',tr:'Tabellenzeile',blockquote:'Zitatblock',
    ul:'Liste',ol:'Nummerierte Liste',table:'Tabelle',text:'SVG-Text',g:'SVG-Gruppe'};
  if(names[tag])return names[tag];
  if(/^h[1-6]$/.test(tag))return 'Überschrift '+tag.toUpperCase();
  const cls=el.classList&&el.classList.length?'.'+el.classList[0]:'';
  return 'Block ('+tag+cls+')';
}
function hTagEnd(src,from){
  let i=from,q=null;
  while(i<src.length){
    const c=src[i];
    if(q){ if(c===q)q=null; }
    else if(c==='"'||c==="'")q=c;
    else if(c==='>')return i;
    i++;
  }
  return -1;
}
const H_VOID_OCC=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
const H_RAWTEXT_OCC='script|style|textarea|title|xmp|iframe|noembed|noframes';
function scanElementOcc(src,tag){
  // Alle wohlgeformten <tag>-Elemente als {start,end} in Dokumentordnung.
  // null = nicht eindeutig (ungeschlossene Tags, kaputte Kommentare …) → Löschen sperren.
  // v2.7: Wie in scanHTML werden Raw-Text-Inhalte (script/style/title/…) und <template>-
  // Inhalte übersprungen – deren Innenleben existiert im DOM nicht als reguläre Elemente.
  // Void-Elemente (img/hr/br …) haben kein Schließ-Tag: jedes Start-Tag ist ein Vorkommen.
  const isVoid=H_VOID_OCC.has(tag);
  const occ=[],stack=[];
  const re=new RegExp('<!--|<(\\/?)('+tag+')(?=[\\s\\/>])|<(\\/?)(template)(?=[\\s\\/>])|<('+H_RAWTEXT_OCC+')(?=[\\s>])','gi');
  let m;
  while((m=re.exec(src))!==null){
    if(m[0]==='<!--'){
      const e=src.indexOf('-->',re.lastIndex);
      if(e<0)return null;
      re.lastIndex=e+3; continue;
    }
    if(m[5]){
      const cr=new RegExp('<\\/'+m[5]+'(?=[\\s\\/>])','gi');
      cr.lastIndex=re.lastIndex;
      const c=cr.exec(src);
      if(!c)return null;
      const ge=hTagEnd(src,c.index+1);
      if(ge<0)return null;
      re.lastIndex=ge+1; continue;
    }
    if(m[4]){
      // <template>-Inhalt überspringen (inkl. Verschachtelung und Raw-Text darin);
      // nur erreichbar, wenn tag!=='template' – sonst greift die tag-Alternative zuerst.
      if(m[3])return null;
      const ge0=hTagEnd(src,m.index+1);
      if(ge0<0)return null;
      if(src[ge0-1]==='/'){ re.lastIndex=ge0+1; continue; }
      let depth=1;
      const tre=new RegExp('<!--|<(\\/?)template(?=[\\s\\/>])|<('+H_RAWTEXT_OCC+')(?=[\\s>])','gi');
      tre.lastIndex=ge0+1;
      let tm;
      while(depth>0&&(tm=tre.exec(src))!==null){
        if(tm[0]==='<!--'){
          const e=src.indexOf('-->',tre.lastIndex);
          if(e<0)return null;
          tre.lastIndex=e+3; continue;
        }
        if(tm[2]){
          const cr=new RegExp('<\\/'+tm[2]+'(?=[\\s\\/>])','gi');
          cr.lastIndex=tre.lastIndex;
          const c=cr.exec(src);
          if(!c)return null;
          const ge=hTagEnd(src,c.index+1);
          if(ge<0)return null;
          tre.lastIndex=ge+1; continue;
        }
        const ge=hTagEnd(src,tm.index+1);
        if(ge<0)return null;
        if(tm[1])depth--; else if(src[ge-1]!=='/')depth++;
        tre.lastIndex=ge+1;
      }
      if(depth>0)return null;
      re.lastIndex=tre.lastIndex;
      continue;
    }
    const ge=hTagEnd(src,m.index+1);
    if(ge<0)return null;
    if(m[1]){
      if(isVoid)return null;   // z. B. </img>: Browser-Verhalten uneinheitlich → konservativ sperren
      if(!stack.length)return null;
      const st=stack.pop();
      if(tag!=='template'||stack.length===0)occ.push({start:st,end:ge+1});
    }else{
      if(isVoid)occ.push({start:m.index,end:ge+1});
      else if(src[ge-1]==='/')occ.push({start:m.index,end:ge+1});
      else stack.push(m.index);
    }
    re.lastIndex=ge+1;
  }
  if(stack.length)return null;
  occ.sort((a,b)=>a.start-b.start);
  return occ;
}
function extendLineRange(src,s,e){
  // Steht das Element allein auf seiner Zeile/seinen Zeilen, Einrückung und
  // Zeilenumbruch mitnehmen, damit keine Leerzeile zurückbleibt.
  let ls=s;
  while(ls>0&&(src[ls-1]===' '||src[ls-1]==='\t'))ls--;
  const atLineStart=ls===0||src[ls-1]==='\n';
  let ee=e;
  while(ee<src.length&&(src[ee]===' '||src[ee]==='\t'))ee++;
  let nl=0;
  if(src[ee]==='\r'&&src[ee+1]==='\n')nl=2; else if(src[ee]==='\n')nl=1;
  if(atLineStart&&nl)return {start:ls,end:ee+nl};
  return {start:s,end:e};
}
function hSourceRangeOf(el){
  const tag=el.tagName.toLowerCase();
  const doc=el.ownerDocument;
  // injizierte Editor-UI (Hover-Box, Lösch-Knopf) aus dem Zählabgleich ausnehmen
  const domList=Array.from(doc.getElementsByTagName(tag)).filter(x=>!(x.closest&&x.closest('[data-voxui]')));
  const idx=domList.indexOf(el);
  if(idx<0)return null;
  const occ=scanElementOcc(srcText,tag);
  if(!occ||occ.length!==domList.length)return null;   // Zählabgleich DOM ↔ Quelle
  const {start,end}=occ[idx];
  return extendLineRange(srcText,start,end);
}
function hDeleteElement(el){
  const rg=hSourceRangeOf(el);
  if(!rg){
    showError('Dieses Element lässt sich nicht sicher der Quelldatei zuordnen (z. B. ungeschlossene oder implizite Tags) – Löschen hier gesperrt.');
    return false;
  }
  srcText=srcText.slice(0,rg.start)+srcText.slice(rg.end);
  el.remove();
  runs=scanHTML(srcText); decodeRuns(runs); alignRuns(hViewer.contentDocument);
  hideError();
  return true;
}
function hDeleteFlow(el){
  if(mode!=='html'||!el)return;
  delUnhighlight();
  hCommitAndFold();
  if(srcText!==hHist[hHistPos])hPushHist();   // offene Edits als eigenen Undo-Schritt sichern
  const tag=el.tagName.toLowerCase();
  const label=delDescribe(el);
  const prev=(el.textContent||'').trim().replace(/\s+/g,' ').slice(0,90);
  if(!confirm(label+' löschen?'+(prev?'\n\n„'+prev+'“':'\n\n(Element ohne Textinhalt)')))return;
  let parentList=null,parentTable=null;
  if(tag==='li'){
    const pl=el.parentElement;
    if(pl&&(pl.tagName==='UL'||pl.tagName==='OL')&&pl.children.length===1)parentList=pl;
  }
  if(tag==='tr'){
    const tb=el.closest&&el.closest('table');
    if(tb&&tb.querySelectorAll('tr').length===1)parentTable=tb;
  }
  if(!hDeleteElement(el))return;
  if(parentList&&confirm('Die Liste ist jetzt leer – leere Liste ebenfalls entfernen?'))
    hDeleteElement(parentList);
  if(parentTable&&confirm('Die Tabelle ist jetzt leer – leere Tabelle ebenfalls entfernen?'))
    hDeleteElement(parentTable);
  hideDelBtn();
  hPushHist();
  hBuildOutline();
  hUpdateStatus();
  if(!findBar.hidden&&findInput.value)findRun();
  flash('Gelöscht – '+KEY_SAVE+' schreibt in die Datei, '+(IS_MAC?'⌘Z':'Strg+Z')+' macht rückgängig');
}
function hideDelBtn(){
  if(delBtn)delBtn.style.display='none';
  delTarget=null; delExpanded=false;
  delUnhighlight();
}

/* ---------- PDF-Seitenoperationen (Phase 3): drehen / löschen / umsortieren ----------
   Alle Operationen bleiben im Incremental-Update-Modell: die Originalbytes werden
   nie umgeschrieben, geänderte Objekte (Page-Dict bzw. flacher Pages-Node) werden
   angehängt. Verschachtelte Seitenbäume: nur Drehen; Löschen/Umsortieren gesperrt. */
let pdfBaseDirty=false;   // Arbeitsstand enthält Struktur-Änderungen, die noch nicht auf der Platte sind
function serializePdfObj(node){
  const n=node.sizeInBytes();
  const buf=new Uint8Array(n);
  node.copyBytesInto(buf,0);
  return buf;
}
function appendDictIncrement(base,objs,meta){
  const parts=[]; let off=base.length;
  parts.push(base);
  const push=x=>{const b=typeof x==='string'?ENC.encode(x):x;parts.push(b);off+=b.length;};
  push('\n');
  const list=[...objs].sort((a,b)=>a.num-b.num);
  const offsets=new Map();
  for(const ob of list){
    offsets.set(ob.num,off);
    push(ob.num+' '+ob.gen+' obj\n');
    push(ob.bytes);
    push('\nendobj\n');
  }
  const xrefOff=off;
  const idPart=meta.idFirstSrc?' /ID [ '+meta.idFirstSrc+' '+randomIdHex()+' ]':'';
  const infoPart=meta.infoSrc?' /Info '+meta.infoSrc:'';
  let newSize=meta.size;
  if(!meta.isXS){
    let x='xref\n';
    for(const ob of list)
      x+=ob.num+' 1\n'+String(offsets.get(ob.num)).padStart(10,'0')+' '+String(ob.gen).padStart(5,'0')+' n \n';
    x+='trailer\n<< /Size '+meta.size+' /Root '+meta.rootSrc+infoPart+idPart+' /Prev '+meta.prev+' >>\nstartxref\n'+xrefOff+'\n%%EOF\n';
    push(x);
  } else {
    const xnum=meta.size; newSize=meta.size+1;
    const entries=list.map(ob=>({n:ob.num,o:offsets.get(ob.num),g:ob.gen}));
    entries.push({n:xnum,o:xrefOff,g:0});
    entries.sort((a,b)=>a.n-b.n);
    const rows=new Uint8Array(entries.length*7);
    entries.forEach((e,i)=>{ rows[i*7]=1;
      rows[i*7+1]=(e.o>>>24)&255;rows[i*7+2]=(e.o>>>16)&255;rows[i*7+3]=(e.o>>>8)&255;rows[i*7+4]=e.o&255;
      rows[i*7+5]=(e.g>>8)&255;rows[i*7+6]=e.g&255; });
    const index=entries.map(e=>e.n+' 1').join(' ');
    push(xnum+' 0 obj\n<< /Type /XRef /Size '+(xnum+1)+' /Index [ '+index+' ] /W [ 1 4 2 ] /Root '
      +meta.rootSrc+infoPart+idPart+' /Prev '+meta.prev+' /Length '+rows.length+' >>\nstream\n');
    push(rows);
    push('\nendstream\nendobj\nstartxref\n'+xrefOff+'\n%%EOF\n');
  }
  const total=new Uint8Array(off);
  let o2=0; for(const p of parts){ total.set(p,o2); o2+=p.length; }
  return {bytes:total,newStartxref:xrefOff,newSize};
}
function pdfFlatPages(doc2){
  // Flacher Seitenbaum: Root-Pages-Node, dessen Kids alle direkt /Page sind.
  try{
    const PN=PDFLib.PDFName;
    const pagesRef=doc2.catalog.get(PN.of('Pages'));
    const node=doc2.context.lookup(pagesRef);
    if(!node||typeof node.get!=='function')return null;
    const kids=node.get(PN.of('Kids'));
    if(!kids||typeof kids.get!=='function'||typeof kids.size!=='function'
      ||typeof kids.set!=='function'||typeof kids.remove!=='function')return null;
    for(let i=0;i<kids.size();i++){
      const kn=doc2.context.lookup(kids.get(i));
      const t=kn&&typeof kn.get==='function'?kn.get(PN.of('Type')):null;
      if(t!==PN.of('Page'))return null;
    }
    return {ref:pagesRef,node,kids};
  }catch(_){ return null; }
}
const PDF_TREE_MSG='Diese PDF hat einen verschachtelten oder ungewöhnlichen Seitenbaum – Löschen/Umsortieren wird hier nicht unterstützt (Drehen funktioniert).';
async function pdfApplyPageOp(mutator,okMsg){
  if(!handle||mode!=='pdf'||!model)return false;
  if(typeof closeEditBox==='function')await closeEditBox(true);
  busy('Wende Seitenoperation an…');
  try{
    // 1) Offene Textänderungen als Increment einfrieren
    const mods=collectMods();
    let base=fileBytes;
    const meta={size:model.size,prev:model.prev,isXS:model.isXS,
      rootSrc:model.rootSrc,infoSrc:model.infoSrc,idFirstSrc:model.idFirstSrc};
    if(mods.size){
      const inc=await buildIncrement(fileBytes,mods,model);
      base=inc.bytes; meta.prev=inc.newStartxref; meta.size=inc.newSize;
    }
    // 2) Frische Strukturansicht und Mutation
    let doc2;
    try{ doc2=await PDFLib.PDFDocument.load(base,{updateMetadata:false,throwOnInvalidObject:false}); }
    catch(e){ showError('Seitenoperation fehlgeschlagen: '+(e&&e.message?e.message:e)); return false; }
    const objs=mutator(doc2);
    if(!objs)return false;
    // 3) Increment anhängen und Arbeitsstand neu laden
    const inc2=appendDictIncrement(base,objs,meta);
    const keepScroll=scroller.scrollTop;
    await loadPdfBytes(handle,inc2.bytes);
    pdfBaseDirty=true;
    scroller.scrollTop=keepScroll;
    updateStatus();
    hideError();
    if(okMsg)flash(okMsg+' – '+KEY_SAVE+' schreibt in die Datei');
    return true;
  } finally { busy(null); }
}
function pdfRotatePage(i){
  pdfApplyPageOp(doc2=>{
    const p=doc2.getPages()[i];
    if(!p)return null;
    let cur=0;
    try{ cur=(p.getRotation&&p.getRotation().angle)||0; }catch(_){}
    p.setRotation(PDFLib.degrees(((cur+90)%360+360)%360));
    return [{num:p.ref.objectNumber,gen:p.ref.generationNumber,bytes:serializePdfObj(p.node)}];
  },'Seite gedreht').catch(err=>showError('Drehen fehlgeschlagen: '+(err&&err.message?err.message:err)));
}
function pdfDeletePage(i){
  if(!model)return;
  if(model.pages.length<=1){ showError('Die letzte Seite kann nicht gelöscht werden.'); return; }
  if(!confirm('Seite '+(i+1)+' aus dem Dokument löschen?'))return;
  pdfApplyPageOp(doc2=>{
    const fp=pdfFlatPages(doc2);
    if(!fp){ showError(PDF_TREE_MSG); return null; }
    if(fp.kids.size()!==model.pages.length){ showError(PDF_TREE_MSG); return null; }
    fp.kids.remove(i);
    fp.node.set(PDFLib.PDFName.of('Count'),PDFLib.PDFNumber.of(fp.kids.size()));
    return [{num:fp.ref.objectNumber,gen:fp.ref.generationNumber,bytes:serializePdfObj(fp.node)}];
  },'Seite gelöscht').catch(err=>showError('Löschen fehlgeschlagen: '+(err&&err.message?err.message:err)));
}
function pdfMovePage(i,dir){
  if(!model)return;
  const j=i+dir;
  if(j<0||j>=model.pages.length){ flash(dir<0?'Schon die erste Seite':'Schon die letzte Seite'); return; }
  pdfApplyPageOp(doc2=>{
    const fp=pdfFlatPages(doc2);
    if(!fp){ showError(PDF_TREE_MSG); return null; }
    if(fp.kids.size()!==model.pages.length){ showError(PDF_TREE_MSG); return null; }
    const a=fp.kids.get(i),b=fp.kids.get(j);
    fp.kids.set(i,b); fp.kids.set(j,a);
    return [{num:fp.ref.objectNumber,gen:fp.ref.generationNumber,bytes:serializePdfObj(fp.node)}];
  },'Seite verschoben').catch(err=>showError('Verschieben fehlgeschlagen: '+(err&&err.message?err.message:err)));
}

/* ---------- pdf.js-Anzeige ---------- */
async function setPreviewDoc(bytes){
  const data=bytes.slice();          // pdf.js transferiert den Buffer
  const task=pdfjsLib.getDocument({data,isEvalSupported:false});
  const doc=await task.promise;
  if(pdfDoc){ try{ pdfDoc.destroy(); }catch(_){}}
  pdfDoc=doc;
}

'use strict';
/* ================= Anzeige, Overlay, Editierfeld ================= */

const RO_MSG={
  font:'Gesperrt: Schrift ohne verwertbare Text-Zuordnung (kein ToUnicode/Encoding).',
  decode:'Gesperrt: Zeichencodes dieser Stelle sind nicht eindeutig zuordenbar.',
  spacing:'Gesperrt: Vom Erzeuger gesetztes Sonder-Spacing würde beim Neusetzen zerstört.',
  type3:'Gesperrt: Type3-Schrift wird nicht unterstützt.',
  vertical:'Gesperrt: Vertikaler Textmodus wird nicht unterstützt.',
  cmap:'Gesperrt: Nicht unterstützte CMap-Kodierung.',
  shared:'Gesperrt: Dieser Seiteninhalt wird von mehreren Seiten gemeinsam genutzt.'
};

async function initialRender(){
  pagesEl.innerHTML='';
  for(const p of model.pages){
    p.wrap=document.createElement('div'); p.wrap.className='pageWrap';
    p.canvas=document.createElement('canvas');
    p.overlay=document.createElement('div'); p.overlay.className='overlay';
    p.wrap.appendChild(p.canvas); p.wrap.appendChild(p.overlay);
    (function(idx){
      const ctl=document.createElement('div'); ctl.className='pageCtl';
      const mk=(txt,title,fn,cls)=>{
        const b=document.createElement('button');
        b.type='button'; b.textContent=txt; b.title=title; if(cls)b.className=cls;
        b.addEventListener('click',ev=>{ ev.stopPropagation(); fn(); });
        ctl.appendChild(b);
      };
      mk('⟳','Seite um 90° drehen',()=>pdfRotatePage(idx));
      mk('↑','Seite nach vorn verschieben',()=>pdfMovePage(idx,-1));
      mk('↓','Seite nach hinten verschieben',()=>pdfMovePage(idx,1));
      mk('✕','Seite löschen',()=>pdfDeletePage(idx),'danger');
      p.wrap.appendChild(ctl);
    })(p.index);
    pagesEl.appendChild(p.wrap);
  }
  await fitZoom(false);
  for(const p of model.pages){
    busy('Rendere Seite '+(p.index+1)+' / '+model.pages.length+'…');
    await rerenderPage(p);
  }
  busy(null);
  updateDocNotice();
}

async function rerenderPage(page){
  const pdfPage=await pdfDoc.getPage(page.index+1);
  const vp=pdfPage.getViewport({scale:zoom});
  page.viewport=vp;
  const dpr=window.devicePixelRatio||1;
  page.canvas.width=Math.round(vp.width*dpr);
  page.canvas.height=Math.round(vp.height*dpr);
  page.canvas.style.width=Math.round(vp.width)+'px';
  page.canvas.style.height=Math.round(vp.height)+'px';
  const ctx2d=page.canvas.getContext('2d');
  ctx2d.setTransform(dpr,0,0,dpr,0,0);
  await pdfPage.render({canvasContext:ctx2d,viewport:vp}).promise;
  if(page.shared){ page.items=[]; }
  else page.items=page.parseFail?[]:parsePageItems(page);
  if(page.shared) for(const it of page.items){ it.editable=false; it.ro='shared'; }
  buildOverlay(page);
}

function itemDeviceBox(page,item){
  const vp=page.viewport;
  const pts=[[0,item.desc*item.size],[item.adv,item.desc*item.size],
             [item.adv,item.asc*item.size],[0,item.asc*item.size]]
    .map(([x,y])=>{ const u=mapply(item.base,x,y); return vp.convertToViewportPoint(u[0],u[1]); });
  const xs=pts.map(p=>p[0]), ys=pts.map(p=>p[1]);
  return {x:Math.min(...xs),y:Math.min(...ys),
          w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};
}
function itemBaselinePts(page,item){ // Start-/Endpunkt der Basislinie in Gerätekoordinaten
  const vp=page.viewport;
  const a=mapply(item.base,0,0), b=mapply(item.base,item.adv,0);
  return [vp.convertToViewportPoint(a[0],a[1]), vp.convertToViewportPoint(b[0],b[1])];
}

function buildOverlay(page){
  page.overlay.innerHTML='';
  const notes=[];
  if(page.parseFail) notes.push('Diese Seite konnte nicht analysiert werden – Bearbeitung deaktiviert.');
  else if(page.items.length===0) notes.push('Kein bearbeitbarer Text auf dieser Seite gefunden – vermutlich gescannt/bildbasiert oder Text in Sonderobjekten.');
  if(page.shared) notes.push('Seiteninhalt wird mehrfach verwendet – Bearbeitung hier deaktiviert.');
  if(page.formText) notes.push('Hinweis: Teile des Textes (z. B. Kopf-/Fußzeilen) liegen in wiederverwendeten Objekten und sind nicht anklickbar.');
  if(notes.length){
    const n=document.createElement('div'); n.className='pageNote'; n.textContent=notes.join(' ');
    page.overlay.appendChild(n);
  }
  for(const item of page.items){
    if(item.text===null&&!item.ro) continue;
    const box=itemDeviceBox(page,item);
    if(!isFinite(box.x)||box.w<=0) continue;
    const d=document.createElement('div');
    d.className='titem'+(item.editable?'':' ro');
    item.el=d;
    d.style.left=(box.x-1)+'px'; d.style.top=(box.y-1)+'px';
    d.style.width=Math.max(box.w+2,4)+'px'; d.style.height=Math.max(box.h+2,4)+'px';
    if(!item.editable) d.title=RO_MSG[item.ro]||'Gesperrt';
    const o=mapply(item.base,0,0);
    if(page.editedMarks.some(mk=>Math.abs(mk.x-o[0])<1&&Math.abs(mk.y-o[1])<1)) d.classList.add('edited');
    if(item.editable) d.addEventListener('mousedown',ev=>{ ev.preventDefault(); startEdit(page,item); });
    page.overlay.appendChild(d);
  }
}

function updateDocNotice(){
  let total=0, locked=0; const reasons=new Set();
  for(const p of model.pages)for(const it of p.items){ total++; if(!it.editable){locked++;reasons.add(it.ro);} }
  if(!total){ setNotice('In diesem PDF wurde kein bearbeitbarer Text gefunden (vermutlich gescannt/bildbasiert).'); return; }
  if(locked) setNotice(locked+' von '+total+' Textstellen sind gesperrt (Grund per Tooltip an der Stelle). Alle übrigen sind per Klick editierbar.');
  else setNotice(null);
}

/* ---------- Editierfeld ---------- */
let editState=null; // {page,item,input,errEl}

function deviceFontPx(page,item){
  const vp=page.viewport;
  const a=mapply(item.base,0,0), b=mapply(item.base,0,item.size);
  const pa=vp.convertToViewportPoint(a[0],a[1]), pb=vp.convertToViewportPoint(b[0],b[1]);
  return Math.max(7,Math.hypot(pb[0]-pa[0],pb[1]-pa[1]));
}

async function startEdit(page,item){
  await closeEditBox(true);
  if(editState)return;
  const box=itemDeviceBox(page,item);
  const input=document.createElement('input');
  input.type='text'; input.id='editBox'; input.value=item.text;
  input.spellcheck=false;
  const fs=deviceFontPx(page,item);
  const c=page.fonts.get(item.fontRes);
  input.style.font=(c&&c.cssFont.ital?'italic ':'')+(c&&c.cssFont.bold?'700 ':'400 ')
    +(fs*0.92)+'px '+(c?c.cssFont.fam:'sans-serif');
  input.style.left=(box.x-3)+'px';
  input.style.top=(box.y-3)+'px';
  input.style.width=Math.max(box.w+60,90)+'px';
  input.style.height=(box.h+6)+'px';
  page.overlay.appendChild(input);
  editState={page,item,input,errEl:null};
  input.focus();
  input.setSelectionRange(input.value.length,input.value.length);
  input.addEventListener('keydown',ev=>{
    if(ev.key==='Enter'){ ev.preventDefault(); closeEditBox(true); }
    else if(ev.key==='Escape'){ ev.preventDefault(); closeEditBox(false); }
    ev.stopPropagation();
  });
  input.addEventListener('blur',()=>{ if(editState&&!editState.errEl) closeEditBox(true); });
}

function showEditErr(html,buttons){
  const es=editState; if(!es)return;
  if(es.errEl)es.errEl.remove();
  const e=document.createElement('div'); e.id='editErr';
  e.style.left=es.input.style.left;
  e.style.top=(parseFloat(es.input.style.top)+parseFloat(es.input.style.height)+6)+'px';
  e.innerHTML=html+'<br>';
  for(const b of buttons){
    const bt=document.createElement('button');
    bt.textContent=b.label; if(b.primary)bt.className='primary';
    bt.addEventListener('mousedown',ev=>{ev.preventDefault();ev.stopPropagation();});
    bt.addEventListener('click',ev=>{ev.stopPropagation();b.fn();});
    e.appendChild(bt);
  }
  es.errEl=e; es.page.overlay.appendChild(e);
}
function clearEditErr(){ if(editState&&editState.errEl){editState.errEl.remove();editState.errEl=null;} }
/* Editierfeld abbauen. editState VOR input.remove() nullen, sonst löst der
   dabei gefeuerte blur-Handler eine erneute closeEditBox-Runde aus. */
function teardownEdit(){ if(!editState)return; const inp=editState.input; clearEditErr(); editState=null; if(inp)inp.remove(); }

function widthCheck(page,item,newAdv){
  // Verfügbarer Platz: bis zur nächsten Textstelle auf gleicher Zeile,
  // bis zum nächsten Tabellen-/Zellrahmen (dünne re-Füllung) oder Seitenrand.
  const vp=page.viewport;
  const [s0,e0]=itemBaselinePts(page,item);
  const fs=deviceFontPx(page,item);
  const devPerText=Math.hypot(e0[0]-s0[0],e0[1]-s0[1])/(item.adv||1e-6);
  const newDevW=newAdv*devPerText;
  let limit=vp.width-8-s0[0];
  for(const other of page.items){
    if(other===item)continue;
    const [os]=itemBaselinePts(page,other);
    if(Math.abs(os[1]-e0[1])<fs*0.55&&os[0]>e0[0]-1){
      limit=Math.min(limit,os[0]-s0[0]-1);
    }
  }
  if(page.barriers){
    for(const b of page.barriers){
      const p0=vp.convertToViewportPoint(b.x,b.y0), p1=vp.convertToViewportPoint(b.x,b.y1);
      const bx=(p0[0]+p1[0])/2;
      const ylo=Math.min(p0[1],p1[1])-2, yhi=Math.max(p0[1],p1[1])+2;
      if(s0[1]>=ylo&&s0[1]<=yhi&&bx>s0[0]+1) limit=Math.min(limit,bx-s0[0]-1.5);
    }
  }
  const oldDevW=item.adv*devPerText;
  const limitDev=Math.max(limit,oldDevW+0.5);
  return {ok:newDevW<=limitDev+0.75, newDevW, oldDevW, limitDev};
}

async function closeEditBox(apply){
  const es=editState; if(!es)return;
  const {page,item,input}=es;
  const newText=input.value;
  if(!apply||newText===item.text){ teardownEdit(); return; }
  const font=page.fonts.get(item.fontRes);
  const enc=encodeTextToCodes(font,newText);
  if(enc.missing.length){
    showEditErr('Diese Zeichen sind in der eingebetteten Schrift („'+escHtml(font.baseFont||item.fontRes)
      +'“) nicht verfügbar: <b>'+escHtml(enc.missing.map(x=>x===' '?'Leerzeichen':x).join(' '))
      +'</b><br>PDF-Subset-Schriften enthalten nur die im Dokument benutzten Zeichen. Bitte Formulierung anpassen.',
      [{label:'Weiter bearbeiten',primary:true,fn:()=>{clearEditErr();input.focus();}},
       {label:'Verwerfen',fn:()=>{teardownEdit();}}]);
    return;
  }
  item.pendingText=newText;
  const rep=buildReplacement(item,font);
  const wc=widthCheck(page,item,rep.newAdv);
  const approxNote=font.approxWidths?'<br>Hinweis: Breitenprüfung näherungsweise (Schrift ohne eingebettete Metriken).':'';
  if(!wc.ok){
    // Statt zu überlappen: Text einpassen (Laufweite reduzieren), gleiche
    // Schrift/Größe/Position. Kleine Überbreiten automatisch, größere per
    // Rückfrage, absurde Überlängen mit klarer Absage.
    let fitScale=(wc.limitDev-0.75)/wc.newDevW;
    if(font.approxWidths) fitScale*=0.985;   // Sicherheitsmarge bei Näherungsmetriken
    const squeezePct=Math.max(1,Math.round((1-fitScale)*100));
    const fitTz=Math.max(1,item.Tz*fitScale);
    if(fitScale>=0.88){
      teardownEdit();
      const r=await applyEdit(page,item,newText,fitTz);
      if(r.missing) showError('Zeichen nicht verfügbar: '+r.missing.join(' '));
      else flash('Eingepasst: Laufweite −'+squeezePct+' %');
      updateDocNotice();
      return;
    }
    if(fitScale>=0.70){
      showEditErr('Der neue Text ist breiter als der Platz auf dieser Zeile. „Einpassen“ setzt ihn mit ca. '
        +squeezePct+'&nbsp;% schmalerer Laufweite – gleiche Schrift und Position, aber sichtbar engere Zeichen.'+approxNote,
        [{label:'Einpassen',primary:true,fn:async()=>{teardownEdit();
           const r=await applyEdit(page,item,newText,fitTz);
           if(r.missing) showError('Zeichen nicht verfügbar: '+r.missing.join(' '));
           else flash('Eingepasst: Laufweite −'+squeezePct+' %');
           updateDocNotice();}},
         {label:'Weiter bearbeiten',fn:()=>{clearEditErr();input.focus();}},
         {label:'Verwerfen',fn:()=>{teardownEdit();}}]);
      return;
    }
    showEditErr('Der neue Text ist deutlich zu breit für diese Zeile – auch Einpassen wäre unleserlich (nötig wären −'
      +squeezePct+'&nbsp;% Laufweite). Bitte kürzen.'+approxNote,
      [{label:'Weiter bearbeiten',primary:true,fn:()=>{clearEditErr();input.focus();}},
       {label:'Verwerfen',fn:()=>{teardownEdit();}}]);
    return;
  }
  teardownEdit();
  const r=await applyEdit(page,item,newText);
  if(r.missing) showError('Zeichen nicht verfügbar: '+r.missing.join(' '));
  updateDocNotice();
}

/* ---------- Zoom ---------- */
async function fitZoom(rerender){
  if(!pdfDoc)return;
  const p1=await pdfDoc.getPage(1);
  const w=p1.getViewport({scale:1}).width;
  zoom=Math.max(.4,Math.min(3,(scroller.clientWidth-64)/w));
  $('#zoomVal').textContent=Math.round(zoom*100)+' %';
  if(rerender)await rerenderAllPages();
}
async function rerenderAllPages(){
  for(const p of model.pages){ busy('Rendere Seite '+(p.index+1)+'…'); await rerenderPage(p); }
  busy(null);
}
async function setZoom(z){
  fitMode=false;
  zoom=Math.max(.4,Math.min(4,z));
  $('#zoomVal').textContent=Math.round(zoom*100)+' %';
  await rerenderAllPages();
}
$('#zoomIn').addEventListener('click',()=>setZoom(zoom*1.2));
$('#zoomOut').addEventListener('click',()=>setZoom(zoom/1.2));
$('#zoomFit').addEventListener('click',()=>{fitMode=true;fitZoom(true);});
let rsTimer=null;
window.addEventListener('resize',()=>{ if(!fitMode||!model)return;
  clearTimeout(rsTimer); rsTimer=setTimeout(()=>fitZoom(true),300); });

/* ---------- Öffnen / Drop / Tasten ---------- */
async function openPicker(){
  if(!window.showOpenFilePicker){
    legacyOpen.value='';
    legacyOpen.click();
    return;
  }
  let hs;
  try{
    hs=await showOpenFilePicker({multiple:false,
      types:[{description:'HTML-, PDF-, Markdown- und Textdateien',
        accept:{'text/html':['.html','.htm'],'application/pdf':['.pdf'],'text/markdown':['.md','.markdown'],'text/plain':['.txt']}}]});
  }catch(err){ if(err&&err.name==='AbortError')return;
    showError('Öffnen fehlgeschlagen: '+err.message); return; }
  await loadFromHandle(hs[0]);
}
legacyOpen.addEventListener('change',async()=>{
  const file=legacyOpen.files&&legacyOpen.files[0];
  if(!file)return;
  await loadFromHandle(makeDownloadHandle(file));
});
function isFileDrag(e){ return e.dataTransfer&&Array.from(e.dataTransfer.types||[]).includes('Files'); }
window.addEventListener('dragenter',e=>{ if(isFileDrag(e))overlayDrop.hidden=false; });
window.addEventListener('dragover',e=>e.preventDefault());
window.addEventListener('drop',e=>e.preventDefault());
overlayDrop.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';});
overlayDrop.addEventListener('dragleave',e=>{ if(!e.relatedTarget)overlayDrop.hidden=true; });
overlayDrop.addEventListener('drop',async e=>{
  e.preventDefault(); overlayDrop.hidden=true;
  const item=[...(e.dataTransfer.items||[])].find(it=>it.kind==='file');
  if(!item)return;
  let h;
  if(item.getAsFileSystemHandle){
    try{ h=await item.getAsFileSystemHandle(); }
    catch(_){ h=null; }
  }
  if(!h){
    const file=item.getAsFile&&item.getAsFile();
    if(!file){showError('Die abgelegte Datei konnte nicht gelesen werden.');return;}
    h=makeDownloadHandle(file);
  }
  if(!h||h.kind!=='file'){ showError('Bitte eine einzelne Datei ablegen (keinen Ordner).'); return; }
  await loadFromHandle(h);
});
btnOpen.addEventListener('click',openPicker);
btnSave.addEventListener('click',save);
window.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&(e.key==='s'||e.key==='S')){ e.preventDefault(); save(); }
});
window.addEventListener('beforeunload',e=>{ if(isDirty()){e.preventDefault();e.returnValue='';} });

if(!window.showOpenFilePicker){
  setNotice('Brave-Kompatibilitätsmodus: Öffnen und Bearbeiten funktionieren vollständig. „Kopie speichern“ lädt die geänderte Datei herunter; die Originaldatei bleibt unverändert.');
}

'use strict';
/* ================= HTML-Modus =================
   Portierte Logik des eigenständigen HTML-Editors: Anzeige in iframe/srcdoc,
   nur Textknoten editierbar, Speichern durch Byte-Splicing im Original-String
   (nie DOM-Serialisierung) – Diff-minimal inkl. BOM/CRLF-Erhalt. */

const hViewer=document.querySelector('#hviewer');
let srcText='', hasBOM=false, fileCRLF=false;
let runs=[], nodeMap=new Map(), unmappedContent=0;
let editSpan=null, editRun=null, preEditValue='';
let hoverBox=null, dirty=false;
/* v2.8: schwebendes Editierfeld für SVG-/MathML-Text und als Rückfallebene, wenn ein
   In-Place-Span keinen Fokus bekommt; hChanged markiert in dieser Sitzung geänderte Textknoten. */
const SVG_NS='http://www.w3.org/2000/svg', MATHML_NS='http://www.w3.org/1998/Math/MathML';
let hOverlay=null;            // {box,node,run,raf,lastPos}
const hChanged=new WeakSet();

const RAW_TEXT_TAGS=new Set(['script','style','textarea','title','xmp','iframe','noembed','noframes']);
const RAW_PARENTS=new Set(['SCRIPT','STYLE','TEXTAREA','TITLE','XMP','IFRAME','NOEMBED','NOFRAMES','PLAINTEXT']);

/* ---------- Quelltext-Scanner (positionsbasiert) ---------- */
function scanHTML(src){
  const out=[]; const n=src.length; let i=0; let lastOpenTag=null;
  const isLetter=c=>(c>='a'&&c<='z')||(c>='A'&&c<='Z');
  function skipTag(from){
    let j=from+1;
    if(src[j]==='/')j++;
    const nameStart=j;
    while(j<n&&!/[\s/>]/.test(src[j]))j++;
    const name=src.slice(nameStart,j).toLowerCase();
    let prev='';
    while(j<n){
      const c=src[j];
      if(c==='>'){j++;break;}
      if((c==='"'||c==="'")&&prev==='='){
        const q=src.indexOf(c,j+1); j=q===-1?n:q+1; prev=c; continue;
      }
      if(!/\s/.test(c))prev=c;
      j++;
    }
    return {end:j,name};
  }
  while(i<n){
    if(src[i]==='<'&&i+1<n){
      const d=src[i+1];
      if(d==='!'){
        if(src.startsWith('<!--',i)){
          let end;
          if(src.startsWith('>',i+4))end=i+5;
          else if(src.startsWith('->',i+4))end=i+6;
          else{
            const a=src.indexOf('-->',i+4), b=src.indexOf('--!>',i+4);
            if(a===-1&&b===-1)end=n;
            else if(a===-1)end=b+4;
            else if(b===-1)end=a+3;
            else end=a<b?a+3:b+4;
          }
          i=end; lastOpenTag=null; continue;
        }
        if(src.startsWith('<![CDATA[',i)){
          const e=src.indexOf(']]>',i+9);
          if(e!==-1)i=e+3;
          else{const g=src.indexOf('>',i+2);i=g===-1?n:g+1;}
          lastOpenTag=null; continue;
        }
        const g=src.indexOf('>',i+2); i=g===-1?n:g+1; lastOpenTag=null; continue;
      }
      if(d==='?'){const g=src.indexOf('>',i+2);i=g===-1?n:g+1;lastOpenTag=null;continue;}
      if(d==='/'){
        const e2=src[i+2];
        if(e2&&isLetter(e2)){i=skipTag(i).end;lastOpenTag=null;continue;}
        if(e2==='>'){i+=3;lastOpenTag=null;continue;}
        const g=src.indexOf('>',i+2); i=g===-1?n:g+1; lastOpenTag=null; continue;
      }
      if(isLetter(d)){
        const t=skipTag(i);
        i=t.end; lastOpenTag=t.name;
        if(t.name==='plaintext'){i=n;break;}
        if(RAW_TEXT_TAGS.has(t.name)||t.name==='template'){
          const re=new RegExp('</'+t.name+'(?=[\\s/>]|$)','gi');
          re.lastIndex=i;
          const m=re.exec(src);
          i=m?m.index:n;
          lastOpenTag=null; continue;
        }
        continue;
      }
    }
    let j=i;
    while(j<n){
      const k=src.indexOf('<',j);
      if(k===-1){j=n;break;}
      const d2=src[k+1];
      if(d2&&(isLetter(d2)||d2==='/'||d2==='!'||d2==='?')){j=k;break;}
      j=k+1;
    }
    out.push({start:i,end:j,raw:src.slice(i,j),prevTag:lastOpenTag});
    lastOpenTag=null;
    i=j;
  }
  return out;
}

function decodeRuns(list){
  const CH=200;
  for(let off=0;off<list.length;off+=CH){
    const chunk=list.slice(off,off+CH);
    const html=chunk.map(r=>'<div>x'+r.raw+'</div>').join('');
    const doc=new DOMParser().parseFromString('<!doctype html><html><body>'+html,'text/html');
    let divs=doc.body.children;
    if(divs.length!==chunk.length)divs=null;
    for(let k=0;k<chunk.length;k++){
      const r=chunk[k];
      let el=divs?divs[k]:null;
      if(!el){
        const d1=new DOMParser().parseFromString('<!doctype html><html><body><div>x'+r.raw+'</div>','text/html');
        el=d1.body.firstElementChild;
      }
      r.decoded=el?el.textContent.slice(1):r.raw;
      let d=r.decoded;
      r.droppedPreNL=false;
      if((r.prevTag==='pre'||r.prevTag==='listing')&&d.startsWith('\n')){d=d.slice(1);r.droppedPreNL=true;}
      r.dom=d;
      r.ws=!/\S/.test(d);
    }
  }
}

function alignRuns(doc){
  nodeMap=new Map();
  unmappedContent=0;
  const walker=doc.createTreeWalker(doc.documentElement,NodeFilter.SHOW_TEXT,{
    acceptNode(t){
      const p=t.parentNode;
      return p&&RAW_PARENTS.has(p.nodeName.toUpperCase())?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT;
    }
  });
  let ri=0,node;
  while((node=walker.nextNode())){
    const data=node.data;
    let found=-1;
    const LIMIT=Math.min(ri+60,runs.length);
    for(let j=ri;j<LIMIT;j++){
      const r=runs[j];
      if(r.dom!==''&&r.dom===data){found=j;break;}
      if(!r.ws&&r.dom!=='')break;
    }
    if(found>=0){
      const r=runs[found];
      r.node=node;
      if(!r.ws)nodeMap.set(node,r);
      ri=found+1;
    } else if(/\S/.test(data)) unmappedContent++;
  }
  return unmappedContent;
}

/* ---------- Anzeige & Editieren ---------- */
function hInstrument(){
  const doc=hViewer.contentDocument;
  editSpan=null; editRun=null; hOverlay=null;
  runs=scanHTML(srcText);
  decodeRuns(runs);
  alignRuns(doc);
  hHookDoc(doc);
  document.body.classList.add('file-loaded');
  hUpdateStatus();
  hBuildOutline();
}
const hOutlineEl=document.querySelector('#hOutline');
let hTab='inhalt', hTxtFilter='', hOutItems=[], hTxtItems=[];
function hTxtLabel(node){ return node.data.replace(/\s+/g,' ').trim(); }
function hElemHidden(el){
  if(!el.getClientRects)return false;
  if(el.getClientRects().length===0)return true;
  const doc=el.ownerDocument;
  for(let e=el;e&&e!==doc.body&&e!==doc.documentElement;e=e.parentElement){
    const b=e.getBoundingClientRect();
    if(b.width<=2&&b.height<=2)return true;
  }
  return false;
}
function hOutlineAfterEdit(oldNode,newNode){
  for(const it of hOutItems){ const s=it.h.textContent.trim(); if(it.a.textContent!==s)it.a.textContent=s; }
  for(const it of hTxtItems){
    if(it.node!==oldNode&&it.node!==newNode)continue;
    it.node=newNode;
    const s=hTxtLabel(newNode);
    it.a.textContent=s.length>80?s.slice(0,80)+'…':(s||'(leer)');
    it.a.classList.toggle('txtChanged',hChanged.has(newNode));
  }
}
function hRenderTxtList(list,texts){
  list.innerHTML=''; hTxtItems=[];
  const q=hTxtFilter.trim().toLowerCase();
  let shown=0;
  for(const t of texts){
    if(q&&!t.label.toLowerCase().includes(q))continue;
    if(++shown>1500){ const m=document.createElement('div'); m.className='txtMore'; m.textContent='… weitere Einträge – bitte filtern'; list.appendChild(m); break; }
    const it={node:t.node,a:document.createElement('a')};
    it.a.href='#'; it.a.className='txtItem';
    const p=t.node.parentNode;
    if(p&&p.namespaceURI===SVG_NS)it.a.classList.add('txtSvg');
    if(!hTextVisible(t.node,false))it.a.classList.add('txtHidden');
    if(hChanged.has(t.node))it.a.classList.add('txtChanged');
    it.a.textContent=t.label.length>80?t.label.slice(0,80)+'…':t.label;
    it.a.title=(p?'<'+p.nodeName.toLowerCase()+'>  ':'')+t.label.slice(0,300);
    // mousedown statt click: verhindert, dass der Klick zuerst das aktive Editierfeld im Iframe blurt
    it.a.addEventListener('mousedown',ev=>{ ev.preventDefault(); ev.stopPropagation(); hEditNode(it.node,null); });
    it.a.addEventListener('click',ev=>ev.preventDefault());
    list.appendChild(it.a); hTxtItems.push(it);
  }
  if(!shown){ const e=document.createElement('div'); e.className='txtMore'; e.textContent=q?'Kein Treffer':'Keine Textstellen'; list.appendChild(e); }
}
function hBuildOutline(){
  hOutlineEl.innerHTML=''; hOutItems=[]; hTxtItems=[];
  const doc=hViewer.contentDocument;
  if(!doc||!doc.body){hOutlineEl.style.display='none';return;}
  const hs=Array.from(doc.body.querySelectorAll('h1,h2,h3,h4,h5,h6')).filter(h=>h.textContent.trim());
  const texts=[];
  for(const r of runs){
    if(r.ws||!r.node||!r.node.isConnected||!nodeMap.has(r.node))continue;
    const s=hTxtLabel(r.node); if(s)texts.push({node:r.node,label:s});
  }
  if(!hs.length&&!texts.length){hOutlineEl.style.display='none';return;}
  if(!hs.length)hTab='texte';
  const tabs=document.createElement('div'); tabs.className='outTabs';
  const mk=(id,label,title)=>{ const b=document.createElement('button'); b.type='button'; b.textContent=label; b.title=title;
    b.className=hTab===id?'on':''; b.addEventListener('mousedown',ev=>{ ev.preventDefault(); if(hTab!==id){hTab=id;hBuildOutline();} }); tabs.appendChild(b); };
  mk('inhalt','Inhalt ('+hs.length+')','Überschriften und Abschnitt-Aktionen');
  mk('texte','Texte ('+texts.length+')','Alle bearbeitbaren Textstellen – Klick öffnet die Bearbeitung');
  hOutlineEl.appendChild(tabs);
  if(hTab==='texte'){
    const f=document.createElement('input'); f.type='text'; f.className='txtFilter'; f.placeholder='Textliste filtern…'; f.value=hTxtFilter; f.spellcheck=false;
    hOutlineEl.appendChild(f);
    const list=document.createElement('div'); list.className='txtList';
    hOutlineEl.appendChild(list);
    f.addEventListener('input',()=>{ hTxtFilter=f.value; hRenderTxtList(list,texts); });
    hRenderTxtList(list,texts);
    hOutlineEl.style.display='';
    return;
  }
  for(const h of hs){
    const row=document.createElement('div');
    row.className='outItem';
    const isHidden=()=>hElemHidden(h);   // display:none, sr-only (1×1 geclippt) o. Ä. (z. B. Druck-Anhang)
    if(isHidden())row.classList.add('outHidden');
    const a=document.createElement('a');
    a.textContent=h.textContent.trim();
    a.className='lvl'+Math.min(parseInt(h.tagName[1],10),4);
    a.href='#';
    if(isHidden())a.title='Auf dem Bildschirm ausgeblendet (z. B. nur im Druck sichtbar)';
    a.addEventListener('click',ev=>{ ev.preventDefault();
      if(isHidden()){ flash('Dieser Abschnitt ist auf dem Bildschirm ausgeblendet (z. B. nur im Druck sichtbar)'); return; }
      h.scrollIntoView({block:'start'}); });
    const d=document.createElement('button');
    d.type='button'; d.className='outDel'; d.textContent='Abschnitt löschen…';
    d.setAttribute('aria-label','Abschnitt löschen: '+h.textContent.trim());
    d.title='Ganzen Abschnitt löschen (Überschrift + Inhalt bis zur nächsten gleichrangigen Überschrift)';
    d.addEventListener('click',ev=>{ ev.preventDefault(); ev.stopPropagation(); hDeleteSectionFlow(h); });
    row.appendChild(a); row.appendChild(d);
    hOutlineEl.appendChild(row);
    hOutItems.push({h,a});
  }
  hOutlineEl.style.display='';
}
/* Abschnitt = Überschrift + folgende Geschwister-Elemente bis zur nächsten
   gleich- oder höherrangigen Überschrift (konservativ: endet am Container). */
function hSectionRun(h){
  const L=parseInt(h.tagName[1],10);
  const HS='h1,h2,h3,h4,h5,h6';
  const isBoundary=el=>{
    if(el.matches&&el.matches(HS)&&parseInt(el.tagName[1],10)<=L)return true;
    if(el.querySelectorAll)
      for(const hh of el.querySelectorAll(HS))
        if(parseInt(hh.tagName[1],10)<=L)return true;
    return false;
  };
  const run=[h];
  let n=h.nextElementSibling;
  while(n){
    if(isBoundary(n))break;
    run.push(n);
    n=n.nextElementSibling;
  }
  return run;
}
async function hDeleteSectionFlow(h){
  if(mode!=='html'||!h||!h.isConnected)return;
  hCommitAndFold();
  if(srcText!==hHist[hHistPos])hPushHist();
  const run=hSectionRun(h);
  if(!await window.confirmSectionDelete(h))return;
  if(mode!=='html'||!h.isConnected)return;
  const checkpoint=srcText;
  let ok=true,failIdx=-1;
  for(let k=0;k<run.length;k++){
    if(!hDeleteElement(run[k])){ ok=false; failIdx=k; break; }
  }
  if(!ok){
    srcText=checkpoint;
    hViewer.srcdoc=window.prepareDocumentPreview?window.prepareDocumentPreview(srcText):srcText;
    showError('Abschnitt nicht gelöscht: Element '+(failIdx+1)+' von '+run.length+' ('+delDescribe(run[failIdx])+') ließ sich nicht sicher der Quelldatei zuordnen – alles wurde zurückgenommen. Es wurde nichts verändert.');
    return;
  }
  hideDelBtn();
  hPushHist();
  hBuildOutline();
  hUpdateStatus();
  if(!findBar.hidden&&findInput.value)findRun();
  flash('Abschnitt gelöscht – '+KEY_SAVE+' schreibt in die Datei, '+(IS_MAC?'⌘Z':'Strg+Z')+' macht rückgängig');
}
function hHookDoc(doc){
  doc.addEventListener('click',hOnDocClick,true);
  doc.addEventListener('mousemove',hOnDocMove,true);
  doc.addEventListener('keydown',hOnKeydown,true);
  doc.addEventListener('scroll',hHideHover,true);
  doc.addEventListener('dragenter',e=>{ if(isFileDrag(e))overlayDrop.hidden=false; },true);
  doc.addEventListener('dragover',e=>e.preventDefault());
  doc.addEventListener('drop',e=>e.preventDefault());
  hoverBox=doc.createElement('div');
  hoverBox.setAttribute('data-voxui','1');
  hoverBox.style.cssText='position:fixed;pointer-events:none;z-index:2147483647;'+
    'border:1px solid rgba(37,99,235,.8);background:rgba(37,99,235,.07);border-radius:2px;display:none;';
  (doc.body||doc.documentElement).appendChild(hoverBox);
  delBtn=null; delTarget=null;
  doc.addEventListener('scroll',hideDelBtn,true);
}
function hRectsContain(doc,t,x,y,tol){
  const rng=doc.createRange();
  if(typeof rng.getClientRects!=='function')return false;
  rng.setStart(t,0); rng.setEnd(t,t.length);
  for(const rect of rng.getClientRects())
    if(x>=rect.left-tol&&x<=rect.right+tol&&y>=rect.top-tol&&y<=rect.bottom+tol)return true;
  return false;
}
function hNodeRect(node){
  const rng=node.ownerDocument.createRange();
  if(typeof rng.getClientRects!=='function')return undefined;   // API fehlt (z. B. Test-Umgebung): unbekannt
  rng.selectNodeContents(node);
  const rs=rng.getClientRects();
  return rs.length?{first:rs[0],all:rng.getBoundingClientRect(),n:rs.length}:null;
}
function hVisibleText(t){ const rr=hNodeRect(t); return !!rr&&(rr.all.width>0||rr.all.height>0); }
function hTextVisible(node,precise){
  // Sichtbar auf dem Bildschirm? Grob: eigene Rechtecke + kein 0×0-/1×1-Vorfahr (display:none-Gruppe,
  // sr-only-Container). Chrome liefert für SVG-Text in display:none-Gruppen trotzdem Range-Rechtecke,
  // daher die Vorfahren-Prüfung. Genau (precise): Trefferprobe per elementsFromPoint an der Textstelle.
  const rr=hNodeRect(node); if(rr===undefined)return true; if(!rr)return false;
  const r=rr.first; if(r.width<1||r.height<1)return false;
  const doc=node.ownerDocument, win=doc.defaultView;
  for(let el=node.parentElement;el&&el!==doc.body&&el!==doc.documentElement;el=el.parentElement){
    const b=el.getBoundingClientRect();
    if(b.width<=2&&b.height<=2)return false;
  }
  if(!precise)return true;
  const cx=Math.min(r.right-1,r.left+Math.min(8,r.width/2)), cy=r.top+r.height/2;
  if(cx<0||cy<0||cx>win.innerWidth||cy>win.innerHeight)return true;   // außerhalb des Fensters: nicht entscheidbar
  if(!doc.elementsFromPoint)return true;
  const pe=node.parentNode;
  for(const el of doc.elementsFromPoint(cx,cy)) if(el===pe||(pe&&pe.contains&&pe.contains(el)))return true;
  return false;
}
function hOffsetAt(doc,t,x,y){
  // Zeichenposition zum Punkt (Rückfallebene ohne caretRangeFromPoint): k mit [0,k)-Rand am nächsten an x
  const n=t.length; if(!n)return 0;
  const rr=hNodeRect(t); if(!rr)return n;
  let best=0,bd=Math.abs(rr.first.left-x)+(y<rr.first.top-2||y>rr.first.bottom+2?1e6:0);
  const rng=doc.createRange();
  for(let k=1;k<=n;k++){
    rng.setStart(t,0); rng.setEnd(t,k);
    const rs=rng.getClientRects(); if(!rs.length)continue;
    const r=rs[rs.length-1];
    const d=Math.abs(r.right-x)+(y<r.top-2||y>r.bottom+2?1e6:0);
    if(d<bd){bd=d;best=k;}
  }
  return best;
}
function hCaretHit(doc,x,y){
  if(!doc.caretRangeFromPoint)return null;
  const cr=doc.caretRangeFromPoint(x,y);
  if(!cr||cr.startContainer.nodeType!==3)return null;
  const t=cr.startContainer;
  const run=nodeMap.get(t);
  if(!run)return null;
  if(hRectsContain(doc,t,x,y,2))return {node:t,offset:cr.startOffset,run};
  return null;
}
function hFindTextAt(doc,x,y,deep){
  const c=hCaretHit(doc,x,y);
  if(c)return c;
  // Rückfallebene 1 (v2.8): alle Elemente unter dem Punkt – findet SVG-Text auch unter
  // unsichtbaren Hover-Flächen (fill-opacity:0) und Text unter gestreckten Link-Overlays.
  if(doc.elementsFromPoint){
    const els=doc.elementsFromPoint(x,y);
    for(let i=0;i<els.length&&i<16;i++){
      const el=els[i];
      if(el.closest&&el.closest('[data-voxui]'))continue;
      for(const t of el.childNodes){
        if(t.nodeType!==3)continue;
        const run=nodeMap.get(t); if(!run)continue;
        if(hRectsContain(doc,t,x,y,2))return {node:t,offset:hOffsetAt(doc,t,x,y),run};
      }
    }
  }
  if(!deep)return null;
  // Rückfallebene 2 (nur beim Klick): geometrische Suche über alle zugeordneten Textknoten
  // (z. B. Text mit pointer-events:none).
  for(const [t,run] of nodeMap){
    if(!t.isConnected)continue;
    const pe=t.parentElement; if(!pe)continue;
    const pr=pe.getBoundingClientRect();
    if(x<pr.left-2||x>pr.right+2||y<pr.top-2||y>pr.bottom+2)continue;
    if(hRectsContain(doc,t,x,y,2))return {node:t,offset:hOffsetAt(doc,t,x,y),run};
  }
  return null;
}
function hHideHover(){ if(hoverBox)hoverBox.style.display='none'; }
function hOnDocMove(e){
  if(!hoverBox)return;
  if(editSpan&&editSpan.contains(e.target)){hHideHover();return;}
  const doc=hViewer.contentDocument;
  const hit=hFindTextAt(doc,e.clientX,e.clientY);
  if(!hit||(editRun&&hit.node===editRun.node)){hHideHover();return;}
  const rng=doc.createRange();
  rng.setStart(hit.node,0); rng.setEnd(hit.node,hit.node.length);
  const r=rng.getBoundingClientRect();
  hoverBox.style.left=(r.left-2)+'px'; hoverBox.style.top=(r.top-2)+'px';
  hoverBox.style.width=(r.width+4)+'px'; hoverBox.style.height=(r.height+4)+'px';
  hoverBox.style.display='block';
}
function hOnDocClick(e){
  hideDelBtn();
  const el=e.target&&e.target.closest?e.target:null;
  const link=el&&el.closest('a[href]');
  if(link)e.preventDefault();
  if(editSpan&&editSpan.contains(e.target))return;
  const doc=hViewer.contentDocument;
  const hit=hFindTextAt(doc,e.clientX,e.clientY,true);
  if(editSpan)hEndEdit(true);
  if(!hit){
    // Text getroffen, aber nicht zuordenbar (z. B. CDATA, Template) → sagen statt schweigen
    const cr=doc.caretRangeFromPoint?doc.caretRangeFromPoint(e.clientX,e.clientY):null;
    const t=cr&&cr.startContainer;
    if(t&&t.nodeType===3&&/\S/.test(t.data)&&!nodeMap.get(t)&&!(t.parentNode&&t.parentNode.closest&&t.parentNode.closest('[data-voxui]'))&&hRectsContain(doc,t,e.clientX,e.clientY,2))
      flash('Diese Textstelle lässt sich nicht sicher der Quelldatei zuordnen – hier gesperrt');
    return;
  }
  e.preventDefault(); e.stopPropagation();
  hBeginEdit(hit.node,hit.offset);
}
function hNeedsOverlay(node){
  const p=node.parentNode;
  if(!p||p.nodeType!==1)return false;
  return p.namespaceURI===SVG_NS||p.namespaceURI===MATHML_NS;
}
function hBeginOverlay(node,offset,run,pinned){
  // Schwebendes Editierfeld über der Textstelle: gleiche Schrift, Größe mit der Grafik skaliert
  // (getScreenCTM), Position folgt der Textstelle pro Frame (Scroll, CSS-Animation).
  // pinned: Textstelle ist ausgeblendet (display:none, sr-only …) → Feld fest oben links.
  const doc=node.ownerDocument, win=doc.defaultView;
  const pe=node.parentNode;
  preEditValue=node.data;
  const cs=win.getComputedStyle(pe);
  let scale=1;
  try{ if(pe.getScreenCTM){ const m=pe.getScreenCTM(); if(m)scale=Math.hypot(m.a,m.b)||1; } }catch(_){}
  const fs=Math.max(13,(parseFloat(cs.fontSize)||16)*scale);
  const box=doc.createElement('div');
  box.setAttribute('data-voxui','1');
  box.setAttribute('contenteditable','plaintext-only');
  box.setAttribute('spellcheck','false');
  box.style.cssText='position:fixed;z-index:2147483647;box-sizing:border-box;margin:0;padding:0 4px;border:2px solid #2563eb;border-radius:3px;'
    +'background:#fff;color:#111;white-space:pre;outline:none;box-shadow:0 2px 10px rgba(0,0,0,.28);cursor:text;text-align:left;'
    +'user-select:text;-webkit-user-select:text;min-width:2em;max-width:calc(100vw - 16px);overflow:hidden;text-transform:none;letter-spacing:normal;';
  box.style.fontFamily=cs.fontFamily; box.style.fontSize=fs+'px';
  box.style.fontWeight=cs.fontWeight; box.style.fontStyle=cs.fontStyle;
  box.textContent=node.data;
  if(!/\S/.test(node.data))box.style.minWidth='6em';
  if(!box.isContentEditable)box.setAttribute('contenteditable','true');
  box.addEventListener('beforeinput',hOnBeforeInput);
  box.addEventListener('blur',()=>hEndEdit(true));
  (doc.body||doc.documentElement).appendChild(box);
  hOverlay={box,node,run,raf:0,lastPos:'',pinned:!!pinned};
  editSpan=box; editRun=run;
  hPlaceOverlay(true);
  hHideHover();
  box.focus({preventScroll:true});
  try{ const t=box.firstChild; if(t)doc.getSelection().collapse(t,Math.min(offset,t.length)); }catch(_){}
  if(pinned){ box.title='Ausgeblendete Textstelle – wird hier bearbeitet'; flash('Ausgeblendete Textstelle – Bearbeitung im Feld oben links (Enter = Übernehmen)'); return; }
  const tick=()=>{ if(!hOverlay||hOverlay.box!==box)return; hPlaceOverlay(false); hOverlay.raf=win.requestAnimationFrame(tick); };
  hOverlay.raf=win.requestAnimationFrame(tick);
}
function hPlaceOverlay(first){
  if(!hOverlay)return;
  const {box,node}=hOverlay;
  const doc=node.ownerDocument, win=doc.defaultView;
  const rr=(!hOverlay.pinned&&node.isConnected)?hNodeRect(node):null;
  const r=rr?rr.all:null;
  if(!r||(r.width===0&&r.height===0)){
    if(first){ box.style.left='16px'; box.style.top='16px'; box.style.lineHeight='1.3'; box.style.maxWidth='min(60ch, calc(100vw - 32px))'; box.style.whiteSpace='pre-wrap'; }   // ausgeblendete Textstelle: oben links
    return;
  }
  const fs=parseFloat(box.style.fontSize)||16;
  const lh=Math.max(Math.round(r.height),Math.round(fs*1.25));
  const left=Math.max(0,Math.min(r.left-6,win.innerWidth-40));
  const top=Math.max(0,Math.min(r.top+r.height/2-lh/2-2,win.innerHeight-lh-4));
  const pos=Math.round(left)+','+Math.round(top)+','+lh;
  if(pos!==hOverlay.lastPos){
    hOverlay.lastPos=pos;
    box.style.lineHeight=lh+'px'; box.style.left=left+'px'; box.style.top=top+'px';
  }
  if(first)box.style.minWidth=Math.max(fs*2,Math.min(win.innerWidth-left-8,r.width+14))+'px';
}
function hEndOverlay(apply){
  const o=hOverlay; hOverlay=null;
  const box=o.box,node=o.node,run=o.run,doc=box.ownerDocument;
  editSpan=null; editRun=null;
  try{ if(o.raf&&doc.defaultView)doc.defaultView.cancelAnimationFrame(o.raf); }catch(_){}
  let text=apply?hSerializeSpan(box):preEditValue;
  if(apply&&text.endsWith('\n')&&!preEditValue.endsWith('\n'))text=text.slice(0,-1);
  try{ box.remove(); }catch(_){}
  preEditValue='';
  if(apply&&run&&node.isConnected&&text!==node.data){
    node.data=text;          // SVG rendert die Stelle neu; Knoten bleibt derselbe (nodeMap gültig)
    run.newDecoded=text;
    hChanged.add(node);
  }
  hUpdateStatus();
  if(apply)hOutlineAfterEdit(node,node);
  if(apply&&!hFolding&&changedRuns().length){
    hFolding=true;
    try{ hFoldChanges(); hPushHist(); }
    finally{ hFolding=false; }
    hUpdateStatus();
  }
}
function hBeginEdit(node,offset,mode){
  // mode: undefined = automatisch, 'overlay' = schwebendes Feld erzwingen, 'pinned' = Feld oben links (Text ausgeblendet)
  const doc=node.ownerDocument;
  const run=nodeMap.get(node);
  if(!run)return;
  if(mode==='pinned'||mode==='overlay'||hNeedsOverlay(node)){ hBeginOverlay(node,offset,run,mode==='pinned'); return; }   // HTML-Span wird in SVG nicht gerendert
  preEditValue=node.data;
  const span=doc.createElement('span');
  span.setAttribute('contenteditable','plaintext-only');
  span.setAttribute('spellcheck','false');
  span.style.cssText='outline:2px solid #2563eb;outline-offset:0;background:rgba(37,99,235,.10);cursor:text;';
  node.parentNode.replaceChild(span,node);
  span.appendChild(node);
  if(!span.isContentEditable){
    span.setAttribute('contenteditable','true');
    span.addEventListener('paste',ev=>{
      ev.preventDefault();
      const t=ev.clipboardData?ev.clipboardData.getData('text/plain'):'';
      if(t)doc.execCommand('insertText',false,t);
    });
  }
  span.addEventListener('beforeinput',hOnBeforeInput);
  span.addEventListener('blur',()=>hEndEdit(true));
  editSpan=span; editRun=run;
  hHideHover();
  span.focus({preventScroll:true});
  if(doc.activeElement!==span){
    // Fokus verweigert (Span nicht darstellbar/fokussierbar) → Span zurückbauen, schwebendes Feld nehmen
    editSpan=null; editRun=null;
    try{ span.replaceWith(node); }catch(_){}
    if(node.isConnected)hBeginOverlay(node,offset,run);
    return;
  }
  try{ doc.getSelection().collapse(node,Math.min(offset,node.length)); }catch(_){}
}
function hOnBeforeInput(e){
  const t=e.inputType||'';
  const ok=t.startsWith('delete')||t.startsWith('history')||
    ['insertText','insertLineBreak','insertParagraph','insertFromPaste',
     'insertCompositionText','insertReplacementText'].includes(t);
  if(!ok)e.preventDefault();
}
function hSerializeSpan(el){
  let s='';
  (function walk(nd){
    for(const c of nd.childNodes){
      if(c.nodeType===3)s+=c.data;
      else if(c.nodeName==='BR')s+='\n';
      else walk(c);
    }
  })(el);
  return s;
}
function hEndEdit(apply){
  if(!editSpan)return;
  if(hOverlay&&editSpan===hOverlay.box){ hEndOverlay(apply); return; }
  const span=editSpan, run=editRun, doc=span.ownerDocument;
  const oldNode=run?run.node:null;
  editSpan=null; editRun=null;
  let text=apply?hSerializeSpan(span):preEditValue;
  if(apply&&text.endsWith('\n')&&!preEditValue.endsWith('\n'))text=text.slice(0,-1);
  const tn=doc.createTextNode(text);
  try{ span.replaceWith(tn); }catch(_){}
  if(run){
    if(run.node)nodeMap.delete(run.node);
    run.node=tn;
    nodeMap.set(tn,run);
    if(apply)run.newDecoded=text;
    if(apply&&text!==run.dom)hChanged.add(tn);
  }
  preEditValue='';
  hUpdateStatus();
  if(apply)hOutlineAfterEdit(oldNode,tn);   // Überschrift/Textliste nachführen, ohne die Leiste neu zu bauen
  if(apply&&!hFolding&&changedRuns().length){
    hFolding=true;
    try{ hFoldChanges(); hPushHist(); }
    finally{ hFolding=false; }
    hUpdateStatus();
  }
}

/* ---------- Speichern (Byte-Splicing im Original-String) ---------- */
function hEncodeRun(r){
  let t=r.newDecoded.replace(/&/g,'&amp;').replace(/</g,'&lt;');
  if(r.droppedPreNL)t='\n'+t;
  const wantCRLF=/\r\n/.test(r.raw)||(!/[\n\r]/.test(r.raw)&&fileCRLF);
  if(wantCRLF)t=t.replace(/\n/g,'\r\n');
  return t;
}
function changedRuns(){
  return runs.filter(r=>r.newDecoded!==undefined&&r.newDecoded!==r.dom);
}
async function hSave(){
  if(!handle)return;
  if(editSpan)hEndEdit(true);
  const changed=changedRuns().sort((a,b)=>a.start-b.start);
  if(changed.length===0&&srcText===hBaseline){flash('Keine Änderungen zu speichern');return;}
  let out='',pos=0;
  for(const r of changed){
    out+=srcText.slice(pos,r.start)+hEncodeRun(r);
    pos=r.end;
  }
  out+=srcText.slice(pos);
  try{
    await writeBackOrDownload(new Blob([hasBOM?'\uFEFF'+out:out],{type:'text/html'}));
  }catch(err){
    showError('Speichern fehlgeschlagen: '+(err&&err.message?err.message:err));
    return;
  }
  hideError();
  srcText=out;
  hBaseline=out;
  lastSaved=new Date();
  runs=scanHTML(srcText);
  decodeRuns(runs);
  alignRuns(hViewer.contentDocument);
  hUpdateStatus();
}

/* ---------- Laden (Bytes kommen vom Dispatcher) ---------- */
async function hLoadBytes(h,buf){
  const bomHere=buf.length>=3&&buf[0]===0xEF&&buf[1]===0xBB&&buf[2]===0xBF;
  let text;
  try{ text=new TextDecoder('utf-8',{fatal:true}).decode(buf); }
  catch(_){
    showError('Diese HTML-Datei ist nicht UTF-8-kodiert. Der Editor schreibt UTF-8 und würde die '+
      'Kodierung verändern. Empfehlung: Datei als UTF-8 speichern und erneut öffnen.');
    return;
  }
  const m=/<meta[^>]*charset\s*=\s*["']?\s*([\w.:-]+)/i.exec(text.slice(0,2048));
  if(m&&!/^utf-?8$/i.test(m[1])){
    showError('Die Datei deklariert die Kodierung „'+m[1]+'“, der Editor unterstützt nur UTF-8. '+
      'Empfehlung: Datei nach UTF-8 konvertieren (inkl. meta charset) und erneut öffnen.');
    return;
  }
  // PDF-/MD-Modus abbauen, HTML-Modus aktivieren
  mode='html';
  if(pdfDoc){try{pdfDoc.destroy();}catch(_){}}
  pdfDoc=null; model=null; pagesEl.innerHTML=''; setNotice(null);
  mdText=''; mdOrig=''; mEdit=null; mIns=null; mOutlineEl.innerHTML='';
  if(mViewer.getAttribute('srcdoc')) mViewer.srcdoc='';
  document.body.classList.add('mode-html');
  document.body.classList.remove('mode-pdf','mode-md');
  handle=h; hasBOM=bomHere; srcText=text; fileCRLF=/\r\n/.test(text); lastSaved=null;
  hBaseline=text; hHist=[text]; hHistPos=0; delBtn=null; delTarget=null; hTab='inhalt'; hTxtFilter='';
  hideError();
  document.querySelector('#fileName').textContent=h.name;
  document.querySelector('#fileName').title=h.name;
  document.title=h.name+' – FinDobe v2.8';
  document.querySelector('#hint').textContent='Text anklicken · Enter = Übernehmen · Tab = nächste Textstelle · Esc = Abbrechen · '+KEY_SAVE+' = Speichern';
  try{
    if(h.queryPermission&&(await h.queryPermission({mode:'readwrite'}))!=='granted'&&h.requestPermission){
      await h.requestPermission({mode:'readwrite'});
    }
  }catch(_){}
  hViewer.srcdoc=window.prepareDocumentPreview?window.prepareDocumentPreview(srcText):srcText;
}

function hUpdateStatus(){
  dirty=changedRuns().length>0||srcText!==hBaseline;
  syncSaveUi();
  btnSave.disabled=!handle;
  if(!handle){statusEl.textContent='';return;}
  if(dirty){statusEl.textContent='● Ungespeicherte Änderungen';statusEl.className='dirty';}
  else {statusEl.textContent=savedStatusText();statusEl.className=lastSaved?'clean':'neutral';}
  if(unmappedContent>0)
    statusEl.textContent+=' · '+unmappedContent+' Textstelle(n) nicht zuordenbar (gesperrt)';
}

function hOnKeydown(e){
  if(e.key==='Escape'){hideDelBtn();hHideHover();}
  if((e.ctrlKey||e.metaKey)&&(e.key==='s'||e.key==='S')){e.preventDefault();save();return;}
  if((e.ctrlKey||e.metaKey)&&(e.key==='f'||e.key==='F')){e.preventDefault();findOpen();return;}
  if(undoKeyHandler(e))return;
  if(!editSpan)return;
  if(e.key==='Escape'){e.preventDefault();hEndEdit(false);return;}
  if(e.key==='Enter'&&!e.shiftKey&&!e.altKey&&!e.isComposing){e.preventDefault();hEndEdit(true);return;}
  if(e.key==='Tab'){e.preventDefault();hEditNeighbor(e.shiftKey?-1:1);}
}
/* v2.8: gezielt eine Textstelle öffnen (Textliste, Tab-Sprung) */
function hEditNode(node,offset){
  const doc=hViewer.contentDocument;
  if(editSpan)hEndEdit(true);
  if(!doc||!node||!node.isConnected||!nodeMap.get(node)){flash('Diese Textstelle ist nicht (mehr) zuordenbar');return;}
  let vis=false;
  try{
    vis=hTextVisible(node,false);
    const rr=hNodeRect(node), win=doc.defaultView;
    if(vis&&rr&&(rr.all.top<0||rr.all.bottom>win.innerHeight||rr.all.left<0||rr.all.right>win.innerWidth)){
      const pe=node.parentElement; if(pe&&pe.scrollIntoView)pe.scrollIntoView({block:'center',inline:'nearest'});
    }
    if(vis)vis=hTextVisible(node,true);
  }catch(_){}
  hBeginEdit(node,offset==null?node.length:offset,vis?undefined:'pinned');
}
function hEditNeighbor(dir){
  const cur=editRun&&editRun.node, doc=hViewer.contentDocument;
  if(!cur||!doc||!cur.isConnected){ if(editSpan)hEndEdit(true); return; }
  const w=doc.createTreeWalker(doc.documentElement,NodeFilter.SHOW_TEXT);
  w.currentNode=cur;
  let n,target=null;
  while((n=dir>0?w.nextNode():w.previousNode())){
    if(nodeMap.has(n)&&hTextVisible(n,false)){target=n;break;}
  }
  hEndEdit(true);
  if(!target){flash(dir>0?'Letzte Textstelle erreicht':'Erste Textstelle erreicht');return;}
  hEditNode(target,dir>0?0:null);
}

hViewer.addEventListener('load',()=>{
  if(mode!=='html'||!handle||!hViewer.srcdoc)return;
  hInstrument();
  const y=parseFloat(hViewer.dataset.scrollY||'0');
  if(y&&hViewer.contentWindow)hViewer.contentWindow.scrollTo(0,y);
  hViewer.dataset.scrollY='';
  if(!findBar.hidden&&findInput.value)findRun();
});

'use strict';
/* ================= Markdown-Modus =================
   Eigener CommonMark/GFM-Subset-Parser. Jede editierbare Textstelle wird beim
   Rendern mit ihrem exakten [start,end)-Bereich im Quelltext annotiert
   (data-s/data-e) – die Zuordnung ist damit konstruktionsbedingt exakt.
   Gespeichert wird durch Byte-Splicing im Original-String (wie HTML-Modus):
   Unberührte Bereiche bleiben byte-identisch, inkl. CRLF und BOM. */

const mViewer=document.querySelector('#mviewer');
const mOutlineEl=document.querySelector('#mdOutline');
let mdText='', mdOrig='', mdBOM=false, mReady=false;
let mEdit=null; // {el, s, e, ctx, fch, flen, orig, ls, cell}
let mIns=null, mInsBusy=false; // Einfüge-Session (Shift+Enter): Pending-Zeile(n)

/* ---------- kleine Helfer ---------- */
const MD_ENT={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',auml:'ä',ouml:'ö',uuml:'ü',
  Auml:'Ä',Ouml:'Ö',Uuml:'Ü',szlig:'ß',euro:'€',copy:'©',reg:'®',sect:'§',deg:'°',plusmn:'±',
  times:'×',divide:'÷',laquo:'«',raquo:'»',bdquo:'„',ldquo:'“',rdquo:'”',lsquo:'‘',rsquo:'’',
  ndash:'–',mdash:'—',hellip:'…',bull:'•',trade:'™',middot:'·',le:'≤',ge:'≥',ne:'≠',rarr:'→',larr:'←'};
function escHtml(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function mdEscapeText(t,cell,lineStart){
  let out=t.replace(/[\\`*_\[\]<&~]/g,m=>'\\'+m);
  if(cell)out=out.replace(/\|/g,'\\|');
  if(lineStart){
    if(/^[#>+=\-]/.test(out))out='\\'+out;
    else out=out.replace(/^(\d{1,9})([.)])/,'$1\\$2');
  }
  return out;
}

/* ---------- Parser ---------- */
function mdParse(src){
  const outline=[]; let hid=0;
  // Quelltext in Zeilen mit Offsets zerlegen (EOL bleibt außerhalb der Ranges)
  const toLines=(text,base)=>{ // -> [{s,text}]
    const ls=[]; let p=0;
    while(p<=text.length){
      let nl=text.indexOf('\n',p);
      let end=nl===-1?text.length:nl;
      let e2=end;
      if(e2>p&&text[e2-1]==='\r')e2--;
      ls.push({s:base+p,text:text.slice(p,e2)});
      if(nl===-1)break;
      p=nl+1;
    }
    return ls;
  };

  const isBlank=l=>/^\s*$/.test(l.text);
  const FENCE_RE=/^( {0,3})(`{3,}|~{3,})(.*)$/;
  const ATX_RE=/^ {0,3}(#{1,6})([ \t]+|$)/;
  const THEMA_RE=/^ {0,3}((\* *){3,}|(- *){3,}|(_ *){3,})[ \t]*$/;
  const QUOTE_RE=/^ {0,3}> ?/;
  const LIST_RE=/^( {0,3})([*+-]|\d{1,9}[.)])( +|$)/;
  const DELIMROW_RE=/^ *\|? *:?-+:? *(\| *:?-+:? *)*\|? *$/;
  const SETEXT_RE=/^ {0,3}(=+|-+)[ \t]*$/;
  const HTMLBLOCK_RE=/^ {0,3}<[a-zA-Z!\/?]/;

  function hasPipe(t){ // unmaskiertes |
    for(let i=0;i<t.length;i++){ if(t[i]==='\\'){i++;continue;} if(t[i]==='|')return true; }
    return false;
  }
  function splitCells(line){ // {s,text} -> [{s,text}]
    const cells=[]; let start=0; const t=line.text;
    for(let i=0;i<=t.length;i++){
      if(i<t.length&&t[i]==='\\'){i++;continue;}
      if(i===t.length||t[i]==='|'){
        cells.push({s:line.s+start,text:t.slice(start,i)});
        start=i+1;
      }
    }
    if(cells.length&&/^\s*$/.test(cells[0].text)&&/^\s*\|/.test(t))cells.shift();
    if(cells.length&&/^\s*$/.test(cells[cells.length-1].text)&&/\|\s*$/.test(t))cells.pop();
    return cells.map(c=>{ // trimmen, Offsets nachziehen
      const m=/^(\s*)(.*?)(\s*)$/.exec(c.text);
      return {s:c.s+m[1].length,text:m[2]};
    });
  }

  function parseBlocks(lines,tight){
    let html='',i=0;
    const n=lines.length;
    while(i<n){
      const L=lines[i];
      if(isBlank(L)){i++;continue;}
      let m;
      // HTML-Block (Roh-Durchreichung, gesperrt)
      if(HTMLBLOCK_RE.test(L.text)&&!ATX_RE.test(L.text)){
        let raw=[];
        while(i<n&&!isBlank(lines[i])){raw.push(lines[i].text);i++;}
        html+='<div class="mraw">'+raw.join('\n')+'</div>\n';
        continue;
      }
      // Fenced Code
      if((m=FENCE_RE.exec(L.text))){
        const indent=m[1].length,ch=m[2][0],len=m[2].length;
        i++;
        let code='';
        while(i<n){
          const cl=lines[i];
          const cm=new RegExp('^ {0,3}('+(ch==='`'?'`':'~')+'{'+len+',})[ \\t]*$').exec(cl.text);
          if(cm){i++;break;}
          const strip=Math.min(indent,(/^ */.exec(cl.text))[0].length);
          const cs=cl.s+strip,ct=cl.text.slice(strip);
          code+='<span class="mr" data-s="'+cs+'" data-e="'+(cs+ct.length)+'" data-c="f" data-fc="'+ch+'" data-fl="'+len+'">'+escHtml(ct)+'</span>\n';
          i++;
        }
        html+='<pre class="mdpre"><code>'+code+'</code></pre>\n';
        continue;
      }
      // ATX-Überschrift
      if((m=ATX_RE.exec(L.text))){
        const level=m[1].length;
        let cs=L.s+m[0].length, ct=L.text.slice(m[0].length);
        const tr=/[ \t]+#+[ \t]*$/.exec(ct);
        if(tr)ct=ct.slice(0,tr.index);
        else if(/^#+[ \t]*$/.test(ct))ct='';
        const id='mdh'+(hid++);
        const inner=inlineParse([{s:cs,text:ct}],false);
        outline.push({level,id,text:ct.replace(/[\\`*_\[\]]/g,'').trim()||'(ohne Titel)'});
        html+='<h'+level+' id="'+id+'">'+inner+'</h'+level+'>\n';
        i++;continue;
      }
      // Blockquote
      if(QUOTE_RE.test(L.text)){
        const inner=[];
        while(i<n&&QUOTE_RE.exec(lines[i].text)){
          const q=QUOTE_RE.exec(lines[i].text);
          inner.push({s:lines[i].s+q[0].length,text:lines[i].text.slice(q[0].length)});
          i++;
        }
        html+='<blockquote>'+parseBlocks(inner,false)+'</blockquote>\n';
        continue;
      }
      // Thematic Break (vor Liste prüfen)
      if(THEMA_RE.test(L.text)){html+='<hr>\n';i++;continue;}
      // Liste
      if((m=LIST_RE.exec(L.text))&&!THEMA_RE.test(L.text)){
        const ordered=/\d/.test(m[2][0]);
        const startNum=ordered?parseInt(m[2],10):null;
        const items=[];let loose=false;
        while(i<n){
          const im=LIST_RE.exec(lines[i].text);
          if(!im)break;
          if((/\d/.test(im[2][0]))!==ordered)break;
          const indent=im[1].length;
          let ci=im[0].length;
          if(im[3].length>4)ci=indent+im[2].length+1;
          const item=[{s:lines[i].s+im[0].length,text:lines[i].text.slice(im[0].length)}];
          i++;
          let sawBlank=false;
          while(i<n){
            const cl=lines[i];
            if(isBlank(cl)){sawBlank=true;i++;continue;}
            const lead=(/^ */.exec(cl.text))[0].length;
            if(lead>=ci){
              if(sawBlank){item.push({s:cl.s,text:''});loose=true;sawBlank=false;}
              item.push({s:cl.s+ci,text:cl.text.slice(ci)});
              i++;
            } else break;
          }
          if(sawBlank&&i<n&&LIST_RE.exec(lines[i].text))loose=true;
          items.push(item);
        }
        let lis='';
        for(const item of items){
          // GFM-Task-Checkbox am Item-Anfang
          let chk='';
          const f=item[0];
          const tm=/^\[( |x|X)\] /.exec(f.text);
          if(tm){chk='<input type="checkbox" disabled'+(tm[1]!==' '?' checked':'')+'> ';
            item[0]={s:f.s+4,text:f.text.slice(4)};}
          lis+='<li>'+chk+parseBlocks(item,!loose)+'</li>\n';
        }
        html+=(ordered?'<ol'+(startNum!==1?' start="'+startNum+'"':'')+'>':'<ul>')+'\n'+lis+(ordered?'</ol>':'</ul>')+'\n';
        continue;
      }
      // GFM-Tabelle
      if(hasPipe(L.text)&&i+1<n&&DELIMROW_RE.test(lines[i+1].text)&&hasPipe(lines[i+1].text)){
        const head=splitCells(L);
        const aligns=splitCells(lines[i+1]).map(c=>{
          const t=c.text.trim();
          return t.startsWith(':')&&t.endsWith(':')?'center':t.endsWith(':')?'right':t.startsWith(':')?'left':'';
        });
        i+=2;
        const rows=[];
        while(i<n&&!isBlank(lines[i])&&hasPipe(lines[i].text)){rows.push(splitCells(lines[i]));i++;}
        const cell=(c,tag,k)=>{
          // Leere Zellen bekommen einen klickbaren Platzhalter-Run ([s,s) = Einfügeposition)
          let inner=c.text===''
            ?'<span class="mr mph" data-s="'+c.s+'" data-e="'+c.s+'" data-c="cell"></span>'
            :inlineParse([c],true);
          return '<'+tag+(aligns[k]?' style="text-align:'+aligns[k]+'"':'')+'>'+inner+'</'+tag+'>';
        };
        let t='<table><thead><tr>'+head.map((c,k)=>cell(c,'th',k)).join('')+'</tr></thead>\n<tbody>\n';
        for(const r of rows){
          t+='<tr>';
          for(let k=0;k<head.length;k++)t+=r[k]?cell(r[k],'td',k):'<td></td>';
          t+='</tr>\n';
        }
        html+=t+'</tbody></table>\n';
        continue;
      }
      // Eingerückter Code (nur außerhalb von Absätzen)
      if(/^ {4}/.test(L.text)){
        let code='';
        while(i<n&&(/^ {4}/.test(lines[i].text)||isBlank(lines[i]))){
          if(isBlank(lines[i])){ if(i+1<n&&/^ {4}/.test(lines[i+1].text)){code+='\n';i++;continue;} break; }
          const cs=lines[i].s+4,ct=lines[i].text.slice(4);
          code+='<span class="mr" data-s="'+cs+'" data-e="'+(cs+ct.length)+'" data-c="i">'+escHtml(ct)+'</span>\n';
          i++;
        }
        html+='<pre class="mdpre"><code>'+code+'</code></pre>\n';
        continue;
      }
      // Absatz (mit Setext-Erkennung)
      {
        const segs=[{s:L.s,text:L.text}];
        i++;
        let setext=0;
        while(i<n){
          const nl=lines[i];
          if(isBlank(nl))break;
          const sm=SETEXT_RE.exec(nl.text);
          if(sm){setext=sm[1][0]==='='?1:2;i++;break;}
          if(FENCE_RE.test(nl.text)||ATX_RE.test(nl.text)||QUOTE_RE.test(nl.text)||
             THEMA_RE.test(nl.text)||LIST_RE.test(nl.text)||HTMLBLOCK_RE.test(nl.text))break;
          segs.push({s:nl.s,text:nl.text});
          i++;
        }
        const inner=inlineParse(segs,false);
        if(setext){
          const id='mdh'+(hid++);
          outline.push({level:setext,id,text:segs.map(x=>x.text).join(' ').replace(/[\\`*_\[\]]/g,'').trim()});
          html+='<h'+setext+' id="'+id+'">'+inner+'</h'+setext+'>\n';
        } else html+=tight?'<div class="mtp">'+inner+'</div>\n':'<p>'+inner+'</p>\n';
      }
    }
    return html;
  }

  /* ---------- Inline-Parser ----------
     segs: Zeilenstücke [{s,text}]; verbunden mit '\n' (Softbreak).
     Läufe (Runs) enden an Segmentgrenzen -> jede Run-Range ist zusammenhängend. */
  function inlineParse(segs,isCell){
    const J=segs.map(x=>x.text).join('\n');
    const map=[];let acc=0;
    for(const sg of segs){map.push({j0:acc,j1:acc+sg.text.length,s:sg.s});acc+=sg.text.length+1;}
    const srcOf=j=>{for(const sm of map){if(j>=sm.j0&&j<=sm.j1)return sm.s+(j-sm.j0);}return -1;};
    const segStartJs=new Set(map.map(sm=>sm.j0));

    const items=[]; // {t:'text',j0,j1,disp} | {t:'delim',ch,n,j0,open,close} | {t:'html',html} | {t:'br'} | {t:'soft'}
    const isWs=c=>c===undefined||/\s/.test(c);
    const isPunct=c=>c!==undefined&&/[!-\/:-@\[-`{-~]/.test(c);
    let j=0;
    const pushText=(j0,j1,disp)=>{if(disp!=='')items.push({t:'text',j0,j1,disp});};
    while(j<J.length){
      const c=J[j];
      if(c==='\n'){ // Soft-/Hardbreak
        // Hardbreak: 2+ Spaces oder Backslash am Zeilenende (bereits konsumiert unten)
        items.push({t:'soft'});j++;continue;
      }
      if(c==='\\'){
        const nx=J[j+1];
        if(nx==='\n'){items.push({t:'br'});j+=2;continue;}
        if(nx!==undefined&&/[!-\/:-@\[-`{-~]/.test(nx)){pushText(j,j+2,nx);j+=2;continue;}
        pushText(j,j+1,'\\');j++;continue;
      }
      if(c===' '&&J[j+1]===' '){ // evtl. Hardbreak vor \n
        let k=j;while(J[k]===' ')k++;
        if(J[k]==='\n'){items.push({t:'br'});j=k+1;continue;}
      }
      if(c==='`'){
        let L=0;while(J[j+L]==='`')L++;
        let close=-1,k=j+L;
        while(k<J.length){
          if(J[k]==='`'){let l2=0;while(J[k+l2]==='`')l2++;
            if(l2===L){close=k;break;} k+=l2;}
          else k++;
        }
        if(close===-1){pushText(j,j+L,'`'.repeat(L));j+=L;continue;}
        // Code-Span: Inhalt als Runs je Segment
        let html='<code>';
        let p=j+L;
        while(p<close){
          let q=Math.min(close,J.indexOf('\n',p)===-1?close:J.indexOf('\n',p));
          if(q>p){const s0=srcOf(p),s1=srcOf(q-1)+1;
            html+='<span class="mr" data-s="'+s0+'" data-e="'+s1+'" data-c="c">'+escHtml(J.slice(p,q))+'</span>';}
          if(q<close)html+=' ';
          p=q+1;
          if(q===close)break;
        }
        html+='</code>';
        items.push({t:'html',html});
        j=close+L;continue;
      }
      if(c==='<'){
        let m=/^<([a-zA-Z][a-zA-Z0-9+.\-]{1,31}:[^ <>\x00-\x1f]*)>/.exec(J.slice(j))||
              /^<([^ <>@]+@[^ <>]+\.[^ <>]+)>/.exec(J.slice(j));
        if(m){items.push({t:'html',html:'<a class="mlock" href="#">'+escHtml(m[1])+'</a>'});j+=m[0].length;continue;}
        m=/^<\/?[a-zA-Z][a-zA-Z0-9\-]*(\s[^<>]*)?\/?>/.exec(J.slice(j));
        if(m){items.push({t:'html',html:m[0]});j+=m[0].length;continue;}
        pushText(j,j+1,'<');j++;continue;
      }
      if(c==='&'){
        const m=/^&(#\d{1,7}|#[xX][0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,31});/.exec(J.slice(j));
        if(m){
          let d=null;
          if(m[1][0]==='#'){const cp=m[1][1]==='x'||m[1][1]==='X'?parseInt(m[1].slice(2),16):parseInt(m[1].slice(1),10);
            if(cp>0&&cp<=0x10FFFF)d=String.fromCodePoint(cp);}
          else d=MD_ENT[m[1]]||null;
          if(d!==null){pushText(j,j+m[0].length,d);j+=m[0].length;continue;}
        }
        pushText(j,j+1,'&');j++;continue;
      }
      if(c==='!'&&J[j+1]==='['){
        const lk=parseLinkAt(j+1);
        if(lk){items.push({t:'html',html:'<img class="mlock" alt="'+escHtml(J.slice(lk.txt0,lk.txt1))+'" src="'+escHtml(lk.dest)+'">'});j=lk.end;continue;}
        pushText(j,j+1,'!');j++;continue;
      }
      if(c==='['){
        const lk=parseLinkAt(j);
        if(lk){
          const inner=inlineSub(lk.txt0,lk.txt1,isCell);
          items.push({t:'html',html:'<a href="'+escHtml(lk.dest)+'">'+inner+'</a>'});
          j=lk.end;continue;
        }
        pushText(j,j+1,'[');j++;continue;
      }
      if(c==='*'||c==='_'||(c==='~'&&J[j+1]==='~')){
        const ch=c;let L2=0;
        while(J[j+L2]===ch)L2++;
        if(ch==='~'&&L2<2){pushText(j,j+1,'~');j++;continue;}
        const prev=J[j-1],next=J[j+L2];
        const lf=!isWs(next)&&(!isPunct(next)||isWs(prev)||isPunct(prev));
        const rf=!isWs(prev)&&(!isPunct(prev)||isWs(next)||isPunct(next));
        let open=lf,closeF=rf;
        if(ch==='_'){open=lf&&(!rf||isPunct(prev));closeF=rf&&(!lf||isPunct(next));}
        items.push({t:'delim',ch,n:L2,j0:j,open,close:closeF});
        j+=L2;continue;
      }
      // normaler Text bis zum nächsten Spezialzeichen
      let k=j+1;
      while(k<J.length&&!'\\`<&[*_~\n!'.includes(J[k])&&!(J[k]===' '&&J[k+1]===' '))k++;
      pushText(j,k,J.slice(j,k));
      j=k;
    }

    function parseLinkAt(pos){ // pos zeigt auf '['
      let depth=0,k=pos;
      while(k<J.length){
        const cc=J[k];
        if(cc==='\\')k+=2;
        else if(cc==='[') {depth++;k++;}
        else if(cc===']'){depth--;k++;if(depth===0)break;}
        else k++;
      }
      if(depth!==0||J[k]!=='(')return null;
      let p=k+1,par=1,dest='';
      while(p<J.length&&par>0){
        const cc=J[p];
        if(cc==='\\'){dest+=J[p+1]||'';p+=2;continue;}
        if(cc==='(')par++;
        else if(cc===')'){par--;if(par===0)break;}
        else if(cc==='\n')return null;
        dest+=cc;p++;
      }
      if(par!==0)return null;
      const dm=/^\s*(\S*?)(\s+"[^"]*")?\s*$/.exec(dest);
      return {txt0:pos+1,txt1:k-1,dest:dm?dm[1]:dest,end:p+1};
    }
    function inlineSub(j0,j1,cell){ // Teilbereich als eigene Segs erneut parsen
      const sub=[];
      for(const sm of map){
        const a=Math.max(j0,sm.j0),b=Math.min(j1,sm.j1);
        if(a<b||(a===b&&a>=sm.j0&&b<=sm.j1&&j0>=sm.j0&&j1<=sm.j1))
          if(a<b)sub.push({s:sm.s+(a-sm.j0),text:J.slice(a,b)});
      }
      return sub.length?inlineParse(sub,cell):'';
    }

    // Emphasis-Paare auflösen (vereinfachtes CommonMark-Verfahren)
    for(let ci=0;ci<items.length;ci++){
      const cl=items[ci];
      if(cl.t!=='delim'||!cl.close||cl.n===0)continue;
      for(let oi=ci-1;oi>=0;oi--){
        const op=items[oi];
        if(op.t!=='delim'||op.ch!==cl.ch||!op.open||op.n===0)continue;
        const use=cl.ch==='~'?2:Math.min(2,op.n,cl.n);
        const tag=cl.ch==='~'?'del':use===2?'strong':'em';
        items.splice(ci,0,{t:'html',html:'</'+tag+'>'});
        items.splice(oi+1,0,{t:'html',html:'<'+tag+'>'});
        ci++;
        op.n-=use;cl.n-=use;
        if(cl.ch==='~'){op.n=0;cl.n=0;}
        if(cl.n===0)break;
        ci--; // selben Closer nochmal prüfen
        break;
      }
    }

    // Serialisieren: Text-Items zu Runs zusammenfassen (nie über Konstrukt-/Segmentgrenzen)
    let html='',run=null;
    const flush=()=>{
      if(!run)return;
      const s0=srcOf(run.j0),s1=srcOf(run.j1-1)+1;
      const ls=segStartJs.has(run.j0)&&!isCell;
      html+='<span class="mr" data-s="'+s0+'" data-e="'+s1+'"'+(isCell?' data-c="cell"':'')+(ls?' data-ls="1"':'')+'>'+escHtml(run.disp)+'</span>';
      run=null;
    };
    for(const it of items){
      if(it.t==='text'){
        if(run&&run.j1===it.j0&&!segStartJs.has(it.j0))run={j0:run.j0,j1:it.j1,disp:run.disp+it.disp};
        else {flush();run={j0:it.j0,j1:it.j1,disp:it.disp};}
      } else if(it.t==='delim'&&it.n>0){ // unverbrauchte Delimiter als Literaltext
        flush();
        const s0=srcOf(it.j0);
        html+='<span class="mr" data-s="'+s0+'" data-e="'+(s0+it.n)+'">'+escHtml(it.ch.repeat(it.n))+'</span>';
      } else {
        flush();
        if(it.t==='html')html+=it.html;
        else if(it.t==='br')html+='<br>\n';
        else if(it.t==='soft')html+='\n';
      }
    }
    flush();
    return html;
  }

  const body=parseBlocks(toLines(src,0),false);
  return {html:body,outline};
}

/* ---------- Anzeige ---------- */
const MD_CSS=`
:root{color-scheme:light}
body{font:15px/1.6 system-ui,"Segoe UI",sans-serif;color:#1f2328;max-width:880px;margin:0 auto;padding:28px 44px 80px}
h1,h2,h3,h4,h5,h6{line-height:1.25;margin:1.4em 0 .5em;font-weight:650;scroll-margin-top:12px}
h1{font-size:1.9em;border-bottom:1px solid #d8dee4;padding-bottom:.25em}
h2{font-size:1.45em;border-bottom:1px solid #d8dee4;padding-bottom:.25em}
h3{font-size:1.2em}h4{font-size:1.05em}
p,.mtp{margin:.55em 0}
blockquote{margin:.7em 0;padding:2px 14px;border-left:4px solid #d0d7de;color:#57606a}
ul,ol{padding-left:2em;margin:.4em 0}
li{margin:.18em 0}
hr{border:0;border-top:2px solid #d8dee4;margin:1.4em 0}
code{font-family:ui-monospace,Consolas,monospace;font-size:.92em;background:#f0f2f5;padding:.12em .35em;border-radius:4px}
pre.mdpre{background:#f6f8fa;border:1px solid #e4e8ec;border-radius:8px;padding:12px 14px;overflow:auto;line-height:1.45}
pre.mdpre code{background:none;padding:0;font-size:.9em}
table{border-collapse:collapse;margin:.7em 0;display:block;overflow-x:auto;max-width:100%}
th,td{border:1px solid #d0d7de;padding:5px 12px}
th{background:#f6f8fa;font-weight:600}
a{color:#0a69da}
img{max-width:100%}
input[type=checkbox]{margin-right:.45em}
.mraw{color:#57606a;font-size:.92em}
.mr{border-radius:2px}
.mr:hover{outline:1px solid rgba(37,99,235,.8);background:rgba(37,99,235,.08);cursor:text}
.mr.editing{outline:2px solid #2563eb;background:rgba(37,99,235,.10);cursor:text}
.mlock{cursor:not-allowed}
.mph{display:inline-block;min-width:2.4em;min-height:1.05em}
.mph:empty::before{content:'···';color:#c8cfd7}
.mph.editing:empty::before{content:''}
.mpend{display:inline-block;min-width:5em;min-height:1.05em;outline:2px solid #2563eb;background:rgba(37,99,235,.10);border-radius:2px;cursor:text;white-space:pre-wrap}
.minsdone{background:rgba(21,128,61,.08)}
tr.mins td{background:rgba(37,99,235,.04)}
`;

function mRender(keepScroll){
  const y=keepScroll&&mViewer.contentWindow?mViewer.contentWindow.scrollY:0;
  const {html,outline}=mdParse(mdText);
  mReady=false;
  mViewer.dataset.scrollY=String(y||0);
  const preview='<!doctype html><html><head><meta charset="utf-8"><style>'+MD_CSS+'</style></head><body>'+html+'</body></html>';
  mViewer.srcdoc=window.prepareDocumentPreview?window.prepareDocumentPreview(preview):preview;
  // Outline-Seitenleiste (Eltern-Dokument)
  mOutlineEl.innerHTML='';
  if(outline.length){
    const cap=document.createElement('div');
    cap.className='cap'; cap.textContent='Inhalt';
    mOutlineEl.appendChild(cap);
    for(const o of outline){
      const a=document.createElement('a');
      a.textContent=o.text;
      a.className='lvl'+Math.min(o.level,4);
      a.dataset.hid=o.id;
      a.href='#';
      a.addEventListener('click',ev=>{
        ev.preventDefault();
        const el=mViewer.contentDocument&&mViewer.contentDocument.getElementById(o.id);
        if(el)el.scrollIntoView({block:'start'});
      });
      mOutlineEl.appendChild(a);
    }
    mOutlineEl.style.display='';
  } else mOutlineEl.style.display='none';
}

mViewer.addEventListener('load',()=>{
  if(mode!=='md'||!handle||!mViewer.srcdoc)return;
  const doc=mViewer.contentDocument;
  doc.addEventListener('click',ev=>{
    const a=ev.target.closest&&ev.target.closest('a');
    if(a)ev.preventDefault();
    const el=ev.target.closest&&ev.target.closest('.mr');
    if(el&&el.dataset.s===undefined)return;      // Pending-Zeile: Caret nativ setzen
    if(mEdit&&el!==mEdit.el)mCommit();
    if(el&&mReady&&!mIns&&(!mEdit||el!==mEdit.el))mStartEdit(el,ev);
  },true);
  doc.addEventListener('keydown',ev=>{
    if((ev.ctrlKey||ev.metaKey)&&(ev.key==='s'||ev.key==='S')){ev.preventDefault();save();return;}
    if((ev.ctrlKey||ev.metaKey)&&(ev.key==='f'||ev.key==='F')){ev.preventDefault();findOpen();return;}
    if(undoKeyHandler(ev))return;
    if(ev.key==='Enter'&&ev.shiftKey){
      if(mEdit){ev.preventDefault();mShiftEnter();return;}
      if(mIns){ev.preventDefault();mInsChain();return;}
    }
    if(mIns){
      if(ev.key==='Enter'){ev.preventDefault();mInsCommitCurrent(false);}
      else if(ev.key==='Escape'){ev.preventDefault();mInsDiscard();}
      return;
    }
    if(!mEdit)return;
    if(ev.key==='Enter'){ev.preventDefault();mCommit();}
    else if(ev.key==='Escape'){ev.preventDefault();mRevert();}
  },true);
  doc.addEventListener('beforeinput',ev=>{
    const inEdit=mEdit&&mEdit.el.contains(ev.target);
    const inPend=ev.target&&ev.target.closest&&ev.target.closest('.mpend');
    if(!inEdit&&!inPend)return;
    const t=ev.inputType||'';
    const ok=t.startsWith('delete')||t.startsWith('history')||
      ['insertText','insertFromPaste','insertCompositionText','insertReplacementText'].includes(t);
    if(!ok)ev.preventDefault();
  },true);
  doc.addEventListener('focusout',ev=>{
    if(mEdit){mCommit();return;}
    if(mIns&&!mInsBusy){
      const rt=ev.relatedTarget;
      if(!rt)return;                                   // Fensterwechsel: nichts verlieren
      if(mIns.kind==='row'&&mIns.rowEl.contains(rt))return; // Zellwechsel in der Pending-Zeile
      if(mIns.kind==='line'&&mIns.span.contains(rt))return;
      mInsCommitCurrent(false);
    }
  },true);
  doc.addEventListener('dragenter',e=>{ if(isFileDrag(e))overlayDrop.hidden=false; },true);
  doc.addEventListener('dragover',e=>e.preventDefault());
  doc.addEventListener('drop',e=>e.preventDefault());
  const y=parseFloat(mViewer.dataset.scrollY||'0');
  if(y)mViewer.contentWindow.scrollTo(0,y);
  mReady=true;
  if(!findBar.hidden&&findInput.value)findRun();   // Ranges nach Re-Render neu aufbauen
});

/* ---------- Editieren ---------- */
function mStartEdit(el,ev){
  if(el.classList.contains('mlock'))return;
  const ctx=el.dataset.c||'t';
  mEdit={el,s:+el.dataset.s,e:+el.dataset.e,ctx,
    fch:el.dataset.fc||'`',flen:+(el.dataset.fl||3),
    orig:el.textContent,ls:el.dataset.ls==='1'};
  el.setAttribute('contenteditable','plaintext-only');
  if(!el.isContentEditable)el.setAttribute('contenteditable','true');
  el.classList.add('editing');
  el.focus({preventScroll:true});
  try{
    const doc=el.ownerDocument;
    const r=doc.caretRangeFromPoint(ev.clientX,ev.clientY);
    if(r&&el.contains(r.startContainer))doc.getSelection().collapse(r.startContainer,r.startOffset);
  }catch(_){}
}
/* mEdit ZUERST nullen: removeAttribute('contenteditable') feuert synchron
   focusout, dessen Handler sonst re-entrant nochmal committet. */
function mCleanup(){
  const ed=mEdit;
  if(!ed)return;
  mEdit=null;
  ed.el.removeAttribute('contenteditable');
  ed.el.classList.remove('editing');
}
function mRevert(){
  const ed=mEdit;
  if(!ed)return;
  mEdit=null;
  ed.el.textContent=ed.orig;
  ed.el.removeAttribute('contenteditable');
  ed.el.classList.remove('editing');
}
function mCommit(){
  if(!mEdit)return;
  const {el,s,e,ctx,fch,flen,orig,ls}=mEdit;
  const txt=el.textContent.replace(/\n/g,'');
  if(txt===orig){mCleanup();return;}
  let repl;
  if(ctx==='c'){
    if(txt.includes('`')){showError('Backticks können innerhalb eines Code-Spans nicht gespeichert werden – bitte entfernen oder Esc drücken.');el.focus();return;}
    repl=txt;
  } else if(ctx==='f'){
    if(new RegExp('^ {0,3}'+(fch==='`'?'`':'~')+'{'+flen+',}[ \\t]*$').test(txt)){
      showError('Diese Zeile würde den Code-Block beenden (Fence) – bitte anders formulieren oder Esc drücken.');el.focus();return;
    }
    repl=txt;
  } else if(ctx==='i'){
    repl=txt;
  } else {
    repl=mdEscapeText(txt,ctx==='cell',ls);
  }
  hideError();
  mCleanup();
  mdText=mdText.slice(0,s)+repl+mdText.slice(e);
  // Kein Re-Render nötig: das Escaping garantiert, dass die Struktur unverändert
  // bleibt. Nur die Quell-Offsets aller nachfolgenden Runs verschieben.
  const delta=repl.length-(e-s);
  el.dataset.e=String(s+repl.length);
  if(delta!==0){
    for(const sp of el.ownerDocument.querySelectorAll('.mr')){
      if(sp===el)continue;
      const ss=+sp.dataset.s;
      if(ss>=e){ sp.dataset.s=String(ss+delta); sp.dataset.e=String(+sp.dataset.e+delta); }
    }
  }
  // Outline-Beschriftung nachziehen, falls eine Überschrift editiert wurde
  const hEl=el.closest&&el.closest('h1,h2,h3,h4,h5,h6');
  if(hEl&&hEl.id){
    for(const a of mOutlineEl.querySelectorAll('a'))
      if(a.dataset.hid===hEl.id){ a.textContent=hEl.textContent.trim()||'(ohne Titel)'; break; }
  }
  updateStatus();
  mdPushHist();
}

/* ---------- Zeilen einfügen (Shift+Enter) ----------
   Prinzip: Die neue Zeile existiert zunächst NUR in der Anzeige (Pending).
   Erst beim Bestätigen mit Inhalt wird an einer festen Quellposition
   (Zeilenende der Ausgangszeile) EOL + Zeilenformat + maskierter Text
   gespliced – eine leer gelassene Zeile verschwindet daher rückstandslos. */
function lineInfoAt(s){
  const ls=mdText.lastIndexOf('\n',s-1)+1;
  let le=mdText.indexOf('\n',s), eol;
  if(le===-1){ le=mdText.length; eol=mdText.includes('\r\n')?'\r\n':'\n'; }
  else if(le>0&&mdText[le-1]==='\r'){ eol='\r\n'; le=le-1; }
  else eol='\n';
  return {ls,le,eol,lineText:mdText.slice(ls,le)};
}
function derivePrefix(lineText,ctx){
  let quotes='',rest=lineText,m;
  while((m=/^ {0,3}> ?/.exec(rest))){ quotes+=m[0]; rest=rest.slice(m[0].length); }
  if(ctx==='f'||ctx==='i') return {pref:quotes+(/^ */.exec(rest))[0]};
  if((m=/^( *)(\d{1,9})([.)] +)/.exec(rest))){
    const task=/^\[( |x|X)\] /.test(rest.slice(m[0].length));
    return {num:{quotes,indent:m[1],n:parseInt(m[2],10),tail:m[3],task}};
  }
  if((m=/^( *[*+-] +)/.exec(rest))){
    const task=/^\[( |x|X)\] /.test(rest.slice(m[0].length));
    return {pref:quotes+m[1]+(task?'[ ] ':''),list:true,task};
  }
  return {pref:quotes};
}
function nextPrefix(info){
  if(info.num){ const q=info.num; q.n+=1; return q.quotes+q.indent+q.n+q.tail+(q.task?'[ ] ':''); }
  return info.pref;
}
function shiftRunsFrom(pos,delta){
  if(!delta)return;
  for(const sp of mViewer.contentDocument.querySelectorAll('.mr')){
    if(sp.dataset.s===undefined)continue;
    const ss=+sp.dataset.s;
    if(ss>=pos){ sp.dataset.s=String(ss+delta); sp.dataset.e=String(+sp.dataset.e+delta); }
  }
}
function mShiftEnter(){
  const ed=mEdit; if(!ed)return;
  const el=ed.el, ctx=ed.ctx, fch=ed.fch, flen=ed.flen;
  mCommit();
  if(mEdit)return;                       // Commit durch Fehlerdialog blockiert
  openInsertAfter(el,ctx,fch,flen);
}
function openInsertAfter(el,ctx,fch,flen){
  if(!el||el.dataset.s===undefined)return;
  const li=lineInfoAt(+el.dataset.s);
  if(ctx==='cell'){ openInsertRow(el,li.le,li.eol); return; }
  const info=derivePrefix(li.lineText,ctx);
  mIns={kind:'line',pos:li.le,eol:li.eol,info,ctx,
    raw:(ctx==='f'||ctx==='i'),fence:ctx==='f'?{ch:fch||'`',len:flen||3}:null,
    span:null,rowEl:null,cells:null,blocks:[],written:false};
  let anchor;
  if(ctx==='f'||ctx==='i')anchor=el;
  else if(info.num||info.list){
    anchor=el.closest('li');
    if(!anchor){ info.num=null; info.list=false; info.pref=info.pref||''; anchor=el.closest('p,.mtp,h1,h2,h3,h4,h5,h6')||el.parentElement; }
  } else anchor=el.closest('p,.mtp,h1,h2,h3,h4,h5,h6')||el.parentElement;
  mInsOpenLineBlock(anchor);
}
function mInsOpenLineBlock(afterNode){
  const ins=mIns, doc=mViewer.contentDocument;
  const span=doc.createElement('span');
  span.className='mr mpend';
  span.setAttribute('contenteditable','plaintext-only');
  let blockEl, extra=null;
  if(ins.ctx==='f'||ins.ctx==='i'){
    const code=afterNode.parentNode;
    let ref=afterNode.nextSibling;
    if(ref&&ref.nodeType===3)ref=ref.nextSibling;   // hinter dem '\n' der Vorzeile
    code.insertBefore(span,ref||null);
    extra=doc.createTextNode('\n');
    code.insertBefore(extra,span.nextSibling);
    blockEl=span;
  } else if(ins.info.num||ins.info.list){
    const nli=doc.createElement('li'); nli.className='mins';
    if((ins.info.num&&ins.info.num.task)||ins.info.task){
      const cb=doc.createElement('input'); cb.type='checkbox'; cb.disabled=true;
      nli.appendChild(cb); nli.appendChild(doc.createTextNode(' '));
    }
    nli.appendChild(span);
    afterNode.after(nli);
    blockEl=nli;
  } else {
    const np=doc.createElement('p'); np.className='mins'; np.appendChild(span);
    afterNode.after(np);
    blockEl=np;
  }
  if(!span.isContentEditable)span.setAttribute('contenteditable','true');
  ins.span=span;
  ins.blocks.push({el:blockEl,extra,done:false});
  span.focus();
}
function openInsertRow(el,pos,eol){
  const doc=mViewer.contentDocument;
  const tr=el.closest('tr'), table=el.closest('table');
  if(!tr||!table)return;
  const cols=table.querySelectorAll('thead th').length||tr.children.length;
  const ntr=doc.createElement('tr'); ntr.className='mins';
  const cells=[];
  for(let k=0;k<cols;k++){
    const td=doc.createElement('td');
    const sp=doc.createElement('span');
    sp.className='mr mpend';
    sp.setAttribute('contenteditable','plaintext-only');
    td.appendChild(sp); ntr.appendChild(td); cells.push(sp);
  }
  tr.after(ntr);
  for(const c of cells) if(!c.isContentEditable)c.setAttribute('contenteditable','true');
  mIns={kind:'row',pos,eol,cells,rowEl:ntr,blocks:[{el:ntr,done:false}],written:false,info:null};
  cells[0].focus();
}
function mInsCommitCurrent(chain){
  const ins=mIns; if(!ins)return true;
  if(ins.kind==='row')return mInsRowCommit(chain);
  mInsBusy=true;
  try{
    const txt=ins.span.textContent.replace(/\n/g,'');
    if(txt===''){ if(!chain)mInsDiscard(); return false; }
    let payload;
    if(ins.raw){
      if(ins.fence&&new RegExp('^ {0,3}'+(ins.fence.ch==='`'?'`':'~')+'{'+ins.fence.len+',}[ \\t]*$').test(txt)){
        showError('Diese Zeile würde den Code-Block beenden (Fence) – bitte anders formulieren oder Esc drücken.');
        ins.span.focus(); return false;
      }
      payload=txt;
    } else payload=mdEscapeText(txt,false,true);
    const S=ins.eol+nextPrefix(ins.info)+payload;
    mdText=mdText.slice(0,ins.pos)+S+mdText.slice(ins.pos);
    shiftRunsFrom(ins.pos,S.length);
    ins.pos+=S.length;
    ins.written=true;
    mdPushHist();
    const b=ins.blocks[ins.blocks.length-1]; b.done=true;
    ins.span.classList.remove('mpend'); ins.span.classList.add('minsdone');
    ins.span.removeAttribute('contenteditable');
    hideError();
    updateStatus();
    if(!chain)endInsertSession();
    return true;
  } finally { mInsBusy=false; }
}
function mInsRowCommit(chain){
  const ins=mIns; if(!ins)return true;
  mInsBusy=true;
  try{
    const texts=ins.cells.map(c=>c.textContent.replace(/\n/g,''));
    if(texts.every(t=>t==='')){ endInsertSession(); return false; }
    const row='|'+texts.map(t=>' '+(t?mdEscapeText(t,true,false):' ')+' ').join('|')+'|';
    const S=ins.eol+row;
    mdText=mdText.slice(0,ins.pos)+S+mdText.slice(ins.pos);
    shiftRunsFrom(ins.pos,S.length);
    ins.pos+=S.length; ins.written=true;
    mdPushHist();
    ins.blocks[ins.blocks.length-1].done=true;
    for(const c of ins.cells){ c.classList.remove('mpend'); c.classList.add('minsdone'); c.removeAttribute('contenteditable'); }
    updateStatus();
    if(chain){
      const doc=mViewer.contentDocument, prev=ins.rowEl, cols=ins.cells.length;
      const ntr=doc.createElement('tr'); ntr.className='mins';
      const cells=[];
      for(let k=0;k<cols;k++){
        const td=doc.createElement('td');
        const sp=doc.createElement('span');
        sp.className='mr mpend'; sp.setAttribute('contenteditable','plaintext-only');
        td.appendChild(sp); ntr.appendChild(td); cells.push(sp);
      }
      prev.after(ntr);
      for(const c of cells) if(!c.isContentEditable)c.setAttribute('contenteditable','true');
      ins.rowEl=ntr; ins.cells=cells; ins.blocks.push({el:ntr,done:false});
      cells[0].focus();
    } else endInsertSession();
    return true;
  } finally { mInsBusy=false; }
}
function mInsChain(){
  const ins=mIns; if(!ins)return;
  if(ins.kind==='row'){ mInsRowCommit(true); return; }
  if(!mInsCommitCurrent(true))return;
  if(!mIns)return;
  mInsOpenLineBlock(ins.blocks[ins.blocks.length-1].el);
}
function mInsDiscard(){
  mInsBusy=true;
  try{ endInsertSession(); } finally { mInsBusy=false; }
}
function endInsertSession(){
  const ins=mIns; if(!ins)return;
  mIns=null;
  for(const b of ins.blocks){
    if(!b.done){ try{ b.el.remove(); if(b.extra)b.extra.remove(); }catch(_){} }
  }
  if(ins.written)mRender(true);   // Anzeige normalisieren, neue Zeilen klickbar machen
}

/* ---------- Laden / Speichern ---------- */
async function mLoadBytes(h,buf){
  const bom=buf.length>=3&&buf[0]===0xEF&&buf[1]===0xBB&&buf[2]===0xBF;
  let text;
  try{ text=new TextDecoder('utf-8',{fatal:true}).decode(buf); }
  catch(_){
    showError('Diese Markdown-/Textdatei ist nicht UTF-8-kodiert. Der Editor schreibt UTF-8 und würde die Kodierung verändern. Empfehlung: Datei als UTF-8 speichern und erneut öffnen.');
    return;
  }
  // andere Modi abbauen
  mode='md';
  if(pdfDoc){try{pdfDoc.destroy();}catch(_){}}
  pdfDoc=null;model=null;pagesEl.innerHTML='';setNotice(null);
  editSpan=null;editRun=null;hOverlay=null;runs=[];nodeMap=new Map();srcText='';unmappedContent=0;
  if(hViewer.getAttribute('srcdoc'))hViewer.srcdoc='';
  hOutlineEl.innerHTML='';
  document.body.classList.add('mode-md');
  document.body.classList.remove('mode-pdf','mode-html');
  handle=h;mdBOM=bom;mdText=text;mdOrig=text;lastSaved=null;mEdit=null;mIns=null;
  mdHist=[text];mdHistPos=0;
  hideError();
  document.querySelector('#fileName').textContent=h.name;
  document.querySelector('#fileName').title=h.name;
  document.title=h.name+' – FinDobe v2.8';
  document.querySelector('#hint').textContent='Text anklicken · Enter = Übernehmen · Shift+Enter = neue Zeile darunter · Esc = Abbrechen · '+KEY_SAVE+' = Speichern';
  try{
    if(h.queryPermission&&(await h.queryPermission({mode:'readwrite'}))!=='granted'&&h.requestPermission)
      await h.requestPermission({mode:'readwrite'});
  }catch(_){}
  document.body.classList.add('file-loaded');
  mRender(false);
  updateStatus();
}
async function mSave(){
  if(!handle)return;
  if(mIns){
    if(mIns.kind==='row')mInsRowCommit(false); else mInsCommitCurrent(false);
    if(mIns)return; // Einfügen durch Fehlerdialog blockiert
  }
  if(mEdit)mCommit();
  if(mEdit)return; // Commit durch Fehler blockiert
  if(mdText===mdOrig){flash('Keine Änderungen zu speichern');return;}
  try{
    await writeBackOrDownload(new Blob([mdBOM?'\uFEFF'+mdText:mdText],{type:'text/markdown'}));
  }catch(err){
    showError('Speichern fehlgeschlagen: '+(err&&err.message?err.message:err));
    return;
  }
  hideError();
  mdOrig=mdText;
  lastSaved=new Date();
  updateStatus();
}
function mUpdateStatus(){
  syncSaveUi();
  btnSave.disabled=!handle;
  if(!handle){statusEl.textContent='';return;}
  if(mdText!==mdOrig){statusEl.textContent='● Ungespeicherte Änderungen';statusEl.className='dirty';}
  else {statusEl.textContent=savedStatusText();statusEl.className=lastSaved?'clean':'neutral';}
}
