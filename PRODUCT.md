# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Students, researchers and analysts who must answer questions from their own documents (PDF, `.txt`, `.md`) and cannot afford to repeat an invented fact. They upload the documents, ask a question and then decide which parts of the answer to trust. They have no time to reread the whole source, but they need to see the evidence behind any claim they plan to use.

Veritrace is also a solo Agentic AI course project, presented live on one laptop and examined in a viva. That shapes the operating context (below) but is not the audience the design serves.

## Product Purpose

Veritrace answers questions only from the uploaded documents and labels every atomic claim in its answer as **High confidence**, **Inferred** or **Possibly hallucinated**, with a score out of 100 and the source passage behind it. It succeeds when a user can tell at a glance which sentences to trust, which to check and which to discard, and can confirm any label by opening its evidence.

## Positioning

Other RAG assistants cite their sources. Veritrace checks the claims and shows the work. A LangGraph agent plans its searches, retries with rewritten queries when the evidence is weak, answers with `[S1]`-style citations and splits the answer into atomic claims. It then scores each claim with NLI entailment against its passage, novelty (words the passage does not contain), consistency across resampled answers and an LLM judge for unsettled cases. The scores were calibrated on a hand-labelled dev set and evaluated on a held-out test set. Every step and signal is visible to the user, not just the final verdict.

## Operating Context

- Runs locally: FastAPI backend on port 8000, Next.js frontend on port 3000, started with `./start.sh`. It is not deployed.
- Models: Groq `openai/gpt-oss-120b` as the main model with Gemini `gemini-3.5-flash` as the fallback, or fully offline on Ollama `qwen3:4b-instruct`. Free tiers only, so rate limits are part of normal use. The header status dot shows which model is serving and why.
- A question takes from several seconds to about a minute, because the agent steps stream in live over SSE.
- Two sample documents ship with it (Chandrayaan-3 and the James Webb Space Telescope) and can be added with one action.
- Presentation flow and demo questions: `docs/demo.md`.

## Capabilities and Constraints

- Upload, list and remove documents. Ask questions, answered only from those documents. Questions outside them get "the documents don't contain this", never an invented answer.
- Live agent steps: Plan search, Search documents, Write answer, Split into claims, Check against sources, Judge unsettled claims, Compare resamples, Score confidence, and Safe rewrite (in safe mode).
- A claim inspector per highlighted sentence shows the label, the score, the entailment, consistency and novelty signals, the new words and the source passage. Citations open the passage they cite.
- **Safe mode** rewrites the answer without the hallucinated claims and shows it in a separate tab.
- Known behaviour: correct paraphrases are often labelled Inferred (on the test set, 15 of 39 supported claims), because a claim with 20% or more words absent from its passage counts as a deduction. That is the safe direction to be wrong in.
- Terminology (fixed): the labels are *High confidence*, *Inferred* and *Possibly hallucinated*, with the hints in `frontend/src/lib/labels.ts`. Step names are in the same file.

## Brand Commitments

- Name: **Veritrace**, subtitle "Hallucination-Aware Information Assistant".
- The label colours are fixed meaning, not decoration: green for High confidence, amber for Inferred and red for Possibly hallucinated. They match `docs/project-overview.html`.
- Voice: plain, exact and modest about limits. The product says what it checked and what it could not.

## Evidence on Hand

- Evaluation with real numbers: `docs/evaluation.md`. On the held-out test set, hallucinations were caught with precision and recall of 0.93; there is also a per-signal ablation and the latency per question. The Groq evaluation is still in progress, so do not quote Groq figures until they are written there.
- The design overview is `docs/project-overview.html`.
- Sample documents are in `backend/samples/` and `frontend/public/samples/`.
- There are no users, testimonials or deployment. Do not invent them.

## Product Principles

1. **Every claim earns its label in view.** The label, its score and the evidence behind it are always one action away. A verdict is never shown without its reasons.
2. **Show the agent working.** The live steps, the retries and the step count are part of the product, not loading chrome.
3. **Honest about limits.** Out-of-scope questions, Inferred paraphrases, rate limits and fallback models are stated plainly, never hidden or softened.
4. **The label vocabulary is stable.** The three names, their meanings and their colours stay consistent wherever a label appears.
5. **Trust comes from the sources.** Only the uploaded documents are authoritative, and the UI always points back to the passage.
