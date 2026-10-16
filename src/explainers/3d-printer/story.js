// Phase 0 artifact: written BEFORE the model. Pure data, never bundled.
//
// SOURCES (research pass): E3D V6 support pages (30x30x10 mm heatsink fan,
// brass nozzle in an aluminium heater block, ~22 mm finned heatsink, thin-walled
// heat break between them); RepRap wiki "DIY Hobbed Drive Gear" + MK8 listings
// (9 mm OD, 11 mm long, ~7 mm effective diameter at the hobbed groove);
// Snapmaker / Wevolver / Prusa forum PLA guides (nozzle ~200-220 °C, bed
// 50-65 °C, PLA glass transition ~60 °C, warping = uneven cooling shrinkage
// lifting corners, textured PEI grips PLA). Volume bookkeeping: 1.75 mm
// filament = 2.41 mm² cross-section; a 0.45 x 0.2 mm bead ≈ 0.08 mm², so 1 mm
// of filament lays ~30 mm of line. 50 mm / 0.2 mm = 250 layers.
export default {
  angle:
    'A 3D printer never prints in 3D. It only ever draws flat lines of melted plastic, then moves ' +
    'up a fifth of a millimetre and draws the next flat layer on top.',
  stat: 'A 5 cm chess rook is 250 separate flat drawings, one for every 0.2 mm layer.',
  button: 'Stack enough flat drawings and you get a thing.',
  who:
    'Anyone who has watched a desktop printer twitch back and forth for an hour and wondered how ' +
    'that jittery little nozzle ends up with a solid object.',
  beats: [
    {
      idea:
        'A desktop printer is a hot nozzle on a gantry over a sliding bed, drawing one layer of a ' +
        'half-built rook. Nothing it does looks three-dimensional.',
      visuals: [
        'a complete open-frame printer on the plinth, spool on top, half-printed rook on the bed',
        'the toolhead sliding left and right while the bed slides front and back',
        'a short glowing line of fresh plastic trailing the nozzle',
      ],
    },
    {
      idea:
        'Before printing, software slices the 3D model into flat layers and turns each one into a ' +
        'path: walls around the edge, a sparse grid inside.',
      visuals: [
        'the rook split into a stack of flat slices that spread apart and close up again',
        'one slice lit up showing two wall loops and a diagonal infill grid',
        'the top slices broken into separate islands where the battlements are',
      ],
    },
    {
      idea:
        'A motor-driven toothed gear pinches the filament against a spring-loaded bearing and ' +
        'pushes it down into the hotend. Its teeth leave bite marks.',
      visuals: [
        'a cut-open extruder: motor, drive gear, idler bearing, spring',
        'the gear turning and the filament moving down with bite marks appearing below the gear',
      ],
    },
    {
      idea:
        'The hotend is hot only at the bottom. A heater block holds 210 °C, a thin heat break ' +
        'chokes the heat, and a fan-cooled heatsink keeps the filament solid until the last moment.',
      visuals: [
        'a half-section hotend: heatsink, heat break, heater block with cartridge and thermistor, nozzle',
        'the section coloured by temperature, hot at the nozzle and cool above the heat break',
        'the solid filament turning into melt inside the block and flowing out of the 0.4 mm hole',
        'cooling air streaming through the heatsink fins from a side fan',
      ],
    },
    {
      idea:
        'The nozzle squashes the melt into a flat bead on top of the layer below. The heat welds ' +
        'the two together, and the part fan freezes the bead before it can sag.',
      visuals: [
        'a macro of the nozzle tip with the part sliding underneath it',
        'stacked oval bead cross-sections of the layers below',
        'the new bead glowing hot where it leaves the nozzle and cooling downstream',
        'the fused seam glowing under the new bead',
        'part-fan air blowing onto the fresh bead',
      ],
    },
    {
      idea:
        'Two motors and belts draw each layer: one moves the toolhead left-right, one moves the bed ' +
        'front-back. The Z screws stay still until the layer is done.',
      visuals: [
        'X motor pulley and belt turning with the toolhead',
        'Y motor and belt moving the bed',
        'the Z lead screws standing still while the layer is drawn',
      ],
    },
    {
      idea:
        'Under the part is a heater. It keeps the steel print sheet at about 60 °C, near where PLA ' +
        'softens, so the first layer stays gripped to the rough PEI coating instead of curling up.',
      visuals: [
        'the print sheet lifted off the bed, rook still stuck to it',
        'the serpentine heater trace glowing in the bed underneath',
      ],
    },
    {
      idea: 'Back together and running: flat drawing after flat drawing. Stack enough and you get a thing.',
      visuals: ['the complete printer printing, free to orbit'],
    },
  ],
};
