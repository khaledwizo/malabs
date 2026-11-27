// يجمع كل جمل أهل السوق والمقدّمة مع إعدادات صوت كل شخصية → lines.json للمولّد (tools/gen_voices.py)
// الاستعمال: node tools/voice_lines.mjs <out/lines.json>
import fs from 'fs';
import { PERSONAS, GROUPS, ttsText } from '../src/game/talkdata.js';
import { CAST, SCRIPT } from '../src/game/introdata.js';
import { QUESTS, FISHER_MEET, FIGHTERS, FISHER } from '../src/game/questdata.js';
import { voiceId, VOICE_NAMES } from '../src/core/voicekey.js';
import { MAJLIS_MEN, MAJLIS, SHEIKH_A, LECTURES, IMAM, IMAM_CALLS, DIGGER, PILGRIM, SHRINE_TALK } from '../src/game/mudhifdata.js';
import { STREET_TALK } from '../src/game/streettalk.js';

const out = [], seen = new Set();
const pct = v => (v >= 0 ? '+' : '') + v + '%';
const add = (per, text, loud, tag) => {
  const id = voiceId(per, text, loud); if (seen.has(id)) return; seen.add(id);
  out.push({ id, tag, voice: VOICE_NAMES[per.v], pitch: pct(per.p), rate: pct(per.r + (loud ? 6 : 0)), volume: loud ? '+25%' : '+0%', text: ttsText(text), shown: text });
};
PERSONAS.forEach((P, i) => {
  if (!P) return;
  for (const k of ['greet', 'call', 'react', 'calm']) for (const t of P[k] || []) add(P, t, false, `npc${i}:${k}`);
  for (const s of P.story || []) for (const t of s) add(P, t, false, `npc${i}:story`);
});
for (const G of GROUPS) for (const c of G.convos) for (const [r, t] of c) add(PERSONAS[G.ids[r]], t, false, `grp:${G.ids.join('-')}`);
for (const b of SCRIPT) if (b.who) add(CAST[b.who], b.text, !!b.loud, 'intro');
// حوارات المهام: صاحب المهمة، شخص الخطوة، مجاهدي الفلوجة، وجمل اللاعب بأصوات الشخصيات الأربع
const ME = ['khaled', 'mohammed', 'ibrahim', 'saif'].map(k => CAST[k]);
const who = (w, q, st) => {
  if (w === 't') return st && st.tgt ? st.tgt.per : st && st.confront ? st.confront.per : null;
  if (w === 'g') w = q.giver;
  if (w === 'n') w = st ? (st.to === 'g' ? q.giver : st.to === 'fighters' ? 'f2' : st.to) : q.giver;
  if (typeof w === 'string' && w[0] === 'f') return FIGHTERS[+w[1]];
  return typeof w === 'number' ? PERSONAS[w] : null;
};
const say = (w, t, q, st, tag) => { if (!t || t[0] === '(') return; if (w === 'me') { for (const P of ME) add(P, t, false, tag + ':me'); return; } const P = who(w, q, st); if (P) add(P, t, false, tag); };
const BAKER_I = 37;
const expanded = []; for (const q of QUESTS) { if (!q.vars) { expanded.push(q); continue; } for (const v of q.vars) expanded.push({ ...q, giver: v.giver, intro: v.intro, outro: [['g', 'هذا ثمنُه وهذهِ مكافأتُك، حفظَكَ الله.']], steps: [{ to: BAKER_I, say: v.say }, { to: 'g', say: v.back }] }); }
for (const q of expanded) {
  const tag = 'quest:' + q.id;
  for (const [w, t] of q.intro || []) say(w, t, q, null, tag);
  for (const [w, t] of q.outro || []) say(w, t, q, null, tag);
  for (const st of q.steps) {
    for (const [w, t] of [...(st.say || []), ...(st.after || []), ...((st.confront && st.confront.lines) || [])]) say(w, t, q, st, tag);
    // حچي المطلوبين قبل الاغتيال
    for (const T of (st.hit && st.hit.targets) || []) for (const [w, t] of T.lines || []) say(w, t, q, { ...st, tgt: T }, tag);
    for (const Q of st.quiz || []) { say('g', Q.ok, q, st, tag); say('g', Q.no, q, st, tag); for (const o of Q.opts) say('me', o, q, st, tag); }
    if (st.choose) for (const o of st.choose.opts) say('me', 'هذا ' + o.label + '.', q, st, tag);
    if (st.choose) say('n', 'اختيارٌ موفَّق! تفضَّل.', q, st, tag);
  }
}
// مضيف الشيخ: المجلس والمحاضرات ونداءات الإمام
for (const T of MAJLIS) for (const [k, t] of T.lines) add(MAJLIS_MEN[k], t, false, 'majlis');
for (const L of LECTURES) for (const t of L.lines) add(SHEIKH_A, t, false, 'lecture');
for (const t of Object.values(IMAM_CALLS)) add(IMAM, t, false, 'imam');
add(SHEIKH_A, SHRINE_TALK.greetDigger, false, 'shrine'); add(DIGGER, SHRINE_TALK.digger, false, 'shrine'); add(SHEIKH_A, SHRINE_TALK.greetPeople, false, 'shrine'); add(PILGRIM, SHRINE_TALK.people, false, 'shrine');
for (const T of STREET_TALK) for (const t of T.lines) add(T.per, t, false, 'street');
for (const [w, t] of FISHER_MEET) say(w === 'n' ? FISHER : w, t, { giver: FISHER }, null, 'quest:fisherMeet');
fs.mkdirSync(new URL('.', 'file://' + process.argv[2].replace(/^(?!\/)/, process.cwd() + '/')).pathname, { recursive: true });
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
console.log('lines', out.length, 'chars', out.reduce((s, l) => s + l.text.length, 0));
