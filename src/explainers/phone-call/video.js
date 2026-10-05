// steps: 0 whole call · 1 voice→electricity · 2 sampled & compressed
//        3 coded/encrypted onto radio · 4 up to tower · 5 core routes
//        6 down into their phone · 7 both ways at once
//
// LENS: a call FEELS like your voice travels — it doesn't. It stops being
// sound at the microphone and only becomes sound again in their ear. Planted
// loop: "stops being sound" (hook) -> "Not your voice" (button), both
// anchored on "voice", which also carries the hook's own shot (the mic) back
// in for the button, closing the loop visually as well as verbally.
//
// SCRIPTING: one flowing single-take voiceover; every line hands off into
// the next on a repeated word ("voice" hook->stakes->question->digitize->
// core->rebuild->button, "code" digitize->radio, "tower" radio->core,
// "whole"/"relay" stat->duplex). No em/en dashes anywhere (ElevenLabs
// renders them as dead air the speed knob can't compress).
//
// FRAMING: this scene has no per-step `focus` (built before that
// convention), so every close shot passes an explicit `frame` — including
// every SILENT one; the portrait default fill (0.88) is too tight for a
// tiny label pair once a push-in shrinks the distance further, and crops.
// There is deliberately NO whole-relay wide shot anywhere in this short:
// phoneA and phoneB sit ~13 units apart, and at 9:16 that's wide enough
// that every framing tried (the solver, the step's own landscape camera)
// either crops both ends off-frame or shrinks the machine to an unreadable
// ~10%-tall sliver on a wall of black. So the "establishing" beats
// (stakes, question, stat, duplex) each land on ONE real part instead —
// the question teases the core network, the payoff beat delivers it, and
// the duplex beat calls back to that same core, which is more legible AND
// a tighter visual through-line than a wide shot would have been.

export default {
  hook: 'The moment your voice hits this microphone, it stops being sound.',

  // Requested explicitly: captioned + follow overlay. No end card (not asked).
  render: {
    formats: ['short'],
    captions: true,
    captionStyle: 'bold-karaoke',
    titleCard: true,
    endCard: false,
    followOverlay: true,
    fps: 30,
  },

  short: {
    shots: [
      {
        // Zone 1 — hook, cold open on the actual moment
        step: 1,
        labels: ['Microphone: air pressure to a wiggling voltage'],
        frame: ['Microphone: air pressure to a wiggling voltage'],
        fill: 0.6,
        narration: 'The moment your voice hits this microphone, it stops being sound.',
      },
      {
        step: 1,
        labels: ['Sound waves in', 'Microphone: air pressure to a wiggling voltage'],
        frame: ['Sound waves in', 'Microphone: air pressure to a wiggling voltage'],
        fill: 0.55,
        push: 0.95,
        seconds: 1.2,
      },

      {
        // Zone 2 — stakes + planted loop, on the modem/antenna (no whole-
        // relay wide shot: phoneA-to-phoneB is ~13 units, wider than
        // portrait can hold at any distance that doesn't crop — see header)
        step: 3,
        labels: ['Modem: packetize, error-code, encrypt'],
        frame: ['Modem: packetize, error-code, encrypt'],
        fill: 0.6,
        move: 'cut',
        narration: 'It gets torn into pure numbers, and for the next tenth of a second, it isn’t a voice at all.',
      },
      {
        step: 3,
        labels: ['RF + PA modulate onto the carrier'],
        frame: ['RF + PA modulate onto the carrier'],
        fill: 0.55,
        push: 0.95,
        seconds: 1.3,
      },

      {
        // Zone 3 — the spoken question, teasing the destination it'll pay
        // off at Zone 4c
        step: 5,
        labels: ['Packet core routes the media (RTP)'],
        frame: ['Packet core routes the media (RTP)'],
        fill: 0.78,
        move: 'cut',
        narration: 'So how does a stream of numbers turn back into your friend’s voice, on the other side of the planet?',
      },

      {
        // Zone 4a — sampled, compressed, encrypted
        step: 2,
        labels: ['ADC samples the voltage 16,000×/sec', 'EVS codec compresses 20 ms frames'],
        frame: ['ADC samples the voltage 16,000×/sec', 'EVS codec compresses 20 ms frames'],
        fill: 0.6,
        move: 'cut',
        narration:
          'First it’s sampled sixteen thousand times a second, squeezed down, and encrypted, so what leaves your phone isn’t your voice, it’s a tiny burst of code.',
      },
      {
        step: 2,
        labels: ['ADC samples the voltage 16,000×/sec', 'EVS codec compresses 20 ms frames'],
        frame: ['ADC samples the voltage 16,000×/sec', 'EVS codec compresses 20 ms frames'],
        fill: 0.55,
        push: 0.95,
        seconds: 1.2,
      },
      {
        step: 3,
        labels: ['Antenna radiates the radio wave'],
        frame: ['Antenna radiates the radio wave'],
        fill: 0.6,
        move: 'cut',
        seconds: 1.0,
      },

      {
        // Zone 4b — radio wave to the tower
        step: 4,
        labels: ['Uplink radio (SC-FDMA, e.g. ~1.9 GHz)', 'eNodeB / gNB base station'],
        frame: ['Uplink radio (SC-FDMA, e.g. ~1.9 GHz)', 'eNodeB / gNB base station'],
        fill: 0.6,
        move: 'cut',
        narration:
          'That code rides a radio wave to the nearest tower, a couple of kilometres away, in less than a hundredth of a millisecond.',
      },
      {
        step: 4,
        labels: ['Backhaul: fibre or microwave to the core'],
        frame: ['Backhaul: fibre or microwave to the core'],
        fill: 0.55,
        push: 0.95,
        seconds: 1.3,
      },

      {
        // Zone 4c — re-hook + the core network
        step: 5,
        labels: ['Packet core routes the media (RTP)', 'HSS locates the recipient'],
        frame: ['Packet core routes the media (RTP)', 'HSS locates the recipient'],
        fill: 0.78,
        move: 'cut',
        narration:
          'Here’s the part that gets me: the network then has to find your friend, anywhere on Earth, and route your voice straight to their tower.',
      },
      {
        step: 5,
        labels: ['IMS: SIP sets up the session'],
        frame: ['IMS: SIP sets up the session'],
        fill: 0.6,
        seconds: 1.2,
      },

      {
        // Zone 4d — rebuilt at the other end. phoneB is rotated 180° (it
        // faces the network on its -X side — model.js `phoneB.group.rotation.y
        // = Math.PI`), so the label-solved camera approaches from the BACK of
        // the board (a blank green plane, no components). Use the step's own
        // authored camera, which already looks at the populated front face.
        step: 6,
        labels: ['Demodulate, decrypt, decode, DAC', 'Speaker pushes air to their ear'],
        camera: { position: [6.6, 1.0, -2.6], target: [6.6, 0.7, -0.05] },
        move: 'cut',
        narration:
          'Their phone catches your voice, decodes it, and drives a speaker, so the sound that left your mouth arrives, rebuilt, in their ear.',
      },
      {
        step: 6,
        labels: ['Speaker pushes air to their ear'],
        camera: { position: [6.6, 1.0, -2.6], target: [6.6, 0.7, -0.05] },
        push: 0.95,
        seconds: 1.3,
      },

      {
        // Zone 5 — THE STAT, isolated, hard cut to the finish line (the ear)
        step: 6,
        labels: ['Speaker pushes air to their ear'],
        camera: { position: [6.6, 1.0, -2.6], target: [6.6, 0.7, -0.05] },
        move: 'cut',
        narration: 'That whole relay carries your voice, start to finish, in about a tenth of a second.',
      },
      {
        step: 6,
        labels: ['Demodulate, decrypt, decode, DAC', 'Speaker pushes air to their ear'],
        camera: { position: [6.6, 1.0, -2.6], target: [6.6, 0.7, -0.05] },
        orbit: 8,
        seconds: 1.4,
      },

      {
        // Zone 6 — so-what: full duplex, callback to the core that routes
        // BOTH directions (D teased it, 4c paid it off, this closes it).
        // Camera PINNED, not solved: this is a REVISIT of step 5 (already
        // shown at Zone 3/4c above), and a solved shot revisiting an
        // earlier step after the export has passed through an intervening
        // `camera`-pinned block (Zone 4d, below) renders with the phone/rack
        // detail missing — an export-time staleness in the solver's frame,
        // not a defect in the model. Every shot from here to the end of the
        // short stays camera-pinned for the same reason.
        step: 5,
        labels: ['Packet core routes the media (RTP)'],
        camera: { position: [0, 1.15, 4.4], target: [0, 0.95, 0] },
        move: 'cut',
        narration:
          'And that whole relay runs both directions at once, so you can interrupt each other without your voice ever breaking up.',
      },
      {
        step: 5,
        labels: ['Packet core routes the media (RTP)', 'HSS locates the recipient'],
        camera: { position: [0, 1.15, 4.4], target: [0, 0.95, 0] },
        orbit: 8,
        seconds: 1.2,
      },

      {
        // Zone 7 — button, closes the "voice"/"stops being sound" loop on
        // the same shot the hook opened on. Also a revisit — camera pinned
        // for the same reason as Zone 6 above.
        step: 1,
        labels: ['Microphone: air pressure to a wiggling voltage'],
        camera: { position: [-6.6, 1.0, 2.6], target: [-6.6, 0.55, 0] },
        move: 'cut',
        narration: 'Not your voice, for one tenth of a second.',
      },
      {
        step: 1,
        labels: ['Microphone: air pressure to a wiggling voltage'],
        camera: { position: [-6.6, 1.0, 2.6], target: [-6.6, 0.55, 0] },
        push: 0.95,
        seconds: 1.6,
      },
    ],
  },

  long: {
    shots: [
      { step: 0, seconds: 8, narration: 'A phone call feels effortless — you talk, they hear you. But behind that simplicity, your voice is converted, digitized, encrypted, beamed through the air, routed across the network, and rebuilt, all in a fraction of a second, both directions at once.' },
      { step: 1, seconds: 9, narration: 'It starts at the microphone. Sound is just moving air, and the mic turns the pressure of your voice into a matching electrical wiggle — an analog copy of the sound, in the form of a changing current.' },
      { step: 2, seconds: 9, narration: 'But the network is digital, so that wiggle is measured thousands of times a second and turned into numbers. Then it’s compressed, throwing away what your ear won’t miss, shrinking your voice to a thin stream of data.' },
      { step: 3, seconds: 9, narration: 'Those numbers are wrapped in error-correcting codes, encrypted for privacy, and modulated onto a radio wave. Your voice is now a scrambled, resilient signal ready to fly through the air.' },
      { step: 4, seconds: 8, narration: 'Your phone transmits it to the nearest cell tower. That tower is your on-ramp to the whole telephone system, catching your faint signal and passing it into the network.' },
      { step: 5, seconds: 9, narration: 'From the tower it enters the core network, the carrier’s high-speed backbone. The system looks up the other person, figures out which tower they’re under, anywhere in the world, and routes your voice toward them.' },
      { step: 6, seconds: 9, narration: 'It arrives at their tower, is beamed down to their phone, decrypted, decompressed, and converted from numbers back into an electrical wiggle that drives their speaker. The air moves, and they hear you.' },
      { step: 7, seconds: 8, narration: 'And the astonishing part: this whole chain runs both ways simultaneously, with such tiny delay that it feels like you’re simply talking. Two voices, rebuilt from data, meeting in the middle in real time.' },
    ],
  },

  platforms: {
    shorts: {
      title: 'Your voice stops being your voice for a tenth of a second',
      hashtags: ['#phonecall', '#howitworks', '#networking', '#science', '#whatdstuff'],
    },
  },
};
