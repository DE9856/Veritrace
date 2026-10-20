# Deploying Veritrace

The backend runs as a Docker container on a free Hugging Face Space; the frontend runs on Vercel. The LLM is Gemini's free tier (`gemini-3.5-flash`), with Groq (`openai/gpt-oss-120b`) as the fallback.

```
browser ──> Vercel (Next.js) ──HTTPS──> Hugging Face Space (FastAPI, bge, DeBERTa) ──> Gemini API
                                                                                  └──> Groq API (fallback)
```

## Before you start

- A Gemini API key from https://aistudio.google.com/apikey
- A Groq API key from https://console.groq.com/keys (optional, for the fallback)
- A Hugging Face account and a token with write access (https://huggingface.co/settings/tokens)
- A Vercel account linked to the GitHub repository

## 1. Check the image locally

From `backend/`:

```bash
docker build -t veritrace-backend .
docker run --rm -p 7860:7860 --env-file .env veritrace-backend
```

Then `curl localhost:7860/api/health` should report `"status": "ok"` and two documents (the bundled samples). The `.env` file is passed at run time only; `.dockerignore` keeps it out of the image.

## 2. Create the Space

1. Create a new Space at https://huggingface.co/new-space: choose **Docker** as the SDK, the **Blank** template, and **CPU basic** (free) hardware. Name it `veritrace` (or anything you like).
2. In the Space's **Settings → Variables and secrets**, add:

   | Name | Kind | Value |
   |---|---|---|
   | `GEMINI_API_KEY` | Secret | your Gemini key |
   | `GROQ_API_KEY` | Secret | your Groq key (optional) |
   | `CORS_ORIGINS` | Variable | `["https://YOUR-APP.vercel.app"]` (fill in after step 4) |

   Everything else has a default in the Dockerfile (`LLM_PROVIDER=gemini`, two consistency samples, sample documents indexed at startup).

## 3. Push the backend to the Space

From the repository root, with your Hugging Face token:

```bash
backend/.venv/bin/hf auth login
backend/.venv/bin/hf upload YOUR-USERNAME/veritrace backend . --repo-type space \
  --exclude ".venv/*" --exclude "data/*" --exclude ".env" --exclude "tests/*" \
  --exclude "**/__pycache__/*" --exclude ".pytest_cache/*" --exclude ".ruff_cache/*"
backend/.venv/bin/hf upload YOUR-USERNAME/veritrace deploy/huggingface/README.md README.md --repo-type space
```

The second upload replaces the Space's README with one that carries the Space settings (`sdk: docker`, `app_port: 7860`). The Space then builds the image, which takes about 10 minutes the first time. When it shows **Running**, the API is at `https://YOUR-USERNAME-veritrace.hf.space`; check `/api/health` there.

## 4. Deploy the frontend on Vercel

1. At https://vercel.com/new, import the GitHub repository.
2. Set **Root Directory** to `frontend`. Vercel detects Next.js.
3. Add the environment variable `NEXT_PUBLIC_API_URL` = `https://YOUR-USERNAME-veritrace.hf.space`.
4. Deploy. Copy the production URL (for example `https://veritrace.vercel.app`) into the Space's `CORS_ORIGINS` variable from step 2, then restart the Space.

`NEXT_PUBLIC_API_URL` is built into the frontend, so redeploy on Vercel if the backend URL changes.

## Things to know

- **The Space is public, and so is the API.** Anyone who finds it uses your Gemini quota. The client-side rate limiter caps requests per minute, but not per day. Pause the Space from its settings when you are not demonstrating it.
- **Storage is temporary.** The free Space disk is wiped on restart. The sample documents are indexed again at startup; uploaded documents are lost.
- **Cold starts.** A free Space sleeps after inactivity. The first request after that waits for the container to start and load the models, about a minute.
- **Speed.** The Space has 2 shared CPU cores, so the NLI checks are slower than on a laptop. Gemini calls run in parallel, which makes up for some of it.
- **Free-tier limits, as measured.** Gemini allows only **20 requests a day per model** and took 6 to 30 seconds per call; one question makes about six calls (plan, answer, extract claims, two consistency samples, judge), so Gemini covers roughly three questions a day. Groq (`openai/gpt-oss-120b`) allows 1000 requests a day and 8000 tokens a minute, and answers in 1 to 2 seconds.
- **What happens when Gemini runs out.** Its daily-quota error carries the reset time. The fallback then skips Gemini until that time (a circuit breaker) and Groq serves every call; a question then takes 10 to 25 seconds. `/api/health` and the status dot in the app show which model is serving and when Gemini resets. If Groq's tokens-per-minute limit is hit, calls wait for the time Groq gives and retry.
