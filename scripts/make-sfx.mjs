// Generate sound effects with the ElevenLabs sound-generation API.
//
//   node scripts/make-sfx.mjs <film-id|explainer-id>   generate its missing cues
//   node scripts/make-sfx.mjs --name relay-clunk --prompt "a heavy electrical relay closing, close mic, dry"
//   node scripts/make-sfx.mjs <film-id> --force    regenerate everything
//   node scripts/make-sfx.mjs <film-id> --list     show what would be generated
//
// SFX are the cheapest fidelity in the whole pipeline. A transformer hum under
// the transmission act, a breaker slam on the substation cut, a switch click on
// the cold open — each is one API call and each does more for perceived
// production value than an hour of shader work.
//
// Cues are declared ONCE in the film manifest's `sfxLibrary`, so a cue used in
// four shots is generated once and reused:
//   sfxLibrary: { 'relay-clunk': { prompt: '...', seconds: 2, influence: 0.6 } }
// Shots reference them by name: sfx: [{ file: 'relay-clunk', at: 0.8 }]
//
// Output: assets/sfx/<name>.mp3 — the same folder export-video.mjs already
// mixes from, so generated cues work for shorts too.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

if (existsSync(resolve('.env'))) process.loadEnvFile(resolve('.env'));

const args = process.argv.slice(2);
const filmId = args.find((a) => !a.startsWith('--'));
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const force = args.includes('--force');
const listOnly = args.includes('--list');

const key = process.env.ELEVENLABS_API_KEY;
const outDir = resolve('assets/sfx');
mkdirSync(outDir, { recursive: true });

// Collect { name, prompt, seconds, influence } from either a film manifest or
// the one-off --name/--prompt flags.
let cues = [];
const oneOffName = opt('name', null);
if (oneOffName) {
  const prompt = opt('prompt', null);
  if (!prompt) {
    console.error('--name needs --prompt "<description of the sound>"');
    process.exit(1);
  }
  cues = [{ name: oneOffName, prompt, seconds: Number(opt('seconds', '3')), influence: Number(opt('influence', '0.4')) }];
} else if (filmId) {
  // One id, two possible homes: a film manifest or an explainer's video.js.
  // Both declare the SAME `sfxLibrary` shape and both are consumed from the
  // same assets/sfx folder, so there is no reason for an explainer to have
  // needed a different command — it just never had one, which is why 0 of 68
  // shipped shorts carry a single sound.
  const filmPath = resolve(`films/${filmId}/film.js`);
  const videoPath = resolve(`src/explainers/${filmId}/video.js`);
  const isFilm = existsSync(filmPath);
  const srcPath = isFilm ? filmPath : videoPath;
  if (!existsSync(srcPath)) {
    console.error(`no films/${filmId}/film.js and no src/explainers/${filmId}/video.js`);
    process.exit(1);
  }
  const mod = (await import(pathToFileURL(srcPath))).default;
  const lib = mod.sfxLibrary ?? {};
  cues = Object.entries(lib).map(([name, v]) =>
    typeof v === 'string'
      ? { name, prompt: v, seconds: 3, influence: 0.4 }
      : { name, prompt: v.prompt, seconds: v.seconds ?? 3, influence: v.influence ?? 0.4 },
  );
  console.log(`${isFilm ? 'film' : 'explainer'}: ${srcPath}`);
  // Warn about cues shots reference but the library never declares — that
  // mismatch otherwise surfaces as a silent gap in the finished mix.
  const declared = new Set(cues.map((c) => c.name));
  const used = new Set();
  const eat = (shots) => {
    for (const shot of shots ?? []) for (const s of shot.sfx ?? []) used.add(s.file);
  };
  if (isFilm) for (const act of mod.acts ?? []) eat(act.shots);
  else for (const f of ['short', 'long']) eat(mod[f]?.shots);
  for (const u of used) if (!declared.has(u)) console.warn(`  shots reference "${u}" but sfxLibrary does not declare it`);
  for (const c of cues) if (!used.has(c.name)) console.warn(`  sfxLibrary declares "${c.name}" but no shot uses it`);
} else {
  console.error('usage: node scripts/make-sfx.mjs <film-id|explainer-id> | --name <n> --prompt "<desc>"');
  process.exit(1);
}

const pending = cues.filter((c) => force || !existsSync(join(outDir, `${c.name}.mp3`)));
console.log(`${cues.length} cues declared, ${pending.length} to generate${force ? ' (--force)' : ''}`);
if (listOnly) {
  for (const c of pending) console.log(`  ${c.name} (${c.seconds}s) — "${c.prompt}"`);
  process.exit(0);
}
if (!pending.length) process.exit(0);

if (!key) {
  console.error('ELEVENLABS_API_KEY not set in .env — cannot generate sound effects.');
  process.exit(1);
}

// prompt_influence: how literally the model follows the text. Low (~0.3) gives
// a more natural, varied result; high (~0.7) hews to the description and is
// what you want for a specific mechanical sound ("a single relay contact
// closing") rather than an ambience ("distant substation hum").
for (const cue of pending) {
  process.stdout.write(`  ${cue.name} (${cue.seconds}s)... `);
  const res = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({
      text: cue.prompt,
      duration_seconds: Math.max(0.5, Math.min(22, cue.seconds)),
      prompt_influence: Math.max(0, Math.min(1, cue.influence)),
    }),
  });
  if (!res.ok) {
    console.log('FAILED');
    console.error(`    ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
    continue;
  }
  writeFileSync(join(outDir, `${cue.name}.mp3`), Buffer.from(await res.arrayBuffer()));
  console.log('ok');
}

console.log(`-> ${outDir}`);
console.log('listen to them before rendering: a wrong-feeling cue is worse than no cue.');
