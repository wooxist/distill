# Oh My Distill

> Automatically distill reusable knowledge from your Claude Code conversations.

Oh My Distill is an MCP (Model Context Protocol) server that analyzes your AI coding conversations and extracts patterns, preferences, decisions, and lessons learned — so Claude remembers what matters across sessions.

## How It Works

When you work with Claude Code, valuable knowledge emerges through conversation — corrections you make, patterns you establish, architectural decisions you commit to. Oh My Distill captures these automatically.

**Extraction signals** (ordered by confidence):

1. **Corrections** — You said "no, that's wrong" and a correct conclusion was reached
2. **Explicit preferences** — "always use X", "I prefer Y"
3. **Error resolutions** — An error occurred, root cause found, solution applied
4. **Repeated patterns** — Code or architecture patterns appearing multiple times
5. **Architectural decisions** — Technology choices, structural conventions

Each extracted piece of knowledge is classified by type, scope, and confidence, then stored locally in SQLite with full-text search.

## Installation

### 1. Clone and build

```bash
git clone https://github.com/your-username/oh-my-distill.git
cd oh-my-distill
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
      "args": ["/absolute/path/to/oh-my-distill/build/server.js"]
    }
  }
}
```

### 3. Set up API key

Oh My Distill uses the Anthropic API for knowledge extraction:

```bash
export ANTHROPIC_API_KEY="your-api-key"
```

### 4. Enable automatic extraction (optional)

Copy the hooks configuration to enable extraction on context compaction and session end:

```bash
cp hooks/hooks.json ~/.claude/hooks.json
```

Edit the paths in `hooks.json` to point to your installation directory.

## MCP Tools

| Tool | Description |
|------|-------------|
| `recall(query)` | Search your knowledge base by semantic query |
| `learn(transcript_path)` | Manually extract knowledge from a conversation transcript |
| `profile()` | View statistics about your accumulated knowledge |
| `digest()` | Find duplicate entries and analyze patterns |
| `memory(action, id)` | Promote, demote, or delete knowledge entries |

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
memory("promote", "chunk-id")   # project → global
memory("demote", "chunk-id")    # global → project
memory("delete", "chunk-id")    # remove entry
```

## Knowledge Types

| Type | Description | Example |
|------|-------------|---------|
| `pattern` | Recurring code/architecture conventions | "Always use barrel exports in this project" |
| `preference` | Explicit user preferences | "Prefer functional style over class-based" |
| `decision` | Architectural or technology choices | "Chose SQLite over PostgreSQL for local storage" |
| `mistake` | Corrections and lessons learned | "Don't use `any` type — use `unknown` instead" |
| `workaround` | Bug workarounds and edge cases | "Library X has a bug with Y — use Z instead" |

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

See [docs/architecture.md](docs/architecture.md) for technical details.

## Contributing

See [docs/development.md](docs/development.md) for development setup and guidelines.

## License

[MIT](LICENSE)
