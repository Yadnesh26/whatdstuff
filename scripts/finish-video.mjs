// Finish a rendered master: burn captions + brand overlays, mix the audio.
//
//   node scripts/finish-video.mjs <explainer-id> [--format short|long]
//                                 [--captions] [--endcard] [--no-title]
//
// This is the second half of the export, split out on purpose (see
// docs/video-pipeline-plan.md §5). The silent `<format>-master.mp4` is a pure
// function of the model, the steps and the shot framing/timing — it does NOT
// depend on narration wording, caption text, caption styling or card copy. So
// re-cutting captions or re-mixing audio should cost two fast re-encodes, not
// a full frame re-render.
//
// export-video.mjs imports finishVideo() and calls it directly after rendering;
// running this file standalone does the same work against whatever master is
// already on disk. It reads `<format>-render.json` (written by the render) for
// the facts it cannot re-derive: viewport, exact video duration, and where the
// narration track starts on the video timeline.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  resolvePreset,
  groupWords,
  railCues,
  deoverlap,
  buildAss,
  DEFAULT_PRESET,
} from './caption-style.mjs';

const require = createRequire(import.meta.url);
const ffmpeg = require('ffmpeg-static');

const TITLE_SECONDS = 5;
const ENDCARD_SECONDS = 3.5;

// The name comes from meta.js (single source of truth for the library card),
// compacted for screen: "How a Refrigerator Works" -> "REFRIGERATOR". A short
// series-brand word reads at a glance; the full sentence does not. video.js can
// override with `titleCard` when the derived form is wrong.
// Also strips the "What Is a Black Hole?" form, used by subjects that aren't
// machines — same intent, and the title card still wants just "BLACK HOLE".
export const compactTitle = (t) =>
  t
    .replace(/^(?:how|what)\s+(?:is\s+|are\s+)?(?:(?:a|an|the)\s+)?/i, '')
    .replace(/\s+works?[.!]?$/i, '')
    .replace(/\?$/, '')
    .trim();

// The short's card is two lines on purpose. Every single-line phrasing that
// actually names YouTube overflows the 960px short-form budget at 84px Arial
// Black — measured, not guessed: "Full video on YouTube" 1007px, "Full version
// on YouTube" 1095px, "Full length on YouTube" 1049px. Split across two lines
// both fit with real margin (849px and 535px). The side effect (a two-line card
// sits higher than a one-line one) is harmless here specifically: the end card
// is scheduled AFTER the last spoken caption, so there is no rail caption on
// screen for it to be mistaken for.
const SHORT_END_CARD = ['Full length version', 'on YouTube'].join('\n');

// The default is FORMAT-AWARE: a short's job is to feed the long-form, so it
// points at YouTube, while the long-form IS the YouTube video and keeps the
// share CTA (telling a YouTube viewer to watch it on YouTube reads as a
// mistake).
export const defaultEndCard = (format) => (format === 'short' ? SHORT_END_CARD : 'Share it.');

function run(fargs, label, cwd) {
  const r = spawnSync(ffmpeg, ['-y', ...fargs], {
    stdio: ['ignore', 'ignore', 'pipe'],
    ...(cwd ? { cwd } : {}),
  });
  if (r.status !== 0) {
    throw new Error(`ffmpeg ${label} failed:\n${r.stderr.toString().slice(-2000)}`);
  }
}

/**
 * Burn overlays onto `<format>-master.mp4` and mix the audio beside it.
 * Everything optional — a missing audio file is skipped and the silent video
 * still ships.
 */
export function finishVideo({
  id,
  format,
  outRoot,
  viewport,
  videoDuration,
  audioDelay,
  continuous,
  timeline,
  editorial,
  metaTitle,
  wantCaptions,
  wantTitle,
  wantEndCard,
  captionStyle = DEFAULT_PRESET,
}) {
  const master = join(outRoot, `${format}-master.mp4`);
  const audioDir = join(outRoot, 'audio');
  const short = format === 'short';
  const preset = resolvePreset(captionStyle, format, viewport);

  const displayTitle =
    editorial?.titleCard ?? (metaTitle ? compactTitle(metaTitle).toUpperCase() : null);
  const endCardText = editorial?.endCard ?? defaultEndCard(format);

  // --- cues ----------------------------------------------------------------
  // Two sources, in priority order:
  //   VERBATIM RAIL (preferred) — make-narration wrote <format>-words.json, the
  //     ElevenLabs word-level alignment for the single take. The spoken words
  //     carry the captions, timed to when they are actually said.
  //   LEGACY SUMMARY (no words.json — e.g. the Edge TTS fallback, which returns
  //     no alignment) — the per-shot `caption` one-liners plus the hook overlay.
  const wordsPath = join(audioDir, `${format}-words.json`);
  let cues = [];
  let hookLine = null;
  if (wantCaptions && existsSync(wordsPath)) {
    const words = JSON.parse(readFileSync(wordsPath, 'utf8'));
    const groups = groupWords(words, preset);
    cues = railCues(groups, { audioDelay, videoEnd: videoDuration, preset });
    console.log(
      `captions: verbatim rail [${preset.name}] — ${cues.length} cues from ${words.length} words`,
    );
  } else if (wantCaptions) {
    for (const t of timeline) {
      if (t.caption) cues.push({ start: t.contentStart, end: t.end, text: t.caption });
    }
    if (short && editorial?.hook) hookLine = editorial.hook;
    console.log(`captions: legacy summary — ${cues.length} cues (no words.json)`);
  }
  cues = deoverlap(cues);

  const titleText = wantCaptions && wantTitle && displayTitle ? displayTitle : null;
  // The end card sits in the SAME bottom slot as the captions, so starting it
  // before the last cue clears is a hard collision (two dialogues stacking on
  // one anchor), not just visual competition. It must begin after lastCueEnd —
  // which is why the render's TAIL_PAD has to be generous enough to leave the
  // card a readable window once the final caption's trailing hold expires.
  let endCardStart = null;
  if (wantCaptions && wantEndCard && endCardText) {
    const lastCueEnd = cues.length ? Math.max(...cues.map((c) => c.end)) : 0;
    endCardStart = Math.max(
      videoDuration - ENDCARD_SECONDS,
      Math.min(lastCueEnd + 0.15, videoDuration - 1.5),
    );
    if (endCardStart >= videoDuration - 0.4) endCardStart = null; // no room
  }

  // --- burn ----------------------------------------------------------------
  let captioned = master;
  if (wantCaptions && (cues.length || hookLine || titleText || endCardStart != null)) {
    const ass = buildAss({
      viewport,
      preset,
      cues,
      overlays: {
        title: titleText,
        titleSeconds: TITLE_SECONDS,
        endCard: endCardStart != null ? endCardText : null,
        endCardStart,
        videoDuration,
        hook: hookLine,
        // when a title card is present the legacy hook drops below it instead
        // of stacking on the same top-centre anchor
        hookMarginV: titleText
          ? preset.titleMarginV + Math.round(preset.fontSize * 2.2)
          : Math.round(viewport.height * 0.14),
      },
    });
    const assName = `${format}-captions.ass`;
    writeFileSync(join(outRoot, assName), ass);
    try {
      // cwd = outRoot so the subtitles filter gets a plain relative filename —
      // Windows drive-letter paths break libass's filter escaping
      run(
        [
          '-i', `${format}-master.mp4`,
          '-vf', `subtitles=${assName}:fontsdir='C\\:/Windows/Fonts'`,
          '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
          '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
          `${format}-captioned.mp4`,
        ],
        'caption burn',
        outRoot,
      );
      captioned = join(outRoot, `${format}-captioned.mp4`);
      console.log(`captioned: ${captioned}`);
    } catch (e) {
      // a failed burn must not throw away a good master
      console.error(`${e.message}\n(master still usable)`);
    }
  }

  // --- audio mix -----------------------------------------------------------
  // audio-master mode: one continuous take (<format>-full.mp3) dropped once at
  // audioDelay — the whole voiceover is a single input, so it plays exactly as
  // it was performed. legacy mode: per-shot files delayed to each shot's
  // contentStart. sfx cues (assets/sfx/<name>.mp3) layer on either.
  const inputs = [];
  const delays = [];
  const fullAudioPath = join(audioDir, `${format}-full.mp3`);
  if (continuous && existsSync(fullAudioPath)) {
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

  let final = null;
  if (inputs.length) {
    final = join(outRoot, `${format}-final.mp4`);
    const fin = ['-i', captioned];
    for (const f of inputs) fin.push('-i', f);
    const chains = inputs.map((_, i) => `[${i + 1}:a]adelay=${delays[i]}|${delays[i]}[a${i}]`);
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
    console.log('audio: no narration/sfx files found — skipped (run make-narration.mjs first)');
  }

  return { master, captioned, final };
}

// --- CLI -------------------------------------------------------------------
// Only when run directly, so importing this from export-video.mjs is free.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const id = args.find((a) => !a.startsWith('--'));
  const opt = (n, d) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 ? args[i + 1] : d;
  };
  const flag = (n) => args.includes(`--${n}`);
  if (!id) {
    console.error('usage: node scripts/finish-video.mjs <explainer-id> [--format short|long] [--captions] [--endcard]');
    process.exit(1);
  }

  const videoJsPath = resolve(`src/explainers/${id}/video.js`);
  const editorial = existsSync(videoJsPath)
    ? (await import(pathToFileURL(videoJsPath))).default
    : null;
  const cfg = editorial?.render ?? {};
  const format = opt('format', cfg.defaultFormat ?? 'long');
  const fmtCfg = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v[format] : v);
  const tri = (n, c, d) => (flag(`no-${n}`) ? false : flag(n) ? true : (c ?? d));

  const outRoot = resolve(opt('out', 'renders'), id);
  const renderInfoPath = join(outRoot, `${format}-render.json`);
  if (!existsSync(renderInfoPath)) {
    console.error(
      `${renderInfoPath} not found — render the master first:\n  node scripts/export-video.mjs ${id} --format ${format}`,
    );
    process.exit(1);
  }
  const info = JSON.parse(readFileSync(renderInfoPath, 'utf8'));
  const timeline = JSON.parse(readFileSync(join(outRoot, `${format}-timeline.json`), 'utf8'));

  const metaPath = resolve(`src/explainers/${id}/meta.js`);
  const metaTitle = existsSync(metaPath)
    ? ((await import(pathToFileURL(metaPath))).default?.title ?? null)
    : null;

  const wantCaptions = tri('captions', fmtCfg(cfg.captions), false);
  finishVideo({
    id,
    format,
    outRoot,
    viewport: info.viewport,
    videoDuration: info.videoDuration,
    audioDelay: info.audioDelay,
    continuous: info.continuous,
    timeline,
    editorial,
    metaTitle,
    wantCaptions,
    wantTitle: tri('title', fmtCfg(cfg.titleCard), true),
    wantEndCard:
      !flag('no-endcard') &&
      (flag('endcard') || fmtCfg(cfg.endCard) === true || editorial?.endCard != null),
    captionStyle: fmtCfg(cfg.captionStyle) ?? DEFAULT_PRESET,
  });
}
