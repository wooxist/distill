# Configuration

## API Key

Distill requires an Anthropic API key for knowledge extraction:

```bash
export ANTHROPIC_API_KEY="your-api-key"
```

Add this to your shell profile (`~/.zshrc`, `~/.bashrc`) for persistence.

**Note:** The API key is only used during extraction (`learn` tool or hook triggers). The `recall`, `profile`, `digest`, and `memory` tools work entirely offline.

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

## Hooks (Automatic Extraction)

Hooks enable automatic knowledge extraction on two Claude Code events:

| Event | When | Purpose |
|-------|------|---------|
| `PreCompact` | Context window is about to be compressed | Extract knowledge before conversation history is lost |
| `SessionEnd` | Claude Code session ends | Final extraction pass |

### Setup

1. Copy the hooks configuration:

```bash
cp hooks/hooks.json ~/.claude/hooks.json
```

2. Edit `~/.claude/hooks.json` and update the paths:

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
    ]
  }
}
```

### Hook Input

Hooks receive JSON via stdin from Claude Code:

```json
{
  "session_id": "abc-123",
  "transcript_path": "/path/to/session.jsonl",
  "cwd": "/current/project/path",
  "hook_event_name": "PreCompact"
}
```

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

## Extraction Model

The default extraction model is `claude-haiku-4-5-20251001`. To use a different model, modify `src/extractor/extractor.ts`:

```typescript
const response = await client.messages.create({
  model: "claude-haiku-4-5-20251001",  // Change this
  // ...
});
```

Rebuild after changes: `npm run build`
