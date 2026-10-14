// Editorial layer for video export (scripts/export-video.mjs).
//
// SCRIPTING: one flowing voiceover, synthesized as a single ElevenLabs take —
// the per-shot `narration` strings are just the cut points; each hands off into
// the next. Arc: hook -> stakes -> spoken question -> reveal -> BUT/THEREFORE
// mechanism -> isolated stat -> re-hook (monsoon) -> so-what (snow) -> button.
//
// PACKAGING
//   Idea:   summer is not when Earth is closer; the north is farthest in July.
//   Lens:   the seasons, monsoon and snow are one lean, not one distance.
//   Loop:   "closest" planted in the hook and "getting closer" in the stakes,
//           closed in the button ("Not closer to the Sun. Just leaning."), which hands
//           straight back to "Earth is closest to the Sun in January" on replay.
//
// CAMERAS: every shot pins an explicit `camera`. This short hides all callouts
// (long readouts do not survive the 9:16 crop), and most of this explainer's
// anchors are bare Object3Ds re-placed per frame, so the framing solver would
// find an empty box. Poses are framed for a 1080x1920 frame at 42° vertical
// FOV: a 2.4-unit globe fills ~85% of the width from ~6.5 units.
//
// LOOP TIMING: the player starts a step's loop from its own start date the
// first time it is activated (index.js `t0`), then RESUMES it. Start dates
// were solved against short-words.json (video time = audio + 0.6s lead-in;
// step 1 also runs the 2s warm-up) so the month on screen is the month said:
//   orbit lap 12s, Earth at its January closest under "January", near
//     aphelion under "July"
//   lean: June under "June"; "December" is a hard cut to the finale step,
//     whose loop opens on 21 December
//   stat: the beam step resumes in April and runs at 3x, so the footprint
//     is tight under "June" and long under "December"
//   day length: "eight and a half in December" cuts to the snow step's
//     polar night (slowed to 0.25x so the snow line still starts in November)
//   monsoon: mid-May under "May", July rains under "rain belt"
//   snow: resumes in November, peaks under "forty seven million".
//
// No em dashes anywhere: ElevenLabs renders them as dead air.

// steps: 0 year · 1 orbit · 2 lean · 3 beam · 4 day length · 5 equinox ·
//        6 monsoon · 7 snow · 8 finale
const at = (center, azDeg, elDeg, dist) => {
  const a = (azDeg * Math.PI) / 180;
  const e = (elDeg * Math.PI) / 180;
  return {
    position: [
      center[0] + dist * Math.cos(e) * Math.sin(a),
      center[1] + dist * Math.sin(e),
      center[2] + dist * Math.cos(e) * Math.cos(a),
    ],
    target: center,
  };
};

const ORBIT_WIDE = at([0, 0, 0], -10, 58, 34);
const ORBIT_LOW = at([0, 0, 1], -20, 24, 30);
const HERO = at([0, 0, 0], 32, 12, 6.6);
const HERO_HIGH = at([0, 0.2, 0], 10, 30, 6.4);
const LEAN = at([0, 0, 0], 30, 8, 6.6);
const LEAN_POLE = at([0, 0.85, 0], 30, 18, 5.4);
const BEAM = at([0.75, 0.9, 0], 22, 14, 9.0);
const FOOT = at([1.05, 0.8, 0], 40, 16, 4.6);
const DAY = at([0, 0.25, 0], 18, 36, 6.6);
const DAY_TOP = at([0, 0.4, 0], 20, 62, 6.0);
const MONSOON = at([0, 0, 0], 0, 0, 5.2);
const INDIA = at([0, 0.15, 0], 0, 6, 3.7);
const SNOW = at([0, 0, 0], 0, 0, 6.2);
const ARCTIC = at([0, 0.55, 0], 0, 14, 4.4);
const FINALE = at([0, 0, 0], 40, 14, 6.8);

export default {
  hook: 'Earth is closest to the Sun in January.',

  render: {
    formats: ['short'],
    captions: true,
    captionStyle: 'bold-karaoke',
    followOverlay: { short: true },
    speed: 1.0, // channel voice at 1x; make-narration's own default is 0.9
  },

  // 9:16 — ~70s. One take, 10 spoken lines, silent cuts inside them.
  short: {
    shots: [
      // Zone 1 — the hook over the real orbit, Earth near its January closest
      {
        step: 1,
        camera: ORBIT_WIDE,
        labels: ['Closest · 3 Jan · 147.1 million km'],
        narration: 'Earth is closest to the Sun in January. That’s the middle of winter up north.',
      },
      { step: 1, camera: ORBIT_LOW, orbit: 10, seconds: 2.4, labels: ['Closest · 3 Jan · 147.1 million km'] },

      // Zone 2 — stakes + the loop planted ("getting closer")
      {
        step: 1,
        camera: ORBIT_LOW,
        labels: ['Farthest · 4 Jul · 152.1 million km'],
        narration:
          'So summer can’t be about getting closer. By July, we’re five million kilometres farther away.',
      },
      { step: 1, camera: ORBIT_WIDE, push: 0.92, seconds: 2.4, labels: ['Farthest · 4 Jul · 152.1 million km'] },

      // Zone 3 — the question, over a whole year on the globe
      { step: 0, camera: HERO, labels: [], narration: 'Then what actually makes a season?' },
      { step: 0, camera: HERO_HIGH, orbit: 8, seconds: 1.4 },

      // Zone 4 — the reveal: the lean, nodding toward the Sun and away
      {
        step: 2,
        camera: LEAN,
        labels: [],
        narration:
          'A lean. Earth’s axis is tipped twenty three and a half degrees. And it keeps pointing at the same star all year. So in June, the north leans into the Sun. In December, it leans away.',
      },
      // "In June, the north leans into the Sun" — the lean step reaches June here
      { step: 2, camera: LEAN_POLE, seconds: 2.8 },
      // "In December, it leans away" — hard cut to a step that opens on 21 Dec
      { step: 8, camera: LEAN, move: 'cut', labels: [], seconds: 2.03 },

      // Zone 4b — THEREFORE: low Sun spreads the light
      {
        step: 3,
        camera: BEAM,
        labels: [],
        narration:
          'Leaning away hurts twice. The Sun sits low, so the same sunlight gets smeared over more ground.',
      },
      { step: 3, camera: FOOT, seconds: 2.4 },

      // Zone 4c — BUT worse: the days shrink
      {
        step: 4,
        camera: DAY,
        labels: [],
        narration:
          'Worse, the days shrink. In Milan, fifteen and a half hours of daylight in June drops to eight and a half in December.',
      },
      // "drops to eight and a half in December" — the Arctic in polar night
      { step: 7, camera: ARCTIC, move: 'cut', labels: [], speed: 0.25, seconds: 2.06 },

      // Zone 5 — the stat, isolated on a hard cut to the beam footprint
      {
        step: 3,
        camera: FOOT,
        move: 'cut',
        speed: 3,
        labels: [],
        narration: 'Put together, a June day there gets four times the sunlight of a December one.',
      },

      // Re-hook — a change of scale: down onto India
      {
        step: 6,
        camera: MONSOON,
        labels: [],
        narration:
          'Here’s the part that gets me. The same lean brings the monsoon. In May, the Sun stands right over India. The land bakes, and the rain belt chases the heat north.',
      },
      { step: 6, camera: INDIA, seconds: 3 },
      { step: 6, camera: MONSOON, push: 0.9, seconds: 2.6 },

      // Zone 6 — so-what: snow, the same lean six months on
      {
        step: 7,
        camera: SNOW,
        labels: [],
        narration:
          'Six months later, the north tips away. The long nights win, and snow covers forty seven million square kilometres of land.',
      },
      { step: 7, camera: ARCTIC, seconds: 2.6 },

      // Zone 7 — the button closes the loop over the whole leaning planet
      {
        step: 8,
        camera: FINALE,
        orbit: 14,
        labels: [],
        narration: 'Not closer to the Sun. Just leaning.',
      },
    ],
  },
};
