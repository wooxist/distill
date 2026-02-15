"""Scope resolution for knowledge storage."""

import os
from pathlib import Path

from .types import KnowledgeScope

GLOBAL_DIR = os.path.join(str(Path.home()), ".distill", "knowledge")
PROJECT_SUBDIR = ".distill"


def resolve_store_path(scope: KnowledgeScope, project_root: str | None = None) -> str:
    """Resolve the storage directory for a given scope."""
    if scope == "global":
        _ensure_dir(GLOBAL_DIR)
        return GLOBAL_DIR

    if not project_root:
        raise ValueError("project scope requires project_root")

    dir_path = os.path.join(project_root, PROJECT_SUBDIR, "knowledge")
    _ensure_dir(dir_path)
    return dir_path


def resolve_db_path(scope: KnowledgeScope, project_root: str | None = None) -> str:
    """Get the SQLite database path for a scope."""
    base = resolve_store_path(scope, project_root)
    return os.path.join(base, "metadata.db")


def detect_project_root(cwd: str | None = None) -> str | None:
    """Detect project root from CWD by looking for common markers."""
    dir_path = cwd or os.getcwd()
    markers = [".git", "pubspec.yaml", "package.json", "CLAUDE.md"]

    for marker in markers:
        if os.path.exists(os.path.join(dir_path, marker)):
            return dir_path

    return None


def _ensure_dir(dir_path: str) -> None:
    if not os.path.exists(dir_path):
        os.makedirs(dir_path, exist_ok=True)
