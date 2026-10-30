#!/usr/bin/env python3
"""Move word times onto the cut timeline so captions line up after cutting.

Usage: retime.py words.json keep.json OUT_words.json
"""
import json
import sys

words, keep = json.load(open(sys.argv[1])), json.load(open(sys.argv[2]))["keep"]
out, offset = [], 0.0
for s, e in keep:
    for w in words:
        if w["start"] >= s and w["end"] <= e + 0.05:
            out.append({**w, "start": round(w["start"] - s + offset, 3), "end": round(min(w["end"], e) - s + offset, 3)})
    offset += e - s
json.dump(out, open(sys.argv[3], "w"), ensure_ascii=False, indent=1)
print(f"{len(out)} words retimed -> {sys.argv[3]}")
