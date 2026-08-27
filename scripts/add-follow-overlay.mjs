// Composite the channel's "Follow" button popup onto a rendered explainer
// video, chroma-keyed off its yellow background.
//
//   node scripts/add-follow-overlay.mjs <video.mp4> [--out <path>]
//                                       [--at 15] [--overlay <path>]
//                                       [--force]
//
// This is a POST-PROCESS step, run after export-video.mjs — it composites
// onto an already-finished MP4, it does not touch the render pipeline.
//
// Placement: top-right zone, inset from both edges (not flush into the
// corner), sized to ~34% of the frame width. Verified against
// washing-machine's short-final.mp4 (2026-08-23): the 3D model stays
// centered/lower, callout labels stay near the model, captions are
// bottom-anchored, and the title card (first 5s only) is centered — the top
// corners are the one zone that's clear in every shot of every explainer
// short. Re-check this against a few frames of a NEW explainer's layout
// before trusting it blind if that explainer's cinematography is unusual
// (e.g. a very wide/flat subject that fills the top of frame).
// Margin tuned 2026-08-25 (quartz-watch export): the original margin sat the
// button flush against the top-right corner, clipped rather than placed —
// see the `margin` constant below for the fix.
//
// Crop/colorkey are tuned for the shipped asset (assets/overlay/
// follow-button.mp4: 3840x2160, solid #F8D000 background, static button
// with a cursor that clicks it). If that asset is ever swapped for a
// different clip, re-derive --crop and --key-color by sampling a frame
// (see the crop/colorkey notes below) rather than assuming these still fit.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, extname, basename, dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ffmpeg = require('ffmpeg-static');

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith('--'));
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
if (!input || !existsSync(input)) {
  console.error(
    'usage: node scripts/add-follow-overlay.mjs <video.mp4> [--out <path>] [--at 15] [--overlay <path>] [--force]',
  );
  process.exit(1);
}

const inPath = resolve(input);
const overlayPath = resolve(opt('overlay', 'assets/overlay/follow-button.mp4'));
if (!existsSync(overlayPath)) {
  console.error(`overlay clip not found: ${overlayPath}`);
  process.exit(1);
}
const at = Number(opt('at', '15'));
const force = args.includes('--force');
const ext = extname(inPath);
const outPath = resolve(
  opt('out', join(dirname(inPath), `${basename(inPath, ext)}-followed${ext}`)),
);
if (existsSync(outPath) && !force) {
  console.error(`refusing to overwrite existing ${outPath} (pass --force)`);
  process.exit(1);
}

// --- probe target resolution (ffmpeg-static ships no ffprobe) --------------
function probe(file) {
  const r = spawnSync(ffmpeg, ['-i', file], { encoding: 'utf8' });
  const err = r.stderr || '';
  const res = err.match(/Video:.*?(\d{2,5})x(\d{2,5})/);
  const dur = err.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
  return {
    width: res ? Number(res[1]) : null,
    height: res ? Number(res[2]) : null,
    seconds: dur ? Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]) : null,
  };
}
const target = probe(inPath);
const overlay = probe(overlayPath);
if (!target.width || !overlay.seconds) {
  console.error('could not probe input/overlay video (unexpected ffmpeg output)');
  process.exit(1);
}

// Crop box tuned for the shipped 3840x2160 asset: contains the static
// button plus the full cursor-click travel, with margin (verified by
// sampling frames across the whole clip, not just the button's resting
// pose). Sample yellow via `ffmpeg -ss T -i clip.mp4 -vf crop=2:2:X:Y,
// format=rgb24 -f rawvideo -frames:v 1 -` if the asset ever changes.
const crop = opt('crop', '2450:1250:700:250');
const keyColor = opt('key-color', '0xF8D000');
const similarity = opt('similarity', '0.28');
const blend = opt('blend', '0.10');
const widthFrac = Number(opt('width-frac', '0.34'));
const overlayW = Math.round(target.width * widthFrac);
// Margin from each edge. The original 0.033 (~36px at 1080 width) sat the
// button flush against both the top and right edges — it read as clipped
// into the very corner rather than placed in the frame (flagged against the
// quartz-watch export, 2026-08-25). 0.07 (~76px at 1080) pulls it a full
// button-height clear of both edges while staying in the top-right zone
// verified clear of the model/callouts/captions; widthFrac also came down
// slightly (0.39 -> 0.34) so the extra breathing room doesn't push it toward
// the subject.
const margin = Math.round(target.width * 0.07);

const filter =
  `[1:v]crop=${crop},colorkey=${keyColor}:${similarity}:${blend},format=yuva420p,` +
  `scale=${overlayW}:-1,setpts=PTS-STARTPTS+${at}/TB[ov];` +
  `[0:v][ov]overlay=x=W-w-${margin}:y=${margin}:eof_action=pass:format=auto[vout]`;

console.log(
  `${basename(inPath)}: overlay at ${at}s for ${overlay.seconds.toFixed(1)}s, ` +
    `${overlayW}px wide, top-right (margin ${margin}px)`,
);

const r = spawnSync(
  ffmpeg,
  [
    '-y',
    '-i',
    inPath,
    '-i',
    overlayPath,
    '-filter_complex',
    filter,
    '-map',
    '[vout]',
    '-map',
    '0:a?',
    '-c:v',
    'libx264',
    '-crf',
    '18',
    '-preset',
    'medium',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'copy',
    outPath,
  ],
  { stdio: ['ignore', 'ignore', 'pipe'] },
);
if (r.status !== 0) {
  console.error(`ffmpeg failed:\n${r.stderr.toString().slice(-2000)}`);
  process.exit(1);
}
console.log(`wrote ${outPath}`);
