export default {
  angle:
    'Your processor cannot read a single word of code. A compiler translates every line into raw numbers, and on the way it quietly rewrites your program: it does the math you wrote before the program ever runs, and deletes the steps it proves are pointless.',
  stat: 'Four lines of C in, four bytes out: 8D 47 06 C3. Without the optimizer, the same function is 10 instructions and 26 bytes.',
  button: 'Four lines in. Four bytes out.',
  who: 'Anyone who has pressed "build" or "run", watched it think for a second, and wondered what actually happens to the words they typed.',
  beats: [
    {
      idea: 'A compiler is a machine with your source text going in and a handful of bytes coming out; the CPU only ever sees the bytes.',
      visuals: [
        'a sealed console on a plinth with a printed page of code standing in its intake slot',
        'an output window on the front showing the bytes 8D 47 06 C3',
        'a build light sweeping left to right along the top seam',
      ],
    },
    {
      idea: 'First the lexer reads the page character by character and groups them into tokens: keywords, names, numbers, symbols. Spaces and comments are thrown away. Editor syntax colours come from this same step.',
      visuals: [
        'the page standing upright, plain single-colour text',
        'a scan bar sweeping down the lines',
        'each word lifting off the page as a coloured token block at the exact spot it was written',
        'the "// combo" comment falling away instead of becoming a token',
      ],
    },
    {
      idea: 'The parser arranges the tokens into a tree that captures the grammar: multiply binds tighter than add, so * sits deeper than +. Brackets and semicolons only mark structure and do not survive into the tree.',
      visuals: [
        'tokens flying from the page into a hanging tree of nodes joined by rods',
        'the * node one level below the + node, with bonus and 2 under it',
        'punctuation tokens ( ) { } ; = fading out',
      ],
    },
    {
      idea: 'The checker walks the tree: every name must trace back to a declaration, and every operation must make sense for its types. This is where "compile errors" come from.',
      visuals: [
        'link arcs from the leaf "bonus" back to its declaration, and from "points" back to the parameter',
        'int type tags stamping onto nodes bottom-up',
      ],
    },
    {
      idea: 'The tree is flattened into a list of tiny steps (intermediate representation): one operation per line, temporaries for every result.',
      visuals: ['tree nodes dropping in order into a rack of six instruction plates, read top to bottom'],
    },
    {
      idea: 'The optimizer proves bonus is always 3, works out 3 × 2 = 6 at compile time, and deletes every step that no longer matters. Six steps become two.',
      visuals: [
        'the load of bonus turning into the number 3',
        'mul 3, 2 folding into 6',
        'four plates sliding out of the rack, the two survivors closing ranks: add points, 6 / ret',
        'a counter reading 6 steps → 2',
      ],
    },
    {
      idea: 'The back end picks real x86-64 instructions and registers: points arrives in rdi, the answer leaves in eax, and a single LEA adds the 6 in one move.',
      visuals: [
        'the two IR plates turning into instruction plates: lea eax, [rdi+6] and ret',
        'a bank of 16 register sockets with rdi lit as the input and rax/eax lit as the output',
      ],
    },
    {
      idea: 'The assembler encodes each instruction as bytes. 8D 47 06 C3 is the whole function; this is all the CPU ever sees.',
      visuals: [
        'the instruction plates splitting into four byte tiles 8D 47 06 C3',
        'eight bit lamps under each byte, lit for 1, dark for 0',
        'the bytes sliding out of the console toward the output window',
      ],
    },
  ],
};
