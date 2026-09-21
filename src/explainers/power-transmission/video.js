// Editorial layer for video export (scripts/render.mjs).
//
// REWRITTEN 2026-09-13. The previous script was the legacy shape: per-shot
// `caption` fields (the verbatim rail ignores them), `dolly`/`seconds` from
// before the framing solver, no `render` block, and one shot per spoken line.
// lint-script flagged ten findings on it: no hook sync, no spoken question, no
// stat, no callback, and four lines that shared no idea with the one before.
//
// ANGLE: the grid's headline number is 400,000 volts, and almost everything the
// grid then does is spent taking that back off again. That is the hook, the
// loop, and the button.
//
// CUTTING: shots with no `narration` are SILENT CUTS riding inside the previous
// spoken line (see export-content "Cutting"). The short runs 7 spoken beats
// across 22 shots, so the picture changes roughly every 3 seconds instead of
// holding one angle for nine. Adding or removing them never re-synthesizes the
// take - timings are matched positionally to the spoken shots.
//
// NO em/en dashes anywhere: ElevenLabs renders them as dead-air pauses that the
// speed knob cannot compress.
export default {
  hook: 'To reach your wall, it first\nbecomes 400,000 volts.',

  // Closing card, held over the silent tail AFTER the last spoken caption. The
  // button ("step it up, just to step it down") is the last thing HEARD; this is
  // the last thing READ, so the video lands on the ingenuity rather than on the
  // mechanism. Kept quiet on purpose: SOUL.md bans "amazing"/"revolutionary" and
  // asks for wonder without hype, so the awe is carried by the plain fact that a
  // person had to invent every stage of this.
  // Measured at the real burn font (84px Arial Black): 742px and 591px, against
  // the 960px short-form budget.
  endCard: 'Someone had to\nthink of that.',

  render: {
    formats: ['short', 'long'],
    captions: true,
    titleCard: true,
    // The end card is an outward-facing beat, so it stays off until asked for.
    // It was asked for: a one-line conclusion over the tail. The follow overlay
    // is a separate promise and stays off.
    endCard: true,
    followOverlay: false,
    captionStyle: 'bold-karaoke',
    fps: 30,
  },

  // Generated once by `node scripts/make-sfx.mjs power-transmission`.
  // Concrete and DRY: reverb baked into a cue cannot be removed, and a dry cue
  // sits under narration far better than a wet one.
  sfxLibrary: {
    'transformer-hum': {
      prompt: 'a deep steady electrical transformer hum at 100 hertz, continuous, industrial, no music',
      seconds: 10,
      influence: 0.6,
    },
    'line-wind': {
      prompt: 'wind moving across high voltage transmission lines in open country, faint electrical crackle',
      seconds: 8,
      influence: 0.45,
    },
    'switch-click': {
      prompt: 'a single crisp domestic light switch clicking on, close microphone, dry, no reverb',
      seconds: 1.5,
      influence: 0.7,
    },
  },

  // 9:16 - ~62s. 7 spoken beats, 22 shots.
  // Spine: hook -> stakes+loop -> spoken question -> BUT/THEREFORE mechanism ->
  // isolated stat -> so-what -> callback button closing the loop.
  short: {
    shots: [
      // --- beat 1: the hook, over the whole journey -------------------------
      {
        step: 0,
        // The whole-journey model is ~10:1, so fitted to a 9:16 frame's WIDTH it
        // occupies about a tenth of the height: a sliver, as the opening image.
        // Open where the four hundred thousand volts actually happens; the silent
        // beat two shots later flashes the full sprawl.
        frame: ['Power plant', 'Step-up transformer'],
        labels: ['Power plant', 'Step-up transformer'],
        fill: 0.72,
        push: 0.95,
        sfx: [{ file: 'transformer-hum', at: 0.2, gain: 0.5 }],
        narration:
          'To reach your wall, electricity first gets pushed to four hundred thousand volts. The rest of its journey is spent taking that back down.',
      },
      { step: 0, frame: ['Power plant'], labels: ['Power plant'], fill: 0.6, seconds: 1.4 },
      { step: 1, frame: ['Step-up transformer'], labels: ['Step-up transformer'], fill: 0.58, seconds: 1.6, push: 0.95 },
      { step: 0, frame: null, seconds: 1.3 },

      // --- beat 2: stakes, and the loop gets planted ------------------------
      {
        step: 2,
        frame: ['Transmission towers'],
        labels: ['Transmission towers'],
        fill: 0.62,
        orbit: 8,
        sfx: [{ file: 'line-wind', at: 0.1, gain: 0.5 }],
        narration:
          'Which sounds insane. You have built an enormous machine whose main job is undoing its own first move.',
      },
      { step: 3, fill: 0.6, frame: ['Substation'], labels: ['Substation'], seconds: 1.3 },
      { step: 5, fill: 0.6, frame: ['Your house'],
        labels: ['Your house'], seconds: 1.4 },

      // --- beat 3: say the question out loud --------------------------------
      {
        step: 1,
        frame: ['Step-up transformer'],
        labels: ['Step-up transformer'],
        fill: 0.58,
        push: 0.95,
        narration: 'So why raise it at all?',
      },

      // --- beat 4: the mechanism, BUT/THEREFORE -----------------------------
      {
        step: 1,
        frame: ['Step-up transformer'],
        labels: ['Step-up transformer'],
        fill: 0.58,
        narration:
          'Because a wire does not waste energy based on its voltage. It wastes energy based on its current, and it wastes it as the square of it.',
      },
      { step: 1, fill: 0.58, frame: ['Step-up transformer'], labels: ['Step-up transformer'], seconds: 1.5 },
      { step: 2, fill: 0.6, frame: ['Lattice steel tower'], labels: ['Lattice steel tower'], seconds: 1.6 },
      { step: 1, fill: 0.52, frame: ['Step-up transformer'],
        labels: ['Step-up transformer'], seconds: 1.4 },

      // --- beat 5: THE STAT, isolated, on a hard cut ------------------------
      {
        step: 1,
        frame: ['Step-up transformer'],
        labels: ['Step-up transformer'],
        fill: 0.56,
        move: 'cut',
        push: 0.95,
        narration:
          'So push the voltage ten times higher, the current falls ten times, and the heat you lose drops to one hundredth.',
      },
      { step: 2, fill: 0.62, frame: ['Lattice steel tower'],
        labels: ['Lattice steel tower'], seconds: 1.7 },

      // --- beat 6: so-what, back down in stages -----------------------------
      {
        step: 3,
        frame: ['Step-down transformer'],
        labels: ['Step-down transformer'],
        fill: 0.6,
        orbit: -6,
        narration:
          'But nothing in your house survives four hundred thousand volts, so it comes back down in stages. A substation, a street pole, the grey can outside your window.',
      },
      { step: 4, fill: 0.6, frame: ['Distribution poles'], labels: ['Distribution poles'], seconds: 1.5 },
      { step: 4, fill: 0.6, frame: ['Wooden distribution pole'], labels: ['Wooden distribution pole'], seconds: 1.5, push: 0.95 },
      { step: 5, fill: 0.6, frame: ['Meter'], labels: ['Meter'], seconds: 1.4 },
      { step: 5, fill: 0.6, frame: ['Breaker panel'],
        labels: ['Breaker panel'], seconds: 1.3 },

      // --- beat 7: the button, closing the loop -----------------------------
      {
        step: 6,
        frame: ['Step-up transformer', 'Step-down transformer'],
        labels: ['Step-up transformer', 'Step-down transformer'],
        fill: 0.72,
        push: 1.1,
        sfx: [{ file: 'switch-click', at: 0.1 }],
        narration:
          'Every one of those steps exists to undo the first. Step it up, just to step it down.',
      },
      { step: 0, fill: 0.6, frame: ['Power plant'], labels: ['Power plant'], seconds: 1.4 },
      { step: 5, fill: 0.6, frame: ['Your house'], labels: ['Your house'], seconds: 1.5 },
      { step: 6, fill: { w: 0.98, h: 0.5 }, frame: null, seconds: 1.8 },
    ],
  },

  // 16:9 - ~2min. Same spine, room to breathe, every step visited.
  long: {
    shots: [
      {
        step: 0,
        frame: null,
        push: 0.94,
        sfx: [{ file: 'transformer-hum', at: 0.3, gain: 0.5 }],
        narration:
          'The electricity in your wall may have started four hundred kilometres away. To make that trip it is first pushed up to something like four hundred thousand volts. Almost everything the grid does from there is spent taking that back off again.',
      },
      { step: 0, fill: 0.6, frame: ['Power plant'], seconds: 2.2 },
      { step: 0, fill: 0.6, frame: ['Your house'], seconds: 2.2 },
      {
        step: 1,
        frame: ['Step-up transformer'],
        push: 0.92,
        narration:
          'Which, put like that, sounds like a machine arguing with itself. You build an enormous chain of transformers whose main job is undoing the very first thing you did. So why raise it at all?',
      },
      { step: 1, fill: 0.6, frame: ['Step-up transformer'], seconds: 2.4 },
      {
        step: 1,
        frame: ['Step-up transformer'],
        fill: 0.58,
        narration:
          'Because of one detail about wires. A wire does not lose energy according to the voltage you put across it. It loses energy according to the current flowing through it, and it loses it as the square of that current.',
      },
      { step: 1, fill: 0.6, frame: ['Step-up transformer'], seconds: 2.6, push: 0.95 },
      {
        step: 1,
        frame: ['Step-up transformer'],
        move: 'cut',
        narration:
          'And power is voltage times current. So for the same power delivered, ten times the voltage means a tenth of the current, and a tenth of the current means one hundredth of the heat left behind in the line.',
      },
      { step: 2, frame: null, seconds: 2.4 },
      {
        step: 2,
        frame: ['Transmission towers'],
        fill: 0.62,
        orbit: 8,
        sfx: [{ file: 'line-wind', at: 0.2, gain: 0.5 }],
        narration:
          'That is the whole reason those towers exist. They hold the conductors high and far apart, because at these voltages electricity will happily jump any shortcut it is offered, including the air itself.',
      },
      { step: 2, fill: 0.6, frame: ['Lattice steel tower'], seconds: 2.6 },
      {
        step: 3,
        frame: ['Substation'],
        fill: 0.62,
        orbit: -6,
        narration:
          'But nothing you own could survive that, so the grid begins giving it back. At a substation near your town, big transformers drop it from transmission levels to the medium voltage that feeds a whole region.',
      },
      { step: 3, fill: 0.6, frame: ['Step-down transformer'], seconds: 2.5 },
      { step: 3, fill: 0.6, frame: ['High voltage arrives here'], seconds: 2.2 },
      {
        step: 4,
        frame: ['Distribution poles'],
        fill: 0.66,
        narration:
          'From there it runs down the ordinary poles on ordinary streets, branching neighbourhood by neighbourhood, and getting trimmed lower at each junction.',
      },
      { step: 4, fill: 0.6, frame: ['Wooden distribution pole'], seconds: 2.4, push: 0.95 },
      {
        step: 5,
        frame: ['Your house'],
        fill: 0.6,
        narration:
          'The last transformer is usually the grey can on the pole outside your window. It makes the final drop to household voltage, and only then does it pass your meter, reach your breaker panel, and wait in the wall.',
      },
      { step: 5, fill: 0.6, frame: ['Meter'], seconds: 2.2 },
      { step: 5, fill: 0.6, frame: ['Breaker panel'], seconds: 2.2 },
      {
        step: 6,
        frame: null,
        push: 1.12,
        sfx: [{ file: 'switch-click', at: 0.2 }],
        narration:
          'Step up, travel far, step down, branch out, step down again. Every one of those stages exists to undo the first one, and the whole relay is standing ready before you have finished reaching for the switch. Step it up, just to step it down.',
      },
      { step: 0, frame: null, seconds: 2.6 },
    ],
  },
};
