// Editorial layer for video export (scripts/export-video.mjs).
// steps: 0 hero · 1 orbit · 2 inner · 3 outer · 4 ellipse · 5 kepler
//        6 disk · 7 wobble · 8 flight
//
// STORY LENS: everyone has already seen the eight-planets diagram, so the
// video does not open on it. It opens on the thing that diagram gets wrong —
// nothing here orbits the Sun, the Sun included. Both bodies fall around a
// shared point, and that point is itself moving. That claim is the hook, the
// planted loop and the button, and it is what the whole script pays off.
//
// SCRIPTING: one flowing voiceover. make-narration.mjs synthesizes it in a
// single ElevenLabs take and the exporter paces the picture to the audio, so
// each shot's line is only a cut point and hands off into the next. Captions
// are the verbatim rail, so the hook lives in shot 1's first spoken sentence.
//
// The loop: planted in shot 2 ("that point is moving too") and closed in the
// button ("The Sun is orbiting too"), which also re-arms the hook on replay.
//
// No em/en dashes in any narration line — ElevenLabs renders them as dead air
// the speed knob cannot compress. Numbers are spelled as they should be spoken.
//
// ---------------------------------------------------------------------------
// PORTRAIT FRAMING — why every shot pins its own `camera`
// ---------------------------------------------------------------------------
// This is the widest subject in the library by a distance: Neptune's orbit is
// 6.6 units across and the whole thing is barely 0.5 units tall. In a 9:16
// export the vertical FOV stays at the 42 degree reference (stage.js's mobile
// widening is gated off during a render), so the HORIZONTAL half-FOV is only
// about 12 degrees. Fitting 3.3 units of half-width therefore needs ~16 units
// of camera distance, and at the site's shallow step elevations the disk then
// projects as a thin band across a very tall frame.
//
// So the short does not reuse the site's poses. Two rules run through all of
// them:
//   1. WIDE SHOTS GO TOP-DOWN, AND CROP. At 56 degrees of elevation the disk
//      projects as a near-circle rather than a band, which is the most a
//      6.6 x 0.5 subject can ever fill a 9:16 frame; at the site's 32 degrees
//      it fills a quarter of it. Distances are then set to let the outermost
//      orbit run off the sides. Framed to hold all of Neptune's orbit the
//      camera has to sit 16 units back, and at that range the Sun is 50 pixels
//      wide on a phone. Cropping the edge of the system reads as being inside
//      something big; fitting it all in reads as a speck.
//   2. TIGHT SHOTS PICK A SUBSET. Earth and its two force arrows, Mercury's
//      ellipse alone, the Sun and its own little orbit — each of those is a
//      compact subject that genuinely fills a tall frame, so the mechanism
//      beats are composed on those instead of on the whole system.
// The finale is the exception that portrait actually favours: the helical
// trails run 5 units along the galactic travel direction, which is 60 degrees
// out of the orbital plane, so they fill the tall frame on their own.
//
// CALLOUTS ARE OFF FOR THE WHOLE SHORT (`labels: []` everywhere). The CSS2D
// pills render at their native CSS size into a 1080x1920 frame at
// deviceScaleFactor 1, which puts their 12px text at about half a percent of
// the frame height: on a phone they are grey specks with a hairline attached,
// and they compete with the caption rail for the same attention. Every number
// they would have carried (30 km/s, 59 against 39, Neptune's 165 years,
// 230 km/s) is spoken instead, so nothing is lost by dropping them.
//
// `camera` also means the auto-framing solver is skipped, which matters here
// for a second reason: most of this explainer's callouts hang off bare anchor
// Object3Ds rather than off geometry, so a solved subject box would collapse
// toward a cluster of points rather than a part. `frame: null` on every shot
// follows from that — with the solver off it only tells the framing gate to
// measure against the whole visible model instead of against those anchors,
// which is why the tight shots report a deliberate crop rather than an error.

const CENTRE_Y = 2.25;

// Spherical pose around the Sun. `liftFrac` translates camera AND target down
// together (a pure vertical rig move, so the viewing angle is untouched),
// which slides the subject UP the frame clear of the caption rail. It is a
// FRACTION OF DISTANCE, not an absolute: at 42 degrees of vertical FOV a lift
// of 0.075 * dist raises the subject by the same tenth of the frame whether the
// camera is 3 units out or 13, which a fixed offset cannot do across a shot
// list that spans both.
function P(azDeg, elDeg, dist, liftFrac = 0.075) {
  const a = (azDeg * Math.PI) / 180;
  const e = (elDeg * Math.PI) / 180;
  const ty = CENTRE_Y - liftFrac * dist;
  return {
    position: [
      dist * Math.cos(e) * Math.cos(a),
      ty + dist * Math.sin(e),
      dist * Math.cos(e) * Math.sin(a),
    ],
    target: [0, ty, 0],
  };
}

export default {
  render: {
    formats: ['short'],
    captions: true,
    captionStyle: 'bold-karaoke',
    titleCard: true,
    endCard: false,
    // Explicitly requested for this export (2026-09-05).
    followOverlay: true,
    fps: 30,
  },

  // Legacy-only card (burns only if words.json is missing). In sync with
  // shot 1's opening line.
  hook: 'Nothing here is orbiting\nthe Sun.',

  // Consumed by scripts/make-postkit.mjs. Authored here with the script rather
  // than improvised at posting time, so the packaging promise and the hook say
  // the same thing.
  platforms: {
    shorts: {
      title: 'Nothing orbits the Sun (not even the planets)',
      hashtags: ['#solarsystem', '#space', '#astronomy', '#physics', '#science'],
    },
  },

  // 9:16 — ~220 words, ~96s at the channel voice's pace. Runs a few seconds
  // past lint-script's 95s advisory band, deliberately: the payoff this hook
  // promises is the Sun's own two motions, and both need saying. Spine: hook ->
  // stakes + planted loop -> spoken question -> BUT/THEREFORE mechanism ->
  // isolated stat -> the payoff the hook promised -> button.
  short: {
    shots: [
      {
        // Zone 1 - hook, word one, on the complete system. Top-down and far: the
        // whole disk, filling the width of a portrait frame.
        step: 0,
        camera: P(35, 56, 13.5),
        frame: null,
        labels: [],
        speed: 1.4,
        narration:
          'Nothing here is actually orbiting the Sun. Not the planets, and not the Sun either.',
      },
      {
        // Zone 2 - the second surprise, and the loop gets planted
        step: 0,
        camera: P(58, 58, 12.2),
        frame: null,
        labels: [],
        speed: 1.4,
        narration:
          'The Sun and its planets fall around one shared point in space. And that point moves too.',
      },
      {
        // Zone 3 - the spoken question, and its one word answer. Steeper and much
        // closer: Earth plus its two force arrows is a compact subject that
        // fills a tall frame properly.
        step: 1,
        camera: P(78, 62, 6.4),
        frame: null,
        labels: [],
        speed: 1.2,
        narration:
          'So what holds the planets up? Nothing does. Each one is only falling.',
      },
      {
        // Zone 4a - the mechanism, and the grey body that was denied it. Sped up
        // so a full drop completes inside the shot.
        step: 1,
        camera: P(96, 58, 6.8),
        frame: null,
        labels: [],
        speed: 1.8,
        narration:
          'Earth is falling toward the Sun, dropping three millimetres a second. But it moves sideways fast enough that the Sun curves away beneath. So it keeps missing. That is an orbit.',
      },
      {
        // Zone 4b - BUT: the shape is wrong too. Azimuth chosen so Mercury's major
        // axis runs up the frame rather than across it.
        step: 4,
        camera: P(282, 60, 3.6),
        frame: null,
        labels: [],
        narration:
          'That orbit is an ellipse, not a circle, with the Sun off to one side.',
      },
      {
        // Zone 4c - THEREFORE: the speed has to swing with it
        step: 4,
        camera: P(296, 54, 3.5),
        frame: null,
        labels: [],
        narration:
          'Sitting off to one side is why Mercury hurries at the near end: fifty nine kilometres a second, against thirty nine.',
      },
      {
        // Zone 4d - re-hook, back out to the whole system lapping
        step: 5,
        camera: P(244, 56, 12.0),
        frame: null,
        labels: [],
        speed: 1.6,
        narration:
          'Mercury is the quickest, Neptune the slowest. And here is the part that gets me.',
      },
      {
        // Zone 5 - the stat, alone on its own beat
        step: 3,
        camera: P(160, 54, 13.0),
        frame: null,
        labels: [],
        speed: 1.6,
        narration:
          'Neptune has been round the Sun exactly once since we found it in eighteen forty six.',
      },
      {
        // Zone 6a - the payoff the hook promised, wide enough to see Jupiter doing it
        step: 7,
        camera: P(322, 44, 8.0),
        frame: null,
        labels: [],
        speed: 2.4,
        narration:
          'Once. Now back to that shared point, just outside the surface of the Sun.',
      },
      {
        // Zone 6b - macro push-in onto the wobble itself
        step: 7,
        camera: P(338, 50, 4.6),
        frame: null,
        labels: [],
        speed: 2.4,
        narration:
          'Jupiter drags the Sun around that point every twelve years. That wobble is how we found planets around other stars.',
      },
      {
        // Zone 6c - the last, biggest motion. Viewed from the side so the travel
        // direction, 60 degrees out of the orbital plane, runs UP the portrait
        // frame with the helices trailing down it.
        step: 8,
        camera: P(285, 22, 9.5, 0.10),
        frame: null,
        labels: [],
        narration:
          'Those stars move too. The whole system flies through the galaxy at two hundred and thirty kilometres a second, and it drags every orbit with it.',
      },
      {
        // Zone 7 - button: closes the loop and re-arms the hook on replay
        step: 8,
        camera: P(300, 28, 9.0, 0.10),
        frame: null,
        labels: [],
        narration:
          'So no orbit ever closes; every one is a corkscrew. Nothing orbits the Sun. The Sun is orbiting too.',
      },
    ],
  },
};
