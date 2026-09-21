// Editorial layer for video export (scripts/render.mjs).
//
// The script comes straight off story.js, which was written BEFORE the model:
//   angle  - a gimbal doesn't hold its payload still by gripping it, it holds
//            it still by decoupling it; the same decoupling can erase a
//            whole axis when two rings end up doing the same job (lock)
//   stat   - Apollo's guidance computer warned at 70deg of tilt and froze
//            the platform outright at 85deg
//   button - "Three rings hold it still, until two agree."
//
// LOOP: planted in beat 2 ("each ring only ever answers for one rotation")
// and the spoken question in beat 3 ("what happens when two end up doing the
// exact same job"), closed word-for-word in the button. Shorts replay, so the
// button also re-sets the hook up on the second pass.
//
// CUTTING: shots with no `narration` are SILENT CUTS riding inside the
// previous spoken line. 8 spoken beats across ~19 shots on the short.
//
// NO em/en dashes: ElevenLabs renders them as dead air the speed knob cannot
// compress.
export default {
  hook: 'A gimbal doesn’t hold your camera steady.\nIt ignores your hand instead.',

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

  platforms: {
    youtube: {
      title: 'How a Gimbal Cancels Your Shake, Until It Can’t',
      description:
        'A gimbal doesn’t hold a camera steady by gripping it. Three nested rings each absorb exactly one rotation, so the payload never feels the frame move. This video builds the mechanism up from the bare three rings, through the no-power ship’s compass trick, to the IMU and brushless motors in a modern camera gimbal. Then it tilts 90 degrees into gimbal lock, the same failure that made Apollo’s guidance computer warn at 70 degrees and freeze outright at 85.\n\nMore explainers at whatdstuff.',
      tags: [
        'gimbal',
        'gimbal lock',
        'camera stabilizer',
        'how gimbals work',
        'IMU',
        'brushless motor',
        'Apollo guidance computer',
        'physics',
        'engineering',
        'mechanism explained',
      ],
    },
    shorts: {
      title: 'The gimbal trick that can undo itself',
      hashtags: ['#gimbal', '#gimballock', '#physics', '#engineering', '#howitworks'],
    },
  },

  // 9:16 - ~85s. 8 spoken beats, ~19 shots.
  short: {
    shots: [
      // --- beat 1: hook. The claim is word one. ------------------------------
      {
        step: 0,
        frame: null,
        fill: 0.8,
        push: 0.95,
        narration:
          'A gimbal doesn’t hold your camera steady by gripping it. It holds it steady by ignoring your hand completely.',
      },
      { step: 0, frame: ['Stabilized payload'], fill: 0.6, labels: ['Stabilized payload'], seconds: 1.2 },

      // --- beat 2: stakes, and the loop gets planted -------------------------
      {
        step: 0,
        frame: null,
        fill: 0.78,
        push: 0.94,
        narration:
          'Inside that camera housing sit three nested rings. Each ring only ever answers for one rotation.',
      },
      { step: 0, frame: ['Roll ring & motor'], fill: 0.6, labels: ['Roll ring & motor'], seconds: 1.2 },

      // --- beat 3: say the mystery out loud -----------------------------------
      {
        step: 1,
        frame: null,
        fill: 0.78,
        narration: 'So what happens when two of those rings end up doing the exact same job?',
      },

      // --- beat 4: isolate the axes -------------------------------------------
      {
        step: 1,
        frame: ['Pan/yaw ring'],
        fill: 0.66,
        labels: ['Pan/yaw ring'],
        push: 0.94,
        narration:
          'Watch those rings isolate one axis at a time. Yaw swings the outer ring, pitch the middle one, roll the ring nearest the lens, and the other two hold still.',
      },
      { step: 1, frame: ['Tilt/pitch ring'], fill: 0.62, labels: ['Tilt/pitch ring'], seconds: 1.1 },
      { step: 1, frame: ['Roll ring & motor'], fill: 0.62, labels: ['Roll ring & motor'], seconds: 1.1 },

      // --- beat 5: passive -----------------------------------------------------
      {
        step: 2,
        frame: ['Counterweight'],
        fill: 0.62,
        labels: ['Counterweight'],
        narration:
          'Some rigs hold still with no power at all. A weight hung below the center of mass does the correcting, the same trick behind a ship’s compass.',
      },
      { step: 2, frame: null, fill: 0.76, seconds: 1.3 },

      // --- beat 6: active --------------------------------------------------------
      {
        step: 3,
        frame: ['IMU sensor'],
        fill: 0.6,
        labels: ['IMU sensor'],
        narration:
          'But swap that weight for a sensor, and the same rings become a camera gimbal, correcting within milliseconds, hundreds of times a second.',
      },
      { step: 3, frame: ['Roll ring & motor'], fill: 0.6, labels: ['Roll ring & motor'], seconds: 1.2 },

      // --- beat 7: THE STAT, isolated, on the reveal of the lock ----------------
      {
        step: 4,
        frame: ['Pan/yaw ring', 'Roll ring & motor'],
        fill: 0.66,
        labels: ['Pan/yaw ring', 'Roll ring & motor'],
        move: 'cut',
        narration:
          'Here’s the part that gets me about this gimbal. Tilt the middle ring ninety degrees, and two of its axes line up. Apollo’s own computer froze solid at eighty five degrees of tilt.',
      },
      { step: 4, frame: null, fill: 0.72, seconds: 1.4 },

      // --- beat 8: the button, closing the loop --------------------------------
      {
        step: 4,
        frame: null,
        fill: 0.72,
        push: 0.95,
        narration:
          'So spin either ring now and you get the identical motion. The direction only a third ring could reach is simply gone. Three rings hold it still, until two agree.',
      },
      { step: 5, frame: null, fill: 0.8, seconds: 1.6 },
    ],
  },

  // 16:9 - ~2:15. Same spine, developed, every step visited.
  long: {
    shots: [
      {
        step: 0,
        frame: null,
        push: 0.95,
        narration:
          'A gimbal doesn’t hold your camera steady by gripping it. It holds it steady by ignoring your hand completely, and that trick is almost the opposite of what it looks like.',
      },
      { step: 0, frame: ['Stabilized payload'], seconds: 2.2 },
      {
        step: 0,
        frame: null,
        push: 0.94,
        narration:
          'Between your shaking hand and the lens sit three nested rings, each free to rock along one line through its own center. Shake every axis at once, and the middle barely drifts.',
      },
      { step: 1, frame: null, seconds: 2.0 },
      {
        step: 1,
        frame: ['Pan/yaw ring'],
        narration:
          'So what happens on each ring? Watch one at a time. Yaw, and only the outer ring answers. Tilt, and only the middle ring moves. Twist, and only the innermost ring rolls. Each ring only ever has one job.',
      },
      { step: 1, frame: ['Tilt/pitch ring'], seconds: 2.0 },
      { step: 1, frame: ['Roll ring & motor'], seconds: 2.0 },
      {
        step: 2,
        frame: ['Counterweight'],
        narration:
          'Some gimbals never touch a battery. Hang a weight below the payload’s own pivot, its center of mass sits under the point it swings from, and any tilt creates its own restoring torque, the same idea that keeps a ship’s compass level.',
      },
      { step: 2, frame: null, seconds: 2.2 },
      {
        step: 3,
        frame: ['IMU sensor'],
        narration:
          'Swap that weight for a sensor, and the same three rings become a camera gimbal. A sensor reads orientation hundreds of times a second, and a small motor at each ring corrects within milliseconds. Push it harder than gravity ever could, and it still doesn’t blink.',
      },
      { step: 3, frame: ['Roll ring & motor'], seconds: 2.2 },
      {
        step: 4,
        frame: ['Pan/yaw ring', 'Roll ring & motor'],
        move: 'cut',
        narration:
          'But this exact design has a famous failure. Tilt the middle ring a full ninety degrees, and the outer ring’s axis lines up with the inner ring’s, the same line now. Apollo’s guidance computer flashed a warning at seventy degrees, and froze solid at eighty five, and astronauts had to realign it by hand.',
      },
      { step: 4, frame: null, seconds: 2.4 },
      {
        step: 4,
        frame: null,
        narration:
          'Spin the outer ring now, or spin the inner one. You get the identical motion either way, because they’ve become the same knob. The direction that used to sit between them, the one only a third ring could reach, is simply gone until the rig tilts back.',
      },
      { step: 5, frame: null, seconds: 2.0 },
      {
        step: 5,
        frame: null,
        push: 1.05,
        narration:
          'Untilt it, and all three axes come back independent, each quietly doing its one job again. Three rings, three rotations, and a payload that never learns anything moved. Three rings hold it still, until two of them agree.',
      },
      { step: 5, frame: null, seconds: 2.4 },
    ],
  },
};
