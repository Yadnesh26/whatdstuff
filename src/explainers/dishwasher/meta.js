// Tiny, eagerly-bundled library-card metadata. Keep it light: the heavy
// index.js/model.js only load when someone opens this explainer.
export default {
  id: 'dishwasher',
  title: 'How a Dishwasher Works',
  summary:
    'It never fills up. Two litres sit in the bottom, and a pump throws that same puddle at your plates for two hours through arms that spin with no motor.',
  accent: '#5ecfd8',
  // one-line teardown for the library card
  spec: '~2 L recirculated · 11 L a cycle · arms 30–60 rpm',
  // part names, so search finds this machine by what is inside it
  keywords:
    'dishwasher spray arm sump filter circulation pump impeller volute flow-through heater detergent dispenser wax motor rinse aid drain pump high loop condensation drying racks cutlery basket inlet valve',
  categories: ['home'],
};
