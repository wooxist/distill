# Distill

> MCP server that extracts reusable knowledge from Claude Code conversations.

## Current Work

Phase 1 complete. See [ROADMAP.md](ROADMAP.md) for Phase 1.5 (Knowledge Routing) and Phase 2 planning.

## Build & Run

| Command | Action |
|---------|--------|
| `npm install` | Install dependencies |
| `npm run build` | Compile TypeScript |
| `npm run dev` | Watch mode |
| `npm test` | Run all tests (115 tests, node:test) |
| `node build/server.js` | Start MCP server |

## Architecture

```
src/config.ts              ← Config loader (.distill/config.json, per-module model)
src/store/                 ← SQLite metadata + FTS5 search
src/extractor/
├── parser.ts              ← .jsonl transcript parsing
├── prompts.ts             ← System + user prompt templates (extraction + crystallize)
├── extractor.ts           ← Orchestration + MCP sampling call (callLlm, extractKnowledge)
├── crystallize.ts         ← Consolidate chunks → distill-*.md rule files via MCP sampling
└── rules-reader.ts        ← Read existing distill-*.md from global + project scopes
src/tools/                 ← 5 MCP Tools (recall, learn, profile, digest, memory)
src/hooks/
├── pending-learn.ts       ← Shared types + PENDING_LEARN_PATH constant
├── distill-hook.ts        ← PreCompact/SessionEnd: writes pending-learn.json + prompt
└── session-start-hook.ts  ← SessionStart: reads pending-learn.json → additionalContext
shared/prompts.md          ← Extraction prompt SSOT (must sync with prompts.ts)
```

## Key Patterns

### MCP Sampling (no API key)

Distill does NOT use `@anthropic-ai/sdk` or `ANTHROPIC_API_KEY`. It uses MCP Sampling:
- `McpServer` (high-level) exposes `readonly server: Server` (low-level)
- `Server.createMessage()` asks the client (Claude Code) to make an LLM call
- Model selection is advisory via `modelPreferences.hints`
- Code accesses the raw server via `mcpServer.server` (see `src/server.ts`)

### Hook → Pending-Learn → SessionStart Flow

Hooks run outside the MCP server process and cannot call `server.createMessage()`.
Solution: file-based handoff via `~/.distill/pending-learn.json`.

1. PreCompact/SessionEnd hook → writes pending-learn.json
2. SessionStart hook → reads file, returns `{ "additionalContext": "..." }`
3. Claude Code auto-learns from previous session

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

- [Architecture](docs/architecture.md) — system diagrams (Mermaid), layer details
- [Configuration](docs/configuration.md) — MCP registration, config.json, hooks setup
- [Development](docs/development.md) — project structure, testing, conventions

## Rules

- [Contribution](.claude/rules/contribution.md)
