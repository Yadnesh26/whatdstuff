// The story contract for hybrid-engine, written BEFORE the model. Every
// `visuals` entry is a promise the procedural model must keep.
//
// MECHANISM (researched): the Toyota-style "power split" hybrid. One planetary
// gearset. Carrier <- petrol engine, sun -> generator MG1, ring -> wheels (and
// the traction motor MG2 is geared onto the same ring). Gen-2 Prius tooth
// counts: sun 30, ring 78, so  MG1 = 3.6 x engine - 2.6 x wheels  (eahart.com
// PSD page; priuschat/ecrostech derivations; UVic THS paper). Torque splits
// 78:30 of the engine's torque: 72% to the ring, 28% to the sun.
export default {
  angle:
    'A hybrid has no gearbox. One small set of planetary gears joins the engine, a generator and ' +
    'the wheels, and how fast the generator spins IS the gear ratio. The gearbox was a generator.',
  stat:
    'The sun gear has 30 teeth and the ring has 78, so generator speed = 3.6 x engine speed - ' +
    '2.6 x wheel speed. Hold the car at one speed and the engine can slide anywhere in its range ' +
    'while the generator simply spins faster or slower to make up the difference.',
  button: 'The gearbox was a generator all along.',
  who:
    'Anyone who has sat in a Prius-style hybrid, heard the engine hum steadily while the speed ' +
    'changed, or pulled away in silence, and wondered where the gears went.',
  beats: [
    {
      idea:
        'A hybrid looks like any other car, yet it creeps off in silence, the engine drones at a ' +
        'steady pitch while you accelerate, and it never shifts.',
      visuals: ['a complete solid sedan driving on a road, wheels rolling'],
    },
    {
      idea:
        'Inside: a petrol engine, TWO electric motor-generators, an inverter and a battery. There ' +
        'is no clutch, no torque converter and no gearbox.',
      visuals: [
        'the body ghosting to show an engine, two motor-generators and the inverter up front',
        'the high-voltage battery at the back with orange cables running to the inverter',
        'both motors and the engine turning',
      ],
    },
    {
      idea:
        'One planetary gearset connects it all: the engine feeds the planet carrier, the sun gear ' +
        'drives generator MG1, the ring gear drives the wheels (and MG2 pushes on that same ring).',
      visuals: [
        'sun, four planets, carrier and ring gear meshing, colour-coded by what they connect to',
        'the engine shaft entering the carrier, the sun shaft leaving to MG1, the ring gear driving the final drive',
      ],
    },
    {
      idea:
        'Three speeds are locked to one straight line. The ring is tied to the road, so the only ' +
        'way to change the engine speed is to change the generator speed. That is the ratio.',
      visuals: [
        'a lever diagram with three markers (sun, carrier, ring) on one straight line',
        'engine marker sliding while the ring marker stays still and the sun marker swings further',
        'engine, generator and wheel speeds visibly matching the gears',
      ],
    },
    {
      idea: 'Pulling away or crawling in traffic: the engine stops completely and the battery drives MG2 alone.',
      visuals: [
        'engine stationary, pistons still',
        'MG1 spinning backwards, freewheeling',
        'power travelling battery to inverter to MG2 to the wheels',
      ],
    },
    {
      idea:
        'With the engine running, its power splits: most goes mechanically to the wheels, the rest ' +
        'spins MG1 as a generator and the electricity tops up the battery.',
      visuals: [
        'pistons firing',
        'power flowing engine to the gearset, then splitting to the ring and to MG1',
        'electric power flowing MG1 to inverter to battery',
      ],
    },
    {
      idea:
        'Floor it: the engine and MG2 both push, MG2 drawing extra power from the battery.',
      visuals: [
        'engine and MG2 both feeding the ring, battery discharging brightly',
      ],
    },
    {
      idea:
        'Lift off and brake: the wheels turn MG2 backwards into a generator, stopping the car ' +
        'partly by making electricity, and the engine is off.',
      visuals: [
        'power flowing backwards from the wheels to MG2 to inverter to battery',
        'the car slowing, engine still',
      ],
    },
    {
      idea: 'Back together, switching modes on its own. The gearbox was a generator all along.',
      visuals: ['the complete solid car driving through a pull-away, acceleration and stop cycle'],
    },
  ],
};
