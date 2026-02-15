# Architecture

Distill is structured in four layers: **Store**, **Extractor**, **Tools**, and **Hooks**.

## Data Flow

```
Conversation (.jsonl)
       │
       ▼
  ┌─────────┐     ┌──────────────┐
  │ Parser   │────▶│  Extractor   │──── Anthropic API
  │ (.jsonl) │     │  (LLM call)  │
  └─────────┘     └──────┬───────┘
                          │
                    JSON array of
                   knowledge chunks
                          │
               ┌──────────┴──────────┐
               ▼                     ▼
        ┌────────────┐       ┌─────────────┐
        │ MetadataDB │       │ VectorStore │
        │  (SQLite)  │       │   (FTS5)    │
        └────────────┘       └─────────────┘
               │                     │
               └──────────┬──────────┘
                          ▼
                    ┌───────────┐
                    │ MCP Tools │
                    │ (5 tools) │
                    └───────────┘
```

## Layers

### Store (`src/store/`)

| File | Responsibility |
|------|---------------|
| `types.ts` | `KnowledgeChunk`, `KnowledgeInput`, type/scope/trigger enums |
| `scope.ts` | Resolve storage paths (global: `~/.distill/knowledge/`, project: `.distill/knowledge/`) |
| `metadata.ts` | `MetadataStore` — SQLite CRUD (insert, search, touch, delete, stats) |
| `vector.ts` | `VectorStore` — FTS5 full-text search with sanitized queries |

**SQLite Schema:**
- `knowledge` table with CHECK constraints on `type`, `scope`, `trigger`
- Indexes on `scope`, `type`, `project`
- FTS5 virtual table `knowledge_fts` for full-text search
- WAL journal mode for concurrent reads

### Extractor (`src/extractor/`)

| File | Responsibility |
|------|---------------|
| `parser.ts` | Parse `.jsonl` transcripts into user/assistant turn pairs |
| `prompts.ts` | System prompt (extraction criteria) and user prompt template |
| `extractor.ts` | Orchestrate: parse → format → truncate → LLM call → validate → return `KnowledgeInput[]` |

**Extraction model:** Claude Haiku (configurable)
**Max transcript size:** 100K characters (truncated from the beginning, keeping recent turns)

### Tools (`src/tools/`)

| Tool | Input | Behavior |
|------|-------|----------|
| `recall` | `query`, optional `type`/`scope` | FTS5 search both scopes, sort by confidence |
| `learn` | `transcript_path` | Extract + save to both stores |
| `profile` | none | Stats per scope (total, by type, most accessed) |
| `digest` | none | Duplicate detection (Jaccard > 0.7), stale entries |
| `memory` | `action`, `id` | Promote/demote/delete entries |

### Hooks (`src/hooks/`)

| File | Responsibility |
|------|---------------|
| `distill-hook.ts` | Handle `PreCompact` and `SessionEnd` Claude Code events |

Hooks receive JSON via stdin with `session_id`, `transcript_path`, `cwd`, and `hook_event_name`. They call `extractKnowledge()` and save results automatically.

## Storage Structure

```
~/.distill/knowledge/          # Global scope
├── metadata.db                # SQLite database
└── metadata.db-wal            # WAL file

<project>/.distill/knowledge/  # Project scope
├── metadata.db
└── metadata.db-wal
```

## Dependencies

| Package | Purpose |
|---------|---------|
| `@modelcontextprotocol/sdk` | MCP server implementation (official SDK) |
| `@anthropic-ai/sdk` | LLM API calls for knowledge extraction |
| `better-sqlite3` | SQLite with FTS5 support |
| `zod` | Input schema validation |
