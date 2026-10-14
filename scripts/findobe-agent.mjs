#!/usr/bin/env node
// Local agent tool. Connection credentials are read from a mode-0600 manifest,
// never printed or put on the command line. FINDOBE_AGENT_MANIFEST selects an instance.
import {readdir,readFile,stat} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {stdin,argv,env,platform} from 'node:process';
export async function connect(manifest=env.FINDOBE_AGENT_MANIFEST) {
  let info;
  if(manifest)info=JSON.parse(await readFile(manifest,'utf8'));
  else {
    const root=platform==='darwin'?join(homedir(),'Library','Application Support','at.the-fin.findobe'):platform==='win32'?join(env.LOCALAPPDATA||homedir(),'at.the-fin.findobe'):join(env.XDG_DATA_HOME||join(homedir(),'.local','share'),'at.the-fin.findobe');
    const candidates=await Promise.all((await readdir(root)).filter(n=>/^agent-\d+\.json$/.test(n)).map(async name=>({name,at:(await stat(join(root,name))).mtimeMs})));
    const names=candidates.sort((a,b)=>b.at-a.at).map(c=>c.name);
    for(const name of names){const candidate=JSON.parse(await readFile(join(root,name),'utf8'));try{process.kill(candidate.pid,0);info=candidate;break;}catch{}}
  }
  if(!info)throw Error('Keine laufende Findobe-App gefunden. Bitte Findobe starten.');
  if(!Number.isInteger(info.port)||info.port<1||info.port>65535||typeof info.token!=='string')throw Error('Ungültige lokale Verbindung.');
  return async request=>{for(let attempt=0;attempt<30;attempt++){const response=await fetch('http://127.0.0.1:'+info.port+'/rpc',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+info.token},body:JSON.stringify(request),signal:AbortSignal.timeout(65000)});const result=await response.json();if(result.code==='STARTING'){await new Promise(resolve=>setTimeout(resolve,100));continue;}if(!result.ok)throw Error(result.error);return result.result;}throw Error('Editor ist noch nicht bereit. Bitte erneut versuchen.');};
}
if(argv[1]&&import.meta.url===pathToFileURL(argv[1]).href) {
  try {
    let request;
    if(argv[2]==='--json')request=JSON.parse(await readFile(argv[3],'utf8'));
    else if(argv[2]==='--stdin'){let text='';for await(const chunk of stdin)text+=chunk;request=JSON.parse(text);}
    else {request={method:argv[2]||'list'};if(argv[3])request.documentId=Number(argv[3]);}
    const rpc=await connect();console.log(JSON.stringify(await rpc(request),null,2));
  }catch(e){console.error(e.message);process.exitCode=1;}
}
