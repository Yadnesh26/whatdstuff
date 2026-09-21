import * as THREE from 'three';
import { materials, rod, disc, studioPlinth } from '../../framework/parts.js';
import { beveledBox, lathe, tubeAlong, gear, boltCircle } from '../../framework/geometry.js';
import { TAU, clamp01 } from '../../framework/motion.js';
import { calloutSets } from '../../framework/callouts.js';

// A domestic lockstitch sewing machine — cream cast-alloy body, drop-in bobbin
// under a horizontal rotary hook — product-shot staged on a charcoal plinth,
// modelled at teardown resolution around the needle and the hook because that
// is where the whole explainer lives.
//
// REFERENCE FACTS (Firgelli "Sewing machine rotary hook mechanism", Firgelli
// "Sewing-machine shuttle mechanism", Wikipedia "Rotary hook", Sewing Machine
// Man "How a sewing machine makes a stitch"):
//  - LOCKSTITCH (ISO 301) is two threads knotted together INSIDE the cloth.
//    The bobbin thread never passes through the fabric at all — it lies under
//    it and gets lassoed. That is the fact the whole explainer is built on.
//  - The needle's eye is at the POINT, not the blunt end (Howe, 1846). Without
//    that, none of this works.
//  - The needle descends, reaches bottom dead centre, then RISES 2.2 mm.
//    Friction in the cloth holds the thread back on the scarf side and a loop
//    bulges out behind the needle. That loop lasts a few thousandths of a
//    second and is the only thing the hook can grab.
//  - The hook point crosses the needle's scarf at 0.05-0.1 mm clearance and
//    snags the loop, then carries it right around the OUTSIDE of the bobbin
//    case. The case does not rotate: a position finger holds it still, with a
//    0.5-0.8 mm gap the thread slides through.
//  - The hook turns at exactly 2:1 to the arm shaft — two hook revolutions per
//    needle stroke, geared, not optional.
//  - The take-up lever then hauls the slack back up, casts the loop off the
//    hook and pulls the knot into the middle of the cloth. Top tension discs
//    and the bobbin-case spring decide where in the sandwich it lands.
//  - Feed dogs orbit an ellipse: up through the throat plate, back by one
//    stitch length, down, forward underneath — and only while the needle is
//    out of the cloth.
//  - Domestic machines run ~800-1,100 stitches a minute; industrial lockstitch
//    heads reach 5,000-5,500, one complete stitch in under 11 ms.
//
// ---------------------------------------------------------------------------
// PROPORTIONS — ONE scale, 1 unit = 0.145 m, ratios read off a 410 x 300 x 175
// mm domestic machine:  W 2.84 : H 2.07 : D 1.22  (H/W 0.73, D/W 0.43 against
// a real 0.73 and 0.43). Throat space needle-to-column 1.21 = 175 mm. Needle
// bar stroke 0.228 = 33 mm. Hook point circle 0.180 dia = 26 mm. Bobbin 0.124
// dia x 0.081 = 18 x 12 mm. At bottom dead centre the needle tip sits 13 mm
// below the plate, which is what buys the hook its room.
//
// TRUE ORIENTATION, not mirrored: head and needle at -X, column and handwheel
// at +X, the operator at +Z, and the cloth feeding AWAY from them (-Z). Wide
// shots quarter in from the front with the target pushed left so the machine's
// mass sits clear of the text panel; the macro steps compose freely because
// only the needle and the hook are in frame.
//
// DISCLOSED EXAGGERATIONS (everything else is to scale):
//  - thread drawn 0.9 mm dia against a real 0.3 mm, needle blade 2.0 mm
//    against a real 0.8 mm. At true diameter both are sub-pixel.
//  - hook-to-needle clearance drawn at ~0.6 mm rather than 0.05-0.1 mm, which
//    is a fifth of a pixel at any framing that still shows the machine.
//  - stitch length set to 4.5 mm, a real domestic maximum rather than a cheat —
//    the copy says so, and it is what makes the feed visible.
// ---------------------------------------------------------------------------

const BASE = 0.26; // plinth top — every Y below already includes it

// --- body shell -------------------------------------------------------------
const BED_X0 = -1.42;
const BED_X1 = 1.42;
const BED_Z0 = -0.61;
const BED_Z1 = 0.61;
const BED_TOP = BASE + 0.41;
const COL_X0 = 0.38;
const COL_X1 = 1.24;
const COL_Z0 = -0.44;
const COL_Z1 = 0.44;
const TOP_Y = BASE + 2.07;
const ARM_Y0 = BASE + 1.32;
const ARM_Y1 = BASE + 1.98;
const ARM_Z0 = -0.36;
const ARM_Z1 = 0.26;
const HEAD_X0 = -1.1;
const HEAD_X1 = -0.56;
const HEAD_Y0 = BASE + 0.8; // head underside — the working clearance
const HEAD_Z0 = -0.4;
const HEAD_Z1 = 0.3;

// --- needle / stitch geometry ------------------------------------------------
const NX = -0.83; // needle axis
const ARM_Y = BASE + 1.64; // arm shaft centreline
const ARM_Z = -0.02;
const STROKE = 0.228; // 33 mm needle bar stroke
const CRANK_R = STROKE / 2;
const ROD_L = 0.42;
const BAR_DROP = 0.5455; // crank-pin joint down to the needle clamp
const NEEDLE_L = 0.198; // clamp to point, 29 mm
const NEEDLE_R = 0.0068;
const EYE_UP = 0.012; // eye centre above the point
const THREAD_R = 0.0042;

const FAB_T = 0.017; // two layers of canvas, 2.5 mm
const FAB_TOP = BED_TOP + FAB_T;
const FAB_MID = BED_TOP + FAB_T * 0.5;
const FAB_X0 = NX - 0.36;
// Edgestitched 1.7 mm from the cut edge. That is a real seam, and it is what
// keeps the right-hand feed row, the needle hole and the whole hook uncovered —
// with a wide seam allowance the cloth lies over every part this explains.
const FAB_X1 = NX + 0.012;
const STITCH = 0.031; // 4.5 mm, the machine's longest stitch
const STITCHES = 18;

// --- rotary hook -------------------------------------------------------------
// Point plane 0.351 puts the beak 2.2 mm of needle rise above bottom dead
// centre, and leaves 5 mm of headroom under the plate for the feed dogs to
// pass over the top of it — the one place in the machine where two moving
// parts share the same few millimetres.
const HOOK_CX = NX + 0.101;
const HOOK_R = 0.09; // point circle
const HOOK_PY = BASE + 0.351;
const CASE_R = 0.062;
const RACE_R = 0.072; // hook basket wall — the gap the loop slides through
const CASE_TOP = BASE + 0.354;
const CASE_BOT = BASE + 0.273;
const CATCH = 203; // shaft degrees: hook point meets the needle scarf
const CAST = 300; // shaft degrees: loop slides off the hook
// The hook turns so the point sweeps the loop round the FRONT of the bobbin
// case (angles falling away from 180). A real rotary hook runs either way, but
// turned the other way every frame of the loop's trip happened behind the case,
// hidden from any camera that could also see the needle. The needle's scarf is
// on the back face, which is the side the point arrives from — consistent.
const HOOK_PHASE = 226; // hookAngle = HOOK_PHASE - 2*shaft, = 180 at CATCH

// --- take-up four-bar (planar, in the z/y plane at x = TU_X) ------------------
// Crank on the arm shaft -> coupler -> rocker. A crank-rocker's extremes fall
// where crank and coupler go collinear, so TOP lands at 60 deg of shaft
// rotation and BOTTOM at 240: slack all through the hook's trip around the
// bobbin, then the big pull from 300 to 60 — which is exactly when the loop is
// cast off and the stitch has to be set, three degrees before the needle
// re-enters the cloth.
const TU_X = -0.7;
const TU_CR = 0.06;
const TU_PZ = -0.05;
const TU_PY = BASE + 1.8;
const TU_RR = 0.13; // rocker arm out to the coupler joint
const TU_LC = 0.2; // coupler
const TU_LT = 0.32; // pivot to the thread eye
const TU_DELTA = -10.98; // degrees between the coupler arm and the tip arm
const TU_PHASE = 40.62; // puts the lever at the top of its swing at 60 deg

// --- feed --------------------------------------------------------------------
// The dogs ride an ellipse and clear the plate only while sin(psi) < -0.5, i.e.
// psi 210-330 deg = shaft 300-60 deg. The needle tip is out of the cloth from
// 297 to 63 deg, so the feed fits inside that window with three degrees to
// spare at each end — which is how real lockstitch timing is actually set.
const FEED_AMP = STITCH * 0.577; // horizontal half-travel: grips exactly one stitch
const FEED_LIFT = 0.016;
const FEED_TOOTH_H = 0.011;
const FEED_TOOTH_TOP = BED_TOP - FEED_LIFT * 0.5; // flush at half lift
const FEED_ROW_DX = 0.032;
const FEED_LEN = 0.166;

// --- drive -------------------------------------------------------------------
const LOW_Y = BASE + 0.2;
const BELT_X = 0.62;
const MOTOR_X = 1.16;

const ACCENT = 0xff8a5c; // needle thread
const BOBBIN_COL = 0x57c9e8; // bobbin thread
const CREAM = 0xded8cc;

const D2R = Math.PI / 180;
const UP = new THREE.Vector3(0, 1, 0);

// Position a rod (origin at its base, running +Y) so it spans a -> b.
function aimRod(mesh, ax, ay, az, bx, by, bz) {
  const d = new THREE.Vector3(bx - ax, by - ay, bz - az);
  const len = d.length();
  mesh.position.set(ax, ay, az);
  mesh.scale.y = len / mesh.userData.baseLen;
  mesh.quaternion.setFromUnitVectors(UP, d.normalize());
}

// A tube whose centreline is rewritten every frame. Thread changes shape far
// too drastically for morph targets (formed -> caught -> stretched round the
// bobbin -> cast off), so the vertices are recomputed in place from a fixed
// segment count: no geometry churn, no per-frame allocation in the writer.
function dynTube(segments, radius, material, radial = 6) {
  const rings = segments + 1;
  const cols = radial + 1;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(rings * cols * 3);
  const nor = new Float32Array(rings * cols * 3);
  const uv = new Float32Array(rings * cols * 2);
  const idx = [];
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * cols + j;
      const b = a + cols;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < cols; j++) {
      uv[(i * cols + j) * 2] = i / segments;
      uv[(i * cols + j) * 2 + 1] = j / radial;
    }
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.castShadow = true;

  const T = new THREE.Vector3();
  const N = new THREE.Vector3();
  const B = new THREE.Vector3();
  const prevN = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const cosT = [];
  const sinT = [];
  for (let j = 0; j <= radial; j++) {
    cosT.push(Math.cos((j / radial) * TAU));
    sinT.push(Math.sin((j / radial) * TAU));
  }

  function set(pts) {
    for (let i = 0; i < rings; i++) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(rings - 1, i + 1)];
      T.set(b.x - a.x, b.y - a.y, b.z - a.z);
      if (T.lengthSq() < 1e-12) T.set(0, 1, 0);
      T.normalize();
      if (i === 0) {
        tmp.set(0, 1, 0);
        if (Math.abs(T.y) > 0.9) tmp.set(1, 0, 0);
        N.crossVectors(T, tmp).normalize();
      } else {
        // parallel transport: keep the previous normal, project off the tangent
        N.copy(prevN).addScaledVector(T, -prevN.dot(T));
        if (N.lengthSq() < 1e-10) {
          tmp.set(0, 1, 0);
          if (Math.abs(T.y) > 0.9) tmp.set(1, 0, 0);
          N.crossVectors(T, tmp);
        }
        N.normalize();
      }
      prevN.copy(N);
      B.crossVectors(T, N);
      const p = pts[i];
      for (let j = 0; j <= radial; j++) {
        const k = (i * cols + j) * 3;
        const nx = N.x * cosT[j] + B.x * sinT[j];
        const ny = N.y * cosT[j] + B.y * sinT[j];
        const nz = N.z * cosT[j] + B.z * sinT[j];
        pos[k] = p.x + nx * radius;
        pos[k + 1] = p.y + ny * radius;
        pos[k + 2] = p.z + nz * radius;
        nor[k] = nx;
        nor[k + 1] = ny;
        nor[k + 2] = nz;
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.normal.needsUpdate = true;
    geo.computeBoundingSphere();
  }

  return { mesh, set };
}

// Resample a waypoint list to exactly `n` points along a smooth spline.
const RS_CURVE = new THREE.CatmullRomCurve3(
  [new THREE.Vector3(), new THREE.Vector3()],
  false,
  'centripetal',
);
function resample(waypoints, n, out) {
  RS_CURVE.points = waypoints;
  for (let i = 0; i < n; i++) RS_CURVE.getPoint(i / (n - 1), out[i]);
  return out;
}

// Plain weave as a normal map. Without it the cloth is a featureless plane that
// reads as sheet metal at every macro framing — and the cloth is in every frame
// of this explainer.
let weaveTex = null;
function weaveNormalMap() {
  if (weaveTex) return weaveTex;
  const N = 256;
  const P = 8; // pixels per yarn
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(N, N);
  const h = (x, y) => {
    const gx = ((x % N) + N) % N;
    const gy = ((y % N) + N) % N;
    const over = (Math.floor(gx / P) + Math.floor(gy / P)) % 2 === 0;
    const u = ((gx % P) / P) * Math.PI;
    const v = ((gy % P) / P) * Math.PI;
    return over ? Math.sin(u) * 0.9 + 0.1 : Math.sin(v) * 0.9 + 0.1;
  };
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const nx = (h(x - 1, y) - h(x + 1, y)) * 2.2;
      const ny = (h(x, y - 1) - h(x, y + 1)) * 2.2;
      const len = Math.hypot(nx, ny, 1);
      const i = (y * N + x) * 4;
      img.data[i] = ((nx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / len) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  weaveTex = new THREE.CanvasTexture(cv);
  weaveTex.wrapS = weaveTex.wrapT = THREE.RepeatWrapping;
  weaveTex.repeat.set(5, 20);
  return weaveTex;
}

// Bevel gear as a toothed cone. A crossed-axis pair is the only honest way to
// get the 2:1 turn from the horizontal lower shaft up to the vertical hook.
function bevelGear(pitchR, teeth, material) {
  const g = new THREE.Group();
  g.add(
    lathe(
      [
        [pitchR * 0.24, -0.012],
        [pitchR * 1.0, 0.03],
        [pitchR * 1.0, 0.05],
        [pitchR * 0.3, 0.008],
        [pitchR * 0.24, -0.012],
      ],
      material,
      36,
    ),
  );
  const toothGeo = new THREE.BoxGeometry(pitchR * 0.5, 0.016, pitchR * 0.1);
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * TAU;
    const t = new THREE.Mesh(toothGeo, material);
    t.position.set(Math.cos(a) * pitchR * 0.78, 0.034, Math.sin(a) * pitchR * 0.78);
    t.rotation.y = -a;
    t.rotation.z = -0.42;
    t.castShadow = true;
    g.add(t);
  }
  return g;
}

export function buildSewingMachine({ scene }) {
  const group = new THREE.Group();
  scene.add(group);
  group.add(studioPlinth({ w: 4.1, h: BASE, d: 2.05 }));

  const labels = calloutSets(['exterior', 'thread', 'takeup', 'needle', 'hook', 'feed', 'drive']);

  // ==========================================================================
  // MATERIALS
  // ==========================================================================
  // ONE cream instance for every shell panel that ghosts on reveal, so a single
  // opacity change opens the whole machine. Clearcoat MUST go to 0 as it fades:
  // coat specular is opacity-independent and a white body reads solid at 0.1
  // opacity with the coat still on.
  // paintedMetal ships clearcoat 1, which on a near-white body under the
  // overhead softbox was the single blown-white patch in a material bisect of
  // the macro steps. Softened the same way studioPlinth's is.
  const softCoat = (m) => {
    m.clearcoat = 0.4;
    m.clearcoatRoughness = 0.3;
    m.roughness = 0.5;
    return m;
  };
  const shell = softCoat(materials.paintedMetal(CREAM));
  const shellCoat = shell.clearcoat;
  const shellFixed = softCoat(materials.paintedMetal(CREAM)); // bed — never ghosts
  const trimDark = materials.polymer(0x2a2d33);
  // Roughness raised well above the presets: roughnessMap MULTIPLIES the base
  // (map texels ~0.5), so the stock numbers read as near-mirror on the plate and
  // the foot and blew a 2,000-pixel white patch through the macro steps.
  const chromePlate = materials.chrome(0xd6dbe1);
  chromePlate.roughness = 0.44;
  // Metalness pulled well below 1 for everything that works inside the bed.
  // A full metal has no diffuse term: down in the well there is almost nothing
  // for it to reflect, so the hook, the beak and the bobbin case all rendered
  // as black cutouts no matter how the step was lit or framed.
  const steelBright = materials.brushedSteel(0xcdd3da);
  steelBright.roughness = 0.5;
  steelBright.metalness = 0.6;
  const steelDark = materials.aluminum(0x949ba4);
  steelDark.roughness = 0.64;
  steelDark.metalness = 0.5;
  // map-free: extruded gear geometry has ad-hoc UVs and samples map texels wrong
  const steelPlain = materials.steel(0xb4bcc6);
  const liner = new THREE.MeshStandardMaterial({
    color: 0xa8a296,
    roughness: 0.96,
    metalness: 0,
    side: THREE.BackSide,
  });
  const threadTopMat = new THREE.MeshPhysicalMaterial({
    color: ACCENT,
    emissive: new THREE.Color(ACCENT),
    emissiveIntensity: 0.16,
    roughness: 0.72,
    metalness: 0,
    sheen: 0.7,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color(0xffd7c4),
  });
  const threadBotMat = new THREE.MeshPhysicalMaterial({
    color: BOBBIN_COL,
    emissive: new THREE.Color(BOBBIN_COL),
    emissiveIntensity: 0.16,
    roughness: 0.72,
    metalness: 0,
    sheen: 0.7,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color(0xd2f2ff),
  });
  const clothMat = new THREE.MeshPhysicalMaterial({
    color: 0x6f747c,
    roughness: 0.97,
    metalness: 0,
    sheen: 0.5,
    sheenRoughness: 0.9,
    sheenColor: new THREE.Color(0x9aa0a8),
    normalMap: weaveNormalMap(),
    normalScale: new THREE.Vector2(0.7, 0.7),
  });
  // Plain transparent, NOT transmission: the wound thread lives inside the
  // bobbin and a transmission pass would not sample it at all.
  const bobbinShell = new THREE.MeshPhysicalMaterial({
    color: 0xdfe6ef,
    roughness: 0.22,
    metalness: 0,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
  });

  // ==========================================================================
  // BODY — bed, column, arm, head
  // ==========================================================================
  const bedW = BED_X1 - BED_X0;
  const bedD = BED_Z1 - BED_Z0;
  const bedCX = (BED_X0 + BED_X1) / 2;
  const bedCZ = (BED_Z0 + BED_Z1) / 2;

  // The bed is a SHELL, not a block. The well under the needle plate is where
  // the hook, the feed bar and the lower shaft actually live, and `open` lifting
  // the plate is the only way to look into it — built solid the first time, the
  // whole hook was buried inside the casting and four callouts pointed at blank
  // white deck.
  const WALL_Y0 = BASE + 0.14;
  const bedFloor = beveledBox(bedW, 0.14, bedD, shellFixed, 0.03);
  bedFloor.position.set(bedCX, BASE + 0.07, bedCZ);
  bedFloor.receiveShadow = true;
  group.add(bedFloor);
  const wallH = BED_TOP - WALL_Y0;
  const wallY = (WALL_Y0 + BED_TOP) / 2;
  // back + both ends stay opaque; the FRONT wall and the deck ride the
  // ghostable shell so the drive step can see the lower shaft through them
  for (const [w, d, x, z, mat] of [
    [0.26, bedD, BED_X0 + 0.13, bedCZ, shellFixed],
    [0.26, bedD, BED_X1 - 0.13, bedCZ, shellFixed],
    [bedW - 0.52, 0.11, bedCX, BED_Z0 + 0.055, shellFixed],
  ]) {
    const b = beveledBox(w, wallH, d, mat, 0.025);
    b.position.set(x, wallY, z);
    b.receiveShadow = true;
    group.add(b);
  }
  // The front wall goes with the needle plate on `open`. Shooting the hook from
  // inside the closed bed put the feed rails and the plate edge across the lens
  // and left the whole subject in the casting's shadow; opened from the front,
  // the hook stands in lit space against the bright far wall.
  const bedFront = beveledBox(bedW - 0.52, wallH, 0.11, shellFixed, 0.025);
  bedFront.position.set(bedCX, wallY, BED_Z1 - 0.055);
  bedFront.receiveShadow = true;
  group.add(bedFront);
  // dark rough liner inside the well — a bare concave cream interior reads as a
  // glowing box under the overhead softbox
  const bedIn = new THREE.Mesh(
    new THREE.BoxGeometry(bedW - 0.5, wallH + 0.02, bedD - 0.2),
    liner,
  );
  bedIn.position.set(bedCX, wallY + 0.02, bedCZ);
  group.add(bedIn);

  const deck = beveledBox(BED_X1 + 0.42, 0.022, bedD, shellFixed, 0.008);
  deck.position.set((-0.42 + BED_X1) / 2, BED_TOP - 0.011, bedCZ);
  deck.receiveShadow = true;
  group.add(deck);
  for (const [w, d, x, z] of [
    [0.26, bedD, BED_X0 + 0.13, bedCZ],
    [0.74, 0.21, -0.79, BED_Z0 + 0.105],
  ]) {
    const b = beveledBox(w, 0.022, d, shellFixed, 0.008);
    b.position.set(x, BED_TOP - 0.011, z);
    b.receiveShadow = true;
    group.add(b);
  }
  // the deck lip in FRONT of the needle plate goes with it on `open` — left in
  // place it sits exactly on the eye-level sightline to the needle
  const deckLip = beveledBox(0.74, 0.022, 0.21, shellFixed, 0.008);
  deckLip.position.set(-0.79, BED_TOP - 0.011, BED_Z1 - 0.105);
  deckLip.receiveShadow = true;
  group.add(deckLip);

  // --- throat plate: chrome, needle hole + two feed-dog slots ---------------
  const plateShape = new THREE.Shape();
  plateShape.moveTo(-1.16, -0.4);
  plateShape.lineTo(-0.42, -0.4);
  plateShape.lineTo(-0.42, 0.4);
  plateShape.lineTo(-1.16, 0.4);
  plateShape.closePath();
  const needleHole = new THREE.Path();
  needleHole.absarc(NX, 0, 0.018, 0, TAU, true);
  plateShape.holes.push(needleHole);
  for (const sx of [-FEED_ROW_DX, FEED_ROW_DX]) {
    const slot = new THREE.Path();
    const sw = 0.019;
    const sl = FEED_LEN * 0.5 + FEED_AMP + 0.012;
    slot.moveTo(NX + sx - sw / 2, sl);
    slot.lineTo(NX + sx + sw / 2, sl);
    slot.lineTo(NX + sx + sw / 2, -sl);
    slot.lineTo(NX + sx - sw / 2, -sl);
    slot.closePath();
    plateShape.holes.push(slot);
  }
  const throatPlate = new THREE.Mesh(
    new THREE.ExtrudeGeometry(plateShape, {
      depth: 0.02,
      bevelEnabled: true,
      bevelThickness: 0.003,
      bevelSize: 0.003,
      bevelSegments: 1,
      curveSegments: 14,
    }).rotateX(Math.PI / 2),
    chromePlate,
  );
  throatPlate.position.y = BED_TOP;
  throatPlate.receiveShadow = true;
  group.add(throatPlate);
  const guideLineMat = materials.darkMetal(0x4a5057);
  for (let i = 1; i <= 4; i++) {
    const gl = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.003, 0.1), guideLineMat);
    gl.position.set(NX + 0.08 + i * 0.04, 0.0035, 0.29);
    throatPlate.add(gl); // rides the plate, so `open` takes it away too
  }

  // --- column, arm, head ----------------------------------------------------
  const dress = new THREE.Group();
  group.add(dress);
  const column = beveledBox(COL_X1 - COL_X0, TOP_Y - BED_TOP, COL_Z1 - COL_Z0, shell, 0.05);
  column.position.set((COL_X0 + COL_X1) / 2, (BED_TOP + TOP_Y) / 2, (COL_Z0 + COL_Z1) / 2);
  dress.add(column);
  const arm = beveledBox(COL_X0 + 0.8, ARM_Y1 - ARM_Y0, ARM_Z1 - ARM_Z0, shell, 0.06);
  arm.position.set((COL_X0 - 0.8) / 2, (ARM_Y0 + ARM_Y1) / 2, (ARM_Z0 + ARM_Z1) / 2);
  dress.add(arm);
  const head = beveledBox(HEAD_X1 - HEAD_X0, ARM_Y1 - HEAD_Y0, HEAD_Z1 - HEAD_Z0, shell, 0.045);
  head.position.set((HEAD_X0 + HEAD_X1) / 2, (HEAD_Y0 + ARM_Y1) / 2, (HEAD_Z0 + HEAD_Z1) / 2);
  dress.add(head);
  const topDeck = beveledBox(COL_X1 + 1.1, 0.05, 0.62, shell, 0.02);
  topDeck.position.set((COL_X1 - 1.1) / 2, TOP_Y - 0.025, -0.06);
  dress.add(topDeck);

  // face plate: chrome, framing the slot the take-up lever swings in. Metal
  // cannot be ghosted (it just reads as a solid mirror) so it hides outright.
  const facePlate = new THREE.Group();
  const FP_X = -0.72;
  const fpPieces = [
    [0.5, 0.07, 2.205],
    [0.5, 0.34, 1.65],
  ];
  for (const [w, h, y] of fpPieces) {
    const p = beveledBox(w, h, 0.018, chromePlate, 0.006);
    p.position.set(FP_X, y, HEAD_Z1 - 0.009);
    facePlate.add(p);
  }
  for (const sx of [-0.19, 0.19]) {
    const p = beveledBox(0.12, 0.35, 0.018, chromePlate, 0.006);
    p.position.set(FP_X + sx, 1.995, HEAD_Z1 - 0.009);
    facePlate.add(p);
  }
  // Dark recess behind the take-up slot. Without it the slot is a black void and
  // the lever — the subject of a whole step — has nothing to silhouette against.
  const tuRecess = beveledBox(0.3, 0.4, 0.02, materials.polymer(0x3c4149), 0.006);
  tuRecess.position.set(FP_X, 1.995, 0.1);
  dress.add(tuRecess);
  dress.add(facePlate);

  // --- the small parts that stop a domestic machine reading as a blank box ---
  // bobbin winder on the top deck
  const winderSpindle = rod(0.013, 0.075, steelBright);
  winderSpindle.position.set(0.74, TOP_Y - 0.01, 0.08);
  dress.add(winderSpindle);
  const winderStop = beveledBox(0.022, 0.05, 0.05, trimDark, 0.006);
  winderStop.position.set(0.83, TOP_Y + 0.02, 0.08);
  dress.add(winderStop);
  // reverse-stitch lever on the column face
  const reverseLever = beveledBox(0.05, 0.14, 0.028, trimDark, 0.008);
  reverseLever.position.set(0.5, BASE + 1.34, COL_Z1 + 0.016);
  dress.add(reverseLever);
  // thread guide down the head's front edge
  for (const gy of [BASE + 1.5, BASE + 1.06]) {
    const tg = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.005, 8, 18), steelBright);
    tg.rotation.y = Math.PI / 2;
    tg.position.set(-1.02, gy, HEAD_Z1 + 0.012);
    dress.add(tg);
  }
  // thread cutter tab under the face plate
  const cutter = beveledBox(0.012, 0.05, 0.03, steelBright, 0.004);
  cutter.position.set(HEAD_X0 + 0.02, BASE + 0.98, 0.1);
  dress.add(cutter);
  // panel seam down the column — a casting joint, not a decal
  const seamLine = beveledBox(0.012, 1.3, 0.012, trimDark, 0.004);
  seamLine.position.set(COL_X0 + 0.012, BASE + 1.3, COL_Z1 - 0.01);
  dress.add(seamLine);

  // handwheel
  const wheel = new THREE.Group();
  const wheelRim = lathe(
    [
      [0.05, 0],
      [0.225, 0.004],
      [0.24, 0.026],
      [0.24, 0.062],
      [0.205, 0.07],
      [0.205, 0.03],
      [0.05, 0.026],
      [0.05, 0],
    ],
    trimDark,
    48,
  );
  wheelRim.rotation.z = -Math.PI / 2;
  wheel.add(wheelRim);
  const wheelBand = new THREE.Mesh(new THREE.TorusGeometry(0.222, 0.016, 10, 48), steelBright);
  wheelBand.rotation.y = Math.PI / 2;
  wheelBand.position.x = 0.055;
  wheel.add(wheelBand);
  wheel.position.set(1.29, ARM_Y, ARM_Z);
  dress.add(wheel);

  // stitch-length dial
  const dial = new THREE.Group();
  const dialBody = disc(0.105, 0.045, trimDark, 36);
  dialBody.rotation.x = Math.PI / 2;
  dial.add(dialBody);
  const dialKnurl = boltCircle(12, 0.092, 0.008, steelDark, 0.05);
  dialKnurl.rotation.x = Math.PI / 2;
  dial.add(dialKnurl);
  dial.position.set(0.78, BASE + 1.06, COL_Z1 + 0.012);
  dress.add(dial);

  // tension unit on the face of the head
  const tension = new THREE.Group();
  const tenBody = lathe(
    [
      [0.012, 0],
      [0.052, 0.004],
      [0.052, 0.026],
      [0.03, 0.032],
      [0.03, 0.05],
      [0.062, 0.056],
      [0.062, 0.078],
      [0.012, 0.086],
    ],
    steelBright,
    32,
  );
  tenBody.rotation.x = -Math.PI / 2;
  tension.add(tenBody);
  const tenKnob = disc(0.07, 0.035, trimDark, 32);
  tenKnob.rotation.x = Math.PI / 2;
  tenKnob.position.z = 0.104;
  tension.add(tenKnob);
  const TEN_X = -0.98;
  const TEN_Y = BASE + 1.24;
  tension.position.set(TEN_X, TEN_Y, HEAD_Z1 - 0.01);
  dress.add(tension);

  // spool pin + spool of the coral thread
  const spoolPin = rod(0.012, 0.2, steelBright);
  spoolPin.position.set(0.34, TOP_Y - 0.02, -0.2);
  dress.add(spoolPin);
  const spool = lathe(
    [
      [0.024, 0],
      [0.085, 0],
      [0.085, 0.012],
      [0.072, 0.016],
      [0.072, 0.148],
      [0.085, 0.152],
      [0.085, 0.164],
      [0.024, 0.164],
    ],
    threadTopMat,
    36,
  );
  spool.position.set(0.34, TOP_Y - 0.01, -0.2);
  dress.add(spool);
  const guideHook = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.006, 8, 24), steelBright);
  guideHook.rotation.y = Math.PI / 2;
  guideHook.position.set(-0.34, TOP_Y + 0.03, -0.06);
  dress.add(guideHook);

  const SPOOL_TOP = new THREE.Vector3(0.34, TOP_Y + 0.16, -0.2);
  const GUIDE_PT = new THREE.Vector3(-0.34, TOP_Y + 0.03, -0.06);
  const TEN_PT = new THREE.Vector3(TEN_X, TEN_Y + 0.042, HEAD_Z1 + 0.05);

  // ==========================================================================
  // DRIVE — motor, arm shaft, timing belt, lower shaft, 2:1 bevel to the hook
  // ==========================================================================
  const drive = new THREE.Group();
  group.add(drive);

  const armShaft = rod(0.032, 2.18, steelDark, 24);
  armShaft.rotation.z = Math.PI / 2;
  armShaft.position.set(1.3, ARM_Y, ARM_Z);
  drive.add(armShaft);

  const motor = lathe(
    [
      [0, -0.13],
      [0.1, -0.13],
      [0.115, -0.1],
      [0.115, 0.1],
      [0.1, 0.13],
      [0, 0.13],
    ],
    steelDark,
    32,
  );
  motor.rotation.z = Math.PI / 2;
  motor.position.set(MOTOR_X - 0.12, BASE + 1.02, -0.24);
  drive.add(motor);
  const motorPulley = disc(0.055, 0.05, steelBright, 28);
  motorPulley.rotation.z = Math.PI / 2;
  motorPulley.position.set(MOTOR_X, BASE + 1.02, -0.24);
  drive.add(motorPulley);
  const armPulley = disc(0.166, 0.05, steelBright, 36);
  armPulley.rotation.z = Math.PI / 2;
  armPulley.position.set(MOTOR_X, ARM_Y, ARM_Z);
  drive.add(armPulley);
  const motorBeltPts = [];
  for (let i = 0; i <= 22; i++) {
    const a = (i / 22) * Math.PI - Math.PI / 2;
    motorBeltPts.push([MOTOR_X, ARM_Y + 0.168 * Math.cos(a), ARM_Z + 0.168 * Math.sin(a)]);
  }
  for (let i = 0; i <= 22; i++) {
    const a = (i / 22) * Math.PI + Math.PI / 2;
    motorBeltPts.push([MOTOR_X, BASE + 1.02 + 0.057 * Math.cos(a), -0.24 + 0.057 * Math.sin(a)]);
  }
  drive.add(
    tubeAlong(motorBeltPts, 0.012, trimDark, {
      closed: true,
      tubularSegments: 120,
      radialSegments: 8,
    }),
  );

  const lowShaft = rod(0.026, 1.62, steelDark, 20);
  lowShaft.rotation.z = Math.PI / 2;
  lowShaft.position.set(BELT_X + 0.08, LOW_Y, 0);
  drive.add(lowShaft);
  const topPulley = gear({ teeth: 22, radius: 0.092, thickness: 0.042, holeR: 0.032 }, steelPlain);
  topPulley.rotation.y = Math.PI / 2;
  topPulley.position.set(BELT_X, ARM_Y, ARM_Z);
  drive.add(topPulley);
  const botPulley = gear({ teeth: 22, radius: 0.092, thickness: 0.042, holeR: 0.028 }, steelPlain);
  botPulley.rotation.y = Math.PI / 2;
  botPulley.position.set(BELT_X, LOW_Y, 0);
  drive.add(botPulley);
  const beltPts = [];
  for (let i = 0; i <= 20; i++) {
    const a = (i / 20) * Math.PI - Math.PI / 2;
    beltPts.push([BELT_X, ARM_Y + 0.098 * Math.cos(a), ARM_Z + 0.098 * Math.sin(a)]);
  }
  for (let i = 0; i <= 20; i++) {
    const a = (i / 20) * Math.PI + Math.PI / 2;
    beltPts.push([BELT_X, LOW_Y + 0.098 * Math.cos(a), 0.098 * Math.sin(a)]);
  }
  drive.add(
    tubeAlong(beltPts, 0.011, trimDark, { closed: true, tubularSegments: 110, radialSegments: 8 }),
  );

  const lowBevel = bevelGear(0.078, 24, steelPlain);
  lowBevel.rotation.z = Math.PI / 2;
  lowBevel.position.set(HOOK_CX + 0.082, LOW_Y, 0);
  drive.add(lowBevel);
  const hookBevel = bevelGear(0.039, 12, steelPlain);
  hookBevel.position.set(HOOK_CX, LOW_Y + 0.004, 0);
  drive.add(hookBevel);

  const eccAdvance = new THREE.Group();
  const eccA = disc(0.052, 0.03, steelBright, 28);
  eccA.rotation.z = Math.PI / 2;
  eccA.position.y = 0.021;
  eccAdvance.add(eccA);
  eccAdvance.position.set(-0.42, LOW_Y, 0);
  drive.add(eccAdvance);
  const eccLift = new THREE.Group();
  const eccB = disc(0.046, 0.03, steelBright, 28);
  eccB.rotation.z = Math.PI / 2;
  eccB.position.y = 0.019;
  eccLift.add(eccB);
  eccLift.position.set(-0.28, LOW_Y, 0);
  drive.add(eccLift);
  const eccRodA = rod(0.011, 1, steelDark, 12);
  eccRodA.userData.baseLen = 1;
  drive.add(eccRodA);
  const eccRodB = rod(0.011, 1, steelDark, 12);
  eccRodB.userData.baseLen = 1;
  drive.add(eccRodB);

  // ==========================================================================
  // HEAD MECHANISM — needle bar crank-slider + take-up four-bar
  // ==========================================================================
  const mech = new THREE.Group();
  group.add(mech);

  const crankDisc = new THREE.Group();
  const crankWeb = lathe(
    [
      [0, 0],
      [0.075, 0],
      [0.075, 0.03],
      [0, 0.03],
    ],
    steelDark,
    28,
  );
  crankWeb.rotation.z = Math.PI / 2;
  crankWeb.position.x = -0.015;
  crankDisc.add(crankWeb);
  const crankPinMesh = rod(0.016, 0.07, steelBright, 14);
  crankPinMesh.rotation.z = -Math.PI / 2;
  crankPinMesh.position.set(0.015, CRANK_R, 0);
  crankDisc.add(crankPinMesh);
  crankDisc.position.set(NX, ARM_Y, ARM_Z);
  mech.add(crankDisc);

  const conRod = rod(0.016, 1, steelBright, 14);
  conRod.userData.baseLen = 1;
  mech.add(conRod);

  // needle bar group: origin AT the crank-pin joint, everything hangs below
  const needleBar = new THREE.Group();
  const barRod = rod(0.024, 0.62, steelBright, 18);
  barRod.position.y = -BAR_DROP - 0.02;
  needleBar.add(barRod);
  const clampBlock = beveledBox(0.055, 0.05, 0.048, steelDark, 0.008);
  clampBlock.position.y = -BAR_DROP - 0.02;
  needleBar.add(clampBlock);
  const clampScrew = rod(0.011, 0.05, steelBright, 10);
  clampScrew.rotation.x = -Math.PI / 2;
  clampScrew.position.set(0, -BAR_DROP - 0.02, 0.024);
  needleBar.add(clampScrew);
  const needleShank = rod(0.0092, 0.05, steelBright, 14);
  needleShank.position.y = -BAR_DROP - 0.045;
  needleBar.add(needleShank);
  const needleBlade = new THREE.Mesh(
    new THREE.CylinderGeometry(NEEDLE_R, NEEDLE_R, NEEDLE_L - 0.03, 16),
    steelBright,
  );
  needleBlade.position.y = -BAR_DROP - 0.045 - (NEEDLE_L - 0.03) / 2;
  needleBlade.castShadow = true;
  needleBar.add(needleBlade);
  const needleTipMesh = new THREE.Mesh(new THREE.ConeGeometry(NEEDLE_R, 0.03, 16), steelBright);
  needleTipMesh.position.y = -BAR_DROP - 0.045 - (NEEDLE_L - 0.03) - 0.015;
  needleBar.add(needleTipMesh);
  const TIP_OFF = -BAR_DROP - 0.045 - NEEDLE_L;
  const EYE_OFF = TIP_OFF + EYE_UP;
  const GUIDE_OFF = -BAR_DROP + 0.05;
  // the scarf: the flat scooped out of the back so the hook can pass inside a
  // tenth of a millimetre of the thread
  const scarf = new THREE.Mesh(
    new THREE.BoxGeometry(NEEDLE_R * 1.7, 0.028, NEEDLE_R * 0.9),
    materials.darkMetal(0x6c737c),
  );
  scarf.position.set(0, TIP_OFF + 0.03, -NEEDLE_R * 0.75);
  needleBar.add(scarf);
  const eyeRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.0052, 0.0022, 8, 18),
    materials.darkMetal(0x40454c),
  );
  eyeRing.rotation.y = Math.PI / 2;
  eyeRing.position.y = EYE_OFF;
  needleBar.add(eyeRing);
  const barGuide = new THREE.Mesh(new THREE.TorusGeometry(0.015, 0.004, 8, 18), steelBright);
  barGuide.rotation.y = Math.PI / 2;
  barGuide.position.set(0, GUIDE_OFF, 0.018);
  needleBar.add(barGuide);
  mech.add(needleBar);

  // --- take-up lever --------------------------------------------------------
  const tuCrank = new THREE.Group();
  const tuWeb = lathe(
    [
      [0, 0],
      [0.05, 0],
      [0.05, 0.024],
      [0, 0.024],
    ],
    steelDark,
    24,
  );
  tuWeb.rotation.z = Math.PI / 2;
  tuCrank.add(tuWeb);
  const tuPin = rod(0.013, 0.06, steelBright, 12);
  tuPin.rotation.z = -Math.PI / 2;
  tuPin.position.set(0.012, TU_CR, 0);
  tuCrank.add(tuPin);
  tuCrank.position.set(TU_X, ARM_Y, ARM_Z);
  mech.add(tuCrank);

  const tuCoupler = rod(0.013, 1, steelBright, 12);
  tuCoupler.userData.baseLen = 1;
  mech.add(tuCoupler);

  // rocker: origin at the pivot, tip arm along +Z, coupler arm at -TU_DELTA
  const takeUp = new THREE.Group();
  const tuArm = beveledBox(0.03, 0.05, TU_LT, steelBright, 0.008);
  tuArm.position.z = TU_LT / 2;
  takeUp.add(tuArm);
  const tuEye = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.005, 8, 20), steelBright);
  tuEye.rotation.y = Math.PI / 2;
  tuEye.position.z = TU_LT;
  takeUp.add(tuEye);
  const tuShort = beveledBox(0.026, 0.036, TU_RR, steelDark, 0.006);
  tuShort.position.set(
    0,
    Math.sin(-TU_DELTA * D2R) * TU_RR * 0.5,
    Math.cos(-TU_DELTA * D2R) * TU_RR * 0.5,
  );
  tuShort.rotation.x = -TU_DELTA * D2R;
  takeUp.add(tuShort);
  const tuHub = disc(0.03, 0.042, steelDark, 20);
  tuHub.rotation.z = Math.PI / 2;
  takeUp.add(tuHub);
  takeUp.position.set(TU_X, TU_PY, TU_PZ);
  mech.add(takeUp);

  // --- presser bar + foot ---------------------------------------------------
  const presser = new THREE.Group();
  const PRESSER_Z = -0.055; // behind the needle bar, not on the same axis
  const presserBar = rod(0.019, 0.34, steelBright, 16);
  presserBar.position.set(0, FAB_TOP + 0.03, PRESSER_Z);
  presser.add(presserBar);
  const footShank = beveledBox(0.03, 0.055, 0.075, steelDark, 0.008);
  footShank.position.set(0, FAB_TOP + 0.052, PRESSER_Z / 2);
  presser.add(footShank);
  for (const sz of [-1, 1]) {
    const toe = beveledBox(0.078, 0.012, 0.1, chromePlate, 0.005);
    toe.position.set(0, FAB_TOP + 0.006, sz * 0.072);
    presser.add(toe);
    const heel = beveledBox(0.078, 0.026, 0.02, chromePlate, 0.005);
    heel.position.set(0, FAB_TOP + 0.013, sz * 0.024);
    presser.add(heel);
  }
  presser.position.x = NX;
  group.add(presser);

  // ==========================================================================
  // HOOK ASSEMBLY — basket, beak, the bobbin case that never turns
  // ==========================================================================
  const hookGroup = new THREE.Group();
  hookGroup.position.set(HOOK_CX, 0, 0);
  group.add(hookGroup);

  const hookShaft = rod(0.019, CASE_BOT - 0.05 - LOW_Y, steelDark, 16);
  hookShaft.position.set(0, LOW_Y, 0);
  hookGroup.add(hookShaft);

  const hookBody = new THREE.Group();
  // A flat base rather than a full basket wall. The real wall would hide the
  // underside of the loop's trip around the case — the exact thing this step
  // exists to show — so the race is implied by the base and the beak arm.
  hookBody.add(
    lathe(
      [
        [0.026, CASE_BOT - 0.053],
        [RACE_R + 0.008, CASE_BOT - 0.053],
        [RACE_R + 0.008, CASE_BOT - 0.023],
        [0.026, CASE_BOT - 0.023],
      ],
      steelBright,
      44,
    ),
  );
  // the beak arm sweeping out to the point circle, and the point itself
  const armPts = [];
  for (let i = 0; i <= 16; i++) {
    const a = (-78 + (78 * i) / 16) * D2R;
    const r = RACE_R + 0.006 + (HOOK_R - RACE_R - 0.006) * (i / 16) ** 1.4;
    const y = CASE_BOT - 0.03 + (HOOK_PY - 0.004 - CASE_BOT + 0.03) * (i / 16) ** 0.8;
    armPts.push([Math.cos(a) * r, y, Math.sin(a) * r]);
  }
  hookBody.add(tubeAlong(armPts, 0.0072, steelDark, { tubularSegments: 60, radialSegments: 10 }));
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.0095, 0.062, 12), chromePlate);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(HOOK_R, HOOK_PY, 0.022);
  beak.castShadow = true;
  hookBody.add(beak);
  const hookHub = disc(0.028, 0.07, steelDark, 20);
  hookHub.position.y = CASE_BOT - 0.06;
  hookBody.add(hookHub);
  hookGroup.add(hookBody);

  // stationary bobbin case + the position finger that holds it still
  const caseMat = materials.aluminum(0xb2b9c1);
  caseMat.roughness = 0.62;
  caseMat.metalness = 0.3;
  const caseWall = lathe(
    [
      [0.018, CASE_BOT - 0.012],
      [CASE_R, CASE_BOT - 0.012],
      [CASE_R, CASE_TOP],
      [CASE_R - 0.007, CASE_TOP],
      [CASE_R - 0.007, CASE_BOT - 0.004],
      [0.018, CASE_BOT - 0.004],
    ],
    caseMat,
    40,
  );
  hookGroup.add(caseWall);
  const caseSpring = beveledBox(0.016, 0.005, 0.058, steelBright, 0.002);
  caseSpring.position.set(-CASE_R - 0.003, CASE_TOP - 0.02, 0.028);
  hookGroup.add(caseSpring);
  const finger = beveledBox(0.06, 0.014, 0.02, steelDark, 0.004);
  finger.position.set(0.015, CASE_TOP + 0.002, -CASE_R - 0.02);
  hookGroup.add(finger);

  // bobbin: clear shell, cyan thread wound inside
  const bobbinMid = CASE_TOP - 0.032;
  const bobbinThreadMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.046, 0.046, 0.05, 28),
    threadBotMat,
  );
  bobbinThreadMesh.position.y = bobbinMid;
  hookGroup.add(bobbinThreadMesh);
  for (const sy of [-1, 1]) {
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.054, 0.005, 28), bobbinShell);
    flange.position.y = bobbinMid + sy * 0.029;
    hookGroup.add(flange);
  }
  const bobbinHub = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.066, 18), bobbinShell);
  bobbinHub.position.y = bobbinMid;
  hookGroup.add(bobbinHub);

  // ==========================================================================
  // FEED DOGS — two toothed rails cantilevered from cross-bars that clear the
  // hook fore and aft, because the dogs have to pass right over the top of it
  // ==========================================================================
  const feedGroup = new THREE.Group();
  group.add(feedGroup);
  const railY = FEED_TOOTH_TOP - FEED_TOOTH_H - 0.004;
  const cross = beveledBox(0.11, 0.018, 0.026, steelDark, 0.004);
  cross.position.set(NX, railY - 0.008, -0.128);
  feedGroup.add(cross);
  const stem = beveledBox(0.05, 0.028, 0.09, steelDark, 0.006);
  stem.position.set(NX, railY - 0.026, -0.17);
  feedGroup.add(stem);
  const toothGeo = new THREE.BoxGeometry(0.016, FEED_TOOTH_H, 0.0054);
  const TEETH = Math.floor(FEED_LEN / 0.0083);
  for (const sx of [-FEED_ROW_DX, FEED_ROW_DX]) {
    const rail = beveledBox(0.018, 0.008, FEED_LEN, steelDark, 0.003);
    rail.position.set(NX + sx, railY, 0);
    feedGroup.add(rail);
    for (let i = 0; i < TEETH; i++) {
      const t = new THREE.Mesh(toothGeo, steelBright);
      t.position.set(
        NX + sx,
        FEED_TOOTH_TOP - FEED_TOOTH_H / 2,
        -FEED_LEN / 2 + 0.004 + i * (FEED_LEN / TEETH),
      );
      t.rotation.x = 0.32; // teeth rake back, so they bite going backwards
      t.castShadow = true;
      feedGroup.add(t);
    }
  }

  // ==========================================================================
  // CLOTH + the row of finished stitches
  // ==========================================================================
  const clothGroup = new THREE.Group();
  group.add(clothGroup);
  const cloth = beveledBox(FAB_X1 - FAB_X0, FAB_T, 1.92, clothMat, 0.004);
  cloth.position.set((FAB_X0 + FAB_X1) / 2, FAB_MID, -0.1);
  cloth.receiveShadow = true;
  cloth.castShadow = true;
  clothGroup.add(cloth);

  // One finished stitch: two interlocking U-bends at mid-thickness, the top
  // thread running along the face between holes and the bobbin thread along the
  // underside. The bobbin thread never goes through the cloth — it is lassoed
  // in the hole, which is exactly what the interlock draws.
  function stitchUnit() {
    const g = new THREE.Group();
    g.add(
      tubeAlong(
        [
          [NX, FAB_TOP + 0.0016, -STITCH],
          [NX, FAB_TOP + 0.0016, -STITCH * 0.45],
          [NX, FAB_TOP + 0.001, -0.005],
          [NX, FAB_MID + 0.0035, -0.0015],
          [NX + 0.005, FAB_MID, 0.0015],
          [NX, FAB_MID - 0.0035, 0.0045],
          [NX, FAB_TOP + 0.001, 0.0065],
        ],
        THREAD_R,
        threadTopMat,
        { tubularSegments: 44, radialSegments: 6 },
      ),
    );
    g.add(
      tubeAlong(
        [
          [NX, BED_TOP - 0.0016, -STITCH],
          [NX, BED_TOP - 0.0016, -STITCH * 0.45],
          [NX, BED_TOP - 0.001, -0.0062],
          [NX - 0.0045, FAB_MID - 0.0018, -0.002],
          [NX - 0.0005, FAB_MID + 0.0016, 0.0015],
          [NX + 0.0045, FAB_MID - 0.0018, 0.0042],
          [NX, BED_TOP - 0.001, 0.0075],
        ],
        THREAD_R,
        threadBotMat,
        { tubularSegments: 44, radialSegments: 6 },
      ),
    );
    return g;
  }
  const stitchProto = stitchUnit();
  const stitchRow = [];
  for (let i = 0; i < STITCHES; i++) {
    const s = i === 0 ? stitchProto : stitchProto.clone();
    clothGroup.add(s);
    stitchRow.push(s);
  }

  // ==========================================================================
  // LIVE THREAD — three tubes rewritten every frame from the cycle scalar
  // ==========================================================================
  const TOP_SEG = 90;
  const LOOP_SEG = 130;
  const BOB_SEG = 40;
  const topThread = dynTube(TOP_SEG, THREAD_R, threadTopMat, 6);
  const loopThread = dynTube(LOOP_SEG, THREAD_R, threadTopMat, 6);
  const bobThread = dynTube(BOB_SEG, THREAD_R, threadBotMat, 6);
  group.add(topThread.mesh, loopThread.mesh, bobThread.mesh);
  const topBuf = Array.from({ length: TOP_SEG + 1 }, () => new THREE.Vector3());
  const loopBuf = Array.from({ length: LOOP_SEG + 1 }, () => new THREE.Vector3());
  const bobBuf = Array.from({ length: BOB_SEG + 1 }, () => new THREE.Vector3());
  // scratch waypoints — reused so the pose function allocates nothing per frame
  const WP = Array.from({ length: 56 }, () => new THREE.Vector3());
  let wpN = 0;
  const wp = (x, y, z) => {
    WP[wpN].set(x, y, z);
    return WP[wpN++];
  };
  const wpList = [];

  // ==========================================================================
  // CALLOUTS — anchors stay on their parts and leaders aim right, clear of the
  // text panel's left ~38%
  // ==========================================================================
  const L = labels.add;
  L('exterior', group, 'Spool of thread', [0.34, TOP_Y + 0.18, -0.2], 54, 60);
  L('exterior', takeUp, 'Take-up lever', [0, 0, TU_LT], 28, 72);
  L('exterior', group, 'Tension dial', [TEN_X, TEN_Y + 0.04, HEAD_Z1 + 0.1], 345, 74);
  L('exterior', needleBar, 'Needle', [0, TIP_OFF + 0.07, 0.016], 318, 78);
  L('exterior', group, 'Presser foot', [NX + 0.034, FAB_TOP + 0.01, 0.07], 306, 66);
  L('exterior', group, 'Needle plate', [-0.55, BED_TOP + 0.01, 0.28], 334, 66);
  L('exterior', group, 'Handwheel', [1.29, ARM_Y + 0.2, ARM_Z + 0.12], 32, 58);
  L('exterior', group, 'Stitch length', [0.78, BASE + 1.06, COL_Z1 + 0.07], 342, 64);

  L('thread', group, 'Spool', [0.34, TOP_Y + 0.18, -0.2], 50, 54);
  L('thread', group, 'Tension discs', [TEN_X, TEN_Y + 0.05, HEAD_Z1 + 0.06], 350, 88);
  L('thread', takeUp, 'Take-up lever', [0, 0, TU_LT], 26, 68);
  L('thread', needleBar, 'Needle eye', [0, EYE_OFF, 0.014], 310, 70);
  L('thread', hookGroup, 'Bobbin', [0.02, CASE_TOP + 0.02, 0], 28, 96);

  L('takeup', takeUp, 'Take-up lever', [0, 0, TU_LT], 26, 70);
  L('takeup', group, 'Tension discs', [TEN_X, TEN_Y + 0.05, HEAD_Z1 + 0.06], 342, 78);

  L('needle', needleBar, 'The eye', [0, EYE_OFF, 0.016], 336, 64);
  L('needle', needleBar, 'Scarf', [0, TIP_OFF + 0.03, -0.014], 22, 58);
  L('needle', group, 'The loop', [NX + 0.006, BASE + 0.352, -0.02], 330, 66);

  L('hook', hookBody, 'Hook point', [HOOK_R + 0.006, HOOK_PY, 0.02], 42, 70);
  L('hook', hookGroup, 'Bobbin case', [0.01, CASE_TOP + 0.008, 0.02], 88, 76);
  L('hook', hookGroup, 'Position finger', [0.015, CASE_TOP + 0.006, -CASE_R - 0.03], 128, 66);
  L('hook', hookGroup, 'Bobbin thread', [-CASE_R - 0.006, CASE_TOP - 0.024, 0.04], 300, 68);

  L('feed', feedGroup, 'Feed dogs', [NX + FEED_ROW_DX, BED_TOP - 0.012, -0.06], 336, 76);
  L('feed', group, 'Presser foot', [NX + 0.03, FAB_TOP + 0.006, 0.08], 336, 72);
  L('feed', group, '4.5 mm per stitch', [NX - 0.05, FAB_TOP + 0.004, -0.24], 156, 70);

  L('drive', group, 'Arm shaft', [0.05, ARM_Y + 0.04, ARM_Z], 64, 62);
  L('drive', group, 'Timing belt', [BELT_X, BASE + 0.55, 0.1], 346, 66);
  L('drive', group, 'Lower shaft', [0.24, LOW_Y - 0.03, 0.04], 320, 74);
  L('drive', group, 'Feed cams', [-0.35, LOW_Y + 0.07, 0.02], 70, 76);
  L('drive', group, '2:1 bevel', [HOOK_CX + 0.06, LOW_Y + 0.06, 0.02], 38, 84);
  L('drive', group, 'Motor', [MOTOR_X - 0.12, BASE + 1.02, -0.24], 26, 66);

  // ==========================================================================
  // POSE — one scalar, `cycle`, in degrees of arm-shaft rotation per stitch
  // ==========================================================================
  const state = { cycle: 0, reveal: 0, open: 0 };
  const vEye = new THREE.Vector3();
  const vGuide = new THREE.Vector3();
  const vHole = new THREE.Vector3();
  const vStraight = new THREE.Vector3();
  let shellTrans = false;

  // Fabric phase: 0 until the dogs grip at psi 210, 1 when they let go at 330,
  // then it wraps. The wrap lands at shaft 60 deg, three degrees before the
  // needle re-enters the cloth, so nothing on screen is ever caught mid-jump.
  function feedPhase(psiDeg) {
    if (psiDeg < 210 || psiDeg > 330) return 0;
    return clamp01((Math.cos(psiDeg * D2R) + 0.866) / 1.732);
  }

  function apply() {
    const th = ((state.cycle % 360) + 360) % 360;
    const rev = state.cycle * D2R;
    wpN = 0;
    wpList.length = 0;

    // --- needle bar: crank-slider on the arm shaft --------------------------
    const bn = (th + 90) * D2R;
    const pinZ = ARM_Z + CRANK_R * Math.cos(bn);
    const pinY = ARM_Y + CRANK_R * Math.sin(bn);
    const barY = pinY - Math.sqrt(Math.max(1e-4, ROD_L * ROD_L - pinZ * pinZ));
    needleBar.position.set(NX, barY, 0);
    crankDisc.rotation.x = th * D2R;
    aimRod(conRod, NX, pinY, pinZ, NX, barY, 0);
    const eyeY = barY + EYE_OFF;

    // --- take-up lever: four-bar off the same shaft --------------------------
    const bt = (th + TU_PHASE) * D2R;
    const tz = ARM_Z + TU_CR * Math.cos(bt);
    const ty = ARM_Y + TU_CR * Math.sin(bt);
    tuCrank.rotation.x = (th + TU_PHASE - 90) * D2R;
    const dz = tz - TU_PZ;
    const dy = ty - TU_PY;
    const dd = Math.hypot(dz, dy);
    const cosPsi = Math.min(
      1,
      Math.max(-1, (dd * dd + TU_RR * TU_RR - TU_LC * TU_LC) / (2 * dd * TU_RR)),
    );
    const jAng = Math.atan2(dy, dz) + Math.acos(cosPsi);
    takeUp.rotation.x = jAng + TU_DELTA * D2R;
    aimRod(
      tuCoupler,
      TU_X,
      ty,
      tz,
      TU_X,
      TU_PY + TU_RR * Math.sin(jAng),
      TU_PZ + TU_RR * Math.cos(jAng),
    );
    const tuTipY = TU_PY + TU_LT * Math.sin(takeUp.rotation.x);
    const tuTipZ = TU_PZ + TU_LT * Math.cos(takeUp.rotation.x);

    // --- hook: two turns per stitch, point at the needle at 203 deg ---------
    const hookA = HOOK_PHASE - 2 * th;
    hookBody.rotation.y = -hookA * D2R;
    hookShaft.rotation.y = -hookA * D2R;
    hookBevel.rotation.y = -hookA * D2R;

    // --- the rest of the transmission ---------------------------------------
    wheel.rotation.x = rev;
    armPulley.rotation.x = rev;
    topPulley.rotation.x = rev;
    botPulley.rotation.x = rev;
    lowBevel.rotation.x = rev;
    motorPulley.rotation.x = rev * 3;
    eccAdvance.rotation.x = rev;
    eccLift.rotation.x = rev;

    // --- feed dogs: the ellipse ----------------------------------------------
    const psi = th - 90;
    const psiDeg = ((psi % 360) + 360) % 360;
    const ps = psi * D2R;
    const feedZ = -FEED_AMP * Math.cos(ps);
    const feedY = -FEED_LIFT * Math.sin(ps);
    feedGroup.position.set(0, feedY, feedZ);
    aimRod(
      eccRodA,
      -0.42,
      LOW_Y + 0.028 * Math.sin(rev),
      0.028 * Math.cos(rev),
      NX + 0.12,
      railY - 0.03 + feedY,
      feedZ - 0.16,
    );
    aimRod(
      eccRodB,
      -0.28,
      LOW_Y + 0.024 * Math.sin(rev + 1.7),
      0.024 * Math.cos(rev + 1.7),
      NX + 0.12,
      railY - 0.06 + feedY * 0.6,
      0.1,
    );

    // --- cloth + finished stitches -------------------------------------------
    const g = feedPhase(psiDeg);
    const advance = -STITCH * g;
    cloth.position.z = -0.1 + advance;
    for (let i = 0; i < STITCHES; i++) stitchRow[i].position.z = -i * STITCH + advance;

    // --- the working thread ---------------------------------------------------
    vEye.set(NX, eyeY, 0);
    vGuide.set(NX, barY + GUIDE_OFF, 0.018);
    wpList.push(
      SPOOL_TOP,
      wp(0.02, TOP_Y + 0.11, -0.14),
      GUIDE_PT,
      wp(-0.62, TEN_Y + 0.34, HEAD_Z1 + 0.02),
      TEN_PT,
      wp(TEN_X + 0.15, TEN_Y + 0.38, HEAD_Z1 + 0.05),
      wp(TU_X, tuTipY, tuTipZ + 0.024),
      wp(NX + 0.06, barY + GUIDE_OFF + 0.17, 0.05),
      vGuide,
      vEye,
    );
    topThread.set(resample(wpList, TOP_SEG + 1, topBuf));

    // Below the cloth: nothing, a forming loop, the loop riding the hook, or
    // the loop collapsing as the take-up hauls it up.
    //
    // The loop's life is set by the HOOK, not by where the needle is. The eye
    // only stays below the cloth from 99 to 261 deg, but the hook holds the
    // loop until 300 and the take-up is still clearing it at 342 — gating the
    // loop on the eye being under the cloth (the first attempt) deleted it
    // before the hook had gone a quarter of the way round the bobbin, and every
    // still of the three hook steps showed a bare needle.
    const eyeUnder = eyeY < FAB_TOP - 0.001;
    // where the top thread meets the cloth: the hole it is sewing, or the knot
    // it trails back to while the dogs drag the cloth away
    const trail = th > 45 && th < 63 ? clamp01((th - 45) / 18) : th >= 63 && th < 300 ? 1 : 0;
    const holeZ = advance * (1 - trail);
    vHole.set(NX, FAB_TOP + 0.002, holeZ);
    let bulge = 0;
    let sweep = 0;
    let collapse = 0;
    if (th >= 180 && th < CATCH) bulge = clamp01((th - 180) / (CATCH - 180));
    else if (th >= CATCH && th <= CAST) {
      bulge = 1;
      sweep = 2 * (th - CATCH);
    } else if (th > CAST && th < CAST + 42) {
      bulge = 1;
      sweep = 2 * (CAST - CATCH);
      collapse = clamp01((th - CAST) / 42);
    }
    wpList.length = 0;
    wpList.push(vEye);
    // if the eye is back above the cloth, the thread reaches the loop by way of
    // the hole it went in through
    if (!eyeUnder) {
      wpList.push(
        wp(NX + 0.004, (eyeY + FAB_TOP) / 2, holeZ * 0.55),
        wp(NX + 0.001, FAB_TOP + 0.001, holeZ * 0.1),
      );
    }
    const startY = eyeUnder ? eyeY : BED_TOP - 0.004;
    if (bulge < 0.02) {
      if (eyeUnder) wpList.push(wp(NX + 0.005, (eyeY + FAB_TOP) / 2, 0.005));
      wpList.push(vHole);
    } else if (sweep < 1) {
      // the loop bulging out on the scarf side — a few thousandths of a second
      const b = -0.024 * bulge; // behind the needle, against the scarf
      wpList.push(
        wp(NX + 0.002, startY - 0.005, b * 0.5),
        wp(NX + 0.004, startY + 0.008, b),
        wp(NX + 0.004, startY + 0.034, b * 0.55),
        vHole,
      );
    } else {
      // riding the hook: over the top of the bobbin case, round to the point,
      // back underneath. That IS "the loop goes round the bobbin".
      const rC = (CASE_R + RACE_R) / 2;
      const N = Math.max(3, Math.round(sweep / 14)); // keep arc points evenly spread
      const topY = CASE_TOP + 0.008;
      const botY = CASE_BOT - 0.015; // the clear gap above the hook base
      wpList.push(wp(NX + 0.007, Math.min(startY, CASE_TOP + 0.02) - 0.004, -0.014));
      for (let i = 0; i <= N; i++) {
        const a = (180 - (sweep * i) / N) * D2R;
        wpList.push(wp(HOOK_CX + rC * Math.cos(a), topY, rC * Math.sin(a)));
      }
      const aTip = (180 - sweep) * D2R;
      wpList.push(
        wp(
          HOOK_CX + (HOOK_R + 0.008) * Math.cos(aTip),
          (topY + botY) / 2,
          (HOOK_R + 0.008) * Math.sin(aTip),
        ),
      );
      for (let i = N; i >= 0; i--) {
        const a = (180 - (sweep * i) / N) * D2R;
        wpList.push(wp(HOOK_CX + rC * Math.cos(a), botY, rC * Math.sin(a)));
      }
      wpList.push(wp(NX - 0.005, CASE_TOP + 0.02, 0.012), vHole);
      if (collapse > 0) {
        // the take-up hauls the slack back: every point of the loop is pulled
        // in toward the straight line from the eye to the hole
        const last = wpList.length - 1;
        const k = Math.min(1, collapse * 1.15);
        for (let i = 1; i < last; i++) {
          vStraight.lerpVectors(wpList[0], wpList[last], i / last);
          wpList[i].lerp(vStraight, k);
        }
      }
    }
    loopThread.set(resample(wpList, LOOP_SEG + 1, loopBuf));

    // bobbin thread: off the bobbin, under the case's leaf spring, up to the
    // underside of the cloth at the knot the machine is tying right now
    wpList.length = 0;
    wpList.push(
      wp(HOOK_CX - 0.03, bobbinMid + 0.004, -0.028),
      wp(HOOK_CX - CASE_R - 0.004, CASE_TOP - 0.012, -0.01),
      wp(NX + 0.028, BED_TOP - 0.022, holeZ * 0.5),
      wp(NX, BED_TOP - 0.0012, holeZ),
    );
    bobThread.set(resample(wpList, BOB_SEG + 1, bobBuf));

    // --- reveal / open --------------------------------------------------------
    const r = state.reveal;
    const wantTrans = r > 0.01;
    if (wantTrans !== shellTrans) {
      shellTrans = wantTrans;
      shell.transparent = wantTrans;
      shell.needsUpdate = true;
    }
    // 0.05, not 0.1: the arm, head, column and top deck overlap, and their
    // alphas compound — at 0.1 each the machine read as one dark grey glass box
    // over the dark backdrop instead of a cutaway
    shell.opacity = 1 - 0.95 * r;
    shell.clearcoat = shellCoat * (1 - r);
    shell.depthWrite = !wantTrans;
    facePlate.visible = r < 0.5;
    tuRecess.visible = r < 0.5; // head dressing — goes with the face plate
    // the two biggest shell panels come off rather than ghost: four ghosted
    // layers compound to ~19% and the machine reads as a dark glass box
    column.visible = r < 0.5;
    topDeck.visible = r < 0.5;
    // the bed deck goes with the needle plate, or the lower shaft, the feed cams
    // and the 2:1 bevel stay buried and the drive step labels point at cream
    deck.visible = state.open < 0.5;
    drive.visible = r > 0.5;
    throatPlate.visible = state.open < 0.5;
    bedFront.visible = state.open < 0.5;
    deckLip.visible = state.open < 0.5;
  }

  apply();

  return {
    group,
    state,
    parts: { needleBar, takeUp, hookBody, feedGroup, cloth, wheel, dress, drive, presser },
    set(partial) {
      Object.assign(state, partial);
      apply();
    },
    setCycle(deg) {
      state.cycle = deg;
      apply();
    },
    setLabels: labels.setLabels,
  };
}
