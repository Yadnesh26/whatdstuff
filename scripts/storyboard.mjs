// One image that shows a whole video before you render it: every shot at the
// pose it will actually be framed at, with its caption and narration printed
// underneath.
//
//   node scripts/storyboard.mjs <explainer-id> [--format short|long] [--port 5199]
//                               [--out renders]
//
// Framing, copy and caption reviewed together, once, instead of discovering a
// problem in a finished MP4 (docs/video-pipeline-plan.md §7e). It runs the same
// auto-framing solver the exporter does, so what you see here is what will be
// captured — but it costs one screenshot per shot rather than a full render.
//
// Writes renders/<id>/<format>-storyboard.png.
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith('--'));
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
if (!id) {
  console.error('usage: node scripts/storyboard.mjs <explainer-id> [--format short|long]');
  process.exit(1);
}

const videoJsPath = resolve(`src/explainers/${id}/video.js`);
if (!existsSync(videoJsPath)) {
  console.error(`${videoJsPath} not found — write the editorial layer first.`);
  process.exit(1);
}
const editorial = (await import(pathToFileURL(videoJsPath))).default;
const cfg = editorial.render ?? {};
const format = opt('format', cfg.defaultFormat ?? 'short');
const port = opt('port', String(cfg.port ?? 5199));
const outRoot = resolve(opt('out', 'renders'), id);
const pick = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v[format] : v);

const shots = editorial[format]?.shots ?? [];
if (!shots.length) {
  console.error(`no ${format}.shots in ${videoJsPath}`);
  process.exit(1);
}

const short = format === 'short';
const viewport = short ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 };
const autoFrame = cfg.autoFrame ?? true;
const captions = pick(cfg.captions) ?? false;
const baseFill = pick(cfg.fill) ?? (short ? 0.88 : 0.78);
const baseBias = pick(cfg.bias) ?? (captions ? (short ? 0.1 : 0.04) : 0);

mkdirSync(outRoot, { recursive: true });

const browser = await chromium.launch({
  channel: 'chromium',
  args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error(`[page exception] ${e.message}`));
// Same export-mode stub the exporter and the gates use: FOV_REF, no mobile
// correction, no hero bob. rAF is NOT stubbed here, so fly-tos still play in
// real time and a plain wait is enough to let one settle.
await page.addInitScript(() => {
  window.__vt = { advance() {}, now: () => 0 };
});
await page.goto(`http://localhost:${port}/#/${id}`);
await page.waitForFunction(() => window.__hiw?.stepRuntimes?.length > 0, null, {
  timeout: 180000,
  polling: 500,
});
await page.waitForTimeout(2500);
await page.addStyleTag({
  content: `.player-hero, .steps, .rail, .back-link, .scroll-hint { display: none !important; }
            body { overflow: hidden; }`,
});

const cards = [];
for (const [si, shot] of shots.entries()) {
  await page.evaluate((n) => window.__hiw.activate(n), shot.step);
  if (shot.labels !== undefined) {
    await page.evaluate((wanted) => {
      const want = new Set(wanted);
      window.__hiw.stage.scene.traverse((o) => {
        if (!o.isCSS2DObject || !o.element || !o.visible) return;
        const tx = o.element.querySelector('.callout-text');
        o.visible = want.has(tx ? tx.textContent : '');
      });
    }, shot.labels);
  }
  const measured = await page.evaluate(
    ({ shot, autoFrame, baseFill, baseBias }) => {
      // Measure the pose being flown TO, not the live camera: flyTo is a 1300ms
      // animation, so reading stage.camera here would measure the previous
      // shot's framing mid-flight and report nonsense.
      let pose;
      if (shot.camera) {
        pose = shot.camera;
        window.__hiw.flyTo(pose);
      } else if (autoFrame) {
        pose = window.__hiw.frameTo({
          keys: shot.frame,
          fill: shot.fill ?? baseFill,
          bias: shot.bias ?? baseBias,
        });
      }
      return window.__hiw.projectSubject({ pose, keys: shot.frame });
    },
    { shot, autoFrame, baseFill, baseBias },
  );
  await page.waitForTimeout(1600); // the fly-to is 1300ms
  const png = await page.screenshot({ type: 'jpeg', quality: 80 });
  cards.push({
    si,
    step: shot.step,
    src: `data:image/jpeg;base64,${png.toString('base64')}`,
    caption: shot.caption ?? null,
    narration: shot.narration ?? '',
    labels: shot.labels,
    how: shot.camera ? 'authored camera' : autoFrame ? `solved · fill ${shot.fill ?? baseFill}` : 'legacy dolly',
    cover: measured
      ? `${(measured.coverW * 100).toFixed(0)}%w ${(measured.coverH * 100).toFixed(0)}%h${measured.cropped ? ' · CROPS' : ''}`
      : 'no subject',
  });
  console.log(`  shot ${si + 1}/${shots.length} (step ${shot.step + 1}) — ${cards[cards.length - 1].cover}`);
}

// --- compose the sheet ------------------------------------------------------
// Laid out as HTML and screenshotted, rather than tiled with ffmpeg drawtext:
// the narration has to wrap, and wrapping prose is what a browser is for.
const esc = (s) =>
  String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const cardW = short ? 200 : 320;
const html = `<!doctype html><meta charset="utf-8"><style>
  body { margin:0; background:#12141a; color:#e8ecf4; font:13px/1.45 system-ui,Segoe UI,sans-serif; padding:24px; }
  h1 { font-size:18px; margin:0 0 4px; font-weight:650; }
  .sub { color:#8b93a7; font-size:12px; margin:0 0 20px; }
  .grid { display:flex; flex-wrap:wrap; gap:16px; align-items:flex-start; }
  .card { width:${cardW}px; background:#1b1e26; border:1px solid #272b36; border-radius:8px; overflow:hidden; }
  .card img { display:block; width:100%; }
  .meta { padding:8px 10px 10px; }
  .hd { display:flex; justify-content:space-between; color:#8b93a7; font-size:11px; margin-bottom:6px; }
  .cover { color:#7fa7ff; }
  .crops { color:#ff9b6b; }
  .cap { color:#ffd479; font-size:12px; margin:0 0 6px; }
  .nar { margin:0; color:#c3cad9; font-size:12px; }
  .lab { margin:6px 0 0; color:#6f7889; font-size:11px; }
</style>
<h1>${esc(id)} — ${esc(format)} storyboard</h1>
<p class="sub">${shots.length} shots · framing solved exactly as the exporter will · captions/narration as written</p>
<div class="grid">
${cards
  .map(
    (c) => `<div class="card">
  <img src="${c.src}">
  <div class="meta">
    <div class="hd"><span>shot ${c.si + 1} · step ${c.step + 1}</span><span class="${c.cover.includes('CROPS') ? 'crops' : 'cover'}">${esc(c.cover)}</span></div>
    <div class="hd"><span>${esc(c.how)}</span>${c.labels ? `<span>${c.labels.length} label${c.labels.length === 1 ? '' : 's'}</span>` : ''}</div>
    ${c.caption ? `<p class="cap">“${esc(c.caption)}”</p>` : ''}
    <p class="nar">${esc(c.narration) || '<em style="color:#6f7889">no narration</em>'}</p>
  </div>
</div>`,
  )
  .join('\n')}
</div>`;

const sheetPage = await browser.newPage({
  viewport: { width: Math.min(1800, 24 * 2 + (cardW + 16) * Math.min(shots.length, 6)), height: 1200 },
});
await sheetPage.setContent(html, { waitUntil: 'load' });
const outPath = join(outRoot, `${format}-storyboard.png`);
await sheetPage.screenshot({ path: outPath, fullPage: true });
await browser.close();

console.log(`\nstoryboard: ${outPath}`);
