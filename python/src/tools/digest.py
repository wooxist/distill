"""Digest tool — analyze patterns across accumulated knowledge."""

from ..store.metadata import MetadataStore
from ..store.scope import detect_project_root
from ..store.types import KnowledgeScope


async def handle_digest() -> str:
    """Analyze patterns across accumulated knowledge: merge duplicates, update confidence scores."""
    project_root = detect_project_root()

    scopes: list[KnowledgeScope]
    if project_root:
        scopes = ["global", "project"]
    else:
        scopes = ["global"]

    report: list[str] = []

    for scope in scopes:
        try:
            meta = MetadataStore(scope, project_root or None)
            all_entries = meta.search(scope=scope, limit=1000)

            # Find potential duplicates (simple text similarity)
            duplicates: list[dict] = []
            for i in range(len(all_entries)):
                for j in range(i + 1, len(all_entries)):
                    if _simple_similarity(all_entries[i].content, all_entries[j].content) > 0.7:
                        duplicates.append({
                            "a": all_entries[i].id,
                            "b": all_entries[j].id,
                            "content": (
                                f'"{all_entries[i].content[:50]}..." '
                                f'\u2248 "{all_entries[j].content[:50]}..."'
                            ),
                        })

            # Find low-confidence, never-accessed entries
            stale = [
                k for k in all_entries
                if k.confidence < 0.5 and k.access_count == 0
            ]

            report.append(f"## {scope.upper()} scope ({len(all_entries)} entries)")

            if duplicates:
                dup_lines = "\n".join(
                    f"  - {d['content']}" for d in duplicates[:5]
                )
                report.append(
                    f"\nPotential duplicates ({len(duplicates)}):\n{dup_lines}"
                )
            else:
                report.append("\nNo duplicates detected.")

            if stale:
                stale_lines = "\n".join(
                    f"  - [{k.type}] (confidence: {k.confidence}) {k.content[:60]}..."
                    for k in stale[:5]
                )
                report.append(
                    f"\nStale entries (low confidence, never accessed): {len(stale)}\n{stale_lines}"
                )

            meta.close()
        except Exception:
            report.append(f"## {scope.upper()} scope\n(no data yet)")

    return "\n\n".join(report) or "No knowledge to analyze."


def _simple_similarity(a: str, b: str) -> float:
    """Simple word-overlap similarity (Jaccard-like).

    Returns 0-1 where 1 = identical word sets.
    """
    words_a = set(a.lower().split())
    words_b = set(b.lower().split())
    intersection = words_a & words_b
    union = words_a | words_b
    return len(intersection) / len(union) if union else 0.0
