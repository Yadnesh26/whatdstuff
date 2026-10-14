// Phase 0 artifact — written BEFORE the model (add-explainer skill, Phase 0).
// Pure data, no imports, never bundled: the registry globs only meta.js and
// index.js. This is the record of what the explainer is FOR, and the contract
// the model must satisfy.
//
// SCOPE NOTE: optical heart RATE on a generic, unbranded smartwatch (green-LED
// reflectance photoplethysmography). Not the ECG electrode feature, and not
// blood-oxygen (red + infrared) beyond a one-line mention in the finale.
//
// SOURCES (research pass): Apple support "Monitor your heart rate" (PPG; blood
// is red because it reflects red and absorbs green; green LEDs + photodiodes;
// LEDs flash hundreds of times per second; 30-210 BPM range; weak signal ->
// brighter LEDs and higher sampling rate; infrared used in the background /
// during sleep on some models); Apple Series 6 materials (four LED clusters,
// four photodiodes under the back crystal); wrist-PPG literature (green
// ~530 nm chosen for its AC/DC ratio and lower motion sensitivity; pulsatile
// part is ~0.1-1 % of the returned light; accelerometer used as the motion
// reference to subtract arm-swing from the spectrum, then the heart-rate peak
// is picked / beat-to-beat intervals measured).
export default {
  angle:
    'Your watch never hears your heart. It shines green light into your wrist and watches it go ' +
    'very slightly darker each time a beat pushes more blood under the sensor, then counts the dips.',

  stat: 'Each heartbeat dims the returning light by about one percent or less, and the LEDs flash hundreds of times a second to catch it.',

  button: 'It counts the moments your wrist goes dark.',

  who: 'Anyone who has seen the green light flickering on the back of a watch and wondered what it is doing.',

  beats: [
    {
      idea: 'A smartwatch reads your pulse with nothing touching an artery: just a glass dome on its back resting on skin.',
      visuals: ['the complete, sealed watch with a live BPM number and pulse trace on its screen', 'the watch turning to show the domed back crystal'],
    },
    {
      idea: 'Under the back crystal sit green LEDs and photodiodes a few millimetres apart. The LEDs flash hundreds of times a second.',
      visuals: ['the back crystal close up: green LEDs strobing, dark photodiode windows beside them', 'the light barrier walls that stop light leaking straight across'],
    },
    {
      idea: 'Green light enters the skin, scatters, and a small share curves back out to the photodiode. Blood absorbs green strongly, so anything that adds blood on that path dims what comes back.',
      visuals: ['a cross-section block of skin under the sensor (layers, capillaries, a small artery)', 'green light packets travelling a curved path from LED to photodiode', 'packets that hit blood disappearing'],
    },
    {
      idea: 'Each heartbeat swells the arteries for a moment, more green gets swallowed, and the photodiode reading dips by about one percent or less.',
      visuals: ['the artery swelling and relaxing in time with the beat', 'fewer packets arriving at the photodiode on each swell', 'the screen showing a tall flat signal with a tiny ripple, then the ripple magnified into a pulse wave'],
    },
    {
      idea: 'Moving your arm shifts the sensor against skin and makes fake bumps far bigger than the pulse. An accelerometer inside measures the motion so the watch can subtract it.',
      visuals: ['the watch case opened to show the logic board, the accelerometer chip and the sensor chip', 'the watch rocking as an arm would swing', 'a messy trace that cleans up once motion is removed'],
    },
    {
      idea: 'The watch times the gap between dips. 0.80 seconds between beats is 75 beats per minute.',
      visuals: ['peaks marked on the clean pulse wave with the interval between them', 'the BPM number on the screen updating'],
    },
    {
      idea: 'Run as a whole: light out, blood swallows some, the dips get counted, the number on your wrist.',
      visuals: ['the complete watch spinning, green light flickering underneath, BPM on the screen'],
    },
  ],
};
