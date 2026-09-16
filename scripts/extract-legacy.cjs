// One-time mechanical split of the existing offline editor into app assets.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const file = path.join(root, 'ui/index.html');
let html = fs.readFileSync(file, 'utf8');
const names = ['pdf.js', 'pdf-lib.js', 'pdf-worker-data.js', 'editor.js'];
let i = 0;
html = html.replace(/<script>([\s\S]*?)<\/script>/g, (_, code) => {
  const name = names[i++];
  if (!name) throw new Error('Unexpected script');
  fs.writeFileSync(path.join(root, 'ui', name), code);
  return '<script src="' + name + '"></script>';
});
if (i !== 4) throw new Error('Unexpected source structure');
html = html.replace(/<style>([\s\S]*?)<\/style>/, (_, css) => {
  fs.writeFileSync(path.join(root, 'ui/legacy.css'), css);
  return '<link rel="stylesheet" href="legacy.css">\n<link rel="stylesheet" href="brand.css">';
});
html = html.replace('</body>', '<script src="native.js"></script>\n</body>');
fs.writeFileSync(file, html);
const brandFile = process.argv[2];
if (brandFile) {
  const source = fs.readFileSync(brandFile, 'utf8');
  const fonts = source.split('\n').filter(l => l.startsWith('@font-face'));
  fs.writeFileSync(path.join(root, 'ui/assets/fonts.css'), fonts.join('\n'));
}
