// Lint an explainer's video narration BEFORE it costs anything.
//
//   node scripts/lint-script.mjs <explainer-id> [--format short|long] [--strict]
//
// Warnings only by default — this is a checklist that reads the script for you,
// not a gate with an opinion it can defend. It exists because the wording class
// of defect was previously only caught by listening to a finished render, i.e.
// after an ElevenLabs call and a full frame render had already been paid for.
//
// Checks the retention spine from the `video-scripting` skill plus the
// AI-writing tells the `humanizer` skill hunts. `--strict` exits non-zero if
// anything fires, for use in an unattended chain.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith('--'));
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const strict = args.includes('--strict');
if (!id) {
  console.error('usage: node scripts/lint-script.mjs <explainer-id> [--format short|long] [--strict]');
  process.exit(1);
}

const videoJsPath = resolve(`src/explainers/${id}/video.js`);
if (!existsSync(videoJsPath)) {
  console.error(`${videoJsPath} not found — nothing to lint.`);
  process.exit(1);
}
const editorial = (await import(pathToFileURL(videoJsPath))).default;
const format = opt('format', editorial.render?.defaultFormat ?? 'short');
const shots = editorial[format]?.shots ?? [];
if (!shots.length) {
  console.error(`no ${format}.shots in ${videoJsPath}`);
  process.exit(1);
}

const findings = [];
const say = (rule, where, msg) => findings.push({ rule, where, msg });

const lines = shots.map((s, i) => ({ i, text: (s.narration ?? '').trim() }));
const spoken = lines.filter((l) => l.text);
const words = (t) => t.split(/\s+/).filter(Boolean);
const allWords = spoken.flatMap((l) => words(l.text));
// ~2.3 words/sec is this library's measured narration pace at speed 0.9.
const estSeconds = allWords.length / 2.3;

// --- the spine --------------------------------------------------------------

// 1. Hook. Beat 1 is a claim that sounds wrong until explained, and it must be
//    what is actually SAID first — the `hook` field is the spoken opening line,
//    not the branded title card.
const hook = (editorial.hook ?? '').replace(/\n/g, ' ').trim();
if (!hook) say('hook-missing', 'editorial.hook', 'no `hook` field — beat 1 has nothing to anchor it');
else if (words(hook).length > 12)
  say('hook-long', 'editorial.hook', `${words(hook).length} words; under 12 reads as a claim, over reads as a summary`);

const firstSentence = (spoken[0]?.text ?? '').split(/(?<=[.?!])\s/)[0] ?? '';
if (hook && firstSentence) {
  const hookKey = words(hook.toLowerCase().replace(/[^\w\s]/g, ''));
  const openKey = new Set(words(firstSentence.toLowerCase().replace(/[^\w\s]/g, '')));
  const shared = hookKey.filter((w) => w.length > 3 && openKey.has(w)).length;
  if (shared < 2)
    say('hook-drift', 'shot 0', 'the `hook` field and shot 0\'s opening sentence do not match — keep them in sync');
}

// 2. Spoken question. Beat 3 asks it out loud; without one the script is a
//    list of facts rather than a thing being answered.
if (!spoken.some((l) => l.text.includes('?')))
  say('no-question', format, 'no spoken question anywhere — beat 3 of the arc is missing');

// 3. Planted loop, closed in the button. Some distinctive phrase from the open
//    must come back at the end, or the ending is just a stop.
const STOP = new Set('this that with from into their there where which what when will your just like about than then them they have here more most only over some such very much been being does doesnt dont cant wont onto upon a an the and or but so of to in on it is as at by for'.split(/\s+/));
const contentWords = (t) =>
  new Set(
    words(t.toLowerCase().replace(/[^\w\s]/g, ''))
      .filter((w) => w.length > 3 && !STOP.has(w)),
  );
if (spoken.length >= 3) {
  const open = contentWords(spoken[0].text);
  const button = contentWords(spoken[spoken.length - 1].text);
  const callback = [...button].filter((w) => open.has(w));
  if (callback.length === 0)
    say('no-callback', `shot ${spoken[spoken.length - 1].i}`, 'the closing line shares no idea with the opening — nothing is being closed');
}

// 4. Connective tissue. "And then" is the tell that a script is a list; ABT
//    ("but"/"so"/"therefore") is what makes it an argument.
for (const l of spoken) {
  const m = l.text.match(/\b(and then|next,|after that|then,? the|also,)\b/i);
  if (m) say('flat-connective', `shot ${l.i}`, `"${m[0]}" — a list joint where a because/but/so belongs`);
}

// 5. Handoff. In a single-take voiceover each line should pick up the previous
//    one; a line sharing no content word with its neighbour is the "standalone
//    one-fact line" that made older exports feel disconnected.
for (let k = 1; k < spoken.length; k++) {
  const prev = contentWords(spoken[k - 1].text);
  const cur = contentWords(spoken[k].text);
  if (![...cur].some((w) => prev.has(w)))
    say('no-handoff', `shot ${spoken[k].i}`, 'shares no idea with the previous line — reads as a standalone fact');
}

// 6. The stat gets its own beat. Burying the single most surprising number in
//    a long paragraph of mechanism is the most common way beat 6 is lost.
// Narration is written to be SPOKEN, so most numbers in it are spelled out
// ("thirty-six teeth", "seventy-two") and a digits-only test misses them
// entirely. Small words are excluded on purpose: "one gear set" and "two
// pumps" are prose, not the stat beat.
const NUM =
  /\b\d[\d,.]*\s*(?:%|per cent|percent|times|x\b)|\b\d[\d,.]{2,}\b|\b(?:twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[- ]\w+)?\b|\b(?:hundred|thousand|million|billion|trillion)\b/i;
const statShots = spoken.filter((l) => NUM.test(l.text));
if (!statShots.length) say('no-stat', format, 'no number anywhere — beat 6 (the mind-blowing stat) is missing');
else {
  const longStats = statShots.filter((l) => words(l.text).length > 55);
  for (const l of longStats)
    say('stat-buried', `shot ${l.i}`, `${words(l.text).length} words around the number — give the stat its own shot`);
}

// --- pacing -----------------------------------------------------------------
const TARGET = format === 'short' ? [45, 95] : [90, 180];
if (estSeconds < TARGET[0] || estSeconds > TARGET[1])
  say('length', format, `~${estSeconds.toFixed(0)}s of narration (${allWords.length} words); target ${TARGET[0]}-${TARGET[1]}s`);

for (const l of spoken) {
  const n = words(l.text).length;
  if (n > 70) say('shot-long', `shot ${l.i}`, `${n} words in one shot — the camera holds a long time on one pose`);
}

// --- legacy fields ----------------------------------------------------------
// The verbatim rail renders the spoken words; per-shot `caption` one-liners are
// the pre-words.json fallback and are ignored whenever narration exists.
const withCaption = shots.filter((s) => s.caption).length;
if (withCaption && shots.some((s) => s.narration))
  say('legacy-caption', format, `${withCaption} shot(s) still carry a \`caption\` field — the verbatim rail ignores them`);

// --- AI-writing tells (humanizer) -------------------------------------------
const joined = spoken.map((l) => l.text).join(' ');
const TELLS = [
  [/\bit'?s not just [^.,]+, it'?s\b/i, 'negative parallelism ("it\'s not just X, it\'s Y")'],
  [/\b(?:delve|tapestry|realm|landscape of|testament to|underscore[sd]?|pivotal|crucial role)\b/i, 'AI-vocabulary word'],
  [/\b(?:in the world of|when it comes to|at the end of the day|the fact that)\b/i, 'filler phrase'],
  [/\bstands? as a\b/i, 'inflated symbolism'],
  [/\b(?:ing)\b/i, null], // placeholder, never fires
];
for (const [re, label] of TELLS) {
  if (!label) continue;
  const m = joined.match(re);
  if (m) say('ai-tell', format, `${label}: "${m[0]}"`);
}
// Em-dash density: ElevenLabs renders a spaced dash as a long FIXED pause the
// speed knob cannot compress, so a dash-heavy script drags no matter the
// setting. make-narration normalizes them by default, but a script written on
// them still reads as a chain of asides.
const dashes = (joined.match(/\s[—–]\s/g) ?? []).length;
if (dashes > spoken.length)
  say('dash-density', format, `${dashes} spaced dashes across ${spoken.length} lines — each is a fixed pause in the take`);

// --- report -----------------------------------------------------------------
console.log(`lint: ${id} [${format}] — ${spoken.length} spoken shots, ${allWords.length} words, ~${estSeconds.toFixed(0)}s\n`);
if (!findings.length) {
  console.log('clean — nothing to flag.');
  process.exit(0);
}
const byRule = new Map();
for (const f of findings) {
  if (!byRule.has(f.rule)) byRule.set(f.rule, []);
  byRule.get(f.rule).push(f);
}
for (const [rule, fs] of byRule) {
  console.log(`${rule}`);
  for (const f of fs) console.log(`  ${f.where.padEnd(12)} ${f.msg}`);
}
console.log(`\n${findings.length} finding(s) — advisory; the script is yours to judge.`);
if (strict) process.exit(1);
