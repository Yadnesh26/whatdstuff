import { getMetas } from './framework/index.js';
import { about, withCount } from './about-copy.js';
import { mountAboutMachine } from './about-hero.js';
import { ensureTextures, esc, masthead, mountGears, siteFooter } from './chrome.js';

// The about page. Same chrome as the library, but its own hero mechanism
// (about-hero.js): one gear, half blueprint and half finished part, built
// live by a sweep — a different object and a different story from the home
// page's gear train, sharing only the lighting/material toolkit.
//
// Layout has real rhythm instead of one grid repeated per section: a type-led
// hero, plain prose, a proof strip of stats (machined plates), a vertical
// rail for the five build steps, a 3-up card grid for what we won't do, and
// a raised panel for the close — mirroring how .promises breaks from the
// plain background on the home page.
//
// All copy comes from about-copy.js, which scripts/prerender.mjs reads too,
// so /about has a real static document before any JavaScript runs.

export function mountAbout(container) {
  ensureTextures();
  const count = getMetas().length;

  const stats = about.stats
    .map(
      (s) => `
          <div class="stat-tile">
            <span class="stat-value mono">${esc(withCount(s.value, count))}</span>
            <span class="stat-label">${esc(s.label)}</span>
            <span class="stat-note mono">${esc(s.note)}</span>
          </div>`,
    )
    .join('');

  const process = about.process
    .map(
      (s) => `
          <li class="about-rail-step">
            <span class="about-rail-dot mono">${esc(s.no)}</span>
            <div class="about-rail-content">
              <b>${esc(s.name)}</b>
              <p>${esc(s.body)}</p>
            </div>
          </li>`,
    )
    .join('');

  const principles = about.principles
    .map(
      (p) => `
          <div class="principle-card">
            <b>${esc(p.title)}</b>
            <p>${esc(p.body)}</p>
          </div>`,
    )
    .join('');

  container.innerHTML = `
    <div class="home about">
${masthead({ active: 'about' })}

      <header class="about-hero">
        <canvas id="hero-machine" aria-label="A live 3D gear, half engineering drawing and half finished part, that you can drag to spin"></canvas>
        <span class="hero-grain" aria-hidden="true"></span>
        <div class="hero-copy">
          <a class="cat-back" href="/">&#8592; the machines</a>
          <p class="mono hero-eyebrow">${esc(about.eyebrow)}</p>
          <h1>
            <span class="ln"><i>${esc(about.heroLines[0])}</i></span>
            <span class="ln"><i><em>${esc(about.heroLines[1])}</em></i></span>
          </h1>
          <p class="hero-deck">${esc(about.deck)}</p>
        </div>
        <p class="mono scroll-cue"><i></i>Scroll</p>
        <p class="mono hero-hint" id="about-hero-hint">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
               aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></svg>
          Drag to spin
        </p>
      </header>

      <main class="about-body">
        <section class="about-intro">
          ${about.intro.map((p) => `<p>${esc(p)}</p>`).join('')}
        </section>

        <section class="about-stats">${stats}</section>

        <section class="about-section">
          <div class="about-head">
            <h2>${esc(about.processHeading)}</h2>
            <span class="mono">${String(about.process.length).padStart(2, '0')} steps</span>
          </div>
          <ol class="about-rail">${process}</ol>
        </section>

        <section class="about-section">
          <div class="about-head">
            <h2>${esc(about.principlesHeading)}</h2>
            <span class="mono">${String(about.principles.length).padStart(2, '0')}</span>
          </div>
          <div class="principle-grid">${principles}</div>
        </section>

        <section class="about-cta">
          <h2>${esc(about.ctaHeading)}</h2>
          <p>${esc(withCount(about.ctaBody, count))}</p>
          <a class="hero-cta" href="/">${esc(about.ctaLabel)}<span aria-hidden="true">&#8599;</span></a>
        </section>
      </main>

${siteFooter()}
    </div>
  `;

  // the masthead docks the moment the hero scrolls past, same as the library
  const mast = container.querySelector('.masthead');
  const mastWatch = new IntersectionObserver(
    ([e]) => mast.classList.toggle('docked', !e.isIntersecting),
    { threshold: 0, rootMargin: '-60px 0px 0px 0px' },
  );
  mastWatch.observe(container.querySelector('.about-hero'));

  // --- the hero mechanism ---------------------------------------------
  let machine = null;
  const canvas = container.querySelector('#hero-machine');
  if (canvas) {
    machine = mountAboutMachine(canvas);
    // the hint has done its job the moment someone drags — retire it
    const hint = container.querySelector('#about-hero-hint');
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

  const stopGears = mountGears(container);

  return {
    destroy() {
      machine?.destroy();
      stopGears();
      mastWatch.disconnect();
      container.innerHTML = '';
    },
  };
}
