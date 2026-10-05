// Editorial layer for video export (scripts/export-video.mjs).
//
// SCRIPTING: one flowing voiceover, synthesized as a single ElevenLabs take —
// the per-shot `narration` strings are just the cut points; each hands off into
// the next. Arc: hook -> stakes -> spoken question -> reveal -> BUT/THEREFORE
// mechanism -> re-hook -> isolated stat -> so-what -> callback button.
//
// PACKAGING
//   Idea:   when you press Enter, Google does not search the internet.
//   Lens:   the searching already happened; what you wait for is a lookup.
//   Loop:   "Google doesn't search the internet" planted in the hook, asked as
//           "how do you search a copy that big without reading it?", closed in
//           the button ("It happened before you asked."), which hands straight
//           back to the hook on replay.
//
// CAMERAS: every shot pins an explicit `camera`. This short hides all callouts
// (they do not survive the 9:16 crop), which leaves the framing solver an empty
// box. Poses were solved numerically against a 1080x1920 projection at 42° FOV;
// the wide subjects (web, index wall, racks) are shot OBLIQUE so they recede
// into depth instead of shrinking to a strip across a portrait frame.
//
// LOOP TIMING: a step's loop starts at phase 0 the first time it is activated.
// Step 0's question flies out ~1.3s into its lap and lands as results at ~4.5s,
// under the hook. Step 2 files page 18 at ~3.6s, under "so eighteen goes on
// both lines". Step 3's scan bar reaches the last match at ~4.9s.
//
// No em dashes anywhere: ElevenLabs renders them as dead air.

// steps: 0 overview · 1 crawl · 2 index · 3 lookup · 4 shards · 5 links
//        6 signals · 7 run
// pull a pose toward its target (k < 1 = closer)
const closer = ({ position: p, target: t }, k) => ({
  position: p.map((v, i) => +(t[i] + (v - t[i]) * k).toFixed(2)),
  target: t,
});

const SCREEN = { position: [2.84, 1.45, 4.97], target: [5.54, 0.94, 0.57] };
const WEB = closer({ position: [0.12, 2.24, 7.7], target: [-4.29, 1.58, -0.47] }, 0.88);
const WEB_TIGHT = { position: [-3.68, 2.29, 5.37], target: [-4.33, 1.9, -0.49] };
const INBOX = { position: [2.43, 2.46, 5.07], target: [-2.17, 1.7, -0.75] };
const INDEX = closer({ position: [3.85, 2.05, 6.83], target: [-0.9, 1.43, -0.74] }, 0.88);
const LOOKUP = { position: [2.82, 2.94, 4.08], target: [-0.48, 2.24, -0.95] };
const RACKS = closer({ position: [6.61, 1.83, 4.89], target: [2.97, 0.89, -0.98] }, 0.88);
const STAT = { position: [6.04, 0.3, 2.94], target: [2.97, 1.18, -0.8] };
const LINKS = closer({ position: [-8.82, 2.57, 7.83], target: [-4.47, 1.53, -0.53] }, 0.88);
const FINALE = { position: [18.84, 4.22, 10.62], target: [0.56, 0.18, -0.93] };

export default {
  hook: 'When you hit search,\nGoogle doesn’t search the internet.',

  render: {
    formats: ['short'],
    captions: true,
    captionStyle: 'bold-karaoke',
    followOverlay: { short: true },
    speed: 1.0, // channel voice at 1x; make-narration's own default is 0.9
  },

  // 9:16 — ~70s. One take, 10 spoken lines, silent cuts inside them.
  short: {
    shots: [
      // Zone 1 — the hook over the question being typed, then the machine
      {
        step: 0,
        camera: SCREEN,
        labels: [],
        narration:
          'When you hit search, Google doesn’t search the internet. It couldn’t. There are hundreds of billions of pages, and your answers show up in under a second.',
      },
      { step: 0, camera: FINALE, seconds: 2.2 },
      { step: 0, camera: RACKS, push: 0.92, seconds: 2.4 },

      // Zone 2 — stakes + the cheat: spiders copy the web in advance
      {
        step: 1,
        camera: WEB,
        labels: [],
        narration:
          'So it cheats. Long before you asked, programs called spiders crawled the web, link by link, copying every page they landed on.',
      },
      { step: 1, camera: WEB_TIGHT, push: 0.92, seconds: 2.4 },
      { step: 1, camera: WEB, orbit: -10, seconds: 2 },

      // Zone 3 — the question, over copies pouring into the index
      {
        step: 1,
        camera: INBOX,
        labels: [],
        narration: 'But how do you search a copy that big without reading it?',
      },

      // Zone 4 — the mechanism: the book index, then the two-line walk
      {
        step: 2,
        camera: INDEX,
        labels: [],
        narration:
          'You build an index, like the one at the back of a book. Every word gets a line of page numbers. Page eighteen says bees and honey, so eighteen goes on both lines.',
      },
      { step: 2, camera: INDEX, push: 0.86, seconds: 2.4 },
      {
        step: 3,
        camera: LOOKUP,
        labels: [],
        narration:
          'So your question never opens a page. Google walks the bees line and the honey line together. A number on both lines is a match.',
      },
      { step: 3, camera: LOOKUP, push: 0.8, seconds: 2.4 },

      // Re-hook — a change of scale: out to the machines
      {
        step: 4,
        camera: RACKS,
        labels: [],
        narration:
          'Here’s the part that gets me. That index is sliced across thousands of computers, and your question hits every slice at once.',
      },
      { step: 4, camera: RACKS, orbit: 14, seconds: 2.4 },

      // Zone 5 — the stat, isolated on a hard cut to the rack fronts
      {
        step: 4,
        camera: STAT,
        move: 'cut',
        labels: [],
        narration:
          'Back in 2009, one search touched about a thousand machines and finished in two tenths of a second.',
      },

      // Zone 6 — so-what: which match goes first
      {
        step: 5,
        camera: LINKS,
        labels: [],
        narration:
          'But which match goes first? Every link is a vote, and a vote from a popular page counts more.',
      },
      { step: 5, camera: WEB_TIGHT, push: 0.9, seconds: 2.2 },
      { step: 5, camera: LINKS, orbit: 10, seconds: 1.6 },
      {
        step: 6,
        camera: SCREEN,
        labels: [],
        narration: 'Hundreds of other clues add up into one score, and the best answer lands on top.',
      },
      { step: 6, camera: SCREEN, push: 0.9, seconds: 2 },

      // Zone 7 — the button closes the loop over the whole machine
      {
        step: 7,
        camera: FINALE,
        labels: [],
        narration: 'You never waited for the search. It happened before you asked.',
      },
      { step: 7, camera: SCREEN, seconds: 2.4 },
    ],
  },
};
