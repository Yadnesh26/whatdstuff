// Story-first contract (add-explainer Phase 0). Read by video-scripting, not
// bundled into the app. Research: Wikipedia "Gimbal lock"; Apollo Guidance
// Computer gimbal-lock warning (70deg advisory / 85deg freeze, requiring a
// manual star-sighting realignment); marine gimballed-compass practice
// (counterweight held below the pivot so gravity self-rights the card);
// modern 3-axis brushless camera-gimbal architecture (IMU at hundreds of Hz,
// per-axis BLDC motors correcting within milliseconds).
export default {
  angle:
    "A gimbal doesn't hold its payload still by gripping it — it holds it " +
    'still by decoupling it. Each ring only ever answers for ONE rotation; ' +
    "stack three of them at right angles and the payload never learns the " +
    'handle moved. Stack them badly and the same trick can erase a whole ' +
    'direction of motion — gimbal lock.',
  stat:
    'On Apollo, the guidance computer flashed a gimbal-lock warning at 70 ' +
    'degrees of tilt and froze the platform outright at 85 — a mechanical ' +
    'limit astronauts had to steer around by hand.',
  button: 'Three rings can hold anything still — until two of them agree.',
  who:
    'Anyone who has watched a handheld camera gimbal hold dead-level while ' +
    "the operator's hand visibly shakes, and wondered how, or who has heard " +
    '"gimbal lock" from Apollo 13 or a 3D app and never gotten the mechanical ' +
    'picture.',
  beats: [
    {
      idea: 'The core claim, shown immediately: the frame trembles, the payload does not.',
      visuals: [
        'a handle/yoke assembly visibly trembling in place',
        'three nested rings absorbing that tremble',
        'a stabilized payload at the center holding dead level throughout',
      ],
    },
    {
      idea: 'Each of the three rings answers for exactly one rotation axis.',
      visuals: [
        'yaw-only disturbance absorbed by the outer ring alone, other two rings still',
        'pitch-only disturbance absorbed by the middle ring alone',
        'roll-only disturbance absorbed by the inner ring alone',
      ],
    },
    {
      idea: 'A gimbal can stabilize with no power at all — gravity does the work.',
      visuals: [
        'a counterweight hung below the payload, pulling its center of mass under the pivot',
        'motors visibly idle/dark',
        'a slower, settling correction instead of an instant one',
      ],
    },
    {
      idea: 'The modern version replaces gravity with sensing and torque.',
      visuals: [
        'an IMU chip on the payload pulsing rapidly',
        'brushless motor pods glowing at each ring pivot',
        'instant, crisp correction under a harder disturbance than the passive step handled',
      ],
    },
    {
      idea: 'Tilt the middle ring 90 degrees and the outer and inner axes become the same line — a whole direction of freedom vanishes.',
      visuals: [
        'the middle ring rotating to a vertical 90-degree pose',
        'the outer ring axis and inner ring axis visually converging into one line',
        'spinning EITHER the outer or the inner ring alone producing the identical payload motion',
      ],
    },
  ],
};
