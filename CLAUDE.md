# Distill

> MCP server that extracts reusable knowledge from Claude Code conversations.

## Build & Run

| Command | Action |
|---------|--------|
| `npm install` | Install dependencies |
| `npm run build` | Compile TypeScript |
| `npm run dev` | Watch mode |
| `node build/server.js` | Start MCP server |

## Architecture

```
src/store/       ← SQLite metadata + FTS5 search
src/extractor/   ← .jsonl parsing + Anthropic API extraction
src/tools/       ← 5 MCP Tools (recall, learn, profile, digest, memory)
src/hooks/       ← PreCompact/SessionEnd event handlers
shared/          ← Extraction prompts
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `recall(query)` | Search knowledge by semantic query |
| `learn(transcript_path)` | Extract knowledge from transcript |
| `profile()` | Knowledge statistics |
| `digest()` | Duplicate detection + stale analysis |
| `memory(action, id)` | Promote/demote/delete entries |

## Scope

| Scope | Path |
|-------|------|
| global | `~/.distill/knowledge/` |
| project | `.distill/knowledge/` |

## Docs

- [Architecture](docs/architecture.md)
- [Configuration](docs/configuration.md)
- [Development](docs/development.md)

## Rules

- [Contribution](.claude/rules/contribution.md)
