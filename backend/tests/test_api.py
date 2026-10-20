DOC = (
    "Chandrayaan-3 launched on 14 July 2023 from Sriharikota.\n\n"
    "The Vikram lander touched down near the lunar south pole on 23 August 2023.\n\n"
    "The Pragyan rover confirmed the presence of sulphur in the lunar surface."
)


def upload(client, name="mission.txt", body=DOC):
    return client.post("/api/documents", files={"file": (name, body.encode(), "text/plain")})


def test_empty_knowledge_base_answers_without_calling_llm(client, provider):
    r = client.post("/api/chat", json={"question": "When did Vikram land?"})
    assert r.status_code == 200
    assert r.json()["sources"] == []
    assert "knowledge base is empty" in r.json()["answer"]
    assert provider.prompts == []


def test_upload_list_and_duplicate(client):
    r = upload(client)
    assert r.status_code == 201
    doc = r.json()
    assert doc["filename"] == "mission.txt"
    assert doc["pages"] == 1 and doc["chunks"] >= 1

    again = upload(client, name="copy.txt")
    assert again.status_code == 200
    assert again.json()["id"] == doc["id"]

    listed = client.get("/api/documents").json()
    assert [d["id"] for d in listed] == [doc["id"]]


def test_rejects_unsupported_and_empty_files(client):
    assert upload(client, name="slides.pptx").status_code == 415
    assert upload(client, name="empty.txt", body="").status_code == 422


def test_chat_returns_grounded_answer_with_sources(client, provider):
    upload(client)
    r = client.post("/api/chat", json={"question": "When did the Vikram lander touch down?"})
    assert r.status_code == 200
    body = r.json()

    assert body["answer"] == provider.reply
    assert body["cited_labels"] == ["S1"]
    assert body["invalid_citations"] == []
    assert body["sources"][0]["label"] == "S1"
    assert "23 August 2023" in body["sources"][0]["text"]
    # The prompt sent to the LLM contains the labelled evidence.
    assert "[S1] (mission; mission.txt, page 1)" in provider.prompts[0]

    chunk = client.get(f"/api/chunks/{body['sources'][0]['chunk_id']}").json()
    assert chunk["text"] == body["sources"][0]["text"]


def test_delete_removes_document_and_chunks(client):
    doc = upload(client).json()
    assert client.delete(f"/api/documents/{doc['id']}").status_code == 204
    assert client.get("/api/documents").json() == []
    assert client.get("/api/health").json()["chunks"] == 0
    assert client.delete(f"/api/documents/{doc['id']}").status_code == 404


def test_health_reports_provider_and_counts(client):
    upload(client)
    health = client.get("/api/health").json()
    assert health["status"] == "ok"
    assert health["llm"]["provider"] == "fake"
    assert health["documents"] == 1
    assert health["chunks"] >= 1


def ask(client, question="When did the Vikram lander touch down?"):
    r = client.post("/api/chat", json={"question": question})
    assert r.status_code == 200
    return r.json()


def test_chat_labels_supported_and_invented_claims(client, provider):
    upload(client)
    provider.reply = "Vikram touched down on 23 August 2023 [S1]. Pragyan detected water ice [S1]."
    provider.extraction = {
        "sentences": [
            {"index": 0, "claims": ["Vikram touched down on 23 August 2023."]},
            {"index": 1, "claims": ["Pragyan detected water ice."]},
        ]
    }
    body = ask(client)

    first, second = body["sentences"]
    assert first["label"] == "high"
    assert first["claims"][0]["verdict"] == "entailment"
    assert second["label"] == "hallucinated"
    assert body["counts"] == {"high": 1, "inferred": 0, "hallucinated": 1}
    assert 0 < body["answer_confidence"] < 1
    assert body["extraction_fallback"] is False
    assert set(body["timings_ms"]) == {"retrieve", "generate", "extract", "verify"}


def test_chat_flags_contradicted_claim(client, provider, nli):
    upload(client)
    nli.contradicted.add("Vikram landed on 23 August 2023.")
    claim = ask(client)["sentences"][0]["claims"][0]
    assert (claim["label"], claim["verdict"]) == ("hallucinated", "contradiction")


def test_refusal_sentence_has_no_claims(client, provider):
    upload(client)
    provider.reply = "The provided documents don't contain this information."
    provider.extraction = {"sentences": [{"index": 0, "claims": []}]}
    body = ask(client, "Did Pragyan find water ice?")
    assert body["sentences"][0]["label"] is None
    assert body["answer_confidence"] is None


def test_failed_extraction_falls_back_to_whole_sentences(client, provider):
    upload(client)
    provider.extraction = None
    body = ask(client)
    assert body["extraction_fallback"] is True
    assert body["sentences"][0]["claims"][0]["text"] == "Vikram landed on 23 August 2023."
