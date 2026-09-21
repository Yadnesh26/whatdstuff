import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildBlockchain } from './model.js';

// Every step loops while active: `phase` sweeps 0->1 once per lap and every
// mechanism in the model is written to land back on an identical pose at the
// wrap. The chain pulse fades in and out inside the lap; the merkle climb, the
// tamper break and the plug demo are out-and-back triangles; the nonce sweep
// ends on the winning value and then blanks before the wrap; the fork branch
// grows and clears again.
function run({ duration, ...pins }) {
  return ({ tl, handles }) => {
    const s = { t: 0 };
    tl.add(s, {
      t: 1,
      duration,
      ease: 'linear',
      onUpdate: () => handles.set({ ...pins, phase: s.t }),
    });
  };
}

// Every onEnter pins ALL of it — anything left unpinned inherits the previous
// step's mid-lap phase and misframes a fixed camera.
const enter = (over, labels) => ({ handles }) => {
  handles.set({
    reveal: 0,
    feed: 0,
    merkleAmt: 0,
    millAmt: 0,
    mineAmt: 0,
    linkAmt: 0,
    tamperAmt: 0,
    forkAmt: 0,
    chainPulse: 0,
    rig: 0,
    phase: 0,
    ...over,
  });
  handles.setLabels(labels ?? false);
};

export default defineExplainer({
  ...meta,

  buildScene({ scene }) {
    return buildBlockchain({ scene });
  },

  stageOptions: { dof: true },

  steps: [
    {
      id: 'chain',
      heading: '1 · A row of sealed boxes',
      body: 'Each of these cases is a block: a few thousand payments, batched together and shut. What holds it shut is a number — the block\'s hash, a 64-character fingerprint of everything inside it. Read the plate on the front and the first nineteen characters are zeros. Nobody chose those zeros; they had to be found by guessing, and finding them is the only way a block gets made. Every block also carries a copy of the hash of the block before it, which is what turns a pile of boxes into a chain.',
      hint: 'Drag to orbit. The light runs the way the chain was built.',
      camera: { position: [-2.2, 3.4, 9.3], target: [-0.5, 1.05, 0.2] },
      focus: ['Its own hash — 19 leading zeros'],
      onEnter: enter({ chainPulse: 1 }, 'chain'),
      timeline: run({ duration: 8000, chainPulse: 1 }),
    },
    {
      id: 'inside',
      heading: '2 · Open one up',
      body: 'Lift the lid off block 964,940 and there are only three things in it. A row of transaction records — the payments this block is responsible for. A tree of hashes growing out of them, which crushes all of those records down to a single 32-byte number. And a header: a strip 80 bytes long that is the only part anyone ever actually hashes.',
      hint: 'Everything above the case is what the miner has to commit to.',
      camera: { position: [0.6, 3.3, 5.6], target: [-0.9, 1.85, 0] },
      dofAperture: 0.00012,
      focus: ['The 80-byte header'],
      onEnter: enter({ reveal: 1 }, 'inside'),
      timeline: run({ duration: 6000, reveal: 1, merkleAmt: 0.35 }),
    },
    {
      id: 'records',
      heading: '3 · Where the payments come from',
      body: 'A payment you make does not go into a block straight away. It goes into the mempool — a waiting room every node keeps of transactions it has heard about but not yet seen confirmed. A miner picks from that pool, usually highest fee first, and packs roughly 4,700 of them into one block; the hard limit is four million weight units, not a count. The first record is different: the miner writes it themselves, and it pays them the block reward — 3.125 bitcoin since the 2024 halving — plus every fee in the block.',
      camera: { position: [0.9, 4.0, 5.2], target: [-1.0, 0.75, 1.1] },
      dofAperture: 0.0001,
      focus: ['Coinbase transaction - pays the miner 3.125 BTC'],
      onEnter: enter({ reveal: 1, feed: 1 }, 'mempool'),
      timeline: run({ duration: 5000, reveal: 1, feed: 1 }),
    },
    {
      id: 'merkle',
      heading: '4 · Four thousand payments, one number',
      body: 'The header has no room for 4,700 transactions, so they get folded. Hash each transaction; hash each neighbouring pair of those hashes together; hash the pairs of pairs — and keep going until one number is left. That is the merkle root, and it is 32 bytes no matter how many payments went in. (If a row has an odd number of nodes, the last one is hashed with a copy of itself.) The useful part: change any single payment down at the bottom and the root at the top comes out completely different.',
      hint: 'One pulse per record, climbing to the root.',
      camera: { position: [0.9, 3.1, 3.6], target: [-0.75, 2.35, 0] },
      dofAperture: 0.00018,
      focus: ['The merkle root — 32 bytes'],
      onEnter: enter({ reveal: 1, merkleAmt: 1 }, 'merkle'),
      timeline: run({ duration: 4200, reveal: 1, merkleAmt: 1 }),
    },
    {
      id: 'header',
      heading: '5 · Eighty bytes, drawn to scale',
      body: 'This strip is the whole header, and each field is drawn as wide as it really is. Version, 4 bytes. The previous block\'s hash, 32. The merkle root, 32. Time, 4. The target, 4. The nonce, 4. Two fingerprints take up 64 of the 80. These 80 bytes are the only thing anyone ever hashes: run them through SHA-256, twice, and out comes a 256-bit number. Feed it the same bytes and you get the same answer every time — but change one bit anywhere, and the answer has nothing to do with the last one.',
      camera: { position: [0.05, 3.42, 4.15], target: [-0.6, 3.12, 0] },
      dofAperture: 0.00025,
      focus: ['Previous block hash - 32 bytes'],
      onEnter: enter({ reveal: 1 }, 'header'),
      timeline: run({ duration: 5000, reveal: 1, merkleAmt: 0.3 }),
    },
    {
      id: 'mine',
      heading: '6 · Guessing until the zeros appear',
      body: 'A block is only valid if its header hash comes out below a target the network sets — in practice, starting with about nineteen zeros. There is no way to work backwards to a header that does that, so miners change the one field they are free to change, the 4-byte nonce, and hash again. And again. The gauge counts leading zeros: nearly every guess gets one or two. Reaching nineteen takes roughly 540 sextillion tries. The whole planet\'s mining hardware, running at about a thousand exahashes a second, chews through that in about nine minutes — slightly faster than the protocol wants, which is exactly why every 2,016 blocks it re-tunes the target to drag the average back to ten.',
      hint: 'Twenty tries a lap. The real ratio is unwatchable.',
      camera: { position: [2.6, 2.7, 9.0], target: [2.2, 1.35, 2.9] },
      dofAperture: 0.00016,
      focus: ['Target: 19 leading zeros'],
      onEnter: enter({ reveal: 1, millAmt: 1, mineAmt: 1, rig: 1 }, 'mine'),
      timeline: run({ duration: 6000, reveal: 1, millAmt: 1, mineAmt: 1, rig: 1 }),
    },
    {
      id: 'link',
      heading: '7 · The hash becomes the key',
      body: 'The winning hash seals the block, and then it does a second job. The next block copies it into its own header as the "previous block hash" — so the two faces here are cut from the same number, and they only close if the number still matches. That is the whole chain: not glue, but a fingerprint recorded twice. Every block on the network is checked against the one before it, all the way back to the first block in 2009.',
      hint: 'Pull the coupling and the fingerprint is still the same.',
      camera: { position: [1.7, 1.6, 2.6], target: [0.75, 0.85, 0.1] },
      dofAperture: 0.00022,
      focus: ['Teeth cut from this block’s own hash'],
      onEnter: enter({ linkAmt: 1 }, 'link'),
      timeline: run({ duration: 4000, linkAmt: 1 }),
    },
    {
      id: 'tamper',
      heading: '8 · Try to change one payment',
      body: 'Edit a single record in a block that is already buried. Its leaf hash changes, so the merkle root changes, so the header changes, so the block\'s own hash changes — and the copy sitting in the next block\'s header is now wrong. The teeth do not meet. To repair it you would have to re-mine this block and every block stacked on top of it, faster than the entire network is adding new ones. That is what "immutable" actually means: not impossible, just far more expensive than it could ever be worth.',
      hint: 'One card moves. Everything downstream goes red.',
      camera: { position: [1.6, 3.1, 7.6], target: [1.3, 1.25, 0.1] },
      dofAperture: 0.00006,
      focus: ['The link no longer fits'],
      onEnter: enter({ reveal: 1, tamperAmt: 1 }, 'tamper'),
      timeline: run({ duration: 5200, reveal: 1, tamperAmt: 1 }),
    },
    {
      id: 'run',
      heading: '9 · The chain keeps growing',
      body: 'Nobody is in charge of the end of the chain. Every ten minutes or so, somewhere, a machine stumbles onto a header that hashes below the target and shouts about it — and occasionally two of them do it at the same moment, so the chain briefly grows two tips. Nodes do not vote. They simply keep building on whichever branch has the most work behind it, and within a block or two the other tip is abandoned, its transactions dropped back into the mempool to be included in a later block.',
      hint: 'Drag to orbit while the tip keeps building.',
      camera: { position: [3.0, 5.0, 12.0], target: [3.6, 1.6, 0] },
      freeOrbit: true,
      onEnter: enter({ chainPulse: 0.6, forkAmt: 1 }, 'fork'),
      timeline: run({ duration: 6500, chainPulse: 0.6, forkAmt: 1 }),
    },
  ],
});
