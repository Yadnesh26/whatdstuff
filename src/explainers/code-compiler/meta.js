export default {
  id: 'code-compiler',
  title: 'How a Code Compiler Works',
  summary:
    'Your processor can’t read a single word of code. A compiler chops your text into tokens, builds a grammar tree, checks it, does your math ahead of time, and hands the chip a handful of bytes.',
  accent: '#ffcb6b',
  // one-line teardown for the library card
  spec: 'lex · parse · check · IR · optimize · codegen · 4 lines in, 4 bytes out',
  // part names, so search finds this machine by what is inside it
  keywords:
    'compiler compile build gcc clang llvm lexer tokenizer tokens parser syntax tree ast semantic analysis type checking compile error intermediate representation ir optimizer constant folding dead code elimination code generation register allocation x86 assembly machine code bytes binary',
  categories: ['electronics'],
};
