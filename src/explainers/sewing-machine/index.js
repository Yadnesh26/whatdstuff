import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildSewingMachine } from './model.js';

// Every step loops while active. ONE scalar drives the whole machine: `cycle`,
// in degrees of arm-shaft rotation, 360 per stitch. Seamlessness is free as
// long as a lap advances a WHOLE number of stitches — the arm shaft and the
// handwheel turn N times, the hook 2N, the motor pulley 3N, the feed dogs run
// N whole ellipses, and the cloth advances N stitch pitches with the row of
// finished stitches recycling at exactly one pitch, so the wrap pose is
// identical to the start pose.
//
// `start` shifts where in the stitch the lap BEGINS. It changes nothing while
// the loop runs — a loop has no beginning — but it decides which phase the
// deterministic 30%/60% captures land on, and the loop only exists for 97 of
// the 360 degrees. Without it every still of the hook steps showed a bare
// needle and four callouts pointing at nothing happening.
const run = (cycles, duration, start = 0) => ({ tl, handles }) => {
  const s = { t: 0 };
  tl.add(s, {
    t: 1,
    duration,
    ease: 'linear',
    onUpdate: () => handles.setCycle(start + s.t * 360 * cycles),
  });
};

// Every step pins EVERY state field, cycle phase included. Anything left unset
// inherits the previous step's mid-lap pose and misframes the fixed camera.
const pin = (labels, extra = {}) => ({ handles }) => {
  handles.set({ cycle: 0, reveal: 0, open: 0, ...extra });
  handles.setLabels(labels);
};

export default defineExplainer({
  ...meta,

  stageOptions: { dof: true },

  buildScene({ scene }) {
    return buildSewingMachine({ scene });
  },

  steps: [
    {
      id: 'machine',
      heading: 'A knot, a thousand times a minute',
      body: 'Every stitch this machine makes is a knot. Not a loop pulled through a loop like knitting — a real interlock between two separate threads, tied inside the cloth, about a thousand times a minute. From out here you can see maybe a fifth of the machine that does it: a needle, a foot, a wheel. Everything else is under the cream casting, and almost all of it exists to keep two moving parts within a tenth of a millimetre of each other.',
      hint: 'Drag to orbit · scroll to open it up.',
      camera: { position: [2.4, 2.15, 3.45], target: [-0.55, 1.05, 0] },
      dofAperture: 0.00003,
      focus: ['Needle', 'Handwheel'],
      onEnter: pin('exterior'),
      timeline: run(3, 8000),
    },
    {
      id: 'threads',
      heading: 'Two threads that never meet',
      body: 'There are two threads in here and they live in separate worlds. The top one comes off the spool, down through a pair of tension discs, up over the take-up lever and into the needle. The bottom one is wound on a bobbin sitting under the needle plate. Here is the part almost nobody realises: the bobbin thread never passes through the cloth. Not once. It lies underneath, and the top thread has to come down and lasso it.',
      camera: { position: [0.43, 2.05, 2.95], target: [-0.82, 1.55, 0.05] },
      dofAperture: 0.00004,
      focus: ['Tension discs', 'Bobbin'],
      onEnter: pin('thread', { reveal: 1, open: 1 }),
      timeline: run(2, 9000),
    },
    {
      id: 'needle',
      heading: 'The eye is at the point',
      body: 'The eye of a sewing needle is at the sharp end. That one idea is the entire machine — put the eye at the blunt end, the way a hand needle has it, and there is no way to get the thread back out of the fabric. Watch the bottom of the stroke: the needle reaches the bottom, then rises about two millimetres. Friction in the cloth holds the thread back, and a small loop bulges out behind the needle, against the flat scooped into its back — the scarf.',
      hint: 'Needle plate lifted and the bed cut open, so you can see under the cloth.',
      camera: { position: [-0.843, 0.636, 0.26], target: [-0.848, 0.608, 0] },
      dofAperture: 0.00012,
      focus: ['The eye', 'The loop'],
      onEnter: pin('needle', { open: 1, cycle: 25 }),
      timeline: run(1, 4400, 25),
    },
    {
      id: 'catch',
      heading: 'A tenth of a millimetre',
      body: 'That loop exists for about a hundredth of a second, and this is what it is for. A hardened steel beak on the rotating hook swings round, passes the needle closer than the thickness of a sheet of paper, and slides straight through the middle of it. Arrive two degrees late and the loop has already collapsed — that is a skipped stitch. It is the tightest tolerance in the machine and it has to be hit on every single stroke.',
      camera: { position: [-0.95, 0.665, 0.42], target: [-0.88, 0.615, -0.01] },
      dofAperture: 0.00024,
      focus: ['Hook point', 'Bobbin case'],
      onEnter: pin('hook', { open: 1, cycle: 107 }),
      timeline: run(1, 4400, 107),
    },
    {
      id: 'around',
      heading: 'All the way around the bobbin',
      body: 'Now the hook drags the loop right around the outside of the bobbin case. One side of the loop slides over the top, the other under the bottom, and they meet again on the far side — which means the loop has just been passed completely around the bobbin, and the bobbin thread is threaded through it. The case itself never turns: a small finger holds it still while the hook spins around it, leaving a gap under a millimetre wide for the thread to slip through.',
      camera: { position: [-0.52, 0.92, 0.52], target: [-0.78, 0.58, 0] },
      dofAperture: 0.00022,
      focus: ['Bobbin case', 'Position finger'],
      onEnter: pin('hook', { open: 1, cycle: 170 }),
      timeline: run(1, 4600, 170),
    },
    {
      id: 'takeup',
      heading: 'The lever that ties it',
      body: 'The loop slips off the hook and leaves a long tail of slack thread under the cloth. Getting rid of that slack is the take-up lever\'s only job. It swings up and hauls the thread back, dragging the knot up off the bobbin and into the fabric. Where the knot stops is settled by a tug-of-war: the tension discs pulling from above against a little leaf spring on the bobbin case below. Balanced right, it stops halfway through the cloth, invisible from either side.',
      camera: { position: [0.05, 2.05, 1.35], target: [-0.8, 1.7, 0.12] },
      dofAperture: 0.00006,
      focus: ['Take-up lever'],
      onEnter: pin('takeup', { reveal: 1, open: 1, cycle: 272 }),
      timeline: run(1, 4400, 272),
    },
    {
      id: 'feed',
      heading: 'Nothing has moved the cloth yet',
      body: 'Under the plate, two toothed bars ride an oval track: up through the slots, back by exactly one stitch length, down, then forward again underneath. They only grip while they are up, and they are only up while the needle is clear of the cloth — a window of about 120 degrees of shaft rotation, with three degrees to spare at each end. The presser foot pins the cloth down onto them so it cannot slide. This one is set to 4.5 mm, the longest stitch it has, so you can see it move.',
      camera: { position: [-0.664, 0.86, 0.25], target: [-0.854, 0.672, 0.04] },
      dofAperture: 0.00018,
      focus: ['Feed dogs', '4.5 mm per stitch'],
      onEnter: pin('feed', { cycle: 144 }),
      timeline: run(2, 6200, 144),
    },
    {
      id: 'timing',
      heading: 'One shaft decides everything',
      body: 'There is one motor and one arm shaft, and no part of this machine decides anything for itself. The shaft throws the needle bar and swings the take-up lever. A belt carries the same rotation down to a lower shaft, which rides the feed cams — and then a pair of bevel gears doubles it, because the hook has to turn exactly twice for every one stroke of the needle. Two to one, forever. Slip a single tooth and the beak arrives at the wrong moment, and the machine simply stops sewing.',
      camera: { position: [1.81, 1.85, 2.55], target: [-0.19, 1.1, 0] },
      dofAperture: 0.00005,
      focus: ['Arm shaft', '2:1 bevel'],
      onEnter: pin('drive', { reveal: 1, open: 1 }),
      timeline: run(3, 6500),
    },
    {
      id: 'run',
      heading: 'One stitch, eleven milliseconds',
      body: 'Needle down. Needle up two millimetres. Beak through the loop, around the bobbin, cast off, take-up snaps it tight, dogs carry the cloth back one notch. That is one stitch. A domestic machine does it around a thousand times a minute; an industrial head gets through five and a half thousand — one complete knot every eleven milliseconds. Everything you are wearing is held together by some version of this.',
      hint: 'Drag to orbit the running machine.',
      camera: { position: [3.05, 1.95, 3.35], target: [-0.5, 1.0, -0.1] },
      freeOrbit: true,
      onEnter: pin(false),
      timeline: run(8, 5200),
    },
  ],
});
