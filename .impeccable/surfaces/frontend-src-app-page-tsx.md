---
version: 1
slug: "frontend-src-app-page-tsx"
primary_target: "frontend/src/app/page.tsx"
related_targets: []
---

Scope: a new landing page, the first thing a visitor sees, at route / (the app moves to /app; "Open Veritrace" and the How it works page's back link point there). Visitor mode: Persuade. Status 2026-10-21: structure chosen, NOT BUILT YET; build it in the next session.
Audience and job: students, researchers and analysts (and the viva examiners) who need to understand in seconds what Veritrace is, what it does, and why it can be trusted, then open the app.
User asks: same Swiss theme as the app (DESIGN.md); the column bars allowed here only, heavily faded into the background; nice scroll animations, including background scroll animations.
Chosen sketch: .impeccable/mocks/decision/landing-worked.html ("The Worked Answer", option 1 of the dealt hand).
Build note: the design check flagged the sketch's full-sentence headline at 92px as oversized; in the build, set it smaller (about 4.5 to 5.5rem) or tighten the copy so the specimen keeps its weight in the first viewport.
Proof allowed (real, from docs/evaluation.md; always say the model and set): fresh held-out set with qwen3:4b-instruct: 81% accuracy, hallucination F1 0.89, all 12 hallucinated claims caught, none of the stated claims called hallucinated; synthetic planted errors: 80 of 86 caught, 0 of 85 unchanged flagged. No users, testimonials or invented numbers.

## Direction contract
THESIS: The landing page is the product checking an answer in front of you: a real checked answer is pinned on screen and builds itself as you scroll, step by step, until the visitor has watched Veritrace work. Refuses the generic hero-plus-feature-cards page.
OWN-WORLD: The app's Swiss world unchanged (DESIGN.md): #f4f4f2 ground, black rules and type, white sheet for the specimen, Archivo condensed headlines, violet #4a3aa8 only on actions, muted verdict colours only for verdicts. Here only: the twelve-column bars across the full background, very faint (about 2% ink), drifting slowly with scroll (parallax).
STORY: Read the headline, see a checked answer, scroll: (1) the question and answer appear; (2) the answer splits into numbered claims; (3) each claim gets its underline and label; (4) ticks drop onto the threshold scale against 45/75; (5) a claim opens to its source passage; then the agent's steps, the evaluation numbers, and a final Open Veritrace.
FIRST VIEWPORT: Top bar: VERITRACE wordmark, How it works, Evaluation, and Open Veritrace (violet). Left 5 columns: condensed headline "Every claim, checked against your documents.", one-line lede, Open Veritrace (primary) and How it checks (outline), and a "1 of 4" step caption. Right 7 columns: a white sheet holding the Chandrayaan-3 sample question, its checked answer (one flagged sentence, PSLV), the confidence numeral and the threshold scale.
FORM: The Worked Answer, dealt structure 1 of 3 (from my ranked list of 7), seed:38c40f3765875a30. Signature motion: the pinned specimen advances with scroll (CSS scroll-driven animations where supported, IntersectionObserver fallback; reduced motion shows every step at rest).
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
