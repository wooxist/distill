"""Knowledge type definitions."""

from dataclasses import dataclass, field
from typing import Literal

KnowledgeType = Literal["pattern", "preference", "decision", "mistake", "workaround"]
KnowledgeScope = Literal["global", "project"]
ExtractionTrigger = Literal["pre_compact", "session_end", "manual"]


@dataclass
class KnowledgeSource:
    session_id: str
    timestamp: str
    trigger: ExtractionTrigger


@dataclass
class KnowledgeChunk:
    """A single knowledge chunk extracted from conversation."""

    id: str
    content: str
    type: KnowledgeType
    scope: KnowledgeScope
    project: str | None
    tags: list[str]
    source: KnowledgeSource
    confidence: float
    access_count: int
    created_at: str
    updated_at: str


@dataclass
class KnowledgeInput:
    """Input for creating a new knowledge chunk (before ID/timestamps)."""

    content: str
    type: KnowledgeType
    scope: KnowledgeScope
    project: str | None
    tags: list[str]
    source: KnowledgeSource
    confidence: float
