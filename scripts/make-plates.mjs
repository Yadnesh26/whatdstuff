// Generate the library's cover plates — one clean render per explainer, used
// by the home page grid.
//
//   node scripts/make-plates.mjs [--port=5174] [--only=jet-engine,gps] [--step=1]
//
// The home page is a storefront for a real-time 3D library, so the cards show
// the actual machines rather than type. These are captured the same
// deterministic way review-shots.mjs and make-thumbnails.mjs capture anything:
// activate the step, wait for the camera fly-to to settle, then pause the loop
// and seek it to a fixed lap fraction. Same command, same pixels.
//
// Output: public/plates/<id>-3d-animation.jpg (referenced as
// /plates/<id>-3d-animation.jpg, lazy-loaded). The suffix is deliberate —
// see scripts/prerender.mjs's plateFile() — keep the two in sync.
// Re-run after adding an explainer, or after any visual change to an existing
// one — the plate is the only part of the library that goes stale on its own.
import { chromium } from 'playwright';
import { mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const flag = (name, dflt) =>
  (args.find((a) => a.startsWith(`--${name}=`)) ?? '').split('=')[1] ?? dflt;

const PORT = flag('port', '5174');
const ONLY = flag('only', '');
const STEP = Number(flag('step', '1')) - 1; // hero step: the finished product shot
const FRAC = Number(flag('frac', '0.45'));
// An explicit --step/--frac is someone iterating on one plate by hand, so it
// beats the table below; without it the table beats the default.
const STEP_GIVEN = args.some((a) => a.startsWith('--step='));
const FRAC_GIVEN = args.some((a) => a.startsWith('--frac='));
const OUT = 'public/plates';

// Per-explainer hero overrides. Step 1 is the right plate for almost every
// explainer, but each step's camera is composed to push its subject into the
// right two-thirds, clear of the text panel. The plate hides that panel, so on
// a few scenes the deliberate offset reads as dead space instead. Where a
// later step frames better WITHOUT changing the in-app camera, pin it here —
// otherwise a plain `make-plates.mjs` run silently reverts the fix.
const OVERRIDES = {
  // step 1 sits the engine high-left with the plume running off-frame; the
  // sealed-and-running finale is the same editorial beat, framed tighter.
  'rocket-engine': { step: 9 },
  // the sealed phone renders small and lost; the exploded electrode stack
  // fills the frame and actually shows what a touchscreen is.
  touchscreen: { step: 3 },
  // step 1 is a flat phone lying on a flat plinth, and with the panel hidden
  // the two slabs read as two phones. The enlarged module fills the frame with
  // voice coil, springs and light cone — the thing worth clicking on.
  'smartphone-camera': { step: 3 },
  // step 1 is the sealed lobby wall — correct as an opening beat, but as a
  // card it is a blank white wall with two shut doors and no machine in it.
  // Step 2 ghosts the concrete and shows the whole thing: car, ropes, sheave,
  // counterweight.
  elevator: { step: 2 },
  // step 1 is the right beat, but its turntable makes a full revolution per
  // lap, so the default 0.45 frac catches the projector from behind — a grey
  // box with a vent on it and no lens. frac 0 is the pose the step's camera
  // was actually composed for: lens and beam toward the viewer.
  projector: { frac: 0.02 },
};

mkdirSync(OUT, { recursive: true });

const ids = readdirSync('src/explainers', { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join('src/explainers', d.name, 'meta.js')))
  .map((d) => d.name)
  .filter((id) => !ONLY || ONLY.split(',').includes(id));

if (!ids.length) {
  console.error('no explainers matched');
  process.exit(1);
}

const browser = await chromium.launch({
  args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-webgl'],
});

// same settle poll as review-shots: activate()'s fly-to races the section
// IntersectionObserver, so wait for the camera to actually stop moving
async function waitForCameraSettle(pg, { timeoutMs = 4000, intervalMs = 140 } = {}) {
  let prev = null;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const pos = await pg.evaluate(() => window.__hiw.stage.camera.position.toArray());
    if (prev && Math.hypot(pos[0] - prev[0], pos[1] - prev[1], pos[2] - prev[2]) < 0.001) return;
    prev = pos;
    await pg.waitForTimeout(intervalMs);
  }
}

const failed = [];
for (const id of ids) {
  const ov = OVERRIDES[id] ?? {};
  const step = STEP_GIVEN || ov.step === undefined ? STEP : ov.step - 1;
  const frac = FRAC_GIVEN || ov.frac === undefined ? FRAC : ov.frac;

  // A fresh page per explainer: replaying a pause+seek()ed looped timeline
  // wedges the anime engine (see review-shots.mjs), so these pages are
  // single-use by design.
  const page = await browser.newPage({
    viewport: { width: 480, height: 300 },
    deviceScaleFactor: 1.5,
  });
  try {
    await page.goto(`http://localhost:${PORT}/#/${id}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__hiw?.stepRuntimes?.length > 0, null, {
      timeout: 60000,
    });
    await page.waitForTimeout(1600); // studio env map + lazy chunk

    // clean plate: no page chrome, no CSS2D callouts
    await page.addStyleTag({
      content: `.player-hero,.steps,.rail,.back-link,.scroll-hint,.callout{display:none!important}
                body{overflow:hidden}`,
    });

    const ok = await page.evaluate((k) => {
      const step = document.querySelectorAll('.step')[k];
      if (!step) return false;
      step.scrollIntoView({ block: 'center' }); // rule 9: layout before render
      window.__hiw.activate(k);
      return true;
    }, step);
    if (!ok) throw new Error(`step ${step + 1} out of range`);

    await page.waitForTimeout(200);
    await waitForCameraSettle(page);

    await page.evaluate(
      ([k, f]) => {
        const rt = window.__hiw.stepRuntimes[k];
        if (rt?.tl) {
          // loop:true timelines report a ~1e12 duration sentinel;
          // iterationDuration is the real lap
          const lap = rt.tl.iterationDuration ?? rt.tl.duration;
          rt.tl.pause();
          rt.tl.seek(lap * f);
        }
      },
      [step, frac],
    );
    await page.waitForTimeout(160);

    await page.screenshot({ path: join(OUT, `${id}-3d-animation.jpg`), quality: 62, type: 'jpeg' });
    console.log(`ok   ${id}${ov.step || ov.frac ? `  (override: step ${step + 1})` : ''}`);
  } catch (e) {
    failed.push(id);
    console.error(`FAIL ${id}: ${e.message.split('\n')[0]}`);
  }
  await page.close();
}

await browser.close();
console.log(
  `\n${ids.length - failed.length}/${ids.length} plates in ${OUT}` +
    (failed.length ? ` — failed: ${failed.join(', ')}` : ''),
);
if (failed.length) process.exit(1);
