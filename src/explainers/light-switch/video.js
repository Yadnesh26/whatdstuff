// Editorial layer for video export (scripts/render.mjs).
//
// The script comes straight off story.js, which was written BEFORE the model:
//   angle  - flipping a switch sends nothing anywhere; the electrons were
//            already in the filament and on AC they never leave
//   stat   - ~0.2 mm/s drift, over an hour to cross one metre
//   button - "Nothing travelled. Everything moved."
//
// LOOP: planted in beat 2 ("the light is instant, but almost nothing inside
// actually moves") and closed word-for-word in the button. Shorts replay, so the
// button also sets the hook up again on the second pass.
//
// CUTTING: shots with no `narration` are SILENT CUTS riding inside the previous
// spoken line. 7 spoken beats across 20 shots, so the picture moves roughly
// every 3 seconds. Adding or removing them never re-synthesizes the take.
//
// FRAMING NOTE: `frame` keys resolve through the callout's PARENT object, so
// only callouts in the step's own active set are usable, and 'Free electron' is
// never framed on - it hangs off a single 0.03-unit sphere and would solve to a
// near-empty frame. 'Copper lattice' (parented to the whole macro insert) is the
// subject for every electron beat.
//
// NO em/en dashes: ElevenLabs renders them as dead air the speed knob cannot
// compress.
export default {
  hook: 'Flipping a switch sends\nnothing anywhere.',

  // meta.js's title compacts to "HAPPENS WHEN YOU FLIP A SWITCH" (compactTitle
  // strips the leading "What "), which is 30 characters and rendered clipped at
  // BOTH frame edges at 84px Arial Black. The card wants the subject, not the
  // sentence.
  titleCard: 'LIGHT SWITCH',

  render: {
    formats: ['short', 'long'],
    captions: true,
    titleCard: true,
    // Outward-facing promises to a viewer; off until explicitly asked for.
    endCard: false,
    followOverlay: false,
    captionStyle: 'bold-karaoke',
    fps: 30,
  },

  // `node scripts/make-sfx.mjs light-switch`. Concrete and DRY: baked reverb
  // cannot be removed, and a dry cue sits under narration far better.
  sfxLibrary: {
    'switch-click': {
      prompt: 'a single crisp domestic light switch clicking on, close microphone, dry, no reverb',
      seconds: 1.5,
      influence: 0.7,
    },
    'contact-snap': {
      prompt: 'a tiny sharp metallic snap of a sprung electrical contact closing, extreme close microphone, dry, no reverb',
      seconds: 1.2,
      influence: 0.75,
    },
    'mains-hum': {
      prompt: 'a faint steady fifty hertz electrical mains hum, continuous, low level, no music',
      seconds: 10,
      influence: 0.55,
    },
  },

  // 9:16 - ~80s. 7 spoken beats, 20 shots.
  short: {
    shots: [
      // --- beat 1: hook. The claim is word one. ------------------------------
      {
        step: 0,
        frame: null,
        fill: 0.8,
        push: 0.95,
        sfx: [{ file: 'switch-click', at: 0.15 }],
        narration:
          'When you flip a switch, nothing travels from the power station to your lamp. Nothing. The electrons that light it were already sitting inside the filament.',
      },
      { step: 0, frame: ['The lamp it feeds'], fill: 0.6, labels: ['The lamp it feeds'], seconds: 1.4 },
      { step: 0, frame: ['Wall plate'], fill: 0.66, labels: ['Wall plate'], seconds: 1.3 },

      // --- beat 2: stakes, and the loop gets planted -------------------------
      {
        step: 0,
        frame: ['The lamp it feeds'],
        fill: 0.62,
        labels: ['The lamp it feeds'],
        push: 0.94,
        narration:
          'They have been sitting in that filament since the day it was built. So the light is instant, but almost nothing inside actually moves.',
      },
      { step: 0, frame: null, fill: 0.8, seconds: 1.4 },

      // --- beat 3: say the mystery out loud ---------------------------------
      {
        step: 0,
        frame: ['Wall plate'],
        fill: 0.62,
        labels: ['Wall plate'],
        push: 0.93,
        narration: 'So what did the switch even do?',
      },

      // --- beat 4: the snap ---------------------------------------------------
      {
        step: 2,
        frame: ['Over-centre spring'],
        fill: 0.62,
        labels: ['Over-centre spring'],
        sfx: [{ file: 'contact-snap', at: 0.9 }],
        narration:
          'It closed a gap. A spring loads up, tips past its own centre, and slams two silver contacts shut in about a thousandth of a second. It has to be that fast, or they would arc and burn away.',
      },
      { step: 2, frame: ['Contacts snap shut'], fill: 0.6, labels: ['Contacts snap shut'], seconds: 1.5 },
      { step: 1, frame: ['Moving contact'], fill: 0.6, labels: ['Moving contact', 'Fixed contact'], seconds: 1.4 },
      { step: 2, frame: ['Over-centre spring'], fill: 0.56, labels: ['Over-centre spring'], move: 'cut', seconds: 1.3 },

      // --- beat 5: the copper, and how slow it really is ---------------------
      {
        step: 4,
        frame: ['Copper lattice'],
        fill: 0.7,
        orbit: 8,
        sfx: [{ file: 'mains-hum', at: 0.2 }],
        narration:
          'But that only completes a loop that was already there. Inside the copper, the electrons creep along at about a fifth of a millimetre per second. Slower than your fingernails grow.',
      },
      { step: 3, frame: ['To the lamp'], fill: 0.6, labels: ['To the lamp'], seconds: 1.4 },
      { step: 4, frame: ['Copper lattice'], fill: 0.62, push: 0.94, seconds: 1.5 },

      // --- beat 6: THE STAT, isolated, on a hard cut -------------------------
      {
        step: 4,
        frame: ['Copper lattice'],
        fill: 0.66,
        move: 'cut',
        push: 0.95,
        narration:
          'At that pace, one electron needs over an hour to cross a metre of lamp cord. On alternating current it never crosses at all. It just shudders in place, fifty times a second.',
      },
      { step: 4, frame: ['Copper lattice'], fill: 0.58, seconds: 1.6 },

      // --- beat 7: the button, closing the loop ------------------------------
      {
        step: 5,
        frame: ['The push, at near light speed'],
        fill: 0.72,
        sfx: [{ file: 'switch-click', at: 0.05 }],
        narration:
          'So while the electrons shudder in place, something else is racing down that wire. It is the push, moving at close to the speed of light. Nothing travelled. Everything moved.',
      },
      { step: 5, frame: null, fill: 0.78, seconds: 1.5 },
      { step: 6, frame: ['The lamp it feeds'], fill: 0.6, seconds: 1.5 },
      { step: 6, frame: null, fill: 0.8, seconds: 1.8 },
    ],
  },

  // 16:9 - ~2min. Same spine, developed, every step visited.
  long: {
    shots: [
      {
        step: 0,
        frame: null,
        push: 0.95,
        sfx: [{ file: 'switch-click', at: 0.2 }],
        narration:
          'When you flip a switch, nothing travels from the power station to your lamp. Not one electron makes that journey. The ones that light the filament were already sitting inside it, and they always were.',
      },
      { step: 0, frame: ['The lamp it feeds'], seconds: 2.2 },
      {
        step: 0,
        frame: ['Rocker'],
        push: 0.94,
        narration:
          'They have been in that filament since the day it was built, and they will die in it. So the light is instant, but almost nothing inside actually moves. Which raises an obvious question. What did the switch even do?',
      },
      { step: 0, frame: null, seconds: 2.2 },
      {
        step: 1,
        frame: ['Back box'],
        narration:
          'Behind the plate there is almost nothing. A brass terminal where the live wire arrives, a second one feeding the lamp, and a sprung steel blade carrying a small silver pad between them.',
      },
      { step: 1, frame: ['Moving contact'], seconds: 2.4 },
      { step: 1, frame: ['Fixed contact'], seconds: 2.2 },
      {
        step: 2,
        frame: ['Over-centre spring'],
        push: 0.94,
        sfx: [{ file: 'contact-snap', at: 1.4 }],
        narration:
          'Watch the contacts rather than the rocker. The rocker moves as slowly as your finger does, but the contacts refuse to follow it. A spring loads up until it tips past its own centre line, at which point the blade slams across in roughly a thousandth of a second.',
      },
      { step: 2, frame: ['Contacts snap shut'], seconds: 2.6 },
      {
        step: 3,
        frame: ['To the lamp'],
        narration:
          'It has to be that violent. A contact closing slowly draws an arc across the last of the gap, and that arc would eat the silver away in weeks. But all the snapping achieves is a complete loop, and the loop was already there waiting.',
      },
      { step: 3, frame: ['Live in'], seconds: 2.4 },
      {
        step: 4,
        frame: ['Copper lattice'],
        fill: 0.6,
        orbit: 10,
        sfx: [{ file: 'mains-hum', at: 0.3 }],
        narration:
          'This is that copper, blown up enormously. The orange cores are copper atoms locked in a lattice. The blue specks are the free electrons wandering between them, and there are roughly as many of those as there are atoms.',
      },
      { step: 4, frame: ['Copper lattice'], fill: 0.6, seconds: 2.6, push: 0.94 },
      {
        step: 4,
        frame: ['Copper lattice'],
        fill: 0.6,
        move: 'cut',
        narration:
          'And they are slow. In a lamp cord they creep along at about a fifth of a millimetre every second, slower than your fingernails grow. At that pace a single electron needs over an hour to cross one metre of cable.',
      },
      { step: 4, frame: ['Copper lattice'], fill: 0.6, seconds: 2.8 },
      {
        step: 5,
        frame: ['The push, at near light speed'],
        narration:
          'On alternating current it is worse than slow. It never gets anywhere. The current reverses fifty times a second, so each electron shudders back and forth across a few millionths of a metre and ends the day where it started.',
      },
      { step: 5, frame: null, fill: 0.7, seconds: 2.6 },
      {
        step: 5,
        frame: ['The push, at near light speed'],
        push: 0.94,
        narration:
          'So the thing racing down your wire is not electrons. It is the push itself, the electric field, sweeping along the copper at a large fraction of the speed of light. That is why the lamp answers instantly while the charge inside it is barely crawling.',
      },
      { step: 6, frame: ['The lamp it feeds'], seconds: 2.4 },
      {
        step: 6,
        frame: null,
        push: 1.1,
        sfx: [{ file: 'switch-click', at: 0.15 }],
        narration:
          'And nothing on the grid is stored, so that push runs all the way back up the line until something answers it. A square of plastic, a rocker, and a gap two millimetres wide. Nothing travelled. Everything moved.',
      },
      { step: 6, frame: null, seconds: 2.6 },
    ],
  },
};
