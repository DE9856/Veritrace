---
name: Veritrace
description: Answers from your documents, with every claim marked in the margin as stated, inferred or possibly hallucinated.
colors:
  pencil: "#2343c4"
  pencil-soft: "#e6ecfc"
  ink: "#121826"
  ink-muted: "#535d72"
  shell-ground: "#edf1f8"
  canvas: "#f6f8fc"
  sheet: "#ffffff"
  tint-secondary: "#e2e7f1"
  tint-muted: "#eaeef6"
  border: "#d6ddea"
  rule: "#e5eaf3"
  input-stroke: "#cbd3e3"
  verdict-high: "#1f7a4d"
  verdict-inferred: "#9a6400"
  verdict-inferred-soft: "#fbedcc"
  verdict-halluc: "#b3261e"
typography:
  display:
    fontFamily: "\"Source Serif 4\", Georgia, serif"
    fontSize: "3.25rem"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.022em"
  headline:
    fontFamily: "\"Source Serif 4\", Georgia, serif"
    fontSize: "1.625rem"
    fontWeight: 600
    lineHeight: 1.375
    letterSpacing: "-0.012em"
  score:
    fontFamily: "\"Source Serif 4\", Georgia, serif"
    fontSize: "2.75rem"
    fontWeight: 600
    lineHeight: 0.9
    letterSpacing: "-0.02em"
    fontFeature: "\"tnum\" 1"
  wordmark:
    fontFamily: "\"Source Serif 4\", Georgia, serif"
    fontSize: "1.3125rem"
    fontWeight: 600
    lineHeight: "24px"
    letterSpacing: "-0.015em"
  title:
    fontFamily: "\"Schibsted Grotesk\", ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.43
  copy:
    fontFamily: "\"Source Serif 4\", Georgia, serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.8
  passage:
    fontFamily: "\"Source Serif 4\", Georgia, serif"
    fontSize: "0.9875rem"
    fontWeight: 400
    lineHeight: 1.75
  body:
    fontFamily: "\"Schibsted Grotesk\", ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "\"Schibsted Grotesk\", ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
    fontFeature: "\"tnum\" 1"
  cite:
    fontFamily: "\"Schibsted Grotesk\", ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.45
    fontFeature: "\"tnum\" 1"
  line-number:
    fontFamily: "\"Schibsted Grotesk\", ui-sans-serif, system-ui, sans-serif"
    fontSize: "10.5px"
    fontWeight: 400
    lineHeight: 1
    fontFeature: "\"tnum\" 1"
  code:
    fontFamily: "\"Geist Mono\", ui-monospace, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
rounded:
  sheet: "8px"
  control: "6px"
  chip: "4px"
  pill: "999px"
spacing:
  gutter: "8px"
  sheet-pad-sm: "16px"
  sheet-pad: "24px"
  stack: "24px"
  exchange: "48px"
components:
  button-primary:
    backgroundColor: "{colors.pencil}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "32px"
  button-outline:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "32px"
  button-outline-hover:
    backgroundColor: "{colors.tint-muted}"
  button-ghost:
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "28px"
  button-ghost-hover:
    backgroundColor: "{colors.tint-muted}"
    textColor: "{colors.ink}"
  answer-sheet:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    padding: "24px"
  proof-slug:
    backgroundColor: "{colors.pencil-soft}"
    textColor: "{colors.pencil}"
    typography: "{typography.label}"
    padding: "8px 24px"
  composer:
    backgroundColor: "{colors.sheet}"
    rounded: "{rounded.sheet}"
    padding: "6px"
  cite-chip:
    backgroundColor: "{colors.pencil-soft}"
    textColor: "{colors.pencil}"
    typography: "{typography.cite}"
    rounded: "{rounded.chip}"
    padding: "0 4px"
  cite-chip-active:
    backgroundColor: "{colors.pencil}"
    textColor: "{colors.sheet}"
  rail-mark-selected:
    backgroundColor: "{colors.pencil}"
    textColor: "{colors.sheet}"
    height: "22px"
    padding: "0 4px"
  document-row:
    rounded: "{rounded.control}"
    padding: "6px 8px"
  document-row-ticked:
    backgroundColor: "{colors.pencil-soft}"
  tooltip:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.control}"
    padding: "6px 10px"
---

# Design System: Veritrace

## Overview

**Creative North Star: "The Editor's Blue Pencil"**

Every answer is a galley proof on a fact-checker's desk, and the checker works in blue pencil. The copy under check is set in a book serif on a white sheet. Around it, everything the checker does is drawn in one committed blue: the double-ruled margin with its galley line numbers, the selection, the citations, the actions, the focus ring, the status dot. Each sentence earns a mark in that margin at its right edge: a tick when a passage states it, a tilde when it follows but not in those words, a strike when it is unsupported. The proof is the product; the pencil is the hand that checks it.

The world is a pale blue-tinted shell, a lighter canvas and white sheets, with ink text and two kinds of colour only: the pencil, which is the apparatus, and the three verdicts, which keep the fixed meaning PRODUCT.md gives them. Source Serif 4 speaks for the page (headings, the wordmark, the headline figures, the copy under check) and Schibsted Grotesk, a newsroom grotesk, does the working parts with tabular figures. Density is that of a working desk: 13px labels, 1px rules, sheets that sit flat. The category default this refuses is a chat bubble with coloured highlights; the previous ink-only chrome on Geist was rejected by the user as reading like a stock kit.

Light and dark are both first-class (system default). Dark mode is the same desk under a lamp: a near-black blue ground, slightly raised sheets, the pencil lifted to a light periwinkle and the verdicts lifted to stay legible. Its values live alongside the light ones in `frontend/src/app/globals.css` and in the sidecar.

**Key Characteristics:**
- Two kinds of colour: the blue pencil for the apparatus, green/amber/red for verdicts only.
- Two voices: Source Serif 4 for the page's voice and the copy under check, Schibsted Grotesk for the apparatus.
- A galley margin beside every checked answer: a double pencil rule, numbered lines, drawn proof marks and scores.
- Three surface tones: blue-tinted ground, canvas, white sheet. Depth by tone and 1px rules, not shadow.
- Marks draw once when a verdict lands; everything else is quick and interruptible.

## Colors

A cool blue-tinted paper-and-ink palette carrying one apparatus hue and three reserved verdict hues.

### Primary
- **Editor's Blue Pencil** (pencil): primary buttons, the focus ring, text selection (at 22%), the selected rail chip, the pressed sentence tint (11%, 6% on hover), active citation chips and source keys, the double margin rule (45%) and its line numbers (70%), the brand tick, the serving status dot, spinners, the streaming caret, the dashed border of the live log (35%), signal bars (80%), How it works step numbers and inline links. Dark: a light periwinkle, with dark ground-coloured content on pencil fills.
- **Pencil Wash** (pencil-soft): the proof slug band (at 70%), citation chips and source keys at rest, ticked documents, the matched sentence in a source passage, the drop zone, the hovered source link (50%).

### Tertiary (the verdicts; fixed by PRODUCT.md)
- **Stated Green** (verdict-high): the tick, the High confidence underline (70% mix) and its share of the label bar.
- **Query Amber** (verdict-inferred): the tilde, the Inferred underline, its bar share, and the retry icon in the agent log (same meaning: not settled on the first pass).
- **Query Amber Wash** (verdict-inferred-soft): the low-coverage caution note; the one soft verdict fill on screen.
- **Strike Red** (verdict-halluc): the × mark, the line-through strike (85% mix), its bar share, a contradiction signal at or above 0.7, failed agent steps and invalid-citation warnings (same meaning: this did not hold).

### Neutral
- **Proofing Ink** (ink): text, tooltips, the hollow not-serving status ring.
- **Muted Ink** (ink-muted): secondary text, 13px section labels, metadata, rail scores at rest.
- **Blue Shell Ground** (shell-ground): the page and the sidebar, tinted toward the pencil.
- **Canvas** (canvas): the framed centre column and the answer's Searched for footer.
- **Sheet White** (sheet): the answer card, the inspector, the composer, outline buttons.
- **Tint** (tint-muted): hover fills on rows and sources, search query chips, code, skeletons. **Secondary Tint** (tint-secondary): the disabled send button.
- **Border** (border): sheet outlines. **Rule** (rule): hairlines inside sheets and the sidebar foot. **Input Stroke** (input-stroke): the composer, outline buttons, the switch when off.

### Named Rules
**The Quarantine Rule.** A hue on screen is either a verdict or the pencil. Green, amber and red mean stated, inferred and flagged (or a failure that means the same thing); the pencil means the checker is acting. No third hue. The red Delete confirmation in the documents list is a known exception, recorded as fact, not a pattern to extend.

**The Blue Pencil Rule.** The pencil is the single apparatus hue: actions, focus, selection, citations, the margin, status, progress. It never marks a verdict, and its fills stay small (chips, buttons, the selected rail mark); larger areas take the pencil wash or the blue-tinted neutrals.

**The Pencil Selection Rule.** Selection is pencil: a pencil chip with white content (selected rail mark, active citation, active source key), the pencil wash for chosen things (ticked documents), an 11% pencil tint on a pressed sentence and 6% on hover. Never a verdict tint, never ink.

**The Pencil Status Rule.** The model status dot is filled pencil when a model is serving, a hollow 1.5px ink ring when it is not, a pulsing muted dot while checking. Status is never green or red.

## Typography

**Voice Font:** Source Serif 4 with the opsz axis and `font-optical-sizing: auto` (with Georgia, serif)
**Apparatus Font:** Schibsted Grotesk (with system sans)
**Code Font:** Geist Mono, for code only

**Character:** A book serif whose display cut carries the page's headings and figures and whose text cut carries the copy under check, against a compact newsroom grotesk for everything the checker operates. The optical axis lets one family run from 52px headlines to 15.8px passages.

### Hierarchy
- **Display** (Source Serif 4, 600, 2.125rem to 3.25rem at sm, 1.05, -0.022em): the welcome heading and the How it works title. The no-backend state uses the same voice at 1.75rem to 2.25rem.
- **Headline** (Source Serif 4, 600, 1.375rem to 1.625rem at sm, snug, -0.012em): the question that heads each exchange; How it works section heads at 1.5rem.
- **Score** (Source Serif 4, 600, 2.75rem, 0.9, -0.02em, tabular): the answer confidence; the inspector's per-claim score is the same voice at 1.875rem.
- **Wordmark** (Source Serif 4, 600, 1.3125rem, -0.015em): "Veritrace" in the sidebar; 1.125rem in the phone bar.
- **Title** (Schibsted Grotesk, 600, 0.875rem): sheet headers such as Claim check.
- **Copy** (Source Serif 4, 400, 1.0625rem at 1.85 on phones, 1.125rem at 1.8 from sm): the checked answer, the safe version and the streaming draft. Column held to the max-w-3xl canvas.
- **Passage** (Source Serif 4, 400, 0.9875rem, 1.75): source passages in the inspector. Explanatory prose on How it works uses the serif at 1.0625rem, 65ch.
- **Body** (Schibsted Grotesk, 400, 15px; 14px in lists): UI prose, example questions, document names.
- **Label** (Schibsted Grotesk, 500 or 400, 13px, sentence case, tabular): section labels, the agent log, the proof slug, metadata, legends, rail scores.
- **Cite** (Schibsted Grotesk, 500, 11px, tabular): citation chips, raised -0.45em into the serif line.
- **Line number** (Schibsted Grotesk, 10.5px, tabular, pencil at 70%): galley line numbers in the margin, hidden below 640px.

### Named Rules
**The Two Voices Rule.** Serif is the voice: the copy under check, the page's headings, the wordmark and the headline figures. Sans is the apparatus: labels, controls, chips, the log, line numbers and rail scores. Never set a control or label in the serif, or copy under check in the sans.

**The Tabular Rule.** Every score, count, duration, line number and page number uses tabular figures so columns and live-updating values do not jitter.

## Layout

A three-pane desk. From 64rem (lg) the sidebar docks at 16rem on the shell ground; from 80rem (xl) the claim inspector docks at 25rem on the right. Between them the canvas is an inset framed panel (8px gutter top, bottom and right, 8px radius, 1px border), joined flush to the inspector at xl. Below each docking point the panel becomes a side sheet (25rem, max 90vw) over a dimmed backdrop; below lg a top bar carries the menu, wordmark and status.

The thread runs in a centred column (max 48rem) with 16px side padding, 24px from sm. Exchanges are 48px apart; sheets pad 16px, 24px from sm; sidebar groups stack 24px apart. The composer docks at the foot of the canvas inside the same column, and the thread fades out over its last 1.5rem above it.

The checked answer is a two-column grid: the serif text column and a galley margin of 3.25rem (5.5rem from sm, to hold the line numbers), 12px (20px) apart. The margin is omitted when nothing was checked. Agent log rows keep fixed columns (icon, step, timing) and update in place.

## Elevation & Depth

Flat at rest. Depth is tonal: blue shell ground, canvas, white sheet, with 1px borders around sheets and 1px rules inside them. Shadows appear only on things that float above the desk or hold focus.

### Shadow Vocabulary
- **Sheet edge** (`box-shadow: 12px 0 32px rgb(0 0 0 / 0.16)`, mirrored for the right sheet): an open side sheet below its docking breakpoint, over a `rgb(10 11 14 / 0.32)` backdrop.
- **Composer focus halo** (`box-shadow: 0 0 0 3px color-mix(in oklch, var(--foreground) 8%, transparent)`): the composer while focused, with its stroke darkening to ink at 40%.

### Named Rules
**The Flat Desk Rule.** No shadow on a resting surface. If it does not float or hold focus, it has no shadow.

## Shapes

Two working radii: 8px for sheets and panels (answer card, inspector, composer, canvas frame, live log), 6px for controls (buttons, rows, tabs, tooltips, notes). Small inline chips (citations, source keys, query chips, code) take 4px; the selected rail chip 5px; the sentence fill and the matched-passage wash 3px so they hug the line. Pills (999px) are reserved for the label bar, signal bars, status dots, spinners and the rail's hover bar. Lines are 1px, except the galley margin's 3px double rule; the live log's border is dashed. Marks are drawn 2px strokes with round caps on a 16px grid; the brand tick is a 2.4px stroke on a 20px grid.

## Components

### Buttons
Compact and pressed by touch, with the pencil as the one action colour.
- **Shape:** gently squared (6px), 32px tall by default, 28px small, 24px extra-small.
- **Primary:** pencil fill, white text (dark ground text in dark mode); hover drops to pencil at 85%. The send button is a 28px pencil square that becomes the secondary tint with muted icon when disabled.
- **Outline:** sheet fill, input stroke, hover to the tint.
- **Ghost:** transparent, muted text, hover to tint and ink.
- **Press / Focus:** scale 0.97 on press (dropped under reduced motion); 2px pencil focus ring offset 2px.
- **Destructive:** red fill, used only for the one-step Delete confirmation (see The Quarantine Rule).

### Chips
- **Citation chip:** 11px tabular label in pencil on the pencil wash, 4px radius, raised into the serif line; hover and active invert to a pencil fill with white text.
- **Source key:** the same chip at 20px tall in the sources list and the inspector's source link; active inverts.
- **Search query chip:** ink at 85% on the muted tint, 4px, wraps.

### Cards / Containers
- **Corner Style:** 8px.
- **Background:** sheet white on the canvas; the Searched for footer drops back to the canvas.
- **Shadow Strategy:** none (The Flat Desk Rule).
- **Border:** 1px border outside, 1px rules between sections.
- **Internal Padding:** 16px, 24px from sm.

### Proof Slug
The head band of every finished answer: pencil wash at 70% with a pencil 15% rule beneath, 13px. "Proof" in pencil semibold, then "Checked HH:MM · N claims · model (provider)" in muted ink with the model name in ink. It carries real provenance, once per answer; it is not a decorative label to repeat above headings elsewhere.

### Inputs / Fields
- **Composer:** sheet fill, input stroke, 8px, 6px inner padding, borderless textarea inside, safe-mode switch and send button in a footer row.
- **Focus:** stroke to pencil at 60% plus a 3px pencil halo at 14%.
- **Disabled:** sheet at 60%; the placeholder states why ("Add a document first.").
- **Switch:** pencil when on, input stroke when off; the thumb slides on the ease-out curve.
- **Checkboxes:** native, accent set to the pencil.

### Navigation
- **Sidebar:** brand (pencil tick, serif wordmark, subtitle), documents list, then a ruled foot with the status, How it works (ghost) and the theme toggle. Document rows hover to the tint and tick to the pencil wash; delete appears on hover.
- **Tabs:** line variant under the answer (Checked answer / Safe version): muted text, ink text and a 2px pencil underline when active.
- **Tooltip:** ink fill, paper text, 12px, 6px radius.
- **Mobile:** a top bar with menu, wordmark and status; the sidebar and inspector slide in as sheets.

### Galley Margin (signature)
The checked answer's right-hand margin, behind a 3px double rule in pencil at 45%. Every line of the answer is numbered in 10.5px tabular pencil at 70% (hidden below 640px). Each checked sentence gets a 22px row level with the line where it runs (pushed down so rows never overlap) carrying its proof mark and its weakest claim's score in 13px tabular muted ink. Hover lays a 3px pencil bar over the rule; the selected sentence's row becomes a pencil chip (5px) with white mark and medium-weight score. The margin is a pointer shortcut; the sentences remain the keyboard targets. The inspector's mark legend sits against the same double pencil rule.

### Proof Marks
Drawn SVG strokes (2px, round caps, 16px box) in the verdict's colour: **tick** for High confidence, **tilde** for Inferred (adapted from a proofreader's query mark: it follows, but not in these words), **×** for Possibly hallucinated. In the text, the sentence carries the matching underline: 2px at 5px offset for high and inferred, a 1.5px red line-through strike for hallucinated, still legible.

### Claim Inspector
Sheet-white panel. Each claim leads with its verdict mark and label in the verdict colour, the claim in 13px, and the score in the serif at 1.875rem. Signals are 4px pill bars on the tint, filled pencil at 80%; the contradiction bar and its value turn red only at or above 0.7. The source link is a 6px row with a rule border that hovers to a pencil 40% border on the pencil wash. In the passage, the matched sentence sits on the pencil wash with a 2px pencil 60% underline.

### Live Log and Agent Route
The agent's steps in a sheet at 60% with a dashed pencil 35% border, 8px. Above the step rows sits the **route**: one stage per agent step (names from STEP_NAMES), centred on a 2px rule that fills in pencil to the last stage reached (scaleX, 500ms ease-out). Done stages are 18px pencil discs with a white tick; the live stage is a pencil ring with a centre dot and a soft pulsing halo (the one looping motion, removed under reduced motion); pending stages are hollow input-stroke rings, skipped ones dashed; a failed stage is an ink disc with ×. Judge and Compare share one stage as a fork of two 14px dots. A rewritten search draws an amber arc from Search back to Plan labelled "search rewritten". Stage names (11px) show from 640px. Step rows below keep fixed columns with live times; running steps show a pencil spinner; retries are amber.

### Claim Strip
Replaces the proportional bar under the confidence figure: one 10px block per claim in reading order, in its verdict colour, 2px radius, 3px gaps. Hovering a block lights its sentence and margin row and dims the other blocks to 30%; hovering a sentence or margin row does the same in reverse (one hover state shared by strip, text and margin). The selected sentence's blocks carry a 2px pencil outline. Pointer shortcut only; counts are repeated for assistive technology.

### Passage Preview
Hovering a citation chip (350ms open delay) opens a 22rem popover above it: a ruled head with the source key inverted in pencil, file and page, and the match score; then the passage cut to the best-supporting sentence with one sentence either side, the supporting one on the pencil wash with a pencil underline and the rest in muted ink; a foot line says selecting opens the whole passage. Touch devices skip it; tapping opens the inspector as before.

### Evidence Jump
Opening a source from a claim scrolls the matched sentence to the centre of the inspector (instant under reduced motion) and flashes its pencil wash at 28% for 1.4s, settling to the resting highlight.

### Worked Example
A labelled illustration of a marked proof, written against the Chandrayaan-3 sample (three true sentences, one false launch vehicle), rendered with the real margin component in a non-interactive mode and captioned as not a checked answer. It appears in the empty inspector, on the welcome screen below 1280px, and on How it works beside the mark legend.

### Safe Version: Removed Claims
Under the rewritten answer, against the double pencil rule, "Removed from this version" lists each possibly hallucinated sentence struck in red at 75% ink with its × mark and score. What the rewrite cut stays visible rather than disappearing.

### Scoring Path (How it works)
A figure on a sheet: signals with pencil bars sized by weight → a pencil-wash "0–100 weighted score" block → the four rules against the double pencil rule, each ending in the label's mark. Arrows in pencil 70%, vertical below 768px.

### Document Rows
Each row carries a small file-type label (PDF, MD, TXT: 9.5px semibold pencil on the pencil wash, 3px radius) before its page and passage counts. While a file is indexed the row shows its type and name over a 4px indeterminate pencil sweep (the backend reports no progress, so no percentage is invented). A newly indexed row arrives and flashes its pencil wash instead of a success toast; failures still toast.

### Motion
Ease-out `cubic-bezier(0.23, 1, 0.32, 1)` for anything answering the user; the drawer curve `cubic-bezier(0.32, 0.72, 0, 1)` for sheets. Colour changes 150ms. Marks draw once in 420ms as a verdict lands, staggered 90ms down the margin, scores fading in 260ms, 160ms behind them; the label bar and signal bars grow from the left in 520ms; arriving log rows rise 4px in 220ms. Sheets and disclosures are always-mounted CSS transitions (open 300ms, close 220ms), so they reverse mid-way. Each sentence's underline (or strike) fades in from transparent in step with its margin mark, same delay; the route's progress line grows in 500ms; the evidence flash settles over 1.4s; indexing sweeps every 1.1s. Reduced motion keeps the fades and drops everything that travels or draws.

## Do's and Don'ts

### Do:
- **Do** keep every hue either a verdict (green states, amber queries, red strikes, at the PRODUCT.md values) or the blue pencil.
- **Do** make primary actions, focus and selection pencil: a pencil chip with white content, the pencil wash, or a pencil tint of 6 to 11% on text.
- **Do** set the copy under check, headings, the wordmark and headline figures in Source Serif 4, and every label, control and small figure in Schibsted Grotesk with tabular figures.
- **Do** use the three tones in order (blue shell ground, canvas, sheet) with 1px borders and rules, 8px for sheets and 6px for controls.
- **Do** rule checking margins with the 3px double pencil rule and number lines in 10.5px pencil.
- **Do** draw new marks as 2px round-capped SVG strokes in the 16px box so they can draw themselves.
- **Do** keep panels mounted and animate them with CSS transitions so they can reverse.

### Don't:
- **Don't** introduce a second apparatus hue or tint the pencil toward a verdict.
- **Don't** use green, amber or red for selection, status, decoration or emphasis that is not a verdict.
- **Don't** show model or connection status in green or red; the status dot is pencil or a hollow ink ring.
- **Don't** put shadows on resting surfaces.
- **Don't** replace the drawn marks with emoji, icon-font glyphs or coloured highlighter fills.
- **Don't** use Geist Mono outside code.
