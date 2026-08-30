// Tiny, eagerly-bundled library-card metadata. Keep it light: the heavy
// index.js/model.js only load when someone opens this explainer.
export default {
  id: 'heart',
  title: 'How the Heart Works',
  summary:
    'It is not one pump. It is two, bolted together and wired to fire 0.1 seconds apart — and the muscle doing the work can only feed itself in the gap between beats.',
  accent: '#ff6a72',
  // one-line teardown for the library card
  spec: 'two pumps · 70 mL a beat · 0.8 s cycle · ~2.7 billion beats',
  // part names, so search finds this machine by what is inside it
  keywords:
    'heart cardiac cycle systole diastole left ventricle right ventricle atrium myocardium interventricular septum mitral valve tricuspid valve aortic valve pulmonary valve semilunar cusp chordae tendineae papillary muscle annulus fibrous skeleton sinoatrial SA node atrioventricular AV node bundle of His Purkinje fibres aorta pulmonary trunk vena cava coronary artery LAD stroke volume ejection fraction',
  categories: ['medical'],
};
