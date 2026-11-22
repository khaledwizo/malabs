// صفحة «سيرفر الرافدين»: تعمل على الهاتف الوسيط وتدير المباراة بلا رسوميات
import { Builder, NULL_GFX } from './world/builder.js';
import { buildSouq } from './world/maps/souq.js';
import { GameServer } from './net/server.js';
import { roomCode } from './net/link.js';
import { MODES } from './sim/weapons.js';
import { CHARS } from './game/chardefs.js';
import { TEAMS } from './sim/sim.js';

const $ = s => document.querySelector(s);
const AND = window.RafidainServer || null; // جسر تطبيق أندرويد
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const store = { get(k, d) { try { const v = localStorage.getItem('rafidain.srv.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('rafidain.srv.' + k, JSON.stringify(v)); } catch (e) { } } };

const B = new Builder(NULL_GFX); buildSouq(B); const world = B.finish();
let room = store.get('room', null); if (!room) { room = roomCode(); store.set('room', room); }
const cfg = Object.assign({ mode: 'tdm', size: 4, rounds: 5, time: 600, difficulty: 'normal', fill: true }, store.get('cfg', {}));
if (!MODES[cfg.mode]) cfg.mode = 'tdm';
const logs = [];
const log = t => { const d = new Date(); logs.unshift(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}  ${t}`); logs.length = Math.min(logs.length, 40); renderLog(); };

let srv = null;
async function boot() {
  if (srv) srv.stop();
  $('#code').textContent = room;
  if (AND) try { AND.room(room); } catch (e) { }
  srv = new GameServer(world, { room, cfg, log, onChange: render });
  log('تشغيل السيرفر · الغرفة ' + room);
  try { await srv.start(); log('متصل بالإنترنت · بانتظار اللاعبين'); }
  catch (e) { log('تعذّر الاتصال: ' + e.message + ' — إعادة المحاولة'); setTimeout(boot, 4000); }
  render();
}

// ---------- الواجهة ----------
function seg(id, items, key) {
  const el = $(id);
  el.innerHTML = items.map(([v, l, sub]) => `<button class="opt ${cfg[key] === v ? 'sel' : ''}" data-v="${v}"><b>${l}</b>${sub ? `<small>${sub}</small>` : ''}</button>`).join('');
  el.querySelectorAll('.opt').forEach(b => b.onclick = () => { const v = b.dataset.v; cfg[key] = v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v; buildForm(); $('#apply').classList.add('pulse'); });
}
function buildForm() {
  seg('#fMode', Object.entries(MODES).map(([k, m]) => [k, m.name, m.desc]), 'mode');
  seg('#fSize', [[2, '2 ضد 2'], [3, '3 ضد 3'], [4, '4 ضد 4'], [5, '5 ضد 5']], 'size');
  if (MODES[cfg.mode].rules !== 'rounds') seg('#fRounds', [[300, '5 دقائق'], [600, '10 دقائق'], [900, '15 دقيقة'], [1200, '20 دقيقة']], 'time');
  else seg('#fRounds', [[3, 'قصيرة', '3 جولات للفوز'], [5, 'عادية', '5 جولات'], [7, 'طويلة', '7 جولات']], 'rounds');
  seg('#fDiff', [['easy', 'سهل'], ['normal', 'عادي'], ['hard', 'صعب']], 'difficulty');
  seg('#fFill', [[true, 'نعم', 'بوتات تكمل الفريق الناقص'], [false, 'لا', 'بشر فقط']], 'fill');
}
const PH = { wait: 'بانتظار اللاعبين', buy: 'وقت التجهيز', live: 'القتال جارٍ', end: 'نهاية الجولة', over: 'انتهت المباراة' };
function fmt(s) { const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return h ? `${h} س ${m} د` : `${m} د ${s % 60} ث`; }
let lastR = 0;
function render() {
  if (!srv) return;
  const t = performance.now(); if (t - lastR < 200) return; lastR = t;
  const I = srv.info(), humans = I.players.filter(p => !p.bot);
  const ok = /متصل|بانتظار|مباشر/.test(I.status);
  $('#dot').className = 'dot ' + (ok ? 'ok' : 'warn');
  $('#stat').textContent = I.status;
  $('#tick').textContent = I.tick ? I.tick + ' Hz' : '—';
  $('#up').textContent = fmt(I.up);
  $('#hum').textContent = humans.length;
  $('#phase').textContent = humans.length ? `${PH[I.phase] || I.phase} · الجولة ${I.round || 0} · ${MODES[I.mode].name}` : PH.wait;
  $('#score').innerHTML = `<span class="t0">${TEAMS[0].name} <b>${I.score[0]}</b></span><span class="t1"><b>${I.score[1]}</b> ${TEAMS[1].name}</span>`;
  const rows = I.players.sort((a, b) => a.team - b.team || a.bot - b.bot).map(p => `<tr class="${p.alive ? '' : 'dead'}"><td><i class="tm t${p.team}"></i>${esc(p.name)}${p.bot ? ' <em>بوت</em>' : ''}</td><td>${esc(CHARS[p.char] ? CHARS[p.char].name : p.char)}</td><td>${p.k}/${p.d}</td><td>${p.bot ? '—' : (p.rtt ? p.rtt + 'ms' : '…')}</td><td>${p.bot ? '' : p.via === 'p2p' ? '<span class="v p2p">مباشر</span>' : '<span class="v">وسيط</span>'}</td></tr>`).join('');
  $('#plist').innerHTML = rows || '<tr><td colspan="5" class="empty">لا أحد بعد — شارك رمز الغرفة مع أصدقائك</td></tr>';
}
function renderLog() { const el = $('#log'); if (el) el.innerHTML = logs.map(l => `<div>${esc(l)}</div>`).join(''); }

$('#apply').onclick = () => { store.set('cfg', cfg); $('#apply').classList.remove('pulse'); if (srv) { srv.configure({ ...cfg }); log('إعدادات جديدة: ' + MODES[cfg.mode].name + ' · ' + cfg.size + ' ضد ' + cfg.size); } };
$('#newCode').onclick = () => { if (!confirmNew()) return; room = roomCode(); store.set('room', room); boot(); };
$('#copy').onclick = () => { try { if (AND) AND.copy(room); else navigator.clipboard.writeText(room); $('#copy').textContent = 'نُسخ ✓'; setTimeout(() => $('#copy').textContent = 'نسخ', 1500); } catch (e) { } };
const shareText = () => `تعال نلعب «جبهة الرافدين»!\nافتح اللعبة ← الإعدادات ← سيرفر خاص ← اكتب رمز الغرفة: ${room}`;
$('#share').onclick = () => { try { if (AND) AND.share(shareText()); else if (navigator.share) navigator.share({ text: shareText() }); else navigator.clipboard.writeText(shareText()); } catch (e) { } };
// تحسين البطارية قد يوقف السيرفر في الخلفية
function battery() { const el = $('#batt'); if (!AND || !AND.batteryFree) { el.style.display = 'none'; return; } let free = true; try { free = AND.batteryFree(); } catch (e) { } el.style.display = free ? 'none' : ''; }
$('#battBtn').onclick = () => { try { AND.askBattery(); } catch (e) { } setTimeout(battery, 4000); };
battery(); document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(battery, 500); });
function confirmNew() { const b = $('#newCode'); if (b.dataset.arm) { delete b.dataset.arm; b.textContent = 'رمز جديد'; return true; } b.dataset.arm = 1; b.textContent = 'اضغط مرة أخرى للتأكيد'; setTimeout(() => { delete b.dataset.arm; b.textContent = 'رمز جديد'; }, 2500); return false; }
buildForm();
setInterval(render, 1000);
// إبقاء الشاشة مضاءة (المتصفح) — التطبيق يفعل ذلك تلقائياً
async function wake() { try { if (navigator.wakeLock) await navigator.wakeLock.request('screen'); } catch (e) { } }
document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
wake();
window.__srv = () => srv;
boot();
