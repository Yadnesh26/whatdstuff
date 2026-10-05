// The story contract for hydraulic-system, written BEFORE the model.
// Every `visuals` entry is a promise the procedural model must keep.
export default {
  angle:
    'The pump in a hydraulic system never makes pressure. It only makes flow: it shoves a ' +
    'fixed amount of oil every turn. Pressure is the load pushing back. With nothing in the ' +
    'way the gauge reads almost zero, and hang six tonnes on the cylinder and it climbs to ' +
    'exactly what six tonnes needs, and no further.',
  stat:
    '200 bar is about 200 kg pressing on every square centimetre. Spread over a 63 mm piston ' +
    'that comes to roughly 6 tonnes of push, from a pump the size of your fist.',
  button: 'The pump only pushes. The load decides the pressure.',
  who:
    'Anyone who has watched an excavator arm or a tipper truck lift something enormous ' +
    'without a sound, and wondered where all that force lives.',
  beats: [
    {
      idea:
        'The complete system: a power pack (electric motor on an oil tank, a valve block with ' +
        'a lever, a pressure gauge) joined by two hoses to a cylinder that lifts a heavy boom.',
      visuals: [
        'a sealed power pack: motor on top of a steel oil tank, valve block with a hand lever, a gauge',
        'two hoses running from the valve block to a double-acting cylinder',
        'the cylinder lifting and lowering a hinged steel boom carrying a heavy block',
      ],
    },
    {
      idea:
        'Inside the tank, the motor turns a gear pump. Oil is not squeezed between the meshing ' +
        'teeth. It rides around the OUTSIDE of both gears, trapped between teeth and housing, ' +
        'and is pushed out where the teeth mesh again.',
      visuals: [
        'the tank going see-through, showing the oil, the suction pipe and the pump',
        'the pump opened: two meshing gears in a figure-eight housing',
        'oil pockets riding around the outside of each gear from inlet to outlet',
      ],
    },
    {
      idea:
        'With the lever centred, the valve opens the pump straight back to the tank and blocks ' +
        'both hoses. Oil races round in a loop, the gauge sits near zero, and the boom holds ' +
        'perfectly still. The pump is working flat out and making no pressure.',
      visuals: [
        'oil flowing pump → valve → tank in a continuous loop',
        'the gauge needle near zero',
        // CHANGED deliberately after the blueprint: the hoses are not "dark".
        // With the valve centred the lift-side hose is LOCKED at the load's
        // holding pressure (~70 bar) while the pump loop sits near 6 bar —
        // that contrast is the truth of a tandem-centre valve, and better TV.
        'the boom frozen in place, the oil locked in the lift-side hose still glowing at holding pressure',
      ],
    },
    {
      idea:
        'Pushing the lever slides a spool inside the valve. Its lands close the path back to ' +
        'the tank and open the pump to one hose, while the other hose opens to the tank.',
      visuals: [
        'a cutaway of the valve block: a spool with lands sliding in a bore',
        'the lever moving and the spool shifting with it',
        'one hose port lighting as pressure, the other as return',
      ],
    },
    {
      idea:
        'Oil fills the cylinder behind the piston. Oil barely compresses, so every drop pushes ' +
        'the piston. The gauge rises only as far as the boom needs, and that same pressure acts ' +
        'on every square centimetre of the piston.',
      visuals: [
        'the cylinder cutaway: piston, rod, cap-side chamber filling with high-pressure oil',
        'rod-side oil pushed out and back to the tank',
        'the boom rising while the gauge holds a steady working pressure',
      ],
    },
    {
      idea:
        'At the end of the stroke the piston cannot move, so pressure climbs until the relief ' +
        'valve spring gives way at 200 bar and dumps the flow back to the tank as heat. That ' +
        'one spring sets the most the system can ever push.',
      visuals: [
        'the piston bottomed out at full stroke',
        'the gauge needle swinging up to the 200 bar mark',
        'the relief valve cutaway: a poppet lifting off its seat against a spring, oil escaping to tank',
      ],
    },
    {
      idea:
        'Back together and running: lift, hold, lower. The tank, the gears, one spring and a ' +
        'sliding spool are the whole trick.',
      visuals: [
        'the complete sealed system cycling the boom up, hold, down',
      ],
    },
  ],
};
