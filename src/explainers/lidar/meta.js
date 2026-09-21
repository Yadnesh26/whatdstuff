// Tiny, eagerly-bundled library-card metadata. Keep it light: the heavy
// index.js/model.js only load when someone opens this explainer.
export default {
  id: 'lidar',
  title: 'How a LiDAR Sensor Works',
  summary:
    'A spinning black can on the roof of a self-driving car, firing invisible five-nanosecond flashes and timing how long they take to come back — sixty-four stopwatches building a 3D map out of nothing but arithmetic.',
  accent: '#6cf0a0',
  spec: 'time-of-flight ranging · 64 lasers on a head spinning at 900 rpm',
  keywords:
    'time of flight laser rangefinder point cloud avalanche photodiode 905nm infrared pulse self-driving autonomous spinning head Velodyne',
  categories: ['vehicles', 'electronics'],
};
