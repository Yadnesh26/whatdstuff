export default {
  angle:
    'A logic gate never "decides" anything — it is a tug-of-war between two teams of switches, wired so exactly one team is always closed and the other always open.',
  stat: 'A modern processor holds tens of billions of these switches, and a NAND gate is only four.',
  button: 'Four switches. Multiply by billions.',
  who: 'Anyone who has heard "it is all ones and zeros" and never seen what a one or a zero physically does.',
  beats: [
    {
      idea: 'A gate is a real, tiny physical part: the chip on the board that answers yes/no with voltage.',
      visuals: ['a sealed 14-pin 7400 DIP chip on a plinth', 'a high and low voltage on the pins as glowing rails'],
    },
    {
      idea: 'The atom of logic is a switch that another voltage can close — no hand involved.',
      visuals: ['one transistor as a gate-controlled switch', 'charge flowing only while the gate is high'],
    },
    {
      idea: 'Two switches in series mean AND; two in parallel mean OR.',
      visuals: ['series pair and parallel pair, each with input toggles', 'current path lighting only when the rule is met'],
    },
    {
      idea: 'A gate pairs a pull-down team with a mirror-image pull-up team, so the output is always tied to power or ground, never floating.',
      visuals: ['NAND: two PMOS in parallel on top, two NMOS in series below', 'output node connected to the top or the bottom rail, never both'],
    },
    {
      idea: 'Run all four input combinations and the output traces the NAND truth table.',
      visuals: ['inputs A and B stepping 00, 01, 10, 11', 'output lamp and a truth-table board that highlights the live row'],
    },
    {
      idea: 'NAND alone can build NOT, AND, OR — every computer is made of this one gate.',
      visuals: ['NAND with inputs tied together becoming NOT', 'NAND followed by NAND-as-NOT becoming AND'],
    },
  ],
};
