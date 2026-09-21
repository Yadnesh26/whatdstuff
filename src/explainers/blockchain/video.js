// Editorial layer for video export (scripts/export-video.mjs).
//
// LENS: proof of work is deliberately wasteful, and the waste IS the
// security. Planted loop: "locked by wasted electricity, on purpose" (shot 1)
// -> "the waste isn't a bug, it's the lock" (button), which also re-primes
// the hook on replay.
//
// SCRIPTING: one flowing single-take voiceover; each line hands off into the
// next. Re-hook at the header->mining handoff ("here's the part that
// actually gets me"). Stat isolated on its own shot with a beat of space.
export default {
  hook: "This chain isn't locked by code. It's locked by wasted electricity.",

  // Declared render config (see export-content skill, step 0). captions and
  // followOverlay were both requested explicitly by name.
  render: {
    formats: ['short'],
    captions: true,
    titleCard: true,
    endCard: false,
    followOverlay: true,
    fps: 30,
  },

  // 9:16 - ~79s at the channel voice's pace (8 beats).
  short: {
    shots: [
      {
        // Zone 1 - hook, on the sealed chain. No callouts: the hook names no
        // part, and a clean product shot stops the scroll.
        step: 0,
        labels: [],
        narration:
          "This chain isn't locked by code. It's locked by wasted electricity.",
      },
      {
        // Zone 2 - stack a second surprise, plant the loop. "chain" hands off
        // from the hook.
        step: 0,
        labels: ['Its own hash — 19 leading zeros'],
        narration:
          "Each block in that chain carries a fingerprint nobody could ever guess. Right now, somewhere on Earth, a machine is guessing it anyway.",
      },
      {
        // Zone 3 - the spoken question, into the reveal. "machine"/"guessing"
        // hand off from the previous line.
        step: 1,
        labels: [],
        narration:
          "So what is that machine actually guessing at, and how do you pick a lock that has no key?",
      },
      {
        // Zone 4a - mechanism: the payments waiting to be sealed in. "Pick"
        // calls back the previous line's "pick a lock."
        step: 2,
        labels: ['Coinbase transaction - pays the miner 3.125 BTC'],
        camera: { position: [0.9, 4.0, 5.2], target: [-1.0, 0.75, 1.1] },
        narration:
          "Pick it open and it's just payments, waiting in line, plus one that pays the miner for the trouble.",
      },
      {
        // Zone 4b - BUT: too many to fit, so they get crushed.
        step: 3,
        labels: ['The merkle root — 32 bytes'],
        narration:
          "But thousands of those payments won't fit in the lock. So they get paired up and hashed, again and again, into a single 32-byte number.",
      },
      {
        // Zone 4c - THEREFORE: that number becomes the thing that gets
        // hashed. Mid-script re-hook.
        step: 4,
        labels: [],
        narration:
          "That number, plus yesterday's fingerprint, becomes today's eighty-byte header. And here's the part that actually gets me. This whole thing gets guessed.",
      },
      {
        // Zone 4d - the guessing loop itself.
        step: 5,
        labels: ['The 4 bytes a miner can change'],
        camera: { position: [2.6, 2.7, 9.0], target: [2.2, 1.35, 2.9] },
        narration:
          "So they change one number, the nonce, and hash it. Wrong. Change it again. Wrong again.",
      },
      {
        // Zone 5 - the stat, isolated, with a beat of space. "Wrong" hands
        // off from the previous line.
        step: 5,
        labels: ['Target: 19 leading zeros'],
        camera: { position: [2.6, 2.7, 9.0], target: [2.2, 1.35, 2.9] },
        narration:
          "Most of those guesses come back wrong. Roughly five hundred forty sextillion of them, before nineteen zeros finally line up, and the whole planet does that in about nine minutes.",
      },
      {
        // Zone 6 - the everyday consequence: why you can't cheat it. Closes
        // on "lock," handing off into the button.
        step: 7,
        // Override the step's default `focus` (a joint ring that starts at
        // opacity 0 and only appears mid-lap) with a part that's always
        // rendered, so the auto-framer has a real subject.
        frame: ['One record edited'],
        labels: ['One record edited'],
        fill: 0.45,
        narration:
          "Which is why cheating never works. Edit one payment and every fingerprint after it breaks. Fixing it means out-guessing the entire planet, the same lock, all over again.",
      },
      {
        // Zone 7 - button, freeOrbit finale, closes the hook's loop. No
        // `frame`/`focus` exists for this step, so the auto-framer falls
        // back to the WHOLE model root, including the fork/child blocks that
        // grow out to x~9.6 by the end of the lap - fitting that full span
        // into a 9:16 frame pushed the solved camera well past the stage's
        // fog start (16 units) into near-total fog blackout. Pin the
        // interactive step's own camera instead, already verified well-lit.
        step: 8,
        labels: [],
        camera: { position: [3.0, 5.0, 12.0], target: [3.6, 1.6, 0] },
        narration: "The waste isn't a bug. It's the lock.",
      },
    ],
  },
};
