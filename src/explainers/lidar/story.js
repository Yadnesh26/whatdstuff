// The story contract for lidar, written BEFORE the model.
// Every `visuals` entry is a promise the procedural model must keep.
export default {
  angle:
    'A lidar has no idea what it is looking at. It is a stopwatch — sixty-four of ' +
    'them, bolted to a turntable, timing how long a five-nanosecond flash of ' +
    'invisible light takes to come back. Everything else is arithmetic.',
  stat:
    'Light covers 30 cm every nanosecond, so a round trip from 100 m away lands ' +
    'back in 667 ns — and to call the distance to ±2 cm the clock has to resolve ' +
    '130 picoseconds, 1.3 million times a second, on a head spinning at 900 rpm.',
  button: 'It never saw the car. It timed it.',
  who:
    'Anyone who has seen the spinning coffee-can on a self-driving car and assumed ' +
    'it was some exotic camera — and anyone who thinks 3D sensing must be hard.',
  beats: [
    {
      idea: 'The sealed sensor: a black cylinder that spins, and gives nothing away.',
      visuals: [
        'a complete solid lidar puck on a studio plinth — ribbed base, smoked window band, cable gland',
        'the upper head turning steadily while the base stays still',
      ],
    },
    {
      idea:
        'Open it and there is no image sensor anywhere. Two blocks of laser diodes on ' +
        'one side, a bank of detectors behind a lens on the other, and a motor spinning ' +
        'the whole optical head on a fixed base.',
      visuals: [
        'the black shell ghosting away to expose the internal optical head',
        'two stacked emitter blocks of laser diodes facing out through their lens',
        'the receive lens and the detector board sitting behind it',
        'the motor and counterweight in the stationary base, head rotating above it',
      ],
    },
    {
      idea:
        'One measurement, slowed down: fire a 5-nanosecond pulse, start a clock, stop it ' +
        'when the echo lands. Distance is the round trip halved — nothing is recognised.',
      visuals: [
        'a single emissive pulse packet leaving the emitter along a beam',
        'the packet striking a target post out in front of the sensor',
        'the packet returning along the same line into the receive lens',
        'the beam path drawn out and back, with the round trip marked',
      ],
    },
    {
      idea:
        'That halving is the whole difficulty. 30 cm per nanosecond means centimetre ' +
        'accuracy is a picosecond stopwatch problem, not an optics problem.',
      visuals: [
        'a nanosecond tick ruler running alongside the beam, a marker riding it with the pulse',
        'the ruler zoomed so a single tick reads as 30 cm of travel',
        'the return marker landing between two ticks — the sub-tick gap called out',
      ],
    },
    {
      idea:
        'The echo is almost nothing. The beam spreads, scatters off a dull surface, and a ' +
        'handful of photons come home — so the detector avalanches one photon into a spike.',
      visuals: [
        'the outgoing beam visibly widening into a spot on the target',
        'a bright outgoing packet versus a sparse scatter of faint returning dots',
        'the avalanche photodiode multiplying one arriving dot into a burst of charge',
      ],
    },
    {
      idea:
        'One beam is one line. Sixty-four lasers are bolted at fixed vertical angles, ' +
        'fanning a 27° blade of beams out of the head.',
      visuals: [
        'the emitter blocks firing all 64 beams at once as a vertical fan',
        'the fan seen edge-on, each beam at its own mechanically fixed angle',
        'the fan striking ground and target at different heights',
      ],
    },
    {
      idea:
        'Now spin it. The fan sweeps 360°, and every (angle, angle, time) triple becomes ' +
        'one XYZ dot — the point cloud is drawn by rotation, not by a picture.',
      visuals: [
        'the head rotating with the fan sweeping through a full circle',
        'dots being laid down where beams land, accumulating into a point cloud of the scene',
        'the finished cloud standing alone with the beams hidden',
      ],
    },
    {
      idea:
        'Sealed back up and running: a stopwatch on a turntable, 1.3 million times a second. ' +
        'Fog, black paint and wet road defeat it for exactly the same reason — no echo, no point.',
      visuals: [
        'the complete solid sensor spinning on its plinth again at speed',
        'the point cloud alive around it, refreshing as the head passes',
      ],
    },
  ],
};
