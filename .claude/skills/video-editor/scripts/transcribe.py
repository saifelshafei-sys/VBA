#!/usr/bin/env python3
"""Write every spoken word with its start and end time to JSON.

Usage: transcribe.py VIDEO OUT.json [--model small] [--language en]
Output: [{"text": "Hello", "start": 0.42, "end": 0.71}, ...]
"""
import argparse
import json

from faster_whisper import WhisperModel

ap = argparse.ArgumentParser()
ap.add_argument("video")
ap.add_argument("out")
ap.add_argument("--model", default="small", help="tiny, base, small, medium, large-v3")
ap.add_argument("--language", default=None, help="e.g. en, ar; omit to auto-detect")
a = ap.parse_args()

model = WhisperModel(a.model, compute_type="int8")
segments, info = model.transcribe(a.video, language=a.language, word_timestamps=True,
                                  vad_filter=True, task="transcribe")
words = []
for seg in segments:
    for w in seg.words or []:
        words.append({"text": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3)})
with open(a.out, "w") as f:
    json.dump(words, f, ensure_ascii=False, indent=1)
print(f"{len(words)} words, language {info.language}, {info.duration:.1f}s -> {a.out}")
