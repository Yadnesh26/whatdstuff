// Render an explainer to video by driving a virtualized clock frame-by-frame.
//
//   node scripts/export-video.mjs <explainer-id> [--format short|long] [--port 5199]
//                                 [--fps 30] [--out renders] [--keep-frames]
//                                 [--captions] [--endcard] [--no-auto-frame]
//                                 [--fill 0.88] [--force-frames]
//
// How it works: every animation in the app (anime.js engine, three's
// setAnimationLoop, camera fly-tos) is driven by requestAnimationFrame +
// performance.now. We stub both in the page with a manual clock, advance it
// exactly 1000/fps ms per captured frame, and screenshot each frame — the
// result is deterministic and perfectly smooth regardless of render cost.
//
// The shot list comes from src/explainers/<id>/video.js (editorial layer:
// which steps, how long, captions, narration). Falls back to "every step,
// 8s each" when video.js doesn't exist yet. Options default from that file's
// `render` block; a CLI flag always wins over it.
//
// AUTO-FRAMING (default on): each shot's camera is solved from the subject's
// real world bounds — player.js frameSubject() — instead of the old guessed
// `dolly` scalar, which could zoom out but never recentre. `--no-auto-frame`
// reproduces a pre-solver render.
//
// The run is in two halves. This file captures frames and encodes the silent
// master; finish-video.mjs burns captions/overlays and mixes audio. The master
// is CACHED against a hash of its real inputs, so re-cutting captions or
// re-recording narration of the same length skips frame capture entirely.
//
// Output (renders/<id>/):
//   <format>-master.mp4    silent, no captions — the reusable master
//   <format>-master.hash   cache key for the above
//   <format>-render.json   viewport/duration/audio offsets, for finish-video
//   <format>-captioned.mp4 captions burned in (skipped if no captions)
//   <format>-final.mp4     captioned + narration/sfx mixed (skipped if no audio)
//   <format>-timeline.json shot → [start,end] seconds, for audio/caption sync
import { chromium } from 'playwright';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { finishVideo } from './finish-video.mjs';
import { DEFAULT_PRESET } from './caption-style.mjs';

const require = createRequire(import.meta.url);
const ffmpeg = require('ffmpeg-static');

// --- args --------------------------------------------------------------
const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith('--'));
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const flag = (name) => args.includes(`--${name}`);
if (!id) {
  console.error('usage: node scripts/export-video.mjs <explainer-id> [--format short|long] [--port 5199] [--fps 30]');
  process.exit(1);
}

// --- editorial layer (video.js) -----------------------------------------
// Loaded BEFORE options are resolved: the `render` block inside it supplies
// their defaults (see below), so it cannot wait until after them.
const videoJsPath = resolve(`src/explainers/${id}/video.js`);
let editorial = null;
if (existsSync(videoJsPath)) {
  editorial = (await import(pathToFileURL(videoJsPath))).default;
  console.log(`editorial: ${videoJsPath}`);
} else {
  console.log('editorial: none (video.js missing) — rendering every step, 8s each');
}

// --- render config -------------------------------------------------------
// Precedence, always: an explicit CLI flag > the explainer's committed
// `render` block in video.js > the built-in default. The config exists so a
// re-render is reproducible from the repo alone instead of from shell history
// — see docs/video-pipeline-plan.md §4.
//
// Fields may be a plain value or { short, long }; fmtCfg picks this format's.
const cfg = editorial?.render ?? {};
const format = opt('format', cfg.defaultFormat ?? 'long'); // short = 9:16, long = 16:9
const fmtCfg = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v[format] : v);
// A --no-<name> flag always wins over a config `true`, so a committed config
// can be overridden downward for one run without editing the file.
const tri = (name, configured, dflt) =>
  flag(`no-${name}`) ? false : flag(name) ? true : (configured ?? dflt);

const port = opt('port', String(cfg.port ?? 5199));
const fps = Number(opt('fps', String(cfg.fps ?? 24))); // 24 = cinematic and 20% fewer frames
const outRoot = resolve(opt('out', 'renders'), id);
const keepFrames = flag('keep-frames');

// AUTO-FRAMING (default ON). The exporter solves each shot's camera from the
// subject's real world bounds — see player.js frameSubject(). `--no-auto-frame`
// restores the pre-solver behaviour exactly (authored pose + `dolly` scalar),
// which is how an already-approved older render is reproduced byte-for-byte.
const autoFrame = tri('auto-frame', cfg.autoFrame, true);

// Captions are resolved HERE, not down at the burn step, because the framing
// bias below has to know whether a caption rail will be occupying the bottom
// of the frame while the subject is being composed into it.
const wantCaptions = tri('captions', fmtCfg(cfg.captions), false);
// The title and end cards ride the SAME single libass pass as the captions
// (each burn is a full re-encode, so they must not cost extra passes) — hence
// no captions, no overlays at all. Resolved here rather than at the burn step
// because the master cache below has to hand them to finish-video on a hit.
const wantTitle = wantCaptions && tri('title', fmtCfg(cfg.titleCard), true);
// The end card is separately OPT-IN: --endcard, `render.endCard` in the config,
// or a per-explainer `endCard` string in video.js (itself an explicit ask). A
// CTA is an outward-facing promise, never a side effect of wanting captions.
// --no-endcard force-disables any of those.
const wantEndCard =
  wantCaptions &&
  !flag('no-endcard') &&
  (flag('endcard') || fmtCfg(cfg.endCard) === true || editorial?.endCard != null);

const viewport =
  format === 'short'
    ? { width: 1080, height: 1920 }
    : { width: 1920, height: 1080 };

// Fraction of the frame the subject should occupy, and how far UP the frame to
// push it so the burned caption rail does not sit across it. Portrait fills
// tighter (there is no side panel to leave room for) and biases harder (the
// short's rail sits at 15% of frame height with room for two lines above it).
// A scalar means both axes; the config may also give { w, h } (see frameSubject),
// so only a CLI --fill is coerced to a number.
const baseFill = flag('fill') ? Number(opt('fill')) : (fmtCfg(cfg.fill) ?? (format === 'short' ? 0.88 : 0.78));
const baseBias = fmtCfg(cfg.bias) ?? (wantCaptions ? (format === 'short' ? 0.1 : 0.04) : 0);

// --- brand overlays -------------------------------------------------------
// The title/end-card COPY and every caption decision live in finish-video.mjs
// (the burn pass owns them). All this stage needs is the explainer's name, and
// only so it can be handed across.
let metaTitle = null;
const metaPath = resolve(`src/explainers/${id}/meta.js`);
if (existsSync(metaPath)) {
  metaTitle = (await import(pathToFileURL(metaPath))).default?.title ?? null;
}


// --- master cache ---------------------------------------------------------
// The silent master is a pure function of the model, the step definitions, and
// the shot list's framing/timing fields. It does NOT depend on narration
// wording, caption text, caption styling or card copy — so a caption fix should
// cost two fast re-encodes, not a full frame re-render (see
// docs/video-pipeline-plan.md §5).
//
// The narration TIMINGS are an input even though the words are not: the audio
// is the master clock, so a re-recorded take of a different length genuinely
// changes what is on screen when. Hashing the timings file's bytes covers that
// honestly — a re-worded line that happens to land at the identical duration is
// rare enough not to chase.
const SOLVER_VERSION = 1; // bump when frameSubject()'s output changes
const masterPath = join(outRoot, `${format}-master.mp4`);
const masterHashPath = join(outRoot, `${format}-master.hash`);
const renderInfoPath = join(outRoot, `${format}-render.json`);
const timelinePath = join(outRoot, `${format}-timeline.json`);
const timingsFile = join(outRoot, 'audio', `${format}-timings.json`);

const readIf = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

function masterInputsHash() {
  // No editorial means the shot list is derived from the live step count, which
  // this stage cannot know without booting the page — so don't pretend to cache.
  if (!editorial?.[format]?.shots) return null;
  const framingFields = ['step', 'seconds', 'speed', 'dolly', 'camera', 'fill', 'bias', 'frame', 'labels'];
  const shots = editorial[format].shots.map((s) =>
    Object.fromEntries(framingFields.filter((k) => s[k] !== undefined).map((k) => [k, s[k]])),
  );
  const h = createHash('sha1');
  h.update(
    JSON.stringify({
      v: SOLVER_VERSION,
      format,
      fps,
      viewport,
      autoFrame,
      baseFill,
      baseBias,
      shots,
      model: readIf(resolve(`src/explainers/${id}/model.js`)),
      steps: readIf(resolve(`src/explainers/${id}/index.js`)),
      timings: readIf(timingsFile),
    }),
  );
  return h.digest('hex');
}

const inputsHash = masterInputsHash();

function writeMasterHash() {
  if (inputsHash) writeFileSync(masterHashPath, inputsHash);
}

function renderInfo() {
  return {
    viewport,
    videoDuration: Number(clock.toFixed(3)),
    audioDelay,
    continuous,
    fps,
    autoFrame,
    shots: shots.length,
  };
}

// A cache hit skips frame capture entirely and goes straight to the burn + mix.
if (
  !flag('force-frames') &&
  inputsHash &&
  existsSync(masterPath) &&
  existsSync(renderInfoPath) &&
  existsSync(timelinePath) &&
  readIf(masterHashPath).trim() === inputsHash
) {
  const info = JSON.parse(readFileSync(renderInfoPath, 'utf8'));
  console.log(
    `master: CACHED (${format}-master.mp4, ${info.videoDuration}s) — inputs unchanged, skipping ${info.shots} shots. --force-frames to re-render.`,
  );
  finishVideo({
    id,
    format,
    outRoot,
    viewport: info.viewport,
    videoDuration: info.videoDuration,
    audioDelay: info.audioDelay,
    continuous: info.continuous,
    timeline: JSON.parse(readFileSync(timelinePath, 'utf8')),
    editorial,
    metaTitle,
    wantCaptions,
    wantTitle,
    wantEndCard,
    captionStyle: fmtCfg(cfg.captionStyle) ?? DEFAULT_PRESET,
  });
  console.log('done');
  process.exit(0);
}

// --- launch page with virtual clock --------------------------------------
const framesDir = join(outRoot, `${format}-frames`);
rmSync(framesDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });

// Real GPU in headless. TWO things are required, and the flags alone are NOT
// enough: Playwright's default headless runs `chrome-headless-shell`, a build
// with no GPU support at all, so it silently rasterizes WebGL on SwiftShader
// (CPU) at ~2s/frame no matter what flags you pass. `channel: 'chromium'` runs
// the FULL Chromium binary in new-headless mode, which can reach D3D11.
// Verified 2026-08-26 by probing WEBGL_debug_renderer_info under both.
const browser = await chromium.launch({
  channel: 'chromium',
  args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
page.on('console', (m) => {
  if (m.type() === 'error') console.error(`[page error] ${m.text()}`);
});
// uncaught exceptions never reach the console handler above — without this a
// boot failure looks like a bare waitForFunction timeout with no explanation
page.on('pageerror', (e) => console.error(`[page exception] ${e.message}`));

// Must be installed before any page script runs: replace the clock the whole
// app animates on. Real timers (setTimeout/Interval) stay real — they only
// gate boot/loading, not animation.
await page.addInitScript(() => {
  let now = 0;
  let cbs = [];
  let nextId = 1;
  const t0 = Date.now();
  performance.now = () => now;
  Date.now = () => t0 + now;
  window.requestAnimationFrame = (cb) => {
    const id = nextId++;
    cbs.push({ id, cb });
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    cbs = cbs.filter((e) => e.id !== id);
  };
  window.__vt = {
    advance(ms) {
      now += ms;
      const due = cbs;
      cbs = [];
      for (const e of due) e.cb(now);
    },
    now: () => now,
  };
});

// The first shot's dolly must exist BEFORE the player boots: boot flies to
// the first step immediately, and re-activating the same step is a no-op.
// Under auto-framing the solver owns distance outright, so the legacy scalar
// is pinned at 1 and every `dolly` in an old video.js is ignored (the shot's
// `fill` is the knob now) — mixing the two would double-correct.
const baseDolly = autoFrame
  ? 1
  : format === 'short'
    ? Number(editorial?.short?.dolly ?? 1.35)
    : 1;
const firstDolly = autoFrame ? 1 : (editorial?.[format]?.shots?.[0]?.dolly ?? baseDolly);
await page.addInitScript((v) => { window.__hiwCameraScale = v; }, firstDolly);

await page.goto(`http://localhost:${port}/#/${id}`);
// generous: a cold vite server compiles three.js + the explainer chunk on first
// hit, and the heaviest scenes (semi-auto-pistol) can take a while to build +
// warm the D3D11 GPU path under headless
// polling MUST be an interval, never Playwright's default 'raf': the init
// script above replaced requestAnimationFrame with a queue that only drains on
// __vt.advance(), and advance() can't run until this wait resolves. Playwright
// evaluates the predicate once immediately, then schedules every later poll via
// rAF — so with the default the first (always-false) check is the ONLY check
// and this deadlocks until timeout. Same rule for any waitForFunction added to
// this file. (review-shots/verify/make-thumbnails don't stub rAF — they're fine.)
await page.waitForFunction(() => window.__hiw?.stepRuntimes?.length > 0, null, {
  timeout: 180000,
  polling: 500,
});
// real-time wait: HDRI env map + lazy chunks arrive over the network
await page.waitForTimeout(2000);

// video mode: pure 3D — hide every piece of page chrome (CSS2D part labels
// live inside .canvas-holder and stay visible; they're content, not chrome)
await page.addStyleTag({
  content: `
    .player-hero, .steps, .rail, .back-link, .scroll-hint { display: none !important; }
    body { overflow: hidden; }
  `,
});

const stepCount = await page.evaluate(() => window.__hiw.stepRuntimes.length);

// resolve the shot list
const shots =
  editorial?.[format]?.shots ??
  Array.from({ length: stepCount }, (_, i) => ({ step: i, seconds: 8 }));
for (const s of shots) {
  if (s.step >= stepCount) {
    console.error(`shot references step ${s.step}, but ${id} has only ${stepCount} steps`);
    process.exit(1);
  }
}

// --- pacing ----------------------------------------------------------------
// The AUDIO is the clock. Two modes:
//   audio-master (preferred): make-narration.mjs wrote one continuous take
//     (<format>-full.mp3) + per-shot timings (<format>-timings.json). Each
//     shot is held for exactly its narration span; the camera fly-to overlaps
//     the shot's opening words instead of sitting in silence; the single track
//     plays straight through. Result: no inter-line gaps — one performance.
//   legacy per-shot: no timings file — extend each shot to fit its own clip
//     plus a breath (the old behavior, kept for back-compat / Edge fallback).
const FLY_SECONDS = 1.6; // camera fly-to, captured as the first slice of a shot
const LEAD_IN = 0.6; // silent beat over the hero before the voiceover starts
// Hold after the final word. This is the END CARD's window: the card is
// scheduled after the last spoken caption, so a short tail squeezes the CTA
// into an unreadable flash. The final caption also holds ~1s past the last
// word and the card cannot start until that clears (same bottom slot), so the
// tail must cover BOTH: 4s leaves the card ~2.8s, mechanism still looping.
const TAIL_PAD = 4.0;
const frameMs = 1000 / fps;

const audioDir = join(outRoot, 'audio');
const timingsPath = join(audioDir, `${format}-timings.json`);
const fullAudioPath = join(audioDir, `${format}-full.mp3`);
const continuous = existsSync(timingsPath) && existsSync(fullAudioPath);

const audioSeconds = (file) => {
  const r = spawnSync(ffmpeg, ['-i', file, '-f', 'null', '-'], { encoding: 'utf8' });
  const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(r.stderr ?? '');
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
};

let narr = null; // audio-time { start, end } per shot index
const shotDurations = []; // seconds each shot is on screen
let audioDelay = 0; // when the continuous track starts on the video timeline

if (continuous) {
  narr = JSON.parse(readFileSync(timingsPath, 'utf8'));
  audioDelay = LEAD_IN;
  const lastIdx = shots.length - 1;
  for (let i = 0; i < shots.length; i++) {
    const startV = i === 0 ? 0 : LEAD_IN + (narr[i]?.start ?? narr[i - 1]?.end ?? 0);
    const endV =
      i === lastIdx
        ? LEAD_IN + (narr[i]?.end ?? 0) + TAIL_PAD
        : LEAD_IN + (narr[i + 1]?.start ?? narr[i]?.end ?? 0);
    // floor so a very short beat still fits its fly-to + a moment of hold
    shotDurations[i] = Math.max(FLY_SECONDS + 0.4, endV - startV);
  }
  const total = LEAD_IN + Math.max(...Object.values(narr).map((t) => t.end)) + TAIL_PAD;
  console.log(`pacing: audio-master single-take — ${shots.length} shots, ~${total.toFixed(1)}s`);
} else {
  for (const [si, shot] of shots.entries()) {
    let base = shot.seconds ?? 8;
    const seg = join(audioDir, `${format}-shot-${String(si).padStart(2, '0')}.mp3`);
    if (existsSync(seg)) {
      const need = audioSeconds(seg) + 0.8;
      if (need > base) {
        console.log(`  shot ${si}: extended ${base}s -> ${need.toFixed(1)}s to fit narration`);
        base = need;
      }
    }
    shotDurations[si] = base;
  }
}

const advance = (ms) => page.evaluate((m) => window.__vt.advance(m), ms);

// portrait crops the sides of landscape-framed shots — dolly out to compensate
// (per-shot override: { dolly: 1.5 } in video.js; first shot's is set pre-boot)
const setDolly = (d) => page.evaluate((v) => { window.__hiwCameraScale = v; }, d);

// warm up: run the virtual clock ~2s so entry animations and the first loop
// settle before frame 0
await page.evaluate((n) => window.__hiw.activate(n), shots[0]?.step ?? 0);
for (let i = 0; i < fps * 2; i++) await advance(frameMs);

console.log(`${id} [${format}] ${viewport.width}x${viewport.height}@${fps} — ${shots.length} shots -> ${outRoot}`);

let frame = 0;
let clock = 0; // seconds on the output timeline
const timeline = [];
const framing = {}; // shot index -> the pose auto-framing solved, for the gate + storyboard
const t0 = Date.now();

for (const [si, shot] of shots.entries()) {
  const isFirst = si === 0;
  // A shot with an explicit `camera` keeps its authored `dolly`; an auto-framed
  // one is pinned at 1 because the solver already put the distance where it
  // wants it (see baseDolly above).
  await setDolly(autoFrame && !shot.camera ? 1 : (shot.dolly ?? baseDolly));
  await page.evaluate((n) => window.__hiw.activate(n), shot.step);

  // Per-shot camera override (OPT-IN via `camera: {position, target}` in
  // video.js): re-aims the shot past whatever the step's own authored camera
  // is. Exists because desktop step cameras are composed rule-of-thirds for
  // the text panel (subject pushed into the right ~62%) — correct on the
  // interactive site, but there is no side panel in a vertical export, so the
  // same pose reads as cropped/off-center in portrait. `dolly` alone can't
  // fix a case like this: it scales distance from `target`, which shrinks
  // the OFFSET too (target always projects to frame-center), but only by
  // dollying out far enough to lose the shot's intended macro framing.
  // Calling flyTo() again here is safe and not a second animation stacking
  // on the first — anime.js REPLACES a tween targeting the same
  // object+properties rather than composing with it (the same thing that
  // already happens on the live site when a user scrolls past a step fast
  // enough to retrigger flyTo before the previous one finishes). Runs even
  // when activate() was a no-op (two shots sharing a step), same reasoning
  // as the labels override below.
  if (shot.camera) {
    await page.evaluate((pose) => window.__hiw.flyTo(pose), shot.camera);
  }

  // Per-shot label targeting (OPT-IN via `labels: [...]` in video.js): show
  // only the named callouts while THIS shot's narration is on screen, so a
  // label appears while the narrator is actually talking about that part
  // instead of the step's default all-or-nothing set. `activate()` is a
  // no-op when consecutive shots share the same step (see player.js), so
  // this must run every shot regardless of whether onEnter re-fired. Sets
  // the CSS2DObject's `.visible` directly (not a DOM style) so it survives
  // every subsequent composer.render() call this shot — CSS2DRenderer
  // re-derives element display from `.visible` every frame. Shots that omit
  // `labels` are untouched (whatever's currently showing carries over),
  // preserving old video.js files with no opinion on this.
  if (shot.labels !== undefined) {
    await page.evaluate((wanted) => {
      const stage = window.__hiw.stage;
      const want = new Set(wanted);
      stage.scene.traverse((o) => {
        if (!o.isCSS2DObject || !o.element) return;
        // Only narrow within whatever the step's onEnter already turned on —
        // never resurrect a label from a DIFFERENT callout set. Explainers
        // that reuse a name across sets (e.g. a mic capsule and a speaker
        // driver both labelling their coil "Voice coil") previously lit up
        // BOTH simultaneously, because this traversed the whole scene by
        // text match alone with no notion of which set is active.
        if (!o.visible) return;
        const tx = o.element.querySelector('.callout-text');
        o.visible = want.has(tx ? tx.textContent : '');
      });
    }, shot.labels);
  }

  // --- auto-framing --------------------------------------------------------
  // Solve this shot's camera from the subject's real world bounds instead of a
  // hand-guessed `dolly`, then fly to the solved pose. Runs AFTER the label
  // override above on purpose: narrowing the visible callouts shrinks the box
  // the solver has to fit, so a shot that talks about one part frames that part
  // rather than every anchor the step happens to own.
  //
  // Skipped when the shot pins an explicit `camera` — that is deliberate art
  // direction and must win — and when --no-auto-frame reproduces a legacy render.
  //
  // The subject defaults to the step's own `focus` list (already authored on
  // most steps, and already means "what this step is about"); `frame: [...]`
  // overrides it per shot, and `frame: null` means the whole model.
  if (autoFrame && !shot.camera) {
    const solved = await page.evaluate(
      (o) => window.__hiw.frameTo(o),
      { keys: shot.frame, fill: shot.fill ?? baseFill, bias: shot.bias ?? baseBias },
    );
    framing[si] = solved;
  }

  // One continuous span per shot. The fly-to (triggered by activate above)
  // plays during the FIRST ~FLY_SECONDS of it — captured as part of the shot,
  // never added on top — so lines butt up against each other with no silent
  // camera-move gap between them.
  const totalFrames = Math.round(shotDurations[si] * fps);
  const start = clock;
  // Optional per-shot { speed } in video.js scales how fast the SCENE's own
  // clock advances per output frame — output fps/duration are untouched, only
  // how much of the model's loop (turntable spin, mechanism cycles) plays out
  // per second of video. A slower hero turn for one shot without touching the
  // step's own timeline duration in index.js (which would also slow the live
  // interactive site).
  const shotSpeed = shot.speed ?? 1;

  for (let f = 0; f < totalFrames; f++) {
    await advance(frameMs * shotSpeed);
    // JPEG q98 (near-lossless) — ~3-4x faster to capture than PNG. At q98 the
    // dark-gradient posterizing is negligible, and the encode-time `gradfun`
    // deband (below) mops up any residual banding, so gradients stay smooth
    // without paying PNG's capture cost.
    await page.screenshot({
      path: join(framesDir, `${String(frame).padStart(5, '0')}.jpg`),
      quality: 98,
    });
    frame++;
    clock += 1 / fps;
  }

  // when this shot's spoken line / caption begins on the video timeline
  const contentStart = continuous
    ? isFirst
      ? audioDelay
      : start
    : start + (isFirst ? 0 : FLY_SECONDS);

  timeline.push({
    shot: si,
    step: shot.step,
    start: Number(start.toFixed(3)),
    contentStart: Number(contentStart.toFixed(3)),
    end: Number(clock.toFixed(3)),
    caption: shot.caption ?? null,
    framed: framing[si] ?? null,
    narration: shot.narration ?? null,
    sfx: shot.sfx ?? null,
  });
  console.log(`  shot ${si + 1}/${shots.length} (step ${shot.step + 1}) — ${frame} frames, ${((Date.now() - t0) / 1000).toFixed(0)}s elapsed`);
}

await browser.close();
writeFileSync(join(outRoot, `${format}-timeline.json`), JSON.stringify(timeline, null, 2));

// --- encode master --------------------------------------------------------
const master = join(outRoot, `${format}-master.mp4`);
const run = (fargs, label) => {
  const r = spawnSync(ffmpeg, ['-y', ...fargs], { stdio: ['ignore', 'ignore', 'pipe'] });
  if (r.status !== 0) {
    console.error(`ffmpeg ${label} failed:\n${r.stderr.toString().slice(-2000)}`);
    process.exit(1);
  }
};
run(
  [
    '-framerate', String(fps),
    '-i', join(framesDir, '%05d.jpg'),
    // gradfun debands smooth gradients by dithering them just before encode —
    // targets the near-flat backdrop, not the whole frame, so no "sandy" grain.
    // crf 16 (from 18) preserves that dither through x264's 8-bit quantization.
    '-vf', 'gradfun=1.2:16',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    master,
  ],
  'encode',
);
console.log(`master: ${master} (${(frame / fps).toFixed(1)}s)`);

writeMasterHash();
writeFileSync(join(outRoot, `${format}-render.json`), JSON.stringify(renderInfo(), null, 2));

if (!keepFrames) rmSync(framesDir, { recursive: true, force: true });

// --- finish (captions + audio) --------------------------------------------
// Imported rather than shelled out to, so a normal export is still one process
// and one command. The same function is what `node scripts/finish-video.mjs`
// runs standalone against a cached master.
finishVideo({
  id,
  format,
  outRoot,
  viewport,
  videoDuration: clock,
  audioDelay,
  continuous,
  timeline,
  editorial,
  metaTitle,
  wantCaptions,
  wantTitle,
  wantEndCard,
  captionStyle: fmtCfg(cfg.captionStyle) ?? DEFAULT_PRESET,
});

console.log('done');
