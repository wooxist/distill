"""Recall tool — search accumulated knowledge by semantic similarity."""

from ..store.metadata import MetadataStore
from ..store.scope import detect_project_root
from ..store.types import KnowledgeChunk, KnowledgeScope
from ..store.vector import VectorStore


async def handle_recall(
    query: str,
    scope: str | None = None,
    type_: str | None = None,
    limit: int | None = None,
) -> str:
    """Search accumulated knowledge by semantic similarity."""
    max_results = limit or 5
    project_root = detect_project_root()
    results: list[KnowledgeChunk] = []

    scopes: list[KnowledgeScope]
    if scope:
        scopes = [scope]  # type: ignore[list-item]
    elif project_root:
        scopes = ["global", "project"]
    else:
        scopes = ["global"]

    for s in scopes:
        try:
            vector = VectorStore(s, project_root or None)
            meta = MetadataStore(s, project_root or None)

            hits = vector.search(query, max_results)
            for hit in hits:
                chunk = meta.get_by_id(hit.id)
                if not chunk:
                    continue
                if type_ and chunk.type != type_:
                    continue
                meta.touch(hit.id)
                results.append(chunk)

            vector.close()
            meta.close()
        except Exception:
            # scope may not exist yet -- skip
            pass

    # Sort by confidence descending
    results.sort(key=lambda k: k.confidence, reverse=True)
    limited = results[:max_results]

    if not limited:
        return "No matching knowledge found."

    formatted = "\n\n".join(
        f"{i + 1}. [{k.type}] ({k.scope}, confidence: {k.confidence})\n"
        f"   {k.content}\n"
        f"   tags: {', '.join(k.tags)}"
        for i, k in enumerate(limited)
    )

    return formatted
