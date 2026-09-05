// Caption design for video exports — the presets, the word grouping, and the
// ASS document the burn pass hands to libass.
//
// This used to be ~40 constants inlined in the middle of export-video.mjs's
// render loop, which made caption look impossible to iterate on without
// touching frame capture. Everything visual now lives here; the exporter
// supplies content and timing only.
//
// Choose a preset with `render.captionStyle` in an explainer's video.js.
//
// THE INVARIANTS BELOW ARE LOAD-BEARING. Each was a real defect once:
//
//  * Cues must NOT overlap in time. libass renders every event live at an
//    instant and STACKS simultaneous ones vertically, so two cues overlapping
//    by a few frames shove the caption a full line up the frame and back —
//    which reads as the subtitles bouncing for the whole video.
//  * The caption block is TOP-anchored (alignment 8) with a computed margin,
//    not bottom-anchored. Bottom-anchored text grows upward, so a two-line cue
//    starts a line higher than a one-line cue; across a word-synced rail the
//    wrap count flips constantly and the baseline visibly jitters.
//  * Every group must FIT on one line. Overflow triggers libass's own
//    auto-wrap, which silently turns one line into two and re-introduces the
//    jitter above. maxChars is measured, not guessed — see measureCharCap().
//  * Captions stay bottom-ish, never true centre: this app's CSS2D callouts
//    float around the middle of the frame and would collide.

// ASS colours are &HBBGGRR&, not RGB.
const YELLOW = '&H00FFFF&';

// A preset is a function of (format, viewport) so a style can react to the
// frame it is being burned into rather than hard-coding one resolution.
export const PRESETS = {
  // The current house look: heavy black-weight face, active-word highlight,
  // 1-4 words visible at a time on shorts. Reads at phone size and matches the
  // trending shorts/reels convention.
  'bold-karaoke': (format, vp) => {
    const short = format === 'short';
    const fontSize = short ? 84 : 58;
    return {
      fontName: 'Arial Black',
      fontSize,
      highlight: YELLOW,
      maxWords: short ? 4 : 7,
      maxChars: short ? 18 : 44,
      marginV: short ? Math.round(vp.height * 0.15) : 60,
      titleMarginV: short ? Math.round(vp.height * 0.09) : 54,
      outline: 5,
      shadow: 1,
      bold: -1,
    };
  },

  // Quieter: phrase-grouped, no per-word highlight, lighter outline. For
  // explainers where the mechanism is doing the talking and a flashing rail
  // fights it.
  'clean-lower-third': (format, vp) => {
    const short = format === 'short';
    const fontSize = short ? 68 : 50;
    return {
      fontName: 'Arial',
      fontSize,
      highlight: null, // no karaoke pop — one cue per phrase group
      maxWords: short ? 6 : 9,
      maxChars: short ? 24 : 52,
      marginV: short ? Math.round(vp.height * 0.14) : 56,
      titleMarginV: short ? Math.round(vp.height * 0.09) : 54,
      outline: 3,
      shadow: 1,
      bold: -1,
    };
  },

  // Long-form only in practice: small, unobtrusive, for a video someone is
  // actually watching rather than scrolling past.
  minimal: (format, vp) => ({
    fontName: 'Arial',
    fontSize: format === 'short' ? 56 : 40,
    highlight: null,
    maxWords: format === 'short' ? 7 : 12,
    maxChars: format === 'short' ? 28 : 64,
    marginV: format === 'short' ? Math.round(vp.height * 0.13) : 48,
    titleMarginV: format === 'short' ? Math.round(vp.height * 0.09) : 48,
    outline: 2,
    shadow: 0,
    bold: 0,
  }),
};

export const DEFAULT_PRESET = 'bold-karaoke';

export function resolvePreset(name, format, viewport) {
  const build = PRESETS[name] ?? PRESETS[DEFAULT_PRESET];
  const style = build(format, viewport);
  // Derived, never authored: bottom-anchored text jitters (see the header), so
  // the block is top-anchored at a margin that puts a TWO-line cue's last line
  // exactly on the bottom margin the preset asked for. One-line and two-line
  // cues then occupy the same zone and the first line never moves.
  const lineHeight = Math.round(style.fontSize * 1.2);
  return {
    name: PRESETS[name] ? name : DEFAULT_PRESET,
    ...style,
    lineHeight,
    capAlignment: 8,
    capMarginV: Math.max(0, viewport.height - style.marginV - lineHeight * 2),
  };
}

// Group the verbatim word list into cues that fit one line.
//
// The break test runs BEFORE the word is added. Checking after allows a group
// to overshoot maxChars by a whole word, which at 84px Arial Black is enough to
// exceed the frame and trigger the auto-wrap this is all here to prevent.
export function groupWords(words, { maxWords, maxChars }) {
  const groups = [];
  let grp = [];
  const flush = () => {
    if (grp.length) groups.push(grp);
    grp = [];
  };
  for (const w of words) {
    const prospective = grp.reduce((n, x) => n + x.t.length + 1, -1) + w.t.length + 1;
    if (grp.length && (grp.length >= maxWords || prospective > maxChars)) flush();
    grp.push(w);
    const hard = /[.?!]["')\]]?$/.test(w.t); // sentence end -> always break
    const soft = /[,;:—]$/.test(w.t) && grp.length >= 2; // clause end
    if (hard || soft) flush();
  }
  flush();
  return groups;
}

const esc = (t) => String(t).replace(/\n/g, '\\N');

// Build the timed cue list for the verbatim rail.
//   groups     from groupWords()
//   audioDelay when the narration track starts on the VIDEO timeline
//   videoEnd   hard stop, so a trailing cue cannot outlive the picture
export function railCues(groups, { audioDelay, videoEnd, preset }) {
  const cues = [];
  groups.forEach((g, gi) => {
    const nextGroupStart = gi + 1 < groups.length ? groups[gi + 1][0].s + audioDelay : Infinity;
    const groupEnd = Math.min(nextGroupStart, g[g.length - 1].e + audioDelay + 1.0, videoEnd);
    if (!preset.highlight) {
      // one cue for the whole group — no per-word pop
      cues.push({ start: g[0].s + audioDelay, end: groupEnd, text: g.map((x) => esc(x.t)).join(' ') });
      return;
    }
    g.forEach((w, i) => {
      const start = w.s + audioDelay;
      const nextWordStart = i + 1 < g.length ? g[i + 1].s + audioDelay : groupEnd;
      // NEVER apply a minimum-duration floor here. A `start + 0.15` floor pushes
      // `end` past the next word whenever words are spoken faster than 150ms
      // apart, which is a genuine overlap and brings the stacking bounce back. A
      // sub-150ms highlight flash is a far smaller cost.
      cues.push({
        start,
        end: Math.min(nextWordStart, groupEnd),
        text: g
          .map((x, j) => (j === i ? `{\\c${preset.highlight}}${esc(x.t)}{\\r}` : esc(x.t)))
          .join(' '),
      });
    });
  });
  return cues;
}

// Clamp every cue to end exactly where the next begins — the caption-bounce fix
// described in the header. Continuous rail, one cue at a time, no gaps opened.
export function deoverlap(cues) {
  const out = [...cues].sort((a, b) => a.start - b.start || a.end - b.end);
  for (let i = 0; i < out.length - 1; i++) {
    if (out[i].end > out[i + 1].start) out[i].end = out[i + 1].start;
  }
  return out.filter((c) => c.end > c.start);
}

const ts = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = (s % 60).toFixed(2).padStart(5, '0');
  return `${h}:${String(m).padStart(2, '0')}:${sec}`;
};

// Assemble the ASS document. `overlays` carries the brand beats that ride the
// same burn pass (a second burn would be a second full re-encode).
export function buildAss({ viewport, preset, cues, overlays = {} }) {
  const { title, titleSeconds, endCard, endCardStart, videoDuration, hook, hookMarginV } = overlays;
  const lines = [];
  if (title) lines.push(`Dialogue: 2,${ts(0)},${ts(titleSeconds)},Title,,0,0,0,,${esc(title)}`);
  if (endCard && endCardStart != null) {
    lines.push(`Dialogue: 2,${ts(endCardStart)},${ts(videoDuration)},EndCard,,0,0,0,,${esc(endCard)}`);
  }
  if (hook) lines.push(`Dialogue: 1,${ts(0)},${ts(3)},Hook,,0,0,0,,${esc(hook)}`);
  for (const c of cues) lines.push(`Dialogue: 0,${ts(c.start)},${ts(c.end)},Cap,,0,0,0,,${c.text}`);

  const f = preset.fontName;
  const b = preset.bold;
  const o = preset.outline;
  const sh = preset.shadow;
  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${viewport.width}
PlayResY: ${viewport.height}
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,${f},${preset.fontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&H7F000000,${b},0,0,0,100,100,0,0,1,${o},${sh},${preset.capAlignment},60,60,${preset.capMarginV},1
Style: Hook,${f},${Math.round(preset.fontSize * 1.15)},&H00FFFFFF,&H00FFFFFF,&H00000000,&H7F000000,${b},0,0,0,100,100,0,0,1,${o},${sh},8,60,60,${hookMarginV ?? preset.titleMarginV},1
Style: Title,${f},${Math.round(preset.fontSize * 0.92)},&H00FFFFFF,&H00FFFFFF,&H00000000,&H7F000000,${b},0,0,0,100,100,4,0,1,${o},${sh},8,60,60,${preset.titleMarginV},1
Style: EndCard,${f},${preset.fontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&H7F000000,${b},0,0,0,100,100,0,0,1,${o},${sh},2,60,60,${preset.marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${lines.join('\n')}
`;
}

// Measure the widest cue group at the preset's real font, in a headless browser
// canvas. `maxChars` in each preset above is a MEASURED number, not a guess: 26
// was the original guess and a 26-char short-form group runs ~1150-1250px at
// 84px Arial Black, ~30% wider than the 960px a 1080-wide frame leaves after
// margins. That overflow is what made captions look inconsistently positioned.
// Call this from the caption gate whenever a preset's font or size changes.
export async function measureGroups(page, groups, preset, availablePx) {
  const texts = groups.map((g) => g.map((w) => w.t).join(' '));
  return page.evaluate(
    ({ texts, font, avail }) => {
      const ctx = document.createElement('canvas').getContext('2d');
      ctx.font = font;
      return texts
        .map((t, i) => ({ i, t, w: Math.round(ctx.measureText(t).width) }))
        .filter((r) => r.w > avail);
    },
    { texts, font: `${preset.fontSize}px "${preset.fontName}"`, avail: availablePx },
  );
}
