import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../ui/native-file-open.js', import.meta.url),'utf8');
const nativeSource = await readFile(new URL('../ui/native.js', import.meta.url),'utf8');
const openFunction = nativeSource.slice(nativeSource.indexOf('openPicker = async function nativeOpen'), nativeSource.indexOf('\nexportPdf ='));
const tick = () => new Promise(resolve => setImmediate(resolve));
function harness() {
  const ctx={window:{},setTimeout};
  vm.runInNewContext(source,ctx);
  let handler, busy=false;
  const pending=[], opened=[], errors=[];
  return {pending,opened,errors, setBusy:value=>busy=value, signal:()=>handler(),
    start:open=>ctx.window.FinDobeFileOpen({
      listen:async (_event,fn)=>{handler=fn;}, takeNext:async ()=>pending.shift()??null,
      isBusy:()=>busy, open:open??(async path=>opened.push(path)), reportError:error=>errors.push(error)
    })};
}
test('cold launch drains stored path without needing an event',async ()=>{
  const h=harness(); h.pending.push(['/tmp/Grüße # Notiz.md']); await h.start();
  assert.deepEqual(h.opened,['/tmp/Grüße # Notiz.md']);
});
test('warm events are serialized while an unsaved decision is pending',async ()=>{
  const h=harness(); let finish, active=0, max=0;
  await h.start(async path=>{active++; max=Math.max(max,active); h.opened.push(path); if(path==='first')await new Promise(r=>finish=r); active--;});
  h.pending.push(['first']); h.signal(); await tick();
  h.pending.push(['second']); h.signal(); await tick();
  assert.deepEqual(h.opened,['first']); finish(); await tick(); await tick();
  assert.deepEqual(h.opened,['first','second']); assert.equal(max,1);
});
test('busy editor defers rather than drops Finder request',async ()=>{
  const h=harness(); h.setBusy(true); h.pending.push(['later.md']); await h.start();
  assert.equal(h.opened.length,0); h.setBusy(false);
  await new Promise(r=>setTimeout(r,200)); assert.deepEqual(h.opened,['later.md']);
});
test('multi-file selection is rejected without replacing current document',async ()=>{
  const h=harness(); h.pending.push(['one.md','two.md']); await h.start();
  assert.equal(h.opened.length,0); assert.match(h.errors[0],/einzelne Datei/);
});
test('file-open failure is reported and later requests still work',async ()=>{
  const h=harness(); await h.start(async path=>{if(path==='bad')throw Error('missing'); h.opened.push(path);});
  h.pending.push(['bad']); h.signal(); await tick(); assert.match(h.errors[0],/missing/);
  h.pending.push(['good']); h.signal(); await tick(); assert.deepEqual(h.opened,['good']);
});
test('opening while saving does not clear the existing busy state',async ()=>{
  const ctx={tabHost:false,working:true,openingDocument:false,mayLeave:()=>{throw Error('should not be called');},setWorking:()=>{throw Error('should not be called');}};
  vm.runInNewContext(openFunction,ctx);
  await ctx.openPicker('/tmp/next.md');
  assert.equal(ctx.working,true); assert.equal(ctx.openingDocument,false);
});
test('canceling unsaved decision never reads or replaces the requested file',async ()=>{
  let reads=0,loads=0;
  const ctx={tabHost:false,working:false,openingDocument:false,mayLeave:async()=>false,
    setWorking:()=>{},call:async()=>{reads++;},loadNative:async()=>{loads++;},showError:()=>{}};
  vm.runInNewContext(openFunction,ctx);
  await ctx.openPicker('/tmp/next.md');
  assert.equal(reads,0); assert.equal(loads,0); assert.equal(ctx.openingDocument,false);
});
