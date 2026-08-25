// Editorial layer for video export (scripts/export-video.mjs).
// steps: 0 sealed product · 1 lid off / whole optical train · 2 arc lamp
//        3 colour wheel · 4 the DMD up close · 5 the ±12° tilt + light dump
//        6 colour from time · 7 re-sealed finale
//
// STORY LENS: not "how a projector works" but "a projector cannot project
// black, so it makes black by throwing light in the bin." The dumped light is
// the loop, the two-position mirror is the payoff, and the rainbow flicker
// people have actually seen on a projector screen is the everyday consequence
// that proves it.
//
// Deliberately CUT from the short: the integrator rod, the fold mirror, and
// the whole "lid off" anatomy step. They are true and they are in the
// explainer, but they are not on this spine — one story told properly beats
// six parts named in a row.
export default {
  hook: 'Your projector throws away\nhalf the light it makes.',

  // 9:16 — single-take narration + word-synced caption rail. ~75s.
  // Arc: hook (it throws light away) -> stakes/loop (so where does it go?)
  // -> mechanism (lamp -> colour wheel -> mirror chip) -> re-hook (two
  // positions, nothing between) -> isolated stat (two million, thousands of
  // times a second) -> the answer to the loop (the black block) -> so-what
  // (the rainbow flicker) -> button, closing the "thrown away" loop.
  short: {
    dolly: 1.7, // portrait crops the sides of this landscape-framed body
    shots: [
      {
        // 1. hook — the boldest true sentence, word one
        step: 0,
        dolly: 1.9,
        labels: [], // clean product shot: the hook carries this beat, not callouts
        narration: 'Your projector throws away half the light it makes. On purpose.',
      },
      {
        // 2. stakes + the loop this whole script closes
        step: 0,
        dolly: 1.9,
        labels: [],
        narration:
          "Because it can't project darkness. It can only take light away. So where does it go?",
      },
      {
        // 3. mechanism — the source
        step: 2,
        dolly: 1.5,
        labels: ['Arc gap — about 1 mm'],
        // Long enough for the camera to ARRIVE. The first cut of this line was
        // seven words (~2.5s), and the fly-to from the wide hero shot eats
        // ~1.3s of that, so the words "arc lamp" landed while the frame still
        // showed the lens barrel. The extra clause also pays off the label
        // this shot targets.
        narration:
          'Inside, one arc lamp burns white hot, an electric arc jumping a gap about a millimetre wide.',
      },
      {
        // 4. mechanism — BUT: the light is never white by the time it leaves
        step: 3,
        dolly: 1.6,
        labels: ['Dichroic filter segments'],
        narration:
          'But its light never leaves white. A spinning disc of coloured glass chops it into red, then green, then blue, a thousand times a second.',
      },
      {
        // 5. mechanism — THEREFORE the picture is built one colour at a time
        step: 4,
        dolly: 1.45,
        labels: ['One mirror = one pixel'],
        narration:
          'So the picture gets built one colour at a time, on a chip covered in mirrors. One for every pixel.',
      },
      {
        // 6. re-hook — the counterintuitive beat the whole video turns on
        step: 5,
        // NOTE: shots 6, 7 and 8 all sit on step 5, and player.js's activate()
        // early-returns when the step doesn't change — so no fly-to runs and
        // only the FIRST of the three actually applies its dolly. All three
        // carry the same number deliberately; editing shot 8's alone does
        // nothing (which cost a render to discover).
        // 2.2 rather than a tighter framing because this run of shots has to
        // hold BOTH destinations at once: the lens the "on" mirrors aim at and
        // the light dump the "off" ones aim at, which is exactly what the
        // "toward the lens, or twelve degrees away" line is contrasting.
        dolly: 2.2,
        // The two DESTINATIONS, not the tilt angle. '−12° — straight down the
        // lens' is anchored at the array's top corner and its pill ran off the
        // right edge in portrait; these two are anchored on the lens marker and
        // the dump block themselves, both safely inside the 9:16 crop, and they
        // are literally the two things this line contrasts.
        labels: ['Projection lens', 'Light dump — +12° ends here'],
        // humanizer pass: the draft ran four clipped sentences back to back and
        // ended on the tailing negation "Nothing in between." One emphatic
        // fragment is fine, a run of them is manufactured drama. The re-hook
        // opener stays: video-scripting sanctions it, and retention beats
        // humanizer's flattening instinct there.
        narration:
          "Here's the part that gets me. Each mirror has only two positions: twelve degrees toward the lens, or twelve degrees away. It can't sit in between.",
      },
      {
        // 7. the stat, isolated, with no label competing for the eye
        step: 5,
        dolly: 2.2, // inherited from shot 6; see the note there
        labels: [],
        narration: 'Two million of them, each flipping thousands of times a second.',
      },
      {
        // 8. the loop's mechanical answer: this is where the light goes
        step: 5,
        dolly: 2.2, // inherited from shot 6; see the note there
        // Deliberately empty, not an oversight: shot 7 cleared every callout,
        // and the exporter only ever NARROWS the currently-visible set (it
        // refuses to resurrect a hidden label, so a name from another callout
        // set can't be forced on). Naming the dump here would silently do
        // nothing. It doesn't need the pill anyway: at this dolly the block is
        // in frame with the off-rays visibly landing in it while the line
        // names it.
        labels: [],
        narration:
          'Tilt one away and its light hits a black block and dies as heat. Grey is just a mirror aimed at that block most of the time.',
      },
      {
        // 9. so-what — the thing the viewer has actually seen happen
        step: 6,
        dolly: 1.55,
        labels: ['What your eye adds up'],
        // humanizer pass: four mid-length sentences in a row read as a flat
        // right edge. Merged the last two behind a "but" so the beat has a
        // transition and a long sentence to land on.
        narration:
          'Your eye never catches the switching. It just blends the colours into one picture. But glance across the screen and the blend breaks, and that rainbow flicker is the machine showing through.',
      },
      {
        // 10. button — closes the loop word for word, and sets up the replay
        // Back to step 0, NOT the step-7 finale. Shorts loop, so the last frame
        // is also the first frame the next viewer sees. Step 7's turntable
        // makes a full revolution per lap and the shot lands at an arbitrary
        // point in it, which left the video ending on the BACK of the
        // projector, vent to camera, no lens in sight. Step 0 rocks through a
        // few degrees instead, so the closing frame is always the composed
        // hero pose the hook opens on and the loop is seamless. The 1.3s
        // fly-to reads as a deliberate pull-back on the closing line.
        step: 0,
        dolly: 1.9,
        labels: [],
        narration: "Black isn't projected. It's thrown away.",
      },
    ],
  },
};
