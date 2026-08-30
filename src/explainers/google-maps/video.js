// Editorial layer for video export (scripts/export-video.mjs). The hook is shot
// 1's spoken line verbatim — the burned caption rail IS the on-screen hook,
// there is no separate title card. Narration is spoken prose written as ONE
// continuous take, not the step body copy (that's written for reading).
//
// steps: 0 the route on the map · 1 weights in seconds · 2 the graph beneath
//        3 Dijkstra floods · 4 A* aims · 5 both ends at once · 6 contraction +
//        shortcuts · 7 the upward query · 8 live traffic reroute
//
// Retention spine: hook (barely looks at the map) -> stat stake -> LOOP PLANT
// ("already knew most of the answer before you asked") -> what it's really
// searching -> three failing attempts as a but/therefore chain -> the cheat ->
// the isolated stat (20,000x) -> so-what -> BUTTON closing the loop word for
// word, which also re-seeds the hook when the short replays.
//
// Accuracy note: the 18M / 280 / two-second figures are the published Western
// Europe benchmark results (Bast et al.), so the narration attributes them to
// that network rather than claiming them for one live Google query, and says
// "the fast ones cheat" rather than naming Google's unpublished stack.
export default {
  hook: 'Google Maps barely looks at the map.',
  // the derived name (GOOGLE MAPS FINDS YOUR ROUTE) overflows the 1080px frame
  titleCard: 'GOOGLE MAPS',

  // 9:16, narrated + verbatim caption rail.
  // Every shot pins labels: [] — at this framing the CSS2D callouts render
  // ~12px in a 1080px frame, illegible on a phone, and the verbatim caption
  // rail already speaks every part name. They stay on for the 16:9 long form.
  // The district is wide and composed off-centre for the text panel, so the
  // dolly has to trade subject size against the right-hand crop. 1.2 fills the
  // frame without losing the far corner; step 1's close macro needs its own.
  short: {
    dolly: 1.2,
    shots: [
      {
        // hook (0-3s) — the boldest true sentence, word one
        step: 0,
        seconds: 3,
        labels: [],
        narration: 'Google Maps barely looks at the map.',
      },
      {
        // stakes: stack the second surprise
        step: 0,
        seconds: 6,
        labels: [],
        narration: 'Eighteen million junctions across Europe. A route like this touches about two hundred and eighty.',
      },
      {
        // LOOP PLANT — these exact words come back as the button
        step: 0,
        seconds: 5,
        labels: [],
        narration: 'Because it already knew most of the answer before you asked.',
      },
      {
        // BUT — the thing it's actually measuring
        step: 1,
        seconds: 7,
        labels: [],
        dolly: 1.8, // already a close macro; the base dolly would bury the camera in it
        narration: 'But it isn’t looking for the shortest road. Every street is priced in seconds instead of miles.',
      },
      {
        // what it's really searching
        step: 2,
        seconds: 7,
        labels: [],
        narration: 'Underneath, it’s a graph. Junctions are dots, roads are lines, and every line carries a time.',
      },
      {
        // attempt 1
        step: 3,
        seconds: 6,
        labels: [],
        narration: 'The old way floods outward from you, cheapest first, in every direction, including backwards.',
      },
      {
        // BUT — attempt 1 fails
        step: 3,
        seconds: 5,
        labels: [],
        narration: 'That works, but it settles nine million junctions and takes two seconds.',
      },
      {
        // attempt 2 fails too — re-hook
        step: 5,
        seconds: 7,
        labels: [],
        narration: 'Aim it at the destination, search from both ends, and you’re still over a second.',
      },
      {
        // THEREFORE — the cheat
        step: 6,
        seconds: 7,
        labels: [],
        narration: 'Therefore the fast ones cheat. Ahead of time, they delete every unimportant junction from a copy of the map.',
      },
      {
        step: 6,
        seconds: 6,
        labels: [],
        narration: 'And a shortcut replaces each one, carrying exactly the time it used to hold.',
      },
      {
        // the payoff shape
        step: 7,
        seconds: 5,
        labels: [],
        narration: 'So the search only ever climbs, from your side street up to the motorway, and stops.',
      },
      {
        // THE STAT, isolated on its own beat
        step: 7,
        seconds: 6,
        labels: [],
        narration: 'Two seconds becomes a tenth of a millisecond. Twenty thousand times faster.',
      },
      {
        // so-what
        step: 8,
        seconds: 4,
        labels: [],
        narration: 'All that’s left to solve live is traffic.',
      },
      {
        // BUTTON — closes the loop word for word, re-seeds the hook on replay
        step: 8,
        seconds: 4,
        labels: [],
        narration: 'It knew the answer before you asked.',
      },
    ],
  },
};
