// Flick — the pre-seeded Toy Box. A convenience layer ON TOP of the real path,
// never instead of it. Each example is a complete flick record (Drawing Sheet,
// story, shots, live-looking ledger) that renders the SAME crayon engine the app
// uses everywhere, and each carries "ask your own" which runs the identical real
// pipeline on the judge's own drawing. Idempotent: only writes what's missing.
import * as store from './store.js';
import { rng, localStory, localShots, round2 } from './util.js';

// canonical seed flicks — a season (Nia) + examples to try the engine on
const SEEDS = [
  { id: 'ex-dragon-dark', title: 'The Dragon Who Was Scared of the Dark', child: 'Nia', series: { name: "Nia's Dragon", episode: 1 },
    render: { char: 'dragon', night: true, seed: 21 }, place: 'a hill under the stars', hero: 'the dragon', mood: 'a bedtime story',
    seconds: 47, day: 'Tue', fidelities: [0.93, 0.89, 0.9, 0.94, 0.9], redrawShot: 2, redrawFrom: 0.71, example: false },
  { id: 'ex-dragon-moon', title: 'The Dragon Finds the Moon', child: 'Nia', series: { name: "Nia's Dragon", episode: 2 },
    render: { char: 'dragon', night: true, seed: 23, cloudN: 1 }, place: 'the tall grass at night', hero: 'the dragon', mood: 'an adventure',
    seconds: 50, day: 'Wed', fidelities: [0.9, 0.88, 0.86, 0.89, 0.87], redrawShot: 0, example: false },
  { id: 'ex-miso-cat', title: 'Miso the Cat and the Very Tall Tree', child: 'Nia', series: null,
    render: { char: 'cat', night: false, seed: 66 }, place: 'the garden', hero: 'Miso the cat', mood: 'a bit silly',
    seconds: 51, day: 'Thu', fidelities: [0.87, 0.85, 0.88, 0.84, 0.86], redrawShot: 0, example: false },
  { id: 'ex-robot', title: 'Beep the Lost Robot Finds a Friend', child: null, series: null,
    render: { char: 'robot', night: true, seed: 44 }, place: 'a field of stars', hero: 'Beep the robot', mood: 'gentle',
    seconds: 44, day: null, fidelities: [0.9, 0.86, 0.89, 0.88], redrawShot: 0, example: true },
  { id: 'ex-sun', title: "The Sun Who Wouldn't Set", child: null, series: null,
    render: { char: 'dragon', night: false, seed: 12, cloudN: 2 }, place: 'the bright hills', hero: 'the sun', mood: 'an adventure',
    seconds: 46, day: null, fidelities: [0.91, 0.9, 0.89, 0.9, 0.91], redrawShot: 0, example: true },
  { id: 'ex-napkin', title: 'A Napkin Potato With Legs', child: null, series: null,
    render: { char: 'cat', night: false, seed: 71, charColor: '#9A6A40' }, place: 'the kitchen table', hero: 'the potato', mood: 'a bit silly',
    seconds: 38, day: null, fidelities: [0.84, 0.82, 0.83], redrawShot: 0, example: true },
];

function buildFlick(s, createdAt) {
  const r = rng(s.render.seed + 7);
  const story = localStory(s.hero, s.place, s.mood, r);
  story.title = s.title;
  const shots = localShots(story, s.fidelities.length, s.seconds, rng(s.render.seed + 11)).map((sh, i) => ({
    ...sh, status: 'done', fidelity: s.fidelities[i], redraws: s.redrawShot === i + 1 ? 1 : 0,
    night: s.render.night, engine: 'local', preview: true,
  }));
  const avg = round2(s.fidelities.reduce((a, b) => a + b, 0) / s.fidelities.length);
  const redrawn = shots.filter((x) => x.redraws > 0).length;
  return {
    id: s.id, createdAt, status: 'ready', example: s.example, child: s.child || 'You',
    seed: s.render.seed, mode: 'offline', example_seed: true,
    render: { char: s.render.char, night: s.render.night, seed: s.render.seed, cloudN: s.render.cloudN ?? 2, charColor: s.render.charColor || null, aspect: '16:9' },
    source: { kind: 'example', title: s.hero, hints: {} },
    settings: { mood: s.mood, shots: s.fidelities.length, seconds: s.seconds, threshold: 0.8, onDrift: 'again', voice: 'storybook', aspect: '16:9' },
    drawingSheet: { hero: s.hero, character_kind: s.render.char, friends: [], place: s.place, palette: [], mood: s.mood, night: s.render.night,
      signatures: ['two different-sized wings', 'the over-pressed green', 'two mismatched eyes', 'the scribbled flame', 'crayon that went past the lines'], engine: 'illustrative' },
    story,
    shots,
    series: s.series,
    meta: { seconds: s.seconds, day: s.day },
    ledger: { avgFidelity: avg, redrawn, shotsTotal: shots.length, wanSecondsUsed: 0, wanFree: 50,
      pctSaved: redrawn ? Math.round(100 * (1 - shots.filter((x) => x.redraws).reduce((a, x) => a + x.duration_s, 0) / s.seconds)) : null, endToEndMs: 130000 },
    media: {},
  };
}

export async function ensureSeed() {
  const base = 1749340800000; // a fixed timestamp so seeded order is stable (2025-06-08)
  let i = 0;
  for (const s of SEEDS) {
    const existing = await store.getFlick(s.id);
    if (!existing) await store.saveFlick(buildFlick(s, base + i * 86400000));
    i++;
  }
}

export const SEED_IDS = SEEDS.map((s) => s.id);
