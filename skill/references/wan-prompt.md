# The Wan prompt formula (The Storyboarder + The Camera)

Qwen Cloud's video docs endorse a **meta-prompt** step: `qwen3.7-plus` expands a one-line
beat into a structured video prompt, then `wan2.7-r2v` films it with the child's drawing as
the `reference_image`.

## The formula

```
Prompt = Entity + Scene + Motion (+ Aesthetic + Stylization)
```

- **Entity** — the child's character, named from the Drawing Sheet ("the green dragon with
  two different-sized wings").
- **Scene** — where the beat happens ("on a hill under the stars, a crayon moon").
- **Motion** — one clear action per shot ("walks left to right, blinks, breathes a small
  scribbled flame"). Keep it to a single beat; short shots hold fidelity.
- **Aesthetic** — "children's crayon-and-construction-paper, wobbling outlines, colour past
  the lines, visible paper tooth".
- **Stylization (always append)** — **"Preserve the child's crayon texture and wonky
  proportions — do not smooth or correct."**

## The Camera call (`wan2.7-r2v`)

- `reference_image` = the child's drawing (a public URL or base64). This is what makes the
  motion keep the exact hand-drawn look — the non-fakeable heart.
- `resolution: "720P"` (pay $0.10/s not $0.15/s), `ratio` per the Booth's Shape control,
  `watermark: false`, `prompt_extend: false`, a per-shot `seed`.
- Async: submit → poll `/tasks/{id}` → download the `video_url` immediately (valid ~24h).
- Fallback model: `happyhorse-1.1-r2v`.

## Multi-shot in one storyboard

`wan2.7-r2v` can take a **multi-panel storyboard image** and stage the whole episode at once
(it auto-detects the panel layout). Cheaper than one job per shot, and it keeps the
character consistent across the episode.

## Duration budget

Free-tier Wan is ~50 seconds/model. Keep episodes short and re-draw **only** the shot that
drifts — the "maximise quality under a limited token budget" the track grades.
