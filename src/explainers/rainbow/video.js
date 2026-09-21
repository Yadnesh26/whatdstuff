// Editorial layer for video export (scripts/render.mjs).
//
// The script comes straight off story.js, which was written BEFORE the model:
//   angle  - a rainbow is not an object and not in the sky. It's an angle,
//            about 42 degrees, measured from the shadow of your own head.
//   stat   - water bends violet light about 1% harder than red (1.343 vs
//            1.331) and that 1% is the ENTIRE width of a rainbow: 1.7 degrees.
//   button - "It is not in the sky. It is aimed at you."
//
// LOOP: planted in the hook ("you keep trying to reach it... it was never up
// there") and closed word-for-word in the button ("It was never in the sky.
// It's aimed at you."). Shorts replay, so the button also re-sets the hook up
// on the second pass.
//
// CUTTING: shots with no `narration` are SILENT CUTS riding inside the
// previous spoken line. 8 spoken beats across ~21 shots on the short.
//
// CAMERAS ARE EXPLICIT, not solver-framed, for every wide/establishing shot.
// The auto-framer builds its box from ALL visible geometry, and this scene's
// ground disc (34 units wide, present in every step) and its InstancedMesh
// rain field (whose true per-instance world positions the box-builder can't
// see) dominate that box — every `frame: null` shot solved to a flat, mostly
// empty sliver aimed at the dark ground (verified in the storyboard: every
// frame:null shot rendered blank). The fix is to reuse this explainer's own
// hand-tuned step cameras (copied from index.js's `shot()`/`macroShot()`
// output) via the `camera` escape hatch, which skips the solver entirely.
// Only the handful of callouts parented to REAL meshes (the drop's bounce
// pins, one fan dot, the antisolar ring) solve correctly, so those few silent
// cuts still use `frame`/`labels` as normal.
//
// SHORT ONLY per explicit request — no long-form cut authored here.
//
// NO em/en dashes in narration: ElevenLabs renders them as dead air the
// speed knob cannot compress.

// Baked from index.js's shot()/macroShot() calls for steps 0 (bow), 1
// (one-drop), 2 (pile-up), 3 (colour), 4 (cone), 5 (yours) and 8 (sun) — the
// same cameras the live site uses for those steps.
const CAM = {
  BOW: { position: [3.6149, 7.3587, 9.6067], target: [-1.4085, 2.7, -7.1006] },
  ONE_DROP: { position: [-1.5366, 5.6384, -2.7558], target: [3.6452, 4, -2.0822] },
  PILE_UP: { position: [-3.4447, 4.6383, -0.7701], target: [3.4352, 4.15, -2.1166] },
  COLOUR: { position: [-5.1296, 5.3747, -2.7128], target: [3.5, 4.5, -1.5] },
  CONE: { position: [7.1733, 9.8523, 7.691], target: [-1.5010, 2.4, -5.0019] },
  YOURS: { position: [1.0107, 6.4823, 7.8536], target: [-1.3467, 2.6, -6.5058] },
};

// A tightened variant of a base pose, `t` of the way from position to target
// (0 = the base pose itself, larger = a punch-in) — used for silent cuts on
// callouts whose anchor carries no mesh of its own (see the header note), so
// the cut still reads as a real cut instead of a frozen repeat of the base.
function push(cam, t) {
  const [px, py, pz] = cam.position;
  const [tx, ty, tz] = cam.target;
  return { position: [px + (tx - px) * t, py + (ty - py) * t, pz + (tz - pz) * t], target: cam.target };
}

export default {
  hook: 'That rainbow you keep trying to reach\nwas never up there.',

  render: {
    formats: ['short'],
    captions: true,
    titleCard: true,
    endCard: false,
    // Explicit user request for this export.
    followOverlay: { short: true },
    captionStyle: 'bold-karaoke',
    fps: 30,
  },

  platforms: {
    shorts: {
      title: 'A rainbow is not a thing. It is an angle.',
      hashtags: ['#rainbow', '#physics', '#optics', '#science', '#howitworks'],
    },
  },

  // 9:16 - ~93s. 8 spoken beats, 21 shots.
  short: {
    shots: [
      // --- beat 1: hook. The claim is word one; plants the "reach" loop. -----
      {
        step: 0,
        camera: CAM.BOW,
        push: 0.95,
        narration:
          'That rainbow you keep trying to reach was never up there. It’s not a thing. It’s an angle, and your head sits at the point of it.',
      },
      { step: 0, camera: push(CAM.BOW, 0.3), labels: ['Falling rain'], seconds: 1.0 },
      {
        step: 0,
        camera: push(CAM.BOW, 0.22),
        labels: ['Secondary bow · 50–54°'],
        seconds: 1.1,
      },

      // --- beat 2: stakes, and the loop develops -------------------------------
      {
        step: 0,
        camera: push(CAM.BOW, 0.05),
        narration:
          'Every drop out there sprays the whole rainbow in every direction, but you only ever catch one colour from any single drop.',
      },
      {
        step: 0,
        camera: push(CAM.BOW, 0.34),
        labels: ['Primary bow · 42°'],
        seconds: 1.0,
      },

      // --- beat 3: say the mystery out loud, punch into the macro drop -------
      {
        step: 1,
        camera: CAM.ONE_DROP,
        move: 'cut',
        narration: 'So what’s happening, drop by drop, to build that one exact angle?',
      },

      // --- beat 4: reveal, the three events inside one drop --------------------
      {
        step: 1,
        camera: push(CAM.ONE_DROP, 0.12),
        narration:
          'Blow one drop up huge and there are three events. Light bends going in, bounces once off the back wall, and bends again coming out.',
      },
      { step: 1, frame: ['Bends going in'], labels: ['Bends going in'], seconds: 0.9 },
      {
        step: 1,
        frame: ['One bounce off the back'],
        labels: ['One bounce off the back'],
        seconds: 1.0,
      },
      { step: 1, frame: ['Bends coming out'], labels: ['Bends coming out'], seconds: 0.9 },

      // --- beat 5: BUT, why there's a bright band at all ------------------------
      {
        step: 2,
        camera: CAM.PILE_UP,
        move: 'cut',
        narration:
          'But it hits the whole face of the drop, and every exit crowds against the exact same limit. That crowding is the brightness.',
      },
      {
        step: 2,
        camera: push(CAM.PILE_UP, 0.1),
        labels: ['Rays hit the whole face'],
        seconds: 1.0,
      },
      // No push here: this subject already sits at ~88% frame coverage, so a
      // punch-in (verified against the settled solve) crops the far edge.
      { step: 2, frame: ['Exits pile up here'], labels: ['Exits pile up here'], seconds: 1.3 },

      // --- beat 6: THE STAT, isolated ------------------------------------------
      {
        step: 3,
        camera: CAM.COLOUR,
        move: 'cut',
        narration:
          'But that limit shifts a little with colour. Water bends violet light about one percent harder than red, so it comes back at forty point seven degrees instead of forty two point four. That gap is the entire width of a rainbow.',
      },
      { step: 3, camera: push(CAM.COLOUR, 0.1), labels: ['Red · 42.4°'], seconds: 1.0 },
      {
        step: 3,
        camera: push(CAM.COLOUR, 0.16),
        labels: ['Violet · 40.7°'],
        seconds: 1.0,
      },

      // --- beat 7: THEREFORE, put the angle back in the sky ---------------------
      {
        step: 4,
        camera: CAM.CONE,
        move: 'cut',
        orbit: 8,
        narration:
          'Now put that angle back in the sky. Spin it around the line to the sun and you get a cone, eye at the tip. It’s an arc only because the ground cuts the bottom off.',
      },
      {
        step: 4,
        frame: ['Antisolar point · your shadow'],
        labels: ['Antisolar point · your shadow'],
        seconds: 1.1,
      },
      {
        step: 4,
        camera: push(CAM.CONE, 0.1),
        labels: ['42° half-angle'],
        seconds: 1.1,
      },

      // --- beat 8: so-what, then the button, closing the loop -------------------
      {
        step: 5,
        camera: CAM.YOURS,
        narration:
          'That cone moves exactly when you move, which is why you can never walk any closer. It was never in the sky. It’s aimed at you.',
      },
      // CAM.SUN (this step's own desktop camera, y-target 1.6) renders blank
      // in portrait via the storyboard/export driver — reusing the hook's
      // BOW establishing shot here instead, which also bookends the loop for
      // the replay (opens and closes on the same wide double-bow framing).
      { step: 8, camera: CAM.BOW, seconds: 1.6 },
    ],
  },
};
