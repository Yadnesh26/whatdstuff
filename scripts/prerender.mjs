// Post-build static-shell generator — runs after `vite build`.
//
//   node scripts/prerender.mjs
//
// Turns the single dist/index.html the SPA build produces into one real
// static document per explainer and per category: dist/<id>/index.html with
// a genuine <title>, meta description, canonical, OG tags, and every step
// heading/body as literal text in the markup — so a crawler that never runs
// JavaScript still sees the whole page, and one that does gets the exact
// same content the client-side mount produces a moment later. Also emits
// dist/sitemap.xml (with inline <image:image> entries for the plates).
//
// Step heading/body/hint text is read by regex straight off each
// explainer's index.js SOURCE FILE, never by importing it. Importing would
// pull in framework/registry.js's import.meta.glob, which is a Vite-only
// construct that throws under plain Node — and CLAUDE.md rule 2 warns that
// statically importing an explainer from shared code kills the per-explainer
// lazy chunk split. Reading source text as a string touches nothing Vite
// has to bundle, so the split this script's own output depends on (each
// explainer's real page still boots its own lazy chunk) can't regress.
//
// meta.js and categories.js ARE safe to import directly: both are plain
// data modules with no Vite-only syntax.
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const SITE = 'https://www.whatdstuff.com';
const DIST = resolve('dist');
const EXPLAINERS_DIR = resolve('src/explainers');

// Plate filenames carry the query language people actually search
// ("3d animation") rather than the bare id — true for every explainer
// regardless of whether the subject is a physical machine or a concept
// (binary-search, black-hole), unlike a word like "cutaway" would be.
// Keep in sync with scripts/make-plates.mjs, which writes this same name.
const plateFile = (id) => `${id}-3d-animation.jpg`;

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('dist/index.html not found — run `vite build` before prerender.mjs');
  process.exit(1);
}

const shellHtml = readFileSync(join(DIST, 'index.html'), 'utf8');
// Pull the built <script>/<link> tags (hashed asset URLs) straight out of
// the shell Vite just produced, so every prerendered page boots the exact
// same bundle without this script having to know the hash itself.
const headAssets = [...shellHtml.matchAll(/<(?:script|link)[^>]*>(?:<\/script>)?/g)]
  .map((m) => m[0])
  .filter((tag) => tag.includes('/assets/'))
  .join('\n    ');
if (!headAssets) throw new Error('no /assets/ script or link tags found in dist/index.html');

const esc = (s = '') =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function lastmod(relPath) {
  try {
    const out = execSync(`git log -1 --format=%cI -- "${relPath}"`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'], // silence git's stderr when there's no repo/history yet
    }).trim();
    if (out) return out;
  } catch {
    /* not tracked yet, or not a git checkout — fall through */
  }
  return new Date().toISOString();
}

function metaDescription(meta) {
  let d = (meta.summary ?? '').trim();
  if (meta.spec && `${d} — ${meta.spec}`.length <= 160) d = `${d} — ${meta.spec}`;
  return d.length > 160 ? `${d.slice(0, 157).trimEnd()}…` : d;
}

// --- article.js — the hand-authored SEO article beneath each 3D scene -----
// A plain data module (no imports, just an exported object — same shape as
// video.js), so it's safe to import directly like meta.js/categories.js.
// Optional per explainer: most don't have one yet (see docs/seo-plan.md §C1
// for the rollout). Every field inside is ALSO optional — each render
// helper below checks its own field independently, so a half-finished
// article.js still improves the page instead of being all-or-nothing.
async function loadArticle(id) {
  const p = join(EXPLAINERS_DIR, id, 'article.js');
  if (!existsSync(p)) return null;
  try {
    const mod = await import(pathToFileURL(p).href);
    return mod.default ?? null;
  } catch (e) {
    // Warn and skip, don't fail the other 47 pages over one explainer's
    // typo — unlike readSteps()'s throw-on-ambiguity above, this is real JS
    // being imported, not regex-parsed untrusted string boundaries, so a
    // mistake here is just a missing section, not a silent-corruption risk.
    console.warn(`${id}/article.js: failed to load, skipping article section — ${e.message}`);
    return null;
  }
}

function directAnswerHtml(d) {
  if (!d?.question || !d?.answer) return '';
  return `
      <section class="article-answer">
        <h2>${esc(d.question)}</h2>
        <p>${esc(d.answer)}</p>
      </section>`;
}

function partsHtml(parts) {
  if (!parts?.length) return '';
  const items = parts
    .map((p) => `<li><strong>${esc(p.name)}</strong> — ${esc(p.body)}</li>`)
    .join('');
  return `
      <section class="article-parts">
        <h2>The parts</h2>
        <ul>${items}</ul>
      </section>`;
}

function numbersHtml(numbers) {
  if (!numbers?.length) return '';
  const rows = numbers
    .map(
      (n) => `<tr><td>${esc(n.label)}</td><td>${esc(n.value)}</td><td>${esc(n.note ?? '')}</td></tr>`,
    )
    .join('');
  return `
      <section class="article-numbers">
        <h2>Numbers that matter</h2>
        <table>
          <thead><tr><th>Figure</th><th>Value</th><th>Note</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </section>`;
}

// Shared by faq and failureModes — same {q, a} shape, different heading.
function qaHtml(heading, items) {
  if (!items?.length) return '';
  const blocks = items
    .map((i) => `<div><h3>${esc(i.q)}</h3><p>${esc(i.a)}</p></div>`)
    .join('');
  return `
      <section class="article-qa">
        <h2>${esc(heading)}</h2>
        ${blocks}
      </section>`;
}

// --- step copy, read from source text, never imported ---------------------
// One step object per `heading:` match; any `body:`/`hint:` string that
// follows before the next `heading:` belongs to that step — true for every
// explainer today because the defineExplainer API always writes heading
// first (see README's authoring example). A step written any other way
// still fails loudly below rather than silently shipping wrong copy.
//
// index.js itself is only ever read as text (importing it would pull in the
// Vite-only registry glob and kill the lazy chunk split — see the header).
// A step body MAY however interpolate `${…}` from a PURE sibling data module
// (google-maps/graph.js computes its own settle counts by running the real
// algorithms); those specific modules are safe to import, so readSteps()
// resolves the interpolation by importing just them. model.js is still
// off-limits (it pulls three.js).
const COPY_MODULE_DENYLIST = new Set(['index.js', 'model.js']);

// Parse `import * as G from './graph.js'` / `import { a, b as c } from './x.js'`
// / `import D from './x.js'` — relative siblings only, .js only, denylist
// applied. Returns local name -> { file, kind, imported }.
function importedBindings(src) {
  const map = new Map();
  const re =
    /import\s+(?:(\*\s*as\s+[A-Za-z_$][\w$]*)|(\{[^}]*\})|([A-Za-z_$][\w$]*))\s+from\s+(['"])(\.\/[^'"]+)\4/g;
  for (const m of src.matchAll(re)) {
    const [, ns, named, def, , spec] = m;
    const file = spec.replace(/^\.\//, '');
    if (!file.endsWith('.js') || COPY_MODULE_DENYLIST.has(file)) continue;
    if (ns) {
      map.set(ns.replace(/\*\s*as\s+/, '').trim(), { file, kind: 'ns' });
    } else if (named) {
      for (const part of named.slice(1, -1).split(',')) {
        const mm = part.trim().match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
        if (mm) map.set(mm[2] || mm[1], { file, kind: 'named', imported: mm[1] });
      }
    } else if (def) {
      map.set(def, { file, kind: 'default' });
    }
  }
  return map;
}

const _siblingCache = new Map();
function importSibling(id, file) {
  const key = `${id}/${file}`;
  if (!_siblingCache.has(key)) {
    _siblingCache.set(key, import(pathToFileURL(join(EXPLAINERS_DIR, id, file)).href));
  }
  return _siblingCache.get(key);
}

// Resolve a step string that uses `${…}` interpolation. Only identifiers
// bound to a pure sibling data module can be resolved; anything else throws
// the loud error so wrong copy never ships silently.
async function resolveInterpolated(id, raw, bindings) {
  const refs = [...raw.matchAll(/\$\{([^}]+)\}/g)].map((m) => m[1]);
  const roots = new Set();
  for (const expr of refs) {
    // leading identifier of each dotted path (skip anything after a `.`)
    for (const r of expr.matchAll(/(?:^|[^.\w$])([A-Za-z_$][\w$]*)/g)) roots.add(r[1]);
  }
  const names = [];
  const values = [];
  for (const name of roots) {
    if (['true', 'false', 'null', 'undefined', 'Math', 'Number', 'String'].includes(name)) continue;
    const b = bindings.get(name);
    if (!b) {
      throw new Error(
        `${id}/index.js: step text interpolates \${${refs.join('}, ${')}} but "${name}" is ` +
          `not imported from a pure sibling data module — rewrite that step as a plain ` +
          `string, or move the value into a data-only module and import it.`,
      );
    }
    const mod = await importSibling(id, b.file);
    names.push(name);
    values.push(b.kind === 'ns' ? mod : b.kind === 'default' ? mod.default : mod[b.imported]);
  }
  // eslint-disable-next-line no-new-func
  const out = new Function(...names, `return \`${raw}\`;`)(...values);
  return String(out).replace(/\s+/g, ' ').trim();
}

async function readSteps(id) {
  const src = readFileSync(join(EXPLAINERS_DIR, id, 'index.js'), 'utf8');
  const bindings = importedBindings(src);
  const re = /\b(heading|body|hint)\s*:\s*(['"`])((?:\\.|(?!\2)[\s\S])*)\2/g;
  const steps = [];
  let cur = null;
  for (const m of src.matchAll(re)) {
    const [, key, , raw] = m;
    const text = raw.includes('${')
      ? await resolveInterpolated(id, raw, bindings)
      : raw
          .replace(/\\'/g, "'")
          .replace(/\\"/g, '"')
          .replace(/\\`/g, '`')
          .replace(/\\n/g, ' ')
          .trim();
    if (key === 'heading') {
      cur = { heading: text, body: '', hint: '' };
      steps.push(cur);
      continue;
    }
    if (cur) cur[key] = text;
  }
  if (!steps.length) throw new Error(`${id}/index.js: no steps found — readSteps() regex may be stale`);
  return steps;
}

// --- registry, read without importing anything Vite-only ------------------
const explainerIds = readdirSync(EXPLAINERS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(EXPLAINERS_DIR, d.name, 'meta.js')))
  .map((d) => d.name)
  .sort();

const metas = [];
for (const id of explainerIds) {
  const mod = await import(pathToFileURL(join(EXPLAINERS_DIR, id, 'meta.js')).href);
  metas.push(mod.default);
}
metas.sort((a, b) => a.title.localeCompare(b.title));

const { categories, itemsIn } = await import(pathToFileURL(resolve('src/categories.js')).href);

// --- page shell -------------------------------------------------------------
function page({ title, description, canonical, ogType = 'article', image, body }) {
  const imageTags = image
    ? `<meta property="og:image" content="${image.url}" />
    <meta property="og:image:width" content="${image.width}" />
    <meta property="og:image:height" content="${image.height}" />
    <meta name="twitter:image" content="${image.url}" />`
    : '';
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${canonical}" />
    <meta property="og:type" content="${ogType}" />
    <meta property="og:site_name" content="whatDstuff" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${canonical}" />
    ${imageTags}
    <meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/site.webmanifest" />
    ${headAssets}
  </head>
  <body>
    <div id="app">${body}</div>
  </body>
</html>
`;
}

async function explainerBody(meta) {
  const categoryId = meta.categories?.[0];
  const category = categoryId ? categories[categoryId] : null;
  const breadcrumb = `
    <nav aria-label="Breadcrumb">
      <a href="/">whatDstuff</a>
      ${category ? ` › <a href="/${categoryId}">${esc(category.title)}</a>` : ''}
      › <span>${esc(meta.title)}</span>
    </nav>`;

  const steps = await readSteps(meta.id);
  // Index badge stays a separate element from the heading text — some step
  // headings already carry their own number ("1 · Suck"), and concatenating
  // a second one ("02 · 1 · Suck") double-counts. Mirrors the live player's
  // own markup (framework/player.js: .panel-num sits beside <h2>, never
  // inside it), so the prerendered and hydrated DOM read the same way.
  const stepsHtml = steps
    .map(
      (s, i) => `
      <section>
        <p><span>Step ${String(i + 1).padStart(2, '0')} of ${String(steps.length).padStart(2, '0')}</span></p>
        <h2>${esc(s.heading)}</h2>
        <p>${esc(s.body)}</p>
      </section>`,
    )
    .join('');

  const article = await loadArticle(meta.id);

  return `
    <article>
      ${breadcrumb}
      <header>
        <h1>${esc(meta.title)}</h1>
        <p>${esc(meta.summary ?? '')}</p>
        <img src="/plates/${plateFile(meta.id)}" alt="${esc(meta.title)} — interactive 3D animation" width="720" height="450" loading="eager" />
      </header>
      ${directAnswerHtml(article?.directAnswer)}
      ${stepsHtml}
      ${partsHtml(article?.parts)}
      ${numbersHtml(article?.numbers)}
      ${qaHtml('Common questions', article?.faq)}
      ${qaHtml('What goes wrong', article?.failureModes)}
    </article>`;
}

function categoryBody(catId) {
  const cat = categories[catId];
  const items = itemsIn(catId, metas);
  const list = items
    .map((e) => `<li><a href="/${e.id}">${esc(e.title)}</a> — ${esc(e.summary ?? '')}</li>`)
    .join('');
  return `
    <article>
      <nav aria-label="Breadcrumb"><a href="/">whatDstuff</a> › <span>${esc(cat.title)}</span></nav>
      <header>
        <h1>${esc(cat.title)}</h1>
        <p>${esc(cat.blurb ?? '')}</p>
      </header>
      <ul>${list}</ul>
    </article>`;
}

// --- write explainer pages --------------------------------------------------
mkdirSync(DIST, { recursive: true });
const sitemapUrls = [];

for (const meta of metas) {
  const canonical = `${SITE}/${meta.id}`;
  const title = `${meta.title} — Interactive 3D | whatDstuff`;
  const outDir = join(DIST, meta.id);
  mkdirSync(outDir, { recursive: true });
  const plateRel = `public/plates/${plateFile(meta.id)}`;
  const plateUrl = existsSync(resolve(plateRel)) ? `${SITE}/plates/${plateFile(meta.id)}` : null;
  writeFileSync(
    join(outDir, 'index.html'),
    page({
      title,
      description: metaDescription(meta),
      canonical,
      image: plateUrl ? { url: plateUrl, width: 720, height: 450 } : null,
      body: await explainerBody(meta),
    }),
  );
  sitemapUrls.push({
    loc: canonical,
    lastmod: lastmod(`src/explainers/${meta.id}`),
    image: plateUrl,
  });
}

// --- write category pages ---------------------------------------------------
let catPages = 0;
for (const [catId, cat] of Object.entries(categories)) {
  const representative = itemsIn(catId, metas)[0];
  // A category no explainer claims yet renders as nothing on the home page —
  // don't ship it an empty static page or a sitemap entry pointing at one.
  if (!representative) continue;
  const outDir = join(DIST, catId);
  mkdirSync(outDir, { recursive: true });
  const catPlateRel = representative ? `public/plates/${plateFile(representative.id)}` : null;
  const catPlateUrl =
    catPlateRel && existsSync(resolve(catPlateRel)) ? `${SITE}/plates/${plateFile(representative.id)}` : null;
  writeFileSync(
    join(outDir, 'index.html'),
    page({
      title: `${cat.title} — whatDstuff`,
      description: cat.blurb ?? `${cat.title} — interactive 3D explainers.`,
      canonical: `${SITE}/${catId}`,
      ogType: 'website',
      image: catPlateUrl ? { url: catPlateUrl, width: 720, height: 450 } : null,
      body: categoryBody(catId),
    }),
  );
  sitemapUrls.push({ loc: `${SITE}/${catId}`, lastmod: lastmod('src/categories.js'), image: catPlateUrl });
  catPages += 1;
}

// home page's own lastmod, from the source shell rather than the built one
sitemapUrls.unshift({ loc: `${SITE}/`, lastmod: lastmod('index.html'), image: null });

// --- sitemap.xml, with inline image entries for the plates ------------------
const IMAGE_NS = 'http://www.google.com/schemas/sitemap-image/1.1';
const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="${IMAGE_NS}">
${sitemapUrls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>${
      u.image ? `\n    <image:image><image:loc>${u.image}</image:loc></image:image>` : ''
    }
  </url>`,
  )
  .join('\n')}
</urlset>
`;
writeFileSync(join(DIST, 'sitemap.xml'), sitemapXml);

console.log(`prerendered ${metas.length} explainer pages + ${catPages} category pages`);
console.log(`wrote dist/sitemap.xml (${sitemapUrls.length} urls)`);
