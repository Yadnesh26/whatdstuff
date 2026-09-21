export default {
  id: 'blockchain',
  title: 'How a Blockchain Works',
  summary:
    'A blockchain is a filing cabinet where every drawer is welded shut by a number nobody can guess. Thousands of payments are folded into a single 32-byte fingerprint, stamped into an 80-byte header, and then a planet-sized swarm of machines guesses quintillions of times a second until one guess produces a hash starting with nineteen zeros. That guess seals the block — and cuts the key that the next block has to fit.',
  accent: '#f0a63a',
  // one-line teardown for the library card
  spec: '80-byte header · merkle root · 19 leading zeros · 540 sextillion guesses a block',
  // part names, so search finds this machine by what is inside it
  keywords:
    'bitcoin block header hash sha-256 merkle root nonce proof of work mining difficulty target ledger distributed immutable fork longest chain coinbase mempool',
  categories: ['communications', 'electronics'],
};
