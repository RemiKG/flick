---
name: flick-drawing-to-cartoon
description: >
  Turn one child's drawing into a real ~50-second animated cartoon that STILL LOOKS
  LIKE THEY DREW IT. A crew of Qwen Cloud models runs the whole short-drama pipeline —
  read the drawing, write a story, storyboard it, paint the world in the child's hand,
  film it with the drawing as the reference image, score each shot's fidelity and
  re-draw only the one that drifts, narrate it, and cut the episode. The un-fakeable
  core is the fidelity critic + targeted single-shot re-render loop.
triggers:
  - a photo / scan of a child's drawing (or any doodle) that should become a cartoon
  - "make a flick", "bring this drawing to life", "animate my kid's drawing"
  - "keep it looking like they drew it", "don't smooth the drawing"
license: MIT
homepage: https://github.com/ (the Flick repo)
base_url: https://dashscope-intl.aliyuncs.com/compatible-mode/v1
models:
  reader: qwen3-vl-plus
  writer: qwen3.7-max
  storyboarder: qwen3.7-plus
  set_painter: wan2.6-t2i
  camera: wan2.7-r2v
  critic: qwen3-vl-plus
  voice: cosyvoice-v3-plus
  voice_clone: qwen-voice-enrollment
---

# Flick — drawing → faithful cartoon (a Qwen Cloud showrunner skill)

A solo director running the whole production team. Eight tools, each a real Qwen Cloud
call on `https://dashscope-intl.aliyuncs.com`. The output is worthless the instant it
stops looking like the actual drawing — so **fidelity is the load-bearing core**.

## The crew (tools)

| tool | model | what it does |
|---|---|---|
| `read_drawing` | `qwen3-vl-plus` | reads the drawing into a Drawing Sheet — hero, palette-as-hex, wonky signatures |
| `write_story` | `qwen3.7-max` | a 5-beat read-aloud story starring that character |
| `storyboard` | `qwen3.7-plus` | a typed shot list + a Wan prompt per shot (`Entity + Scene + Motion`) |
| `paint_set` | `wan2.6-t2i` | paints the world in the child's hand |
| `roll_camera` | `wan2.7-r2v` | films each shot with **the drawing as the `reference_image`** |
| `check_fidelity` | `qwen3-vl-plus` | scores each shot's fidelity back to the drawing (0–1) and flags the one to re-draw |
| `voice_line` | `cosyvoice-v3-plus` | warm storybook narration (optionally a cloned grandparent's voice) |
| `cut_episode` | `ffmpeg` | assembles the shots + narration into the ~50s episode |

## How to run it

Two ways, both real:

1. **Against a running Flick server** (recommended — the identical pipeline the web app runs):
   ```bash
   export FLICK_URL=http://localhost:8080        # your deployed Flick backend
   python scripts/flick.py make --image ./fridge-dragon.jpg --mood "a bedtime story"
   # -> prints the flick id + a watch URL; the server streams progress over SSE
   ```

2. **Directly against Qwen Cloud** (self-contained; needs `DASHSCOPE_API_KEY`):
   ```bash
   export DASHSCOPE_API_KEY=sk-...              # from https://home.qwencloud.com/api-keys
   python scripts/flick.py read  --image ./fridge-dragon.jpg     # -> the Drawing Sheet
   python scripts/flick.py story --sheet sheet.json             # -> the story
   ```

`scripts/flick.py` is stdlib-only (no pip installs). It reads `DASHSCOPE_API_KEY` from the
environment and never hardcodes a key. See `references/rubric.md` for the fidelity rubric
and `references/wan-prompt.md` for the `Entity + Scene + Motion` prompt formula.

## The one promise

> No smoothing. No "improving." No turning your kid's dragon into someone else's.
