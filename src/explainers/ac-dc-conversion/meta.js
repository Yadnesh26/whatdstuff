export default {
  id: 'ac-dc-conversion',
  title: 'How AC and DC Conversion Works',
  summary:
    'Wall power sloshes back and forth; batteries only hold one-way DC. Inside an online (double-conversion) UPS, four diodes straighten AC into DC and four switches shake it back into AC.',
  accent: '#ffb347',
  // one-line teardown for the library card
  spec: 'AC → 4-diode bridge → DC bus → 4-switch H-bridge → AC',
  // part names, so search finds this machine by what is inside it
  keywords:
    'ac dc alternating direct current rectifier bridge diode inverter h-bridge pwm ups capacitor ripple sine wave electrons drift',
  categories: ['electronics', 'power'],
};
