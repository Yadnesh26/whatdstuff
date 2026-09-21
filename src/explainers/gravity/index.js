import { defineExplainer } from '../../framework/index.js';
import { win, TAU } from '../../framework/motion.js';
import meta from './meta.js';
import { buildGravity } from './model.js';

// Camera bearings rather than raw vectors. The rig is a tall thin object with
// two satellite stations (the clock rail, the projection), so the shot list
// has to march the azimuth steadily around it — 34 deg to 346 deg over nine
// steps, one continuous hero arc — while the distance swings 4.5 -> 1.0 ->
// 4.9 to alternate wide staging with macro.
function shot(azDeg, elDeg, dist, target, push = 0.15) {
  const a = (azDeg * Math.PI) / 180;
  const e = (elDeg * Math.PI) / 180;
  const d = [Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a)];
  const position = [
    target[0] + dist * d[0],
    target[1] + dist * d[1],
    target[2] + dist * d[2],
  ];
  // Aim off-axis so the subject sits right of frame centre — the text panel
  // owns the left ~38% of the viewport. Camera-right in world is
  // normalize(cross(worldUp, eye - target)) = (dz, 0, -dx).
  const rx = d[2];
  const rz = -d[0];
  const rl = Math.hypot(rx, rz) || 1;
  const k = (push * dist) / rl;
  return { position, target: [target[0] - k * rx, target[1], target[2] - k * rz] };
}

// The holographic projection is a flat plane. Turning it to face the active
// camera keeps it readable: rotating +Z by (90 - az) aims its normal along the
// camera bearing.
const faceCam = (azDeg) => ((90 - azDeg) * Math.PI) / 180;

const RIG = [0, 1.4, 0]; // the column as a whole
const CAP = [0, 1.945, 0]; // the capsule held at the release clamp
const FALL = [0, 1.38, 0]; // midpoint of the capsule's travel
const CLK = [-0.63, 1.395, 0]; // between the two clock heads, on the -X rail
const PROJ = [2.25, 1.56, 0]; // the projection station

// Every onEnter pins the COMPLETE state — anything left unpinned inherits
// whatever mid-lap phase the previous step's loop happened to be at, and the
// fixed camera then frames the wrong thing.
const pin = (over) => ({
  spin: 0,
  drop: 0,
  selftest: 0,
  dither: 0,
  reveal: 0,
  lattice: 0,
  sag: 0,
  clocks: 0,
  beat: 0,
  worldline: 0,
  wlPhase: 0,
  scale: 0,
  orbit: 0,
  orbitPhase: 0,
  projYaw: 0,
  ...over,
});

export default defineExplainer({
  ...meta,

  stageOptions: { dof: true },

  buildScene({ scene }) {
    return buildGravity({ scene });
  },

  steps: [
    {
      id: 'hero',
      heading: '1 · A capsule that is about to weigh nothing',
      body: 'This is a drop column — a glass tube with the air pumped out and a capsule hanging at the top of it. Inside that capsule is an ordinary accelerometer, the same kind of part that knows which way up your phone is. Held still, it reads 1.000 g. In a moment the clamp opens, and for the quarter-second it spends falling, that number will be zero. Nothing about the Earth changes in between.',
      hint: 'The number on the fascia is live — watch it through the drop.',
      camera: shot(34, 8, 4.5, RIG),
      dofAperture: 0.00003,
      onEnter: ({ handles }) => {
        handles.set(pin({ reveal: 0 }));
        handles.setLabels('exterior');
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 9000,
          ease: 'linear',
          onUpdate: () => handles.set({ drop: s.t, spin: s.t * TAU }),
        });
      },
    },

    {
      id: 'accelerometer',
      heading: '2 · What the instrument actually measures',
      body: 'Ghost the shell and there is one moving part: a tungsten proof mass slung on springs between two metal plates. Sitting on the bench it hangs low, closer to the bottom plate than the top. That is not gravity dragging it down. It is the bench pushing the case UP, and the springs taking a moment to haul the mass along with it. The gap between mass and plate changes, the electronics read that gap, and they call it 1.000 g.',
      hint: 'The slow breathing is the self-test — a test voltage nudging the mass to prove the pickoff is alive.',
      camera: shot(66, 2, 1.0, CAP),
      dofAperture: 0.00028,
      onEnter: ({ handles }) => {
        // drop 0.05 is inside the held phase: clamp shut, capsule at the top,
        // a clean 1.000 g for the copy to point at.
        handles.set(pin({ reveal: 1, drop: 0.05, dither: 0.18 }));
        handles.setLabels('internal');
      },
      focus: ['Proof mass', 'Frame — pushed up by the bench'],
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 7000,
          ease: 'linear',
          // drives the amplitude too, so this step's motion does not depend on
          // onEnter having run first
          onUpdate: () => handles.set({ selftest: s.t, drop: 0.05, dither: 0.18 }),
        });
      },
    },

    {
      id: 'freefall',
      heading: '3 · Let go, and the force disappears',
      body: 'The clamp opens. Case and mass now fall at exactly the same rate, so the springs go slack and the mass drifts to dead centre. The readout says 0.000. That is the honest reading, not a broken one: a falling object has no force acting on it. What you feel standing on the floor was never gravity — it is the floor, refusing to let you fall. That push is the only thing your body has ever actually felt.',
      hint: 'The spike near the bottom is the catch cradle stopping it — about six g.',
      camera: shot(84, 2, 2.15, FALL),
      dofAperture: 0.00008,
      onEnter: ({ handles }) => {
        handles.set(pin({ reveal: 1 }));
        handles.setLabels('internal');
      },
      focus: ['Proof mass'],
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 5200,
          ease: 'linear',
          onUpdate: () => handles.set({ drop: s.t }),
        });
      },
    },

    {
      id: 'geometry',
      heading: '4 · So what chooses the path?',
      body: 'If nothing pulls, something still has to decide where a free object goes. The answer is that mass and energy bend the geometry of spacetime, and anything left alone simply takes the straightest line that geometry allows. The lattice around the column is that geometry. Notice what it does not do: it does not sag like a sheet. Its planes crowd — evenly spaced far from the mass, packed tighter as they get closer to it.',
      hint: 'Exaggerated a hundred million billion times over — the real difference is seventeen decimal places down.',
      camera: shot(148, 16, 4.9, RIG),
      dofAperture: 0.00003,
      onEnter: ({ handles }) => {
        handles.set(pin({ reveal: 0, lattice: 1, sag: 1 }));
        handles.setLabels('field');
      },
      focus: ['Packed tighter = time runs slower'],
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 8000,
          ease: 'linear',
          onUpdate: () => handles.set({ drop: s.t }),
        });
      },
    },

    {
      id: 'clocks',
      heading: '5 · The crowding is in time, not space',
      body: 'Each plane is one tick of a clock, so planes packed closer together mean a clock down there gets through fewer ticks — it genuinely runs slow. Not apparently: measurably. In 2010 two aluminium-ion clocks were compared with one raised 33 centimetres above the other, exactly the gap between these two heads, and they disagreed by about four parts in a hundred million billion. At that rate the upper clock needs roughly 900 million years to gain a single second.',
      hint: 'Your head really is ageing faster than your feet. By about a microsecond per lifetime.',
      camera: shot(186, 3, 1.85, CLK),
      dofAperture: 0.00016,
      onEnter: ({ handles }) => {
        handles.set(pin({ reveal: 0, lattice: 0.35, sag: 1, clocks: 1 }));
        handles.setLabels('clocks');
      },
      focus: ['Upper clock · +33 cm', 'Rate gap 3.6e-17, amplified'],
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 7000,
          ease: 'linear',
          onUpdate: () => handles.set({ beat: s.t, drop: s.t }),
        });
      },
    },

    {
      id: 'worldline',
      heading: '6 · A straight line through crowded time bends',
      body: "Here is a thrown ball's path with time running left to right and height running up. It has to get from one end to the other, and every route it could take spends its seconds at different heights — and higher up, clocks run faster. But climb too high and you must move fast to get back down, and speed slows your clock again. The winning route is the exact compromise between those two, and it is the one the ball takes. That arc is not a fall. It is the path that ages the most.",
      hint: 'Over a two-second toss it gains about 0.4 femtoseconds on a ball that stayed put.',
      camera: shot(228, 12, 3.4, PROJ),
      dofAperture: 0.00006,
      onEnter: ({ handles }) => {
        handles.set(
          pin({ reveal: 0, lattice: 0.12, sag: 1, worldline: 1, projYaw: faceCam(228) }),
        );
        handles.setLabels('world');
      },
      focus: ['The path that ages most · +0.4 fs'],
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 6500,
          ease: 'linear',
          onUpdate: () => handles.set({ wlPhase: s.t, drop: s.t }),
        });
      },
    },

    {
      id: 'truescale',
      heading: '7 · At true scale it is almost perfectly straight',
      body: 'That drawing cheats. It makes two seconds about as wide as five metres are tall. Draw it honestly — one second of time is 300,000 kilometres across — and the arc flattens into something you cannot tell from a straight line. It is a piece of a circle whose radius is c²/g: 9.2 thousand million million metres, or 0.97 light-years. Every falling thing near Earth rides an arc of that same circle. Spacetime is barely bent at all. You only notice because you have spent your whole life watching one metre of it.',
      hint: 'The rescale runs out and back each loop — same arc, two honesties.',
      camera: shot(256, 8, 4.2, PROJ),
      dofAperture: 0.00004,
      onEnter: ({ handles }) => {
        handles.set(
          pin({ reveal: 0, lattice: 0.1, sag: 1, worldline: 1, projYaw: faceCam(256) }),
        );
        handles.setLabels('world');
      },
      focus: ['Time across · height up'],
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 7000,
          ease: 'linear',
          onUpdate: () => {
            // Out to true scale, hold, and back — so the lap wraps on itself.
            const sc = win(s.t, 0.06, 0.3) - win(s.t, 0.72, 0.96);
            handles.set({ scale: sc, wlPhase: s.t, drop: s.t });
          },
        });
      },
    },

    {
      id: 'orbit',
      heading: '8 · Run it sideways and it never lands',
      body: 'Nothing changes but speed. Give that same free path enough sideways motion and it closes into a loop: the object still takes the straightest line available, and the line simply comes back round. That is an orbit — falling that keeps missing. The probe riding it reads exactly what our capsule read inside the tube: 0.000 g. Astronauts do not float because gravity ran out. At the space station they still sit in about 90 percent of the pull you feel right now. They float because they are falling, and so is everything around them.',
      hint: 'Same reading, same physics, no ground in the way.',
      camera: shot(300, 30, 4.4, PROJ),
      dofAperture: 0.00005,
      onEnter: ({ handles }) => {
        handles.set(
          pin({ reveal: 0, lattice: 0.1, sag: 1, orbit: 1, projYaw: faceCam(300) }),
        );
        handles.setLabels('orbit');
      },
      focus: ['Still reading 0.000 g'],
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 6000,
          ease: 'linear',
          onUpdate: () => handles.set({ orbitPhase: s.t, drop: s.t }),
        });
      },
    },

    {
      id: 'open',
      heading: '9 · What is settled, and what is not',
      body: 'Everything you just watched is measured rather than argued — the zero reading, the clock gap, the orbit, each of them confirmed to many decimal places. What nobody can tell you is why gravity is so faint: between two protons it loses to electric repulsion by a factor of 10³⁶, a billion billion billion billion times over, and there is no accepted reason for it. Nor does anyone know what spacetime is made of. Relativity says it is smooth and bends; quantum mechanics says everything comes in grains and jitters. Both must be true somewhere, and no one has written down where.',
      hint: 'A century old, still open. Drag to look around.',
      camera: shot(346, 10, 5.2, RIG),
      dofAperture: 0.00003,
      freeOrbit: true,
      onEnter: ({ handles }) => {
        handles.set(pin({ reveal: 0 }));
        handles.setLabels('exterior');
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 7500,
          ease: 'linear',
          onUpdate: () => handles.set({ drop: s.t, spin: s.t * TAU }),
        });
      },
    },
  ],
});
