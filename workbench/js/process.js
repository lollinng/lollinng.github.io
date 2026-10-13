/* Renders the process page from the same framework the app uses, so the
   explanation cannot drift from what the workbench actually asks for. */
(() => {
'use strict';

const { STAGES, BANDS, TRADITIONS, METHOD, EVIDENCE } = window.TW;
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ARROW = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M3 12h17M14 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/* ---------- the five stages ---------- */
$('#flow').innerHTML = STAGES.map((s, i) =>
  `<li class="node"><span class="eyebrow">Stage ${i + 1}</span><b>${s.name}</b><span class="q">${s.ask}</span><span class="k">The trap</span><span>${s.trap}</span><span class="k">You leave with</span><span>${s.out}</span></li>`
  + (i < STAGES.length - 1 ? `<li class="arr" aria-hidden="true">${ARROW}</li>` : '')).join('');

/* ---------- the likelihood scale ---------- */
const bands = BANDS.map(([hi, word], i) => ({ lo: i ? BANDS[i - 1][0] : 0, hi, word, n: i + 1 }));
$('#scale').innerHTML = bands.map(b => `<span style="flex:${b.hi - b.lo};background:var(--b${b.n})" data-tip="${b.lo}–${b.hi}%: ${esc(b.word)}"></span>`).join('');
$('#ticks').innerHTML = [0, 20, 45, 55, 80, 100].map(t => `<span style="left:${t}%"${t === 0 ? ' class="first"' : t === 100 ? ' class="last"' : ''}>${t}%</span>`).join('');
$('#bands').innerHTML = bands.map(b => `<li><i style="background:var(--b${b.n})"></i><span><b>${esc(b.word)}</b> <span class="mono">${b.lo}–${b.hi}%</span></span></li>`).join('');

/* ---------- traditions by stage ---------- */
$('#trad').innerHTML = `<thead><tr><th scope="col">Borrowed from</th>${STAGES.map(s => `<th scope="col">${s.name}</th>`).join('')}</tr></thead><tbody>${
  TRADITIONS.map(([id, name]) => `<tr><th scope="row">${name}</th>${METHOD.map(g => `<td>${g.rows.filter(r => r.trad === id).map(r => `<span>${r.m}</span>`).join('')}</td>`).join('')}</tr>`).join('')}</tbody>`;

const tradName = Object.fromEntries(TRADITIONS);
$('#methods').innerHTML = METHOD.map((g, i) =>
  `<section class="mstage"><span class="eyebrow">Stage ${i + 1}</span><h3>${g.stage}</h3><ul class="mlist">${g.rows.map(r =>
    `<li><b>${r.url ? `<a href="${r.url}" target="_blank" rel="noopener noreferrer">${r.m}</a>` : r.m}</b><span class="from mono">${r.from} · ${tradName[r.trad]}</span><p>${r.why}</p><p><span class="eyebrow">In the workbench</span> ${r.here}</p></li>`).join('')}</ul></section>`).join('');

$('#evidence-list').innerHTML = EVIDENCE.map(e =>
  `<li><b>${e.t}</b><p>${e.d}</p><span class="from mono"><a href="${e.url}" target="_blank" rel="noopener noreferrer">${e.src}</a></span></li>`).join('');

/* ---------- the session loop ---------- */
function ring(W){
  const H = Math.round(W * 0.82), cx = W / 2, cy = H / 2;
  const R = Math.min(W * 0.31, H * 0.36), r = clamp(W * 0.075, 30, 38);
  const steps = [['Observe', 1], ['Explain', 1], ['Predict', 1], ['Wait', 0], ['Resolve', 0], ['Update', 0]];
  const pt = (deg, rad = R) => [cx + rad * Math.cos(deg * Math.PI / 180), cy + rad * Math.sin(deg * Math.PI / 180)];
  const pad = Math.asin(r / R) * 180 / Math.PI + 4;       // angle hidden behind a node, plus a small gap
  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="A loop of six steps: observe, explain, predict, wait for the date, resolve the prediction, update your confidence, then observe again"><defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs>`;
  steps.forEach((_, i) => {
    const a = -90 + i * 60, [x1, y1] = pt(a + pad), [x2, y2] = pt(a + 60 - pad - 2);
    s += `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} A${R.toFixed(1)} ${R.toFixed(1)} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="currentColor" stroke-width="1.5" marker-end="url(#ah)"/>`;
  });
  steps.forEach(([label, now], i) => {
    const [x, y] = pt(-90 + i * 60);
    s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${now ? 'var(--accent-wash)' : 'var(--surface)'}" stroke="${now ? 'var(--accent)' : 'var(--line-strong)'}" stroke-width="1.5"/><text class="node-n" x="${x.toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle">${i + 1}</text><text class="node-t" x="${x.toFixed(1)}" y="${(y + 9).toFixed(1)}" text-anchor="middle">${label}</text>`;
  });
  s += `<text class="tk" x="${cx}" y="${cy - 3}" text-anchor="middle">each lap moves</text><text class="tk" x="${cx}" y="${cy + 12}" text-anchor="middle">your confidence</text>`;
  return s + '</svg>';
}

/* ---------- calibration, illustrated ---------- */
function calib(W){
  const pts = [[10, 8], [30, 27], [50, 46], [70, 60], [90, 71]];
  const H = Math.round(W * 0.86), m = { l: 44, r: 14, t: 26, b: 44 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const X = v => m.l + iw * v / 100, Y = v => m.t + ih * (1 - v / 100);
  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Illustrative calibration chart. Stated odds on the horizontal axis, how often it happened on the vertical. The dots fall below the diagonal at the high end, which is overconfidence">`;
  s += `<text class="tk" x="0" y="12">How often it happened</text>`;
  for (const t of [0, 25, 50, 75, 100]) s += `<line x1="${m.l}" x2="${m.l + iw}" y1="${Y(t)}" y2="${Y(t)}" stroke="var(--grid)" stroke-width="1"/><text class="tk" x="${m.l - 8}" y="${Y(t) + 4}" text-anchor="end">${t}%</text><text class="tk" x="${X(t)}" y="${m.t + ih + 16}" text-anchor="middle">${t}%</text>`;
  s += `<text class="tk" x="${m.l + iw / 2}" y="${H - 6}" text-anchor="middle">How likely you said it was</text>`;
  s += `<line x1="${X(0)}" y1="${Y(0)}" x2="${X(100)}" y2="${Y(100)}" stroke="var(--line-strong)" stroke-width="1"/>`;
  s += `<text class="tk" x="${X(30)}" y="${Y(86)}" text-anchor="middle">more often than said</text><text class="tk" x="${X(70)}" y="${Y(12)}" text-anchor="middle">less often than said</text>`;
  for (const [x, y] of pts) s += `<circle cx="${X(x).toFixed(1)}" cy="${Y(y).toFixed(1)}" r="5.5" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/><circle cx="${X(x).toFixed(1)}" cy="${Y(y).toFixed(1)}" r="14" fill="transparent" tabindex="0" data-tip="Said about ${x}%. It happened ${y}% of the time."/>`;
  return s + '</svg>';
}

function draw(){
  const r = $('#ring'), c = $('#calib');
  r.innerHTML = ring(clamp(r.clientWidth || 320, 280, 460));
  c.innerHTML = calib(clamp(c.clientWidth || 320, 280, 420));
}
draw();
let rz = 0; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(draw, 150); });

/* ---------- tooltips ---------- */
const tip = $('#tip');
function showTip(t){ tip.textContent = t.dataset.tip; tip.hidden = false; const b = t.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight; tip.style.left = clamp(b.left + b.width / 2 - w / 2, 8, window.innerWidth - w - 8) + 'px'; tip.style.top = (b.top - h - 6 < 8 ? b.bottom + 6 : b.top - h - 6) + 'px'; }
document.addEventListener('pointerover', e => { const t = e.target.closest && e.target.closest('[data-tip]'); if (t) showTip(t); });
document.addEventListener('pointerout', e => { if (e.target.closest && e.target.closest('[data-tip]')) tip.hidden = true; });
document.addEventListener('focusin', e => { if (e.target.dataset && e.target.dataset.tip) showTip(e.target); });
document.addEventListener('focusout', e => { if (e.target.dataset && e.target.dataset.tip) tip.hidden = true; });
})();
