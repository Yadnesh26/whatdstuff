// The story contract for adas-lane-assist, written BEFORE the model.
// Every `visuals` entry is a promise the procedural model must keep.
export default {
  angle:
    'Lane assist never sees a road. A camera behind your mirror finds two bright stripes, ' +
    'fits a line to each, and reduces the whole scene to two numbers: how far you are from ' +
    'the middle and which way you are pointing. Then a motor leans on your steering column, ' +
    'deliberately weaker than your hands, so you always win.',
  stat:
    'A lane-keeping nudge is typically capped at about 3 Nm of steering torque. On a 38 cm ' +
    'steering wheel that is roughly 1.6 kg of push at the rim, so one hand overrules it.',
  button: 'It never drives. It only leans.',
  who:
    'Anyone who has felt their steering wheel tug gently back toward the middle of the lane ' +
    'and wondered what, exactly, just touched it.',
  beats: [
    {
      idea:
        'A car cruising down a two-lane road, staying in the middle of its lane with no ' +
        'visible help. Nothing on the outside gives the system away.',
      visuals: [
        'a complete solid sedan on a strip of road with a dashed centre line and solid edge lines',
        'the road markings streaming under the car, wheels rolling',
        'the car holding the middle of its lane',
      ],
    },
    {
      idea:
        'Ghost the body and there are four parts: a camera behind the rear-view mirror, a radar ' +
        'behind the grille badge, a controller, and the electric motor that already powers the ' +
        'steering. Wires join them.',
      visuals: [
        'the body fading to a ghost while the ADAS hardware stays solid',
        'the windshield camera module behind the mirror, lens facing the road',
        'the front radar module behind the badge',
        'the ADAS controller and the wires from both sensors to it',
        'the steering wheel, column and column-mounted EPS motor, linked to the rack and front wheels',
      ],
    },
    {
      idea:
        'The camera does not recognise a road. Row by row it looks for bright stripes against ' +
        'dark asphalt, marks the edges it finds, and fits a smooth line through them, one for ' +
        'each side of your lane.',
      visuals: [
        'the camera view cone spreading from the windshield onto the road ahead',
        'detected edge points appearing on the lane markings, near to far, only where paint exists',
        'a fitted line drawing itself through the points on each side of the lane',
      ],
    },
    {
      idea:
        'From those two lines it computes two numbers: your offset from the lane centre and ' +
        'your heading. Project the heading forward and it shows where you will cross the line. ' +
        'If that comes up soon and your indicator is off, it warns you.',
      visuals: [
        'the car drifting slowly toward the line',
        'an offset arrow from the lane centre to the car centreline, growing with the drift',
        'a heading ray from the nose meeting the lane line at a marked crossing point that moves closer',
        'the warning lamp on the dash lighting before the tyre reaches the line, then the car returning to centre',
      ],
    },
    {
      idea:
        'Lane keep assist goes one step further. It asks the power-steering motor for a little ' +
        'extra torque on top of normal assist. The steering wheel turns a few degrees by itself ' +
        'and the front wheels steer the car back.',
      visuals: [
        'the EPS motor spinning and its worm gear turning the column',
        'a torque arrow on the steering wheel rim, the wheel turning a few degrees',
        'the front wheels steering and the car heading back to the middle of the lane',
      ],
    },
    {
      idea:
        'The nudge is capped at about 3 Nm, roughly 1.6 kg at the rim. A torque sensor in the ' +
        'column feels your hands. Push harder than the motor and it gives way; take your hands ' +
        'off for too long and it switches itself off.',
      visuals: [
        'the torque sensor in the column, marked',
        'a small assist arrow and a larger driver arrow in the opposite direction on the rim',
        'the assist arrow shrinking to nothing as the driver arrow wins and the car follows the driver',
      ],
    },
    {
      idea:
        'The radar handles the car ahead. It sends a continuous rising chirp and compares the ' +
        'echo with what it is sending: the gap gives distance, the Doppler shift gives closing ' +
        'speed. Adaptive cruise keeps a time gap, not a fixed distance. The camera supplies what ' +
        'the radar cannot: that the echo is a car.',
      visuals: [
        'a lead car ahead in the same lane',
        'radar wavefronts fanning out from the grille, reflecting off the lead car and returning',
        'a gap band on the road between the cars, shrinking when the lead car slows and recovering as the car slows too',
        'a camera box and a radar mark on the lead car merging into one locked target',
      ],
    },
    {
      idea:
        'Back together and running: a camera that only sees stripes, a radar that only hears ' +
        'echoes, and a motor that only leans. It never drives. It only leans.',
      visuals: [
        'the complete solid car following the lead car and holding its lane',
        'the drift-and-correct and the following happening together',
      ],
    },
  ],
};
