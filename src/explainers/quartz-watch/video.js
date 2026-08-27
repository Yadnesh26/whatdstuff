// Editorial layer for video export (scripts/export-video.mjs). Short only —
// no long-form requested for this explainer yet.
//
// SCRIPTING: written as ONE flowing voiceover, not a stack of standalone
// sentences — make-narration.mjs synthesizes it as a single ElevenLabs take
// and the exporter paces the picture to the audio, so each line is written
// to hand off into the next. 8-beat arc: pattern interrupt -> curiosity hook
// + spoken question -> reveal (the crystal) -> step-by-step (divider ->
// motor -> gears) -> isolated stat -> real-world connection + callback.
// Loop: "the cheapest watch ... beats the finest one ever made" is planted
// in the hook and closed in the button.
export default {
  hook: 'Your cheapest watch\nbeats the finest watch ever made.',

  platforms: {
    shorts: {
      title: 'Your $10 watch beats a $50,000 one',
      hashtags: ['#watch', '#quartz', '#howitworks', '#engineering', '#science'],
    },
  },

  // 9:16 — ~80s. One take, 7 shots. Skips the caseback-overview step (2) —
  // the short doesn't need it, the reveal jumps straight to the crystal.
  short: {
    shots: [
      {
        // Zone 1 — hook: the boldest true claim, on the sealed, complete watch
        step: 0,
        dolly: 1.5,
        narration:
          'Your cheapest watch beats the finest watch ever made — for accuracy, at least. And it does it with a part smaller than a grain of rice.',
      },
      {
        // Zone 2+3 — curiosity hook + the spoken question, still sealed
        step: 0,
        dolly: 1.5,
        labels: [],
        narration:
          'That’s the whole secret — a sliver of quartz, cut like a tiny tuning fork, buried behind the dial. So what does a sliver of sand have to do with keeping time?',
      },
      {
        // Zone 4a — reveal: the crystal, named, mechanism explained
        step: 2,
        dolly: 2.2,
        labels: ['Quartz tuning fork'],
        narration:
          'Squeeze quartz and it makes a tiny voltage; feed the voltage back in, and it hums — always at exactly the same pitch, 32,768 vibrations every second.',
      },
      {
        // Zone 4b — step: the divider, connective handoff
        step: 3,
        dolly: 2.2,
        labels: ['Fifteen halvings inside', 'One a second out'],
        narration:
          'A chip counts that hum down, halving it fifteen times in a row, until one flash falls out the bottom — once a second.',
      },
      {
        // Zone 4c — step: the motor, THEREFORE connective
        step: 4,
        dolly: 2.8,
        labels: ['Coil', 'Rotor magnet'],
        narration:
          'That flash kicks a coil, which flips a magnet a millimeter wide exactly half a turn, then goes dead silent until the next flash.',
      },
      {
        // Zone 5 — the stat, isolated on its own beat
        step: 5,
        dolly: 2.2,
        labels: ['Rotor pinion, 10 teeth', 'Seconds wheel'],
        narration:
          'Gears turn that half-turn into the six-degree jump you’re watching — and it’ll repeat that about thirty million times a year, without ever losing more than fifteen seconds a month.',
      },
      {
        // Zone 6+7 — so-what, then the callback button (closes the loop)
        step: 6,
        dolly: 1.55,
        narration:
          'No spring to wind, no gears full of friction to fight — just that same sliver of sand, doing the same tiny job, forever. Your cheapest watch, quietly beating the finest one ever made.',
      },
    ],
  },
};
