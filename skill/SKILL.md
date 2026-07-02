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
