// Editorial layer for video export (scripts/export-video.mjs).
//
// LENS: "your air fryer has never fried anything" — the packaging promise is
// the honest reveal, so the first spoken line states it flat and the button
// closes it. Planted loop: "the part doing the work isn't even the hot part"
// (shot 1) → "the fan, not the heat, is what crisps your chips" (shot 8).
//
// SCRIPTING: one flowing single-take voiceover; each line hands off into the
// next. No em/en dashes anywhere — ElevenLabs renders them as dead air.
//
// SHOT ROUTING NOTE (2026-08-26): the fan beat is narrated over step 4
// (`circuit`) rather than step 3 (`fan`). At the fan step's camera the roof
// plate occludes all but one blade (PLATE_R_IN === FAN_R in model.js), so a
// hero shot there would show a grey disc while the voice says "axial fan".
// If that clearance is ever fixed, step 3 is the better home for shot 4.
export default {
  hook: 'Your air fryer has never\nfried anything.',

  // 9:16 — ~90s at the channel voice's pace (dense mechanism, 8 beats).
  short: {
    shots: [
      {
        // Zone 1 — hook: the promise, stated flat, plus the planted loop
        step: 0,
        dolly: 2.1,
        labels: ['Basket drawer'],
        narration:
          'Your air fryer has never fried anything. No oil, nothing touching the food, and the part doing the work isn’t even the hot part.',
      },
      {
        // Zone 2+3 — strip it back, then the spoken question
        step: 1,
        dolly: 1.75,
        labels: ['Heating element', 'Fan'],
        narration:
          'Ghost the shell and there are only two things in here. A coil of hot wire, and a fan. So what is actually crisping your chips?',
      },
      {
        // Zone 4a — rule the obvious suspect out
        step: 2,
        dolly: 1.5,
        labels: ['Nichrome element — 1,500 W'],
        narration:
          'The coil is basically a toaster. Fifteen hundred watts through nichrome wire. Left alone, it would scorch the tops and leave the bottoms raw.',
      },
      {
        // Zone 4b — BUT: the fan, and the closed circuit it drives
        step: 4,
        dolly: 1.6,
        labels: ['Blown down over the coil', 'Out through the floor', 'Back into the fan'],
        narration:
          'But right above it sits a fan, and that is the real invention. The air has nowhere to escape, so the same air just loops around, again and again. That basket floor isn’t a tray with holes. It’s a duct.',
      },
      {
        // Zone 5 — the stat, isolated on its own beat (same step, camera holds)
        step: 4,
        dolly: 1.6,
        narration:
          'And one number explains this whole machine. Air hits your food at five metres a second. A convection oven manages zero point nine.',
      },
      {
        // Zone 4c — what that speed physically does
        step: 5,
        dolly: 1.45,
        labels: ['Vapour film'],
        narration:
          'Speed matters because hot food wears a skin of its own steam, and it keeps the surface wet. Slow air lets it sit. Fast air strips it off, so the surface can finally dry and brown.',
      },
      {
        // Zone 6 — the honest so-what
        step: 6,
        dolly: 1.45,
        labels: ['Maillard crust'],
        narration:
          'Past a hundred and forty degrees, that dry surface browns for real. But it never fries. Oil carries heat about ten times harder than moving air can.',
      },
      {
        // Zone 7 — button, closes the loop, sets up the replay
        step: 7,
        dolly: 2.1,
        narration:
          'So it’s a tiny, ferocious oven wearing a better name. The fan, not the heat, is what crisps your chips.',
      },
    ],
  },

  platforms: {
    shorts: {
      title: 'Your air fryer has never fried anything',
      hashtags: '#airfryer #howitworks #engineering #science #whatdstuff',
    },
  },
};
