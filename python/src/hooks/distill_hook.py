#!/usr/bin/env python3
"""Distill hook handler for PreCompact and SessionEnd events.

Receives hook event data via stdin (JSON), extracts knowledge
from the session transcript, and stores it.

Usage: echo '{"session_id":"...","transcript_path":"..."}' | python -m src.hooks.distill_hook
"""

import asyncio
import json
import sys

from ..extractor.extractor import extract_knowledge
from ..store.metadata import MetadataStore
from ..store.scope import detect_project_root
from ..store.types import ExtractionTrigger
from ..store.vector import VectorStore


async def main() -> None:
    # Read stdin
    input_data = sys.stdin.read().strip()
    if not input_data:
        print("distill-hook: no input received on stdin", file=sys.stderr)
        sys.exit(1)

    try:
        hook_data = json.loads(input_data)
    except json.JSONDecodeError:
        print("distill-hook: invalid JSON on stdin", file=sys.stderr)
        sys.exit(1)

    session_id = hook_data.get("session_id")
    transcript_path = hook_data.get("transcript_path")

    if not session_id or not transcript_path:
        print(
            "distill-hook: missing session_id or transcript_path",
            file=sys.stderr,
        )
        sys.exit(1)

    # Determine trigger type from hook event name
    hook_event_name = hook_data.get("hook_event_name", "")
    trigger: ExtractionTrigger = (
        "pre_compact" if hook_event_name == "PreCompact" else "session_end"
    )

    cwd = hook_data.get("cwd")
    project_root = detect_project_root(cwd) if cwd else detect_project_root()
    project_name = project_root.split("/")[-1] if project_root else None

    print(
        f"distill-hook: extracting from session {session_id} ({trigger})",
        file=sys.stderr,
    )

    try:
        chunks = await extract_knowledge(
            transcript_path=transcript_path,
            session_id=session_id,
            trigger=trigger,
            project_name=project_name,
        )

        if not chunks:
            print("distill-hook: no knowledge extracted", file=sys.stderr)
            return

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
                print(
                    f"distill-hook: failed to save chunk: {err}",
                    file=sys.stderr,
                )

        print(
            f"distill-hook: extracted {len(chunks)}, saved {saved} knowledge chunks",
            file=sys.stderr,
        )
    except Exception as err:
        print(f"distill-hook: extraction failed: {err}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
