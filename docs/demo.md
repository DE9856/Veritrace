# Demo guide

How to run Veritrace for the presentation, which questions to ask, and what to do when something goes wrong. Everything runs locally on one laptop.

## The day before

- [ ] `cd backend && .venv/bin/pytest -q`: all tests pass.
- [ ] `./start.sh`, then open http://localhost:3000 and ask question 1 below. This also confirms the Groq key works.
- [ ] `./start.sh ollama` and ask one question, so the offline backup is known to work and the model is downloaded (`ollama pull qwen3:4b-instruct` if not).
- [ ] Charge the laptop. Ollama on battery is slower.
- [ ] Go easy on Groq in the 24 hours before the presentation. Its free tier allows 200,000 tokens per rolling 24 hours, and every question spends tokens on the answer, the resampled answers and the judge. Rehearse on `./start.sh ollama`, which has no limit, and keep Groq for a final check.

## On the day

1. Start about five minutes early: `./start.sh`. The first start takes about 20 seconds to load the embedding and NLI models; wait for `Veritrace is running`.
2. Open http://localhost:3000. The status dot in the header should be green and name `openai/gpt-oss-120b`. The documents panel should list the two sample documents (Chandrayaan-3 and the James Webb Space Telescope); if it is empty, choose **Add the two sample documents**.
3. Leave about a minute between questions where you can. Groq's free tier allows 8000 tokens a minute and a question uses a few thousand. If the limit is hit, the app waits for it to reset instead of failing, so a question can take a minute. If the daily cap is hit instead, Gemini takes over for about three questions; after that, switch to `./start.sh ollama`.

## Questions to ask

Answers vary a little from run to run, so the labels below are what usually happens, not a guarantee.

| # | Question | What it shows |
|---|---|---|
| 1 | When did Vikram land and what did the rover find? | A fully supported answer: every claim **high**, confidence about 97/100. Open a claim in the inspector to show entailment, consistency and the source passage. |
| 2 | Why does MIRI need a cryocooler, and why is the mirror coated in gold? | **High** and **inferred** side by side. Inferred claims follow from the passage but are not stated in its words; the inspector lists the new words. |
| 3 | Who was James E. Webb and why was the telescope named after him? | Usually one **hallucinated** claim: the documents say who Webb was, not why the telescope carries his name, so "named because of his leadership" is flagged as unsupported by the judge. |
| 4 | Question 3 again with **Safe mode** on | The safe version tab: the answer rewritten without the hallucinated claim. |
| 5 | Why was JWST launched on a Falcon 9 rocket? | A false premise. The agent searches with several rewritten queries, finds nothing that supports it and answers that the documents don't contain this, instead of inventing a reason. |

Things to point out while it runs: the live agent steps (plan, search, answer, extract claims, verify, consistency, judge, score), the retry when evidence is weak, the clickable `[S1]` citations, and the final "Agent took N steps" summary.

To show uploads, drag in any PDF, `.txt` or `.md` file and ask about it. Keep it short (a few pages); a long PDF takes a while to index on the CPU.

## If something goes wrong

| Problem | What to do |
|---|---|
| No internet, or Groq is down | Ctrl+C, then `./start.sh ollama`. Everything runs offline; the first question takes about a minute while the model loads, later ones about 15 seconds. |
| Status dot is amber or red | Hover over it for the reason. Amber means the model is not reachable; red means the backend is not running. |
| Status dot says "rate limited" | The fallback model is serving; questions still work. |
| `port 8000 is already in use` | An earlier run is still going: `pkill -f "uvicorn app.main"`, or close the other terminal. |
| A question fails with a rate-limit error | Groq's and Gemini's quotas are both used up. Ctrl+C, then `./start.sh ollama`. |
| Documents panel is empty | Choose **Add the two sample documents**, or restart: `SEED_SAMPLES=true` indexes them when the store is empty. |

To show the model fallback on purpose, start with `./start.sh gemini`. Gemini's free tier runs out after about three questions; the status dot then shows Groq serving and when Gemini resets.

## Known behaviour worth explaining if asked

- **Correct paraphrases are sometimes labelled inferred.** A claim that uses 20% or more words not found in its passage is treated as a deduction. This is the most common error in the evaluation ([evaluation.md](evaluation.md)): on the held-out test set, 15 of 39 supported claims were labelled inferred, while hallucinations were caught with precision and recall of 0.93. Calling a supported claim inferred is the safe direction to be wrong in.
- **Questions outside the documents get no answer.** Veritrace only answers from the uploaded documents, by design; a true fact that the documents don't contain would be labelled unsupported.
