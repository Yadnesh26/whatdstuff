// Phase 0 artifact — written BEFORE the model (add-explainer skill, Phase 0).
// Pure data, no imports, never bundled: the registry globs only meta.js and
// index.js. This is the record of what the explainer is FOR, and the contract
// the model must satisfy.
//
// SCOPE NOTE: `internet-request` already tells the packet's physical journey
// (radio, fibre, routers, data centre) and `qr-code` already explains what the
// black squares encode. This explainer deliberately retells neither. It stands
// at the moment of payment and answers the one question those never touch:
// when the shop's phone says "received", what actually arrived?
export default {
  angle:
    'A UPI payment moves no money. Nothing leaves your bank and nothing enters ' +
    'the shop\'s — two banks simply edit their own private ledgers, one down and ' +
    'one up, because a machine in the middle told them to at the same instant. ' +
    'The actual cash between those banks moves hours later, in bulk, and only ' +
    'the netted difference ever moves at all. What travelled in those two ' +
    'seconds was a message, sealed with a PIN your payment app is not allowed ' +
    'to read.',

  stat: 'Roughly 791 million UPI payments a day — 24.5 billion in August 2026 — and every one of them is settled in just 10 netting batches.',

  button: 'Nothing moved. Everybody agreed.',

  who: 'Anyone who has scanned a shopfront QR a thousand times and assumed their rupees flew down a wire.',

  beats: [
    {
      idea: 'A payment is two seconds of ordinary life: a phone, a printed QR standee, a chime from behind the counter.',
      visuals: [
        'the sealed everyday scene — a phone on the counter, the shop\'s QR standee, the merchant\'s phone',
        'the amount landing and the shop\'s phone chiming, with nothing else visible',
      ],
    },
    {
      idea: 'Under that counter is a hub and its spokes: no bank is wired to any other bank, every one has a single line to one machine in the middle. That is the whole reason any app can pay any bank.',
      visuals: [
        'the counter scene lifting to expose the network layer beneath it',
        'the NPCI switch at the centre with bank vaults on radial spokes, and visibly NO wire running bank-to-bank',
      ],
    },
    {
      idea: 'You address a person, not an account. The handle after the @ tells the switch which bank keeps that mapping, and the answer that comes back is a name — never the shop\'s account number.',
      visuals: [
        'the typed address shop@okaxis leaving the phone',
        'a lookup packet routed by the switch to one specific bank and a name pill returning to the phone',
      ],
    },
    {
      idea: 'The PIN keypad that appears is not your app\'s. The PIN is sealed on your own phone and can only be opened inside tamper-proof hardware at your bank — the app you tapped never sees it.',
      visuals: [
        'a sealed capsule forming at the phone\'s keypad',
        'the capsule passing through the app and the switch still sealed, and cracking open only inside the bank\'s locked module',
      ],
    },
    {
      idea: 'Debit first, credit second, never both at once. The switch asks your bank to subtract; only if that succeeds does it ask the shop\'s bank to add.',
      visuals: [
        'a debit request reaching the payer bank and its ledger digits counting down',
        'only then a credit request crossing to the payee bank and its ledger counting up',
      ],
    },
    {
      idea: 'And that is the trick: the rupees that left one ledger are not the rupees that arrived in the other. Neither bank sent anything. The hub just wrote down who now owes whom.',
      visuals: [
        'both ledgers changed while the direct span between the two banks stays conspicuously empty',
        'an IOU tally stacking up at the hub as more payments run',
      ],
    },
    {
      idea: 'Ten times a day the hub nets every debt in both directions down to one number per bank, and the central bank moves only that.',
      visuals: [
        'the tall stack of opposing tallies collapsing into one short net bar per bank',
        'the settlement vault opening and a single heavy ingot moving, once, for millions of payments',
      ],
    },
    {
      idea: 'All of it, 791 million times a day, over the same one machine in the middle.',
      visuals: ['the whole network running end to end, sealed counter scene included, free to orbit'],
    },
  ],
};
