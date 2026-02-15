"""Vector store for semantic knowledge search.

MVP: Uses SQLite FTS5 for full-text search.
Upgrade path: Replace with ChromaDB or another vector DB
when embedding infrastructure is available.
"""

import re
import sqlite3
from dataclasses import dataclass

from .scope import resolve_db_path
from .types import KnowledgeScope

FTS_SCHEMA = """
CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
  id UNINDEXED,
  content,
  tags
);
"""


@dataclass
class SearchResult:
    id: str
    content: str
    tags: list[str]
    score: float


class VectorStore:
    """Vector store backed by SQLite FTS5."""

    def __init__(self, scope: KnowledgeScope, project_root: str | None = None) -> None:
        db_path = resolve_db_path(scope, project_root)
        self.db = sqlite3.connect(db_path)
        self.db.row_factory = sqlite3.Row
        self.db.execute("PRAGMA journal_mode = WAL")
        self.db.executescript(FTS_SCHEMA)

    def index(self, chunk_id: str, content: str, tags: list[str]) -> None:
        """Index a knowledge chunk for search."""
        self.db.execute(
            "INSERT OR REPLACE INTO knowledge_fts (id, content, tags) VALUES (?, ?, ?)",
            (chunk_id, content, " ".join(tags)),
        )
        self.db.commit()

    def search(self, query: str, limit: int = 5) -> list[SearchResult]:
        """Search by query string using FTS5 ranking."""
        sanitized = _sanitize_fts_query(query)
        if not sanitized:
            return []

        cursor = self.db.execute(
            """SELECT id, content, tags, rank
               FROM knowledge_fts
               WHERE knowledge_fts MATCH ?
               ORDER BY rank
               LIMIT ?""",
            (sanitized, limit),
        )
        rows = cursor.fetchall()

        return [
            SearchResult(
                id=row["id"],
                content=row["content"],
                tags=[t for t in row["tags"].split(" ") if t],
                score=-row["rank"],  # FTS5 rank is negative (lower = better)
            )
            for row in rows
        ]

    def remove(self, chunk_id: str) -> None:
        """Remove an entry from the search index."""
        self.db.execute("DELETE FROM knowledge_fts WHERE id = ?", (chunk_id,))
        self.db.commit()

    def close(self) -> None:
        """Close the database connection."""
        self.db.close()


def _sanitize_fts_query(query: str) -> str:
    """Sanitize query for FTS5 MATCH syntax.

    Splits into tokens and joins with OR for broad matching.
    """
    # Remove non-alphanumeric, non-whitespace characters (Unicode-aware)
    cleaned = re.sub(r"[^\w\s]", " ", query, flags=re.UNICODE)
    tokens = [t for t in cleaned.split() if len(t) > 0]

    if not tokens:
        return ""

    # Join tokens with OR for broad matching
    return " OR ".join(f'"{t}"' for t in tokens)
