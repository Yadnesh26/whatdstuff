// Editorial layer for video export (scripts/export-video.mjs).
//
// LENS: a QR code is mostly not your data. Four squares in five are scaffolding
// and armour, and that is the whole reason the thing survives contact with the
// real world. Planted loop: "so you can wreck it and still read it" (shot 2) →
// "Most of it was never your data. It's armour." (button), which also re-primes
// the hook on replay.
//
// SCRIPTING: one flowing single-take voiceover; each line hands off into the
// next (shot 4 ends on the ratio, shot 5 opens "a Japanese engineer picked that
// ratio"; shot 7 ends on "error correction", shot 8 opens "bury thirteen of
// them"). No em/en dashes anywhere — ElevenLabs renders them as dead air.
//
// STAT PLACEMENT: the isolated number is twenty-eight of forty-four codewords
// being pure correction. The 625/128 split is staged earlier as the hook's
// evidence, so the stat beat gets the one nobody predicts.
//
// FRAMING NOTE: nearly every callout in this model is parented to `panel` (the
// whole plaque), so naming one in `frame` frames the entire code rather than a
// macro on that part. That is the right subject for almost every shot here, and
// the mint role highlight does the pointing instead of the camera. The two
// exceptions are rail-parented: '28 Reed–Solomon codewords' frames the codeword
// rail, which is exactly what the stat beat is about.
// LABEL CONSTRAINT: export-video.mjs's per-shot `labels` filter can only
// NARROW what the step's onEnter already turned on, and activate() is a no-op
// when consecutive shots share a step. So across a run of shots on one step the
// label list must start wide and only shrink. Shots 4/5 (step 'finder') and 7
// (step 'ec') each name a callout the shot before them must therefore already
// have had on, or it renders with no callout at all.
export default {
  hook: "Four out of five squares here aren't your data at all.",

  // Declared render config (see export-content skill, step 0). captions and
  // followOverlay were both requested explicitly by name; no end card.
  render: {
    formats: ['short'],
    captions: true,
    captionStyle: 'bold-karaoke',
    titleCard: true,
    endCard: false,
    followOverlay: true,
    fps: 30,
  },

  // Posting copy, authored with the script rather than at upload time
  // (scripts/make-postkit.mjs reads this). Only `shorts` is filled in: this
  // explainer ships the 9:16 short alone, so the long-form YouTube fields stay
  // unauthored on purpose rather than being invented for a video that does not
  // exist.
  platforms: {
    shorts: {
      title: "Four out of five squares in a QR code aren't your data",
      hashtags: [
        '#qrcode',
        '#howitworks',
        '#engineering',
        '#3danimation',
        '#reedsolomon',
        '#errorcorrection',
        '#tech',
        '#scienceexplained',
      ],
    },
  },

  // 9:16 — ~78s at the channel voice's pace (8 beats).
  short: {
    shots: [
      {
        // Zone 1 — hook, on the complete code. No callouts: the hook names no
        // part, and a clean product shot stops the scroll.
        step: 0,
        labels: [],
        frame: ['Version 2 — 25 × 25 modules'],
        fill: 0.9,
        narration: "Four out of five squares here aren't your data at all.",
      },
      {
        // Zone 2 — the raw numbers behind the hook, and the planted loop. Step 4
        // lights exactly the 128 message modules, so the claim is visibly true.
        step: 4,
        labels: ['The message itself sits here'],
        frame: ['The message itself sits here'],
        fill: 0.95,
        narration:
          'Six hundred and twenty-five squares, and your message fills a hundred and twenty-eight. The rest is there so you can wreck it and still read it.',
      },
      {
        // Zone 3 — the spoken question, back on the whole code.
        step: 0,
        labels: ['Version 2 — 25 × 25 modules'],
        frame: ['Version 2 — 25 × 25 modules'],
        fill: 0.8,
        narration: "So what's in all the other squares?",
      },
      {
        // Zone 4a — mechanism: the finders and the run a scanner hunts for.
        step: 1,
        labels: ['Finder pattern — 7 × 7', '1 : 1 : 3 : 1 : 1', 'No finder — that sets which way is up'],
        frame: ['Finder pattern — 7 × 7'],
        fill: 0.92,
        narration:
          'Start with the three big eyes. Cut a line through any one and you cross black, white, black, white, black, in a ratio of one, one, three, one, one.',
      },
      {
        // Zone 4b — THEREFORE: why that particular ratio. Camera holds; this is
        // one continuous thought with the shot above.
        step: 1,
        labels: ['1 : 1 : 3 : 1 : 1', 'No finder — that sets which way is up'],
        frame: ['Finder pattern — 7 × 7'],
        fill: 0.92,
        narration:
          'A Japanese engineer picked that ratio in nineteen ninety-four because it was the rarest pattern in print. So your phone sweeps every row of the picture, and almost nothing else trips it.',
      },
      {
        // Zone 4c — BUT: the fourth corner is deliberately empty. Pull back a
        // little so the bare corner is legible.
        step: 1,
        labels: ['No finder — that sets which way is up'],
        frame: ['No finder — that sets which way is up'],
        fill: 0.88,
        narration:
          "But there are only three eyes, never four. That bare corner is how your phone knows which way up you're holding it.",
      },
      {
        // Zone 5 — the stat, isolated, with a beat of space. Rail-parented
        // callout, so the solver frames the codeword rail itself.
        step: 5,
        labels: ['28 Reed–Solomon codewords', '13 codewords buried — 14 is the limit'],
        frame: ['28 Reed–Solomon codewords', '13 codewords buried — 14 is the limit'],
        fill: 0.92,
        narration:
          "Here's the part that gets me. Twenty-eight of this code's forty-four chunks are pure error correction.",
      },
      {
        // Zone 5b — the stat made physical: the sticker lands, the rail goes
        // red, the spares rebuild it. Closes the loop planted in shot 2.
        step: 5,
        labels: ['13 codewords buried — 14 is the limit'],
        frame: ['13 codewords buried — 14 is the limit'],
        fill: 0.95,
        narration: 'Bury thirteen of those chunks under a sticker and it still reads perfectly.',
      },
      {
        // Zone 6 — the everyday consequence, on the phone actually reading it.
        // frame: null so the handset and its beams stay in shot with the code.
        step: 8,
        labels: ['Three finders, four corners', 'Unmask, then Reed–Solomon'],
        frame: ['Three finders, four corners', 'Unmask, then Reed–Solomon'],
        fill: 0.9,
        narration:
          'Which is why a battered parking meter still scans, and why a company can print a logo over the middle.',
      },
      {
        // Zone 7 — button. Back to the clean complete code, same framing as
        // shot 1, so the loop hands straight back into the hook on replay.
        step: 0,
        labels: [],
        frame: ['Version 2 — 25 × 25 modules'],
        fill: 0.9,
        narration: "Most of it was never your data. It's armour.",
      },
    ],
  },
};
