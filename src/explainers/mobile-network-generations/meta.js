// Tiny, eagerly-bundled library-card metadata. Keep it light: the heavy
// index.js/model.js only load when someone opens this explainer.
export default {
  id: 'mobile-network-generations',
  title: 'How 2G, 3G, 4G, 5G and 6G Work',
  summary:
    'A radio wave has not got faster since 1901, and Shannon\'s limit has not moved a decibel. Every G is the same steel mast buying speed with the same three coins — a wider slice of spectrum, a denser alphabet, more copies of the signal sent through space at once. What actually changes each time is how the network stops you waiting your turn.',
  // one-line teardown for the library card
  spec: '200 kHz → 400 MHz · 8 turns → 64 beams · 9.6 kbit/s → 20 Gbit/s',
  // part names, so search finds this machine by what is inside it
  keywords:
    '2g 3g 4g 5g 6g gsm tdma timeslot wcdma cdma spreading code lte ofdma resource block qam constellation massive mimo beamforming aau mmwave isac sector antenna cell tower base station bandwidth',
  categories: ['communications', 'electronics'],
};
