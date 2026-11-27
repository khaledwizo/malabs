// أنبوب الموارد (القسم 1) — يشتغل داخل GitHub Actions:
//   node game/tools/assets.mjs <manifest.json> <cacheDir> <outDir>
// 1) ينزّل كل مورد مرّة وحدة للكاش (cacheDir/raw) ويفحص رخصته (CC0 بس — المستودع عام)
// 2) يضغط: glb ← meshopt + تكستشرات ktx2 (toktx) وإذا ما توفّر toktx ← webp، وإذا فشل كلشي ← النسخة الأصلية
//    ogg ← ffmpeg opus 64k mono ؛ صور ← ktx2
// 3) يكتب outDir/manifest.js = window.__RES = { id: { file, bytes, license, author } } ويحفظ الناتج بالكاش (cacheDir/out)
import fs from 'fs'; import path from 'path'; import { execFileSync } from 'child_process'; import crypto from 'crypto';
const [manPath, cache, out] = process.argv.slice(2);
const M = JSON.parse(fs.readFileSync(manPath, 'utf8'));
const OK_LIC = /^(CC0|CC0-1\.0|CC-0|Public Domain)$/i;
fs.mkdirSync(path.join(cache, 'raw'), { recursive: true }); fs.mkdirSync(path.join(cache, 'out'), { recursive: true }); fs.mkdirSync(out, { recursive: true });
const sh = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], timeout: 15 * 60 * 1000 }).toString();
const has = cmd => { try { sh('which', [cmd]); return true; } catch (e) { return false; } };
async function get(url, dst) {
  if (fs.existsSync(dst) && fs.statSync(dst).size > 0) return 'cached';
  for (let i = 0; i < 3; i++) {
    try { const r = await fetch(url, { redirect: 'follow' }); if (!r.ok) throw new Error('HTTP ' + r.status); fs.writeFileSync(dst, Buffer.from(await r.arrayBuffer())); return 'downloaded'; }
    catch (e) { console.log('  retry', url, e.message); await new Promise(r => setTimeout(r, 3000)); }
  }
  throw new Error('download failed: ' + url);
}
const index = {}; const credits = [];
for (const a of M.assets) {
  const tag = `[${a.id}]`;
  try {
    // الرخصة: من الملف نفسه (licenseUrl) إذا موجود، وإلا من الحقل
    let lic = a.license || '';
    if (a.licenseUrl) { const t = await (await fetch(a.licenseUrl)).text(); const m = t.match(/"(?:spdx|license)"\s*:\s*"([^"]+)"/); if (m) lic = m[1]; }
    if (!OK_LIC.test(lic)) { console.log(tag, 'SKIP: license not CC0 →', lic); continue; }
    const ext = a.kind === 'glb' ? 'glb' : a.kind === 'ogg' ? 'ogg' : path.extname(a.url).slice(1) || 'bin';
    const raw = path.join(cache, 'raw', a.id + '.' + ext); console.log(tag, await get(a.url, raw), (fs.statSync(raw).size / 1e6).toFixed(2) + ' MB');
    const key = crypto.createHash('sha1').update(JSON.stringify(a) + fs.statSync(raw).size).digest('hex').slice(0, 10);
    const sub = a.kind === 'glb' ? 'models' : a.kind === 'ogg' ? 'sounds' : 'textures';
    const outExt = a.kind === 'glb' ? 'glb' : a.kind === 'ogg' ? 'ogg' : 'ktx2';
    const done = path.join(cache, 'out', `${a.id}.${key}.${outExt}`), dst = path.join(out, sub, `${a.id}.${outExt}`);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    if (!fs.existsSync(done)) {
      if (a.kind === 'glb') {
        const T = ['--yes', '@gltf-transform/cli@4', 'optimize', raw, done, '--compress', 'meshopt', '--texture-size', String(a.texSize || 1024)];
        try { if (!has('toktx')) throw new Error('no toktx'); sh('npx', [...T, '--texture-compress', 'ktx2']); console.log(tag, 'meshopt + ktx2'); }
        catch (e) { console.log(tag, 'ktx2 failed (' + e.message.split('\n')[0] + ') → webp'); try { sh('npx', [...T, '--texture-compress', 'webp']); } catch (e2) { console.log(tag, 'optimize failed → raw copy'); fs.copyFileSync(raw, done); } }
      } else if (a.kind === 'ogg') sh('ffmpeg', ['-loglevel', 'error', '-y', '-i', raw, '-c:a', 'libopus', '-b:a', '64k', '-ac', '1', done]);
      else sh('toktx', ['--t2', '--encode', 'etc1s', '--genmipmap', done, raw]);
    } else console.log(tag, 'from cache');
    fs.copyFileSync(done, dst);
    index[a.id] = { file: `${sub}/${a.id}.${outExt}`, bytes: fs.statSync(dst).size, license: lic, author: a.author || '' };
    credits.push(`${a.id}: ${a.author || ''} — ${lic}`);
    console.log(tag, '→', index[a.id].file, (index[a.id].bytes / 1e3).toFixed(0) + ' KB');
  } catch (e) { console.log(tag, 'FAILED', e.message); }
}
fs.writeFileSync(path.join(out, 'manifest.js'), 'window.__RES=' + JSON.stringify(index) + ';\n');
fs.writeFileSync(path.join(out, 'CREDITS.txt'), credits.join('\n') + '\n');
console.log('assets ready:', Object.keys(index).length, '/', M.assets.length);
