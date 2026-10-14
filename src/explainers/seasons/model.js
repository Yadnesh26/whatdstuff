import * as THREE from 'three';
import { calloutSets } from '../../framework/callouts.js';
import { clamp01, smooth, TAU } from '../../framework/motion.js';

// "How the Seasons Work" — one planet, one lean, one scalar.
//
// Everything in the scene is driven by `t`, the fraction of a year since
// 1 January. From t the model derives Earth's place on its (real, almost
// circular) orbit, the Sun's declination, the snow line, the latitude of the
// tropical rain belt, India's greening and the monsoon winds. Nothing is
// keyframed per step: a step only chooses a camera FRAME and which overlays
// are on.
//
// Reference facts (Wikipedia "Season", "Monsoon of South Asia"; NWS; IMD
// 2022 normals; Rutgers Global Snow Lab via NOAA NCEI):
//   axial tilt 23.44° · eccentricity 0.0167 · perihelion ~3 Jan 147.1 M km,
//   aphelion ~4 Jul 152.1 M km · at 45° N noon Sun 68.4° (Jun) vs 21.6° (Dec),
//   daylight 15 h 26 m vs 8 h 34 m · monsoon onset Kerala ~1 Jun, all-India
//   by mid-July, Jun–Sep ≈ 75% of annual rain · NH snow cover ~47 M km² Jan,
//   ~3 M km² Aug.
//
// THREE CAMERA FRAMES, one Earth:
//   'orbit' — heliocentric: Sun at the origin, Earth on its orbit with the
//             axis fixed in space. Sizes are not to scale (disclosed in copy);
//             the orbit's shape and the dates are.
//   'sun'   — riding along with Earth, the Earth→Sun line held on +x. The
//             fixed axis then appears to nod toward the Sun in June and away
//             in December. Same physics, co-rotating frame.
//   'fixed' — Earth held still (one chosen meridian toward the camera) and
//             the Sun direction computed for the date and a fixed local time:
//             a "same hour every day" time-lapse, so India or the Arctic stays
//             put while the overhead Sun marches north and south.
//
// Geography is procedural data: coarse coastlines typed in below as lon/lat
// outlines, rasterised to textures at build time. No image assets.

const PI = Math.PI;
const deg = (x) => (x * PI) / 180;

export const R = 1.2; // globe radius in the globe frames
const EPS = deg(23.44);
const ECC = 0.0167;
const YEAR = 365.25;
const PERI_DAY = 2.5; // 3 January, ~midday
const PERI_LON = deg(102.95); // heliocentric longitude of perihelion
const AU_KM = 149.598e6;
export const ORBIT_A = 7; // orbit semi-major axis, scene units
const K_ORB = 0.45; // Earth's scale in the orbit view (radius 0.54)
const SUN_R = 0.85;
export const LAT45 = 45;
export const MILAN_LON = 9.2;

// ---------------------------------------------------------------------------
// orbit + Sun geometry for a date
// ---------------------------------------------------------------------------
function wrap1(t) {
  return ((t % 1) + 1) % 1;
}

export function sunGeom(t) {
  const M = (TAU * (wrap1(t) * YEAR - PERI_DAY)) / YEAR;
  const nu = M + 2 * ECC * Math.sin(M) + 1.25 * ECC * ECC * Math.sin(2 * M);
  const rho = (1 - ECC * ECC) / (1 + ECC * Math.cos(nu)); // in AU
  const lamE = nu + PERI_LON;
  const dec = Math.asin(Math.sin(EPS) * Math.sin(lamE + PI));
  return { nu, rho, lamE, dec };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MDAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export function fmtDate(t) {
  let d = Math.floor(wrap1(t) * 365);
  let m = 0;
  while (d >= MDAYS[m]) {
    d -= MDAYS[m];
    m++;
  }
  return `${d + 1} ${MONTHS[m]}`;
}

// daylight hours at latitude φ for declination δ (geometric, no refraction)
function dayHours(phi, dec) {
  const x = -Math.tan(phi) * Math.tan(dec);
  if (x <= -1) return 24;
  if (x >= 1) return 0;
  return (2 * Math.acos(x) * 12) / PI;
}
function fmtHM(h) {
  let hh = Math.floor(h);
  let mm = Math.round((h - hh) * 60);
  if (mm === 60) {
    hh++;
    mm = 0;
  }
  return `${hh} h ${String(mm).padStart(2, '0')} m`;
}

// periodic keyframes on day-of-year, smoothstepped between keys
function keyed(keys) {
  const n = keys.length;
  return (t) => {
    const d = wrap1(t) * YEAR;
    let i = n - 1; // the last key at or before d (wrapping to the final key)
    for (let k = 0; k < n; k++) if (keys[k][0] <= d) i = k;
    const [a, v0] = keys[i];
    const [b0, v1] = keys[(i + 1) % n];
    const b = b0 <= a ? b0 + YEAR : b0;
    const x = d < a ? d + YEAR : d;
    return v0 + (v1 - v0) * smooth((x - a) / (b - a));
  };
}

// Climatology, simplified to smooth curves (averages, not one year).
// Rain-belt latitude over the South Asian sector: south of the equator in
// winter, Kerala (~10° N) by 1 June, ~24° N by mid-July, back by November.
const itczAsia = keyed([
  [15, -12], [90, -5], [135, 3], [152, 10], [196, 24], [244, 22], [275, 13], [305, 2], [335, -8],
]);
// India's vegetation: driest in May, greenest in September–October
const greenIndia = keyed([[10, 0.55], [75, 0.22], [140, 0], [170, 0.3], [212, 0.85], [258, 1], [305, 0.82], [349, 0.62]]);
// pre-monsoon heat over the subcontinent, peaking in May
const heatIndia = keyed([[60, 0], [105, 0.45], [140, 1], [166, 0.5], [190, 0], [300, 0]]);
// monsoon winds: wet south-westerlies Jun–Sep, dry north-easterlies Dec–Feb
const windSW = keyed([[145, 0], [170, 1], [258, 1], [285, 0]]);
const windNE = keyed([[60, 1], [80, 0], [318, 0], [340, 1]]);
// rain cloud boost over the subcontinent while the monsoon is in
const rainIndia = keyed([[140, 0], [165, 0.7], [200, 1], [250, 1], [285, 0.2], [300, 0]]);

// snow lines: the effective latitude above which land is white. Lagged a
// month+ behind the solstice, like the cold itself.
const snowLineN = (t) => 74 - 28 * (0.5 + 0.5 * Math.cos(TAU * (wrap1(t) - 0.09)));
const snowLineS = (t) => 72 - 22 * (0.5 + 0.5 * Math.cos(TAU * (wrap1(t) - 0.59)));
// sea-ice edges: Arctic largest in March, Antarctic in September
const seaIceN = (t) => 76.5 - 11 * (0.5 + 0.5 * Math.cos(TAU * (wrap1(t) - 0.2)));
const seaIceS = (t) => 69 - 9 * (0.5 + 0.5 * Math.cos(TAU * (wrap1(t) - 0.71)));
const itczBase = (t) => 5 + 7 * Math.cos(TAU * (wrap1(t) - 0.6));

// lat/lon (radians) → unit vector in the body frame: y = north, lon 0 on +x,
// east longitudes counter-clockwise seen from the north (toward −z)
function latlon(lat, lon, out = new THREE.Vector3()) {
  return out.set(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon));
}
const LL = (latDeg, lonDeg, out) => latlon(deg(latDeg), deg(lonDeg), out);

// ---------------------------------------------------------------------------
// coastlines — [lon, lat] outlines, coarse but recognisable at globe scale
// ---------------------------------------------------------------------------
const LAND = [
  // North America
  [[-168,65.6],[-163,69.5],[-156,71.3],[-148,70.3],[-141,69.7],[-133,69.5],[-125,70],[-117,68.9],[-108,68],[-98,67.9],[-94,69],[-90,68.5],[-85,69.5],[-82,67],[-87,64.5],[-93,61],[-94,58.7],[-90,57],[-85,55.3],[-82,52.9],[-79.5,51.5],[-78.6,54.5],[-77,58],[-78,60.8],[-73,62],[-70,61],[-65,60],[-61.5,56],[-56,52.5],[-59,47.6],[-64,46.2],[-61,45.2],[-65.8,44.5],[-70,43.7],[-70,41.7],[-74,40.5],[-75.5,38.5],[-76,35.5],[-78.5,33.8],[-81,31.8],[-80.2,27],[-80.4,25.2],[-81.8,26.5],[-82.7,28],[-84,30],[-86.5,30.4],[-89.5,30.2],[-90.1,29.1],[-94,29.6],[-97.2,27.8],[-97.5,25],[-97.8,22.4],[-96,19],[-94.5,18.2],[-91,18.6],[-90.4,21],[-87,21.5],[-87.5,18],[-88.3,16],[-84,15.8],[-83.3,14.8],[-83.6,11],[-81.7,9],[-79.5,9.5],[-77.5,8.6],[-80,7.3],[-83,8.3],[-85.7,10],[-87.5,13],[-91.5,14],[-94.5,16],[-97.5,16],[-101,17.5],[-105.5,20],[-105.5,22.5],[-109,25.8],[-112,29],[-114.8,31.5],[-113,28],[-110,23],[-109.8,22.9],[-112,25],[-115,28.5],[-116.7,31.7],[-118.5,34],[-120.6,34.6],[-122.5,37.8],[-124.2,40.5],[-124,46],[-124.7,48.4],[-127.5,50.5],[-130.5,54],[-133,57],[-137,58.5],[-140,59.8],[-146,60.8],[-151,59.4],[-154,57.7],[-158,56.5],[-162,55],[-164.5,54.5],[-160,58.6],[-162,60],[-165,61],[-164.5,63.2],[-161,64.4],[-166,64.6]],
  // Canadian Arctic islands
  [[-80,73.6],[-72,71.5],[-68,70],[-62,66.8],[-64,63.5],[-68,62.4],[-73,64.5],[-78,64.5],[-75,67.5],[-82,69.5],[-89,70.5],[-87,73.5]],
  [[-118,73],[-110,73],[-101,72],[-101,69],[-108,68.5],[-117,69]],
  [[-95,76],[-82,76],[-78,79],[-62,82.6],[-75,83],[-92,81.5],[-96,79]],
  [[-125,72],[-120,74.5],[-116,73],[-118,71.5]],
  // Greenland
  [[-73,78],[-66,80.8],[-55,82.2],[-40,83.5],[-25,83],[-20,81.5],[-18.5,78],[-20,75],[-22,72],[-24,70],[-28,68.2],[-35,65.8],[-40,64.5],[-43,60],[-48,61],[-51,64],[-53,67],[-54,70],[-56,72.5],[-60,75.8],[-66,76]],
  // Iceland
  [[-22,64],[-24,65.5],[-22,66.4],[-18,66.2],[-14.5,66.3],[-13.6,65.2],[-15,64.3],[-18,63.4]],
  // Cuba, Hispaniola
  [[-85,21.9],[-82,23.2],[-79,23],[-75.7,21.1],[-74.2,20.2],[-77.7,19.9],[-80,21.8],[-82.6,21.6]],
  [[-74.4,18.4],[-72.8,19.9],[-70,19.8],[-68.4,18.6],[-70,18.2],[-71.4,17.6]],
  // South America
  [[-77.5,8.6],[-75.5,10.5],[-72,11.8],[-71.5,10],[-68,10.6],[-64,10.7],[-61,10.2],[-58,7],[-54,5.8],[-51.5,4.2],[-50,1.5],[-48.5,-1.2],[-44.5,-2.5],[-40,-2.8],[-35.2,-5.5],[-35,-9],[-37.5,-12.5],[-39,-15.5],[-40,-20],[-42,-23],[-45,-23.8],[-48.5,-26.5],[-48.7,-28.5],[-51,-31],[-53.4,-33.8],[-56,-34.9],[-58.5,-34.5],[-57.5,-36.5],[-57.6,-38.2],[-62,-39],[-62.3,-40.6],[-65,-41],[-64.5,-42.5],[-65.5,-45],[-67.5,-46.5],[-66,-48],[-68.4,-50.2],[-69,-52],[-68.3,-53.5],[-66.5,-55],[-70,-55.2],[-73.5,-53],[-75.2,-50],[-74.5,-46.8],[-74,-44],[-73.5,-41.5],[-73.5,-37.2],[-71.6,-33],[-71.4,-29],[-70.5,-25],[-70.2,-20],[-70.3,-18.3],[-72.5,-17],[-76,-14],[-77.8,-11],[-79.5,-7.5],[-81.2,-5.5],[-80.5,-3],[-80,-1],[-80.2,0.8],[-78.8,1.8],[-77.5,4],[-77.4,6.5]],
  // Africa
  [[-17,21],[-16,24],[-14.5,26.2],[-12,28],[-9.7,30],[-9.6,32],[-7,33.6],[-5.9,35.8],[-2,35.1],[1,36.5],[5,36.8],[9.8,37.3],[11,37],[10.2,34],[11,33.1],[15.2,32.3],[19,30.3],[20,31.8],[23,32.6],[25,31.7],[29,30.9],[32.3,31.3],[34.2,31.2],[34.9,29.5],[33.6,27.8],[35.5,24],[37.2,21],[38.6,18],[39.7,15.2],[41.8,13],[43.3,11.8],[44.5,10.4],[51.2,11.8],[51,10.5],[50,8.5],[48,5],[46,2],[43,-0.8],[41,-2.5],[39.2,-4.7],[39.3,-8],[40.5,-10.5],[40.5,-15],[37,-17.8],[35,-20.5],[35.5,-24],[32.8,-25.8],[32.5,-28.5],[30.5,-31],[27.5,-33.6],[25,-34],[22,-34.2],[20,-34.8],[18.4,-34],[17.8,-31.5],[16.5,-28.6],[15.2,-26.8],[14.4,-22.5],[11.8,-18],[11.8,-16.2],[13.6,-12],[13.2,-9],[12.2,-6],[12,-5],[9.5,-2],[9.3,1],[9.8,3.5],[8.5,4.5],[6,4.3],[4.4,6.4],[1,6],[-2,4.8],[-4.5,5.2],[-7.5,4.4],[-10.5,6.5],[-13.2,8.5],[-15,11],[-16.7,12.5],[-17.2,14.7],[-16.5,16.5],[-16.2,19]],
  // Madagascar
  [[49.3,-12],[50.5,-15.5],[49.8,-17],[48,-21.5],[47,-25],[45,-25.5],[43.7,-23.5],[43.3,-21.5],[44.4,-19],[44,-16.5],[46,-15.8],[48,-13.5]],
  // Eurasia (Iberia → Mediterranean → Arabia → India → SE Asia → China →
  // Far East → Arctic coast → Scandinavia → Baltic → back to Iberia)
  [[-5.6,36],[-2,36.7],[0,38.8],[0.5,40.5],[3.2,42],[3.1,43.1],[4.5,43.4],[6.5,43.1],[8.6,44.4],[10.2,43.9],[11,42.4],[12.6,41.5],[15.6,40.1],[15.7,38],[16.1,37.9],[16.6,38.4],[17.2,39.4],[17.2,40.4],[18.5,40.1],[18,40.6],[16,41.5],[13.9,42.8],[12.3,44.5],[12.4,45.4],[13.7,45.6],[15,44.6],[17.5,43],[19.5,41.8],[19.3,40.4],[21,38.3],[22.2,36.5],[23.2,37.8],[24,38.2],[22.9,40.5],[24,40.9],[26.2,40.6],[26.3,40],[27.2,37.5],[28.3,36.7],[30.6,36.7],[32.6,36.1],[36,36.8],[35.8,35],[35.1,33.2],[34.3,31.2],[35,29.5],[35,28],[36.5,26],[38.5,23.5],[39.2,21.5],[40.8,19],[42.6,16.5],[43.3,12.7],[45,12.8],[48.5,14],[52,15.6],[55,17.5],[56.8,18.5],[58.6,20.5],[59.8,22.5],[58.7,23.6],[56.4,24.8],[56.3,26.2],[55.5,25.5],[54.2,24.2],[52,24],[51.5,25.5],[50.8,24.8],[50,26.5],[48.6,28],[48,30],[49.5,30],[50.5,29],[51.5,27.9],[54,26.6],[56.3,27.1],[57.4,25.8],[61.5,25.2],[66.6,25.4],[67.5,24],[68.7,23.3],[70.3,22.9],[69,22.3],[70.4,20.8],[72.6,21.3],[72.9,19],[73.4,16],[74.4,14],[75,12],[76.2,10],[77,8.2],[77.6,8.1],[78.2,8.9],[79.3,10.3],[79.8,11.5],[80.3,13.4],[80.1,15.8],[82.3,17],[84.6,19.2],[87,20.8],[86.9,21.6],[88.5,21.7],[90,22],[91.5,22.5],[92.3,21],[93,19.5],[94.3,18],[94.4,16.2],[95.5,15.8],[97.6,16.6],[98,13.5],[98.6,10],[98.4,8],[100.3,4],[101.3,2.8],[103.5,1.3],[104.2,1.4],[103.4,4],[102.2,6.2],[100.3,7.5],[100,10],[99.2,10.5],[100,13.4],[100.9,12.7],[102.6,12.2],[103.5,10.5],[104.8,8.6],[106,9.3],[106.8,10.5],[109,11.6],[109.3,13.5],[108.8,15.4],[107,17],[106.4,18.3],[105.7,19],[106.7,20.7],[108,21.5],[109.7,21.5],[110.3,20.3],[111,21.5],[113.2,22.2],[114.2,22.3],[116.5,22.9],[118.6,24.5],[119.6,25.9],[120.4,27.2],[121.9,30],[121.2,30.8],[121.9,31.7],[120.3,34.3],[119.2,35],[120.3,36.1],[122.5,37],[121,37.7],[119,37.2],[118.9,38],[117.6,38.6],[118,39.3],[119.5,39.9],[121.2,40.9],[122.3,40.4],[121.3,39],[122.6,39.4],[124.3,39.9],[125.3,37.7],[126.6,37.2],[126.4,34.5],[127.6,34.7],[129.4,35.5],[129.4,37],[128.4,38.6],[127.5,39.8],[129.7,40.9],[129.9,42.4],[132,43.2],[135.5,43.9],[138.2,46.5],[140.5,48.8],[140.4,51.3],[141.4,53.2],[137.5,54],[135.2,54.8],[137,56.5],[140.5,58.3],[143,59.3],[148,59.3],[152.5,59.1],[155,59.3],[155.9,57.5],[156.7,51],[158.5,52.5],[160.5,54.8],[162.5,56.5],[163.3,58.2],[164.5,59.8],[166.4,60.4],[170.4,60],[172.8,61.2],[175,62],[177.5,62.6],[179.5,62.5],[182,64.8],[186,64.5],[187.5,65.5],[190.3,66],[188,67.3],[184,68.3],[180,69],[175,69.9],[170,70],[166,69.6],[161,69.6],[160,70.8],[152,70.9],[147,72.3],[140,72.5],[135,71.6],[130,70.9],[128,72.2],[126,73.5],[119,73.1],[113.5,73.7],[110,74],[112,76],[107,77.5],[104,77.7],[100,76.5],[98,76.1],[93,75.8],[88,75.2],[86.6,74],[81,73.6],[80.5,72.5],[78,72.3],[75.2,72.9],[74.5,72.2],[73,71.5],[73.5,68.5],[71.5,66.5],[68.5,68.2],[69,69],[66.7,70.8],[61,69.8],[58.5,68.5],[54.5,68.1],[50,67.7],[44,68.4],[40,67.4],[35,66.3],[33,69.1],[29,70],[25,71.1],[20,70],[15.6,68.5],[12.5,66],[10.5,64],[5.3,62],[5,60],[5.7,58.9],[7,58],[8.2,58.2],[10.5,59.3],[11.2,58.4],[12.6,56.3],[14.2,55.4],[16,56.2],[16.5,57.5],[18.7,59.3],[17.3,60.7],[17.4,62.4],[21,64.6],[22.4,65.8],[25.4,65],[24.6,64.2],[21.4,62.3],[21.4,60.6],[22.9,59.8],[26,60.4],[30,60],[28,59.5],[24,59.3],[23.4,58.6],[24.2,57.3],[21.5,57.4],[21,56],[21.2,55.2],[19.6,54.4],[18.5,54.7],[16,54.3],[14.2,53.9],[11.2,54],[9.9,54.8],[10.3,56.4],[10.6,57.7],[8.3,56.9],[8.2,55.5],[8.6,53.9],[7,53.5],[5,53.3],[4.2,52],[3.4,51.4],[1.6,50.9],[0,49.5],[-1.3,49.6],[-1.9,48.7],[-4.7,48.4],[-4.2,47.8],[-2.3,47.3],[-1.2,46],[-1.4,44],[-1.8,43.4],[-4,43.4],[-8,43.7],[-9.3,43],[-8.9,41.5],[-9.5,38.8],[-8.8,37],[-7.4,37.2],[-6.4,36.8]],
  // Great Britain, Ireland
  [[-5.7,50],[-3,50.6],[1.4,51.2],[1.7,52.6],[0.3,53.4],[-0.1,54.5],[-1.6,55.6],[-2,57.6],[-3.3,58.6],[-5,58.6],[-6.2,57.5],[-5.6,56.3],[-4.9,55.2],[-3.1,54.9],[-3.4,54.2],[-3,53.4],[-4.6,53.3],[-4.1,52.3],[-5.2,51.7],[-3.2,51.4]],
  [[-6,52.2],[-6.2,53.9],[-5.7,54.6],[-7.3,55.3],[-8.5,54.3],[-10.1,54],[-9.5,52.9],[-10.3,51.9],[-9.7,51.5],[-8,51.8]],
  // Svalbard, Novaya Zemlya
  [[11,78.8],[16,80],[22,80.4],[27,80.1],[24,78.5],[20,77.4],[16,76.5],[13,77.5]],
  [[52,71.3],[55,73],[58,75.5],[64,76.5],[68,77],[66,75.7],[60,74],[56,71],[53,70.6]],
  // Sri Lanka
  [[79.9,9.8],[81,8.8],[81.9,7.5],[81.7,6.4],[80.6,5.9],[80,6.8],[79.7,8.2]],
  // Japan, Sakhalin, Taiwan, Hainan
  [[130,33.5],[131,31.3],[132.2,33.5],[134.7,33.8],[136,33.5],[137,34.6],[139,34.7],[140.9,35.7],[140.6,36.9],[141,38.3],[142,39.6],[141.4,41.4],[143.2,42],[145.5,43.3],[144.5,44],[141.9,45.5],[141.4,43.3],[140,41.4],[140,40],[139.8,38.5],[137.3,37],[136.7,37.3],[135.8,35.6],[133,35.5],[131,34.3]],
  [[142,46],[143.5,46.3],[143.3,49.5],[144.7,49],[143,54],[142.5,54.2],[142.2,51],[141.8,48]],
  [[120.2,22.6],[120.9,21.9],[121.9,24.6],[121.5,25.3],[120.7,24.5]],
  [[108.7,18.5],[110,18.2],[111,19.6],[110.5,20.1],[109.2,19.9]],
  // Philippines
  [[120.6,18.5],[122.3,18.5],[122,16],[123.8,13.8],[124,12.5],[121.7,13.9],[120.6,14.4],[120,16]],
  [[122,7],[125.5,9.8],[126.5,7],[125.3,5.6],[123.8,7.7]],
  // Borneo, Sumatra, Java, Sulawesi, New Guinea
  [[109,1.5],[109.6,-1],[110.2,-2.9],[114,-3.4],[116.5,-3.8],[116,-1.5],[118,0.8],[117.8,2.8],[119.2,5.2],[117.2,7],[115.4,5],[113,3.2],[111,1.7],[109.7,2]],
  [[95.3,5.6],[97.5,5.2],[100.4,2.2],[103.8,-1],[106,-3.2],[105.8,-5.8],[104.5,-5.9],[102.3,-4],[100.8,-2],[98.7,1.7],[96.2,3.7]],
  [[105.2,-6.8],[106.5,-6],[108.5,-6.6],[111,-6.4],[112.7,-6.9],[114.5,-7.8],[112.6,-8.4],[110,-8.1],[106.4,-7.4]],
  [[119.4,-5.5],[120.4,-5.6],[121.3,-4.6],[123.2,-5.4],[122.9,-4.3],[121.5,-1.9],[123.3,-1],[125.1,1.5],[124.4,0.4],[120.9,1.3],[119.6,-0.1],[118.8,-2.7]],
  [[131,-1.4],[134,-0.9],[138,-1.6],[141,-2.6],[144.5,-3.8],[147.5,-6],[148,-8],[150.8,-10.3],[147.5,-10],[146,-8],[144,-7.7],[142.7,-9.2],[141,-9.1],[139,-8.1],[138,-5.5],[135,-4.4],[132.8,-4.1],[132,-2.8]],
  // Australia, Tasmania, New Zealand
  [[113.4,-22],[114,-26.3],[115,-30],[115,-33.6],[116,-35],[118,-35.1],[121,-33.9],[124,-32.9],[126.2,-32.2],[129,-31.6],[131.2,-31.5],[134.2,-32.6],[135.6,-34.8],[137.8,-32.6],[137.8,-35.6],[139.6,-36.2],[140.6,-38],[143.5,-38.8],[146.3,-39.1],[148,-37.8],[150,-37.5],[151.2,-33.9],[153.1,-31],[153.6,-28.2],[153,-25.3],[150.8,-22.6],[149,-20.4],[146.3,-18.9],[145.4,-16],[145.3,-14.9],[143.6,-13.9],[142.5,-10.7],[141.6,-12.6],[141.6,-15.1],[140.8,-17.5],[139.2,-17.3],[137.5,-16],[135.5,-14.8],[136.8,-12.2],[135,-12.2],[132.6,-11.5],[131,-12.3],[129.5,-14.9],[128,-15.3],[126.2,-14],[124.3,-16.5],[122.2,-18],[121,-19.6],[118.5,-20.4],[116.7,-20.6]],
  [[144.6,-40.7],[148.3,-40.9],[148.2,-42.2],[147,-43.6],[145.2,-42.4]],
  [[172.7,-34.4],[174.7,-36.9],[176,-37.6],[178.5,-37.7],[177.9,-39.2],[176.8,-40.1],[175.2,-41.6],[174.6,-41.2],[175.2,-40.3],[174,-39.2],[174.6,-38]],
  [[172.8,-40.5],[174.2,-41.8],[173,-43.7],[171.2,-44.5],[170.6,-45.9],[169,-46.6],[166.5,-46],[166.9,-45],[168.4,-44],[171.2,-42.4]],
];
// Antarctica spans every longitude, so it closes along the pole
const ANTARCTICA = [[-180,-78],[-160,-78],[-150,-76],[-140,-75],[-130,-74],[-120,-73.5],[-100,-73],[-90,-73],[-80,-73],[-75,-71],[-68,-67],[-62,-64],[-57,-63.3],[-58,-64.5],[-61,-66.5],[-62,-69],[-61,-72.5],[-60,-75],[-50,-78],[-40,-78],[-30,-76],[-20,-73.5],[-10,-71],[0,-70],[10,-70],[20,-69.8],[30,-69.5],[40,-68.5],[50,-67],[60,-67.2],[70,-68],[75,-69.5],[80,-67.5],[90,-66.5],[100,-66],[110,-66.3],[120,-66.8],[130,-66.3],[140,-66.8],[150,-68.5],[160,-70],[166,-71.5],[170,-72.5],[168,-76],[170,-78],[180,-78],[180,-90],[-180,-90]];
// inland seas cut back out of the land
const SEAS = [
  [[27.5,42.5],[28,41.3],[29,41.2],[31.5,41.3],[33.5,42],[35.2,42],[38,41],[41.5,41.5],[41.7,42.6],[40,43.5],[38,44.6],[36.7,45.3],[35,45],[33.5,44.5],[32.5,45.4],[33.6,46.1],[31.5,46.6],[30.3,46.2],[29.6,45.3],[28.6,44.2],[27.9,43.2]],
  [[49.5,46.4],[51.7,47],[53,46.3],[53.2,45],[51,44.4],[51.3,43.2],[52.8,41.8],[53,40],[53.9,37.3],[51,36.8],[49.2,37.5],[48.8,38.8],[49.5,40.3],[48.3,41.8],[47.5,43],[47.2,44.5]],
];
// soft regional masks: [lon, lat, radius lon°, radius lat°, strength]
const DESERTS = [
  [0,24,27,9.5,1.25],[22,23,19,9.5,1.25],[-10,22,9,7,1.1],[32,25,6,6,1],[46,23,12,8,1.15],
  [60,32,13,6,0.8],[70,27,5,4,0.9],[62,43,15,5.5,0.7],[84,40,9,3.5,0.9],[104,42,11,4,0.8],
  [19,-24,7,6,0.8],[131,-25,17,8,1],[-112,33,7,5,0.8],[-70,-23,2,6,0.8],[-68,-44,4,5,0.5],[46,6,5,4,0.6],
];
const HIGHLANDS = [
  [87,33,12,4.5,1],[82,29.5,9,1.6,0.75],[71,37,5,2.5,0.85],[-113,47,5,10,0.6],[-108,38,4,5,0.55],[-70,-18,2.5,14,0.7],
  [-71,-37,1.8,9,0.65],[10,46.3,4,1.2,0.65],[44,42.7,3,1,0.55],[39,9,3,4,0.35],[55,33,9,4,0.3],[100,47,10,4,0.4],
  [36,-3,3,6,0.3],[13,64,2.5,5,0.4],[-150,62,6,2.5,0.55],[-125,55,4,6,0.45],[170,-43.5,2.5,2,0.6],
];
const MONSOON = [[78,21,8,9,1],[80,27,7,3,0.85],[90,24,3.5,3,0.9],[96,20,4,6,0.7],[77,12,4,5,0.9]];
const HEAT = [[76,22,14,10,1.15],[69,28,7,5,0.7]];

// ---------------------------------------------------------------------------
// texture bake
// ---------------------------------------------------------------------------
function hash2(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1274126177);
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// value noise that wraps in x with period px — a sphere-map seam is the one
// flaw you cannot miss on a turning globe
function vnoise(x, y, px, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const h = (i, j) => hash2(((i % px) + px) % px, j, seed);
  const a = h(x0, y0);
  const b = h(x0 + 1, y0);
  const c = h(x0, y0 + 1);
  const d = h(x0 + 1, y0 + 1);
  const top = a + (b - a) * sx;
  const bot = c + (d - c) * sx;
  return top + (bot - top) * sy;
}

const TEX_W = 2048;
const TEX_H = 1024;
const px = (lon) => ((lon + 180) / 360) * TEX_W;
const py = (lat) => ((90 - lat) / 180) * TEX_H;

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  return { c, ctx };
}

function fillPolys(ctx, polys, style) {
  ctx.fillStyle = style;
  for (const poly of polys) {
    for (const off of [-TEX_W, 0, TEX_W]) {
      ctx.beginPath();
      poly.forEach(([lo, la], i) => {
        const x = px(lo) + off;
        const y = py(la);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fill();
    }
  }
}

// soft ellipses, additive into one channel ('r' | 'g' | 'b')
function blobs(ctx, list, ch) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const rgb = ch === 'r' ? '255,0,0' : ch === 'g' ? '0,255,0' : '0,0,255';
  for (const [lo, la, rx, ry, s] of list) {
    for (const off of [-TEX_W, 0, TEX_W]) {
      ctx.save();
      ctx.translate(px(lo) + off, py(la));
      ctx.scale((rx / 360) * TEX_W, (ry / 180) * TEX_H);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, `rgba(${rgb},${s})`);
      g.addColorStop(0.55, `rgba(${rgb},${s * 0.8})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
    }
  }
  ctx.restore();
}

// progressive 2× downsample = a cheap, browser-proof box blur
function downsample(canvas, levels) {
  let src = canvas;
  for (let i = 0; i < levels; i++) {
    const w = Math.max(1, src.width >> 1);
    const h = Math.max(1, src.height >> 1);
    const { c, ctx } = makeCanvas(w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(src, 0, 0, w, h);
    src = c;
  }
  const img = src.getContext('2d').getImageData(0, 0, src.width, src.height);
  return { w: src.width, h: src.height, d: img.data };
}
function sampleR(s, u, v) {
  const x = u * s.w - 0.5;
  const y = v * s.h - 0.5;
  const x0 = Math.floor(x);
  const y0 = Math.max(0, Math.min(s.h - 1, Math.floor(y)));
  const y1 = Math.min(s.h - 1, y0 + 1);
  const fx = x - x0;
  const fy = clamp01(y - y0);
  const xi = (i) => ((i % s.w) + s.w) % s.w;
  const at = (xx, yy) => s.d[(yy * s.w + xi(xx)) * 4] / 255;
  const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * fx;
  const b = at(x0, y1) + (at(x0 + 1, y1) - at(x0, y1)) * fx;
  return a + (b - a) * fy;
}

const mix3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

function bakeEarth() {
  const land = makeCanvas(TEX_W, TEX_H);
  fillPolys(land.ctx, LAND, '#ff0000');
  fillPolys(land.ctx, [ANTARCTICA], '#ff0000');
  fillPolys(land.ctx, SEAS, '#000000');
  // ice sheets in green, on top of their land
  land.ctx.save();
  land.ctx.globalCompositeOperation = 'lighter';
  fillPolys(land.ctx, [LAND[5], ANTARCTICA], '#00ff00');
  land.ctx.restore();

  const reg = makeCanvas(TEX_W, TEX_H);
  blobs(reg.ctx, DESERTS, 'r');
  blobs(reg.ctx, HIGHLANDS, 'g');
  blobs(reg.ctx, MONSOON, 'b');
  const reg2 = makeCanvas(TEX_W, TEX_H);
  blobs(reg2.ctx, HEAT, 'r');

  const shelf = downsample(land.c, 3); // ~8 px blur
  const cont = downsample(land.c, 6); // ~64 px blur: distance from the sea

  const L = land.ctx.getImageData(0, 0, TEX_W, TEX_H).data;
  const G = reg.ctx.getImageData(0, 0, TEX_W, TEX_H).data;
  const G2 = reg2.ctx.getImageData(0, 0, TEX_W, TEX_H).data;

  const alb = new Uint8Array(TEX_W * TEX_H * 4);
  const dat = new Uint8Array(TEX_W * TEX_H * 4);
  const dat2 = new Uint8Array(TEX_W * TEX_H * 4);

  const TROP = [34, 74, 30];
  const TEMP = [72, 100, 50];
  const BOREAL = [40, 62, 38];
  const TUNDRA = [104, 100, 80];
  const SAV = [142, 132, 76];
  const SAND = [196, 160, 106];
  const ROCK = [112, 98, 82];
  const ICE = [236, 241, 247];
  const DEEP = [7, 28, 60];
  const MID = [12, 52, 98];
  const SHELF = [28, 92, 126];
  const POLAR = [22, 42, 62];

  for (let y = 0; y < TEX_H; y++) {
    const v = (y + 0.5) / TEX_H;
    const lat = 90 - v * 180;
    const a = Math.abs(lat);
    // DataTexture row 0 is the SOUTH edge (uv.y = 0); canvases start north
    const row = TEX_H - 1 - y;
    for (let x = 0; x < TEX_W; x++) {
      const u = (x + 0.5) / TEX_W;
      const i = (y * TEX_W + x) * 4;
      const o = (row * TEX_W + x) * 4;
      const ld = L[i] / 255;
      const ice = L[i + 1] / 255;
      const n1 = vnoise(u * 24, v * 12, 24, 7);
      const n2 = vnoise(u * 96, v * 48, 96, 19);
      const n3 = vnoise(u * 48, v * 24, 48, 31);
      // break the soft ellipses into ragged, natural edges
      const n4 = vnoise(u * 192, v * 96, 192, 43);
      const wob = (n1 - 0.5) * 0.55 + (n3 - 0.5) * 0.6 + (n2 - 0.5) * 0.45 + (n4 - 0.5) * 0.25;
      const g0 = G[i] / 255;
      const des = smooth((g0 * 1.2 - 0.45 + wob * 1.6) / 0.5) * smooth(g0 / 0.25);
      // mountains are ragged ridges, not domes
      const ridge = 1 - Math.abs(2 * n2 - 1);
      const elev = clamp01((G[i + 1] / 255) * (0.25 + 0.75 * ridge + 0.4 * (n3 - 0.5)) * 1.25);
      const mon = G[i + 2] / 255;
      const heat = clamp01((G2[i] / 255) * (0.85 + 0.3 * n1));
      const nn = 0.82 + 0.26 * n1 + 0.14 * n2;

      let c;
      if (ld > 0.5) {
        let g = TROP;
        g = mix3(g, TEMP, smooth((a - 14) / 18));
        g = mix3(g, BOREAL, smooth((a - 48) / 8));
        g = mix3(g, TUNDRA, smooth((a - 63) / 6));
        g = mix3(g, SAV, smooth(des / 0.5) * 0.85);
        const sand = mix3(SAND, [182, 128, 86], smooth((n3 - 0.45) / 0.3) * 0.5);
        g = mix3(g, sand, smooth((des - 0.3) / 0.6) * (0.85 + 0.15 * n4));
        g = mix3(g, ROCK, elev * 0.55);
        c = g.map((k) => k * nn);
        if (ice > 0.5) c = ICE.map((k) => k * (0.94 + 0.08 * n2));
      } else {
        const sh = sampleR(shelf, u, v);
        let w = mix3(DEEP, MID, 0.5 + 0.5 * (n1 - 0.5));
        w = mix3(w, SHELF, smooth((sh - 0.12) / 0.5) * 0.85);
        w = mix3(w, POLAR, smooth((a - 55) / 15) * 0.6);
        c = w;
      }
      alb[o] = Math.min(255, c[0]);
      alb[o + 1] = Math.min(255, c[1]);
      alb[o + 2] = Math.min(255, c[2]);
      alb[o + 3] = 255;
      dat[o] = L[i];
      dat[o + 1] = G[i + 1];
      dat[o + 2] = G[i + 2];
      dat[o + 3] = L[i + 1];
      dat2[o] = 255 * sampleR(cont, u, v);
      dat2[o + 1] = 255 * des;
      dat2[o + 2] = 255 * heat * (mon > 0.05 || des > 0.5 ? 1 : 0.4);
      dat2[o + 3] = 255;
    }
  }

  const mk = (arr, srgb) => {
    const t = new THREE.DataTexture(arr, TEX_W, TEX_H, THREE.RGBAFormat);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  };
  return { map: mk(alb, true), data: mk(dat, false), data2: mk(dat2, false) };
}

// ---------------------------------------------------------------------------
// shaders
// ---------------------------------------------------------------------------
const NOISE_GLSL = /* glsl */ `
vec3 hash33(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
           dot(p, vec3(269.5, 183.3, 246.1)),
           dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453);
}
float vnoise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n = 0.0;
  for (int dx = 0; dx < 2; dx++)
  for (int dy = 0; dy < 2; dy++)
  for (int dz = 0; dz < 2; dz++) {
    vec3 o = vec3(float(dx), float(dy), float(dz));
    vec3 w = mix(1.0 - f, f, o);
    n += hash33(i + o).x * w.x * w.y * w.z;
  }
  return n;
}
float fbm3(vec3 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    s += a * vnoise3(p);
    p = p * 2.03 + 11.7;
    a *= 0.5;
  }
  return s / 0.96875;
}
`;

const BODY_VERT = /* glsl */ `
varying vec3 vWP;
varying vec3 vWN;
varying vec3 vObj;
varying vec2 vUv;
void main() {
  vUv = uv;
  vObj = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  vWN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const EARTH_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform sampler2D uData;
uniform sampler2D uData2;
uniform vec3 uSunPos;
uniform float uSnowN;
uniform float uSnowS;
uniform float uIceN;
uniform float uIceS;
uniform float uDry;
uniform float uHeat;
uniform float uFoot;
uniform vec3 uBeamP;
uniform vec3 uBeamU;
uniform vec3 uBeamV;
uniform float uBeamHalf;
varying vec3 vWP;
varying vec3 vWN;
varying vec3 vObj;
varying vec2 vUv;
${NOISE_GLSL}
void main() {
  vec3 N = normalize(vWN);
  vec3 L = normalize(uSunPos - vWP);
  vec3 V = normalize(cameraPosition - vWP);
  vec3 alb = texture2D(uMap, vUv).rgb;
  vec4 dA = texture2D(uData, vUv);  // land, highland, monsoon, ice sheet
  vec4 dB = texture2D(uData2, vUv); // continentality, desert, heat
  float land = smoothstep(0.35, 0.65, dA.r);
  vec3 o = normalize(vObj);
  float lat = degrees(asin(clamp(o.y, -1.0, 1.0)));

  // the monsoon's vegetation: brown before the rains, green after
  float dry = dA.b * uDry * (1.0 - dB.g) * land;
  alb = mix(alb, vec3(0.27, 0.19, 0.09), dry * 0.8);

  // snow: land whose effective latitude (raised by altitude and by distance
  // from the sea) is past the season's snow line
  float jit = (vnoise3(o * 9.0) - 0.5) * 7.0 + (vnoise3(o * 27.0) - 0.5) * 5.0 + (vnoise3(o * 70.0) - 0.5) * 3.0;
  // snow climbs the ridges first: ridged noise turns highland snow into ranges
  float rel = mix(vnoise3(o * 14.0), 1.0 - abs(2.0 * vnoise3(o * 38.0) - 1.0), 0.45);
  float eff = dA.g * 20.0 * (0.45 + 0.65 * rel) + (dB.r - 0.5) * 12.0 + jit;
  float sn = smoothstep(uSnowN - 2.5, uSnowN + 2.5, lat + eff);
  float ss = smoothstep(uSnowS - 2.5, uSnowS + 2.5, -lat + eff);
  float snPatch = mix(0.7, 1.0, vnoise3(o * 85.0));
  float snow = max(sn, ss) * land * (1.0 - 0.6 * dB.g) * snPatch;
  snow = max(snow, dA.a * land);

  // fine relief on bare ground, so the land holds up close
  float det = vnoise3(o * 55.0) * 0.6 + vnoise3(o * 140.0) * 0.4;
  alb *= mix(1.0, 0.8 + 0.42 * det, land * (1.0 - snow));
  alb = mix(alb, vec3(0.84, 0.88, 0.94), snow);

  // sea ice: polar oceans freeze over in winter, enclosed seas first
  float sj = (vnoise3(o * 14.0) - 0.5) * 6.0 + (vnoise3(o * 42.0) - 0.5) * 2.5;
  float seff = (dB.r - 0.3) * 14.0 + sj;
  float sice = clamp(smoothstep(uIceN - 1.5, uIceN + 1.5, lat + seff) + smoothstep(uIceS - 1.5, uIceS + 1.5, -lat + seff), 0.0, 1.0);
  sice *= 1.0 - land;
  alb = mix(alb, vec3(0.6, 0.68, 0.76) * (0.9 + 0.2 * det), sice * 0.9);

  // pre-monsoon heat over the subcontinent
  float heat = dB.b * uHeat * land;
  alb = mix(alb, vec3(0.6, 0.17, 0.04), heat * 0.6);

  float ndl = dot(N, L);
  float lit = smoothstep(-0.02, 0.12, ndl) * (0.1 + 0.9 * max(ndl, 0.0));
  vec3 col = alb * lit * 1.35 + alb * vec3(0.012, 0.014, 0.022);
  col += vec3(1.0, 0.3, 0.05) * heat * 0.22 * smoothstep(-0.1, 0.25, ndl);

  float ocean = (1.0 - land) * (1.0 - sice);
  vec3 H = normalize(L + V);
  col += vec3(1.0, 0.92, 0.78) * pow(max(dot(N, H), 0.0), 80.0) * 0.5 * ocean * step(0.0, ndl);

  // a square beam of sunlight: the footprint is the exact intersection of
  // the beam (a prism along the Sun direction) with the sphere
  if (uFoot > 0.001) {
    vec3 d = vWP - uBeamP;
    float m = max(abs(dot(d, uBeamU)), abs(dot(d, uBeamV))) / uBeamHalf;
    float inside = (1.0 - smoothstep(0.97, 1.0, m)) * step(0.0, ndl);
    float edge = inside * smoothstep(0.84, 0.97, m);
    col = mix(col, col * 0.25 + vec3(1.0, 0.68, 0.18) * 1.1, inside * 0.85 * uFoot);
    col += vec3(1.0, 0.85, 0.5) * edge * 1.1 * uFoot;
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const CLOUD_FRAG = /* glsl */ `
uniform vec3 uSunPos;
uniform float uItczBase;
uniform float uItczAsia;
uniform float uRain;
uniform float uAlpha;
varying vec3 vWP;
varying vec3 vWN;
varying vec3 vObj;
varying vec2 vUv;
${NOISE_GLSL}
void main() {
  vec3 o = normalize(vObj);
  float lat = degrees(asin(clamp(o.y, -1.0, 1.0)));
  float lon = degrees(atan(-o.z, o.x));
  // stretched along the latitude lines (winds blow east-west) and warped
  vec3 q = o * vec3(3.2, 6.4, 3.2);
  q += 0.9 * vec3(vnoise3(o * 4.0 + 1.3), vnoise3(o * 4.0 + 7.1), vnoise3(o * 4.0 + 3.7));
  float n = fbm3(q + 2.0);
  float n2 = vnoise3(o * vec3(16.0, 30.0, 16.0) + 5.0);
  float al = abs(lat);
  // climatology: stormy mid-latitudes, clear subtropical deserts
  float clim = 0.06 * exp(-pow((al - 56.0) / 12.0, 2.0)) - 0.12 * exp(-pow((al - 24.0) / 9.0, 2.0));
  float dl = mod(lon - 84.0 + 180.0, 360.0) - 180.0;
  float wA = exp(-pow(dl / 30.0, 2.0));
  float itcz = mix(uItczBase, uItczAsia, wA);
  float wid = mix(5.5, 9.0, wA);
  float band = exp(-pow((lat - itcz) / wid, 2.0));
  float dens = n * 0.85 + n2 * 0.15 + clim + band * (0.12 + 0.38 * wA * uRain);
  float c = smoothstep(0.5, 0.8, dens);
  c *= c * (3.0 - 2.0 * c);
  vec3 N = normalize(vWN);
  vec3 L = normalize(uSunPos - vWP);
  float ndl = dot(N, L);
  float lit = smoothstep(-0.05, 0.22, ndl) * (0.25 + 0.75 * max(ndl, 0.0));
  vec3 col = vec3(1.0, 0.99, 0.97) * (0.01 + 1.05 * lit);
  gl_FragColor = vec4(col, c * 0.85 * uAlpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const AIR_FRAG = /* glsl */ `
uniform vec3 uSunPos;
uniform float uK;
varying vec3 vWP;
varying vec3 vWN;
varying vec3 vObj;
varying vec2 vUv;
void main() {
  vec3 N = normalize(vWN);
  vec3 V = normalize(cameraPosition - vWP);
  vec3 L = normalize(uSunPos - vWP);
  float f = pow(1.0 - max(dot(N, V), 0.0), 2.4);
  float lit = smoothstep(-0.3, 0.4, dot(N, L));
  gl_FragColor = vec4(vec3(0.3, 0.56, 1.0) * f * lit * uK, 1.0);
}
`;

// latitude circles: split into a gold day arc and a blue night arc by the
// true terminator, or drawn plain (optionally dashed)
const RING_VERT = /* glsl */ `
varying vec3 vWP;
varying float vAng;
void main() {
  vAng = atan(position.y, position.x);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const RING_FRAG = /* glsl */ `
uniform vec3 uSunPos;
uniform vec3 uC;
uniform vec3 uDay;
uniform vec3 uNight;
uniform vec3 uPlain;
uniform float uSplit;
uniform float uDash;
uniform float uOpacity;
varying vec3 vWP;
varying float vAng;
void main() {
  vec3 n = normalize(vWP - uC);
  float l = dot(n, normalize(uSunPos - vWP));
  vec3 split = mix(uNight, uDay, smoothstep(-0.006, 0.006, l));
  vec3 col = mix(uPlain, split, uSplit);
  float a = uOpacity;
  if (uDash > 0.5) a *= step(0.42, fract(vAng * 40.0 / 6.2831853));
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// stars and a faint Milky Way, on a dome that follows the camera
const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const SKY_FRAG = /* glsl */ `
varying vec3 vDir;
${NOISE_GLSL}
vec3 starLayer(vec3 d, float scale, float density, float bright) {
  vec3 q = d * scale;
  vec3 c = floor(q);
  vec3 f = q - c;
  vec3 h = hash33(c + 17.0);
  if (h.x > density) return vec3(0.0);
  vec3 sp = vec3(0.25) + 0.5 * h;
  float s = smoothstep(0.19, 0.0, length(f - sp));
  float mag = pow(fract(h.y * 7.31), 3.0);
  vec3 tint = mix(vec3(0.74, 0.83, 1.0), vec3(1.0, 0.87, 0.68), h.z);
  return tint * s * s * mag * bright;
}
void main() {
  vec3 d = normalize(vDir);
  vec3 col = vec3(0.0035, 0.0045, 0.009);
  vec3 bandN = normalize(vec3(0.3, 0.8, -0.52));
  float b = dot(d, bandN);
  float band = exp(-(b * b) / (2.0 * 0.11 * 0.11));
  float mottle = vnoise3(d * 14.0) * 0.5 + vnoise3(d * 38.0) * 0.3 + vnoise3(d * 90.0) * 0.2;
  col += vec3(0.03, 0.036, 0.06) * band * (0.12 + 0.88 * mottle);
  col += starLayer(d, 120.0, 0.05, 2.0) + starLayer(d, 260.0, 0.034, 1.0) + starLayer(d, 540.0, 0.024, 0.5);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

function glowTexture() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,236,190,1)');
  g.addColorStop(0.18, 'rgba(255,214,140,0.55)');
  g.addColorStop(0.45, 'rgba(255,170,80,0.14)');
  g.addColorStop(1, 'rgba(255,150,60,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// GTAO renders a depth/normal prepass with scene.overrideMaterial, which draws
// every mesh as an opaque surface — including transparent shells and the
// camera-facing glow quads. Emptying the draw range for that prepass only,
// from the mesh's own hooks, keeps this out of stage.js (see solar-eclipse).
function skipInPrepass(mesh) {
  const before = mesh.onBeforeRender;
  mesh.onBeforeRender = function (r, sc, c, geo, mat, grp) {
    before.call(this, r, sc, c, geo, mat, grp);
    if (sc.overrideMaterial) {
      this.userData.savedRange = [geo.drawRange.start, geo.drawRange.count];
      geo.setDrawRange(0, 0);
    }
  };
  mesh.onAfterRender = function (r, sc, c, geo) {
    const d = this.userData.savedRange;
    if (d) {
      geo.setDrawRange(d[0], d[1]);
      this.userData.savedRange = null;
    }
  };
}

// ---------------------------------------------------------------------------
// monsoon wind paths, [lon, lat] — wet south-westerlies in summer (the
// Arabian Sea branch crosses the equator off Somalia), dry north-easterlies
// blowing off the land in winter
// ---------------------------------------------------------------------------
const WIND_SW = [
  [[72,-20],[62,-14],[52,-8],[45,-3],[45,2],[49,7],[55,10],[62,12.5],[68,14],[73.8,15]],
  [[80,-18],[70,-12],[60,-5],[55,0],[58,5],[64,8],[70,10],[75.6,11]],
  [[66,-17],[56,-10],[49,-4],[47,3],[52,8],[60,13],[66,17],[72.4,19.6]],
  [[92,-14],[84,-7],[80,-1],[82,5],[86,11],[89.5,17],[90,22],[87.5,25],[83,26.8],[79,28]],
];
const WIND_NE = [
  [[82,30],[78,24],[74,18],[70,12],[65,6],[58,0]],
  [[95,24],[90,19],[86,14],[82,9],[78,4],[74,-1]],
  [[88,27],[84,22],[80,16],[76,10],[70,4],[64,-2]],
  [[100,20],[95,14],[91,9],[86,4],[80,-1]],
];
const PACKETS = 5;
const TRAIL = 3;

// ---------------------------------------------------------------------------
export function buildSeasons({ scene, stage }) {
  const disposables = [];
  const track = (x) => {
    disposables.push(x);
    return x;
  };

  // --- star dome (scene, not root: the hero bob moves the root) ---
  const sky = new THREE.Mesh(
    track(new THREE.SphereGeometry(80, 48, 32)),
    track(
      new THREE.ShaderMaterial({
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        side: THREE.BackSide,
        depthTest: false,
        depthWrite: false,
      }),
    ),
  );
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  sky.onBeforeRender = (r, s, cam) => {
    sky.position.copy(cam.position);
    sky.updateMatrixWorld();
  };
  scene.add(sky);

  const root = new THREE.Group();
  scene.add(root);
  const labels = calloutSets(['hero', 'orbit', 'lean', 'beam', 'day', 'equinox', 'monsoon', 'snow', 'finale']);

  // --- Earth ---------------------------------------------------------------
  const tex = bakeEarth();
  for (const t of Object.values(tex)) track(t);
  const sunPos = new THREE.Vector3(1e4, 0, 0); // world, shared by every shader
  const earthC = new THREE.Vector3();

  const earthU = {
    uMap: { value: tex.map },
    uData: { value: tex.data },
    uData2: { value: tex.data2 },
    uSunPos: { value: sunPos },
    uSnowN: { value: 60 },
    uSnowS: { value: 60 },
    uIceN: { value: 75 },
    uIceS: { value: 65 },
    uDry: { value: 0 },
    uHeat: { value: 0 },
    uFoot: { value: 0 },
    uBeamP: { value: new THREE.Vector3() },
    uBeamU: { value: new THREE.Vector3() },
    uBeamV: { value: new THREE.Vector3() },
    uBeamHalf: { value: 0.08 },
  };
  const earthMat = track(new THREE.ShaderMaterial({ uniforms: earthU, vertexShader: BODY_VERT, fragmentShader: EARTH_FRAG }));

  const rig = new THREE.Group(); // position + scale (orbit vs globe)
  root.add(rig);
  const body = new THREE.Group(); // orientation: axis + daily spin
  rig.add(body);
  const earth = new THREE.Mesh(track(new THREE.SphereGeometry(R, 160, 112)), earthMat);
  body.add(earth);

  const cloudU = {
    uSunPos: { value: sunPos },
    uItczBase: { value: 5 },
    uItczAsia: { value: 5 },
    uRain: { value: 0 },
    uAlpha: { value: 1 },
  };
  const clouds = new THREE.Mesh(
    track(new THREE.SphereGeometry(R * 1.009, 128, 96)),
    track(
      new THREE.ShaderMaterial({
        uniforms: cloudU,
        vertexShader: BODY_VERT,
        fragmentShader: CLOUD_FRAG,
        transparent: true,
        depthWrite: false,
      }),
    ),
  );
  clouds.renderOrder = 2;
  body.add(clouds);

  const airU = { uSunPos: { value: sunPos }, uK: { value: 1.1 } };
  const air = new THREE.Mesh(
    track(new THREE.SphereGeometry(R * 1.035, 96, 64)),
    track(
      new THREE.ShaderMaterial({
        uniforms: airU,
        vertexShader: BODY_VERT,
        fragmentShader: AIR_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ),
  );
  air.renderOrder = 3;
  body.add(air);

  // axis: a thin rod through the poles, as on a desk globe
  const axisMat = track(new THREE.MeshStandardMaterial({ color: 0xd9dde4, metalness: 0.6, roughness: 0.35 }));
  const axisRod = new THREE.Mesh(track(new THREE.CylinderGeometry(0.011, 0.011, R * 2.7, 16)), axisMat);
  body.add(axisRod);
  const capGeo = track(new THREE.SphereGeometry(0.022, 16, 12));
  const capN = new THREE.Mesh(capGeo, axisMat);
  capN.position.y = R * 1.35;
  const capS = new THREE.Mesh(capGeo, axisMat);
  capS.position.y = -R * 1.35;
  axisRod.add(capN, capS);
  const aAxisTip = new THREE.Object3D();
  aAxisTip.position.set(0, R * 1.35, 0);
  body.add(aAxisTip);

  // latitude circles
  const rings = {};
  function ring(key, latDeg, plain, dash) {
    const phi = deg(latDeg);
    const k = 1.016;
    const u = {
      uSunPos: { value: sunPos },
      uC: { value: earthC },
      uDay: { value: new THREE.Color(1.25, 0.72, 0.12) },
      uNight: { value: new THREE.Color(0.12, 0.32, 1.1) },
      uPlain: { value: new THREE.Color(plain) },
      uSplit: { value: 0 },
      uDash: { value: dash ? 1 : 0 },
      uOpacity: { value: 0.9 },
    };
    const m = new THREE.Mesh(
      track(new THREE.TorusGeometry(R * Math.cos(phi) * k, 0.0095, 8, 320)),
      track(
        new THREE.ShaderMaterial({
          uniforms: u,
          vertexShader: RING_VERT,
          fragmentShader: RING_FRAG,
          transparent: true,
          depthWrite: false,
        }),
      ),
    );
    m.rotation.x = PI / 2;
    m.position.y = R * Math.sin(phi) * k;
    m.renderOrder = 4;
    body.add(m);
    rings[key] = { mesh: m, u, lat: latDeg };
    return m;
  }
  ring('equator', 0, 0xe8ecf2, false);
  ring('cancer', 23.44, 0xffd27a, true);
  ring('capricorn', -23.44, 0xffd27a, true);
  ring('arctic', 66.56, 0xbfe0ff, true);
  ring('lat45', LAT45, 0xffc04d, false);

  // a city on 45° N (Milan) — rides the 45° circle through day and night
  const cityMat = track(new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.2, 1.5) }));
  const city = new THREE.Mesh(track(new THREE.SphereGeometry(0.03, 16, 12)), cityMat);
  LL(LAT45, MILAN_LON, city.position).multiplyScalar(R * 1.018);
  body.add(city);

  // --- monsoon winds: instanced streaks riding body-frame curves ----------
  function windSet(paths, color) {
    const curves = paths.map(
      (p) => new THREE.CatmullRomCurve3(p.map(([lo, la]) => LL(la, lo, new THREE.Vector3())), false, 'centripetal'),
    );
    const mat = track(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }));
    const geo = track(new THREE.SphereGeometry(1, 10, 6));
    const mesh = new THREE.InstancedMesh(geo, mat, paths.length * PACKETS * TRAIL);
    mesh.frustumCulled = false;
    mesh.renderOrder = 5;
    body.add(mesh);
    return { curves, mesh, mat };
  }
  const windWet = windSet(WIND_SW, new THREE.Color(0.62, 0.9, 1.25));
  const windDry = windSet(WIND_NE, new THREE.Color(1.2, 0.86, 0.5));
  const dummy = new THREE.Object3D();
  const vX = new THREE.Vector3(1, 0, 0);
  const tP = new THREE.Vector3();
  const tT = new THREE.Vector3();
  function poseWind(set, flow, weight) {
    set.mat.opacity = 0.9 * weight;
    set.mesh.visible = weight > 0.004;
    let k = 0;
    set.curves.forEach((cv, ci) => {
      for (let p = 0; p < PACKETS; p++) {
        const u0 = wrap1(flow + p / PACKETS + ci * 0.13);
        for (let j = 0; j < TRAIL; j++) {
          const u = clamp01(u0 - j * 0.03);
          cv.getPointAt(u, tP).normalize();
          cv.getTangentAt(u, tT);
          tT.addScaledVector(tP, -tT.dot(tP)).normalize();
          const fade = smooth(u / 0.12) * smooth((1 - u) / 0.12) * weight;
          const s = (1 - j * 0.3) * fade;
          dummy.position.copy(tP).multiplyScalar(R * 1.03);
          dummy.quaternion.setFromUnitVectors(vX, tT);
          dummy.scale.set(0.055 * s + 1e-4, 0.0055 * s + 1e-4, 0.0055 * s + 1e-4);
          dummy.updateMatrix();
          set.mesh.setMatrixAt(k++, dummy.matrix);
        }
      }
    });
    set.mesh.instanceMatrix.needsUpdate = true;
  }

  // --- overhead-Sun marker (world-placed: it belongs to the Sun, not Earth)
  const glowMap = track(glowTexture());
  const subDot = new THREE.Mesh(
    track(new THREE.SphereGeometry(0.032, 16, 12)),
    track(new THREE.MeshBasicMaterial({ color: new THREE.Color(2.8, 2.3, 1.2) })),
  );
  root.add(subDot);
  const subGlow = new THREE.Mesh(
    track(new THREE.PlaneGeometry(0.52, 0.52)),
    track(
      new THREE.MeshBasicMaterial({
        map: glowMap,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        color: 0xffd58a,
      }),
    ),
  );
  subGlow.renderOrder = 6;
  root.add(subGlow);
  const aSub = new THREE.Object3D();
  root.add(aSub);

  // --- the sunbeam: 5×5 parallel rays and the square they start from ------
  const BEAM_HALF = R * 0.07;
  const BEAM_LEN = R * 1.3;
  const NR = 5;
  const rayPos = new Float32Array(NR * NR * 2 * 3);
  const rayGeo = track(new THREE.BufferGeometry());
  rayGeo.setAttribute('position', new THREE.BufferAttribute(rayPos, 3));
  const rays = new THREE.LineSegments(
    rayGeo,
    track(new THREE.LineBasicMaterial({ color: new THREE.Color(1.6, 1.15, 0.45), transparent: true, opacity: 0.75 })),
  );
  rays.frustumCulled = false;
  root.add(rays);
  const sqPos = new Float32Array(4 * 3);
  const sqGeo = track(new THREE.BufferGeometry());
  sqGeo.setAttribute('position', new THREE.BufferAttribute(sqPos, 3));
  const square = new THREE.LineLoop(sqGeo, track(new THREE.LineBasicMaterial({ color: new THREE.Color(1.8, 1.3, 0.5) })));
  square.frustumCulled = false;
  root.add(square);
  const sqFill = new THREE.Mesh(
    track(new THREE.PlaneGeometry(1, 1)),
    track(
      new THREE.MeshBasicMaterial({
        color: 0xffc04d,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    ),
  );
  root.add(sqFill);
  const aBeamSq = new THREE.Object3D();
  const aFoot = new THREE.Object3D();
  root.add(aBeamSq, aFoot);

  // --- orbit view: Sun, orbit, monthly axis sticks ------------------------
  const orbit = new THREE.Group();
  root.add(orbit);
  const sunMat = track(new THREE.MeshBasicMaterial({ color: new THREE.Color(2.3, 1.58, 0.74) }));
  const sun = new THREE.Mesh(track(new THREE.SphereGeometry(SUN_R, 64, 48)), sunMat);
  orbit.add(sun);
  const sunGlow = new THREE.Mesh(
    track(new THREE.PlaneGeometry(SUN_R * 5, SUN_R * 5)),
    track(
      new THREE.MeshBasicMaterial({
        map: glowMap,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ),
  );
  sunGlow.renderOrder = 6;
  orbit.add(sunGlow);
  const aSun = new THREE.Object3D();
  aSun.position.set(0, SUN_R * 0.9, 0);
  orbit.add(aSun);

  const orbitPos = (nu, out = new THREE.Vector3()) => {
    const rho = (1 - ECC * ECC) / (1 + ECC * Math.cos(nu));
    const lam = nu + PERI_LON;
    return out.set(Math.cos(lam), 0, -Math.sin(lam)).multiplyScalar(ORBIT_A * rho);
  };
  const ringPts = [];
  for (let i = 0; i < 360; i++) ringPts.push(orbitPos((i / 360) * TAU));
  const orbitTube = new THREE.Mesh(
    track(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ringPts, true), 480, 0.018, 8, true)),
    track(new THREE.MeshBasicMaterial({ color: 0xffd58a, transparent: true, opacity: 0.4, depthWrite: false })),
  );
  orbit.add(orbitTube);

  // axis fixed in space: north end leans toward the Sun at the June solstice
  const AXIS_H = new THREE.Vector3(0, Math.cos(EPS), -Math.sin(EPS));
  const stickMat = track(
    new THREE.MeshBasicMaterial({ color: 0x4f9dff, transparent: true, opacity: 0.9, depthWrite: false }),
  );
  const stickGeo = track(new THREE.CylinderGeometry(0.018, 0.018, 1.25, 8));
  const dotGeo = track(new THREE.SphereGeometry(0.045, 12, 8));
  const dotMat = track(new THREE.MeshBasicMaterial({ color: 0xffd58a }));
  const qAxis = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), AXIS_H);
  for (let m = 0; m < 12; m++) {
    const g = sunGeom((m * 30.44 + 20) / YEAR);
    const p = orbitPos(g.nu);
    const stick = new THREE.Mesh(stickGeo, stickMat);
    stick.position.copy(p);
    stick.quaternion.copy(qAxis);
    orbit.add(stick);
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.copy(p);
    orbit.add(dot);
  }
  // perihelion / aphelion markers
  const markMat = track(new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.3, 0.55) }));
  const markGeo = track(new THREE.OctahedronGeometry(0.11));
  const peri = new THREE.Mesh(markGeo, markMat);
  orbitPos(0, peri.position);
  const aph = new THREE.Mesh(markGeo, markMat);
  orbitPos(PI, aph.position);
  orbit.add(peri, aph);
  // the Sun–Earth line
  const lineMat = track(
    new THREE.MeshBasicMaterial({ color: 0xffd58a, transparent: true, opacity: 0.35, depthWrite: false }),
  );
  const sunLine = new THREE.Mesh(track(new THREE.CylinderGeometry(0.008, 0.008, 1, 6)), lineMat);
  orbit.add(sunLine);

  // every see-through piece (orbit sticks, tube, glow, line, shells, rings)
  for (const o of [clouds, air, subGlow, sqFill, windWet.mesh, windDry.mesh]) skipInPrepass(o);
  for (const r of Object.values(rings)) skipInPrepass(r.mesh);
  orbit.traverse((o) => {
    if (o.isMesh && o.material.transparent) skipInPrepass(o);
  });

  // --- callouts --------------------------------------------------------------
  const L = {};
  const anchorAt = (parent, latDeg, lonDeg, k = 1.02) => {
    const a = new THREE.Object3D();
    LL(latDeg, lonDeg, a.position).multiplyScalar(R * k);
    parent.add(a);
    return a;
  };
  // ring anchors re-placed each frame at the ring's camera-facing side
  const ringAnchors = [];
  const ringAnchor = (key, az) => {
    const a = new THREE.Object3D();
    root.add(a);
    ringAnchors.push({ a, key, az: deg(az) });
    return a;
  };

  labels.add('hero', aAxisTip, "Earth's axis · tilted 23.4°", [0, 0, 0], 28, 70);

  const aPeri = new THREE.Object3D();
  aPeri.position.copy(peri.position);
  const aAph = new THREE.Object3D();
  aAph.position.copy(aph.position);
  orbit.add(aPeri, aAph);
  L.sun = labels.add('orbit', aSun, 'Sun', [0, 0, 0], 140, 56);
  labels.add('orbit', aPeri, 'Closest · 3 Jan · 147.1 million km', [0, 0, 0], 40, 60);
  labels.add('orbit', aAph, 'Farthest · 4 Jul · 152.1 million km', [0, 0, 0], -30, 56);
  labels.add('orbit', aAxisTip, 'Axis · always aims at the Pole Star', [0, 0, 0], 62, 60);

  labels.add('lean', aAxisTip, 'Axis · tilted 23.4°', [0, 0, 0], 30, 64);
  L.subLean = labels.add('lean', aSub, 'Sun overhead', [0, 0, 0], 8, 70);
  labels.add('lean', ringAnchor('cancer', 12), 'Tropic of Cancer · 23.4° N', [0, 0, 0], 62, 64);
  labels.add('lean', ringAnchor('capricorn', 12), 'Tropic of Capricorn · 23.4° S', [0, 0, 0], -62, 64);

  L.beamSq = labels.add('beam', aBeamSq, 'Same sunlight, every day', [0, 0, 0], 95, 46);
  L.foot = labels.add('beam', aFoot, 'Noon Sun', [0, 0, 0], -22, 140);
  labels.add('beam', ringAnchor('lat45', 40), '45° N', [0, 0, 0], 120, 54);

  L.day45 = labels.add('day', ringAnchor('lat45', 38), '45° N', [0, 0, 0], -20, 60);
  L.dayArc = labels.add('day', ringAnchor('arctic', 40), 'Arctic Circle', [0, 0, 0], 30, 60);

  L.subEq = labels.add('equinox', aSub, 'Sun overhead', [0, 0, 0], 8, 70);
  labels.add('equinox', aAxisTip, 'Day/night line · through both poles', [0, 0, 0], 40, 56);
  L.eq45 = labels.add('equinox', ringAnchor('lat45', 15), '45° N', [0, 0, 0], 55, 60);
  L.eqEq = labels.add('equinox', ringAnchor('equator', 5), 'Equator', [0, 0, 0], -55, 70);

  const aHeat = anchorAt(body, 24, 77);
  const aWind = anchorAt(body, 9, 62, 1.03);
  const aBelt = anchorAt(body, 10, 86, 1.012);
  L.subMon = labels.add('monsoon', aSub, 'Sun overhead', [0, 0, 0], 20, 60);
  labels.add('monsoon', aHeat, 'Land heats first · April–May', [0, 0, 0], 130, 54);
  L.wind = labels.add('monsoon', aWind, 'Monsoon winds', [0, 0, 0], -40, 70);
  labels.add('monsoon', aBelt, 'Rain belt', [0, 0, 0], -25, 64);

  const aSnow = anchorAt(body, 55, 60);
  const aGreen = anchorAt(body, 74, -40);
  labels.add('snow', aSnow, 'Snow line', [0, 0, 0], -20, 60);
  L.snowArc = labels.add('snow', ringAnchor('arctic', 35), 'Arctic Circle', [0, 0, 0], 30, 56);
  labels.add('snow', aGreen, 'Greenland · white all year', [0, 0, 0], 75, 60);

  labels.add('finale', aAxisTip, 'One lean · 23.4°', [0, 0, 0], 30, 64);

  const textCache = new Map();
  const setText = (c, s) => {
    if (textCache.get(c) !== s) {
      textCache.set(c, s);
      c.setText(s);
    }
  };

  // --- pose ------------------------------------------------------------------
  const S = {
    view: 'globe', // 'globe' | 'orbit'
    frame: 'sun', // 'sun' | 'fixed'  (globe view only)
    t: 0.47,
    hour: 0, // hour angle at lonRef, radians (0 = local noon)
    lonRef: MILAN_LON,
    tilt: 0, // fixed frame: north pole tipped toward the camera, degrees
    flow: 0,
    axis: 1,
    equator: 0,
    cancer: 0,
    capricorn: 0,
    arctic: 0,
    lat45: 0,
    split: 0, // day/night colouring on the rings
    beam: 0,
    city: 0,
    sub: 0,
    winds: 0,
    monsoonFx: 1,
    clouds: 1,
  };

  const Y = new THREE.Vector3();
  const sDir = new THREE.Vector3();
  const sPerp = new THREE.Vector3();
  const X = new THREE.Vector3();
  const Z = new THREE.Vector3();
  const M4 = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const qy = new THREE.Quaternion();
  const UP = new THREE.Vector3(0, 1, 0);
  const XA = new THREE.Vector3(1, 0, 0);
  const vO = new THREE.Vector3();
  const vD = new THREE.Vector3();
  let rigScale = 1;

  // body orientation from its axis, the Sun direction, and the subsolar
  // longitude: lon 0 is placed so that the meridian lamSS faces the Sun
  function orient(axis, s, lamSS) {
    sPerp.copy(s).addScaledVector(axis, -s.dot(axis));
    if (sPerp.lengthSq() < 1e-9) sPerp.set(1, 0, 0);
    sPerp.normalize();
    X.copy(sPerp).applyAxisAngle(axis, -lamSS);
    Z.crossVectors(X, axis);
    M4.makeBasis(X, axis, Z);
    Q.setFromRotationMatrix(M4);
    return Q;
  }

  function apply() {
    const g = sunGeom(S.t);
    const dec = g.dec;
    const lamSS = deg(S.lonRef) - S.hour;
    const orbitView = S.view === 'orbit';
    orbit.visible = orbitView;

    if (orbitView) {
      orbitPos(g.nu, rig.position);
      rigScale = K_ORB;
      sDir.copy(rig.position).negate().normalize();
      Y.copy(AXIS_H);
      body.quaternion.copy(orient(Y, sDir, lamSS));
      sunPos.set(0, 0, 0);
    } else if (S.frame === 'sun') {
      rig.position.set(0, 0, 0);
      rigScale = 1;
      orbitPos(g.nu, vA).negate(); // Earth → Sun, heliocentric
      qy.setFromAxisAngle(UP, Math.atan2(vA.z, vA.x));
      Y.copy(AXIS_H).applyQuaternion(qy);
      sDir.set(1, 0, 0);
      body.quaternion.copy(orient(Y, sDir, lamSS));
      sunPos.copy(sDir).multiplyScalar(1e4);
    } else {
      rig.position.set(0, 0, 0);
      rigScale = 1;
      Q.setFromAxisAngle(XA, deg(S.tilt));
      qy.setFromAxisAngle(UP, -PI / 2 - deg(S.lonRef));
      body.quaternion.copy(Q).multiply(qy);
      Y.copy(UP).applyQuaternion(body.quaternion);
      latlon(dec, lamSS, sDir).applyQuaternion(body.quaternion);
      sunPos.copy(sDir).multiplyScalar(1e4);
    }
    rig.scale.setScalar(rigScale);
    sunPos.add(root.position);
    earthC.copy(rig.position).add(root.position);

    // seasonal fields
    earthU.uSnowN.value = snowLineN(S.t);
    earthU.uSnowS.value = snowLineS(S.t);
    earthU.uIceN.value = seaIceN(S.t);
    earthU.uIceS.value = seaIceS(S.t);
    const fx = S.monsoonFx;
    earthU.uDry.value = (1 - greenIndia(S.t)) * fx;
    earthU.uHeat.value = heatIndia(S.t) * fx;
    cloudU.uItczBase.value = itczBase(S.t);
    cloudU.uItczAsia.value = itczAsia(S.t);
    cloudU.uRain.value = rainIndia(S.t);
    cloudU.uAlpha.value = S.clouds;
    clouds.visible = S.clouds > 0.01;

    // overlays
    axisRod.visible = S.axis > 0;
    for (const [k, r] of Object.entries(rings)) {
      const on = S[k] > 0 && !orbitView;
      r.mesh.visible = on;
      r.u.uSplit.value = S.split;
      r.u.uOpacity.value = 0.9 * S[k];
    }
    city.visible = S.city > 0 && !orbitView;

    const subOn = S.sub > 0 && !orbitView;
    subDot.visible = subGlow.visible = subOn;
    subDot.position.copy(rig.position).addScaledVector(sDir, R * 1.012);
    subGlow.position.copy(subDot.position);
    aSub.position.copy(subDot.position);
    const latS = (dec * 180) / PI;
    const subTxt = `Sun overhead · ${Math.abs(latS).toFixed(1)}° ${latS >= 0 ? 'N' : 'S'} · ${fmtDate(S.t)}`;
    setText(L.subLean, subTxt);
    setText(L.subEq, subTxt);
    setText(L.subMon, subTxt);

    // the beam
    const beamOn = S.beam > 0 && !orbitView;
    rays.visible = square.visible = sqFill.visible = beamOn;
    earthU.uFoot.value = beamOn ? 1 : 0;
    if (beamOn) {
      const P = LL(LAT45, S.lonRef, vA).applyQuaternion(body.quaternion).multiplyScalar(R).add(rig.position);
      const U = vB.copy(Y).addScaledVector(sDir, -Y.dot(sDir)).normalize();
      const V = vC.crossVectors(sDir, U).normalize();
      earthU.uBeamP.value.copy(P).add(root.position);
      earthU.uBeamU.value.copy(U);
      earthU.uBeamV.value.copy(V);
      earthU.uBeamHalf.value = BEAM_HALF;
      let k = 0;
      const O = vO;
      const D = vD;
      for (let i = 0; i < NR; i++) {
        for (let j = 0; j < NR; j++) {
          const a = ((i / (NR - 1)) * 2 - 1) * BEAM_HALF * 0.92;
          const b = ((j / (NR - 1)) * 2 - 1) * BEAM_HALF * 0.92;
          O.copy(P).addScaledVector(sDir, BEAM_LEN).addScaledVector(U, a).addScaledVector(V, b);
          // first hit of the ray O − τ·s with the sphere
          D.copy(O).sub(rig.position);
          const bq = -D.dot(sDir);
          const cq = D.lengthSq() - R * R;
          const disc = bq * bq - cq;
          const tau = disc > 0 ? -bq - Math.sqrt(disc) : BEAM_LEN;
          rayPos[k++] = O.x;
          rayPos[k++] = O.y;
          rayPos[k++] = O.z;
          rayPos[k++] = O.x - sDir.x * tau;
          rayPos[k++] = O.y - sDir.y * tau;
          rayPos[k++] = O.z - sDir.z * tau;
        }
      }
      rayGeo.attributes.position.needsUpdate = true;
      const corners = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ];
      corners.forEach(([a, b], ci) => {
        O.copy(P).addScaledVector(sDir, BEAM_LEN).addScaledVector(U, a * BEAM_HALF).addScaledVector(V, b * BEAM_HALF);
        sqPos[ci * 3] = O.x;
        sqPos[ci * 3 + 1] = O.y;
        sqPos[ci * 3 + 2] = O.z;
      });
      sqGeo.attributes.position.needsUpdate = true;
      sqFill.position.copy(P).addScaledVector(sDir, BEAM_LEN);
      M4.makeBasis(U, V, sDir);
      sqFill.quaternion.setFromRotationMatrix(M4);
      sqFill.scale.set(BEAM_HALF * 2, BEAM_HALF * 2, 1);
      aBeamSq.position.copy(P).addScaledVector(sDir, BEAM_LEN).addScaledVector(U, BEAM_HALF);
      aFoot.position.copy(P);
      const alt = 90 - Math.abs(LAT45 - latS);
      const spread = 1 / Math.sin(deg(alt));
      setText(L.foot, `Noon Sun ${Math.round(alt)}° up · ${spread.toFixed(1)}× the ground`);
    }

    // live readouts
    const h45 = dayHours(deg(LAT45), dec);
    setText(L.day45, `45° N · ${fmtHM(h45)} of daylight`);
    setText(L.eq45, `45° N · ${fmtHM(h45)} of daylight`);
    setText(L.eqEq, `Equator · ${fmtHM(dayHours(0, dec))}`);
    const hArc = dayHours(deg(66.56), dec);
    setText(
      L.dayArc,
      hArc >= 23.95 ? 'Arctic Circle · the Sun never sets' : hArc <= 0.05 ? 'Arctic Circle · the Sun never rises' : `Arctic Circle · ${fmtHM(hArc)} of daylight`,
    );
    setText(
      L.snowArc,
      hArc <= 3 ? 'Arctic Circle · polar night' : hArc >= 21 ? 'Arctic Circle · midnight Sun' : 'Arctic Circle',
    );
    const km = (g.rho * AU_KM) / 1e6;
    setText(L.sun, `Sun · ${km.toFixed(1)} M km to Earth · ${fmtDate(S.t)}`);

    // the Sun–Earth line in the orbit view
    if (orbitView) {
      const d = rig.position.length();
      sunLine.scale.set(1, d - SUN_R - R * K_ORB * 1.1, 1);
      sunLine.position.copy(rig.position).normalize().multiplyScalar((SUN_R + d - R * K_ORB * 1.1) / 2);
      sunLine.quaternion.setFromUnitVectors(UP, vA.copy(rig.position).normalize());
    }

    // monsoon winds
    const wW = windSW(S.t) * S.winds;
    const wD = windNE(S.t) * S.winds;
    poseWind(windWet, S.flow, wW);
    poseWind(windDry, S.flow, wD);
    setText(
      L.wind,
      wW > 0.3 ? 'South-west monsoon · wet sea air onto land' : wD > 0.3 ? 'North-east monsoon · dry air off the land' : 'Winds turning around',
    );
    aBelt.position.copy(LL(itczAsia(S.t), 86, vA)).multiplyScalar(R * 1.012);
    aSnow.position.copy(LL(Math.min(80, snowLineN(S.t) - 3), 62, vA)).multiplyScalar(R * 1.02);
  }

  // camera-facing pieces + ring anchors on the side of each circle nearest
  // the camera, so the labels never sit on the far side of the globe
  const camDir = new THREE.Vector3();
  const qBody = new THREE.Quaternion();
  const axisW = new THREE.Vector3();
  function updateView() {
    const cam = stage.camera;
    sunGlow.quaternion.copy(cam.quaternion);
    subGlow.quaternion.copy(cam.quaternion);
    if (S.view === 'orbit') return;
    body.getWorldQuaternion(qBody);
    axisW.set(0, 1, 0).applyQuaternion(qBody);
    root.updateMatrixWorld();
    for (const ra of ringAnchors) {
      const lat = deg(rings[ra.key].lat);
      camDir.copy(cam.position).sub(earthC);
      camDir.addScaledVector(axisW, -camDir.dot(axisW));
      if (camDir.lengthSq() < 1e-8) camDir.set(0, 0, 1);
      camDir.normalize().applyAxisAngle(axisW, ra.az);
      ra.a.position
        .copy(earthC)
        .addScaledVector(camDir, Math.cos(lat) * R * 1.016 * rigScale)
        .addScaledVector(axisW, Math.sin(lat) * R * 1.016 * rigScale);
      root.worldToLocal(ra.a.position);
    }
  }
  const stopTick = stage.onTick(updateView);

  apply();

  return {
    group: root,
    parts: { earth, clouds, body, rig, orbit, sun, rays, winds: windWet.mesh },
    set(patch) {
      Object.assign(S, patch);
      apply();
    },
    setLabels: labels.setLabels,
    dispose() {
      stopTick();
      scene.remove(root);
      scene.remove(sky);
      for (const d of disposables) d.dispose?.();
    },
  };
}
