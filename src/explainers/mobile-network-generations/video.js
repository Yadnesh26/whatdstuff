// Editorial layer for video export (scripts/export-video.mjs).
//
// LENS (from story.js): no generation ever made radio faster. A wave travels at
// its 1901 speed and Shannon's limit has not moved, so every G is the same steel
// buying speed with the same three coins. What actually changes each time is how
// the network stops you waiting your turn. Planted loop: "your place in the
// queue" (shot 2) -> "The queue did" (button), which also re-primes the hook on
// replay.
//
// SCRIPTING: one flowing single-take voiceover; every line hands off into the
// next (shot 3 asks where the speed comes from, shot 4 starts answering). No
// em/en dashes and no ellipses anywhere, since ElevenLabs renders both as dead
// air the speed knob cannot compress. Every figure is spelled out in words so
// the TTS reads it as speech and the verbatim caption rail matches.
//
// STAT PLACEMENT: the isolated number is the two-million-times span from one
// 2G timeslot (9.6 kbit/s) to 5G peak (~20 Gbit/s). The 200 kHz, 5 MHz and
// 20 MHz figures are staged earlier as credibility toward the mechanism; the
// ratio is the one nobody sees coming, so it gets a hard cut onto the five-block
// staircase with no callouts competing for the frame.
//
// LABEL TRAP: export-video matches `labels` and `frame` against a callout's LIVE
// textContent. Two pills here are rewritten every frame by model.js and can
// NEVER be named: the constellation readout (QPSK -> 16-QAM -> ...) and the
// finale's generation pill (2G -> 3G -> ...). Shots on steps 4 and 8 use
// `labels: []` and frame on a neighbouring part instead.
//
// FRAMING NOTE: model.js parents every callout to the real part group, so a
// `frame` key resolves to that group's bounds. Several keys share a parent by
// design: anything on the spectrum rail frames `bench` (the whole 3.1u rail,
// which is the right subject for a "how wide" claim), and the three
// access-panel keys frame the whole panel.
export default {
  hook: "5G didn't make radio any faster.",

  // Declared render config (see export-content skill, step 0). Captions and the
  // follow overlay were both requested explicitly by name.
  render: {
    formats: ['short'],
    captions: true,
    captionStyle: 'bold-karaoke',
    titleCard: true,
    endCard: false,
    followOverlay: true,
    fps: 30,
  },

  // 9:16 — ~85s at the channel voice's pace (195 words, 10 spoken beats, 23 shots).
  //
  // FRAMING NOTES:
  //  1. The solver owns distance, so there is no `dolly` anywhere.
  //  2. The spectrum rail is 3.1u wide in a PORTRAIT frame, so it is width
  //     limited and wants a high fill; the constellation plate and a single
  //     handset are small and want a low one, or the lens lands on top of them.
  //  3. Nothing in this scene turntables, so the picture only moves when the
  //     camera does. Every silent shot therefore carries a push, orbit or cut.
  short: {
    shots: [
      {
        // Zone 1 — hook, on the complete sealed site. No callouts: the claim
        // names no part, and a clean product shot is what stops the scroll.
        step: 0,
        labels: [],
        frame: ['One mast, thirty years'],
        fill: 0.72,
        narration: "5G didn't make radio any faster. Nothing has, since 1901.",
      },
      {
        step: 0,
        labels: ['Sector antenna'],
        frame: ['Sector antenna'],
        fill: 0.5,
        push: 0.9,
        seconds: 3.0,
      },

      {
        // Zone 2 — second surprise, and the planted loop ("the queue")
        step: 0,
        labels: ['One mast, thirty years', 'Base station cabinet'],
        frame: ['One mast, thirty years'],
        fill: 0.68,
        narration:
          "So every G you've ever used ran on the same steel tower and the same physics. What changed was your place in the queue.",
      },
      {
        // Was a tight cut on the cabinet, which is the one featureless grey box
        // in the scene and landed at ~4.5s, the worst possible place for a dull
        // frame. A lit handset is what "your place in the queue" actually means,
        // and it plants the three users before the 5G beam beat pays them off.
        step: 0,
        labels: [],
        frame: ['A beam each'],
        fill: 0.42,
        rise: 0.1,
        seconds: 3.0,
      },
      { step: 0, labels: [], frame: ['One mast, thirty years'], fill: 0.66, orbit: 10, seconds: 3.2 },

      {
        // Zone 3 — the mystery, said out loud, tight on the antenna
        step: 0,
        labels: ['Sector antenna'],
        frame: ['Sector antenna'],
        fill: 0.44,
        push: 0.92,
        narration: 'But if the radio never changed, where is the speed coming from?',
      },

      {
        // Zone 4a — 2G: literal turns
        step: 1,
        labels: ['Eight turns · one talker'],
        frame: ['Eight turns · one talker'],
        fill: 0.86,
        move: 'cut',
        narration:
          "Start with 2G. One channel, two hundred kilohertz wide, cut into eight turns. You get one, and you're silent for the other seven.",
      },
      {
        step: 1,
        labels: ['Eight turns · one talker'],
        frame: ['Eight turns · one talker'],
        fill: 0.7,
        push: 0.9,
        seconds: 3.0,
      },
      {
        // the 200 kHz sliver at the far left of the decade rail
        step: 1,
        labels: ['200 kHz — the whole channel', 'One tick = ten times'],
        frame: ['200 kHz — the whole channel', 'Eight turns · one talker'],
        fill: 0.78,
        seconds: 3.4,
      },

      {
        // Zone 4b — THEREFORE 3G: turns abolished, codes instead
        step: 2,
        labels: ['5 MHz — 25× wider', 'All three, all the time'],
        frame: ['5 MHz — 25× wider', 'All three, all the time'],
        fill: 0.78,
        narration:
          'So 3G threw the turns out. Everyone talks at once across a channel twenty five times wider, and each phone hides its bits under its own code.',
      },
      {
        step: 2,
        labels: ['All three, all the time'],
        frame: ['All three, all the time'],
        fill: 0.74,
        push: 0.9,
        seconds: 3.2,
      },
      {
        step: 2,
        labels: ['On the air: one hash'],
        frame: ['On the air: one hash'],
        fill: 0.72,
        seconds: 3.0,
      },

      {
        // Zone 4c — BUT 4G: turns come back, tiny
        step: 3,
        labels: ['A fresh deal every ms'],
        frame: ['A fresh deal every ms'],
        fill: 0.76,
        narration:
          'But codes hit a ceiling, so 4G brought turns back and shrank them. It dices the channel into a grid and re-deals it every millisecond.',
      },
      {
        step: 3,
        labels: ['12 subcarriers × 0.5 ms'],
        frame: ['12 subcarriers × 0.5 ms'],
        fill: 0.7,
        push: 0.9,
        seconds: 3.2,
      },
      {
        step: 3,
        labels: ['20 MHz, diced into tiles', 'A fresh deal every ms'],
        frame: ['20 MHz, diced into tiles', 'A fresh deal every ms'],
        fill: 0.78,
        seconds: 3.0,
      },

      {
        // Zone 4d — the re-hook, and the lever 5G actually leans on
        step: 5,
        labels: ['64 elements: 16 × 4'],
        frame: ['64 elements: 16 × 4'],
        fill: 0.52,
        move: 'cut',
        narration:
          "Here's the part that gets me. 5G stopped taking turns. Sixty four tiny antennas aim a private beam at each phone, so the same tile goes to three people at once.",
      },
      {
        step: 5,
        labels: ['A beam each'],
        frame: ['A beam each', '64 elements: 16 × 4'],
        fill: 0.62,
        seconds: 3.0,
      },
      {
        step: 5,
        labels: ['64 elements: 16 × 4', 'A beam each'],
        frame: ['One mast, thirty years'],
        fill: 0.72,
        orbit: 12,
        seconds: 3.6,
      },

      {
        // Zone 5 — THE STAT. Hard cut onto the five-width staircase, no
        // callouts competing for the frame.
        step: 6,
        labels: [],
        frame: ['Lever 1 — how wide'],
        fill: 0.8,
        move: 'cut',
        narration:
          'One 2G turn carried nine point six kilobits a second. 5G peaks near twenty gigabits. That is two million times more, off the same steel.',
      },
      {
        step: 6,
        labels: ['Lever 1 — how wide', 'Lever 2 — how dense'],
        frame: ['Lever 1 — how wide'],
        fill: 0.76,
        push: 0.93,
        seconds: 3.4,
      },

      {
        // Zone 6 — so-what: what 6G is actually for
        step: 7,
        labels: ['256 elements · it listens'],
        frame: ['256 elements · it listens'],
        fill: 0.5,
        narration:
          "Which is why 6G isn't chasing speed. It listens for its own echoes, so the beam already knows where you are.",
      },
      {
        step: 7,
        labels: ['256 elements · it listens'],
        frame: ['One mast, thirty years'],
        fill: 0.7,
        seconds: 3.2,
      },
      {
        step: 7,
        labels: [],
        frame: ['One mast, thirty years'],
        fill: 0.68,
        orbit: 10,
        seconds: 3.4,
      },

      {
        // Zone 7 — button. Closes the queue loop and re-primes the hook on
        // replay. The finale's own pill is live-rewritten, so labels stay off.
        step: 8,
        labels: [],
        frame: ['One mast, thirty years'],
        fill: 0.7,
        narration: 'The wave never got faster. The queue did.',
      },
    ],
  },

  platforms: {
    shorts: {
      title: "5G didn't make radio any faster",
      hashtags: ['#5g', '#6g', '#technology', '#howitworks', '#whatdstuff'],
    },
  },
};
