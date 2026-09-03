// Editorial layer for video export (scripts/export-video.mjs).
//
// SCRIPTING: one flowing voiceover, single ElevenLabs take — each line hands
// off into the next rather than standing alone. 8-beat arc: pattern interrupt
// -> curiosity hook -> spoken question -> reveal -> step-by-step (converter,
// then the planetary trick) -> isolated stat (one sun, every ratio) ->
// real-world connection -> callback button. Loop: "no clutch pedal" planted
// in shot 1, closed in the button (shot 7).
//
// Facts reused verbatim from the built explainer (independently reviewed):
// stator torque multiplication up to 2:1 at stall; sun 36T / ring 72T shared
// by both planetary sets, giving 2.50 / 1.50 / 1.00 / 2.00-reverse.
export default {
  hook: 'This transmission\nhas no clutch pedal.',

  // 9:16 — ~80s, 7 shots.
  short: {
    shots: [
      {
        // Zone 1 — hook: matches the full sealed model, establishing shot
        step: 0,
        dolly: 1,
        camera: { position: [8.98, 4.4, 7.81], target: [0.07, 1.35, 0.15] },
        caption: 'This transmission has no clutch pedal.',
        narration:
          'This transmission has no clutch pedal, no lever, not even a stick you’d recognize — it shifts three gears with a doughnut of spinning oil.',
      },
      {
        // Zone 2+3 — stakes + planted detail, then the spoken question
        step: 1,
        dolly: 1,
        camera: { position: [-8.5, 4.6, 8.1], target: [0.07, 1.35, 0.15] },
        caption: 'So how does spinning oil replace a clutch?',
        narration:
          'Crack the case open and there’s no gearstick in here — just two gear sets on one shaft, and oil deciding which part gets clamped still. So how does spinning fluid replace a clutch?',
      },
      {
        // Zone 4a — reveal: name the converter
        step: 2,
        dolly: 1,
        camera: { position: [-2.556, 2.36, 3.95], target: [-0.986, 1.32, 0.19] },
        labels: ['Impeller — engine side', 'Turbine — gearbox side'],
        caption: 'It starts in the torque converter',
        narration:
          'It starts here, in the torque converter. The engine spins this wheel, the impeller, which flings oil across a gap to a second wheel, the turbine — no metal ever touches.',
      },
      {
        // Zone 4b — the stator, connective handoff
        step: 2,
        dolly: 1,
        camera: { position: [-2.556, 2.36, 3.95], target: [-0.986, 1.32, 0.19] },
        labels: ['Stator'],
        caption: 'The stator turns the oil around',
        narration:
          'But a third wheel, the stator, catches oil coming back the wrong way and redirects it to help the impeller — from a stop, that trick doubles the engine’s twisting force.',
      },
      {
        // Zone 4c — THEREFORE: the planetary trick
        step: 4,
        dolly: 1,
        camera: { position: [4.085, 2.897, 2.825], target: [0.13, 1.35, 0.02] },
        labels: ['Sun gear · 36 teeth', 'Planet carrier', 'Ring gear · 72 teeth'],
        caption: 'One gear set, three different answers',
        narration:
          'Next it hits a planetary gear set — a sun in the middle, a ring around the outside, planets between them. Hold the sun, you get one speed; lock it all together, you get another. Same gears, three different answers.',
      },
      {
        // Zone 5 — isolated stat, its own beat
        step: 7,
        dolly: 1,
        camera: { position: [3.124, 3.744, 7.117], target: [0.35, 1.35, 0.05] },
        labels: ['Sun', 'Rear carrier', 'Output'],
        caption: 'One ratio makes every gear — even reverse',
        narration:
          'Here’s the number that gets me: both gear sets share one sun with thirty-six teeth and a ring with seventy-two. First gear, second, third, even reverse — it all falls out of that one ratio.',
      },
      {
        // Zone 6+7 — real-world connection + the callback button
        step: 8,
        dolly: 2.4,
        caption: 'No clutch, no pedal — just oil, deciding.',
        narration:
          'So next time it shifts with no lever moving at all, that’s oil clamping one part of a gear set perfectly still. No clutch, no pedal — just oil, deciding.',
      },
    ],
  },

  platforms: {
    shorts: {
      title: 'How an Automatic Transmission Actually Shifts (No Clutch, No Lever)',
      hashtags: ['#automatictransmission', '#howitworks', '#engineering', '#cars', '#mechanics'],
    },
  },
};
