// The story contract for power-steering, written BEFORE the model.
// Every `visuals` entry is a promise the procedural model must keep.
export default {
  angle:
    'Power steering has no idea which way you want to go. A steel rod about as thick as a ' +
    'pencil sits between your hands and the wheels, and your effort twists it a few degrees. ' +
    'That twist is the only signal. It opens a valve, and pressurised oil does the heavy lifting.',
  stat:
    'Full assist arrives after about 3.5° of twist in the torsion bar. At that point roughly ' +
    '100 bar (about 1,500 psi) is acting on the rack piston, a push of around 700 kg.',
  button: 'You never turned the wheels. You twisted a rod.',
  who:
    'Anyone who has turned a parked car’s wheel with two fingers, or who has felt the ' +
    'steering go suddenly heavy when the engine stalled.',
  beats: [
    {
      idea:
        'The complete system: a steering wheel, a column, a rack between the front tyres, and ' +
        'a belt-driven pump with its own oil. The tyres swing left and right with ease.',
      visuals: [
        'a solid steering rack housing with rubber boots at both ends, tie rods out to two front tyres',
        'a steering wheel on a column dropping into the valve housing on the rack',
        'a belt-driven pump with a pulley and a fluid reservoir, joined to the rack by hoses',
        'the tyres steering left and right as the steering wheel turns',
      ],
    },
    {
      idea:
        'Underneath the hydraulics is a plain mechanical rack and pinion. The pinion rolls along ' +
        'the rack teeth and slides the rack sideways, and the tie rods swing the tyres about their pivots.',
      visuals: [
        'the rack housing opened up, the toothed rack bar and the small pinion meshing',
        'the rack sliding sideways as the pinion turns',
        'tie rods pushing and pulling the steering arms so the tyres pivot',
      ],
    },
    {
      idea:
        'The pump never stops. Whenever the engine runs, the vanes sling oil around a loop, and ' +
        'with the wheel centred that oil flows straight through the valve and back to the reservoir ' +
        'at almost no pressure.',
      visuals: [
        'the pump opened: a slotted rotor inside an oval cam ring, vanes sliding in and out',
        'oil moving pump → valve → reservoir → pump as a continuous loop at low pressure',
        'both ends of the power cylinder showing equal low pressure',
      ],
    },
    {
      idea:
        'The input shaft from the steering wheel is not solidly joined to the pinion. The only ' +
        'link is a thin torsion bar, and your effort twists it up to about 3.5°.',
      visuals: [
        'the valve housing opened, input shaft above, pinion below, the torsion bar joining them',
        'a stripe on the torsion bar twisting as effort goes on and unwinding as it comes off',
        'index marks on the input shaft and pinion drifting apart by a few degrees',
      ],
    },
    {
      idea:
        'That twist is the valve. The inner spool turns with the input shaft and the outer sleeve ' +
        'turns with the pinion. A few degrees between them uncovers ports that send pressure one ' +
        'way and open the other side to return.',
      visuals: [
        'a cross-section of the rotary valve: inner spool lands, outer sleeve grooves, oil in the gaps',
        'twist one way: one set of gaps closing and the other opening, pressure sent to one line',
        'twist the other way: the pattern mirrors and the other line lights up',
      ],
    },
    {
      idea:
        'The pressure lands on a piston fixed to the rack, a push of around 700 kg. As the rack ' +
        'catches up with your hands the twist unwinds and the valve closes itself. The system ' +
        'follows you and never takes over.',
      visuals: [
        'the power cylinder opened: a piston on the rack, one chamber glowing with high pressure',
        'the piston and rack driven toward the low-pressure side, oil pushed out of it to return',
        'the torsion-bar twist falling back toward zero as the rack catches up',
      ],
    },
    {
      idea:
        'Put back together and running: a twist of a few degrees in a pencil-thick rod steers a ' +
        'tonne and a half of car.',
      visuals: [
        'the complete sealed system turning on the plinth',
        'full lock-to-lock steering at speed',
      ],
    },
  ],
};
