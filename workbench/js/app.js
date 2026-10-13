(() => {
'use strict';

const { filled, STAGES, PROMPTS, BANDS, band, SOURCE_KINDS, RELIABILITY } = window.TW;

/* ================================ utilities ================================ */
const $ = (s, r=document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Math.random().toString(36).slice(2,10);
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const ymd = (d=new Date()) => new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,10);
const plusDays = n => { const d = new Date(); d.setDate(d.getDate()+n); return ymd(d); };
const parseDay = s => { const [y,m,d] = String(s||'').split('-').map(Number); return (y&&m&&d) ? new Date(y,m-1,d) : null; };
const fmtDay = s => { const d = typeof s === 'number' ? new Date(s) : parseDay(s); if (!d || isNaN(d)) return ''; const o = {day:'numeric',month:'short'}; if (d.getFullYear() !== new Date().getFullYear()) o.year = 'numeric'; return d.toLocaleDateString(undefined, o); };
const short = (s,n=60) => { s = String(s||'').trim(); return s.length > n ? s.slice(0,n-1).trimEnd() + '…' : s; };
const plural = (n,w) => `${n} ${w}${n===1?'':'s'}`;
const safeUrl = u => /^https?:\/\//i.test(String(u||'').trim()) ? String(u).trim() : '';
const stageById = id => STAGES.find(s => s.id === id);
const I = {
  check:'<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  x:'<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  dash:'<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4 8h8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  log:'<svg class="ring" viewBox="0 0 32 32" width="32" height="32" aria-hidden="true"><path d="M10 11h12M10 16h12M10 21h7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};

/* ================================ data model ================================ */
const SHAPES = {
  sources:{title:'',url:'',claim:'',kind:'',rel:'',stake:false,corr:false},
  failures:{what:'',why:''},
  assumptions:{text:'',status:''},
  positions:{who:'',claim:'',best:'',track:'',scope:''},
  hypotheses:{text:'',p:''},
  evidence:{text:'',from:'',marks:{}},
  tests:{claim:'',method:'',expect:'',result:'',match:'',learned:''},
  signposts:{text:'',seen:false},
  sessions:{at:0,stage:'understand',src:'',url:'',obs:'',exp:'',pred:''},
  predictions:{text:'',p:60,due:'',createdAt:0,outcome:'',resolvedAt:0,sessionId:''},
  confLog:{at:0,p:50,note:''},
};
function coerce(shape, x){
  x = (x && typeof x === 'object') ? x : {};
  const o = { id: (typeof x.id === 'string' && x.id) ? x.id : uid() };
  for (const k in shape){
    const dv = shape[k], v = x[k];
    if (typeof dv === 'string') o[k] = typeof v === 'string' ? v : dv;
    else if (typeof dv === 'number') o[k] = (v != null && v !== '' && Number.isFinite(+v)) ? +v : dv;
    else if (typeof dv === 'boolean') o[k] = !!v;
    else { o[k] = {}; if (v && typeof v === 'object') for (const kk of Object.keys(v)) if (typeof v[kk] === 'string') o[k][kk] = v[kk]; }
  }
  return o;
}
function normalize(r, id){
  r = (r && typeof r === 'object') ? r : {};
  const str = v => typeof v === 'string' ? v : '';
  const pct = (v,d) => (v != null && v !== '' && Number.isFinite(+v)) ? clamp(Math.round(+v),0,100) : d;
  const q = {
    v:1, id: id || str(r.id) || uid(), title:str(r.title), why:str(r.why), example:!!r.example,
    createdAt:+r.createdAt || Date.now(), updatedAt:+r.updatedAt || +r.createdAt || Date.now(),
    prior:{ take:str(r.prior && r.prior.take), p:pct(r.prior && r.prior.p, 50) },
    fields:{}, manual:{},
    thesis:{ statement:str(r.thesis && r.thesis.statement), p:pct(r.thesis && r.thesis.p, null),
      reasons:[0,1,2].map(i => str(r.thesis && Array.isArray(r.thesis.reasons) ? r.thesis.reasons[i] : '')),
      objection:str(r.thesis && r.thesis.objection), answer:str(r.thesis && r.thesis.answer), reviewOn:str(r.thesis && r.thesis.reviewOn),
      strength:str(r.thesis && r.thesis.strength), basis:str(r.thesis && r.thesis.basis) },
  };
  if (r.fields && typeof r.fields === 'object') for (const k of Object.keys(r.fields)) if (typeof r.fields[k] === 'string') q.fields[k] = r.fields[k];
  if (r.manual && typeof r.manual === 'object') for (const k of Object.keys(r.manual)) q.manual[k] = !!r.manual[k];
  for (const k of Object.keys(SHAPES)) q[k] = Array.isArray(r[k]) ? r[k].map(x => coerce(SHAPES[k], x)) : [];
  return q;
}
const BAD_KEYS = new Set(['__proto__','constructor','prototype']);
function setPath(obj, path, val){
  const parts = path.split('.');
  if (parts.some(p => BAD_KEYS.has(p))) return false;
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++){
    const k = parts[i];
    if (Array.isArray(cur)) cur = cur.find(x => x && x.id === k);
    else { if (cur[k] == null) cur[k] = {}; cur = cur[k]; }
    if (cur == null || typeof cur !== 'object') return false;
  }
  const last = parts[parts.length-1];
  if (Array.isArray(cur)) cur[+last] = val; else cur[last] = val;
  return true;
}

const progress = (q, st) => { const done = st.checks.filter(c => c.manual ? !!q.manual[c.id] : c.ok(q)).length; return {done, total:st.checks.length}; };
function nextStep(q){
  for (let i = 0; i < STAGES.length; i++){
    const st = STAGES[i];
    const c = st.checks.find(c => !(c.manual ? q.manual[c.id] : c.ok(q)));
    if (c) return {st, i, c};
  }
  return null;
}
const curConf = q => q.confLog.length ? q.confLog[q.confLog.length-1].p : null;
const confPoints = q => [{p:q.prior.p, at:q.createdAt, note:'Gut take, before research'}, ...q.confLog];
const allPreds = () => { const out = []; for (const q of store.items.values()) for (const p of q.predictions) if (filled(p.text)) out.push({p, q}); return out; };
const isDue = p => !p.outcome && p.due && p.due <= ymd();
function brier(res){ if (!res.length) return null; return res.reduce((a,{p}) => a + Math.pow(p.p/100 - (p.outcome === 'yes' ? 1 : 0), 2), 0) / res.length; }

/* ================================ storage ================================ */
const store = { mode:'loading', items:new Map(), col:null, timers:{}, dirty:new Set(), writing:new Set(), wroteAt:{}, deletedAt:{}, failed:'', readOnly:false };
let pendingRender = false;

function setSave(){
  const el = $('#save'); if (!el) return;
  let t = 'Saved';
  if (store.mode === 'loading') t = 'Opening…';
  else if (store.readOnly) t = 'View only: changes are not saved';
  else if (store.failed) t = 'Could not save. Will retry on your next edit';
  else if (store.dirty.size || store.writing.size) t = 'Saving…';
  else if (store.mode === 'local') t = 'Saved in this browser only';
  el.textContent = t;
}
function touch(q){ q.updatedAt = Date.now(); markDirty(q.id); }
function markDirty(id){ store.dirty.add(id); setSave(); clearTimeout(store.timers[id]); store.timers[id] = setTimeout(() => flush(id), 700); }
function saveLocal(){ try { localStorage.setItem('tw.data', JSON.stringify([...store.items.values()])); } catch (e) {} }
async function attempt(fn){
  try { return await fn(); }
  catch (e) { if (e && e.code === 'unavailable') { await new Promise(r => setTimeout(r, 400 + Math.random()*600)); return await fn(); } throw e; }
}
async function flush(id){
  clearTimeout(store.timers[id]); delete store.timers[id];
  if (!store.dirty.has(id)) return;
  if (store.mode === 'local'){ store.dirty.delete(id); saveLocal(); setSave(); return; }
  if (store.mode !== 'db' || store.writing.has(id)) return;
  store.dirty.delete(id); store.writing.add(id); setSave();
  const q = store.items.get(id);
  try {
    if (q) await attempt(() => store.col.doc(id).set(JSON.parse(JSON.stringify(q))));
    else await attempt(() => store.col.doc(id).delete());
    store.wroteAt[id] = Date.now(); store.failed = '';
  } catch (e) {
    store.failed = (e && e.code) || 'unavailable';
    if (['invalid_argument','not_granted','revoked'].includes(store.failed)) store.readOnly = true;
    if (store.failed === 'quota_exceeded') toast('Storage for this workbench is full. Delete an old question to make room.');
  }
  store.writing.delete(id);
  if (store.dirty.has(id) && !store.readOnly) flush(id);
  setSave();
}
function flushAll(){ for (const id of [...store.dirty]) flush(id); }

function onSnap(snap){
  const seen = new Set(); let changed = store.mode !== 'db';
  const now = Date.now();
  for (const d of snap.docs){
    seen.add(d.id);
    if (store.dirty.has(d.id) || store.writing.has(d.id)) continue;
    if (now - (store.deletedAt[d.id] || 0) < 6000) continue;
    const data = d.data(); if (!data) continue;
    const next = normalize(JSON.parse(JSON.stringify(data)), d.id);
    const cur = store.items.get(d.id);
    if (!cur || next.updatedAt > cur.updatedAt){ store.items.set(d.id, next); changed = true; }
  }
  for (const id of [...store.items.keys()]){
    if (seen.has(id) || store.dirty.has(id) || store.writing.has(id)) continue;
    if (now - (store.wroteAt[id] || 0) < 6000) continue;
    store.items.delete(id); changed = true;
  }
  store.mode = 'db'; setSave();
  if (changed) softRender();
  if (store.dirty.size) flushAll();
}
function softRender(){
  const ae = document.activeElement;
  if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && $('#app').contains(ae)) pendingRender = true;
  else render();
}
function startLocal(){
  if (store.mode === 'db') return;
  store.mode = 'local';
  try { const raw = JSON.parse(localStorage.getItem('tw.data') || '[]'); if (Array.isArray(raw)) for (const r of raw){ const q = normalize(r); if (!store.items.has(q.id)) store.items.set(q.id, q); } } catch (e) {}
  try { if (!store.items.size && typeof window.TW_EXAMPLE === 'function' && !localStorage.getItem('tw.seeded')) { const q = normalize(window.TW_EXAMPLE()); store.items.set(q.id, q); localStorage.setItem('tw.seeded', '1'); saveLocal(); } } catch (e) {}
  setSave(); render();
  if (store.dirty.size) flushAll();
}
async function boot(){
  loadView(); render(); setSave();
  let db = null, user = null, me = null;
  try {
    if (window.claude && typeof window.claude.use === 'function') [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
    me = user ? await user.id() : null;
  } catch (e) {}
  if (db && me){
    try {
      store.col = db.doc('data/users/' + me + '/workbench').collection('inquiries');
      store.col.onSnapshot(onSnap, () => { if (store.mode !== 'db') startLocal(); else { store.failed = 'unavailable'; setSave(); } });
      return;
    } catch (e) {}
  }
  startLocal();
}

/* ================================ view state ================================ */
let view = { name:'home', q:'', stage:'understand', pf:'open' };
function loadView(){
  try { const v = JSON.parse(localStorage.getItem('tw.view') || 'null'); if (v && typeof v === 'object') view = Object.assign(view, v); } catch (e) {}
  const h = (location.hash || '').slice(1);
  if (h === 'questions') view.name = 'home';
  else if (h === 'predictions') view.name = h;
  if (!['home','predictions','q'].includes(view.name)) view.name = 'home';
}
function saveView(){ try { localStorage.setItem('tw.view', JSON.stringify(view)); } catch (e) {} }
function go(patch){ view = Object.assign({}, view, patch); saveView(); render(); window.scrollTo(0, 0); }
const curQ = () => view.name === 'q' ? store.items.get(view.q) : null;

/* ================================ shared pieces ================================ */
const idOf = p => 'f_' + p.replace(/[^A-Za-z0-9_-]/g, '_');
const ti = (path, val, ph, o={}) => `<input type="text" id="${idOf(path)}" data-f="${path}" value="${esc(val)}" placeholder="${esc(ph)}" aria-label="${esc(o.label || ph)}"${o.focus ? ` data-focus="${o.focus}"` : ''}>`;
const ta = (path, val, ph, o={}) => `<textarea id="${idOf(path)}" class="${o.one ? 'one' : ''}" data-f="${path}" rows="${o.one ? 1 : 2}" placeholder="${esc(ph)}" aria-label="${esc(o.label || ph)}"${o.focus ? ` data-focus="${o.focus}"` : ''}${o.ro ? ' readonly' : ''}>${esc(val)}</textarea>`;
const fld = (label, control, help) => `<div class="field"><span class="lab">${label}</span>${help ? `<p class="help">${help}</p>` : ''}${control}</div>`;
const sel = (path, val, opts, label) => `<select id="${idOf(path)}" data-f="${path}" aria-label="${esc(label)}"><option value="">${esc(label)}…</option>${opts.map(([v,l]) => `<option value="${v}"${val === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
const chk = (path, val, label) => `<label class="chk"><input type="checkbox" id="${idOf(path)}" data-f="${path}"${val ? ' checked' : ''}>${esc(label)}</label>`;
const seg = (path, cur, opts) => `<div class="seg" role="group">${opts.map(([v,l,tone]) => `<button type="button" class="${cur === v ? 'on' : ''} ${tone || ''}" aria-pressed="${cur === v}" data-act="set" data-f="${path}" data-v="${v}">${l}</button>`).join('')}</div>`;
const del = (list, id, label) => `<button type="button" class="icon" data-act="del" data-list="${list}" data-id="${id}" aria-label="${esc(label)}" title="${esc(label)}">${I.x}</button>`;
const add = (list, label) => `<div><button type="button" class="btn sm" data-act="add" data-list="${list}">+ ${label}</button></div>`;
const bandRange = p => { const i = Math.max(0, BANDS.findIndex(b => p <= b[0])); return `${i ? BANDS[i-1][0] : 0}–${BANDS[i][0]}%`; };
const bandText = v => `<b>${v}%</b>${band(v)} <span class="rng">(${bandRange(v)})</span>`;
const slider = (id, val, attrs='') => `<div class="slider"><input type="range" id="${id}" min="1" max="99" step="1" value="${val}" data-band="${id}_o" ${attrs}><div class="tick-row" aria-hidden="true"><span>1%</span><span>50%</span><span>99%</span></div><output id="${id}_o" for="${id}">${bandText(val)}</output></div>`;
function ring(n, pr){
  const r = 13, c = 2*Math.PI*r, f = pr.total ? pr.done/pr.total : 0;
  return `<svg class="ring" viewBox="0 0 32 32" width="32" height="32" aria-hidden="true"><circle cx="16" cy="16" r="${r}" fill="none" stroke="var(--accent-wash)" stroke-width="3"/>${f > 0 ? `<circle cx="16" cy="16" r="${r}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" stroke-dasharray="${(c*f).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 16 16)"/>` : ''}${f >= 1 ? `<path d="M11 16.5l3.4 3.4 7.1-7.4" fill="none" stroke="var(--accent)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>` : `<text x="16" y="20.3" text-anchor="middle" fill="var(--ink)">${n}</text>`}</svg>`;
}
const pathStrip = () => `<ol class="path">${STAGES.map((s,i) => `<li><span class="eyebrow">Stage ${i+1}</span><b>${s.name}</b><span>${s.ask}</span></li>`).join('')}</ol>`;

/* ================================ home ================================ */
function predRow({p, q}, withQ=true){
  const due = isDue(p);
  const state = p.outcome === 'yes' ? `<span class="pill">${I.check}Happened</span>` : p.outcome === 'no' ? `<span class="pill">${I.x}Did not happen</span>` : p.outcome === 'void' ? `<span class="pill">${I.dash}Could not tell</span>` : due ? `<span class="pill warn">Due</span>` : `<span class="pill">Open</span>`;
  const acts = p.outcome
    ? `<button type="button" class="btn quiet sm" data-act="resolve" data-q="${q.id}" data-id="${p.id}" data-v="">Reopen</button>`
    : `<button type="button" class="btn sm" data-act="resolve" data-q="${q.id}" data-id="${p.id}" data-v="yes">Happened</button><button type="button" class="btn sm" data-act="resolve" data-q="${q.id}" data-id="${p.id}" data-v="no">Did not happen</button><button type="button" class="btn quiet sm" data-act="resolve" data-q="${q.id}" data-id="${p.id}" data-v="void">Cannot tell</button>`;
  return `<li><div class="pmain"><span>${esc(p.text)}</span><span class="pmeta mono">${state}<span>${p.p}% · ${band(p.p)}</span>${p.due ? `<span>check by ${fmtDay(p.due)}</span>` : ''}${withQ ? `<button type="button" class="link" data-act="open" data-id="${q.id}" data-stage="thesis">${esc(short(q.title, 48))}</button>` : `<button type="button" class="link" data-act="pred-del" data-id="${p.id}">Remove</button>`}</span></div><div class="pact">${acts}</div></li>`;
}
const backupLine = () => store.mode === 'local' ? `<p class="backup">Your work is saved in this browser only. <button type="button" class="link" data-act="export">Save a backup file</button> or <button type="button" class="link" data-act="import">restore from one</button>.</p>` : '';
function homeHTML(){
  if (store.mode === 'loading') return `<div class="page"><div class="page-head"><div><h1>Form an opinion you can defend</h1><p>Opening your notebook…</p></div></div>${pathStrip()}</div>`;
  const qs = [...store.items.values()].sort((a,b) => b.updatedAt - a.updatedAt);
  if (!qs.length) return `<div class="page">
    <div class="page-head"><div><h1>Form an opinion you can defend</h1><p>Pick a question and work it through five stages. You finish with a thesis, a confidence level, and a list of what would change your mind.</p></div><div class="row-meta"><button type="button" class="btn primary" data-act="new-q">Ask your first question</button><a class="btn" href="process.html">See how it works</a></div></div>
    ${pathStrip()}
    <div class="rule3"><div><span class="eyebrow">Every session, write one</span><b>Observation</b><p>What you saw, stated so that someone who disagrees with you would accept it.</p></div><div><span class="eyebrow">and one</span><b>Explanation</b><p>Why you think it happens. Name the mechanism.</p></div><div><span class="eyebrow">and one</span><b>Prediction</b><p>Something checkable that follows if your explanation is right, with a probability and a date.</p></div></div>
    ${backupLine()}
  </div>`;
  const due = allPreds().filter(x => isDue(x.p)).sort((a,b) => a.p.due < b.p.due ? -1 : 1);
  const reviews = qs.filter(q => q.thesis.reviewOn && q.thesis.reviewOn <= ymd());
  const attn = (due.length || reviews.length) ? `<section class="attn"><h2>Needs your attention</h2><ul>${due.map(x => predRow(x)).join('')}${reviews.map(q => `<li><div class="pmain"><span>Review your thesis: ${esc(short(q.title, 80))}</span><span class="pmeta mono"><span class="pill warn">Review due</span><span>set for ${fmtDay(q.thesis.reviewOn)}</span></span></div><div class="pact"><button type="button" class="btn sm" data-act="open" data-id="${q.id}" data-stage="thesis">Open thesis</button></div></li>`).join('')}</ul></section>` : '';
  return `<div class="page">
    <div class="page-head"><div><h1>Your questions</h1><p>Work each one through five stages. Leave every research session with one observation, one explanation, and one prediction.</p></div><button type="button" class="btn primary" data-act="new-q">New question</button></div>
    ${attn}
    <div class="qgrid">${qs.map(qcard).join('')}</div>
    ${backupLine()}
  </div>`;
}
function qcard(q){
  const nx = nextStep(q), cur = curConf(q);
  const open = q.predictions.filter(p => filled(p.text) && !p.outcome).length;
  return `<article class="qcard">
    ${q.example ? '<div><span class="pill warn">Example</span></div>' : ''}
    <h2><button type="button" data-act="open" data-id="${q.id}">${esc(q.title || 'Untitled question')}</button></h2>
    <div class="meter5" role="img" aria-label="Progress by stage: ${STAGES.map(s => { const pr = progress(q, s); return `${s.name} ${pr.done} of ${pr.total}`; }).join(', ')}">${STAGES.map(s => { const pr = progress(q, s); return `<span><i style="width:${Math.round(100*pr.done/pr.total)}%"></i></span>`; }).join('')}</div>
    <p class="next">${nx ? `<b>Stage ${nx.i+1} of 5 · ${nx.st.name}.</b> Next: ${esc(nx.c.label.charAt(0).toLowerCase() + nx.c.label.slice(1))}.` : '<b>All five stages complete.</b> Revisit when new evidence arrives.'}</p>
    <div class="qfoot mono"><span>${cur == null ? `Started at ${q.prior.p}%` : `${q.prior.p}% → ${cur}% · ${band(cur)}`}</span><span>${plural(q.sessions.length, 'session')}</span><span>${plural(open, 'open prediction')}</span><span>Edited ${fmtDay(q.updatedAt)}</span></div>
  </article>`;
}

/* ================================ bench ================================ */
function benchMeta(q){
  const cur = curConf(q);
  return `<span>${cur == null ? `Started at ${q.prior.p}%` : `${q.prior.p}% at the start → ${cur}% now`}</span><span>${plural(q.sessions.length, 'session')} logged</span>`;
}
function railHTML(q){
  return STAGES.map((st,i) => { const pr = progress(q, st); return `<button type="button" class="step${view.stage === st.id ? ' on' : ''}" data-act="stage" data-stage="${st.id}"${view.stage === st.id ? ' aria-current="step"' : ''}>${ring(i+1, pr)}<span class="step-t"><b>${st.name}</b><small>${pr.done} of ${pr.total}</small></span></button>`; }).join('')
    + `<button type="button" class="step${view.stage === 'log' ? ' on' : ''}" data-act="stage" data-stage="log"${view.stage === 'log' ? ' aria-current="step"' : ''}>${I.log}<span class="step-t"><b>Session log</b><small>${q.sessions.length} logged</small></span></button>`
    + `<div class="start"><span class="eyebrow">Where you started · ${fmtDay(q.createdAt)}</span>${filled(q.prior.take) ? `<q>${esc(q.prior.take)}</q>` : ''}<span class="mono">${q.prior.p}% · ${band(q.prior.p)}</span>${filled(q.why) ? `<span><b>Why it matters.</b> ${esc(q.why)}</span>` : ''}<div><button type="button" class="btn quiet sm" data-act="q-del">Delete this question</button></div></div>`;
}
function benchHTML(q){
  return `<div class="bench-head">
      <button type="button" class="link back" data-act="go" data-to="home">← All questions</button>
      <div><textarea class="title-input one" id="f_title" data-f="title" rows="1" aria-label="Question">${esc(q.title)}</textarea><div class="bench-meta mono" id="benchMeta">${benchMeta(q)}</div></div>
      <button type="button" class="btn primary" data-act="session-new">Log a session</button>
    </div>
    ${q.example ? `<div class="banner"><span>This is a filled-in example so you can see the format. Its entries are illustrative. Check them before relying on them.</span><button type="button" class="btn sm" data-act="q-del">Delete example</button></div>` : ''}
    <div class="bench"><nav class="rail" id="rail" aria-label="Stages">${railHTML(q)}</nav><section class="sheet" id="sheet">${sheetHTML(q)}</section></div>`;
}
function checksInner(q, st){
  return `<div class="block-h"><h3>Ready to move on?</h3></div><ul>${st.checks.map(c => {
    if (c.manual) return `<li class="${q.manual[c.id] ? 'done' : ''}"><label><input type="checkbox" id="f_manual_${c.id}" data-f="manual.${c.id}"${q.manual[c.id] ? ' checked' : ''}><span>${c.label}</span></label></li>`;
    const ok = c.ok(q);
    return `<li class="${ok ? 'done' : ''}"><span class="tickbox">${ok ? I.check : ''}</span><span>${c.label}</span></li>`;
  }).join('')}</ul>`;
}
function sessCard(q, s){
  const p = q.predictions.find(x => x.sessionId === s.id);
  const st = stageById(s.stage);
  const u = safeUrl(s.url);
  const part = (label, text, extra='') => `<div><dt>${label}</dt><dd>${filled(text) ? esc(text) + extra : '<span class="none">Not written yet</span>'}</dd></div>`;
  return `<article class="sess">
    <div class="sess-h mono"><span>${fmtDay(s.at)}${st ? ' · ' + st.name : ''}</span>${filled(s.src) ? (u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(short(s.src, 70))}</a>` : `<span>${esc(short(s.src, 70))}</span>`) : ''}<span class="sp"></span><button type="button" class="btn quiet sm" data-act="session-edit" data-id="${s.id}">Edit</button><button type="button" class="btn quiet sm" data-act="session-del" data-id="${s.id}">Remove</button></div>
    <dl class="oep">${part('Observation', s.obs)}${part('Explanation', s.exp)}${part('Prediction', s.pred, p ? ` <span class="pill">${p.p}%${p.due ? ' · by ' + fmtDay(p.due) : ''}</span>` : '')}</dl>
  </article>`;
}
function sheetHTML(q){
  if (view.stage === 'log'){
    const ss = [...q.sessions].sort((a,b) => b.at - a.at);
    return `<header class="stage-head"><p class="eyebrow">Session log</p><h2 class="ask"><span class="hl">One observation, one explanation, one prediction</span></h2><p class="trap">Every time you read, watch, or test something for this question, log what you took from it.</p></header>
      <div class="block">${ss.length ? `<div class="rows">${ss.map(s => sessCard(q, s)).join('')}</div>` : `<div class="empty"><p>No sessions yet. After your next reading, talk, or test, log what you saw, why you think it happens, and what should follow if you are right.</p></div>`}<div><button type="button" class="btn primary" data-act="session-new">Log a session</button></div></div>`;
  }
  const i = Math.max(0, STAGES.findIndex(s => s.id === view.stage)), st = STAGES[i];
  const ss = q.sessions.filter(s => s.stage === st.id).sort((a,b) => b.at - a.at);
  return `<header class="stage-head"><p class="eyebrow">Stage ${i+1} of 5 · ${st.name}</p><h2 class="ask"><span class="hl">${st.ask}</span></h2><p class="trap"><b>The trap</b>${st.trap}</p></header>
    ${st.parts.map(p => p.startsWith('p:') ? promptHTML(q, p.slice(2)) : TOOLS[p.slice(2)](q)).join('')}
    <section class="block"><div class="block-h"><h3>Sessions in this stage</h3><p class="help">What you read, watched, or tested here, each reduced to an observation, an explanation, and a prediction.</p></div>${ss.length ? `<div class="rows">${ss.map(s => sessCard(q, s)).join('')}</div>` : ''}<div><button type="button" class="btn sm" data-act="session-new">+ Log a session</button></div></section>
    <section class="block checks" id="checks">${checksInner(q, st)}</section>
    <div class="stage-nav">${i > 0 ? `<button type="button" class="btn" data-act="stage" data-stage="${STAGES[i-1].id}">← ${STAGES[i-1].name}</button>` : '<span></span>'}${i < STAGES.length-1 ? `<button type="button" class="btn primary" data-act="stage" data-stage="${STAGES[i+1].id}">${STAGES[i+1].name} →</button>` : `<button type="button" class="btn" data-act="go" data-to="predictions">See all predictions →</button>`}</div>`;
}
function promptHTML(q, k){
  const p = PROMPTS[k];
  return `<section class="block"><div class="field"><label for="${idOf('fields.'+k)}">${p.label}</label><p class="help">${p.help}</p><textarea id="${idOf('fields.'+k)}" data-f="fields.${k}" rows="2" placeholder="${esc(p.ph)}">${esc(q.fields[k] || '')}</textarea></div></section>`;
}
const blockH = (h, help) => `<div class="block-h"><h3>${h}</h3>${help ? `<p class="help">${help}</p>` : ''}</div>`;
function srcSummary(q){
  const S = q.sources.filter(s => filled(s.title)); if (!S.length) return '';
  const prim = S.filter(s => ['firsthand','data','study','review'].includes(s.kind)).length;
  return `${plural(S.length, 'source')} · ${prim} primary · ${S.filter(s => s.stake).length} with a stake in the answer · ${S.filter(s => s.corr).length} independently backed`;
}
function matrixVerdict(q){
  const H = q.hypotheses.filter(h => filled(h.text)), E = q.evidence.filter(e => filled(e.text));
  if (H.length < 2 || !E.length) return '<p class="help">Add at least two explanations and a few pieces of evidence to compare them.</p>';
  const count = (h, v) => E.filter(e => e.marks[h.id] === v).length;
  const rated = E.filter(e => H.every(h => e.marks[h.id]));
  const tally = `<table class="tbl"><thead><tr><th>Explanation</th><th>Conflicts</th><th>Fits</th><th>Neutral</th></tr></thead><tbody>${H.map(h => `<tr><td>${esc(short(h.text, 70))}</td><td>${count(h,'i')}</td><td>${count(h,'c')}</td><td>${count(h,'n')}</td></tr>`).join('')}</tbody></table>`;
  const ps = H.map(h => parseFloat(h.p)).filter(Number.isFinite), sum = Math.round(ps.reduce((a,b) => a+b, 0));
  const shares = ps.length ? `<p class="help">Your shares add to ${sum}%.${sum === 100 ? '' : ' They should add to 100%. Leave some for an explanation you have not thought of.'}</p>` : '';
  if (!rated.length) return tally + '<p class="help">Rate one piece of evidence against every explanation to see which survives.</p>' + shares;
  const flat = rated.filter(e => new Set(H.map(h => e.marks[h.id])).size === 1).length;
  let s = 'The tally does not pick a winner. Weigh the conflicts yourself: one decisive conflict can outweigh several fits.';
  if (flat) s = `${flat} of ${rated.length} fully rated pieces of evidence sit the same way with every explanation, so ${flat === 1 ? 'that one tells' : 'those tell'} you nothing about which is right. ` + s;
  return tally + `<p class="verdict">${s}</p>` + shares;
}
const STRENGTH = {strong:'Strong', moderate:'Moderate', thin:'Thin'};
function thesisText(q){
  const cur = curConf(q), L = [];
  L.push('# ' + (q.title || 'Untitled question'), '');
  L.push('**Thesis.** ' + (q.thesis.statement.trim() || '(not written yet)'));
  L.push('**Confidence.** ' + (cur == null ? 'not logged yet' : `${cur}% (${band(cur).toLowerCase()})`) + `. Started at ${q.prior.p}%.`);
  if (STRENGTH[q.thesis.strength]) L.push('**Evidence.** ' + STRENGTH[q.thesis.strength] + (filled(q.thesis.basis) ? '. ' + q.thesis.basis.trim() : ''));
  const rs = q.thesis.reasons.filter(filled); if (rs.length) { L.push('', '**Why.**'); rs.forEach(r => L.push('- ' + r.trim())); }
  if (filled(q.thesis.objection)) L.push('', '**Strongest objection.** ' + q.thesis.objection.trim() + (filled(q.thesis.answer) ? '\n**My answer.** ' + q.thesis.answer.trim() : ''));
  const sp = q.signposts.filter(s => filled(s.text)); if (sp.length) { L.push('', '**What would change my mind.**'); sp.forEach(s => L.push(`- ${s.text.trim()}${s.seen ? ' (seen)' : ''}`)); }
  const pr = q.predictions.filter(p => filled(p.text)); if (pr.length) { L.push('', '**Predictions.**'); pr.forEach(p => L.push(`- ${p.text.trim()} (${p.p}%${p.due ? ', check by ' + p.due : ''}${p.outcome ? ', outcome: ' + ({yes:'happened',no:'did not happen',void:'could not tell'}[p.outcome]) : ''})`)); }
  if (q.thesis.reviewOn) L.push('', '**Review on.** ' + q.thesis.reviewOn);
  return L.join('\n');
}
function thesisCardInner(q){
  const cur = curConf(q), rs = q.thesis.reasons.filter(filled), sp = q.signposts.filter(s => filled(s.text));
  return `<p class="state">${filled(q.thesis.statement) ? esc(q.thesis.statement) : '<span style="color:var(--ink-3)">Your thesis will appear here once you write it.</span>'}</p>
    <dl>
      <div><dt>Confidence</dt><dd>${cur == null ? 'Not logged yet' : `${cur}% · ${band(cur)}`} <span class="mono" style="color:var(--ink-3)">(started at ${q.prior.p}%)</span></dd></div>
      ${STRENGTH[q.thesis.strength] ? `<div><dt>Evidence</dt><dd>${STRENGTH[q.thesis.strength]}${filled(q.thesis.basis) ? '. ' + esc(q.thesis.basis) : ''}</dd></div>` : ''}
      ${rs.length ? `<div><dt>Why</dt><dd><ul>${rs.map(r => `<li>${esc(r)}</li>`).join('')}</ul></dd></div>` : ''}
      ${filled(q.thesis.objection) ? `<div><dt>Strongest objection</dt><dd>${esc(q.thesis.objection)}${filled(q.thesis.answer) ? `<br><b>My answer.</b> ${esc(q.thesis.answer)}` : ''}</dd></div>` : ''}
      ${sp.length ? `<div><dt>What would change my mind</dt><dd><ul>${sp.map(s => `<li>${esc(s.text)}${s.seen ? ' <span class="pill warn">Seen</span>' : ''}</li>`).join('')}</ul></dd></div>` : ''}
      ${q.thesis.reviewOn ? `<div><dt>Review on</dt><dd>${fmtDay(q.thesis.reviewOn)}</dd></div>` : ''}
    </dl>`;
}

const TOOLS = {
  sources: q => `<section class="block">${blockH('Sources', 'Log what you read or watched. Grade the source and the claim separately: a reliable source can still be wrong on this point.')}
    <p class="summary mono" id="srcSummary">${srcSummary(q)}</p>
    <div class="rows">${q.sources.map(s => `<div class="row"><div class="row-body">
      <div class="grid2">${ti(`sources.${s.id}.title`, s.title, 'Title, or who said it', {focus:s.id})}${ti(`sources.${s.id}.url`, s.url, 'Link (optional)')}</div>
      ${ta(`sources.${s.id}.claim`, s.claim, 'What it claims, in one line', {one:true})}
      <div class="row-meta">${sel(`sources.${s.id}.kind`, s.kind, SOURCE_KINDS, 'Kind of evidence')}${sel(`sources.${s.id}.rel`, s.rel, RELIABILITY, 'Source reliability')}</div>
      <div class="row-meta">${chk(`sources.${s.id}.stake`, s.stake, 'Has a stake in the answer')}${chk(`sources.${s.id}.corr`, s.corr, 'Backed by an independent source')}</div>
    </div>${del('sources', s.id, 'Remove source')}</div>`).join('')}</div>${add('sources', 'Add a source')}</section>`,

  failures: q => `<section class="block">${blockH('Where it fails', 'Counter-examples, broken demos, cases where the claim did not hold. For each, give your best account of why.')}
    <div class="rows">${q.failures.map(f => `<div class="row"><div class="row-body"><div class="grid2">${ta(`failures.${f.id}.what`, f.what, 'What failed or did not hold', {one:true, focus:f.id})}${ta(`failures.${f.id}.why`, f.why, 'Why, as best you can tell', {one:true})}</div></div>${del('failures', f.id, 'Remove case')}</div>`).join('')}</div>${add('failures', 'Add a failure case')}</section>`,

  assumptions: q => `<section class="block">${blockH('Assumptions check', 'List what must be true for the popular view to hold. Then rate how well each one is supported.')}
    <div class="rows">${q.assumptions.map(a => `<div class="row"><div class="row-body">${ta(`assumptions.${a.id}.text`, a.text, 'This view assumes that …', {one:true, focus:a.id})}${seg(`assumptions.${a.id}.status`, a.status, [['solid','Well supported','good'],['shaky','Shaky','warn'],['none','Unsupported','bad']])}</div>${del('assumptions', a.id, 'Remove assumption')}</div>`).join('')}</div>${add('assumptions', 'Add an assumption')}</section>`,

  positions: q => `<section class="block">${blockH('Positions', 'One entry per camp. Write each side\u2019s strongest argument in words that side would accept. Weigh a scored track record above fame or confidence.')}
    <div class="rows">${q.positions.map(p => `<div class="row"><div class="row-body"><div class="grid2">
      ${fld('Who', ti(`positions.${p.id}.who`, p.who, 'Person, lab, or school of thought', {focus:p.id}))}
      ${fld('Track record and stake', ti(`positions.${p.id}.track`, p.track, 'Past calls, and what they gain if right'))}
      ${fld('What they claim or predict', ta(`positions.${p.id}.claim`, p.claim, 'They expect …', {one:true}))}
      ${fld('Their strongest argument', ta(`positions.${p.id}.best`, p.best, 'The best case for this view is …', {one:true}))}
    </div><div class="row-meta"><span class="lab">Is this their own field?</span>${seg(`positions.${p.id}.scope`, p.scope, [['in','Yes'],['adjacent','Adjacent'],['out','Outside it']])}</div></div>${del('positions', p.id, 'Remove position')}</div>`).join('')}</div>${add('positions', 'Add a position')}</section>`,

  matrix: q => {
    const H = q.hypotheses, E = q.evidence;
    const pull = q.sessions.some(s => filled(s.obs) && !E.some(e => e.from === s.id));
    const markSeg = (e, h, j) => `<div class="seg" role="group" aria-label="How evidence ${j+1} sits with this explanation">${[['c','Fits','good'],['i','Conflicts','bad'],['n','Neutral','']].map(([v,l,tone]) => `<button type="button" class="${e.marks[h.id] === v ? 'on' : ''} ${tone}" aria-pressed="${e.marks[h.id] === v}" data-act="mark" data-e="${e.id}" data-h="${h.id}" data-v="${v}">${l}</button>`).join('')}</div>`;
    return `<section class="block">${blockH('Competing explanations', 'List the evidence once. Then take each explanation in turn and rate how every piece of evidence sits with it. Look hardest for conflicts, because support is cheap.')}
      <div class="field"><span class="lab">Evidence</span><div class="rows">${E.map((e,j) => `<div class="row tight"><div class="row-body">${ta(`evidence.${e.id}.text`, e.text, `Evidence ${j+1}`, {one:true, focus:e.id})}</div>${del('evidence', e.id, `Remove evidence ${j+1}`)}</div>`).join('')}</div>
        <div class="row-meta"><button type="button" class="btn sm" data-act="add" data-list="evidence">+ Add evidence</button>${pull ? `<button type="button" class="btn quiet sm" data-act="ev-pull">Pull in my logged observations</button>` : ''}</div></div>
      <div class="field"><span class="lab">Explanations</span><div class="hgrid">${H.map((h,i) => `<div class="hcard"><div class="mx-h">${ta(`hypotheses.${h.id}.text`, h.text, `Explanation ${i+1}`, {one:true, focus:h.id})}${del('hypotheses', h.id, `Remove explanation ${i+1}`)}</div>
          <label class="share"><span>Chance this is the main cause</span><input type="text" inputmode="numeric" id="${idOf(`hypotheses.${h.id}.p`)}" data-f="hypotheses.${h.id}.p" value="${esc(h.p)}" placeholder="0–100" aria-label="Chance that explanation ${i+1} is the main cause, in percent"><span>%</span></label>
          ${E.length ? `<ul class="marks">${E.map((e,j) => `<li><span data-evtext="${e.id}" data-n="${j+1}">${esc(e.text.trim() || `Evidence ${j+1}`)}</span>${markSeg(e, h, j)}</li>`).join('')}</ul>` : '<p class="help">Add evidence above, then rate it here.</p>'}</div>`).join('')}</div>
        ${H.length < 4 ? `<div><button type="button" class="btn sm" data-act="add" data-list="hypotheses">+ Add an explanation</button></div>` : ''}</div>
      <div id="matrixVerdict">${matrixVerdict(q)}</div></section>`;
  },

  tests: q => `<section class="block">${blockH('Tests', 'No lab needed. Reproduce a demo, try the tool on your own task, rerun a published number, or ask a practitioner. Write what you expect first.')}
    <div class="rows">${q.tests.map(t => `<div class="row"><div class="row-body"><div class="grid2">
      ${fld('Claim under test', ta(`tests.${t.id}.claim`, t.claim, 'They say that …', {one:true, focus:t.id}))}
      ${fld('What you will do', ta(`tests.${t.id}.method`, t.method, 'I will …', {one:true}))}
      ${fld('What you expect to see', ta(`tests.${t.id}.expect`, t.expect, 'If the claim is true I should see … If not, …', {one:true, ro:filled(t.result)}), filled(t.result) ? 'Locked, because a result is recorded.' : 'Write this before you run it.')}
      ${fld('What happened', ta(`tests.${t.id}.result`, t.result, 'I saw …', {one:true}))}
    </div>
    <div class="row-meta"><span class="lab">Did it match?</span>${seg(`tests.${t.id}.match`, t.match, [['yes','Yes'],['partly','Partly'],['no','No']])}</div>
    ${fld('What you learned', ta(`tests.${t.id}.learned`, t.learned, 'This moves me toward … because …', {one:true}))}
    </div>${del('tests', t.id, 'Remove test')}</div>`).join('')}</div>${add('tests', 'Plan a test')}</section>`,

  prior: q => `<section class="block" style="border-top:0;padding-top:0"><div class="prior"><span class="eyebrow">Where you started · ${fmtDay(q.createdAt)}</span>${filled(q.prior.take) ? `<q>${esc(q.prior.take)}</q>` : '<span class="help">You did not record a gut take.</span>'}<span class="mono">${q.prior.p}% · ${band(q.prior.p)}</span></div></section>`,

  statement: q => `<section class="block"><div class="field"><label for="f_thesis_statement">Your thesis</label><p class="help">One or two sentences. Specific enough that it could turn out wrong.</p>${ta('thesis.statement', q.thesis.statement, 'I believe that …', {label:'Your thesis'})}</div></section>`,

  confidence: q => { const v = q.thesis.p == null ? q.prior.p : q.thesis.p; const last = curConf(q);
    return `<section class="block">${blockH('Confidence', 'How likely is it that your thesis is right? Log each change with the reason. The best forecasters update often and in small steps.')}
      <div class="conf"><div class="rows">
        ${slider('f_thesis_p', v, 'data-f="thesis.p" aria-label="Confidence"')}
        <div class="field"><label for="conf_note">What moved you?</label><input type="text" id="conf_note" placeholder="The evidence or argument behind this number"></div>
        <div><button type="button" class="btn" data-act="conf-log">${last == null ? 'Log this confidence' : 'Log an update'}</button></div>
        ${q.confLog.length ? `<ul class="loglist">${[...q.confLog].reverse().map(c => `<li><b>${fmtDay(c.at)} · ${c.p}%</b>${esc(c.note || 'No reason given')}</li>`).join('')}<li><b>${fmtDay(q.createdAt)} · ${q.prior.p}%</b>Gut take, before research</li></ul>` : ''}
      </div><div class="chart" data-chart="conf"></div></div></section>`; },

  strength: q => `<section class="block">${blockH('Strength of the evidence', 'A separate question from how likely you think it is: you can be 70% sure on thin evidence. Mark it down if your sources have a stake, disagree with each other, are about something adjacent, or are few.')}
    <div class="row-meta">${seg('thesis.strength', q.thesis.strength, [['strong','Strong','good'],['moderate','Moderate','warn'],['thin','Thin','bad']])}</div>
    ${ta('thesis.basis', q.thesis.basis, 'It rests mainly on …', {one:true, label:'What the evidence rests on'})}</section>`,

  reasons: q => `<section class="block">${blockH('What carries the weight', 'The three reasons that matter most. If one fell, would the thesis still stand?')}
    <div class="rows">${[0,1,2].map(i => ta(`thesis.reasons.${i}`, q.thesis.reasons[i], `Reason ${i+1}`, {one:true})).join('')}</div></section>`,

  objection: q => `<section class="block">${blockH('Strongest objection', 'The best argument against you, stated as its smartest advocate would put it. Then your answer.')}
    <div class="grid2">${ta('thesis.objection', q.thesis.objection, 'The strongest case against this is …')}${ta('thesis.answer', q.thesis.answer, 'I still hold my view because …')}</div></section>`,

  signposts: q => `<section class="block">${blockH('What would change my mind', 'Specific things you could observe, each with a date. Tick one when you see it, then revisit your confidence.')}
    <div class="rows">${q.signposts.map(s => `<div class="row"><div class="row-body">${ta(`signposts.${s.id}.text`, s.text, 'If by a given date I have, or have not, seen \u2026 I will lower my confidence', {one:true, focus:s.id})}${chk(`signposts.${s.id}.seen`, s.seen, 'I have seen this')}</div>${del('signposts', s.id, 'Remove')}</div>`).join('')}</div>${add('signposts', 'Add a signpost')}</section>`,

  predictions: q => { const P = q.predictions.filter(p => filled(p.text));
    return `<section class="block">${blockH('Predictions', 'What should happen if your thesis is right? Give each a probability and a date, then score yourself when the date comes.')}
      ${P.length ? `<ul class="plist">${P.map(p => predRow({p, q}, false)).join('')}</ul>` : ''}
      <div class="row"><div class="row-body"><textarea id="pr_text" class="one" rows="1" placeholder="By the date below, … will have happened" aria-label="New prediction"></textarea>
        <div class="grid2">${slider('pr_p', 70, 'aria-label="Probability"')}<div class="field"><label for="pr_due">Check by</label><input type="date" id="pr_due" value="${plusDays(90)}"></div></div>
        <div><button type="button" class="btn sm" data-act="pred-add">+ Add prediction</button></div></div></div></section>`; },

  review: q => `<section class="block"><div class="field" style="max-width:260px"><label for="f_thesis_reviewOn">Review this thesis on</label><input type="date" id="f_thesis_reviewOn" data-f="thesis.reviewOn" value="${esc(q.thesis.reviewOn)}"></div><p class="help">It shows up on your Questions page when the date arrives.</p></section>`,

  card: q => `<section class="block">${blockH('Thesis card', 'Everything above, in the form you would share.')}<div class="tcard" id="thesisCard">${thesisCardInner(q)}</div><div><button type="button" class="btn" data-act="copy-thesis">Copy as text</button></div></section>`,
};

/* ================================ predictions page ================================ */
function calBins(res){
  const bins = [0,1,2,3,4].map(i => ({lo:i*20, hi:i*20+20, n:0, sum:0, yes:0}));
  for (const {p} of res){ const b = bins[Math.min(4, Math.floor(p.p/20))]; b.n++; b.sum += p.p; if (p.outcome === 'yes') b.yes++; }
  return bins;
}
function predictionsHTML(){
  const all = allPreds();
  const res = all.filter(x => x.p.outcome === 'yes' || x.p.outcome === 'no');
  const open = all.filter(x => !x.p.outcome), due = open.filter(x => isDue(x.p));
  const b = brier(res), bins = calBins(res);
  const f = view.pf || 'open';
  const list = (f === 'resolved' ? all.filter(x => x.p.outcome) : f === 'due' ? due : open).sort((a,b) => (a.p.due || '9999') < (b.p.due || '9999') ? -1 : 1);
  const tile = (v, l, n='') => `<div class="tile"><span class="l">${l}</span><span class="v">${v}</span><span class="n">${n}</span></div>`;
  return `<div class="page">
    <div class="page-head"><div><h1>Predictions</h1><p>Every prediction you log lands here. Resolve each one when its date arrives. Your score shows whether your 70% really means 70%.</p></div></div>
    <div class="tiles">${tile(open.length, 'Open')}${tile(due.length, 'Due now', due.length ? 'Resolve these first' : '')}${tile(res.length, 'Resolved', 'Scored as happened or not')}${tile(b == null ? '–' : b.toFixed(2), 'Brier score', '0 is perfect. Always saying 50% scores 0.25')}</div>
    <div class="two">
      <div class="panel"><h2 class="sec-h">Calibration</h2><p class="help">Each dot groups predictions by how likely you said they were. Dots on the line mean your stated odds matched reality. Below it, things happened less often than you said. Above it, more often.</p>
        ${res.length ? `<div class="chart" data-chart="cal"></div>${res.length < 20 ? `<p class="help">Only ${plural(res.length, 'resolved prediction')} so far. Treat this as a rough sketch until you have a few dozen.</p>` : ''}
        <details><summary>Show as a table</summary><table class="tbl"><thead><tr><th>You said</th><th>Predictions</th><th>Happened</th><th>Rate</th></tr></thead><tbody>${bins.map(x => `<tr><td>${x.lo}–${x.hi}%</td><td>${x.n}</td><td>${x.yes}</td><td>${x.n ? Math.round(100*x.yes/x.n) + '%' : '–'}</td></tr>`).join('')}</tbody></table></details>`
        : `<div class="empty"><p>Nothing resolved yet. Once you mark predictions as happened or not, this chart compares how often things happened with how likely you said they were.</p></div>`}
      </div>
      <div class="rows">
        <div class="filters"><h2 class="sec-h">${f === 'resolved' ? 'Resolved' : f === 'due' ? 'Due now' : 'Open'}</h2><div class="seg" role="group" aria-label="Filter predictions">${[['open','Open'],['due','Due'],['resolved','Resolved']].map(([v,l]) => `<button type="button" class="${f === v ? 'on' : ''}" aria-pressed="${f === v}" data-act="pf" data-v="${v}">${l}</button>`).join('')}</div></div>
        ${list.length ? `<ul class="plist">${list.map(x => predRow(x)).join('')}</ul>` : `<div class="empty"><p>${all.length ? 'Nothing in this list.' : 'No predictions yet. Add one when you log a research session, or from the Thesis stage of a question.'}</p></div>`}
      </div>
    </div></div>`;
}

/* ================================ charts ================================ */
function drawCharts(){
  document.querySelectorAll('#app [data-chart]').forEach(el => {
    const w = el.clientWidth || 320;
    if (el.dataset.chart === 'conf'){ const q = curQ(); el.innerHTML = q ? confChart(q, Math.min(w, 520)) : ''; }
    else el.innerHTML = calChart(Math.min(w, 400));
  });
}
function confChart(q, W){
  const pts = confPoints(q), H = 190, m = {l:38, r:46, t:12, b:26};
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const X = i => m.l + (pts.length === 1 ? 0 : iw*i/(pts.length-1)), Y = p => m.t + ih*(1 - p/100);
  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Confidence over time, from ${pts[0].p}% at the start to ${pts[pts.length-1].p}% now">`;
  for (const t of [0,50,100]) s += `<line x1="${m.l}" x2="${m.l+iw}" y1="${Y(t)}" y2="${Y(t)}" stroke="var(--grid)" stroke-width="1"/><text class="tk" x="${m.l-8}" y="${Y(t)+4}" text-anchor="end">${t}%</text>`;
  const d = pts.map((p,i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.p).toFixed(1)}`).join(' ');
  if (pts.length > 1) s += `<path d="${d} L${X(pts.length-1).toFixed(1)} ${Y(0)} L${X(0)} ${Y(0)} Z" fill="var(--accent)" fill-opacity=".1"/><path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  pts.forEach((p,i) => { const end = i === pts.length-1;
    s += `<circle cx="${X(i).toFixed(1)}" cy="${Y(p.p).toFixed(1)}" r="${end ? 5 : 3.5}" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/><circle cx="${X(i).toFixed(1)}" cy="${Y(p.p).toFixed(1)}" r="13" fill="transparent" tabindex="0" data-tip="${esc(`${fmtDay(p.at)}: ${p.p}%. ${p.note || 'No reason given'}`)}"/>`; });
  const last = pts[pts.length-1];
  s += `<text class="lbl" x="${(X(pts.length-1)+10).toFixed(1)}" y="${(Y(last.p)+4).toFixed(1)}">${last.p}%</text>`;
  s += `<text class="tk" x="${m.l}" y="${H-6}">Start</text>${pts.length > 1 ? `<text class="tk" x="${m.l+iw}" y="${H-6}" text-anchor="end">${fmtDay(last.at)}</text>` : ''}`;
  return s + '</svg>';
}
function calChart(W){
  const res = allPreds().filter(x => x.p.outcome === 'yes' || x.p.outcome === 'no'), bins = calBins(res);
  const H = Math.round(W*0.86), m = {l:44, r:14, t:26, b:44};
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const X = v => m.l + iw*v/100, Y = v => m.t + ih*(1 - v/100);
  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Calibration chart: how often things happened against how likely you said they were">`;
  s += `<text class="tk" x="0" y="12">How often it happened</text>`;
  for (const t of [0,25,50,75,100]) s += `<line x1="${m.l}" x2="${m.l+iw}" y1="${Y(t)}" y2="${Y(t)}" stroke="var(--grid)" stroke-width="1"/><text class="tk" x="${m.l-8}" y="${Y(t)+4}" text-anchor="end">${t}%</text><text class="tk" x="${X(t)}" y="${m.t+ih+16}" text-anchor="middle">${t}%</text>`;
  s += `<text class="tk" x="${m.l+iw/2}" y="${H-6}" text-anchor="middle">How likely you said it was</text>`;
  s += `<line x1="${X(0)}" y1="${Y(0)}" x2="${X(100)}" y2="${Y(100)}" stroke="var(--line-strong)" stroke-width="1"/>`;
  const ang = -Math.atan2(ih, iw)*180/Math.PI;
  s += `<text class="tk" transform="translate(${X(8).toFixed(1)} ${(Y(8)-7).toFixed(1)}) rotate(${ang.toFixed(1)})">matches reality</text>`;
  for (const b of bins){ if (!b.n) continue; const cx = X(b.sum/b.n).toFixed(1), cy = Y(100*b.yes/b.n).toFixed(1);
    s += `<circle cx="${cx}" cy="${cy}" r="5.5" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="14" fill="transparent" tabindex="0" data-tip="${esc(`You said ${b.lo}–${b.hi}% (average ${Math.round(b.sum/b.n)}%). It happened ${b.yes} of ${b.n} times (${Math.round(100*b.yes/b.n)}%).`)}"/>`; }
  return s + '</svg>';
}

/* ================================ render ================================ */
const needAuto = !(window.CSS && CSS.supports && CSS.supports('field-sizing', 'content'));
function autosize(t){ if (!needAuto || t.tagName !== 'TEXTAREA') return; t.style.height = 'auto'; t.style.height = (t.scrollHeight + 2) + 'px'; }
function after(){ document.querySelectorAll('#app textarea').forEach(autosize); drawCharts(); }
function setTabs(){ for (const n of ['home','predictions']){ const b = $('#tab-' + n); if (!b) continue; if (view.name === n || (n === 'home' && view.name === 'q')) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); } }
function render(){
  pendingRender = false;
  if (view.name === 'q' && store.mode !== 'loading' && !store.items.has(view.q)) view.name = 'home';
  if (view.name === 'q' && store.mode === 'loading') { $('#app').innerHTML = homeHTML(); setTabs(); return; }
  if (view.name === 'q' && view.stage !== 'log' && !stageById(view.stage)) view.stage = 'understand';
  setTabs();
  $('#app').innerHTML = view.name === 'q' ? benchHTML(curQ()) : view.name === 'predictions' ? predictionsHTML() : homeHTML();
  after();
}
function sig(el){
  if (!el || !el.dataset) return null;
  if (el.id) return '#' + CSS.escape(el.id);
  if (!el.dataset.act) return null;
  return `[data-act="${el.dataset.act}"]` + ['f','v','id','list','e','h','stage'].map(k => el.dataset[k] != null ? `[data-${k}="${CSS.escape(el.dataset[k])}"]` : '').join('');
}
function refreshDerived(q){
  const s = sig(document.activeElement);
  const rail = $('#rail'); if (rail) rail.innerHTML = railHTML(q);
  const st = stageById(view.stage), ch = $('#checks'); if (ch && st) ch.innerHTML = checksInner(q, st);
  const bm = $('#benchMeta'); if (bm) bm.innerHTML = benchMeta(q);
  const ss = $('#srcSummary'); if (ss) ss.textContent = srcSummary(q);
  const mv = $('#matrixVerdict'); if (mv) mv.innerHTML = matrixVerdict(q);
  const tc = $('#thesisCard'); if (tc) tc.innerHTML = thesisCardInner(q);
  document.querySelectorAll('#sheet [data-evtext]').forEach(el => { const e = q.evidence.find(x => x.id === el.dataset.evtext); if (e) el.textContent = e.text.trim() || ('Evidence ' + el.dataset.n); });
  if (s && document.activeElement === document.body) { const el = $(s); if (el) el.focus({preventScroll:true}); }
}
function rerenderSheet(q, focusId){
  const s = sig(document.activeElement), y = window.scrollY;
  $('#sheet').innerHTML = sheetHTML(q); refreshDerived(q); after();
  window.scrollTo(0, y);
  const el = focusId ? $(`[data-focus="${focusId}"]`) : (s ? $(s) : null);
  if (el) el.focus({preventScroll: !focusId});
}

/* ================================ dialogs ================================ */
const dlg = $('#dlg');
function openDialog(html, label){ dlg.innerHTML = html; dlg.setAttribute('aria-label', label); try { if (!dlg.open) dlg.showModal(); } catch (e) { dlg.setAttribute('open', ''); } const f = dlg.querySelector('textarea,input'); if (f) f.focus(); }
function closeDialog(){ try { dlg.close(); } catch (e) { dlg.removeAttribute('open'); } dlg.innerHTML = ''; }
dlg.addEventListener('click', e => { if (e.target === dlg) closeDialog(); });

function newQuestionDialog(){
  openDialog(`<form class="dlg" id="nqForm" novalidate>
    <header><h2>New question</h2><button type="button" class="icon" data-act="dlg-close" aria-label="Close">${I.x}</button></header>
    <div class="field"><label for="nq_title">What are you trying to work out?</label><p class="help">Phrase it so evidence could settle it. "Is X good?" is hard to check. "Can X do Y by a given date?" is not.</p><textarea id="nq_title" class="one" rows="1" placeholder="How reliable are AI coding agents at real software work?"></textarea><p class="err" id="nq_err" hidden>Write the question first.</p></div>
    <div class="field"><label for="nq_why">Why does the answer matter to you?</label><p class="help">What would you do differently depending on how it comes out?</p><textarea id="nq_why" class="one" rows="1"></textarea></div>
    <div class="field"><label for="nq_take">Your gut take, before any research</label><p class="help">Write it now. Later you can see how far the evidence moved you.</p><textarea id="nq_take" class="one" rows="1"></textarea></div>
    <div class="field"><label for="nq_p">How sure are you of that take?</label>${slider('nq_p', 50)}</div>
    <footer><button type="button" class="btn" data-act="dlg-close">Cancel</button><button type="submit" class="btn primary">Start research</button></footer>
  </form>`, 'New question');
}
function sessionDialog(q, s){
  const p = s ? q.predictions.find(x => x.sessionId === s.id) : null;
  const d = s || {id:'', stage: stageById(view.stage) ? view.stage : (nextStep(q) || {st:STAGES[0]}).st.id, src:'', url:'', obs:'', exp:'', pred:''};
  openDialog(`<form class="dlg" id="ssForm" data-id="${d.id}" novalidate>
    <header><h2>${s ? 'Edit session' : 'Log a session'}</h2><button type="button" class="icon" data-act="dlg-close" aria-label="Close">${I.x}</button></header>
    <div class="grid2"><div class="field"><label for="ss_src">What did you look at?</label><input type="text" id="ss_src" value="${esc(d.src)}" placeholder="Talk, paper, demo, or your own test"></div><div class="field"><label for="ss_url">Link (optional)</label><input type="text" id="ss_url" value="${esc(d.url)}" placeholder="https://"></div></div>
    <div class="field"><label for="ss_stage">Stage</label><select id="ss_stage">${STAGES.map((st,i) => `<option value="${st.id}"${d.stage === st.id ? ' selected' : ''}>${i+1}. ${st.name}</option>`).join('')}</select></div>
    <div class="oep-in">
      <div class="field"><label for="ss_obs">Observation</label><p class="help">What you saw, with no interpretation. Someone who disagrees with you should accept it.</p><textarea id="ss_obs" rows="2" placeholder="Coding agents complete some well-specified tasks but struggle with long, complex workflows.">${esc(d.obs)}</textarea></div>
      <div class="field"><label for="ss_exp">Explanation</label><p class="help">Why you think it happens. Name the mechanism.</p><textarea id="ss_exp" rows="2" placeholder="Success depends on context, feedback quality, tooling, and the ability to catch and recover from mistakes.">${esc(d.exp)}</textarea></div>
      <div class="field"><label for="ss_pred">Prediction</label><p class="help">Something checkable that follows if your explanation is right.</p><textarea id="ss_pred" rows="2" placeholder="By the date below, agents will be reliable on a broader range of tasks as verification and planning improve.">${esc(d.pred)}</textarea></div>
      <div class="grid2"><div class="field"><label for="ss_p">How likely is the prediction?</label>${slider('ss_p', p ? p.p : 70)}</div><div class="field"><label for="ss_due">Check by</label><input type="date" id="ss_due" value="${esc(p ? p.due : plusDays(90))}"></div></div>
    </div>
    <p class="err" id="ss_err" hidden>Write at least an observation.</p>
    <footer><button type="button" class="btn" data-act="dlg-close">Cancel</button><button type="submit" class="btn primary">${s ? 'Save changes' : 'Log session'}</button></footer>
  </form>`, s ? 'Edit session' : 'Log a session');
}
const val = id => { const el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; };
document.addEventListener('submit', e => {
  e.preventDefault();
  if (e.target.id === 'nqForm'){
    const title = val('nq_title');
    if (!title){ $('#nq_err').hidden = false; $('#nq_title').focus(); return; }
    const q = normalize({title, why:val('nq_why'), prior:{take:val('nq_take'), p:+$('#nq_p').value}});
    store.items.set(q.id, q); touch(q); closeDialog(); go({name:'q', q:q.id, stage:'understand'});
  } else if (e.target.id === 'ssForm'){
    const q = curQ(); if (!q) return closeDialog();
    const data = {stage:val('ss_stage'), src:val('ss_src'), url:val('ss_url'), obs:val('ss_obs'), exp:val('ss_exp'), pred:val('ss_pred')};
    if (!data.obs && !data.exp && !data.pred){ $('#ss_err').hidden = false; $('#ss_obs').focus(); return; }
    let s = q.sessions.find(x => x.id === e.target.dataset.id);
    if (!s){ s = coerce(SHAPES.sessions, {at:Date.now()}); q.sessions.push(s); }
    Object.assign(s, data);
    let p = q.predictions.find(x => x.sessionId === s.id);
    if (data.pred){ if (!p){ p = coerce(SHAPES.predictions, {createdAt:Date.now(), sessionId:s.id}); q.predictions.push(p); } if (!p.outcome){ p.text = data.pred; p.p = clamp(+$('#ss_p').value, 1, 99); p.due = val('ss_due'); } }
    else if (p && !p.outcome) q.predictions = q.predictions.filter(x => x !== p);
    touch(q); closeDialog(); render();
    const miss = [['observation',data.obs],['explanation',data.exp],['prediction',data.pred]].filter(x => !x[1]).map(x => x[0]);
    toast(miss.length ? `Session logged. Still missing: ${miss.join(' and ')}.` : 'Session logged with all three parts.');
  }
});

/* ================================ toast and tooltip ================================ */
let toastT = 0, undoFn = null;
function toast(msg, undo){
  const el = $('#toast'); undoFn = undo || null;
  el.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button type="button" data-act="undo">Undo</button>' : ''}`;
  el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; undoFn = null; }, undo ? 7000 : 3200);
}
const tip = $('#tip');
function showTip(t){ tip.textContent = t.dataset.tip; tip.hidden = false; const r = t.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight; tip.style.left = clamp(r.left + r.width/2 - w/2, 8, window.innerWidth - w - 8) + 'px'; tip.style.top = (r.top - h - 6 < 8 ? r.bottom + 6 : r.top - h - 6) + 'px'; }
document.addEventListener('pointerover', e => { const t = e.target.closest && e.target.closest('[data-tip]'); if (t) showTip(t); });
document.addEventListener('pointerout', e => { if (e.target.closest && e.target.closest('[data-tip]')) tip.hidden = true; });
document.addEventListener('focusin', e => { if (e.target.dataset && e.target.dataset.tip) showTip(e.target); });
document.addEventListener('focusout', e => {
  if (e.target.dataset && e.target.dataset.tip) tip.hidden = true;
  if (pendingRender) setTimeout(() => { const ae = document.activeElement; if (pendingRender && !(ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && $('#app').contains(ae))) render(); }, 60);
});

/* ================================ events ================================ */
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.band){ const o = document.getElementById(t.dataset.band); if (o) o.innerHTML = bandText(+t.value); }
  autosize(t);
  const f = t.dataset.f, q = curQ(); if (!f || !q) return;
  const v = t.type === 'checkbox' ? t.checked : t.type === 'range' ? +t.value : t.value;
  if (!setPath(q, f, v)) return;
  if (/^tests\.[^.]+\.result$/.test(f)){ const ex = document.getElementById(idOf(f.replace(/result$/, 'expect'))); if (ex) ex.readOnly = filled(v); }
  touch(q); refreshDerived(q);
});

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const a = b.dataset.act, d = b.dataset, q = curQ();
  if (a === 'go') return go({name:d.to});
  if (a === 'open') return go({name:'q', q:d.id, stage:d.stage || ((nextStep(store.items.get(d.id) || normalize({})) || {st:STAGES[4]}).st.id)});
  if (a === 'new-q') return newQuestionDialog();
  if (a === 'dlg-close') return closeDialog();
  if (a === 'undo'){ const fn = undoFn; undoFn = null; $('#toast').hidden = true; if (fn) fn(); return; }
  if (a === 'export'){
    const blob = new Blob([JSON.stringify({app:'thesis-workbench', v:1, exportedAt:new Date().toISOString(), questions:[...store.items.values()]}, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob), an = document.createElement('a');
    an.href = url; an.download = `thesis-workbench-${ymd()}.json`; document.body.appendChild(an); an.click(); an.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return toast('Backup file saved to your downloads.');
  }
  if (a === 'import'){ const f = $('#importFile'); if (f){ f.value = ''; f.click(); } return; }
  if (a === 'pf'){ view.pf = d.v; saveView(); return render(); }
  if (a === 'resolve'){
    const qq = store.items.get(d.q); const p = qq && qq.predictions.find(x => x.id === d.id); if (!p) return;
    p.outcome = d.v; p.resolvedAt = d.v ? Date.now() : 0; touch(qq); render();
    if (d.v === 'yes' || d.v === 'no') toast(`Scored. You said ${p.p}% and it ${d.v === 'yes' ? 'happened' : 'did not happen'}.`);
    return;
  }
  if (!q) return;
  const qid = q.id;
  if (a === 'stage'){ view.stage = d.stage; saveView(); render(); const sh = $('#sheet'); if (sh && sh.getBoundingClientRect().top < 0) sh.scrollIntoView(); const nb = $(`.step[data-stage="${d.stage}"]`); if (nb && b.classList.contains('step')) nb.focus({preventScroll:true}); return; }
  if (a === 'session-new') return sessionDialog(q, null);
  if (a === 'session-edit') return sessionDialog(q, q.sessions.find(s => s.id === d.id));
  if (a === 'session-del'){
    const i = q.sessions.findIndex(s => s.id === d.id); if (i < 0) return;
    const [gone] = q.sessions.splice(i, 1); const gp = q.predictions.filter(p => p.sessionId === gone.id);
    q.predictions = q.predictions.filter(p => p.sessionId !== gone.id); touch(q); render();
    return toast('Session removed.', () => { const x = store.items.get(qid); if (!x) return; x.sessions.splice(i, 0, gone); x.predictions.push(...gp); touch(x); render(); });
  }
  if (a === 'add'){ const item = coerce(SHAPES[d.list], {}); q[d.list].push(item); touch(q); return rerenderSheet(q, item.id); }
  if (a === 'del'){
    const arr = q[d.list], i = arr.findIndex(x => x.id === d.id); if (i < 0) return;
    const [gone] = arr.splice(i, 1); touch(q); rerenderSheet(q);
    return toast('Removed.', () => { const x = store.items.get(qid); if (!x) return; x[d.list].splice(i, 0, gone); touch(x); if (curQ() === x) rerenderSheet(x); });
  }
  if (a === 'set'){
    const parts = d.f.split('.'), key = parts.pop(); if (BAD_KEYS.has(key) || parts.some(k => BAD_KEYS.has(k))) return;
    let tgt = q; for (const k of parts){ tgt = Array.isArray(tgt) ? tgt.find(x => x && x.id === k) : tgt[k]; if (!tgt || typeof tgt !== 'object') return; }
    tgt[key] = tgt[key] === d.v ? '' : d.v; touch(q); return rerenderSheet(q);
  }
  if (a === 'mark'){ const ev = q.evidence.find(x => x.id === d.e); if (!ev || BAD_KEYS.has(d.h)) return; if (ev.marks[d.h] === d.v) delete ev.marks[d.h]; else ev.marks[d.h] = d.v; touch(q); return rerenderSheet(q); }
  if (a === 'ev-pull'){ for (const s of q.sessions) if (filled(s.obs) && !q.evidence.some(x => x.from === s.id)) q.evidence.push(coerce(SHAPES.evidence, {text:s.obs, from:s.id})); touch(q); return rerenderSheet(q); }
  if (a === 'conf-log'){ const p = q.thesis.p == null ? q.prior.p : q.thesis.p; q.thesis.p = p; q.confLog.push(coerce(SHAPES.confLog, {at:Date.now(), p, note:val('conf_note')})); touch(q); rerenderSheet(q); return toast(`Logged ${p}%.`); }
  if (a === 'pred-add'){ const text = val('pr_text'); if (!text){ const el = $('#pr_text'); if (el) el.focus(); return; } q.predictions.push(coerce(SHAPES.predictions, {text, p:+$('#pr_p').value, due:val('pr_due'), createdAt:Date.now()})); touch(q); return rerenderSheet(q); }
  if (a === 'pred-del'){
    const i = q.predictions.findIndex(p => p.id === d.id); if (i < 0) return; const [gone] = q.predictions.splice(i, 1); touch(q); rerenderSheet(q);
    return toast('Prediction removed.', () => { const x = store.items.get(qid); if (!x) return; x.predictions.splice(i, 0, gone); touch(x); if (curQ() === x) rerenderSheet(x); });
  }
  if (a === 'copy-thesis'){
    const text = thesisText(q);
    const fallback = () => openDialog(`<div class="dlg"><header><h2>Copy your thesis</h2><button type="button" class="icon" data-act="dlg-close" aria-label="Close">${I.x}</button></header><p class="help">Select the text below and copy it.</p><textarea id="copyBox" rows="12" readonly>${esc(text)}</textarea></div>`, 'Copy your thesis');
    try { navigator.clipboard.writeText(text).then(() => toast('Copied.'), fallback); } catch (err) { fallback(); }
    return;
  }
  if (a === 'q-del'){
    store.items.delete(qid); store.deletedAt[qid] = Date.now(); markDirty(qid); flush(qid); go({name:'home'});
    return toast('Question deleted.', () => { delete store.deletedAt[qid]; store.items.set(qid, q); touch(q); render(); });
  }
});

document.addEventListener('change', e => {
  if (e.target.id !== 'importFile' || !e.target.files || !e.target.files[0]) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result));
      const list = Array.isArray(data) ? data : data.questions;
      if (!Array.isArray(list)) throw new Error('shape');
      let n = 0;
      for (const r of list){ const q = normalize(r); const cur = store.items.get(q.id); if (!cur || q.updatedAt >= cur.updatedAt){ store.items.set(q.id, q); markDirty(q.id); n++; } }
      render(); toast(n ? `Restored ${plural(n, 'question')}.` : 'Nothing newer in that file.');
    } catch (err) { toast('That file is not a Thesis Workbench backup.'); }
  };
  reader.readAsText(e.target.files[0]);
});

document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushAll(); });
let rz = 0; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(drawCharts, 150); });

boot();
})();
