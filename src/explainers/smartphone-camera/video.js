// Editorial layer for video export (scripts/export-video.mjs).
// steps: 0 exterior (bump) · 1 three modules inside · 2 voice-coil AF ·
//        3 fixed aperture stop · 4 rare six-blade iris · 5 gyro OIS ·
//        6 folded periscope telephoto · 7 quad-Bayer sensor · 8 run it
//
// STORY LENS: not "how a phone camera works" but "nothing in there is held
// still." The lens rides on hair-thin wires and a motor flies it; that same
// floating rig is what the OIS coils shove sideways to fight your hand. One
// loop: floating/flying, planted in the hook, closed word-for-word in the
// button. Periscope + sensor steps are deliberately left out of the short —
// one spine, told properly, beats five facts crammed in.
export default {
  hook: "The lens in your phone\nisn't bolted down.",

  // 9:16 — single-take narration + word-synced caption rail. ~95s (complex
  // module: voice-coil AF, fixed aperture, gyro-driven OIS, isolated stat).
  // Arc: hook (floating/flying) -> stakes/question -> mechanism (coil ->
  // fixed hole -> gyro+wires) -> isolated stat (5,000/sec) -> so-what ->
  // button, closing the "flying" loop.
  short: {
    shots: [
      {
        // 1. hook — the boldest true sentence, word one; plants the loop
        step: 0,
        dolly: 1.5,
        narration:
          "The lens in your phone isn't bolted down. It floats on wires thinner than a hair, and a motor flies it back and forth hundreds of times a second.",
      },
      {
        // 2. stakes + the question
        step: 0,
        dolly: 1.5,
        narration:
          "That's just for focus. This lens also has no shutter, and barely any iris. So how does something this thin ever come out sharp?",
      },
      {
        // 3. mechanism beat 1 — the voice-coil motor
        step: 2,
        dolly: 1.4,
        labels: ['Voice-coil winding', 'Magnet'],
        narration:
          "Start with focus. There's no room for gears in a body this thin, so the lens rides in a coil of copper between four magnets, the same trick behind a speaker cone. Push current through it and the lens hunts until the light lands as one sharp point.",
      },
      {
        // 4. mechanism beat 2 — the fixed aperture (BUT)
        step: 3,
        dolly: 1.4,
        labels: ['Aperture stop'],
        narration:
          "There's no iris either. The hole here is moulded in place, wide open, and it never changes size. So the phone can't close down in bright light. It only has exposure time and gain left to work with. That's the whole reason night mode exists.",
      },
      {
        // 5. mechanism beat 3 — re-hook + gyro/OIS (THEREFORE)
        step: 5,
        dolly: 1.4,
        labels: ['Gyroscope', 'Suspension wire', 'OIS drive coil'],
        narration:
          "Here's the part that actually saves the shot. Your hand drifts through a fraction of a degree several times a second, enough to smear the picture. So a gyroscope reads that tilt a thousand times a second, and tiny coils shove the lens sideways on hair thin wires to cancel it out.",
      },
      {
        // 6. the stat, isolated on its own beat
        step: 5,
        dolly: 1.4,
        labels: [],
        narration:
          "Apple pushes that same trick to the sensor itself. Five thousand corrections, every single second.",
      },
      {
        // 7. so-what + button, closes the "floating/flying" loop
        step: 8,
        dolly: 1.5,
        narration:
          "That's why you can shoot handheld in a moving car, or grab a night shot with no tripod. Nothing in that lens is holding still. It's flying.",
      },
    ],
  },
};
