import meta from './meta.js';
import { buildCompiler } from './model.js';
import { defineExplainer } from '../../framework/index.js';
import { win } from '../../framework/motion.js';

// Zoom-in / reveal: the sealed console (page in, bytes out), then one station
// per step along the bench — lex, parse, check, IR, optimize, codegen,
// assemble — and the sealed console again running fast. Every step drives
// the model through handles.pose(), which resets ALL state to defaults before
// applying the step's own values, so nothing leaks between steps.
//
// Seamless wrap: each lap's last ~12% shrinks the step's new work away
// (first half) and regrows the step's STARTING state (second half), so the
// pose at u=1 equals the pose at u=0 exactly. Key moments are timed onto
// u=0.30 / 0.60 — the instants review-shots and the label gate sample.

const loop = (duration, fn) => ({ tl, handles }) => {
  const s = { t: 0 };
  tl.add(s, {
    t: 1,
    duration,
    ease: 'linear',
    onUpdate: () => handles.pose(fn(Math.min(s.t, 0.99999))),
  });
};

const wrap = (u) => win(u, 0.86, 0.98);

const sealed = (u, laps) => ({ reveal: 0, sweep: ((u * laps) % 1) * 1.5 - 0.2 });

const lexer = (u) => {
  const o = wrap(u);
  return o < 0.5 ? { reveal: 1, lex: u, tokScale: 1 - 2 * o } : { reveal: 1, lex: 0 };
};

const parser = (u) => {
  const o = wrap(u);
  return o < 0.5
    ? { reveal: 1, lex: 1, parse: u, treeScale: 1 - 2 * o }
    : { reveal: 1, lex: 1, parse: 0, tokScale: 2 * o - 1 };
};

const built = { reveal: 1, lex: 1, parse: 1 };

const checker = (u) => {
  const o = wrap(u);
  return o < 0.5 ? { ...built, check: u, checkScale: 1 - 2 * o } : { ...built, check: 0 };
};

const lower = (u) => {
  const o = wrap(u);
  return o < 0.5 ? { ...built, ir: u, rackScale: 1 - 2 * o } : { ...built, ir: 0 };
};

const optimize = (u) => {
  const o = wrap(u);
  return o < 0.5
    ? { ...built, ir: 1, opt: u, rackScale: 1 - 2 * o }
    : { ...built, ir: 1, opt: 0, rackScale: 2 * o - 1 };
};

const codegen = (u) => {
  const o = wrap(u);
  return o < 0.5
    ? { ...built, ir: 1, opt: 1, cg: u, cgScale: 1 - 2 * o }
    : { ...built, ir: 1, opt: 1, cg: 0, rackScale: 2 * o - 1 };
};

const assemble = (u) => {
  const o = wrap(u);
  return o < 0.5
    ? { ...built, ir: 1, opt: 1, cg: 1, bytes: u, bytesScale: 1 - 2 * o }
    : { ...built, ir: 1, opt: 1, cg: 1, bytes: 0 };
};

export default defineExplainer({
  ...meta,
  stageOptions: { dof: true },

  buildScene({ scene }) {
    return buildCompiler({ scene });
  },

  steps: [
    {
      id: 'console',
      heading: '1 · Words in, numbers out',
      body: 'Every app you use started as text someone typed. Your processor can’t read a word of it. It only runs numbers. This box is a compiler. A page of code goes in the top, and four bytes come out the front: 8D 47 06 C3. Here’s how it gets from one to the other.',
      hint: 'Drag to orbit · scroll to open it up.',
      camera: { position: [6.31, 5.84, 19.49], target: [-4.78, 1.1, 3.23] },
      focus: ['Machine code comes out'],
      dofAperture: 0.00002,
      onEnter: ({ handles }) => {
        handles.pose(sealed(0, 2));
        handles.setLabels('exterior');
      },
      timeline: loop(7000, (u) => sealed(u, 2)),
    },
    {
      id: 'lex',
      heading: '2 · Chop the text into tokens',
      body: 'To the compiler, your code arrives as a row of characters, no different from a shopping list. The lexer reads them in order and groups them into tokens: keywords, names, numbers and symbols. Spaces mean nothing to it, and the comment “// combo” is thrown away. The colours in your code editor come from this same step.',
      hint: 'Colours follow a common editor theme: violet keywords, blue names, orange numbers.',
      camera: { position: [-3.36, 1.85, 4.14], target: [-3.92, 1.11, -0.22] },
      focus: ['Comment: thrown away', 'Keyword', 'Name', 'Number'],
      dofAperture: 0.00008,
      onEnter: ({ handles }) => {
        handles.pose(lexer(0));
        handles.setLabels('lex');
      },
      timeline: loop(7000, lexer),
    },
    {
      id: 'parse',
      heading: '3 · Build the grammar tree',
      body: 'Next, the parser fits the tokens into a tree, the way you might diagram a sentence. “points + bonus * 2” becomes a + with points on one side and a * on the other. Multiply binds tighter than add, so the * sits lower in the tree and gets worked out first. Brackets and semicolons only mark where things start and stop. Once the tree is built, they’re gone.',
      camera: { position: [-0.9, 2.31, 7.77], target: [-2.38, 0.99, -0.3] },
      focus: ['* sits deeper: done first'],
      dofAperture: 0.00004,
      onEnter: ({ handles }) => {
        handles.pose(parser(0));
        handles.setLabels('parse');
      },
      timeline: loop(7000, parser),
    },
    {
      id: 'check',
      heading: '4 · Check that it makes sense',
      body: 'Now the compiler checks the meaning. Every name has to lead back to where it was declared: bonus on line 3 traces to line 2, and points to the function’s input. Every operation has to fit its types: an int times an int gives an int. Misspell bonus and the trace finds nothing. That’s a compile error, and the build stops right here.',
      camera: { position: [-0.47, 1.77, 5.71], target: [-1.26, 1.05, -0.17] },
      focus: ['bonus → declared on line 2'],
      dofAperture: 0.00007,
      onEnter: ({ handles }) => {
        handles.pose(checker(0));
        handles.setLabels('check');
      },
      timeline: loop(6500, checker),
    },
    {
      id: 'ir',
      heading: '5 · Flatten it into tiny steps',
      body: 'The tree is then flattened into a list of tiny steps called the intermediate representation, or IR. Each line does exactly one thing, and every in-between result gets a name of its own, t1 to t4. The list is built from the bottom of the tree up, so the multiply lands before the add. Every later stage works on this list.',
      hint: 'Simplified from the real LLVM IR that clang produces for this function.',
      camera: { position: [0.51, 2.3, 7.96], target: [-0.7, 1.03, -0.2] },
      focus: ['IR: one operation per line'],
      dofAperture: 0.00005,
      onEnter: ({ handles }) => {
        handles.pose(lower(0));
        handles.setLabels('ir');
      },
      timeline: loop(7000, lower),
    },
    {
      id: 'optimize',
      heading: '6 · Do the math now, delete the rest',
      body: 'Here the compiler rewrites your program. bonus is always 3, so the optimizer swaps in the 3. And 3 × 2 is always 6, so it does that multiply once, right now, instead of every time the program runs. Steps whose results nobody needs anymore are deleted. Six steps become two: add 6 to points, then return.',
      hint: 'Real numbers: unoptimized, clang emits 10 instructions (26 bytes) for this function. Optimized: 2 instructions, 4 bytes.',
      camera: { position: [2.29, 1.61, 4.17], target: [1.69, 1.07, -0.21] },
      focus: ['Folded: 3 × 2 = 6', 'IR: 6 steps'],
      dofAperture: 0.0001,
      onEnter: ({ handles }) => {
        handles.pose(optimize(0));
        handles.setLabels('opt');
      },
      timeline: loop(7000, optimize),
    },
    {
      id: 'codegen',
      heading: '7 · Pick real instructions',
      body: 'Now the compiler writes for one particular chip, here an x86-64. Registers are a few storage slots built into the processor itself. On Linux and macOS, a function’s first number arrives in the register rdi, and the answer has to leave in eax. The compiler picks LEA, an instruction made for address math, because it can add 6 to rdi and drop the result in eax in a single move.',
      hint: 'This is what gcc 14 and clang 19 both emit at -O2.',
      camera: { position: [3.43, 1.59, 3.9], target: [3.06, 1.0, -0.19] },
      focus: ['LEA: add 6 in one move', 'rdi: points arrives here'],
      dofAperture: 0.00008,
      onEnter: ({ handles }) => {
        handles.pose(codegen(0));
        handles.setLabels('cg');
      },
      timeline: loop(7000, codegen),
    },
    {
      id: 'bytes',
      heading: '8 · Encode it as bytes',
      body: 'Last, the assembler turns each instruction into bytes. 8D means LEA. 47 says “into eax, from rdi plus a small number”. 06 is the 6 itself, baked right into the code. C3 means return. That’s 32 bits, each a lamp that is on or off. This is the whole function, and it is all the processor will ever see.',
      camera: { position: [3.7, 1.43, 3.36], target: [3.24, 0.97, -0.19] },
      focus: ['8D: means LEA', '06: the 6, baked in'],
      dofAperture: 0.00012,
      onEnter: ({ handles }) => {
        handles.pose(assemble(0));
        handles.setLabels('bytes');
      },
      timeline: loop(7000, assemble),
    },
    {
      id: 'run',
      heading: '9 · Four lines in. Four bytes out.',
      body: 'Every build runs this pipeline over every function in your project: chop, build the tree, check, flatten, optimize, translate, encode. The compiler did arithmetic you wrote and threw out steps you asked for. The four bytes still do exactly what your four lines said.',
      hint: 'Drag to orbit while it builds.',
      camera: { position: [9.45, 4.19, 15.67], target: [-3.11, 1.01, 3.11] },
      freeOrbit: true,
      focus: [],
      dofAperture: 0.00002,
      onEnter: ({ handles }) => {
        handles.pose(sealed(0, 5));
        handles.setLabels(false);
      },
      timeline: loop(5000, (u) => sealed(u, 5)),
    },
  ],
});
