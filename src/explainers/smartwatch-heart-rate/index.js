import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildSmartwatch, BEAT_MS } from './model.js';

// Zoom-in / reveal story: the sealed watch, its back crystal, a magnified
// slice of the sensor on skin (the light path, then the beat), the case
// opened to the accelerometer, the dip-counting on the screen, then the
// whole watch again.
//
// Seamless loops: every lap is a WHOLE, ODD number of heartbeats at a true
// 75 BPM (lap = beats x 800 ms), and every other motion (strobe, spin, sway,
// arm-swing rock, light packets) advances whole cycles per lap. One local
// tween target per step drives the model's single pose call, tick(u, cfg).

// One cfg per step feeds BOTH onEnter (pins every flag and the start pose, so
// scrolling either way lands on a consistent frame) and the loop.
function step(cfg) {
  const { view, ...motion } = cfg;
  return {
    onEnter: ({ handles }) => {
      handles.view(view);
      handles.tick(0, motion);
    },
    timeline: ({ tl, handles }) => {
      const s = { u: 0 }; // LOCAL state — never share tween targets across steps
      tl.add(s, {
        u: 1,
        duration: motion.beats * BEAT_MS,
        ease: 'linear',
        onUpdate: () => handles.tick(s.u, motion),
      });
    },
  };
}

export default defineExplainer({
  ...meta,

  buildScene({ scene }) {
    return buildSmartwatch({ scene });
  },

  stageOptions: { dof: true },

  steps: [
    {
      id: 'watch',
      heading: '1 · A pulse with nothing touching an artery',
      body: 'This watch says 75 beats per minute. It has no microphone listening for your heart, and nothing presses on an artery the way a nurse\'s fingers do. All it has is a small glass dome on its back, resting on your skin. Everything happens there, with light.',
      hint: 'Drag to orbit · scroll to turn it over.',
      camera: { position: [1.62, 2.79, 7.38], target: [-1.46, 1.76, 0.79] },
      dofAperture: 0.00003,
      focus: ['Heart-rate readout'],
      ...step({ view: { labels: 'exterior', screen: 'hr' }, beats: 15, sway: 0.35 }),
    },
    {
      id: 'back',
      heading: '2 · Green lights and dark windows',
      body: 'Turn it over and look through the back crystal. In the middle sit the LEDs, and the green ones do the heart-rate work. Around them are four photodiodes, dark squares that turn light into a tiny electric current. Black walls between them stop LED light leaking straight across. While it measures, the LEDs flash hundreds of times a second. That is the green flicker you see on your wrist in the dark.',
      hint: 'The flashing is slowed right down here so you can see it.',
      camera: { position: [0.51, 2.41, 3.5], target: [-0.84, 1.88, -0.46] },
      dofAperture: 0.00018,
      focus: ['Green LEDs', 'Photodiodes'],
      ...step({ view: { labels: 'sensor', screen: 'hr' }, beats: 5, turn: Math.PI, sway: 0.08, flashes: 13 }),
    },
    {
      id: 'skin',
      heading: '3 · Light goes in, a little comes back',
      body: 'Here is a magnified slice of the sensor resting on skin. Green light from the LED goes into the skin and scatters, and a small share of it curves back up to the photodiode a few millimetres away. On the way it passes capillaries and small arteries. Blood absorbs green light strongly, so light that runs into blood never comes back.',
      hint: 'Each dot stands for light scattering through the skin.',
      camera: { position: [0.45, 2.24, 5.59], target: [-0.94, 1.39, 0.68] },
      dofAperture: 0.00012,
      focus: ['Green LED', 'Photodiode'],
      ...step({ view: { macroOn: true, labels: 'skin' }, beats: 7 }),
    },
    {
      id: 'beat',
      heading: '4 · Each beat, a little darker',
      body: 'Every heartbeat sends a surge of blood that stretches the small arteries for a moment. Wider arteries swallow more green light, so a little less reaches the photodiode. Then they relax and the light comes back. The panel shows how small that change is. Almost all the light that returns is steady, from skin, tissue and veins. The beat is a flicker at the very top, about one percent or less.',
      hint: 'The artery\'s swell is exaggerated here so you can see it.',
      camera: { position: [0.32, 2.77, 6.29], target: [-1.13, 2.1, 0.7] },
      dofAperture: 0.00008,
      focus: ['Small artery', 'Photodiode signal'],
      ...step({ view: { macroOn: true, scopeOn: true, labels: 'beat' }, beats: 7 }),
    },
    {
      id: 'motion',
      heading: '5 · Your arm is louder than your heart',
      body: 'Swing your arm and the watch shifts against your skin while blood sloshes around your wrist. That changes the light far more than your pulse does. So the watch carries an accelerometer, a chip that feels every movement. The screen shows the raw light, the motion the accelerometer measured, and what is left once the watch filters that motion out: your pulse.',
      hint: 'The watch rocks here to stand in for your swinging arm.',
      camera: { position: [3.81, 2.44, 5.17], target: [-0.42, 1.57, 1.81] },
      dofAperture: 0.00004,
      focus: ['Accelerometer'],
      ...step({ view: { reveal: 1, labels: 'internal', screen: 'motion' }, beats: 7, rock: 3 }),
    },
    {
      id: 'count',
      heading: '6 · Counting the dark moments',
      body: 'Now there is a clean wave with one dip for every heartbeat. The watch times the gap from one dip to the next. Here it is 0.80 seconds, and 60 seconds divided by 0.80 is 75 beats per minute. A real watch looks at several seconds of signal at once, which is why a new reading takes a moment to settle.',
      camera: { position: [0.22, 2.32, 4.74], target: [-0.72, 1.93, 1.49] },
      dofAperture: 0.00016,
      ...step({ view: { screen: 'count' }, beats: 5, sway: 0.03 }),
    },
    {
      id: 'run',
      heading: '7 · Run it',
      body: 'Light goes in, blood swallows a little more of it on every beat, and the watch counts the dark moments. It does this all day without a needle or a microphone. When the signal is weak, on a cold wrist or under a loose strap, it turns the LEDs brighter and samples faster. Some watches also use infrared, a colour you cannot see, for readings in the background.',
      hint: 'Drag to orbit while it runs.',
      camera: { position: [1.77, 2.77, 7.87], target: [-1.56, 1.66, 0.77] },
      dofAperture: 0.00003,
      freeOrbit: true,
      // turn offset: three-quarter front at the 30% sample, three-quarter back
      // at 60% (never edge-on at the poses screenshots judge)
      ...step({ view: { screen: 'hr' }, beats: 9, spin: 1, turn: -1.385, flashes: 45 }),
    },
  ],
});
