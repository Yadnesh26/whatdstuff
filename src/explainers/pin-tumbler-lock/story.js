// The story contract for pin-tumbler-lock, written BEFORE the model.
// Every `visuals` entry is a promise the procedural model must keep.
export default {
  angle:
    'A lock never checks your key. It is just a cylinder inside a cylinder with a ' +
    'gap between them, and the key’s only job is to stop blocking that gap — which ' +
    'is why a bent wire opens it too.',
  stat:
    'The gap the pins have to clear is about 0.004 inch wide — one sheet of paper — ' +
    'and the chambers around it are drilled a thousandth of an inch out of line.',
  button: 'Nothing in there ever checked your key.',
  who:
    'Anyone who has locked a padlock and assumed it recognised their key — and anyone ' +
    'who has watched a lockpicking video and never understood why it works.',
  beats: [
    {
      idea: 'The sealed brass padlock: from outside, the key looks like a password.',
      visuals: [
        'a complete solid brass padlock on a studio plinth, shackle closed',
        'the keyway slot on its underside, a real hole in the plug face',
      ],
    },
    {
      idea:
        'There is no lock in there — only a plug inside a shell, and the hairline gap ' +
        'between them. The plug is already free to turn; something just has to not block it.',
      visuals: [
        'the front half of the brass body removed, showing the round plug inside the shell',
        'the shear line traced as a bright accent circle between plug and shell',
        'the plug twitching against something that stops it',
      ],
    },
    {
      idea:
        'Locked is a physical jam: five springs shove five driver pins across the gap, ' +
        'so each pin is half in the plug and half in the shell at once.',
      visuals: [
        'five chambers, each with spring, driver pin, key pin, stacked and pushed inward',
        'the driver pins crossing the accent shear line',
        'the plug trying to rotate and being stopped dead by the pins',
      ],
    },
    {
      idea:
        'The key is not a code being read — it is five ramps of five heights, and each ' +
        'one lifts its stack until the split between the two pins lands on the gap.',
      visuals: [
        'the cut key sliding up into the keyway, riding each key pin up its ramp',
        'five splits arriving on the shear line at once',
        'the shear line clear from end to end',
      ],
    },
    {
      idea:
        'Now nothing is in the way: the plug turns, its cam drives the ball bearings out ' +
        'of the shackle notches, and the shackle spring throws it open.',
      visuals: [
        'the plug rotating 90° with the key',
        'the cam at the back of the plug pushing two ball bearings out of the shackle notches',
        'the shackle springing up out of the body',
      ],
    },
    {
      idea:
        'A wrong key fails the same way a stick would: one stack too low, one pushed too ' +
        'high, so pin metal still crosses the gap. The lock never compared anything.',
      visuals: [
        'a wrong key inserted: one pin left short of the shear line, one overlifted above it',
        'the shear line blocked in two places while three chambers sit perfectly clear',
        'the plug stopping after a few degrees of rotation',
      ],
    },
    {
      idea:
        'The manufacturing flaw: the chambers are not in a perfect line, so under turning ' +
        'pressure exactly one pin binds first. A pick sets it on the ledge, the plug creeps, ' +
        'the next pin binds. Five one-pin puzzles instead of one five-pin puzzle.',
      visuals: [
        'a tension wrench in the bottom of the keyway rotating the plug a fraction of a degree',
        'the plug lip shown slightly out of round, one chamber pinching its driver pin',
        'a hook pick lifting the bound pin until the driver pin catches on the plug ledge',
        'the pins setting one after another until the plug turns with no key in it',
      ],
    },
    {
      idea:
        'Whole again, running: key in, five splits line up, shackle opens. It is a gap, ' +
        'five springs and a tolerance — not a judgement.',
      visuals: [
        'the solid brass padlock reassembled, turning on its plinth',
        'a full lock-and-open cycle at speed',
      ],
    },
  ],
};
