import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildPrinter } from './model.js';

// Story (story.js is the contract): the printer drawing one flat layer, the
// slicer's stack, the extruder gear, the hotend in thermal false colour, the
// bead at the nozzle tip, the motors that draw a layer, the heated bed, then
// everything running. Every step drives ONE lap function through a local tween
// object (model.js `setLap`); setView picks which insert is on stage.

// Pin the full view/label state on entering a step (pre-flight #4).
const view =
  (opts, labelMode) =>
  ({ handles }) => {
    handles.setView(opts);
    handles.setLabels(labelMode);
  };

function lap(name, duration) {
  return ({ tl, handles }) => {
    const s = { t: 0 }; // LOCAL state, never shared across steps
    tl.add(s, { t: 1, duration, ease: 'linear', onUpdate: () => handles.setLap(name, s.t % 1) });
  };
}

export default defineExplainer({
  ...meta,

  buildScene({ scene }) {
    return buildPrinter({ scene });
  },

  steps: [
    {
      id: 'machine',
      heading: 'It never prints in 3D',
      body: 'This desktop 3D printer is halfway through a chess rook. Watch the nozzle slide left and right while the bed slides front and back. The glowing line behind it is fresh plastic. Every one of those moves is flat: the printer is drawing a single layer, about as thick as a sheet of card, and this rook needs 250 of them.',
      hint: 'Drag to orbit.',
      camera: { position: [2.25, 2.98, 7.26], target: [-1.57, 1.85, 0.64] },
      onEnter: view({ scene: 'A' }, 'exterior'),
      timeline: lap('print', 9000),
    },
    {
      id: 'slice',
      heading: 'First, cut it into slices',
      body: 'Before the printer moves at all, a program called a slicer cuts the 3D model into flat layers 0.2 mm thick. The 5 cm rook becomes 250 of them; here you see one in ten. Each slice is turned into a path for the nozzle, like the one pulled out here: two walls around the edge, then a sparse diagonal grid inside, so the part is mostly air. Near the top, the battlements split a slice into four separate islands.',
      hint: 'The lit slice is the path the nozzle will follow.',
      focus: ['One layer: 2 walls + 15% infill'],
      camera: { position: [1.58, 3, 4.52], target: [-0.59, 1.29, 0.1] },
      onEnter: view({ scene: 'S' }, 'slice'),
      timeline: lap('slice', 10000),
    },
    {
      id: 'extruder',
      heading: 'A gear pushes the plastic',
      body: 'The plastic arrives as a 1.75 mm string wound on the spool. In the extruder, cut in half here, a stepper motor turns a small toothed gear. A spring presses a bearing against the other side, pinching the filament onto the teeth, so every turn of the gear shoves it down toward the hot end. You can see where the teeth bit into it.',
      hint: 'Watch the bite marks appear below the gear.',
      focus: ['Drive gear'],
      camera: { position: [0.87, 3.22, 3.01], target: [-0.54, 2.72, 0.2] },
      onEnter: view({ scene: 'B' }, 'extruder'),
      timeline: lap('feed', 10000),
    },
    {
      id: 'hotend',
      heading: 'Hot at the bottom, cold on top',
      body: 'The same cut, now coloured by temperature. The aluminium heater block sits at 210 °C, warmed by a heater cartridge and checked by a thermistor. Above it is the heat break, a steel neck with walls about half a millimetre thick, so little heat can climb past it. A fan blows through the heatsink fins to keep the filament cold and stiff until the last few millimetres, where it melts and squeezes out of a 0.4 mm hole.',
      hint: 'Purple is cool, yellow is hot.',
      focus: ['Heat break'],
      camera: { position: [0.32, 1.64, 3.62], target: [-0.93, 1.28, 0.23] },
      onEnter: view({ scene: 'B', thermal: true }, 'hotend'),
      timeline: lap('feed', 10000),
    },
    {
      id: 'bead',
      heading: 'Squash, weld, freeze',
      body: 'Down at the tip, the nozzle stays put and the part slides underneath it. Melt leaves the hole and is squashed into a flat bead 0.2 mm tall, a little wider than the hole. Its heat softens the top of the layer below, and the two fuse along a seam. The glow marks heat. A fan blows on the fresh bead so it stiffens before it can sag.',
      hint: 'The cut on the right shows the layers stacked like bricks.',
      focus: ['Fused seam'],
      camera: { position: [3.09, 2.33, 3.12], target: [-1.03, 1.35, 0.51] },
      onEnter: view({ scene: 'C' }, 'bead'),
      timeline: lap('bead', 8000),
    },
    {
      id: 'motion',
      heading: 'Two motors draw a layer',
      body: 'One motor pulls a toothed belt that slides the toolhead left and right. Another pulls a belt under the bed and slides it front and back. Together they trace the walls, then the infill, then hop back to the start. The two lead screws that lift the gantry stand still the whole time. They turn only when a layer is finished, raising the nozzle 0.2 mm.',
      hint: 'Only X and Y move while a layer is drawn.',
      focus: ['X motor + belt', 'Y belt moves the bed'],
      camera: { position: [-3.91, 2.63, 4.06], target: [-0.86, 1.14, -0.59] },
      onEnter: view({ scene: 'A' }, 'motion'),
      timeline: lap('print', 9000),
    },
    {
      id: 'bed',
      heading: 'A warm bed holds on',
      body: 'Here the steel print sheet is lifted so you can see underneath. The bed below it is a heater: a long copper trace that keeps it at about 60 °C, close to the temperature where PLA starts to soften. The first layer was pressed into the rough PEI coating on the sheet, and the warmth keeps it gripping. Without it, the plastic shrinks as it cools and peels its corners up off the sheet.',
      hint: 'The glowing line is the heater trace.',
      focus: ['Heater trace · 60 °C'],
      camera: { position: [1.26, 1.18, 2.87], target: [-0.64, 0.99, 0.58] },
      onEnter: view({ scene: 'A', heat: true }, 'bed'),
      timeline: lap('bed', 7000),
    },
    {
      id: 'run',
      heading: 'Stack enough and you get a thing',
      body: 'Back together and printing. The spool feeds the gear, the gear feeds the hotend, the nozzle draws one flat layer, and the gantry steps up a fifth of a millimetre to draw the next. This rook takes 250 rounds of that. A 3D printer never prints in 3D. Stack enough flat drawings and you get a thing.',
      hint: 'Drag to orbit while it prints.',
      camera: { position: [-4.59, 3.26, 5.81], target: [-1.26, 1.85, -0.58] },
      freeOrbit: true,
      onEnter: view({ scene: 'A' }, false),
      timeline: lap('print', 5000),
    },
  ],
});
