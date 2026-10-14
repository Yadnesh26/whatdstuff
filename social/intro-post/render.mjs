// Renders the Instagram intro post (2 animated slides, 1080x1350, 30 fps).
//
//   node social/intro-post/prep.mjs                 # once: footage frame sequences
//   node social/intro-post/render.mjs               # both slides + cover stills
//   node social/intro-post/render.mjs --static      # the two static posts: post-1.png, post-2.png
//   node social/intro-post/render.mjs --stills      # only stills, to check the design
//   node social/intro-post/render.mjs --slide=2     # one slide
//
// Output: renders/intro-post/slide-1.mp4, slide-2.mp4, cover-1.png, cover-2.png
import { chromium } from 'playwright';
import ffmpeg from 'ffmpeg-static';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const flag = (n) => args.some((a) => a === `--${n}` || a.startsWith(`--${n}=`));
const opt = (n, d) => (args.find((a) => a.startsWith(`--${n}=`)) ?? `=${d}`).split('=')[1];
const FPS = 30;
const OUT = resolve('renders/intro-post');
mkdirSync(OUT, { recursive: true });
const slides = flag('slide') ? [Number(opt('slide'))] : [1, 2];

// where each slide reads best as a still (used for covers and --stills)
const STILLS = { 1: [0, 2.2, 4.4, 7.5], 2: [1.2, 3.8, 5.6, 9.0] };
const COVER = { 1: 7.5, 2: 9.0 };

const browser = await chromium.launch({ channel: 'chromium' });
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
page.on('console', (m) => m.type() === 'error' && console.error('[page]', m.text()));
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
await page.goto(pathToFileURL(resolve('social/intro-post/index.html')).href);

for (const slide of slides) {
  const dur = await page.evaluate((s) => window.setup(s), slide);
  const shot = async (t, f) => {
    await page.evaluate(([tt, ff]) => window.draw(tt, ff), [t, f]);
    return page.screenshot({ type: 'jpeg', quality: 96 });
  };

  if (flag('static')) {
    await page.evaluate(() => window.drawStatic());
    await page.screenshot({ path: `${OUT}/post-${slide}.png`, type: 'png' });
    console.log(`slide ${slide}: ${OUT}/post-${slide}.png`);
    continue;
  }

  if (flag('stills')) {
    for (const t of STILLS[slide]) {
      const buf = await shot(t, Math.round(t * FPS));
      const p = `${OUT}/still-${slide}-${String(t).replace('.', '_')}.jpg`;
      (await import('node:fs')).writeFileSync(p, buf);
    }
    console.log(`slide ${slide}: stills written`);
    continue;
  }

  const frames = Math.round(dur * FPS);
  const ff = spawn(ffmpeg, [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-shortest', '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p',
    '-profile:v', 'high', '-r', String(FPS), '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart',
    `${OUT}/slide-${slide}.mp4`,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => { ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c)))); });
  for (let f = 0; f < frames; f++) {
    const buf = await shot(f / FPS, f);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (f % 45 === 0) console.log(`slide ${slide}: frame ${f}/${frames}`);
  }
  ff.stdin.end();
  await done;
  const cover = await (async () => { await page.evaluate(([tt]) => window.draw(tt, 0), [COVER[slide]]); return page.screenshot({ type: 'png' }); })();
  (await import('node:fs')).writeFileSync(`${OUT}/cover-${slide}.png`, cover);
  console.log(`slide ${slide}: ${OUT}/slide-${slide}.mp4`);
}
await browser.close();
