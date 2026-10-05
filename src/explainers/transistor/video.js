// steps: 0 component · 1 silicon die · 2 two junctions · 3 injection
//        4 current gain · 5 switch · 6 amplifier · 7 quietly
export default {
  hook: 'This tiny part is a valve, a whisper controlling a flood.',

  render: {
    formats: ['short'],
    captions: true,
    captionStyle: 'bold-karaoke',
    followOverlay: { short: true },
  },

  short: {
    shots: [
      { step: 0, narration: 'This tiny part is a valve, a whisper of current controlling a flood.' },
      { step: 0, frame: ['Emitter lead', 'Base lead', 'Collector lead'], seconds: 1 },
      { step: 0, frame: ['Black epoxy package (TO-92)'], seconds: 1 },

      { step: 1, narration: 'Crack that valve open and there’s almost nothing inside, just a fleck of silicon smaller than a grain of rice.' },
      { step: 1, frame: ['Gold wire bonds'], seconds: 1 },
      { step: 1, frame: null, seconds: 1 },

      { step: 2, narration: 'So how does a fleck that tiny control a current a hundred times bigger?' },
      { step: 2, frame: ['Base-emitter: forward biased (thin barrier)', 'Base-collector: reverse biased (wide barrier)'], fill: 0.6, seconds: 1.4 },
      { step: 2, narration: 'That fleck is grown into three layers, and it forms two junctions where they meet.' },
      { step: 2, narration: 'One of those junctions sits wide open, and the other stays shut tight.' },
      { step: 2, frame: ['Base-collector: reverse biased (wide barrier)'], fill: 0.6, seconds: 1 },

      { step: 3, narration: 'But push a tiny trickle of current into the thin layer between those junctions, and it floods with charge.' },
      { step: 3, frame: ['Thin base: most carriers cross'], fill: 0.55, seconds: 1.2 },
      { step: 3, narration: 'Most of that charge shoots straight through the junction that’s supposed to be closed.' },
      { step: 3, frame: ['Swept into the collector'], fill: 0.65, seconds: 1 },

      { step: 4, narration: 'So that’s current gain, a trickle in and a flood out, sometimes a hundred times bigger.' },
      { step: 4, frame: ['Ib — the small controlling trickle'], fill: 0.45, seconds: 1 },
      { step: 4, frame: ['Ic — the large controlled current'], fill: 0.45, seconds: 1.2 },

      { step: 5, narration: 'Push that flood all the way and the valve just snaps, fully open or fully shut. That’s a one or a zero.' },
      { step: 5, frame: null, fill: 0.75, seconds: 1.2 },
      { step: 5, narration: 'Billions of these specks flipping open and shut like that, billions of times a second, is literally what a computer is.' },

      { step: 7, frame: null, seconds: 0.8 },
      { step: 7, narration: 'Still, just a whisper, controlling a flood inside every computer it powers.' },
    ],
  },

  long: {
    shots: [
      { step: 0, seconds: 8, narration: 'This is a transistor, arguably the most important invention of the last century. At its heart it’s an electrically-controlled valve: a small signal at one terminal controls a much bigger current through the other two.' },
      { step: 1, seconds: 9, narration: 'Open the case and there’s barely anything there — a tiny sliver of silicon. But that silicon has been carefully doped with impurities into three distinct regions, and the boundaries between them are where everything happens.' },
      { step: 2, seconds: 10, narration: 'Those three regions make two junctions back to back. In normal use one junction is forward biased, nudged open, while the other is reverse biased, held shut. On its own, that reverse junction blocks the main current cold.' },
      { step: 3, seconds: 10, narration: 'Now the clever part: injection. Push a small current into the thin middle layer, the base, and it floods with charge carriers. The base is so thin that most of them shoot straight across and get swept through the blocked junction.' },
      { step: 4, seconds: 9, narration: 'That’s current gain. A tiny trickle into the base releases a flood, often a hundred times larger, through the main path. A small change in the little current makes a big change in the big one.' },
      { step: 5, seconds: 9, narration: 'Drive it hard and it acts as a switch: fully off, or fully on, a clean one or zero. This is the on-off decision, repeated billions of times, that every line of code ultimately runs on.' },
      { step: 6, seconds: 9, narration: 'Drive it gently and it’s an amplifier instead: a faint wiggle at the base comes out as a powerful copy at the output. That’s how a whisper into a microphone can fill a stadium.' },
      { step: 7, seconds: 8, narration: 'Switch or amplifier, it’s the same little valve. And with billions of them etched onto a fingernail of silicon, it quietly runs every phone, every computer, every chip on Earth.' },
    ],
  },
};
