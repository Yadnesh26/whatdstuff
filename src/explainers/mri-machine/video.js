// Editorial layer for video export (scripts/export-video.mjs).
//
// SCRIPTING: written as ONE flowing voiceover, not a stack of standalone
// sentences — make-narration.mjs synthesizes it in a single ElevenLabs take
// and the exporter paces the picture to the audio. Built on the 8-beat arc:
// pattern interrupt -> curiosity hook (loop planted here) -> spoken question
// -> reveal -> step-by-step (BUT/THEREFORE) -> isolated stat -> so-what ->
// callback button (closes the loop).
//
// LOOP: "six protons in a million" is planted in shot 2, isolated as the stat
// in shot 7, and closed in the shot 8 button.
//
// LENGTH: short only, ~78s. Portrait shots on the wide/horizontal gantry
// carry a per-shot `dolly` pull-back so the machine doesn't crop at the sides.
export default {
  hook: 'Nothing in this machine\nhas moved in years.',

  // 9:16 — ~78s, 8 shots on the video-scripting spine.
  short: {
    shots: [
      {
        // Zone 1 — hook: the boldest true claim, word one
        step: 0,
        dolly: 2.0,
        narration:
          'Nothing in this machine has moved in years. Not even the electricity making the picture.',
      },
      {
        // Zone 2 — stack a second surprise, plant the loop
        step: 0,
        dolly: 2.0,
        narration:
          'It’s colder inside than deep space, and that picture comes from six protons in a million that refuse to fall in line.',
      },
      {
        // Zone 3 — the spoken question
        step: 0,
        dolly: 2.0,
        narration: 'So how do six leftover protons turn into a picture of your knee?',
      },
      {
        // Zone 4a — reveal: the magnet that never turns off
        step: 2,
        dolly: 1.6,
        labels: ['One loop, no resistance'],
        narration:
          'It starts with a magnet that never turns off. Cool the wire to four degrees above absolute zero and it loses all resistance, so once the current’s flowing, nobody has to push it. It’s been circling for years.',
      },
      {
        // Zone 4b — THEREFORE: the protons, almost all cancelling out
        step: 5,
        labels: ['Hydrogen protons'],
        narration:
          'Therefore every proton in your body tries to line up with that field. But almost all of them cancel out in pairs, and only a handful refuse.',
      },
      {
        // Zone 4c — the RF pulse that listens for the leftovers
        step: 6,
        labels: ['Birdcage body coil'],
        narration:
          'So a radio pulse tips those leftovers over. When they spring back, they broadcast, and a coil is built just to catch that whisper.',
      },
      {
        // Zone 5 — the stat, isolated with a beat of space
        step: 5,
        labels: ['Hydrogen protons', 'Net magnetisation'],
        narration: 'Six protons in a million. That’s every MRI picture you’ve ever seen.',
      },
      {
        // Zone 6+7 — so-what, then the callback button
        step: 8,
        dolly: 2.1,
        narration:
          'Because it’s radio waves, not X-rays, doctors can scan you again and again with zero radiation. Six protons in a million. One whole picture.',
      },
    ],
  },
};
