export default {
  angle:
    'A battery cannot store the back-and-forth power that comes out of your wall. So the box that keeps a computer alive in a blackout straightens AC into one-way DC, parks it, and then fakes the back-and-forth again with four switches.',
  stat: 'In wall wiring, each electron moves only about a micrometre before turning back, 50 times a second.',
  button: 'Straighten it, store it, shake it back.',
  who: 'Anyone who has seen "AC" and "DC" printed on a charger and never known what physically differs.',
  beats: [
    {
      idea: 'A UPS takes AC in and gives AC out, yet inside, the power is DC.',
      visuals: [
        'a sealed desktop UPS on a plinth, mains cord in on the left, a lit desk lamp plugged in on the right',
        'front status lights: LINE on',
      ],
    },
    {
      idea: 'AC: the electrons in the wire shuffle back and forth in place, about a micrometre, 50 times a second.',
      visuals: [
        'a magnified cut-open mains wire: insulation, translucent copper core, fixed copper atoms',
        'free electrons swinging back and forth together, a tracked electron returning to its start',
        'a scope screen tracing the wall sine wave',
      ],
    },
    {
      idea: 'DC: the same electrons drift steadily one way, slower than a snail.',
      visuals: ['the same wire with electrons drifting one direction', 'the scope screen showing a flat line'],
    },
    {
      idea: 'Inside the box: rectifier → DC bus (capacitors + battery) → inverter → filter.',
      visuals: [
        'the cover gone, the board revealed left to right',
        'four scope screens probing each stage: sine, flat DC, pulses, sine',
      ],
    },
    {
      idea: 'Four diodes, each a one-way valve, steer both halves of the wave into the same + rail.',
      visuals: [
        'bridge of four diodes; the diagonal pair conducting glows and swaps every half cycle',
        'current dots reversing on the input wires but always running the same way on the + rail',
        'scope: sine in, every hump flipped positive out',
      ],
    },
    {
      idea: 'Big capacitors fill the gaps between humps, so the bus sits nearly flat; the battery hangs on this same DC.',
      visuals: [
        'reservoir capacitors in place; current into them only in short gulps near each peak',
        'scope: nearly flat DC with a small ripple, the bare humps ghosted beneath',
      ],
    },
    {
      idea: 'Four switches in an H flip which way the DC pushes through the load: a crude AC square wave.',
      visuals: ['four transistors, diagonal pairs lighting alternately', 'current reversing through the output leads', 'scope: square wave'],
    },
    {
      idea: 'Switch thousands of times a second with varying pulse widths, and a coil + capacitor average the pulses into a smooth sine.',
      visuals: ['transistors flickering', 'scope 1: pulses widening and narrowing', 'scope 2 after the coil and film capacitor: clean sine'],
    },
    {
      idea: 'Pull the plug: the battery feeds the same DC bus and the lamp never blinks.',
      visuals: ['sealed UPS; LINE light goes out, BATTERY light comes on, display says ON BATTERY', 'lamp stays lit'],
    },
  ],
};
