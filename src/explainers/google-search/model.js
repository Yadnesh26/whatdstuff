import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { materials, rod, studioPlinth } from '../../framework/parts.js';
import { beveledBox } from '../../framework/geometry.js';
import { calloutSets } from '../../framework/callouts.js';
import { clamp01, smooth, win, TAU } from '../../framework/motion.js';

// "How Google Search works" — the whole system on one studio table, read left
// to right: a WEB of page cards joined by link threads, the INDEX WALL that
// the copies are filed into, a row of SERVER RACKS that hold that index in
// slices, and the SCREEN where the question is typed.
//
// Reference facts (Google Search Central "In-depth guide to how Google Search
// works"; google.com/search/howsearchworks; Jeff Dean, WSDM 2009 keynote;
// Brin & Page 1998):
//  - Three stages: CRAWL (Googlebot discovers URLs by following links and
//    sitemaps, fetches and renders pages), INDEX ("like the index in the back
//    of a book — an entry for every word seen on every webpage"; hundreds of
//    billions of pages, well over 100,000,000 GB, "hosted on thousands of
//    computers"), SERVE (look up the index, rank by "hundreds of factors" incl.
//    location, language, device).
//  - Inverted index: word -> POSTING LIST of document IDs, kept sorted, so a
//    two-word query is a linear walk along two sorted lists (intersection);
//    no page text is read at query time.
//  - The index is SHARDED BY DOCID (each machine holds every word, but only
//    for its own range of pages) and shards are replicated. A query fans out
//    to every shard in parallel; each returns its best few; a root merges.
//    "One query touches ~1,000 machines in ~0.2 s" (Dean, 2009).
//  - PageRank: each page splits its score evenly across its outgoing links,
//    damping 0.85. A link from a heavily linked page therefore weighs more.
//    The card sizes in the links step are this EXACT computation, run below
//    on the drawn links — nothing is hand-sized.
//  - Ranking blends hundreds of signals; we show four families: links,
//    words + meaning, freshness, the searcher's place/language.
//
// One numbering runs through the whole model: page cards carry #2..#47, the
// same numbers are the tiles on the index wall, the rack slices are ranges of
// them (0-9, 10-19 ...), and the results on the screen are four of them. Page
// 18, "How Bees Make Honey", can be followed through every step.
//
// Loop contract: everything reads one `phase` (0->1 per lap). Crawler tours,
// vote particles and LED twinkles advance WHOLE cycles per lap; one-shot
// events (a page being filed, a query fanning out, rows sorting) rise and fall
// back inside the lap, so the wrap pose is the start pose.

const DECK = 0.26;
const CRAWLER_SCALE = 1.9;
const ACCENT = 0xfbbc05;

// ---------------------------------------------------------------------------
// the little world: 20 pages, their links, 7 index lines
// ---------------------------------------------------------------------------
const PAGES = {
  2: { title: ['Encyclopedia', 'Main Page'], hue: '#7fb0ff' },
  3: { title: ['Garden', 'Pollinators'], hue: '#e58fc4' },
  5: { title: ['Volcano', 'Facts'], hue: '#e2694a' },
  7: { title: ['Honeybee', 'Facts'], hue: '#f2b33d' },
  9: { title: ['Pizza Dough', 'Basics'], hue: '#c9cf5a' },
  12: { title: ['Flowers', '& Nectar'], hue: '#e58fc4' },
  13: { title: ['Honey-Glazed', 'Pizza'], hue: '#c9cf5a' },
  17: { title: ['Pizza', 'Ovens'], hue: '#c9cf5a' },
  18: { title: ['How Bees', 'Make Honey'], hue: '#f2b33d' },
  22: { title: ['Make a', 'Volcano Model'], hue: '#e2694a' },
  25: { title: ['Inside a', 'Beehive'], hue: '#f2b33d' },
  27: { title: ['Make Pizza', 'at Home'], hue: '#c9cf5a' },
  29: { title: ['Lava', '& Magma'], hue: '#e2694a' },
  31: { title: ['Beekeeping', 'Basics'], hue: '#f2b33d' },
  34: { title: ['Volcano', 'Hikes'], hue: '#e2694a' },
  37: { title: ['The Bee', 'Dance'], hue: '#f2b33d' },
  40: { title: ['Mead:', 'Honey Wine'], hue: '#c9a07a' },
  42: { title: ['Humming-', 'birds'], hue: '#5ec9b0' },
  44: { title: ['Honey Cake', 'Recipe'], hue: '#c9a07a' },
  47: { title: ['Make', 'Bread'], hue: '#c9a07a' },
};

// grid[r][c], r = 0 bottom row
const GRID = [
  [34, 3, 42, 7, 44],
  [22, 12, 18, 31, 47],
  [29, 5, 2, 25, 37],
  [9, 17, 27, 13, 40],
];

// #18 sits just below the encyclopedia; keep it in FRONT of #2 so neither
// hides the other once the cards are sized by PageRank.
const Z_OVERRIDE = { 18: -0.2, 2: -0.6 };

// Crawler tours follow REAL outgoing links (directed), each a closed cycle.
const TOURS = [
  [34, 22, 29, 9, 17, 5, 12, 3],
  [2, 18, 31, 47, 37, 40, 13, 27],
  [18, 42, 7, 44, 31],
];
// further links, so the vote counts mean something: the encyclopedia (#2) gets
// the most links in (11), and it points at #18. #18 has only 6 links in, yet
// the computed PageRank ranks it first — one of its six is the encyclopedia's.
const EXTRA_LINKS = [
  [5, 2], [25, 2], [12, 2], [13, 2], [17, 2], [9, 2], [40, 2], [47, 2], [3, 2], [22, 2],
  [12, 18], [3, 18], [25, 18], [7, 18],
  [25, 31], [37, 25], [31, 7], [22, 3], [2, 5],
];

const WORDS = ['bees', 'honey', 'hive', 'make', 'nectar', 'pizza', 'volcano'];
const POSTINGS = {
  bees: [3, 7, 12, 18, 25, 31, 37, 44],
  honey: [7, 13, 18, 31, 40, 44],
  hive: [7, 18, 25, 31, 37],
  make: [9, 18, 22, 27, 40, 47],
  nectar: [3, 12, 18, 25, 42],
  pizza: [9, 13, 17, 27],
  volcano: [5, 22, 29, 34],
};
const FILED_PAGE = 18; // the page we watch being filed (step 3)
const MATCHES = POSTINGS.bees.filter((n) => POSTINGS.honey.includes(n)); // 7 18 31 44

const SHARD_COLORS = ['#4f9dff', '#3ddc97', '#b28dff', '#ff8f6b', '#ffd166'];
const shardOf = (n) => Math.min(4, Math.floor(n / 10));

const QUERY = 'how do bees make honey';

// other ranking clues per result (links come from the real PageRank below)
const CLUES = {
  7: { words: 0.55, fresh: 0.3, place: 0.35 },
  18: { words: 0.95, fresh: 0.5, place: 0.4 },
  31: { words: 0.5, fresh: 0.7, place: 0.45 },
  44: { words: 0.45, fresh: 0.35, place: 0.3 },
};
const CLUE_COLORS = [ACCENT, 0x6aa8ff, 0x3ddc97, 0xff7fb0];
const RESULT_TEXT = {
  7: 'Honeybee Facts',
  18: 'How Bees Make Honey',
  31: 'Beekeeping Basics',
  44: 'Honey Cake Recipe',
};

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function canvasTex(w, h, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.userData = { canvas, ctx };
  return tex;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const FONT = '"Segoe UI", system-ui, sans-serif';

// A lit screen-like face: the canvas is both colour and emission, so text
// reads under any studio angle the way a real display does.
function faceMat(map, intensity = 0.6) {
  return new THREE.MeshStandardMaterial({
    map,
    emissive: 0xffffff,
    emissiveMap: map,
    emissiveIntensity: intensity,
    roughness: 0.55,
    metalness: 0,
    transparent: true,
    depthWrite: false,
  });
}

function mix(hexA, hexB, t) {
  const a = new THREE.Color(hexA);
  const b = new THREE.Color(hexB);
  return '#' + a.lerp(b, t).getHexString();
}

function pageTexture(num) {
  const p = PAGES[num];
  return canvasTex(180, 230, (ctx, w, h) => {
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = p.hue;
    ctx.fillRect(0, 0, w, 40);
    ctx.fillStyle = '#0d1117';
    ctx.font = `700 26px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    ctx.fillText('#' + num, w - 12, 21);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#eef1f5';
    ctx.font = `700 23px ${FONT}`;
    ctx.fillText(p.title[0], 12, 66);
    ctx.fillText(p.title[1], 12, 94);
    // body copy as grey bars, one of them a blue link
    const bars = [0.86, 0.72, 0.8, 0.5, 0.78, 0.64];
    bars.forEach((bw, i) => {
      ctx.fillStyle = i === 3 ? '#8ab4f8' : '#3a4352';
      ctx.fillRect(12, 122 + i * 17, (w - 24) * bw, 8);
    });
  });
}

function textTile(text, w, h, { bg = '#171c24', fg = '#eef1f5', border = null, size = 0.6, weight = 700 } = {}) {
  return canvasTex(w, h, (ctx) => {
    roundRect(ctx, 3, 3, w - 6, h - 6, Math.min(w, h) * 0.18);
    ctx.fillStyle = bg;
    ctx.fill();
    if (border) {
      ctx.lineWidth = 5;
      ctx.strokeStyle = border;
      ctx.stroke();
    }
    ctx.fillStyle = fg;
    ctx.font = `${weight} ${Math.round(h * size)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 2);
  });
}

// Box with a canvas on its front face only (BoxGeometry group 4 = +Z).
function slab(w, h, d, tex, bodyMat, intensity = 0.6) {
  const front = faceMat(tex, intensity);
  front.transparent = false;
  front.depthWrite = true;
  const mats = [bodyMat, bodyMat, bodyMat, bodyMat, front, bodyMat];
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
  mesh.castShadow = true;
  mesh.userData.front = front;
  return mesh;
}

function pageRank(nodes, edges, d = 0.85, iters = 80) {
  const n = nodes.length;
  const idx = new Map(nodes.map((v, i) => [v, i]));
  const out = nodes.map(() => []);
  edges.forEach(([a, b]) => out[idx.get(a)].push(idx.get(b)));
  let pr = new Array(n).fill(1 / n);
  for (let k = 0; k < iters; k++) {
    const next = new Array(n).fill((1 - d) / n);
    for (let u = 0; u < n; u++) {
      if (!out[u].length) {
        for (let v = 0; v < n; v++) next[v] += (d * pr[u]) / n;
      } else {
        const share = (d * pr[u]) / out[u].length;
        out[u].forEach((v) => (next[v] += share));
      }
    }
    pr = next;
  }
  return { pr: new Map(nodes.map((v, i) => [v, pr[i]])), outDeg: new Map(nodes.map((v, i) => [v, out[i].length])) };
}

// ---------------------------------------------------------------------------
// THE WEB — 20 page cards hanging in space, joined by link threads
// ---------------------------------------------------------------------------
function buildWeb() {
  const group = new THREE.Group();
  const pages = new Map();
  const cardMat = materials.polymer(0x171a20);
  GRID.forEach((row, r) => {
    row.forEach((num, c) => {
      const pos = new THREE.Vector3(
        -5.9 + c * 0.78,
        0.98 + r * 0.66,
        Z_OVERRIDE[num] ?? -0.62 + 0.36 * Math.sin(c * 1.7 + r * 2.3),
      );
      const g = new THREE.Group();
      g.position.copy(pos);
      g.rotation.y = 0.1 * Math.sin(c * 2.1 + r);
      const body = beveledBox(0.4, 0.5, 0.03, cardMat, 0.012);
      g.add(body);
      const tex = pageTexture(num);
      const fm = faceMat(tex, 0.55);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.46), fm);
      face.position.z = 0.017;
      g.add(face);
      group.add(g);
      pages.set(num, { num, group: g, pos, tex, faceMat: fm });
    });
  });

  // links: tours + extras, deduped, directed
  const seen = new Set();
  const links = [];
  const addLink = (a, b) => {
    const k = a + '>' + b;
    if (seen.has(k)) return;
    seen.add(k);
    links.push([a, b]);
  };
  TOURS.forEach((t) => t.forEach((a, i) => addLink(a, t[(i + 1) % t.length])));
  EXTRA_LINKS.forEach(([a, b]) => addLink(a, b));

  const geos = links.map(([a, b]) => {
    const pa = pages.get(a).pos;
    const pb = pages.get(b).pos;
    return new THREE.TubeGeometry(new THREE.LineCurve3(pa, pb), 1, 0.0075, 6, false);
  });
  const threadMat = new THREE.MeshStandardMaterial({
    color: 0x6a7a90, emissive: 0x33445c, emissiveIntensity: 0.9, roughness: 0.5,
  });
  const threads = new THREE.Mesh(mergeGeometries(geos), threadMat);
  group.add(threads);

  const nodes = [...pages.keys()];
  const { pr, outDeg } = pageRank(nodes, links);
  const maxPr = Math.max(...pr.values());
  pages.forEach((p) => {
    p.pr = pr.get(p.num);
    p.rankScale = 0.62 + 0.75 * (p.pr / maxPr);
  });
  const shares = links.map(([a]) => pr.get(a) / outDeg.get(a));
  const maxShare = Math.max(...shares);

  // vote particles — 2 per link, uneven seeds (a summed hash can't cancel)
  const PER = 2;
  const voteGeo = new THREE.SphereGeometry(0.022, 10, 8);
  const voteMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(ACCENT).multiplyScalar(1.6), toneMapped: false });
  const votes = new THREE.InstancedMesh(voteGeo, voteMat, links.length * PER);
  votes.frustumCulled = false;
  group.add(votes);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sv = new THREE.Vector3();
  const pv = new THREE.Vector3();
  function setVotes(phase, amount, laps) {
    let i = 0;
    links.forEach(([a, b], li) => {
      const pa = pages.get(a).pos;
      const pb = pages.get(b).pos;
      const w = 0.5 + 1.4 * (shares[li] / maxShare);
      for (let k = 0; k < PER; k++) {
        const f = (phase * laps + k * 0.53 + li * 0.137) % 1;
        const fade = Math.min(1, f * 6) * Math.min(1, (1 - f) * 6);
        pv.lerpVectors(pa, pb, f);
        pv.z += 0.03;
        const s = amount * fade * w;
        sv.set(s, s, s);
        m4.compose(pv, q, sv);
        votes.setMatrixAt(i++, m4);
      }
    });
    votes.instanceMatrix.needsUpdate = true;
    votes.visible = amount > 0.001;
  }

  const heavy = links.findIndex(([a, b]) => a === 2 && b === 18);
  const heavyMid = new THREE.Vector3().lerpVectors(pages.get(2).pos, pages.get(18).pos, 0.5);

  return { group, pages, links, setVotes, heavyMid, heavy, threads, threadMat };
}

// ---------------------------------------------------------------------------
// CRAWLER — a small spider-bot: body, glowing eye, six legs
// ---------------------------------------------------------------------------
function buildCrawler() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshPhysicalMaterial({ color: 0xaab3c0, metalness: 0.55, roughness: 0.38, clearcoat: 0.3 });
  const legMat = new THREE.MeshPhysicalMaterial({ color: 0x3a414c, metalness: 0.5, roughness: 0.45 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.05, 18, 14), bodyMat);
  body.scale.set(1, 0.75, 1.25);
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10), bodyMat);
  head.position.set(0, 0.005, 0.065);
  g.add(head);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), materials.glow(ACCENT, 2.2));
  eye.position.set(0, 0.012, 0.09);
  g.add(eye);
  const legGeos = [];
  for (let k = 0; k < 6; k++) {
    const side = k < 3 ? -1 : 1;
    const zz = ((k % 3) - 1) * 0.035;
    // upper leg out and up, lower leg down: a bent spider leg
    const up = new THREE.CylinderGeometry(0.005, 0.005, 0.07, 5);
    up.rotateZ(side * 1.05);
    up.translate(side * 0.055, 0.02, zz);
    const lo = new THREE.CylinderGeometry(0.0045, 0.003, 0.08, 5);
    lo.rotateZ(-side * 0.35);
    lo.translate(side * 0.1, -0.02, zz * 1.4);
    legGeos.push(up, lo);
  }
  const legs = new THREE.Mesh(mergeGeometries(legGeos), legMat);
  g.add(legs);
  return { group: g, eye, legs };
}

// ---------------------------------------------------------------------------
// THE INDEX WALL — one line per word, page-number tiles on a number line
// ---------------------------------------------------------------------------
const WX = -0.62;
const WZ = -0.95;
const rowY = (r) => 2.78 - r * 0.335;
const numX = (n) => -1.36 + (n - 1) * 0.0455;
const TILE_Z = WZ + 0.07;

function buildIndexWall() {
  const group = new THREE.Group();
  const frameMat = materials.polymer(0x16191e);
  const postMat = new THREE.MeshPhysicalMaterial({ color: 0x2b3038, metalness: 0.6, roughness: 0.42 });

  const foot = beveledBox(3.35, 0.1, 0.6, postMat, 0.03);
  foot.position.set(WX, DECK + 0.05, WZ);
  group.add(foot);
  const back = beveledBox(3.0, 2.48, 0.05, frameMat, 0.02);
  back.position.set(WX, 1.86, WZ - 0.02);
  back.receiveShadow = true;
  group.add(back);
  [-1, 1].forEach((s) => {
    const post = beveledBox(0.09, 2.86, 0.12, postMat, 0.02);
    post.position.set(WX + s * 1.545, DECK + 0.1 + 1.43, WZ);
    group.add(post);
  });
  const cap = beveledBox(3.18, 0.07, 0.16, postMat, 0.02);
  cap.position.set(WX, DECK + 0.1 + 2.86, WZ);
  group.add(cap);

  // intake slot on the left post: copies from the web go in here
  const inbox = beveledBox(0.12, 0.62, 0.3, postMat, 0.02);
  inbox.position.set(WX - 1.62, 1.95, WZ + 0.05);
  group.add(inbox);
  const slotMat = materials.glow(ACCENT, 0.5);
  const slot = beveledBox(0.02, 0.48, 0.06, slotMat, 0.008);
  slot.position.set(WX - 1.69, 1.95, WZ + 0.05);
  group.add(slot);
  const INBOX = new THREE.Vector3(WX - 1.72, 1.95, WZ + 0.05);

  const plateBody = materials.polymer(0x1c2129);
  const rowParts = WORDS.map((word, r) => {
    const y = rowY(r);
    const plate = slab(0.56, 0.22, 0.05, textTile(word, 256, 100, { bg: '#1d232c', size: 0.56 }), plateBody, 0.65);
    plate.position.set(-1.8, y, WZ + 0.06);
    group.add(plate);
    const rail = rod(0.008, 2.2, postMat, 6);
    rail.rotation.z = -Math.PI / 2;
    rail.position.set(-1.46, y, WZ + 0.035);
    group.add(rail);
    const tiles = POSTINGS[word].map((n) => {
      const sc = SHARD_COLORS[shardOf(n)];
      const tex = textTile(String(n), 80, 104, { bg: mix(sc, '#0d1015', 0.72), border: sc, size: 0.5 });
      const t = slab(0.15, 0.2, 0.03, tex, plateBody, 0.6);
      t.position.set(numX(n), y, TILE_Z);
      group.add(t);
      return { n, mesh: t, front: t.userData.front, base: 0.6 };
    });
    return { word, y, plate, tiles };
  });

  // lookup: a scan bar spanning the bees + honey lines, and match connectors
  const scanMat = materials.glow(0xffffff, 1.2);
  scanMat.transparent = true;
  scanMat.depthWrite = false;
  const scan = beveledBox(0.018, 0.82, 0.018, scanMat, 0.006);
  scan.position.set(numX(1), (rowY(0) + rowY(1)) / 2, TILE_Z + 0.05);
  group.add(scan);
  const beams = MATCHES.map((n) => {
    const m = materials.glow(ACCENT, 1.4);
    m.transparent = true;
    m.depthWrite = false;
    const b = beveledBox(0.03, rowY(0) - rowY(1) - 0.18, 0.02, m, 0.008);
    b.position.set(numX(n), (rowY(0) + rowY(1)) / 2, TILE_Z + 0.01);
    group.add(b);
    return { n, mesh: b, mat: m };
  });

  // the copy of page 18 arriving to be filed, and its five word chips
  const card = new THREE.Group();
  const cardBody = beveledBox(0.5, 0.62, 0.03, materials.polymer(0x171a20), 0.014);
  card.add(cardBody);
  const cardFaceMat = faceMat(pageTexture(FILED_PAGE), 0.75);
  const cardFace = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.575), cardFaceMat);
  cardFace.position.z = 0.017;
  card.add(cardFace);
  cardBody.material = cardBody.material.clone();
  cardBody.material.transparent = true;
  group.add(card);

  const chipWords = WORDS.filter((w) => POSTINGS[w].includes(FILED_PAGE));
  const chips = chipWords.map((w) => {
    const tex = textTile(w, 220, 80, { bg: '#2a2410', border: '#fbbc05', fg: '#fff3cf', size: 0.56 });
    const m = faceMat(tex, 0.9);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.11), m);
    group.add(mesh);
    return { word: w, r: WORDS.indexOf(w), mesh, mat: m };
  });

  return { group, rowParts, scan, scanMat, beams, card, cardBody, cardFaceMat, chips, INBOX, slotMat };
}

// ---------------------------------------------------------------------------
// THE DATA CENTRE — five racks, each holding one slice of page numbers
// ---------------------------------------------------------------------------
const RACK_X = [1.75, 2.31, 2.87, 3.43, 3.99];
const RACK_Z = -0.95;
const UNITS = 9;
function buildRacks() {
  const group = new THREE.Group();
  const cabMat = new THREE.MeshPhysicalMaterial({ color: 0x1b1f25, metalness: 0.45, roughness: 0.5, clearcoat: 0.2, clearcoatRoughness: 0.5 });
  const unitGeo = new THREE.BoxGeometry(0.4, 0.13, 0.02);
  const units = new THREE.InstancedMesh(unitGeo, materials.polymer(0x2c313a), RACK_X.length * UNITS);
  const ledGeo = new THREE.BoxGeometry(0.05, 0.018, 0.012);
  const ledMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const leds = new THREE.InstancedMesh(ledGeo, ledMat, RACK_X.length * UNITS * 2);
  const m4 = new THREE.Matrix4();
  const frontZ = RACK_Z + 0.31;
  const ledSeeds = [];
  const signs = [];
  RACK_X.forEach((x, i) => {
    const cab = beveledBox(0.48, 1.8, 0.62, cabMat, 0.025);
    cab.position.set(x, DECK + 0.9, RACK_Z);
    group.add(cab);
    for (let k = 0; k < UNITS; k++) {
      const y = DECK + 0.2 + k * 0.17;
      m4.makeTranslation(x, y, frontZ + 0.01);
      units.setMatrixAt(i * UNITS + k, m4);
      for (let l = 0; l < 2; l++) {
        m4.makeTranslation(x + 0.1 + l * 0.065, y, frontZ + 0.024);
        leds.setMatrixAt((i * UNITS + k) * 2 + l, m4);
        // odd whole cycles per lap, uneven seeds
        ledSeeds.push({ rack: i, k: 1 + 2 * ((i * 7 + k * 3 + l) % 3), s: (i * 0.37 + k * 0.61 + l * 0.29) % 1 });
      }
    }
    const sc = SHARD_COLORS[i];
    const lo = i * 10;
    const signTex = textTile(`pages ${lo}–${lo + 9}`, 300, 90, { bg: '#12161c', border: sc, fg: sc, size: 0.42 });
    const sign = slab(0.46, 0.14, 0.025, signTex, cabMat, 0.7);
    sign.position.set(x, DECK + 1.8 + 0.12, RACK_Z + 0.2);
    group.add(sign);
    const stem = rod(0.01, 0.06, cabMat, 6);
    stem.position.set(x, DECK + 1.8, RACK_Z + 0.2);
    group.add(stem);
    signs.push(sign);
  });
  units.instanceMatrix.needsUpdate = true;
  leds.instanceMatrix.needsUpdate = true;
  units.castShadow = true;
  group.add(units, leds);

  const col = new THREE.Color();
  const base = new THREE.Color(0x3ddc97);
  const hot = new THREE.Color(ACCENT);
  function setLeds(phase, flash) {
    ledSeeds.forEach((sd, j) => {
      const tw = 0.25 + 0.55 * Math.max(0, Math.sin(TAU * (phase * sd.k + sd.s)));
      const f = flash[sd.rack] || 0;
      col.copy(base).multiplyScalar(tw * (1 - f)).add(new THREE.Color().copy(hot).multiplyScalar(f * 2.2));
      leds.setColorAt(j, col);
    });
    leds.instanceColor.needsUpdate = true;
  }
  return { group, setLeds, signs, frontZ };
}

// ---------------------------------------------------------------------------
// THE SCREEN — a monitor on a stand: search bar, four results, score bars
// ---------------------------------------------------------------------------
const SCREEN_W = 1.9;
const SCREEN_H = 1.22;
const ROW_SLOTS = [0.24, 0.05, -0.14, -0.33];
const BAR_X0 = 0.36;
const BAR_MAX = 0.52;
function buildPanel() {
  const g = new THREE.Group();
  const bezelMat = new THREE.MeshPhysicalMaterial({ color: 0x0f1115, metalness: 0.3, roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.4 });
  const standMat = new THREE.MeshPhysicalMaterial({ color: 0x8d949e, metalness: 0.85, roughness: 0.38 });
  const bezel = beveledBox(SCREEN_W + 0.1, SCREEN_H + 0.1, 0.07, bezelMat, 0.03);
  g.add(bezel);
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_W, SCREEN_H), materials.glow(0x0b0e13, 0.6));
  bg.position.z = 0.036;
  g.add(bg);

  // search bar (redrawn as the question is typed)
  const barTex = canvasTex(1024, 104, () => {});
  let typedChars = -1;
  function drawBar(nChars, caret) {
    if (nChars === typedChars && caret === drawBar.caret) return;
    typedChars = nChars;
    drawBar.caret = caret;
    const { ctx, canvas } = barTex.userData;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    roundRect(ctx, 4, 4, w - 8, h - 8, (h - 8) / 2);
    ctx.fillStyle = '#1b2029';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#4a5363';
    ctx.stroke();
    // magnifier
    ctx.strokeStyle = '#9aa3b2';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(56, h / 2 - 4, 17, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(68, h / 2 + 8);
    ctx.lineTo(82, h / 2 + 22);
    ctx.stroke();
    ctx.fillStyle = '#eef1f5';
    ctx.font = `500 50px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const txt = QUERY.slice(0, nChars);
    ctx.fillText(txt, 110, h / 2 + 2);
    if (caret) {
      const tw = ctx.measureText(txt).width;
      ctx.fillStyle = '#8ab4f8';
      ctx.fillRect(114 + tw, h / 2 - 26, 4, 52);
    }
    barTex.needsUpdate = true;
  }
  const barMat = faceMat(barTex, 0.85);
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.173), barMat);
  bar.position.set(0, 0.45, 0.04);
  g.add(bar);

  // result rows — each its own group so it can slide into score order
  const rows = MATCHES.map((n, i) => {
    const rg = new THREE.Group();
    rg.position.set(0, ROW_SLOTS[i], 0.042);
    g.add(rg);
    const sc = SHARD_COLORS[shardOf(n)];
    const tex = canvasTex(780, 112, (ctx, w, h) => {
      ctx.fillStyle = sc;
      ctx.beginPath();
      ctx.arc(26, 34, 13, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#9aa3b2';
      ctx.font = `500 26px ${FONT}`;
      ctx.textBaseline = 'middle';
      ctx.fillText(`page ${n}`, 50, 34);
      ctx.fillStyle = '#8ab4f8';
      ctx.font = `600 40px ${FONT}`;
      ctx.fillText(RESULT_TEXT[n], 12, 84);
    });
    const m = faceMat(tex, 0.85);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.12, 0.161), m);
    plane.position.x = -0.36;
    rg.add(plane);
    const segs = CLUE_COLORS.map((c) => {
      const sm = materials.glow(c, 0.45);
      sm.transparent = true;
      sm.depthWrite = false;
      const geo = new THREE.BoxGeometry(1, 0.075, 0.01);
      geo.translate(0.5, 0, 0);
      const mesh = new THREE.Mesh(geo, sm);
      mesh.position.set(BAR_X0, -0.01, 0.004);
      rg.add(mesh);
      return { mesh, mat: sm };
    });
    return { n, group: rg, mat: m, segs, slot: i };
  });

  const legendTex = canvasTex(1100, 60, (ctx) => {
    const items = ['links in', 'words + meaning', 'freshness', 'your place & language'];
    let x = 10;
    ctx.font = `500 30px ${FONT}`;
    ctx.textBaseline = 'middle';
    items.forEach((t, i) => {
      ctx.fillStyle = '#' + new THREE.Color(CLUE_COLORS[i]).getHexString();
      ctx.fillRect(x, 18, 24, 24);
      ctx.fillStyle = '#c4cad4';
      ctx.fillText(t, x + 34, 31);
      x += 44 + ctx.measureText(t).width + 22;
    });
  });
  const legendMat = faceMat(legendTex, 0.8);
  const legend = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.098), legendMat);
  legend.position.set(0.02, -0.5, 0.042);
  g.add(legend);

  // stand
  const neck = beveledBox(0.14, 0.62, 0.06, standMat, 0.02);
  neck.position.set(0, -0.6, -0.08);
  g.add(neck);
  const baseFoot = beveledBox(0.72, 0.035, 0.42, standMat, 0.015);
  baseFoot.position.set(0, -0.92, -0.04);
  g.add(baseFoot);

  return { group: g, drawBar, bar, rows, legend, legendMat };
}

// ---------------------------------------------------------------------------
// assembly
// ---------------------------------------------------------------------------
export function buildGoogleSearch({ scene }) {
  const root = new THREE.Group();
  scene.add(root);

  const plinth = studioPlinth({ w: 13.4, h: DECK, d: 4.4, color: 0x17191d });
  plinth.position.x = 0.1;
  root.add(plinth);

  const web = buildWeb();
  root.add(web.group);
  const wall = buildIndexWall();
  root.add(wall.group);
  const dc = buildRacks();
  root.add(dc.group);
  const panel = buildPanel();
  panel.group.position.set(5.55, DECK + 0.95, 0.55);
  panel.group.rotation.y = -0.55;
  root.add(panel.group);
  panel.group.updateMatrixWorld(true);

  // front server: splits the question and merges the answers
  const forkMat = new THREE.MeshPhysicalMaterial({ color: 0x23272e, metalness: 0.45, roughness: 0.45 });
  const fork = new THREE.Group();
  fork.position.set(4.42, 0, -0.15);
  const forkPost = rod(0.025, 0.72, forkMat, 10);
  forkPost.position.y = DECK;
  fork.add(forkPost);
  const forkBox = beveledBox(0.36, 0.2, 0.3, forkMat, 0.03);
  forkBox.position.y = DECK + 0.82;
  fork.add(forkBox);
  const forkLedMat = materials.glow(ACCENT, 0.6);
  const forkLed = beveledBox(0.2, 0.025, 0.012, forkLedMat, 0.006);
  forkLed.position.set(0, DECK + 0.82, 0.156);
  fork.add(forkLed);
  root.add(fork);
  const FORK = new THREE.Vector3(4.42, DECK + 0.82, -0.15);

  const BAR_W = panel.group.localToWorld(new THREE.Vector3(-0.55, 0.45, 0.06));
  const ROWS_W = panel.group.localToWorld(new THREE.Vector3(-0.3, -0.1, 0.06));
  const RACK_IN = RACK_X.map((x) => new THREE.Vector3(x, DECK + 0.95, dc.frontZ + 0.08));

  // crawlers
  const crawlers = TOURS.map((tour, ci) => {
    const c = buildCrawler();
    root.add(c.group);
    return { ...c, tour, off: [0.0, 0.31, 0.62][ci] };
  });
  const crawlPos = (num) => {
    const p = web.pages.get(num).pos;
    return new THREE.Vector3(p.x, p.y + 0.02, p.z + 0.11);
  };

  // copies flying from the web to the intake slot: one per tour hop
  const copies = [];
  crawlers.forEach((cr, ci) => {
    cr.tour.forEach((num, hop) => {
      const m = faceMat(web.pages.get(num).tex, 0.7);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.383), m);
      root.add(mesh);
      const start = crawlPos(num);
      const end = wall.INBOX.clone();
      const ctrl = start.clone().lerp(end, 0.5);
      ctrl.y += 0.7;
      ctrl.z += 0.6;
      copies.push({ ci, hop, mesh, mat: m, curve: new THREE.QuadraticBezierCurve3(start, ctrl, end) });
    });
  });

  // query beads + answer chips
  const beadGeo = new THREE.SphereGeometry(0.045, 14, 12);
  const mkBead = () => {
    const m = materials.glow(ACCENT, 2.2);
    m.transparent = true;
    m.depthWrite = false;
    const b = new THREE.Mesh(beadGeo, m);
    root.add(b);
    return b;
  };
  const qBead = mkBead();
  const fanBeads = RACK_X.map(() => mkBead());
  const answerChips = MATCHES.map((n) => {
    const sc = SHARD_COLORS[shardOf(n)];
    const tex = textTile(String(n), 120, 80, { bg: mix(sc, '#0d1015', 0.65), border: sc, size: 0.6 });
    const m = faceMat(tex, 1.0);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.113), m);
    root.add(mesh);
    return { n, rack: shardOf(n), mesh, mat: m };
  });

  // results: score totals (links clue = real PageRank of the page)
  const maxPrResult = Math.max(...MATCHES.map((n) => web.pages.get(n).pr));
  const clueVals = MATCHES.map((n) => [
    web.pages.get(n).pr / maxPrResult,
    CLUES[n].words,
    CLUES[n].fresh,
    CLUES[n].place,
  ]);
  const totals = clueVals.map((v) => v.reduce((a, b) => a + b, 0));
  const maxTotal = Math.max(...totals);
  const rankOrder = MATCHES.map((_, i) => i).sort((a, b) => totals[b] - totals[a]);
  const rankSlot = new Array(MATCHES.length);
  rankOrder.forEach((ri, slot) => (rankSlot[ri] = slot));

  // -------------------------------------------------------------------------
  // callouts
  // -------------------------------------------------------------------------
  const labels = calloutSets(['overview', 'crawl', 'index', 'lookup', 'shards', 'links', 'signals']);
  const L = labels.add;
  const anchor = (parent, pos) => {
    const o = new THREE.Object3D();
    o.position.copy(pos);
    parent.add(o);
    return o;
  };
  const p18 = web.pages.get(18);
  const p2 = web.pages.get(2);
  const beesRow = wall.rowParts[0];
  const tile18 = (r) => wall.rowParts[r].tiles.find((t) => t.n === FILED_PAGE).mesh;

  L('overview', panel.bar, 'Your screen', [0, 0.2, 0], 80, 50);
  L('overview', web.pages.get(27).group, 'The web', [0, 0.25, 0], 45, 46);
  L('overview', wall.group, 'The index', [WX, DECK + 2.95, WZ], 85, 50);
  L('overview', dc.group, 'Servers', [RACK_X[2], DECK + 2.0, RACK_Z + 0.2], 100, 60);

  L('crawl', crawlers[1].group, 'Crawler, a "spider"', [0, 0.06, 0], 60, 50);
  L('crawl', root, 'A link', web.pages.get(25).pos.clone().lerp(web.pages.get(31).pos, 0.55).add(new THREE.Vector3(0, 0, 0.02)), -50, 40);
  L('crawl', wall.group, 'Copies go in here', wall.INBOX.clone().add(new THREE.Vector3(0, 0.3, 0)), 60, 46);

  L('index', beesRow.plate, 'One line per word', [0, 0.11, 0.03], 80, 40);
  L('index', wall.rowParts[6].tiles[1].mesh, 'Page numbers, smallest first', [0, -0.1, 0.02], -70, 40);
  L('index', tile18(0), 'Page 18 filed here', [0, 0.1, 0.02], 60, 56);

  L('lookup', wall.group, 'bees line', [0.8, rowY(0), TILE_Z], 12, 34);
  L('lookup', wall.group, 'honey line', [0.8, rowY(1), TILE_Z], -12, 34);
  L('lookup', tile18(0), 'On both lines = a match', [0, 0.1, 0.02], 65, 46);

  L('shards', dc.signs[1], 'Holds pages 10–19 only', [0, 0.07, 0.02], 82, 95);
  L('shards', dc.signs[2], 'No match: sends nothing', [0.1, 0.07, 0.02], 40, 40);
  L('shards', fork, 'Splits, then merges', [0, DECK + 0.92, 0], 105, 80);

  L('links', p2.group, 'Most links in: 11', [0.1, 0.27, 0], 70, 40);
  L('links', root, 'Vote from a big page', web.heavyMid.clone().add(new THREE.Vector3(0.03, 0, 0.04)), 10, 70);
  L('links', p18.group, '6 links in, top score', [0.2, -0.1, 0.02], -30, 50);

  L('signals', panel.group, 'Clues add into one score', [0.84, ROW_SLOTS[0], 0.05], 82, 178);
  L('signals', panel.group, 'Sorted by score', [0.2, -0.62, 0.05], -80, 50);

  // -------------------------------------------------------------------------
  // pose
  // -------------------------------------------------------------------------
  const S = {
    phase: 0,
    crawl: 1, // crawlers + copies amount
    tours: 1, // whole crawler tours per lap
    typed: 1, // 0..1 of the question typed
    caret: 0,
    query: -1, // 0..1 progress of the question's trip, <0 = none
    results: 1, // result rows shown
    file: -1, // 0..1 filing of page 18 (step 3), <0 = none
    filed: 1, // tile 18 present on its lines
    lookup: 0, // dims every line but bees + honey
    scan: 0, // 0..1 scan bar position
    lit: 0, // match glow amount
    votes: 0,
    voteLaps: 1,
    rank: 0, // pages sized by PageRank
    score: 0, // score bars grown
    sort: 0, // rows in score order
    legend: 0,
    shard: 0.4, // rack sign glow
    signs: 1, // rack signs shown
  };

  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const dirV = new THREE.Vector3();

  function applyCrawl() {
    const amt = S.crawl;
    const flash = new Map();
    crawlers.forEach((cr) => {
      const H = cr.tour.length;
      const x = (((S.phase * S.tours + cr.off) % 1) + 1) % 1 * H;
      const hop = Math.floor(x);
      const l = x - hop;
      const a = cr.tour[hop];
      const b = cr.tour[(hop + 1) % H];
      const pa = crawlPos(a);
      const pb = crawlPos(b);
      const DW = 0.32;
      const m = smooth((l - DW) / (1 - DW));
      tmp.lerpVectors(pa, pb, m);
      // small hop while walking, still while reading a page
      tmp.y += Math.sin(Math.PI * m) * 0.05;
      cr.group.position.copy(tmp);
      dirV.subVectors(pb, pa).normalize();
      tmp2.copy(tmp).add(dirV);
      cr.group.lookAt(tmp2);
      cr.legs.rotation.z = l > DW ? Math.sin(l * 9 * TAU) * 0.12 : 0;
      cr.group.visible = amt > 0.01;
      cr.group.scale.setScalar(Math.max(0.001, amt * CRAWLER_SCALE));
      if (l < DW) {
        const f = Math.sin((Math.PI * l) / DW) * amt;
        flash.set(a, Math.max(flash.get(a) || 0, f));
      }
    });
    web.pages.forEach((p) => {
      p.faceMat.emissiveIntensity = 0.55 + 1.0 * (flash.get(p.num) || 0);
    });
    // copies: launched mid-read, 1.4 hops in the air
    let arriving = 0;
    copies.forEach((cp) => {
      const cr = crawlers[cp.ci];
      const H = cr.tour.length;
      const x = (((S.phase * S.tours + cr.off) % 1) + 1) % 1 * H;
      const d = (((x - cp.hop - 0.16) % H) + H) % H;
      const FL = 1.4;
      if (d < FL && amt > 0.01) {
        const f = d / FL;
        cp.mesh.visible = true;
        cp.curve.getPoint(smooth(f), cp.mesh.position);
        cp.mesh.scale.setScalar(1 - 0.55 * f);
        cp.mat.opacity = amt * Math.min(1, f * 8) * Math.min(1, (1 - f) * 6);
        if (f > 0.85) arriving = Math.max(arriving, (f - 0.85) / 0.15);
      } else {
        cp.mesh.visible = false;
        cp.mat.opacity = 0;
      }
    });
    wall.slotMat.emissiveIntensity = 0.5 + 1.2 * arriving * amt;
  }

  function applyIndex() {
    const lit = S.lit;
    const scanN = 1 + S.scan * 47;
    wall.rowParts.forEach((row, r) => {
      const inQuery = r === 0 || r === 1;
      const dimK = inQuery ? 1 : 1 - 0.8 * S.lookup;
      row.plate.userData.front.emissiveIntensity = (inQuery ? 0.65 + 0.6 * S.lookup : 0.65) * dimK;
      row.plate.userData.front.color.setScalar(dimK);
      row.tiles.forEach((t) => {
        let e = t.base * dimK;
        const isMatch = inQuery && MATCHES.includes(t.n);
        if (isMatch && S.lookup > 0) {
          const passed = clamp01((scanN - t.n) / 2.5);
          e += 1.3 * passed * lit;
        }
        if (t.n === FILED_PAGE) {
          const s = S.filed;
          t.mesh.scale.set(1, Math.max(0.001, s), 1);
          t.mesh.visible = s > 0.002;
          e += S.newGlow;
        }
        t.front.emissiveIntensity = e;
        t.front.color.setScalar(dimK);
      });
    });
    wall.scan.visible = S.lookup > 0.01 && S.scanShow > 0.01;
    wall.scan.position.x = numX(scanN);
    wall.scanMat.opacity = S.scanShow;
    wall.beams.forEach((bm) => {
      const passed = clamp01((scanN - bm.n) / 2.5) * lit * S.lookup;
      bm.mesh.visible = passed > 0.01;
      bm.mat.opacity = passed;
      bm.mesh.scale.y = Math.max(0.001, passed);
    });

    // filing page 18
    const fp = S.file;
    const on = fp >= 0;
    const cardStart = web.pages.get(FILED_PAGE).pos.clone().add(new THREE.Vector3(0, 0, 0.1));
    const cardHold = new THREE.Vector3(-2.02, 2.2, 0.3);
    if (on) {
      const fly = win(fp, 0.02, 0.16);
      wall.card.position.lerpVectors(cardStart, cardHold, fly);
      wall.card.position.y += Math.sin(Math.PI * fly) * 0.35;
      wall.card.position.z += Math.sin(Math.PI * fly) * 0.3;
      const op = win(fp, 0.0, 0.05) * (1 - win(fp, 0.3, 0.38));
      wall.card.visible = op > 0.01;
      wall.cardFaceMat.opacity = op;
      wall.cardBody.material.opacity = op;
      wall.card.scale.setScalar(0.8 + 0.2 * fly);
    } else {
      wall.card.visible = false;
    }
    wall.chips.forEach((ch, i) => {
      if (!on) {
        ch.mesh.visible = false;
        return;
      }
      const y = rowY(ch.r);
      const t0 = 0.2 + i * 0.012;
      const a = win(fp, t0, t0 + 0.15);
      const b = win(fp, t0 + 0.15, t0 + 0.27);
      const start = cardHold.clone().add(new THREE.Vector3(0, 0.18 - i * 0.09, 0.03));
      const mid = new THREE.Vector3(-1.38, y + 0.005, -0.72);
      const end = new THREE.Vector3(numX(FILED_PAGE), y, TILE_Z + 0.05);
      ch.mesh.position.lerpVectors(start, mid, a);
      ch.mesh.position.z += Math.sin(Math.PI * a) * 0.25;
      if (b > 0) ch.mesh.position.lerpVectors(mid, end, b);
      const op = win(fp, t0 - 0.01, t0 + 0.02) * (1 - win(fp, t0 + 0.25, t0 + 0.3));
      ch.mesh.visible = op > 0.01;
      ch.mat.opacity = op;
      ch.mesh.scale.setScalar(1 - 0.35 * b);
    });
  }

  function applyQuery() {
    const q = S.query;
    const on = q >= 0;
    const flash = [0, 0, 0, 0, 0];
    // panel -> fork
    const a = on ? win(q, 0.0, 0.22) : 0;
    qBead.visible = on && q < 0.24;
    if (qBead.visible) {
      qBead.position.lerpVectors(BAR_W, FORK, a);
      qBead.position.y += Math.sin(Math.PI * a) * 0.35;
      qBead.material.opacity = Math.min(1, q * 30) * (1 - win(q, 0.2, 0.24));
    }
    // fork -> every rack at once
    const b = on ? win(q, 0.24, 0.46) : 0;
    fanBeads.forEach((bd, i) => {
      bd.visible = on && q > 0.22 && q < 0.5;
      if (!bd.visible) return;
      bd.position.lerpVectors(FORK, RACK_IN[i], b);
      bd.position.y += Math.sin(Math.PI * b) * 0.25;
      bd.material.opacity = win(q, 0.22, 0.25) * (1 - win(q, 0.46, 0.5));
    });
    // racks search their slice
    if (on) {
      const f = win(q, 0.44, 0.5) * (1 - win(q, 0.6, 0.68));
      for (let i = 0; i < 5; i++) flash[i] = f;
    }
    dc.setLeds(S.phase, flash);
    dc.signs.forEach((s, i) => {
      s.visible = S.signs > 0.5;
      s.userData.front.emissiveIntensity = 0.45 + 0.5 * S.shard + 0.8 * flash[i];
    });
    forkLedMat.emissiveIntensity = 0.6 + 1.6 * (on ? Math.max(1 - Math.abs(q - 0.22) * 12, 1 - Math.abs(q - 0.8) * 10, 0) : 0);
    // answers back to the fork, merged, then to the screen
    const c = on ? win(q, 0.6, 0.8) : 0;
    const d = on ? win(q, 0.82, 0.97) : 0;
    answerChips.forEach((ch, i) => {
      ch.mesh.visible = on && q > 0.58 && q < 0.99;
      if (!ch.mesh.visible) return;
      const merged = FORK.clone().add(new THREE.Vector3(-0.06 + i * 0.04, 0.24 + i * 0.13, 0.12));
      if (d <= 0) {
        ch.mesh.position.lerpVectors(RACK_IN[ch.rack], merged, c);
        ch.mesh.position.y += Math.sin(Math.PI * c) * 0.3;
      } else {
        const toPanel = ROWS_W.clone().add(new THREE.Vector3(0, 0.3 - i * 0.12, 0));
        ch.mesh.position.lerpVectors(merged, toPanel, d);
      }
      ch.mat.opacity = win(q, 0.58, 0.62) * (1 - win(q, 0.94, 0.99));
    });
  }

  function applyPanel() {
    const n = Math.round(S.typed * QUERY.length);
    panel.drawBar(n, S.caret > 0.5);
    panel.rows.forEach((row, i) => {
      const stagger = clamp01(S.results * 4 - i * 0.9);
      row.mat.opacity = smooth(stagger);
      row.group.visible = stagger > 0.01;
      const y0 = ROW_SLOTS[i];
      const y1 = ROW_SLOTS[rankSlot[i]];
      // rows slide sideways a touch while swapping, so they never pass through each other
      const s = smooth(S.sort);
      row.group.position.y = y0 + (y1 - y0) * s;
      row.group.position.x = Math.sin(Math.PI * s) * 0.05 * Math.sign(y0 - y1);
      let x = BAR_X0;
      row.segs.forEach((sg, k) => {
        const w = (clueVals[i][k] / maxTotal) * BAR_MAX * S.score;
        sg.mesh.scale.x = Math.max(0.0001, w);
        sg.mesh.position.x = x;
        sg.mesh.visible = S.score > 0.01 && stagger > 0.01;
        sg.mat.opacity = row.mat.opacity;
        x += w;
      });
    });
    panel.legendMat.opacity = S.legend;
    panel.legend.visible = S.legend > 0.01;
  }

  function applyLinks() {
    web.setVotes(S.phase, S.votes, S.voteLaps);
    web.pages.forEach((p) => {
      p.group.scale.setScalar(1 + (p.rankScale - 1) * S.rank);
    });
  }

  function apply() {
    applyCrawl();
    applyIndex();
    applyQuery();
    applyPanel();
    applyLinks();
  }

  S.newGlow = 0;
  S.scanShow = 0;
  apply();

  function set(p) {
    Object.assign(S, p);
    apply();
  }

  return {
    group: root,
    set,
    setLabels: labels.setLabels,
    parts: { web: web.group, wall: wall.group, racks: dc.group, panel: panel.group, fork, crawlers: crawlers.map((c) => c.group) },
    debug: { rankOrder, totals, pr: [...web.pages.values()].map((p) => [p.num, +p.pr.toFixed(4)]) },
  };
}
