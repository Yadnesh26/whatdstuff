import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildCrtTv } from './model.js';

// Reveal story: the sealed set with a picture on it -> ghost the cabinet and
// find that the television IS one glass bottle -> the three wires being boiled
// in its neck -> the 25 kV drop that throws the electrons -> the yoke that
// bends them into a raster -> the fact that the picture is one dot and your
// eye -> the steel sheet that sorts the colours -> the phosphor that makes
// them -> switch the whole thing on and watch it warm up.
//
// CAMERA RULE for this scene: the tube runs along Z with the screen at +Z and
// the gun at -Z, and the front-side cameras all sit in the -X/+Z quadrant, so
// world +X is screen-right and the electrons always travel away from the
// viewer, down the tube. Every target is offset about 0.3-0.6 units to the
// screen-LEFT of its subject, which parks the subject in the right two thirds
// and clear of the text panel.

// Pin ALL scene state on entering a step (pre-flight #4): reveal, beam mode,
// what the phosphor is doing, the presentation sway, the detail block, the
// patch marker and the labels — so scrolling in either direction lands on an
// identical frame.
const view =
  ({ reveal = 1, mode = 'scan', screen = 'bars', sway = 0, macro = 'off', patch = false, labels = false }) =>
  ({ handles }) => {
    handles.setReveal(reveal);
    handles.setMode(mode);
    handles.setScreen(screen);
    handles.setSwayAmp(sway);
    handles.setMacro(macro);
    handles.setPatch(patch);
    handles.setLabels(labels);
  };

function phaseLoop(duration) {
  return ({ tl, handles }) => {
    const s = { t: 0 }; // LOCAL state — never share tween targets across steps
    tl.add(s, { t: 1, duration, ease: 'linear', onUpdate: () => handles.setPhase(s.t) });
  };
}

export default defineExplainer({
  ...meta,
  stageOptions: { dof: true },

  buildScene({ scene }) {
    return buildCrtTv({ scene });
  },

  steps: [
    {
      id: 'complete',
      heading: 'Nothing on this screen is really there',
      body: 'There is no image inside a television like this. There is one dot of light, moving, and a piece of glass that stays lit for about a thousandth of a second after the dot has gone. Everything you think you can see — the whole picture, all of it at once — is assembled behind your eyes out of a dot that was somewhere else a moment ago. The rest of this cabinet is the machinery for aiming it.',
      hint: 'Drag to orbit · scroll to look inside. Note the depth: 460 mm of it, for a 400 mm picture.',
      camera: { position: [-3.45, 2.75, 4.6], target: [-0.48, 1.5, -0.27] },
      dofAperture: 0.00003,
      onEnter: view({ reveal: 0, mode: 'scan', screen: 'bars', sway: 10, labels: 'exterior' }),
      timeline: phaseLoop(7200),
    },
    {
      id: 'inside',
      heading: 'The television is the tube',
      body: 'Take the cabinet off and almost nothing is left. One glass bottle fills the entire box — a flat face, a funnel, a thin neck — pumped down until barely a ten-millionth of the air is left, because an electron has to cross the whole thing without hitting a single atom of it. Under it sits one circuit board. The tube is not a component in the television; the television is a stand for the tube, plus the electronics needed to keep it fed.',
      hint: 'The glass is thick and leaded on purpose: it is holding atmospheric pressure out, and soaking up stray X-rays.',
      camera: { position: [-4.25, 2.4, 0.2], target: [-0.02, 1.55, -0.47] },
      dofAperture: 0.00005,
      focus: ['Faceplate glass', 'Funnel', 'Neck', 'Deflection yoke'],
      onEnter: view({ reveal: 1, mode: 'scan', screen: 'bars', labels: 'inside' }),
      timeline: phaseLoop(6400),
    },
    {
      id: 'gun',
      heading: 'It starts by boiling three wires',
      body: 'In the neck are three tiny metal cups, each with a coated wire inside running at 800 to 1,000 °C. At that temperature electrons stop being held by the metal and simply evaporate off it, hanging in a cloud around the tip. The stack of apertured discs in front does two jobs: the first one is charged negative and meters how many electrons get past — that is the brightness of the picture — and the ones behind it squeeze the cloud into a pencil. Three cups, side by side, five and a half millimetres apart. One for red, one for green, one for blue.',
      camera: { position: [-0.85, 1.82, -1.05], target: [0.06, 1.53, -0.46] },
      dofAperture: 0.00045,
      focus: ['Cathode · 800 °C', 'Control grid G1', 'Focus electrodes'],
      onEnter: view({ reveal: 1, mode: 'gun', screen: 'off', labels: 'gun' }),
      timeline: phaseLoop(3400),
    },
    {
      id: 'anode',
      heading: 'Then drop them off a 25,000-volt cliff',
      body: 'The far end of the tube is held at twenty-five thousand volts positive, through a rubber-capped button on the side of the funnel. Nothing but empty space lies between, so the electrons arrive at about a third of the speed of light — around 90,000 kilometres a second. The graphite painted on the inside and outside of that funnel is not decoration: the two coatings and the glass between them make a capacitor, and it is what keeps 25 kV steady while the picture is being drawn. The voltage itself comes from the flyback transformer on the board, which harvests it from the collapsing current in the deflection coils, fifteen thousand times a second.',
      hint: 'The coloured dots are electrons — three streams, one per colour, all in the same vacuum.',
      camera: { position: [-2.7, 2.1, 1.35], target: [-0.47, 1.66, -0.06] },
      dofAperture: 0.00012,
      focus: ['Anode button · 25 kV', 'Aquadag coating', 'Flyback transformer'],
      onEnter: view({ reveal: 1, mode: 'stream', screen: 'off', labels: 'anode' }),
      timeline: phaseLoop(3000),
    },
    {
      id: 'yoke',
      heading: 'Magnets do all the drawing',
      body: 'Nothing physically moves in a television picture except a magnetic field. The collar clamped where the neck meets the funnel holds two sets of copper windings at right angles to each other. The pair on the flanks makes a vertical field, which pushes the beam sideways, and it is driven at 15,734 hertz — a full sweep across the screen and back every 63 microseconds. The windings on the ferrite ring make a horizontal field and pull the beam steadily down the screen, sixty times a second. Side to side fast, top to bottom slow: everything else is timing.',
      camera: { position: [-1.8, 2.05, 0.72], target: [-0.13, 1.56, -0.07] },
      dofAperture: 0.0002,
      focus: ['Horizontal coils', 'Vertical coils', 'Ferrite ring'],
      onEnter: view({ reveal: 1, mode: 'scan', screen: 'raster', labels: 'yoke' }),
      timeline: phaseLoop(4200),
    },
    {
      id: 'raster',
      heading: 'The picture is never on the screen',
      body: 'Watch what the phosphor is actually doing. The dot lays down one line, goes dark for the ten microseconds it takes to fly back to the left edge, and lays down the next one; by the time it reaches the bottom, the top has stopped glowing. It does not even draw the lines in order — it does every other line on the way down, flies back to the top, and fills in the gaps on the second pass, which is why an old TV shimmers when you photograph it. Five hundred and twenty-five lines, two passes, thirty complete pictures a second. At no instant does more than a sliver of the image exist.',
      hint: 'The trail is stretched out here so you can follow it. In life the glow is gone in about a millisecond.',
      camera: { position: [-2.1, 2.2, 3.9], target: [-0.4, 1.53, 0.75] },
      dofAperture: 0.00008,
      focus: ['One dot, moving', 'Blanked retrace', 'Odd lines, then even'],
      onEnter: view({ reveal: 1, mode: 'interlace', screen: 'raster', labels: 'scan' }),
      timeline: phaseLoop(5000),
    },
    {
      id: 'mask',
      heading: 'A steel sheet that throws most of it away',
      body: 'A beam of electrons has no colour, so something has to make sure the red beam only ever hits red phosphor. Thirteen millimetres behind the glass hangs a sheet of steel with about four hundred thousand holes punched in it. The three beams converge on each hole from three slightly different angles, and because they arrive tilted, they leave tilted — each one can only reach the stripe of phosphor lined up with its own approach. It works by geometry alone, and the price is savage. A typical mask is only about fifteen per cent open area, so the great majority of the electrons never reach the screen at all: they hit metal and become heat, which is most of the reason a big CRT runs warm and why so much of the power goes into making a picture you never see.',
      hint: 'Detail block: the ratios are honest, but the block is enormously oversized and the angles between the beams are opened up — in the real tube they converge at about one degree.',
      camera: { position: [1.25, 3.3, -0.95], target: [2.82, 2.5, 0.49] },
      dofAperture: 0.00022,
      focus: ['Shadow mask', 'Most of them hit metal', 'Real pitch: 0.6 mm'],
      onEnter: view({ reveal: 0, mode: 'off', screen: 'bars', macro: 'mask', patch: true, labels: 'mask' }),
      timeline: phaseLoop(3600),
    },
    {
      id: 'phosphor',
      heading: 'Three colours, and no others',
      body: 'Behind each hole sit three stripes of powdered phosphor, six tenths of a millimetre from one triad to the next — fine enough that from a sofa your eye cannot separate them and simply adds them together. There is no yellow phosphor and no white one anywhere in a colour television: yellow is red and green struck hard at the same instant, white is all three. Behind the stripes is a film of aluminium about a hundred nanometres thick, which electrons pass straight through but light does not, so every photon aimed at the back of the tube gets bounced forwards instead. Then it all goes out in about a millisecond, and the beam has to come back.',
      camera: { position: [1.45, 2.75, 2.75], target: [2.27, 2.5, 0.55] },
      dofAperture: 0.00025,
      focus: ['Red · green · blue', 'Aluminised backing', 'Gone in a millisecond'],
      onEnter: view({ reveal: 0, mode: 'off', screen: 'bars', macro: 'colour', patch: true, labels: 'phosphor' }),
      timeline: phaseLoop(4200),
    },
    {
      id: 'run',
      heading: 'Switch it on',
      body: 'The heaters take a few seconds to come up, so the picture arrives late, opening out of a bright line across the middle. Before that there is a low mechanical boing — a coil of wire around the front of the tube being hit with a burst of alternating current that dies away, wiping any magnetism out of the shadow mask so the colours land where they should. Then twenty-five kilovolts, three boiling wires and a magnetic field doing 15,734 sweeps a second, all so that a dot can be in the right place at the right time, thirty times over, every second, for twenty years.',
      hint: 'Drag to orbit while it runs.',
      camera: { position: [-3.75, 2.85, 4.45], target: [-0.42, 1.5, -0.26] },
      freeOrbit: true,
      onEnter: view({ reveal: 0, mode: 'scan', screen: 'warm', sway: 12 }),
      timeline: phaseLoop(5400),
    },
  ],
});
