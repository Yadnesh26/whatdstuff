// The folder tree of the library. Categories are VIEWS over explainer
// metadata, not containers: an explainer lists every category it belongs to
// in its meta.js `categories` array (the AC is a car system AND a home
// appliance), and appears in each. `parent` nests a category under another
// to any depth (e.g. car under vehicles).
export const categories = {
  vehicles: {
    title: 'Vehicles',
    blurb: 'Engines, turbines and everything that moves you.',
    accent: '#ff8f5e',
  },
  home: {
    title: 'Around the Home',
    blurb: 'The machines humming away in the background of your day.',
    accent: '#8fd3ff',
  },
  precision: {
    title: 'Precision Machines',
    blurb: 'Small mechanisms doing exact work.',
    accent: '#e0b34a',
  },
  electronics: {
    title: 'Electronics',
    blurb: 'The handful of components hiding inside every circuit.',
    accent: '#b28dff',
  },
  infrastructure: {
    title: 'Infrastructure',
    blurb: 'Buildings, bridges and the machines hidden inside them.',
    accent: '#c9a87c',
  },
  earth: {
    title: 'Earth & Weather',
    blurb: "The planet's own machinery — engines that build weather out of sunlight and seawater.",
    accent: '#5ec9b0',
  },
  power: {
    title: 'Power & the Grid',
    blurb: 'How electricity is made, stepped up, and carried to your wall.',
    accent: '#54c8e8',
  },
  communications: {
    title: 'Communications',
    blurb: 'How voices, signals and data race across the world in milliseconds.',
    accent: '#6ec8ff',
  },
  medical: {
    title: 'Medicine & the Body',
    blurb: 'Machines that look inside you without opening you up.',
    accent: '#7ddfc4',
  },
  space: {
    title: 'Space & the Cosmos',
    blurb: 'Things you can never take apart, running on physics you can only watch.',
    accent: '#ffb454',
  },
  matter: {
    title: 'Matter & Particles',
    blurb: 'What everything else on this site is built out of, down where the rules change.',
    accent: '#5ec8ff',
  },
};

export function isCategory(id) {
  return Object.hasOwn(categories, id);
}

export function childrenOf(id) {
  return Object.entries(categories)
    .filter(([, c]) => c.parent === id)
    .map(([cid, c]) => ({ id: cid, ...c }));
}

export function topLevel() {
  return Object.entries(categories)
    .filter(([, c]) => !c.parent)
    .map(([cid, c]) => ({ id: cid, ...c }));
}

// A category contains an explainer if the meta lists it or any descendant.
export function itemsIn(id, metas) {
  const ids = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const [cid, c] of Object.entries(categories)) {
      if (c.parent && ids.has(c.parent) && !ids.has(cid)) {
        ids.add(cid);
        grew = true;
      }
    }
  }
  return metas.filter((m) => (m.categories ?? []).some((c) => ids.has(c)));
}
