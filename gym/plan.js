// The written plan, rendered from the profile and the program data.

const SOURCES = [
  ['Morton 2018: protein meta-analysis (1.6–2.2 g/kg)', 'https://pubmed.ncbi.nlm.nih.gov/28698222/'],
  ['Helms 2014: contest-prep nutrition (0.5–1%/week, 2.3–3.1 g/kg lean mass)', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4033492'],
  ['Schoenfeld & Aragon 2018: protein per meal', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5828430'],
  ['Murphy & Koehler 2022: deficits above ~500 kcal blunt lean-mass gains', 'https://doi.org/10.1111/sms.14075'],
  ['Schoenfeld 2017: weekly sets vs muscle growth', 'https://pubmed.ncbi.nlm.nih.gov/27433992/'],
  ['Schoenfeld 2016: training a muscle twice a week', 'https://pubmed.ncbi.nlm.nih.gov/27102172/'],
  ['Singer 2024: rest between sets meta-analysis', 'https://www.frontiersin.org/articles/10.3389/fspor.2024.1429789/full'],
  ['Ogasawara 2013: muscle memory after training breaks', 'https://link.springer.com/article/10.1007/s00421-012-2511-9'],
  ['NSCA/CSCCa 2019: safe return to training (rhabdo risk window)', 'https://nsca.com/about-us/position-statements/safe-return-to-training'],
  ['Bell 2023: how coaches deload', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10511399/'],
  ['Peos 2021: diet breaks in trained lifters', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7906362/'],
  ['Eddens 2018: lifting before cardio in the same session (meta-analysis)', 'https://pubmed.ncbi.nlm.nih.gov/28917030/'],
  ['Murlasits 2018: strength/endurance order (meta-analysis)', 'https://pubmed.ncbi.nlm.nih.gov/28783467/'],
  ['Kreider 2017: ISSN creatine position stand', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5469049/'],
  ['Nedeltcheva 2010: sleep loss in a calorie deficit', 'https://pubmed.ncbi.nlm.nih.gov/20921542/'],
  ['Tasali 2022: longer sleep, lower intake', 'https://pubmed.ncbi.nlm.nih.gov/35129580/'],
  ['Hodgdon & Beckett 1984: US Navy body-fat equations', 'https://apps.dtic.mil/sti/pdfs/ADA143890.pdf'],
  ['IFCT 2017: Indian Food Composition Tables (NIN)', 'https://www.nin.res.in/ebooks/IFCT2017.pdf'],
];

export function planView({ S, tg, week, phaseOf, dayPlan, schedOf, PHASES, DAYS, SCHEDULES, EXERCISES, addDays, fmtShort, esc, restFor, mmss, bf }) {
  const p = S.profile; const ph = phaseOf(week);
  const bfNow = bf ?? 24; const measured = bf != null;
  const lean = tg.w * (1 - bfNow / 100);
  const w20 = lean / 0.8; const w15 = lean / 0.85;
  const lo = tg.w * 0.005, hi = tg.w * 0.0075;
  const span = (target) => (target >= tg.w ? null : [Math.ceil((tg.w - target) / hi), Math.ceil((tg.w - target) / lo)]);
  const s20 = span(w20), s15 = span(w15);
  const month = (weeks) => new Date(Date.now() + weeks * 7 * 864e5).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  const feeds = Math.round(tg.protein / 4);
  const main = SCHEDULES[p.schedule] || SCHEDULES.five;
  const wkStart = (w) => addDays(p.startDate, (w - 1) * 7);

  const dayList = (days, w) => days.map((d) => `<details class="dayplan"><summary><b>${DAYS[d].name}</b> <span class="muted small">${esc(DAYS[d].focus)}</span></summary>
    <table class="tbl">${dayPlan(d, w).map((s) => { const E = EXERCISES[s.ex]; return `<tr><td>${esc(E.name)}</td><td class="num">${s.sets} × ${E.reps.join('–')}</td><td class="num muted">${mmss(restFor(s.ex))}</td></tr>`; }).join('')}</table></details>`).join('');

  return `
  <section class="card hero">
    <div class="kicker">Week ${week} · ${esc(ph.name)}</div>
    <h2>Get under 20%, then to 15%, keeping the muscle</h2>
    <p>Lift 5 days a week with a slow re-entry, eat ${tg.cut.toLocaleString('en-IN')} kcal with ${tg.protein} g protein, walk ${(10000).toLocaleString('en-IN')} steps and sleep 7.5+ hours. Lose ${lo.toFixed(1)}–${hi.toFixed(1)} kg a week and no faster.</p>
  </section>

  <section class="card">
    <h3>Your numbers</h3>
    <table class="tbl kv">
      <tr><td>Calories</td><td><b>${tg.cut.toLocaleString('en-IN')} kcal/day</b> <span class="muted">(maintenance ≈ ${Math.round(tg.tdee / 50) * 50}, a 500 kcal deficit)</span></td></tr>
      <tr><td>Protein</td><td><b>${tg.protein} g/day</b> <span class="muted">in 4 feeds of about ${feeds} g</span></td></tr>
      <tr><td>Fat / carbs</td><td>55–65 g fat, the rest carbs (about 230 g), mostly around training</td></tr>
      <tr><td>Steps</td><td>8,000 in weeks 1–2, then <b>10,000</b>, every day</td></tr>
      <tr><td>Cardio</td><td><b>10 min incline treadmill walk after every session</b>, plus a 20–30 min walk on 1–2 rest days if fat loss stalls. Not running: it eats into leg recovery</td></tr>
      <tr><td>Sleep</td><td><b>7+ hours asleep</b>, 7.5–9 in bed, same wake-up time daily</td></tr>
      <tr><td>Creatine</td><td>3–5 g daily, any time, with a meal. Adds 0.5–1 kg of water over 3–4 weeks</td></tr>
      <tr><td>Water</td><td>About 3 L</td></tr>
      <tr><td>Rate</td><td><b>${lo.toFixed(2)}–${hi.toFixed(2)} kg/week</b> on the 7-day average, judged from week 5</td></tr>
    </table>
  </section>

  <section class="card">
    <h3>Where this gets you</h3>
    <p>${measured ? `Your tape measurement says about <b>${bfNow.toFixed(1)}%</b>` : 'Assuming you are around <b>24%</b> now (log waist and neck in Progress to replace this guess)'}, you carry about ${lean.toFixed(1)} kg of lean mass. Keeping it:</p>
    <table class="tbl kv">
      <tr><td>Under 20%</td><td>${s20 ? `about <b>${w20.toFixed(1)} kg</b>, ${s20[0]}–${s20[1]} weeks (around ${month(s20[0])}–${month(s20[1])})` : '<b>already there</b>'}</td></tr>
      <tr><td>15%</td><td>${s15 ? `about <b>${w15.toFixed(1)} kg</b>, ${s15[0]}–${s15[1]} weeks plus diet breaks (around ${month(s15[0] + 1)}–${month(s15[1] + 2)})` : '<b>already there</b>'}</td></tr>
    </table>
    <p class="small muted">If you build some muscle on the way (likely, with muscle memory), you reach each level a little heavier than this.</p>
  </section>

  <section class="card">
    <h3>The phases</h3>
    <ol class="phases">${PHASES.filter((x) => x.weeks[0] <= 16).map((x) => {
      const cur = x === ph; const range = x.weeks[0] === x.weeks[1] ? `Week ${x.weeks[0]}` : x.weeks[1] > 100 ? `Week ${x.weeks[0]}+` : `Weeks ${x.weeks[0]}–${x.weeks[1]}`;
      return `<li class="${cur ? 'cur' : ''}"><div class="ph-h"><b>${esc(x.name)}</b> <span class="muted small">${range} · from ${fmtShort(wkStart(x.weeks[0]))}</span>${cur ? ' <span class="tag">now</span>' : ''}</div>
        <div class="small">${x.sets} sets, stop ${x.rir} reps short${x.maintenance ? ' · eat at maintenance' : ''}</div><div class="small muted">${esc(x.note)}</div></li>`;
    }).join('')}</ol>
  </section>

  <section class="card">
    <h3>The week</h3>
    <p><b>Weeks 1–2:</b> Push, Pull, Legs, rest, repeat.<br><b>From week 3:</b> ${esc(main.label)}. <span class="muted">(Change it in Settings.)</span></p>
    <p class="small muted">The app picks the next session from the last one you did, so a missed day just shifts everything. Each muscle gets hit about twice a week and 10–16 hard sets once Build starts.</p>
    <h4>This week's sessions</h4>
    ${dayList(schedOf(week).days, week)}
    ${week < 3 ? `<h4>From week 3</h4>${dayList(main.days, 3)}` : ''}
  </section>

  <section class="card">
    <h3>Each session</h3>
    <ol class="steps-list">
      <li>5 minutes of easy walking or cycling, then two warm-up sets on the first two lifts (the app shows the weights).</li>
      <li>Tick each set. The rest timer starts by itself: ${mmss(S.settings.restHeavy ?? 150)} for heavy free weights, ${mmss(S.settings.restCompound)} for machine compounds, ${mmss(S.settings.restIso)} for isolation.</li>
      <li>After the last set of each exercise, tag it easy, good or hard. That tag drives the next suggested weight.</li>
      <li><b>Finish with a 10-minute incline treadmill walk</b> (incline 8–12%, 5–5.5 km/h, you can still talk). Always last, never first: lifting first gives better strength gains, and order makes no difference to fat loss. The app has a 10:00 timer for it.</li>
      <li>Done in 60–75 minutes.</li>
    </ol>
  </section>

  <section class="card">
    <h3>How the weight goes up</h3>
    <ul>
      <li><b>Double progression.</b> Each exercise has a rep range (say 8–12). Keep the weight until every set hits 12, then add one step (2.5 kg upper body, 5 kg legs, 1–2 kg dumbbells) and start again at 8.</li>
      <li><b>Weeks 1–3 ramp fast.</b> Your starting weights are far below what you can do. If an exercise felt easy, the next session goes up a step even before you reach the top of the range, two steps if you did.</li>
      <li><b>Stalls.</b> If you miss the bottom of the range twice and it felt hard, drop a step and build back.</li>
      <li><b>Deloads</b> in weeks 8 and 15: same weights, 2 sets, easy. Take one early if reps drop on 2+ lifts for 2 sessions in a row.</li>
    </ul>
    <p class="note small">Weeks 1–2: no sets to failure and no slow lowering. Coming back after a layoff is the main risk window for rhabdomyolysis. Cola-coloured urine, swelling, or pain far beyond normal soreness means see a doctor that day.</p>
  </section>

  <section class="card">
    <h3>Food, the Indian way</h3>
    <ul>
      <li><b>Protein first at every meal.</b> Dal and roti alone are not a protein source: you'd need 3–4 katoris of dal for what one scoop of whey gives.</li>
      <li><b>Plate:</b> a third protein (paneer, soya, eggs, chicken, hung curd), a third vegetables, the rest roti or rice.</li>
      <li><b>Biggest carbs around training</b>, lighter dinner. Last big meal 2–3 hours before bed.</li>
      <li><b>Eating out:</b> pick the tandoori/tikka, dal or chicken dish and skip the fried starter; log it honestly.</li>
    </ul>
    <h4>What 25 g of protein looks like</h4>
    <table class="tbl"><tr><th>Food</th><th class="num">Amount</th><th class="num">kcal</th></tr>
      <tr><td>Whey</td><td class="num">1 scoop</td><td class="num">120</td></tr>
      <tr><td>Soya chunks</td><td class="num">50 g dry</td><td class="num">175</td></tr>
      <tr><td>Chicken breast, cooked</td><td class="num">80 g</td><td class="num">135</td></tr>
      <tr><td>Egg whites + 1 whole egg</td><td class="num">5 + 1</td><td class="num">145</td></tr>
      <tr><td>Hung curd / Greek yogurt</td><td class="num">280 g</td><td class="num">260</td></tr>
      <tr><td>Paneer</td><td class="num">130 g</td><td class="num">390</td></tr>
      <tr><td>Dal</td><td class="num">3½ katori</td><td class="num">525</td></tr>
    </table>
    <p class="small muted">Your ready-made day plan and grocery list are in <a href="#food/plan">Food → Day plan</a> and <a href="#food/prep">Prep &amp; groceries</a>. Prep on Sunday and Wednesday.</p>
  </section>

  <section class="card">
    <h3>Checking progress and adjusting</h3>
    <ul>
      <li>Weigh every morning; only the 7-day average counts.</li>
      <li>Waist and neck every Sunday morning; photos every two weeks, same light.</li>
      <li><b>Weeks 1–4: change nothing.</b> Creatine and fresh training add water.</li>
      <li>From week 5: losing 0.2–0.8 kg a week → keep going. Under 0.2 kg for 2 weeks with a flat waist → 150 kcal less or 2,000 more steps. Over 0.8 kg or lifts dropping → 150 kcal more.</li>
      <li>Weight flat but waist down and lifts up = recomposition. Change nothing.</li>
    </ul>
  </section>

  <section class="card">
    <h3>Sources</h3>
    <ul class="small src">${SOURCES.map(([t, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join('')}</ul>
    <p class="small muted">General guidance, not medical advice. Food values are rounded from IFCT 2017, USDA and Indian pack labels; check your own labels for whey and paneer.</p>
  </section>`;
}
