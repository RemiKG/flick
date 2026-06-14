# Flick — *flick it to life*

> **Every kid draws a whole world. Nobody ever gets to watch it.**
>
> Snap the drawing on your fridge. A little projectionist gives it a story, films it as a
> real ~50-second cartoon, and reads it aloud — and **every single frame still looks like
> your kid drew it.** You just press play.

Flick is an **autonomous Qwen Cloud showrunner** (Qwen Cloud Global AI Hackathon · Track 2,
AI Showrunner). A crew of Qwen models runs the entire short-drama pipeline — scriptwriting →
storyboarding → video generation → editing — while a **fidelity critic** guarantees the
output never stops looking like the child's own drawing. The un-fakeable core is that
fidelity: strip the critic + targeted re-render loop and it's just another AI-smoother that
turns your kid's dragon into a stranger's.

*It moves. It talks. It's still theirs.*

---

## What it does (the one mechanic)

**Pin one drawing → press one button → watch the same wonky drawing, still and then alive.**

1. **The Fridge** — drop a drawing (or take a photo). One button: *Make a flick*.
2. **Backstage** — the crew lights up on screen: Reader → Writer → Storyboarder → Set Painter
   → Camera → Critic → Voice → Cutter. The pipeline **is** the interface; the fidelity meter
   ticks honestly (e.g. a shot comes back at 0.71 → *"let me draw that one again"* → 0.89).
3. **Off the fridge / Still ⇄ Alive** — the drawing peels off the page and steps into its own
   ~50s episode, narrated; the still drawing beside the same drawing moving.
4. **The Drawing Sheet** — exactly what was **kept** (two-sized wings, over-pressed green,
   mismatched eyes…), each with a gold-star seal, plus the one shot that drifted and got
   re-drawn.
5. **The Toy Box** — every flick kept; a light **Series Bible** keeps a child's recurring
   character consistent across episodes.
6. **The Booth** — direct the show (mood, length, video-second budget, fidelity threshold,
   narration voice, aspect, re-draw one shot) + the live **MCP/Skill** tool loop + the ledger.

---

## The crew (eight tools, each a real Qwen Cloud call)

| # | Crew | Tool | Model | Job |
|---|---|---|---|---|
| 1 | The Reader | `read_drawing` | `qwen3-vl-plus` | reads the drawing into a **Drawing Sheet** (hero, palette-as-hex, wonky signatures) |
| 2 | The Writer | `write_story` | `qwen3.7-max` | a 5-beat read-aloud story starring that character |
| 3 | The Storyboarder | `storyboard` | `qwen3.7-plus` | a typed shot list + a Wan prompt per shot (`Entity + Scene + Motion`) |
| 4 | The Set Painter | `paint_set` | `wan2.6-t2i` | paints the world **in the child's hand** |
| 5 | The Camera | `roll_camera` | `wan2.7-r2v` | films each shot with **the drawing as `reference_image`** |
| 6 | The Critic ⭐ | `check_fidelity` | `qwen3-vl-plus` | scores each shot's fidelity back to the drawing; re-draws **only** the one that drifts |
| 7 | The Voice | `voice_line` | `cosyvoice-v3-plus` | warm storybook narration (+ optional cloned grandparent's voice) |
| 8 | The Cutter | `cut_episode` | `ffmpeg` | deterministic assembly of shots + narration into the episode |

All Qwen inference hits **`https://dashscope-intl.aliyuncs.com`** behind a single env var.
Exposed as a **custom MCP server (SSE)** and a **custom Qwen Skill** (`/skill`), so you can
make a flick by texting a photo of the fridge to a bot.

---

## Architecture

```
                    ┌──────────────────────────────  one Node process  ──────────────────────────────┐
  browser (SPA)     │  Express  (src/server/index.js)                                                 │
  ───────────────   │    ├── static  public/         the crayon-scrapbook SPA (vanilla JS + SVG)      │
  crayon art engine │    ├── /api/flicks  (POST)      start a flick from a drawing                     │
  (lib/crayon.js,   │────│    /api/flicks/:id/stream   SSE — every stage as it lands (latency visible) │
   scene.js, ui.js) │    ├── /api/flicks/:id/redraw   targeted single-shot re-render                   │
  movie.js animates │    ├── /api/tools/:name         one crew tool over HTTP (the Skill calls these)  │
  the movie window  │    ├── /mcp/sse  + /mcp/messages the MCP tool surface (JSON-RPC over SSE)         │
                    │    └── /media/...               the persisted media store                        │
                    │                                                                                  │
                    │  pipeline.js  ── the showrunner: runs the crew in order, streams progress,       │
                    │                   runs the fidelity → targeted re-render loop, computes every     │
                    │                   on-screen number live.                                          │
                    │  crew.js      ── the 8 tools. Each: real Qwen call ⟶ honest local fallback.       │
                    │  qwen.js      ── thin fetch client (chat/vision/images/async-video/tts).          │
                    │  ffmpeg.js    ── the Cutter's hands (concat Qwen shots | zoompan the drawing).    │
                    │  store.js     ── the Toy Box: filesystem JSON + media (DB/OSS env seam).          │
                    └──────────────────────────────────────────────────────────────────────────────────┘
```

- **Same art engine everywhere.** `public/lib/{crayon,scene,ui}.js` is a dependency-free,
  seed-locked, procedural SVG crayon system — *every mark placed by code* (wobbling
  `feTurbulence` outlines, back-and-forth scribble fills, paper tooth). It draws the wordmark,
  the mascot, and the child's world. **No diffusion model in the app**; the *cartoons* use
  Qwen video-gen, style-locked to the drawing.
- **The movie window comes alive** (`public/app/movie.js`) via CSS-driven motion (breathe /
  bob / step-off-the-fridge / twinkle), or a real Qwen `<video>` when the crew is live.
- **Streaming, not blocking.** The run streams Drawing Sheet → story → storyboard → shots over
  SSE, so latency is visible and honest.

### Stack
