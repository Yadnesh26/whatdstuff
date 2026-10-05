// Editorial layer for video export (scripts/export-video.mjs).
//
// SCRIPTING: one flowing voiceover, synthesized as a single ElevenLabs take —
// the per-shot `narration` strings are just the cut points; each hands off into
// the next. Arc: hook -> stakes -> spoken question -> reveal -> BUT/THEREFORE
// mechanism -> re-hook -> isolated stat -> so-what -> callback button.
//
// PACKAGING
//   Idea:   the Moon's shadow only just reaches Earth, and usually doesn't.
//   Lens:   a total eclipse is a near miss that happens to land.
//   Loop:   "usually too short" planted in the hook, asked again as the
//           question, closed in the button ("Usually too short. Sometimes,
//           just long enough."), which hands straight back to the hook on replay.
//
// CAMERAS: every shot pins an explicit `camera`. The framing solver builds its
// box from the step's focus callouts, and this short hides all callouts (they
// do not survive the 9:16 crop), which leaves it an empty box; the whole-model
// fallback would include a Sun 60 units away. Poses were tuned numerically
// against a 1080x1920 projection at the export's 42° FOV.
//
// LOOP TIMING: the player RESUMES a step's loop where it paused, and a step's
// loop starts from zero the first time it is activated. Step 0 (after the 2s
// warm-up) reaches totality ~6s in, under "turns noon into night"; step 6 is
// fresh at the last beat and reaches totality under the button.
//
// No em dashes anywhere: ElevenLabs renders them as dead air.

// steps: 0 totality (ground) · 1 lineup · 2 two shadows · 3 tip only just
//        reaches · 4 spot racing east · 5 why not every month · 6 inside the dot
const SKY_WIDE = { position: [0, 0.6, 1], target: [0, 1.2, -11] };
const SKY_TIGHT = { position: [0, 1.2, -3.5], target: [0, 1.5, -11] };
const SKY_FINALE = { position: [1.5, 0.4, 5], target: [0, 0.9, -11] };
const LINEUP = { position: [-0.6, 0.75, 1.05], target: [-20, -0.4, -1.2] };
const CONES = { position: [-11, 8.6, 1.2], target: [-2.8, -0.8, 0] };
const TIP = { position: [-4.4, 2.2, 2.6], target: [-1.0, 0.25, 0.1] };
const TIP_SIDE = { position: [-1.6, 0.9, 6.2], target: [-1.6, 0.35, 0] };
const TRACK = { position: [-5.3, 1.5, -0.4], target: [0, -0.2, 0] };
const SPOT = { position: [-3.1, 1.3, -0.9], target: [-0.7, 0.3, 0.05] };
const NODES = { position: [-2.8, 6.8, 18.5], target: [-2.8, -0.6, 0] };
const NODES_HIGH = { position: [4, 9, 17], target: [-1.5, -1.2, 0] };

export default {
  hook: 'The Moon’s shadow is usually\ntoo short to reach you.',

  render: {
    formats: ['short'],
    captions: true,
    captionStyle: 'bold-karaoke',
    followOverlay: { short: true },
    speed: 1.0, // channel voice at 1x; make-narration's own default is 0.9
  },

  // 9:16 — ~70s. One take, 8 spoken lines, silent cuts inside them.
  short: {
    shots: [
      // Zone 1 — the hook over the Moon biting into the Sun; totality arrives
      // under the second sentence
      {
        step: 0,
        camera: SKY_WIDE,
        labels: [],
        narration:
          'The Moon’s shadow is usually too short to reach you. Yet every year or two, it turns noon into night somewhere on Earth.',
      },
      { step: 0, camera: SKY_TIGHT, seconds: 2.2 },
      { step: 0, camera: SKY_WIDE, orbit: 8, seconds: 2 },

      // Zone 2 — the coincidence, shown literally: two same-size discs
      {
        step: 1,
        camera: LINEUP,
        labels: [],
        narration:
          'Blame a coincidence. The Sun is four hundred times wider than the Moon, and four hundred times farther away. So in your sky, they look the same size.',
      },
      { step: 1, camera: LINEUP, push: 0.9, seconds: 2 },

      // Zone 3 — the cone, then the loop asked out loud
      {
        step: 2,
        camera: CONES,
        labels: [],
        narration:
          'That makes the Moon’s shadow a cone, squeezed to a point by light from opposite edges of the Sun. So how does a shadow that’s usually too short ever reach you?',
      },
      { step: 2, camera: CONES, orbit: 12, seconds: 2.4 },

      // Zone 4 — the mechanism: close = total, far = ring of fire
      {
        step: 3,
        camera: TIP,
        labels: [],
        narration:
          'The Moon’s orbit is stretched. When it swings close, the tip touches the ground. That’s totality. When it’s far, the tip falls short, and you get a ring of fire.',
      },
      { step: 3, camera: TIP_SIDE, seconds: 2.4 },
      { step: 3, camera: TIP, push: 0.92, seconds: 2 },

      // Re-hook — a change of scale: down onto the ground
      {
        step: 4,
        camera: TRACK,
        labels: [],
        narration:
          'Here’s the part that gets me. Where it lands, it’s a dark spot at most two hundred and sixty seven kilometres wide, racing east at seventeen hundred kilometres an hour.',
      },
      { step: 4, camera: TRACK, push: 0.88, seconds: 2.4 },

      // Zone 4b — BUT: why not every month, at true scale
      {
        step: 5,
        camera: NODES,
        labels: [],
        narration:
          'But it can’t happen every month. The Moon’s orbit is tilted five degrees, so most new Moons throw their shadow right past us.',
      },
      { step: 5, camera: NODES_HIGH, seconds: 2.4 },

      // Zone 5 — the stat, isolated on a hard cut to the ground track
      {
        step: 4,
        camera: SPOT,
        move: 'cut',
        labels: [],
        narration: 'Any one spot on Earth waits about three hundred and seventy five years.',
      },

      // Zone 6 + 7 — so-what, then the button closes the loop over totality
      {
        step: 6,
        camera: SKY_FINALE,
        labels: [],
        narration:
          'And the Moon drifts almost four centimetres farther every year, so one day the tip won’t reach at all. Usually too short. Sometimes, just long enough.',
      },
      { step: 6, camera: SKY_WIDE, seconds: 3 },
    ],
  },
};
