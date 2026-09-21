// Editorial layer for video export (scripts/render.mjs -> export-video.mjs).
// steps: 0 anatomy · 1 inside the dome · 2 fission · 3 fuel + water
//        4 control rods · 5 primary loop · 6 steam generator
//        7 turbine/generator · 8 the plant runs
//
// STORY LENS: not "a nuclear plant is really a steam engine" — the coal-plant
// short already owns that ending, and it is the common angle anyway. The
// uncommon, genuinely counterintuitive fact is that the water is not there to
// damp the reaction down. It is the reason the reaction runs at all: fast
// neutrons barely split U-235, and water is what slows them enough to be
// caught. That paradox is the loop, planted in shot 2 and closed by the button.
export default {
  hook: 'A nuclear reactor cannot run\nwithout water.',

  render: {
    formats: ['short'],
    captions: true,
    captionStyle: 'bold-karaoke',
    titleCard: true,
    endCard: false,
    // Outward-facing promise, requested explicitly for this export.
    followOverlay: true,
    fps: 30,
  },

  // 9:16 — ~80s at the channel voice's pace. 8 beats: hook -> loop + question
  // -> fission -> BUT the neutrons are too fast -> THEREFORE water slows them
  // -> the stat -> so-what -> button closing the loop.
  short: {
    shots: [
      {
        // Zone 1 — hook on the sealed site. No callouts: the hook names no
        // part, and the bare dome is the strongest scroll-stopper here.
        step: 0,
        labels: [],
        narration:
          "A nuclear reactor can't run without water. Not because it would overheat, but because the reaction would stop dead.",
      },
      {
        // Zone 2 + 3 — plant the loop, then ask the question out loud. The
        // dome opens on this line, so the reveal lands with "in there".
        step: 1,
        labels: ['Reactor pressure vessel'],
        // Solver put the pressuriser across the foreground and left the lower
        // 40% of a portrait frame on the bare containment floor. Both vessels
        // are TALL, which portrait actually wants, so frame the pair on their
        // shared midpoint. Bearing checked to clear the pressuriser.
        camera: { position: [0.09, 1.98, 2.41], target: [-2.02, 1.1, -0.11] },
        narration:
          "The stuff we put fires out with is the only thing keeping this one lit. So how does water feed a nuclear fire? Start with what's splitting in there.",
      },
      {
        // Zone 4a — the split itself.
        step: 2,
        labels: ['U-235 nucleus'],
        // The fission group is a few centimetres across, so fitting it filled
        // the frame with orange rod stripes and one white blob: unreadable.
        // Pull back to 1.45 so the event reads WITH the bundle around it.
        camera: { position: [-1.35, 1.14, 1.23], target: [-2.3, 0.82, 0.19] },
        narration:
          'A uranium nucleus is barely holding itself together. One slow neutron drifts in, and it splits in two, throwing off heat and two or three fresh neutrons.',
      },
      {
        // Zone 4b — BUT. Same step, different callout, so the auto-framer
        // solves a new pose off the scattering neutrons instead of repeating
        // the previous shot's framing.
        step: 2,
        labels: ['2 to 3 new neutrons'],
        // Same event, wider and off a shallower bearing, so the BUT beat is a
        // new shot rather than a repeat of the one before it.
        camera: { position: [-1.48, 1.26, 1.61], target: [-2.3, 0.82, 0.19] },
        narration:
          "But those fresh neutrons come out far too fast. A fast neutron passes straight through uranium like it isn't even there.",
      },
      {
        // Zone 4c — THEREFORE: the water is what fixes that.
        step: 3,
        labels: ['Water: coolant AND neutron moderator'],
        // On the vessel mid-section, where the downcomer annulus the line is
        // about is actually visible beside the core.
        camera: { position: [-1.29, 1.07, 1.2], target: [-2.41, 0.85, 0.08] },
        narration:
          'So the water does a second job. Every bounce off it costs a neutron a little speed, until one is finally slow enough to get caught.',
      },
      {
        // Zone 5 — the stat, isolated on its own beat, on the fuel itself.
        step: 3,
        labels: ['Fuel rods — UO2 pellets in zircaloy'],
        // Tight on the bundle: the stat is the reward beat, and it should not
        // land on the same framing as the two shots before it.
        camera: { position: [-1.67, 0.88, 0.82], target: [-2.41, 0.79, 0.08] },
        narration:
          "And here's what that buys you. One ceramic pellet, about the size of a pencil eraser, carries the heat of a ton of coal.",
      },
      {
        // Zone 6 — so-what: the reason this is a place people can work in.
        step: 6,
        labels: ['Steam out — never touched the fuel'],
        // The generator is the tallest object in the dome, which suits portrait,
        // but the obvious bearing puts the pressuriser dead on the sightline.
        // 55 degrees clears it (checked against both the pressuriser and pump).
        camera: { position: [-0.01, 1.58, 0.83], target: [-1.63, 1.3, -0.3] },
        narration:
          'None of that heat reaches the turbine directly. It crosses into a separate water loop through thousands of thin tubes. The steam spinning that turbine has never touched uranium.',
      },
      {
        // Zone 7 — button, on the re-sealed plant. Closes the loop and
        // re-primes the hook for the replay.
        step: 8,
        labels: [],
        // A 7.4-unit-wide site cannot fill a 9:16 frame: solved whole, the plant
        // shrank to a speck in a sea of empty. Close on the RE-SEALED dome
        // instead, with the hall and tower receding. It is the truer image for
        // this line, and it rhymes with shot 1 so the replay loop lands.
        camera: { position: [1.15, 2.64, 1.9], target: [-2.15, 1.4, 0] },
        narration: 'Take the water, and the fire goes out.',
      },
    ],
  },

  platforms: {
    shorts: {
      title: "A nuclear reactor can't run without water",
      hashtags: ['#nuclear', '#physics', '#howitworks', '#engineering', '#whatdstuff'],
    },
  },
};
