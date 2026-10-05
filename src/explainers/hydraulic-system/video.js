// Editorial layer for video export (scripts/export-video.mjs).
//
// LENS (from story.js): the pump never makes pressure, it only makes flow;
// the load decides the pressure. Planted loop in the hook ("never makes a
// single bar of pressure") + the contradiction straight after ("Yet the gauge
// reads seventy bar"), closed by the button "The pump only pushes. The load
// decides the pressure.", which re-primes the hook on replay (both play over
// the same whole-rig framing).
//
// SCRIPTING: one flowing single-take voiceover, but/therefore transitions, no
// em/en dashes. Humanizer pass folded the two dramatic closers ("That's flow,
// nothing more." / "Not one bar more.") into full sentences.
//
// STAT: "two hundred kilos on every square centimetre ... six tonnes" gets a
// HARD CUT onto the cylinder's lift side glowing red at relief pressure, then
// a cut to the fist-sized pump.
//
// LOOP PHASE PLAN (activate() resumes a step where it paused; first
// activation starts at phase 0 — see the export-framing memory):
//   step 4 (cylinder, 13 s lap): FIRST used for the gauge cutaway in beat 2,
//     so the needle swings 6 → 70 bar on "seventy bar" (lift pressure is
//     reached ~1.0 s in). It resumes for beats 6-7 while the boom is still
//     lifting (lift runs 1.3 s → 6.0 s).
//   "it stops at seventy bar" cuts to step 2 (idle), where the
//     lift side is LOCKED at the 70 bar holding pressure whatever the phase.
//   step 5 (relief, 14 s lap): first used in beat 8. Piston reaches the top at
//     ~2.0 s, relief open 2.5 s → 11.2 s, which covers beats 8 and 9 (a 12 s
//     lap closed the relief just before "six tonnes" in the smoke render).
//
// LABELS: every shot hides the in-scene callouts (labels: []). A 9:16 crop
// cuts right-anchored pills in half and the rest are illegible at phone size.
// Framing still uses the named callouts' parent geometry.
export default {
  hook: 'The pump lifting this tonne never makes a single bar of pressure.',

  // Requested explicitly: short only, captioned, follow overlay, labels
  // hidden. No end card (not asked for, and it would promise a long-form
  // that doesn't exist).
  render: {
    formats: ['short'],
    captions: true,
    captionStyle: 'bold-karaoke',
    titleCard: true,
    endCard: false,
    followOverlay: true,
    speed: 1.0, // channel voice at 1x (make-narration still defaults to 0.9)
    fps: 30,
  },

  short: {
    shots: [
      {
        // Zone 1 — hook on the complete sealed rig, boom lifting the tonne
        // authored oblique pose: the rig is a wide strip in portrait, so look
        // along it from the pump end (solved by a 42° / 1080x1920 probe) —
        // from the load end the tonne block hides the whole mechanism
        step: 0,
        labels: [],
        camera: { position: [-7.54, 3.51, 4.92], target: [-0.34, 0.65, -0.12] },
        dolly: 1,
        orbit: 6,
        narration: 'The pump lifting this tonne never makes a single bar of pressure.',
      },
      {
        step: 0,
        labels: [],
        frame: ['1-tonne load', 'Hydraulic cylinder'],
        fill: 0.8,
        push: 0.9,
        seconds: 1.4,
      },

      {
        // Zone 2 — second surprise + the contradiction that opens the loop
        step: 1,
        labels: [],
        frame: ['Gear pump — 12 teeth each'],
        fill: 0.6,
        move: 'cut',
        narration: 'It just shoves oil, eight cc every turn. Yet the gauge reads seventy bar.',
      },
      {
        // first activation of step 4: needle swings 6 → 70 bar inside this shot
        step: 4,
        labels: [],
        frame: ['Pressure gauge'],
        fill: 0.5,
        seconds: 1.8,
      },

      {
        // Zone 3 — the spoken question, whole sealed rig running
        step: 6,
        labels: [],
        camera: { position: [-6.14, 5.2, 9.58], target: [-0.25, 0.71, 0.14] },
        dolly: 1,
        orbit: -10,
        narration: 'So where’s that pressure coming from?',
      },

      {
        // Zone 4a — the pump makes flow
        step: 1,
        labels: [],
        frame: ['Oil rides round the outside'],
        fill: 0.5,
        push: 0.88,
        narration:
          'Inside, two gears carry oil round the outside of their teeth. That flow is all a pump makes.',
      },
      {
        step: 1,
        labels: [],
        camera: { position: [-1.46, 1.11, 2.29], target: [-2.01, 0.73, 0.23] },
        dolly: 1,
        seconds: 1.4,
      },

      {
        // Zone 4b — open centre: flow with nothing in the way
        step: 2,
        labels: [],
        frame: ['Lever centred', 'Straight through to the tank'],
        fill: 0.8,
        narration:
          'Centre the lever and the flow runs straight back to the tank. Nothing pushes back, so the gauge sits near zero.',
      },
      {
        step: 2,
        labels: [],
        frame: ['Straight through to the tank'],
        fill: 0.62,
        push: 0.9,
        seconds: 2.0,
      },
      {
        step: 2,
        labels: [],
        frame: ['Gauge 6 bar'],
        fill: 0.5,
        seconds: 1.4,
      },

      {
        // Zone 4c — BUT: the spool shuts the easy path (first activation of
        // step 3: the lever throws ~0.6 s in)
        step: 3,
        labels: [],
        frame: ['Control lever', 'Spool'],
        fill: 0.8,
        narration:
          'But pull the lever, and a sliding spool shuts that easy path. Now the oil has to get under the piston.',
      },
      {
        step: 3,
        labels: [],
        frame: ['Spool'],
        fill: 0.6,
        push: 0.9,
        seconds: 1.6,
      },
      {
        step: 4,
        labels: [],
        frame: ['Piston', 'Lift side 70 bar'],
        fill: 0.55,
        seconds: 1.6,
      },

      {
        // Zone 4d — THEREFORE: pressure climbs only until the load moves
        step: 4,
        labels: [],
        frame: ['Hydraulic cylinder', 'Boom'],
        fill: 0.85,
        orbit: 10,
        narration:
          'Oil won’t squeeze smaller, so the pressure climbs until the load moves. For this tonne, it stops at seventy bar.',
      },
      {
        // idle step: lift side locked at holding pressure, phase-proof
        step: 2,
        labels: [],
        frame: ['Hydraulic cylinder'],
        fill: 0.66,
        bias: 0.16,
        seconds: 2.4,
      },
      {
        step: 2,
        labels: [],
        frame: ['Lift side 70 bar'],
        fill: 0.5,
        push: 0.9,
        seconds: 1.8,
      },

      {
        // Zone 4e — re-hook as a scale change: stall + relief (first
        // activation of step 5)
        step: 5,
        labels: [],
        frame: ['Hydraulic cylinder'],
        fill: 0.68,
        move: 'cut',
        narration:
          'Jam the piston at the top, and it keeps climbing until a spring lets the oil escape at two hundred bar.',
      },
      {
        step: 5,
        labels: [],
        frame: ['Pressure gauge'],
        fill: 0.5,
        seconds: 1.4,
      },
      {
        step: 5,
        labels: [],
        frame: ['Poppet', 'Spring — set to 200 bar'],
        fill: 0.6,
        seconds: 1.8,
      },

      {
        // Zone 5 — THE STAT, hard cut onto the red lift side, then the pump
        step: 5,
        labels: [],
        frame: ['Lift side 70 bar'],
        fill: 0.45,
        move: 'cut',
        narration:
          'That’s two hundred kilos on every square centimetre, or six tonnes of push from a pump you could hold in one hand.',
      },
      {
        step: 1,
        labels: [],
        frame: ['Gear pump — 12 teeth each'],
        fill: 0.55,
        push: 0.9,
        seconds: 2.0,
      },

      {
        // Zone 6 — so-what
        step: 6,
        labels: [],
        camera: { position: [7.64, 3.47, 6.49], target: [0.36, 0.66, -0.07] },
        dolly: 1,
        orbit: 12,
        narration: 'Every excavator arm you’ve watched lift something huge runs on this same trick.',
      },
      {
        step: 6,
        labels: [],
        frame: ['Boom'],
        fill: 0.8,
        rise: 0.1,
        seconds: 1.4,
      },

      {
        // Zone 7 — button, closes the loop over the hook's framing
        step: 0,
        labels: [],
        camera: { position: [-7.54, 3.51, 4.92], target: [-0.34, 0.65, -0.12] },
        dolly: 1,
        narration: 'The pump only pushes. The load decides the pressure.',
      },
    ],
  },

  platforms: {
    shorts: {
      title: 'This pump never makes pressure',
      hashtags: ['#hydraulics', '#engineering', '#howitworks', '#physics', '#whatdstuff'],
    },
  },
};
