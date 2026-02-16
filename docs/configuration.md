# Configuration

## MCP Server Registration

Add to `~/.claude/mcp.json`:

```json
{
  "mcpServers": {
    "distill": {
      "command": "node",
      "args": ["/absolute/path/to/distill/build/server.js"]
    }
  }
}
```

Restart Claude Code after updating `mcp.json`.

> **No API key needed.** Distill uses MCP Sampling (`server.createMessage()`) which routes through your existing Claude subscription (Max, Teams, etc.).

## Config File

Config file: `.distill/config.json` (project) or `~/.distill/config.json` (global).
Project config overrides global. All fields are optional — Distill works with zero configuration.

```json
{
  "extraction_model": "claude-haiku-4-5-20251001",
  "crystallize_model": "claude-sonnet-4-5-20250929",
  "max_transcript_chars": 100000,
  "auto_crystallize_threshold": 0
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `extraction_model` | `claude-haiku-4-5-20251001` | Model hint for knowledge extraction (advisory — client decides) |
| `crystallize_model` | `claude-sonnet-4-5-20250929` | Model hint for crystallize (rule generation) |
| `max_transcript_chars` | `100000` | Max transcript size before truncation (keeps recent turns) |
| `auto_crystallize_threshold` | `0` (disabled) | Automatically crystallize after N new chunks since last crystallize |

### Per-Module Model Selection

Distill uses different models for different pipeline stages:

- **Extraction** (Haiku): Runs frequently on every `learn` call. Optimized for speed and cost.
- **Crystallize** (Sonnet): Runs infrequently when consolidating rules. Optimized for quality.

Model hints are advisory — they're passed via `modelPreferences.hints` in the MCP Sampling request. The client (Claude Code) decides which model actually runs.

## Hooks (Automatic Extraction)

Hooks enable automatic knowledge extraction across Claude Code sessions.

| Event | When | Hook Script | Purpose |
|-------|------|-------------|---------|
| `PreCompact` | Context window about to compress | `distill-hook.js` | Extract before history is lost |
| `SessionEnd` | Session ends | `distill-hook.js` | Final extraction pass |
| `SessionStart` | New session begins | `session-start-hook.js` | Auto-learn from previous session |

### How Hooks Work

1. **PreCompact/SessionEnd**: `distill-hook.ts` writes `~/.distill/pending-learn.json` with session info and outputs a prompt to stdout
2. **SessionStart**: `session-start-hook.ts` reads the pending file and returns `additionalContext` JSON, which Claude Code injects into the new session's context
3. Claude Code sees the learn prompt and calls the `learn` tool automatically

### Setup

Add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PreCompact": [
      {
        "type": "command",
        "command": "node /absolute/path/to/distill/build/hooks/distill-hook.js"
      }
    ],
    "SessionEnd": [
      {
        "type": "command",
        "command": "node /absolute/path/to/distill/build/hooks/distill-hook.js"
      }
    ],
    "SessionStart": [
      {
        "type": "command",
        "command": "node /absolute/path/to/distill/build/hooks/session-start-hook.js"
      }
    ]
  }
}
```

Update the paths to point to your Distill installation directory.

### Hook Input (PreCompact/SessionEnd)

Hooks receive JSON via stdin from Claude Code:

```json
{
  "session_id": "abc-123",
  "transcript_path": "/path/to/session.jsonl",
  "cwd": "/current/project/path",
  "hook_event_name": "PreCompact"
}
```

### Hook Output (SessionStart)

The SessionStart hook outputs JSON to stdout:

```json
{
  "additionalContext": "[Distill] Previous session has unprocessed knowledge.\nPlease run the `learn` tool..."
}
```

If no pending extraction exists (or the pending file is stale > 24h), the hook outputs nothing.

## Scope Directories

| Scope | Path | Created Automatically |
|-------|------|:---:|
| Global | `~/.distill/knowledge/` | Yes |
| Project | `<project-root>/.distill/knowledge/` | Yes |

**Project root detection** searches for these markers (in order):
1. `.git/`
2. `pubspec.yaml`
3. `package.json`
4. `CLAUDE.md`

Add `.distill/` to your project's `.gitignore` to avoid committing knowledge databases.
