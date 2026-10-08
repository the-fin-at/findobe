import {build} from 'esbuild';
import {readFile, writeFile} from 'node:fs/promises';

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
