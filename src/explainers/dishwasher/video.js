// Editorial layer for video export (scripts/export-video.mjs).
//
// SCRIPTING: one flowing voiceover, synthesized as a single ElevenLabs take —
// the per-shot `narration` strings are just the cut points; each hands off into
// the next. 8-beat arc: hook -> stakes/planted loop -> spoken question ->
// reveal -> BUT/THEREFORE mechanism beats -> isolated stat -> so-what ->
// callback button.
//
// PACKAGING
//   Idea:  a dishwasher never fills up. It gets two litres and throws them.
//   Lens:  not a bath, a puddle moved very hard, by arms with no motor.
//   Loop:  "two litres" planted in shot 2, closed word for word in the button.
//   Replay: the button hands straight back to the hook, so the loop closes on
//           the cut as well as in the script.
//
// No em dashes anywhere: ElevenLabs renders them as dead air the speed knob
// cannot compress.
export default {
  // The exporter's short-form default end card reads "Full length version /
  // on YouTube". There is no long-form dishwasher video, so that default would
  // promise something that does not exist. Single line also keeps it on the
  // same baseline as the caption rail instead of sitting a line higher.
  endCard: 'Share it. whatDstuff',

  hook: 'Your dishwasher\nnever fills up with water.',

  // 9:16 — ~80s. One take, 7 shots.
  short: {
    shots: [
      {
        // Zone 1 — the hook, on the sealed hero. The claim is word one.
        step: 0,
        dolly: 1.45,
        labels: [],
        narration:
          'Your dishwasher never fills up with water. There’s no tank behind that door at all.',
      },
      {
        // Zone 2+3 — stakes plant the loop ("two litres"), then the question
        // gets asked out loud over the cutaway and the puddle
        step: 3,
        dolly: 1.55,
        labels: [],
        narration:
          'It gets about two litres. A puddle you could mop up with a tea towel. Your plates sit a foot above it, bone dry. So how does a puddle clean anything?',
      },
      {
        // Zone 4a — the answer: pressure and heat
        step: 4,
        dolly: 1.6,
        labels: [],
        narration:
          'By moving it, hard. A pump under the tub drives that puddle up the back wall, heating it to fifty-five degrees on the way.',
      },
      {
        // Zone 4b — the re-hook. Short, flat, and the best fact in the video.
        step: 5,
        dolly: 1.65,
        labels: [],
        narration: 'But here’s the part that gets me. The spray arms have no motor.',
      },
      {
        // Zone 4c — the mechanism itself, on the same step pushed in closer
        step: 5,
        dolly: 1.45,
        labels: [],
        narration:
          'Look at the nozzles. Every one is tipped sideways, so each jet leaves at an angle. Push water one way hard enough and it shoves the arm the other way. A lawn sprinkler, spun by the water for free.',
      },
      {
        // Zone 5 — the stat, isolated on its own beat
        step: 6,
        dolly: 1.6,
        labels: [],
        narration:
          'So it lands, runs off the plates, and strains back into the sump. The pump picks it straight back up. The same two litres, hundreds of times, in one wash.',
      },
      {
        // Zone 6+7 — so-what, then the button closes the loop word for word
        step: 8,
        dolly: 1.45,
        labels: [],
        narration:
          'A whole load costs about eleven litres. At the sink, five times as much, and never that hot, because your hands can’t. Two litres, thrown a thousand times.',
      },
    ],
  },

  // 16:9 — ~2.5min. Same spine with room to develop the soap and the drying.
  long: {
    shots: [
      {
        step: 0,
        narration:
          'Your dishwasher never fills up with water. There’s no tank behind that door at all. It gets about two litres, and then throws them, hard, for two hours.',
      },
      {
        step: 3,
        labels: ['Sump — about 2 litres', 'Filter over the drain', 'Dishes never sit in it'],
        narration:
          'Take the cabinet off and the surprise is what’s missing. A valve lets about two litres into a well in the floor called the sump, then shuts. Your plates stand a foot above it, dry.',
      },
      {
        step: 4,
        labels: ['Impeller — 2800 rpm', 'Volute housing', 'Flow-through heater'],
        narration:
          'So the machine has to move that puddle. A pump under the tub spins curved vanes near two thousand eight hundred rpm, and its snail shaped housing turns that speed into pressure. A heater built into the pipe brings the water to fifty-five degrees on the way past.',
      },
      {
        step: 2,
        labels: ['Main-wash cup', 'Wax-motor latch'],
        narration:
          'The soap waits for that heat. A sprung lid holds the tablet through the fill and the cold pre-rinse. Then a pellet of wax, warmed by a tiny heater, swells just far enough to trip the catch.',
      },
      {
        step: 5,
        labels: ['Nozzles tipped sideways', 'Jet kicks the arm round', 'Hub bearing — no motor'],
        narration:
          'But here’s the part that gets me. The spray arms have no motor. Look at the nozzles and every one is tipped sideways, so each jet leaves at an angle. Push water one way hard enough and it shoves the arm the other way. A lawn sprinkler, spun by the water for free.',
      },
      {
        step: 6,
        labels: ['Food trapped on the mesh', 'High loop — no backflow'],
        narration:
          'So all of it lands, runs off the plates, and strains back into the sump through a filter. The pump picks it straight back up. The same two litres, hundreds of times, in one wash. At the end a second pump finally shoves it out.',
      },
      {
        step: 7,
        labels: ['Rinse aid: it sheets off', 'Condensate on the wall'],
        narration:
          'The last rinse carries rinse aid, a surfactant that drops the water’s surface tension so it can’t bead. It sheets off the glass instead. Then the machine stops, and the dishes, hotter than the steel around them, dry themselves.',
      },
      {
        step: 8,
        narration:
          'A whole load costs about eleven litres. At the sink, that job can take five times as much, and never gets near fifty-five degrees, because your hands can’t. Two litres, thrown a thousand times.',
      },
    ],
  },
};
