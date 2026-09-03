import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildTransmission } from './model.js';

// Zoom-in / reveal story: the sealed box first, then the case lifts and we walk
// the power path — the converter's ring of oil, the lock-up clutch that ends
// its slip, the one planetary trick the whole box is built from, how oil
// actually holds a gear still, the hydraulics that decide, then the ratio set
// laid out one at a time and finally the whole thing driven up through the
// gears.
//
// Seamlessness: every loop states its INPUT turns per lap and those counts are
// checked against the mode table in model.js's header (1st needs a multiple of
// 5, 2nd a multiple of 9, neutral a multiple of 3, 3rd and reverse any whole
// number; the converter needs turbine turns x 20 and impeller turns x 24 to be
// whole, which is why every impeller runs a whole+half turns per lap).

// Pin the FULL layer/label state on entering a step, so scrolling either way
// always lands on exactly the same scene.
const view = ({ caseOn = false, shell = false, cut = false, conv = 0, labels = false }) =>
  ({ handles }) => {
    handles.setCase(caseOn);
    handles.setShell(shell);
    handles.setCut(cut);
    handles.setConvCut(conv);
    handles.setLabels(labels);
  };

// One driver, built once per step activation, stepped by one linear tween.
const loop = (pick, duration) => ({ tl, handles }) => {
  const drive = pick(handles);
  const s = { t: 0 }; // LOCAL state — never share tween targets across steps
  tl.add(s, { t: 1, duration, ease: 'linear', onUpdate: () => drive(s.t) });
};

const steps = [
  {
    id: 'complete',
    heading: 'The box with no clutch pedal',
    body: 'An engine only makes useful power over a narrow band of revs, and pulling away from rest takes far more twist than it can make on its own. A manual gearbox solves that with your left foot and your right hand. This one solves it with oil. There is no pedal and no lever anywhere inside it — just a doughnut of spinning fluid bolted to the engine, and behind it two gear sets that change ratio by clamping one part of themselves perfectly still. From out here you would never know any of it: one dull aluminium case, and a single yoke turning at the back.',
    hint: 'Drag to orbit · scroll to open it up.',
    camera: { position: [3.05, 2.5, 3.6], target: [-0.58, 1.26, 0.48] },
    focus: ['Output yoke'],
    onEnter: view({ caseOn: true, shell: true, labels: 'exterior' }),
    // 3rd gear cruising, lock-up applied: input == output == 8 turns.
    timeline: loop((h) => h.steady('3', 8, 0), 8000),
  },
  {
    id: 'inside',
    heading: 'Everything is a circle inside a circle',
    body: 'Lift the case away and there are no shafts sitting side by side. Every part shares one centreline, nested like a telescope: the input shaft up the middle, a clutch drum around it, a second drum around that. Behind them sit two planetary gear sets that share a single sun gear, and underneath sits the valve body — a slab of aluminium with a maze milled into it that decides which part gets clamped. Right now nothing is clamped at all, and you can see exactly what that buys: the engine spins the converter and both clutch drums, and stops there. Every gear behind them is standing perfectly still. That is neutral.',
    hint: 'Drag to orbit.',
    camera: { position: [2.75, 2.35, 3.25], target: [-0.38, 1.3, 0.4] },
    onEnter: view({ labels: 'internal' }),
    // true neutral: nothing is driven, so only the input side turns
    timeline: loop((h) => h.steady('N', 9), 7000),
  },
  {
    id: 'converter',
    heading: 'A doughnut of oil doing a clutch’s job',
    body: 'Take the front cover off the converter and there are three bladed wheels facing each other inside a ring of fluid. The impeller is welded to that cover and turns with the engine, slinging oil outward like a slow centrifuge. The oil crosses the gap, hits the turbine’s curved blades and shoves them round — that is the entire coupling, with no metal ever touching. Then the clever part: oil leaving the turbine is heading back the wrong way, so a small wheel between them, the stator, is locked by a one-way clutch and turns that flow around to help the impeller instead. From a standstill that redirected oil multiplies engine torque by up to two to one, which is why an automatic creeps forward on idle alone.',
    hint: 'The stator holds still while the oil fights it, then spins free.',
    camera: { position: [-2.45, 1.95, 2.45], target: [-1.5, 1.32, 0.18] },
    dofAperture: 0.00022,
    focus: ['Impeller — engine side', 'Turbine — gearbox side', 'Stator'],
    onEnter: view({ conv: 2, labels: 'converter' }),
    timeline: loop((h) => h.setConverter, 9000),
  },
  {
    id: 'lockup',
    heading: 'Then it stops slipping',
    body: 'Fluid drive always slips a little, and slip is heat and wasted fuel — a few percent of every turn, all day, at motorway speed. So once the two wheels are running at nearly the same rate, oil pressure pushes a clutch plate on the front of the turbine against the machined face of the cover. The turbine is now bolted solid to the engine and the last of the slip disappears. Watch the two speeds converge, the plate close, and the circulating oil go quiet: past that point there is nothing left for it to do.',
    camera: { position: [-2.3, 1.05, 1.9], target: [-1.83, 1.34, -0.11] },
    dofAperture: 0.00026,
    focus: ['Lock-up clutch'],
    onEnter: view({ conv: 1, labels: 'lockup' }),
    timeline: loop((h) => h.setLockup, 8000),
  },
  {
    id: 'planetary',
    heading: 'One gear set, three answers',
    body: 'A planetary set is three parts sharing one axis: a sun in the middle, a ring around the outside, and four planet gears on a carrier riding between them. Turn any one of the three, hold another, and the third comes out at a fixed ratio — and that single trick is the whole gearbox. Hold the sun still and the ring drives the carrier out at exactly 1.50 to 1. Drive the sun and the ring together and nothing inside can turn at all: the set locks solid and passes drive straight through, 1 to 1. Now stop the carrier, which is what a parked car does, and the sun is forced backwards at twice the ring’s speed. That backwards sun is not a fault. It is where first gear comes from.',
    hint: 'Sun held · both driven · carrier held by the car.',
    camera: { position: [1.15, 1.8, 1.1], target: [-0.12, 1.3, 0.2] },
    dofAperture: 0.0003,
    focus: ['Sun gear · 36 teeth', 'Planet carrier', 'Ring gear · 72 teeth'],
    onEnter: view({ labels: 'planet' }),
    // 2nd -> 3rd -> stalled Drive, 9 input turns (2nd needs /9, D0 needs /3)
    timeline: loop((h) => h.setPlanetDemo, 12000),
  },
  {
    id: 'clutches',
    heading: 'How oil holds a gear still',
    body: 'Cut a drum open and a clutch turns out to be a stack of thin discs, alternating: steel plates splined to one member, friction plates splined to another, all free to slide along the splines but never to twist. Feed oil behind the ring-shaped piston at the end of the drum and it squeezes the stack together with a few tonnes of clamp, and the two members become one part. A band does the opposite job from the outside: a steel strap wrapped round the drum, hauled tight by a small servo on the roof of the case until the drum simply stops turning. Clutches couple two things together, bands hold one thing still, and every gear in this box is one particular pair of them.',
    hint: 'Watch the pack close, then the strap bite.',
    camera: { position: [-0.35, 1.95, 1.75], target: [-0.92, 1.32, 0.14] },
    dofAperture: 0.00028,
    focus: ['Friction plates', 'Apply piston', 'Kickdown band'],
    onEnter: view({ cut: true, labels: 'clutch' }),
    // 2nd gear steady, 9 input turns
    timeline: loop((h) => h.setClutchDemo, 9000),
  },
  {
    id: 'hydraulics',
    heading: 'The brain is a maze in a lump of aluminium',
    body: 'None of it happens unless something makes pressure and decides where to send it. A gear pump on the nose of the case is driven straight off the converter hub, so oil is pumped the instant the engine turns — and never when it does not, which is exactly why you cannot push-start an automatic. It draws through a filter lying in the sump and feeds the valve body: passages milled into aluminium, with spring-loaded spool valves sliding inside them and electric solenoids nudging those spools. Road speed and throttle move the valves, and each one routes pressure to exactly one clutch piston or one band servo. The gear you are in is simply which passages currently have oil in them.',
    camera: { position: [-0.2, 1.05, 2.5], target: [-0.95, 0.95, 0.36] },
    focus: ['Oil pump', 'Valve body', 'Shift solenoids'],
    onEnter: view({ labels: 'hydraulic' }),
    // 1st gear steady, 10 input turns (1st needs a multiple of 5)
    timeline: loop((h) => h.setHydraulics, 8000),
  },
  {
    id: 'ratios',
    heading: 'Three ratios and a reverse, from one sun',
    body: 'Here is what holding different things actually buys, with the engine held at one steady speed so the only thing changing is what comes out the far end. Both gear sets share a single sun of 36 teeth, and both rings carry 72 — that one-to-two relationship is the only number the whole box is built from. Hold the rear carrier and the sun is dragged backwards, and the double reduction that follows is 2.50 to 1: first gear. Let the carrier go, clamp the sun with the band instead, and it eases to 1.50. Apply both clutches and the sets lock together for a straight-through 1 to 1. For reverse, drive the sun instead of the ring while the rear carrier is still held, and the output turns the other way at 72 over 36 — exactly 2 to 1, backwards.',
    hint: 'The engine never changes speed. Only the output does.',
    // near-broadside and raised, so the two gear sets read as a PAIR you can
    // compare left to right; the 3/4 vantage of the reveal steps foreshortens
    // them into one lump. Target left of the train's centre, which pushes the
    // whole set into the ~62% of frame the text panel does not cover.
    camera: { position: [0.55, 2.2, 2.6], target: [-0.4, 1.38, 0.18] },
    focus: ['Sun', 'Rear carrier', 'Output'],
    onEnter: view({ labels: 'ratios' }),
    // 1 -> 2 -> 3 -> R, 12 input turns; reverse is the last segment and its
    // factors land on any whole turn count
    timeline: loop((h) => h.setRatios, 18000),
  },
  {
    id: 'run',
    heading: 'Drive it',
    body: 'Put the whole thing together and pulling away is a sequence you can watch happen. The converter takes up the load as pure slip, multiplying torque while the car is barely moving. First gear does the heavy work through both sets at once. Then pressure lets go of one element and takes up another — a change lasts about a third of a second, and the only part that ever comes to a stop is whichever one is being held. Road speed climbs steadily the whole way; it is the engine that drops at every shift and climbs again. Three ratios, no pedal, no lever — just oil deciding, several times a minute, which part of the gear set gets to stand still.',
    hint: 'Drag to orbit. Watch the engine dip at every change while the output keeps rising.',
    camera: { position: [2.7, 2.35, 3.2], target: [0.06, 1.3, -0.12] },
    freeOrbit: true,
    onEnter: view({ labels: 'drive' }),
    // 1 -> 2 -> 3, 15 input turns; 3rd's factors are all 1 so any whole count
    // lands, and the tail brakes back to the opening speed for a clean wrap
    timeline: loop((h) => h.setRun, 13000),
  },
];

export default defineExplainer({
  ...meta,
  stageOptions: { dof: true },
  buildScene({ scene }) {
    return buildTransmission({ scene });
  },
  steps,
});
