# Veritrace backend, for Hugging Face Spaces (Docker SDK) or any container host.
# The LLM is called over the network (Gemini, with Groq as fallback); the embedding
# and NLI models run on the CPU inside the container.

FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Spaces run containers as user 1000.
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

# Defaults for a hosted deployment; override any of them with Space variables.
# The disk is wiped on restart, so the sample documents are indexed at startup.
ENV LLM_PROVIDER=gemini \
    LLM_FALLBACK=groq \
    CONSISTENCY_SAMPLES=2 \
    SEED_SAMPLES=true \
    DATA_DIR=/home/user/data \
    PORT=7860

EXPOSE 7860
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
