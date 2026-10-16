// The story contract for race-car-downforce, written BEFORE the model.
// Every `visuals` entry is a promise the procedural model must keep.
export default {
  angle:
    'A race car is an aeroplane built to fly into the ground. Its wings are flipped upside ' +
    'down, but the biggest pull comes from somewhere you never see: the floor uses the road ' +
    'itself as one wall of a tunnel and sucks the whole car down onto the track.',
  stat:
    'At roughly 200 km/h a Formula 1 car makes downforce equal to its own weight of about ' +
    '800 kg, so in theory it could drive on a ceiling.',
  button: 'It grips harder the faster it goes.',
  who:
    'Anyone who has watched an F1 car take a corner at 250 km/h and wondered why it does not ' +
    'just slide straight off.',
  beats: [
    {
      idea:
        'Tyres grip in proportion to how hard they are pressed into the road. More weight would ' +
        'mean more grip, but also more mass to turn. Downforce adds the push without the mass.',
      visuals: [
        'the complete, solid open-wheel race car on a wind-tunnel rolling road',
        'the four tyres sitting on the moving belt',
      ],
    },
    {
      idea:
        'Downforce grows with the square of speed: twice as fast, four times the push. Around ' +
        '200 km/h it matches the car\'s weight.',
      visuals: [
        'smoke streamlines flowing over the car, speeding up and slowing down through one lap',
        'a weight arrow that stays fixed and a downforce arrow that grows with speed squared',
        'the moment the two arrows are equal',
      ],
    },
    {
      idea:
        'The front wing is an aircraft wing turned upside down. It turns the air upward, which ' +
        'leaves higher pressure on its top face and lower pressure underneath, and the ' +
        'difference pushes the nose down.',
      visuals: [
        'the multi-element front wing in close-up',
        'pressure colour on the wing: warm on top, cold underneath',
        'streamlines bending upward as they leave the trailing edge',
      ],
    },
    {
      idea:
        'The rear wing does the same job at the back with two stacked elements; the slot between ' +
        'them keeps the air attached to the steep flap. Opening the flap on a straight dumps ' +
        'downforce and drag together: that was DRS (2011–25); since 2026 both wings flatten on ' +
        'designated straights.',
      visuals: [
        'the rear wing main plane and flap with the slot between them',
        'air flung upward off the back of the wing',
        'the flap opening and closing, its downforce arrow shrinking and growing with it',
      ],
    },
    {
      idea:
        'The floor is the biggest wing on the car. Two tunnels under the sidepods narrow to a ' +
        'throat a few centimetres off the road; air squeezed through speeds up and its pressure ' +
        'drops, so the atmosphere pushes the car down from above.',
      visuals: [
        'the bodywork ghosted to show the venturi tunnels under the floor',
        'the gap between floor and road, with the road forming the tunnel\'s bottom wall',
        'streamlines bunching and speeding through the throat, coloured deep blue for low pressure',
      ],
    },
    {
      idea:
        'The diffuser at the back sweeps up and widens, slowing the air gently back to normal ' +
        'pressure before it leaves. That recovery is what pulls more air through the throat; ' +
        'flare it too steeply and the flow tears away and the suction dies.',
      visuals: [
        'the diffuser exit from behind, its upswept channels and fences',
        'streamlines spreading and slowing as they leave the diffuser',
      ],
    },
    {
      idea:
        'All together: front wing, floor and rear wing, each pressing on the car, with more than ' +
        'half of the total coming from the floor. It grips harder the faster it goes.',
      visuals: [
        'the complete car with flow over and under it',
        'three downforce arrows sized by share, the floor arrow the largest',
      ],
    },
  ],
};
