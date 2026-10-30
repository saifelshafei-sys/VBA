#!/usr/bin/env python3
"""Write brand captions (ASS): Inter Bold, white on a navy box, the spoken word in gold.

Usage: captions.py words.json OUT.ass --width 1080 --height 1920 [--words-per-line 4]
Burn in with: ffmpeg -i in.mp4 -vf "ass=OUT.ass" ...
"""
import argparse
import json
import re

NAVY, GOLD, WHITE = "&H003A1F0B", "&H0027A2C9", "&H00FFFFFF"  # ASS colours are &HAABBGGRR

ap = argparse.ArgumentParser()
ap.add_argument("words")
ap.add_argument("out")
ap.add_argument("--width", type=int, default=1080)
ap.add_argument("--height", type=int, default=1920)
ap.add_argument("--words-per-line", type=int, default=4)
ap.add_argument("--font", default="Inter")
a = ap.parse_args()
words = [w for w in json.load(open(a.words)) if w["text"].strip()]

vertical = a.height > a.width
size = round(a.height * (0.05 if vertical else 0.055))
margin_v = round(a.height * (0.26 if vertical else 0.08))  # clear of platform buttons


def ts(t):
    t = max(0, t)
    return f"{int(t // 3600)}:{int(t % 3600 // 60):02d}:{t % 60:05.2f}"


lines, cur = [], []
for i, w in enumerate(words):
    cur.append(w)
    nxt = words[i + 1] if i + 1 < len(words) else None
    if (len(cur) >= a.words_per_line or re.search(r"[.?!,]$", w["text"]) or nxt is None
            or nxt["start"] - w["end"] > 0.4):
        lines.append(cur)
        cur = []

events = []
for n, line in enumerate(lines):
    # A line ends where the next begins: overlapping events would stack and jump.
    line_end = line[-1]["end"] + 0.15
    if n + 1 < len(lines):
        line_end = min(line_end, lines[n + 1][0]["start"])
    for j, w in enumerate(line):
        end = line[j + 1]["start"] if j + 1 < len(line) else line_end
        text = " ".join((r"{\c" + GOLD + "&}" + x["text"].upper() + r"{\c" + WHITE + "&}") if k == j
                        else x["text"].upper() for k, x in enumerate(line))
        events.append(f"Dialogue: 0,{ts(w['start'])},{ts(end)},Cap,,0,0,0,,{text}")

header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {a.width}
PlayResY: {a.height}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,{a.font},{size},{WHITE},{WHITE},{NAVY},&H66000000,-1,0,0,0,100,100,1,0,3,{round(size * 0.28)},0,2,{round(a.width * 0.08)},{round(a.width * 0.08)},{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
open(a.out, "w").write(header + "\n".join(events) + "\n")
print(f"{len(lines)} caption lines, {len(events)} events -> {a.out}")
