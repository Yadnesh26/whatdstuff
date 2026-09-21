// Editorial layer for video export (scripts/export-video.mjs).
//
// LENS (from story.js): gravity is not a force that pulls. Free fall is the
// no-force state, and what you feel as weight is the floor shoving you off the
// path you would otherwise take. Planted loop: "the only thing you've ever
// felt" (shot 1) -> "the floor stops you" (button), which also re-primes the
// hook on replay.
//
// SCRIPTING: one flowing single-take voiceover; every line hands off into the
// next (shot 4 ends on a spoken question, shot 7 answers it with "Zero"). No
// em/en dashes and no ellipses anywhere, since ElevenLabs renders both as dead
// air the speed knob cannot compress.
//
// STAT PLACEMENT: the isolated number is the 0.97 light-year radius of the
// free-fall worldline, not the 33 cm clock gap or the 3.6e-17 rate difference.
// Those two are staged earlier as credibility toward the mechanism; the
// light-year is the one nobody sees coming, so it gets a hard cut and its own
// beat with no callouts competing for the frame.
//
// LABEL TRAP: export-video matches `labels` against a callout's LIVE
// textContent. The exterior set's readout pill is rewritten every frame by
// model.js (Readout · 1.000 g -> 0.000 g -> ...), so it can never be named
// here. Shots on steps 0 and 8 use `labels: []` instead.
export default {
  hook: 'Nothing is pulling you down right now.',

  // Declared render config (see export-content skill, step 0). Captions and
  // the follow overlay were both requested explicitly by name.
  render: {
    formats: ['short'],
    captions: true,
    captionStyle: 'bold-karaoke',
    titleCard: true,
    endCard: false,
    followOverlay: true,
    fps: 30,
  },

  // 9:16 — ~87s at the channel voice's pace (201 words, 9 spoken beats, 23 shots).
  //
  // FRAMING NOTES (read off the storyboard sheet, not guessed):
  //  1. The solver owns distance, so there is no `dolly` anywhere.
  //  2. player.js subjectRoots() falls back to a callout's bare anchor POINT
  //     when the callout is parented straight to the model root, which fits a
  //     zero-size box. So 'Evacuated drop column', 'Earth · 5.97e24 kg...' and
  //     the exaggeration pill can never be framed on. The rig is framed on
  //     'Release clamp' + 'Catch cradle' instead, which spans the column.
  //  3. frame:null means the WHOLE visible model, and that includes the 3.0u
  //     plinth. The first cut used it for the hero and the rig came out at 36%
  //     of frame height, marooned in empty deck. Only the lattice shots want
  //     that much width now.
  //  4. A small FLAT part (a pickoff plate, a spring, the 0.05u orbit bead)
  //     fitted to the default 0.88 fill puts the lens on top of it and fills
  //     the frame with defocused surface. Macros here run fill 0.3 to 0.5 so
  //     the part reads in its context.
  short: {
    shots: [
      {
        // Zone 1+2 — hook + planted loop, on the complete sealed rig. No
        // callouts: the claim names no part, and a clean product shot is what
        // stops the scroll.
        step: 0,
        labels: [],
        frame: ['Release clamp', 'Catch cradle'],
        fill: 0.68,
        narration:
          "Nothing is pulling you down right now. That weight you feel is the floor pushing up, and it's the only thing you've ever felt.",
      },
      {
        step: 0,
        labels: ['Evacuated drop column'],
        frame: ['Release clamp', 'Catch cradle'],
        fill: 0.62,
        push: 0.9,
        seconds: 3.2,
      },
      { step: 0, labels: ['Release clamp'], frame: ['Release clamp'], fill: 0.3, seconds: 2.8 },

      {
        // Zone 3 — the instrument, and the spoken question that sets up the drop
        step: 1,
        labels: ['Proof mass', 'Capacitive pickoff plates'],
        frame: ['Proof mass', 'Capacitive pickoff plates'],
        fill: 0.6,
        narration:
          'An accelerometer proves it. Inside, a weight hangs on springs between two plates, and held still it reads one g. So what happens when the clamp lets go?',
      },
      {
        step: 1,
        labels: ['Suspension springs'],
        frame: ['Suspension springs'],
        fill: 0.45,
        seconds: 3.0,
      },
      {
        // the frame the next line's "Zero" pays off against: mass sitting low
        step: 1,
        labels: ['Proof mass'],
        frame: ['Proof mass'],
        fill: 0.42,
        push: 0.92,
        seconds: 3.4,
      },

      {
        // Zone 4a — the payoff of the hook, on its own hard beat.
        // MOVING-SUBJECT TRAP: 'Proof mass' is parented to pmMass, which rides
        // the capsule down 1.13u. Framing on it solves the box where the mass
        // was at shot start, and the whole payoff then falls out of frame. Both
        // shots here frame the STATIC column span instead, so the drop happens
        // inside the frame instead of leaving it.
        step: 2,
        labels: ['Proof mass'],
        frame: ['Release clamp', 'Catch cradle'],
        fill: 0.6,
        narration:
          'Zero. Not a glitch. In free fall nothing acts on it, so the weight floats dead centre.',
      },
      {
        step: 2,
        labels: ['Proof mass'],
        frame: ['Release clamp', 'Catch cradle'],
        fill: 0.55,
        push: 0.93,
        bias: 0.16,
        seconds: 3.2,
      },

      {
        // Zone 4b — BUT: something still has to choose the path
        step: 3,
        labels: ['Planes of equal clock time'],
        frame: null,
        narration:
          'But something still has to choose the path. Mass bends the geometry around it, and free things take the straightest line available.',
      },
      {
        step: 3,
        labels: ['Packed tighter = time runs slower'],
        frame: ['Packed tighter = time runs slower'],
        seconds: 3.2,
      },
      {
        // settle down toward the crowded warm planes at the base
        step: 3,
        labels: ['Earth · 5.97e24 kg, 6371 km down'],
        frame: null,
        rise: -0.2,
        seconds: 3.0,
      },

      {
        // Zone 4c — the re-hook, and the real mechanism: it is TIME
        step: 4,
        labels: ['Upper clock · +33 cm', 'Lower clock · reference'],
        frame: ['Upper clock · +33 cm', 'Lower clock · reference'],
        fill: 0.6,
        bias: 0.16,
        narration:
          "Here's the part that gets me. That bending is in time, not space. Clocks lower down genuinely run slower, and we've measured it across thirty three centimetres.",
      },
      {
        step: 4,
        labels: ['Upper clock · +33 cm'],
        frame: ['Upper clock · +33 cm'],
        fill: 0.5,
        seconds: 3.2,
      },
      {
        step: 4,
        labels: ['Rate gap 3.6e-17, amplified'],
        frame: ['Rate gap 3.6e-17, amplified'],
        fill: 0.7,
        seconds: 3.4,
      },

      {
        // Zone 4d — THEREFORE: why a straight line through slow time falls
        step: 5,
        labels: ['The path that ages most · +0.4 fs', 'Time across · height up'],
        frame: ['The path that ages most · +0.4 fs'],
        narration:
          "So a straight path through slower time tilts down. That's the fall. A thrown ball's arc is the route that ages the most.",
      },
      {
        step: 5,
        labels: ['Every other path ages less'],
        frame: ['Every other path ages less'],
        fill: 0.7,
        seconds: 3.0,
      },
      {
        step: 5,
        labels: ['The path that ages most · +0.4 fs'],
        frame: ['The path that ages most · +0.4 fs'],
        fill: 0.8,
        push: 0.92,
        seconds: 3.0,
      },

      {
        // Zone 5 — THE STAT. Hard cut, no callouts competing. Framing still
        // works with labels off: the box comes from wlGroup's geometry, not
        // from the hidden pill.
        step: 6,
        labels: [],
        frame: ['Time across · height up'],
        fill: 0.8,
        move: 'cut',
        narration:
          "At true scale that path barely bends at all. It's a slice of a circle nearly one light year wide.",
      },
      {
        step: 6,
        labels: ['Time across · height up'],
        frame: ['Time across · height up'],
        fill: 0.78,
        orbit: 10,
        seconds: 3.8,
      },

      {
        // Zone 6 — so-what: the same rule, run sideways, and why it matters
        step: 7,
        labels: ['Same straight path, more sideways speed', 'Still reading 0.000 g'],
        frame: ['Same straight path, more sideways speed', 'Still reading 0.000 g'],
        narration:
          "Add sideways speed to that same path and it closes into a loop. That's an orbit, and it's why astronauts float. Gravity still has them, they're just falling and missing the ground.",
      },
      {
        // The probe is a 0.05u bead: frame the ORBIT and let the label point at
        // it. Framing the bead itself put the lens on it and turned the ring
        // edge-on, which rendered as a bare white diagonal line.
        step: 7,
        labels: ['Still reading 0.000 g'],
        frame: ['Same straight path, more sideways speed'],
        fill: 0.62,
        push: 0.92,
        seconds: 3.4,
      },
      {
        step: 7,
        labels: ['Same straight path, more sideways speed'],
        frame: ['Same straight path, more sideways speed'],
        fill: 0.7,
        orbit: 12,
        seconds: 4.0,
      },

      {
        // Zone 7 — button. Closes the loop and re-primes the hook on replay.
        step: 8,
        labels: [],
        frame: ['Release clamp', 'Catch cradle'],
        fill: 0.6,
        narration: 'Nothing pulls you down. The floor stops you.',
      },
    ],
  },

  platforms: {
    shorts: {
      title: 'Nothing is pulling you down right now',
      hashtags: ['#gravity', '#physics', '#space', '#howitworks', '#whatdstuff'],
    },
  },
};
