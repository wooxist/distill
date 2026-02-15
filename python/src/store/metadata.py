"""Metadata store backed by SQLite."""

import json
import sqlite3
import uuid
from datetime import datetime, timezone

from .scope import resolve_db_path
from .types import (
    KnowledgeChunk,
    KnowledgeInput,
    KnowledgeScope,
    KnowledgeSource,
    KnowledgeType,
)

SCHEMA = """
CREATE TABLE IF NOT EXISTS knowledge (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('pattern','preference','decision','mistake','workaround')),
  scope TEXT NOT NULL CHECK(scope IN ('global','project')),
  project TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  session_id TEXT NOT NULL,
  trigger TEXT NOT NULL CHECK("trigger" IN ('pre_compact','session_end','manual')),
  source_timestamp TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  access_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_knowledge_scope ON knowledge(scope);
CREATE INDEX IF NOT EXISTS idx_knowledge_type ON knowledge(type);
CREATE INDEX IF NOT EXISTS idx_knowledge_project ON knowledge(project);
"""


class MetadataStore:
    """Metadata store backed by SQLite."""

    def __init__(self, scope: KnowledgeScope, project_root: str | None = None) -> None:
        db_path = resolve_db_path(scope, project_root)
        self.db = sqlite3.connect(db_path)
        self.db.row_factory = sqlite3.Row
        self.db.execute("PRAGMA journal_mode = WAL")
        self.db.executescript(SCHEMA)

    def insert(self, input_: KnowledgeInput) -> KnowledgeChunk:
        """Insert a new knowledge chunk, returns full chunk with generated id/timestamps."""
        now = datetime.now(timezone.utc).isoformat()
        chunk_id = str(uuid.uuid4())

        self.db.execute(
            """
            INSERT INTO knowledge (id, content, type, scope, project, tags, session_id, "trigger", source_timestamp, confidence, access_count, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
            """,
            (
                chunk_id,
                input_.content,
                input_.type,
                input_.scope,
                input_.project,
                json.dumps(input_.tags),
                input_.source.session_id,
                input_.source.trigger,
                input_.source.timestamp,
                input_.confidence,
                now,
                now,
            ),
        )
        self.db.commit()

        return KnowledgeChunk(
            id=chunk_id,
            content=input_.content,
            type=input_.type,
            scope=input_.scope,
            project=input_.project,
            tags=input_.tags,
            source=input_.source,
            confidence=input_.confidence,
            access_count=0,
            created_at=now,
            updated_at=now,
        )

    def get_by_id(self, chunk_id: str) -> KnowledgeChunk | None:
        """Get a knowledge chunk by ID."""
        cursor = self.db.execute("SELECT * FROM knowledge WHERE id = ?", (chunk_id,))
        row = cursor.fetchone()
        return _row_to_chunk(row) if row else None

    def search(
        self,
        scope: KnowledgeScope | None = None,
        type_: KnowledgeType | None = None,
        project: str | None = None,
        limit: int = 20,
    ) -> list[KnowledgeChunk]:
        """Search by filters (non-vector, metadata only)."""
        conditions: list[str] = []
        params: list[object] = []

        if scope:
            conditions.append("scope = ?")
            params.append(scope)
        if type_:
            conditions.append("type = ?")
            params.append(type_)
        if project:
            conditions.append("project = ?")
            params.append(project)

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        params.append(limit)

        cursor = self.db.execute(
            f"SELECT * FROM knowledge {where} ORDER BY updated_at DESC LIMIT ?",
            params,
        )
        rows = cursor.fetchall()
        return [_row_to_chunk(row) for row in rows]

    def touch(self, chunk_id: str) -> None:
        """Increment access count (called on recall)."""
        now = datetime.now(timezone.utc).isoformat()
        self.db.execute(
            "UPDATE knowledge SET access_count = access_count + 1, updated_at = ? WHERE id = ?",
            (now, chunk_id),
        )
        self.db.commit()

    def update_scope(self, chunk_id: str, new_scope: KnowledgeScope) -> None:
        """Update scope (promote/demote)."""
        now = datetime.now(timezone.utc).isoformat()
        self.db.execute(
            "UPDATE knowledge SET scope = ?, updated_at = ? WHERE id = ?",
            (new_scope, now, chunk_id),
        )
        self.db.commit()

    def delete(self, chunk_id: str) -> bool:
        """Delete a knowledge entry."""
        cursor = self.db.execute("DELETE FROM knowledge WHERE id = ?", (chunk_id,))
        self.db.commit()
        return cursor.rowcount > 0

    def stats(self) -> dict:
        """Get aggregate statistics."""
        total_row = self.db.execute("SELECT COUNT(*) as cnt FROM knowledge").fetchone()
        total = total_row["cnt"]

        by_type: dict[str, int] = {}
        for row in self.db.execute(
            "SELECT type, COUNT(*) as cnt FROM knowledge GROUP BY type"
        ):
            by_type[row["type"]] = row["cnt"]

        by_scope: dict[str, int] = {}
        for row in self.db.execute(
            "SELECT scope, COUNT(*) as cnt FROM knowledge GROUP BY scope"
        ):
            by_scope[row["scope"]] = row["cnt"]

        return {"total": total, "byType": by_type, "byScope": by_scope}

    def close(self) -> None:
        """Close the database connection."""
        self.db.close()


def _row_to_chunk(row: sqlite3.Row) -> KnowledgeChunk:
    return KnowledgeChunk(
        id=row["id"],
        content=row["content"],
        type=row["type"],
        scope=row["scope"],
        project=row["project"],
        tags=json.loads(row["tags"]),
        source=KnowledgeSource(
            session_id=row["session_id"],
            timestamp=row["source_timestamp"],
            trigger=row["trigger"],
        ),
        confidence=row["confidence"],
        access_count=row["access_count"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )
