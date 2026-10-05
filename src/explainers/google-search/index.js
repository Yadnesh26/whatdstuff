import { defineExplainer } from '../../framework/index.js';
import { win } from '../../framework/motion.js';
import meta from './meta.js';
import { buildGoogleSearch } from './model.js';

// Every step loops while active: `phase` sweeps 0 -> 1 once per lap. Crawler
// tours, vote particles and rack LEDs advance whole cycles per lap; every
// one-shot event (typing, a query's round trip, a page being filed, rows
// sorting) rises and falls back to its start inside the lap. So the wrap pose
// is the start pose, always.

// The full resting state. Every onEnter pins ALL of it, so no step inherits
// another's mid-lap leftovers.
const REST = {
  crawl: 1, tours: 1, typed: 1, caret: 0, query: -1, results: 1,
  file: -1, filed: 1, newGlow: 0, lookup: 0, scan: 0, scanShow: 0, lit: 0,
  votes: 0, voteLaps: 3, rank: 0, score: 0, sort: 0, legend: 0, shard: 0.4, signs: 1,
};

const span = (u, a, b) => (u >= a && u <= b ? (u - a) / (b - a) : -1);

// one search, start to finish: type, fly out, fan out, merge, land
function searchCycle(u) {
  return {
    typed: win(u, 0.02, 0.13) * (1 - win(u, 0.92, 0.98)),
    caret: u < 0.15 || u > 0.97 ? 1 : 0,
    query: span(u, 0.14, 0.5),
    results: win(u, 0.5, 0.58) * (1 - win(u, 0.9, 0.97)),
  };
}

function run(duration, pose) {
  return ({ tl, handles }) => {
    const s = { t: 0 };
    tl.add(s, {
      t: 1,
      duration,
      ease: 'linear',
      onUpdate: () => handles.set({ phase: s.t, ...pose(s.t) }),
    });
  };
}

function pin(handles, extra, labels) {
  handles.set({ ...REST, phase: 0, ...extra });
  handles.setLabels(labels);
}

export default defineExplainer({
  ...meta,

  buildScene({ scene }) {
    return buildGoogleSearch({ scene });
  },

  steps: [
    {
      id: 'overview',
      heading: '1 · Ten answers in a fifth of a second',
      body: 'Type how do bees make honey and press Enter. Before your finger has left the key, the answers are on the screen, picked from hundreds of billions of pages. Nothing could read that many pages in a fifth of a second, so Google never tries. Everything on this table is how it gets away with that: a web of pages on the left, a giant index in the middle, a row of servers, and your screen.',
      hint: 'Drag to orbit. Amber is your question travelling.',
      camera: { position: [-6.96, 6.45, 21.56], target: [-5.42, 1.76, -0.32] },
      focus: ['Your screen'],
      onEnter: ({ handles }) => pin(handles, searchCycle(0), 'overview'),
      timeline: run(9000, searchCycle),
    },
    {
      id: 'crawl',
      heading: '2 · The reading happened before you asked',
      body: 'Google runs programs called crawlers, nicknamed spiders, that never stop walking the web. One lands on a page, saves a copy, reads the links on it, and follows one to the next page. Then it does it again. Every copy goes home to Google, where the next step files it. So when you search, Google is not out on the internet at all. It is looking through the copy it already brought back.',
      hint: 'Google says its copy of the web is over 100 million gigabytes.',
      camera: { position: [-4.02, 2.61, 6.44], target: [-5.66, 1.91, -0.24] },
      focus: ['Crawler, a "spider"'],
      onEnter: ({ handles }) => pin(handles, {}, 'crawl'),
      timeline: run(8000, () => ({})),
    },
    {
      id: 'index',
      heading: '3 · Filed like the index at the back of a book',
      body: 'Each copy is broken into its words, and every word has one line in a giant index, the same trick as the index at the back of a textbook. Page 18 says bees, honey, hive, make and nectar, so the number 18 is written onto those five lines. Not the page, just its number. Every line keeps its numbers in order, smallest first. This is the slow, expensive work, and it is all done before anyone searches.',
      camera: { position: [-1.1, 2.37, 5.7], target: [-2.05, 1.77, -0.57] },
      focus: ['Page 18 filed here'],
      onEnter: ({ handles }) => pin(handles, { crawl: 0, file: 0, filed: 0 }, 'index'),
      timeline: run(7000, (u) => ({
        file: u,
        filed: win(u, 0.52, 0.6) * (1 - win(u, 0.9, 0.98)),
        newGlow: 0.9 * win(u, 0.52, 0.6) * (1 - win(u, 0.72, 0.86)),
      })),
    },
    {
      id: 'lookup',
      heading: '4 · Answering without opening a single page',
      body: 'Now your question arrives, and Google still does not open any page. It pulls out two lines: every page that says bees, and every page that says honey. Then it runs along both at once, like two fingers on two lists. A number that sits on both lines is a page with both words. Here that is pages 7, 18, 31 and 44, found by comparing short lists of numbers, which a computer can do billions of times a second. A real search walks every word of your question this way, make included; we follow two to keep it readable.',
      camera: { position: [-0.76, 2.91, 4.55], target: [-1.35, 2.53, -0.77] },
      focus: ['On both lines = a match'],
      onEnter: ({ handles }) => pin(handles, { crawl: 0, lookup: 1, lit: 1 }, 'lookup'),
      timeline: run(7000, (u) => ({
        scan: win(u, 0.06, 0.7),
        scanShow: win(u, 0.02, 0.06) * (1 - win(u, 0.74, 0.8)),
        lit: 1 - win(u, 0.88, 0.97),
      })),
    },
    {
      id: 'shards',
      heading: '5 · A thousand machines, each with a sliver',
      body: 'The real index is far too big for one computer, so it is cut up by page number and each slice lives on its own machine. Your question is copied to every slice at the same moment. Each machine checks only its own pages and sends back its best few. The one holding pages 20 to 29 finds nothing, so it sends nothing. A front server merges the replies. Because every slice works at once, searching the whole index takes about as long as searching one slice. In 2009, Google said a single search touched about 1,000 machines and still finished in about 0.2 seconds.',
      hint: 'Five racks stand in for thousands. Each slice is also copied many times over, so millions of people can search at once.',
      camera: { position: [5.11, 3.29, 8.61], target: [1.96, 0.92, 0.29] },
      focus: ['Splits, then merges'],
      onEnter: ({ handles }) => pin(handles, { crawl: 0, shard: 1, results: 0 }, 'shards'),
      timeline: run(7000, (u) => ({
        query: span(u, 0.04, 0.86),
        results: win(u, 0.86, 0.92) * (1 - win(u, 0.95, 0.995)),
      })),
    },
    {
      id: 'links',
      heading: '6 · Every link is a vote',
      body: 'Finding pages that contain your words is the easy half. Millions of real pages say bees and honey, so which one goes first? Google started with links. Every link counts as a vote for the page it points to, and votes are weighted: a page splits its own score among its links, so a link from a page that many others link to carries more. That is PageRank. Here each page is sized by its score, worked out from exactly these links. The encyclopedia has the most links pointing in, eleven. Page 18 has only six, yet it comes out on top, because one of its six comes from the encyclopedia and two more come from bee pages, 31 and 7, that are well linked themselves.',
      camera: { position: [-4.22, 2.91, 6.17], target: [-5.78, 1.92, -0.18] },
      focus: ['Vote from a big page'],
      onEnter: ({ handles }) => pin(handles, { votes: 1, rank: 1 }, 'links'),
      timeline: run(8000, () => ({})),
    },
    {
      id: 'signals',
      heading: '7 · Hundreds of clues become one order',
      body: 'Links are only one clue. Google weighs hundreds: whether your words appear in the title and close together, whether the page means what you meant, how recently it changed, and where you are and what language you read. Each clue adds to one score, and the results are sorted by it. Watch the four matches arrive in page-number order, then slide into score order. About 15% of what people search each day has never been searched before, so this has to work on questions nobody has asked yet.',
      camera: { position: [3.34, 1.45, 2.75], target: [4.92, 1.14, 0.17] },
      focus: ['Clues add into one score'],
      onEnter: ({ handles }) => pin(handles, { crawl: 0, legend: 1, signs: 0 }, 'signals'),
      timeline: run(7000, (u) => ({
        score: win(u, 0.1, 0.4) * (1 - win(u, 0.88, 0.97)),
        sort: win(u, 0.42, 0.58) * (1 - win(u, 0.86, 0.95)),
      })),
    },
    {
      id: 'run',
      heading: '8 · Run it',
      body: 'Crawl, copy, file, look up, split, score, sort. The slow part, reading the web, was finished long before you typed. All that is left when you press Enter is looking up numbers in an index that is already sorted, and that is why it feels instant.',
      hint: 'Drag to look around.',
      camera: { position: [1.24, 3.89, 18.78], target: [-3.05, 1.55, 0.34] },
      freeOrbit: true,
      onEnter: ({ handles }) => pin(handles, searchCycle(0), false),
      timeline: run(4600, searchCycle),
    },
  ],
});
