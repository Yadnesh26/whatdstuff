import * as THREE from 'three';
import { materials, rod, box, flowField, studioPlinth } from '../../framework/parts.js';
import { beveledBox, tubeAlong, bladeRing, coil, chainPath } from '../../framework/geometry.js';
import { TAU, smooth } from '../../framework/motion.js';
import { calloutSets } from '../../framework/callouts.js';
import { concreteAlbedoMap } from '../../framework/textures.js';

// A pressurised water reactor (PWR) station — the design behind roughly 70% of
// the world's operating reactors — staged left-to-right along the energy path:
// containment building (reactor vessel + steam generator + pressuriser +
// coolant pump) -> turbine hall (HP + 2x LP turbine and generator on one
// shaft) -> condenser -> cooling tower -> step-up transformer and lines.
//
// Mechanism, validated against Wikipedia's Pressurized water reactor, Nuclear
// fuel, Nuclear fission and Containment building articles:
//   * A slow ("thermal") neutron is absorbed by a U-235 nucleus, which splits
//     into two fragments of roughly 95 and 135 daltons, releasing ~200 MeV and
//     an average of 2.5 fast neutrons. The chain sustains itself when exactly
//     one of those neutrons goes on to cause the next fission (k = 1.0).
//   * Those new neutrons are born FAST and are poor at splitting U-235. The
//     surrounding water moderates them — slows them by collision — which is
//     why a PWR physically cannot run away if it loses its water: no water,
//     no moderation, no chain reaction. Hotter water is also less dense and
//     moderates less, giving the negative temperature coefficient that makes
//     the reactor self-regulating.
//   * Fuel is UO2 ceramic pellets enriched to 3-5% U-235, sealed in ~1 cm
//     zircaloy tubes, bundled 264 rods to a 17x17 assembly ~4 m long; a core
//     holds 150-250 assemblies (80-100 t of uranium) and a third is swapped
//     every 18-24 months. One pellet carries the heat of about a ton of coal.
//   * Control rods (boron/cadmium) enter from ABOVE and absorb neutrons; on a
//     scram they drop in under gravity.
//   * The primary loop runs at ~155 bar and 275 degC in / 315 degC out. At
//     that pressure the water cannot boil (it would need to pass 374 degC /
//     22.06 MPa to reach the critical point). A pressuriser, held at 345 degC
//     by submerged heaters and a spray nozzle, is what pins the pressure there.
//   * The steam generator hands that heat across several thousand U-tubes into
//     a SEPARATE secondary circuit, which boils at ~6.2 MPa / 275 degC. The two
//     fluids never mix, so the steam driving the turbine has never touched the
//     fuel. From the turbine on, it is an ordinary steam plant.
//
// DISCLOSED SIMPLIFICATIONS (for legibility at explainer scale):
//   * The reactor vessel and steam generator are drawn oversize relative to the
//     containment dome; at true scale the vessel would be a thumb-width speck.
//   * ONE coolant loop is shown; real PWRs run two to four in parallel.
//   * Seven fuel assemblies of 4x4 rods stand in for 150-250 of 17x17.

const GY = 0.16; // plinth top — everything stands on this
const CONT_X = -2.15; // containment centre
const CONT_R = 1.02;
const CONT_WALL_TOP = 1.85;
const AXIS_Y = 1.2; // turbine/generator shaft height
const TH_X0 = -0.48;
const TH_X1 = 2.35;
const TH_ROOF_Y = 1.9;
const CT_X = 3.05;
const GAP = 1.15; // cutaway sector opening, radians

// LatheGeometry measures phi from +Z toward +X, so PI/4 points the opening at
// the (+X, +Z) corner every step camera sits in.
const CUT_PHI = Math.PI / 4;

// Lathe sector — a turned shell with a wedge removed so the camera can see
// inside. Sealed shells (the containment dome) use a full lathe instead.
function sectorLathe(profile, material, segments = 44, side = THREE.FrontSide) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(pts, segments, CUT_PHI + GAP / 2, TAU - GAP);
  material.side = side;
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}

// Quarter-arc profile points for a hemispherical vessel head. dir +1 sweeps
// upward from the equator (a top head), -1 downward (a bottom head).
function headProfile(r, yEquator, dir, steps = 6) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * (Math.PI / 2);
    pts.push([r * Math.cos(a), yEquator + dir * r * Math.sin(a)]);
  }
  return dir > 0 ? pts : pts.reverse();
}

// Soft upward-drifting plume of overlapping translucent puffs (the cooling
// tower's vapour). depthWrite:false so a faded puff never punches a hole.
function buildPlume(color, baseR, levels, riseY) {
  const g = new THREE.Group();
  const meshes = [];
  for (let i = 0; i < levels; i++) {
    const t = i / (levels - 1);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(baseR * (0.7 + t * 1.9), 12, 9), mat);
    mesh.userData.jitter = Math.sin(i * 2.4) * baseR * 0.6 * t;
    mesh.userData.jitterZ = Math.cos(i * 1.7) * baseR * 0.6 * t;
    mesh.position.set(mesh.userData.jitter, t * riseY, mesh.userData.jitterZ);
    mesh.userData.baseOpacity = 0.11 * (1 - t * 0.6);
    g.add(mesh);
    meshes.push(mesh);
  }
  return { group: g, meshes };
}

export function buildNuclearPlant({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  // ---- shared materials ----------------------------------------------------
  const concrete = new THREE.MeshStandardMaterial({ color: 0x8f949a, roughness: 0.94, metalness: 0.03 });
  const concreteDark = new THREE.MeshStandardMaterial({ color: 0x7a7d82, roughness: 0.94, metalness: 0.03 });

  // Cast-concrete surfacing for the two big shells. The map is cached and
  // SHARED, so each surface takes its own clone with a repeat matched to its
  // real size — left at the default (1,1) the tile stretches across a whole
  // cooling tower and reads as smeared plastic rather than concrete.
  function castConcrete(color, repeatX, repeatY) {
    const albedo = concreteAlbedoMap().clone();
    albedo.colorSpace = THREE.SRGBColorSpace;
    albedo.wrapS = albedo.wrapT = THREE.RepeatWrapping;
    albedo.repeat.set(repeatX, repeatY);
    albedo.needsUpdate = true;
    return new THREE.MeshStandardMaterial({
      color,
      map: albedo,
      roughness: 0.94,
      metalness: 0.03,
    });
  }

  const vesselMat = materials.paintedMetal(0x8e97a3);
  vesselMat.roughness = 0.55;
  vesselMat.clearcoatRoughness = 0.35;
  const vesselLiner = new THREE.MeshStandardMaterial({ color: 0x1d2024, roughness: 0.9, metalness: 0.2, side: THREE.BackSide });
  const casingMat = materials.aluminum(0x8c94a0);
  casingMat.roughness = 0.7;
  const linerMat = new THREE.MeshStandardMaterial({ color: 0x232529, roughness: 0.92, metalness: 0.15 });
  const bladeMat = materials.brushedSteel(0xb9c2cc);
  bladeMat.roughness = 0.85;
  const pipeMat = materials.paintedMetal(0x3d4a52);
  const pipeMatBig = materials.paintedMetal(0x445560);
  pipeMatBig.clearcoatRoughness = 0.4;
  const boronMat = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.72, metalness: 0.4 });
  const wireColor = 0xc9853f;

  const HOT_N = 0xd23c2e;
  const COOL_S = 0x2e6bd2;
  const POS_COLOR = 0x6ea8ff;
  const NEG_COLOR = 0xffa860;
  const VAPOR_WHITE = 0xf2f6fa;
  const NEUTRON_C = 0x5ec8ff;

  const labels = calloutSets(['anatomy', 'inside', 'fission', 'fuel', 'rods', 'primary', 'steamgen', 'power']);

  // =========================================================================
  // GROUND
  // =========================================================================
  const plinth = studioPlinth({ w: 7.4, h: GY, d: 2.5, bevel: 0.05 });
  plinth.position.x = 0.25;
  group.add(plinth);

  // =========================================================================
  // CONTAINMENT BUILDING — sealed cylinder + hemispherical dome. This is the
  // ONLY thing the viewer sees in step 1; setReveal() ghosts it away.
  // =========================================================================
  const contBase = new THREE.Mesh(new THREE.CylinderGeometry(CONT_R + 0.12, CONT_R + 0.16, 0.16, 48), concreteDark);
  contBase.position.set(CONT_X, GY + 0.08, 0);
  contBase.receiveShadow = true;
  group.add(contBase);

  const contProfile = [[CONT_R, GY + 0.14], [CONT_R, CONT_WALL_TOP], ...headProfile(CONT_R, CONT_WALL_TOP, 1, 8)];
  const shellMat = castConcrete(0xa8adb3, 4, 1);
  const contShell = new THREE.Mesh(
    new THREE.LatheGeometry(contProfile.map(([r, y]) => new THREE.Vector2(r, y)), 56),
    shellMat,
  );
  contShell.castShadow = true;
  contShell.receiveShadow = true;
  contShell.position.x = CONT_X;
  group.add(contShell);

  // the steel liner every containment carries inside its concrete — only ever
  // seen while the shell is solid, so it is hidden outright on reveal rather
  // than darkening the internals through a ghosted wall
  const contLiner = new THREE.Mesh(
    new THREE.LatheGeometry(
      contProfile.map(([r, y]) => new THREE.Vector2(Math.max(0.001, r - 0.045), y)),
      40,
    ),
    new THREE.MeshStandardMaterial({ color: 0x2c3034, roughness: 0.55, metalness: 0.75, side: THREE.BackSide }),
  );
  contLiner.position.x = CONT_X;
  group.add(contLiner);

  // Ring beam at the spring line, base ring, and the two openings every
  // containment carries: the big round equipment hatch and a personnel
  // airlock. All on shellMat, so they ghost away with the shell.
  const contDress = new THREE.Group();
  contDress.position.x = CONT_X;
  group.add(contDress);
  const ringBeam = new THREE.Mesh(new THREE.CylinderGeometry(CONT_R + 0.06, CONT_R + 0.055, 0.14, 56), shellMat);
  ringBeam.position.y = CONT_WALL_TOP - 0.05;
  ringBeam.castShadow = true;
  contDress.add(ringBeam);
  const baseRing = new THREE.Mesh(new THREE.CylinderGeometry(CONT_R + 0.06, CONT_R + 0.09, 0.2, 56), shellMat);
  baseRing.position.y = GY + 0.24;
  baseRing.castShadow = true;
  contDress.add(baseRing);
  const RADIAL_UP = new THREE.Vector3(0, 1, 0);
  const hatchDir = new THREE.Vector3(Math.sin(1.22), 0, Math.cos(1.22));
  const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.23, 0.12, 30), shellMat);
  hatch.position.copy(hatchDir).multiplyScalar(CONT_R - 0.02).setY(0.92);
  hatch.quaternion.setFromUnitVectors(RADIAL_UP, hatchDir);
  hatch.castShadow = true;
  contDress.add(hatch);
  const airlockDir = new THREE.Vector3(Math.sin(2.0), 0, Math.cos(2.0));
  const airlock = beveledBox(0.26, 0.34, 0.22, shellMat, 0.02);
  airlock.position.copy(airlockDir).multiplyScalar(CONT_R - 0.03).setY(GY + 0.34);
  airlock.rotation.y = 2.0;
  contDress.add(airlock);

  // everything the dome hides
  const internals = new THREE.Group();
  group.add(internals);

  // =========================================================================
  // REACTOR PRESSURE VESSEL — cutaway, core inside, control rods from above
  // =========================================================================
  const RPV_R = 0.24;
  const RPV_O = new THREE.Vector3(CONT_X - 0.26, GY + 0.1, 0.08); // vessel bottom centre
  const rpv = new THREE.Group();
  rpv.position.copy(RPV_O);
  internals.add(rpv);

  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.1, 28), concreteDark);
  pedestal.position.set(RPV_O.x, GY + 0.05, RPV_O.z);
  pedestal.receiveShadow = true;
  internals.add(pedestal);

  const RPV_BODY_TOP = 0.88;
  const RPV_FLANGE_TOP = 0.95;
  const rpvProfile = [
    ...headProfile(RPV_R, RPV_R, -1, 6),
    [RPV_R, RPV_BODY_TOP],
    [RPV_R + 0.035, RPV_BODY_TOP],
    [RPV_R + 0.035, RPV_FLANGE_TOP],
    [RPV_R, RPV_FLANGE_TOP],
    ...headProfile(RPV_R, RPV_FLANGE_TOP, 1, 6),
  ];
  rpv.add(sectorLathe(rpvProfile, vesselMat.clone()));
  rpv.add(
    sectorLathe(
      rpvProfile.map(([r, y]) => [Math.max(0.001, r - 0.016), y]),
      vesselLiner.clone(),
      40,
      THREE.BackSide,
    ),
  );

  // core barrel + support plates
  const CORE_Y0 = 0.3;
  const CORE_Y1 = 0.76;
  const BARREL_R = 0.168;
  const barrelMat = materials.brushedSteel(0x99a2ad);
  barrelMat.roughness = 0.7;
  rpv.add(sectorLathe([[BARREL_R, CORE_Y0 - 0.06], [BARREL_R, CORE_Y1 + 0.06]], barrelMat, 36, THREE.DoubleSide));
  const lowerPlate = new THREE.Mesh(
    new THREE.CylinderGeometry(BARREL_R, BARREL_R, 0.022, 32),
    materials.brushedSteel(0x8e97a3),
  );
  lowerPlate.position.y = CORE_Y0 - 0.02;
  rpv.add(lowerPlate);
  // upper support is an open RING so the descending control rods stay visible
  const upperRingMat = materials.brushedSteel(0x8e97a3);
  upperRingMat.side = THREE.DoubleSide;
  const upperRing = new THREE.Mesh(
    new THREE.CylinderGeometry(BARREL_R, BARREL_R, 0.022, 32, 1, true),
    upperRingMat,
  );
  upperRing.position.y = CORE_Y1 + 0.03;
  rpv.add(upperRing);

  // --- fuel assemblies: 7 bundles of 4x4 rods, one instanced mesh ----------
  const ASM_RING_R = 0.115;
  const ROD_PITCH = 0.018;
  const asmCentres = [[0, 0]];
  for (let k = 0; k < 6; k++) {
    // the first ring bundle sits at CUT_PHI, so it faces straight out of the
    // cutaway opening — that is the one the fission step features
    const th = CUT_PHI + (k * TAU) / 6;
    asmCentres.push([ASM_RING_R * Math.sin(th), ASM_RING_R * Math.cos(th)]);
  }
  const FRONT_ASM = asmCentres[1];

  const fuelMat = materials.brushedSteel(0xb6bec8);
  fuelMat.roughness = 0.62;
  fuelMat.emissive = new THREE.Color(0x000000);
  const fuelRods = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.0055, 0.0055, CORE_Y1 - CORE_Y0, 8),
    fuelMat,
    asmCentres.length * 16,
  );
  fuelRods.castShadow = true;
  {
    const m = new THREE.Matrix4();
    let n = 0;
    for (const [cx, cz] of asmCentres) {
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          m.makeTranslation(cx + (i - 1.5) * ROD_PITCH, (CORE_Y0 + CORE_Y1) / 2, cz + (j - 1.5) * ROD_PITCH);
          fuelRods.setMatrixAt(n++, m);
        }
      }
    }
    fuelRods.instanceMatrix.needsUpdate = true;
  }
  rpv.add(fuelRods);

  // --- control rod clusters: boron rodlets on a spider, driven from above ---
  const RODS_TRAVEL = 0.5; // fully withdrawn sits this far above the inserted pose
  const rodsGroup = new THREE.Group(); // modelled FULLY INSERTED; lifted by the pose fn
  rpv.add(rodsGroup);
  const rodlets = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.0042, 0.0042, CORE_Y1 - CORE_Y0 + 0.02, 7),
    boronMat,
    asmCentres.length * 4,
  );
  {
    const m = new THREE.Matrix4();
    let n = 0;
    for (const [cx, cz] of asmCentres) {
      for (const [dx, dz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
        m.makeTranslation(cx + dx * ROD_PITCH * 2, (CORE_Y0 + CORE_Y1) / 2, cz + dz * ROD_PITCH * 2);
        rodlets.setMatrixAt(n++, m);
      }
    }
    rodlets.instanceMatrix.needsUpdate = true;
  }
  rodsGroup.add(rodlets);
  const driveMat = materials.brushedSteel(0x8e97a3);
  driveMat.roughness = 0.6;
  const spiders = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(ROD_PITCH * 2.2, ROD_PITCH * 2.2, 0.016, 16),
    boronMat,
    asmCentres.length,
  );
  // drive shafts, long enough to stay swallowed by their housings at both extremes
  const drives = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.008, 0.008, 0.82, 10),
    driveMat,
    asmCentres.length,
  );
  {
    const m = new THREE.Matrix4();
    asmCentres.forEach(([cx, cz], n) => {
      spiders.setMatrixAt(n, m.makeTranslation(cx, CORE_Y1 + 0.03, cz));
      drives.setMatrixAt(n, m.makeTranslation(cx, CORE_Y1 + 0.44, cz));
    });
    spiders.instanceMatrix.needsUpdate = true;
    drives.instanceMatrix.needsUpdate = true;
  }
  rodsGroup.add(spiders, drives);
  // fixed CRDM housings poking through the vessel head. One InstancedMesh per
  // shape rather than 14 meshes — this scene opened the polish pass at the
  // 10 ms ceiling, so every repeated shape rides instancing.
  const housingMat = materials.brushedSteel(0xa5adb8);
  housingMat.roughness = 0.6;
  const housingGeo = new THREE.CylinderGeometry(0.017, 0.017, 0.34, 20).translate(0, 0.17, 0);
  const housings = new THREE.InstancedMesh(housingGeo, housingMat, asmCentres.length);
  const caps = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.019, 12, 8),
    materials.paintedMetal(0x565e69),
    asmCentres.length,
  );
  housings.castShadow = true;
  {
    const m = new THREE.Matrix4();
    asmCentres.forEach(([cx, cz], n) => {
      const rad = Math.hypot(cx, cz);
      const yTop = RPV_FLANGE_TOP + RPV_R * Math.cos(Math.asin(Math.min(1, rad / RPV_R)));
      housings.setMatrixAt(n, m.makeTranslation(cx, yTop - 0.02, cz));
      caps.setMatrixAt(n, m.makeTranslation(cx, yTop + 0.32, cz));
    });
    housings.instanceMatrix.needsUpdate = true;
    caps.instanceMatrix.needsUpdate = true;
  }
  rpv.add(housings, caps);

  // Head studs around the closure flange — the signature detail of a reactor
  // vessel, and the flange reads as a bare machined step without them. Placed
  // only where the shell actually exists: studs inside the cutaway wedge would
  // hang in the opening. Built instanced rather than with geometry.boltCircle,
  // which emits one mesh per bolt.
  {
    const studAngles = [];
    for (let i = 0; i < 26; i++) {
      const phi = (i / 26) * TAU;
      const off = Math.abs(((phi - CUT_PHI + Math.PI) % TAU) - Math.PI);
      if (off < GAP / 2 + 0.06) continue; // inside the cutaway opening
      studAngles.push(phi);
    }
    const studMat = materials.brushedSteel(0x9aa2ad);
    studMat.roughness = 0.52;
    const studs = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.011, 0.011, 0.062, 6).translate(0, 0.031, 0),
      studMat,
      studAngles.length,
    );
    studs.castShadow = true;
    const m = new THREE.Matrix4();
    studAngles.forEach((phi, n) => {
      m.makeTranslation(Math.sin(phi) * 0.256, RPV_FLANGE_TOP - 0.005, Math.cos(phi) * 0.256);
      studs.setMatrixAt(n, m);
    });
    studs.instanceMatrix.needsUpdate = true;
    rpv.add(studs);
  }

  // --- fission event: one atom splitting, at the front bundle's face --------
  const FISS_OUT = 0.055; // pulled just clear of the bundle so nothing occludes it
  const fissionGroup = new THREE.Group();
  fissionGroup.position.set(
    FRONT_ASM[0] * (1 + FISS_OUT / ASM_RING_R),
    0.55,
    FRONT_ASM[1] * (1 + FISS_OUT / ASM_RING_R),
  );
  rpv.add(fissionGroup);

  const nucleusMat = materials.glow(0x7fd4ff, 1.2);
  nucleusMat.transparent = true;
  nucleusMat.depthWrite = false;
  const nucleus = new THREE.Mesh(new THREE.SphereGeometry(0.023, 16, 12), nucleusMat);
  fissionGroup.add(nucleus);

  const flashMat = new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0, depthWrite: false });
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.038, 14, 10), flashMat);
  fissionGroup.add(flash);

  // two UNEQUAL fragments — real fission splits ~95 / ~135 daltons, not in half
  const fragments = [];
  for (const [fr, sign] of [[0.0165, 1], [0.0185, -1]]) {
    const mat = materials.glow(0xff8a2e, 0.9);
    mat.transparent = true;
    mat.opacity = 0;
    mat.depthWrite = false;
    const frag = new THREE.Mesh(new THREE.SphereGeometry(fr, 14, 10), mat);
    frag.userData.dir = new THREE.Vector3(0.72 * sign, 0.3 * sign, 0.6 * sign).normalize();
    fissionGroup.add(frag);
    fragments.push(frag);
  }

  // the average 2.5 neutrons per fission — drawn as the common 3
  const bornNeutrons = [];
  for (let i = 0; i < 3; i++) {
    const mat = materials.glow(NEUTRON_C, 1.0);
    mat.transparent = true;
    mat.opacity = 0;
    mat.depthWrite = false;
    const n = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), mat);
    const a = (i / 3) * TAU + 0.5;
    n.userData.dir = new THREE.Vector3(Math.cos(a) * 0.8, 0.5 + Math.sin(a) * 0.3, Math.sin(a) * 0.8).normalize();
    fissionGroup.add(n);
    bornNeutrons.push(n);
  }

  const incomingMat = materials.glow(NEUTRON_C, 1.1);
  incomingMat.transparent = true;
  incomingMat.depthWrite = false;
  const incoming = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), incomingMat);
  const INCOMING_FROM = new THREE.Vector3(0.062, 0.076, 0.046);
  fissionGroup.add(incoming);

  // ambient neutron rain through the core — INTEGER frequencies, so every dot
  // returns to its own start position at the end of a lap
  const neutronRain = [];
  for (let i = 0; i < 16; i++) {
    const mat = materials.glow(NEUTRON_C, 0.9);
    mat.transparent = true;
    mat.opacity = 0;
    mat.depthWrite = false;
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.0048, 8, 6), mat);
    d.userData.seed = i / 16;
    d.userData.fx = 2 + (i % 3);
    d.userData.fz = 3 + (i % 2);
    d.userData.fy = 2 + (i % 4);
    rpv.add(d);
    neutronRain.push(d);
  }

  // =========================================================================
  // STEAM GENERATOR — slim tube bundle below, fat steam-separator drum above
  // =========================================================================
  const SG_O = new THREE.Vector3(CONT_X + 0.52, GY + 0.46, -0.3);
  const SG_R_LOW = 0.155;
  const SG_R_UP = 0.2;
  const sg = new THREE.Group();
  sg.position.copy(SG_O);
  internals.add(sg);

  const sgPedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.46, 24), concreteDark);
  sgPedestal.position.set(SG_O.x, GY + 0.23, SG_O.z);
  sgPedestal.receiveShadow = true;
  internals.add(sgPedestal);

  const SG_TOP = 1.32;
  const sgProfile = [
    ...headProfile(SG_R_LOW, SG_R_LOW, -1, 5),
    [SG_R_LOW, 0.62],
    [SG_R_UP, 0.8], // conical transition to the separator drum
    [SG_R_UP, 1.14],
    ...headProfile(SG_R_UP, 1.14, 1, 5),
  ];
  sg.add(sectorLathe(sgProfile, vesselMat.clone()));
  sg.add(
    sectorLathe(
      sgProfile.map(([r, y]) => [Math.max(0.001, r - 0.014), y]),
      vesselLiner.clone(),
      40,
      THREE.BackSide,
    ),
  );

  // tube sheet + divider plate: the boundary the two circuits meet across but
  // never cross. Legs run along uDir so the U reads broadside to the cutaway.
  const U_DIR = new THREE.Vector3(Math.sin(CUT_PHI + Math.PI / 2), 0, Math.cos(CUT_PHI + Math.PI / 2));
  const TUBE_SHEET_Y = 0.16;
  const tubeSheet = new THREE.Mesh(
    new THREE.CylinderGeometry(SG_R_LOW - 0.012, SG_R_LOW - 0.012, 0.022, 32),
    materials.brushedSteel(0x99a2ad),
  );
  tubeSheet.position.y = TUBE_SHEET_Y;
  sg.add(tubeSheet);
  const divider = beveledBox(0.012, 0.15, SG_R_LOW * 1.9, materials.brushedSteel(0x8e97a3), 0.004);
  divider.position.y = TUBE_SHEET_Y - 0.078;
  divider.rotation.y = CUT_PHI + Math.PI / 2;
  sg.add(divider);

  // the U-tubes themselves — inverted U's of rising height
  const uTubeMat = materials.brushedSteel(0xc2cad4);
  uTubeMat.roughness = 0.58;
  const uTubes = [];
  const U_COUNT = 7;
  for (let i = 0; i < U_COUNT; i++) {
    const d = 0.028 + i * 0.0155;
    const yTop = 0.62 + i * 0.028;
    const pts = [];
    pts.push(U_DIR.clone().multiplyScalar(-d).setY(TUBE_SHEET_Y));
    pts.push(U_DIR.clone().multiplyScalar(-d).setY(yTop - d));
    for (let k = 0; k <= 10; k++) {
      const a = Math.PI - (k / 10) * Math.PI;
      pts.push(U_DIR.clone().multiplyScalar(Math.cos(a) * d).setY(yTop - d + Math.sin(a) * d));
    }
    pts.push(U_DIR.clone().multiplyScalar(d).setY(yTop - d));
    pts.push(U_DIR.clone().multiplyScalar(d).setY(TUBE_SHEET_Y));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1);
    const mat = uTubeMat.clone();
    mat.emissive = new THREE.Color(0x000000);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.0085, 8), mat);
    tube.castShadow = true;
    sg.add(tube);
    uTubes.push({ mesh: tube, mat, curve });
  }
  const U_MID = uTubes[(U_COUNT - 1) >> 1].curve;

  // secondary-side boiling: bubbles rising OUTSIDE the tubes, in the shell
  const sgBubbles = [];
  for (let i = 0; i < 22; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xf3f7fb, transparent: true, opacity: 0, depthWrite: false });
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.008 + (i % 3) * 0.0026, 8, 6), mat);
    const a = (i / 22) * TAU * 3;
    b.userData.seed = i / 22;
    b.userData.x = Math.sin(a) * (0.04 + (i % 5) * 0.021);
    b.userData.z = Math.cos(a) * (0.04 + (i % 4) * 0.024);
    b.userData.fy = 2 + (i % 3);
    sg.add(b);
    sgBubbles.push(b);
  }

  // =========================================================================
  // PRESSURISER — the small vessel that pins the primary loop at 155 bar
  // =========================================================================
  const PZ_O = new THREE.Vector3(CONT_X + 0.74, GY + 0.4, 0.4);
  const PZ_R = 0.1;
  const pressuriser = new THREE.Group();
  pressuriser.position.copy(PZ_O);
  internals.add(pressuriser);
  const pzProfile = [
    ...headProfile(PZ_R, PZ_R, -1, 5),
    [PZ_R, 0.56],
    ...headProfile(PZ_R, 0.56, 1, 5),
  ];
  pressuriser.add(sectorLathe(pzProfile, vesselMat.clone(), 32));
  const pzLinerMat = new THREE.MeshStandardMaterial({
    color: 0x3a4046, // lighter than the big vessels' liner: at this diameter the
    roughness: 0.88, // dark preset fills the whole silhouette and reads as a slab
    metalness: 0.2,
    side: THREE.BackSide,
  });
  pressuriser.add(
    sectorLathe(
      pzProfile.map(([r, y]) => [Math.max(0.001, r - 0.012), y]),
      pzLinerMat,
      28,
      THREE.BackSide,
    ),
  );
  const pzStand = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.095, 0.24, 20), concreteDark);
  pzStand.position.set(PZ_O.x, GY + 0.12, PZ_O.z);
  internals.add(pzStand);
  // submerged electric heaters in the bottom head — these are what hold 345 degC
  const pzHeaters = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    const mat = materials.glow(0xff7a3c, 0.4);
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.09, 6), mat);
    h.position.set(Math.sin(a) * 0.05, 0.055, Math.cos(a) * 0.05);
    pressuriser.add(h);
    pzHeaters.push(mat);
  }

  // =========================================================================
  // REACTOR COOLANT PUMP — vertical motor over a volute casing
  // =========================================================================
  const RCP_O = new THREE.Vector3(CONT_X + 0.46, GY + 0.26, 0.12);
  const rcp = new THREE.Group();
  rcp.position.copy(RCP_O);
  internals.add(rcp);
  const volute = new THREE.Mesh(new THREE.SphereGeometry(0.1, 22, 16), materials.paintedMetal(0x4a545e));
  volute.scale.set(1, 0.72, 1);
  volute.position.y = 0.1;
  volute.castShadow = true;
  rcp.add(volute);
  const rcpMotor = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.3, 22), materials.paintedMetal(0x3d4a52));
  rcpMotor.position.y = 0.33;
  rcpMotor.castShadow = true;
  rcp.add(rcpMotor);
  const rcpFly = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.03, 24), materials.brushedSteel(0x9aa2ad));
  rcpFly.position.y = 0.5;
  rcp.add(rcpFly);
  const rcpCap = new THREE.Mesh(new THREE.SphereGeometry(0.062, 16, 10), materials.paintedMetal(0x565e69));
  rcpCap.scale.y = 0.6;
  rcpCap.position.y = 0.52;
  rcp.add(rcpCap);
  const rcpPedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.26, 20), concreteDark);
  rcpPedestal.position.set(RCP_O.x, GY + 0.13, RCP_O.z);
  internals.add(rcpPedestal);

  // =========================================================================
  // PRIMARY LOOP — closed, radioactive, and entirely inside the dome.
  //   P0 hot leg  P1 through the U-tubes  P2 cold leg via the pump  P3 in-vessel
  // =========================================================================
  const HOT_DIR = new THREE.Vector3(0.899, 0, -0.438); // RPV -> SG
  const COLD_DIR = new THREE.Vector3(0.999, 0, 0.035); // RPV -> pump, clear of the cutaway
  const hotNozzle = new THREE.Vector3(RPV_R * HOT_DIR.x, 0.7, RPV_R * HOT_DIR.z).add(RPV_O);
  const coldNozzle = new THREE.Vector3(RPV_R * COLD_DIR.x, 0.62, RPV_R * COLD_DIR.z).add(RPV_O);
  const sgInlet = U_DIR.clone().multiplyScalar(-0.16).setY(0.1).add(SG_O);
  const sgOutlet = U_DIR.clone().multiplyScalar(0.16).setY(0.1).add(SG_O);

  // nozzle stubs, so the legs visibly enter real openings rather than floating
  for (const [pos, dir, r] of [
    [hotNozzle, HOT_DIR, 0.05],
    [coldNozzle, COLD_DIR, 0.05],
    [sgInlet, U_DIR.clone().negate(), 0.05],
    [sgOutlet, U_DIR, 0.05],
  ]) {
    const stub = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.07, 16), vesselMat.clone());
    stub.position.copy(pos);
    stub.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    internals.add(stub);
  }

  const uMidPts = [];
  for (let i = 0; i <= 14; i++) uMidPts.push(U_MID.getPointAt(i / 14).clone().add(SG_O));

  const primarySegments = [
    // P0 · hot leg: 315 degC water out of the vessel, over to the generator
    [hotNozzle.toArray(), [-2.06, 0.9, -0.1], [-1.89, 0.8, -0.16], sgInlet.toArray()],
    // P1 · inlet plenum, up one leg of the U-tubes, over, down the other
    [
      sgInlet.toArray(),
      U_DIR.clone().multiplyScalar(-0.075).setY(0.07).add(SG_O).toArray(),
      ...uMidPts.map((p) => p.toArray()),
      U_DIR.clone().multiplyScalar(0.075).setY(0.07).add(SG_O).toArray(),
      sgOutlet.toArray(),
    ],
    // P2 · cold leg: 275 degC water through the coolant pump, back to the vessel
    [sgOutlet.toArray(), [-1.45, 0.6, -0.28], [-1.5, 0.52, -0.06], [-1.6, 0.52, 0.06],
      [-1.78, 0.54, 0.2], [-2.0, 0.58, 0.26], [-2.13, 0.8, 0.15], coldNozzle.toArray()],
    // P3 · in-vessel: down the downcomer, across the bottom head, up through the core
    [
      coldNozzle.toArray(),
      new THREE.Vector3(0.16, 0.5, -0.14).add(RPV_O).toArray(),
      new THREE.Vector3(-0.1, 0.3, -0.19).add(RPV_O).toArray(),
      new THREE.Vector3(-0.14, 0.12, -0.07).add(RPV_O).toArray(),
      new THREE.Vector3(0, 0.07, 0).add(RPV_O).toArray(),
      new THREE.Vector3(-0.042, 0.3, -0.042).add(RPV_O).toArray(),
      new THREE.Vector3(-0.042, 0.72, -0.042).add(RPV_O).toArray(),
      new THREE.Vector3(0.1, 0.82, 0).add(RPV_O).toArray(),
      hotNozzle.toArray(),
    ],
  ];
  const primary = chainPath(primarySegments);
  const pB = primary.bounds;

  // only the two legs get drawn pipework — P1 IS the U-tubes, P3 is in-vessel
  const hotLegPipe = new THREE.Mesh(new THREE.TubeGeometry(primary.curves[0], 50, 0.042, 14), pipeMat);
  const coldLegPipe = new THREE.Mesh(new THREE.TubeGeometry(primary.curves[2], 70, 0.042, 14), pipeMat.clone());
  hotLegPipe.castShadow = true;
  coldLegPipe.castShadow = true;
  internals.add(hotLegPipe, coldLegPipe);

  // surge line: pressuriser bottom down onto the hot leg — the one connection
  // that lets the pressuriser dictate the whole loop's pressure
  const surgeLine = tubeAlong(
    [
      [PZ_O.x, PZ_O.y + 0.02, PZ_O.z],
      [PZ_O.x - 0.16, PZ_O.y - 0.04, PZ_O.z - 0.2],
      [-1.92, 0.66, -0.22],
      [-2.02, 0.88, -0.12],
    ],
    0.018,
    pipeMat.clone(),
    { tubularSegments: 24 },
  );
  internals.add(surgeLine);

  const HOT_C = new THREE.Color(0xff9a4d);
  const COLD_C = new THREE.Color(0xd1673a);
  const tmpColor = new THREE.Color();
  function primaryColorAt(t, out) {
    t = ((t % 1) + 1) % 1;
    if (t < pB[0]) out.copy(HOT_C);
    else if (t < pB[1]) out.lerpColors(HOT_C, COLD_C, (t - pB[0]) / (pB[1] - pB[0]));
    else if (t < pB[2]) out.copy(COLD_C);
    else out.lerpColors(COLD_C, HOT_C, (t - pB[2]) / (1 - pB[2]));
    return out;
  }

  const UP = new THREE.Vector3(0, 1, 0);
  const tangent = new THREE.Vector3();
  const _pos = new THREE.Vector3();
  const _quat = new THREE.Quaternion();
  const PRIMARY_N = 41; // odd: an even packet count repeats at half a lap and
  // verify.mjs's motion gate (which samples 20% vs 70%) reports it static
  const primaryField = flowField(PRIMARY_N, 0.055, { opacity: 0.92 });
  internals.add(primaryField.mesh);

  // =========================================================================
  // TURBINE HALL — HP + two LP cylinders + generator, all on one shaft
  // =========================================================================
  const thMat = materials.paintedMetal(0xd7dadd);
  const thRoofMat = materials.paintedMetal(0x565e69);
  const thMid = (TH_X0 + TH_X1) / 2;
  const thFloor = beveledBox(TH_X1 - TH_X0 + 0.1, 0.12, 1.0, concreteDark, 0.02);
  thFloor.position.set(thMid, GY + 0.06, 0);
  thFloor.receiveShadow = true;
  const thBack = beveledBox(TH_X1 - TH_X0, TH_ROOF_Y - GY, 0.06, thMat, 0.02);
  thBack.position.set(thMid, (TH_ROOF_Y + GY) / 2, -0.47);
  const thRoof = beveledBox(TH_X1 - TH_X0 + 0.14, 0.1, 1.1, thRoofMat, 0.02);
  thRoof.position.set(thMid, TH_ROOF_Y, 0);
  group.add(thFloor, thBack, thRoof);

  const phCore = new THREE.Group();
  phCore.position.set(0, AXIS_Y, 0);
  group.add(phCore);
  const rotor = new THREE.Group();
  phCore.add(rotor);

  // Turbine casing sector — same trick as the vessels, opened toward the camera.
  // A solid casing seen from inside would be a curved mirror, so each one gets
  // a dark rough liner just inside it.
  function turbineCase(rA, rB, len, x) {
    const geo = new THREE.CylinderGeometry(rA, rB, len, 44, 1, true, GAP / 2, TAU - GAP);
    geo.rotateZ(-Math.PI / 2);
    const mat = casingMat.clone();
    mat.side = THREE.FrontSide;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.position.x = x;
    const lGeo = new THREE.CylinderGeometry(rA - 0.02, rB - 0.02, len - 0.01, 40, 1, true, GAP / 2, TAU - GAP);
    lGeo.rotateZ(-Math.PI / 2);
    const lMat = linerMat.clone();
    lMat.side = THREE.DoubleSide;
    const liner = new THREE.Mesh(lGeo, lMat);
    liner.position.x = x;
    phCore.add(mesh, liner);
    return mesh;
  }

  // HP cylinder. A PWR's steam arrives SATURATED at ~6.2 MPa — far lower
  // pressure than a coal plant's ~16 MPa, so even the HP annulus is generous.
  const hpCase = turbineCase(0.28, 0.28, 0.44, -0.1);
  [-0.2, -0.02].forEach((x) => {
    const stage = bladeRing(
      { blades: 26, hubR: 0.13, span: 0.12, chord: 0.055, camber: 0.06, twist: 0.8, twistTip: 0.35, hubDepth: 0.06 },
      bladeMat,
    );
    stage.group.rotation.y = Math.PI / 2;
    stage.group.position.x = x;
    rotor.add(stage.group);
  });

  // two LP cylinders — blades lengthen toward each exhaust as the steam's
  // specific volume balloons on the way down to condenser vacuum
  const lpCase1 = turbineCase(0.46, 0.46, 0.56, 0.55);
  const lpCase2 = turbineCase(0.46, 0.46, 0.56, 1.22);
  [0.34, 0.55, 0.76, 1.01, 1.22, 1.43].forEach((x, i) => {
    const grow = i % 3;
    const hubR = 0.15;
    const stage = bladeRing(
      { blades: 20, hubR, span: 0.2 + grow * 0.07, chord: 0.085, camber: 0.09, twist: 0.9, twistTip: 0.35, hubDepth: 0.08 },
      bladeMat,
    );
    stage.group.rotation.y = Math.PI / 2;
    stage.group.position.x = x;
    rotor.add(stage.group);
  });

  const shaftMat = materials.brushedSteel(0x8b929c);
  shaftMat.roughness = 0.6;
  const shaft = rod(0.045, 2.72, shaftMat);
  shaft.rotation.z = Math.PI / 2;
  shaft.position.x = -0.42;
  rotor.add(shaft);

  // =========================================================================
  // GENERATOR — spinning magnetic poles inside fixed stator windings
  // =========================================================================
  const GEN_X = 1.9;
  const GEN_R = 0.38;
  const GEN_LEN = 0.62;
  turbineCase(GEN_R, GEN_R, GEN_LEN, GEN_X);
  const genCap = new THREE.Mesh(
    new THREE.CylinderGeometry(GEN_R + 0.02, GEN_R + 0.02, 0.05, 44).rotateZ(Math.PI / 2),
    materials.paintedMetal(0x565e69),
  );
  genCap.position.x = GEN_X + GEN_LEN / 2;
  phCore.add(genCap);

  const statorCoils = [];
  for (let i = 0; i < 6; i++) {
    const theta = (i / 6) * TAU;
    const wound = coil(
      { turns: 5, radius: 0.065, length: GEN_LEN * 0.7, wireRadius: 0.013, segmentsPerTurn: 16 },
      materials.brushedSteel(wireColor),
    );
    wound.mesh.rotation.z = Math.PI / 2;
    wound.mesh.position.set(GEN_X, Math.cos(theta) * (GEN_R - 0.085), Math.sin(theta) * (GEN_R - 0.085));
    phCore.add(wound.mesh);
    const dotMat = materials.glow(POS_COLOR, 0);
    dotMat.transparent = true;
    dotMat.opacity = 0;
    dotMat.depthWrite = false;
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), dotMat);
    dot.position.copy(wound.mesh.position);
    phCore.add(dot);
    statorCoils.push({ theta, dot });
  }

  const rotorCoreMat = materials.brushedSteel(0x9aa2ad);
  rotorCoreMat.roughness = 0.7; // viewed near end-on from some steps; the default reads near-mirror
  const rotorCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.17, GEN_LEN * 0.75, 28).rotateZ(Math.PI / 2),
    rotorCoreMat,
  );
  rotorCore.position.x = GEN_X;
  rotor.add(rotorCore);
  const poleN = beveledBox(GEN_LEN * 0.65, 0.1, 0.15, materials.paintedMetal(HOT_N), 0.015);
  poleN.position.set(GEN_X, 0.21, 0);
  const poleS = beveledBox(GEN_LEN * 0.65, 0.1, 0.15, materials.paintedMetal(COOL_S), 0.015);
  poleS.position.set(GEN_X, -0.21, 0);
  rotor.add(poleN, poleS);

  // =========================================================================
  // CONDENSER + FEED PUMP — the secondary loop's cold end
  // =========================================================================
  const CONDENSER = new THREE.Vector3(0.88, 0.4, 0);
  const condenserGroup = new THREE.Group();
  condenserGroup.position.copy(CONDENSER);
  group.add(condenserGroup);
  const condShell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.24, 0.9, 30).rotateZ(Math.PI / 2),
    materials.paintedMetal(0x3d434b),
  );
  condShell.castShadow = true;
  condenserGroup.add(condShell);
  const tubeEndMat = materials.brushedSteel(0xaab3bf);
  tubeEndMat.roughness = 0.65;
  {
    // the cutaway tube sheet: one instanced disc, not ~45 meshes each carrying
    // its own freshly-allocated CircleGeometry
    const seats = [];
    for (let ty = -0.15; ty <= 0.15; ty += 0.042) {
      for (let tz = -0.15; tz <= 0.15; tz += 0.042) {
        if (ty * ty + tz * tz > 0.15 * 0.15) continue;
        seats.push([ty, tz]);
      }
    }
    const tubeEnds = new THREE.InstancedMesh(
      new THREE.CircleGeometry(0.011, 8).rotateY(Math.PI / 2),
      tubeEndMat,
      seats.length,
    );
    const m = new THREE.Matrix4();
    seats.forEach(([ty, tz], n) => tubeEnds.setMatrixAt(n, m.makeTranslation(0.451, ty, tz)));
    tubeEnds.instanceMatrix.needsUpdate = true;
    condenserGroup.add(tubeEnds);
  }
  for (const fx of [-0.3, 0.3]) {
    const foot = beveledBox(0.08, 0.24, 0.2, concreteDark, 0.01);
    foot.position.set(fx, -0.36, 0);
    condenserGroup.add(foot);
  }

  const feedPump = new THREE.Group();
  feedPump.position.set(0.1, 0.3, -0.22);
  group.add(feedPump);
  const fpBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 0.16, 18).rotateZ(Math.PI / 2),
    materials.paintedMetal(0x445560),
  );
  feedPump.add(fpBody);
  const fpMotor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 0.14, 16).rotateZ(Math.PI / 2),
    materials.darkMetal(0x2b3037),
  );
  fpMotor.position.x = 0.16;
  feedPump.add(fpMotor);

  // =========================================================================
  // SECONDARY LOOP — clean steam. Never touches the fuel, never goes back in.
  // =========================================================================
  const sgSteamOut = new THREE.Vector3(SG_O.x, SG_O.y + 1.36, SG_O.z);
  const sgFeedIn = new THREE.Vector3(
    SG_O.x + SG_R_UP * Math.sin(2.1),
    SG_O.y + 1.0,
    SG_O.z + SG_R_UP * Math.cos(2.1),
  );
  const hpIn = [-0.34, 1.23, 0.02];
  const hpOut = [0.14, 1.2, 0];
  const lp1In = [0.25, 1.23, 0.02];
  const lp1Out = [0.85, 1.2, 0];
  const lp2In = [0.92, 1.23, 0.02];
  const lp2Out = [1.52, 1.2, 0];
  const condIn = [1.2, 0.62, 0.02];
  const condOut = [0.48, 0.3, -0.14];

  const secondarySegments = [
    // S0 · main steam line: out of the drum, THROUGH the containment wall
    // routed up and over rather than straight across: on the shallower line it
    // passed between the steam-generator step's camera and its own subject
    [sgSteamOut.toArray(), [-1.52, 2.18, -0.28], [-1.2, 2.16, -0.22], [-0.92, 2.05, -0.14], [-0.6, 1.6, -0.04], hpIn],
    [hpIn, hpOut], // S1 · through the HP cylinder
    [hpOut, [0.2, 1.31, 0.06], lp1In], // S2 · crossover
    [lp1In, lp1Out], // S3 · through LP1
    [lp1Out, [0.89, 1.3, 0.05], lp2In], // S4 · crossunder
    [lp2In, lp2Out], // S5 · through LP2
    [lp2Out, [1.56, 0.95, 0.02], [1.38, 0.72, 0.02], condIn], // S6 · exhaust to the condenser
    // S7 · condensate: feed pump, back through the wall, into the generator again
    [condOut, [0.3, 0.28, -0.2], [0.1, 0.3, -0.22], [-0.3, 0.36, -0.3], [-0.9, 0.6, -0.36],
      [-1.2, 0.92, -0.4], [-1.38, 1.32, -0.42], sgFeedIn.toArray()],
  ];
  const secondary = chainPath(secondarySegments);
  const sB = secondary.bounds;
  const secondaryRadii = [0.055, null, 0.075, null, 0.075, null, 0.095, 0.038];
  secondary.curves.forEach((curve, i) => {
    if (secondaryRadii[i] == null) return;
    const mat = i === 6 ? pipeMatBig : pipeMat.clone();
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 70, secondaryRadii[i], 14), mat);
    tube.castShadow = true;
    group.add(tube);
  });

  const STEAM_C = new THREE.Color(0xf6ecdd);
  const WATER_C = new THREE.Color(0x3f8fc4);
  function secondaryColorAt(t, out) {
    t = ((t % 1) + 1) % 1;
    if (t < sB[6]) out.copy(STEAM_C);
    else {
      // condensation happens inside the condenser, at the head of the last leg
      const u = (t - sB[6]) / (sB[7] - sB[6]);
      out.lerpColors(STEAM_C, WATER_C, Math.min(1, u / 0.22));
    }
    return out;
  }

  const SECONDARY_N = 45;
  const secondaryField = flowField(SECONDARY_N, 0.07, { opacity: 0.9 });
  group.add(secondaryField.mesh);

  // =========================================================================
  // COOLING-WATER LOOP — a THIRD, open circuit, condenser <-> cooling tower
  // =========================================================================
  const coolSegments = [
    [[1.3, 0.36, -0.18], [1.95, 0.4, -0.2], [2.35, 0.3, -0.14], [CT_X - 0.55, 0.28, -0.1]],
    [[CT_X - 0.55, 0.26, 0.14], [2.35, 0.28, 0.2], [1.95, 0.3, 0.22], [1.3, 0.28, 0.18]],
  ];
  const coolChain = chainPath(coolSegments);
  const coolPipeMat = materials.aluminum(0x8fa4ae);
  coolPipeMat.roughness = 0.7;
  coolChain.curves.forEach((curve) => {
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.03, 12), coolPipeMat);
    tube.castShadow = true;
    group.add(tube);
  });
  const coolDots = [];
  const WARM_C = new THREE.Color(0x5fb0d8);
  const COLD_W = new THREE.Color(0x3f8fc4);
  for (let i = 0; i < 14; i++) {
    const m = materials.glow(0x5fb0d8, 1.1);
    m.transparent = true;
    m.opacity = 0;
    m.depthWrite = false;
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), m);
    d.userData.seed = i / 14;
    coolDots.push(d);
    group.add(d);
  }

  // =========================================================================
  // COOLING TOWER — hyperboloid shell + vapour plume (water, not smoke)
  // =========================================================================
  // The shell starts at 0.3, not 0: a natural-draft tower stands clear of the
  // ground on a ring of raking columns, and that air gap under the shell is the
  // most recognisable thing about the silhouette.
  const CT_LIFT = 0.3;
  const towerProfile = [
    [0.663, CT_LIFT], [0.493, 0.808], [0.391, 1.275], [0.357, 1.573],
    [0.374, 1.785], [0.468, 2.168], [0.595, 2.508], [0.697, 2.72],
  ];
  const towerMat = castConcrete(0xa8adb3, 3, 1);
  const towerMesh = new THREE.Mesh(
    new THREE.LatheGeometry(towerProfile.map(([r, y]) => new THREE.Vector2(r, y)), 48),
    towerMat,
  );
  towerMesh.castShadow = true;
  towerMesh.receiveShadow = true;
  towerMesh.position.set(CT_X, GY, 0);
  group.add(towerMesh);
  const towerLiner = new THREE.Mesh(
    new THREE.LatheGeometry(towerProfile.map(([r, y]) => new THREE.Vector2(r - 0.03, y)), 48),
    new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.95, side: THREE.BackSide }),
  );
  towerLiner.position.copy(towerMesh.position);
  group.add(towerLiner);

  // raking inlet columns, alternately tilted so the ring reads as the real
  // V-lattice rather than a picket fence — one InstancedMesh for all of them
  {
    const N_COL = 26;
    const colGeo = new THREE.CylinderGeometry(0.022, 0.026, 1, 7).translate(0, 0.5, 0);
    const cols = new THREE.InstancedMesh(colGeo, concreteDark, N_COL);
    cols.castShadow = true;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    const from = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const YUP = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < N_COL; i++) {
      const a0 = (i / N_COL) * TAU;
      const lean = (i % 2 ? 1 : -1) * 0.13; // tangential rake, alternating
      from.set(Math.sin(a0) * 0.79, GY, Math.cos(a0) * 0.79);
      const a1 = a0 + lean;
      dir.set(Math.sin(a1) * 0.663, GY + CT_LIFT, Math.cos(a1) * 0.663).sub(from);
      const len = dir.length();
      q.setFromUnitVectors(YUP, dir.divideScalar(len));
      m.compose(from.clone().add(new THREE.Vector3(CT_X, 0, 0)), q, sc.set(1, len, 1));
      cols.setMatrixAt(i, m);
    }
    cols.instanceMatrix.needsUpdate = true;
    group.add(cols);
    // rims on both open lathe edges — a zero-thickness cut edge is the loudest
    // "this is a surface, not a structure" tell at the top of the frame
    const rimMat = concrete;
    const topRim = new THREE.Mesh(new THREE.TorusGeometry(0.697, 0.017, 8, 56), rimMat);
    topRim.rotation.x = Math.PI / 2;
    topRim.position.set(CT_X, GY + 2.72, 0);
    const baseRim = new THREE.Mesh(new THREE.TorusGeometry(0.663, 0.019, 8, 56), rimMat);
    baseRim.rotation.x = Math.PI / 2;
    baseRim.position.set(CT_X, GY + CT_LIFT, 0);
    group.add(topRim, baseRim);
  }

  const vaporPlume = buildPlume(VAPOR_WHITE, 0.24, 18, 1.5);
  vaporPlume.group.position.set(CT_X, GY + 2.72, 0);
  group.add(vaporPlume.group);

  // =========================================================================
  // STEP-UP TRANSFORMER + TRANSMISSION LINES
  // =========================================================================
  const xfmr = new THREE.Group();
  xfmr.position.set(2.05, GY, 0.92);
  group.add(xfmr);
  const tank = beveledBox(0.34, 0.3, 0.26, materials.paintedMetal(0x3d434b), 0.02);
  tank.position.y = 0.15;
  tank.castShadow = true;
  xfmr.add(tank);
  for (let i = -3; i <= 3; i++) {
    const fin = box(0.02, 0.24, 0.03, materials.aluminum(0x9aa2ad));
    fin.position.set(0.19, 0.15, i * 0.035);
    xfmr.add(fin);
  }
  const bushings = [];
  for (const bx of [-0.09, 0.09]) {
    const bushing = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.2, 14), materials.chrome(0xdce6ee));
    bushing.position.set(bx, 0.4, -0.04);
    xfmr.add(bushing);
    bushings.push(bushing);
  }
  const postMat = materials.darkMetal(0x2b3037);
  const postA = rod(0.02, 0.55, postMat);
  postA.position.set(2.62, GY, 1.08);
  const postB = rod(0.02, 0.55, postMat.clone());
  postB.position.set(2.62, GY, 0.82);
  group.add(postA, postB);

  const wireMat = materials.darkMetal(0x1c1e22);
  const wireIn = tubeAlong(
    [
      [GEN_X + 0.24, AXIS_Y - 0.3, 0.3],
      [2.0, 0.85, 0.62],
      [xfmr.position.x + bushings[0].position.x, GY + 0.52, xfmr.position.z - 0.04],
    ],
    0.012,
    wireMat.clone(),
    { tubularSegments: 24 },
  );
  group.add(wireIn);
  const wireOut = tubeAlong(
    [
      [xfmr.position.x + bushings[1].position.x, GY + 0.52, xfmr.position.z - 0.04],
      [2.4, GY + 0.62, 0.99],
      [postA.position.x, GY + 0.54, postA.position.z],
    ],
    0.012,
    wireMat.clone(),
    { tubularSegments: 16 },
  );
  group.add(wireOut);
  const gridLineMat = new THREE.MeshBasicMaterial({ color: 0x8fc4ff, transparent: true, opacity: 0, depthWrite: false });
  const gridLines = new THREE.Group();
  for (const p0 of [postA, postB]) {
    const line = tubeAlong(
      [
        [p0.position.x, GY + 0.52, p0.position.z],
        [p0.position.x + 0.5, GY + 0.34, p0.position.z + 0.12],
        [4.0, GY - 0.05, p0.position.z + 0.32],
      ],
      0.008,
      gridLineMat.clone(),
      { tubularSegments: 20 },
    );
    gridLines.add(line);
  }
  group.add(gridLines);
  const gridDots = [];
  const gridDotCurve = wireOut.userData.curve;
  for (let i = 0; i < 6; i++) {
    const m = materials.glow(0x8fc4ff, 1.4);
    m.transparent = true;
    m.opacity = 0;
    m.depthWrite = false;
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), m);
    d.userData.seed = i / 6;
    gridDots.push(d);
    group.add(d);
  }

  // =========================================================================
  // CALLOUTS — grouped per step, anchored ON the part they name
  // =========================================================================
  const tag = (set, parent, text, pos, dir, len = 70) => labels.add(set, parent, text, pos, dir, len);

  // anchored on the dome's camera-side surface with the leader thrown RIGHT:
  // the natural top-centre spot projects onto the text panel's edge
  tag('anatomy', contShell, 'Containment building', [0.647, 2.3, 0.647], 52, 62);
  tag('anatomy', thRoof, 'Turbine hall', [0.2, 0.08, 0.3], 72, 56);
  tag('anatomy', towerMesh, 'Cooling tower', [0, 2.0, 0.3], 62, 58);
  tag('anatomy', tank, 'Step-up transformer', [0, 0.2, 0.1], 24, 86);

  tag('inside', rpv, 'Reactor pressure vessel', [0.1, 0.62, 0.16], 22, 96);
  tag('inside', sg, 'Steam generator', [0.1, 1.0, 0.14], 58, 78);
  tag('inside', pressuriser, 'Pressuriser', [0.05, 0.5, 0.07], 28, 76);
  tag('inside', rcp, 'Reactor coolant pump', [0.03, 0.36, 0.055], -34, 92);

  // parented to the EVENT, not to the transient meshes: the nucleus, fragments
  // and neutrons each exist for only part of the cycle, and a callout riding a
  // mesh that blinks out blinks with it. Fixed offsets point at where each
  // thing happens instead.
  tag('fission', fissionGroup, 'U-235 nucleus', [0, 0.026, 0], 80, 70);
  tag('fission', fissionGroup, 'A slow neutron arrives', [0.034, 0.042, 0.025], 30, 96);
  tag('fission', fissionGroup, 'Two fragments — 200 MeV of heat', [0.037, 0.015, 0.03], -34, 96);
  tag('fission', fissionGroup, '2 to 3 new neutrons', [0.096, 0.088, 0.052], 46, 84);

  tag('fuel', rpv, 'Fuel rods — UO2 pellets in zircaloy', [0.06, 0.7, 0.12], 26, 120);
  tag('fuel', rpv, 'Water: coolant AND neutron moderator', [0.17, 0.34, 0.13], -34, 120);

  tag('rods', rodsGroup, 'Boron control rods', [0.115, 0.82, 0.115], 40, 92);
  // short pill, anchored low on the housings: the long one rode off the top of
  // frame as soon as the declutter pass stopped clamping it
  tag('rods', rpv, 'Drive mechanisms', [0.02, 1.15, 0.1], 74, 100);

  tag('primary', hotLegPipe, 'Hot leg — 315 °C, 155 bar', [-2.1, 0.99, 0.0], 46, 110);
  tag('primary', pressuriser, 'Pressuriser holds the pressure', [0.05, 0.42, 0.07], 30, 104);

  tag('steamgen', sg, 'Thousands of U-tubes', [0.06, 0.5, 0.12], 26, 92);
  tag('steamgen', sg, 'Steam out — never touched the fuel', [0.02, 1.3, 0.06], 66, 104);

  // on the FIRST LP cylinder, not the HP one — from this step's camera the HP
  // casing sits behind the text panel
  tag('power', lpCase1, 'Turbine', [0, 0.16, 0.3], 70, 58);
  // parented to the STATIONARY casing group, not to rotorCore: a callout on the
  // rotor orbits with the shaft, so its anchor swung behind the casing for most
  // of every turn and the occlusion pass dimmed it out
  tag('power', phCore, 'Generator', [GEN_X, 0.4, 0.08], 58, 62);
  tag('power', condenserGroup, 'Condenser', [0.1, 0.2, 0.18], -40, 70);
  tag('power', tank, 'To the grid', [0, 0.22, 0.1], 26, 70);

  // =========================================================================
  // POSE — one state object, one apply(). Every step pins ALL of these.
  // =========================================================================
  const state = { flow: 0, spin: 0, fission: 0, rods: 0, reveal: 0, gridOn: 0 };
  const tmpVec = new THREE.Vector3();

  function apply() {
    // ---- containment: sealed vs ghosted ------------------------------------
    const rv = state.reveal;
    // three caches a material's shader program on `transparent`, so flipping it
    // without needsUpdate leaves the dome fully opaque and the whole reveal
    // silently does nothing (the internals just hide behind it)
    const wantTransparent = rv > 0.01;
    if (shellMat.transparent !== wantTransparent) {
      shellMat.transparent = wantTransparent;
      shellMat.needsUpdate = true;
    }
    shellMat.opacity = 1 - rv * 0.9;
    shellMat.depthWrite = rv < 0.5;
    contShell.castShadow = rv < 0.5;
    contLiner.visible = rv < 0.5;
    internals.visible = rv > 0.5;

    // ---- control rods + the heat they take out of the core ------------------
    rodsGroup.position.y = (1 - state.rods) * RODS_TRAVEL;
    const heat = 1 - state.rods * 0.82;
    fuelMat.emissive.setRGB(0.85 * heat, 0.2 * heat, 0.04 * heat);
    fuelMat.emissiveIntensity = 0.55 * heat;
    for (const { mat } of uTubes) {
      mat.emissive.setRGB(0.5 * heat, 0.12 * heat, 0.02 * heat);
      mat.emissiveIntensity = 0.3 * heat;
    }
    for (const m of pzHeaters) m.emissiveIntensity = 0.5 + 0.3 * Math.sin(state.flow * TAU * 4);

    // ---- one fission event, twice per lap ----------------------------------
    // Phases: neutron flies in -> flash -> fragments and neutrons scatter ->
    // everything fades and the nucleus returns, so the wrap pose is identical.
    const fu = state.fission % 1;
    const live = state.reveal > 0.5 && heat > 0.25;
    const APPROACH = 0.42;
    const SPLIT = 0.46;
    incoming.visible = live && fu < SPLIT;
    if (incoming.visible) {
      const k = Math.min(1, fu / APPROACH);
      incoming.position.copy(INCOMING_FROM).multiplyScalar(1 - k);
      incomingMat.opacity = Math.min(1, fu / 0.06) * (fu < APPROACH ? 1 : 0);
    }
    nucleus.visible = live && (fu < SPLIT || fu > 0.9);
    if (nucleus.visible) {
      const back = fu > 0.9 ? (fu - 0.9) / 0.1 : 1;
      nucleusMat.opacity = fu < SPLIT ? 1 : back;
      const wobble = fu < SPLIT ? 1 + 0.12 * smooth(fu / SPLIT) * Math.sin(fu * 46) : 1;
      nucleus.scale.setScalar(wobble * (fu > 0.9 ? back : 1));
    }
    const burst = fu >= SPLIT ? (fu - SPLIT) / (1 - SPLIT) : 0;
    flashMat.opacity = live && fu >= SPLIT && fu < SPLIT + 0.1 ? 1 - (fu - SPLIT) / 0.1 : 0;
    flash.scale.setScalar(1 + burst * 2.2);
    for (const frag of fragments) {
      frag.visible = live && burst > 0;
      if (!frag.visible) continue;
      frag.position.copy(frag.userData.dir).multiplyScalar(burst * 0.085);
      frag.material.opacity = Math.min(1, burst * 8) * (1 - smooth(Math.max(0, (burst - 0.45) / 0.55)));
    }
    for (const n of bornNeutrons) {
      n.visible = live && burst > 0;
      if (!n.visible) continue;
      n.position.copy(n.userData.dir).multiplyScalar(burst * 0.32);
      n.material.opacity = Math.min(1, burst * 8) * (1 - smooth(Math.max(0, (burst - 0.4) / 0.6)));
    }

    // ---- ambient neutron rain through the core -----------------------------
    for (const d of neutronRain) {
      const u = d.userData;
      d.visible = live;
      if (!d.visible) continue;
      const ph = state.flow;
      d.position.set(
        Math.sin(TAU * (u.fx * ph + u.seed)) * 0.125,
        CORE_Y0 + 0.05 + (0.5 + 0.5 * Math.sin(TAU * (u.fy * ph + u.seed * 2.3))) * (CORE_Y1 - CORE_Y0 - 0.1),
        Math.cos(TAU * (u.fz * ph + u.seed * 1.7)) * 0.125,
      );
      d.material.opacity = 0.5 * heat * (0.55 + 0.45 * Math.sin(TAU * (2 * ph + u.seed * 3.1)));
    }

    // ---- primary loop packets ----------------------------------------------
    for (let i = 0; i < PRIMARY_N; i++) {
      const t = (i / PRIMARY_N + state.flow) % 1;
      _pos.copy(primary.getPointAt(t));
      tangent.copy(primary.getTangentAt(t));
      _quat.setFromUnitVectors(UP, tangent);
      primaryField.set(i, _pos, _quat, 1, primaryColorAt(t, tmpColor));
    }
    primaryField.commit();

    // ---- secondary loop packets --------------------------------------------
    for (let i = 0; i < SECONDARY_N; i++) {
      const t = (i / SECONDARY_N + state.flow) % 1;
      _pos.copy(secondary.getPointAt(t));
      tangent.copy(secondary.getTangentAt(t));
      _quat.setFromUnitVectors(UP, tangent);
      // the steam swells as it expands through the LP end, then collapses
      const sc = t > sB[2] && t < sB[6] ? 1.15 : 0.88;
      secondaryField.set(i, _pos, _quat, sc, secondaryColorAt(t, tmpColor));
    }
    secondaryField.commit();

    // ---- secondary-side boiling in the steam generator ---------------------
    for (const b of sgBubbles) {
      const u = b.userData;
      b.visible = state.reveal > 0.5;
      if (!b.visible) continue;
      const p = (u.seed + state.flow * u.fy) % 1;
      b.position.set(u.x, 0.2 + p * 1.0, u.z);
      b.material.opacity = 0.55 * Math.sin(Math.PI * p) * heat;
      b.scale.setScalar(0.7 + p * 1.1);
    }

    // ---- shaft, and the current it induces ---------------------------------
    rotor.rotation.x = -state.spin;
    for (const { theta, dot } of statorCoils) {
      const rel = Math.cos(theta - state.spin);
      const mag = Math.abs(rel);
      const col = rel >= 0 ? POS_COLOR : NEG_COLOR;
      dot.material.color.set(col);
      dot.material.emissive.set(col);
      dot.material.emissiveIntensity = 0.6 + mag * 1.6;
      dot.material.opacity = 0.25 + mag * 0.7;
    }

    // ---- cooling water + the tower's plume ---------------------------------
    for (const d of coolDots) {
      const t = (d.userData.seed + state.flow) % 1;
      d.position.copy(coolChain.getPointAt(t));
      tmpColor.lerpColors(WARM_C, COLD_W, t < 0.5 ? t * 0.6 : 1 - (t - 0.5) * 0.6);
      d.material.color.copy(tmpColor);
      d.material.emissive.copy(tmpColor);
      d.material.opacity = 0.85;
    }
    vaporPlume.meshes.forEach((m, i) => {
      m.material.opacity = m.userData.baseOpacity;
      m.position.x = m.userData.jitter + Math.sin(state.flow * TAU * 2 + i * 1.3) * (0.04 + i * 0.01);
    });

    // ---- grid --------------------------------------------------------------
    gridLineMat.opacity = state.gridOn * 0.7;
    for (const d of gridDots) {
      const t = (d.userData.seed + state.flow * 2) % 1;
      d.position.copy(gridDotCurve.getPointAt(t)).add(wireOut.position);
      d.material.opacity = state.gridOn * Math.min(1, t * 6) * Math.min(1, (1 - t) * 6);
    }
  }
  apply();

  return {
    group,
    parts: { rpv, sg, rotor, rodsGroup, fissionGroup, internals, contShell, pressuriser, rcp },
    set(partial) {
      Object.assign(state, partial);
      apply();
    },
    setLabels: labels.setLabels,
  };
}
