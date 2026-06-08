// Flick — small shared helpers. The deterministic RNG mirrors the crayon art
// engine's xorshift, so a flick's seed reproduces the same art forever (seed-lock
// = persistence). The local composers back the honest OFFLINE path — real,
// deterministic text/structure, always labelled `engine:'local'`, never dressed
// up as a Qwen result.

export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) || 1;
}

export function newId() {
  const s = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
  const r = rng(seed);
  for (let i = 0; i < 10; i++) out += s[Math.floor(r() * s.length)];
  return out;
}

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const round2 = (v) => Math.round(v * 100) / 100;

const GENERIC = (h) => !h || /^(your|the) drawing$/i.test(h.trim());

// A friendly title from a hero + mood, deterministic (offline Writer helper).
export function localTitle(hero, mood, r) {
  const cap = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());
  // when we can't read the drawing (offline), don't force an awkward name into the title
  if (GENERIC(hero)) {
    const noName = {
      'a bedtime story': ['The Sleepy Moon', 'The Brave Little Flame', 'Goodnight, Little One'],
      'an adventure': ['The Lost Star', 'The Very Tall Tree', 'The Big Hill'],
      'a bit silly': ['The Runaway Sock', 'A Rainbow Sneeze', 'The Whole Cake'],
      gentle: ['A Kind Cloud', 'The New Friend', 'The Sharing Day'],
    };
    const l = noName[mood] || noName.gentle;
    return l[Math.floor(r() * l.length)];
  }
  const H = cap(hero);
  const byMood = {
    'a bedtime story': [`${H} and the Sleepy Moon`, `${H} Was Scared of the Dark`, `Goodnight, ${H}`],
    'an adventure': [`${H} Finds the Lost Star`, `${H} and the Very Tall Tree`, `${H} Climbs the Big Hill`],
    'a bit silly': [`${H} and the Runaway Sock`, `${H} Sneezes a Rainbow`, `${H} Eats the Whole Cake`],
    gentle: [`${H} Makes a Friend`, `${H} and the Kind Cloud`, `${H} Learns to Share`],
  };
  const list = byMood[mood] || byMood.gentle;
  return list[Math.floor(r() * list.length)];
}

// A real 5–6 beat arc (want -> snag -> turn -> warm ending), ~read-aloud voice.
export function localStory(hero, place, mood, r) {
  const H = GENERIC(hero) ? 'a little one' : hero;
  const P = place || 'a green hill';
  const beats = [
    { key: 'pin', text: `Once there was ${H}, who lived on ${P} and wanted just one thing.` },
    { key: 'peel', text: `But when the day came, something small stood in the way, and ${H} wasn't sure at all.` },
    { key: 'it moves', text: `So ${H} took one brave step, and then another, right across the whole wide world.` },
    { key: 'the moon', text: `And when it got dark, ${H} found that the thing they feared was smaller than they thought.` },
    { key: 'home', text: `So ${H} went home, a little braver — and everything was warm, and everything was theirs.` },
  ];
  return {
    beats,
    narration: beats.map((b) => b.text).join(' '),
    title: localTitle(hero, mood, r),
  };
}

// Split a story into N typed shots (offline Storyboarder). Camera + motion vary
// deterministically so the shot strip reads like a real board.
export function localShots(story, n, totalSeconds, r) {
  const cams = ['wide establishing', 'medium follow', 'close on the face', 'low tracking', 'wide pull-back'];
  const motions = ['a slow reveal', 'walking left to right', 'a gentle bob and blink', 'breathing a small flame', 'walking home'];
  const per = Math.max(2, Math.round(totalSeconds / n));
  const shots = [];
  for (let i = 0; i < n; i++) {
    const beat = story.beats[Math.min(i, story.beats.length - 1)];
    shots.push({
      shot_no: i + 1,
      subject: beat.text.slice(0, 64),
      camera: cams[i % cams.length],
      motion: motions[i % motions.length],
      duration_s: per,
      edit_beat: beat.key,
      wan_prompt: `${beat.text} ${cams[i % cams.length]}, ${motions[i % motions.length]}. Preserve the child's crayon texture and wonky proportions — do not smooth or correct.`,
    });
  }
  return shots;
}
