// Editorial layer for video export. FIREARM-ADJACENT: conceptual physics only
// (no dimensions, no build detail). The user explicitly asked for a short-form
// cut, accepting the age-restriction / demonetization risk of firearm content
// on short platforms; long-form is the primary home.
//
// One flowing single-take voiceover per format. Angle: "silencers don't
// silence". Stat: 30 dB off is a thousandth of the sound power, still ~130 dB.
// Loop planted in shot 2 ("it slows something down, and it isn't the bullet"),
// closed in the button (".
//
// steps: 0 the tube · 1 bare muzzle blast · 2 cutaway · 3 bullet passes
//        4 gas path · 5 side by side · 6 what is left (sonic crack)
// Portrait (9:16) cameras are authored: the rig is a long horizontal object, so
// the solver would shrink it to a strip. These look down the diagonal so the
// axis fills the tall frame.
const CAM = {
  WIDE: { position: [12.87, 6.46, 12.54], target: [0.9, 0.95, 0] },
  BARE: { position: [6.7, 3.02, 7.48], target: [1.6, 1.15, 0] },
  CUT: { position: [7.88, 4.95, 9.66], target: [2.0, 0.95, 0] },
  GAS: { position: [7.46, 4.53, 9.24], target: [2.0, 0.95, 0] },
  CMP: { position: [7.15, 10.12, 6.75], target: [2.4, 0.75, 0] },
  CRK: { position: [10.68, 4.45, 11.56], target: [3.2, 1.05, 0] },
};

export default {
  hook: 'A silencer doesn’t\nsilence anything.',

  render: {
    formats: ['short', 'long'],
    captions: true,
    titleCard: true,
    followOverlay: { short: true, long: false },
    fps: 30,
  },

  platforms: {
    youtube: {
      title: 'How a Gun Silencer Really Works (It Doesn’t Silence)',
      description:
        'A suppressed gunshot is still around 130 decibels. So what does the tube actually do? A 3D cutaway of the blast chamber and baffle stack shows how the burst of gas leaving the muzzle gets caught, turned, swirled and cooled, why that takes about 30 dB off (a thousandth of the sound power), and why the sonic crack of a fast bullet is left over.\n\nConceptual physics only, in the spirit of a manufacturer cutaway. Suppressors are regulated items in many places.\n\nEvery model on whatdstuff is built procedurally from scratch.',
      tags: ['how a silencer works', 'how does a suppressor work', 'suppressor explained', 'baffles', 'blast chamber', 'muzzle blast', 'sonic crack', 'decibels', '3D animation', 'how it works'],
    },
    shorts: {
      title: 'Silencers don’t silence anything',
      hashtags: ['#howitworks', '#physics', '#3danimation', '#engineering', '#explained'],
    },
  },

  short: {
    shots: [
      {
        step: 0,
        labels: [],
        camera: CAM.WIDE,
        narration:
          'A silencer doesn’t silence anything. Even with one on, a gunshot is around a hundred and thirty decibels, louder than a jackhammer.',
      },
      { step: 0, labels: [], camera: CAM.WIDE, push: 0.9, seconds: 2 },
      {
        step: 0,
        labels: [],
        camera: CAM.WIDE,
        narration: 'So what’s the tube for? It slows something down, and it isn’t the bullet.',
      },
      {
        step: 1,
        labels: [],
        camera: CAM.BARE,
        narration:
          'Without it, the barrel is full of gas at enormous pressure. The moment the bullet leaves, that gas hits open air all at once. That pop is most of the bang.',
      },
      { step: 1, labels: [], camera: CAM.BARE, push: 0.88, seconds: 2.5 },
      {
        step: 2,
        labels: [],
        camera: CAM.CUT,
        narration:
          'Cut the tube open and it’s mostly empty space. One wide blast chamber, then a stack of cone baffles.',
      },
      { step: 2, labels: [], camera: CAM.CUT, orbit: 14, seconds: 2 },
      {
        step: 3,
        labels: [],
        camera: CAM.CUT,
        narration:
          'The bullet, though, flies straight down the middle, through holes wider than itself. It never touches a thing.',
      },
      {
        step: 4,
        labels: [],
        camera: CAM.GAS,
        narration:
          'The gas can’t fly straight. It’s turned aside by every cone, swirls, and dumps its heat into the steel. One violent pop becomes a long, weak push.',
      },
      { step: 4, labels: [], camera: CAM.GAS, push: 0.88, seconds: 2.5 },
      {
        step: 5,
        labels: [],
        camera: CAM.CMP,
        move: 'cut',
        narration:
          'Here’s the part that gets me. Thirty decibels off is only a thousandth of the sound power. The shot is still around a hundred and thirty.',
      },
      { step: 5, labels: [], camera: CAM.CMP, move: 'cut', seconds: 2.5, orbit: 10 },
      {
        step: 6,
        labels: [],
        camera: CAM.CRK,
        narration:
          'What’s left is the bullet itself, outrunning sound and dragging its own crack behind it.',
      },
      {
        step: 0,
        labels: [],
        camera: CAM.WIDE,
        narration: 'It never silenced anything. It slowed things down.',
      },
    ],
  },

  long: {
    shots: [
      {
        step: 0,
        narration:
          'A silencer doesn’t silence anything. Put one on a gun and the shot is still around a hundred and thirty decibels, louder than a jackhammer. So what is this steel tube actually for?',
      },
      {
        step: 1,
        narration:
          'To find out, take it off. Behind every bullet, the barrel is full of propellant gas at enormous pressure. The instant the bullet clears the muzzle, that gas hits open air and expands all at once, with a flash. That sudden release is most of the bang.',
      },
      {
        step: 2,
        narration:
          'So the tube’s real job is to catch the gas. Cut it open and it’s mostly empty space: a wide blast chamber right at the muzzle, then a stack of cone-shaped baffles, each with one hole on the centre line.',
      },
      {
        step: 3,
        narration:
          'The bullet flies straight through those holes, which are wider than it is, and never touches the metal. The bullet was never the thing being slowed down.',
      },
      {
        step: 4,
        narration:
          'The gas is. It follows the bullet in, fills the blast chamber and expands, losing pressure. To get out it has to squeeze through hole after hole, and every cone turns part of it aside into a chamber where it swirls, slows and cools. The steel soaks up the heat. One violent pop leaves as a long, weak push.',
      },
      {
        step: 5,
        camera: { position: [3.4, 10.5, 6.5], target: [1.2, 1.0, 0.7] },
        narration:
          'Put the two side by side. The bare muzzle hits open air at full pressure, while the suppressed one just leaks. A good one takes roughly twenty to thirty decibels off. Thirty decibels sounds like a lot, but it’s only a thousandth of the sound power, and the shot is still around a hundred and thirty.',
      },
      {
        step: 6,
        narration:
          'And there’s a floor. A rifle bullet travels faster than sound, so it drags its own shock wave, a sonic crack, all the way downrange. No tube can touch that. The movie version, the little pfft, is fiction. These are tightly regulated in many places for good reason.',
      },
      {
        step: 0,
        narration: 'So a silencer never silenced anything. It slowed things down.',
      },
    ],
  },
};
