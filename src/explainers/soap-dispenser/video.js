// Editorial layer for video export (scripts/render.mjs → export-video.mjs).
//
// SCRIPTING: one flowing voiceover (single ElevenLabs take) on the
// video-scripting spine. Loop: "Pressing … doesn't pull the soap up. Letting go
// does." is planted in shot 1 and closed by the button "You press. The spring
// does the pulling." — which also leads straight back into the hook on replay.
// The stat (twelve millimetres → about two millilitres) gets a hard cut to the
// piston, then the nozzle. Silent shots carry the cutting.
//
// LOOP SYNC: the intake and delivery lines each run ~2 laps of steps 3 and 4.
// Those steps' `dwell` laps spend ~80% of their time on their own stroke, so
// the picture matches the line for most of every lap.
//
// In-scene callouts are hidden for the 9:16 crop (labels: []).
//
// steps: 0 dose · 1 inside · 2 intake · 3 delivery · 4 prime · 5 run
export default {
  hook: "Pressing a soap pump doesn't pull the soap up.",

  render: {
    formats: ['short'],
    captions: true,
    captionStyle: 'bold-karaoke',
    followOverlay: { short: true },
    speed: 1.0,
  },

  short: {
    shots: [
      // 1 · hook — the whole sealed product, then the head working
      { step: 0, frame: null, fill: 0.78, labels: [], push: 0.94,
        narration: "Pressing a soap pump doesn't pull the soap up. Letting go does." },
      { step: 0, frame: ['Pump head', 'Nozzle'], fill: 0.42, labels: [], seconds: 1.6 },
      // 2 · stakes — the dose was loaded last time
      { step: 0, frame: ['Nozzle'], fill: 0.7, labels: [], orbit: 8,
        narration: "The squirt in your hand was loaded on your last release, and it's been waiting in there ever since." },
      { step: 0, frame: null, labels: [], orbit: -10, seconds: 2 },
      // 3 · question
      { step: 1, frame: ['Pump head', 'Lower ball valve'], fill: 0.6, labels: [], push: 0.94,
        narration: "What's hiding under that head?" },
      // 4 · reveal — the parts
      { step: 1, frame: ['Hollow stem', 'Lower ball valve'], fill: 0.6, labels: [], orbit: 8,
        narration: "A tiny piston pump. A tube hangs down into the soap, with a piston on a hollow stem and a steel spring underneath." },
      { step: 1, camera: { position: [0.28, 2.27, 1.06], target: [0, 2.14, 0] }, frame: ['Upper ball valve'], labels: [], push: 0.92, seconds: 2 },
      { step: 1, frame: ['Upper ball valve', 'Lower ball valve'], fill: 0.72, labels: [], seconds: 1.8 },
      // 5 · the valves
      { step: 1, camera: { position: [-0.17, 2.24, 0.82], target: [0, 2.16, 0] }, frame: ['Upper ball valve'], labels: [], move: 'cut',
        narration: "The valves are just two glass balls, smaller than peppercorns." },
      { step: 1, camera: { position: [0.31, 1.61, 1.17], target: [0, 1.46, 0] }, frame: ['Lower ball valve'], labels: [], seconds: 1.6 },
      // 6-7 · release = intake
      { step: 2, frame: ['Upper ball valve', 'Lower ball valve'], fill: 0.72, labels: [],
        narration: "Now let go. The spring shoves the piston up, and the pressure under it drops." },
      { step: 2, camera: { position: [0.31, 1.61, 1.17], target: [0, 1.46, 0] }, frame: ['Lower ball valve'], labels: [], push: 0.92, seconds: 2 },
      { step: 2, camera: { position: [0.73, 1.73, 2.29], target: [0, 1.36, 0] }, frame: ['Lower ball valve'], labels: [], rise: -0.1,
        narration: "So the air outside pushes soap up the straw. It lifts the bottom ball and floods the chamber." },
      { step: 2, frame: ['Upper ball valve', 'Lower ball valve'], fill: 0.72, labels: [], seconds: 2 },
      // 8-9 · press = delivery
      { step: 3, camera: { position: [-0.31, 1.61, 1.17], target: [0, 1.46, 0] }, frame: ['Lower ball valve'], labels: [], move: 'cut',
        narration: "But that soap can't go back. Press, and the bottom ball slams shut." },
      { step: 3, frame: ['Upper ball valve', 'Lower ball valve'], fill: 0.72, labels: [], seconds: 1.8 },
      { step: 3, camera: { position: [0.21, 2.2, 0.81], target: [0, 2.1, 0] }, frame: ['Upper ball valve'], labels: [],
        narration: "The only way out is up. The soap pushes past the top ball and runs up the hollow stem to the nozzle." },
      { step: 3, frame: ['Hollow stem', 'Nozzle'], fill: 0.72, labels: [], rise: 0.08, seconds: 2.2 },
      { step: 3, frame: ['Nozzle'], fill: 0.7, labels: [], push: 0.92, seconds: 1.8 },
      // 10-11 · re-hook — priming
      { step: 4, frame: null, fill: 0.86, labels: [], move: 'cut',
        narration: "But a brand new pump spits air at first." },
      { step: 4, camera: { position: [0.79, 1.62, 3.01], target: [0, 1.31, 0] }, frame: ['Lower ball valve'], labels: [], push: 0.93,
        narration: "Air squashes instead of opening the valves, so each stroke drags the soap a little higher until the chamber's full." },
      { step: 4, frame: null, fill: 0.8, labels: [], seconds: 2.4 },
      // 12 · the stat — hard cuts
      { step: 1, camera: { position: [-0.39, 2.36, 1.02], target: [0, 2.14, 0] }, frame: ['Upper ball valve'], labels: [], move: 'cut',
        narration: "Once it's full, the piston moves twelve millimetres a press. That's about two millilitres, every single time." },
      { step: 3, frame: ['Nozzle'], fill: 0.7, labels: [], move: 'cut', seconds: 2.4 },
      // 13 · so-what
      { step: 5, frame: null, labels: [], orbit: 12,
        narration: "So the next dose is already waiting before you reach for it." },
      // 14 · button — closes the loop, leads back into the hook
      { step: 5, frame: ['Pump head', 'Nozzle'], fill: 0.6, labels: [], push: 0.93,
        narration: 'You press. The spring does the pulling.' },
    ],
  },

  platforms: {
    shorts: {
      title: "Pressing a soap pump doesn't pull the soap up",
      hashtags: ['#soapdispenser', '#howitworks', '#engineering', '#physics', '#whatdstuff'],
    },
  },
};
