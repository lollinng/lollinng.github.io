import { EXERCISES, DAYS, SCHEDULES, PHASES, MUSCLE_TARGETS, FOODS, ALIASES, MEALS, MEAL_TEMPLATES, HABITS, MY_PROFILE, MY_HISTORY } from './data.js';
import { planView } from './plan.js';
import { parseMeal, buildIndex } from './meals.js';

// Backend (Cloudflare Worker, ~/personal/gym/worker). Empty = run fully offline with no sync, AI or photos.
const API = '';

// ---------- small utils ----------
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pad = (n) => String(n).padStart(2, '0');
const dkey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseD = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = parseD(k); d.setDate(d.getDate() + n); return dkey(d); };
const diffDays = (a, b) => Math.round((parseD(b) - parseD(a)) / 864e5);
const today = () => dkey();
const fmtDay = (k, o = { weekday: 'short', day: 'numeric', month: 'short' }) => parseD(k).toLocaleDateString('en-IN', o);
const fmtShort = (k) => parseD(k).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const roundTo = (x, step) => Math.round(x / step) * step;
const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
const kg = (w) => (w == null || w === '' ? '–' : String(+(+w).toFixed(2)));
const hm = (mins) => { const m = Math.round(mins); return `${Math.floor(m / 60)}h ${pad(m % 60)}m`; };
const mmss = (sec) => { const s = Math.max(0, Math.round(sec)); return `${Math.floor(s / 60)}:${pad(s % 60)}`; };
const weekStart = (k) => { const d = parseD(k); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dkey(d); };
const e1rm = (w, r) => (r > 0 ? w * (1 + r / 30) : 0);
const sum = (a) => a.reduce((x, y) => x + y, 0);
const avg = (a) => (a.length ? sum(a) / a.length : null);
const byDate = (a, b) => a.date.localeCompare(b.date) || (a.startedAt || '').localeCompare(b.startedAt || '');

// ---------- state ----------
const KEY = 'gym.v1';
const defaults = () => ({
  v: 1,
  profile: { ...MY_PROFILE },
  workouts: structuredClone(MY_HISTORY),
  active: null,
  food: {},
  custom: [],
  plan: null,
  sleep: [],
  bedPending: null,
  body: [{ date: MY_PROFILE.startDate, w: MY_PROFILE.weightKg }],
  habits: {},
  grocery: {},
  swaps: {},
  settings: { restHeavy: 150, restCompound: 120, restIso: 90, sound: true, vibrate: true, wake: true, notify: false },
  applied: MY_HISTORY.map((w) => w.id), // inbox / built-in entries already merged, so they never come back after a delete
});
let fresh = false; // nothing saved on this device yet: a new install can restore from the cloud
let S = load();
const ui = { foodTab: 'log', foodDate: today(), addMeal: 'Breakfast', addMode: 'log', liftEx: null, query: '', mtext: '', mrows: [], mskip: new Set(), mai: {}, mphoto: null, mbusy: false };
seedHistory();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const o = JSON.parse(raw); const d = defaults();
      return { ...d, ...o, profile: o.profile || d.profile, settings: { ...d.settings, ...(o.settings || {}) } };
    }
  } catch (e) { /* private mode or corrupt: start fresh */ }
  fresh = true;
  return defaults();
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Could not save on this device (storage blocked or full). Export a backup.'); }
  fresh = false;
  scheduleSync();
}
// Sessions added to MY_HISTORY after the first open get merged once (by id), even into existing data.
function seedHistory() {
  S.applied ||= [];
  const add = MY_HISTORY.filter((w) => !S.applied.includes(w.id));
  if (!add.length) return;
  for (const w of add) { if (!S.workouts.some((x) => x.id === w.id)) S.workouts.push(structuredClone(w)); S.applied.push(w.id); }
  if (!fresh) try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ }
}

// ---------- cloud sync ----------
// The whole state goes to the Worker a few seconds after each change; the reply carries the inbox
// (meals or sessions Claude added from chat), merged here once by id.
const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } return null; };
const SYNC_KEY = 'gym-sync';
const sync = { t: null, busy: false, dirty: false, last: +ls('gym-synced') || null, err: null };
function deviceId() { let d = ls('gym-device'); if (!d) { d = `d${uid()}`; ls('gym-device', d); } return d; }
const canSync = () => !!(API && unlocked && ls(SYNC_KEY));
async function api(path, body, opts = {}) {
  const r = await fetch(API + path, { method: body ? 'POST' : 'GET', headers: { authorization: `Bearer ${ls(SYNC_KEY)}`, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, ...opts });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}
function scheduleSync(ms = 4000) { if (!canSync()) return; sync.dirty = true; clearTimeout(sync.t); sync.t = setTimeout(pushSync, ms); }
function syncBody() {
  const bucket = `${today()}-${Math.floor(new Date().getHours() / 6)}`;
  return { body: { device: deviceId(), at: new Date().toISOString(), ua: navigator.userAgent, daily: ls('gym-hist') !== bucket, state: S }, bucket };
}
async function pushSync() {
  if (!canSync() || sync.busy) return;
  sync.busy = true; sync.dirty = false; clearTimeout(sync.t);
  const { body, bucket } = syncBody();
  try {
    const r = await api('/sync', body);
    sync.last = Date.now(); sync.err = null; ls('gym-synced', String(sync.last)); if (body.daily) ls('gym-hist', bucket);
    if (applyInbox(r.inbox || [])) { save(); render(); }
  } catch (e) { sync.err = String(e.message || e); }
  finally { sync.busy = false; if (sync.dirty) scheduleSync(); }
  if (route().v === 'settings') { const el = $('#syncState'); if (el) el.textContent = syncText(); }
}
// Leaving the app: send pending changes right away (keepalive survives the page closing).
function flushSync() {
  if (!canSync() || !sync.dirty) return;
  clearTimeout(sync.t);
  const { body } = syncBody(); const txt = JSON.stringify(body);
  fetch(API + '/sync', { method: 'POST', headers: { authorization: `Bearer ${ls(SYNC_KEY)}`, 'content-type': 'application/json' }, body: txt, keepalive: txt.length < 60000 }).then(() => { sync.dirty = false; sync.last = Date.now(); ls('gym-synced', String(sync.last)); }).catch(() => {});
}
function applyInbox(items) {
  S.applied ||= []; let n = 0, changed = false;
  for (const it of items) {
    if (!it?.id || S.applied.includes(it.id)) continue;
    const d = it.data;
    if (it.kind === 'workout' && d?.id && d.items) { if (!S.workouts.some((w) => w.id === d.id)) { S.workouts.push(d); n++; } }
    else if (it.kind === 'food' && it.date && d?.name) { (S.food[it.date] ||= []).push({ ...d, inbox: it.id }); n++; }
    else if (it.kind === 'body' && d?.date) { upsertBody(d.date, d); n++; }
    else if (it.kind === 'sleep' && d?.bed && d?.wake) { S.sleep.push({ id: it.id, q: null, ...d }); n++; }
    else if (it.kind === 'profile' && d) { Object.assign(S.profile, d); n++; }
    S.applied.push(it.id); changed = true;
  }
  if (n) setTimeout(() => toast(`Claude added ${n} entr${n > 1 ? 'ies' : 'y'} to your log`), 300);
  return changed;
}
// A new install (say the iPhone home-screen app, which doesn't share Safari's storage) pulls the latest copy.
async function restoreIfFresh() {
  if (!fresh || !canSync()) return;
  try {
    const r = await api('/state');
    if (!fresh || !r.state?.workouts) return;
    const d = defaults(); S = { ...d, ...r.state, settings: { ...d.settings, ...(r.state.settings || {}) } };
    seedHistory(); save(); render(); toast(`Restored your data from the cloud (${S.workouts.length} sessions)`);
  } catch (e) { sync.err = String(e.message || e); }
}
function syncText() {
  if (!API) return 'Off: this copy has no server set.';
  if (!ls(SYNC_KEY)) return 'Off on this device: lock and unlock again to turn it on.';
  const ago = sync.last ? Math.round((Date.now() - sync.last) / 60000) : null;
  return `${ago == null ? 'Not synced yet' : ago < 1 ? 'Synced just now' : `Synced ${ago < 120 ? `${ago} min` : `${Math.round(ago / 60)} h`} ago`}${sync.err ? ` · last try failed (${sync.err}), retries on the next change` : ''}`;
}

// ---------- targets & program ----------
export const ACTIVITY = [
  { v: 1.4, label: 'Light: desk job, under 6k steps' },
  { v: 1.5, label: 'Moderate: desk job, 8–10k steps, training 5 days' },
  { v: 1.65, label: 'Active: 10k+ steps, training 6 days' },
  { v: 1.8, label: 'Very active: on your feet all day plus training' },
];

function latestWeight() {
  const ws = S.body.filter((b) => b.w).sort((a, b) => a.date.localeCompare(b.date));
  if (!ws.length) return null;
  const last = ws.at(-1).date;
  return avg(ws.filter((b) => diffDays(b.date, last) < 7).map((b) => b.w));
}

function targets() {
  const p = S.profile;
  const w = latestWeight() ?? p.weightKg;
  const bmr = 10 * w + 6.25 * p.heightCm - 5 * p.age + 5;
  const tdee = bmr * (p.activity || 1.5);
  const wk = weekNo(); const ph = phaseOf(wk);
  const cut = p.kcalOverride || roundTo(tdee - (p.deficit ?? 500), 50);
  const kcal = ph.maintenance ? roundTo(tdee, 50) : cut;
  const protein = p.proteinOverride || roundTo(w * 1.9, 5);
  return { w, bmr, tdee, cut, kcal, maintenance: !!ph.maintenance, protein, steps: wk <= 2 ? 8000 : 10000, water: 3, sleep: p.sleepGoal || 8,
    lossLo: +(w * 0.005).toFixed(2), lossHi: +(w * 0.0075).toFixed(2) };
}

function weekNo(k = today()) {
  if (!S.profile) return 1;
  return Math.max(1, Math.floor(diffDays(S.profile.startDate, k) / 7) + 1);
}
function phaseOf(w) { return PHASES.find((p) => w >= p.weeks[0] && w <= p.weeks[1]) || PHASES.at(-1); }
function slotEx(day, i) { return S.swaps[`${day}:${i}`] || DAYS[day].slots[i].ex; }
function dayPlan(day, w = weekNo()) {
  const ph = phaseOf(w);
  return DAYS[day].slots
    .map((s, i) => ({ slot: i, ex: slotEx(day, i), from: s.from }))
    .filter((s) => s.from <= w)
    .map((s, idx) => ({ ...s, sets: idx < (ph.four || 0) ? 4 : ph.sets }));
}
function schedOf(w = weekNo()) { return phaseOf(w).sched === 'ramp' ? SCHEDULES.ramp : SCHEDULES[S.profile?.schedule] || SCHEDULES.five; }
function sortedWorkouts() { return [...S.workouts].sort(byDate); }
function lastWorkout() { return sortedWorkouts().at(-1); }
function nextDay() {
  const lw = lastWorkout();
  return lw ? schedOf().next[lw.day] || 'push' : 'push';
}
function streakToYesterday() {
  const days = new Set(S.workouts.map((w) => w.date));
  let n = 0; let k = addDays(today(), -1);
  while (days.has(k)) { n++; k = addDays(k, -1); }
  return n;
}
function restAdvice() {
  const t = today();
  const doneToday = S.workouts.filter((w) => w.date === t);
  if (doneToday.length) return { done: doneToday };
  const lw = lastWorkout();
  if (!lw) return {};
  const streak = streakToYesterday();
  if (!streak) return {};
  const sc = schedOf();
  if (streak >= 6) return { rest: true };
  if (sc.restAfter.includes(lw.day)) return { rest: true };
  if (sc.restAfterStreak) {
    const recent = S.workouts.filter((w) => { const d = diffDays(w.date, t); return d >= 1 && d <= streak; });
    return { rest: lw.day === 'legs' && recent.filter((w) => w.day === 'legs').length >= 2 };
  }
  return {};
}

// History of one exercise, newest first.
function exHistory(ex) {
  const out = [];
  for (const w of sortedWorkouts().reverse()) for (const it of w.items) if (it.ex === ex && it.sets.some((s) => s.done)) out.push({ date: w.date, sets: it.sets.filter((s) => s.done), effort: it.effort });
  return out;
}
function bestE1rm(ex) { return Math.max(0, ...exHistory(ex).flatMap((h) => h.sets.map((s) => e1rm(s.w, s.r)))); }

const inc0 = (E) => E.inc <= 0;
// Double progression with effort tags. Returns { w, reps, why }.
function suggest(ex, ph) {
  const E = EXERCISES[ex]; const [lo, hi] = E.reps;
  const hist = exHistory(ex);
  if (!hist.length) {
    if (inc0(E)) return { w: 0, reps: hi, why: E.inc === 0 ? `Bodyweight: log 0 kg (or the weight you add). Aim for ${hi} clean reps.` : `Log the assist weight. Pick an assist that lets you do ${hi} reps with 3–4 to spare.` };
    if (E.start != null) return { w: E.start, reps: hi, why: `Starting weight ${kg(E.start)} kg (machines differ between gyms). Set 1 is a test: if ${hi} reps feel easy, go up a step on set 2. Stop ${ph.rir} reps short.` };
    return { w: null, reps: hi, why: `First time: pick a weight you could lift about ${hi + 3} times, do ${hi}.` };
  }
  const last = hist[0];
  const topW = Math.max(...last.sets.map((s) => s.w));
  const top = last.sets.filter((s) => s.w === topW);
  const minR = Math.min(...top.map((s) => s.r)); const maxR = Math.max(...top.map((s) => s.r));
  const hitTop = minR >= hi; const hitLo = minR >= lo;
  const ramp = !!ph.ramp;
  const inc = E.inc;
  const fix = (w) => Math.max(0, roundTo(w, 0.25));
  if (ph.deload) return { w: topW, reps: lo, why: `Deload week: same ${kg(topW)} kg, 2 sets, stop 3–4 reps short.` };
  if (inc === 0) return { w: topW, reps: Math.min(maxR + 1, hi + 5), why: `Bodyweight: beat ${maxR} reps.` };
  if (hitTop) {
    const jumps = ramp && last.effort === 'easy' ? 2 : 1;
    return { w: fix(topW + jumps * inc), reps: lo, why: `You hit ${hi} on every set${jumps > 1 ? ' and it felt easy' : ''}: +${kg(Math.abs(jumps * inc))} kg, start again at ${lo} reps.` };
  }
  if (ramp && last.effort === 'easy' && hitLo) return { w: fix(topW + inc), reps: Math.max(lo, minR - 1), why: `Ramp-up and it felt easy: up one step to ${kg(fix(topW + inc))} kg.` };
  if (hitLo) return { w: topW, reps: Math.min(hi, minR + 1), why: `Same ${kg(topW)} kg, aim for ${Math.min(hi, minR + 1)}+ reps on every set. Add weight once all sets hit ${hi}.` };
  const prevMissed = hist[1] && Math.min(...hist[1].sets.map((s) => s.r)) < lo;
  if (last.effort === 'hard' && prevMissed) return { w: fix(topW - inc), reps: lo, why: `Missed ${lo} reps twice: drop to ${kg(fix(topW - inc))} kg and build back.` };
  return { w: topW, reps: lo, why: `Same ${kg(topW)} kg until every set reaches ${lo} reps.` };
}

// ---------- rest timer, alarm, wake lock ----------
let tickIv = null; let actx = null; let wakeLock = null;
function unlockAudio() {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
  } catch (e) { /* no audio */ }
}
function chime() {
  if (!actx || !S.settings.sound) return;
  const t0 = actx.currentTime;
  [0, 0.3, 0.6].forEach((d, i) => {
    const o = actx.createOscillator(); const g = actx.createGain();
    o.type = 'sine'; o.frequency.value = i === 2 ? 1320 : 880;
    g.gain.setValueAtTime(0.0001, t0 + d);
    g.gain.exponentialRampToValueAtTime(0.5, t0 + d + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.25);
    o.connect(g).connect(actx.destination); o.start(t0 + d); o.stop(t0 + d + 0.3);
  });
}
async function notify(title, body) {
  try {
    if (!S.settings.notify || !('Notification' in window) || Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker?.getRegistration();
    const opts = { body, tag: 'rest', renotify: true, vibrate: [300, 150, 300], icon: 'icons/icon-192.png' };
    if (reg) reg.showNotification(title, opts); else new Notification(title, opts);
  } catch (e) { /* ignore */ }
}
async function keepAwake(on) {
  try {
    if (on && S.settings.wake && 'wakeLock' in navigator && !wakeLock && document.visibilityState === 'visible') {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { wakeLock = null; }
}
function startRest(sec, label, walk = false) {
  if (!S.active || sec <= 0) return;
  S.active.rest = { endAt: Date.now() + sec * 1000, total: sec, label, fired: false, walk };
  save(); runTimer();
}
function runTimer() { clearInterval(tickIv); tickIv = setInterval(tick, 250); tick(); }
function tick() {
  const bar = $('#timer'); const r = S.active?.rest;
  const el = $('#elapsed');
  if (el && S.active?.startedAt && !S.active.past) el.textContent = mmss((Date.now() - Date.parse(S.active.startedAt)) / 1000);
  if (!r) { bar.hidden = true; document.title = 'Gym'; if (!S.active) clearInterval(tickIv); return; }
  bar.hidden = false;
  const left = (r.endAt - Date.now()) / 1000;
  const t = $('#timer-time'); const lab = $('#timer-label'); const fill = $('#timer-fill');
  if (left > 0) {
    bar.classList.remove('go');
    t.textContent = mmss(Math.ceil(left));
    lab.textContent = r.label;
    fill.style.transform = `scaleX(${Math.max(0, Math.min(1, left / r.total))})`;
    document.title = `${mmss(Math.ceil(left))} rest`;
  } else {
    bar.classList.add('go');
    const over = -left;
    t.textContent = r.walk ? 'Done' : over < 5 ? 'Go' : `+${mmss(over)}`;
    lab.textContent = r.walk ? '10 minutes walked. Tap Mark done, then Finish workout.' : over < 5 ? r.label : `Rest ended ${mmss(over)} ago · ${r.label}`;
    fill.style.transform = 'scaleX(0)';
    document.title = r.walk ? 'Walk done' : 'Go: next set';
    if (!r.fired) {
      r.fired = true; save();
      chime();
      if (S.settings.vibrate && navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);
      if (document.visibilityState !== 'visible') notify(r.walk ? 'Walk done' : 'Rest over', r.label);
      document.body.classList.add('flash'); setTimeout(() => document.body.classList.remove('flash'), 900);
    }
    if (over > 600) { S.active.rest = null; save(); }
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { keepAwake(!!S.active && !S.active.past); tick(); }
});

// ---------- modal & toast ----------
const dlg = $('#dlg');
function modal(html) { dlg.innerHTML = `<div class="sheet">${html}</div>`; if (!dlg.open) dlg.showModal(); }
function closeModal() { if (dlg.open) dlg.close(); }
dlg.addEventListener('click', (e) => { if (e.target === dlg) closeModal(); });
let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2800);
}

// ---------- charts (inline SVG, hover/tap readout) ----------
const charts = new Map();
function chart(id, cfg) {
  charts.set(id, cfg);
  return `<figure class="chart" data-chart="${id}" aria-label="${esc(cfg.title)}">${drawChart(cfg)}<div class="tip" hidden></div></figure>`;
}
function drawChart(c) {
  const W = 360, H = 180, L = 38, R = 10, T = 12, B = 24;
  const vals = [...c.values, ...(c.dots || [])].filter((v) => v != null);
  const refs = c.refs || [];
  if (!vals.length) return `<div class="empty">${esc(c.empty || 'No data yet')}</div>`;
  let lo = Math.min(...vals, ...refs.map((r) => r.y)); let hi = Math.max(...vals, ...refs.map((r) => r.y));
  if (c.kind === 'bar') lo = 0;
  if (hi - lo < (c.minSpan || 1)) { const m = (hi + lo) / 2; lo = c.kind === 'bar' ? 0 : m - (c.minSpan || 1) / 2; hi = m + (c.minSpan || 1) / 2; }
  const padY = (hi - lo) * 0.08; if (c.kind !== 'bar') lo -= padY; hi += padY;
  const n = c.values.length;
  const pw = W - L - R, ph = H - T - B;
  const x = (i) => (c.kind === 'bar' ? L + (i + 0.5) * (pw / n) : L + (n === 1 ? pw / 2 : (i * pw) / (n - 1)));
  const y = (v) => T + ph - ((v - lo) / (hi - lo)) * ph;
  const fmt = c.yFmt || ((v) => String(Math.round(v)));
  let g = '';
  for (let k = 0; k <= 3; k++) {
    const v = lo + ((hi - lo) * k) / 3; const yy = y(v).toFixed(1);
    g += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" class="grid"/><text x="${L - 6}" y="${(+yy + 3.5).toFixed(1)}" class="ax" text-anchor="end">${esc(fmt(v))}</text>`;
  }
  const xl = n > 2 ? [0, Math.floor((n - 1) / 2), n - 1] : [...Array(n).keys()];
  for (const i of xl) g += `<text x="${x(i).toFixed(1)}" y="${H - 6}" class="ax" text-anchor="middle">${esc(c.labels[i])}</text>`;
  for (const r of refs) {
    const yy = y(r.y).toFixed(1);
    g += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" class="ref"/><text x="${W - R}" y="${(+yy - 4).toFixed(1)}" class="ax ref-l" text-anchor="end">${esc(r.label)}</text>`;
  }
  if (c.kind === 'bar') {
    const bw = Math.max(3, pw / n - 4);
    c.values.forEach((v, i) => {
      if (v == null) return;
      const x0 = x(i) - bw / 2, y0 = y(v), y1 = y(0), r = Math.min(4, bw / 2, (y1 - y0));
      g += `<path class="bar${c.good && c.good(v) ? ' ok' : ''}" d="M${x0.toFixed(1)},${y1.toFixed(1)}V${(y0 + r).toFixed(1)}Q${x0.toFixed(1)},${y0.toFixed(1)} ${(x0 + r).toFixed(1)},${y0.toFixed(1)}H${(x0 + bw - r).toFixed(1)}Q${(x0 + bw).toFixed(1)},${y0.toFixed(1)} ${(x0 + bw).toFixed(1)},${(y0 + r).toFixed(1)}V${y1.toFixed(1)}Z"/>`;
    });
  } else {
    if (c.dots) c.dots.forEach((v, i) => { if (v != null) g += `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3" class="dot"/>`; });
    let d = ''; let pen = false;
    c.values.forEach((v, i) => { if (v == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`; pen = true; });
    g += `<path d="${d}" class="line"/>`;
    if (c.markers !== false) c.values.forEach((v, i) => { if (v != null && (c.markers || n < 16)) g += `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="4" class="mk"/>`; });
  }
  g += `<line class="cross" x1="0" x2="0" y1="${T}" y2="${T + ph}" visibility="hidden"/>`;
  c._geo = { W, L, R, n, x };
  return `<svg viewBox="0 0 ${W} ${H}" role="img">${g}</svg>`;
}
function bindCharts() {
  for (const fig of $$('.chart')) {
    const c = charts.get(fig.dataset.chart); if (!c || !c._geo) continue;
    const svg = $('svg', fig); const tip = $('.tip', fig); const cross = $('.cross', fig);
    const show = (e) => {
      const box = svg.getBoundingClientRect(); const { W, n, x } = c._geo;
      const vx = ((e.clientX - box.left) / box.width) * W;
      let best = -1; let bd = Infinity;
      for (let i = 0; i < n; i++) { const has = c.values[i] != null || (c.dots && c.dots[i] != null); if (!has) continue; const d = Math.abs(x(i) - vx); if (d < bd) { bd = d; best = i; } }
      if (best < 0) return;
      cross.setAttribute('x1', x(best)); cross.setAttribute('x2', x(best)); cross.setAttribute('visibility', 'visible');
      tip.replaceChildren();
      const lines = c.tip(best);
      lines.forEach(([val, lab], j) => { const p = document.createElement('div'); const b = document.createElement('strong'); b.textContent = val; p.append(b); if (lab) p.append(document.createTextNode(` ${lab}`)); if (j) p.className = 'sub'; tip.append(p); });
      tip.hidden = false;
      const px = (x(best) / W) * box.width;
      tip.style.left = `${Math.min(Math.max(px, 60), box.width - 60)}px`;
    };
    svg.addEventListener('pointermove', show);
    svg.addEventListener('pointerdown', show);
    svg.addEventListener('pointerleave', () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); });
  }
}

// ---------- icons ----------
const I = {
  today: '<path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  train: '<path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11"/>',
  food: '<path d="M3 11h18a9 9 0 0 1-18 0zM8 7c0-1.5 1-2 1-3.5M12 7c0-1.5 1-2 1-3.5M16 7c0-1.5 1-2 1-3.5"/>',
  sleep: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  stats: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  plan: '<path d="M8 4h8M9 2h6v4H9zM6 4H5a1 1 0 0 0-1 1v15a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-1M8 11h8M8 15h5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  swap: '<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  back: '<path d="m15 5-7 7 7 7"/>',
  fwd: '<path d="m9 5 7 7-7 7"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  share: '<path d="M12 3v12M8 7l4-4 4 4M5 11v9h14v-9"/>',
};
const icon = (k, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[k]}</svg>`;

// ---------- views ----------
const VIEWS = { today: vToday, train: vTrain, food: vFood, sleep: vSleep, stats: vStats, plan: vPlan, settings: vSettings };
const TITLES = { today: 'Today', train: 'Train', food: 'Food', sleep: 'Sleep', stats: 'Progress', plan: 'The plan', settings: 'Settings' };

function route() {
  const h = location.hash.replace(/^#/, '');
  const [v, sub] = h.split('/');
  return { v: VIEWS[v] ? v : 'today', sub };
}

// Password gate: only a SHA-256 of the password is in this file. A device that unlocked once stays unlocked.
const GATE_HASH = 'd74ff0ee8da3b9806b18c877dbf29bbde50b5bd8e4dad7a3a725000feb82e8f1';
const GATE_KEY = 'gym-unlocked';
let unlocked = false;
try { unlocked = localStorage.getItem(GATE_KEY) === GATE_HASH && (!API || !!localStorage.getItem('gym-sync')); } catch (e) { /* storage blocked */ }
async function sha256(text) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function vGate() {
  return `<form class="card form gate" data-form="gate" autocomplete="off">
    <h3>Private</h3>
    ${API && ls(GATE_KEY) === GATE_HASH ? '<p class="small muted">Enter the password once more to turn on cloud sync.</p>' : ''}
    <label>Password <input class="inp" name="pw" type="password" autocapitalize="none" autocomplete="current-password" required></label>
    <button class="btn primary">Unlock</button>
    <p class="small muted" id="gate-msg" role="status"></p>
  </form>`;
}

function render() {
  const main = $('#view');
  const locked = !unlocked;
  $('#nav').hidden = locked; $('.toplinks').hidden = locked;
  if (locked) { $('#title').textContent = 'Gym'; main.innerHTML = vGate(); $('input[name=pw]', main)?.focus(); return; }
  if (handleImport()) return;
  const { v, sub } = route();
  if (v === 'sleep' && (sub === 'bed' || sub === 'wake')) { history.replaceState(null, '', '#sleep'); if (sub === 'bed' && !S.bedPending) { act.bed(); return; } if (sub === 'wake' && S.bedPending) { act.wake(); return; } }
  $('#title').textContent = v === 'train' && S.active ? `${DAYS[S.active.day].name} day` : TITLES[v];
  for (const a of $$('#nav a')) a.classList.toggle('on', a.dataset.v === v);
  charts.clear();
  main.innerHTML = VIEWS[v](sub);
  bindCharts();
  tick();
}

// ----- today -----
function vToday() {
  const t = today(); const w = weekNo(); const ph = phaseOf(w); const tg = targets();
  const adv = restAdvice(); const nd = nextDay();
  let train;
  if (S.active) {
    const done = sum(S.active.items.map((it) => it.sets.filter((s) => s.done).length)); const all = sum(S.active.items.map((it) => it.sets.length));
    train = `<div class="kicker">In progress</div><h3>${DAYS[S.active.day].name} · ${done}/${all} sets</h3><a class="btn primary" href="#train">Resume workout</a>`;
  } else if (adv.done) {
    const wd = adv.done.at(-1); const sets = sum(wd.items.map((i) => i.sets.length));
    train = `<div class="kicker">Done today</div><h3>${DAYS[wd.day].name} ${icon('check', 'ok')}</h3><p class="muted">${sets} sets${wd.mins ? ` in ${wd.mins} min` : ''}. Next: ${DAYS[nd].name}. Walk, eat your protein, sleep on time.</p>`;
  } else if (adv.rest) {
    train = `<div class="kicker">Rest day</div><h3>Recover, walk ${tg.steps.toLocaleString('en-IN')} steps</h3><p class="muted">Next session: ${DAYS[nd].name}. Optional: 20–30 min incline walk or bike (not running). Protein and sleep matter more today.</p><button class="btn" data-act="start" data-day="${nd}">Train anyway</button>`;
  } else {
    const items = dayPlan(nd);
    train = `<div class="kicker">Today · ${esc(DAYS[nd].focus)}</div><h3>${DAYS[nd].name} day</h3>
      <ol class="mini">${items.map((s) => `<li>${esc(EXERCISES[s.ex].name)} <span class="muted">${s.sets}×${EXERCISES[s.ex].reps.join('–')}</span></li>`).join('')}<li>Treadmill walk <span class="muted">10 min, incline</span></li></ol>
      <button class="btn primary" data-act="start" data-day="${nd}">Start workout</button>`;
  }
  const fl = S.food[t] || []; const kc = sum(fl.map((f) => f.kcal * f.qty)); const pr = sum(fl.map((f) => f.p * f.qty));
  const h = S.habits[t] || {};
  const lastSleep = [...S.sleep].sort((a, b) => a.wake.localeCompare(b.wake)).at(-1);
  const bw = S.body.find((b) => b.date === t);
  return `${installHint()}
  <p class="phase"><b>Week ${w}</b> · ${esc(ph.name)} · ${ph.sets} sets, ${ph.rir} reps in reserve <a href="#plan">plan ${icon('fwd')}</a></p>
  <section class="card">${train}</section>

  <section class="card">
    <div class="head"><h3>Food</h3><a href="#food">log ${icon('fwd')}</a></div>
    ${tg.maintenance ? '<p class="note">Diet-break week: eat at maintenance.</p>' : ''}
    ${meter('Protein', pr, tg.protein, 'g', true)}
    ${meter('Calories', kc, tg.kcal, 'kcal', false)}
  </section>

  <section class="card">
    <div class="head"><h3>Daily habits</h3></div>
    <ul class="checks">
      ${HABITS.map((x) => `<li><label><input type="checkbox" data-habit="${x.id}" ${h[x.id] ? 'checked' : ''}> ${esc(x.label)}</label></li>`).join('')}
    </ul>
    <div class="counter"><span>Water <b>${((h.water || 0) * 0.25).toFixed(2).replace(/\.?0+$/, '')} / ${tg.water} L</b></span>
      <span class="steps"><button class="btn sm" data-act="water" data-d="-1" aria-label="Less water">−</button><button class="btn sm" data-act="water" data-d="1" aria-label="Add 250 ml water">+250 ml</button></span></div>
    <label class="counter"><span>Steps <span class="muted">target ${tg.steps.toLocaleString('en-IN')}</span></span><input class="inp sm" type="number" inputmode="numeric" data-steps value="${h.steps ?? ''}" placeholder="0"></label>
  </section>

  <section class="card">
    <div class="head"><h3>Sleep</h3><a href="#sleep">log ${icon('fwd')}</a></div>
    ${lastSleep ? `<p>Last night <b>${hm(sleepMins(lastSleep))}</b> <span class="muted">${fmtTime(lastSleep.bed)} → ${fmtTime(lastSleep.wake)}${lastSleep.q ? ` · quality ${lastSleep.q}/5` : ''}</span></p>` : '<p class="muted">No nights logged yet.</p>'}
    ${S.bedPending ? `<button class="btn primary" data-act="wake">I'm awake <span class="muted-in">(in bed since ${fmtTime(S.bedPending)})</span></button>` : '<button class="btn" data-act="bed">Going to bed</button>'}
  </section>

  <section class="card">
    <div class="head"><h3>Morning weight</h3><a href="#stats">trend ${icon('fwd')}</a></div>
    <form class="inline" data-form="weight"><input class="inp" name="w" type="number" inputmode="decimal" step="0.05" placeholder="kg" value="${bw?.w ?? ''}" aria-label="Weight in kg"><button class="btn">Save</button></form>
    <p class="muted small">After the toilet, before food or water. The 7-day average is what counts, not today's number.</p>
  </section>`;
}
function installHint() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  if (!ios || standalone || ls('gym-install-hint')) return '';
  return `<section class="card install"><h3>Put this on your home screen</h3>
    <p class="small">In Safari tap ${icon('share')} <b>Share</b>, then <b>Add to Home Screen</b>. It opens full screen like an app, works offline, and can ping you when rest ends.${API ? ' Your log follows you there through the cloud copy.' : ''}</p>
    <button class="btn sm" data-act="hideInstall">Got it</button></section>`;
}
function meter(label, val, target, unit, main) {
  const pct = Math.min(100, (val / target) * 100); const left = Math.round(target - val);
  return `<div class="meter${main ? ' main' : ''}">
    <div class="mrow"><span>${label}</span><span><b>${Math.round(val)}</b> / ${target} ${unit}</span></div>
    <div class="track"><div class="fill${val > target * (main ? 10 : 1.05) ? ' over' : ''}" style="width:${pct}%"></div></div>
    <div class="small muted">${left > 0 ? `${left} ${unit} left` : main ? 'Target hit' : `${-left} ${unit} over`}</div></div>`;
}

// ----- train -----
function vTrain() {
  if (S.active) return vActive();
  const w = weekNo(); const ph = phaseOf(w); const nd = nextDay(); const adv = restAdvice();
  const hist = sortedWorkouts().reverse().slice(0, 30);
  return `
  <section class="card">
    <div class="kicker">Week ${w} · ${esc(ph.name)}</div>
    <p>${esc(ph.note)}</p>
    <p class="muted small">${ph.sets} working sets per exercise${ph.four ? ` (4 on the first ${ph.four === 1 ? 'one' : 'two'})` : ''}, last set ${ph.rir} reps short of failure. Schedule: ${esc(schedOf().label)}.</p>
    ${adv.rest ? `<p class="note">Rest day recommended today. Next up is ${DAYS[nd].name}.</p>` : ''}
    <div class="daypick">${schedOf().days.map((d) => `<button class="btn${d === nd ? ' primary' : ''}" data-act="start" data-day="${d}">${DAYS[d].name}${d === nd ? ' · next' : ''}</button>`).join('')}</div>
    <button class="btn ghost sm" data-act="pastForm">+ Log a past session</button>
  </section>
  <h2 class="sec">History</h2>
  ${hist.length ? hist.map(histCard).join('') : '<p class="muted">No sessions yet. Your first one shows up here.</p>'}`;
}
function histCard(wk) {
  const sets = sum(wk.items.map((i) => i.sets.length));
  const vol = sum(wk.items.flatMap((i) => i.sets.map((s) => s.w * s.r)));
  return `<details class="card hist"><summary><span><b>${DAYS[wk.day].name}</b> <span class="muted">${fmtDay(wk.date)}</span></span><span class="muted small">${sets} sets · ${Math.round(vol).toLocaleString('en-IN')} kg${wk.mins ? ` · ${wk.mins} min` : ''}${wk.walk ? ' · walk' : ''}</span></summary>
    <table class="tbl">${wk.items.map((it) => `<tr><td>${esc(EXERCISES[it.ex]?.name || it.ex)}${it.effort ? ` <span class="tag">${it.effort}</span>` : ''}</td><td class="num">${it.sets.map((s) => `${kg(s.w)}×${s.r}`).join(', ')}</td></tr>`).join('')}</table>
    <button class="btn ghost sm danger" data-act="delWorkout" data-id="${wk.id}">Delete session</button></details>`;
}

function newActive(day, date = today(), past = false) {
  const w = weekNo(date); const ph = phaseOf(w);
  const items = dayPlan(day, w).map((s) => {
    const sg = suggest(s.ex, ph);
    return { slot: s.slot, ex: s.ex, effort: null, sets: Array.from({ length: s.sets }, () => ({ w: sg.w ?? '', r: '', done: false })) };
  });
  return { id: uid(), day, date, past, week: w, startedAt: new Date().toISOString(), items, rest: null };
}

function vActive() {
  const A = S.active; const ph = phaseOf(A.week);
  return `
  <div class="wbar"><span>${A.past ? `Past session · ${fmtDay(A.date)}` : `<span id="elapsed">0:00</span> elapsed`}</span><span class="muted">${ph.sets} sets · ${ph.rir} RIR</span></div>
  ${A.past ? '' : '<p class="small muted warm">Start with 5 min of easy walking or cycling, then the warm-up sets shown on the first two exercises.</p>'}
  ${A.items.map((it, i) => exCard(it, i, ph)).join('')}
  <section class="card ex walk${A.walk ? ' complete' : ''}">
    <div class="exhead"><div><h3>Treadmill walk · 10 min</h3><div class="small muted">last thing · incline 8–12% · 5–5.5 km/h · you can still talk</div></div></div>
    <p class="why">After lifting, not before: lifting first gives better strength gains, and the walk adds about 70–90 kcal without taking anything from your sets.</p>
    <div class="row-btns">${A.past ? '' : '<button class="btn" data-act="walkTimer">Start 10:00 timer</button>'}<button class="btn${A.walk ? ' primary' : ''}" data-act="walkDone">${A.walk ? `Done ${icon('check')}` : 'Mark done'}</button></div>
  </section>
  <div class="card add-ex"><button class="btn ghost sm" data-act="addExForm">+ Add exercise</button></div>
  <div class="finish"><button class="btn primary" data-act="finish">Finish workout</button><button class="btn ghost danger" data-act="discard">Discard</button></div>`;
}
function exCard(it, i, ph) {
  const E = EXERCISES[it.ex]; const sg = suggest(it.ex, ph); const last = exHistory(it.ex)[0];
  const doneN = it.sets.filter((s) => s.done).length; const complete = doneN === it.sets.length;
  const best = bestE1rm(it.ex);
  const warm = i < 2 && E.type === 'compound' && sg.w && !ph.deload && doneN === 0
    ? `<p class="small muted">Warm-up: ${kg(roundTo(sg.w * 0.5, 0.5))} kg × 10, then ${kg(roundTo(sg.w * 0.75, 0.5))} kg × 5.</p>` : '';
  return `<section class="card ex${complete ? ' complete' : ''}" id="ex${i}">
    <div class="exhead">
      <div><h3>${esc(E.name)}</h3><div class="small muted">${esc(E.muscle)} · ${E.reps.join('–')} reps · rest ${mmss(restFor(it.ex))}</div></div>
      <div class="exbtns"><button class="icon-btn" data-act="info" data-ex="${it.ex}" aria-label="About ${esc(E.name)}">${icon('info')}</button>${E.alts.length ? `<button class="icon-btn" data-act="swapForm" data-i="${i}" aria-label="Swap exercise">${icon('swap')}</button>` : ''}</div>
    </div>
    <p class="why">${last ? `<span class="muted">Last ${fmtShort(last.date)}:</span> ${last.sets.map((s) => `${kg(s.w)}×${s.r}`).join(', ')}<br>` : ''}${esc(sg.why)}</p>
    ${warm}
    <div class="sets">
      <div class="shead"><span>Set</span><span>kg</span><span>Reps</span><span></span></div>
      ${it.sets.map((s, j) => {
        const pr = s.done && best && e1rm(s.w, s.r) > best + 0.01;
        return `<div class="set${s.done ? ' done' : ''}">
        <span class="sn">${j + 1}${pr ? '<span class="pr">PR</span>' : ''}</span>
        <span class="wgrp"><button class="stp" data-act="bump" data-i="${i}" data-s="${j}" data-d="-1" aria-label="Less weight">−</button><input class="inp" inputmode="decimal" data-w="${i}:${j}" value="${s.w}" placeholder="kg" aria-label="Set ${j + 1} weight"><button class="stp" data-act="bump" data-i="${i}" data-s="${j}" data-d="1" aria-label="More weight">+</button></span>
        <input class="inp reps" inputmode="numeric" data-r="${i}:${j}" value="${s.r}" placeholder="${sg.reps}" aria-label="Set ${j + 1} reps">
        <button class="tick" data-act="tick" data-i="${i}" data-s="${j}" aria-label="${s.done ? 'Undo set' : 'Set done'}">${icon('check')}</button>
      </div>`;
      }).join('')}
    </div>
    <div class="exfoot">
      <span><button class="btn ghost sm" data-act="addSet" data-i="${i}">+ set</button>${it.sets.length > 1 ? `<button class="btn ghost sm" data-act="rmSet" data-i="${i}">− set</button>` : ''}</span>
      ${doneN ? `<span class="effort" role="group" aria-label="How hard was it">${['easy', 'good', 'hard'].map((e) => `<button class="chip${it.effort === e ? ' on' : ''}" data-act="effort" data-i="${i}" data-e="${e}">${e}</button>`).join('')}</span>` : ''}
    </div>
  </section>`;
}
function restFor(ex) { const E = EXERCISES[ex]; const st = S.settings; return E.type !== 'compound' ? st.restIso : E.heavy ? (st.restHeavy ?? 150) : st.restCompound; }

// ----- food -----
function allFoods() { return [...FOODS, ...S.custom]; }
function food(id) { return allFoods().find((f) => f.id === id); }
function dietOK(f) { const d = S.profile.diet; return d === 'nonveg' || f.diet === 'v' || (d === 'egg' && f.diet === 'e'); }
function planOf() { return S.plan || MEAL_TEMPLATES[S.profile.diet] || MEAL_TEMPLATES.egg; }
function planTotals(plan) {
  let kcal = 0, p = 0;
  for (const m of MEALS) for (const [id, q] of plan[m] || []) { const f = food(id); if (f) { kcal += f.kcal * q; p += f.p * q; } }
  return { kcal, p };
}

function vFood(sub) {
  if (sub && ['log', 'plan', 'prep'].includes(sub)) ui.foodTab = sub;
  const tabs = `<div class="seg" role="tablist">${[['log', 'Log'], ['plan', 'Day plan'], ['prep', 'Prep & groceries']].map(([k, l]) => `<a role="tab" href="#food/${k}" class="${ui.foodTab === k ? 'on' : ''}">${l}</a>`).join('')}</div>`;
  if (ui.foodTab === 'plan') return tabs + vFoodPlan();
  if (ui.foodTab === 'prep') return tabs + vPrep();
  return tabs + vFoodLog();
}
function vFoodLog() {
  const d = ui.foodDate; const tg = targets(); const log = S.food[d] || [];
  const kc = sum(log.map((f) => f.kcal * f.qty)); const pr = sum(log.map((f) => f.p * f.qty));
  return `
  <div class="datenav"><button class="icon-btn" data-act="foodDay" data-d="-1" aria-label="Previous day">${icon('back')}</button><b>${d === today() ? 'Today' : fmtDay(d)}</b><button class="icon-btn" data-act="foodDay" data-d="1" aria-label="Next day" ${d >= today() ? 'disabled' : ''}>${icon('fwd')}</button></div>
  <section class="card">${meter('Protein', pr, tg.protein, 'g', true)}${meter('Calories', kc, tg.kcal, 'kcal', false)}</section>
  ${mealBoxHtml()}
  ${MEALS.map((m) => {
    const items = log.map((f, idx) => ({ ...f, idx })).filter((f) => f.meal === m);
    const planned = (planOf()[m] || []).length;
    return `<section class="card meal">
      <div class="head"><h3>${m} <span class="muted small">${Math.round(sum(items.map((f) => f.kcal * f.qty)))} kcal · ${Math.round(sum(items.map((f) => f.p * f.qty)))} g P</span></h3>
      <span>${planned && !items.length ? `<button class="btn ghost sm" data-act="logPlanMeal" data-m="${m}">use plan</button>` : ''}<button class="btn sm" data-act="addFood" data-m="${m}" data-mode="log">+ add</button></span></div>
      ${items.map((f) => `<div class="fitem"><div><div>${esc(f.name)}</div><div class="small muted">${f.qty} × ${esc(f.serving)} · ${Math.round(f.kcal * f.qty)} kcal · <b>${+(f.p * f.qty).toFixed(1)} g P</b></div></div>
        <span class="qty"><button class="stp" data-act="qty" data-idx="${f.idx}" data-d="-0.5" aria-label="Less">−</button><button class="stp" data-act="qty" data-idx="${f.idx}" data-d="0.5" aria-label="More">+</button></span></div>`).join('')}
    </section>`;
  }).join('')}
  <div class="row-btns"><button class="btn" data-act="logPlanDay">Log the whole day plan</button><button class="btn ghost" data-act="copyYesterday">Copy yesterday</button></div>`;
}
// ----- typed / photographed meals -----
let foodIdx = null; let foodIdxN = -1;
function mealIndex() { if (!foodIdx || foodIdxN !== S.custom.length) { foodIdx = buildIndex(allFoods(), ALIASES); foodIdxN = S.custom.length; } return foodIdx; }
function guessMeal() {
  const lw = lastWorkout();
  if (lw?.date === today() && lw.startedAt) { const end = Date.parse(lw.startedAt) + (lw.mins || 60) * 60000; if (Date.now() - end < 90 * 60000 && Date.now() > end - 30 * 60000) return 'Post-workout'; }
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  return h < 11 ? 'Breakfast' : h < 16 ? 'Lunch' : h < 19.5 ? 'Snack' : 'Dinner';
}
// Rows ready to log: typed rows (with AI estimates filled in) plus photo rows.
function mealRows() {
  const rows = ui.mrows.map((r, k) => {
    const ai = r.src === 'unknown' ? ui.mai[r.raw] : null;
    return { ...(ai ? { ...r, name: ai.name || r.name, serving: ai.qty || 'estimate', kcal: ai.kcal, p: ai.p, qty: 1, src: 'ai' } : r), key: `t${k}` };
  });
  for (const [k, it] of (ui.mphoto?.items || []).entries()) rows.push({ raw: `photo: ${it.name}`, name: it.name, serving: it.qty || 'from photo', kcal: it.kcal, p: it.p, qty: 1, src: 'photo', key: `p${k}`, fid: null });
  return rows.map((r) => ({ ...r, skip: ui.mskip.has(r.key) }));
}
function mealPreviewHtml() {
  const rows = mealRows(); if (!rows.length && !ui.mbusy) return '';
  const ok = rows.filter((r) => !r.skip && r.src !== 'unknown');
  const unknown = rows.filter((r) => !r.skip && r.src === 'unknown');
  const tag = { db: '', given: 'your numbers', ai: 'estimate', photo: 'photo' };
  return `${ui.mphoto?.thumb ? `<div class="mphoto"><img src="${ui.mphoto.thumb}" alt="Meal photo"><span class="small muted">${esc(ui.mphoto.note || '')}</span><button type="button" class="icon-btn" data-act="mPhotoClear" aria-label="Remove photo">${icon('x')}</button></div>` : ''}
    <ul class="mprev">${rows.map((r) => `<li class="${r.skip ? 'skip' : ''} ${r.src === 'unknown' ? 'unk' : ''}">
      <div><div>${esc(r.name)}${tag[r.src] ? ` <span class="tag">${tag[r.src]}</span>` : ''}</div>
      <div class="small muted">${r.src === 'unknown' ? `not in the food list${API ? '' : ', add numbers like “' + esc(r.phrase || r.raw) + ' 250 kcal 10p”'}` : `${r.src === 'db' ? `${r.qty} × ${esc(r.serving)}` : esc(r.serving)} · ${Math.round(r.kcal * r.qty)} kcal · <b>${+(r.p * r.qty).toFixed(1)} g P</b>`}</div></div>
      <button type="button" class="icon-btn" data-act="mSkip" data-k="${r.key}" aria-label="${r.skip ? 'Keep' : 'Leave out'} ${esc(r.name)}">${r.skip ? '+' : icon('x')}</button></li>`).join('')}</ul>
    ${ui.mbusy ? `<p class="small muted">${esc(ui.mbusy)}</p>` : ''}
    ${unknown.length && API && !ui.mbusy ? `<button type="button" class="btn sm" data-act="mEstimate">Estimate ${unknown.length} unknown item${unknown.length > 1 ? 's' : ''}</button>` : ''}
    ${ok.length ? `<p class="small">Total <b>${Math.round(sum(ok.map((r) => r.kcal * r.qty)))} kcal · ${Math.round(sum(ok.map((r) => r.p * r.qty)))} g protein</b></p>` : ''}`;
}
function mealBoxHtml() {
  const meal = ui.mmeal || guessMeal();
  const n = mealRows().filter((r) => !r.skip && r.src !== 'unknown').length;
  return `<section class="card mealbox"><form class="form" data-form="meal" autocomplete="off">
    <label for="mtext"><b>What did you eat?</b> <span class="small muted">plain English, quantities optional</span></label>
    <textarea id="mtext" class="inp" name="text" rows="2" placeholder="2 roti, 1 katori dal, rice, 2 eggs, whey with milk">${esc(ui.mtext)}</textarea>
    <div class="mrow">
      <select class="inp sm" name="meal" data-mmeal aria-label="Meal">${MEALS.map((m) => `<option ${m === meal ? 'selected' : ''}>${m}</option>`).join('')}</select>
      ${API ? `<label class="btn ghost sm">${icon('camera')} Photo<input type="file" accept="image/*" id="mphoto" hidden></label>` : ''}
      <button class="btn primary sm" id="madd" ${n ? '' : 'disabled'}>Add${n ? ` ${n}` : ''}</button>
    </div>
    <div id="mprev">${mealPreviewHtml()}</div>
  </form></section>`;
}
function refreshMealBox() {
  const pv = $('#mprev'); if (pv) pv.innerHTML = mealPreviewHtml();
  const b = $('#madd'); if (b) { const n = mealRows().filter((r) => !r.skip && r.src !== 'unknown').length; b.disabled = !n; b.textContent = `Add${n ? ` ${n}` : ''}`; }
}
let mealT;
function onMealInput(v) {
  ui.mtext = v; clearTimeout(mealT);
  mealT = setTimeout(() => { ui.mrows = parseMeal(ui.mtext, mealIndex()); ui.mskip = new Set([...ui.mskip].filter((k) => k.startsWith('p'))); refreshMealBox(); }, 150);
}
async function shrinkImage(file, max = 1024) {
  const src = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const t = document.createElement('canvas'); const tk = 160 / Math.max(c.width, c.height); t.width = Math.round(c.width * tk); t.height = Math.round(c.height * tk);
    t.getContext('2d').drawImage(c, 0, 0, t.width, t.height);
    return { full: c.toDataURL('image/jpeg', 0.8), thumb: t.toDataURL('image/jpeg', 0.7) };
  } finally { URL.revokeObjectURL(src); }
}
async function mealPhoto(file) {
  if (!canSync()) { toast('Photos need the cloud server'); return; }
  ui.mbusy = 'Looking at the photo…'; refreshMealBox();
  try {
    const { full, thumb } = await shrinkImage(file);
    const r = await api('/photo', { image: full, hint: ui.mtext, meal: $('[data-mmeal]')?.value || '' });
    ui.mphoto = { id: r.id, items: r.items || [], note: r.note, thumb };
    if (!ui.mphoto.items.length) toast('Could not make out the food. Type it instead.');
  } catch (e) { toast(`Photo failed: ${e.message}`); }
  ui.mbusy = false; refreshMealBox();
}

function vFoodPlan() {
  const plan = planOf(); const t = planTotals(plan); const tg = targets();
  const gap = tg.protein - t.p;
  return `
  <section class="card"><p>Your standard day. Log it in one tap on the Log tab, and the grocery list is built from it.</p>
    ${meter('Protein', t.p, tg.protein, 'g', true)}${meter('Calories', t.kcal, tg.kcal, 'kcal', false)}
    ${gap > 10 ? `<p class="note">${Math.round(gap)} g protein short. Easiest fixes: +100 g hung curd (+9 g), +1 scoop whey (+24 g), soya chunks instead of a dal (+17 g).</p>` : ''}
    ${t.kcal > tg.kcal + 150 ? `<p class="note">${Math.round(t.kcal - tg.kcal)} kcal over. Drop a roti (−100) or the fruit, or switch to low-fat paneer.</p>` : ''}
  </section>
  ${MEALS.map((m) => `<section class="card meal"><div class="head"><h3>${m}</h3><button class="btn sm" data-act="addFood" data-m="${m}" data-mode="plan">+ add</button></div>
    ${(plan[m] || []).map(([id, q], k) => { const f = food(id); if (!f) return ''; return `<div class="fitem"><div><div>${esc(f.name)}</div><div class="small muted">${q} × ${esc(f.serving)} · ${Math.round(f.kcal * q)} kcal · <b>${+(f.p * q).toFixed(1)} g P</b></div></div>
      <span class="qty"><button class="stp" data-act="planQty" data-m="${m}" data-k="${k}" data-d="-0.5" aria-label="Less">−</button><button class="stp" data-act="planQty" data-m="${m}" data-k="${k}" data-d="0.5" aria-label="More">+</button></span></div>`; }).join('')}
  </section>`).join('')}
  <button class="btn ghost sm" data-act="resetPlan">Reset to the default ${S.profile.diet === 'nonveg' ? 'non-veg' : S.profile.diet === 'veg' ? 'veg' : 'veg + egg'} plan</button>`;
}
function groceryList(days) {
  const plan = planOf(); const acc = new Map();
  for (const m of MEALS) for (const [id, q] of plan[m] || []) {
    const f = food(id); if (!f?.buy) continue;
    const [amt, unit, item] = f.buy; const k = `${item}|${unit}`;
    const cur = acc.get(k) || { item, unit, amt: 0, cat: f.cat };
    cur.amt += amt * q * days; acc.set(k, cur);
  }
  const fmt = (g) => (g.unit === 'pc' ? String(Math.ceil(g.amt)) : g.unit === 'g' ? (g.amt >= 1000 ? `${+(g.amt / 1000).toFixed(2)} kg` : `${roundTo(g.amt, 10)} g`) : (g.amt >= 1000 ? `${+(g.amt / 1000).toFixed(2)} L` : `${roundTo(g.amt, 10)} ml`));
  return [...acc.values()].map((g) => ({ ...g, qty: fmt(g) })).sort((a, b) => a.cat.localeCompare(b.cat) || a.item.localeCompare(b.item));
}
function vPrep() {
  const wk = weekStart(today()); const days = S.prepDays || 7;
  const list = groceryList(days); const ticks = S.grocery[wk] || {};
  const preps = [...new Set(MEALS.flatMap((m) => (planOf()[m] || []).map(([id]) => food(id)?.prep).filter(Boolean)))];
  const cats = [...new Set(list.map((g) => g.cat))];
  return `
  <section class="card">
    <div class="head"><h3>Groceries for <select class="inp sm" data-prepdays>${[3, 4, 7].map((n) => `<option value="${n}" ${n === days ? 'selected' : ''}>${n} days</option>`).join('')}</select></h3><button class="btn ghost sm" data-act="shareList">Share</button></div>
    <p class="small muted">From your day plan, week of ${fmtShort(wk)}. Ticks reset every Monday.</p>
    ${cats.map((c) => `<h4>${esc(c)}</h4><ul class="checks">${list.filter((g) => g.cat === c).map((g) => { const k = `${g.item}|${g.unit}`; return `<li><label><input type="checkbox" data-gro="${esc(k)}" ${ticks[k] ? 'checked' : ''}> <span class="gitem">${esc(g.item)}</span><span class="num">${g.qty}</span></label></li>`; }).join('')}</ul>`).join('')}
  </section>
  <section class="card">
    <h3>Prep twice a week</h3>
    <p class="small muted">Sunday covers Mon–Wed, Wednesday night covers Thu–Sat. About 60–75 minutes each.</p>
    <ol class="steps-list">${preps.map((p) => `<li>${esc(p)}</li>`).join('')}
      <li>Portion lunches into boxes with the protein weighed (100 g paneer, 50 g dry soya, 150 g chicken). Then no daily maths.</li>
      <li>Keep one ready snack in the bag: roasted chana, a boiled egg or a whey sachet.</li></ol>
  </section>`;
}

// ----- sleep -----
function sleepMins(s) { return (Date.parse(s.wake) - Date.parse(s.bed)) / 60000; }
function minsOfDay(iso, base = 18) { const d = new Date(iso); let m = d.getHours() * 60 + d.getMinutes() - base * 60; if (m < 0) m += 1440; return m; }
function sd(a) { const m = avg(a); return Math.sqrt(avg(a.map((x) => (x - m) ** 2))); }
function vSleep() {
  const tg = targets(); const goal = tg.sleep * 60;
  const nights = [...S.sleep].sort((a, b) => a.wake.localeCompare(b.wake));
  const last7 = nights.filter((s) => diffDays(dkey(new Date(s.wake)), today()) < 7);
  const avg7 = avg(last7.map(sleepMins));
  const bedSd = last7.length >= 3 ? sd(last7.map((s) => minsOfDay(s.bed))) : null;
  const wakeSpread = last7.length >= 3 ? (() => { const m = last7.map((s) => minsOfDay(s.wake, 12)); return Math.max(...m) - Math.min(...m); })() : null;
  const avgBed = last7.length ? avg(last7.map((s) => minsOfDay(s.bed))) : null;
  const avgWake = last7.length ? avg(last7.map((s) => minsOfDay(s.wake, 0))) : null;
  const clock = (m, base) => { let x = Math.round(m + base * 60) % 1440; return `${pad(Math.floor(x / 60))}:${pad(x % 60)}`; };
  // last 14 nights by wake date
  const days = [...Array(14).keys()].map((i) => addDays(today(), i - 13));
  const byDay = Object.fromEntries(nights.map((s) => [dkey(new Date(s.wake)), s]));
  const vals = days.map((d) => (byDay[d] ? +(sleepMins(byDay[d]) / 60).toFixed(2) : null));
  return `
  <section class="card center">
    ${S.bedPending ? `<p class="muted">In bed since ${fmtTime(S.bedPending)}</p><button class="btn primary big" data-act="wake">I'm awake</button><button class="btn ghost sm" data-act="cancelBed">Cancel</button>`
      : '<button class="btn primary big" data-act="bed">Going to bed</button><p class="small muted">Tap when the lights go off; tap "I\'m awake" in the morning. Forgot? Add the night by hand below.</p>'}
  </section>
  <section class="card stats3">
    <div><div class="kicker">7-night avg</div><b>${avg7 != null ? hm(avg7) : '–'}</b><div class="small muted">goal ${tg.sleep} h</div></div>
    <div><div class="kicker">Bedtime</div><b>${avgBed != null ? clock(avgBed, 18) : '–'}</b><div class="small muted">${bedSd != null ? `±${Math.round(bedSd)} min` : 'need 3 nights'}</div></div>
    <div><div class="kicker">Wake</div><b>${avgWake != null ? clock(avgWake, 0) : '–'}</b><div class="small muted">${wakeSpread != null ? `${Math.round(wakeSpread)} min spread` : 'same time daily'}</div></div>
  </section>
  <section class="card">
    <h3>Last 14 nights</h3>
    ${chart('sleep', { title: 'Hours slept, last 14 nights', kind: 'bar', labels: days.map(fmtShort), values: vals, refs: [{ y: tg.sleep, label: `goal ${tg.sleep} h` }], yFmt: (v) => `${Math.round(v)}h`, minSpan: 9, good: (v) => v >= tg.sleep - 0.25, empty: 'Log a night to see the chart',
      tip: (i) => { const s = byDay[days[i]]; return s ? [[hm(sleepMins(s)), fmtDay(days[i])], [`${fmtTime(s.bed)} → ${fmtTime(s.wake)}${s.q ? ` · quality ${s.q}/5` : ''}`]] : [['–', fmtDay(days[i])]]; } })}
    ${wakeSpread != null && wakeSpread > 60 ? '<p class="note">Your wake-up time moved more than an hour this week. Pick one alarm time for every day, weekends included; bedtime follows.</p>' : ''}
  </section>
  <section class="card">
    <div class="head"><h3>Nights</h3><button class="btn sm" data-act="sleepForm">+ add night</button></div>
    ${nights.length ? `<table class="tbl">${nights.slice(-21).reverse().map((s) => `<tr><td class="nowrap">${fmtShort(dkey(new Date(s.wake)))}</td><td class="num">${fmtTime(s.bed)}–${fmtTime(s.wake)}</td><td class="num"><b>${hm(sleepMins(s))}</b></td><td class="num">${s.q ? `${s.q}/5` : ''}</td><td><button class="icon-btn" data-act="delSleep" data-id="${s.id}" aria-label="Delete night">${icon('x')}</button></td></tr>`).join('')}</table>` : '<p class="muted">Nothing yet.</p>'}
  </section>
  <section class="card"><h3>Why it matters on a cut</h3>
    <p class="small">On the same diet, people given 5.5 hours in bed lost 55% less fat and 60% more muscle than at 8.5 hours (Nedeltcheva 2010). Sleeping about 1.2 hours more cut how much people ate by about 270 kcal a day (Tasali 2022). Sleep is part of the fat-loss plan.</p>
    <ul class="small"><li>At least 7 hours asleep; plan 7.5–9 in bed.</li><li>Same wake-up time every day (within an hour), weekends too.</li><li>Caffeine stops 8+ hours before bed.</li><li>Last big meal 2–3 hours before bed; whey or curd later is fine.</li><li>Dark, cool room; phone away from the bed.</li></ul></section>`;
}

// ----- stats -----
function navyBF(waist, neck, h) {
  if (!waist || !neck || waist <= neck) return null;
  return 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(h)) - 450;
}
function vStats() {
  const tg = targets(); const t = today();
  const ws = S.body.filter((b) => b.w).sort((a, b) => a.date.localeCompare(b.date));
  // weight: daily series over the last 60 days
  let wChart = '<p class="muted">Log your morning weight on the Today tab.</p>'; let rate = '';
  if (ws.length) {
    const start = ws.length && diffDays(ws[0].date, t) > 59 ? addDays(t, -59) : ws[0].date;
    const n = diffDays(start, t) + 1; const days = [...Array(n).keys()].map((i) => addDays(start, i));
    const map = Object.fromEntries(ws.map((b) => [b.date, b.w]));
    const raw = days.map((d) => map[d] ?? null);
    const ma = days.map((d, i) => { const win = days.slice(Math.max(0, i - 6), i + 1).map((x) => map[x]).filter((v) => v != null); return win.length ? +avg(win).toFixed(2) : null; });
    wChart = chart('weight', { title: 'Weight', labels: days.map(fmtShort), values: ma, dots: raw, yFmt: (v) => v.toFixed(1), minSpan: 2, markers: false,
      tip: (i) => [[ma[i] != null ? `${ma[i].toFixed(1)} kg` : '–', '7-day avg'], [raw[i] != null ? `${raw[i]} kg weigh-in · ${fmtDay(days[i])}` : fmtDay(days[i])]] });
    const thisW = avg(ws.filter((b) => diffDays(b.date, t) < 7).map((b) => b.w));
    const prevW = avg(ws.filter((b) => { const d = diffDays(b.date, t); return d >= 7 && d < 14; }).map((b) => b.w));
    if (thisW && prevW) {
      const ch = thisW - prevW; const pct = (ch / prevW) * 100;
      const early = weekNo() <= 4;
      const verdict = early ? 'Weeks 1–4 don\'t count: creatine and fresh training add 0.5–1 kg of water, which hides fat loss. Don\'t change calories yet.'
        : ch > -0.2 ? 'Slower than planned. If this holds 2 weeks and your waist is flat too, eat 150 kcal less or add 2,000 steps a day. If the waist is dropping and lifts are going up, that is recomposition: change nothing.'
        : ch < -0.8 ? 'Faster than 0.8 kg a week: muscle is at risk. Add 150 kcal, mostly carbs around training.'
        : 'On track (0.2–0.8 kg a week). Change nothing.';
      rate = `<p><b>${ch > 0 ? '+' : ''}${ch.toFixed(2)} kg</b> this week vs last (${pct > 0 ? '+' : ''}${pct.toFixed(2)}%). <span class="muted">${verdict}</span></p>`;
    }
  }
  const ms = S.body.filter((b) => b.waist && b.neck).sort((a, b) => a.date.localeCompare(b.date));
  const bf = ms.map((b) => +navyBF(b.waist, b.neck, S.profile.heightCm).toFixed(1));
  const lastM = ms.at(-1);
  // lifts
  const done = [...new Set(S.workouts.flatMap((w) => w.items.map((i) => i.ex)))];
  if (!ui.liftEx || !done.includes(ui.liftEx)) ui.liftEx = done[0] || null;
  let lift = '<p class="muted">Finish a workout to see strength trends.</p>';
  if (ui.liftEx) {
    const h = exHistory(ui.liftEx).reverse();
    const vals = h.map((x) => +Math.max(...x.sets.map((s) => e1rm(s.w, s.r))).toFixed(1));
    lift = `<select class="inp" data-liftex>${done.map((e) => `<option value="${e}" ${e === ui.liftEx ? 'selected' : ''}>${esc(EXERCISES[e]?.name || e)}</option>`).join('')}</select>
      ${chart('lift', { title: 'Estimated 1-rep max', labels: h.map((x) => fmtShort(x.date)), values: vals, yFmt: (v) => v.toFixed(1), minSpan: 2,
        tip: (i) => [[`${vals[i]} kg`, 'est. 1RM'], [h[i].sets.map((s) => `${kg(s.w)}×${s.r}`).join(', ')]] })}
      <p class="small muted">Estimated 1-rep max from your best set (weight × (1 + reps/30)). Holding this flat on a cut is a win; rising means you're gaining muscle.</p>`;
  }
  // weekly sets per muscle
  const ws0 = weekStart(t);
  const thisWeek = S.workouts.filter((w) => w.date >= ws0);
  const per = {};
  for (const w of thisWeek) for (const it of w.items) { const m = EXERCISES[it.ex]?.muscle; if (m) per[m] = (per[m] || 0) + it.sets.length; }
  const last28 = S.workouts.filter((w) => diffDays(w.date, t) < 28).length;
  return `
  <section class="card"><h3>Weight</h3>${wChart}${rate}
    <p class="small muted">Target loss ${tg.lossLo}–${tg.lossHi} kg a week (0.5–0.75% of body weight). Dots are single weigh-ins; the line is the 7-day average. Weight is often highest on Sunday and Monday.</p></section>
  <section class="card"><div class="head"><h3>Body fat (US Navy tape method)</h3></div>
    ${ms.length ? chart('bf', { title: 'Body fat estimate', labels: ms.map((b) => fmtShort(b.date)), values: bf, refs: [{ y: 20, label: '20%' }, { y: 15, label: '15% goal' }], yFmt: (v) => `${Math.round(v)}%`, minSpan: 8,
      tip: (i) => [[`${bf[i]}%`, fmtDay(ms[i].date)], [`waist ${ms[i].waist} cm · neck ${ms[i].neck} cm`]] }) : ''}
    ${lastM ? `<p>Latest <b>${navyBF(lastM.waist, lastM.neck, S.profile.heightCm).toFixed(1)}%</b> <span class="muted">(${fmtShort(lastM.date)})</span></p>` : ''}
    <form class="form" data-form="measure"><div class="row2">
      <label>Waist at navel (cm) <input class="inp" name="waist" type="number" inputmode="decimal" step="0.1" value="${lastM?.waist ?? ''}"></label>
      <label>Neck (cm) <input class="inp" name="neck" type="number" inputmode="decimal" step="0.1" value="${lastM?.neck ?? ''}"></label></div>
      <button class="btn">Save measurement</button></form>
    <p class="small muted">Every Sunday morning before food. Waist: tape level at the navel, relaxed, breathe out. Neck: just below the Adam's apple. The estimate can be off by about ±3.7 points either way, so watch the trend: each cm off the waist is about 0.7% body fat.</p></section>
  <section class="card"><h3>Strength</h3>${lift}</section>
  <section class="card"><h3>Sets this week</h3>
    <p class="small muted">${thisWeek.length} sessions since Monday, ${last28} in the last 4 weeks. Ranges are the weekly targets once Build starts (week 3).</p>
    <table class="tbl">${Object.entries(MUSCLE_TARGETS).map(([m, [a, b]]) => { const v = per[m] || 0; return `<tr><td>${m}</td><td class="barcell"><span class="hbar" style="width:${Math.min(100, (v / b) * 100)}%"></span></td><td class="num"><b>${v}</b> <span class="muted">/ ${a}–${b}</span></td></tr>`; }).join('')}</table></section>`;
}

// ----- plan & settings -----
function vPlan() {
  const ms = S.body.filter((b) => b.waist && b.neck).sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  const bf = ms ? navyBF(ms.waist, ms.neck, S.profile.heightCm) : null;
  return planView({ S, tg: targets(), week: weekNo(), phaseOf, dayPlan, schedOf, PHASES, DAYS, SCHEDULES, EXERCISES, addDays, fmtShort, esc, restFor, mmss, bf, suggest, kg });
}

function vSettings() {
  const p = S.profile; const tg = targets(); const st = S.settings;
  const notifState = !('Notification' in window) ? 'not supported here' : Notification.permission;
  return `
  <form class="card form" data-form="profile">
    <h3>Profile</h3>
    <div class="row2"><label>Age <input class="inp" name="age" type="number" value="${p.age}"></label><label>Height (cm) <input class="inp" name="heightCm" type="number" step="0.1" value="${p.heightCm}"></label></div>
    <div class="row2"><label>Start weight (kg) <input class="inp" name="weightKg" type="number" step="0.1" value="${p.weightKg}"></label><label>Program start <input class="inp" name="startDate" type="date" value="${p.startDate}"></label></div>
    <label>Diet <select class="inp" name="diet">${[['veg', 'Vegetarian'], ['egg', 'Vegetarian + eggs'], ['nonveg', 'Non-veg']].map(([v, l]) => `<option value="${v}" ${p.diet === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label>Weekly schedule from week 3 <select class="inp" name="schedule">${['five', 'six'].map((k) => `<option value="${k}" ${(p.schedule || 'five') === k ? 'selected' : ''}>${SCHEDULES[k].label}</option>`).join('')}</select></label>
    <label>Activity <select class="inp" name="activity">${ACTIVITY.map((a) => `<option value="${a.v}" ${+p.activity === a.v ? 'selected' : ''}>${a.label}</option>`).join('')}</select></label>
    <div class="row2"><label>Calories (blank = auto ${roundTo(tg.tdee - (p.deficit ?? 500), 50)}) <input class="inp" name="kcalOverride" type="number" value="${p.kcalOverride || ''}"></label><label>Protein g (blank = auto ${roundTo(tg.w * 1.9, 5)}) <input class="inp" name="proteinOverride" type="number" value="${p.proteinOverride || ''}"></label></div>
    <label>Sleep goal (hours) <input class="inp" name="sleepGoal" type="number" step="0.25" value="${p.sleepGoal || 8}"></label>
    <button class="btn primary">Save profile</button>
  </form>
  <form class="card form" data-form="settings">
    <h3>Workout</h3>
    <div class="row3"><label>Rest, heavy free weights (s) <input class="inp" name="restHeavy" type="number" step="15" value="${st.restHeavy ?? 150}"></label><label>Rest, machine compounds (s) <input class="inp" name="restCompound" type="number" step="15" value="${st.restCompound}"></label><label>Rest, isolation (s) <input class="inp" name="restIso" type="number" step="15" value="${st.restIso}"></label></div>
    <label class="radio"><input type="checkbox" name="sound" ${st.sound ? 'checked' : ''}> Chime when rest ends</label>
    <label class="radio"><input type="checkbox" name="vibrate" ${st.vibrate ? 'checked' : ''}> Vibrate (Android)</label>
    <label class="radio"><input type="checkbox" name="wake" ${st.wake ? 'checked' : ''}> Keep the screen on during a workout</label>
    <label class="radio"><input type="checkbox" name="notify" ${st.notify ? 'checked' : ''}> Notification when rest ends while the app is in the background <span class="muted">(${notifState}; Android, or iPhone with the app on the home screen)</span></label>
    <button class="btn primary">Save</button>
  </form>
  ${!API ? '' : `<section class="card">
    <h3>Cloud copy</h3>
    <p class="small" id="syncState">${esc(syncText())}</p>
    <p class="small muted">Everything you log is copied to your own server a few seconds after each change, so Claude can read it and a new install picks it up. Entries Claude adds show up here on the next open.</p>
    ${canSync() ? '<button class="btn sm" data-act="syncNow">Sync now</button>' : ''}
  </section>`}
  <section class="card">
    <h3>Backup</h3>
    <p class="small muted">${API ? 'A file copy, in case.' : 'Data lives only in this browser.'} Export after big changes; import on a new phone.</p>
    <div class="row-btns"><button class="btn" data-act="export">Export backup</button><button class="btn" data-act="importPick">Import backup</button></div>
    <button class="btn ghost danger sm" data-act="reset">Erase everything</button>
  </section>
  <section class="card small muted"><p>Install: in Chrome tap ⋮ → Add to Home screen; on iPhone Safari tap Share → Add to Home Screen. Long-press the icon on Android for Going to bed / I'm awake shortcuts.</p></section>`;
}

// ---------- actions ----------
const act = {
  start(el) {
    unlockAudio();
    if (S.active) { location.hash = '#train'; return; }
    S.active = newActive(el.dataset.day); save();
    if (S.settings.notify && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    keepAwake(true);
    if (location.hash !== '#train') location.hash = '#train'; else render();
  },
  pastForm() {
    modal(`<h3>Log a past session</h3><form class="form" data-form="past">
      <label>Date <input class="inp" type="date" name="date" max="${today()}" value="${addDays(today(), -1)}" required></label>
      <label>Day <select class="inp" name="day">${Object.keys(DAYS).map((d) => `<option value="${d}">${DAYS[d].name}</option>`).join('')}</select></label>
      <button class="btn primary">Open the log</button></form>`);
  },
  tick(el) {
    unlockAudio();
    const i = +el.dataset.i, j = +el.dataset.s; const it = S.active.items[i]; const s = it.sets[j];
    if (s.done) { s.done = false; save(); render(); return; }
    const E = EXERCISES[it.ex];
    const w = num(s.w); if (w == null && E.inc !== 0) { toast('Enter the weight first'); $(`[data-w="${i}:${j}"]`)?.focus(); return; }
    s.w = w ?? 0;
    const r = num(s.r) ?? num($(`[data-r="${i}:${j}"]`)?.placeholder);
    if (!r) { toast('Enter reps'); return; }
    s.r = Math.round(r); s.done = true; s.t = new Date().toISOString();
    // prefill later sets with this weight if empty
    for (const t of it.sets.slice(j + 1)) if (!t.done && (t.w === '' || t.w == null)) t.w = s.w;
    const lastOfAll = S.active.items.every((x) => x.sets.every((y) => y.done));
    if (!S.active.past && !lastOfAll) {
      const nextIt = it.sets.some((x) => !x.done) ? it : S.active.items.find((x) => x.sets.some((y) => !y.done));
      const nj = nextIt.sets.findIndex((y) => !y.done);
      startRest(restFor(it.ex), `Next: ${EXERCISES[nextIt.ex].name}, set ${nj + 1}${nextIt.sets[nj].w !== '' ? ` · ${kg(nextIt.sets[nj].w)} kg` : ''}`);
    }
    save(); render();
    if (!it.sets.some((x) => !x.done) && !it.effort) toast('How did that feel? Tap easy / good / hard.');
  },
  bump(el) {
    const i = +el.dataset.i, j = +el.dataset.s; const it = S.active.items[i]; const s = it.sets[j];
    const E = EXERCISES[it.ex]; const step = Math.abs(E.inc) || 1;
    const cur = num(s.w) ?? 0; s.w = Math.max(0, roundTo(cur + step * +el.dataset.d, 0.25));
    save(); const inp = $(`[data-w="${i}:${j}"]`); if (inp) inp.value = s.w;
  },
  addSet(el) { const it = S.active.items[+el.dataset.i]; const last = it.sets.at(-1); it.sets.push({ w: last?.w ?? '', r: '', done: false }); save(); render(); },
  rmSet(el) { const it = S.active.items[+el.dataset.i]; const k = it.sets.map((s) => s.done).lastIndexOf(false); it.sets.splice(k >= 0 ? k : it.sets.length - 1, 1); save(); render(); },
  effort(el) { const it = S.active.items[+el.dataset.i]; it.effort = it.effort === el.dataset.e ? null : el.dataset.e; save(); render(); },
  walkTimer() { unlockAudio(); startRest(600, 'Treadmill walk', true); },
  walkDone() { S.active.walk = !S.active.walk; if (S.active.walk && S.active.rest?.walk) S.active.rest = null; save(); render(); },
  skipRest() { if (S.active) { S.active.rest = null; save(); tick(); } },
  restAdj(el) { const r = S.active?.rest; if (!r) return; const d = +el.dataset.d; if (r.fired) { if (d > 0) startRest(d, r.label); return; } r.endAt += d * 1000; r.total = Math.max(r.total + d, 1); save(); tick(); },
  info(el) {
    const ex = el.dataset.ex; const E = EXERCISES[ex]; const h = exHistory(ex).slice(0, 6);
    modal(`<h3>${esc(E.name)}</h3><p>${esc(E.cue)}</p>
      <p class="small muted">${E.type === 'compound' ? 'Compound' : 'Isolation'} · ${E.reps.join('–')} reps · rest ${mmss(restFor(ex))} · steps of ${kg(Math.abs(E.inc))} kg</p>
      ${h.length ? `<table class="tbl">${h.map((x) => `<tr><td>${fmtShort(x.date)}</td><td class="num">${x.sets.map((s) => `${kg(s.w)}×${s.r}`).join(', ')}</td><td>${x.effort || ''}</td></tr>`).join('')}</table><p class="small">Best est. 1RM: <b>${bestE1rm(ex).toFixed(1)} kg</b></p>` : '<p class="muted small">No history yet.</p>'}
      <button class="btn" data-act="close">Close</button>`);
  },
  swapForm(el) {
    const i = +el.dataset.i; const it = S.active.items[i];
    const orig = DAYS[S.active.day].slots[it.slot]?.ex || it.ex;
    const opts = [...new Set([orig, ...EXERCISES[orig].alts, ...EXERCISES[it.ex].alts])];
    modal(`<h3>Swap exercise</h3><p class="small muted">Machine taken or missing? The swap is remembered for next time.</p>
      <div class="list">${opts.map((e) => `<button class="btn${e === it.ex ? ' primary' : ''}" data-act="swap" data-i="${i}" data-ex="${e}">${esc(EXERCISES[e].name)}</button>`).join('')}</div>`);
  },
  swap(el) {
    const i = +el.dataset.i; const it = S.active.items[i]; const ex = el.dataset.ex;
    it.ex = ex; if (it.slot != null) S.swaps[`${S.active.day}:${it.slot}`] = ex;
    const sg = suggest(ex, phaseOf(S.active.week));
    for (const s of it.sets) if (!s.done) { s.w = sg.w ?? ''; s.r = ''; }
    save(); closeModal(); render();
  },
  addExForm() {
    const groups = {};
    for (const [id, E] of Object.entries(EXERCISES)) (groups[E.muscle] ||= []).push([id, E]);
    modal(`<h3>Add exercise</h3><div class="list">${Object.entries(groups).map(([m, xs]) => `<h4>${esc(m)}</h4>${xs.map(([id, E]) => `<button class="btn ghost" data-act="addEx" data-ex="${id}">${esc(E.name)}</button>`).join('')}`).join('')}</div>`);
  },
  addEx(el) {
    const ex = el.dataset.ex; const sg = suggest(ex, phaseOf(S.active.week));
    S.active.items.push({ slot: null, ex, effort: null, sets: Array.from({ length: phaseOf(S.active.week).sets }, () => ({ w: sg.w ?? '', r: '', done: false })) });
    save(); closeModal(); render();
  },
  finish() {
    const A = S.active;
    const items = A.items.map((it) => ({ ex: it.ex, effort: it.effort, sets: it.sets.filter((s) => s.done).map(({ w, r, t }) => ({ w: +w, r: +r, done: true, t })) })).filter((it) => it.sets.length);
    if (!items.length) { if (confirm('No sets ticked. Discard this workout?')) { S.active = null; save(); keepAwake(false); render(); } return; }
    const prs = items.filter((it) => { const b = bestE1rm(it.ex); return b > 0 && Math.max(...it.sets.map((s) => e1rm(s.w, s.r))) > b + 0.01; }).map((it) => EXERCISES[it.ex].name);
    const mins = A.past ? null : Math.round((Date.now() - Date.parse(A.startedAt)) / 60000);
    S.workouts.push({ id: A.id, day: A.day, date: A.date, startedAt: A.startedAt, mins, items, walk: !!A.walk });
    S.active = null; save(); keepAwake(false);
    const sets = sum(items.map((i) => i.sets.length));
    modal(`<h3>${DAYS[A.day].name} done ${icon('check', 'ok')}</h3><p><b>${sets}</b> sets${mins ? ` in <b>${mins}</b> min` : ''}.</p>
      ${prs.length ? `<p>New bests: ${prs.map(esc).join(', ')}</p>` : ''}
      ${A.walk ? '<p>Treadmill walk done.</p>' : '<p class="note small">Skipped the 10-minute walk? Do it now, or a 15-minute walk later today.</p>'}
      <p class="small muted">Now: protein within the next few hours (whey counts). Next session: ${DAYS[nextDay()].name}.</p>
      <button class="btn primary" data-act="close">Nice</button>`);
    location.hash = '#today';
  },
  discard() { if (confirm('Discard this workout? Ticked sets will be lost.')) { S.active = null; save(); keepAwake(false); render(); } },
  delWorkout(el) { if (confirm('Delete this session?')) { S.workouts = S.workouts.filter((w) => w.id !== el.dataset.id); save(); render(); } },
  close() { closeModal(); },

  water(el) { const t = today(); const h = (S.habits[t] ||= {}); h.water = Math.max(0, (h.water || 0) + +el.dataset.d); save(); render(); },

  bed() { S.bedPending = new Date().toISOString(); save(); toast('Good night. Tap "I\'m awake" in the morning.'); render(); },
  cancelBed() { S.bedPending = null; save(); render(); },
  wake() {
    const bed = S.bedPending; const now = new Date().toISOString();
    const mins = (Date.parse(now) - Date.parse(bed)) / 60000;
    if (mins < 60) { if (!confirm(`Only ${Math.round(mins)} min since you tapped "Going to bed". Save anyway?`)) return; }
    const id = uid(); S.sleep.push({ id, bed, wake: now, q: null }); S.bedPending = null; save();
    modal(`<h3>Slept ${hm(mins)}</h3><p>How rested do you feel?</p><div class="qrow">${[1, 2, 3, 4, 5].map((q) => `<button class="btn" data-act="sleepQ" data-id="${id}" data-q="${q}">${q}</button>`).join('')}</div><p class="small muted">1 = wrecked, 5 = fully rested</p>`);
    render();
  },
  sleepQ(el) { const s = S.sleep.find((x) => x.id === el.dataset.id); if (s) s.q = +el.dataset.q; save(); closeModal(); render(); },
  sleepForm() {
    modal(`<h3>Add a night</h3><form class="form" data-form="sleep">
      <label>Woke up on <input class="inp" type="date" name="date" value="${today()}" max="${today()}" required></label>
      <div class="row2"><label>Bed time <input class="inp" type="time" name="bed" value="23:30" required></label><label>Wake time <input class="inp" type="time" name="wake" value="07:00" required></label></div>
      <label>Quality (1–5) <input class="inp" type="number" name="q" min="1" max="5" inputmode="numeric"></label>
      <button class="btn primary">Save</button></form>`);
  },
  delSleep(el) { S.sleep = S.sleep.filter((s) => s.id !== el.dataset.id); save(); render(); },

  mSkip(el) { const k = el.dataset.k; if (ui.mskip.has(k)) ui.mskip.delete(k); else ui.mskip.add(k); refreshMealBox(); },
  mPhotoClear() { ui.mphoto = null; ui.mskip = new Set([...ui.mskip].filter((k) => k.startsWith('t'))); refreshMealBox(); },
  async mEstimate() {
    const lines = mealRows().filter((r) => r.src === 'unknown' && !r.skip).map((r) => r.raw);
    if (!lines.length || !canSync()) return;
    ui.mbusy = 'Estimating…'; refreshMealBox();
    try { const r = await api('/estimate', { items: lines }); for (const it of r.items || []) ui.mai[it.text] = it; }
    catch (e) { toast(`Estimate failed: ${e.message}`); }
    ui.mbusy = false; refreshMealBox();
  },
  hideInstall() { ls('gym-install-hint', '1'); render(); },
  syncNow() { if (canSync()) { sync.dirty = true; pushSync(); toast('Syncing…'); } },
  foodDay(el) { const d = addDays(ui.foodDate, +el.dataset.d); if (d <= today()) { ui.foodDate = d; render(); } },
  addFood(el) { ui.addMeal = el.dataset.m; ui.addMode = el.dataset.mode; ui.query = ''; modal(addFoodHtml()); $('#fq')?.focus(); },
  pickFood(el) {
    const f = food(el.dataset.id); if (!f) return;
    if (ui.addMode === 'plan') {
      const plan = structuredClone(planOf()); (plan[ui.addMeal] ||= []).push([f.id, 1]); S.plan = plan;
    } else {
      (S.food[ui.foodDate] ||= []).push({ fid: f.id, name: f.name, serving: f.serving, kcal: f.kcal, p: f.p, qty: 1, meal: ui.addMeal });
    }
    save(); closeModal(); render(); toast(`Added ${f.name}`);
  },
  customForm() {
    modal(`<h3>New food</h3><form class="form" data-form="custom">
      <label>Name <input class="inp" name="name" required></label>
      <label>Serving <input class="inp" name="serving" placeholder="e.g. 1 bowl" required></label>
      <div class="row2"><label>Calories <input class="inp" name="kcal" type="number" inputmode="numeric" required></label><label>Protein (g) <input class="inp" name="p" type="number" step="0.5" inputmode="decimal" required></label></div>
      <button class="btn primary">Save and add</button></form>`);
  },
  qty(el) {
    const log = S.food[ui.foodDate]; const f = log[+el.dataset.idx]; f.qty = +(f.qty + +el.dataset.d).toFixed(2);
    if (f.qty <= 0) log.splice(+el.dataset.idx, 1);
    save(); render();
  },
  planQty(el) {
    const plan = structuredClone(planOf()); const row = plan[el.dataset.m][+el.dataset.k];
    row[1] = +(row[1] + +el.dataset.d).toFixed(2); if (row[1] <= 0) plan[el.dataset.m].splice(+el.dataset.k, 1);
    S.plan = plan; save(); render();
  },
  resetPlan() { if (confirm('Reset the day plan to the default?')) { S.plan = null; save(); render(); } },
  logPlanMeal(el) { logPlan([el.dataset.m]); },
  logPlanDay() { const have = new Set((S.food[ui.foodDate] || []).map((f) => f.meal)); logPlan(MEALS.filter((m) => !have.has(m))); },
  copyYesterday() {
    const y = S.food[addDays(ui.foodDate, -1)] || []; if (!y.length) { toast('Nothing logged the day before'); return; }
    (S.food[ui.foodDate] ||= []).push(...y.map((f) => ({ ...f }))); save(); render(); toast(`Copied ${y.length} items`);
  },
  shareList() {
    const list = groceryList(S.prepDays || 7); const text = `Groceries (${S.prepDays || 7} days)\n${list.map((g) => `- ${g.item}: ${g.qty}`).join('\n')}`;
    if (navigator.share) navigator.share({ text }).catch(() => {}); else navigator.clipboard?.writeText(text).then(() => toast('List copied'));
  },

  export() {
    const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `gym-backup-${today()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },
  importPick() { $('#importFile').click(); },
  reset() { if (confirm('Erase all workouts, food, sleep and settings on this device?') && confirm('Really? This cannot be undone.')) { localStorage.removeItem(KEY); S = defaults(); save(); render(); } },
};

function logPlan(meals) {
  const plan = planOf(); const log = (S.food[ui.foodDate] ||= []); let n = 0;
  for (const m of meals) for (const [id, q] of plan[m] || []) { const f = food(id); if (f) { log.push({ fid: f.id, name: f.name, serving: f.serving, kcal: f.kcal, p: f.p, qty: q, meal: m }); n++; } }
  save(); render(); toast(n ? `Logged ${n} items from your plan` : 'Those meals are already logged');
}

function addFoodHtml() {
  return `<h3>Add to ${esc(ui.addMeal)}${ui.addMode === 'plan' ? ' (day plan)' : ''}</h3>
    <input id="fq" class="inp" type="search" placeholder="Search: paneer, dal, roti…" autocomplete="off" value="${esc(ui.query)}">
    <div id="flist" class="flist">${foodListHtml()}</div>
    <button class="btn ghost sm" data-act="customForm">+ Food not listed</button>`;
}
function foodListHtml() {
  const q = ui.query.trim().toLowerCase();
  const recent = [...new Set(Object.keys(S.food).sort().reverse().flatMap((d) => S.food[d].map((f) => f.fid)).filter(Boolean))].slice(0, 8);
  let list = allFoods().filter(dietOK);
  if (q) list = list.filter((f) => `${f.name} ${f.cat}`.toLowerCase().includes(q));
  else list = [...recent.map(food).filter(Boolean), ...list.filter((f) => !recent.includes(f.id)).sort((a, b) => b.p / b.kcal - a.p / a.kcal)];
  return list.slice(0, 60).map((f, i) => `<button class="frow" data-act="pickFood" data-id="${f.id}"><span><span class="fname">${esc(f.name)}</span>${!q && i < recent.length ? ' <span class="tag">recent</span>' : ''}<br><span class="small muted">${esc(f.serving)}</span></span><span class="num small"><b>${f.p} g P</b><br>${f.kcal} kcal</span></button>`).join('') || '<p class="muted">No match. Add it as a new food.</p>';
}

// ---------- forms & inputs ----------
const forms = {
  async gate(fd) {
    const msg = $('#gate-msg');
    if (!window.crypto?.subtle) { msg.textContent = 'This page needs a secure (https) connection.'; return; }
    const pw = String(fd.get('pw')).trim().toLowerCase();
    if (await sha256(pw) === GATE_HASH) {
      try { localStorage.setItem(GATE_KEY, GATE_HASH); localStorage.setItem(SYNC_KEY, await sha256(`gym-sync|${pw}`)); } catch (e) { /* stays unlocked for this visit only */ }
      unlocked = true; render();
      if (fresh) restoreIfFresh(); else scheduleSync(500);
    } else { msg.textContent = 'Wrong password.'; $('input[name=pw]')?.select(); }
  },
  meal(fd) {
    clearTimeout(mealT); ui.mtext = String(fd.get('text') || ''); ui.mrows = parseMeal(ui.mtext, mealIndex());
    const meal = fd.get('meal') || guessMeal(); const at = new Date().toISOString();
    const rows = mealRows().filter((r) => !r.skip && r.src !== 'unknown');
    const left = mealRows().filter((r) => !r.skip && r.src === 'unknown');
    if (!rows.length) { toast(left.length ? 'Nothing recognised yet. Add numbers, or tap Estimate.' : 'Type what you ate'); return; }
    const log = (S.food[ui.foodDate] ||= []);
    for (const r of rows) {
      log.push({ fid: r.fid || null, name: r.name, serving: r.serving, kcal: r.kcal, p: r.p, qty: r.qty, meal, src: r.src, text: r.raw, at, ...(r.src === 'photo' ? { photo: ui.mphoto?.id } : {}) });
      // a food typed with its own numbers is remembered, so next time the name alone works
      const words = String(r.phrase || '').trim();
      if (r.src === 'given' && !r.fid && words && words.split(' ').length <= 4 && !r.noKcal && !allFoods().some((f) => f.name.toLowerCase() === words)) {
        const n = r.n && r.n > 0 ? r.n : 1;
        S.custom.push({ id: `c_${uid()}`, name: words.charAt(0).toUpperCase() + words.slice(1), serving: r.unit ? `1 ${r.unit}` : '1 serving', kcal: Math.round(r.kcal / n), p: Math.round((r.p / n) * 10) / 10, diet: 'v', cat: 'Custom', buy: null });
      }
    }
    ui.mtext = ''; ui.mrows = []; ui.mskip = new Set(); ui.mai = {}; ui.mphoto = null; ui.mmeal = null;
    save(); render();
    toast(`Added ${rows.length} item${rows.length > 1 ? 's' : ''} to ${meal}${left.length ? `, skipped ${left.length} unknown` : ''}`);
  },
  weight(fd) { const w = num(fd.get('w')); if (!w) return; upsertBody(today(), { w }); save(); toast(`Saved ${w} kg`); render(); },
  measure(fd) { const waist = num(fd.get('waist')), neck = num(fd.get('neck')); if (!waist || !neck) { toast('Enter waist and neck'); return; } upsertBody(today(), { waist, neck }); save(); render(); },
  past(fd) { S.active = newActive(fd.get('day'), fd.get('date'), true); save(); closeModal(); location.hash = '#train'; render(); },
  sleep(fd) {
    const d = fd.get('date'); const [bh, bm] = fd.get('bed').split(':').map(Number); const [wh, wm] = fd.get('wake').split(':').map(Number);
    const wake = parseD(d); wake.setHours(wh, wm);
    const bed = parseD(d); bed.setHours(bh, bm); if (bed >= wake) bed.setDate(bed.getDate() - 1);
    S.sleep.push({ id: uid(), bed: bed.toISOString(), wake: wake.toISOString(), q: num(fd.get('q')) });
    save(); closeModal(); render();
  },
  custom(fd) {
    const f = { id: `c_${uid()}`, name: fd.get('name').trim(), serving: fd.get('serving').trim(), kcal: +fd.get('kcal'), p: +fd.get('p'), diet: 'v', cat: 'Custom', buy: null };
    S.custom.push(f); save(); act.pickFood({ dataset: { id: f.id } });
  },
  profile(fd) {
    const p = S.profile;
    for (const k of ['age', 'heightCm', 'weightKg', 'activity', 'sleepGoal']) p[k] = num(fd.get(k)) ?? p[k];
    p.startDate = fd.get('startDate') || p.startDate; p.diet = fd.get('diet'); p.schedule = fd.get('schedule') || 'five';
    p.kcalOverride = num(fd.get('kcalOverride')); p.proteinOverride = num(fd.get('proteinOverride'));
    save(); toast('Profile saved'); render();
  },
  settings(fd) {
    const st = S.settings;
    st.restHeavy = num(fd.get('restHeavy')) ?? 150; st.restCompound = num(fd.get('restCompound')) ?? 120; st.restIso = num(fd.get('restIso')) ?? 90;
    for (const k of ['sound', 'vibrate', 'wake', 'notify']) st[k] = fd.get(k) === 'on';
    if (st.notify && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission().then(() => render());
    unlockAudio(); save(); toast('Saved'); render();
  },
};
function upsertBody(date, vals) {
  let b = S.body.find((x) => x.date === date);
  if (!b) { b = { date }; S.body.push(b); }
  Object.assign(b, vals);
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const fn = act[el.dataset.act]; if (!fn) return;
  e.preventDefault(); fn(el, e);
});
document.addEventListener('submit', (e) => {
  const f = e.target.closest('form[data-form]'); if (!f) return;
  e.preventDefault(); forms[f.dataset.form]?.(new FormData(f));
});
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.w || t.dataset.r) {
    const [i, j] = (t.dataset.w || t.dataset.r).split(':').map(Number);
    const s = S.active?.items[i]?.sets[j]; if (!s) return;
    if (t.dataset.w) s.w = t.value; else s.r = t.value;
    save();
  } else if (t.id === 'fq') { ui.query = t.value; $('#flist').innerHTML = foodListHtml(); }
  else if (t.id === 'mtext') onMealInput(t.value);
});
document.addEventListener('keydown', (e) => {
  // Enter adds the meal (Shift+Enter for a new line) on keyboards that have it
  if (e.target.id === 'mtext' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); e.target.form.requestSubmit(); }
});
document.addEventListener('change', (e) => {
  const t = e.target; const d = today();
  if (t.dataset.habit) { (S.habits[d] ||= {})[t.dataset.habit] = t.checked; save(); }
  else if ('steps' in t.dataset) { (S.habits[d] ||= {}).steps = num(t.value); save(); }
  else if (t.dataset.gro) { const wk = weekStart(d); (S.grocery[wk] ||= {})[t.dataset.gro] = t.checked; save(); }
  else if ('prepdays' in t.dataset) { S.prepDays = +t.value; save(); render(); }
  else if ('liftex' in t.dataset) { ui.liftEx = t.value; render(); }
  else if ('mmeal' in t.dataset) ui.mmeal = t.value;
  else if (t.id === 'mphoto' && t.files[0]) { mealPhoto(t.files[0]); t.value = ''; }
  else if (t.id === 'importFile' && t.files[0]) {
    t.files[0].text().then((txt) => {
      const o = JSON.parse(txt);
      if (!o || !Array.isArray(o.workouts)) throw new Error('not a backup');
      if (!confirm(`Replace everything on this device with the backup (${o.workouts.length} workouts)?`)) return;
      const dflt = defaults(); S = { ...dflt, ...o, settings: { ...dflt.settings, ...(o.settings || {}) } }; save(); render(); toast('Backup restored');
    }).catch(() => toast('That file is not a gym backup')).finally(() => { t.value = ''; });
  }
});

// One-time setup link: #import=<base64url JSON with profile / workouts / body>
function handleImport() {
  const m = location.hash.match(/^#import=([A-Za-z0-9_-]+)$/);
  if (!m) return false;
  history.replaceState(null, '', `${location.pathname}#today`);
  try {
    const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
    const o = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))));
    if (o.profile && (!S.profile || confirm('Replace your profile with the one in this link?'))) S.profile = { ...S.profile, ...o.profile };
    let added = 0;
    for (const w of o.workouts || []) if (!S.workouts.some((x) => x.id === w.id)) { S.workouts.push(w); added++; }
    for (const b of o.body || []) if (!S.body.some((x) => x.date === b.date)) S.body.push(b);
    save(); setTimeout(() => toast(`Setup loaded${added ? `, ${added} past session${added > 1 ? 's' : ''} added` : ''}`), 50);
  } catch (e) { setTimeout(() => toast('That setup link is broken'), 50); }
  render();
  return true;
}

// ---------- boot ----------
window.addEventListener('hashchange', render);
render();
if (S.active?.rest) runTimer();
if (unlocked && S.active && !S.active.past) { keepAwake(true); runTimer(); }
if (canSync()) { if (fresh) restoreIfFresh(); else scheduleSync(1000); }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushSync(); else if (canSync()) scheduleSync(800); });
window.addEventListener('pagehide', flushSync);
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
