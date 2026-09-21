// Regression test for the QR encoder in src/explainers/qr-code/qr.js.
// The explainer claims the plaque it renders is a real, scannable code, so that
// claim needs a proof that runs: `node scripts/qr-selftest.mjs`.
// 1. Reed-Solomon against the published HELLO WORLD 1-M vector.
// 2. BCH format bits against the published format-string table.
// 3. A real decoder that reads the finished matrix back to the payload.
import {
  encode,
  rsEncode,
  formatBits,
  formatPositions,
  dataOrder,
  MASKS,
  ROLE,
  SIZE,
  PAYLOAD,
} from '../src/explainers/qr-code/qr.js';

let fails = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) fails++;
};

// --- 1. Reed-Solomon golden vector (thonky.com/qr-code-tutorial/error-correction-coding)
const helloData = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
const helloEC = [196, 35, 39, 119, 235, 215, 231, 226, 93, 23];
const gotEC = rsEncode(helloData, 10);
check('rs: HELLO WORLD 1-M', String(gotEC) === String(helloEC), String(gotEC));

// --- 2. format strings (thonky.com/qr-code-tutorial/format-version-tables)
const TABLE = {
  L: ['111011111000100','111001011110011','111110110101010','111100010011101','110011000101111','110001100011000','110110001000001','110100101110110'],
  M: ['101010000010010','101000100100101','101111001111100','101101101001011','100010111111001','100000011001110','100111110010111','100101010100000'],
  Q: ['011010101011111','011000001101000','011111100110001','011101000000110','010010010110100','010000110000011','010111011011010','010101111101101'],
  H: ['001011010001001','001001110111110','001110011100111','001100111010000','000011101100010','000001001010101','000110100001100','000100000111011'],
};
let fmtOk = true;
for (const [ecl, row] of Object.entries(TABLE)) {
  row.forEach((want, mask) => {
    const got = formatBits(ecl, mask).toString(2).padStart(15, '0');
    if (got !== want) {
      fmtOk = false;
      console.log(`   ${ecl}/${mask}: got ${got} want ${want}`);
    }
  });
}
check('format: all 32 BCH strings', fmtOk);

// --- 3. encode, then decode the finished matrix back ------------------------
const qr = encode();
check('size', qr.size === 25, `${qr.size}x${qr.size}`);
check('codewords', qr.allWords.length === 44 && qr.dataWords.length === 16, `${qr.dataWords.length} data + ${qr.ecWords.length} ec`);
check('data modules', qr.order.length === 359, `${qr.order.length}`);

// decoder: read the format strip, un-mask, walk the snake, parse byte mode
function decode(matrix) {
  const fpos = formatPositions();
  let fmt = 0;
  fpos.slice(0, 15).forEach(([r, c], i) => {
    fmt |= matrix[r * SIZE + c] << (14 - i);
  });
  // the second copy must agree with the first
  let fmt2 = 0;
  fpos.slice(15).forEach(([r, c], i) => {
    fmt2 |= matrix[r * SIZE + c] << (14 - i);
  });
  if (fmt !== fmt2) throw new Error('format copies disagree');

  let ecl = null;
  let mask = null;
  for (const e of ['L', 'M', 'Q', 'H']) {
    for (let mi = 0; mi < 8; mi++) {
      if (formatBits(e, mi) === fmt) {
        ecl = e;
        mask = mi;
      }
    }
  }
  if (ecl === null) throw new Error('format bits match no (level, mask) pair');

  // rebuild the function-pattern skeleton so the snake finds the same cells
  const skeleton = { m: Int8Array.from(qr.unmasked) };
  for (let i = 0; i < skeleton.m.length; i++) {
    skeleton.m[i] = qr.role[i] >= ROLE.DATA ? -1 : 0;
  }
  const order = dataOrder(skeleton);

  const bits = order.map((idx) => {
    const r = Math.floor(idx / SIZE);
    const c = idx % SIZE;
    return matrix[idx] ^ (MASKS[mask](r, c) ? 1 : 0);
  });

  const words = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
    words.push(v);
  }

  const mode = bits.slice(0, 4).join('');
  let count = 0;
  for (let i = 4; i < 12; i++) count = (count << 1) | bits[i];
  let text = '';
  for (let n = 0; n < count; n++) {
    let ch = 0;
    for (let i = 0; i < 8; i++) ch = (ch << 1) | bits[12 + n * 8 + i];
    text += String.fromCharCode(ch);
  }
  return { ecl, mask, mode, count, text, words };
}

const back = decode(qr.matrix);
check('decode: level', back.ecl === 'H', back.ecl);
check('decode: mask', back.mask === qr.mask, `${back.mask}`);
check('decode: mode indicator', back.mode === '0100', back.mode);
check('decode: char count', back.count === PAYLOAD.length, `${back.count}`);
check('decode: payload', back.text === PAYLOAD, JSON.stringify(back.text));
check('decode: codewords', String(back.words.slice(0, 44)) === String(qr.allWords));

console.log('\nchosen mask', qr.mask, 'penalties', qr.penalties.join(', '));
console.log('winner score breakdown', JSON.stringify(qr.candidates[qr.mask].score));
console.log('format bits', qr.format.toString(2).padStart(15, '0'));
console.log('data codewords', qr.dataWords.join(', '));
console.log('ec codewords  ', qr.ecWords.join(', '));
let dark = 0;
for (const v of qr.matrix) dark += v;
console.log('dark modules', dark, 'of', qr.matrix.length, `(${((dark * 100) / qr.matrix.length).toFixed(1)}%)`);

console.log();
for (let r = 0; r < SIZE; r++) {
  let line = '';
  for (let c = 0; c < SIZE; c++) line += qr.matrix[r * SIZE + c] ? '##' : '  ';
  console.log('    ' + line + '    ');
}
console.log(`\n${fails === 0 ? 'QR SELF-TEST PASS' : `QR SELF-TEST FAIL (${fails})`}`);
process.exit(fails === 0 ? 0 : 1);
