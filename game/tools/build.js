// يجمع ملفات المصدر في صفحة HTML واحدة: dist/index.html
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const src = path.join(root, 'src');
const tpl = fs.readFileSync(path.join(src, 'template.html'), 'utf8');
const css = fs.readFileSync(path.join(src, 'style.css'), 'utf8');
const jsDir = path.join(src, 'js');
const files = fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).sort();
const js = files.map(f => '// ===== ' + f + ' =====\n' + fs.readFileSync(path.join(jsDir, f), 'utf8')).join('\n');
let progress = '';
try { progress = fs.readFileSync(path.join(root, 'PROGRESS.md'), 'utf8'); } catch (e) { }
const comment = progress ? '<!--\n' + progress.replace(/--/g, '—') + '\n-->' : '';
const out = tpl.replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => js).replace('<!--__PROGRESS__-->', () => comment);
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'index.html'), out);
fs.writeFileSync(path.join(root, 'dist', 'game.check.js'), '(() => {\n' + js + '\n})();\n');
console.log('built', (out.length / 1024).toFixed(1) + ' KB', files.length + ' js files');
