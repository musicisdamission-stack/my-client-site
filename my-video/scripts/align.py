"""Align written lyrics (one line per row, hand-timed chants removed) to whisper words:
python3 align.py words_medium.en.json src/data/lyrics.json lyrics.txt"""
import json, re, sys, difflib
wh = json.load(open(sys.argv[1]))
ww = [w for s in wh for w in s["words"]]
norm = lambda t: re.sub(r"[^a-z0-9]", "", t.lower().replace("’", "'"))
wt = [norm(w["w"]) for w in ww]

HOOK = ("stack the guap", "make it big", "devil", "spotlight the fraud", "i choose the light", "i am the flame", "god's the plot", "raw!")
BRIDGE = ("the facade's crumbling", "(raw truth")
lines = []
for raw in open(sys.argv[3]).read().strip().split("\n"):
    low = raw.lower().replace("’", "'")
    sec = "bridge" if low.startswith(BRIDGE) else "hook" if low.startswith(HOOK) or low.startswith("(make it big") else "verse"
    toks = [t for t in re.split(r"\s+|—|\s/\s", raw.replace(" / ", " ")) if t and norm(t)]
    lines.append({"text": raw.replace(" / ", " "), "section": sec, "words": [{"t": t} for t in toks]})

flat = [w for l in lines for w in l["words"]]
lt = [norm(w["t"]) for w in flat]
sm = difflib.SequenceMatcher(None, lt, wt, autojunk=False)
for a, b, n in sm.get_matching_blocks():
    for k in range(n):
        flat[a+k]["s"], flat[a+k]["e"] = ww[b+k]["s"], ww[b+k]["e"]
matched = sum("s" in w for w in flat)
# manual anchors where whisper hallucinated (verse 2 opening sits under a bogus "Make it big")
for l in lines:
    if l["text"].startswith("Influencer altars"):
        l["words"][0]["s"], l["words"][0]["e"] = 158.0, 158.4
        for w in l["words"][1:5]: w.pop("s", None); w.pop("e", None)
        l["words"][5]["s"], l["words"][5]["e"] = 160.46, 160.82
# interpolate gaps
i = 0
while i < len(flat):
    if "s" in flat[i]: i += 1; continue
    j = i
    while j < len(flat) and "s" not in flat[j]: j += 1
    t0 = flat[i-1]["e"] if i > 0 else 0.0
    t1 = flat[j]["s"] if j < len(flat) else t0 + 0.35*(j-i)
    step = (t1 - t0) / (j - i + 1)
    step = min(step, 0.45)  # keep words tight to the preceding vocal
    for k in range(i, j):
        flat[k]["s"] = round(t0 + step*(k-i+0.5), 3); flat[k]["e"] = round(flat[k]["s"] + step*0.9, 3)
    flat[k]["interp"] = True
    i = j
CHANTS = [127.6, 141.98, 146.84, 151.8, 247.2, 252.16, 257.08, 260.52]
for c in CHANTS:
    words = [{"t": "MAKE", "s": c, "e": c + 0.4}, {"t": "IT", "s": c + 0.4, "e": c + 0.6}, {"t": "BIG", "s": c + 0.6, "e": c + 1.2}]
    lines.append({"text": "MAKE IT BIG", "section": "hook", "words": words})
lines.sort(key=lambda l: l["words"][0]["s"])
for n, l in enumerate(lines):
    l["start"] = l["words"][0]["s"]
    nxt = lines[n+1]["words"][0]["s"] if n+1 < len(lines) else None
    l["end"] = min(nxt, l["words"][-1]["e"] + 2.5) if nxt else l["words"][-1]["e"] + 3
    for w in l["words"]:
        w["s"], w["e"] = round(w["s"], 3), round(w["e"], 3); w.pop("interp", None)
print(f"matched {matched}/{len(flat)} words", file=sys.stderr)
for l in lines: print(f'{l["start"]:7.2f}-{l["end"]:7.2f} [{l["section"]}] {l["text"][:70]}', file=sys.stderr)
json.dump(lines, open(sys.argv[2], "w"), indent=1)
