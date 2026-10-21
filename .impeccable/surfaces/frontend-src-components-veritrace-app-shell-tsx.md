---
version: 1
slug: "frontend-src-components-veritrace-app-shell-tsx"
primary_target: "frontend/src/components/veritrace/app-shell.tsx"
related_targets: ["frontend/src/components/veritrace/how-it-works.tsx"]
---

Scope: the Veritrace app (route /: documents, thread, inspector) and /how-it-works. Visitor mode: Operate (/how-it-works: Read).
Audience and job: students, researchers and analysts ask a question of their own documents and decide which sentences to trust, check or discard, confirming any verdict by opening its passage.

## Direction contract
THESIS: The answer is a galley proof on a fact-checker's desk: every sentence earns a tick, a query or a strike in a margin rail beside it. Refuses the category default of a chat bubble with coloured highlights and a blue brand accent.
OWN-WORLD: White sheets for the copy under check on a pale blue-tinted shell (#edf1f8) and canvas (#f6f8fc). The checking apparatus is drawn in the editor's blue pencil (#2343c4): the double-ruled margin with galley line numbers, selection (a pencil chip), citations, actions, focus, status. The three verdicts (green, amber, red) are the only other hues and are never reused. Source Serif 4 sets the copy under check and the page's voice (headings, wordmark, confidence and claim scores, display cut via opsz); Schibsted Grotesk sets the apparatus with tabular figures. Radii 8/6, 1px rules, no shadows at rest.
STORY: The user sees the verdict distribution and confidence first, scans the margin for queries and strikes, opens one, and reads the passage that settles it.
FIRST VIEWPORT: Left sidebar on the ground: Veritrace mark and name, documents, then model status, How it works and theme at the foot. Centre: question, live checker's log, then the answer sheet with confidence 30px and the label bar on top, text column with the margin rail at its right edge. Composer docked at the bottom. Right rail: the claim inspector.
FORM: Checker's proof, candidate 1 of 7 (Impeccable's pick), seed:621de4eb49a16676. Raised by the lexicon challenger: colour quarantined to verdicts. Raised by the split-flap challenger: log rows keep fixed columns and update in place. Bolder pass (user request, 2026-10-21): the user chose "Editor\'s blue pencil" over "Proof-room navy" to replace the colourless chrome and Geist, which read as a stock kit.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
