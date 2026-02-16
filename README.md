# Distill

> Automatically distill reusable knowledge from your Claude Code conversations.

Distill is an MCP (Model Context Protocol) server that analyzes your AI coding conversations and extracts patterns, preferences, decisions, and lessons learned — so Claude remembers what matters across sessions.

**No API key needed.** Distill uses MCP Sampling, which routes through your existing Claude subscription.

## How It Works

When you work with Claude Code, valuable knowledge emerges through conversation — corrections you make, patterns you establish, architectural decisions you commit to. Distill captures these automatically.

**Extraction signals** (ordered by confidence):

1. **Decision signals** — Any moment a direction was set: corrections (either party), convergence after discussion, or selection among alternatives
2. **Explicit preferences** — "always use X", "I prefer Y"
3. **Error resolutions** — An error occurred, root cause found, solution applied
4. **Accumulated patterns** — Repeated code/architecture patterns or consistent decision directions

Each extracted piece of knowledge is classified by type, scope, and confidence, then stored locally in SQLite with full-text search.

## Installation

### 1. Clone and build

```bash
git clone https://github.com/wooxist/distill.git
cd distill
npm install
npm run build
```

### 2. Register as MCP server

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

### 3. Enable automatic extraction (optional)

Add hooks to `~/.claude/settings.json` for automatic extraction on context compaction, session end, and session start. See [docs/configuration.md](docs/configuration.md) for the full hooks configuration.

## MCP Tools

| Tool | Description |
|------|-------------|
| `recall(query)` | Search your knowledge base by semantic query |
| `learn(transcript_path)` | Extract knowledge from a conversation transcript (auto-crystallize if threshold met) |
| `profile()` | View statistics about your accumulated knowledge |
| `digest()` | Find duplicate entries and analyze patterns |
| `memory(action, id)` | promote/demote/delete/crystallize knowledge entries |

### Usage Examples

**Search for knowledge:**
```
recall("how to handle authentication in this project")
```

**View your knowledge profile:**
```
profile()
```

**Manage knowledge scope:**
```
memory("promote", "chunk-id")      # project → global
memory("demote", "chunk-id")       # global → project
memory("delete", "chunk-id")       # remove entry
memory("crystallize")              # consolidate into rule files
```

## Knowledge Types

| Type | Description | Example |
|------|-------------|---------|
| `pattern` | Recurring code/architecture conventions | "Always use barrel exports in this project" |
| `preference` | Explicit user preferences | "Prefer functional style over class-based" |
| `decision` | Architectural or technology choices | "Chose SQLite over PostgreSQL for local storage" |
| `mistake` | Corrections and lessons learned | "Don't use `any` type — use `unknown` instead" |
| `workaround` | Bug workarounds and edge cases | "Library X has a bug with Y — use Z instead" |
| `conflict` | Contradictions with existing rules | "New pattern conflicts with distill-style.md rule #2" |

## Scope

Knowledge is stored in two scopes:

| Scope | Path | Purpose |
|-------|------|---------|
| `global` | `~/.distill/knowledge/` | Language/framework patterns (portable across projects) |
| `project` | `.distill/knowledge/` | Project-specific conventions and decisions |

Both scopes are searched simultaneously by `recall`. Use `memory("promote", id)` to move project knowledge to global scope.

## Configuration

See [docs/configuration.md](docs/configuration.md) for detailed setup instructions.

## Architecture

See [docs/architecture.md](docs/architecture.md) for technical details and system diagrams.

## Contributing

See [docs/development.md](docs/development.md) for development setup and guidelines.

## License

[MIT](LICENSE)
