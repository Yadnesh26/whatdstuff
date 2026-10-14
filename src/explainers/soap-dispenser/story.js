// Phase 0 artifact — written BEFORE the model (add-explainer skill, Phase 0).
// Pure data, no imports, never bundled: the registry globs only meta.js and
// index.js. This is the record of what the explainer is FOR, and the contract
// the model must satisfy.
//
// SCOPE NOTE: this is the classic manual LOTION/SOAP PUMP (28/410 closure,
// dip tube, two ball check valves, internal return spring) — the one on every
// bathroom sink. Not the foaming pump (air + liquid chambers + mesh) and not
// the touchless IR/motor dispenser; both are different machines.
export default {
  angle:
    'Pressing the pump does not pull soap up out of the bottle — letting go does. ' +
    'The soap that lands in your hand was drawn up by the spring on your PREVIOUS ' +
    'release and has been waiting in a tiny chamber ever since. Your press only ' +
    'empties it. Two glass balls make sure it can only ever go one way.',

  stat: 'About 2 mL per press — a 14.5 mm piston moving 12 mm. A new bottle needs a few presses before any comes out, because the first strokes are only pumping air.',

  button: 'You press. The spring does the pulling.',

  who: 'Anyone who has pumped a new bottle five times, got nothing, and wondered what it was doing.',

  beats: [
    {
      idea: 'A soap pump is a sealed plastic head on a bottle — press it and a measured dose comes out the spout, every time.',
      visuals: ['the complete bottle with its pump head, solid and ordinary', 'the head pressing down and a squirt leaving the spout'],
    },
    {
      idea: 'Under the cap is a tiny piston pump: a cylinder hanging into the bottle, a piston on a hollow stem, a spring, and a straw to the bottom.',
      visuals: ['the bottle and cap ghosting to expose the pump', 'housing cylinder, piston + hollow stem, spring, dip tube, both balls labelled'],
    },
    {
      idea: 'Releasing is the intake stroke: the spring lifts the piston, the chamber grows, the pressure drops, and atmospheric pressure on the soap surface pushes it up the dip tube past the lower ball.',
      visuals: ['the piston rising', 'the lower ball lifting off its seat', 'soap climbing the dip tube and filling the chamber', 'the upper ball sealed shut'],
    },
    {
      idea: 'Pressing is the delivery stroke: the lower ball slams onto its seat, so the trapped soap has one exit — up through the hollow stem, past the upper ball, out the spout.',
      visuals: ['the piston driving down, compressing the spring', 'the lower ball seated', 'the upper ball lifted', 'soap travelling up the stem and out of the nozzle'],
    },
    {
      idea: 'A new pump is full of air. Air squashes instead of opening valves, so the first strokes just shuttle air — each release lifts the soap a little higher until the chamber is full.',
      visuals: ['the soap column rising stroke by stroke up the dip tube', 'the chamber filling and the first squirt arriving'],
    },
    {
      idea: 'Run as a whole: press, release, press — the spring does the pulling, your thumb only ever pushes.',
      visuals: ['the complete pump re-solidified, cycling', 'a dose leaving the spout each press'],
    },
  ],
};
