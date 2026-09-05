// Mechanical gates for an explainer's VIDEO export — the things that used to be
// found by watching the finished MP4.
//
//   node scripts/verify-video.mjs <explainer-id> [--format short|long] [--port 5199]
//
// Prints VIDEO PASS / VIDEO FAIL. Complements scripts/verify.mjs, which gates
// the interactive explainer; this one gates the shot list in video.js against
// the frame it will actually be rendered into.
//
// Gates (docs/video-pipeline-plan.md §7):
//   framing        every shot's subject is on screen, big enough, and centred
//   caption-width  no cue group overflows the frame at the preset's real font
//   caption-clash  the caption rail does not sit across the subject
//   labels         every `labels:` entry matches a callout that actually exists
//
// It boots the page with a stubbed __vt so stage.js pins FOV_REF and leaves the
// mobile portrait correction off — measuring against any other camera would be
// measuring a shot nobody is going to render.
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolvePreset, groupWords, DEFAULT_PRESET } from './caption-style.mjs';

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith('--'));
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
if (!id) {
  console.error('usage: node scripts/verify-video.mjs <explainer-id> [--format short|long]');
  process.exit(1);
}

const videoJsPath = resolve(`src/explainers/${id}/video.js`);
if (!existsSync(videoJsPath)) {
  console.error(`${videoJsPath} not found — nothing to verify.`);
  process.exit(1);
}
const editorial = (await import(pathToFileURL(videoJsPath))).default;
const cfg = editorial.render ?? {};
const format = opt('format', cfg.defaultFormat ?? 'short');
const port = opt('port', String(cfg.port ?? 5199));
const pick = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v[format] : v);

const shots = editorial[format]?.shots ?? [];
if (!shots.length) {
  console.error(`no ${format}.shots in ${videoJsPath}`);
  process.exit(1);
}

const viewport =
  format === 'short' ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 };
const autoFrame = cfg.autoFrame ?? true;
const captions = pick(cfg.captions) ?? false;
const baseFill = pick(cfg.fill) ?? (format === 'short' ? 0.88 : 0.78);
const baseBias = pick(cfg.bias) ?? (captions ? (format === 'short' ? 0.1 : 0.04) : 0);
const preset = resolvePreset(pick(cfg.captionStyle) ?? DEFAULT_PRESET, format, viewport);

// Thresholds. Deliberately loose: this gate exists to catch a shot that is
// broken, not to police composition. Anything an author pinned with an explicit
// `camera` is exempt from the centring check — that IS the art direction.
const MIN_COVER = 0.28; // subject must occupy at least this much of one axis
const MAX_OFFSET = 0.18; // centroid distance from frame centre, NDC

const results = [];
const gate = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok === true ? ' ok ' : ok === 'warn' ? 'warn' : 'FAIL'}  ${name.padEnd(15)} ${detail}`);
};

const browser = await chromium.launch({
  channel: 'chromium',
  args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error(`[page exception] ${e.message}`));
// Make the page believe it is an export: FOV_REF, no mobile correction, no
// hero bob. The advance/now stubs are never called — nothing here animates.
await page.addInitScript(() => {
  window.__vt = { advance() {}, now: () => 0 };
});
await page.goto(`http://localhost:${port}/#/${id}`);
try {
  await page.waitForFunction(() => window.__hiw?.stepRuntimes?.length > 0, null, {
    timeout: 180000,
    polling: 500,
  });
} catch {
  console.error(`player did not boot on :${port} — is the dev server running?`);
  await browser.close();
  process.exit(1);
}
await page.waitForTimeout(2000);

const stepCount = await page.evaluate(() => window.__hiw.stepRuntimes.length);

// --- gate: shot indices are in range ---------------------------------------
const badStep = shots.filter((s) => s.step >= stepCount);
gate(
  'shot-steps',
  badStep.length === 0,
  badStep.length === 0
    ? `${shots.length} shots, all within ${stepCount} steps`
    : `shots reference missing steps: ${badStep.map((s) => s.step).join(', ')}`,
);

// --- gate: framing ----------------------------------------------------------
const framingProblems = []; // solver failures — these fail the run
const framingWarnings = []; // same issues on an author-pinned camera — reported only
const shotRects = [];
for (const [si, shot] of shots.entries()) {
  if (shot.step >= stepCount) {
    shotRects.push(null);
    continue;
  }
  await page.evaluate((n) => window.__hiw.activate(n), shot.step);
  await page.waitForTimeout(120);
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
  const rect = await page.evaluate(
    ({ shot, autoFrame, baseFill, baseBias }) => {
      const pose = shot.camera
        ? shot.camera
        : autoFrame
          ? window.__hiw.frameSubject({
              keys: shot.frame,
              fill: shot.fill ?? baseFill,
              bias: shot.bias ?? baseBias,
            })
          : undefined;
      return window.__hiw.projectSubject({ pose, keys: shot.frame });
    },
    { shot, autoFrame, baseFill, baseBias },
  );
  shotRects.push(rect);
  // A shot that pins its own `camera` is art direction: a deliberate macro that
  // runs past the frame edge is a choice, not a defect, so its problems are
  // reported as warnings. A shot the SOLVER framed has no such excuse — if that
  // one crops or comes out tiny, the pipeline got it wrong and must fail.
  const bucket = shot.camera ? framingWarnings : framingProblems;
  if (!rect) {
    framingProblems.push(`shot ${si}: no subject geometry found`);
    continue;
  }
  // `bias` is the INTENDED lift, so it has to be subtracted out before the
  // residual is measured. frameSubject slides the subject UP by `bias` frame
  // heights and projectSubject returns Three.js NDC (+y up, full height 2), so
  // a correctly framed captioned shot sits at centre[1] ≈ +bias*2. Adding it
  // instead double-counted the lift and failed every such shot at ~0.35 — which
  // no run ever caught, because bias is 0 whenever captions are off and this is
  // the repo's first captioned format.
  const off = Math.hypot(rect.centre[0], rect.centre[1] - (shot.bias ?? baseBias) * 2);
  if (rect.cropped) bucket.push(`shot ${si}: subject crops the frame`);
  else if (Math.max(rect.coverW, rect.coverH) < MIN_COVER) {
    bucket.push(
      `shot ${si}: subject fills only ${(rect.coverW * 100).toFixed(0)}%w/${(rect.coverH * 100).toFixed(0)}%h`,
    );
  } else if (!shot.camera && off > MAX_OFFSET) {
    framingProblems.push(`shot ${si}: subject ${(off * 100).toFixed(0)}% off centre`);
  }
}
const framedCovers = shotRects.filter(Boolean).map((r) => Math.max(r.coverW, r.coverH));
gate(
  'framing',
  framingProblems.length ? false : framingWarnings.length ? 'warn' : true,
  framingProblems.length
    ? framingProblems.slice(0, 4).join(' | ')
    : framingWarnings.length
      ? `authored cameras: ${framingWarnings.slice(0, 3).join(' | ')}`
      : `${shots.length} shots framed (min cover ${(Math.min(...framedCovers) * 100).toFixed(0)}%)`,
);

// --- gate: labels name real callouts ---------------------------------------
const allLabels = await page.evaluate(() => {
  const out = new Set();
  window.__hiw.stage.scene.traverse((o) => {
    if (!o.isCSS2DObject || !o.element?.classList.contains('callout')) return;
    const tx = o.element.querySelector('.callout-text');
    if (tx) out.add(tx.textContent);
  });
  return [...out];
});
const missingLabels = [];
for (const [si, shot] of shots.entries()) {
  for (const l of shot.labels ?? []) if (!allLabels.includes(l)) missingLabels.push(`shot ${si}: "${l}"`);
}
gate(
  'labels',
  missingLabels.length === 0,
  missingLabels.length === 0
    ? `every labels[] entry matches a callout`
    : `no such callout — ${missingLabels.slice(0, 4).join(', ')}`,
);

// --- gates: captions --------------------------------------------------------
// Only meaningful once narration exists; a script that has not been synthesized
// yet has no word timing to group, and guessing from the prose would gate on
// text the viewer will never see.
const wordsPath = resolve('renders', id, 'audio', `${format}-words.json`);
if (!captions) {
  gate('captions', 'warn', 'captions off for this format — caption gates skipped');
} else if (!existsSync(wordsPath)) {
  gate('captions', 'warn', `no ${format}-words.json yet — run make-narration.mjs, then re-verify`);
} else {
  const words = JSON.parse(readFileSync(wordsPath, 'utf8'));
  const groups = groupWords(words, preset);
  // Available width is the frame minus the ASS left/right margins (60 each).
  const available = viewport.width - 120;
  const over = await page.evaluate(
    ({ texts, font, avail }) => {
      const ctx = document.createElement('canvas').getContext('2d');
      ctx.font = font;
      return texts
        .map((t, i) => ({ i, t, w: Math.round(ctx.measureText(t).width) }))
        .filter((r) => r.w > avail);
    },
    {
      texts: groups.map((g) => g.map((w) => w.t).join(' ')),
      font: `${preset.fontSize}px "${preset.fontName}"`,
      avail: available,
    },
  );
  gate(
    'caption-width',
    over.length === 0,
    over.length === 0
      ? `${groups.length} cue groups all under ${available}px at ${preset.fontSize}px ${preset.fontName}`
      : `${over.length} group(s) overflow → libass will wrap and shift the block: ${over
          .slice(0, 2)
          .map((r) => `"${r.t}" ${r.w}px`)
          .join(', ')}`,
  );

  // The caption block occupies a fixed band; a subject overlapping it is a
  // warning, not a failure — plenty of shots legitimately have geometry down
  // there, and the bias knob is the fix when it actually matters.
  const bandTop = 1 - (2 * preset.capMarginV) / viewport.height;
  const bandBottom = 1 - (2 * (preset.capMarginV + 2 * preset.lineHeight)) / viewport.height;
  const clash = shotRects
    .map((r, si) => (r && r.min[1] < bandTop && r.max[1] > bandBottom ? si : null))
    .filter((v) => v !== null);
  gate(
    'caption-clash',
    clash.length === 0 ? true : 'warn',
    clash.length === 0
      ? 'caption rail clear of every subject'
      : `subject overlaps the caption band on shot(s) ${clash.join(', ')} — raise \`bias\` if it reads badly`,
  );
}

await browser.close();

const fails = results.filter((r) => r.ok === false);
const warns = results.filter((r) => r.ok === 'warn');
console.log('');
if (fails.length) {
  console.log(`VIDEO FAIL — ${fails.map((f) => f.name).join(', ')}`);
  process.exit(1);
}
console.log(`VIDEO PASS${warns.length ? ` (warnings: ${warns.map((w) => w.name).join(', ')})` : ''}`);
