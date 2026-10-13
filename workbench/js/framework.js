/* ================================================================
   Thesis Workbench: the framework.

   Everything a niche version would change lives in this file: the
   stages, their prompts, their exit checks, the rating scales, and
   the method notes shown on the process page. The app (app.js) and
   the process page (process.js) both read it from window.TW.
   ================================================================ */
window.TW = (() => {
'use strict';

const filled = s => typeof s === 'string' && s.trim().length > 0;

const STAGES = [
  { id:'understand', out:'A scoped question, graded sources, and a base rate', name:'Understand', ask:'What is actually true today?',
    trap:'Taking one confident voice as the state of the field.',
    parts:['p:u_scope','p:u_known','p:u_base','t:sources'],
    checks:[
      {id:'u1', label:'Write the scope and define the slippery terms', ok:q=>filled(q.fields.u_scope)},
      {id:'u2', label:'Log at least three sources', ok:q=>q.sources.filter(s=>filled(s.title)).length>=3},
      {id:'u3', label:'Include one primary source: data, a study, or your own test', ok:q=>q.sources.some(s=>['firsthand','data','study','review'].includes(s.kind))},
      {id:'u4', label:'Note a base rate for cases like this one', ok:q=>filled(q.fields.u_base)},
      {id:'u5', manual:true, label:'I could explain where things stand today to a friend, without notes'},
    ]},
  { id:'investigate', out:'Failure cases, rated assumptions, and a list of missing evidence', name:'Investigate', ask:'Where does it fail, and why?',
    trap:'Collecting only the evidence that agrees with you.',
    parts:['t:failures','t:assumptions','p:i_missing'],
    checks:[
      {id:'i1', label:'Record two cases where it failed or did not hold', ok:q=>q.failures.filter(f=>filled(f.what)).length>=2},
      {id:'i2', label:'List three assumptions and rate each one', ok:q=>q.assumptions.filter(a=>filled(a.text)&&a.status).length>=3},
      {id:'i3', label:'Say what evidence is missing', ok:q=>filled(q.fields.i_missing)},
      {id:'i4', manual:true, label:'I searched for evidence against my gut take, not only for it'},
    ]},
  { id:'compare', out:'Each side\u2019s best case, the crux, and explanations ranked by conflicts', name:'Compare', ask:'What do different experts predict?',
    trap:'Adopting the conclusion of whoever you heard last, or like most.',
    parts:['t:positions','p:c_agree','p:c_crux','t:matrix'],
    checks:[
      {id:'c1', label:'Lay out two positions that disagree, each with its strongest argument', ok:q=>q.positions.filter(p=>filled(p.who)&&filled(p.claim)&&filled(p.best)).length>=2},
      {id:'c2', label:'Name the crux of the disagreement', ok:q=>filled(q.fields.c_crux)},
      {id:'c3', label:'Weigh two explanations against three pieces of evidence', ok:q=>{const H=q.hypotheses.filter(h=>filled(h.text)); return H.length>=2 && q.evidence.filter(e=>filled(e.text)&&H.every(h=>e.marks[h.id])).length>=3;}},
      {id:'c4', manual:true, label:'Each side would say I described their view fairly'},
    ]},
  { id:'experiment', out:'A test whose expected result you wrote down first', name:'Experiment', ask:'Can I test their claims myself?',
    trap:'Deciding what the result means after you have seen it.',
    parts:['t:tests'],
    checks:[
      {id:'e1', label:'Plan one test and write what you expect before running it', ok:q=>q.tests.some(t=>filled(t.claim)&&filled(t.expect))},
      {id:'e2', label:'Run a test and record the result', ok:q=>q.tests.some(t=>filled(t.result))},
      {id:'e3', label:'Mark whether the result matched your expectation', ok:q=>q.tests.some(t=>filled(t.result)&&t.match)},
    ]},
  { id:'thesis', out:'A statement, a confidence number, kill criteria, and dated predictions', name:'Thesis', ask:'What do I believe, how confident am I, and what would change my mind?',
    trap:'Holding a view that has no way to be wrong.',
    parts:['t:prior','t:statement','t:confidence','t:strength','t:reasons','t:objection','t:signposts','t:predictions','p:t_variant','p:t_premortem','t:review','t:card'],
    checks:[
      {id:'t1', label:'State your thesis in one or two sentences', ok:q=>filled(q.thesis.statement)},
      {id:'t2', label:'Log your confidence with a reason', ok:q=>q.confLog.length>=1},
      {id:'t3', label:'Answer the strongest objection', ok:q=>filled(q.thesis.objection)&&filled(q.thesis.answer)},
      {id:'t4', label:'List two things that would change your mind', ok:q=>q.signposts.filter(s=>filled(s.text)).length>=2},
      {id:'t5', label:'Make one dated prediction with a probability', ok:q=>q.predictions.some(p=>filled(p.text)&&p.due)},
      {id:'t6', label:'Set a date to review this thesis', ok:q=>!!q.thesis.reviewOn},
    ]},
];

const PROMPTS = {
  u_scope:{label:'Scope and terms', help:'What exactly is inside this question, and what is out? Pin down any word people use loosely.', ph:'In scope: …   Out of scope: …   By "reliable" I mean …'},
  u_known:{label:'What is established', help:'Facts that supporters and sceptics would both accept.', ph:'Both sides agree that …'},
  u_base:{label:'Base rate', help:'Before the specifics: how have things like this usually turned out? Name what you are comparing it to.', ph:'Of comparable cases, roughly … turned out as claimed. I am comparing it to …'},
  i_missing:{label:'Missing evidence', help:'If the popular claim were true, what should you be seeing that you are not?', ph:'I would expect to see … and I have not found it.'},
  c_agree:{label:'Where they agree', help:'Common ground narrows the real dispute.', ph:'Everyone accepts that …'},
  c_crux:{label:'The crux', help:'Which single fact, if settled, would move one side toward the other?', ph:'They split on whether …'},
  t_variant:{label:'Where you differ from the common view', help:'If you disagree with most informed people, say what you think they are missing. If you agree, say so.', ph:'Most people think … I think … because …'},
  t_premortem:{label:'Pre-mortem', help:'It is a year from now and this thesis turned out wrong. What is the most likely reason?', ph:'I was wrong because …'},
};

/* Likelihood words follow the US intelligence community standard (ICD 203). */
const BANDS = [[5,'Almost no chance'],[20,'Very unlikely'],[45,'Unlikely'],[55,'Roughly even odds'],[80,'Likely'],[95,'Very likely'],[100,'Almost certain']];
const band = p => (BANDS.find(b => p <= b[0]) || BANDS[BANDS.length-1])[1];

const SOURCE_KINDS = [
  ['firsthand','I tested or saw it myself'],
  ['data','Primary data or original record'],
  ['study','Peer-reviewed or audited study'],
  ['review','Systematic review of many studies'],
  ['expert','Expert opinion'],
  ['report','Journalism or secondhand report'],
  ['promo','Marketing or advocacy'],
];
/* Source reliability letters follow the NATO "Admiralty" grading. */
const RELIABILITY = [['A','A · Completely reliable'],['B','B · Usually reliable'],['C','C · Fairly reliable'],['D','D · Not usually reliable'],['E','E · Unreliable'],['F','F · Cannot be judged yet']];

/* The four traditions the methods are borrowed from. */
const TRADITIONS = [['sci','Science and philosophy'],['intel','Intelligence analysis'],['fore','Forecasting'],['inv','Investing and decision practice']];

const METHOD = [
  { stage:'Understand', rows:[
    {m:'Outside view', trad:'fore', from:'Kahneman and Tversky; Flyvbjerg', url:'https://arxiv.org/pdf/1302.3642', why:'Vivid specifics crowd out how similar cases usually end. Start from the base rate, then adjust.', here:'Base rate prompt'},
    {m:'Grade the source and the claim separately', trad:'intel', from:'NATO Admiralty system', url:'https://en.wikipedia.org/wiki/Admiralty_code', why:'A usually reliable source can pass on a doubtful claim, and an unreliable one can be right. Confirmation only counts when the second source is independent.', here:'Source log ratings'},
    {m:'Lateral reading', trad:'sci', from:'Wineburg and McGrew; Caulfield’s SIFT', url:'https://hapgood.us/2019/06/19/sift-the-four-moves/', why:'Check what others say about a source before investing time in what it says.', here:'Stake and independent-backing flags'},
    {m:'Scope before you search', trad:'sci', from:'Systematic reviews: PRISMA 2020, Cochrane', url:'https://pmc.ncbi.nlm.nih.gov/articles/PMC8005924/', why:'Deciding what counts after you have read it lets you keep only what you like.', here:'Scope and terms prompt'},
  ]},
  { stage:'Investigate', rows:[
    {m:'Key assumptions check', trad:'intel', from:'CIA Tradecraft Primer, 2009', url:'https://www.cia.gov/resources/csi/static/Tradecraft-Primer-apr09.pdf', why:'Conclusions rest on premises nobody stated. Listing them shows which ones carry the weight.', here:'Assumptions list'},
    {m:'Seek disconfirmation', trad:'sci', from:'Karl Popper', url:'https://plato.stanford.edu/entries/popper/', why:'Any view can gather supporting cases. Failed predictions are what separate one view from another.', here:'Failure cases'},
    {m:'Absence of evidence', trad:'intel', from:'Richards Heuer, 1999', url:'https://www.cia.gov/resources/csi/static/Pyschology-of-Intelligence-Analysis.pdf', why:'People weigh what is in front of them and overlook what should be there and is not.', here:'Missing evidence prompt'},
  ]},
  { stage:'Compare', rows:[
    {m:'Several working hypotheses', trad:'sci', from:'T. C. Chamberlin, 1890', url:'https://www.whoi.edu/cms/files/chamberlin65sci_72744.pdf', why:'One favourite explanation breeds attachment. Holding several keeps you impartial.', here:'Competing explanations'},
    {m:'Least evidence against', trad:'intel', from:'Richards Heuer, Analysis of Competing Hypotheses', url:'https://www.cia.gov/resources/csi/static/Pyschology-of-Intelligence-Analysis.pdf', why:'The most probable explanation is usually the one with the least evidence against it. Evidence that fits every explanation tells you nothing.', here:'Conflict tally'},
    {m:'One explanation at a time', trad:'intel', from:'Dhami and colleagues, 2024', url:'https://pmc.ncbi.nlm.nih.gov/articles/PMC11169332/', why:'In experiments, laying explanations out as rows reduced confirmation-driven choices. The standard grid, with explanations as columns, did not.', here:'Explanation cards'},
    {m:'Steelman first', trad:'sci', from:'Rapoport’s rules, as put by Dennett', url:'https://en.wikipedia.org/wiki/Rapoport%27s_rules', why:'You have not understood a view until its holder would accept your summary of it.', here:'Strongest-argument field'},
    {m:'Find the crux', trad:'inv', from:'Double Crux, Center for Applied Rationality', url:'https://www.lesswrong.com/posts/exa5kmvopeRyfJgCy/double-crux-a-strategy-for-mutual-understanding', why:'Most disputes turn on one or two factual questions. Find those and research them.', here:'Crux prompt'},
    {m:'Check the expert’s lane', trad:'sci', from:'Nathan Ballantyne, on epistemic trespassing', url:'https://ndpr.nd.edu/reviews/knowing-our-limits/', why:'Expertise in one field does not carry into the next. Note when someone is speaking outside theirs.', here:'"Is this their own field?" on each position'},
    {m:'Track records over fame', trad:'fore', from:'Tetlock; Goldman, 2001', url:'https://kutrov.web.elte.hu/tudhat/11_goldman.pdf', why:'In Tetlock’s study of 284 experts, fame went with worse forecasts. A scored record and a declared stake tell you more than confidence does.', here:'Track record and stake field'},
  ]},
  { stage:'Experiment', rows:[
    {m:'State the expectation first', trad:'sci', from:'Preregistration; Nosek and colleagues, 2018', url:'https://pmc.ncbi.nlm.nih.gov/articles/PMC5856500/', why:'Results get explained away after the fact. A recorded expectation makes surprise visible.', here:'Expectation locks once a result is logged'},
    {m:'Strong inference', trad:'sci', from:'John Platt, 1964', url:'https://pages.cs.wisc.edu/~markhill/science64_strong_inference.pdf', why:'A good test is one where the competing explanations predict different outcomes.', here:'Test planning fields'},
    {m:'Minimal-trust investigation', trad:'inv', from:'Holden Karnofsky', url:'https://www.cold-takes.com/minimal-trust-investigations/', why:'Checking one claim all the way down yourself teaches you how far to trust the rest.', here:'Your own tests'},
  ]},
  { stage:'Thesis', rows:[
    {m:'A number, with a word attached', trad:'intel', from:'Sherman Kent, 1964; ICD 203', url:'https://www.cia.gov/resources/csi/static/Words-of-Estimative-Probability.pdf', why:'"Likely" means 55% to one reader and 90% to another. A number can be scored. Across 888,328 forecasts, rounding numbers into two or three verbal buckets cost accuracy.', here:'Confidence slider and its label'},
    {m:'Update often, in small steps', trad:'fore', from:'Atanasov and colleagues, 2020', url:'https://faculty.wharton.upenn.edu/wp-content/uploads/2022/03/1-s2.0-S0749597819300949-main.pdf', why:'Superforecasters revised each forecast about five times, moving 11 points on average. Typical forecasters revised twice and moved 20.', here:'Confidence log'},
    {m:'Likelihood and evidence, rated apart', trad:'sci', from:'IPCC guidance; GRADE; ICD 203', url:'https://www.stat.berkeley.edu/users/aldous/157/Papers/ipcc_uncertainty-guidance-note.pdf', why:'How likely a claim is and how well founded it is are different questions. Merging them hides thin evidence behind a confident number.', here:'Strength of the evidence'},
    {m:'Kill criteria', trad:'inv', from:'Annie Duke', url:'https://behavioralscientist.org/annie-duke-quit-mental-models-to-help-you-cut-your-losses/', why:'Decide what would change your mind, and by when, before you are attached to the view.', here:'Change-my-mind list'},
    {m:'Pre-mortem', trad:'inv', from:'Gary Klein, 2007', url:'https://hbr.org/2007/09/performing-a-project-premortem', why:'Imagining the failure as already happened surfaces risks that optimism hides. The evidence for it is thinner than its reputation.', here:'Pre-mortem prompt'},
    {m:'Keep score', trad:'fore', from:'Brier, 1950; Good Judgment Project', url:'https://en.wikipedia.org/wiki/Brier_score', why:'Calibration improves only with feedback on dated, checkable predictions.', here:'Predictions page'},
    {m:'Record the starting view', trad:'inv', from:'Decision journals; Farnam Street', url:'https://fs.blog/decision-journal/', why:'Memory rewrites what you used to think. A dated record is the only fair comparison.', here:'Where you started'},
    {m:'Reasoning transparency', trad:'inv', from:'Open Philanthropy, now Coefficient Giving', url:'https://coefficientgiving.org/research/reasoning-transparency/', why:'Say what you believe, how sure you are, and what kind of support each claim has.', here:'Thesis card'},
  ]},
];
const EVIDENCE = [
  {t:'Structure helps less than its reputation suggests.', d:'Controlled tests of the classic competing-hypotheses grid found no gain in accuracy, and trained analysts skipped steps. Filling boxes is not thinking, so the workbench keeps the required boxes few and never picks a winner for you.', url:'https://strathprints.strath.ac.uk/69049/', src:'Dhami, Belton and Mandel, 2019'},
  {t:'Practice with feedback is what improves judgement.', d:'One hour of forecasting training improved accuracy by roughly 6 to 12% across a four-year tournament. A 2025 reanalysis questions how much of that was the training itself.', url:'https://dlab.sauder.ubc.ca/sjdm/journal/16/16511/jdm16511.html', src:'Chang and colleagues, 2016'},
  {t:'Calibration needs volume.', d:'With ten predictions in a group, the hit rate can sit nearly 30 points off from luck alone. Read your calibration chart as a sketch until you have a few dozen resolved predictions.', url:'https://en.wikipedia.org/wiki/Brier_score', src:'Binomial margin of error'},
  {t:'Entry effort is what kills a tracking habit.', d:'In a survey of 193 people who gave up self-tracking, the work of entering data was the most common reason. If you skip everything else, still log the three-line session.', url:'https://pmc.ncbi.nlm.nih.gov/articles/PMC5428074', src:'Epstein and colleagues, 2016'},
];

return { filled, STAGES, PROMPTS, BANDS, band, SOURCE_KINDS, RELIABILITY, TRADITIONS, METHOD, EVIDENCE };
})();
