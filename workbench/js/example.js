/* A worked example, loaded once on first run so the workbench opens in a
   realistic state. It is marked as an example in the interface. Its entries
   show the format; check them before relying on them. */
window.TW_EXAMPLE = () => {
  const day = 86400000, t0 = Date.now() - 10 * day;
  const iso = ms => new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  return {
    v: 1, id: 'example-coding-agents', example: true,
    title: 'How reliable are AI coding agents at real software work?',
    why: 'It decides how much of my own work I hand to an agent, and which skills I keep investing in.',
    createdAt: t0, updatedAt: t0 + 9 * day,
    prior: { take: 'Impressive in demos, but I would not trust one with a multi-day task.', p: 60 },
    fields: {
      u_scope: 'In scope: agents that plan, edit code and run tools with little supervision. Out of scope: autocomplete and chat assistants. By "reliable" I mean the change passes review and tests without me rewriting it.',
      u_known: 'Both sides agree that agents finish many short, well-specified tasks, and that success drops as tasks get longer and less clearly specified.',
      u_base: 'Earlier developer tools raised output without removing the need for review. Claims of full automation in software have usually arrived later and narrower than first announced.',
      i_missing: 'Independent measurements on large private codebases. Most public numbers come from open-source repositories or from vendors.',
      c_agree: 'Short, well-specified tasks are largely handled. Checking the work is the bottleneck.'
    },
    manual: { u5: true },
    sources: [
      { id: 's1', title: 'SWE-bench Verified leaderboard', url: 'https://www.swebench.com/', claim: 'Top agents resolve a majority of a curated set of real GitHub issues.', kind: 'data', rel: 'B', stake: false, corr: true },
      { id: 's2', title: 'METR, measuring AI ability to complete long tasks (2025)', url: '', claim: 'The length of task an agent can finish half the time has been doubling roughly every seven months.', kind: 'study', rel: 'B', stake: false, corr: false },
      { id: 's3', title: 'METR, randomised trial with experienced open-source developers (2025)', url: '', claim: 'Experienced developers took about 19% longer with AI tools on their own repositories, while believing they were faster.', kind: 'study', rel: 'B', stake: false, corr: false },
      { id: 's4', title: 'Vendor launch demo', url: '', claim: 'The agent builds a complete app from a single prompt.', kind: 'promo', rel: 'D', stake: true, corr: false }
    ],
    failures: [
      { id: 'f1', what: 'Agent reports a task as done while the tests it wrote itself pass trivially.', why: 'It works toward a visible success signal and has weak checks on its own output.' },
      { id: 'f2', what: 'Loses the thread on changes that span many files and several hours.', why: 'Early decisions fall out of context and get contradicted later.' }
    ],
    assumptions: [
      { id: 'a1', text: 'Benchmark tasks resemble my day-to-day work.', status: 'shaky' },
      { id: 'a2', text: 'A passing test suite means the change is correct.', status: 'shaky' },
      { id: 'a3', text: 'Progress on short tasks carries over to long ones.', status: '' }
    ],
    positions: [
      { id: 'p1', who: 'Lab and vendor forecasts', claim: 'Agents will handle multi-day engineering work within a couple of years.', best: 'The length of task agents can complete has grown on a steady exponential for years and the trend has not bent.', track: 'Strong commercial stake in the optimistic reading.', scope: 'in' },
      { id: 'p2', who: 'Sceptical practitioners', claim: 'Agents stay unreliable on messy, long-running work for a long time.', best: 'Real work is under-specified, and errors compound over long tasks unless something catches them.', track: 'Hands-on experience, though often with earlier, weaker tools.', scope: 'in' }
    ],
    hypotheses: [
      { id: 'h1', text: 'Failures come mostly from weak verification and feedback', p: '55' },
      { id: 'h2', text: 'Failures come mostly from limits in raw model capability', p: '35' }
    ],
    evidence: [
      { id: 'e1', text: 'Agents do much better when a test suite or checker exists', from: '', marks: { h1: 'c', h2: 'n' } },
      { id: 'e2', text: 'Success falls as tasks get longer', from: '', marks: { h1: 'c', h2: 'c' } },
      { id: 'e3', text: 'The same model scores very differently depending on the harness around it', from: '', marks: { h1: 'c', h2: 'i' } },
      { id: 'e4', text: 'Newer models improve on an unchanged harness', from: '', marks: { h1: 'n', h2: 'c' } }
    ],
    tests: [
      { id: 't1', claim: 'Agents can complete a routine dependency upgrade unaided.', method: 'Give an agent three upgrade tickets from my backlog and review each diff.', expect: 'If true, at least two of three merge without my edits. If not, I rewrite most of each one.', result: '', match: '', learned: '' }
    ],
    signposts: [
      { id: 'g1', text: 'If a new model handles multi-day tasks on an unchanged harness, verification is not the bottleneck.', seen: false },
      { id: 'g2', text: 'If independent studies on private codebases still show no speed-up for experienced developers a year from now, I lower my confidence.', seen: false }
    ],
    sessions: [
      { id: 'x1', at: t0 + 1 * day, stage: 'understand', src: 'Talk by an AI researcher on coding agents', url: '',
        obs: 'Coding agents can complete some well-specified programming tasks but struggle with certain complex, long-running workflows.',
        exp: 'Success depends on context, feedback quality, tooling, and the ability to detect and recover from mistakes.',
        pred: 'Agents will become reliable at a broader range of development tasks as their verification and planning systems improve, though full project autonomy may remain uneven.' },
      { id: 'x2', at: t0 + 5 * day, stage: 'investigate', src: 'Example: a small trial on your own code', url: '',
        obs: 'The agent finished a small migration in one pass but removed two edge-case tests along the way.',
        exp: 'Nothing in its loop required the old tests to keep passing, so deleting them looked like progress.',
        pred: 'With a rule that existing tests may not be deleted, the same task will pass review without my edits.' }
    ],
    predictions: [
      { id: 'r1', text: 'Agents will become reliable at a broader range of development tasks as their verification and planning systems improve, though full project autonomy may remain uneven.', p: 70, due: iso(Date.now() + 270 * day), createdAt: t0 + 1 * day, outcome: '', resolvedAt: 0, sessionId: 'x1' },
      { id: 'r2', text: 'With a rule that existing tests may not be deleted, the same task will pass review without my edits.', p: 60, due: iso(Date.now() + 14 * day), createdAt: t0 + 5 * day, outcome: '', resolvedAt: 0, sessionId: 'x2' }
    ],
    confLog: [
      { id: 'c1', at: t0 + 4 * day, p: 55, note: 'The slowdown trial made me doubt the vendor numbers.' },
      { id: 'c2', at: t0 + 8 * day, p: 65, note: 'Evidence on checkers and harnesses fits the verification explanation better.' }
    ],
    thesis: {
      statement: 'Coding agents are dependable today for short, well-specified tasks that come with a checker, and unreliable for long or loosely specified work. The gap closes mainly as verification improves.',
      p: 65,
      reasons: ['Agents do far better where a test suite or checker exists.', 'Independent trials show smaller gains than vendor demos.', 'The length of task agents handle keeps growing on a steady trend.'],
      objection: 'Model capability alone may close the gap and make tooling beside the point.',
      answer: 'Possible. One of my signposts watches for exactly that.',
      strength: 'moderate', basis: 'Two independent studies and one public benchmark. Nothing yet from large private codebases.',
      reviewOn: iso(Date.now() + 90 * day)
    }
  };
};
