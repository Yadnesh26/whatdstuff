// One command that renders everything an explainer's `render` config declares.
//
//   node scripts/render.mjs <explainer-id>
//   node scripts/render.mjs <explainer-id> --format short --no-captions
//   node scripts/render.mjs <explainer-id> --dry-run
//
// The point (docs/video-pipeline-plan.md §4): every render decision used to
// live in CLI flags spread across three scripts plus three ask-the-user steps
// in the export-content skill, so nothing was recorded per explainer and no
// re-render was reproducible from the repo alone. Put the decisions in
// video.js's `render` block instead, and a re-render is one argument.
//
//   // src/explainers/<id>/video.js
//   render: {
//     formats: ['short', 'long'],       // what this explainer ships
//     captions: true,                   // or { short: true, long: false }
//     titleCard: true,
//     endCard:       { short: true,  long: false },
//     followOverlay: { short: true,  long: false },
//     captionStyle: 'bold-karaoke',     // see caption-style.mjs
//     fill: 0.88,                       // auto-framing tightness, or { w, h }
//     voice: '<elevenlabs-id>',         // else VOICE_ID from .env
//     fps: 30,
//   }
//
// GUARDRAIL, unchanged: the end card and the follow overlay are outward-facing
// promises to a viewer. Writing one into the config IS the explicit human
// choice the ask-first rule protects — it lands in a reviewable diff rather
// than in shell history. Absent config still means off, and the unattended
// explainer-to-video pipeline still applies neither.
//
// Every stage is skippable and every stage is cached, so re-running after a
// script tweak costs the narration call plus two re-encodes, not a full render.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith('--'));
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const flag = (n) => args.includes(`--${n}`);
if (!id) {
  console.error('usage: node scripts/render.mjs <explainer-id> [--format short|long] [--dry-run]');
  process.exit(1);
}

const videoJsPath = resolve(`src/explainers/${id}/video.js`);
if (!existsSync(videoJsPath)) {
  console.error(`${videoJsPath} not found — write the editorial layer first (video-scripting skill).`);
  process.exit(1);
}
const editorial = (await import(pathToFileURL(videoJsPath))).default;
const cfg = editorial.render ?? {};

const dryRun = flag('dry-run');
const port = opt('port', String(cfg.port ?? 5199));
const only = opt('format', null);
const formats = only ? [only] : (cfg.formats ?? ['short', 'long']);
const pick = (v, format) => (v && typeof v === 'object' && !Array.isArray(v) ? v[format] : v);
// A CLI --x / --no-x always beats the config, so one run can differ without
// editing the committed file.
const tri = (name, configured, dflt) =>
  flag(`no-${name}`) ? false : flag(name) ? true : (configured ?? dflt);

const node = process.execPath;
const step = (label, script, scriptArgs) => {
  console.log(`\n── ${label}\n   ${['node', script, ...scriptArgs].join(' ')}`);
  if (dryRun) return true;
  const r = spawnSync(node, [script, ...scriptArgs], { stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`\n${label} failed (exit ${r.status}) — stopping.`);
    process.exit(r.status ?? 1);
  }
  return true;
};

// Narration is an API call and the slowest thing here that is not frame
// capture, so it is cached on the narration TEXT (plus voice and speed). A
// script edit re-synthesizes; a caption or framing change does not.
const narrationDir = resolve('renders', id, 'audio');
function narrationKey(format, voice, speed) {
  const text = (editorial[format]?.shots ?? []).map((s) => s.narration ?? '').join(' ');
  return createHash('sha1').update(JSON.stringify({ text, voice, speed })).digest('hex');
}
function narrationIsCurrent(format, voice, speed) {
  const full = join(narrationDir, `${format}-full.mp3`);
  const hashFile = join(narrationDir, `${format}-narration.hash`);
  if (!existsSync(full) || !existsSync(hashFile)) return false;
  return readFileSync(hashFile, 'utf8').trim() === narrationKey(format, voice, speed);
}
function stampNarration(format, voice, speed) {
  // Only stamp when the single-take path actually produced its output. The Edge
  // TTS fallback writes per-shot files and no <format>-full.mp3, and stamping
  // there would cache a miss as a hit forever.
  if (dryRun || !existsSync(join(narrationDir, `${format}-full.mp3`))) return;
  writeFileSync(join(narrationDir, `${format}-narration.hash`), narrationKey(format, voice, speed));
}

console.log(`render: ${id} — formats [${formats.join(', ')}]${dryRun ? '  (dry run)' : ''}`);

for (const format of formats) {
  const shots = editorial[format]?.shots;
  if (!shots?.length) {
    console.log(`\n── ${format}: no shots in video.js — skipped`);
    continue;
  }
  const captions = tri('captions', pick(cfg.captions, format), false);
  const endCard = tri('endcard', pick(cfg.endCard, format), editorial.endCard != null);
  const follow = tri('follow', pick(cfg.followOverlay, format), false);
  const voice = opt('voice', cfg.voice ?? null);
  const speed = opt('speed', cfg.speed ?? null);

  console.log(
    `\n═══ ${format}: captions ${captions ? 'on' : 'off'} · endcard ${endCard ? 'on' : 'off'} · follow ${follow ? 'on' : 'off'}`,
  );

  // 1. narration ------------------------------------------------------------
  const hasNarration = shots.some((s) => s.narration);
  if (!hasNarration) {
    console.log(`\n── narration: none written for ${format} — skipped`);
  } else if (flag('skip-narration')) {
    console.log(`\n── narration: --skip-narration`);
  } else if (narrationIsCurrent(format, voice, speed) && !flag('force-narration')) {
    console.log(`\n── narration: CACHED (${format}-full.mp3 matches the script)`);
  } else {
    const nargs = [id, '--format', format];
    if (voice) nargs.push('--voice', voice);
    if (speed) nargs.push('--speed', String(speed));
    step(`narration (${format})`, 'scripts/make-narration.mjs', nargs);
    stampNarration(format, voice, speed);
  }

  // 2. render + finish ------------------------------------------------------
  // export-video reads the same `render` block for everything not passed here,
  // and skips frame capture entirely when its master cache is still valid.
  const eargs = [id, '--format', format, '--port', port];
  if (captions) eargs.push('--captions');
  else eargs.push('--no-captions');
  if (endCard) eargs.push('--endcard');
  else eargs.push('--no-endcard');
  if (flag('fps')) eargs.push('--fps', opt('fps'));
  if (flag('force-frames')) eargs.push('--force-frames');
  if (flag('no-auto-frame')) eargs.push('--no-auto-frame');
  step(`render (${format})`, 'scripts/export-video.mjs', eargs);

  // 3. follow overlay -------------------------------------------------------
  // Composited onto the captioned cut; without captions there is no captioned
  // file to composite onto, and the overlay's placement was verified against
  // captioned frames, so the combination is refused rather than guessed at.
  if (follow) {
    const target = resolve('renders', id, `${format}-captioned.mp4`);
    if (!captions) {
      console.log(`\n── follow overlay: skipped — needs captions on (nothing to composite onto)`);
    } else if (!dryRun && !existsSync(target)) {
      console.log(`\n── follow overlay: skipped — ${target} not produced`);
    } else {
      step(`follow overlay (${format})`, 'scripts/add-follow-overlay.mjs', [target]);
    }
  }
}

// 4. posting kit ------------------------------------------------------------
step('postkit', 'scripts/make-postkit.mjs', [id]);

console.log(`\nrender: ${id} complete — see renders/${id}/`);
