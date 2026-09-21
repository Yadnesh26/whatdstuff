// A real, complete QR encoder — not a picture of one.
//
// Everything the 3D scene draws is generated here at build time, so the plaque
// on screen is a genuinely scannable Version 2 code. Written against the
// ISO/IEC 18004 structure as laid out in Thonky's QR tutorial:
//   - GF(256) Reed-Solomon over the primitive polynomial x^8+x^4+x^3+x^2+1 (285)
//   - 15-bit BCH(15,5) format information, XOR-masked with 101010000010010
//   - the 2-module-wide snaking data placement, skipping the vertical timing column
//   - all 8 mask patterns scored by the four penalty rules; lowest total wins
//
// SUBJECT: "whatdstuff.com" is 14 bytes, which is EXACTLY the byte-mode capacity
// of a version 2 code at error-correction level H — so the smallest code that
// holds it at the strongest correction level is the 25x25 we render.
//
// Validated by `node scripts/qr-selftest.mjs` against two published vectors (the
// HELLO WORLD 1-M error-correction codewords and the full format-string table),
// plus a decoder that reads the finished matrix back to "whatdstuff.com". Run it
// after any change in here — a silent encoder bug still renders a plausible
// pattern, it just stops being a QR code.

export const PAYLOAD = 'whatdstuff.com';
export const VERSION = 2;
export const SIZE = 4 * VERSION + 17; // 25
export const ECL = 'H';
export const QUIET = 4;

// data + ec codeword split for version 2, level H (a single block)
export const DATA_CODEWORDS = 16;
export const EC_CODEWORDS = 28;
export const REMAINDER_BITS = 7; // versions 2-6 carry 7 unused trailing bits

export const ROLE = {
  FINDER: 1,
  SEPARATOR: 2,
  TIMING: 3,
  ALIGN: 4,
  FORMAT: 5,
  DARK: 6,
  DATA: 7,
  EC: 8,
  PAD: 9, // the remainder bits
};

// --- GF(256) ----------------------------------------------------------------
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}
const gmul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

// g(x) = product of (x - alpha^i) for i in 0..n-1, highest degree first
export function generatorPoly(n) {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      next[j] ^= g[j];
      next[j + 1] ^= gmul(g[j], EXP[i]);
    }
    g = next;
  }
  return g;
}

// polynomial long division remainder — the error-correction codewords
export function rsEncode(data, n) {
  const g = generatorPoly(n);
  const res = new Array(n).fill(0);
  for (const b of data) {
    const factor = b ^ res[0];
    res.shift();
    res.push(0);
    for (let i = 0; i < n; i++) res[i] ^= gmul(g[i + 1], factor);
  }
  return res;
}

// --- format information: BCH(15,5) ------------------------------------------
const ECL_BITS = { L: 1, M: 0, Q: 3, H: 2 };

export function formatBits(ecl, mask) {
  const data = (ECL_BITS[ecl] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return (((data << 10) | rem) ^ 0x5412) & 0x7fff;
}

// --- mask patterns ----------------------------------------------------------
export const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r, c) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

// --- bit stream -------------------------------------------------------------
function byteModeBits(text) {
  const bytes = [];
  for (let i = 0; i < text.length; i++) bytes.push(text.charCodeAt(i) & 0xff);
  const bits = [];
  const push = (value, count) => {
    for (let i = count - 1; i >= 0; i--) bits.push((value >> i) & 1);
  };
  push(0b0100, 4); // byte mode indicator
  push(bytes.length, 8); // character count — 8 bits for versions 1-9
  for (const b of bytes) push(b, 8);
  return bits;
}

function toCodewords(bits, capacityBytes) {
  const capacity = capacityBytes * 8;
  const out = bits.slice(0, capacity);
  for (let i = 0; i < 4 && out.length < capacity; i++) out.push(0); // terminator
  while (out.length % 8 !== 0) out.push(0); // pad to a byte boundary
  const words = [];
  for (let i = 0; i < out.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | out[i + j];
    words.push(v);
  }
  const pads = [0xec, 0x11]; // then alternating 11101100 / 00010001
  let p = 0;
  while (words.length < capacityBytes) words.push(pads[p++ % 2]);
  return words;
}

// --- matrix -----------------------------------------------------------------
function blank() {
  return { m: new Int8Array(SIZE * SIZE).fill(-1), role: new Uint8Array(SIZE * SIZE) };
}

export function alignmentCenters() {
  // version 2: candidate centres are 6 and 18; the three that would collide
  // with a finder pattern are dropped, leaving (18, 18)
  const coords = [6, 18];
  const out = [];
  for (const r of coords) {
    for (const c of coords) {
      const nearFinder =
        (r === 6 && c === 6) || (r === 6 && c === SIZE - 7) || (r === SIZE - 7 && c === 6);
      if (!nearFinder) out.push([r, c]);
    }
  }
  return out;
}

// The 15 format bits, most significant first, written twice. Index i in the
// returned list receives bit (14 - i) of the format value.
export function formatPositions() {
  const a = [];
  for (let i = 0; i <= 5; i++) a.push([8, i]);
  a.push([8, 7], [8, 8], [7, 8]);
  for (let i = 5; i >= 0; i--) a.push([i, 8]);
  const b = [];
  for (let i = 0; i <= 6; i++) b.push([SIZE - 1 - i, 8]);
  for (let i = 7; i >= 0; i--) b.push([8, SIZE - 1 - i]);
  return a.concat(b);
}

function placeFunctionPatterns(g) {
  const { m, role } = g;
  const at = (r, c) => r * SIZE + c;

  // three 7x7 finders plus their 1-module separators
  for (const [r0, c0] of [
    [0, 0],
    [0, SIZE - 7],
    [SIZE - 7, 0],
  ]) {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = r0 + dr;
        const c = c0 + dc;
        if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) continue;
        const inside = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        if (inside) {
          const ring = Math.max(Math.abs(dr - 3), Math.abs(dc - 3));
          m[at(r, c)] = ring === 3 || ring <= 1 ? 1 : 0;
          role[at(r, c)] = ROLE.FINDER;
        } else {
          m[at(r, c)] = 0;
          role[at(r, c)] = ROLE.SEPARATOR;
        }
      }
    }
  }

  // timing patterns: row 6 and column 6, alternating, dark on even indices
  for (let i = 8; i < SIZE - 8; i++) {
    const v = i % 2 === 0 ? 1 : 0;
    m[at(6, i)] = v;
    role[at(6, i)] = ROLE.TIMING;
    m[at(i, 6)] = v;
    role[at(i, 6)] = ROLE.TIMING;
  }

  for (const [cr, cc] of alignmentCenters()) {
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const ring = Math.max(Math.abs(dr), Math.abs(dc));
        m[at(cr + dr, cc + dc)] = ring === 1 ? 0 : 1;
        role[at(cr + dr, cc + dc)] = ROLE.ALIGN;
      }
    }
  }

  // the always-dark module
  m[at(4 * VERSION + 9, 8)] = 1;
  role[at(4 * VERSION + 9, 8)] = ROLE.DARK;

  // reserve the two format-information strips
  for (const [r, c] of formatPositions()) {
    m[at(r, c)] = 0;
    role[at(r, c)] = ROLE.FORMAT;
  }
}

// The snaking order every data bit is written in: 2-module-wide columns
// climbing from the bottom-right, alternating direction, never crossing the
// vertical timing column.
export function dataOrder(g) {
  const order = [];
  let upward = true;
  for (let right = SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // step left past the timing column
    for (let vert = 0; vert < SIZE; vert++) {
      for (let j = 0; j < 2; j++) {
        const col = right - j;
        const row = upward ? SIZE - 1 - vert : vert;
        const idx = row * SIZE + col;
        if (g.m[idx] === -1) order.push(idx);
      }
    }
    upward = !upward;
  }
  return order;
}

// --- penalty scoring --------------------------------------------------------
const RUN_A = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
const RUN_B = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];

export function penalty(m) {
  const at = (r, c) => m[r * SIZE + c];
  let n1 = 0;
  let n2 = 0;
  let n3 = 0;

  for (let i = 0; i < SIZE; i++) {
    for (const line of [(k) => at(i, k), (k) => at(k, i)]) {
      let run = 1;
      for (let k = 1; k < SIZE; k++) {
        if (line(k) === line(k - 1)) {
          run++;
        } else {
          if (run >= 5) n1 += 3 + (run - 5);
          run = 1;
        }
      }
      if (run >= 5) n1 += 3 + (run - 5);

      for (let k = 0; k <= SIZE - 11; k++) {
        let a = true;
        let b = true;
        for (let t = 0; t < 11; t++) {
          if (line(k + t) !== RUN_A[t]) a = false;
          if (line(k + t) !== RUN_B[t]) b = false;
        }
        if (a) n3 += 40;
        if (b) n3 += 40;
      }
    }
  }

  for (let r = 0; r < SIZE - 1; r++) {
    for (let c = 0; c < SIZE - 1; c++) {
      const v = at(r, c);
      if (v === at(r, c + 1) && v === at(r + 1, c) && v === at(r + 1, c + 1)) n2 += 3;
    }
  }

  let dark = 0;
  for (let i = 0; i < m.length; i++) dark += m[i];
  const pct = (dark * 100) / m.length;
  const n4 = Math.floor(Math.abs(pct - 50) / 5) * 10;

  return { n1, n2, n3, n4, total: n1 + n2 + n3 + n4 };
}

// --- the whole thing --------------------------------------------------------
export function encode(text = PAYLOAD) {
  const g = blank();
  placeFunctionPatterns(g);

  const dataWords = toCodewords(byteModeBits(text), DATA_CODEWORDS);
  const ecWords = rsEncode(dataWords, EC_CODEWORDS);
  const allWords = dataWords.concat(ecWords);

  const bits = [];
  for (const w of allWords) for (let i = 7; i >= 0; i--) bits.push((w >> i) & 1);
  for (let i = 0; i < REMAINDER_BITS; i++) bits.push(0);

  const order = dataOrder(g);
  if (order.length !== bits.length) {
    throw new Error(`qr: ${order.length} data modules but ${bits.length} bits`);
  }
  order.forEach((idx, i) => {
    g.m[idx] = bits[i];
    g.role[idx] =
      i < DATA_CODEWORDS * 8 ? ROLE.DATA : i < allWords.length * 8 ? ROLE.EC : ROLE.PAD;
  });

  // score all eight masks and keep the cheapest
  const fpos = formatPositions();
  const candidates = MASKS.map((fn, mi) => {
    const m = Int8Array.from(g.m);
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const idx = r * SIZE + c;
        if (g.role[idx] >= ROLE.DATA && fn(r, c)) m[idx] ^= 1;
      }
    }
    const fv = formatBits(ECL, mi);
    // fpos holds BOTH copies back to back, so the bit index restarts at 15
    fpos.forEach(([r, c], i) => {
      m[r * SIZE + c] = (fv >> (14 - (i % 15))) & 1;
    });
    return { mask: mi, matrix: m, score: penalty(m) };
  });

  let best = candidates[0];
  for (const cand of candidates) if (cand.score.total < best.score.total) best = cand;

  return {
    size: SIZE,
    version: VERSION,
    ecl: ECL,
    text,
    role: g.role,
    unmasked: g.m, // data placed, format strip still blank
    order,
    bits,
    dataWords,
    ecWords,
    allWords,
    candidates,
    mask: best.mask,
    matrix: best.matrix, // the finished, scannable code
    penalties: candidates.map((c) => c.score.total),
    format: formatBits(ECL, best.mask),
    formatPositions: fpos,
  };
}
