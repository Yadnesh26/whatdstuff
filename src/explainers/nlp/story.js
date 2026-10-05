export default {
  angle:
    'A language model never reads a word. It chops text into numbered pieces, turns each number into a position in space, and "understanding" is just which positions sit close together and which ones pull on each other.',
  stat: 'GPT-2 small: 50,257 pieces, 768 numbers each. 38.6 million numbers before it has read a single word.',
  button: 'Predict one piece. Append. Repeat.',
  who: 'Anyone who uses a chatbot or autocomplete every day and pictures a tiny reader inside that understands the sentence.',
  beats: [
    {
      idea: 'NLP is a machine with text going in and one next word coming out; nothing inside reads.',
      visuals: [
        'a sealed console on a plinth with a sentence strip feeding in on the left',
        'an output lamp on the right that lights one predicted word',
      ],
    },
    {
      idea: 'First the text is cut into pieces from a fixed menu, and each piece is swapped for a whole number.',
      visuals: [
        'sentence slugs passing a cutter and splitting into sub-word chunks',
        'an integer ID stamped onto each chunk',
      ],
    },
    {
      idea: 'Each ID pulls one row out of a giant lookup table, and that row is the token as a list of numbers.',
      visuals: [
        'a lookup drum with thousands of rows, one row sliding out per token',
        'a tall column of glowing cells under each token, one cell per number',
      ],
    },
    {
      idea: 'Those numbers are coordinates: similar words land near each other, and directions carry meaning.',
      visuals: [
        'a 3D point cloud with clustered word points',
        'the king, man, woman, queen offset drawn as parallel arrows',
      ],
    },
    {
      idea: 'Attention lets each token query the others, and "it" pulls most strongly on "fish".',
      visuals: [
        'tokens in a row with beams whose thickness is the attention weight',
        'weight bars for "it" that sum to one, the tallest on "fish"',
        'the vector for "it" drifting toward the vector for "fish"',
      ],
    },
    {
      idea: 'The same attention-and-refine block is stacked again and again, each pass reshaping every vector.',
      visuals: ['twelve stacked layer slabs', 'one token column passing up through all twelve and changing colour'],
    },
    {
      idea: 'The last vector is scored against every piece in the vocabulary, one is sampled, and it is appended to the input.',
      visuals: [
        'a bar chart of candidate next pieces with one dominant bar',
        'the chosen piece dropping onto the end of the sentence strip',
      ],
    },
  ],
};
