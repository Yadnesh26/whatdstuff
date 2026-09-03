// Render an explainer to video by driving a virtualized clock frame-by-frame.
//
//   node scripts/export-video.mjs <explainer-id> [--format short|long] [--port 5199]
//                                 [--fps 30] [--out renders] [--keep-frames]
//
// How it works: every animation in the app (anime.js engine, three's
// setAnimationLoop, camera fly-tos) is driven by requestAnimationFrame +
// performance.now. We stub both in the page with a manual clock, advance it
// exactly 1000/fps ms per captured frame, and screenshot each frame — the
// result is deterministic and perfectly smooth regardless of render cost.
//
// The shot list comes from src/explainers/<id>/video.js (editorial layer:
// which steps, how long, captions, narration). Falls back to "every step,
// 8s each" when video.js doesn't exist yet.
//
// Output (renders/<id>/):
//   <format>-master.mp4    silent, no captions — the reusable master
//   <format>-captioned.mp4 captions burned in (skipped if no captions)
//   <format>-final.mp4     captioned + narration/sfx mixed (skipped if no audio)
//   <format>-timeline.json shot → [start,end] seconds, for audio/caption sync
import { chromium } from 'playwright';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ffmpeg = require('ffmpeg-static');

// --- args --------------------------------------------------------------
const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith('--'));
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
if (!id) {
  console.error('usage: node scripts/export-video.mjs <explainer-id> [--format short|long] [--port 5199] [--fps 30]');
  process.exit(1);
}
const format = opt('format', 'long'); // short = 9:16 vertical, long = 16:9
const port = opt('port', '5199');
const fps = Number(opt('fps', '24')); // 24 = cinematic and 20% fewer frames
const outRoot = resolve(opt('out', 'renders'), id);
const keepFrames = args.includes('--keep-frames');

const viewport =
  format === 'short'
    ? { width: 1080, height: 1920 }
    : { width: 1920, height: 1080 };

// --- editorial layer (video.js) -----------------------------------------
const videoJsPath = resolve(`src/explainers/${id}/video.js`);
let editorial = null;
if (existsSync(videoJsPath)) {
  editorial = (await import(pathToFileURL(videoJsPath))).default;
  console.log(`editorial: ${videoJsPath}`);
} else {
  console.log('editorial: none (video.js missing) — rendering every step, 8s each');
}

// --- brand overlays: title card + end card --------------------------------
// The name comes from meta.js (single source of truth for the library card),
// compacted for screen: "How a Refrigerator Works" -> "REFRIGERATOR". A short
// series-brand word reads at a glance; the full sentence does not. video.js can
// override with `titleCard` when the derived form is wrong.
// Also strips the "What Is a Black Hole?" form, used by subjects that aren't
// machines — same intent, and the title card still wants just "BLACK HOLE".
const compactTitle = (t) =>
  t
    .replace(/^(?:how|what)\s+(?:is\s+|are\s+)?(?:(?:a|an|the)\s+)?/i, '')
    .replace(/\s+works?[.!]?$/i, '')
    .replace(/\?$/, '')
    .trim();
let metaTitle = null;
const metaPath = resolve(`src/explainers/${id}/meta.js`);
if (existsSync(metaPath)) {
  metaTitle = (await import(pathToFileURL(metaPath))).default?.title ?? null;
}
const displayTitle =
  editorial?.titleCard ?? (metaTitle ? compactTitle(metaTitle).toUpperCase() : null);
// End card: the closing share/funnel beat. OPT-IN (2026-08-11, user request):
// it burns only when explicitly asked for, via `--endcard` or an `endCard`
// field in video.js. It used to ride `--captions` by default, which put a
// "Full length version on YouTube" CTA on the end of shorts whose long-form
// did not exist. A CTA is an outward-facing promise, so it is now the
// caller's deliberate choice, never a side effect of wanting captions.
//
// The copy below is what `--endcard` burns when no per-explainer `endCard`
// overrides it. Overridable per explainer; `\n`
// splits lines IF you want more than one — but the EndCard style shares its
// MarginV/Alignment with Cap (the rail captions) on purpose, so a 1-line
// card lands at the EXACT same position captions have held all video. A
// 2-line card anchored at that same point pushes its top line upward,
// which reads as the captions randomly "jumping" position in the last few
// seconds — confirmed 2026-07-28 by comparing rendered frames. Default is
// single-line for this reason; only go multi-line with a deliberate reason.
//
// The default is FORMAT-AWARE (2026-08-05): a short's job is to feed the
// long-form, so it points at YouTube, while the long-form IS the YouTube
// video and keeps the share CTA (telling a YouTube viewer to watch it on
// YouTube reads as a mistake).
//
// The short's card is two lines on purpose, and that is the "deliberate
// reason" the caveat above asks for. Every single-line phrasing that
// actually names YouTube overflows the 960px short-form budget at 84px
// Arial Black — measured, not guessed: "Full video on YouTube" 1007px,
// "Full version on YouTube" 1095px, "Full length on YouTube" 1049px. Split
// across two lines, both fit with real margin (849px and 535px). The
// sits-higher side effect is harmless here specifically: the end card is
// scheduled AFTER the last spoken caption, so there is no rail caption on
// screen for it to be mistaken for.
const SHORT_END_CARD = ['Full length version', 'on YouTube'].join('\n');
const endCardText = editorial?.endCard ?? (format === 'short' ? SHORT_END_CARD : 'Share it.');

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
const baseDolly = format === 'short' ? Number(editorial?.short?.dolly ?? 1.35) : 1;
const firstDolly = editorial?.[format]?.shots?.[0]?.dolly ?? baseDolly;
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
const t0 = Date.now();

for (const [si, shot] of shots.entries()) {
  const isFirst = si === 0;
  await setDolly(shot.dolly ?? baseDolly);
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

// --- captions --------------------------------------------------------------
// ASS burned via libass: auto-wraps, real outline, positioned per format.
// OPT-IN (--captions). Two sources, in priority order:
//   VERBATIM RAIL (preferred) — make-narration wrote <format>-words.json, the
//     ElevenLabs word-level alignment for the single take. We group the spoken
//     words into short lower-third cues timed to WHEN THEY'RE ACTUALLY SAID, so
//     the on-screen text matches the narrator's voice (the captions-overlay
//     "rail" model). No summary text, no title card — the spoken words carry it.
//   LEGACY SUMMARY (fallback, no words.json — e.g. Edge TTS with no alignment) —
//     the per-shot `caption` one-liners plus the hook overlay, kept for
//     back-compat. (Silent -captioned.mp4 for trending-audio posting is still
//     produced whenever --captions is passed.)
const wantCaptions = args.includes('--captions');
// title + end card ride the same single burn pass as captions (each burn is a
// full re-encode, so they must not cost extra passes). Opt out individually.
const wantTitle = wantCaptions && !args.includes('--no-title');
// opt-in: --endcard, or a per-explainer `endCard` in video.js (itself an
// explicit ask). --no-endcard still force-disables either of those.
const wantEndCard =
  wantCaptions &&
  !args.includes('--no-endcard') &&
  (args.includes('--endcard') || editorial?.endCard != null);
const TITLE_SECONDS = 5;
const ENDCARD_SECONDS = 3.5;
const short = format === 'short';
const ts = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = (s % 60).toFixed(2).padStart(5, '0');
  return `${h}:${String(m).padStart(2, '0')}:${sec}`;
};
const esc = (t) => String(t).replace(/\n/g, '\\N');

// Build the cue list on the VIDEO timeline: { start, end, text }.
const wordsPath = join(audioDir, `${format}-words.json`);
let cues = [];
let hookLine = null; // top title card — legacy path only (non-verbatim)
const HILITE = '&H00FFFF&'; // ASS BGR — bright yellow pop on the active word
if (wantCaptions && existsSync(wordsPath)) {
  const words = JSON.parse(readFileSync(wordsPath, 'utf8'));
  // group verbatim words into readable, voice-synced phrase groups (1-4 words
  // visible at once for shorts — the trending word-by-word rail shape)
  const maxWords = short ? 4 : 7;
  // 26 was a guess and never actually fit: measured via headless Chromium
  // canvas.measureText at the real render font (84px Arial Black, 960px
  // available width after margins), a 26-char short-form group averages
  // ~1150-1250px wide — 30% wider than the frame allows. That overflow (not
  // wrapping) is what caused captions to run edge-to-edge / look
  // inconsistently positioned. 18 was verified empirically (see
  // scripts/find-safe-caption-cap.tmp.mjs) to keep every group under 900px,
  // a real safety margin below the 960px budget. Long-form's 44 at 58px
  // measured fine (max ~1406px vs 1800px available) — left unchanged.
  const maxChars = short ? 18 : 44;
  const groups = [];
  let grp = [];
  const flush = () => {
    if (!grp.length) return;
    groups.push(grp);
    grp = [];
  };
  for (const w of words) {
    // Check BEFORE adding: the old check ran after pushing, so a group could
    // overshoot maxChars by up to one whole word — long enough at 84px Arial
    // Black to exceed the frame width and trigger libass's WrapStyle auto-wrap,
    // which silently turns one "line" into two and, since captions are
    // bottom-anchored, shoves the whole block upward. Breaking BEFORE the
    // word that would cross the cap guarantees every group actually fits.
    const prospectiveLen = grp.reduce((n, x) => n + x.t.length + 1, -1) + w.t.length + 1;
    if (grp.length && (grp.length >= maxWords || prospectiveLen > maxChars)) flush();
    grp.push(w);
    const hard = /[.?!]["')\]]?$/.test(w.t); // sentence end -> always break
    const soft = /[,;:—]$/.test(w.t) && grp.length >= 2; // clause end
    if (hard || soft) flush();
  }
  flush();
  // audio starts at audioDelay. Each word in a group gets its own cue so the
  // word being spoken pops in a highlight colour (karaoke-style), held until
  // the next word begins; the group as a whole holds ~1s into a trailing pause.
  const videoEnd = clock;
  groups.forEach((g, gi) => {
    const nextGroupStart = gi + 1 < groups.length ? groups[gi + 1][0].s + audioDelay : Infinity;
    const groupEnd = Math.min(nextGroupStart, g[g.length - 1].e + audioDelay + 1.0, videoEnd);
    g.forEach((w, i) => {
      const start = w.s + audioDelay;
      const nextWordStart = i + 1 < g.length ? g[i + 1].s + audioDelay : groupEnd;
      // NEVER let end exceed the next cue's start: a `start + 0.15` minimum-
      // duration floor here can push end past nextWordStart/groupEnd when
      // words are spoken faster than 150ms apart, creating a genuine time
      // overlap between two consecutive same-style Dialogue lines. libass
      // then applies its collision-avoidance stacking (for lines it thinks
      // are simultaneously visible) and shoves one upward by roughly a line
      // height — this is the actual cause of captions appearing to jump
      // position throughout the video (confirmed 2026-07-28 by finding 22
      // genuine start/end overlaps in the generated .ass and reproducing the
      // exact ~100px shift). A very fast word's highlight flashing under
      // 150ms is a far smaller cost than that.
      const end = Math.min(nextWordStart, groupEnd);
      const text = g
        .map((x, j) => (j === i ? `{\\c${HILITE}}${esc(x.t)}{\\r}` : esc(x.t)))
        .join(' ');
      cues.push({ start, end, text });
    });
  });
  console.log(`captions: verbatim rail — ${cues.length} word-synced cues from ${words.length} words (active-word highlight)`);
} else if (wantCaptions) {
  for (const t of timeline) if (t.caption) cues.push({ start: t.contentStart, end: t.end, text: esc(t.caption) });
  if (short && editorial?.hook) hookLine = editorial.hook;
  console.log(`captions: legacy summary — ${cues.length} cues${hookLine ? ' + hook' : ''} (no words.json)`);
}

// NON-OVERLAPPING CUES — the caption-bounce fix.
// libass renders every event that is live at an instant, STACKING simultaneous
// ones vertically. So two cues whose time ranges overlap by even a few frames
// push the caption a full line across the frame and back, which reads as the
// subtitles jumping up and down for the whole video.
// The word rail overlaps constantly: its minimum-duration floor (start + 0.15s)
// overruns the next word's start whenever a word is spoken faster than 150ms.
// Clamping each cue to end exactly where the next begins removes the stacking
// without opening gaps — the rail stays continuous, one cue at a time.
cues.sort((a, b) => a.start - b.start || a.end - b.end);
for (let i = 0; i < cues.length - 1; i++) {
  if (cues[i].end > cues[i + 1].start) cues[i].end = cues[i + 1].start;
}
cues = cues.filter((c) => c.end > c.start);

// Title holds for the first TITLE_SECONDS then clears, so nothing competes with
// the mechanism and it can never collide with the CSS2D callouts that float
// around the model mid-video.
const videoDuration = clock;
const titleText = wantTitle && displayTitle ? displayTitle : null;
// The end card sits in the SAME bottom slot as the captions, so starting it
// before the last cue clears is a hard collision (two dialogues stacking on one
// anchor), not just visual competition. It must begin after lastCueEnd — which
// is why TAIL_PAD has to be generous enough to leave the card a readable window
// once the final caption's trailing hold has expired.
let endCardStart = null;
if (wantEndCard && endCardText) {
  const lastCueEnd = cues.length ? Math.max(...cues.map((c) => c.end)) : 0;
  endCardStart = Math.max(
    videoDuration - ENDCARD_SECONDS,
    Math.min(lastCueEnd + 0.15, videoDuration - 1.5),
  );
  if (endCardStart >= videoDuration - 0.4) endCardStart = null; // no room
}

let captioned = master;
if (wantCaptions && (cues.length || hookLine || titleText || endCardStart != null)) {
  // trending shorts/reels look: heavy black-weight font, bigger, active-word
  // highlight pop, positioned center-ish (clear of the bottom platform-UI zone)
  const fontName = 'Arial Black';
  const fontSize = short ? 84 : 58;
  // NOTE: true center (the usual shorts/reels convention) collides with this
  // app's own callout labels, which float around the 3D model mid-frame —
  // so both formats stay bottom-anchored, clear of them.
  const alignment = 2;
  const marginV = short ? Math.round(viewport.height * 0.15) : 60;
  // CAPTION BASELINE STABILITY. Bottom-anchored text (alignment 2) grows
  // UPWARD: a one-line cue sits on the margin, a two-line cue starts a line
  // higher. Across a word-synced rail the wrap count flips constantly, so the
  // captions visibly bounce up and down for the whole video.
  // Fix: top-anchor the caption block (alignment 8) so the FIRST line is
  // pinned and extra lines extend downward instead. The reserve below keeps a
  // two-line cue's last line on the old bottom margin, so the block occupies
  // the same zone as before — it just no longer moves.
  const capLineHeight = Math.round(fontSize * 1.2);
  const capAlignment = 8;
  const capMarginV = Math.max(0, viewport.height - marginV - capLineHeight * 2);
  const titleMarginV = short ? Math.round(viewport.height * 0.09) : 54;
  // when a title card is present the legacy hook drops below it instead of
  // stacking on the same top-center anchor
  const hookMarginV = titleText
    ? titleMarginV + Math.round(fontSize * 2.2)
    : Math.round(viewport.height * 0.14);
  const lines = [];
  if (titleText) lines.push(`Dialogue: 2,${ts(0)},${ts(TITLE_SECONDS)},Title,,0,0,0,,${esc(titleText)}`);
  if (endCardStart != null) {
    lines.push(`Dialogue: 2,${ts(endCardStart)},${ts(videoDuration)},EndCard,,0,0,0,,${esc(endCardText)}`);
  }
  // shorts (legacy only): hook on top-third for the first 3 seconds
  if (hookLine) lines.push(`Dialogue: 1,${ts(0)},${ts(3)},Hook,,0,0,0,,${esc(hookLine)}`);
  for (const c of cues) {
    lines.push(`Dialogue: 0,${ts(c.start)},${ts(c.end)},Cap,,0,0,0,,${c.text}`);
  }
  const ass = `[Script Info]
ScriptType: v4.00+
PlayResX: ${viewport.width}
PlayResY: ${viewport.height}
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,${fontName},${fontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&H7F000000,-1,0,0,0,100,100,0,0,1,5,1,${capAlignment},60,60,${capMarginV},1
Style: Hook,${fontName},${Math.round(fontSize * 1.15)},&H00FFFFFF,&H00FFFFFF,&H00000000,&H7F000000,-1,0,0,0,100,100,0,0,1,5,1,8,60,60,${hookMarginV},1
Style: Title,${fontName},${Math.round(fontSize * 0.92)},&H00FFFFFF,&H00FFFFFF,&H00000000,&H7F000000,-1,0,0,0,100,100,4,0,1,5,1,8,60,60,${titleMarginV},1
Style: EndCard,${fontName},${fontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&H7F000000,-1,0,0,0,100,100,0,0,1,5,1,${alignment},60,60,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${lines.join('\n')}
`;
  const assName = `${format}-captions.ass`;
  writeFileSync(join(outRoot, assName), ass);
  captioned = join(outRoot, `${format}-captioned.mp4`);
  // run with cwd = outRoot so the subtitles filter gets a plain relative
  // filename (Windows drive-letter paths break libass filter escaping)
  const r = spawnSync(
    ffmpeg,
    [
      '-y', '-i', `${format}-master.mp4`,
      '-vf', `subtitles=${assName}:fontsdir='C\\:/Windows/Fonts'`,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      `${format}-captioned.mp4`,
    ],
    { cwd: outRoot, stdio: ['ignore', 'ignore', 'pipe'] },
  );
  if (r.status !== 0) {
    console.error(`caption burn failed (master still usable):\n${r.stderr.toString().slice(-2000)}`);
    captioned = master;
  } else {
    console.log(`captioned: ${captioned}`);
  }
}

// --- audio mix --------------------------------------------------------------
// audio-master mode: one continuous take (<format>-full.mp3) dropped once at
// LEAD_IN — the whole voiceover is a single input, so it plays exactly as it
// was performed. legacy mode: per-shot files (<format>-shot-NN.mp3) delayed to
// each shot's contentStart. sfx cues (assets/sfx/<name>.mp3) layer on either.
// Everything optional — missing files skipped, silent video still ships.
const inputs = [];
const delays = [];
if (continuous) {
  inputs.push(fullAudioPath);
  delays.push(Math.round(audioDelay * 1000));
}
for (const [si, t] of timeline.entries()) {
  if (!continuous) {
    const seg = join(audioDir, `${format}-shot-${String(si).padStart(2, '0')}.mp3`);
    if (existsSync(seg)) {
      inputs.push(seg);
      delays.push(Math.round(t.contentStart * 1000));
    }
  }
  for (const cue of t.sfx ?? []) {
    const f = resolve('assets/sfx', `${cue.file}.mp3`);
    if (existsSync(f)) {
      inputs.push(f);
      delays.push(Math.round((t.contentStart + (cue.at ?? 0)) * 1000));
    }
  }
}
if (inputs.length) {
  const final = join(outRoot, `${format}-final.mp4`);
  const fin = ['-i', captioned];
  for (const f of inputs) fin.push('-i', f);
  const chains = inputs.map(
    (_, i) => `[${i + 1}:a]adelay=${delays[i]}|${delays[i]}[a${i}]`,
  );
  // amix preserves the authored per-input balance (normalize=0), then loudnorm
  // brings the FINISHED mix to the streaming target. Without this the export
  // lands well under platform loudness and sounds thin next to the normalized
  // feed around it — which reads as amateur before a word is understood.
  const mix =
    `${chains.join(';')};${inputs.map((_, i) => `[a${i}]`).join('')}` +
    `amix=inputs=${inputs.length}:normalize=0[mixed];` +
    `[mixed]loudnorm=I=-14:TP=-1.5:LRA=11[out]`;
  run(
    [
      ...fin,
      '-filter_complex', mix,
      '-map', '0:v', '-map', '[out]',
      // NOT -shortest: the narration ends before the video does (that tail is
      // deliberate — it is the end card's window), and -shortest would cut the
      // video back to the audio and clip the CTA down to a flash. Bound the
      // output by the rendered video length instead.
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', videoDuration.toFixed(3),
      final,
    ],
    'audio mix',
  );
  console.log(`final (with audio): ${final}`);
} else {
  console.log('audio: no narration/sfx files found — skipped (run make-narration.mjs first for voiced output)');
}

if (!keepFrames) rmSync(framesDir, { recursive: true, force: true });
console.log('done');
