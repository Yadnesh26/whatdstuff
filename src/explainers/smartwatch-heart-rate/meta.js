// Tiny, eagerly-bundled library-card metadata. Keep it light: the heavy
// index.js/model.js only load when someone opens this explainer.
export default {
  id: 'smartwatch-heart-rate',
  title: 'How a Smartwatch Measures Your Heart Rate',
  summary:
    'Your watch never hears your heart. It shines green light into your wrist, watches it come back a fraction darker each time a beat pushes blood under the sensor, and counts the dips.',
  accent: '#4ef08a',
  // one-line teardown for the library card
  spec: 'Green LEDs · photodiodes · ~1 % dip per beat · accelerometer motion filter',
  // part names, so search finds this machine by what is inside it
  keywords:
    'smartwatch heart rate monitor BPM pulse optical heart sensor photoplethysmography PPG green LED photodiode back crystal light barrier accelerometer motion artifact analog front end AFE fitness tracker wearable Apple Watch Fitbit Galaxy Watch infrared red LED blood oxygen capillaries arteries',
  categories: ['medical', 'electronics'],
};
