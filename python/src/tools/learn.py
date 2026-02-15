"""Learn tool — extract and save knowledge from a conversation transcript."""

import sys

from ..extractor.extractor import extract_knowledge
from ..store.metadata import MetadataStore
from ..store.scope import detect_project_root
from ..store.types import KnowledgeScope
from ..store.vector import VectorStore


async def handle_learn(
    transcript_path: str,
    session_id: str,
    scope: str | None = None,
) -> str:
    """Extract and save knowledge from a conversation transcript."""
    project_root = detect_project_root()
    project_name = project_root.split("/")[-1] if project_root else None

    # Extract knowledge from transcript
    chunks = await extract_knowledge(
        transcript_path=transcript_path,
        session_id=session_id,
        trigger="manual",
        project_name=project_name,
        scope_override=scope if scope else None,  # type: ignore[arg-type]
    )

    if not chunks:
        return "No extractable knowledge found in this transcript."

    # Save each chunk to the appropriate store
    saved = 0
    for chunk in chunks:
        try:
            meta = MetadataStore(chunk.scope, project_root or None)
            vector = VectorStore(chunk.scope, project_root or None)

            inserted = meta.insert(chunk)
            vector.index(inserted.id, inserted.content, inserted.tags)

            meta.close()
            vector.close()
            saved += 1
        except Exception as err:
            print(f"Failed to save chunk: {err}", file=sys.stderr)

    summary = "\n".join(
        f"- [{c.type}] {c.content[:80]}..." for c in chunks
    )

    return f"Extracted {len(chunks)} knowledge chunks, saved {saved}.\n\n{summary}"
