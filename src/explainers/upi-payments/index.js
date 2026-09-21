import { defineExplainer } from '../../framework/index.js';
import { win } from '../../framework/motion.js';
import meta from './meta.js';
import { buildUpi } from './model.js';

// Every step loops while active: `phase` sweeps 0->1 once per lap, and every
// packet stream's speed multiplier is a whole number, so a dot always returns
// to an identical position at the wrap. The rotor turns a whole 2 turns per
// lap. Anything discrete (the ledger edits, the tally stack, the vault door,
// the PIN capsule) is driven by `pulse`, which is forced back to zero before
// the lap ends — so the wrap pose is identical no matter what happened inside.
const pulse = (u, a, b, fallA = 0.94, fallB = 1.0) =>
  win(u, a, b) * (1 - win(u, fallA, fallB));

// Every scalar the model owns, at rest. Spreading this into each onEnter is
// what guarantees no step ever inherits the previous step's mid-lap state.
const REST = {
  reveal: 0,
  lookup: 0, pay: 0, debit: 0, credit: 0, notify: 0, busy: 0,
  pinAmt: 0, hsm: 0,
  ledgerPayer: 0, ledgerPayee: 0,
  beam: 0, tally: 0, net: 0, vaultOpen: 0, cycle: 0,
  gap: 0, screen: 0, chime: 0, spin: 1,
};
// `set` pins every scalar; `setLabels` pins the callout set. Both, every step.
const pin = (labelSet, over) => ({ handles }) => {
  handles.set({ ...REST, ...over });
  handles.setLabels(labelSet);
};

function run({ duration, extra }) {
  return ({ tl, handles }) => {
    const s = { t: 0 };
    tl.add(s, {
      t: 1,
      duration,
      ease: 'linear',
      onUpdate: () => {
        handles.set({ phase: s.t });
        if (extra) handles.set(extra(s.t));
      },
    });
  };
}

export default defineExplainer({
  ...meta,

  buildScene({ scene }) {
    return buildUpi({ scene });
  },

  stageOptions: { dof: true },

  steps: [
    {
      id: 'counter',
      heading: '1 · Two seconds at a counter',
      body: 'You hold your phone up to a printed square taped to the till, type ₹249, press your PIN, and somewhere behind the counter a phone says the money arrived. That is the entire experience, and India does it about 791 million times a day. Nothing here looks like a bank: no card, no terminal, no wire you can see. Just a sticker with an address on it.',
      hint: 'Drag to orbit. Watch the payment run once, end to end.',
      camera: { position: [1.0, 3.9, 11.4], target: [1.0, 2.4, 6.5] },
      dofAperture: 0.00006,
      focus: ["An address, not a card reader"],
      onEnter: pin('counter', { reveal: 0 }),
      timeline: run({
        duration: 7000,
        extra: (t) => ({
          screen: t < 0.12 ? 0 : t < 0.3 ? 1 : t < 0.48 ? 2 : t < 0.68 ? 3 : t < 0.92 ? 4 : 0,
          chime: pulse(t, 0.7, 0.76, 0.9, 0.96),
        }),
      }),
    },
    {
      id: 'network',
      heading: '2 · One machine in the middle',
      body: 'Lift the counter away and the shape underneath is the whole trick. Your bank has no line to the shop\'s bank. Neither does any other bank. Every one of them — and every payment app, which is not a bank and borrows a sponsor bank\'s line to get here — runs a single cable to one switch operated by NPCI, and to nothing else. That is why an app you downloaded last night can pay into a bank it has never heard of: it doesn\'t have to know the bank at all, only the switch.',
      hint: 'Count the wires. None of them joins two banks.',
      camera: { position: [-2.04, 7.4, 12.2], target: [-2.04, 1.0, 1.0] },
      dofAperture: 0.00002,
      focus: ['The NPCI switch', 'One line each'],
      onEnter: pin('network', { reveal: 1, busy: 1, screen: 2 }),
      timeline: run({ duration: 7000 }),
    },
    {
      id: 'address',
      heading: '3 · You pay a name, not an account',
      body: 'What the QR actually carries is an address like shop@okaxis — a stand-in the shop can print on a sticker without ever publishing its account number. The part after the @ is the routing instruction: it tells the switch which bank keeps the mapping from that address to a real account. The switch asks that one bank, and what comes back is the registered name — SHREE STORES. You get a name to check against the shopfront; the account number behind it never leaves the bank that holds it.',
      hint: 'Mint packets go out to one bank and bring a name home.',
      camera: { position: [-0.4, 5.4, 12.4], target: [-0.4, 2.0, 3.6] },
      dofAperture: 0.00008,
      focus: ['The @ picks the bank'],
      onEnter: pin('address', { reveal: 1, lookup: 1, busy: 0.25, screen: 1 }),
      timeline: run({
        duration: 5200,
        extra: (t) => ({ screen: t < 0.55 ? 1 : t < 0.94 ? 2 : 1 }),
      }),
    },
    {
      id: 'pin',
      heading: '4 · The PIN your app cannot read',
      body: 'Now the keypad appears — and it is not your app\'s keypad. It belongs to a piece of NPCI code called the Common Library, running on your own phone, and it seals what you type before the app around it can look. That sealed block travels through the app, through the sponsor bank, through the switch, and none of them can open it. It opens in exactly one place: tamper-resistant hardware inside your bank, which checks the PIN and destroys the block. This is why handing the keypad to a payment app is safe even though you would never hand it your password.',
      hint: 'Follow the capsule. It only cracks at the far end.',
      camera: { position: [-1.6, 5.2, 12.4], target: [-1.6, 1.9, 3.0] },
      dofAperture: 0.00012,
      focus: ['Opened only in here'],
      onEnter: pin('pin', { reveal: 1, busy: 0.2, screen: 3, pinAmt: 1 }),
      timeline: run({
        duration: 5600,
        extra: (t) => ({
          // the capsule fades in and out inside the lap, so the wrap is clean
          pinAmt: Math.min(1, t * 14) * Math.min(1, (1 - t) * 14),
          hsm: pulse(t, 0.86, 0.95, 0.985, 1.0),
        }),
      }),
    },
    {
      id: 'ledger',
      heading: '5 · Subtract first, then add',
      body: 'With the PIN checked, the switch runs the payment in a strict order, and the order is the safety. First it tells your bank to debit: take ₹249 off this account, and tell me you did it. Only when that confirmation comes back does it tell the shop\'s bank to credit. Never both at once — because if the second half failed after both had fired, the money would exist twice or not at all. Each bank is writing in its own book, about its own customer, and neither can see the other\'s.',
      hint: 'Watch the left number fall before the right one rises.',
      camera: { position: [-2.0, 6.6, 12.0], target: [-2.0, 1.4, 1.4] },
      dofAperture: 0.00004,
      focus: ['ReqPay_Debit — subtract first', 'ReqPay_Credit — second'],
      onEnter: pin('ledger', { reveal: 1, busy: 0.2, screen: 3 }),
      timeline: run({
        duration: 6000,
        extra: (t) => ({
          debit: pulse(t, 0.05, 0.12, 0.44, 0.5),
          credit: pulse(t, 0.52, 0.6, 0.88, 0.94),
          ledgerPayer: pulse(t, 0.34, 0.44),
          ledgerPayee: pulse(t, 0.66, 0.76),
          notify: pulse(t, 0.74, 0.82, 0.92, 0.97),
          chime: pulse(t, 0.8, 0.86, 0.93, 0.97),
          screen: t < 0.3 ? 3 : t < 0.94 ? 4 : 3,
        }),
      }),
    },
    {
      id: 'iou',
      heading: '6 · Nothing actually crossed',
      body: 'Here is what just happened, and what did not. One bank\'s book says ₹249 less. Another bank\'s book says ₹249 more. But the rupees that left the first were never the rupees that arrived at the second — there is no path between those two buildings for anything to travel along. Neither bank sent the other a single paisa. All the switch did was write down that one bank now owes the other, and both banks agreed to believe it. Your "instant transfer" is a promise, recorded.',
      hint: 'The arc between the banks is drawn so you can see it stay empty.',
      camera: { position: [-2.4, 6.0, 14.0], target: [-2.4, 2.2, 2.6] },
      dofAperture: 0.00003,
      focus: ['No wire between them'],
      onEnter: pin('iou', {
        reveal: 1, busy: 1, gap: 1, screen: 4, beam: 1,
        ledgerPayer: 1, ledgerPayee: 1,
      }),
      timeline: run({
        duration: 6000,
        extra: (t) => ({ tally: pulse(t, 0.15, 0.85, 0.93, 1.0) }),
      }),
    },
    {
      id: 'settle',
      heading: '7 · Ten times a day, the real money moves',
      body: 'Those promises pile up in both directions all day, and most of them cancel. While your bank owes the shop\'s bank ₹249, a thousand payments are running the other way. So ten times a day the switch nets everything down — every debt in every direction collapsed into one figure per bank — and only that difference is actually settled, through accounts the banks hold at the Reserve Bank. Billions of rupees of payments, a handful of real transfers. The speed you felt was never the money moving. It was the message.',
      hint: 'The two stacks cancel; one bar is what is left to pay.',
      camera: { position: [-3.4, 6.2, 8.6], target: [-2.6, 2.0, -2.6] },
      dofAperture: 0.00003,
      focus: ['Only the NET moves'],
      onEnter: pin('settle', {
        reveal: 1, busy: 0.6, screen: 4, beam: 1,
        ledgerPayer: 1, ledgerPayee: 1,
      }),
      timeline: run({
        duration: 6400,
        extra: (t) => ({
          tally: pulse(t, 0.02, 0.28, 0.95, 1.0),
          net: pulse(t, 0.32, 0.56, 0.95, 1.0),
          cycle: pulse(t, 0.3, 0.8, 0.95, 1.0),
          vaultOpen: pulse(t, 0.58, 0.78, 0.9, 0.99),
        }),
      }),
    },
    {
      id: 'run',
      heading: '8 · Nothing moved. Everybody agreed.',
      body: 'A sticker that is really an address. A PIN sealed on your own phone and opened nowhere else. One switch that every bank talks to and no bank talks around. Two books edited in a fixed order, a debt written down, and the actual cash following hours later, netted to almost nothing. That is what happens in the two seconds between your thumb and the chime — 24.5 billion times in a single month, over one machine in the middle.',
      hint: 'Drag to orbit while the whole system runs.',
      camera: { position: [-2.6, 7.0, 15.0], target: [-2.6, 1.4, 1.0] },
      dofAperture: 0.00002,
      freeOrbit: true,
      onEnter: pin(false, {
        reveal: 1, busy: 1, beam: 1, pay: 1, debit: 1, credit: 1, notify: 1,
        screen: 4, chime: 0.6, ledgerPayer: 1, ledgerPayee: 1,
      }),
      timeline: run({
        duration: 4600,
        extra: (t) => ({ tally: pulse(t, 0.1, 0.9, 0.94, 1.0) }),
      }),
    },
  ],
});
