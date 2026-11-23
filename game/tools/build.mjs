// يجمع اللعبة (وحدات ES + three.js) في صفحة HTML واحدة: dist/index.html
import { build } from '/opt/npm-tools/node_modules/esbuild/lib/main.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const minify = !process.argv.includes('--dev');
const threePath = process.env.THREE_PATH || path.join(root, 'vendor', 'three.module.js');
const bundle = async entry => (await build({
  entryPoints: [path.join(root, 'src', entry)],
  bundle: true, format: 'iife', write: false, minify, target: ['es2020'], legalComments: 'none',
  alias: { three: threePath },
  define: { __DEV__: minify ? 'false' : 'true' },
  logLevel: 'warning', loader: { '.jpg': 'dataurl', '.png': 'dataurl' },
})).outputFiles[0].text;
const safe = js => js.replace(/<\/script/gi, '<\\/script');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
// اللعبة
const js = await bundle('main.js');
const tpl = fs.readFileSync(path.join(root, 'src', 'template.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src', 'style.css'), 'utf8');
let notes = '';
try { notes = fs.readFileSync(path.join(root, 'PROGRESS.md'), 'utf8'); } catch (e) { }
const out = tpl.replace('/*__CSS__*/', () => css)
  .replace('/*__JS__*/', () => safe(js))
  .replace('<!--__PROGRESS__-->', () => notes ? '<!--\n' + notes.replace(/--/g, '—') + '\n-->' : '');
fs.writeFileSync(path.join(root, 'dist', 'index.html'), out);
console.log('built index.html', (out.length / 1024 / 1024).toFixed(2) + ' MB', minify ? '(min)' : '(dev)');
// السيرفر المركزي (تطبيق «سيرفر الرافدين»): لوحة الإدارة + المحرك، وكود عامل المعركة مضمّن كنص
const wjs = await bundle('hub_worker.js');
const hjs = await bundle('hub_main.js');
const htpl = fs.readFileSync(path.join(root, 'src', 'hub.html'), 'utf8');
const hout = htpl.replace('/*__WORKER__*/', () => safe(wjs)).replace('/*__JS__*/', () => safe(hjs));
fs.writeFileSync(path.join(root, 'dist', 'server.html'), hout);
console.log('built server.html', (hout.length / 1024).toFixed(0) + ' KB', '(worker ' + (wjs.length / 1024).toFixed(0) + ' KB)');
