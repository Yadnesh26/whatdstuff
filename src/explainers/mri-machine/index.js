import { defineExplainer } from '../../framework/index.js';
import { win } from '../../framework/motion.js';
import meta from './meta.js';
import { buildMriMachine } from './model.js';

// Reveal story: the sealed suite (gantry, table, phantom, console) -> swap the
// covers for a sectioned shell and look into the cryostat -> the windings -> the
// switch that closes the loop forever -> the layers that hold 4.2 K -> the
// protons in the phantom at isocentre -> the RF note that tips them -> the
// gradients that turn position into frequency -> resealed, table in, scanning.
//
// Seamless loops: setPhase is one 0-1 phase. The cold head's valve motor turns
// exactly once per lap, the protons precess 4 whole times, the bore light
// breathes on whole sine cycles, and the current dots are frac(phase*2 + i/n)
// so frame 0 == frame 1. Every discrete event — the field switching on, the RF
// pulse, the gradient fan, the table travel, the image building — is a PAIR of
// smoothstep windows that starts and ends at exactly the same value.
//
// CAMERA RULE for this scene: the bore axis is world X and the table runs off
// to -X, so the sealed steps (1 and 9) shoot from the FRONT quarter, down the
// axis, with the table leading in from screen-left and the bore mouth reading
// as an actual hole. The reveal steps swing round to +Z — the side everything
// is sectioned towards — sitting ~30 deg above the bore axis, on the bisector
// of the removed quarter, so the layer cake faces the lens. Steps 6-8 look
// straight through it: those three sit INSIDE the removed quarter, a pocket of
// open air a metre from the phantom, which is the only place in a 2 m machine
// where a 20 cm object can be the subject of the frame.
//
// Pin ALL scene state on entering a step (pre-flight #4): reveal, table travel,
// spins, field, RF, tip, gradients, current, the macro insert, the console and
// the labels — so scrolling in either direction lands on an identical frame.
const view =
  ({
    reveal = 0,
    table = 0,
    spins = false,
    field = 0,
    rf = 0,
    tip = 0,
    grad = 0,
    flow = false,
    image = 0,
    macro = false,
    labels = false,
  }) =>
  ({ handles }) => {
    handles.setReveal(reveal);
    handles.setTable(table);
    handles.setSpins(spins);
    handles.setField(field);
    handles.setRf(rf);
    handles.setTip(tip);
    handles.setGrad(grad);
    handles.setFlow(flow);
    handles.setImage(image);
    handles.setMacro(macro);
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
    return buildMriMachine({ scene });
  },

  steps: [
    {
      id: 'complete',
      heading: 'Nothing in here moves',
      body: 'The part of this machine that makes the picture has no moving parts at all. No tube, no shutter, no detector panel — just a hole, three and a half tonnes of magnet packed around it, and a table that slides you into the middle. The only thing actually in motion is the small cryocooler ticking away on top, and its entire job is to stop the machine warming up. Everything else is done with a magnetic field, one radio note, and arithmetic.',
      hint: 'Drag to orbit · scroll to look inside. The cylinder on the table is a test phantom — a sealed bottle of doped water, the object radiographers scan to check a machine is telling the truth.',
      camera: { position: [-3.15, 1.95, 3.35], target: [-0.75, 1.15, 0.05] },
      dofAperture: 0.00002,
      onEnter: view({ labels: 'exterior' }),
      timeline: phaseLoop(7200),
    },
    {
      id: 'inside',
      heading: 'Cut it open and it is a thermos',
      body: 'Take the covers off and there is no machinery to find. The whole gantry is a flask inside a flask inside a flask: a steel vacuum vessel, an aluminised shield hanging inside that, and inside that a second sealed vessel holding the coils. The six copper bands are the magnet — six separate winding sections rather than one long coil, spaced and sized so that what they add up to in the middle is uniform to a few parts in a million. That uniformity is the whole game: the field has to be the same everywhere you lie, or the picture is of nothing.',
      camera: { position: [1.85, 2.75, 3.0], target: [-0.35, 1.42, 0] },
      dofAperture: 0.00005,
      focus: ['Vacuum vessel', 'Aluminised shield', 'Helium vessel — 4.2 K', 'Six coil sections'],
      onEnter: view({ reveal: 1, labels: 'cryostat' }),
      timeline: phaseLoop(6000),
    },
    {
      id: 'coils',
      heading: 'Kilometres of wire, and no resistance',
      body: 'The windings are not copper doing the work. Inside the copper run thousands of filaments of niobium-titanium, each far thinner than a hair, and below about 9 kelvin that alloy stops resisting current — not "hardly any", none. The copper around them is a safety net: somewhere for the current to dump itself if any short length of wire ever warms up and comes out of superconductivity. Push five hundred amps into a loop built like this and there is nothing in it to slow the current down.',
      hint: 'The floating insert is one wire, cut across and blown up — copper outside, NbTi filaments inside. Drawn at 54 filaments you can count; a real wire packs thousands, each around 20 microns.',
      camera: { position: [1.15, 2.35, 2.05], target: [-0.2, 1.6, 0.2] },
      dofAperture: 0.00012,
      focus: ['NbTi in a copper stabiliser', 'One loop, no resistance'],
      onEnter: view({ reveal: 1, flow: true, macro: true, labels: 'coil' }),
      timeline: phaseLoop(4200),
    },
    {
      id: 'persistent',
      heading: 'The current has been going round for years',
      body: 'Getting the field in takes a day or two. A supply raises the current towards five hundred amps very slowly, because rushing it would knock the wire out of superconductivity and dump the lot as heat. Then comes the trick. A short length of the same superconductor bridges the two ends of the coil, held warm by a small heater so it behaves like an ordinary resistor while the ramp is happening. Switch the heater off and that bridge goes superconducting too — the circuit quietly closes on itself. The leads come off, the supply is wheeled away, and the current keeps going round with nothing driving it. These magnets lose about a tenth of a part per million an hour.',
      camera: { position: [0.72, 2.22, 1.25], target: [-0.05, 1.95, 0.36] },
      dofAperture: 0.00016,
      focus: ['Persistent current switch', 'Switch heater', 'Ramp leads — disconnected'],
      onEnter: view({ reveal: 1, flow: true, labels: 'switch' }),
      timeline: phaseLoop(4000),
    },
    {
      id: 'cold',
      heading: 'Holding 4.2 kelvin, indefinitely',
      body: 'None of that works unless the wire stays below about 9 kelvin, so the coils sit in liquid helium at 4.2 — roughly minus 269 °C, colder than anywhere in deep space that is not doing it on purpose. Heat arrives three ways and each is blocked separately: the vacuum kills conduction and convection, the aluminised shield in the middle intercepts radiation before it reaches the cold vessel, and the cryocooler on top recondenses whatever boils off anyway. A classic magnet holds around 1,500 litres of helium. The newest sealed ones manage on seven.',
      hint: 'The thick pipe is the quench line. If the magnet ever loses superconductivity, all of that helium boils in seconds — and it has to go somewhere other than the room you are lying in.',
      camera: { position: [1.55, 2.9, 3.5], target: [-0.55, 1.72, -0.05] },
      dofAperture: 0.00004,
      focus: ['Vacuum — no conduction', 'Radiation shield', 'Liquid helium', 'Quench vent'],
      onEnter: view({ reveal: 1, flow: true, labels: 'cryo' }),
      timeline: phaseLoop(6200),
    },
    {
      id: 'align',
      heading: 'Six protons in a million',
      body: 'Slide the phantom to the middle and every hydrogen nucleus in it — one proton, spinning — feels the field. They do not snap into line. They wobble around it like a leaning top, at a rate set precisely by how strong the field is where they happen to be sitting. Slightly more of them wobble the field’s way than against it, and all the rest cancel out in pairs. That surplus is almost nothing: about four protons in a million per tesla, so roughly six in a million here. Every MRI image ever taken was made from the leftovers.',
      hint: 'Watch the pairs cancel. The single arrow left standing is the only thing this machine can measure.',
      camera: { position: [-0.72, 1.62, 0.52], target: [-0.05, 1.3, -0.2] },
      dofAperture: 0.00012,
      focus: ['Hydrogen protons', 'Net magnetisation', 'Test phantom — doped water'],
      onEnter: view({ reveal: 1, table: 1, spins: true, labels: 'spins' }),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 6800,
          ease: 'linear',
          onUpdate: () => {
            handles.setPhase(s.t);
            // random -> lined up and cancelling in pairs -> random again. Both
            // windows finish inside the lap, so the wrap pose is identical.
            handles.setField(win(s.t, 0.08, 0.34) - win(s.t, 0.8, 0.98));
          },
        });
      },
    },
    {
      id: 'rf',
      heading: 'Play it the right note',
      body: 'That leftover points straight down the bore, which makes it undetectable — it is buried inside a field tens of thousands of times bigger, pointing the same way. So the machine knocks it over. The coil built into the bore wall, a birdcage of copper rungs, transmits a radio pulse at exactly the frequency the protons are already wobbling at: 42.58 megahertz per tesla, so 63.87 megahertz here, just below the bottom of the FM dial. Hit them on their own note and they tip together. Then the transmitter shuts off, they spiral back down — and on the way, they broadcast. A coil sitting close to the subject listens.',
      camera: { position: [-0.95, 1.72, 0.62], target: [-0.1, 1.36, -0.18] },
      dofAperture: 0.0001,
      focus: ['Birdcage body coil', '63.87 MHz', 'Receive coil'],
      onEnter: view({ reveal: 1, table: 1, spins: true, field: 1, labels: 'rf' }),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 5600,
          ease: 'linear',
          onUpdate: () => {
            handles.setPhase(s.t);
            // transmit, then go quiet while the tipped magnetisation relaxes
            handles.setRf(win(s.t, 0.1, 0.2) - win(s.t, 0.26, 0.36));
            handles.setTip(win(s.t, 0.12, 0.28) - win(s.t, 0.42, 0.9));
          },
        });
      },
    },
    {
      id: 'gradients',
      heading: 'Where the banging comes from',
      body: 'Every proton in the phantom sings the same note, which tells you nothing about where any of them is. So three more coils sit just inside the bore and bend the field on purpose, making it slightly stronger at one end than the other. Now frequency means position: protons further along the bore wobble faster and drift out of step with the ones behind them. Do it in three directions and every point in the body has its own signature. Those coils carry hundreds of amps, switched on and off hundreds of times a second, inside a 1.5 tesla field — so every time they fire, that field shoves their own windings. Hard. That is the hammering you hear through the earplugs: over a hundred decibels of coil trying to move.',
      hint: 'The flex is exaggerated — real deflection is a fraction of a millimetre. Down at the phantom, the arrows fanning out of step and back into it are the dephasing, at true proportions.',
      camera: { position: [0.92, 2.12, 1.88], target: [-0.32, 1.48, 0.06] },
      dofAperture: 0.00012,
      focus: ['Gradient former', 'Z gradient — a Maxwell pair', 'Position becomes frequency'],
      onEnter: view({ reveal: 1, table: 1, spins: true, field: 1, tip: 0.95, labels: 'gradient' }),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 5200,
          ease: 'linear',
          onUpdate: () => {
            handles.setPhase(s.t);
            // two gradient pulses per lap, each ramping on and fully releasing
            handles.setGrad(
              win(s.t, 0.1, 0.2) -
                win(s.t, 0.3, 0.42) +
                (win(s.t, 0.54, 0.63) - win(s.t, 0.72, 0.86)),
            );
          },
        });
      },
    },
    {
      id: 'run',
      heading: 'Run it',
      body: 'The table slides in, the field is already there and always has been, and for a few minutes the machine does nothing but transmit, tilt, listen and write numbers down. Each measurement is not a pixel — it is one spatial frequency, present across the whole slice at once, which is why the picture arrives all together or not at all. Collect enough of them, run a Fourier transform, and the numbers become an image. No lens, no film, no radiation: a very cold loop of wire, one radio note, and the few protons in every million that failed to cancel out.',
      hint: 'Drag to orbit while it scans.',
      camera: { position: [-2.9, 2.1, 4.3], target: [-0.45, 1.22, 0.15] },
      freeOrbit: true,
      onEnter: view({ labels: 'image' }),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 7400,
          ease: 'linear',
          onUpdate: () => {
            handles.setPhase(s.t);
            // one whole examination per lap: in, scan, image, out
            handles.setTable(win(s.t, 0.04, 0.2) - win(s.t, 0.82, 0.96));
            handles.setImage(win(s.t, 0.26, 0.72) - win(s.t, 0.88, 0.99));
            handles.setRf(
              win(s.t, 0.28, 0.31) -
                win(s.t, 0.34, 0.37) +
                (win(s.t, 0.46, 0.49) - win(s.t, 0.52, 0.55)) +
                (win(s.t, 0.62, 0.65) - win(s.t, 0.68, 0.71)),
            );
          },
        });
      },
    },
  ],
});
