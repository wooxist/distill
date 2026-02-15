"""Load extraction prompts from shared/prompts.md (SSOT)."""

import os
import re

_PROMPTS_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "..", "shared", "prompts.md"
)

_system_prompt: str | None = None
_user_template: str | None = None


def _load_prompts() -> None:
    """Parse shared/prompts.md and extract system prompt and user template."""
    global _system_prompt, _user_template

    prompts_path = os.path.normpath(_PROMPTS_PATH)
    with open(prompts_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Extract code blocks after "## System Prompt" and "## User Prompt Template"
    blocks = re.findall(r"```\n(.*?)```", content, re.DOTALL)
    if len(blocks) >= 2:
        _system_prompt = blocks[0].strip()
        _user_template = blocks[1].strip()
    else:
        raise RuntimeError(f"Failed to parse prompts from {prompts_path}")


def get_system_prompt() -> str:
    """Get the extraction system prompt."""
    if _system_prompt is None:
        _load_prompts()
    assert _system_prompt is not None
    return _system_prompt


def get_user_template() -> str:
    """Get the user prompt template."""
    if _user_template is None:
        _load_prompts()
    assert _user_template is not None
    return _user_template


def build_extraction_prompt(
    formatted_transcript: str, project_name: str | None = None
) -> str:
    """Build the user prompt with the actual transcript."""
    template = get_user_template()

    project_context = (
        f'\n\nProject context: "{project_name}"' if project_name else ""
    )

    result = template.replace("{{PROJECT_CONTEXT}}", project_context)
    result = result.replace("{{TRANSCRIPT}}", formatted_transcript)
    return result
