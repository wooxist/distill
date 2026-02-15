"""Parse Claude Code .jsonl transcripts into conversation turns."""

import json
from dataclasses import dataclass


@dataclass
class ConversationTurn:
    """A single conversational turn parsed from .jsonl."""

    role: str  # "user" | "assistant"
    text: str
    timestamp: str | None = None


def parse_transcript(file_path: str) -> list[ConversationTurn]:
    """Parse a Claude Code .jsonl transcript into conversation turns.

    Extracts only user and assistant text content.
    Skips tool_use, tool_result, thinking, system messages.
    """
    with open(file_path, "r", encoding="utf-8") as f:
        raw = f.read()

    lines = [line for line in raw.split("\n") if line.strip()]
    turns: list[ConversationTurn] = []

    for line in lines:
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue  # skip malformed lines

        # Only process user/assistant messages
        entry_type = entry.get("type")
        if entry_type not in ("user", "assistant"):
            continue

        role = entry_type
        message = entry.get("message")
        if not message or not message.get("content"):
            continue

        # Extract text content only
        text_parts: list[str] = []
        for block in message["content"]:
            if isinstance(block, dict) and block.get("type") == "text" and "text" in block:
                text_parts.append(block["text"])

        text = "\n".join(text_parts).strip()
        if not text:
            continue

        turns.append(
            ConversationTurn(
                role=role,
                text=text,
                timestamp=entry.get("timestamp"),
            )
        )

    return turns


def format_transcript(turns: list[ConversationTurn]) -> str:
    """Format conversation turns into a readable transcript for the LLM."""
    return "\n\n---\n\n".join(
        f"[{t.role.upper()}]\n{t.text}" for t in turns
    )
