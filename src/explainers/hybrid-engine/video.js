// Editorial layer for video export (scripts/export-video.mjs).
//
// LENS (from story.js): a hybrid has no gearbox. One small set of planetary
// gears joins the engine, a generator and the wheels, and how fast the
// generator spins IS the gear ratio. Planted loop: the hook asks "So what does
// the shifting?" -> closed by the button "The gearbox was a generator all
// along.", which also re-primes the hook on replay.
//
// SCRIPTING: one flowing single-take voiceover; each line hands off into the
// next (so / but / here's the part). No em/en dashes, no colons.
//
// STAT PLACEMENT: "thirty teeth ... three point six times the engine" gets a
// HARD CUT onto the lever diagram, whose footer prints that same formula.
//
// LABELS: every shot hides the in-scene callouts (labels: []); a 9:16 crop
// cuts right-anchored pills in half. Callouts hang off empty anchors (blinds
// the auto-framer), so every shot carries an authored camera.
//
// HUD: the lever/mode diagram is a screen-fixed sprite (top-centre on
// portrait, top-right on landscape), so it needs no per-shot camera maths.
// It appears on steps 3-7; the follow-button overlay (top-right) is timed to
// land while the gearset shots (no HUD) are on screen.
export default {
  hook: 'Your hybrid has no gearbox.',
  titleCard: 'HYBRID ENGINE',

  render: {
    formats: ['short', 'long'],
    captions: true,
    captionStyle: 'bold-karaoke',
    titleCard: true,
    endCard: false,
    followOverlay: { short: true, long: false },
    speed: 1.0,
    fps: 30,
  },

  short: {
    shots: [
      {
        // Zone 1 + 3 - hook and the spoken question
        step: 0,
        labels: [],
        camera: { position: [2.4, 3.0, -11.6], target: [0, 0.6, -0.6] },
        narration: 'Your hybrid has no gearbox. So what does the shifting?',
      },
      {
        step: 0,
        labels: [],
        camera: { position: [4.4, 1.9, -9.2], target: [0, 0.6, -1.0] },
        push: 0.92,
        seconds: 1.4,
      },

      {
        // Zone 2 - inside
        step: 1,
        labels: [],
        camera: { position: [1.0, 4.6, -4.6], target: [0, 0.3, 0.0] },
        move: 'cut',
        narration:
          'To find out, look inside. There’s a petrol engine, two electric motors and a battery, and one small set of gears.',
      },
      {
        step: 1,
        labels: [],
        camera: { position: [0.9, 2.6, -3.4], target: [0, 0.5, -1.5] },
        seconds: 1.6,
      },

      {
        // Zone 4a - the gearset
        step: 2,
        labels: [],
        camera: { position: [1.55, 0.8, -2.25], target: [0, 0.55, -1.6] },
        move: 'cut',
        narration:
          'The engine turns the planet carrier, a generator holds the sun gear, and the outer ring drives the wheels.',
      },
      {
        step: 2,
        labels: [],
        camera: { position: [1.2, 0.7, -2.0], target: [0, 0.55, -1.6] },
        orbit: 10,
        seconds: 1.8,
      },

      {
        // Zone 4b - the lever
        step: 3,
        labels: [],
        camera: { position: [1.65, 0.95, -2.5], target: [0, 1.0, -1.6] },
        move: 'cut',
        narration:
          'But the ring is locked to the road. So when the engine speeds up or slows down, the generator has to swing to make up the difference.',
      },
      {
        step: 3,
        labels: [],
        camera: { position: [1.5, 0.85, -2.3], target: [0, 1.0, -1.6] },
        push: 0.92,
        seconds: 1.8,
      },

      {
        // Zone 5 - the stat, isolated on a hard cut
        step: 3,
        labels: [],
        camera: { position: [1.9, 1.05, -2.8], target: [0, 1.0, -1.6] },
        move: 'cut',
        narration:
          'Thirty teeth on the sun, seventy-eight on the ring. So the generator turns three point six times the engine, minus two point six times the wheels.',
      },

      {
        // re-hook - electric only
        step: 4,
        labels: [],
        camera: { position: [2.2, 5.8, -6.0], target: [0.1, 0.2, -0.3] },
        move: 'cut',
        narration:
          'Here’s the part that gets me. Pull away, and the engine just stops. The battery drives one motor, and the generator spins backwards, doing nothing.',
      },
      {
        step: 4,
        labels: [],
        camera: { position: [1.6, 3.6, -3.8], target: [0.2, 0.5, -1.0] },
        seconds: 1.6,
      },

      {
        // charging while driving
        step: 5,
        labels: [],
        camera: { position: [2.2, 5.8, -6.0], target: [0.1, 0.2, -0.3] },
        narration:
          'Start the engine and its power splits. About seventy percent goes straight to the wheels, and the rest spins the generator to charge the battery.',
      },
      {
        step: 5,
        labels: [],
        camera: { position: [1.6, 3.6, -3.8], target: [0.2, 0.5, -1.0] },
        seconds: 1.6,
      },

      {
        // full power
        step: 6,
        labels: [],
        camera: { position: [2.2, 5.8, -6.0], target: [0.1, 0.2, -0.3] },
        narration: 'Floor it, and the motor adds its own push from the battery.',
      },

      {
        // regen
        step: 7,
        labels: [],
        camera: { position: [2.2, 5.8, -6.0], target: [0.1, 0.2, -0.3] },
        narration:
          'Brake, and the wheels turn that motor into a generator, so slowing down fills the battery.',
      },

      {
        // Zone 7 - button closes the loop
        step: 8,
        labels: [],
        camera: { position: [3.0, 2.2, -9.0], target: [0, 0.6, -0.8] },
        narration: 'The engine never shifted. The gearbox was a generator all along.',
      },
      {
        step: 8,
        labels: [],
        camera: { position: [3.0, 2.2, -9.0], target: [0, 0.6, -0.8] },
        orbit: -12,
        seconds: 1.4,
      },
    ],
  },

  long: {
    shots: [
      {
        step: 0,
        labels: [],
        camera: { position: [4.0, 1.6, -4.6], target: [-0.5, 0.5, -0.3] },
        narration:
          'Your hybrid has no gearbox. There is no clutch, no torque converter, no gears to change. It creeps away in silence, the engine drones at one steady pitch while you speed up, and nothing ever shifts. So what is doing the job a gearbox does?',
      },
      {
        step: 1,
        labels: [],
        camera: { position: [1.95, 2.9, -4.4], target: [0.5, 0.4, -1.0] },
        narration:
          'Look inside and you find a small petrol engine, two electric motor generators called MG1 and MG2, an inverter that moves power between them, and a battery at the back. Nothing here looks like a transmission.',
      },
      {
        step: 2,
        labels: [],
        camera: { position: [1.55, 0.8, -2.25], target: [0, 0.55, -1.6] },
        narration:
          'But it is all joined by one small planetary gearset. The engine turns the carrier, which holds four planet gears. A generator, MG1, is bolted to the sun gear in the middle. And the outer ring gear drives the wheels, with motor MG2 pushing on that same ring.',
      },
      {
        step: 3,
        labels: [],
        camera: { position: [1.55, 0.8, -2.25], target: [0, 0.55, -1.6] },
        narration:
          'Here is the trick. The ring is locked to the road, so it cannot pick its own speed. That means when the engine speeds up or slows down, the generator has to swing the other way to make up the difference. That swing is the gear ratio. With thirty teeth on the sun and seventy-eight on the ring, the generator turns three point six times the engine, minus two point six times the wheels.',
      },
      {
        step: 4,
        labels: [],
        camera: { position: [1.95, 2.9, -4.4], target: [0.5, 1.1, -1.2] },
        narration:
          'So when you pull away gently, the engine just stops. The battery drives MG2, and the generator spins backwards, freewheeling, doing no work.',
      },
      {
        step: 5,
        labels: [],
        camera: { position: [1.95, 2.9, -4.4], target: [0.5, 1.1, -1.2] },
        narration:
          'Start the engine and its power splits through the gears. About seventy percent goes straight to the ring and the wheels, and the rest spins the generator, which turns it into electricity for the battery.',
      },
      {
        step: 6,
        labels: [],
        camera: { position: [1.95, 2.9, -4.4], target: [0.5, 1.1, -1.2] },
        narration:
          'Floor it, and the engine speeds up while MG2 adds its own push from the battery. That is how a small engine can feel like a big one.',
      },
      {
        step: 7,
        labels: [],
        camera: { position: [1.95, 2.9, -4.4], target: [0.5, 1.1, -1.2] },
        narration:
          'Brake, and the engine switches off. The wheels turn MG2 against its own push, so it becomes a generator, and slowing the car puts energy back in the battery instead of only heating the brakes.',
      },
      {
        step: 8,
        labels: [],
        camera: { position: [4.0, 1.6, -4.6], target: [-0.5, 0.5, -0.3] },
        narration:
          'The car picks between all of this on its own. The engine never shifted. The gearbox was a generator all along.',
      },
    ],
  },

  platforms: {
    youtube: {
      title: 'Your hybrid has no gearbox. Here is what does the shifting.',
      description:
        'A Toyota-style hybrid joins its petrol engine, a generator and the wheels with one planetary gearset. The generator speed IS the gear ratio: 30 teeth on the sun, 78 on the ring, so generator = 3.6 x engine - 2.6 x wheels. We walk through electric-only driving, charging while driving, full power and regenerative braking.',
      tags: [
        'hybrid engine',
        'how a hybrid works',
        'power split device',
        'planetary gearset',
        'Toyota Prius',
        'regenerative braking',
        'e-CVT',
        'MG1 MG2',
        'how it works',
      ],
    },
    shorts: {
      title: 'Your hybrid has no gearbox. So what shifts?',
      hashtags: ['#hybrid', '#prius', '#engineering', '#HowItWorks', '#cars'],
      description:
        'One planetary gearset joins the engine, a generator and the wheels, and the generator speed is the gear ratio. #hybrid #HowItWorks',
    },
  },
};
