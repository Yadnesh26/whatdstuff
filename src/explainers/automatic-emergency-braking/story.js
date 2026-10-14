// The story contract for automatic-emergency-braking, written BEFORE the model.
// Every `visuals` entry is a promise the procedural model must keep.
export default {
  angle:
    'Your car never measures the distance to the car ahead. It hums a rising note at 77 GHz ' +
    'and listens: the echo comes back a few hundred billionths of a second late, so it is still ' +
    'singing an older, lower note, and that difference in pitch IS the distance. Emergency ' +
    'braking then ignores distance altogether and brakes on time: how many seconds until impact.',
  stat:
    'An echo from a car 30 m ahead returns just 200 nanoseconds after it left. The radar never ' +
    'times that directly; it hears it as a steady difference in pitch between what it is sending ' +
    'and what is coming back.',
  button: 'It never measured distance. It listened to time.',
  who:
    'Anyone whose car has ever flashed BRAKE! and jolted to a stop on its own, and wondered how ' +
    'it knew, and how it pressed a pedal nobody touched.',
  beats: [
    {
      // CHANGED after the blueprint: the dummy is road-fixed and the radar laps
      // have no clean way to spawn it, so it is introduced in beat 5 instead.
      idea:
        'A car following another down a street, the gap between them drifting in and out. ' +
        'Nothing on the outside shows how it measures that gap.',
      visuals: [
        'a complete solid sedan on a road, a second car ahead in the same lane',
        'road markings streaming under the cars, wheels rolling',
      ],
    },
    {
      idea:
        'Behind the badge sits a radar that never stops humming a note that sweeps upward in ' +
        'pitch, over and over, thousands of times a second.',
      visuals: [
        'the body ghosting to reveal the radar module behind the badge',
        'wavefronts leaving the radar toward the car ahead and echoes returning',
        'a floating pitch-over-time chart: the sent note as a rising sawtooth',
      ],
    },
    {
      idea:
        'The echo is the same rising note, only late, so at every instant it is a little lower ' +
        'than what is being sent. That constant gap in pitch grows with distance: the gap is the ' +
        'ruler.',
      visuals: [
        'the echo sawtooth drawn beside the sent one, shifted later in time',
        'the gap between the two lines highlighted as the beat',
        'the lead car drifting nearer and further, the gap shrinking and widening with it',
      ],
    },
    {
      idea:
        'If the gap is closing, the echo also comes back squeezed a touch higher in pitch, the ' +
        'Doppler shift. That gives closing speed directly, and distance divided by closing speed ' +
        'is the number that matters: seconds to impact.',
      visuals: [
        'the lead car braking and the distance shrinking',
        'the echo line nudged upward while closing',
        'a time-to-collision ring counting down as the gap closes',
      ],
    },
    {
      idea:
        'Radar barely sees a person: a pedestrian reflects about a hundred times less than a car. ' +
        'So the windshield camera does the recognising, boxing shapes it has learned are people, ' +
        'and the radar confirms where and how fast. Together they predict whether the path will ' +
        'cross your lane.',
      visuals: [
        'the windshield camera module and its view cone',
        'a box locking onto the dummy as it steps off the kerb',
        'a faint radar blip on the dummy beside a bright one on the car',
        'a predicted walking path drawn across the lane',
      ],
    },
    {
      idea:
        'The car acts in stages as time-to-collision falls: first a warning, then the brakes are ' +
        'pre-filled so the pads touch the discs, then partial braking, and finally full braking ' +
        'about half a second before impact if nothing else has worked.',
      visuals: [
        'a time-to-collision countdown with the stage thresholds marked on it',
        'a warning lamp lighting at the first threshold',
        'brake pads closing onto the discs at pre-fill, then clamping harder',
      ],
    },
    {
      idea:
        'Nobody presses the pedal. The stability-control unit under the bonnet has its own ' +
        'electric pump: it opens and closes valves and pumps brake fluid straight to all four ' +
        'calipers.',
      visuals: [
        'the ESC hydraulic unit: aluminium block, pump motor, valve coils',
        'pressure glowing along the brake lines from the unit to all four calipers',
        'the brake pedal staying still while the calipers clamp',
        'the car stopping short of the dummy as it finishes crossing',
      ],
    },
    {
      idea:
        'Back together: a radar listening to pitch, a camera recognising shapes, and a pump that ' +
        'can stop the car without you. It never measured distance. It listened to time.',
      visuals: [
        'the complete solid car braking to a stop before the dummy, then driving on',
      ],
    },
  ],
};
