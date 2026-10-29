# Second Home Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An animated cover page and a scroll-animated Chapter 1 of *Second Home* by D.H. (Dina Helmy).

**Architecture:** Static pages in `book/`. Shared `style.css` holds the palette and reading typography; shared `motion.js` adds scroll-triggered classes via IntersectionObserver. Each page uses inline SVG for its art.

**Tech Stack:** HTML, CSS, vanilla JS; Playwright (pre-installed) for a smoke test.

**Spec:** `docs/superpowers/specs/2026-10-29-online-thriller-book-design.md`

## Global Constraints

- No build step, no external scripts; Google Fonts stylesheet only.
- Phone first: no horizontal scroll at 375px width.
- `prefers-reduced-motion: reduce` → all text visible, no animation.
- Text is readable even if JavaScript fails (content not hidden without JS).
- Cover credit: "D.H." ; title page line: "Written by Dina Helmy".
- Original work only.

## Review Focus

- JavaScript disabled → every paragraph still visible (hidden state applies only under `.js` on `<html>`).
- Reduced motion → no element stays at opacity 0.
- 375px phone width → no horizontal overflow from SVG art.
- Console errors on load → none.
- Cover "Begin reading" link → reaches `chapter-1.html`.

---

### Task 1: Shared styles, motion script, smoke test

**Files:**
- Create: `book/style.css`, `book/motion.js`, `book/tests/smoke.js`

**Interfaces:**
- Produces: elements with `data-reveal` get class `is-in` when scrolled into view; `data-glitch` elements flicker once revealed; `data-clue` elements shimmer faintly; `html.js` set by `motion.js`.

- [ ] Write `book/tests/smoke.js` (Playwright): for each page at 375×812 and 1280×800, assert no console errors, `scrollWidth <= clientWidth`, and with `reducedMotion: 'reduce'` every `[data-reveal]` has computed opacity `1` after load; with JS disabled every `p` is visible; cover link href is `chapter-1.html`.
- [ ] Run `node book/tests/smoke.js` → fails (pages missing).
- [ ] Implement `style.css` and `motion.js`.

### Task 2: Cover page

**Files:** Create `book/index.html`

- [ ] SVG cake-topper couple, drifting/splitting shadow, drop-by-drop blood spatter, cracked title, "D.H." credit, title-page line "Written by Dina Helmy", "Begin reading" → `chapter-1.html`.
- [ ] Run smoke test → cover checks pass.

### Task 3: Chapter 1

**Files:** Create `book/chapter-1.html`

- [ ] ~2,000 words, first person present, Claire finds Daniel's second phone; text "The girls keep asking when you're coming home."; clues: unlocks first try, full charge, notes the time before she screams; hook last line.
- [ ] Animated phone with typing texts, glitch on lies, shimmering clues, closing image.
- [ ] Run smoke test → all pass. Commit.
