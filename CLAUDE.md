# Distill

> MCP server that extracts reusable knowledge from Claude Code conversations.

## Current Work

Phase 1 complete. See [ROADMAP.md](ROADMAP.md) for Phase 2 planning.

## Build & Run

| Command | Action |
|---------|--------|
| `npm install` | Install dependencies |
| `npm run build` | Compile TypeScript |
| `npm run dev` | Watch mode |
| `node build/server.js` | Start MCP server |

## Architecture

```
src/config.ts    ← Config loader (.distill/config.json, per-module model)
src/store/       ← SQLite metadata + FTS5 search
src/extractor/   ← .jsonl parsing + Anthropic API extraction + crystallize + rules reader
src/tools/       ← 5 MCP Tools (recall, learn, profile, digest, memory)
src/hooks/       ← PreCompact/SessionEnd event handlers
shared/          ← Extraction prompts (SSOT)
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `recall(query)` | Search knowledge by semantic query |
| `learn(transcript_path)` | Extract knowledge from transcript (auto-crystallize if threshold met) |
| `profile()` | Knowledge statistics |
| `digest()` | Duplicate detection + stale analysis |
| `memory(action, id?)` | promote/demote/delete/crystallize |

## Configuration

Config file: `.distill/config.json` (project) or `~/.distill/config.json` (global).
Project config overrides global. All fields optional (zero-config).

```json
{
  "extraction_model": "claude-haiku-4-5-20251001",
  "crystallize_model": "claude-sonnet-4-5-20250929",
  "max_transcript_chars": 100000,
  "auto_crystallize_threshold": 0
}
```

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
