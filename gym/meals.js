// Turns a typed meal ("2 roti, 1 katori dal and a cup of rice") into food-log rows.
// Runs offline against the food list. Anything it can't place comes back as `unknown`
// so the app can ask the AI for an estimate, or the user can type numbers ("misal 450 kcal 18p").

const WORDNUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, half: 0.5, quarter: 0.25, couple: 2, dozen: 12 };
const UNIT_WORDS = {
  g: ['g', 'gm', 'gms', 'gram', 'grams', 'gr'], kg: ['kg', 'kgs'], ml: ['ml', 'mls'], l: ['l', 'ltr', 'litre', 'liter', 'litres', 'liters'],
  katori: ['katori', 'katoris', 'katora', 'vati', 'wati'], bowl: ['bowl', 'bowls'], cup: ['cup', 'cups', 'mug', 'mugs'],
  plate: ['plate', 'plates', 'thali'], glass: ['glass', 'glasses'], piece: ['piece', 'pieces', 'pc', 'pcs', 'nos'],
  slice: ['slice', 'slices'], scoop: ['scoop', 'scoops'], tbsp: ['tbsp', 'tablespoon', 'tablespoons', 'spoon', 'spoons'],
  tsp: ['tsp', 'teaspoon', 'teaspoons'], handful: ['handful', 'handfuls', 'mutthi'], serving: ['serving', 'servings', 'portion', 'portions', 'helping', 'helpings'],
  pack: ['pack', 'packs', 'packet', 'packets'],
};
const UNIT = Object.fromEntries(Object.entries(UNIT_WORDS).flatMap(([u, ws]) => ws.map((w) => [w, u])));
const SIZE = { small: 0.75, little: 0.5, medium: 1, regular: 1, full: 1, large: 1.5, big: 1.5, double: 2 };
const STOP = new Set(['water', 'without', 'no', 'less', 'of', 'some', 'bit', 'the', 'my', 'i', 'ate', 'had', 'have', 'for', 'in', 'at', 'on', 'home', 'homemade', 'made', 'cooked', 'freshly', 'fresh', 'around', 'about', 'approx', 'approximately', 'x', 'more', 'extra', 'also', 'then', 'today', 'just', 'only', 'like', 'nearly', 'almost', 'total']);
// Words that only describe a food. Leftovers other than these become an unknown item instead of being dropped.
const DESCRIBE = new Set(['masala', 'fry', 'fried', 'tadka', 'tarka', 'curry', 'gravy', 'dry', 'spicy', 'hot', 'cold', 'plain', 'sweet', 'salted', 'roasted', 'boiled', 'grilled', 'steamed', 'baked', 'green', 'red', 'yellow', 'white', 'brown', 'homemade', 'garlic', 'jeera', 'lemon', 'special', 'mix', 'mixed', 'desi', 'ghar', 'style', 'maharashtrian', 'punjabi', 'south', 'indian', 'chinese', 'schezwan', 'kadai', 'kadhai', 'rava', 'rawa', 'sooji', 'suji', 'wheat', 'atta', 'multigrain', 'ragi', 'jowar', 'bajra', 'tawa', 'stuffed', 'healthy', 'light', 'low', 'fat', 'sugar', 'sugarfree', 'free', 'diet', 'chilli', 'chili', 'pepper', 'ginger', 'tandoori', 'tikka', 'malai', 'makhani', 'shahi', 'restaurant', 'hotel', 'canteen', 'office', 'mess', 'tiffin', 'leftover', 'piece', 'chutney', 'pickle', 'achar', 'papad', 'sauce', 'ketchup', 'mayo', 'dip']);
const VOL_UNITS = new Set(['katori', 'bowl', 'cup', 'plate']);
const UNIT_G = { katori: 150, bowl: 200, cup: 150, plate: 300, tbsp: 15, tsp: 5, handful: 30 };
const UNIT_ML = { cup: 150, katori: 150, bowl: 200, glass: 250 };

const stem = (w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
const words = (s) => s.toLowerCase().replace(/[^a-z0-9.\s/]/g, ' ').split(/\s+/).filter(Boolean);

function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const same = (a, b) => a === b || (a.length >= 5 && b.length >= 5 && lev(a, b) <= (a.length >= 8 ? 2 : 1));

// What one serving of a food is: grams, ml, a volume unit, or a count of pieces.
function servingInfo(f) {
  const s = String(f.serving || '').toLowerCase();
  const g = /(\d+(?:\.\d+)?)\s*g\b(?!\s*(?:dry|besan|dal))/.exec(s);
  const ml = /(\d+(?:\.\d+)?)\s*ml\b/.exec(s);
  const lead = /^(\d+(?:\.\d+)?)\s*([a-z]+)?/.exec(s);
  const unitWord = lead?.[2] && UNIT[lead[2]];
  const pcs = /(\d+)\s*(?:pcs|pieces)\b/.exec(s);
  let count = null;
  if (lead && (!unitWord || unitWord === 'piece' || unitWord === 'slice')) count = +lead[1];
  else if (pcs) count = +pcs[1];
  if (unitWord === 'g' || unitWord === 'ml') count = pcs ? +pcs[1] : null;
  return { g: g ? +g[1] : null, ml: ml ? +ml[1] : null, unit: unitWord && !['g', 'ml', 'piece', 'slice'].includes(unitWord) ? unitWord : null, count };
}

// How many servings the typed amount is.
function multiplier(f, n, unit, size) {
  const info = servingInfo(f);
  const hasNum = n != null; n = n ?? 1;
  const sz = (unit && VOL_UNITS.has(unit)) || (!unit && !info.count) ? size : 1;
  let m;
  switch (unit) {
    case 'kg': n *= 1000; // fall through
    case 'g': m = info.g ? n / info.g : n / 150; break;
    case 'l': n *= 1000; // fall through
    case 'ml': case 'glass': {
      const ml = unit === 'glass' ? n * 250 : n;
      m = info.ml ? ml / info.ml : info.unit && UNIT_ML[info.unit] ? ml / UNIT_ML[info.unit] : ml / 250; break;
    }
    case 'katori': case 'bowl': case 'cup':
      if (info.unit && ['katori', 'bowl', 'cup'].includes(info.unit)) m = n;
      else if (info.g && !info.count) m = (n * UNIT_G[unit]) / info.g;
      else m = n;
      break;
    case 'plate':
      if (info.unit === 'plate') m = n;
      else if (info.unit && ['katori', 'bowl', 'cup'].includes(info.unit)) m = n * 2;
      else if (info.g && !info.count) m = (n * UNIT_G.plate) / info.g;
      else m = n;
      break;
    case 'tbsp': case 'tsp': case 'handful':
      if (info.unit === unit) m = n;
      else if (info.unit === 'tsp' && unit === 'tbsp') m = n * 3;
      else if (info.unit === 'tbsp' && unit === 'tsp') m = n / 3;
      else if (info.g) m = (n * UNIT_G[unit]) / info.g;
      else m = n;
      break;
    case 'serving': case 'pack': case 'scoop': m = n; break;
    default: // pieces, slices or a bare number
      if (hasNum && !unit && n > 20) m = info.g && !info.count ? n / info.g : 1; // "paneer 150" means grams; "chicken 65" is a dish name
      else m = hasNum && info.count ? n / info.count : n;
  }
  m *= sz;
  return Math.max(0.05, Math.round(m * 100) / 100);
}

// Phrases that name each food: its aliases, else the name before any comma or bracket, split on "/".
export function buildIndex(foods, aliases = {}) {
  const idx = [];
  foods.forEach((f, order) => {
    const phrases = aliases[f.id] || String(f.name).toLowerCase().split(/[,(]/)[0].split('/').map((x) => x.trim()).filter(Boolean);
    for (const ph of phrases) idx.push({ f, order, toks: words(ph).map(stem) });
  });
  return idx;
}

function matchFood(nameToks, idx) {
  if (!nameToks.length) return null;
  const last = nameToks.at(-1);
  let best = null;
  for (const e of idx) {
    if (!e.toks.length || !e.toks.every((t) => nameToks.some((w) => same(w, t)))) continue;
    const score = e.toks.length * 10 + (e.toks.some((t) => same(t, last)) ? 3 : 0) + (e.toks.every((t) => nameToks.includes(t)) ? 1 : 0);
    if (!best || score > best.score || (score === best.score && e.order < best.order)) best = { f: e.f, toks: e.toks, score, order: e.order };
  }
  return best;
}

function pullNutrition(s) {
  let kcal = null, p = null;
  s = s.replace(/(\d+(?:\.\d+)?)\s*(?:k\s*cals?|kcals?|calories|calorie|cals?)\b/g, (_, x) => { kcal = +x; return ' '; });
  s = s.replace(/(?:calories|kcal|cals?)\s*[:=]\s*(\d+(?:\.\d+)?)/g, (_, x) => { kcal = +x; return ' '; });
  s = s.replace(/(\d+(?:\.\d+)?)\s*(?:g|gm|gms|grams?)\s*(?:of\s+)?(?:protein|prot)\b/g, (_, x) => { p = +x; return ' '; });
  s = s.replace(/(\d+(?:\.\d+)?)\s*p\b/g, (_, x) => { p = +x; return ' '; });
  s = s.replace(/\b(?:protein|prot)\s*[:=-]?\s*(\d+(?:\.\d+)?)\s*(?:g|gm|grams?)?\s*$/g, (_, x) => { p = +x; return ' '; });
  return { s, kcal, p };
}

// Split one chunk into pieces wherever a new number starts after a food name ("2 roti 1 katori dal").
function pieces(toks) {
  const out = []; let cur = { n: null, unit: null, size: 1, name: [] };
  const isNum = (t) => /^\d+(?:\.\d+)?(?:\/\d+)?$/.test(t) || (t in WORDNUM && t !== 'a' && t !== 'an');
  for (const t of toks) {
    if (isNum(t) && cur.name.length && cur.n != null) { out.push(cur); cur = { n: null, unit: null, size: 1, name: [] }; }
    if (isNum(t) || ((t === 'a' || t === 'an') && cur.n == null && !cur.name.length)) {
      const v = t.includes('/') ? t.split('/').reduce((a, b) => +a / +b) : (WORDNUM[t] ?? +t);
      if (cur.name.length && cur.n == null) cur.n = v; // "dal 2 katori"
      else if (cur.n != null && t === 'half') cur.n *= 0.5; // "1 half" is unusual; treat as a half
      else cur.n = v;
    } else if (UNIT[t] && !cur.unit) cur.unit = UNIT[t];
    else if (SIZE[t] && !cur.name.length) cur.size = SIZE[t];
    else if (!STOP.has(t)) cur.name.push(stem(t));
  }
  out.push(cur);
  // a piece with only a quantity belongs to the food before it ("paneer tikka 200 g")
  const merged = [];
  for (const pc of out) {
    const prev = merged.at(-1);
    if (!pc.name.length && prev && prev.n == null) { prev.n = pc.n; prev.unit = prev.unit || pc.unit; prev.size = pc.size !== 1 ? pc.size : prev.size; continue; }
    if (!pc.name.length && prev && pc.n == null) continue;
    merged.push(pc);
  }
  return merged;
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function qtyText(n, unit, size) {
  const sz = size !== 1 ? (Object.entries(SIZE).find(([, v]) => v === size)?.[0] + ' ') : '';
  if (n == null && !unit) return sz.trim();
  return `${n ?? 1}${unit && ['g', 'kg', 'ml', 'l'].includes(unit) ? '' : ' '}${sz}${unit || ''}`.trim();
}

// Returns rows: { raw, name, fid, serving, kcal, p, qty, src: 'db' | 'given' | 'unknown' }.
// For 'db' rows kcal/p are per serving and qty is the multiplier; for 'given' rows they are totals with qty 1.
export function parseMeal(text, idx) {
  let t = String(text || '').toLowerCase()
    .replace(/(\d)\s*½/g, '$1.5').replace(/(\d)\s*¼/g, '$1.25').replace(/(\d)\s*¾/g, '$1.75')
    .replace(/½/g, '0.5').replace(/¼/g, '0.25').replace(/¾/g, '0.75')
    .replace(/\b(\d+|one|two|three|four|five)\s+and\s+a\s+half\b/g, (_, x) => String((WORDNUM[x] ?? +x) + 0.5))
    .replace(/\bhalf\s+an?\b/g, 'half')
    .replace(/(\d)\s*x\b/g, '$1 ');
  const chunks = t.split(/\s*(?:,|;|\n|\+|&|\band\b|\bwith\b|\bplus\b|\balong\b|\bani\b|\baur\b|\bn\b)\s*/).map((c) => c.trim()).filter(Boolean);
  const rows = [];
  for (const chunk of chunks) {
    const nut = pullNutrition(chunk);
    const toks = words(nut.s.replace(/(\d)([a-z])/g, '$1 $2').replace(/([a-z])(\d)/g, '$1 $2'));
    const ps = pieces(toks);
    const named = ps.filter((pc) => pc.name.length);
    if (!named.length) { // only numbers: they belong to the previous food ("dal, 150 kcal")
      const prev = rows.at(-1);
      if (prev && (nut.kcal != null || nut.p != null)) Object.assign(prev, given(prev, nut));
      continue;
    }
    named.forEach((pc, k) => {
      const m = matchFood(pc.name, idx); const f = m?.f;
      const raw = named.length === 1 ? chunk : `${qtyText(pc.n, pc.unit, pc.size)} ${pc.name.join(' ')}`.trim();
      const row = { raw, phrase: pc.name.join(' '), n: pc.n, unit: pc.unit, size: pc.size };
      if (f) Object.assign(row, { name: f.name, fid: f.id, serving: f.serving, kcal: f.kcal, p: f.p, qty: multiplier(f, pc.n, pc.unit, pc.size), src: 'db' });
      else Object.assign(row, { name: cap(row.phrase), fid: null, src: 'unknown' });
      // typed numbers apply to the last food in the chunk
      if (k === named.length - 1 && (nut.kcal != null || nut.p != null)) Object.assign(row, given(row, nut));
      rows.push(row);
      // words left over after the match can be a second food: "dal chawal", "bread omelette"
      if (f && row.src === 'db') {
        const rest = pc.name.filter((w) => !m.toks.some((t) => same(w, t)));
        const m2 = rest.length ? matchFood(rest, idx) : null;
        if (m2 && m2.f.id !== f.id) rows.push({ raw: rest.join(' '), phrase: rest.join(' '), name: m2.f.name, fid: m2.f.id, serving: m2.f.serving, kcal: m2.f.kcal, p: m2.f.p, qty: 1, src: 'db' });
        else if (!m2) {
          const odd = rest.filter((w) => !DESCRIBE.has(w) && !/^\d/.test(w) && w.length > 2);
          if (odd.length) rows.push({ raw: odd.join(' '), phrase: odd.join(' '), name: cap(odd.join(' ')), fid: null, src: 'unknown' });
        }
      }
    });
  }
  return rows;
}

function given(row, nut) {
  const had = row.src === 'given' ? row : null;
  const db = row.src === 'db' ? { kcal: row.kcal * row.qty, p: row.p * row.qty } : null;
  const kcal = nut.kcal ?? (had && !row.noKcal ? row.kcal : db?.kcal);
  const p = nut.p ?? (had && !row.noP ? row.p : db?.p);
  return { kcal: Math.round(kcal ?? 0), p: Math.round((p ?? 0) * 10) / 10, qty: 1, serving: qtyText(row.n, row.unit, row.size) || 'as typed', src: 'given', noKcal: kcal == null, noP: p == null };
}
