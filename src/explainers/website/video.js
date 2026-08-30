// Editorial layer for video export (scripts/export-video.mjs).
// steps: 0 overview · 1 dns · 2 request · 3 server · 4 backend · 5 db
//        6 response · 7 frontend · 8 run
//
// STORY LENS: "how a website works" is a saturated topic, and the common
// angle (a request travels across the internet) is already the
// `internet-request` explainer's job. This one takes the uncommon angle the
// model was built for: a website is not a thing you visit, it is a thing that
// gets BUILT for you, on demand, twice. Once on a server, then again out of
// text inside your browser. Everything in the script hangs off that.
//
// SCRIPTING: one flowing voiceover. make-narration.mjs synthesizes it in a
// SINGLE ElevenLabs take and the exporter paces the picture to the audio, so
// each shot's line is only a cut point and hands off into the next. Captions
// are the verbatim voice rail, so the hook lives in shot 1's first spoken
// sentence.
//
// The loop: planted word one ("didn't exist until you asked for it") and
// closed word-for-word in the button ("None of it existed until you asked"),
// which also re-arms the hook when the short replays.
//
// No em/en dashes in any narration line: ElevenLabs renders them as dead air
// the speed knob cannot compress. Numbers are spelled as they should be
// spoken ("forty million", "about sixteen milliseconds").
//
// DOLLY, corrected against a 6fps smoke render: the instinct to pull WAY back
// for portrait was wrong here. The stage already widens its FOV for narrow
// aspects, so a heavy dolly just shrinks the subject, and at 2.1 the hero shot
// was two specks in a black frame. Portrait's real constraint on a ten-unit
// horizontal corridor is that showing BOTH machines at once always reads
// small, so the edit opens on the screen instead and saves the two-machine
// wide for the question and the button, where small is the point. Macro shots
// (rack, sled, drawer) suit portrait as-is and barely dolly at all.
export default {
  // Legacy-only card (burns only if words.json is missing). In sync with
  // shot 1's opening line.
  hook: 'The page you\'re looking at\ndidn\'t exist until you asked.',

  // Consumed by scripts/make-postkit.mjs. Authored here with the script so the
  // packaging promise and the hook say the same thing.
  platforms: {
    shorts: {
      title: 'What a website actually is',
      hashtags: ['#webdev', '#coding', '#howitworks', '#programming', '#tech'],
    },
  },

  // 9:16 — ~172 words at ~2.3 words/sec (~75s). Spine: hook -> stakes + loop
  // + spoken question -> BUT/THEREFORE mechanism (name, server, backend) ->
  // re-hook -> isolated stat -> so-what -> button that closes the loop.
  short: {
    dolly: 1.6,
    shots: [
      {
        // Zone 1 — hook: the loop is planted in the first six words. Opens on
        // the SCREEN, not the wide: "the page you're looking at" wants a page
        // on it, and this step's layers landing is literally "it got built".
        step: 7,
        dolly: 1.8,
        labels: [],
        narration:
          "The page you're looking at didn't exist until you asked for it. It got built from scratch in about a third of a second.",
      },
      {
        // Zone 2+3 — pull out to both machines: this is where "your computer
        // holds none of it" needs the other machine in frame
        step: 0,
        dolly: 1.75,
        labels: [],
        narration:
          "Your computer holds none of it. It has a name, and a name is not an address. So how does a name find one machine out of billions?",
      },
      {
        // Zone 4a — THEREFORE: the answer, and the surprise inside it
        step: 1,
        dolly: 1.3,
        labels: ['The A record lives here'],
        narration:
          "You don't own that name, you rent it. And the registry never stores your site, only a pointer to whichever server speaks for you.",
      },
      {
        // Zone 4b — BUT: the machine that answers is really two machines
        step: 3,
        dolly: 1.25,
        labels: ['Web server tier'],
        narration:
          "The machine that answers has two jobs. Ask for a file that exists, and it hands it over. Ask for something about you, and it has to go deeper.",
      },
      {
        // Zone 4c — re-hook, then the backend in one breath
        step: 4,
        dolly: 1.2,
        labels: ['Your code runs here'],
        narration:
          "Here's the part that gets me. A program wakes up, works out who you are, and asks a database.",
      },
      {
        // Zone 5 — the stat, isolated on its own beat
        step: 5,
        dolly: 1.15,
        labels: ['Index seek — not a scan'],
        narration:
          "That table might hold forty million rows. Finding one takes about four reads. A sorted index means the search skips almost everything, at every step.",
      },
      {
        // Zone 6 — so-what: the answer arriving and the page painting in
        step: 6,
        dolly: 1.35,
        labels: [],
        narration:
          "The answer comes back as plain text. Your browser rebuilds it into structure, style, and pixels. About sixteen milliseconds a frame.",
      },
      {
        // Zone 7 — button: 7 words, closes the loop, re-arms the hook on replay
        step: 8,
        dolly: 1.75,
        labels: [],
        narration: 'None of it existed until you asked.',
      },
    ],
  },
};
