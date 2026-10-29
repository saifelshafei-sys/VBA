# Online Thriller Book with Moving Graphics — Pilot Design

## Intent

Write an original domestic psychological thriller in the spirit of Freida
McFadden's *The Divorce*, published online as a scrolling web book whose
graphics move with the story. The pilot (animated cover + Chapter 1) lets the
author see and feel the format before the rest of the book is written.

## The story (decided together)

- **Premise:** A wife "discovers" her husband has a secret second family.
- **Her secret:** The discovery is staged. She has known about the other family
  for a long time and is executing a plan to get rid of her husband and frame
  the other woman.
- **The final turn:** The other woman was one step ahead from the first page.
  She lets the wife do the dirty work, turns the planted evidence back on her,
  and ends the book in the wife's kitchen.
- **Reader's last feeling:** Chilled. The other woman is the most dangerous
  person in the book.

### My calls (change any of these)

- **Working title:** *Second Home*.
- **Names:** Claire Whitmore (wife, narrator), Daniel Whitmore (husband,
  "travels for work"), Nora Vance (the other woman), two little girls with Nora.
- **Setting:** A tidy commuter suburb outside Boston; Daniel's "work trips" are
  to Providence.
- **Voice:** First person, present tense, short punchy chapters, McFadden-style
  cliffhanger last lines. Mostly Claire; Nora's chapters begin near the
  midpoint.
- **Fair-play clues:** Claire's early chapters read as genuine heartbreak, but
  each holds small details that only make sense once the staging is revealed.

## Pilot scope

1. **Cover page:** title, author line, animated cake-topper couple (drawn in
   SVG), a shadow that drifts and splits, blood spatter that appears drop by
   drop, title text that cracks. "Begin reading" button.
2. **Chapter 1 (~2,000 words):** Claire finds a second phone hidden in
   Daniel's gym bag. A text appears: *"The girls keep asking when you're
   coming home."* She narrates shock and grief. Planted clues: she unlocks the
   phone on the first try; it's fully charged; she notes the time before she
   "screams." Last line is a hook that hints she is not what she seems.
3. **Chapter 1 animations (scroll-triggered):** the phone buzzing with texts
   typing in; a glitch flicker on lines that are lies; clue phrases that
   faintly shimmer for sharp-eyed readers; a closing image that tips the
   reader off.

## Constraints

- Plain HTML, CSS, and vanilla JavaScript. No build step and no paid tools.
  Opens directly in a browser; can be hosted free (e.g. GitHub Pages).
- Readable and comfortable on a phone first, desktop second.
- Respects "reduce motion" settings: the text stays fully readable with no
  animation.
- All writing and art is original. No McFadden text, characters, or cover art.

## Approaches considered

1. **Scrolling web book (chosen).** Free, works everywhere, dramatic
   scroll-triggered effects, fully buildable in code. The art is stylized
   rather than cinematic.
2. **Flip-book.** Feels like a printed book but is clunky on phones and limits
   the effects.
3. **AI video scenes.** The most striking, but costs credits and is harder to
   keep consistent. Kept as a possible later upgrade layered onto option 1.

## Location

Lives in a new `book/` folder on this branch (`book/index.html` cover,
`book/chapter-1.html`, shared `book/style.css` and `book/motion.js`).

## Non-goals for the pilot

- The rest of the chapters (a full chapter outline comes after the pilot).
- Accounts, payments, comments, or audio.

## Left to the builder

Exact visual palette (purple/red/black thriller mood), fonts, and animation
timing.
