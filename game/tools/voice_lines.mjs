// يجمع كل جمل أهل السوق والمقدّمة مع إعدادات صوت كل شخصية → lines.json للمولّد (tools/gen_voices.py)
// الاستعمال: node tools/voice_lines.mjs <out/lines.json>
import fs from 'fs';
import { PERSONAS, GROUPS, ttsText } from '../src/game/talkdata.js';
import { CAST, SCRIPT } from '../src/game/introdata.js';
import { voiceId, VOICE_NAMES } from '../src/core/voicekey.js';

const out = [], seen = new Set();
const pct = v => (v >= 0 ? '+' : '') + v + '%';
const add = (per, text, loud, tag) => {
  const id = voiceId(per, text, loud); if (seen.has(id)) return; seen.add(id);
  out.push({ id, tag, voice: VOICE_NAMES[per.v], pitch: pct(per.p), rate: pct(per.r + (loud ? 6 : 0)), volume: loud ? '+25%' : '+0%', text: ttsText(text), shown: text });
};
PERSONAS.forEach((P, i) => {
  for (const k of ['greet', 'call', 'react', 'calm']) for (const t of P[k] || []) add(P, t, false, `npc${i}:${k}`);
  for (const s of P.story || []) for (const t of s) add(P, t, false, `npc${i}:story`);
});
for (const G of GROUPS) for (const c of G.convos) for (const [r, t] of c) add(PERSONAS[G.ids[r]], t, false, `grp:${G.ids.join('-')}`);
for (const b of SCRIPT) if (b.who) add(CAST[b.who], b.text, !!b.loud, 'intro');
fs.mkdirSync(new URL('.', 'file://' + process.argv[2].replace(/^(?!\/)/, process.cwd() + '/')).pathname, { recursive: true });
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
console.log('lines', out.length, 'chars', out.reduce((s, l) => s + l.text.length, 0));
