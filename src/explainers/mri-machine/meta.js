// Tiny, eagerly-bundled library-card metadata. Keep it light: the heavy
// index.js/model.js only load when someone opens this explainer.
export default {
  id: 'mri-machine',
  title: 'How an MRI Machine Works',
  summary:
    'Nothing inside it moves. The image comes from a magnet held 269 degrees below zero by a current that has been going round in circles for years, a radio note played into you at 63.87 megahertz, and the handful of protons — about six in every million — that never bothered to cancel out.',
  accent: '#6ec6ff',
  // one-line teardown for the library card
  spec: 'superconducting NbTi magnet · 1.5 T · 4.2 K · 63.87 MHz',
  // part names, so search finds this machine by what is inside it
  keywords:
    'MRI scanner bore cryostat vacuum vessel radiation shield liquid helium superconducting magnet niobium titanium NbTi persistent current switch quench vent gradient coil slew rate birdcage RF body coil receive coil Larmor frequency precession net magnetisation k-space Fourier transform phantom shim coil',
  categories: ['medical'],
};
