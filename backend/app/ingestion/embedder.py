"""bge-small sentence embeddings, run locally on the CPU."""

from sentence_transformers import SentenceTransformer

# bge models retrieve better when queries (not passages) carry this instruction.
QUERY_INSTRUCTION = "Represent this sentence for searching relevant passages: "


class Embedder:
    def __init__(self, model_name: str, device: str = "cpu"):
        self.model_name = model_name
        self._model = SentenceTransformer(model_name, device=device)

    def count_tokens(self, text: str) -> int:
        return len(self._model.tokenizer.encode(text, add_special_tokens=False))

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        vectors = self._model.encode(
            texts, batch_size=32, normalize_embeddings=True, convert_to_numpy=True
        )
        return vectors.tolist()

    def embed_query(self, text: str) -> list[float]:
        vector = self._model.encode(
            QUERY_INSTRUCTION + text, normalize_embeddings=True, convert_to_numpy=True
        )
        return vector.tolist()
