# Veritrace backend in a container (see docs/docker.md).
# The LLM is called over the network (Groq, with Gemini as fallback); the embedding
# and NLI models run on the CPU inside the container.

FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Run as an unprivileged user.
RUN useradd --create-home --uid 1000 user
WORKDIR /home/user/app

# CPU-only PyTorch first, so requirements.txt does not pull the 2.5 GB CUDA build.
RUN pip install torch --index-url https://download.pytorch.org/whl/cpu
COPY requirements.txt .
RUN pip install -r requirements.txt

USER user
ENV HOME=/home/user \
    HF_HOME=/home/user/.cache/huggingface

# Bake the embedding and NLI models into the image, so a cold start does not begin with
# a 1 GB download.
RUN python -c "\
from sentence_transformers import SentenceTransformer; \
from transformers import AutoModelForSequenceClassification, AutoTokenizer; \
SentenceTransformer('BAAI/bge-small-en-v1.5'); \
name = 'MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli'; \
AutoTokenizer.from_pretrained(name); AutoModelForSequenceClassification.from_pretrained(name)"

COPY --chown=user . .

# Defaults; backend/.env passed with --env-file overrides any of them. The container's
# disk is fresh on every run, so the sample documents are indexed at startup.
ENV LLM_PROVIDER=groq \
    LLM_FALLBACK=gemini \
    CONSISTENCY_SAMPLES=2 \
    SEED_SAMPLES=true \
    DATA_DIR=/home/user/data \
    PORT=8000

EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
