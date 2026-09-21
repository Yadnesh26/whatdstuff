import { getMetas } from './framework/index.js';
import { categories, childrenOf, itemsIn, topLevel } from './categories.js';
import { mountHeroMachine } from './home-hero.js';
import { navigate } from './main.js';
import {
  ensureTextures,
  esc,
  masthead,
  mountGears,
  siteFooter,
} from './chrome.js';

// The library. Two modes:
//   mountHome(app)          — full library: hero mechanism + every category
//   mountHome(app, catId)   — one category: its child folders and explainers
//
// The product is a real-time 3D library, so the storefront shows the machines:
// every card carries a plate rendered from that explainer's own opening step
// (see scripts/make-plates.mjs), and the hero runs a live gear train.


// Titles read "How a Jet Engine Works" for SEO; the card wants the noun.
// Also handles "What Is a Black Hole?" — subjects that aren't machines get
// that framing instead, and the card still wants the bare noun.
const shortTitle = (t) =>
  t
    .replace(/^(?:How|What)\s+(?:is\s+|are\s+)?(?:a\s+|an\s+|the\s+)?/i, '')
    .replace(/\s*works?$/i, '')
    .replace(/\?$/, '');


// --- cards ----------------------------------------------------------------
// A machined plate: the render on top, a label strip milled into the bottom
// carrying the stamped index number, the name and the one-line teardown.
function card(e, n) {
  return `
    <a class="ex-card" href="/${e.id}">
      <img class="ex-shot" src="/plates/${e.id}-3d-animation.jpg" alt="" loading="lazy" decoding="async"
           width="720" height="450" />
      <span class="ex-plate">
        <span class="ex-no">${String(n).padStart(2, '0')}</span>
        <span class="ex-name">${esc(shortTitle(e.title))}</span>
        <span class="ex-go" aria-hidden="true">&#8599;</span>
        <span class="ex-spec">${esc(e.spec ?? e.summary ?? '')}</span>
      </span>
    </a>`;
}

function folderCard(c, count) {
  return `
    <a class="ex-card ex-folder" href="/${c.id}" style="--dye:${c.accent ?? '#93a7b3'}">
      <span class="ex-plate">
        <span class="ex-name">${esc(c.title)}</span>
        <span class="ex-go" aria-hidden="true">&#8599;</span>
        <span class="ex-spec">${esc(c.blurb ?? '')} — ${count} machine${count === 1 ? '' : 's'}</span>
      </span>
    </a>`;
}



// --------------------------------------------------------------------------
export function mountHome(container, catId = null) {
  ensureTextures();
  const metas = getMetas();
  const cat = catId ? categories[catId] : null;
  let plateNo = 0; // stamped in display order, so each rack reads 01, 02, 03…

  // Sections. A machine can belong to several categories but is listed once,
  // under the first that claims it — same rule the category pages use.
  let sectionsHtml = '';
  if (cat) {
    const kids = childrenOf(catId).map((c) => folderCard(c, itemsIn(c.id, metas).length));
    const items = itemsIn(catId, metas).map((m) => card(m, ++plateNo));
    sectionsHtml = `<div class="ex-grid">${[...kids, ...items].join('')}</div>`;
  } else {
    const claimed = new Set();
    sectionsHtml = topLevel()
      .map((c) => {
        const items = itemsIn(c.id, metas).filter((m) => !claimed.has(m.id));
        items.forEach((m) => claimed.add(m.id));
        if (!items.length) return '';
        return `
          <section class="ex-cat" style="--dye:${c.accent ?? '#93a7b3'}">
            <div class="ex-cat-head">
              <h3><a href="/${c.id}">${esc(c.title)}</a></h3>
              <span class="mono">${String(items.length).padStart(2, '0')}</span>
              <p>${esc(c.blurb ?? '')}</p>
            </div>
            <div class="ex-grid">${items.map((m) => card(m, ++plateNo)).join('')}</div>
          </section>`;
      })
      .join('');
    const loose = metas.filter((m) => !claimed.has(m.id));
    if (loose.length) {
      sectionsHtml += `
        <section class="ex-cat">
          <div class="ex-cat-head">
            <h3><a>More machines</a></h3>
            <span class="mono">${String(loose.length).padStart(2, '0')}</span>
          </div>
          <div class="ex-grid">${loose.map((m) => card(m, ++plateNo)).join('')}</div>
        </section>`;
    }
  }

  const heroHtml = cat
    ? `<header class="cat-hero">
         <a class="cat-back" href="/">&#8592; the machines</a>
         <h1>${esc(cat.title)}</h1>
         <p class="hero-deck">${esc(cat.blurb ?? '')}</p>
       </header>`
    : `<section class="home-hero">
         <canvas id="hero-machine" aria-label="A live gear train you can drag to spin"></canvas>
         <span class="hero-grain" aria-hidden="true"></span>
         <div class="hero-copy">
           <p class="mono hero-eyebrow">Interactive 3D teardowns</p>
           <h1>
             <span class="ln"><i>Snoop</i></span>
             <span class="ln"><i>through</i></span>
             <span class="ln"><i><em>your stuff.</em></i></span>
           </h1>
           <p class="hero-deck">
             Real machines, taken apart a step at a time and left running. Pause
             anywhere, look inside, and see what every part is doing.
           </p>
           <div class="hero-actions">
             <a class="hero-cta" href="#machines">See all<span aria-hidden="true">&#8599;</span></a>
           </div>
         </div>
         <p class="mono scroll-cue"><i></i>Scroll</p>
         <p class="mono hero-hint" id="hero-hint">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
                aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></svg>
           Drag to spin
         </p>
       </section>
       <section class="promises">
         <div>
           <b>Scroll it apart</b>
           <p>Every machine opens one step at a time as you scroll, from its outer shell to its deepest part.</p>
         </div>
         <div>
           <b>Watch it run</b>
           <p>Each step is a live mechanism, not a video — it keeps running while you look, and a drag turns it.</p>
         </div>
         <div>
           <b>Built from the real thing</b>
           <p>Every part is modelled against the actual mechanism, piece by piece. Nothing is downloaded or faked.</p>
         </div>
       </section>`;

  container.innerHTML = `
    <div class="home">
${masthead({ anchored: true, search: true, active: 'machines' })}

      ${heroHtml}

      <main class="machines" id="machines">
        <div class="machines-head">
          <h2>${cat ? 'In this category' : 'The Machines'}</h2>
          <p class="mono" id="ex-count"></p>
        </div>
        ${sectionsHtml}
      </main>

${siteFooter({ anchored: true })}
    </div>

    <div class="finder-scrim" id="finder-scrim"></div>
    <div class="finder" id="finder" role="dialog" aria-modal="true" aria-label="Find a machine">
      <div class="finder-bar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" />
        </svg>
        <input id="finder-q" type="text" autocomplete="off" spellcheck="false"
               placeholder="Search machines and the parts inside them" />
        <button id="close-finder" type="button">ESC</button>
      </div>
      <div class="finder-body" id="finder-body"></div>
    </div>
  `;

  const q = (sel) => container.querySelector(sel);
  const count = q('#ex-count');
  const shown = container.querySelectorAll('.ex-card:not(.ex-folder)').length;
  count.textContent = `${shown} machine${shown === 1 ? '' : 's'}`;

  // --- the hero mechanism -------------------------------------------------
  let machine = null;
  const canvas = q('#hero-machine');
  if (canvas) {
    machine = mountHeroMachine(canvas);
    // the hint has done its job the moment someone drags — retire it
    const hint = q('#hero-hint');
    canvas.addEventListener(
      'train-dragged',
      () => {
        hint.style.transition = 'opacity .5s, transform .5s';
        hint.style.opacity = '0';
        hint.style.transform = 'translateY(6px)';
      },
      { once: true },
    );
  }

  // --- the finder ---------------------------------------------------------
  // At library scale, browsing gives out and search becomes the front door, so
  // it indexes each machine's PARTS as well as its title and says which it
  // matched on.
  const scrim = q('#finder-scrim');
  const finder = q('#finder');
  const input = q('#finder-q');
  const body = q('#finder-body');
  const catTitle = (m) =>
    categories[(m.categories ?? [])[0]]?.title ?? 'More machines';
  let hits = [];
  let sel = 0;

  const mark = (text, needle) => {
    const i = text.toLowerCase().indexOf(needle);
    if (i < 0) return esc(text);
    return (
      esc(text.slice(0, i)) +
      '<mark>' +
      esc(text.slice(i, i + needle.length)) +
      '</mark>' +
      esc(text.slice(i + needle.length))
    );
  };

  const hitHTML = (m, why) => `
    <div class="hit" data-id="${m.id}">
      <b>${esc(shortTitle(m.title))}</b>
      <span class="hit-tag">${esc(catTitle(m))}</span>
      <span class="hit-why">${why}</span>
    </div>`;

  function search(raw) {
    const needle = raw.trim().toLowerCase();
    if (!needle) {
      hits = metas.slice(0, 6);
      body.innerHTML =
        '<p class="finder-group">Start here</p>' +
        hits.map((m) => hitHTML(m, esc(m.spec ?? ''))).join('');
      sel = 0;
      paint();
      return;
    }

    const byName = metas.filter((m) => m.title.toLowerCase().includes(needle));
    const inside = metas.filter(
      (m) =>
        !byName.includes(m) &&
        `${m.spec ?? ''} ${m.keywords ?? ''} ${m.summary ?? ''}`.toLowerCase().includes(needle),
    );
    hits = [...byName, ...inside];

    let html = '';
    if (byName.length) {
      html +=
        '<p class="finder-group">Machines</p>' +
        byName.map((m) => hitHTML(m, esc(m.spec ?? ''))).join('');
    }
    if (inside.length) {
      // say WHERE the term was found — that is what makes it an encyclopedia
      html +=
        '<p class="finder-group">Found inside</p>' +
        inside
          .map((m) => {
            const src = `${m.spec ?? ''} · ${m.keywords ?? ''}`;
            const i = src.toLowerCase().indexOf(needle);
            const from = Math.max(0, i - 34);
            const frag = (from ? '…' : '') + src.slice(from, i + needle.length + 40) + '…';
            return hitHTML(m, mark(frag, needle));
          })
          .join('');
    }
    if (!hits.length) html = requisitionHTML(raw.trim());
    body.innerHTML = html;
    sel = 0;
    paint();
  }

  // A miss is not an error — it is the highest-intent moment in the product.
  // The visitor has just told us exactly what to build next.
  function requisitionHTML(raw) {
    const words = raw.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const near = metas
      .map((m) => {
        const hay = `${m.title} ${m.spec ?? ''} ${m.keywords ?? ''}`.toLowerCase();
        return { m, score: words.reduce((s, w) => s + (hay.includes(w.slice(0, 5)) ? 1 : 0), 0) };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((x) => x.m);
    const fallback = near.length ? near : metas.slice(0, 3);

    return `
      <div class="req">
        <div class="req-plate">
          <span class="mono">Not opened — yet</span><span class="req-no">REQ &middot; NEW</span>
        </div>
        <h4>Nobody has taken <q>${esc(raw)}</q> apart here.</h4>
        <p>
          Tell us and it goes on the bench. What people ask for is what gets built
          next — we would rather build the machine you actually wanted than guess.
        </p>
        <form class="req-form" id="req-form">
          <input type="email" required placeholder="you@example.com" aria-label="Your email" />
          <button type="submit">Put it on the bench</button>
        </form>
        <div class="req-near">
          <p class="finder-group">Closest matches</p>
          ${fallback.map((m) => hitHTML(m, esc(m.spec ?? ''))).join('')}
        </div>
      </div>`;
  }

  function paint() {
    const els = body.querySelectorAll('.hit');
    els.forEach((el, i) => el.setAttribute('data-sel', i === sel ? '1' : '0'));
    els[sel]?.scrollIntoView({ block: 'nearest' });
  }

  function openFinder() {
    scrim.dataset.open = '1';
    finder.dataset.open = '1';
    document.body.style.overflow = 'hidden';
    input.value = '';
    search('');
    setTimeout(() => input.focus(), 40);
  }
  function closeFinder() {
    scrim.dataset.open = '0';
    finder.dataset.open = '0';
    document.body.style.overflow = '';
  }

  q('#open-finder').addEventListener('click', openFinder);
  q('#close-finder').addEventListener('click', closeFinder);
  scrim.addEventListener('click', closeFinder);
  input.addEventListener('input', () => search(input.value));
  body.addEventListener('click', (e) => {
    const hit = e.target.closest('.hit');
    if (hit) {
      navigate(hit.dataset.id);
      closeFinder();
    }
  });
  body.addEventListener('submit', (e) => {
    if (e.target.id !== 'req-form') return;
    e.preventDefault();
    // no backend yet — this is where the demand log and the email provider wire
    // in (see docs/audience-capture-plan.md)
    e.target.outerHTML = `<div class="req-done">Logged. You will get
      <q>${esc(input.value.trim())}</q> the day it ships — and nothing else.</div>`;
  });

  const onKey = (e) => {
    const open = finder.dataset.open === '1';
    if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) ||
        (e.key === '/' && !open && e.target === document.body)) {
      e.preventDefault();
      openFinder();
      return;
    }
    if (!open) return;
    if (e.key === 'Escape') closeFinder();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      sel = Math.min(sel + 1, hits.length - 1);
      paint();
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      sel = Math.max(sel - 1, 0);
      paint();
    }
    if (e.key === 'Enter' && hits[sel]) {
      navigate(hits[sel].id);
      closeFinder();
    }
  };
  document.addEventListener('keydown', onKey);

  // masthead docks once the hero is behind you
  const mast = q('.masthead');
  const firstSection = q('.home-hero') ?? q('.cat-hero');
  const mastWatch = new IntersectionObserver(
    ([e]) => mast.classList.toggle('docked', !e.isIntersecting),
    { threshold: 0, rootMargin: '-60px 0px 0px 0px' },
  );
  if (firstSection) mastWatch.observe(firstSection);

  const stopGears = mountGears(container);

  return {
    destroy() {
      machine?.destroy();
      stopGears();
      mastWatch.disconnect();
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      container.innerHTML = '';
    },
  };
}
