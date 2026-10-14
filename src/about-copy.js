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
  heroLines: ['You learn by watching things happen.', 'So that’s what we build.'],
  deck:
    'Most of what we’re taught about how the world works comes as a ' +
    'paragraph and a diagram with arrows. whatDstuff builds every explainer ' +
    'from scratch in interactive 3D, from the real science, and leaves it ' +
    'running while you look.',

  intro: [
    'Ask anyone how their fridge makes cold, how a payment goes through, or ' +
      'what a heart does with each beat. Most people only half know. We were ' +
      'taught from words: a paragraph, a definition, a diagram with arrows. ' +
      'It rarely sticks, because that’s not how people learn.',
    'We learn by watching something work, one step at a time. So every ' +
      'explainer here is built from scratch in 3D, from the real science and ' +
      'checked step by step. Scroll through it, spin it around, and watch it ' +
      'run for as long as you like. No memorising and no jargon. Just the ' +
      'thing itself, working in front of you, until you get it.',
  ],

  // A glanceable proof strip. `${count}` is swapped for the live explainer
  // count by both about.js and prerender.mjs, so it can never go stale.
  stats: [
    { value: '${count}', label: 'explainers built', note: 'and counting' },
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

  ctaHeading: 'Pick one.',
  // `${count}` is filled in with the real number of explainers.
  ctaBody:
    '${count} explainers and counting: engines, the human body, cyclones, ' +
    'black holes, the internet, AI. Search for the one you want even if it ' +
    'isn’t there. A search that comes up empty gets logged, and that log is ' +
    'what we build next. Now you know.',
  ctaLabel: 'Open the library',
};

// Small helper so the client and the prerenderer fill counts identically.
export const withCount = (s, count) => s.replace('${count}', String(count));
