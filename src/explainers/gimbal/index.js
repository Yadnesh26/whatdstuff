import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildGimbal } from './model.js';

// Seamlessness: every step's `t` is a lap phase 0..1; every periodic term in
// model.js's shakeAngles() is a whole sine cycle of that phase, so t=0 and
// t=1 land on an identical pose. The gimbal-lock step's three phases are
// fixed fractions of the same 0..1 lap for the same reason.

export default defineExplainer({
  ...meta,

  buildScene({ scene }) {
    return buildGimbal({ scene });
  },

  stageOptions: { dof: true },

  steps: [
    {
      id: 'overview',
      heading: '1 · Decoupled, Not Clamped',
      body: 'That yoke is trembling right now — a few degrees of yaw, pitch and roll, the kind of shake a hand can’t help making. Watch the center instead: it never moves. Three nested rings sit between the shake and the payload, and each one only ever answers for a single rotation.',
      hint: 'Drag to orbit — keep your eyes on the middle.',
      camera: { position: [3.2, 2.6, 4.4], target: [0, 1.6, 0.05] },
      focus: ['Stabilized payload'],
      onEnter: ({ handles }) => handles.setLabels('anatomy'),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 6000,
          ease: 'linear',
          onUpdate: () =>
            handles.set({ t: s.t, axisMode: 'all', shakeAmp: 0.12, lag: 0, motors: 0, imu: 0 }),
        });
      },
    },
    {
      id: 'axes',
      heading: '2 · Three Rings, Three Axes',
      body: 'Yaw first: the outer ring alone swings to cancel it while the other two hold dead still. Then pitch — only the middle ring moves. Then roll — only the inner ring. Each ring is mechanically blind to the other two rotations, so each one only ever has one job.',
      camera: { position: [2.2, 2.0, 3.1], target: [0, 1.72, 0.05] },
      onEnter: ({ handles }) => handles.setLabels(false),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 5200,
          ease: 'linear',
          onUpdate: () =>
            handles.set({ t: s.t, axisMode: 'cycle', shakeAmp: 0.24, lag: 0, motors: 0, imu: 0 }),
        });
      },
    },
    {
      id: 'passive',
      heading: '3 · Passive: Gravity Does the Work',
      body: 'No motor is running here — the small weight hanging under the payload does all the work. It pulls the payload’s center of mass below the pivot, so any tilt creates its own restoring torque — the same trick that keeps a ship’s compass level and a drink from spilling in a gimbaled cup holder. It settles a beat behind the shake instead of snapping ahead of it.',
      camera: { position: [2.7, 1.25, 3.5], target: [0, 1.4, 0] },
      focus: ['Counterweight'],
      onEnter: ({ handles }) => handles.setLabels('anatomy'),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 4400,
          ease: 'linear',
          onUpdate: () =>
            handles.set({ t: s.t, axisMode: 'all', shakeAmp: 0.14, lag: 0.06, motors: 0, imu: 0 }),
        });
      },
    },
    {
      id: 'active',
      heading: '4 · Active: IMU + Brushless Motors',
      body: 'Swap the weight for a sensor and the same three rings become a camera gimbal. An inertial measurement unit reads orientation hundreds of times a second; a small brushless motor sits at each ring, correcting within milliseconds of every nudge. Push it harder than gravity ever could, and it still doesn’t blink.',
      camera: { position: [-1.55, 2.35, -2.15], target: [0, 1.82, -0.08] },
      dofAperture: 0.00018,
      focus: ['IMU sensor', 'Roll ring & motor'],
      onEnter: ({ handles }) => handles.setLabels('anatomy'),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 3200,
          ease: 'linear',
          onUpdate: () =>
            handles.set({ t: s.t, axisMode: 'all', shakeAmp: 0.22, lag: 0, motors: 1, imu: 1 }),
        });
      },
    },
    {
      id: 'lock',
      heading: '5 · Gimbal Lock',
      body: 'Tilt the middle ring a full 90 degrees and something breaks: the outer ring’s axis and the inner ring’s axis now point the same way. Spin one, then spin the other — the payload sweeps the identical arc either way. The direction that used to sit between them, the one only a third ring could reach, is simply gone until the rig untilts.',
      camera: { position: [2.85, 2.35, 3.5], target: [0, 1.78, 0] },
      focus: ['Pan/yaw ring', 'Roll ring & motor'],
      onEnter: ({ handles }) => handles.setLabels('anatomy'),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 7200,
          ease: 'linear',
          onUpdate: () => handles.set({ t: s.t, axisMode: 'lock', motors: 1, imu: 1 }),
        });
      },
    },
    {
      id: 'run',
      heading: '6 · Run It',
      body: 'Un-tilt, and all three axes come back independent. That is the whole trick: nothing clamps the payload — the rings simply give the shake nowhere to go, one axis surrendered to each ring, until two of them are asked for the same one.',
      camera: { position: [3.6, 2.2, 4.6], target: [0, 1.65, 0] },
      freeOrbit: true,
      onEnter: ({ handles }) => handles.setLabels(false),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 3000,
          ease: 'linear',
          onUpdate: () =>
            handles.set({ t: s.t, axisMode: 'all', shakeAmp: 0.16, lag: 0, motors: 1, imu: 1 }),
        });
      },
    },
  ],
});
