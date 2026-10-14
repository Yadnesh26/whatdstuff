// The story contract for anti-lock-braking, written BEFORE the model.
// Every `visuals` entry is a promise the procedural model must keep.
export default {
  angle:
    'ABS does not brake harder. It lets go of the brakes on purpose, over and over, because a ' +
    'tyre that is still turning grips better than one that is sliding, and only a rolling wheel ' +
    'can steer.',
  stat:
    'Up to 15 times a second the ABS unit opens a valve and drops the pressure on one wheel, ' +
    'holding it at roughly 10 to 20 percent slip, the peak of the grip curve.',
  button: 'It stops fastest by letting go.',
  who:
    'Anyone who has stamped on the pedal in a panic stop and felt it buzz back under their foot, ' +
    'and wondered whether the car was broken.',
  beats: [
    {
      idea:
        'In a hard stop the wheel turns on the road while the brakes try to freeze it. From ' +
        'outside, nothing shows how the car stops the wheel from locking.',
      visuals: [
        'a complete solid wheel on a moving road, tyre rolling under the corner of a car',
        'road markings streaming under the tyre',
      ],
    },
    {
      idea:
        'A toothed ring spins with the wheel past a small magnetic sensor. Each tooth makes a ' +
        'pulse, so the pulse rate is the wheel speed, and a wheel that locks stops making pulses.',
      visuals: [
        'the wheel removed to show the toothed tone ring on the hub',
        'the wheel-speed sensor facing the teeth, flashing as each tooth passes',
        'a cable running from the sensor to the ABS computer',
      ],
    },
    {
      idea:
        'Grip depends on slip: how much slower the tyre surface turns than the road moves. Grip ' +
        'peaks near 15 percent slip and falls when the wheel locks, so a sliding tyre grips less ' +
        'than a rolling one.',
      visuals: [
        'a floating grip-versus-slip curve with its peak marked',
        'a marker riding the curve while the wheel slips from rolling to fully locked',
        'the contact patch changing colour from green to red as the wheel locks',
      ],
    },
    {
      idea:
        'The ABS unit sits in the brake line. An inlet valve passes pressure to the caliper; ' +
        'closing it holds the pressure; an outlet valve dumps fluid into an accumulator and a ' +
        'pump returns it. Hold, release, reapply.',
      visuals: [
        'the hydraulic unit: inlet valve, outlet valve, accumulator, return pump',
        'valve plungers moving and coils lighting as each phase starts',
        'fluid dots running to the caliper, then draining to the accumulator',
        'the caliper pads easing off and clamping again',
      ],
    },
    {
      idea:
        'The computer repeats hold, release, reapply up to 15 times a second, keeping the wheel ' +
        'near the peak of the grip curve. The pump pushes fluid back toward the pedal, which is ' +
        'the buzzing you feel.',
      visuals: [
        'the pedal kicking back in time with the pump',
        'the grip marker hovering around the peak',
        'the whole hydraulic circuit cycling together',
      ],
    },
    {
      idea:
        'A rolling wheel can steer. Two wheels turn the same way under hard braking: the locked ' +
        'one keeps sliding straight on, the ABS one follows where it points.',
      visuals: [
        'two wheels on the road steering together, one locked, one rolling',
        'a red travel arrow that stays straight and a green one that follows the wheel',
      ],
    },
    {
      idea:
        'Back together: sensor, computer, valves and pump releasing the brake before the wheel ' +
        'can lock. It stops fastest by letting go.',
      visuals: ['the complete wheel braking on the moving road with the ABS unit beside it'],
    },
  ],
};
