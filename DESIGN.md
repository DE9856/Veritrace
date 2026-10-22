---
name: Veritrace
description: Answers from your documents, laid out as a Swiss information sheet that shows why every claim got its verdict.
colors:
  signal: "#4a3aa8"
  signal-soft: "#ecebf6"
  ink: "#111214"
  rail-black: "#111214"
  sheet-white: "#ffffff"
  canvas-grey: "#f4f4f2"
  wash: "#ececea"
  hairline: "#e3e3e0"
  border-grey: "#d6d6d2"
  input-grey: "#b9b9b4"
  muted-ink: "#5c5d61"
  stated-green: "#126a40"
  stated-soft: "#e3efe7"
  inferred-amber: "#94701c"
  inferred-soft: "#f5edda"
  flagged-red: "#a52e47"
  flagged-soft: "#f6e4e8"
typography:
  display:
    fontFamily: "Archivo, Arial, sans-serif"
    fontSize: "clamp(3.25rem, 6vw, 6rem)"
    fontWeight: 800
    lineHeight: 0.88
    letterSpacing: "-0.015em"
    fontVariation: "\"wdth\" 62"
  landing-display:
    fontFamily: "Archivo, Arial, sans-serif"
    fontSize: "clamp(3rem, 4.6vw + 1rem, 5.25rem)"
    fontWeight: 800
    lineHeight: 0.88
    letterSpacing: "-0.015em"
    fontVariation: "\"wdth\" 62"
  landing-section:
    fontFamily: "Archivo, Arial, sans-serif"
    fontSize: "clamp(2.25rem, 2.6vw + 1.25rem, 3.75rem)"
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: "-0.015em"
    fontVariation: "\"wdth\" 62"
  numeral:
    fontFamily: "Archivo, Arial, sans-serif"
    fontSize: "clamp(4rem, 9vw, 8.5rem)"
    fontWeight: 800
    lineHeight: 0.8
    letterSpacing: "-0.03em"
    fontFeature: "\"tnum\", \"lnum\""
    fontVariation: "\"wdth\" 62"
  headline:
    fontFamily: "Archivo, Arial, sans-serif"
    fontSize: "clamp(1.875rem, 3vw, 2.625rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.015em"
    fontVariation: "\"wdth\" 80"
  title:
    fontFamily: "Archivo, Arial, sans-serif"
    fontSize: "2rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.015em"
    fontVariation: "\"wdth\" 70"
  reading:
    fontFamily: "Archivo, Arial, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.7
  body:
    fontFamily: "Archivo, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.375
  small:
    fontFamily: "Archivo, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Archivo, Arial, sans-serif"
    fontSize: "11.5px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.08em"
  figure:
    fontFamily: "Archivo, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "\"tnum\", \"lnum\""
    fontVariation: "\"wdth\" 75"
  code:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.8em"
    fontWeight: 400
rounded:
  none: "0px"
  round: "999px"
spacing:
  hair: "4px"
  tight: "8px"
  row: "12px"
  sheet-x-sm: "20px"
  gutter: "24px"
  sheet-x: "32px"
  section: "40px"
components:
  button-primary:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.sheet-white}"
    typography: "{typography.small}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "36px"
  button-primary-disabled:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.muted-ink}"
    rounded: "{rounded.none}"
  button-outline:
    backgroundColor: "{colors.sheet-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "36px"
  button-outline-hover:
    backgroundColor: "{colors.wash}"
  panel-toggle-open:
    backgroundColor: "{colors.signal-soft}"
    textColor: "{colors.signal}"
    rounded: "{rounded.none}"
    padding: "0 12px"
    height: "32px"
  source-tag:
    backgroundColor: "{colors.signal-soft}"
    textColor: "{colors.signal}"
    typography: "{typography.figure}"
    rounded: "{rounded.none}"
    padding: "0 4px"
  source-tag-active:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.sheet-white}"
  claim-row-selected:
    backgroundColor: "{colors.signal-soft}"
    textColor: "{colors.ink}"
    padding: "12px 0"
  exchange-sheet:
    backgroundColor: "{colors.sheet-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "24px 32px 40px"
  composer:
    backgroundColor: "{colors.sheet-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "8px"
  rail:
    backgroundColor: "{colors.rail-black}"
    textColor: "{colors.wash}"
    width: "16rem"
  claim-panel:
    backgroundColor: "{colors.sheet-white}"
    textColor: "{colors.ink}"
    width: "26rem"
  query-chip:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.ink}"
    typography: "{typography.small}"
    rounded: "{rounded.none}"
    padding: "2px 8px"
  button-primary-landing:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.sheet-white}"
    rounded: "{rounded.none}"
    padding: "0 20px"
    height: "48px"
  button-primary-landing-close:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.sheet-white}"
    rounded: "{rounded.none}"
    padding: "0 28px"
    height: "56px"
  button-outline-landing:
    backgroundColor: "{colors.sheet-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0 20px"
    height: "48px"
  specimen-sheet:
    backgroundColor: "{colors.sheet-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "20px 32px 24px"
  agent-band:
    backgroundColor: "{colors.rail-black}"
    textColor: "{colors.wash}"
---

# Design System: Veritrace

## Overview

**Creative North Star: "The Swiss Information Sheet"**

Every answer is set like a page of International Typographic Style information design: a white sheet on a strict twelve-column grid, laid on a pale grey ground beside a black rail. One grotesk, Archivo, does all the talking; its width axis supplies a condensed cut for numerals and headings and a regular cut for reading. The sheet's spine is the verdict: a huge condensed confidence numeral and a threshold scale that places every numbered claim on one fixed 0 to 100 ramp against the two cut-offs (45 and 75) the backend labels from.

The world is formal, dense where data lives and generous where reading happens. The answer holds a fixed measure (40rem) and spare width goes to the margins, never to longer lines. Structure is drawn with black rules (2px heads, 1px dividers) rather than boxes, tints or shadows. Colour is rationed: neutrals come from one tonal ramp, a single violet marks only what can be pressed or is selected, and green, amber and red speak only for verdicts.

Claims are numbered once and the same number appears in the answer's superscripts, on the scale, in the claim list and in the claim panel, so a reader can cross-reference by number alone. Picking a claim dims the rest of the answer and opens the claim panel with its evidence.

**Key Characteristics:**
- Black rail, white sheets, pale grey ground; square corners everywhere.
- One grotesk at several widths; tabular lining figures on every number that sits in a column or updates.
- One violet signal for interaction and selection; verdict hues for verdicts only.
- 2px black head rules open every sheet, section and list; 1px hairlines divide rows.
- The confidence numeral plus the threshold scale is the signature.
- Flat at rest; depth appears only on floating layers that are open.

## Colors

A neutral tonal ramp carries almost everything; one violet and three verdict hues are the only chroma, each with a single job.

### Primary
- **Signal Violet** (signal; dark theme #a59ce0): the only interactive colour. Primary buttons, the open claim-panel toggle, checked document boxes, the active tab underline, source tags, the selected claim's number on the scale, focus rings, the text caret and the composer's focus frame. Its soft tint (signal-soft; dark #29264a) fills selected claim and source rows and the matched evidence line; 6 to 7% violet washes mark hover on rows and sentences, 13% marks a pressed sentence.

### Tertiary (verdicts)
- **Stated Green** (stated-green; dark #3c9566): claims the documents state. Solid underline at 75% strength, tick mark, top zone of the scale.
- **Inferred Amber** (inferred-amber; dark #c49c4a): claims that follow but are not stated. Solid amber underline, tilde mark, middle zone. Its soft tint also backs the low-coverage note.
- **Flagged Red** (flagged-red; dark #d3687f): possibly hallucinated claims. Broken (dashed) red underline, cross mark, bottom zone, and alarm values in the claim signals.
- Each verdict has a soft companion (stated-soft, inferred-soft, flagged-soft) for quiet backgrounds; the scale zones use the full hue at 25%.

### Neutral
- **Ink** (ink): text, 2px head rules, the scale's confidence pointer, the active theme button.
- **Rail Black** (rail-black; dark #0b0b0c): the shell rail, always rendered as a dark scope in both themes.
- **Sheet White** (sheet-white; dark #1c1d20): exchange sheets, the claim panel, the composer.
- **Canvas Grey** (canvas-grey; dark #121315): the ground the sheets sit on and the thin top bar.
- **Wash** (wash; dark #26272b): muted fills: query chips, missing-word chips, meter tracks, disabled primary buttons, outline hover.
- **Hairline** (hairline; dark #26272b): 1px dividers between rows.
- **Border Grey** (border-grey; dark #2f3034): sheet side edges, the top bar's bottom edge, rail dividers.
- **Input Grey** (input-grey; dark #45464b): unchecked switch tracks, stage-dot outlines.
- **Muted Ink** (muted-ink; dark #a3a4a8): secondary text, labels, scale tick numbers.

The light ramp is #ffffff, #f4f4f2, #ececea, #e3e3e0, #d6d6d2, #b9b9b4, #5c5d61, #111214; the dark ramp is #0b0b0c, #161719, #1c1d20, #26272b, #2f3034, #45464b, #a3a4a8, #ececea. Every neutral is a step of one of them.

### Named Rules
**The One Signal Rule.** Violet appears only on something that can be pressed or is currently selected. Headings, rules, decoration and data never take it.

**The Verdict Monopoly Rule.** Green, amber and red mean stated, inferred and possibly hallucinated. Nothing else in the interface uses those hues.

**The One Ramp Rule.** Every neutral is a step of the tonal ramp; no off-ramp greys.

## Typography

**Display Font:** Archivo (variable, wdth axis), condensed widths 62 to 80
**Body Font:** Archivo at normal width
**Label/Mono Font:** Archivo for labels; Geist Mono for inline code only

**Character:** A single grotesk across the whole system, varied by width and weight rather than by family. Condensed extra-bold figures read as data at a distance (the app is projected in a viva); regular width carries long reading.

### Hierarchy
- **Display** (800, 3.25rem to 6rem by container, line-height 0.88, wdth 62): the welcome and How it works headlines only.
- **Landing display** (800, 3rem to 5.25rem, line-height 0.88, wdth 62): the landing headline and its closing head (up to 5.25rem). **Landing section** (800, 2.25rem to 3.75rem, line-height 0.92, wdth 62): the agent band and evaluation heads. Walkthrough step heads use the 70% cut (800, 1.75rem to 2.375rem, line-height 1.02), each under its condensed step numeral (2.75rem, wdth 62).
- **Numeral** (800, 4rem stacked, 6.5rem two-column, 8.5rem wide; line-height 0.8; wdth 62; tabular): the answer's confidence. Smaller condensed scores repeat the voice: 3rem in the claim panel, 1.625rem in the claim list, 3.5rem for elapsed agent time.
- **Headline** (700, 1.875rem to 2.625rem, line-height 1.05, wdth 80): the question at the top of each sheet.
- **Title** (800, 2rem, line-height 1, wdth 70): How it works section heads; the uppercase VERITRACE wordmark uses the same cut.
- **Reading** (400, 1.1875rem to 1.25rem, line-height 1.7, max 40rem): the answer text and the safe version.
- **Body** (400, 15px, snug): claim text, list rows. **Small** (13px) for metadata, notes and controls.
- **Label** (600, 11.5px, 0.08em tracking, uppercase): column and table heads (Claims, Sources searched, Documents, Confidence, Score, Claim check). A label always heads or captions the data it sits with.
- **Figure** (700, wdth 75, tabular lining): claim numbers, counts, superscript claim references.

### Named Rules
**The Tabular Figures Rule.** Any number that sits in a column, a scale or updates live is set with tabular lining figures.

**The Open Condensed Rule.** Condensed display heads on the landing open their word spacing so words do not run together: 0.07em at the 62% cut, 0.06em at the 70% cut.

**The Width Is Hierarchy Rule.** Change emphasis with width and weight within Archivo; never add a second display family. Geist Mono is for code and nothing else.

## Layout

The shell is three bands: a 16rem black rail (documents, model status, theme), the grey canvas holding the thread, and the 26rem claim panel. A 56px top bar on the canvas states the search scope in label caps and carries the Claim check toggle. The thread is capped at 80rem and padded 12/24/32px by width; exchanges stack 32px apart.

Each exchange sheet sits on a twelve-column grid with 24px gutters. Columns 1 to 4 hold the margin: the "Question N" note, the confidence numeral, the scale, the verdict counts and the agent steps (sticky at 24px from the top). Columns 5 to 12 hold the question, the answer at a 40rem measure, and the numbered claim list. The composer docks on the canvas at one size everywhere: the page's full measure, inset like a sheet's content, on the home page and under answers alike. The grid is not drawn in the app: no column guides or stripes, on the sheet or the ground. The landing page is the one sanctioned exception (see Landing page below).

Responsive behaviour is by container, not page: below 36rem of sheet the grid collapses to one column, the numeral and scale sit side by side in one strip above the answer, and counts and steps follow the claims so the answer stays in the first screen. The rail docks from 64rem and becomes a left slide-over below. The claim panel docks from 80rem (opening by width so the sheet narrows rather than being covered) and is a right slide-over sheet below. The panel is closed until a claim is picked; an explicit toggle is remembered in localStorage.

Spacing rhythm: 4/8/12px inside rows, 24px gutters, 20px (narrow) and 32px sheet padding, 40px between answer sections.

### Landing page
The landing (route /; the app lives at /app) uses the same twelve columns at page scale: a 90rem container padded 16/32/64px with 24px gutters, under a sticky 56px canvas-grey top bar (wordmark, How it works, Evaluation, a 36px violet Open Veritrace). The first viewport splits 5 + 7 columns: the condensed headline, lede and two calls to action at left, the white specimen sheet at right.

Here only, the twelve columns are drawn: a fixed layer behind the page carries one column of bars per grid column, ink at 1.25% (a color-mix of the foreground), each column a repeating run of bars and gaps of its own lengths. Each column drifts upward at its own rate as the page scrolls (a scroll-driven animation on the root scroller); where scroll timelines are unsupported, or motion is reduced, the bars stand still. Below 64rem only six columns of bars show.

From 64rem the specimen sheet is sticky in columns 6 to 12 beside four walkthrough steps in columns 1 to 5. Each step block is at least 86svh tall; the step whose block has crossed 55% of the viewport drives the sheet, the other steps sit at 40% opacity, and a 45svh tail row lets the last step hold before the page moves on. Below 64rem nothing pins: every step carries its own copy of the sheet in that step's state, under its text.

After the walkthrough come a full-bleed agent band (4 + 8 columns), the evaluation (4 + 8 columns) and a close (7 + 5 columns) opened by a 2px ink rule; sections sit 96 to 128px apart.

**The Landing Bars Rule.** The column bars belong to the landing page only, stay at 1.25% ink behind everything, and never appear on a sheet, in the app or on How it works.

## Elevation & Depth

Flat at rest. Sheets separate from the canvas by tone and a 2px ink head rule, not by shadow. Shadows appear only on floating layers while they are open: the slide-over sheets (12px 0 32px, 16 to 20% black, toward the content) over a 40% ink backdrop, and the citation hover card (0 8px 24px, 14% black). Focus is a 2px violet outline offset 2px; the composer swaps its ink frame for violet plus a 3px 18% violet halo.

### Shadow Vocabulary
- **Sheet edge** (`box-shadow: -12px 0 32px rgb(0 0 0 / 0.16)`; left sheet 0.2): open slide-over panels only.
- **Hover card** (`box-shadow: 0 8px 24px rgb(0 0 0 / 0.14)`): the citation preview while it is open.

### Named Rules
**The Flat At Rest Rule.** Nothing casts a shadow at rest. A shadow means a layer is temporarily floating over the sheet. The landing's pinned specimen is at rest while sticky and stays flat.

## Shapes

Square corners throughout (0px on every radius step). The only round forms are the loading spinner. Status dots, stage dots, checkboxes, switches and their thumbs are square. Form is drawn with rules: a 2px ink rule opens each sheet, list, table and panel section; 1px hairlines divide rows; the composer and error notices take a full 2px ink frame. Verdict marks are drawn SVG strokes (2px, square caps, mitred joins): tick, tilde, cross.

## Components

### Buttons
Formal and flat; colour carries the meaning, not shape.
- **Shape:** square (0px).
- **Primary:** signal violet with white text (dark: #a59ce0 with ink text), 36px tall, 16px sides, semibold 13 to 14px; hover lightens to 85%. Disabled primary goes to wash with muted ink at full opacity.
- **Outline:** sheet white with a near-black (ink at 70 to 100%) 1px border; hover fills with wash. Used for Stop, Add documents, Upload and the Claim check toggle.
- **Hover / Focus:** 150ms colour transitions; press scales to 0.97; focus is a 2px violet ring offset 2px.
- **Claim check toggle (open):** violet border, signal-soft fill, violet text.
- **Ghost:** text only, wash on hover (rail links).
- **Landing calls to action:** the primary is 48px tall, 20px sides, 15px semibold, with a trailing arrow that nudges 2px right on hover; the close's primary is 56px, 28px sides, 17px. The outline partner is 48px with a 2px ink border and a down arrow (How it checks). Inline links to further reading are violet semibold text with an arrow, underlined on hover.

### Chips
- **Source tag:** a tiny square tag (S1, S2) in figure type, violet on signal-soft; solid violet with white text when its source is active.
- **Query / missing-word chips:** ink on wash, square, 13px, non-interactive.

### Cards / Containers
- **Corner Style:** square.
- **Background:** sheet white on canvas grey.
- **Shadow Strategy:** none (see Elevation).
- **Border:** 2px ink head rule, 1px border-grey on the other three sides.
- **Internal Padding:** 20px sides narrow, 32px wide; 24px top, 40px bottom.

### Inputs / Fields
- **Composer:** a 2px ink frame on sheet white, 8px padding, borderless transparent textareas inside, 16px text; Safe mode and Check an answer switches sit in its foot. Focus turns the frame violet with a soft violet halo. Disabled: input-grey frame on faint wash.
- **Checkbox:** square, 1.5px muted-ink border, fills violet with a white tick when checked.
- **Switch:** square track and thumb; violet when on, input grey when off.

### Navigation
- **Rail:** black, dark-scoped controls; uppercase condensed VERITRACE wordmark, a Documents list headed by a label and a passage count, rows labelled by file type (PDF, MD) rather than numbers, model status with a square dot, How it works link and a three-way square theme switch (active state inverts to ink).
- **Top bar:** canvas grey, 56px, label-caps search scope at left, Claim check toggle at right.
- **Tabs:** line variant only; the active tab takes a 2px violet underline, inactive text at 60% ink.

### Threshold Scale (signature)
A fixed 0 to 100 ramp, 8px tall, divided into three zones at 45 and 75 (flagged, inferred, stated hues at 25%), with 1px ink cut-off lines at 50%. Every claim is a 3px tick in its verdict hue at its exact score; a small ink triangle above the ramp marks the answer's confidence. The claim numbers sit in a row beneath the ticks, spread at least 20px apart (closer only when that many cannot fit), each joined to its tick by a 1px leader line: numbers that would collide are gathered into an evenly spaced run centred on their ticks, so clusters fan out and never overlap. Hover links tick, number, sentence and claim row; the selected claim's number inverts to violet. When a verdict lands, each tick slides from zero to its score in reading order (720ms ease-out, 90ms stagger).

### Checked Answer
Reading type at 40rem. Each sentence is underlined 2px, offset 6px, in the colour of its weakest claim: solid green for stated, solid amber for inferred, dashed red for possibly hallucinated. Claim numbers follow as condensed superscripts outside the underline. Selecting a sentence tints it 13% violet and dims the rest of the answer to 38%.

### Claim List and Claim Panel
The claim list is a ruled table: number, claim text, verdict mark and label, condensed score; hover is a 6% violet wash, selected is signal-soft. The claim panel opens with a 2px ink head and a "Claim check" label plus the claim range, then per claim: a 2px ink rule, number and verdict, a 3rem condensed score, the reasoning, signal meters (ink bars, red when alarming) and a framed link to the passage, where the matched line flashes violet once.

### Worked Answer Specimen (landing signature)
The landing's specimen is an exchange sheet (2px ink head, 1px border-grey sides, sheet white) holding the worked example: a progress row, the question in the headline cut, the checked answer, one swappable lower panel and a caption saying it is an illustration, not a recorded run.
- **Progress row:** four 3px segments, ink when done or current and border grey when next, each followed by a label-caps name (Answer, Claims, Check, Evidence) in muted ink, the current one in ink.
- **States:** 0 the finished check; 1 the answer with searched-for query chips and the source; 2 the numbered claim list, with the answer's superscripts in ink; 3 the confidence numeral, verdict counts and the threshold scale, its ticks replaying each time the step is reached; 4 the flagged claim opened to its passage, the rest of the answer dimmed, the matched words in signal-soft inside a 2px ink frame.
- **Motion:** the lower panels share one grid cell so the sheet keeps its height; they cross-fade (320ms ease-out in with a 6px rise, 160ms out), and sentence underlines colour in over 420ms. Reduced motion drops the transitions and shows each state at rest.

### Agent Band (landing)
A full-bleed rail-black band rendered as a dark scope in both themes: a landing-section head and lede at left, the nine agent steps at right in a two-column list opened by a 2px rule, each row a condensed 1.75rem step numeral beside the step name and a muted one-line description, divided by 1px rules.

### Figure Tables (landing)
Evaluation results as ruled tables: a label-caps caption on a 2px ink rule, then rows divided by hairlines, each a condensed 62% figure (2.5rem to 3.5rem, tabular) followed by "of N" in 15px muted semibold, beside a plain description. Limitations follow as a ruled list under a 70% condensed head ("Where it falls short").

## Do's and Don'ts

### Do:
- **Do** open every sheet, list and panel section with a 2px ink rule and divide rows with 1px hairlines.
- **Do** set every score, count and claim number in condensed Archivo with tabular lining figures.
- **Do** place every new score on the same fixed 0 to 100 ramp against the 45 and 75 cut-offs, mirroring backend/config.yaml.
- **Do** reuse a claim's single number everywhere the claim appears.
- **Do** keep reading text at a 40rem measure and give spare width to the margins.
- **Do** derive every neutral from the tonal ramp and flip to the dark ramp with the same roles.
- **Do** keep the landing's column bars at 1.25% ink, behind the page, and still under reduced motion or without scroll-timeline support.
- **Do** give every pinned or scroll-driven landing state a stacked, at-rest equivalent below 64rem and under reduced motion.

### Don't:
- **Don't** use violet on anything that cannot be pressed or is not selected.
- **Don't** use green, amber or red for anything except verdicts.
- **Don't** strike through a flagged sentence in the checked answer; it takes a broken red underline and stays fully legible.
- **Don't** round corners; only the spinner is round.
- **Don't** put shadows on anything at rest.
- **Don't** introduce a second display typeface; Geist Mono is for code only.
- **Don't** set a label above a heading as an eyebrow; labels head the data they describe.
- **Don't** draw column guides, stripes or bars anywhere but the landing page's ground.
