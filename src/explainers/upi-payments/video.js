// Editorial layer for video export (scripts/render.mjs → export-video.mjs).
//
// LENS: a UPI payment moves no money. Two banks edit their own books because
// one machine in the middle told them to, and the real cash follows hours
// later, netted down. Planted loop: "the real cash doesn't move for hours"
// (shot 3) → "the money itself takes hours" (shot 22) → button "Nothing moved.
// Everybody just agreed.", which also re-primes the hook on replay.
//
// SCRIPTING: one flowing single-take voiceover; each line hands off into the
// next (shot 4 asks "what actually travels?", shot 5 answers with the topology;
// shot 14 ends on the bank's locked hardware, shot 15 opens "But the switch
// never moves money"). Transitions are but/therefore, never and-then. No em or
// en dashes anywhere in narration: ElevenLabs renders them as dead air the
// speed knob cannot compress. The dashes inside `labels` are fine, those are
// on-screen callouts and are never spoken.
//
// STAT PLACEMENT: the isolated number is seven hundred and ninety one million
// payments a day, on its own shot with a hard cut to the wide system (shot 19),
// and the collapse to ten settlement batches lands on the shot after it. The
// ₹249 payment itself is staged much earlier so the stat beat gets the figure
// nobody predicts.
//
// LABEL CONSTRAINT: export-video.mjs's per-shot `labels` filter can only NARROW
// what the step's onEnter already turned on, and activate() is a no-op when
// consecutive shots share a step. So across every run of shots on one step the
// label list here starts wide and only shrinks (see 5→8, 9→11, 12→14, 20→22).
// `frame` may name a callout that is currently hidden: it is a camera solve
// target, not a visibility switch, which is how the step-0 shots frame the
// counter objects with all callouts off.
export default {
  hook: 'Nothing moves when you pay by UPI.',

  // Declared render config (see export-content skill, step 0). The short,
  // captions and the Follow overlay were all requested explicitly by name;
  // no end card.
  render: {
    formats: ['short'],
    captions: true,
    captionStyle: 'bold-karaoke',
    titleCard: true,
    endCard: false,
    followOverlay: true,
    fps: 30,
  },

  // Posting copy, authored with the script rather than at upload time
  // (scripts/make-postkit.mjs reads this). Only `shorts` is filled in: this
  // explainer ships the 9:16 short alone, so the long-form YouTube fields stay
  // unauthored on purpose rather than being invented for a video that does not
  // exist.
  platforms: {
    shorts: {
      title: 'Nothing moves when you pay by UPI',
      hashtags: [
        '#upi',
        '#howitworks',
        '#npci',
        '#3danimation',
        '#payments',
        '#fintech',
        '#india',
        '#scienceexplained',
      ],
    },
  },

  // 9:16 — ~75s at the channel voice's pace (14 spoken beats across 23 shots).
  // lint-script estimates at 2.3 words/sec; the channel voice actually runs closer
  // to 2.55, which is why 191 words lands near 75s rather than the linted 83s.
  short: {
    shots: [
      {
        // Zone 1 — hook, on the sealed counter. No callouts: the hook names no
        // part, and the clean product shot is what stops the scroll.
        step: 0,
        labels: [],
        frame: ['An address, not a card reader'],
        fill: 0.88,
        narration: 'Nothing moves when you pay by UPI. Not one rupee leaves your bank.',
      },
      {
        // silent — push to the payer's handset showing ₹249
        step: 0,
        labels: [],
        frame: ['Your phone'],
        fill: 0.95,
      },
      {
        // Zone 2 — the second surprise, and the planted loop, on the merchant's
        // phone as the chime lands.
        step: 0,
        labels: [],
        frame: ["The merchant's phone"],
        fill: 0.92,
        narration: "The shop gets paid in two seconds anyway. The real cash doesn't move for hours.",
      },
      {
        // Zone 3 — the spoken question. Hard cut to the whole system running.
        step: 7,
        labels: [],
        frame: null,
        fill: 0.85,
        move: 'cut',
        narration: 'So what actually travels?',
      },
      {
        // Zone 4a — mechanism: the topology IS the answer. Widest label list on
        // this step, so the three shots below can only narrow it.
        step: 1,
        labels: [
          'The NPCI switch',
          'Your bank',
          "The shop's bank",
          "Your app borrows a bank's line",
          'One line each',
        ],
        frame: ['The NPCI switch'],
        fill: 0.9,
        move: 'cut',
        narration:
          "Your bank has no wire to the shop's bank. Every bank runs one line to one switch in the middle.",
      },
      {
        // silent — across to the payer's vault, so "no wire" is visibly true
        step: 1,
        labels: ['Your bank', "The shop's bank", "Your app borrows a bank's line", 'One line each'],
        frame: ['Your bank'],
        fill: 0.95,
      },
      {
        // silent — the spokes themselves
        step: 1,
        labels: ["Your app borrows a bank's line", 'One line each'],
        frame: ['One line each'],
        fill: 0.92,
      },
      {
        // Zone 4a THEREFORE — the payoff of the topology, on the PSP puck.
        step: 1,
        labels: ["Your app borrows a bank's line"],
        frame: ["Your app borrows a bank's line"],
        fill: 0.95,
        narration: "That's why a brand new app can pay any bank.",
      },
      {
        // Zone 4b — addressing. The handle is the routing instruction.
        step: 2,
        labels: ['shop@okaxis', 'The @ picks the bank', 'A name, not a number'],
        frame: ['shop@okaxis'],
        fill: 0.78,
        move: 'cut',
        narration:
          "That code is an address, not an account number. The part after the at sign tells the switch which bank to ask, and a name comes back.",
      },
      {
        // silent — the switch routing the lookup to exactly one bank
        step: 2,
        labels: ['The @ picks the bank', 'A name, not a number'],
        frame: ['The @ picks the bank'],
        fill: 0.9,
      },
      {
        // silent — the name arriving back
        step: 2,
        labels: ['A name, not a number'],
        camera: { position: [0.8, 3.8, 6.0], target: [3.44, 1.25, 1.83] },
      },
      {
        // Zone 4c — the re-hook, and it is a hard cut to macro on the phone.
        step: 3,
        labels: ['Sealed on your own phone', 'Still sealed here', 'Opened only in here'],
        frame: ['Sealed on your own phone'],
        fill: 0.8,
        move: 'cut',
        narration:
          "Here's the part that gets me. That PIN pad isn't your app's. It's NPCI code that seals your PIN before the app can look.",
      },
      {
        // silent — the sealed capsule riding through the switch, still shut
        step: 3,
        labels: ['Still sealed here', 'Opened only in here'],
        frame: ['Still sealed here'],
        fill: 0.9,
      },
      {
        // Zone 4c close — it cracks only inside the bank's hardware module.
        step: 3,
        labels: ['Opened only in here'],
        frame: ['Opened only in here'],
        fill: 0.95,
        narration: 'It only opens inside locked hardware at your bank.',
      },
      {
        // Zone 4d — BUT: the order of operations, and the order is the safety.
        step: 4,
        labels: ['ReqPay_Debit — subtract first', 'ReqPay_Credit — second'],
        frame: ['ReqPay_Debit — subtract first'],
        fill: 0.9,
        move: 'cut',
        narration:
          "But the switch moves no money. It tells your bank to subtract, waits for a yes, then tells the shop's bank to add.",
      },
      {
        // silent — the credit landing on the payee ledger, after the debit
        step: 4,
        labels: ['ReqPay_Credit — second'],
        camera: { position: [0.8, 3.8, 6.0], target: [3.44, 1.25, 1.83] },
      },
      {
        // Zone 4e — the thesis, on the arc that is drawn only to stay empty.
        step: 5,
        labels: ['No wire between them', 'Only a debt, written down'],
        frame: ['No wire between them', 'Only a debt, written down'],
        fill: 0.88,
        move: 'cut',
        narration: 'Each bank edited its own book. Nothing crossed between them.',
      },
      {
        // silent — the debt stacking up at the switch instead
        step: 5,
        labels: ['Only a debt, written down'],
        frame: ['Only a debt, written down'],
        fill: 0.93,
      },
      {
        // Zone 5 — THE STAT. Hard cut, wide, isolated, nothing else competing.
        step: 1,
        labels: [],
        frame: ['The NPCI switch'],
        fill: 0.9,
        move: 'cut',
        narration: 'Seven hundred and ninety one million of these a day.',
      },
      {
        // Zone 5b — the collapse: all of that volume into ten batches.
        step: 6,
        labels: ['Both directions cancel', 'RBI settlement, 10× a day', 'Only the NET moves'],
        frame: ['Both directions cancel'],
        fill: 0.9,
        move: 'cut',
        narration: 'They all settle in ten batches, where every debt cancels against every other.',
      },
      {
        // silent — the settlement vault opening
        step: 6,
        labels: ['RBI settlement, 10× a day', 'Only the NET moves'],
        frame: ['RBI settlement, 10× a day'],
        fill: 0.92,
      },
      {
        // Zone 6 — the so-what, closing the loop planted in shot 3 with the
        // same words: the money itself takes hours.
        step: 6,
        labels: ['Only the NET moves'],
        frame: ['Only the NET moves'],
        fill: 0.95,
        narration: 'So those two seconds were the message. The money itself takes hours.',
      },
      {
        // Zone 7 — button. Same framing as shot 1, so the loop hands straight
        // back into the hook on replay.
        step: 0,
        labels: [],
        frame: ['An address, not a card reader'],
        fill: 0.88,
        move: 'cut',
        narration: 'Nothing moved. Everybody just agreed.',
      },
    ],
  },
};
