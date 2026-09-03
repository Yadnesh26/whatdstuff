// Editorial layer for video export (scripts/export-video.mjs).
// steps: 0 anatomy · 1 hot side (exhaust->turbine) · 2 one shaft · 3 cold side
//        4 oil film · 5 950C/aluminium · 6 wastegate · 7 the run
//
// SCRIPTING: one flowing take, 8-beat arc. Loop: hook plants "throws away...
// power" (the engine wastes fuel as exhaust heat); button closes it with
// "never wasted, just late" — a direct callback that also seeds turbo lag
// without ever using the word. Numbers match the built explainer's own copy
// (a third of fuel out the exhaust, 820C exhaust in, 10k idle / 200k full
// boost, oil film thinner than a coat of paint) so the video never contradicts
// the page it links to.
export default {
  hook: 'Your engine throws away\na third of its own power.',

  // 9:16 — ~70s. Wide/horizontal subject (axis runs sideways), so most shots
  // carry a bigger-than-default dolly to keep both housings in a 9:16 crop.
  short: {
    shots: [
      {
        // 1. hook — the boldest true claim, matches the full sealed unit
        step: 0,
        dolly: 2.3,
        seconds: 13,
        labels: [],
        narration:
          'Your engine throws away almost a third of the fuel it burns, as hot gas blasting out the tailpipe. This little machine catches it, and hands the power back.',
      },
      {
        // 2. stakes — plants how, not just that
        step: 1,
        dolly: 2.0,
        seconds: 9,
        labels: ['Turbine wheel'],
        narration:
          'Put a fan in that wasted heat, and a second fan spins on the very same shaft, stuffing extra air into the engine for barely any extra cost.',
      },
      {
        // 3. the question, out loud
        step: 2,
        dolly: 2.4,
        seconds: 9,
        labels: [],
        narration:
          'So how do you run one fan at eight hundred degrees, and a second one inches away, in aluminium that would melt if it got anywhere near that heat?',
      },
      {
        // 4. reveal — camera holds on the shaft
        step: 2,
        dolly: 2.4,
        seconds: 7,
        labels: ['Shaft - 10 mm'],
        narration:
          "Turns out there's no gearbox and no belt between them. Just one steel shaft. Whatever the hot end does, the cold end does too.",
      },
      {
        // 5. BUT — the mechanism that makes that survivable
        step: 4,
        dolly: 1.7,
        seconds: 9,
        labels: ['Floating ring', 'Oil film'],
        narration:
          "But a shaft spinning that fast can't touch anything solid. So it floats on a film of engine oil thinner than a coat of paint, and never makes contact.",
      },
      {
        // 6. re-hook + isolated stat, on the spinning turbine for pace
        step: 1,
        dolly: 1.9,
        seconds: 9,
        labels: [],
        narration:
          "Here's the part that gets me: idle is already ten thousand RPM. Floor it, and that shaft passes two hundred thousand: over three thousand spins every second.",
      },
      {
        // 7. so-what — the part that keeps it from destroying itself
        step: 6,
        dolly: 2.0,
        seconds: 10,
        labels: ['Actuator - boost-fed', 'Flapper'],
        narration:
          'But left alone, that spiral never stops. More boost makes more exhaust, and more exhaust spins it harder. So a spring-loaded valve bleeds exhaust around the wheel the instant boost turns dangerous.',
      },
      {
        // 8. button — closes the "throws away" loop
        step: 7,
        dolly: 2.3,
        seconds: 4,
        labels: [],
        narration: 'The power was never wasted. Just late.',
      },
    ],
  },

  platforms: {
    shorts: {
      title: 'Your engine is throwing away a third of its own power',
      hashtags: '#turbocharger #howitworks #engineering #cars #whatdstuff',
    },
  },
};
