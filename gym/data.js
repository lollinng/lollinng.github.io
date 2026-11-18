// Static data for the gym app: exercises, the program, foods and meal templates.

// Prathamesh's starting point. Editable in Settings; these are only the first-open defaults.
export const MY_PROFILE = { age: 24, heightCm: 172.7, weightKg: 80, startDate: '2026-11-17', diet: 'egg', activity: 1.5, deficit: 500, sleepGoal: 8, schedule: 'five' };
export const MY_HISTORY = [
  { id: 'push-20261117', day: 'push', date: '2026-11-17', startedAt: '2026-11-17T18:00:00+05:30', mins: null, items: [
    { ex: 'incline_press', effort: 'easy', sets: [{ w: 7.5, r: 10, done: true }, { w: 7.5, r: 10, done: true }] },
    { ex: 'chest_press', effort: 'easy', sets: [{ w: 7.5, r: 10, done: true }, { w: 7.5, r: 10, done: true }] },
    { ex: 'shoulder_press', effort: 'easy', sets: [{ w: 5, r: 10, done: true }, { w: 5, r: 10, done: true }] },
    { ex: 'cable_lateral', effort: 'easy', sets: [{ w: 2.5, r: 10, done: true }, { w: 2.5, r: 10, done: true }] },
  ] },
];
// Food values are per serving as shown, rounded, from IFCT 2017 / USDA / Indian pack labels.

export const EXERCISES = {
  // ---- Push ----
  incline_press:   { name: 'Incline chest press', muscle: 'chest', type: 'compound', reps: [8, 12], inc: 2.5, alts: ['incline_db', 'incline_smith'], cue: 'Bench at 30°. Shoulder blades pinned back, bar or handles to upper chest.' },
  incline_db:      { name: 'Incline dumbbell press', muscle: 'chest', type: 'compound', heavy: true, reps: [8, 12], inc: 2, alts: ['incline_press', 'incline_smith'], cue: 'Weight per dumbbell. Elbows about 45° from the body.' },
  incline_smith:   { name: 'Incline Smith press', muscle: 'chest', type: 'compound', reps: [8, 12], inc: 2.5, alts: ['incline_press', 'incline_db'], cue: 'Bench at 30°, bar touches upper chest.' },
  chest_press:     { name: 'Chest press (machine)', muscle: 'chest', type: 'compound', reps: [8, 12], inc: 2.5, alts: ['flat_db', 'bench'], cue: 'Handles at mid-chest. Push without the shoulders rolling forward.' },
  flat_db:         { name: 'Flat dumbbell press', muscle: 'chest', type: 'compound', heavy: true, reps: [8, 12], inc: 2, alts: ['chest_press', 'bench'], cue: 'Weight per dumbbell. Feet planted, slight arch.' },
  bench:           { name: 'Barbell bench press', muscle: 'chest', type: 'compound', heavy: true, reps: [6, 10], inc: 2.5, alts: ['chest_press', 'flat_db'], cue: 'Total bar weight. Bar to lower chest, use a spotter or safeties.' },
  shoulder_press:  { name: 'Shoulder press', muscle: 'shoulders', type: 'compound', heavy: true, reps: [8, 12], inc: 2, alts: ['machine_ohp', 'smith_ohp'], cue: 'Seated, back supported. Dumbbells from ear level to just short of lockout.' },
  machine_ohp:     { name: 'Shoulder press (machine)', muscle: 'shoulders', type: 'compound', reps: [8, 12], inc: 2.5, alts: ['shoulder_press', 'smith_ohp'], cue: 'Handles start at chin height.' },
  smith_ohp:       { name: 'Smith shoulder press', muscle: 'shoulders', type: 'compound', reps: [8, 12], inc: 2.5, alts: ['shoulder_press', 'machine_ohp'], cue: 'Seated, bar to chin level.' },
  cable_lateral:   { name: 'Cable lateral raise', muscle: 'shoulders', type: 'iso', reps: [12, 15], inc: 1.25, alts: ['db_lateral', 'machine_lateral'], cue: 'Lead with the elbow, stop at shoulder height, 2 s down.' },
  db_lateral:      { name: 'Dumbbell lateral raise', muscle: 'shoulders', type: 'iso', reps: [12, 15], inc: 1, alts: ['cable_lateral', 'machine_lateral'], cue: 'Slight forward lean, no swinging.' },
  machine_lateral: { name: 'Lateral raise (machine)', muscle: 'shoulders', type: 'iso', reps: [12, 15], inc: 2.5, alts: ['cable_lateral', 'db_lateral'], cue: 'Pads on the outside of the elbows.' },
  pec_deck:        { name: 'Pec deck / cable fly', muscle: 'chest', type: 'iso', reps: [12, 15], inc: 2.5, alts: ['cable_fly'], cue: 'Soft elbows, squeeze for a second at the middle.' },
  cable_fly:       { name: 'Cable fly (low to high)', muscle: 'chest', type: 'iso', reps: [12, 15], inc: 1.25, alts: ['pec_deck'], cue: 'Hands meet at chin height.' },
  pushdown:        { name: 'Triceps rope pushdown', muscle: 'triceps', type: 'iso', reps: [10, 15], inc: 2.5, alts: ['bar_pushdown'], cue: 'Elbows fixed at your sides, spread the rope at the bottom.' },
  bar_pushdown:    { name: 'Triceps bar pushdown', muscle: 'triceps', type: 'iso', reps: [10, 15], inc: 2.5, alts: ['pushdown'], cue: 'Elbows fixed, full lockout.' },
  oh_triceps:      { name: 'Overhead cable triceps extension', muscle: 'triceps', type: 'iso', reps: [10, 15], inc: 2.5, alts: ['db_oh_triceps'], cue: 'Face away from the cable, deep stretch behind the head.' },
  db_oh_triceps:   { name: 'Overhead dumbbell triceps extension', muscle: 'triceps', type: 'iso', reps: [10, 15], inc: 2, alts: ['oh_triceps'], cue: 'One dumbbell, both hands, elbows pointing up.' },

  // ---- Pull ----
  lat_pulldown:    { name: 'Lat pulldown', muscle: 'back', type: 'compound', reps: [8, 12], inc: 2.5, alts: ['assisted_pullup', 'pullup', 'single_pulldown'], cue: 'Chest up, pull the bar to the collarbone, elbows down and back.' },
  assisted_pullup: { name: 'Assisted pull-up', muscle: 'back', type: 'compound', reps: [6, 10], inc: -2.5, alts: ['lat_pulldown', 'pullup'], cue: 'Log the assist weight. Less assist = progress.' },
  pullup:          { name: 'Pull-up', muscle: 'back', type: 'compound', reps: [5, 10], inc: 0, alts: ['lat_pulldown', 'assisted_pullup'], cue: 'Log added weight (0 for bodyweight). Chin over bar.' },
  single_pulldown: { name: 'Single-arm cable pulldown', muscle: 'back', type: 'compound', reps: [10, 12], inc: 1.25, alts: ['lat_pulldown'], cue: 'Per arm. Drive the elbow to the hip.' },
  cable_row:       { name: 'Seated cable row', muscle: 'back', type: 'compound', reps: [8, 12], inc: 2.5, alts: ['machine_row', 'tbar_row'], cue: 'Sit tall, pull to the belly button, squeeze the shoulder blades.' },
  machine_row:     { name: 'Chest-supported machine row', muscle: 'back', type: 'compound', reps: [8, 12], inc: 2.5, alts: ['cable_row', 'tbar_row'], cue: 'Chest on the pad, no jerking.' },
  tbar_row:        { name: 'T-bar row', muscle: 'back', type: 'compound', heavy: true, reps: [8, 12], inc: 2.5, alts: ['machine_row', 'cable_row'], cue: 'Flat back, pull to the lower chest.' },
  db_row:          { name: 'One-arm dumbbell row', muscle: 'back', type: 'compound', heavy: true, reps: [8, 12], inc: 2, alts: ['machine_row', 'cable_row'], cue: 'Per dumbbell. Knee and hand on the bench, pull to the hip.' },
  face_pull:       { name: 'Face pull', muscle: 'rear delts', type: 'iso', reps: [12, 15], inc: 1.25, alts: ['reverse_fly'], cue: 'Rope to the forehead, thumbs back, elbows high.' },
  reverse_fly:     { name: 'Reverse pec deck', muscle: 'rear delts', type: 'iso', reps: [12, 15], inc: 2.5, alts: ['face_pull'], cue: 'Arms nearly straight, lead with the elbows.' },
  straight_arm:    { name: 'Straight-arm pulldown', muscle: 'back', type: 'iso', reps: [12, 15], inc: 2.5, alts: ['single_pulldown'], cue: 'Hinge slightly, sweep the bar to the thighs with straight arms.' },
  db_curl:         { name: 'Dumbbell biceps curl', muscle: 'biceps', type: 'iso', reps: [10, 12], inc: 1, alts: ['cable_curl', 'ez_curl'], cue: 'Per dumbbell. Elbows still, 2 s down.' },
  cable_curl:      { name: 'Cable curl', muscle: 'biceps', type: 'iso', reps: [10, 12], inc: 2.5, alts: ['db_curl', 'ez_curl'], cue: 'Elbows pinned, full squeeze.' },
  ez_curl:         { name: 'EZ bar curl', muscle: 'biceps', type: 'iso', reps: [8, 12], inc: 2.5, alts: ['db_curl', 'cable_curl'], cue: 'Total bar weight. No hip swing.' },
  hammer_curl:     { name: 'Hammer curl', muscle: 'biceps', type: 'iso', reps: [10, 12], inc: 1, alts: ['db_curl'], cue: 'Per dumbbell, thumbs up.' },

  // ---- Legs ----
  leg_press:       { name: 'Leg press', muscle: 'quads', type: 'compound', heavy: true, reps: [10, 15], inc: 5, alts: ['hack_squat', 'goblet_squat', 'squat'], cue: 'Plates added (both sides). Lower until the hips start to tuck, never lock the knees.' },
  hack_squat:      { name: 'Hack squat', muscle: 'quads', type: 'compound', heavy: true, reps: [8, 12], inc: 5, alts: ['leg_press', 'squat'], cue: 'Plates added. Full depth you can control.' },
  goblet_squat:    { name: 'Goblet squat', muscle: 'quads', type: 'compound', reps: [10, 15], inc: 2, alts: ['leg_press'], cue: 'One dumbbell at the chest, sit between the heels.' },
  squat:           { name: 'Barbell back squat', muscle: 'quads', type: 'compound', heavy: true, reps: [6, 10], inc: 2.5, alts: ['leg_press', 'hack_squat'], cue: 'Total bar weight. Use the safety pins.' },
  rdl:             { name: 'Romanian deadlift', muscle: 'hamstrings', type: 'compound', heavy: true, reps: [8, 12], inc: 2.5, alts: ['db_rdl'], cue: 'Total bar weight. Hips back, bar close to the legs, stop when the back wants to round.' },
  db_rdl:          { name: 'Dumbbell Romanian deadlift', muscle: 'hamstrings', type: 'compound', heavy: true, reps: [8, 12], inc: 2, alts: ['rdl'], cue: 'Per dumbbell. Hips back, flat back.' },
  leg_ext:         { name: 'Leg extension', muscle: 'quads', type: 'iso', reps: [12, 15], inc: 2.5, alts: [], cue: 'Pause for a second at the top.' },
  leg_curl:        { name: 'Leg curl (seated or lying)', muscle: 'hamstrings', type: 'iso', reps: [10, 15], inc: 2.5, alts: [], cue: 'Hips pressed down, slow on the way back.' },
  split_squat:     { name: 'Bulgarian split squat', muscle: 'glutes', type: 'compound', reps: [8, 12], inc: 2, alts: ['lunge'], cue: 'Per dumbbell, per leg. Rear foot on a bench.' },
  lunge:           { name: 'Walking lunge', muscle: 'glutes', type: 'compound', reps: [10, 12], inc: 2, alts: ['split_squat'], cue: 'Per dumbbell. Reps per leg.' },
  hip_thrust:      { name: 'Hip thrust (barbell or machine)', muscle: 'glutes', type: 'compound', reps: [8, 12], inc: 5, alts: ['split_squat'], cue: 'Upper back on a bench, chin tucked, squeeze the glutes for a second at the top.' },
  calf_raise:      { name: 'Calf raise', muscle: 'calves', type: 'iso', reps: [10, 15], inc: 5, alts: [], cue: 'Full stretch at the bottom, 1 s pause at the top.' },
  knee_raise:      { name: 'Hanging knee raise', muscle: 'abs', type: 'iso', reps: [10, 15], inc: 0, alts: ['cable_crunch'], cue: 'Log 0 kg. Curl the pelvis up, no swinging.' },
  cable_crunch:    { name: 'Cable crunch', muscle: 'abs', type: 'iso', reps: [10, 15], inc: 2.5, alts: ['knee_raise'], cue: 'Kneel, crunch the ribs to the hips.' },
};

// Each day lists slots. `from` = first program week the slot appears.
export const DAYS = {
  push: {
    name: 'Push', focus: 'Chest, shoulders, triceps',
    slots: [
      { ex: 'incline_press', from: 1 },
      { ex: 'chest_press', from: 1 },
      { ex: 'shoulder_press', from: 1 },
      { ex: 'cable_lateral', from: 1 },
      { ex: 'pushdown', from: 1 },
      { ex: 'pec_deck', from: 3 },
      { ex: 'oh_triceps', from: 3 },
    ],
  },
  pull: {
    name: 'Pull', focus: 'Back, rear delts, biceps',
    slots: [
      { ex: 'lat_pulldown', from: 1 },
      { ex: 'cable_row', from: 1 },
      { ex: 'db_row', from: 1 },
      { ex: 'face_pull', from: 1 },
      { ex: 'db_curl', from: 1 },
      { ex: 'straight_arm', from: 3 },
      { ex: 'hammer_curl', from: 3 },
    ],
  },
  legs: {
    name: 'Legs', focus: 'Quads, hamstrings, glutes, calves, abs',
    slots: [
      { ex: 'leg_press', from: 1 },
      { ex: 'rdl', from: 1 },
      { ex: 'leg_ext', from: 1 },
      { ex: 'leg_curl', from: 1 },
      { ex: 'calf_raise', from: 1 },
      { ex: 'split_squat', from: 3 },
      { ex: 'knee_raise', from: 1 },
    ],
  },
  upper: {
    name: 'Upper', focus: 'Chest, back, shoulders, arms',
    slots: [
      { ex: 'flat_db', from: 1 },
      { ex: 'machine_row', from: 1 },
      { ex: 'machine_ohp', from: 1 },
      { ex: 'single_pulldown', from: 1 },
      { ex: 'db_lateral', from: 1 },
      { ex: 'cable_curl', from: 1 },
      { ex: 'oh_triceps', from: 1 },
    ],
  },
  lower: {
    name: 'Lower', focus: 'Quads, glutes, hamstrings, calves, abs',
    slots: [
      { ex: 'hack_squat', from: 1 },
      { ex: 'hip_thrust', from: 1 },
      { ex: 'leg_curl', from: 1 },
      { ex: 'lunge', from: 1 },
      { ex: 'calf_raise', from: 1 },
      { ex: 'cable_crunch', from: 1 },
    ],
  },
};

// How the next session is picked. Weeks 1-2 always use `ramp`; from week 3 the profile's schedule.
export const SCHEDULES = {
  ramp: { label: 'Push, Pull, Legs, rest', days: ['push', 'pull', 'legs'],
    next: { push: 'pull', pull: 'legs', legs: 'push', upper: 'lower', lower: 'push' }, restAfter: ['legs'] },
  five: { label: '5 days: Push, Pull, Legs, rest, Upper, Lower, rest', days: ['push', 'pull', 'legs', 'upper', 'lower'],
    next: { push: 'pull', pull: 'legs', legs: 'upper', upper: 'lower', lower: 'push' }, restAfter: ['legs', 'lower'] },
  six: { label: '6 days: Push, Pull, Legs twice, then rest', days: ['push', 'pull', 'legs'],
    next: { push: 'pull', pull: 'legs', legs: 'push', upper: 'lower', lower: 'push' }, restAfter: [], restAfterStreak: 6 },
};

// Program phases by week number (week 1 = the week of the start date).
// sets: working sets per exercise; rir: reps to leave in the tank on the last set.
export const PHASES = [
  { id: 'reentry1', name: 'Re-entry', weeks: [1, 1], sets: 2, rir: '4–5', ramp: true, sched: 'ramp',
    note: 'Light on purpose. Raise the weight each session until 10 reps feels like you had 4 more in you. No failure, no slow negatives. Legs gets 2 easy sets: the first leg day back causes most of the soreness.' },
  { id: 'reentry2', name: 'Re-entry', weeks: [2, 2], sets: 3, rir: '3', ramp: true, sched: 'ramp',
    note: 'Third set comes in. Big jumps in weight are fine while you still stop 3 reps short. Muscle memory makes this fast.' },
  { id: 'ramp', name: 'Ramp', weeks: [3, 3], sets: 3, rir: '2–3', ramp: true, sched: 'main',
    note: 'The full weekly schedule starts and extra exercises appear. Still not to failure.' },
  { id: 'build', name: 'Build', weeks: [4, 7], sets: 3, rir: '1–2', four: 1, sched: 'main',
    note: 'Real work now. Last set of compounds 1–2 reps short of failure, isolation last set to 0–1. Four sets on the first exercise.' },
  { id: 'deload', name: 'Deload + diet break', weeks: [8, 8], sets: 2, rir: '3–4', deload: true, maintenance: true, sched: 'main',
    note: 'Same weights, two sets, nothing hard. Eat at maintenance this week: hunger and training recover, and fat loss picks up after.' },
  { id: 'push', name: 'Push hard', weeks: [9, 14], sets: 3, rir: '0–2', four: 2, sched: 'main',
    note: 'Four sets on the first two exercises. Last set close to failure. This is where the visible change happens.' },
  { id: 'deload2', name: 'Deload', weeks: [15, 15], sets: 2, rir: '3–4', deload: true, sched: 'main',
    note: 'Easy week. Re-measure waist and neck, re-check calories against your new weight.' },
  { id: 'repeat', name: 'Keep going', weeks: [16, 999], sets: 3, rir: '1–2', four: 1, sched: 'main',
    note: 'If body fat is still above target, run Build, Deload and Push hard again with calories reset from your current weight.' },
];

export const MUSCLE_TARGETS = {
  // weekly working sets aimed for in Build / Push hard (direct sets, primary muscle)
  chest: [10, 16], back: [10, 16], shoulders: [8, 16], 'rear delts': [6, 10], triceps: [6, 12],
  biceps: [6, 12], quads: [10, 14], hamstrings: [6, 12], glutes: [4, 10], calves: [6, 10], abs: [4, 10],
};

// ---------- Foods ----------
// diet: v = vegetarian, e = has egg, n = non-veg. cat drives grouping and grocery list.
export const FOODS = [
  // protein, veg
  { id: 'whey', name: 'Whey protein', serving: '1 scoop (30 g)', kcal: 120, p: 24, diet: 'v', cat: 'Supplements', buy: [1, 'pc', 'Whey (scoops)'] },
  { id: 'paneer', name: 'Paneer, raw', serving: '100 g', kcal: 300, p: 19, diet: 'v', cat: 'Dairy', buy: [100, 'g', 'Paneer'] },
  { id: 'paneer_bhurji', name: 'Paneer bhurji / sabzi', serving: '100 g paneer', kcal: 360, p: 19, diet: 'v', cat: 'Dairy', buy: [100, 'g', 'Paneer'] },
  { id: 'paneer_tikka', name: 'Paneer tikka', serving: '150 g (6 pcs)', kcal: 360, p: 27, diet: 'v', cat: 'Dairy', buy: [150, 'g', 'Paneer'] },
  { id: 'lowfat_paneer', name: 'Low-fat paneer', serving: '100 g', kcal: 200, p: 22, diet: 'v', cat: 'Dairy', buy: [100, 'g', 'Low-fat paneer'] },
  { id: 'tofu', name: 'Tofu, firm', serving: '100 g', kcal: 120, p: 13, diet: 'v', cat: 'Protein', buy: [100, 'g', 'Tofu'] },
  { id: 'soya', name: 'Soya chunks, cooked', serving: '50 g dry', kcal: 175, p: 26, diet: 'v', cat: 'Protein', buy: [50, 'g', 'Soya chunks (dry)'], prep: 'Soya chunks: boil 3 days’ worth for 10 min, squeeze dry, fridge in a box.' },
  { id: 'soya_curry', name: 'Soya chunk sabzi', serving: '50 g dry', kcal: 250, p: 26, diet: 'v', cat: 'Protein', buy: [50, 'g', 'Soya chunks (dry)'], prep: 'Soya chunks: boil 3 days’ worth for 10 min, squeeze dry, fridge in a box.' },
  { id: 'curd', name: 'Curd (dahi)', serving: '1 katori (150 g)', kcal: 95, p: 5, diet: 'v', cat: 'Dairy', buy: [150, 'g', 'Curd'] },
  { id: 'hung_curd', name: 'Hung curd / Greek yogurt', serving: '150 g', kcal: 140, p: 13, diet: 'v', cat: 'Dairy', buy: [300, 'g', 'Curd'], prep: 'Hung curd: tie 1 kg curd in muslin overnight in the fridge → about 500 g.' },
  { id: 'milk', name: 'Milk, toned', serving: '250 ml', kcal: 145, p: 8, diet: 'v', cat: 'Dairy', buy: [250, 'ml', 'Milk'] },
  { id: 'chaas', name: 'Chaas (buttermilk)', serving: '250 ml', kcal: 40, p: 2, diet: 'v', cat: 'Dairy', buy: [100, 'g', 'Curd'] },
  { id: 'dal', name: 'Dal (toor/moong/masoor)', serving: '1 katori (30 g dry)', kcal: 150, p: 7, diet: 'v', cat: 'Pulses', buy: [30, 'g', 'Dal (toor/moong/masoor)'], prep: 'Dal: pressure-cook 2 days at a time.' },
  { id: 'chana', name: 'Chole / chana', serving: '1 katori (50 g dry)', kcal: 200, p: 9, diet: 'v', cat: 'Pulses', buy: [50, 'g', 'Chana (dry)'], prep: 'Chana/rajma: soak overnight, pressure-cook a batch, fridge 3 days.' },
  { id: 'rajma', name: 'Rajma', serving: '1 katori (50 g dry)', kcal: 200, p: 10, diet: 'v', cat: 'Pulses', buy: [50, 'g', 'Rajma (dry)'], prep: 'Chana/rajma: soak overnight, pressure-cook a batch, fridge 3 days.' },
  { id: 'sprouts', name: 'Sprouts chaat (moong)', serving: '1 bowl (40 g dry)', kcal: 140, p: 9, diet: 'v', cat: 'Pulses', buy: [40, 'g', 'Whole moong (for sprouts)'], prep: 'Sprouts: soak whole moong 8 h, drain, keep in a cloth 1–2 days.' },
  { id: 'roasted_chana', name: 'Roasted chana', serving: '30 g', kcal: 110, p: 6, diet: 'v', cat: 'Snacks', buy: [30, 'g', 'Roasted chana'] },
  { id: 'peanuts', name: 'Peanuts, roasted', serving: '30 g', kcal: 170, p: 7, diet: 'v', cat: 'Snacks', buy: [30, 'g', 'Peanuts'] },
  { id: 'besan_chilla', name: 'Besan chilla', serving: '2 (60 g besan)', kcal: 290, p: 13, diet: 'v', cat: 'Breakfast', buy: [60, 'g', 'Besan'] },
  { id: 'moong_chilla', name: 'Moong dal chilla', serving: '2 (60 g dal)', kcal: 260, p: 14, diet: 'v', cat: 'Breakfast', buy: [60, 'g', 'Moong dal (yellow)'], prep: 'Moong chilla batter: soak moong dal overnight, grind, fridge 2 days.' },
  { id: 'protein_bar', name: 'Protein bar', serving: '1 bar', kcal: 200, p: 20, diet: 'v', cat: 'Supplements', buy: [1, 'pc', 'Protein bars'] },
  // egg
  { id: 'egg', name: 'Egg, boiled', serving: '1 large', kcal: 70, p: 6.5, diet: 'e', cat: 'Eggs', buy: [1, 'pc', 'Eggs'], prep: 'Eggs: boil a dozen, keep peeled in a box, use within 5 days.' },
  { id: 'egg_white', name: 'Egg white', serving: '1 egg', kcal: 15, p: 3.5, diet: 'e', cat: 'Eggs', buy: [1, 'pc', 'Eggs'] },
  { id: 'omelette', name: 'Omelette / bhurji', serving: '2 eggs', kcal: 190, p: 13, diet: 'e', cat: 'Eggs', buy: [2, 'pc', 'Eggs'] },
  // non-veg
  { id: 'chicken', name: 'Chicken breast, cooked', serving: '100 g', kcal: 165, p: 31, diet: 'n', cat: 'Meat & fish', buy: [130, 'g', 'Chicken breast'], prep: 'Chicken: marinate 1 kg breast, grill or pressure-cook, portion into boxes (fridge 3–4 days).' },
  { id: 'chicken_curry', name: 'Chicken curry', serving: '1 bowl (150 g chicken)', kcal: 320, p: 32, diet: 'n', cat: 'Meat & fish', buy: [150, 'g', 'Chicken'] },
  { id: 'tandoori', name: 'Tandoori chicken', serving: '2 leg pieces', kcal: 260, p: 28, diet: 'n', cat: 'Meat & fish', buy: [250, 'g', 'Chicken legs'] },
  { id: 'fish', name: 'Fish curry / grilled fish', serving: '100 g fish', kcal: 170, p: 20, diet: 'n', cat: 'Meat & fish', buy: [120, 'g', 'Fish'] },
  { id: 'tuna', name: 'Tuna, canned in water', serving: '100 g', kcal: 115, p: 25, diet: 'n', cat: 'Meat & fish', buy: [100, 'g', 'Tuna (canned)'] },
  // staples
  { id: 'roti', name: 'Roti / chapati', serving: '1 medium', kcal: 100, p: 3, diet: 'v', cat: 'Grains', buy: [30, 'g', 'Atta'] },
  { id: 'rice', name: 'Rice, cooked', serving: '1 cup (150 g)', kcal: 200, p: 4.5, diet: 'v', cat: 'Grains', buy: [50, 'g', 'Rice'] },
  { id: 'poha', name: 'Poha', serving: '1 plate', kcal: 250, p: 5, diet: 'v', cat: 'Breakfast', buy: [50, 'g', 'Poha'] },
  { id: 'upma', name: 'Upma', serving: '1 plate', kcal: 250, p: 6, diet: 'v', cat: 'Breakfast', buy: [50, 'g', 'Rava'] },
  { id: 'idli', name: 'Idli', serving: '2 pieces', kcal: 120, p: 4, diet: 'v', cat: 'Breakfast', buy: [100, 'g', 'Idli/dosa batter'] },
  { id: 'dosa', name: 'Dosa, plain', serving: '1', kcal: 180, p: 5, diet: 'v', cat: 'Breakfast', buy: [80, 'g', 'Idli/dosa batter'] },
  { id: 'sambar', name: 'Sambar', serving: '1 katori', kcal: 120, p: 5, diet: 'v', cat: 'Pulses', buy: [20, 'g', 'Dal (toor/moong/masoor)'] },
  { id: 'bread', name: 'Brown bread', serving: '2 slices', kcal: 140, p: 6, diet: 'v', cat: 'Grains', buy: [2, 'pc', 'Brown bread (slices)'] },
  { id: 'oats', name: 'Oats (with water)', serving: '40 g', kcal: 150, p: 5, diet: 'v', cat: 'Grains', buy: [40, 'g', 'Oats'] },
  { id: 'khichdi', name: 'Dal khichdi', serving: '1 plate', kcal: 300, p: 11, diet: 'v', cat: 'Grains', buy: [70, 'g', 'Rice + dal'] },
  { id: 'sabzi', name: 'Green sabzi', serving: '1 katori', kcal: 100, p: 3, diet: 'v', cat: 'Vegetables', buy: [150, 'g', 'Green vegetables'] },
  { id: 'aloo_sabzi', name: 'Aloo sabzi', serving: '1 katori', kcal: 160, p: 3, diet: 'v', cat: 'Vegetables', buy: [150, 'g', 'Potatoes'] },
  { id: 'salad', name: 'Salad (cucumber, onion, tomato)', serving: '1 bowl', kcal: 40, p: 2, diet: 'v', cat: 'Vegetables', buy: [200, 'g', 'Salad veg'], prep: 'Salad: chop 3 days of cucumber, carrot, onion into boxes.' },
  { id: 'banana', name: 'Banana', serving: '1', kcal: 105, p: 1, diet: 'v', cat: 'Fruit', buy: [1, 'pc', 'Bananas'] },
  { id: 'apple', name: 'Apple / guava / orange', serving: '1', kcal: 90, p: 1, diet: 'v', cat: 'Fruit', buy: [1, 'pc', 'Fruit'] },
  { id: 'ghee', name: 'Ghee / oil', serving: '1 tsp', kcal: 45, p: 0, diet: 'v', cat: 'Other', buy: [5, 'g', 'Ghee/oil'] },
  { id: 'tea', name: 'Chai with milk and sugar', serving: '1 cup', kcal: 80, p: 2, diet: 'v', cat: 'Drinks', buy: null },
  { id: 'coffee', name: 'Coffee with milk', serving: '1 cup', kcal: 80, p: 3, diet: 'v', cat: 'Drinks', buy: null },
  // eating out
  { id: 'samosa', name: 'Samosa', serving: '1', kcal: 260, p: 4, diet: 'v', cat: 'Outside', buy: null },
  { id: 'vada_pav', name: 'Vada pav', serving: '1', kcal: 300, p: 7, diet: 'v', cat: 'Outside', buy: null },
  { id: 'pav_bhaji', name: 'Pav bhaji', serving: '1 plate (2 pav)', kcal: 500, p: 12, diet: 'v', cat: 'Outside', buy: null },
  { id: 'biryani_veg', name: 'Veg biryani', serving: '1 plate', kcal: 450, p: 10, diet: 'v', cat: 'Outside', buy: null },
  { id: 'biryani_chicken', name: 'Chicken biryani', serving: '1 plate', kcal: 600, p: 30, diet: 'n', cat: 'Outside', buy: null },
  { id: 'pizza', name: 'Pizza', serving: '1 slice', kcal: 280, p: 12, diet: 'v', cat: 'Outside', buy: null },
  { id: 'sweet', name: 'Indian sweet', serving: '1 piece', kcal: 150, p: 2, diet: 'v', cat: 'Outside', buy: null },
  { id: 'biscuits', name: 'Biscuits', serving: '4', kcal: 120, p: 2, diet: 'v', cat: 'Outside', buy: null },
  { id: 'beer', name: 'Beer', serving: '330 ml', kcal: 150, p: 1, diet: 'v', cat: 'Outside', buy: null },
];

export const MEALS = ['Breakfast', 'Post-workout', 'Lunch', 'Snack', 'Dinner'];

// Default day templates, about 2,150 kcal and 145–165 g protein, in 4–5 protein feeds. Edit in Food → Day plan.
export const MEAL_TEMPLATES = {
  egg: {
    Breakfast: [['omelette', 1], ['egg_white', 2], ['roti', 1], ['tea', 1]],
    'Post-workout': [['whey', 1], ['milk', 1]],
    Lunch: [['roti', 2], ['dal', 1], ['soya_curry', 1], ['curd', 1], ['salad', 1]],
    Snack: [['roasted_chana', 1]],
    Dinner: [['roti', 1], ['paneer_bhurji', 1], ['hung_curd', 1], ['salad', 1]],
  },
  veg: {
    Breakfast: [['moong_chilla', 1], ['hung_curd', 1], ['tea', 1]],
    'Post-workout': [['whey', 1], ['milk', 1]],
    Lunch: [['roti', 2], ['dal', 1], ['soya_curry', 1], ['salad', 1]],
    Snack: [['roasted_chana', 1]],
    Dinner: [['roti', 1], ['paneer_bhurji', 1], ['hung_curd', 1], ['salad', 1]],
  },
  nonveg: {
    Breakfast: [['omelette', 1], ['egg_white', 2], ['roti', 1], ['tea', 1]],
    'Post-workout': [['whey', 1], ['milk', 1]],
    Lunch: [['roti', 2], ['dal', 1], ['chicken', 1.5], ['curd', 1], ['salad', 1]],
    Snack: [['roasted_chana', 1]],
    Dinner: [['rice', 1], ['soya_curry', 1], ['hung_curd', 1], ['salad', 1]],
  },
};

export const HABITS = [
  { id: 'creatine', label: 'Creatine 5 g' },
  { id: 'whey', label: 'Whey shake' },
  { id: 'eggs', label: 'Eggs / protein breakfast' },
  { id: 'caffeine', label: 'No caffeine after 3 pm' },
  { id: 'screens', label: 'Screens off 30 min before bed' },
];
