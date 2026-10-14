import {build} from 'esbuild';
import {readFile, writeFile, copyFile} from 'node:fs/promises';

const result = await build({entryPoints:['frontend/markdown-editor.js'], bundle:true,
  outfile:'ui/markdown-editor.js', format:'iife', target:['safari15','chrome100'], minify:true, metafile:true});
const packages = [...new Set(Object.keys(result.metafile.inputs).map(p => {
  const match = /node_modules\/((?:@[^/]+\/)?[^/]+)/.exec(p);
  return match?.[1];
}).filter(Boolean))];
const licenses = await Promise.all(packages.sort().map(async name => {
  return name + '\n' + await readFile('node_modules/' + name + '/LICENSE','utf8');
}));
await writeFile('ui/assets/Markdown-editor-LICENSES.txt',licenses.join('\n\n---\n\n'));

const documents = await build({entryPoints:['frontend/document/editor.js'], bundle:true, outfile:'ui/document-editor.js', format:'iife', target:['safari15','chrome100'], minify:true, metafile:true});
const documentPackages = [...new Set(Object.keys(documents.metafile.inputs).map(p => /node_modules\/((?:@[^/]+\/)?[^/]+)/.exec(p)?.[1]).filter(Boolean))];
const documentLicenses = await Promise.all(documentPackages.sort().map(async name => {
  for (const file of ['LICENSE','LICENSE.md','LICENSE.txt','license','license.md','LICENSE-MIT']) { try {return name+'\n'+await readFile('node_modules/'+name+'/'+file,'utf8');} catch {} }
  return name+'\n'+JSON.parse(await readFile('node_modules/'+name+'/package.json','utf8')).license;
}));
await writeFile('ui/assets/Document-editor-LICENSES.txt',documentLicenses.join('\n\n---\n\n'));

await copyFile('node_modules/dompurify/dist/purify.min.js','ui/purify.min.js');

const workerSource = await readFile('ui/pdf-worker-data.js','utf8');
const workerMatch = /WORKER_B64=\"([^\"]+)\"/.exec(workerSource);
if (!workerMatch) throw Error('PDF worker data missing');
await writeFile('ui/pdf.worker.js',Buffer.from(workerMatch[1],'base64'));

const pdfEngine = await readFile('ui/pdf.js','utf8');
if (!pdfEngine.includes('!globalThis.__FIN_PDF_BACKGROUND_RENDER')) throw Error('Native PDF scheduler adapter missing; verify the PDF.js upgrade before building.');
