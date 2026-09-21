// Editorial layer for video export (scripts/render.mjs / export-video.mjs).
// Angle/stat/button are locked in story.js — this is the spoken adaptation
// of that same contract, not a new take on the mechanism.
//
// steps: 0 product (sealed deadbolt) · 1 shear-line (empty plug spins) ·
//        2 locked (five pins jam it) · 3 the-key (five ramps) ·
//        4 turn (bolt throws) · 5 wrong-key (fails like a stick) ·
//        6 picking (binding order) · 7 run (whole, fast)
export default {
  hook: 'Your lock has never once checked your key.',

  short: {
    shots: [
      {
        // hook (0-3s) — the whole sealed product, wide. Explicit frame:null
        // overrides step 0's own focus (['Bolt'], tuned for the interactive
        // scroll step) — the video hero needs the WHOLE lock, not a macro.
        step: 0,
        frame: null,
        seconds: 3,
        narration: 'Your lock has never once checked your key.',
      },
      {
        // stakes + promise — plant the loop ("stop blocking it") the
        // button closes
        step: 0,
        frame: null,
        seconds: 5,
        narration:
          'It’s just two brass cylinders with a gap between them. Your key’s only job is to stop blocking it.',
      },
      { step: 0, frame: ['Keyway'], seconds: 1.2 },
      {
        // spoken question — explicit fill (looser than default) so the thin
        // shear-line bar doesn't crop at 9:16
        step: 1,
        frame: ['Shear line'],
        fill: 0.6,
        seconds: 3,
        narration: 'So what’s actually blocking it?',
      },
      { step: 1, frame: null, orbit: 12, seconds: 1.6 },
      {
        // mechanism beat 1: locked (AND the setup) — frame narrows to the
        // single Driver pin (the combined Driver-pin+Spring box is too tall
        // for 9:16 at fill 0.88); `labels` still shows both callouts
        step: 2,
        frame: ['Driver pin'],
        labels: ['Driver pin', 'Spring'],
        seconds: 5,
        narration:
          'Pull the key out, and five springs slam five pins straight across that gap. The plug jams by brute force.',
      },
      { step: 2, labels: ['Driver pin'], camera: { position: [2.57, 6.5, 3.65], target: [-1.56, 2.61, 0.86] }, seconds: 1.4 },
      {
        // mechanism beat 2: the key (BUT)
        step: 3,
        seconds: 5.5,
        labels: ['The split'],
        narration:
          'But every cut on your key is a ramp. Push it in, and each ramp lifts its pin until the split lands on the gap.',
      },
      { step: 3, frame: ['The split'], seconds: 1.3 },
      {
        // mechanism beat 3: turn (THEREFORE) — the payoff
        step: 4,
        seconds: 5.5,
        labels: ['Bolt fork', 'Bolt'],
        narration:
          'Therefore the gap clears, the plug spins half a turn, and that turn drags a whole inch of bolt out of the door frame.',
      },
      { step: 4, camera: { position: [5.43, 8.34, 6.99], target: [-1.19, 1.65, 0.59] }, seconds: 1.4 },
      {
        // mid-video re-hook: wrong key
        step: 5,
        seconds: 6,
        labels: ['The split'],
        narration:
          'Here’s the part that gets me. A wrong key fails the same way a stick would: one pin too short, one too tall, jammed metal again, not a judgment call.',
      },
      { step: 5, camera: { position: [3.55, 4.47, 4.52], target: [-1.52, 2.33, 1.59] }, seconds: 1.3 },
      {
        // isolated stat, own hard cut, tight
        step: 1,
        seconds: 4,
        frame: ['Shear line'],
        fill: 0.7,
        narration:
          'That gap is about four thousandths of an inch. Thinner than a sheet of paper.',
      },
      {
        // real-world connection: why picking works — frame narrows to the
        // single Tension-wrench (the combined ledge+wrench box crops at
        // 9:16); `labels` still shows both callouts
        step: 6,
        frame: ['Tension wrench'],
        fill: 0.7,
        seconds: 7,
        labels: ['On the ledge', 'Tension wrench'],
        narration:
          'Which is exactly why those five holes are never perfectly lined up. One pin binds first. Set it, the plug creeps. Set the next. That’s the secret behind picking a lock with a bent wire.',
      },
      { step: 6, frame: ['Tension wrench'], labels: ['On the ledge'], fill: 0.6, push: 0.97, seconds: 1.4 },
      { step: 6, camera: { position: [3.92, 6.02, 3.0], target: [-1.24, 2.45, 1.12] }, seconds: 1.2 },
      {
        // button — closes the "stop blocking it" loop
        step: 7,
        seconds: 4,
        narration: 'Nothing in there ever checked your key.',
      },
      { step: 7, frame: null, orbit: 10, seconds: 1.6 },
    ],
  },

  render: {
    formats: ['short'],
    captions: true,
    followOverlay: { short: true },
    captionStyle: 'bold-karaoke',
    speed: 1.0, // channel-standard voice speed — the script's own default is 0.9
  },
};
