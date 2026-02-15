"""Extract knowledge from conversation transcripts using Anthropic API."""

import json
import os
import re
from datetime import datetime, timezone

import anthropic

from ..store.types import ExtractionTrigger, KnowledgeInput, KnowledgeScope, KnowledgeSource
from .parser import ConversationTurn, format_transcript, parse_transcript
from .prompts import build_extraction_prompt, get_system_prompt

MAX_TRANSCRIPT_CHARS = 100_000  # ~25k tokens, safe for Haiku


async def extract_knowledge(
    transcript_path: str,
    session_id: str,
    trigger: ExtractionTrigger,
    project_name: str | None = None,
    scope_override: KnowledgeScope | None = None,
) -> list[KnowledgeInput]:
    """Extract knowledge from a .jsonl transcript file."""
    # 1. Parse transcript
    turns = parse_transcript(transcript_path)
    if len(turns) < 2:
        return []  # need at least 1 exchange

    # 2. Format and truncate
    formatted = format_transcript(turns)
    if len(formatted) > MAX_TRANSCRIPT_CHARS:
        formatted = _truncate_to_recent(turns, MAX_TRANSCRIPT_CHARS)

    # 3. Call LLM
    raw = await _call_llm(formatted, project_name)
    if not raw:
        return []

    # 4. Convert to KnowledgeInput
    now = datetime.now(timezone.utc).isoformat()
    return [
        KnowledgeInput(
            content=r["content"],
            type=r["type"],
            scope=scope_override or r["scope"],
            project=project_name if r["scope"] == "project" else None,
            tags=r["tags"],
            source=KnowledgeSource(
                session_id=session_id,
                timestamp=now,
                trigger=trigger,
            ),
            confidence=r["confidence"],
        )
        for r in raw
    ]


async def _call_llm(
    formatted_transcript: str,
    project_name: str | None = None,
) -> list[dict]:
    """Call Anthropic API for knowledge extraction."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError(
            "ANTHROPIC_API_KEY environment variable is required for extraction"
        )

    client = anthropic.Anthropic(api_key=api_key)

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=4096,
        system=get_system_prompt(),
        messages=[
            {
                "role": "user",
                "content": build_extraction_prompt(formatted_transcript, project_name),
            }
        ],
    )

    # Extract text from response
    text = "".join(
        block.text for block in response.content if block.type == "text"
    )

    # Parse JSON from response
    return _parse_extraction_response(text)


def _parse_extraction_response(text: str) -> list[dict]:
    """Parse the LLM extraction response into raw extraction dicts."""
    # Try to find JSON array in the response
    json_match = re.search(r"\[[\s\S]*\]", text)
    if not json_match:
        return []

    try:
        parsed = json.loads(json_match.group(0))
        if not isinstance(parsed, list):
            return []

        valid_types = {"pattern", "preference", "decision", "mistake", "workaround"}
        valid_scopes = {"global", "project"}

        # Validate each entry
        return [
            item
            for item in parsed
            if isinstance(item, dict)
            and isinstance(item.get("content"), str)
            and item.get("type") in valid_types
            and item.get("scope") in valid_scopes
            and isinstance(item.get("tags"), list)
            and isinstance(item.get("confidence"), (int, float))
            and 0 <= item["confidence"] <= 1
        ]
    except (json.JSONDecodeError, KeyError):
        return []


def _truncate_to_recent(turns: list[ConversationTurn], max_chars: int) -> str:
    """Truncate transcript to fit within char limit, keeping recent turns."""
    result: list[ConversationTurn] = []
    total = 0

    # Walk backwards, keeping recent turns
    for i in range(len(turns) - 1, -1, -1):
        entry = f"[{turns[i].role.upper()}]\n{turns[i].text}\n\n---\n\n"
        if total + len(entry) > max_chars:
            break
        total += len(entry)
        result.insert(0, turns[i])

    return format_transcript(result)
