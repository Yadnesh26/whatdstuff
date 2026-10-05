export default {
  angle:
    'The RISC-versus-CISC war ended in a draw nobody sees: since 1995 every fast x86 chip breaks its complex instructions into small, fixed-size RISC-style micro-ops before running them. The real difference left is the front door, the decoder.',
  stat: 'An x86 instruction can be anywhere from 1 to 15 bytes long. Every ARM64 instruction is exactly 4.',
  button: 'Complex outside. Simple inside.',
  who: 'Anyone who has heard "ARM is RISC, Intel is CISC" quoted as the reason a MacBook runs cool, and never seen what the words mean.',
  beats: [
    {
      idea: 'A laptop chip and a phone chip both run programs, but each understands a different instruction set: the vocabulary its hardware can read.',
      visuals: ['two sealed processor packages side by side on a plinth, marked x86-64 and ARM64'],
    },
    {
      idea: 'An instruction is a row of bytes in memory. CISC instructions vary from 1 to 15 bytes; RISC instructions are all one fixed size.',
      visuals: [
        'two ribbons of byte cells streaming past, one per chip',
        'x86 tiles of 1, 2, 3 and 6 bytes, with real encodings',
        'ARM tiles that are all exactly 4 bytes',
      ],
    },
    {
      idea: 'Same job, two scripts: adding a register into memory is ONE x86 instruction but THREE ARM instructions (load, add, store).',
      visuals: [
        'two identical datapaths: memory bank, register file, ALU',
        'a data token making the same memory → ALU → memory trip in both',
        'one CISC tile lit for the whole trip vs three RISC tiles lighting one per leg',
      ],
    },
    {
      idea: 'RISC is load/store: only loads and stores touch memory, arithmetic works on registers only, so RISC chips carry more registers (31 vs 16).',
      visuals: ['register files of 16 and 31 slots, side by side', 'memory bank touched only by the load and store legs'],
    },
    {
      idea: 'Fixed size makes decoding easy: the chip can slice the next 8 instructions every 4 bytes at once. With x86 it must find where each instruction ends before it knows where the next one starts.',
      visuals: [
        'eight decoder blades cutting the ARM ribbon at 4-byte marks simultaneously',
        'a length-scanner walking the x86 ribbon, marking one boundary at a time',
      ],
    },
    {
      idea: 'The twist: x86 decoders crack each complex instruction into simple micro-ops, the same load / add / store the ARM program spelled out.',
      visuals: [
        'the 6-byte ADD [x], EAX tile entering the decoder',
        'three uniform micro-op tiles coming out, the same shape as the RISC tiles beside them',
      ],
    },
    {
      idea: 'Both chips run a RISC-like core inside. x86 carries a bigger translator because decades of software depend on its vocabulary; ARM needs far less translating.',
      visuals: ['the two chips with their lids lifted off', 'each die: a decoder strip (wide on x86, slim on ARM) in front of a RISC-style core'],
    },
  ],
};
