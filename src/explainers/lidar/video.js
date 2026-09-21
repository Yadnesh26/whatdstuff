// Editorial layer for video export (scripts/render.mjs / export-video.mjs).
// Angle/stat/button are locked in story.js — this is the spoken adaptation of
// that same contract, not a new take on the mechanism.
//
// steps: 0 sealed (the black can) · 1 inside (no image sensor) ·
//        2 roundtrip (fire and start a clock) · 3 clock (the true-scale ruler) ·
//        4 echo (almost nothing comes back) · 5 fan (64 beams) ·
//        6 sweep (the head spins, the cloud draws) · 7 running (sealed, alive)
//
// Loop: planted in shot 2 ("without ever seeing one"), closed word-for-word in
// the button ("It never saw the car"). The stat — 130 trillionths of a second —
// gets its own hard cut with nothing else competing for the beat.
export default {
  hook: 'The spinning can on a self-driving car is completely blind.',

  short: {
    shots: [
      {
        // hook (0-3s) — the whole sealed product, wide. frame:null overrides
        // step 0's own focus, which is tuned for the scroll page.
        step: 0,
        frame: null,
        seconds: 3,
        narration: 'The spinning can on a self-driving car is completely blind.',
      },
      { step: 0, frame: ['Smoked window'], seconds: 1.3 },
      {
        // stakes + promise — plants the loop the button closes
        step: 1,
        seconds: 6,
        labels: ['Receive lens', '32 laser diodes'],
        narration:
          'It’s blind because there’s no camera in it, and no lens to look through. But it maps every car on the street without seeing one.',
      },
      { step: 1, frame: ['32 laser diodes'], seconds: 1.9 },
      { step: 1, frame: ['Receive lens'], seconds: 1.7 },
      {
        // the spoken question, over a flash-forward to the finished cloud
        step: 7,
        camera: { position: [5.6, 6.4, 7.4], target: [0.2, 0.5, 0.2] },
        seconds: 3,
        narration: 'So how do you map a street you can’t see?',
      },
      { step: 7, camera: { position: [5.6, 6.4, 7.4], target: [0.2, 0.5, 0.2] }, orbit: 10, seconds: 1.3 },
      {
        // mechanism beat 1 — fire and start a clock
        step: 2,
        seconds: 5.6,
        fill: 0.62,
        labels: ['One 5 ns pulse out'],
        narration:
          'You time it. It fires a flash of infrared lasting five billionths of a second, and starts a clock.',
      },
      { step: 2, frame: ['One 5 ns pulse out'], fill: 0.62, seconds: 1.8 },
      {
        // mechanism beat 2 — the round trip IS the measurement
        step: 2,
        seconds: 7.5,
        fill: 0.62,
        labels: ['Echo lands on the lens', 'Target — 42 cm here, 100 m in life'],
        narration:
          'That flash scatters off whatever is out there, and a sliver comes home. Halve the round trip and you have the distance.',
      },
      { step: 2, frame: ['Echo lands on the lens'], fill: 0.62, seconds: 2.0 },
      { step: 4, frame: ['Avalanche photodiode'], seconds: 1.8 },
      {
        // re-hook — hard cut to the true-scale nanosecond bar
        step: 3,
        seconds: 3.8,
        fill: 0.62,
        labels: ['1 ns of flight = 30 cm'],
        narration: 'Here’s the part that gets me. Light covers thirty centimetres every nanosecond.',
      },
      { step: 3, frame: ['1 ns of flight = 30 cm'], fill: 0.62, seconds: 1.4 },
      {
        // THE STAT — isolated, tight on the accuracy notch, nothing else moving
        step: 3,
        seconds: 5.6,
        frame: ['±2 cm = 130 ps of clock'],
        fill: 0.7,
        labels: ['±2 cm = 130 ps of clock'],
        narration:
          'To place a car within two centimetres, that stopwatch has to resolve 130 trillionths of a second.',
      },
      { step: 3, frame: ['±2 cm = 130 ps of clock'], fill: 0.55, seconds: 2.2 },
      {
        // mechanism beat 3 — one line becomes a fan, therefore a machine
        step: 5,
        seconds: 6.4,
        labels: ['64 beams, a 26.8° fan'],
        narration:
          'But one laser is one direction. So they bolt in sixty-four, each fixed at its own angle, and spin the whole head.',
      },
      { step: 5, frame: ['Each laser at a fixed angle'], seconds: 1.7 },
      { step: 5, frame: ['64 beams, a 26.8° fan'], fill: 0.7, seconds: 1.5 },
      {
        // the payoff — the cloud is drawn by rotation
        step: 6,
        camera: { position: [4.8, 5.4, 6.4], target: [0.2, 0.6, 0.3] },
        seconds: 5.6,
        labels: ['One dot = one round trip'],
        narration:
          'Spin it, and every reading becomes a dot in space. The gaps in those rings are where a car stood.',
      },
      { step: 6, camera: { position: [4.8, 5.4, 6.4], target: [0.2, 0.6, 0.3] }, orbit: 14, seconds: 1.8 },
      {
        // so-what — the same physics that makes it work is what breaks it
        step: 4,
        seconds: 3.0,
        labels: ['A few photons come home'],
        narration: 'Which is why fog beats it. No echo, no dot.',
      },
      { step: 4, frame: ['A few photons come home'], seconds: 1.3 },
      {
        // button — closes the "without ever seeing one" loop, and on replay it
        // sets up the hook again
        step: 7,
        camera: { position: [4.2, 3.0, 5.6], target: [0.1, 1.2, 0.3] },
        seconds: 2.4,
        narration: 'It never saw the car. It timed it.',
      },
      { step: 7, camera: { position: [4.2, 3.0, 5.6], target: [0.1, 1.2, 0.3] }, orbit: 12, seconds: 1.6 },
    ],
  },

  render: {
    formats: ['short'],
    captions: true,
    followOverlay: { short: true },
    captionStyle: 'bold-karaoke',
    speed: 1.0, // channel-standard voice speed
  },
};
