import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readdir} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
const run=promisify(execFile);
if(process.platform!=='darwin')throw Error('Dieser Launcher ist für macOS. Auf anderen Plattformen eine leere App starten und test:native-documents mit FINDOBE_AGENT_MANIFEST verwenden.');
const root=join(homedir(),'Library','Application Support','at.the-fin.findobe');
const before=new Set(await readdir(root).catch(()=>[]));
await run('/usr/bin/open',['-n',resolve(process.argv[2]||'src-tauri/target/release/bundle/macos/FinDobe.app')]);
let manifest;
for(let attempt=0;attempt<100;attempt++){
  const fresh=(await readdir(root)).find(name=>/^agent-\d+\.json$/.test(name)&&!before.has(name));
  if(fresh){manifest=join(root,fresh);break;}await new Promise(resolve=>setTimeout(resolve,100));
}
if(!manifest)throw Error('Keine neue App-Instanz gefunden.');
const result=await run(process.execPath,['tests/native-document-e2e.mjs'],{env:{...process.env,FINDOBE_AGENT_MANIFEST:manifest},maxBuffer:1024*1024,timeout:300000});process.stdout.write(result.stdout);process.stderr.write(result.stderr);
