# Changelog

All notable changes to Veritrace, the Hallucination-Aware Information Assistant (M1-P5), are recorded here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.10.0] - 2026-10-21

Phase 9: confidence calibration (is the score a probability?) and synthetic hallucinations (detection by kind of error).

### Added
- Each claim has a `support_probability`: the calibrated chance that it is supported (stated or inferred), from Platt scaling of the score, sigmoid(6.27 x score - 2.07), fitted on the 84 dev claims. Labels still come from the raw score and its thresholds. The inspector shows it under the score.
- `calibration/reliability.py` and a calibration section in `docs/evaluation.md`: reliability by score bin, ECE with a 95% bootstrap interval, Brier score, the Platt fit, and selective answering (show only claims above a chance of support) with a risk-coverage curve. The report writes two SVG figures to `docs/figures/` (light and dark mode, no plotting library).
- `calibration/synthetic.py`: true claims with one fact changed by fixed rules, no model (a date moved, a number or count changed, a name swapped for a confusable one, a negation flipped), from two sources: the documents' sentences and the hand-labelled paraphrases. 86 corrupted claims and 85 unchanged controls in `synthetic_claims.yaml`, each read once; 5 that came out arguable or unclear are dropped in the code. `docs/evaluation.md` reports detection by source and kind, and against NLI alone and the judge alone.
- `collect_signals.py` runs with consistency off (`CONSISTENCY_SAMPLES=0`) and keeps a synthetic claim's kind and source.

### Fixed
- With Groq's daily token quota spent, every call retried twice (30 s waits) before falling back, and Groq was tried again a minute later, so a question took 3 to 6 minutes. A daily limit ("tokens per day"), or any limit whose "try again in 1m45s" is longer than 30 s, now fails over at once, and the fallback skips Groq until the given reset time.
- `STARTUP.md` and `docs/demo.md`: what slow questions mean (a spent Groq quota), that long documents use several times more tokens per question, and that calibration runs on Groq share the app's quota.

### Results (qwen3:4b-instruct)
- The raw score is underconfident: on fresh, claims scored 0.6-0.9 were all supported. Calibration error on fresh falls from 0.153 to 0.081 (95% intervals 0.10-0.23 and 0.04-0.15, which overlap: 37 claims are few); Brier from 0.076 to 0.047. On test, ECE 0.090 to 0.058.
- Isotonic regression fit dev better but jumps to exactly 0 and 1 from 84 claims, so Platt scaling (two parameters, never certain) was kept.
- Selective answering on fresh: showing only claims with at least a 50% chance shows 62% of claims, none of the 12 hallucinations, and hides 2 of the 25 supported claims. The sets are a third hallucinated by design, so these rates are not those of real answers.
- Synthetic hallucinations: 80 of 86 caught (93%), none of the 85 unchanged claims flagged. Every wrong date, number, count and negation is caught; swapped names are the weak spot (28 of 34), and harder in a model's wording (16 of 20) than in the documents' (12 of 14).
- Four of the six misses are the judge's: it calls the swapped claim "stated", which rescues an NLI contradiction of 0.99-1.00 (three claims), or its "contradicted" is ignored on a claim NLI accepted (one). Not letting "stated" rescue a strong NLI contradiction was tried and rejected: it lowers dev accuracy from 85.7% to 84.5%, because NLI also strongly contradicts correct deductions with rough arithmetic ("worked for roughly two weeks"), and the judge's rescue keeps those inferred.

## [0.9.0] - 2026-10-21

Phase 8: check mode, the judge's "stated" verdict, the novelty rework and a fresh held-out set.

### Added
- `STARTUP.md`: one-time setup, starting and stopping (with `start.sh` or by hand), quota limits and fixes for common problems.
- Frontend: a "How it works" page (`/how-it-works`) with the agent's steps, the signals and their weights, the labelling rules, the models in use and the evaluation results.
- Frontend: each answer shows the model that wrote it and the search queries the agent ran.
- Frontend: tick documents in the documents panel to limit questions to them (the API's `document_ids`); the question shows which documents it searched.
- Check mode: `ChatRequest.answer` checks a given answer (written by hand, or by another model) instead of having the model write one; the rest of the graph runs unchanged. In the app, the "Check an answer" switch adds a field for it, so a planted error can be shown flagged live.
- Judge verdict "stated": the passage says the claim in other words. Claims NLI confirmed but whose only novelty is new words now go to the judge, which tells a paraphrase from a deduction; for these it only decides between high and inferred, so it cannot overrule NLI.
- `calibration/fresh_claims.yaml`: a second held-out set of 36 claims (14 high, mostly paraphrases; 10 inferred; 12 hallucinated), written before the changes below, because the test set's errors had been used to find what to fix. Plus 8 questions in `answer_questions.yaml` (split `fresh`) that ask for something the documents lack next to something they have.
- `calibration/dev_claims.yaml`: 19 paraphrased claims (11 high, 5 inferred without a number, 3 hallucinated). The dev set mostly copied the documents' words, which is why tuning never saw the paraphrase problem.
- `calibration/rejudge.py`: judges saved claims again after a judge prompt change, without collecting the other signals again. Collected records note the judge prompt they used.
- `calibration/run_groq.sh`: the Groq evaluation as resumable steps, to rerun after each daily quota reset.

### Changed
- Novelty: a new quantity (a number, a duration such as "a month", a comparison such as "only" or "more than", a superlative) always makes a stated claim inferred. "One of" a list no longer counts as a number. Hedges ("roughly"), verb particles ("lifted off") and "lunar" for "Moon" no longer count as new words.
- Generation prompt: answering the covered part of a question comes first, and the fixed refusal is only for questions the sources answer no part of. On Groq this answered one of four half-covered questions that it had refused; qwen3:4b-instruct still refuses all of them.
- Frontend: the delete button on each document is always visible (it only showed on hover, so not at all on touch screens) and says what it removes: the uploaded file, its passages in the vector store and its record.
- Frontend: the example questions are the demo-guide questions, each with a note on what it shows (every claim stated, inferred claims, an unsupported claim, a false premise).
- The "How it works" page reports the fresh held-out set.

### Fixed
- A sentence about what the sources leave out ("No other experiments are mentioned ... in the provided sources") was extracted as a claim and checked. Found on a test answer.

### Results (qwen3:4b-instruct)
| Set | Before: accuracy / macro-F1 / hallucination F1 | After |
|---|---|---|
| Fresh (37, the clean measure) | 67% / 0.66 / 0.85 | 81% / 0.78 / 0.89 |
| Test (67, its errors were read) | 75% / 0.76 / 0.93 | 91% / 0.88 / 0.90 |
| Dev (84, with the new claims) | 82% / 0.81 / 0.86 | 86% / 0.80 / 0.84 |
- Correct paraphrases labelled inferred: 8 of 14 high claims on fresh before, 2 after. A first attempt that only changed the word lists (and matching words by embedding similarity, which rated "europe"/"european" 0.91 and "coldest"/"colder" 0.84) fixed test but changed nothing on fresh, so it was not enough on its own.
- The cost: the judge, given a "stated" option, sometimes calls a deduction stated (dev: 3 claims) or reads approximate arithmetic as a contradiction (fresh: 3 inferred claims labelled hallucinated), so hallucination precision fell on dev and test.
- Every hallucinated claim on fresh is caught, and no stated claim is called hallucinated. The grid search on dev keeps every setting in `config.yaml`.
- qwen3:4b-instruct refused seven of the eight half-covered fresh questions outright, so answers still contribute almost no hallucinations; check mode is the way to show one.

## [0.8.0] - 2026-10-21

Evaluation. The labels are now measured on a held-out test set, with an ablation of each signal, two single-signal baselines and the latency per question. Results are in `docs/evaluation.md`.

### Added
- `calibration/test_claims.yaml`: 41 held-out hand-labelled claims (15 high, many of them paraphrases; 12 inferred; 14 hallucinated, including swapped entities and facts that are true but not in the documents).
- `calibration/collect_answers.py` and `answer_questions.yaml`: run the real agent on 12 questions (6 dev, 6 test) and save every claim it extracts with its raw signals, so the evaluation also covers claims a model actually wrote. Hand labels are in `answer_labels.yaml`.
- `calibration/evaluate.py`: tunes on dev, scores test, and writes `docs/evaluation.md` with the main result, confusion matrix, ablation, baselines (LLM judge alone, self-consistency alone), the test claims it gets wrong and latency. Novelty is recomputed from the saved passages, so a change to the novelty rule is evaluated without calling a model.
- `calibration/latency.py`: seconds per question through the full agent and, on Groq, the tokens each question uses.
- The Groq provider counts the tokens the API reports as used.

### Changed
- The collection scripts take `--claims` and `--out`, turn the fallback model off so every LLM signal comes from one model, wait out rate limits, and save after every claim or answer so an interrupted run resumes.
- A judge call that fails during collection is retried instead of being saved as "no verdict".

### Fixed
- Novelty counted the "s" of a possessive ("JWST's") as a new word, and did not recognise an acronym of a name in the passage ("JWST" for "James Webb Space Telescope").
- Novelty counted modals, causal links and pronouns ("must", "because", "he") as new words, so "MIRI needs a cryocooler because it must be colder" was demoted to inferred against "MIRI has to be colder ..., so a cryocooler keeps it ...". Found on the dev set.

### Results (qwen3:4b-instruct, test set, 67 claims)
- Accuracy 75%, macro-F1 0.76, hallucination precision and recall 0.93. The novelty fixes raise dev accuracy from 90.8% to 92.3% and leave test unchanged.
- Every hallucinated claim but one is caught, and no supported claim is called hallucinated. Most errors are faithful paraphrases labelled inferred (15 of 39 high claims): the novelty rule, designed on dev claims that mostly copy the documents' words, does not carry over to the paraphrase-heavy test claims. Without novelty, accuracy is 82% but inferred is almost never predicted.
- The grid search on dev keeps every current setting, so `config.yaml` is unchanged.

### Found while testing
- Groq's free tier also caps tokens at 200,000 a day (rolling), which the collection reached after the 39 dev claims. A full question uses several thousand tokens (consistency sampling and the judge send the passages again), so rehearsing the demo many times on the day can use up the quota.
- "one of its four instruments" counts "one" as a new number, which forces inferred. Seen on test claims only, so left for after the evaluation.

## [0.7.0] - 2026-10-21

Local demo. Veritrace is shown on a laptop rather than hosted, so deployment is dropped in favour of a one-command start, a reliable model setup and a demo guide.

### Added
- `start.sh`: starts the backend and frontend together, waits for the models to load, and stops both on Ctrl+C. `./start.sh ollama` runs fully offline (starting Ollama if needed), `./start.sh gemini` starts on Gemini.
- `docs/demo.md`: pre-flight checklist, five demo questions with the labels they usually produce, and what to do when the network or a model fails.
- `docs/docker.md`: running the backend image locally.
- The fallback waits for the primary instead of failing when both are rate limited and the primary's limit resets within 90 seconds (Groq's per-minute token limit), so a burst of questions is slower rather than an error.

### Changed
- Groq (`openai/gpt-oss-120b`) is the main model and Gemini the fallback. Gemini's free tier (20 requests a day, about three questions) is too small to lead a live demo; Groq allows 1000 requests and 200,000 tokens a day.
- The Docker image defaults to Groq with Gemini as fallback and listens on port 8000, like the local backend.
- The project overview describes the local demo instead of hosting, and lists Phase 7.

### Removed
- `docs/deployment.md` and `deploy/huggingface/`. A Docker Space on Hugging Face now needs a paid plan, and a public URL would let anyone spend the free model quota.

### Fixed
- Citations written as `[ S1 ]` were not recognised when the answer was streamed, because the padding could be split across stream pieces and each piece was normalised on its own. The answer then reported no citations, the citations were not clickable in the app, and verification did not know which source each sentence cited. The whole answer is now normalised after streaming.

### Found while testing
- On Groq, faithful paraphrases are often labelled inferred at about 0.74: gpt-oss rewords more than the local model the novelty threshold was tuned on. To be addressed by re-running the calibration on Groq.
- gpt-oss rarely adds facts the documents lack; off-topic questions mostly get "the documents don't contain this".

### Verified
- 117 backend tests pass. `./start.sh` on Groq and `./start.sh ollama` offline each answered demo questions in the app's API, and Ctrl+C (SIGTERM) stopped every process including Ollama.

## [0.6.0] - 2026-10-20

Phase 6: hosted models and deployment. Gemini is the primary model, Groq takes over when Gemini's free quota runs out, and the backend ships as a Docker image ready for Hugging Face Spaces.

### Added
- Gemini provider (`providers/gemini.py`): `gemini-3.5-flash` with thinking off, JSON output through `response_json_schema`, streaming, and consistency samples sent in parallel. Health checks are cached for five minutes so the app's status polling does not spend quota.
- OpenAI-compatible provider (`providers/openai_compat.py`) over plain HTTP, used for Groq (`openai/gpt-oss-120b`, low reasoning effort) and usable for any OpenAI-style API.
- Fallback provider with a circuit breaker (`providers/fallback.py`): a rate-limited call goes to the fallback, and the primary is skipped until its limit resets (the reset time comes from Gemini's daily-quota error). Other errors, such as a bad key, are not hidden. A half-streamed answer is never finished by a different model. Responses and `/api/health` name the model actually serving and when the primary resets.
- Rate limiting and retries (`providers/limits.py`): a sliding-window limiter per provider, and retries with backoff that follow the server's suggested delay (`retryDelay`, `retry-after`), including when opening a stream.
- Output normalisation for all providers: `【S1】` and `[ S1 ]` become `[S1]`, and narrow or non-breaking spaces and non-breaking hyphens become plain ones.
- API keys are `SecretStr` settings, so they never appear in logs or tracebacks. `backend/.env` has the new settings ready for the keys.
- Docker image (`backend/Dockerfile`, `.dockerignore`): CPU-only PyTorch, the embedding and NLI models baked in, runs as user 1000 on port 7860, and never contains `.env`.
- `SEED_SAMPLES`: index the bundled sample documents at startup when the store is empty, for hosts whose disk is wiped on restart. Uploads and seeding share one function (`ingestion/library.py`).
- `deploy/huggingface/README.md` (Space settings) and `docs/deployment.md` (step-by-step guide for Hugging Face Spaces and Vercel, with the measured limits).
- `requirements-dev.txt` for pytest and ruff; `requirements.txt` holds only runtime dependencies.
- 31 new tests (rate limiter, retries, Gemini error handling, Groq over a mock transport, fallback and circuit breaker, normalisation, settings and seeding), 114 in total.

### Changed
- Connective words ("using", "via", "also", "then") no longer count as new content in the novelty check. Groq's extractor writes "the rover, using its LIBS, detected iron", which marked eight correct claims as inferred. Calibration re-run on the local model afterwards: still 97% accuracy (macro-F1 0.97) on the 39 labelled claims, with unchanged thresholds.

### Found while testing
- `gemini-2.5-flash` and `gemini-2.5-flash-lite` are closed to new API keys (404). The 3.x lite models reject `thinking_budget=0`.
- Gemini's free tier allows 20 requests a day per model and took 6 to 30 seconds per call: about three questions a day, at 50 to 60 seconds each. Groq's free tier allows 1000 requests a day and 8000 tokens a minute, at 1 to 2 seconds per call.
- Groq retired the Llama 3.3 models; `qwen3.8-27b` failed JSON validation.

### Verified
- On Gemini: three questions answered (a correct factual answer scored 12 of 12 claims high), until the daily quota ran out.
- On the Groq fallback: four questions in 14 to 27 seconds each; in a hand-written answer, the true claim was high, the deduction inferred, the two invented claims hallucinated, and the wrong date and rocket contradicted, each with the judge's reason.
- The Docker image on this machine with `backend/.env`: two sample documents indexed at startup, a streamed question answered in 10.5 seconds with Gemini's quota error tripping the breaker to Groq, and `/api/health` reporting the switch and Gemini's reset time.

## [0.5.0] - 2026-10-20

Phase 5: the web app. A Next.js frontend that streams the agent's work and shows every claim's check.

### Added
- `frontend/`: Next.js 16 (App Router, Cache Components), TypeScript, Tailwind CSS 4 and shadcn/ui on Radix, with the project overview's palette and fonts (Bricolage Grotesque, Source Sans 3, JetBrains Mono) and light, dark and system themes.
- Three-panel layout: documents on the left, the conversation in the middle, the inspector on the right. Below 1024 and 1280 pixels the side panels become overlays.
- Documents panel: drag-and-drop or choose `.pdf`, `.txt` and `.md` files, see pages and passages, remove documents with a confirm step, and load the two sample documents in one click.
- Live agent steps from the SSE stream, with retries marked. The answer streams in as a draft, then becomes the checked answer. Once finished, the steps collapse into a summary ("Agent took 8 steps in 18.0s").
- Checked answer: each sentence highlighted by the label of its weakest claim, with clickable `[S1]` citations; a confidence summary (score out of 100, a bar split by label, counts with explanations); warnings for low coverage, invalid citations and extraction fallback; tabs for the checked answer and the safe version in safe mode; and a list of sources showing which were cited.
- Inspector: each claim's score, label, reason, signal bars (entailment, contradiction, consistency, passage match), self-label, judge verdict, NLI verdict and words not found in the passage, with a link to the supporting passage. The source view highlights the sentence that best matches the claim.
- Composer with safe mode switch, Enter to send and a stop button that cancels the run on the server.
- Health indicator (model and verifier) polled every 30 seconds.
- `frontend/.env.example` (`NEXT_PUBLIC_API_URL`) and `frontend/README.md`.

### Fixed
- Markdown heading markers ("## Landing") stayed in the indexed text of `.md` files and showed in the source viewer; they are now removed on ingest. Re-upload Markdown documents indexed before this change.
- The frontend's generated `.gitignore` ignored `.env.example`; it is now committed.

### Verified
- A scripted browser run (headless Chromium) against the real backend and `qwen3:4b-instruct`: load the samples, ask a question (verdict in about 20 seconds), open a claim and its source, ask in safe mode, switch to dark mode and a 400-pixel-wide phone layout. No console errors and no horizontal overflow on the phone layout. Type check, ESLint and a production build all pass.

## [0.4.0] - 2026-10-20

Phase 4: the agentic graph. The pipeline is now a LangGraph state graph that plans its searches, retries when the evidence is weak, verifies claims on parallel branches, optionally revises its answer, and streams every step to the client.

### Added
- Agent graph (`agent/graph.py`) with ten nodes: analyze, retrieve, no_sources, generate, extract, verify, judge, consistency, score and revise. Every node is wrapped to emit a status event, time itself and append to the trace.
- Retrieval loop: the analyze node plans up to three extra search queries, and retrieve searches with all of them. If the best match is below `evidence_threshold` (0.55, measured with bge on the samples: on-topic 0.53 to 0.73, off-topic 0.40 to 0.56), the graph loops back to analyze, which writes different queries, at most `max_retrieval_retries` (2) times. If the evidence is still weak, the agent answers and sets `low_coverage`.
- Parallel branches: judge (LLM) and consistency (NLI on samples) both follow verify and join at score. Resampling starts as a background task in the extract node, because LangGraph waits for every branch of a step to finish before the next one starts.
- Safe mode (`safe_mode` in the request): when any claim is flagged hallucinated, the revise node returns `revised_answer`, which removes flagged claims and phrases inferred ones as conclusions.
- `POST /api/chat/stream`: Server-Sent Events with `status` per agent step, `draft` while the answer is written (with half-written confidence tags hidden), then `verdict` or `error`. If the client disconnects, the agent run is cancelled.
- `GET /api/chat/graph`: the compiled graph as a Mermaid diagram.
- Token streaming in the provider interface (`LLMProvider.stream`), implemented for Ollama.
- Response fields: `queries`, `retrieval_attempts`, `low_coverage`, `trace` and `revised_answer`. Timings are now per graph node, summed over retries.
- 9 new tests (retry loop recovering and giving up, empty knowledge base route, safe mode with and without flags, SSE stream and error event, graph endpoint), 82 in total.

### Changed
- `agent/pipeline.py` is now a thin wrapper around the graph; the API holds one compiled agent created at startup.

### Verified
- Live with `qwen3:4b-instruct`: a streamed question produced 8 status events, 81 draft updates and the verdict in 24 seconds. An off-topic question ("What is the capital of France?") retried twice, ended with `low_coverage` and a refusal. A safe-mode question that invited speculation about future missions had that claim flagged and removed by the revise node.

## [0.3.0] - 2026-10-20

Phase 3: full confidence scoring. Each claim's label now combines NLI with four more signals, and the weights and thresholds are tuned on hand-labelled claims.

### Added
- Self-labels: the generator tags every sentence `{HIGH}`, `{INFERRED}` or `{UNSURE}`. Tags are read per sentence and removed from the displayed answer.
- Consistency node (`agent/nodes/consistency.py`): resamples the answer 3 times at temperature 0.8 and scores each claim by how strongly the samples entail it (the SelfCheckGPT idea). A sampling failure leaves the signal out instead of failing the request.
- Judge node (`agent/nodes/judge.py`): one LLM call reviews every claim NLI did not cleanly confirm (entailment below the high threshold, or a strong contradiction) and answers derivable, contradicted or unsupported with a short reason. The reason length is capped in the JSON schema sent to the model.
- Novelty check (`verification/novelty.py`): claim words and numbers missing from the supporting passage. NLI entails deductions ("about three weeks after launch") as strongly as statements; a new number or a large share of new words marks the claim inferred, and the reason lists the new words.
- Weighted score of entailment, consistency, retrieval relevance (claim-to-passage similarity) and self-label, with missing signals dropped and weights renormalised. Labels follow ordered rules: judge contradiction; judge rescue of an unconfirmed claim to inferred; NLI contradiction; unsupported; then strong entailment or the score, with novelty able to demote high to inferred.
- `backend/config.yaml` holds the weights and thresholds, loaded below environment variables and `.env`.
- Calibration (`backend/calibration/`): 39 hand-labelled claims over two documents, a script that collects every signal once with the real models (`signals.json`), and a script that grid-searches thresholds and weights, reports confusion matrices, and checks the result by tuning on one document and testing on the other.
- Second sample document, `samples/james-webb-space-telescope.md`.
- Response fields: `consistency`, `retrieval`, `self_label`, `judge` and `new_terms` per claim; timings for `sample`, `consistency` and `judge`.
- 36 new tests, 73 in total.

### Changed
- NLI reads each window twice, with and without the document title, when the first reading is not decisive. Support counts if either reading shows it; a contradiction counts only if both agree. The title helps link "Chandrayaan-3" to "the Vikram lander" but blurred "India became the first to land near the south pole" (entailment 0.52 with the title, 0.85 without).
- The pipeline overlaps GPU and CPU work: NLI verification runs while answers are being resampled, and the consistency check runs while the judge works. Questions take 23 to 30 seconds locally, down from 30 to 39.
- Score weights tuned from 0.55 / 0.20 / 0.15 / 0.10 to 0.65 / 0.15 / 0.10 / 0.10 (entailment / consistency / retrieval / self-label). The thresholds came out unchanged. On the 39 labelled claims: 72% accuracy before the novelty check and wider judging, 92% after, 97% (macro-F1 0.97) with the tuned weights. Tuning on either document alone finds no better settings than these, which score 100% on the JWST claims and 95% on the Chandrayaan-3 claims. Lowering the consistency weight also matches an observed weakness: resampled answers that state only part of a long claim do not entail it.
- Ruff's SIM905 rule is disabled, so word lists can stay readable as a split string.

### Fixed
- Garbled names in extracted claims ("Praginois", "Prag่าน", "Chandray-2" for Pragyan and Chandrayaan-2). This is the 4B model at temperature 0, with or without JSON mode. A capitalised word missing from the answer that starts like, and closely matches, a name in it is repaired.
- A citation used as the subject of a sentence ("[S1] mentions ...") was moved to the previous sentence; a lone "." after a refusal became its own sentence; "No source addresses ..." was not recognised as a statement about the sources.

## [0.2.0] - 2026-10-20

Phase 2: claim verification. Every answer is split into atomic claims, each claim is checked against the sources with an NLI model, and every claim and sentence gets a label.

### Added
- Extract node (`agent/nodes/extract.py`): splits the answer into sentences, keeping citations with the right sentence, then asks the LLM for atomic, self-contained claims as structured JSON. If extraction fails, whole sentences are checked instead, so verification is never skipped. A cited sentence that comes back with no claims is also checked whole.
- NLI verifier (`verification/nli.py`): `MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli` on the CPU, reading the label order from the model config.
- Verify node (`agent/nodes/verify.py`): splits sources into 3-sentence windows and checks each claim against its 4 best-matching windows plus the best window of every source its sentence cited. Windows are ranked by 70% bge similarity and 30% shared words, because embeddings treat dates and numbers loosely. Each NLI premise is prefixed with its document title, because passages often name the subject only indirectly ("the Vikram lander" rather than "Chandrayaan-3").
- Phase 2 scoring (`verification/scoring.py`): entailment of 0.75 or more is high confidence, 0.45 or more is inferred, and anything lower is hallucinated. Contradiction of 0.7 or more makes a claim hallucinated unless another passage clearly supports it, since NLI often reads a passage about a different event as a contradiction. Each claim records its NLI verdict, signals, evidence source, whether that source was cited, and a reason.
- Roll-up: a sentence takes the label of its weakest claim; answer confidence is the claim-length-weighted average score, with counts per label.
- `/api/chat` response fields from the API contract: `answer_confidence`, `counts`, `sentences` (each with its claims), and `extraction_fallback`. Timings now include `extract` and `verify`. `/api/health` reports the NLI model.
- Claim-extraction prompts with a worked example; NLI and window settings in `config.py`.
- Statements about what the sources do not cover ("The documents do not mention ...") are recognised and left unlabelled instead of being checked as claims.
- Document titles: taken from PDF metadata, else a heading-like first line, else the filename. Stored in each chunk's ChromaDB metadata (older chunks fall back to the filename) and shown to the LLM with each source.
- 21 new tests (scoring rules, support versus unrelated contradiction, roll-up, answer splitting, statements about the sources, evidence windows and ranking, titles, labelled chat responses, contradiction, refusal and extraction fallback, Ollama offline handling), 37 in total.

### Verified
- End to end with `qwen3:4b-instruct`, bge-small and DeBERTa on the sample document. A correct answer about the landing and the rover's findings: 11 of 11 claims high confidence. A causal explanation of why the mission ended: labelled inferred. A comparison of Chandrayaan-2 and Chandrayaan-3: 5 of 5 high. In a hand-written answer, an invented claim (water ice) and an unsupported deduction were flagged as hallucinated, and a wrong launch date was flagged as contradicted (1.00). Extraction takes 4 to 5 seconds and verification 2 to 3 seconds per answer.

### Fixed
- The NLI model loaded in float16, the default in Transformers 5, which is about 4x slower on a CPU. It now loads in float32 on the CPU.
- When Ollama was not running, its client raised the built-in `ConnectionError`, which was not caught: `/api/chat` returned a 500 instead of a 503, and `/api/health` failed instead of reporting `degraded`.

## [0.1.0] - 2026-10-20

Phase 1: foundations and RAG. The backend ingests documents and answers questions from them with citations.

### Added
- FastAPI backend (`backend/app/`) with an app factory, CORS for the Next.js dev server, and shared services built once at startup.
- Settings loaded from `backend/.env` through pydantic-settings, with `.env.example` documenting every option.
- LLM provider interface (`providers/base.py`) with `generate`, `generate_json`, `sample` and `health`, plus an Ollama implementation and a factory that selects the provider from `LLM_PROVIDER`.
- Ingestion pipeline: PyMuPDF text extraction with line-wrap and hyphen cleanup, pysbd sentence splitting, page-bounded chunks of up to 400 tokens with 60 tokens of sentence overlap, bge-small-en-v1.5 embeddings, and storage in a persistent ChromaDB collection using cosine distance.
- SQLite document records (SQLModel) with SHA-256 duplicate detection, so uploading the same file twice does not index it twice.
- Retrieve node (top-k chunks labelled S1..Sk) and generate node (grounded answer with inline `[S1]` citations; citations to labels that were never provided are reported as invalid).
- Grounded-answer prompts in `app/prompts/`, including an exact refusal sentence when the sources lack the answer.
- API endpoints: `POST/GET /api/documents`, `GET/DELETE /api/documents/{id}`, `GET /api/chunks/{id}`, `POST /api/chat`, `GET /api/health`.
- Sample document `backend/samples/chandrayaan-3.md`.
- 16 tests (chunker, citation parsing, reasoning cleanup, full API flow) that use a fake embedder and LLM; Ruff lint and format configuration in `pyproject.toml`.
- `README.md` with setup, run and test instructions.
- Project name Veritrace and a `.gitignore` covering secrets, the virtual environment, runtime data, Node build output and editor files.

### Changed
- Development model switched from `qwen3:4b` to `qwen3:4b-instruct`. Ollama's `qwen3:4b` tag is the thinking-only Qwen3-4B-Thinking-2507 build, which ignores `think=False`: its reasoning leaked into answers and each answer took 25 to 80 seconds. The instruct build is the same size and answers in 1 to 2 seconds.
- Project overview: project structure updated to match the code, and the development model renamed.

## [0.0.1] - 2026-10-20

Preliminaries: design and environment setup.

### Added
- Project overview document (`docs/project-overview.html`) covering the approach, confidence labels, agent pipeline, scoring formula, tech stack, architecture, API contract, deployment and build roadmap.
- `backend/requirements.txt` with backend dependencies (FastAPI, LangGraph, ChromaDB, sentence-transformers, transformers, google-genai, ollama, PyMuPDF, pysbd, SQLModel, pytest, ruff).
- Python 3.12 virtual environment at `backend/.venv`, created with uv.
- PyTorch 2.14.1 CPU build, installed separately so the GPU's 4 GB VRAM stays free for Ollama.
- Local development model `qwen3:4b` pulled through Ollama.

### Decided
- Grounding: answers come from a knowledge base of uploaded documents.
- Detection: an ensemble led by claim-level NLI verification (DeBERTa), with self-consistency sampling and the model's own confidence labels as secondary signals.
- Labels: claims are checked individually; sentences are displayed with the label of their weakest claim.
- Models: `qwen3:4b` on Ollama during development, with thinking mode off. The final version switches to the Gemini API free tier, with Sarvam or Groq as a fallback.
- Stack: FastAPI and LangGraph backend, Next.js frontend, ChromaDB vector store, bge-small-en-v1.5 embeddings.
- Deployment: backend on Hugging Face Spaces, frontend on Vercel.
