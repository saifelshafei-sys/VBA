#!/usr/bin/env python3
"""Render a keep list from a work copy at the highest quality, optionally with captions and reframing.

Usage: render.py WORK_COPY keep.json OUT.mp4 [--ass captions.ass] [--size 1080x1920]
Captions must be timed to the CUT video (run captions.py on retimed words).
"""
import argparse
import json
import subprocess

ap = argparse.ArgumentParser()
ap.add_argument("src")
ap.add_argument("keep")
ap.add_argument("out")
ap.add_argument("--ass")
ap.add_argument("--size", help="WxH; scales and center-crops to fill, e.g. 1080x1920")
a = ap.parse_args()
keep = json.load(open(a.keep))["keep"]

parts, labels = [], ""
for i, (s, e) in enumerate(keep):
    parts.append(f"[0:v]trim={s}:{e},setpts=PTS-STARTPTS[v{i}];[0:a]atrim={s}:{e},asetpts=PTS-STARTPTS[a{i}]")
    labels += f"[v{i}][a{i}]"
graph = ";".join(parts) + f";{labels}concat=n={len(keep)}:v=1:a=1[v][a]"
vf = []
if a.size:
    w, h = a.size.split("x")
    vf.append(f"scale={w}:{h}:force_original_aspect_ratio=increase:flags=lanczos,crop={w}:{h}")
if a.ass:
    vf.append(f"ass={a.ass}")
if vf:
    graph += f";[v]{','.join(vf)}[vo]"
vout = "[vo]" if vf else "[v]"
cmd = ["ffmpeg", "-y", "-v", "error", "-i", a.src, "-filter_complex", graph, "-map", vout, "-map", "[a]",
       "-c:v", "libx264", "-crf", "16", "-preset", "slow", "-pix_fmt", "yuv420p",
       "-c:a", "aac", "-b:a", "320k", "-ar", "48000", "-movflags", "+faststart", a.out]
subprocess.run(cmd, check=True)
print("saved", a.out)
