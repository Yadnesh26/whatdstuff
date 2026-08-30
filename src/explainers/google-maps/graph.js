// The road network and the four routing algorithms, as PURE data + functions —
// no three.js in this file. Everything the animation replays is computed here
// by actually running the algorithms over this district: Dijkstra's settle
// order, A*'s settle order, bidirectional Dijkstra's alternating fronts, and a
// real contraction hierarchy (importance ordering, witness search, shortcut
// insertion, upward-only bidirectional query). The pictures are algorithm
// OUTPUT, not a drawing of what the output would look like.
//
// Reference facts this models (Bast et al., "Route Planning in Transportation
// Networks", and Geisberger/Sanders/Schultes/Delling 2008):
//   Western Europe benchmark: 18.0M vertices / 42.5M directed arcs.
//   Dijkstra               9,326,696 vertices scanned   2,195,080 us
//   bidirectional Dijkstra 4,914,804 vertices scanned   1,205,660 us
//   contraction hierarchies      280 vertices scanned         110 us
// Weights are TRAVEL TIME (length / speed), never distance — that is the
// single most important fact about a real road graph.

export const GRID = 9;
export const PITCH = 0.55;
export const N = GRID * GRID; // 81 junctions
export const SPAN = (GRID - 1) * PITCH; // 4.4 units across

const nid = (i, j) => j * GRID + i;

// Road classes. Speeds are relative, but their RATIOS are the real ones a
// router sees: a motorway carries roughly 3x the average speed of a
// stop-start residential street, which is why time-weighting reroutes you
// onto a longer highway leg every single day.
export const LOCAL = 0;
export const COLLECTOR = 1;
export const ARTERIAL = 2;
export const HIGHWAY = 3;
export const SPEED = [0.45, 0.7, 1.0, 1.45];

// deterministic hash-noise so the city is identical on every load
function rnd(seed) {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const onTrunk = (i, j) =>
  i === 2 || i === 6 || j === 2 || j === 6 || i === 4 || j === 4 || i === j || i + j === GRID - 1;

export const nodes = [];
for (let j = 0; j < GRID; j++) {
  for (let i = 0; i < GRID; i++) {
    // trunk roads run dead straight; side streets wander a little, which is
    // what stops the district reading as graph paper
    const jit = onTrunk(i, j) ? 0 : 0.05;
    nodes.push({
      id: nid(i, j),
      i,
      j,
      x: (i - (GRID - 1) / 2) * PITCH + (rnd(nid(i, j) * 7 + 1) - 0.5) * 2 * jit,
      z: (j - (GRID - 1) / 2) * PITCH + (rnd(nid(i, j) * 7 + 2) - 0.5) * 2 * jit,
      cls: LOCAL,
    });
  }
}

export const edges = [];
function addEdge(a, b, cls) {
  const A = nodes[a];
  const B = nodes[b];
  const len = Math.hypot(A.x - B.x, A.z - B.z);
  edges.push({ id: edges.length, a, b, cls, len, w: len / SPEED[cls] });
  nodes[a].cls = Math.max(nodes[a].cls, cls);
  nodes[b].cls = Math.max(nodes[b].cls, cls);
}

const rowClass = (j) => (j === 2 || j === 6 ? ARTERIAL : j === 4 ? COLLECTOR : LOCAL);
const colClass = (i) => (i === 2 || i === 6 ? ARTERIAL : i === 4 ? COLLECTOR : LOCAL);

for (let j = 0; j < GRID; j++) {
  for (let i = 0; i < GRID; i++) {
    if (i < GRID - 1) addEdge(nid(i, j), nid(i + 1, j), rowClass(j));
    if (j < GRID - 1) addEdge(nid(i, j), nid(i, j + 1), colClass(i));
  }
}
// the two diagonal expressways
for (let k = 0; k < GRID - 1; k++) {
  addEdge(nid(k, k), nid(k + 1, k + 1), HIGHWAY);
  addEdge(nid(k, GRID - 1 - k), nid(k + 1, GRID - 2 - k), HIGHWAY);
}

export const adj = nodes.map(() => []);
for (const e of edges) {
  adj[e.a].push({ to: e.b, w: e.w, edge: e.id });
  adj[e.b].push({ to: e.a, w: e.w, edge: e.id });
}

export const START = nid(1, 3);
export const DEST = nid(7, 5);

const euclid = (a, b) => Math.hypot(nodes[a].x - nodes[b].x, nodes[a].z - nodes[b].z);

// --- plain Dijkstra / A* -----------------------------------------------------
// Same routine both ways: with no heuristic it settles in order of pure cost
// (a circle spreading in every direction); with an admissible estimate of the
// remaining time it settles in order of cost + estimate, which drags the
// search towards the destination.
function search(src, dst, { heuristic = null, weights = null } = {}) {
  const cost = (e) => (weights ? weights[e.edge] : e.w);
  const dist = new Array(N).fill(Infinity);
  const prev = new Array(N).fill(-1);
  const done = new Array(N).fill(false);
  const order = [];
  dist[src] = 0;
  for (;;) {
    let u = -1;
    let bestKey = Infinity;
    for (let v = 0; v < N; v++) {
      if (done[v] || dist[v] === Infinity) continue;
      const key = dist[v] + (heuristic ? heuristic(v) : 0);
      if (key < bestKey) {
        bestKey = key;
        u = v;
      }
    }
    if (u < 0) break;
    done[u] = true;
    order.push(u);
    if (u === dst) break;
    for (const e of adj[u]) {
      if (done[e.to]) continue;
      const nd = dist[u] + cost(e);
      if (nd < dist[e.to] - 1e-12) {
        dist[e.to] = nd;
        prev[e.to] = u;
      }
    }
  }
  const path = [];
  for (let v = dst; v >= 0; v = prev[v]) {
    path.unshift(v);
    if (v === src) break;
  }
  return { dist, prev, order, path, total: dist[dst] };
}

// --- bidirectional Dijkstra --------------------------------------------------
// Two searches, one from each end, always advancing whichever front is
// currently cheaper. They stop the moment the two smallest keys can no longer
// beat the best meeting point found so far.
function bidirectional(src, dst) {
  const dF = new Array(N).fill(Infinity);
  const dB = new Array(N).fill(Infinity);
  const pF = new Array(N).fill(-1);
  const pB = new Array(N).fill(-1);
  const okF = new Array(N).fill(false);
  const okB = new Array(N).fill(false);
  dF[src] = 0;
  dB[dst] = 0;
  const order = [];
  let best = Infinity;
  let meet = -1;
  const pick = (d, ok) => {
    let u = -1;
    let b = Infinity;
    for (let v = 0; v < N; v++) {
      if (!ok[v] && d[v] < b) {
        b = d[v];
        u = v;
      }
    }
    return [u, b];
  };
  for (;;) {
    const [uF, bF] = pick(dF, okF);
    const [uB, bB] = pick(dB, okB);
    if (uF < 0 && uB < 0) break;
    const keyF = uF < 0 ? Infinity : bF;
    const keyB = uB < 0 ? Infinity : bB;
    // textbook termination for bidirectional Dijkstra: once the two cheapest
    // remaining keys can no longer sum to less than the best meeting cost
    // found so far, nothing left can improve it
    if (keyF + keyB >= best) break;
    const fwd = keyF <= keyB;
    const u = fwd ? uF : uB;
    const d = fwd ? dF : dB;
    const ok = fwd ? okF : okB;
    const p = fwd ? pF : pB;
    ok[u] = true;
    order.push({ node: u, fwd });
    if (dF[u] + dB[u] < best) {
      best = dF[u] + dB[u];
      meet = u;
    }
    for (const e of adj[u]) {
      const nd = d[u] + e.w;
      if (nd < d[e.to] - 1e-12) {
        d[e.to] = nd;
        p[e.to] = u;
      }
    }
  }
  const path = [];
  for (let v = meet; v >= 0; v = pF[v]) {
    path.unshift(v);
    if (v === src) break;
  }
  for (let v = pB[meet]; v >= 0; v = pB[v]) {
    path.push(v);
    if (v === dst) break;
  }
  return { order, path, meet, total: best };
}

// --- contraction hierarchies -------------------------------------------------
// Preprocessing: rank every junction by importance (a residential corner is
// unimportant, a motorway interchange is not), then contract them from least
// to most important. Contracting a junction deletes it and, for every pair of
// its surviving neighbours whose only shortest path ran through it, inserts a
// SHORTCUT carrying the same travel time. A witness search — a small local
// Dijkstra that ignores the junction being removed — is what proves whether a
// shortcut is actually needed.
function witnessExists(g, removed, v, u, w, limit) {
  const dist = new Map([[u, 0]]);
  const done = new Set([v]); // the node being contracted is off-limits
  for (let guard = 0; guard < 4 * N; guard++) {
    let cur = -1;
    let best = Infinity;
    for (const [n, d] of dist) {
      if (!done.has(n) && d < best) {
        best = d;
        cur = n;
      }
    }
    if (cur < 0 || best > limit + 1e-9) break;
    if (cur === w) return true;
    done.add(cur);
    for (const [to, arc] of g[cur]) {
      if (removed[to] || to === v || done.has(to)) continue;
      const nd = best + arc.w;
      if (nd < (dist.get(to) ?? Infinity)) dist.set(to, nd);
    }
  }
  return (dist.get(w) ?? Infinity) <= limit + 1e-9;
}

function buildCH() {
  const g = nodes.map(() => new Map());
  for (const e of edges) {
    const arc = { w: e.w, edge: e.id, via: -1 };
    g[e.a].set(e.b, arc);
    g[e.b].set(e.a, arc);
  }
  const removed = new Array(N).fill(false);
  const rank = new Array(N).fill(0);
  const shortcuts = [];
  // importance: road class first (the real hierarchy of a road network), then
  // degree, then index — deterministic, so the picture never shifts
  const order = [...Array(N).keys()].sort(
    (a, b) => nodes[a].cls - nodes[b].cls || g[a].size - g[b].size || a - b,
  );
  order.forEach((v, r) => {
    rank[v] = r;
  });

  for (const v of order) {
    const nb = [...g[v].keys()].filter((u) => !removed[u]);
    for (let a = 0; a < nb.length; a++) {
      for (let b = a + 1; b < nb.length; b++) {
        const u = nb[a];
        const w = nb[b];
        const via = g[v].get(u).w + g[v].get(w).w;
        const cur = g[u].get(w);
        if (cur && cur.w <= via + 1e-12) continue;
        if (witnessExists(g, removed, v, u, w, via)) continue;
        const arc = { w: via, edge: -1, via: v };
        g[u].set(w, arc);
        g[w].set(u, arc);
        shortcuts.push({ a: u, b: w, via: v, w: via, rank: rank[v] });
      }
    }
    removed[v] = true;
    for (const u of g[v].keys()) g[u].delete(v);
  }
  return { rank, shortcuts, order };
}

// The augmented graph, but with every arc pointing UPWARD only. This is the
// whole reason the query is fast: from either end you can only ever climb.
function upwardGraph(rank, shortcuts) {
  const up = nodes.map(() => []);
  const push = (a, b, w) => {
    const lo = rank[a] < rank[b] ? a : b;
    const hi = lo === a ? b : a;
    up[lo].push({ to: hi, w });
  };
  for (const e of edges) push(e.a, e.b, e.w);
  for (const s of shortcuts) push(s.a, s.b, s.w);
  return up;
}

function chQuery(up, src, dst) {
  const dF = new Array(N).fill(Infinity);
  const dB = new Array(N).fill(Infinity);
  const okF = new Array(N).fill(false);
  const okB = new Array(N).fill(false);
  dF[src] = 0;
  dB[dst] = 0;
  const order = [];
  let best = Infinity;
  let meet = -1;
  const pick = (d, ok) => {
    let u = -1;
    let b = Infinity;
    for (let v = 0; v < N; v++) {
      if (!ok[v] && d[v] < b) {
        b = d[v];
        u = v;
      }
    }
    return [u, b];
  };
  for (;;) {
    const [uF, bF] = pick(dF, okF);
    const [uB, bB] = pick(dB, okB);
    if (uF < 0 && uB < 0) break;
    const keyF = uF < 0 ? Infinity : bF;
    const keyB = uB < 0 ? Infinity : bB;
    if (Math.min(keyF, keyB) >= best) break;
    const fwd = keyF <= keyB;
    const u = fwd ? uF : uB;
    const d = fwd ? dF : dB;
    const ok = fwd ? okF : okB;
    ok[u] = true;
    order.push({ node: u, fwd });
    if (dF[u] + dB[u] < best) {
      best = dF[u] + dB[u];
      meet = u;
    }
    for (const e of up[u]) {
      const nd = d[u] + e.w;
      if (nd < d[e.to] - 1e-12) d[e.to] = nd;
    }
  }
  return { order, meet, total: best };
}

const ch = buildCH();
const chUp = upwardGraph(ch.rank, ch.shortcuts);

export const dijkstra = search(START, DEST);
export const astar = search(START, DEST, {
  // admissible: straight-line distance divided by the fastest speed on the
  // network can never overestimate the remaining travel time
  heuristic: (v) => euclid(v, DEST) / SPEED[HIGHWAY],
});
export const bidi = bidirectional(START, DEST);
export const chRun = chQuery(chUp, START, DEST);
export const chRank = ch.rank;
export const chShortcuts = ch.shortcuts;

// --- live traffic ------------------------------------------------------------
// Congestion is applied to a real corridor (the middle of the expressway plus
// the arterial feeding it) and the route is re-solved against the new weights —
// the detour you see is the algorithm's answer, not a hand-drawn line.
export const congested = new Set(
  edges
    .filter((e) => {
      const A = nodes[e.a];
      const B = nodes[e.b];
      const mid = (A.i + B.i) / 2;
      if (e.cls === HIGHWAY && A.i === A.j && B.i === B.j && mid >= 2 && mid <= 6) return true;
      if (e.cls === ARTERIAL && A.j === 6 && B.j === 6 && mid >= 2 && mid <= 6) return true;
      return false;
    })
    .map((e) => e.id),
);

export const trafficWeights = edges.map((e) => {
  if (congested.has(e.id)) return e.w * 4.5;
  // everything else drifts a little, the way real live speeds do
  return e.w * (0.92 + rnd(e.id * 13 + 5) * 0.3);
});

export const trafficLevel = edges.map((e) => {
  if (congested.has(e.id)) return 1;
  const r = rnd(e.id * 29 + 3);
  return r > 0.88 ? 0.55 : r > 0.72 ? 0.28 : 0;
});

export const trafficRoute = search(START, DEST, { weights: trafficWeights });

export const stats = {
  nodes: N,
  edges: edges.length,
  arcs: edges.length * 2,
  shortcuts: chShortcuts.length,
  dijkstraSettled: dijkstra.order.length,
  astarSettled: astar.order.length,
  biSettled: bidi.order.length,
  chSettled: chRun.order.length,
};
