#!/usr/bin/env python3
"""Turn a word-timed transcript into a keep list: drop retakes and long pauses.

Usage: plan_cuts.py words.json keep.json [--max-pause 0.5] [--pad 0.1]
Prints every drop with its reason so you can check it before rendering.
"""
import argparse
import json
import re

CUES = ["let's redo", "lets redo", "redo that", "let me redo", "start again", "start over",
        "let me start", "cut that", "one more time", "take two", "scratch that", "let me try that again"]

ap = argparse.ArgumentParser()
ap.add_argument("words")
ap.add_argument("out")
ap.add_argument("--max-pause", type=float, default=0.5)
ap.add_argument("--pad", type=float, default=0.1)
a = ap.parse_args()
words = json.load(open(a.words))


def norm(t):
    return re.sub(r"[^\w']", "", t.lower())


# Group words into sentences: end punctuation or a gap over 1 second.
sentences, cur = [], []
for i, w in enumerate(words):
    cur.append(i)
    nxt = words[i + 1] if i + 1 < len(words) else None
    if re.search(r"[.?!]$", w["text"]) or nxt is None or nxt["start"] - w["end"] > 1.0:
        sentences.append(cur)
        cur = []

drop, dropped = set(), []


def mark(idx, reason):
    if idx in drop:
        return
    drop.add(idx)
    ws = [words[i] for i in sentences[idx]]
    dropped.append({"start": ws[0]["start"], "end": ws[-1]["end"],
                    "text": " ".join(w["text"] for w in ws), "reason": reason})


for s, idxs in enumerate(sentences):
    text = " ".join(norm(words[i]["text"]) for i in idxs)
    if any(c in text for c in CUES):
        mark(s, "spoken retake cue")
        if s > 0:
            mark(s - 1, "take before a retake cue")
    if s + 1 < len(sentences):
        a3 = [norm(words[i]["text"]) for i in idxs[:3]]
        b3 = [norm(words[i]["text"]) for i in sentences[s + 1][:3]]
        if len(a3) >= 2 and a3 == b3[:len(a3)]:
            mark(s, "sentence restarted right after")

kept = [words[i] for s, idxs in enumerate(sentences) if s not in drop for i in idxs]
keep = []
for w in kept:
    if keep and w["start"] - keep[-1][1] <= a.max_pause:
        keep[-1][1] = w["end"]
    else:
        keep.append([w["start"], w["end"]])
keep = [[round(max(0, s - a.pad), 3), round(e + a.pad, 3)] for s, e in keep]
for k in range(1, len(keep)):  # padding must not overlap
    if keep[k][0] < keep[k - 1][1]:
        keep[k][0] = keep[k - 1][1]

json.dump({"keep": keep, "dropped": sorted(dropped, key=lambda d: d["start"])}, open(a.out, "w"), indent=1)
total = sum(e - s for s, e in keep)
print(f"{len(keep)} segments, {total:.1f}s kept; dropped {len(dropped)} takes:")
for d in sorted(dropped, key=lambda d: d["start"]):
    print(f"  {d['start']:7.2f}-{d['end']:7.2f}  [{d['reason']}]  {d['text']}")
