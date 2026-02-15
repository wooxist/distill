"""Profile tool — view accumulated user knowledge profile and statistics."""

from ..store.metadata import MetadataStore
from ..store.scope import detect_project_root
from ..store.types import KnowledgeScope


async def handle_profile(scope: str | None = None) -> str:
    """View accumulated user knowledge profile and statistics."""
    project_root = detect_project_root()

    scopes: list[KnowledgeScope]
    if scope:
        scopes = [scope]  # type: ignore[list-item]
    elif project_root:
        scopes = ["global", "project"]
    else:
        scopes = ["global"]

    sections: list[str] = []

    for s in scopes:
        try:
            meta = MetadataStore(s, project_root or None)
            stats = meta.stats()

            type_breakdown = "\n".join(
                f"  {k}: {v}" for k, v in stats["byType"].items()
            )

            sections.append(
                f"## {s.upper()} scope\n"
                f"Total: {stats['total']}\n\n"
                f"By type:\n{type_breakdown or '  (empty)'}"
            )

            # Show top accessed knowledge
            top_accessed = meta.search(scope=s, limit=5)
            if top_accessed:
                top = sorted(top_accessed, key=lambda k: k.access_count, reverse=True)[:3]
                top_lines = "\n".join(
                    f"  - [{k.type}] (accessed {k.access_count}x) {k.content[:60]}..."
                    for k in top
                )
                sections.append(f"\nMost accessed:\n{top_lines}")

            meta.close()
        except Exception:
            sections.append(f"## {s.upper()} scope\n(no data yet)")

    return "\n\n".join(sections) or "No knowledge accumulated yet."
