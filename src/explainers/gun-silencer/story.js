// Phase 0 artifact: written BEFORE the model. Pure data, never bundled.
//
// SCOPE NOTE: conceptual physics only, at the level of an encyclopedia or a
// manufacturer's marketing cutaway. No dimensions, no build or conversion
// detail anywhere (model, copy, narration, post copy). Suppressors are
// regulated items in many places and the copy may say so.
//
// SOURCES (research pass): Wikipedia "Suppressor" (a metal cylinder with
// internal baffles and a bore the bullet passes through; gas routed on a longer
// winding path, slowed and spread over more surface; typically about four to
// fifteen chambers; steel absorbs heat; suppressed gunshots regularly measure
// above 130 dB; US OSHA uses 140 dB as the impulse-noise cutoff; measured peak
// reductions in studies range roughly 17 to 32 dB; supersonic bullets make a
// sonic crack that only subsonic ammunition removes; some designs raise
// backpressure and push gas back toward the shooter; reduced muzzle flash by
// containing the gas), Wikipedia "Muzzle flash" (muzzle blast is the sudden
// release of high-temperature, high-pressure gas), and manufacturer cutaway
// explainers (silencershop, ruggedsuppressors) for the blast chamber plus
// baffle sequence. 10 dB is a factor of 10 in sound power, so 30 dB is 1000x.
export default {
  angle:
    'Silencers do not silence. A suppressed gunshot is still around jackhammer-plus loud. ' +
    'The tube does one job: it catches the burst of high-pressure gas leaving the muzzle and makes it expand, swirl and cool, so it escapes slowly instead of in one violent pop.',

  stat: 'About 30 decibels off is only one thousandth of the sound power, and the shot is still around 130 decibels.',

  button: 'Not silenced. Just slowed down.',

  who: 'Anyone whose idea of a silencer comes from movies, where it goes pfft, and who has never seen what is inside.',

  beats: [
    {
      idea: 'A suppressor is a plain steel tube on the end of a barrel, and the name overpromises.',
      visuals: ['the complete sealed tube on a barrel stub', 'the bullet leaving the front cap with a small wisp of gas'],
    },
    {
      idea: 'Without it the barrel is full of high-pressure gas that bursts into open air the instant the bullet clears: that burst is most of the bang.',
      visuals: ['the bare muzzle with a violent expanding gas burst and flash', 'a shock shell expanding from the muzzle'],
    },
    {
      idea: 'Inside, the tube is mostly empty space: a big blast chamber, then a stack of cone baffles, each with one hole on the centre line.',
      visuals: ['the tube cut open', 'the blast chamber', 'the stack of cone baffles', 'the bore line'],
    },
    {
      idea: 'The bullet flies straight through the holes without touching metal; only the gas gets caught.',
      visuals: ['the bullet crossing the whole cutaway on the centre line', 'gas trailing behind it'],
    },
    {
      idea: 'The gas expands, is turned aside by each cone, swirls, cools and soaks its heat into the steel before it leaves.',
      visuals: ['gas particles coloured by pressure and temperature', 'swirl in each chamber', 'baffles warming up'],
    },
    {
      idea: 'Same shot, two muzzles: one pop versus one slow, weak leak. About 30 dB is a thousandth of the sound power, yet still about 130 dB.',
      visuals: ['two rigs side by side, bare and suppressed', 'a violent burst next to a weak wisp', 'dB readouts'],
    },
    {
      idea: 'What is left is the bullet itself: faster than sound it drags a sonic crack, and the can cannot touch that.',
      visuals: ['expanding shock shells trailing the bullet forming a cone', 'sealed tube from outside'],
    },
  ],
};
