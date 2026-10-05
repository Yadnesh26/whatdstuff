// Editorial layer for video export (scripts/export-video.mjs).
//
// LENS (from story.js): an earthquake isn't the ground starting to move — it
// has been moving the whole time. Planted loop: "that motion is already
// loading the next earthquake" (shot 2) -> "already bending toward the next
// one" (button), which also re-primes the hook on replay.
//
// SCRIPTING: one flowing single-take voiceover; every line hands off into the
// next. No em/en dashes anywhere, since ElevenLabs renders them as dead air
// the speed knob cannot compress.
//
// STAT PLACEMENT: "fingernail speed... six metres sideways in under a
// minute" is the isolated number — it reuses the SAME fault-line/fence shot
// from the hook (shot 1) as a hard cut, so the visual proof of the offset
// fence lines lands right on the number. lint-script.mjs's `no-stat` still
// fires here: every number is spelled out for the TTS/caption rail ("six",
// "three and a half") and its NUM regex only matches twelve-plus number
// words or 3+ digit runs, per its own comment. Known false negative, not a
// missing beat.
export default {
  hook: 'The ground under your feet\nis moving right now.',

  // Requested explicitly: captioned + follow overlay. No end card (not asked).
  render: {
    formats: ['short'],
    captions: true,
    captionStyle: 'bold-karaoke',
    titleCard: true,
    endCard: false,
    followOverlay: true,
    fps: 30,
  },

  // 9:16 — ~80s at the channel voice's pace (183 words, 9 spoken beats, 20 shots).
  short: {
    shots: [
      {
        // Zone 1 — hook, on the complete block, no callouts
        step: 0,
        labels: [],
        frame: null,
        fill: 0.68,
        narration: 'The ground under your feet is moving right now. You’ve never felt it.',
      },
      {
        step: 0,
        labels: ['Fault line'],
        frame: ['Fault line'],
        fill: 0.55,
        push: 0.92,
        seconds: 1.4,
      },

      {
        // Zone 2 — second surprise + planted loop, on the creep arrow
        step: 0,
        labels: ['Plate creeping · ~3.5 cm/yr'],
        frame: ['Plate creeping · ~3.5 cm/yr'],
        fill: 0.48,
        narration:
          'Under that ground, a fault like the San Andreas creeps about three and a half centimetres a year. That’s already loading the next earthquake.',
      },

      {
        // Zone 3 — the spoken question, wide, no callouts yet
        step: 1,
        labels: [],
        frame: null,
        fill: 0.66,
        narration: 'So why does the ground ever feel still?',
      },

      {
        // Zone 4a — BUT: locked and bending
        step: 1,
        labels: ['Locked fault', 'Rock bending · storing strain'],
        frame: ['Locked fault', 'Rock bending · storing strain'],
        fill: 0.62,
        narration:
          'Because the fault is jammed shut by friction, holding it still. The plates keep sliding, but the rock at the fault can’t, so it bends instead, like a ruler flexed in your hands.',
      },
      {
        step: 1,
        labels: ['Rock bending · storing strain'],
        frame: ['Locked fault', 'Rock bending · storing strain'],
        fill: 0.5,
        push: 0.9,
        seconds: 2.2,
      },

      {
        // Zone 4b — re-hook, THEREFORE: rupture starts and unzips
        // Solo-framed on just this marker, the solver fits the TINY marker
        // sphere itself (real geometry, but small on purpose), producing an
        // extreme macro blur instead of the rupture patch. Pairing it with
        // the other rupture marker gives the solver a real span to frame —
        // ~0.9 units apart — while `labels` still shows only this pill.
        step: 2,
        labels: ['Hypocentre · ~10 km down'],
        frame: ['Hypocentre · ~10 km down', 'Slip spreads · ~3 km/s'],
        fill: 0.56,
        move: 'cut',
        narration:
          'Here’s the part that gets me. Friction always loses eventually. The break starts ten kilometres down and rips along the fault at three kilometres a second, snapping the bent rock straight as it goes.',
      },
      {
        step: 2,
        labels: ['Slip spreads · ~3 km/s'],
        frame: ['Hypocentre · ~10 km down', 'Slip spreads · ~3 km/s'],
        fill: 0.52,
        push: 0.9,
        seconds: 2.4,
      },
      {
        step: 2,
        labels: ['Hypocentre · ~10 km down', 'Slip spreads · ~3 km/s'],
        frame: ['Hypocentre · ~10 km down', 'Slip spreads · ~3 km/s'],
        fill: 0.62,
        orbit: 10,
        seconds: 2.2,
      },

      {
        // Zone 4c — THEREFORE: the waves that spring-back fires
        step: 3,
        labels: ['P wave · ~6 km/s', 'S wave · ~3.5 km/s'],
        frame: ['P wave · ~6 km/s', 'S wave · ~3.5 km/s'],
        fill: 0.7,
        narration:
          'That spring-back fires two waves through the rock. A fast push-pull wave, then a slower, harder shake seconds behind it.',
      },
      {
        step: 3,
        labels: ['P wave · ~6 km/s', 'S wave · ~3.5 km/s'],
        frame: ['P wave · ~6 km/s', 'S wave · ~3.5 km/s'],
        fill: 0.58,
        push: 0.88,
        seconds: 2.6,
      },
      {
        step: 3,
        labels: ['Seismogram'],
        frame: ['Seismogram'],
        fill: 0.6,
        seconds: 2.0,
      },

      {
        // Zone 5 — THE STAT. Hard cut back onto the fence-line proof shot.
        step: 0,
        labels: ['Fault line'],
        frame: ['Fault line'],
        fill: 0.5,
        move: 'cut',
        narration:
          'So rock bent at fingernail speed can snap six metres sideways, in under a minute.',
      },
      {
        step: 0,
        labels: ['Fault line'],
        frame: ['Fault line'],
        fill: 0.44,
        push: 0.92,
        seconds: 2.6,
      },

      {
        // Zone 6 — so-what: the slow waves that actually do the damage
        step: 4,
        labels: ['Surface waves'],
        frame: ['Surface waves'],
        fill: 0.66,
        narration:
          'That sideways snap rolls the ground itself once it reaches the surface, and those slow rolling waves are what actually tear buildings apart.',
      },
      {
        step: 4,
        labels: ['Surface waves'],
        frame: null,
        fill: 0.7,
        rise: 0.08,
        seconds: 2.4,
      },

      {
        // Zone 7 — button, closes the loop, sets up the replay on the hero shot
        step: 5,
        labels: [],
        frame: null,
        fill: 0.68,
        narration: 'The fault locks shut again the moment it’s done. The ground is already bending toward the next one.',
      },
      {
        step: 5,
        labels: [],
        frame: null,
        fill: 0.66,
        orbit: 12,
        seconds: 2.6,
      },
    ],
  },

  platforms: {
    shorts: {
      title: 'The ground never actually stops moving',
      hashtags: ['#earthquake', '#geology', '#howitworks', '#science', '#whatdstuff'],
    },
  },
};
