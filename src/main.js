import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';
// `standard` carries BOTH axes — the library's display type uses the width
// axis (condensed for the hero, expanded for category nameplates), and the
// default `index.css` ships weight only.
import '@fontsource-variable/archivo/standard.css';
import './style.css';
import { engine as animeEngine } from 'animejs';
import { loadExplainer, mountExplainer } from './framework/index.js';
import { categories, isCategory } from './categories.js';
import { mountHome } from './home.js';
import { mountAbout } from './about.js';

// anime.js pauses its engine when the document is hidden and, in embedded /
// backgrounded contexts, doesn't reliably resume on becoming visible again —
// which freezes every looping timeline (and, if it happens at load, the home
// page's entrance animation). Keep the engine running regardless of tab
// visibility; a real foreground tab renders fine, a background one just costs
// a little idle work.
animeEngine.pauseOnDocumentHidden = false;

// Explainers register themselves: registry.js globs every
// src/explainers/*/meta.js eagerly and lazy-imports index.js on navigation.

const app = document.querySelector('#app');
let current = null;
let nav = 0;

const BASE_TITLE = 'whatDstuff';

function setTitle(title) {
  document.title = title;
}

// Real path is the URL of record (what search indexes and what the
// prerendered shells at dist/<id>/index.html are built for); the hash form
// is kept as a silent fallback so old links, bookmarks and the Playwright
// tooling (verify.mjs, review-shots.mjs, export-video.mjs, render-film.mjs,
// make-thumbnails.mjs, make-plates.mjs — all of which still navigate via
// `#/<id>`) keep working untouched. See docs/seo-plan.md § F1.
function resolvePath() {
  const fromPath = location.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
  if (fromPath) return fromPath;
  return location.hash.replace(/^#\/?/, '').replace(/\/+$/, '');
}

async function route() {
  const token = ++nav;
  current?.destroy();
  current = null;
  window.scrollTo(0, 0);

  // Paths: '' → library, 'about' → the about page, 'vehicles' → category
  // page, 'vehicles/jet-engine' or plain 'jet-engine' → explainer (ids are
  // globally unique, so only the last segment matters — old flat URLs keep
  // working). 'about' is checked before the registry, so an explainer can
  // never be given that id and shadow the page.
  const path = resolvePath();
  if (!path) {
    current = mountHome(app);
    setTitle(BASE_TITLE);
    return;
  }
  const last = path.split('/').at(-1);
  if (last === 'about') {
    current = mountAbout(app);
    setTitle(`About — ${BASE_TITLE}`);
    return;
  }
  if (isCategory(last)) {
    current = mountHome(app, last);
    setTitle(`${categories[last].title} — whatDstuff`);
    return;
  }
  const def = await loadExplainer(last);
  if (token !== nav) return; // user navigated again while the chunk loaded
  if (def) {
    current = mountExplainer(def, app);
    setTitle(`${def.title} | whatDstuff`);
  } else {
    current = mountHome(app);
    setTitle(BASE_TITLE);
  }
}

// Pushes a real path and re-routes, without a full page reload. Exported so
// home.js's search finder can navigate a hit without going through
// location.hash (a hash write here would leave a stray `#/id` in the address
// bar next to the new path).
export function navigate(path) {
  const url = path.startsWith('/') ? path : `/${path}`;
  if (url === location.pathname) return;
  history.pushState(null, '', url);
  route();
}

// Intercept same-origin left-clicks on internal links so the app can
// pushState instead of a full reload. Every in-app href is now a real path
// (e.g. href="/jet-engine"); same-page anchors like href="#machines" keep
// their native scroll-to behaviour because their pathname never changes.
document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest('a');
  if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return;
  if (url.pathname === location.pathname && url.hash) return; // in-page anchor
  e.preventDefault();
  navigate(url.pathname);
});

window.addEventListener('popstate', route);
window.addEventListener('hashchange', route); // legacy #/<id> links, tooling
route();
