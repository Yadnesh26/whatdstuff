// Tiny, eagerly-bundled library-card metadata. Keep it light: the heavy
// index.js/model.js only load when someone opens this explainer.
export default {
  id: 'air-fryer',
  title: 'How an Air Fryer Works',
  summary:
    'A coil of hot wire, a fan running hard enough to strip the steam off your food, and a pot small enough that the air never slows down — the machine that browns chips without frying anything.',
  accent: '#ff7d4d',
  // one-line teardown for the library card
  spec: '1,500 W coil · 5 m/s air · a fast oven wearing a fryer’s name',
  // part names, so search finds this machine by what is inside it
  keywords: 'heating element nichrome fan convection perforated basket boundary layer maillard rapid air',
  categories: ['home'],
};
