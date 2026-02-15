"""Memory tool — manage knowledge: promote/demote scope, or delete entries."""

from ..store.metadata import MetadataStore
from ..store.scope import detect_project_root
from ..store.types import KnowledgeInput, KnowledgeSource
from ..store.vector import VectorStore


async def handle_memory(action: str, chunk_id: str) -> str:
    """Manage knowledge: promote/demote scope, or delete entries."""
    project_root = detect_project_root()

    if action == "delete":
        for scope in ("global", "project"):
            try:
                meta = MetadataStore(scope, project_root or None)  # type: ignore[arg-type]
                vector = VectorStore(scope, project_root or None)  # type: ignore[arg-type]

                if meta.delete(chunk_id):
                    vector.remove(chunk_id)
                    meta.close()
                    vector.close()
                    return f"Deleted knowledge entry {chunk_id} from {scope} scope."

                meta.close()
                vector.close()
            except Exception:
                continue

        return f"Knowledge entry {chunk_id} not found."

    # promote or demote
    from_scope = "project" if action == "promote" else "global"
    to_scope = "global" if action == "promote" else "project"

    if to_scope == "project" and not project_root:
        return "Cannot demote to project scope: no project root detected."

    try:
        from_meta = MetadataStore(from_scope, project_root or None)  # type: ignore[arg-type]
        from_vector = VectorStore(from_scope, project_root or None)  # type: ignore[arg-type]
        to_meta = MetadataStore(to_scope, project_root or None)  # type: ignore[arg-type]
        to_vector = VectorStore(to_scope, project_root or None)  # type: ignore[arg-type]

        chunk = from_meta.get_by_id(chunk_id)
        if not chunk:
            from_meta.close()
            from_vector.close()
            to_meta.close()
            to_vector.close()
            return f"Knowledge entry {chunk_id} not found in {from_scope} scope."

        input_ = KnowledgeInput(
            content=chunk.content,
            type=chunk.type,
            scope=to_scope,  # type: ignore[arg-type]
            project=chunk.project if to_scope == "project" else None,
            tags=chunk.tags,
            source=chunk.source,
            confidence=chunk.confidence,
        )
        inserted = to_meta.insert(input_)
        to_vector.index(inserted.id, inserted.content, inserted.tags)

        from_meta.delete(chunk_id)
        from_vector.remove(chunk_id)

        from_meta.close()
        from_vector.close()
        to_meta.close()
        to_vector.close()

        action_label = "Promoted" if action == "promote" else "Demoted"
        return (
            f"{action_label} knowledge entry.\n"
            f"{from_scope} \u2192 {to_scope}\n"
            f"New ID: {inserted.id}\n"
            f"Content: {chunk.content[:100]}..."
        )
    except Exception as err:
        return f"Error during {action}: {err}"
