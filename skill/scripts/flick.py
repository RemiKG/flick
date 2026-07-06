#!/usr/bin/env python3
"""Flick skill — drawing -> faithful cartoon, on Qwen Cloud. Stdlib only (no pip).

Two real modes, no mocks:
  • If FLICK_URL is set, drive a running Flick backend (the identical pipeline the
    web app runs): read_drawing / write_story / storyboard / ... / make.
  • Else, call Qwen Cloud directly with DASHSCOPE_API_KEY for the vision + text steps
    (base URL https://dashscope-intl.aliyuncs.com/compatible-mode/v1).

The key is read from the environment and never hardcoded. Usage:
  python flick.py read  --image ./fridge-dragon.jpg
  python flick.py story --sheet sheet.json --mood "a bedtime story"
  python flick.py make  --image ./fridge-dragon.jpg          (needs FLICK_URL)
"""
import argparse, base64, json, mimetypes, os, sys, urllib.error, urllib.request

BASE_URL = os.environ.get("DASHSCOPE_BASE_URL", "https://dashscope-intl.aliyuncs.com/compatible-mode/v1").rstrip("/")
FLICK_URL = os.environ.get("FLICK_URL", "").rstrip("/")
KEY = os.environ.get("DASHSCOPE_API_KEY", "").strip()

MODELS = {"reader": "qwen3-vl-plus", "writer": "qwen3.7-max", "storyboarder": "qwen3.7-plus"}


def _post(url, body, headers):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode())


def _image_to_url(image):
    if image.startswith("http://") or image.startswith("https://") or image.startswith("data:"):
        return image
    mime = mimetypes.guess_type(image)[0] or "image/png"
    with open(image, "rb") as f:
        return f"data:{mime};base64," + base64.b64encode(f.read()).decode()


def _qwen_chat(model, messages, extra=None):
    if not KEY:
        sys.exit("No DASHSCOPE_API_KEY set. Get one at https://home.qwencloud.com/api-keys, or set FLICK_URL to use a running Flick server.")
    body = {"model": model, "messages": messages}
    if extra:
        body.update(extra)
    hdr = {"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
    out = _post(f"{BASE_URL}/chat/completions", body, hdr)
    return out["choices"][0]["message"]["content"]


def _server_tool(name, args):
    out = _post(f"{FLICK_URL}/api/tools/{name}", args, {"Content-Type": "application/json"})
    return out


def read_drawing(image):
    if FLICK_URL:
        return _server_tool("read_drawing", {"image": _image_to_url(image)})
    prompt = ('You are The Reader. Read this child\'s drawing into a Drawing Sheet. STRICT JSON: '
              '{"hero":"...","character_kind":"dragon|cat|robot|person|creature|other","place":"...",'
              '"palette":["#rrggbb",...],"mood":"...","night":true|false,'
              '"signatures":["the wonky choices to keep"]}')
    txt = _qwen_chat(MODELS["reader"], [{"role": "user", "content": [
        {"type": "image_url", "image_url": {"url": _image_to_url(image)}},
        {"type": "text", "text": prompt}]}], {"temperature": 0.4})
    return _first_json(txt)


def write_story(sheet, mood):
    if FLICK_URL:
        return _server_tool("write_story", {"sheet": sheet, "mood": mood})
    sys_p = "You are The Writer. A warm 5-beat read-aloud story for the given character. ~110 words."
    user = (f"Character: {json.dumps(sheet)}. Mood: {mood}. STRICT JSON: "
            '{"title":"...","beats":[{"key":"pin","text":"..."},{"key":"peel","text":"..."},'
            '{"key":"it moves","text":"..."},{"key":"the moon","text":"..."},{"key":"home","text":"..."}],"narration":"..."}')
    txt = _qwen_chat(MODELS["writer"], [{"role": "system", "content": sys_p}, {"role": "user", "content": user}], {"temperature": 0.8})
    return _first_json(txt)


def make(image, child, mood):
    if not FLICK_URL:
        sys.exit("make needs a running Flick backend. Set FLICK_URL, e.g. export FLICK_URL=http://localhost:8080")
    out = _post(f"{FLICK_URL}/api/flicks", {"image": _image_to_url(image), "child": child, "settings": {"mood": mood}}, {"Content-Type": "application/json"})
    return out


def _first_json(text):
    for op, cl in (("{", "}"), ("[", "]")):
        i = text.find(op)
        if i < 0:
            continue
        depth = 0
        for k in range(i, len(text)):
            if text[k] == op:
                depth += 1
            elif text[k] == cl:
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(text[i:k + 1])
                    except Exception:
                        break
    return {"raw": text}


def main():
    ap = argparse.ArgumentParser(description="Flick — drawing to faithful cartoon (Qwen Cloud)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("read"); r.add_argument("--image", required=True)
    s = sub.add_parser("story"); s.add_argument("--sheet", required=True); s.add_argument("--mood", default="a bedtime story")
    m = sub.add_parser("make"); m.add_argument("--image", required=True); m.add_argument("--child", default="You"); m.add_argument("--mood", default="a bedtime story")
    a = ap.parse_args()
    if a.cmd == "read":
        print(json.dumps(read_drawing(a.image), indent=2))
    elif a.cmd == "story":
        with open(a.sheet) as f:
            sheet = json.load(f)
        print(json.dumps(write_story(sheet, a.mood), indent=2))
    elif a.cmd == "make":
        print(json.dumps(make(a.image, a.child, a.mood), indent=2))


if __name__ == "__main__":
    main()
