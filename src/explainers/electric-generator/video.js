// Editorial layer for video export (scripts/export-video.mjs).
//
// LENS: a generator does not "make" electricity and hand it over. It sells it
// to you, in torque, in real time — the instant you draw current the shaft
// gets physically harder to turn. That is the uncommon angle on a topic
// everyone thinks they already know, and it is the Lenz's-law payoff the
// explainer's step 7 already animates.
//
// Planted loop: "the message reached the engine through the shaft itself"
// (shot 2) -> "that's the message" (shot 7), with the button re-priming the
// hook on replay ("flip a switch, and something has to push").
//
// SCRIPTING: one flowing single-take voiceover; each line hands off into the
// next. Re-hook at the AC->load handoff ("here's the part that gets me").
// Stat isolated on its own shot: fifty revolutions a second, therefore a
// hundred reversals a second.
//
// steps: 0 overview (sealed) · 1 shaft · 2 gap (cutaway) · 3 induction ·
//        4 wave (scope) · 5 rings · 6 load · 7 run (sealed)
// The short skips the slip-ring step: excitation is a lovely fact but it is
// a second mechanism, and the short's spine is hook -> anatomy -> induction
// -> AC -> the load you can feel.
export default {
  hook: 'Switch on one light bulb,\nand this engine gets harder to turn.',

  // Declared render config (see export-content skill, step 0). captions and
  // followOverlay were both requested explicitly by name; endCard stays off
  // because it was not asked for.
  render: {
    formats: ['short'],
    captions: true,
    captionStyle: 'bold-karaoke',
    titleCard: true,
    endCard: false,
    followOverlay: true,
    fps: 30,
  },

  // 9:16 — ~80s at the channel voice's pace (8 beats).
  short: {
    shots: [
      {
        // Zone 1 — hook: the boldest true sentence, over the sealed genset.
        // No callouts; the line names no part and a clean product shot is
        // what stops the scroll.
        step: 0,
        labels: [],
        narration: 'Switch on one light bulb, and this engine physically gets harder to turn.',
      },
      {
        // Zone 2 — second surprise, and the loop goes in. "That bulb" hands
        // off from the hook.
        step: 0,
        labels: [],
        narration:
          'Nothing measured that bulb. The message reached the engine through the shaft itself, sent by a magnet the size of your fist.',
      },
      {
        // Zone 3 — the spoken question. "Magnet" hands off from the previous
        // line and sets up the cutaway.
        step: 0,
        labels: [],
        narration: 'So how does a spinning magnet know you flipped a switch?',
      },
      {
        // Zone 4 — the reveal: two parts and the gap between them.
        step: 2,
        labels: ['Rotor core', 'Air gap'],
        narration:
          'Take the covers off and only two parts matter. A ring of copper that never moves, and inside it, a magnet clearing the copper by half a millimetre.',
      },
      {
        // Zone 5 — mechanism, on a BUT. The counterintuitive beat: a coil is
        // darkest when the pole points straight at it. The model animates
        // exactly this, so the words and the picture agree.
        step: 3,
        labels: ['Stator winding', 'Rotor pole'],
        narration:
          'Sweep a magnet past copper and voltage appears. But only while the field is changing. So a coil goes dead the instant the magnet points at it, and peaks a quarter turn later.',
      },
      {
        // Zone 6 — the stat, isolated, over the scope trace. Fifty turns a
        // second is fifty cycles, which is a HUNDRED reversals a second.
        step: 4,
        labels: ['One turn, one cycle'],
        narration:
          'Fifty times a second, that magnet comes round. So a hundred times a second, the push reverses. That reversing is the alternating in alternating current.',
      },
      {
        // Zone 7 — re-hook, then the payoff that closes the loop word for
        // word. The drag arrows are on screen as the line lands.
        step: 6,
        labels: ['Reaction torque'],
        narration:
          "Here's the part that gets me. Start drawing that current out, and the copper pushes back. Its own field grabs the magnet and drags. That's the message.",
      },
      {
        // Zone 8 — so-what, then the button. Eight words, and it re-primes
        // the hook for the replay.
        step: 7,
        labels: [],
        narration:
          'And that message costs fuel. You never take electricity out of anything, you buy it, by the watt, the moment you ask. Flip a switch, and something has to push.',
      },
    ],
  },
};
