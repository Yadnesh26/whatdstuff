import { defineExplainer } from '../../framework/index.js';
import { win } from '../../framework/motion.js';
import meta from './meta.js';
import { buildLock } from './model.js';

// Every step loops while active. Seamlessness rule: each lap ends on the pose
// it started from — the key returns to where it entered, the plug returns to
// its rest angle, the turntable advances a whole turn.

const LIFTS = [0.58, 0.4, 0.52, 0.34, 0.46]; // must match model.js
const CHAMBER_Z = [0.52, 0.22, -0.08, -0.38, -0.68];
const PICK_ORDER = [2, 0, 4, 1, 3]; // the order the drilling happens to impose

const lerp = (a, b, t) => a + (b - a) * t;
// raw (un-eased) window — `win` already smoothsteps, which would warp timing
const seg = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));

// a blocked plug: pressure rises, metal stops it, pressure comes off
const jam = (u) => {
  const c = Math.abs(Math.sin(u * Math.PI));
  return c * c;
};

export default defineExplainer({
  ...meta,

  stageOptions: { dof: true },

  buildScene({ scene }) {
    return buildLock({ scene });
  },

  steps: [
    {
      id: 'product',
      heading: 'The thing on your door',
      body: 'A deadbolt: a brass cylinder, a steel case, and an inch of hardened bolt buried in the door frame. Push the right key in, turn it half a revolution, and the bolt slides back out of the wall. From out here it looks like the lock is reading your key — comparing it against something it remembers. It is not. There is nothing in there that can read.',
      hint: 'Drag to orbit · scroll to look inside.',
      camera: { position: [3.44, 4.59, 9.6], target: [-2.1, 1.19, 0.72] },
      focus: ['Bolt'],
      onEnter: ({ handles }) => {
        handles.set({
          reveal: 0,
          stacks: true,
          key: 'right',
          keyIn: 0,
          turn: 0,
          creep: 0,
          set: [0, 0, 0, 0, 0],
          shear: false,
          spin: 0,
        });
        handles.setLabels('exterior');
      },
      timeline({ tl, handles }) {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 9000,
          ease: 'linear',
          onUpdate: () => {
            const t = s.t;
            const inn = win(t, 0.02, 0.16);
            const out = 1 - win(t, 0.8, 0.96);
            const open = win(t, 0.2, 0.42);
            const close = win(t, 0.5, 0.72);
            handles.set({ keyIn: Math.min(inn, out), turn: open - close });
          },
        });
      },
    },

    {
      id: 'shear-line',
      heading: 'A cylinder inside a cylinder',
      body: 'Cut it in half and the lock turns out to be two cylinders. The outer one — the shell — is fixed in the door. The inner one — the plug — carries the keyway, and with its chambers still empty it simply spins, winding the bolt in and out as it goes. All that separates the two is a running clearance about four thousandths of an inch wide: the thickness of one sheet of paper. That gap is the whole lock.',
      camera: { position: [3.11, 5.74, 6.03], target: [-1.84, 2.13, 0.53] },
      dofAperture: 0.00008,
      focus: ['Shear line'],
      onEnter: ({ handles }) => {
        handles.set({
          reveal: 1,
          stacks: false, // nothing in the chambers yet — that is the point
          key: 'none',
          keyIn: 0,
          turn: 0,
          creep: 0,
          set: [0, 0, 0, 0, 0],
          shear: true,
          spin: 0,
        });
        handles.setLabels('internal');
      },
      timeline({ tl, handles }) {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 6000,
          ease: 'linear',
          // one WHOLE revolution of the plug per lap; the fork is a scotch yoke,
          // so the bolt rides a pure cosine out and back
          onUpdate: () => handles.set({ turn: s.t * 2 }),
        });
      },
    },

    {
      id: 'locked',
      heading: 'Five pins in the way',
      body: 'Now fill those chambers. Each takes a spring, a nickel driver pin, and a brass key pin underneath it, and the chambers run straight down through the shell and on into the plug. Pull the key out and the springs shove every stack down, so each driver pin ends up half in the shell and half in the plug — five steel pegs pinning the two cylinders together. Lean on the plug now and it moves a fraction of a degree and stops dead.',
      camera: { position: [2.57, 6.5, 3.65], target: [-1.56, 2.61, 0.86] },
      dofAperture: 0.00018,
      focus: ['Driver pin', 'Spring'],
      onEnter: ({ handles }) => {
        handles.set({
          reveal: 1,
          stacks: true,
          key: 'right',
          keyIn: 1,
          turn: 0,
          creep: 0,
          set: [0, 0, 0, 0, 0],
          shear: true,
          spin: 0,
        });
        handles.setLabels('stack');
      },
      timeline({ tl, handles }) {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 5200,
          ease: 'linear',
          onUpdate: () => {
            const t = s.t;
            // key out → springs slam the stacks down → the plug jams → key back
            const out = 1 - (win(t, 0.0, 0.26));
            const back = (win(t, 0.78, 1.0));
            const keyIn = t < 0.5 ? out : Math.max(out, back);
            const creep = 0.05 * jam(seg(t, 0.34, 0.74) * 2);
            handles.set({ keyIn, creep });
          },
        });
      },
    },

    {
      id: 'the-key',
      heading: 'The key is five ramps',
      body: 'A key is not a password — it is a row of machined heights. Each cut lifts its own key pin by exactly the amount that puts the joint between key pin and driver pin level with the shear line. Watch the pins bob as the blade slides past them: every cut lifts every pin it passes, and they only land together when the key is all the way home. Five splits, one line, nothing left crossing it.',
      camera: { position: [4.18, 4.7, 2.8], target: [-1.19, 2.46, 1.46] },
      dofAperture: 0.0002,
      focus: ['The split'],
      onEnter: ({ handles }) => {
        handles.set({
          reveal: 1,
          stacks: true,
          key: 'right',
          keyIn: 0,
          turn: 0,
          creep: 0,
          set: [0, 0, 0, 0, 0],
          shear: true,
          spin: 0,
        });
        handles.setLabels('stack');
      },
      timeline({ tl, handles }) {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 6000,
          ease: 'linear',
          onUpdate: () => {
            const t = s.t;
            const inn = (win(t, 0.05, 0.55));
            const out = 1 - (win(t, 0.78, 0.98));
            handles.set({ keyIn: t < 0.66 ? inn : Math.min(inn, out) });
          },
        });
      },
    },

    {
      id: 'turn',
      heading: 'Half a turn, one inch of bolt',
      body: 'With the gap clear, the plug simply turns — a full half revolution, key and all, while the driver pins sit up on the shear line, stranded. Its tail carries a crank pin, and that pin rides in the fork on the back of the bolt: half a turn of rotation becomes an inch of straight-line travel, and the bolt pulls out of the door frame. Everything else in this lock exists to permit that half turn.',
      camera: { position: [5.43, 8.34, 6.99], target: [-1.19, 1.65, 0.59] },
      dofAperture: 0.00006,
      focus: ['Bolt fork', 'Bolt'],
      onEnter: ({ handles }) => {
        handles.set({
          reveal: 1,
          stacks: true,
          key: 'right',
          keyIn: 1,
          turn: 0,
          creep: 0,
          set: [0, 0, 0, 0, 0],
          shear: true,
          spin: 0,
        });
        handles.setLabels('release');
      },
      timeline({ tl, handles }) {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 5000,
          ease: 'linear',
          onUpdate: () => {
            const t = s.t;
            const open = (win(t, 0.12, 0.45));
            const close = (win(t, 0.62, 0.95));
            handles.set({ turn: open - close });
          },
        });
      },
    },

    {
      id: 'wrong-key',
      heading: 'A wrong key fails like a stick',
      body: 'This key fits the keyway and is cut wrong in two places. Chamber two is left short, so its driver pin still bridges the gap. Chamber four is cut too shallow and overlifts, so now the key pin itself pokes across. Three of the five chambers are perfect and the plug still will not move. Nothing was compared, nothing was rejected — there is simply metal in the way again.',
      camera: { position: [3.55, 4.47, 4.52], target: [-1.52, 2.33, 1.59] },
      dofAperture: 0.00022,
      focus: ['The split'],
      onEnter: ({ handles }) => {
        handles.set({
          reveal: 1,
          stacks: true,
          key: 'wrong',
          keyIn: 0,
          turn: 0,
          creep: 0,
          set: [0, 0, 0, 0, 0],
          shear: true,
          spin: 0,
        });
        handles.setLabels('stack');
      },
      timeline({ tl, handles }) {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 5400,
          ease: 'linear',
          onUpdate: () => {
            const t = s.t;
            const inn = (win(t, 0.02, 0.38));
            const out = 1 - (win(t, 0.84, 1.0));
            handles.set({
              keyIn: t < 0.6 ? inn : Math.min(inn, out),
              creep: 0.05 * jam(seg(t, 0.42, 0.8) * 2),
            });
          },
        });
      },
    },

    {
      id: 'picking',
      heading: 'The flaw is the drilling',
      body: 'Those five chambers cannot be drilled perfectly in line — the tolerance is around a thousandth of an inch. So when a wrench puts turning pressure on the plug, one chamber pinches its driver pin before any other. Lift that one pin to the shear line and the plug creeps a fraction of a degree; the driver drops onto the edge of the plug and stays there. Now the next pin binds. Five one-pin puzzles, solved in whatever order the factory decided — and no key involved.',
      camera: { position: [3.92, 6.02, 3.0], target: [-1.24, 2.45, 1.12] },
      dofAperture: 0.00026,
      focus: ['On the ledge', 'Tension wrench'],
      onEnter: ({ handles }) => {
        handles.set({
          reveal: 1,
          stacks: true,
          key: 'tools',
          keyIn: 0,
          turn: 0,
          creep: 0,
          set: [0, 0, 0, 0, 0],
          pickIndex: PICK_ORDER[0],
          pickZ: CHAMBER_Z[PICK_ORDER[0]],
          pickLift: 0,
          shear: true,
          spin: 0,
        });
        handles.setLabels('attack');
      },
      timeline({ tl, handles }) {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 9000,
          ease: 'linear',
          onUpdate: () => {
            const t = s.t;
            const set = [0, 0, 0, 0, 0];
            let pickIndex = PICK_ORDER[0];
            let pickZ = CHAMBER_Z[PICK_ORDER[0]];
            let pickLift = 0;
            let turn = 0;

            const P0 = 0.08;
            const SPAN = 0.144; // five phases fill 0.08 → 0.80

            if (t < P0) {
              // tension goes on before anything moves
            } else if (t < P0 + SPAN * 5) {
              const k = Math.min(4, Math.floor((t - P0) / SPAN));
              const u = (t - P0 - k * SPAN) / SPAN;
              const i = PICK_ORDER[k];
              pickIndex = i;
              const fromZ = CHAMBER_Z[PICK_ORDER[Math.max(0, k - 1)]];
              pickZ = lerp(fromZ, CHAMBER_Z[i], (win(u, 0, 0.22)));
              const rise = (win(u, 0.24, 0.6));
              const drop = (win(u, 0.72, 0.95));
              pickLift = LIFTS[i] * (1.05 * rise - 1.05 * drop);
              for (let j = 0; j < k; j++) set[PICK_ORDER[j]] = 1;
              if (u >= 0.66) set[i] = 1; // the driver catches on the plug's edge
            } else if (t < 0.93) {
              for (const i of PICK_ORDER) set[i] = 1;
              pickIndex = PICK_ORDER[4];
              pickZ = CHAMBER_Z[PICK_ORDER[4]];
              turn = 0.42 * (win(t, 0.8, 0.9));
            } else {
              // let everything fall back so the lap wraps on its opening pose
              const r = (win(t, 0.93, 1.0));
              turn = 0.42 * (1 - r);
              pickZ = lerp(CHAMBER_Z[PICK_ORDER[4]], CHAMBER_Z[PICK_ORDER[0]], r);
              for (const i of PICK_ORDER) set[i] = r < 0.45 ? 1 : 0;
            }

            const setCount = set.reduce((a, b) => a + b, 0);
            const creep =
              t < P0
                ? 0.014 * (win(t, 0, P0))
                : t < 0.93
                  ? 0.014 + 0.018 * setCount
                  : (0.014 + 0.09) * (1 - (win(t, 0.93, 1.0)));

            handles.set({ set, pickIndex, pickZ, pickLift, turn, creep });
          },
        });
      },
    },

    {
      id: 'run',
      heading: 'Springs, pins and a gap',
      body: 'Put it back together and nothing about it changes. Five springs, five pairs of pins, a cam, and four thousandths of an inch of clearance between two brass cylinders. Every key ever cut does the same single job: it lifts five pieces of metal out of the path of a rotation. Nothing in there ever checked your key.',
      hint: 'Drag to orbit the running lock.',
      camera: { position: [9.29, 6.12, 4.68], target: [-0.49, 1.49, 1.12] },
      freeOrbit: true,
      onEnter: ({ handles }) => {
        handles.set({
          reveal: 0,
          stacks: true,
          key: 'right',
          keyIn: 0,
          turn: 0,
          creep: 0,
          set: [0, 0, 0, 0, 0],
          shear: false,
          spin: 0,
        });
        handles.setLabels(false);
      },
      timeline({ tl, handles }) {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 7000,
          ease: 'linear',
          onUpdate: () => {
            const t = s.t;
            const inn = (win(t, 0.02, 0.18));
            const out = 1 - (win(t, 0.84, 1.0));
            const open = (win(t, 0.22, 0.44));
            const close = (win(t, 0.58, 0.8));
            handles.set({ keyIn: Math.min(inn, out), turn: open - close });
          },
        });
      },
    },
  ],
});
