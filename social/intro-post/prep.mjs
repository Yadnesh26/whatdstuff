// Pulls footage for the Instagram intro post out of the explainers' existing
// short masters (silent, clean, no captions — renders/<id>/short-master.mp4)
// as numbered JPG sequences the page can show frame-by-frame. Chromium builds
// have no H.264, so <video> is not an option, and a frame sequence keeps the
// render deterministic anyway.
//
//   node social/intro-post/prep.mjs
//
// Output: renders/intro-post/cache/<id>/001.jpg …, logo.png
import ffmpeg from 'ffmpeg-static';
import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = resolve('renders/intro-post/cache');
const run = (args) => execFileSync(ffmpeg, ['-y', '-loglevel', 'error', ...args]);

// start = seconds into the master where the machine is big and moving
const TILES = [
  { id: 'four-stroke-engine', start: 20 },
  { id: 'jet-engine', start: 30 },
  { id: 'black-hole', start: 20 },
  { id: 'mechanical-watch', start: 20 },
  { id: 'mri-machine', start: 0 },
  { id: 'nlp', start: 30 },
  { id: 'rocket-engine', start: 30 },
  { id: 'wind-turbine', start: 20 },
  { id: 'google-search', start: 30 },
];

for (const t of TILES) {
  const dir = `${OUT}/${t.id}`;
  if (existsSync(`${dir}/300.jpg`)) continue;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  // 9:16 master → centred 3:4 portrait crop → tile size, 10 s at 30 fps
  run([
    '-ss', String(t.start), '-t', '10',
    '-i', `renders/${t.id}/short-master.mp4`,
    '-vf', 'fps=30,crop=1080:1440:0:240,scale=336:448:flags=lanczos',
    '-q:v', '3', '-start_number', '1', `${dir}/%03d.jpg`,
  ]);
  console.log('tile', t.id);
}

// slide 1's card: the four-stroke engine as a 3:2 landscape crop, 6 s
{
  const dir = `${OUT}/card`;
  if (!existsSync(`${dir}/180.jpg`)) {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    run([
      '-ss', '22', '-t', '6',
      '-i', 'renders/four-stroke-engine/short-master.mp4',
      '-vf', 'fps=30,crop=1080:720:0:520,scale=900:600:flags=lanczos',
      '-q:v', '2', '-start_number', '1', `${dir}/%03d.jpg`,
    ]);
    console.log('card');
  }
}

// the gear-D mark, trimmed out of its transparent padding
run([
  '-i', 'assets/logo/main_logo.png',
  '-vf', 'crop=1500:1700:916:750,scale=-1:480',
  `${OUT}/logo.png`,
]);
console.log('logo');
