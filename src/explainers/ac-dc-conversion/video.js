// Editorial layer for video export (scripts/render.mjs → export-video.mjs).
//
// SCRIPTING: one flowing voiceover (single ElevenLabs take) on the
// video-scripting spine. Loop: "it shakes back and forth … no battery can
// store that" is planted in shot 1 and closed by the button "Straighten it,
// store it, shake it back." The stat (one micrometre, then it turns around)
// gets a hard cut back to the wire macro. Silent shots carry the cutting.
// In-scene callouts are hidden for the 9:16 crop (labels: []). Wide shots and
// macros carry authored portrait cameras (1080x1920, fov 42) solved from world
// boxes: the machine is long and flat, so the solver's width fit left it a
// sliver of the frame height.
//
// steps: 0 ups · 1 ac · 2 dc · 3 map · 4 bridge · 5 caps · 6 hbridge · 7 pwm · 8 run
export default {
  hook: 'The electrons in your wall never actually go anywhere.',

  render: {
    formats: ['short'],
    captions: true,
    captionStyle: 'bold-karaoke',
    followOverlay: { short: true },
    speed: 1.0,
  },

  short: {
    shots: [
      { step: 0, camera: { position: [-5.37, 4.71, 6.45], target: [-0.05, 0.31, 0.11] }, labels: [], push: 0.92,
        narration: "The electrons in your wall never actually go anywhere. They shake back and forth fifty times a second, and no battery can store that." },
      { step: 0, frame: ['AC in from the wall'], fill: 0.45, labels: [], push: 0.92, seconds: 2 },
      { step: 0, frame: ['Lamp on the AC output'], fill: 0.5, labels: [], seconds: 1.6 },
      { step: 1, camera: { position: [-6.01, 3.24, 2.89], target: [-0.34, 0.6, -0.38] }, labels: [], orbit: 8,
        narration: "Inside the wire, the copper atoms stay put while the electrons swing past them and end up right where they started." },
      { step: 1, camera: { position: [-1.14, 1.72, 2.19], target: [-0.79, 0.78, 0.2] }, labels: [], push: 0.92, seconds: 2.4 },
      { step: 1, camera: { position: [-6.01, 3.24, 2.89], target: [-0.34, 0.6, -0.38] }, labels: [], orbit: -10, seconds: 1.8 },
      { step: 2, camera: { position: [6.01, 3.24, 2.89], target: [0.34, 0.6, -0.38] }, labels: [], orbit: -8,
        narration: "But a battery needs electrons drifting one way, all the time. That's DC." },
      { step: 3, camera: { position: [-4.63, 5.47, 5.1], target: [-0.53, 0.48, 0.2] }, labels: [], rise: 0.15,
        narration: "So how does a backup box fill a battery from the wall, then run your computer off it?" },
      { step: 3, camera: { position: [3.48, 5.76, 5.38], target: [-0.11, 0.5, 0.24] }, labels: [], seconds: 2 },
      { step: 4, camera: { position: [-1.89, 2.85, 3.44], target: [-0.96, 0.61, -0.03] }, labels: [], push: 0.94,
        narration: "It starts with four diodes, and each one is a one-way valve. Whichever way the wall pushes, two of them steer it onto the same rail." },
      { step: 4, frame: ['D1', 'D2', 'D3', 'D4'], fill: 0.7, labels: [], seconds: 2.2 },
      { step: 5, camera: { position: [0.11, 2.17, 2.38], target: [-0.57, 0.66, -0.15] }, labels: [], push: 0.93,
        narration: "But that comes out lumpy, so big capacitors fill the gaps until it's almost flat." },
      { step: 5, frame: ['Reservoir capacitors'], fill: 0.5, labels: [], seconds: 1.8 },
      { step: 6, camera: { position: [1.66, 2.9, 3.4], target: [0.4, 0.6, -0.05] }, labels: [], orbit: 8,
        narration: "Here's the clever part. To get AC back, four switches flip which way that DC pushes." },
      { step: 6, frame: ['Q1', 'Q2', 'Q3', 'Q4'], fill: 0.7, labels: [], seconds: 2 },
      { step: 7, camera: { position: [0.45, 2.75, 3.58], target: [0.45, 0.63, -0.09] }, labels: [], push: 0.94,
        narration: "Flip them thousands of times a second, and a coil smooths the pulses into a clean wave." },
      { step: 7, frame: ['Coil', 'Film capacitor'], fill: 0.6, labels: [], seconds: 2.2 },
      { step: 1, camera: { position: [-0.58, 1.32, 1.48], target: [-0.81, 0.84, 0.19] }, labels: [], move: 'cut',
        narration: "Back to that wall wire. Each electron moves about a micrometre. Then it turns around." },
      { step: 8, camera: { position: [-1.95, 1.96, 5.4], target: [0.78, 0.49, 0.67] }, labels: [], push: 0.94, move: 'cut',
        narration: "So when the power cuts out, the battery feeds the same DC, and the lamp never blinks." },
      { step: 8, camera: { position: [-5.37, 4.71, 6.45], target: [-0.05, 0.31, 0.11] }, labels: [], orbit: 12, seconds: 2 },
      { step: 3, camera: { position: [3.48, 5.76, 5.38], target: [-0.11, 0.5, 0.24] }, labels: [], push: 0.94,
        narration: "Straighten it, store it, shake it back." },
    ],
  },

  platforms: {
    shorts: {
      title: 'The electrons in your wall never go anywhere',
      hashtags: ['#acdc', '#electricity', '#howitworks', '#electronics', '#whatdstuff'],
    },
  },
};
