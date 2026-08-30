import meta from './meta.js';
import { buildGoogleMaps } from './model.js';
import { defineExplainer } from '../../framework/registry.js';
import { clamp01, smooth, win } from '../../framework/motion.js';
import * as G from './graph.js';

// Zoom-in / reveal story: the finished map first, then the graph underneath it,
// then four real algorithms run over that graph in increasing order of
// cleverness, then the live weights that make the whole thing a moving target.
//
// Every lap of every step starts and ends on the SAME pose: searches grow,
// draw their winning route, then fade to an empty map; the reveal step sinks
// the city and brings it back; the preprocessing step lifts the hierarchy and
// lays it flat again.

// Full state, pinned on every step — anything omitted here would inherit the
// previous step's mid-lap phase and misframe the fixed camera.
const BASE = {
  reveal: 1,
  lift: 0,
  settled: 0,
  order: null,
  intensity: 1,
  contract: 0,
  shortcutT: 0,
  route: 'none',
  routeT: 0,
  routeAlpha: 1,
  traffic: 0,
  probes: 0,
  probePhase: 0,
  bob: 0,
  spin: 0,
};
const pin = (handles, over) => handles.set({ ...BASE, ...over });

export default defineExplainer({
  ...meta,
  stageOptions: { dof: true },

  buildScene({ scene }) {
    return buildGoogleMaps({ scene });
  },

  steps: [
    {
      id: 'the-route',
      heading: '1 · The line you already trust',
      body: 'Two taps, and a blue ribbon appears through a city you have never driven. It arrived in about a tenth of a second, and it is not the shortest route — it is the fastest one. Everything under this map exists to answer one question: out of the millions of ways from this pin to that one, which gets you there soonest?',
      hint: 'Drag to orbit.',
      camera: { position: [-1.45, 4.7, 8.1], target: [-1.45, 0.32, 0.05] },
      focus: ['Start', 'Destination'],
      dofAperture: 0.00002,
      onEnter: ({ handles }) => {
        pin(handles, { reveal: 0, route: 'main' });
        handles.setLabels('city');
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 7200,
          ease: 'linear',
          onUpdate: () =>
            handles.set({
              routeT: smooth(win(clamp01(s.t), 0, 0.42)),
              routeAlpha: 1 - smooth(win(clamp01(s.t), 0.8, 0.96)),
              probePhase: s.t,
              bob: s.t * 3,
            }),
        });
      },
    },
    {
      id: 'weights',
      heading: '2 · The weight is time, not distance',
      body: 'Every edge carries a number, and it is not its length — it is how long it takes: length divided by the speed that road actually moves at. The expressway here runs about three times the speed of the side street beside it, so two kilometres of motorway can cost less than four hundred metres of stop-start. Choosing seconds instead of metres is the entire reason the app sends you the long way round and still wins.',
      camera: { position: [1.5, 3.3, 2.6], target: [0.64, 0.36, -0.7] },
      focus: ['Expressway — length ÷ 1.45', 'Side street — length ÷ 0.45'],
      dofAperture: 0.00018,
      onEnter: ({ handles }) => {
        pin(handles, { reveal: 0, probes: 0.9 });
        handles.setLabels('weights');
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 4600,
          ease: 'linear',
          // the dots run at each road's own speed — a side street crawls, the
          // expressway flies, which is the weight made visible
          onUpdate: () => handles.set({ probePhase: s.t, bob: s.t * 3 }),
        });
      },
    },
    {
      id: 'graph',
      heading: '3 · Strip the map away',
      body: 'The buildings are decoration. What the router sees is this: every junction a node, every stretch of road between two junctions an edge, stored twice over because a street can be quicker one way than the other. This district has 81 junctions and 160 segments. Western Europe — the benchmark this field measures itself against — has 18 million junctions and 42.5 million.',
      camera: { position: [-1.15, 3.9, 8.0], target: [-1.15, 0.42, 0.1] },
      focus: ['Junction — one node', 'Road segment — one edge'],
      dofAperture: 0.00003,
      onEnter: ({ handles }) => {
        pin(handles, { reveal: 0 });
        handles.setLabels('graph');
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 6800,
          ease: 'linear',
          onUpdate: () => {
            const u = clamp01(s.t);
            // the city sinks away, the graph stands alone, the city comes back
            const rev = smooth(win(u, 0.04, 0.34)) * (1 - smooth(win(u, 0.86, 1)));
            handles.set({ reveal: rev, bob: s.t * 3 });
          },
        });
      },
    },
    {
      id: 'dijkstra',
      heading: '4 · Dijkstra: cheapest first, in every direction',
      body: `The classic answer, published by Edsger Dijkstra in 1959: always expand from the cheapest junction you have reached but not yet finished with. Do that and the search grows as a circle of equal travel time — outward in every direction, including straight away from where you are going. Here it settles ${G.stats.dijkstraSettled} of the 81 junctions to find one route. On Western Europe it settles 9,326,696 of them, and takes about two seconds.`,
      camera: { position: [-1.3, 8.6, 5.6], target: [-1.3, 0.3, 0.1] },
      focus: ['Settled — its cost is final'],
      dofAperture: 0.00003,
      onEnter: ({ handles }) => {
        pin(handles);
        handles.setLabels('search');
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 5200,
          ease: 'linear',
          onUpdate: () => {
            handles.playSearch(G.dijkstra.order, clamp01(s.t));
            handles.set({ bob: s.t * 3 });
          },
        });
      },
    },
    {
      id: 'astar',
      heading: '5 · A*: aim the search at the destination',
      body: `Add one number to every junction — an estimate of the time still to go, straight-line distance divided by the fastest speed anywhere on the network. Because that estimate can never come out too high, the answer stays exactly correct, but the search now prefers junctions that face the destination and the circle stretches into a teardrop. ${G.stats.astarSettled} junctions here instead of ${G.stats.dijkstraSettled}.`,
      camera: { position: [2.35, 9.9, 5.3], target: [-1.3, 0.3, 0.1] },
      focus: ['Frontier — next cheapest'],
      dofAperture: 0.00003,
      onEnter: ({ handles }) => {
        pin(handles);
        handles.setLabels('search');
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 4800,
          ease: 'linear',
          onUpdate: () => {
            handles.playSearch(G.astar.order, clamp01(s.t));
            handles.set({ bob: s.t * 3 });
          },
        });
      },
    },
    {
      id: 'bidirectional',
      heading: '6 · Search from both ends at once',
      body: `Run a second search backwards from the destination and advance whichever front is currently cheaper. Two half-sized searches cost far less than one full-sized one, and both can stop the moment their cheapest remaining pair can no longer beat the best meeting point already found. ${G.stats.biSettled} junctions here, meeting in the middle. On Western Europe this halves the work to 4.9 million — and still takes more than a second.`,
      camera: { position: [-4.05, 7.9, 5.3], target: [-1.3, 0.3, 0.1] },
      focus: ['Settled — its cost is final'],
      dofAperture: 0.00004,
      onEnter: ({ handles }) => {
        pin(handles);
        handles.setLabels('search');
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 4800,
          ease: 'linear',
          onUpdate: () => {
            handles.playSearch(G.bidi.order, clamp01(s.t));
            handles.set({ bob: s.t * 3 });
          },
        });
      },
    },
    {
      id: 'contraction',
      heading: '7 · Build the shortcuts before anyone asks',
      body: `Everything so far searches the live map. The technique that makes continent-scale routing practical does the expensive part once, offline: rank every junction by importance, then delete them one at a time from the least important upward. Whenever deleting one would break the only shortest path between two of its neighbours, drop in a shortcut edge carrying exactly that travel time. ${G.stats.shortcuts} shortcuts cover this district; the whole of Western Europe takes about five minutes.`,
      camera: { position: [-1.3, 5.6, 8.4], target: [-1.3, 0.6, 0.0] },
      focus: ['Shortcut arc'],
      dofAperture: 0.00004,
      onEnter: ({ handles }) => {
        pin(handles);
        handles.setLabels('hierarchy');
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 6600,
          ease: 'linear',
          onUpdate: () => {
            const u = clamp01(s.t);
            const settle = 1 - smooth(win(u, 0.87, 1));
            handles.set({
              lift: smooth(win(u, 0, 0.16)) * settle,
              contract: smooth(win(u, 0.18, 0.78)) * settle,
              shortcutT: smooth(win(u, 0.2, 0.8)) * settle,
              bob: s.t * 3,
            });
          },
        });
      },
    },
    {
      id: 'upward',
      heading: '8 · The query is only allowed to climb',
      body: `With the shortcuts in place, each of the two searches is forbidden from ever moving downward in the hierarchy. From your side street it climbs to the arterial, to the expressway, and stops. The two upward searches meet near the top, and unpacking the shortcuts they used hands back exactly the route Dijkstra found the slow way. ${G.stats.chSettled} junctions here. On Western Europe: 280 junctions, 110 microseconds — roughly twenty thousand times faster than where we started.`,
      camera: { position: [1.3, 5.2, 8.3], target: [-1.2, 0.58, 0.0] },
      focus: ['They meet up here'],
      dofAperture: 0.00005,
      onEnter: ({ handles }) => {
        pin(handles, { lift: 1, shortcutT: 1 });
        handles.setLabels('query');
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 4400,
          ease: 'linear',
          onUpdate: () => {
            handles.playSearch(G.chRun.order, clamp01(s.t));
            handles.set({ bob: s.t * 3 });
          },
        });
      },
    },
    {
      id: 'traffic',
      heading: '9 · The weights move while you drive',
      body: 'The map comes back, and with it the part no preprocessing can bake in: every phone running the app reports how fast it is moving, and those anonymised traces — blended with years of history for this road at this hour — become the live weight on each edge. When the corridor ahead jams, the numbers change and the route is simply solved again against the new ones. Google puts its arrival times within a few minutes on more than 97% of trips.',
      hint: 'Drag to orbit while it runs.',
      camera: { position: [-1.45, 4.5, 7.9], target: [-1.45, 0.34, 0.1] },
      freeOrbit: true,
      focus: ['Jammed corridor'],
      dofAperture: 0.00002,
      onEnter: ({ handles }) => {
        pin(handles, { reveal: 0, probes: 0.85 });
        handles.setLabels('traffic');
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 8200,
          ease: 'linear',
          onUpdate: () => {
            const u = clamp01(s.t);
            const early = u < 0.44;
            handles.set({
              traffic: smooth(win(u, 0.02, 0.2)) * (1 - smooth(win(u, 0.9, 1))),
              route: early ? 'main' : 'detour',
              routeT: early
                ? smooth(win(u, 0.04, 0.2))
                : smooth(win(u, 0.48, 0.68)),
              routeAlpha: early
                ? 1 - smooth(win(u, 0.34, 0.43))
                : 1 - smooth(win(u, 0.84, 0.95)),
              probePhase: s.t,
              bob: s.t * 3,
            });
          },
        });
      },
    },
  ],
});
