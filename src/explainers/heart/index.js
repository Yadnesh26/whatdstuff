import { defineExplainer } from '../../framework/index.js';
import { TAU } from '../../framework/motion.js';
import meta from './meta.js';
import { buildHeart } from './model.js';

// Reveal story: the sealed organ beating on its mount, then the anterior half
// lifts off to show that it is TWO pumps and not one, then the circuit with
// blood actually running round it, then a macro on the two cut faces where the
// 10 mm : 3 mm wall ratio is simply visible, then the valve plane from above,
// then deep inside the left ventricle for the chordae, then the wiring and its
// deliberate 0.1 s stall, and finally the organ shut again, turning, with its
// own coronary supply pulsing in the gap between beats.
//
// Seamless loops: every step drives ONE linear 0-1 phase which IS the cardiac
// cycle, so a lap is a whole number of beats and the wrap pose is identical.
// Steps 1-7 run one beat per lap: the deterministic capture instants (30% and
// 60% of a lap) then land at beat 0.30 — mid-ejection, AV valves shut,
// semilunars open — and beat 0.60 — early filling, the other way round. Two
// genuinely different, fully settled poses, never a valve caught mid-slam.
// The finale runs 4 beats against 1 whole turntable revolution.

// Every scalar the model owns, so each step can pin ALL of them (pre-flight #4)
// and scrolling either direction lands on an identical scene.
const DEFAULTS = {
  beat: 0,
  lid: 1,
  reveal: 0,
  flow: 0,
  xray: 0,
  wire: 0,
  atria: 1,
  vess: 1,
  top: 1,
  cor: 0,
  spin: 0,
};

const view =
  ({ labels = false, ...rest }) =>
  ({ handles }) => {
    handles.set({ ...DEFAULTS, ...rest });
    handles.setLabels(labels);
  };

// One linear phase per lap. `beats` is a WHOLE number of cardiac cycles, `turn`
// a whole number of turntable revolutions.
function run({ duration, beats = 1, turn = 0, rock = 0 }) {
  return ({ tl, handles }) => {
    const s = { t: 0 }; // LOCAL state — never share tween targets across steps
    tl.add(s, {
      t: 1,
      duration,
      ease: 'linear',
      onUpdate: () =>
        handles.set({
          beat: s.t * beats,
          // a full turntable revolution swings the specimen mount round in
          // front of the organ, so the finale rocks instead
          spin: turn ? s.t * turn * TAU : rock * Math.sin(s.t * TAU),
        }),
    });
  };
}

export default defineExplainer({
  ...meta,
  stageOptions: { dof: true },

  buildScene({ scene }) {
    return buildHeart({ scene });
  },

  steps: [
    {
      id: 'sealed',
      heading: 'A fist that never gets a day off',
      body: 'This is a pump the size of your clenched fist — about 300 grams of muscle — and it has been running since roughly three weeks after you were conceived. Each beat it moves about 70 millilitres, a decent gulp, and there are around 100,000 beats in your day. No off switch, no maintenance window, no spare. Everything strange about the way it is built follows from that one constraint.',
      hint: 'Drag to orbit · scroll to open it up.',
      camera: { position: [3.6, 3.9, 5.6], target: [-0.5, 2.15, 0.1] },
      dofAperture: 0.00004,
      focus: ['Left ventricle'],
      onEnter: view({ labels: 'exterior' }),
      timeline: run({ duration: 2000 }),
    },
    {
      id: 'two-pumps',
      heading: 'It is not one pump. It is two.',
      body: 'Lift the front wall off and there are four rooms in there, not one chamber. A slab of muscle down the middle — the septum — splits the whole organ in half, and the two halves never share a drop. The right half takes blood back from your body and sends it to your lungs. The left half takes it back from your lungs and sends it everywhere else. Two pumps, welded together, sharing one muscle and one clock.',
      camera: { position: [1.7, 2.85, 5.2], target: [-1.05, 1.85, 0.0] },
      dofAperture: 0.00008,
      focus: ['Interventricular septum'],
      onEnter: view({ labels: 'chambers', lid: 0, reveal: 1 }),
      timeline: run({ duration: 1900 }),
    },
    {
      id: 'circuit',
      heading: 'Two circuits — and the blue is a convention, not a colour',
      body: 'Follow one cell. It arrives spent through the two big veins, drops into the right atrium, falls through into the right ventricle, and is thrown about 30 centimetres to your lungs. It comes back through four pulmonary veins into the left atrium, falls into the left ventricle, and is thrown out of the aorta to everywhere from your scalp to your toes. Around 70 mL a beat, 5.25 litres a minute — your entire blood volume, every minute, on both circuits at once. One honest note: deoxygenated blood is dark maroon, never blue. Blue is a mapmaker’s convention, borrowed from how veins look through skin.',
      hint: 'Both sides fire together — the blood on screen is one beat of each.',
      camera: { position: [3.5, 4.0, 5.6], target: [-0.5, 2.15, 0.1] },
      dofAperture: 0.00003,
      focus: ['To the lungs', 'To the body'],
      onEnter: view({ labels: 'circuit', lid: 0, reveal: 1, flow: 1, xray: 1 }),
      timeline: run({ duration: 2700 }),
    },
    {
      id: 'walls',
      heading: 'One wall is three times the other',
      body: 'Both ventricles push out the same 70 millilitres. They are not pushing against the same thing. The right one only has to reach the lungs, 30 centimetres away, at about 25 mmHg — so its wall is three millimetres of muscle. The left one has to reach the far end of you at about 120, so its wall is ten, and in mid-squeeze it thickens to nearly fifteen. Cut straight across the two of them and the ratio is simply there in the muscle — no drawing convention required. It is what each side actually grew into, and it is why a failing left ventricle is a different disease from a failing right one.',
      camera: { position: [-0.24, 6.32, 1.17], target: [-0.95, 1.95, -0.06] },
      dofAperture: 0.00012,
      focus: ['Left ventricle wall — 10 mm', 'Right ventricle wall — 3 mm'],
      onEnter: view({ labels: 'walls', lid: 1, reveal: 1, atria: 0, vess: 0, top: 0 }),
      timeline: run({ duration: 1800 }),
    },
    {
      id: 'valves',
      heading: 'Four doors, none of them powered',
      body: 'Every valve in here is a flap of tissue about a millimetre thick, and not one of them has a hinge, a spring or a motor. They are opened and shut entirely by which side currently has more pressure. The two big ones between atrium and ventricle carry three flaps on the right and two on the left. The two guarding the exits are three little pockets each: push from below and they flatten against the wall; push from above and they fill like parachutes and jam shut against each other. The lub-dub through a stethoscope is not the muscle at all. It is these — the big pair, then the little pair.',
      camera: { position: [0.6, 4.7, 3.0], target: [-1.15, 1.8, 0.0] },
      dofAperture: 0.00016,
      focus: ['Tricuspid — 3 flaps', 'Mitral — 2 flaps'],
      onEnter: view({ labels: 'valves', lid: 0, reveal: 1, atria: 0, vess: 0 }),
      timeline: run({ duration: 1800 }),
    },
    {
      id: 'chordae',
      heading: 'The rigging that stops them turning inside out',
      body: 'At 120 mmHg the mitral valve has every reason to blow backwards into the atrium, the way an umbrella inverts in a gust. It does not, because it is guyed. Cone-shaped papillary muscles rise off the ventricle wall, and from their tips run the chordae tendineae — fine tendon cords fanning out to the free edge of each flap. They never pull the valve shut; pressure does that. They tighten at the same instant the ventricle does and simply refuse to let the edges travel any further, exactly like rigging on a parachute canopy. Snap one and the flap flails, and the leak that follows is audible across the room.',
      camera: { position: [1.3, 2.5, 2.2], target: [-0.25, 1.35, -0.05] },
      dofAperture: 0.00035,
      focus: ['Chordae tendineae', 'Papillary muscle'],
      onEnter: view({ labels: 'chordae', lid: 0, reveal: 1 }),
      timeline: run({ duration: 1800 }),
    },
    {
      id: 'wiring',
      heading: 'It fires itself — and then it waits, on purpose',
      body: 'No nerve tells the heart to beat. A patch of cells at the top of the right atrium, the sinoatrial node, leaks itself up to threshold and goes off on its own, roughly once a second. The wave crosses both atria in about 90 milliseconds and squeezes them. Then it reaches the atrioventricular node and stops dead for another 100 or so. That stall is the whole design: it buys the atria time to finish topping the ventricles up, the last 20 to 30 percent of the fill. Only then does the signal drop into the bundle of His and the Purkinje fibres — 2 to 4 metres a second — and light the entire ventricle almost at once, apex first, so the squeeze wrings upward toward the exits instead of pinching shut in the middle.',
      hint: 'Watch the AV node sit there lit while nothing below it moves.',
      camera: { position: [-1.8, 3.0, 4.6], target: [-0.95, 1.75, -0.1] },
      dofAperture: 0.00006,
      focus: ['AV node — the 0.1 s stall', 'SA node — the pacemaker'],
      onEnter: view({ labels: 'wiring', lid: 0, reveal: 1, wire: 1, vess: 0 }),
      timeline: run({ duration: 2700 }),
    },
    {
      id: 'coronary',
      heading: 'It can only feed itself between beats',
      body: 'The muscle needs blood like everything else, and it gets it from two arteries that leave the aorta a centimetre above the valve and then lie on the outside of the heart. Here is the catch: when the left ventricle squeezes, it squeezes those arteries shut as well. So the heart’s own supply arrives almost entirely during diastole — the gap between beats. Speed the heart up and the gap shrinks faster than the beat does, which is why a heart under strain can starve for reasons that have nothing to do with anything being blocked. Watch the beads: they crawl through the squeeze and run in the pause.',
      camera: { position: [3.8, 3.8, 5.7], target: [-0.45, 2.1, 0.1] },
      dofAperture: 0.00004,
      freeOrbit: true,
      onEnter: view({ labels: false, lid: 1, reveal: 0, cor: 1 }),
      timeline: run({ duration: 2100, beats: 1, rock: 0.16 }),
    },
  ],
});
