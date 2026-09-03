// Editorial layer for video export (scripts/export-video.mjs).
// One flowing voiceover, single-take TTS + audio-master pacing; captions are
// the word-synced verbatim rail (--captions), not per-shot caption strings.
//
// steps: 0 sealed package · 1 contacts · 2 die · 3 floorplan · 4 pipeline
//        5 clock · 6 execute · 7 cache · 8 running
//
// Short lens: the chip outran its own memory. Everything clever inside it —
// the pipeline, the cache hierarchy — exists to hide the wait. Loop: "solves a
// single problem" (planted shot 2, named in shot 7, closed in the button).
// Shot 1 skips the contacts step: the hook has to be on the sealed tile, and
// the pad grid is a beat the 70s cut cannot afford.
export default {
  hook: 'In one tick, light only\ncrosses your thumb.',

  // 9:16 — ~70s.
  short: {
    shots: [
      {
        // 1. hook: the speed claim, then the concrete stack
        step: 0,
        dolly: 2.05,
        labels: [],
        narration:
          'Your processor ticks five billion times a second. In that time, light only crosses your thumb.',
      },
      {
        // 2. reveal + planted loop
        step: 2,
        dolly: 1.9,
        labels: ['The silicon die'],
        narration:
          'But the thing doing it is tiny. Lift the lid and the whole computer is a fingernail of silicon, and almost every clever thing in it solves a single problem.',
      },
      {
        // 3. the floorplan
        step: 3,
        dolly: 2.1,
        labels: ['Core', 'Ring bus'],
        narration:
          'So zoom in. That speck is a city, and each bright block is a full core, linked by a ring road.',
      },
      {
        // 4. the answer: it never does one job at a time
        step: 4,
        dolly: 2.25,
        labels: ['All of this is one core'],
        narration:
          'But no core does one job at a time. The work splits across five stations, like a factory line, with five instructions moving at once.',
      },
      {
        // 5. the clock drives the line
        step: 5,
        dolly: 2.25,
        labels: ['Clock — one tick, one step'],
        narration:
          'So every clock tick, all five slide one station along. Fetch, decode, execute, memory, write back. One finished answer drops off the end.',
      },
      {
        // 6. re-hook: the anticlimax at the centre of it
        step: 6,
        dolly: 2.0,
        labels: ['Register file', 'Arithmetic logic unit'],
        narration:
          "Here's the part that gets me. All that machinery just adds binary, column by column, carrying the one, exactly like you did at school.",
      },
      {
        // 7. the stat, isolated: the problem the loop was about
        step: 7,
        dolly: 2.4,
        labels: ['L1 — about 4 cycles', 'Main memory — hundreds'],
        narration:
          "But it's starving. Its own cache answers in about four ticks, and main memory takes hundreds.",
      },
      {
        // 8. button, closes the loop
        step: 8,
        dolly: 1.75,
        labels: [],
        narration:
          "That's the problem. The rest of the chip exists to hide it. Never let you see it wait.",
      },
    ],
  },
};
