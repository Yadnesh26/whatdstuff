// The story contract for the rainbow, written BEFORE the model.
// Every `visuals` entry is a promise the procedural model must keep.
export default {
  angle:
    'A rainbow is not an object and it is not in the sky. It is an angle — about ' +
    '42 degrees — measured from the shadow of your own head. Every raindrop out ' +
    'there sprays the whole spectrum in every direction; you only ever catch one ' +
    'colour from any one drop, and only from the drops that happen to sit on that ' +
    'angle. Which is why nobody has ever reached one.',
  stat:
    'Water bends violet light about 1% harder than red — 1.343 against 1.331 — ' +
    'and that single percent is the entire width of the rainbow: red comes back at ' +
    '42.4°, violet at 40.7°, and the 1.7° between them is the whole show.',
  button: 'It is not in the sky. It is aimed at you.',
  who:
    'Anyone who has chased one, photographed one and wondered why it never got ' +
    'closer, or assumed the colours were somehow painted onto the rain.',
  beats: [
    {
      idea: 'The finished thing: a bow standing in a curtain of falling rain, sun low behind you.',
      visuals: [
        'a wide shot of a rain curtain with a full primary bow arcing through it',
        'a fainter second bow outside it, colours reversed',
        'a camera on a tripod standing on the ground as the observer, sun low behind it',
      ],
    },
    {
      idea:
        'Inside one drop there are exactly three events: it bends going in, bounces once ' +
        'off the far inside wall, and bends again coming out.',
      visuals: [
        'a single giant water drop held in frame, a sunbeam entering it',
        'the beam bending at the front surface, striking the back wall, bouncing once',
        'the beam bending again on the way out and leaving back toward the sun side',
      ],
    },
    {
      idea:
        'Rays hit every part of the drop face, but their exit angles pile up against a ' +
        'limit near 42°. That pile-up IS the brightness of the bow.',
      visuals: [
        'a fan of parallel rays striking the drop at many different heights',
        'each one traced through and out, exit directions spraying at different angles',
        'the exit rays visibly crowding together at one limiting angle, sparse elsewhere',
      ],
    },
    {
      idea:
        'Water bends violet slightly harder than red, so each colour has its own limiting ' +
        'angle — and a single drop can only ever send you one of them.',
      visuals: [
        'the same drop traced separately for red and for violet, two exit rays splitting apart',
        'the 42.4° / 40.6° gap between them marked',
        'a red ray reaching the observer from a high drop while the violet from that same drop misses',
      ],
    },
    {
      idea:
        'Spin that angle around the line from the sun through your head and you get a cone. ' +
        'The bow is a circle because a cone is.',
      visuals: [
        'a cone opening from the observer at a fixed half-angle, axis pointing away from the sun',
        'the antisolar point marked on the ground, where the observer’s own shadow falls',
        'the cone meeting the rain curtain and lighting a circular band of drops',
      ],
    },
    {
      idea:
        'The drops are falling straight through the band. A drop is red for a moment, then ' +
        'orange, then dark — and the bow does not move at all.',
      visuals: [
        'drops falling down through the coloured band, each changing colour as it crosses',
        'the band itself holding perfectly still while its drops are replaced',
        'the observer stepping forward and the whole cone moving with it',
      ],
    },
    {
      idea:
        'The second bow is the light that bounced twice: wider, reversed, dimmer — and ' +
        'between the two, a band of sky no drop can send light into.',
      visuals: [
        'the drop traced again with two internal bounces, the exit leaving at a wider angle',
        'the second band appearing outside the first with the spectrum reversed',
        'the dark gap between the two bands called out',
      ],
    },
    {
      idea:
        'Sealed back up: sun low, bow high. Lift the sun above 42° and there is nothing ' +
        'left to see, because the whole cone has gone underground.',
      visuals: [
        'the full scene running again, both bows live in the falling rain',
        'the sun climbing and the bow sinking as it does, until the band drops below the ground',
      ],
    },
  ],
};
