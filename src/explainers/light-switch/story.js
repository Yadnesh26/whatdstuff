// Phase 0 artifact — written BEFORE the model (add-explainer skill, Phase 0).
// Pure data, no imports, never bundled: the registry globs only meta.js and
// index.js. This is the record of what the explainer is FOR, and the contract
// the model must satisfy.
//
// SCOPE NOTE: `power-transmission` ("How Power Reaches Your House") and the
// `electricity-to-your-home` film already tell the grid journey — plant, towers,
// substation, poles. This explainer deliberately does NOT retell it. It stands
// at the switch and answers the question that journey never touches: what
// actually travels when you flip it. The grid appears only in the last beat, as
// the thing that answers.
export default {
  angle:
    'Flipping a switch sends nothing anywhere. The electrons that light the bulb ' +
    'were already sitting in the filament, and on AC they never leave — they shudder ' +
    'in place a few micrometres, 50 times a second. What races down the wire is not ' +
    'electrons but the PUSH, and it moves at close to the speed of light.',

  stat: 'An electron in your lamp cord drifts about 0.2 mm per second — over an hour to cross one metre. On AC it never crosses at all.',

  button: 'Nothing travelled. Everything moved.',

  who: 'Anyone who has flipped a switch and never once wondered what the click actually did.',

  beats: [
    {
      idea: 'A wall switch is a sealed plastic rectangle that does exactly one thing: it opens and closes a gap.',
      visuals: ['the finished switch plate on a wall, solid and ordinary', 'a finger-less rocker flipping, the bulb lighting'],
    },
    {
      idea: 'Under the plate it is a lever, a spring, and two pieces of metal that either touch or do not.',
      visuals: ['the plate ghosting away to expose the mechanism', 'the rocker, the spring, the fixed and moving contacts, the terminals'],
    },
    {
      idea: 'The spring is over-centre: it snaps the contacts shut fast, because a slow close would draw an arc that would burn the metal away.',
      visuals: ['the over-centre spring going past its tipping point', 'the contact SNAPPING the last of the gap shut, faster than the rocker moves'],
    },
    {
      idea: 'Closing the gap completes a loop that was always there — the wire to the lamp was live and waiting on one side.',
      visuals: ['the complete circuit loop lighting up: switch, cord, lamp, back'],
    },
    {
      idea: 'Inside the copper, the electrons were already everywhere. They do not set off on a journey; on AC they just shudder in place.',
      visuals: ['a macro cutaway of the copper lattice', 'electrons jittering back and forth in place, net movement zero'],
    },
    {
      idea: 'What actually travels is the push — the electric field down the wire — at a large fraction of light speed. That is why the bulb is instant while the electrons are glacial.',
      visuals: ['a pulse racing the length of the cord while the electrons barely twitch'],
    },
    {
      idea: 'Nothing is stored anywhere, so the demand runs all the way back: the plant answers the instant you close the gap.',
      visuals: ['the wire leaving the frame toward the grid', 'the whole switch running its cycle again, sealed'],
    },
  ],
};
