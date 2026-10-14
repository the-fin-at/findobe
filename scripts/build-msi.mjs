import {readFile, writeFile, mkdir, mkdtemp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';

const root = fileURLToPath(new URL('../',import.meta.url));
const config = JSON.parse(await readFile(path.join(root,'src-tauri/tauri.conf.json'),'utf8'));
const version = config.version;
if (!/^\d+\.\d+\.\d+$/.test(version)) throw Error('MSI requires a three-part numeric version');
const parts = version.split('.').map(Number);
if(parts[0]>255||parts[1]>255||parts[2]>65535)throw Error('Version exceeds MSI limits');
// Never change this UpgradeCode for the FinDobe x64 per-machine product line.
const upgradeCode = 'BA217E1B-A2DB-489B-AE18-30D30C93D851';
const uuidBytes = createHash('sha1').update(Buffer.from(upgradeCode.replaceAll('-',''),'hex'))
  .update('FinDobe-x64-' + version).digest().subarray(0,16);
uuidBytes[6] = (uuidBytes[6] & 15) | 80; uuidBytes[8] = (uuidBytes[8] & 63) | 128;
const hex = uuidBytes.toString('hex').toUpperCase();
const productCode = `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
const payload = path.join(root,'dist/FinDobe-Windows-x64');
const dist = path.join(root,'dist');
const output = path.join(dist,`FinDobe-${version}-x64.msi`);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const exe = await readFile(path.join(payload,'FinDobe.exe'));
const pe = exe.readUInt32LE(0x3c);
if(exe.toString('ascii',pe,pe+4)!=='PE\0\0'||exe.readUInt16LE(pe+4)!==0x8664)throw Error('Payload is not a Windows x64 EXE');
const currentBuild = await readFile(path.join(root,'src-tauri/target/x86_64-pc-windows-gnu/release/findobe.exe'));
if(sha(exe)!==sha(currentBuild))throw Error('Portable payload differs from the latest Windows release build');
await mkdir(dist,{recursive:true});
const args = ['-a','x64','-D',`Version=${version}`,'-D',`ProductCode=${productCode}`,
  '-D',`UpgradeCode=${upgradeCode}`,'-D',`PayloadDir=${payload}`,
  '-D',`AssetsDir=${path.join(root,'ui/assets')}`,'-D',`IconPath=${path.join(root,'src-tauri/icons/icon.ico')}`,
  '-o',output,path.join(root,'packaging/windows/FinDobe.wxs')];
execFileSync('wixl',args,{stdio:'inherit'});
const checks = [
  ['Installed OR VersionNT64','FinDobe requires 64-bit Windows.'],
  ['Installed OR (WEBVIEW2_VERSION AND WEBVIEW2_VERSION <> "0.0.0.0")','Install Microsoft Edge WebView2 Evergreen Runtime for all users before installing FinDobe.'],
  ['Installed OR NOT FINDOBE_NEWER','A newer version of FinDobe is already installed.']
];
const temp = await mkdtemp(path.join(os.tmpdir(),'findobe-msi-'));
const conditionTable = path.join(temp,'LaunchCondition.idt');
await writeFile(conditionTable,'Condition\tDescription\r\ns255\tl255\r\nLaunchCondition\tCondition\r\n'+checks.map(row=>row.join('\t')).join('\r\n')+'\r\n');
execFileSync('msibuild',[output,'-i',conditionTable],{stdio:'inherit'});
// wixl 0.106 replaces this property while generating Upgrade rows.
execFileSync('msibuild',[output,'-q',"UPDATE `Property` SET `Value` = 'FINDOBE_OLD;FINDOBE_NEWER;WEBVIEW2_VERSION' WHERE `Property` = 'SecureCustomProperties'"],{stdio:'inherit'});
execFileSync(process.execPath,[path.join(root,'scripts/verify-msi.mjs'),output],{stdio:'inherit'});
const manifest = {name:'FinDobe',version,architecture:'x64',installScope:'perMachine',
  productCode:`{${productCode}}`,upgradeCode:`{${upgradeCode}}`,signed:false,windowsRuntimeTested:false,
  webView2:'Machine-wide Evergreen Runtime required; not included',
  msi:{file:path.basename(output),sha256:sha(await readFile(output))},files:[]};
for(const filename of ['FinDobe.exe','WebView2Loader.dll'])manifest.files.push({file:filename,sha256:sha(await readFile(path.join(payload,filename)))});
await writeFile(path.join(dist,`FinDobe-${version}-x64.manifest.json`),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest,null,2));
