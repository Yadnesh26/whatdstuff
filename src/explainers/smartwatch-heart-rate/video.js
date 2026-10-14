// Editorial layer for video export (scripts/export-video.mjs).
//
// SCRIPTING: one flowing voiceover, synthesized as a single ElevenLabs take;
// the per-shot `narration` strings are just the cut points and each hands off
// into the next. Arc: hook -> stakes -> spoken question -> reveal ->
// BUT/THEREFORE mechanism -> isolated stat -> re-hook (motion) -> count ->
// button.
//
// PACKAGING (from story.js)
//   Idea:  how does a watch read your pulse with nothing touching your heart?
//   Lens:  it never hears the heart; it watches your wrist go dark.
//   Loop:  "watching your wrist go dark" planted in the hook, closed in the
//          button ("It counts the moments your wrist goes dark."), which hands
//          straight back to "Your watch has never heard your heartbeat." on
//          replay.
//
// LABELS: every shot hides the in-scene callouts (labels: []). Right-anchored
// pills are cut in half by the 9:16 crop and illegible at phone size.
//
// FRAMING: solved per shot. `frame: null` = the whole visible model (the watch,
// or the skin insert on steps 2-3); named frames use the hidden callouts'
// parent parts as the subject box.
//
// No em dashes anywhere: ElevenLabs renders them as dead air.

// steps: 0 watch · 1 back · 2 skin · 3 beat · 4 motion · 5 count · 6 run
//
// The skin insert is a WIDE subject: the solver fits it to the 9:16 width and
// it fills a quarter of the height. Its shots are authored macros instead
// (1080x1920 at 42° vertical FOV, dolly 1), letting the block run past the
// frame edges; the cut face sits at z 1.0, skin surface at y 1.95.
const at = (center, azDeg, elDeg, dist) => {
  const a = (azDeg * Math.PI) / 180;
  const e = (elDeg * Math.PI) / 180;
  return {
    position: [
      center[0] + dist * Math.cos(e) * Math.sin(a),
      center[1] + dist * Math.sin(e),
      center[2] + dist * Math.cos(e) * Math.cos(a),
    ],
    target: center,
  };
};
const SKIN_WIDE = at([0, 1.5, 1.0], 14, 16, 5.6);
const SKIN_RIGHT = at([0.45, 1.6, 1.0], 10, 12, 3.3);
const SKIN_LEFT = at([-0.45, 1.6, 1.0], -12, 12, 3.3);
const ARTERY = at([-0.3, 1.35, 1.0], 6, 10, 2.7);

export default {
  hook: 'Your watch has never heard your heartbeat.',
  titleCard: 'SMARTWATCH HEART RATE',

  render: {
    formats: ['short'],
    captions: true,
    captionStyle: 'bold-karaoke',
    followOverlay: { short: true },
    speed: 1.0, // channel voice at 1x; make-narration's own default is 0.9
  },

  // 9:16, ~70s. One take, 10 spoken lines, silent cuts inside them.
  short: {
    shots: [
      // Zone 1: the hook over the whole watch, then onto its readout
      {
        step: 0,
        frame: null,
        labels: [],
        narration: 'Your watch has never heard your heartbeat. It finds your pulse by watching your wrist go dark.',
      },
      { step: 0, frame: ['Heart-rate readout'], fill: 0.72, labels: [], push: 0.9, seconds: 2.2 },

      // Zone 2: stakes, the dips themselves
      {
        step: 0,
        frame: ['Heart-rate readout'],
        labels: [],
        narration: 'About seventy five times a minute, your wrist turns a tiny bit darker. And your watch counts each one.',
      },
      { step: 5, frame: ['Heart-rate readout'], fill: 0.74, labels: [], push: 0.92, seconds: 2.4 },

      // Zone 3: the question, as the watch turns
      { step: 0, frame: null, labels: [], orbit: 18, narration: 'But how can a watch see your blood?' },

      // Zone 4a: the reveal, the back crystal
      {
        step: 1,
        frame: null,
        labels: [],
        narration: 'Flip it over. Those green lights flash hundreds of times a second, straight into your skin.',
      },
      { step: 1, frame: ['Green LEDs'], fill: 0.72, labels: [], push: 0.9, seconds: 2.2 },

      // Zone 4b: into the skin
      {
        step: 2,
        camera: SKIN_WIDE,
        dolly: 1,
        labels: [],
        narration:
          'The light scatters inside you, and a little bounces back to a sensor beside the lights. But blood swallows green light. So light that runs into blood never comes back.',
      },
      { step: 2, camera: SKIN_RIGHT, dolly: 1, labels: [], push: 0.92, seconds: 2.6 },
      { step: 2, camera: SKIN_LEFT, dolly: 1, labels: [], orbit: -10, seconds: 2.6 },

      // Zone 4c: THEREFORE, the beat
      {
        step: 3,
        frame: null,
        labels: [],
        narration:
          'Every heartbeat pushes a surge of blood into the tiny arteries under the watch. They swell and swallow more green, so the sensor sees a little less light. Then they relax and the light comes back.',
      },
      { step: 3, camera: ARTERY, dolly: 1, labels: [], seconds: 3 },
      { step: 3, frame: null, fill: 0.72, labels: [], push: 0.9, seconds: 2.4 },

      // Zone 5: the stat, isolated on a hard cut to the readout plate
      {
        step: 3,
        frame: ['Photodiode signal'],
        move: 'cut',
        labels: [],
        narration: 'That dip is only about one percent of the light. It’s all the watch has to go on.',
      },

      // Re-hook: a change of scale, the watch blown apart and swinging
      {
        step: 4,
        frame: null,
        move: 'cut',
        labels: [],
        narration:
          'But swing your arm and the light jumps far more than that. So a motion sensor inside feels every swing, and the watch subtracts it.',
      },
      { step: 4, frame: ['Accelerometer', 'Sensor chip'], fill: 0.5, labels: [], seconds: 2.4 },
      { step: 4, frame: ['Display'], fill: 0.74, labels: [], push: 0.92, seconds: 2.6 },

      // Zone 6: the count
      {
        step: 5,
        frame: ['Heart-rate readout'],
        labels: [],
        narration: 'What’s left is one clean dip per beat. Point eight seconds apart means seventy five beats a minute.',
      },
      { step: 5, frame: ['Heart-rate readout'], fill: 0.72, labels: [], push: 0.9, seconds: 2.4 },

      // Zone 7: the button closes the loop over the whole watch
      {
        step: 6,
        frame: null,
        labels: [],
        narration: 'It never hears your heart. It counts the moments your wrist goes dark.',
      },
    ],
  },
};
