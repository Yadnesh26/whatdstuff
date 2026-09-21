// Editorial layer for video export (scripts/export-video.mjs).
//
// LENS: most people picture a sewing machine as one thread laced through
// cloth. It's actually two threads that never touch each other directly,
// tied into a real knot buried inside the fabric, by a hook that has to
// catch a loop of thread within a tenth of a millimetre, a thousand times a
// minute. That gap between what people assume and what is actually
// happening under the plate is the lens.
//
// Planted loop: "never touched the fabric" (shot 1) -> "invisible from
// either side" (shot 2) -> "never touching" (button), same idea closed on
// its own words.
//
// SCRIPTING: one flowing single-take voiceover; each line hands off into
// the next. Re-hook mid-script on the take-up lever, the part that actually
// ties the knot. Stat isolated on its own shot, run at full speed.
//
// steps (numeric index into index.js): 0 machine (sealed) · 1 threads
//        (reveal) · 2 needle (macro, loop forms) · 3 catch (macro, hook
//        meets scarf) · 4 around (loop round the bobbin) · 5 takeup (lever
//        cinches it) · 6 feed, 7 timing (not used, short skips them) ·
//        8 run (sealed, full speed)
// The short skips feed and timing: the drive train is a lovely fact but a
// second mechanism, and the short's spine is thread -> needle -> hook ->
// bobbin -> lever -> speed.
export default {
  hook: 'One thread in every stitch you own\nhas never touched the fabric.',

  render: {
    formats: ['short'],
    captions: true,
    captionStyle: 'bold-karaoke',
    titleCard: true,
    endCard: false,
    followOverlay: true,
    fps: 30,
  },

  short: {
    shots: [
      {
        // Zone 1 - hook: the boldest true sentence, over the sealed
        // machine. No callouts; a clean product shot stops the scroll.
        step: 0,
        frame: null,
        labels: [],
        narration: 'One thread in every stitch you own has never touched the fabric.',
      },
      {
        // Zone 2 - second surprise, and the loop goes in. "Fabric" hands
        // off from the hook.
        step: 1,
        frame: null,
        labels: ['Tension discs', 'Bobbin'],
        narration:
          "It's called the bobbin thread, living under the plate, tied to the top thread, invisible from either side.",
      },
      {
        // Zone 3 - the spoken question. Camera holds on the reveal.
        step: 1,
        labels: [],
        narration: 'So how does a needle get two threads that never touch tied together?',
      },
      {
        // Zone 4 - mechanism beat one: the needle's eye is at the tip.
        step: 2,
        // The auto-frame solver's caption-bias lift overshoots the top edge on
        // this subject (needleBar is tall and thin, already near the fill
        // limit) - an explicit camera is the sanctioned escape hatch, reusing
        // the step's own tuned macro from index.js.
        camera: { position: [-0.843, 0.636, 0.26], target: [-0.848, 0.608, 0] },
        labels: ['The eye', 'The loop'],
        narration:
          "The needle has its eye right at the tip, which is what lets it dive through the cloth and leave a tiny loop of slack behind.",
      },
      {
        // Mechanism beat two, on a BUT: the tight catch window.
        step: 3,
        labels: ['Hook point', 'Bobbin case'],
        narration:
          'But that loop only lasts a hundredth of a second. A hook must catch it within a tenth of a millimetre, or the stitch skips.',
      },
      {
        // Mechanism beat three, on a THEREFORE: the loop travels the
        // bobbin.
        step: 4,
        labels: ['Bobbin case', 'Position finger'],
        narration:
          'Therefore the hook drags that loop in a full circle around the bobbin, lassoing the bottom thread without slowing down.',
      },
      {
        // Mechanism beat four, re-hooked: the actual knot-tying moment.
        step: 5,
        // Same class of solver edge case as the needle shot above, this time
        // overflowing the left edge; same fix.
        camera: { position: [-0.664, 0.86, 0.25], target: [-0.854, 0.672, 0.04] },
        labels: ['Take-up lever'],
        narration:
          "That closes the loop. Here's the part that ties the knot. A lever snaps upward and hauls the slack back through the cloth, cinching both threads together.",
      },
      {
        // Zone 5 - the stat, isolated, over the machine running at full
        // speed.
        step: 8,
        labels: [],
        narration: 'A home machine repeats that knot about a thousand times a minute.',
      },
      {
        // Zone 6 - so-what: the everyday consequence.
        step: 8,
        labels: [],
        narration:
          "That seam holding your jeans, your bag, your seatbelt isn't thread laced through cloth. It's a knot, tied blind, thousands of times a day.",
      },
      {
        // Zone 7 - button. Closes the loop on the hook's own words.
        step: 8,
        labels: [],
        narration: 'Two threads, never touching, tied together anyway.',
      },
    ],
  },
};
