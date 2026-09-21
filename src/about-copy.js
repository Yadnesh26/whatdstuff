// The About page, in words.
//
// A pure data module — no imports, no DOM — so scripts/prerender.mjs can
// render the exact same copy into dist/about/index.html that about.js mounts
// on the client. One source of truth; the static page and the live page can
// never drift.
//
// Voice lives in SOUL.md. Concrete nouns, calm, no hype: the mechanism
// supplies the awe, not the adjectives.

export const about = {
  eyebrow: 'About',
  // Two lines: the first is plain (the honest, human reason), the second
  // gets the home hero's "machine out" sheen treatment (see .about-hero h1
  // em in style.css) — the craft position stated as a fact, not a slogan.
  heroLines: ['We wanted to see inside things.', 'So we started building them.'],
  deck:
    'whatDstuff is two people who got tired of diagrams that freeze the one ' +
    'instant everything has already stopped moving. Every machine here is ' +
    'built from scratch and left running while you look at it — scrolling ' +
    'through one is the closest thing to actually taking it apart.',

  intro: [
    'You already know these machines by feel: the fridge’s hum, the click a ' +
      'pen makes, the shudder a washing machine works itself into right ' +
      'before it spins. Almost nobody has seen what’s actually happening ' +
      'inside.',
    'A cutaway photo won’t show you either — it’s frozen at the one moment ' +
      'everything already stopped. So each explainer here is a small machine ' +
      'of its own: built part by part from how the real thing works, running ' +
      'the whole time you’re on the page, ready to be dragged around and ' +
      'looked at from any angle.',
  ],

  // A glanceable proof strip. `${count}` is swapped for the live explainer
  // count by both about.js and prerender.mjs, so it can never go stale.
  stats: [
    { value: '${count}', label: 'machines built', note: 'and counting' },
    { value: '0', label: 'parts imported', note: 'every gear tooth is math' },
    { value: '2', label: 'people building this', note: 'meet them in the gears, below ↓' },
  ],

  processHeading: 'How one gets built',
  process: [
    {
      no: '01',
      name: 'Read the real thing',
      body:
        'Service manuals, patents, teardown footage, spec sheets — whatever ' +
        'the manufacturer or the patent office actually wrote down. If a ' +
        'source disagrees with the story we wanted to tell, the story loses.',
    },
    {
      no: '02',
      name: 'Build every part',
      body:
        'Geometry, material, tolerance: all of it written as code, none of ' +
        'it bought or downloaded. It’s the slower way to work, and it has one ' +
        'advantage: a part we can’t construct is a part we don’t actually ' +
        'understand yet.',
    },
    {
      no: '03',
      name: 'Light it like a product shot',
      body:
        'Studio lighting, real metal and glass, filleted edges, a camera ' +
        'angle chosen for that exact step. If it still looks like a ' +
        'programmer’s demo, it isn’t done.',
    },
    {
      no: '04',
      name: 'Make it run without a seam',
      body:
        'Every loop comes back to the exact pose it started from, so there’s ' +
        'no cut to hide. The moment a seam shows, it stops looking like a ' +
        'real machine and starts looking like a trick.',
    },
    {
      no: '05',
      name: 'Check the words against the picture',
      body:
        'Last, someone reads the copy against the frame it’s sitting on. If a ' +
        'sentence says the piston is rising while it’s falling on screen, ' +
        'that counts as a bug.',
    },
  ],

  principlesHeading: 'What we won’t do',
  principles: [
    {
      title: 'Simplify it until it’s wrong',
      body:
        'If the real mechanism is stranger than the tidy version, the strange ' +
        'one wins. Your fridge doesn’t make cold — it moves heat out of ' +
        'itself, which is why the back of it is warm.',
    },
    {
      title: 'Import a single part',
      body:
        'No stock models, no marketplace assets, not once. Everything you see ' +
        'was generated from a description of the real thing.',
    },
    {
      title: 'Promise a surprise we can’t pay off',
      body:
        'A hook has to open a real question the mechanism goes on to answer. ' +
        'Anything else is a headline with nothing behind it.',
    },
  ],

  ctaHeading: 'Go open one',
  // `${count}` is filled in with the real number of machines.
  ctaBody:
    'There are ${count} machines on the bench right now, and the list is ' +
    'only that short because nobody has asked for the rest yet. Search for ' +
    'the one you want even if it isn’t there. A search that comes up empty ' +
    'gets logged, and that log is what we build next.',
  ctaLabel: 'Open the library',
};

// Small helper so the client and the prerenderer fill counts identically.
export const withCount = (s, count) => s.replace('${count}', String(count));
