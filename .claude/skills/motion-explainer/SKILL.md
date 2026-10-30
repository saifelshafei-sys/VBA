---
name: motion-explainer
description: Use when the user wants an animated explainer, motion graphic, animated chart, kinetic-text video, product walkthrough animation, or a short MP4 that explains their own data, plan, pricing, process, or report (e.g. "animate this", "make a 30-second explainer", "turn this chart into a video", "/motion"). Not for AI-generated footage, realistic people, or live-action video.
---

# Motion Explainer

## Overview

An explainer is code, not generated footage: one HTML scene whose every frame is a pure function of time `t`, rendered frame by frame to MP4 with Playwright + ffmpeg. Every word, number, and timing stays editable, and the render is deterministic.

**Core principle:** `renderFrame(t)` must draw the same pixels for the same `t`, no matter when or how often it is called. Anything driven by the wall clock (CSS animations, transitions, `requestAnimationFrame` timing, `Date.now()`, unseeded `Math.random()`) renders as frozen or jittery frames.

## Requirements

`node` (18+), `ffmpeg`, and Playwright with Chromium (`npm i -D playwright && npx playwright install chromium`). Check first: `node -v && ffmpeg -version | head -1`.

## Workflow

1. **Script first, no code.** Write the beat sheet: one message per beat, with on-screen text and start time. Show it to the user and get the numbers and wording confirmed. Never invent data; anything not supplied is labeled as a placeholder.
2. **Copy the template**: `cp <skill-dir>/template.html ./explainer/scene.html`. Edit `DATA`, `BEATS`, the text, and the CSS variables. Keep the helpers (`progress`, `easeOut`, `easeInOut`, `enter`).
3. **Render a draft** of the hardest section: `node <skill-dir>/scripts/render.mjs explainer/scene.html explainer/draft.mp4 --from 2 --to 6`.
4. **Look at stills before showing anything.** Pull one frame per beat, once each beat's motion has settled:
   ```bash
   for s in 1.5 4 7 9.5; do ffmpeg -loglevel error -y -ss $s -i explainer/draft.mp4 -frames:v 1 explainer/still-$s.png; done
   ```
   Open each still and check for wrapped or clipped text, overlaps, empty regions after an element exits, wrong numbers, and contrast.
5. **Full render**, then verify: `ffprobe -v error -show_entries stream=width,height,r_frame_rate,nb_frames -show_entries format=duration -of compact out.mp4`. Report the actual duration and resolution.
6. **Deliver** the MP4, `scene.html` (the editable source), and the stills.

## Scene contract

```js
window.EXPLAINER = { duration: 10, width: 1920, height: 1080 }; // seconds, pixels
window.renderFrame = (t) => { /* set styles/text from t only */ };
```
- Build the DOM once at load. `renderFrame` only updates `opacity`, `transform`, `width`, and `textContent`.
- Animate with `progress(t, start, dur)` → an easing function → `lerp`. Stagger by offsetting `start`, not with timers.
- Fonts: use system fonts, or embed the font file locally. A remote webfont that hasn't loaded renders in a fallback font. The renderer waits for `document.fonts.ready`.
- Vertical (Reels/Shorts): `width: 1080, height: 1920`, and update `html, body` sizes to match.

## Pacing

| Element | Timing |
|---|---|
| Enter/exit motion | 0.4–0.8 s, ease-out entering, ease-in leaving |
| Hold after a beat settles | ≥ 1.5 s, plus about 0.3 s per word of new on-screen text |
| Number count-up / bar growth | 1.2–2 s |
| 30-second explainer | 4–6 beats; one idea per beat |
| Final takeaway | Hold ≥ 2.5 s so it can be read before the cut |

Move only what carries meaning: one primary motion per beat. Keep earlier context on screen (the title stays while the chart grows) instead of clearing the stage, unless the beat is a deliberate scene change.

## Quick reference

| Need | How |
|---|---|
| Render part of the video | `--from 2 --to 6` |
| Frame rate | `--fps 30` (default); `--fps 60` for fast motion |
| Smaller file | `--crf 23` (default 18; higher means smaller and lower quality) |
| Add voiceover/music | `ffmpeg -i out.mp4 -i vo.mp3 -c:v copy -c:a aac -shortest final.mp4` |
| GIF for Slack/docs | `ffmpeg -i out.mp4 -vf "fps=15,scale=960:-1:flags=lanczos" out.gif` |
| Live preview | Open `scene.html` in a browser; it loops in real time when not run by the renderer |
| Render speed | About 2 s of render per 1 s of 1080p30 video |

## Common mistakes

| Mistake | Fix |
|---|---|
| Values or labels wrap to two lines | `white-space: nowrap` and enough width for the final value, not the starting `0.0` |
| Element exits and leaves a hole | Keep it on screen, or bring the next element into that space |
| Using CSS `transition`/`@keyframes` | Frames come out static. Derive every style from `t` |
| Counting numbers jitter in width | `font-variant-numeric: tabular-nums` |
| Headline claim doesn't match the data | Compute it from `DATA` or check it by hand (e.g. 12.3 / 5.1 = 2.4×) |
| Delivering without looking at frames | Step 4 is mandatory; the template's own first draft failed it |
| Promising AI footage or people | Out of scope. This animates text, charts, shapes, and images supplied by the user |
