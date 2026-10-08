async page => {
  const measurements=[];
  for(const dpr of [1,2]){
    const context=await page.context().browser().newContext({viewport:{width:1240,height:900},deviceScaleFactor:dpr});
    const p=await context.newPage(), errors=[];
    p.on('pageerror',e=>errors.push(e.message));
    try{
      await p.addInitScript(()=>{
        if(window!==top)return;
        window.files={};window.docs=new Map();window.writes=[];let serial=0;
        window.__TAURI__={core:{invoke:async(cmd,args={})=>{
          if(cmd==='take_pending_files')return null;
          if(cmd==='open_path'){
            const d={id:++serial,path:args.path,name:args.path.slice(1),text:files[args.path],encoding:'base64'};
            docs.set(d.id,d);return {...d};
          }
          if(cmd==='release_document'){docs.delete(args.id);return;}
          if(cmd==='save_document'){
            const d=docs.get(args.id);files[d.path]=args.content;writes.push(args);return {path:d.path,name:d.name};
          }
          if(cmd==='read_resource')throw Error('No resources');
          throw Error(cmd);
        }},event:{listen:async()=>()=>{}}};
        window.peak={count:0,bytes:0};window.violations=[];
        window.sample=()=>{
          const counts=[];let bytes=0;
          for(const tab of window.FinDobeTabs?tabs:[]){
            const canvases=[...tab.frame.contentDocument.querySelectorAll('canvas')].filter(c=>c.width&&c.height);
            counts.push(canvases.length);bytes+=canvases.reduce((sum,c)=>sum+c.width*c.height*4,0);
            if(canvases.length>6)violations.push('page budget');
            if(tab.frame.hidden&&canvases.length)violations.push('hidden tab buffers');
          }
          peak.count=Math.max(peak.count,...counts);peak.bytes=Math.max(peak.bytes,bytes);
          if(bytes>64*1024*1024)violations.push('byte budget');
          return {counts,bytes};
        };
        setInterval(()=>sample(),10);
      });
      await p.goto('http://127.0.0.1:17893/tabs.html');
      await p.evaluate(async()=>{
        const script=document.createElement('script');script.src='pdf-lib.js';document.head.append(script);await new Promise(r=>script.onload=r);
        const d=await PDFLib.PDFDocument.create(),f=await d.embedFont(PDFLib.StandardFonts.Helvetica);
        for(let i=0;i<100;i++){
          const pg=d.addPage([595,842]);pg.drawText('Page '+i+' original',{x:60,y:750,size:22,font:f});
          pg.drawText('Second line stays',{x:60,y:700,size:14,font:f});
        }
        const bytes=await d.save({useObjectStreams:false});window.sourceBytes=bytes.length;
        files['/first.pdf']=btoa(String.fromCharCode(...bytes));files['/second.pdf']=files['/first.pdf'];
        await FinDobeTabs.open('/first.pdf');
      });
      const frame=()=>p.frameLocator('.document-frame:not([hidden])');
      const wait=()=>p.waitForFunction(()=>!busy&&!active.api.info().blocked);
      const check=async(fn,message)=>{if(!await p.evaluate(fn))throw Error('DPR '+dpr+': '+message);};
      const render=()=>p.evaluate(()=>active.frame.contentWindow.renderVisiblePdfPages());
      const snapshot=()=>p.evaluate(()=>({budget:sample(),peak,scroll:active.frame.contentDocument.querySelector('#scroller').scrollTop}));
      const scrollTo=async index=>{
        await p.evaluate(i=>active.frame.contentWindow.eval(`model.pages[${i}].wrap.scrollIntoView({block:'center'})`),index);
        await render();
        await check(()=>active.frame.contentDocument.querySelectorAll('.pageWrap').length===100,'placeholders missing');
        await p.waitForFunction(i=>{const c=active.frame.contentDocument.querySelectorAll('canvas')[i];return c.width>0&&c.height>0;},index);
      };
      await wait();await render();
      const original=await p.evaluate(()=>files['/first.pdf']);
      await check(()=>active.frame.contentDocument.querySelectorAll('.titem').length===200,'offscreen text/search state missing');
      const first=await snapshot();
      for(const index of [25,49,99,80,0,49])await scrollTo(index);
      // A far-away text spot is a real keyboard action; editing must survive eviction.
      const spot=frame().locator('.pageWrap').nth(49).locator('.titem').first();
      await spot.focus();await spot.press('Enter');await frame().locator('#editBox').fill('Page 49 changed');
      await frame().locator('#editBox').press('Enter');await wait();await render();
      await check(()=>active.frame.contentDocument.activeElement.classList.contains('titem'),'edit focus lost');
      await scrollTo(0);await scrollTo(99);
      await frame().locator('body').press('ControlOrMeta+z');await wait();
      const undone=await p.evaluate(async()=>{const w=active.frame.contentWindow;return w.encodeBinary(await w.currentBytes());});
      if(undone!==original)throw Error('DPR '+dpr+': evicted-page undo changed bytes');
      await frame().locator('body').press('ControlOrMeta+Shift+z');await wait();
      await p.locator('#btnSave').click();await wait();
      const saved=await p.evaluate(()=>files['/first.pdf']);
      await scrollTo(49);
      await frame().locator('.pageWrap').nth(49).locator('.titem').first().focus();
      const beforeZoom=await snapshot();
      await p.evaluate(()=>active.frame.contentWindow.setZoom(1.6));await wait();await render();
      await check(()=>active.frame.contentDocument.activeElement.classList.contains('titem'),'zoom focus lost');
      await check(()=>{
        const w=active.frame.contentWindow, spot=w.document.querySelectorAll('.pageWrap')[49].getBoundingClientRect();
        const viewport=w.document.querySelector('#scroller').getBoundingClientRect();return spot.bottom>viewport.top&&spot.top<viewport.bottom;
      },'zoom lost visible page');
      await p.evaluate(async()=>{
        const w=active.frame.contentWindow;await Promise.all([w.setZoom(3.8),w.setZoom(2.8),w.fitZoom(true)]);
      });await wait();await render();
      // Return to fit; switching at unchanged geometry must not rebuild placeholders.
      await frame().locator('#zoomFit').click();await wait();await render();
      const scroll=await p.evaluate(()=>active.frame.contentDocument.querySelector('#scroller').scrollTop);
      await p.evaluate(()=>FinDobeTabs.open('/second.pdf'));await wait();await render();
      await check(()=>tabs[0].frame.contentDocument.querySelectorAll('canvas[width="0"]').length===100,'hidden buffers retained');
      await p.locator('.tab-select').first().click();await wait();await render();
      const restored=await p.evaluate(()=>active.frame.contentDocument.querySelector('#scroller').scrollTop);
      if(Math.abs(scroll-restored)>2)throw Error('DPR '+dpr+': tab scroll lost');
      await check(()=>!active.api.info().dirty,'tab switch changed saved state');
      // Search must reach a currently evicted page and trigger its raster window.
      await p.locator('#btnSearch').click();await frame().locator('#findInput').fill('Page 80 original');
      await frame().locator('#findInput').press('Enter');await render();
      await p.waitForFunction(()=>active.frame.contentDocument.querySelectorAll('canvas')[80].width>0);
      await check(()=>active.frame.contentDocument.querySelector('.findcur')?.getAttribute('aria-label').includes('Page 80'),'offscreen search lost text');
      await frame().locator('#findInput').press('Escape');
      await p.evaluate(()=>FinDobeTabs.open('/second.pdf'));await wait();
      await p.locator('.tab-close').first().click();
      await p.waitForFunction(()=>tabs.length===1);
      await p.evaluate(()=>FinDobeTabs.open('/first.pdf'));await wait();await render();
      const independentText=await p.evaluate(async()=>{
        const w=active.frame.contentWindow;const page=await w.eval('pdfDoc.getPage(50)');
        return (await page.getTextContent()).items.map(i=>i.str).join(' ');
      });
      if(!independentText.includes('Page 49 changed')||!independentText.includes('Second line stays'))throw Error('Saved content lost');
      if(await p.evaluate(()=>files['/first.pdf'])!==saved)throw Error('Reopening changed exported PDF bytes');
      await scrollTo(99);
      await p.screenshot({path:'test-results/pdf-cache-dpr-'+dpr+'.png'});
      await check(()=>violations.length===0,'canvas budget exceeded: '+await p.evaluate(()=>violations));
      if(errors.length)throw Error(errors.join('\n'));
      measurements.push({dpr,sourceBytes:await p.evaluate(()=>sourceBytes),first,beforeZoom,final:await snapshot(),
        checks:'100 placeholders; bounded canvas window/bytes; scroll, zoom, focus, hidden tabs, edit/eviction/undo/save/reopen/search',errors});
      await p.evaluate(async()=>{
        const d=await PDFLib.PDFDocument.create(),f=await d.embedFont(PDFLib.StandardFonts.Helvetica);
        for(let i=0;i<16;i++)d.addPage([595,30]).drawText('Short page '+i,{x:30,y:10,size:12,font:f});
        const b=await d.save({useObjectStreams:false});files['/short.pdf']=btoa(String.fromCharCode(...b));
        await FinDobeTabs.open('/short.pdf');
      });await wait();await render();
      await check(()=>{
        const doc=active.frame.contentDocument,rect=doc.querySelector('#scroller').getBoundingClientRect();
        const visible=[...doc.querySelectorAll('.pageWrap')].filter(el=>{const box=el.getBoundingClientRect();return box.bottom>rect.top&&box.top<rect.bottom;});
        return visible.length>6&&visible.every(el=>el.querySelector('canvas').width>0)
          &&[...doc.querySelectorAll('canvas')].reduce((sum,c)=>sum+c.width*c.height*4,0)<=64*1024*1024;
      },'short visible pages left blank');
      measurements.at(-1).shortPages='All simultaneous visible short pages rendered within 64 MiB';
    }finally{await context.close();}
  }
  return measurements;
}
