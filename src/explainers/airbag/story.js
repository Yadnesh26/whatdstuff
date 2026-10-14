// Phase 0 artifact — written BEFORE the model (add-explainer skill, Phase 0).
// Pure data, no imports, never bundled: the registry globs only meta.js and
// index.js. This is the record of what the explainer is FOR, and the contract
// the model must satisfy.
//
// SCOPE NOTE: the DRIVER-side frontal airbag (steering-wheel module, dual-stage
// pyrotechnic inflator), tested against a fixed barrier. Not the passenger,
// curtain or side bags, and not the seatbelt pretensioner it works alongside.
//
// SOURCES (research pass): Wikipedia "Airbag" (ACU decides in 15-30 ms; bag
// fills in ~20-30 ms; fully inflated 60-80 ms after first contact; ~40 ms from
// onset; US rule = deploy at or above a ~23 km/h (14 mph) barrier crash;
// MEMS capacitive accelerometer; NaN3 -> Na + N2, Na + KNO3 -> N2, silicate
// slag; modern guanidine-nitrate and hybrid stored-gas inflators; vents; cover
// flaps designed to tear; dual-stage since 1998), plus patents on squib
// bridgewire, filter cooling, dual chambers, and ~300 km/h gas-front speed.
export default {
  angle:
    'An airbag is a controlled explosion that is already letting go by the time you hit it. ' +
    'The bag is not a balloon you bounce off: it is built to leak, so it absorbs you instead of throwing you back.',

  stat: 'About 40 milliseconds from first contact to a full bag, after the control unit has spent roughly 20 of them deciding.',

  button: 'It was already letting go.',

  who: 'Anyone who has wondered how a bag can go off in a blink and still not punch the driver in the face.',

  beats: [
    {
      idea: 'A driver airbag is invisible until it is needed: a flat cover on the steering wheel with a seam down the middle.',
      visuals: ['the steering wheel with its hub cover and seam, solid and ordinary', 'a headform ahead of the wheel standing in for the driver'],
    },
    {
      idea: 'Behind the cover is a nylon bag folded into a can, sitting on a steel inflator with a tiny igniter wired to the car.',
      visuals: ['the module cut open', 'the folded bag, the inflator and its squib with the yellow wire'],
    },
    {
      idea: 'A crash sensor in the crumple zone and an accelerometer in the control unit feel the deceleration. The unit integrates it and decides in about 20 ms.',
      visuals: ['the barrier hitting the bumper and the crush can folding', 'the signal travelling the yellow wire to the control unit', 'the MEMS accelerometer comb deflecting and a threshold gauge filling'],
    },
    {
      idea: 'The control unit fires a current through the squib. It lights a ring of propellant pellets in the inflator, which burn into gas in a few milliseconds.',
      visuals: ['current reaching the squib', 'the pellet ring burning outward', 'gas leaving through the filter and the ports'],
    },
    {
      idea: 'The gas bursts the cover along its seam and fills the bag in a few tens of milliseconds, before the occupant has moved.',
      visuals: ['the cover splitting into two flaps', 'the bag unfolding and inflating', 'the clock reading about 40 ms'],
    },
    {
      idea: 'The bag has vent holes, so the moment the occupant loads it, the gas escapes and the bag cushions instead of rebounding.',
      visuals: ['the headform meeting the bag', 'gas streaming out of the vent holes', 'the bag collapsing around the headform'],
    },
    {
      idea: 'A dual-stage inflator has two propellant chambers: light on a mild crash, both on a severe one.',
      visuals: ['stage 1 firing alone, the second chamber untouched', 'stage 2 firing a few milliseconds later'],
    },
    {
      idea: 'Run as a whole, the whole event is over in a tenth of a second.',
      visuals: ['the complete rig cycling through a crash'],
    },
  ],
};
