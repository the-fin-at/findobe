import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile, mkdtemp, readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';

const root = fileURLToPath(new URL('../', import.meta.url));
const msi = path.resolve(process.argv[2]);
const table = (name, source = msi) => {
  const [header, , , ...rows] = execFileSync('msiinfo', ['export', source, name], {encoding:'utf8'}).trimEnd().split(/\r?\n/);
  const keys = header.split('\t');
  return rows.map(row => Object.fromEntries(row.split('\t').map((value, i) => [keys[i], value])));
};
const props = Object.fromEntries(table('Property').map(r => [r.Property,r.Value]));
const config = JSON.parse(await readFile(path.join(root,'src-tauri/tauri.conf.json'),'utf8'));
assert.equal(props.ProductVersion,config.version);
assert.equal(props.ProductName,'FinDobe');
assert.equal(props.UpgradeCode,'{BA217E1B-A2DB-489B-AE18-30D30C93D851}');
assert.equal(props.ALLUSERS,'1');
for (const name of ['FINDOBE_OLD','FINDOBE_NEWER','WEBVIEW2_VERSION']) assert(props.SecureCustomProperties.split(';').includes(name));
assert.match(execFileSync('msiinfo',['suminfo',msi],{encoding:'utf8'}),/Template: x64;1033/);
assert.equal(table('Directory').find(r=>r.Directory==='INSTALLFOLDER').Directory_Parent,'ProgramFiles64Folder');
assert.equal(table('Component').length,5);
for(const row of table('Component')) assert(Number(row.Attributes)&256);
assert.equal(table('Registry')[0].Root,'2');
assert.equal(table('RegLocator')[0].Type,'2'); // raw value, 32-bit registry view
assert.equal(table('RegLocator')[0].Root,'2');
assert.equal(table('AppSearch')[0].Property,'WEBVIEW2_VERSION');
const conditions = table('LaunchCondition').map(r=>r.Condition);
assert(conditions.includes('Installed OR VersionNT64'));
assert(conditions.includes('Installed OR NOT FINDOBE_NEWER'));
assert(conditions.includes('Installed OR (WEBVIEW2_VERSION AND WEBVIEW2_VERSION <> "0.0.0.0")'));
for(const name of ['InstallExecuteSequence','InstallUISequence']) {
  const seq=Object.fromEntries(table(name).map(r=>[r.Action,Number(r.Sequence)]));
  assert(seq.AppSearch<seq.LaunchConditions);
  assert(seq.FindRelatedProducts<seq.LaunchConditions);
  if(name==='InstallExecuteSequence') {
    assert(seq.InstallInitialize<seq.RemoveExistingProducts);
    assert(seq.RemoveExistingProducts<seq.ProcessComponents);
    assert(seq.RemoveExistingProducts<seq.InstallFinalize);
  }
}
const upgrades=table('Upgrade');
assert.equal(upgrades.find(r=>r.ActionProperty==='FINDOBE_NEWER').Attributes,'2');
assert.equal(upgrades.find(r=>r.ActionProperty==='FINDOBE_OLD').Attributes,'257');
assert.equal(upgrades.find(r=>r.ActionProperty==='FINDOBE_OLD').VersionMin,'0.0.0');
assert.equal(upgrades.find(r=>r.ActionProperty==='FINDOBE_OLD').VersionMax,props.ProductVersion);
assert.equal(upgrades.find(r=>r.ActionProperty==='FINDOBE_NEWER').VersionMin,props.ProductVersion);
for(const row of upgrades)assert.equal(row.UpgradeCode,props.UpgradeCode);
if(process.argv[3]) {
  const previous=path.resolve(process.argv[3]);
  const old=Object.fromEntries(table('Property',previous).map(r=>[r.Property,r.Value]));
  const versionNumber=value=>value.split('.').reduce((total,n,i)=>total+Number(n)*[65536*256,65536,1][i],0);
  assert(versionNumber(props.ProductVersion)>versionNumber(old.ProductVersion),'New MSI version must be higher');
  assert.equal(props.UpgradeCode,old.UpgradeCode,'UpgradeCode must remain stable');
  assert.notEqual(props.ProductCode,old.ProductCode,'Major upgrade needs a new ProductCode');
  const packageCode=source=>execFileSync('msiinfo',['suminfo',source],{encoding:'utf8'}).match(/Revision number \(UUID\): (.+)/)?.[1];
  assert(packageCode(msi));assert.notEqual(packageCode(msi),packageCode(previous));
  const components=new Map(table('Component',previous).map(r=>[r.Component,r.ComponentId]));
  for(const row of table('Component'))assert.equal(row.ComponentId,components.get(row.Component),'Existing component identity changed');
  console.log(`Upgrade metadata verified: ${old.ProductVersion} -> ${props.ProductVersion}; stable UpgradeCode/components, new ProductCode/PackageCode.`);
}
assert.equal(table('Shortcut')[0].Target,'[INSTALLFOLDER]FinDobe.exe');
assert.equal(table('Media')[0].Cabinet,'#FinDobe.cab');
assert.equal(table('File').length,4);
const extracted=await mkdtemp(path.join(os.tmpdir(),'findobe-msi-verify-'));
execFileSync('msiextract',['--directory',extracted,msi],{stdio:'pipe'});
async function walk(dir) {
  const result=[];
  for(const entry of await readdir(dir,{withFileTypes:true})) {
    const name=path.join(dir,entry.name);
    result.push(...(entry.isDirectory()?await walk(name):[name]));
  }
  return result;
}
const files=await walk(extracted);
assert.equal(files.length,4);
const expected={
  'FinDobe.exe':'dist/FinDobe-Windows-x64/FinDobe.exe',
  'WebView2Loader.dll':'dist/FinDobe-Windows-x64/WebView2Loader.dll',
  'Markdown-editor-LICENSES.txt':'ui/assets/Markdown-editor-LICENSES.txt',
  'DOMPurify-LICENSE.txt':'ui/assets/DOMPurify-LICENSE'
};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
for(const file of files) {
  const source=expected[path.basename(file)];
  assert(source,`Unexpected payload: ${file}`);
  assert.equal(sha(await readFile(file)),sha(await readFile(path.join(root,source))));
}
console.log('MSI static checks passed: x64, machine scope, prerequisites, upgrade sequencing, embedded payload hashes (4/4). Windows runtime test still required.');
