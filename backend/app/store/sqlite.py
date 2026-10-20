"""Document records in SQLite. ChromaDB holds the chunks; this holds one row per uploaded file."""

from datetime import UTC, datetime
from pathlib import Path

from sqlmodel import Field, Session, SQLModel, create_engine, func, select


class Document(SQLModel, table=True):
    id: str = Field(primary_key=True)
    filename: str
    content_type: str
    sha256: str = Field(index=True)
    stored_path: str
    pages: int
    chunks: int
    size_bytes: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class DocumentRepository:
    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self._engine = create_engine(f"sqlite:///{path}", connect_args={"check_same_thread": False})
        SQLModel.metadata.create_all(self._engine)

    def add(self, document: Document) -> Document:
        with Session(self._engine) as session:
            session.add(document)
            session.commit()
            session.refresh(document)
            return document

    def get(self, document_id: str) -> Document | None:
        with Session(self._engine) as session:
            return session.get(Document, document_id)

    def find_by_hash(self, sha256: str) -> Document | None:
        with Session(self._engine) as session:
            return session.exec(select(Document).where(Document.sha256 == sha256)).first()

    def list(self) -> list[Document]:
        with Session(self._engine) as session:
            return list(session.exec(select(Document).order_by(Document.created_at.desc())))

    def delete(self, document_id: str) -> None:
        with Session(self._engine) as session:
            document = session.get(Document, document_id)
            if document:
                session.delete(document)
                session.commit()

    def count(self) -> int:
        with Session(self._engine) as session:
            return session.exec(select(func.count()).select_from(Document)).one()
