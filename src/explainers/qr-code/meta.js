export default {
  id: 'qr-code',
  title: 'How a QR Code Works',
  summary:
    'A QR code is a page of writing with the ruler printed on it. Three 7×7 squares tell a camera where the code is and which way up it is, a dotted line down the middle tells it how big a module is, and the rest is your message run through Reed–Solomon so a third of it can be scratched off and still read. This one is a real Version 2 code, generated module by module in the browser.',
  accent: '#4ddbc4',
  // one-line teardown for the library card
  spec: '25 × 25 modules · 16 data + 28 correction codewords · 8 masks, lowest penalty wins',
  // part names, so search finds this machine by what is inside it
  keywords:
    'qr code quick response denso wave masahiro hara finder pattern alignment timing pattern quiet zone format information reed solomon error correction mask pattern penalty score codeword byte mode module matrix barcode scanner version 2 ecc level h',
  categories: ['communications', 'electronics'],
};
