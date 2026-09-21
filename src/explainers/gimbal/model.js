import * as THREE from 'three';
import { materials, rod, studioPlinth } from '../../framework/parts.js';
import { beveledBox, tubeAlong } from '../../framework/geometry.js';
import { calloutSets } from '../../framework/callouts.js';
import { smooth, TAU } from '../../framework/motion.js';

// A three-axis gimbal: yoke -> outer/yaw ring -> middle/pitch ring ->
// inner/roll ring -> a rigid, stabilized payload. Each ring is a CHILD of
// the previous and rotates about exactly one local axis, in this cascade:
//   handle (trembles)
//     -> outerRing.rotation.y   (yaw)
//       -> middleRing.rotation.x (pitch)
//         -> innerRing.rotation.z (roll)
//           -> payload (rigid — no rotation of its own)
//
// That Y -> X -> Z chain is the same "YXZ" Euler order three.js recommends
// for FPS cameras, chosen there BECAUSE its singularity sits at pitch =
// +-90deg — which is also exactly where a real three-ring gimbal loses a
// degree of freedom. We exploit the same decomposition on purpose:
//
//   handle applies a disturbance quaternion Qh. Decomposing Qh^-1 into a
//   YXZ Euler triple (ay, ax, az) and driving
//     outerRing.rotation.y = ay; middleRing.rotation.x = ax; innerRing.rotation.z = az
//   makes the composed transform
//     Qh * Qy(ay) * Qx(ax) * Qz(az) === Identity
//   by construction — so the payload (a rigid child of innerRing) holds
//   level in world space no matter how the handle trembles. "Passive" mode
//   feeds this decomposition a phase-delayed copy of the disturbance
//   instead of the live one, which reads as a settling lag rather than an
//   instant lock — a fair stand-in for gravity-driven correction, which
//   really is slower than active sensing.
//
// The gimbal-lock step does NOT fake a numerical failure (a quaternion
// controller never actually breaks this way — that's WHY modern IMU
// gimbals use quaternions, not Euler angles). Instead it demonstrates the
// literal, textbook definition: drive the pitch/middle ring to 90deg, then
// show that spinning EITHER the outer ring alone or the inner ring alone
// produces the identical payload motion (derived below) — the two axes
// really have become the same axis, so the direction that used to
// distinguish them is simply gone.
//
// Reference facts (see story.js for sources): Apollo's gimbal-lock warning
// fired at 70deg and froze the platform at 85deg; marine gimballed
// compasses self-right on a counterweight held below the pivot; modern
// camera gimbals sample an IMU hundreds of times a second and correct with
// per-axis brushless motors within milliseconds.

const PLINTH_H = 0.26;
const CY = 1.7; // gimbal common center, world Y
const R1 = 0.56; // outer/yaw ring radius
const R2 = 0.42; // middle/pitch ring radius
const R3 = 0.29; // inner/roll ring radius
const T1 = 0.042;
const T2 = 0.036;
const T3 = 0.03;

const AX_Y = new THREE.Vector3(0, 1, 0);
const AX_X = new THREE.Vector3(1, 0, 0);
const AX_Z = new THREE.Vector3(0, 0, 1);

export function buildGimbal({ scene }) {
  const group = new THREE.Group();
  scene.add(group);
  group.add(studioPlinth({ w: 3.2, h: PLINTH_H, d: 1.7 }));

  // --- materials --------------------------------------------------------
  const ring1Mat = materials.brushedSteel(0xc7ccd6);
  ring1Mat.roughness = 0.44;
  const ring2Mat = materials.brushedSteel(0xbdc6d4);
  ring2Mat.roughness = 0.44;
  const ring3Mat = materials.brushedSteel(0xb3bfd0);
  ring3Mat.roughness = 0.44;
  const yokeMat = materials.paintedMetal(0x22262d);
  const motorMat = materials.polymer(0x16181d);
  // dark at rest, glows via emissive only (motors "off" must read as dark,
  // not as a lit blue disc) — materials.glow ties color to emissive, so
  // these two are built directly instead
  const podGlow = new THREE.MeshStandardMaterial({
    color: 0x0a0c10,
    emissive: 0x8fb4ff,
    emissiveIntensity: 0,
    roughness: 0.4,
    metalness: 0.2,
  });
  const lugMat = materials.brushedSteel(0xcdaa5a);
  lugMat.roughness = 0.5;
  const payloadMat = materials.paintedMetal(0x1c2027);
  const lensMat = materials.opticalGlass({ color: 0xbfe0ff, thickness: 0.05, ior: 1.5, coating: 0.3 });
  const imuMat = new THREE.MeshStandardMaterial({
    color: 0x0a0c10,
    emissive: 0x6ee7ff,
    emissiveIntensity: 0,
    roughness: 0.3,
    metalness: 0.1,
  });
  const weightMat = materials.brushedSteel(0x8f97a3);
  weightMat.roughness = 0.5;
  const axisMat = materials.glow(0xffb454, 0);
  axisMat.transparent = true;
  axisMat.opacity = 0;
  axisMat.depthWrite = false;

  // --- yoke: fixed base + the handle group that trembles ------------------
  const yokeBase = beveledBox(0.62, 0.16, 0.5, yokeMat, 0.03);
  yokeBase.position.set(0, PLINTH_H + 0.08, -0.16);
  group.add(yokeBase);

  const handle = new THREE.Group();
  const hY = PLINTH_H + 0.16; // handle group's world Y (sits on the base)
  handle.position.set(0, hY, -0.16);
  group.add(handle);

  const topPivotY = CY + R1 - hY; // outer ring's top pivot, in handle-local Y
  const botPivotY = CY - R1 - hY; // outer ring's bottom pivot, in handle-local Y

  // rear post + arm arching over to the top pivot — a gallows/C-stand, the
  // classic look of a gyroscope demonstration mount
  const arm = tubeAlong(
    [
      [0, 0, -0.34],
      [0, topPivotY + 0.16, -0.34],
      [0, topPivotY + 0.02, -0.08],
      [0, topPivotY, 0.16],
    ],
    0.05,
    yokeMat,
  );
  handle.add(arm);
  // front post straight up to the bottom pivot
  const frontPost = rod(0.05, botPivotY, yokeMat);
  frontPost.position.set(0, 0, 0.16);
  handle.add(frontPost);

  // yaw motor pods — fixed to the handle (their stator is bolted to the
  // frame; the ring's shaft rotates inside them)
  const yawPodTop = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.13, 20), motorMat);
  yawPodTop.position.set(0, topPivotY, 0.16);
  handle.add(yawPodTop);
  const yawPodBot = yawPodTop.clone();
  yawPodBot.position.set(0, botPivotY, 0.16);
  handle.add(yawPodBot);
  const yawGlowTop = new THREE.Mesh(new THREE.TorusGeometry(0.076, 0.008, 8, 24), podGlow);
  yawGlowTop.rotation.x = Math.PI / 2;
  yawGlowTop.position.copy(yawPodTop.position);
  handle.add(yawGlowTop);
  const yawGlowBot = yawGlowTop.clone();
  yawGlowBot.position.copy(yawPodBot.position);
  handle.add(yawGlowBot);

  // --- outer ring (yaw) ----------------------------------------------------
  const outerRing = new THREE.Group();
  outerRing.position.set(0, CY - hY, 0.16);
  handle.add(outerRing);
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(R1, T1, 16, 64), ring1Mat);
  outerRing.add(ring1);
  // the outer/yaw rotation axis — a fixed line through the gimbal center,
  // invisible except during the gimbal-lock step
  const outerAxisRod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.7, 8), axisMat);
  outerRing.add(outerAxisRod);

  // pitch motor pods — bolted to the outer ring, at the points where the
  // middle ring's shaft passes through it
  const pitchPodA = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.12, 18), motorMat);
  pitchPodA.rotation.z = Math.PI / 2;
  pitchPodA.position.set(R1, 0, 0);
  outerRing.add(pitchPodA);
  const pitchPodB = pitchPodA.clone();
  pitchPodB.position.set(-R1, 0, 0);
  outerRing.add(pitchPodB);
  const pitchGlowA = new THREE.Mesh(new THREE.TorusGeometry(0.066, 0.008, 8, 24), podGlow);
  pitchGlowA.rotation.y = Math.PI / 2;
  pitchGlowA.position.copy(pitchPodA.position);
  outerRing.add(pitchGlowA);
  const pitchGlowB = pitchGlowA.clone();
  pitchGlowB.position.copy(pitchPodB.position);
  outerRing.add(pitchGlowB);

  // --- middle ring (pitch) --------------------------------------------------
  const middleRing = new THREE.Group();
  outerRing.add(middleRing);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(R2, T2, 16, 56), ring2Mat);
  middleRing.add(ring2);
  // roll motor: a pancake housing sitting just behind the payload, bolted
  // into the pitch cage — real 3-axis brushless gimbals put the roll motor
  // exactly here, directly behind the camera plate
  const rollPod = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.09, 24), motorMat);
  rollPod.rotation.x = Math.PI / 2;
  rollPod.position.set(0, 0, -0.22);
  middleRing.add(rollPod);
  const rollGlow = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.008, 8, 28), podGlow);
  rollGlow.position.set(0, 0, -0.175);
  middleRing.add(rollGlow);
  // the inner/roll rotation axis — a fixed line through the gimbal center
  // in the MIDDLE ring's frame, so as the middle ring pitches, this line
  // sweeps with it. At pitch=90deg it swings onto the same line as
  // outerAxisRod above — the literal collapse gimbal lock names.
  const innerAxisRod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 1.3, 8).rotateX(Math.PI / 2),
    axisMat,
  );
  middleRing.add(innerAxisRod);

  // --- inner ring (roll) -----------------------------------------------------
  const innerRing = new THREE.Group();
  middleRing.add(innerRing);
  const ring3 = new THREE.Mesh(new THREE.TorusGeometry(R3, T3, 14, 48), ring3Mat);
  innerRing.add(ring3);
  // asymmetric marker lugs so the bare ring visibly rolls, not just the
  // payload — a plain torus is radially symmetric about its own hole axis
  for (const s of [1, -1]) {
    const lug = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), lugMat);
    lug.position.set(s * R3, 0, 0);
    innerRing.add(lug);
  }

  // --- payload: the stabilized core ------------------------------------------
  const payload = new THREE.Group();
  innerRing.add(payload);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.16, 8, 20), payloadMat);
  body.rotation.x = Math.PI / 2; // capsule axis along local Z (the lens direction)
  payload.add(body);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.12, 24), lensMat);
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, 0, 0.24);
  payload.add(lens);
  const lensRim = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.014, 10, 24), motorMat);
  lensRim.position.set(0, 0, 0.19);
  payload.add(lensRim);
  const imuMesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.014, 0.05), imuMat);
  imuMesh.position.set(0, 0.165, -0.02);
  payload.add(imuMesh);
  // counterweight: hangs below the payload so its centre of mass sits
  // under the common pivot — the whole passive story in one small part
  const weightRod = rod(0.014, 0.16, weightMat);
  weightRod.rotation.x = Math.PI;
  weightRod.position.set(0, -0.16, 0);
  payload.add(weightRod);
  const weightBob = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), weightMat);
  weightBob.scale.set(1, 1.3, 1);
  weightBob.position.set(0, -0.33, 0);
  payload.add(weightBob);

  // --- callouts ---------------------------------------------------------------
  const labels = calloutSets(['anatomy']);
  // dir/len for the two centre-anchored labels (Stabilized payload, IMU
  // sensor) are pushed unusually far because their anchor projects near
  // screen centre in both the front (hero/overview) and rear (active step)
  // cameras — a short leader there lands the pill on top of the hero H1/
  // paragraph (unboxed, wider than the per-step panel) or crosses a
  // neighbouring label in the crowded rear view.
  labels.add('anatomy', handle, 'Handle & yaw motor', [0, topPivotY - 0.35, 0.16], 55, 88);
  labels.add('anatomy', outerRing, 'Pan/yaw ring', [R1, 0.05, 0], 40, 58);
  labels.add('anatomy', middleRing, 'Tilt/pitch ring', [0, R2, 0], 70, 56);
  labels.add('anatomy', innerRing, 'Roll ring & motor', [0, -R3, -0.12], -70, 58);
  labels.add('anatomy', payload, 'Stabilized payload', [0, 0, 0.24], 5, 172);
  labels.add('anatomy', payload, 'Counterweight', [0, -0.33, 0], -50, 56);
  labels.add('anatomy', payload, 'IMU sensor', [0, 0.165, -0.02], 6, 150);

  // --- pose -------------------------------------------------------------------
  const state = {
    t: 0, // loop phase 0..1 — every periodic term below is a whole cycle per lap
    shakeAmp: 0.12, // handle tremor amplitude, radians
    axisMode: 'all', // 'all' | 'yaw' | 'pitch' | 'roll' | 'cycle' | 'lock'
    lag: 0, // phase-delay fraction fed to the correction (0 = instant/active)
    motors: 0, // 0..1 motor-pod glow
    imu: 0, // 0..1 IMU-chip pulse
  };

  const _qy = new THREE.Quaternion();
  const _qx = new THREE.Quaternion();
  const _qz = new THREE.Quaternion();
  const _qh = new THREE.Quaternion();
  const _qc = new THREE.Quaternion();
  const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

  // Deterministic "hand tremor" disturbance at lap-phase u: every term is
  // sin(u*TAU*integer + phase), so u=0 and u=1 give identical values and
  // derivatives — the seamless-loop contract, satisfied by construction.
  function shakeAngles(u, amp, mode) {
    const sy = Math.sin(u * TAU * 3) * 0.6 + Math.sin(u * TAU * 5 + 1.3) * 0.4;
    const sx = Math.sin(u * TAU * 4 + 0.7) * 0.5 + Math.sin(u * TAU * 2) * 0.5;
    const sz = Math.sin(u * TAU * 3.5 + 2.1);
    if (mode === 'yaw') return { y: amp * sy, x: 0, z: 0 };
    if (mode === 'pitch') return { y: 0, x: amp * sx, z: 0 };
    if (mode === 'roll') return { y: 0, x: 0, z: amp * sz };
    if (mode === 'cycle') {
      // one axis at a time, a third of the lap each — smoothly zero at both
      // ends of its own segment, so the hand-off is seamless
      const k = Math.min(2, Math.floor(u * 3));
      const v = u * 3 - k;
      const s = amp * Math.sin(v * TAU);
      return { y: k === 0 ? s : 0, x: k === 1 ? s : 0, z: k === 2 ? s : 0 };
    }
    return { y: amp * 0.6 * sy, x: amp * 0.6 * sx, z: amp * 0.6 * sz }; // 'all'
  }

  function quatFrom(a) {
    _qy.setFromAxisAngle(AX_Y, a.y);
    _qx.setFromAxisAngle(AX_X, a.x);
    _qz.setFromAxisAngle(AX_Z, a.z);
    return _qy.multiply(_qx).multiply(_qz); // Qy * Qx * Qz
  }

  // Gimbal-lock demo: bypasses the disturbance/cancellation pipeline
  // entirely, since the point is a geometric collapse, not a correction
  // failure (a quaternion controller never actually breaks — that's why
  // real IMU gimbals use one). Three phases across one lap:
  //   A [0,.35]  tilt the pitch ring 0 -> 90deg, ambient tremor still fully
  //              corrected (nothing wrong yet — this is a normal "point
  //              straight up" move)
  //   B [.35,.75] HELD at 90deg: spin the outer ring, then the inner ring,
  //              by the identical arc — same payload sweep either way
  //   C [.75,1]  tilt back to 0, resume normal correction; the lap closes
  //              on an identical, unlocked pose
  function applyLock(u) {
    handle.quaternion.identity();
    let axisGlow = 0;
    if (u < 0.35) {
      const pitch = smooth(u / 0.35) * (Math.PI / 2);
      outerRing.rotation.set(0, 0, 0);
      middleRing.rotation.set(pitch, 0, 0);
      innerRing.rotation.set(0, 0, 0);
      axisGlow = smooth(u / 0.35);
    } else if (u < 0.75) {
      const v = (u - 0.35) / 0.4;
      middleRing.rotation.set(Math.PI / 2, 0, 0);
      const wiggle = 0.1 * Math.sin(((v * 2) % 1) * TAU);
      if (v < 0.5) {
        outerRing.rotation.set(0, wiggle, 0);
        innerRing.rotation.set(0, 0, 0);
      } else {
        // Qx(90deg)*Qz(phi) === Qy(-phi)*Qx(90deg): rolling the inner ring
        // by -wiggle here reproduces EXACTLY the payload motion the outer
        // ring produced above with +wiggle — the two knobs do the same job.
        outerRing.rotation.set(0, 0, 0);
        innerRing.rotation.set(0, 0, -wiggle);
      }
      axisGlow = 1;
    } else {
      const v = smooth((u - 0.75) / 0.25);
      const pitch = (1 - v) * (Math.PI / 2);
      outerRing.rotation.set(0, 0, 0);
      middleRing.rotation.set(pitch, 0, 0);
      innerRing.rotation.set(0, 0, 0);
      axisGlow = 1 - v;
    }
    return axisGlow;
  }

  function apply() {
    const { t, shakeAmp, axisMode, lag, motors, imu } = state;
    let axisGlow = 0;
    if (axisMode === 'lock') {
      axisGlow = applyLock(t);
    } else {
      const cur = shakeAngles(t, shakeAmp, axisMode);
      handle.quaternion.copy(quatFrom(cur));

      const du = ((t - lag) % 1 + 1) % 1;
      const del = shakeAngles(du, shakeAmp, axisMode);
      _qc.copy(quatFrom(del)).invert();
      _euler.setFromQuaternion(_qc, 'YXZ');
      outerRing.rotation.set(0, _euler.y, 0);
      middleRing.rotation.set(_euler.x, 0, 0);
      innerRing.rotation.set(0, 0, _euler.z);
    }

    const pulse = 0.65 + 0.35 * Math.sin(t * TAU * 6);
    podGlow.emissiveIntensity = motors * pulse * 1.6;
    imuMat.emissiveIntensity = imu * (0.7 + 0.5 * Math.sin(t * TAU * 9)) * 1.6;
    axisMat.opacity = axisGlow;
    axisMat.emissiveIntensity = axisGlow * 1.4;
  }
  apply();

  return {
    group,
    state,
    set(partial) {
      Object.assign(state, partial);
      apply();
    },
    setLabels: labels.setLabels,
    parts: { handle, outerRing, middleRing, innerRing, payload },
  };
}
