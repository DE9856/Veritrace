---
title: Veritrace API
emoji: 🔎
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
pinned: false
short_description: Hallucination-aware question answering over documents
---

# Veritrace API

The backend of Veritrace, a hallucination-aware information assistant. It answers questions from a document knowledge base and labels every claim in the answer as high confidence, inferred, or possibly hallucinated.

- `GET /api/health`: model status
- `POST /api/chat`: ask a question
- `POST /api/chat/stream`: the same, streamed as Server-Sent Events
- `GET /docs`: interactive API documentation

Source and documentation: https://github.com/DE9856/Veritrace
