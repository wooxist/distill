# Development

## Prerequisites

- Node.js 18+
- npm

## Setup

```bash
git clone https://github.com/your-username/distill.git
cd distill
npm install
```

## Build

```bash
npm run build        # Compile TypeScript
npm run dev          # Watch mode (auto-rebuild on changes)
```

## Project Structure

```
src/
├── server.ts            # MCP server entry point
├── tools/               # 5 MCP tool implementations
│   ├── recall.ts        # Knowledge search
│   ├── learn.ts         # Manual extraction
│   ├── profile.ts       # Statistics
│   ├── digest.ts        # Duplicate detection
│   └── memory.ts        # Promote/demote/delete
├── extractor/           # Knowledge extraction pipeline
│   ├── parser.ts        # .jsonl transcript parsing
│   ├── prompts.ts       # LLM prompts
│   └── extractor.ts     # Orchestration + API call
├── store/               # Storage layer
│   ├── types.ts         # Type definitions
│   ├── scope.ts         # Path resolution
│   ├── metadata.ts      # SQLite CRUD
│   └── vector.ts        # FTS5 search
└── hooks/
    └── distill-hook.ts  # Claude Code event handler
```

## Code Style

- ESM modules (`"type": "module"` in package.json)
- TypeScript strict mode
- Explicit type annotations
- No default exports

## Commit Convention

```
type(scope): message
```

| Type | Usage |
|------|-------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code restructuring |
| `docs` | Documentation |
| `test` | Tests |
| `chore` | Build, config, dependencies |

Examples:
- `feat(tools): add tag filtering to recall`
- `fix(extractor): handle empty transcript`
- `docs: update configuration guide`

## Testing

Verify the MCP server starts and responds:

```bash
npm run build
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node build/server.js
```

Verify tools are registered:

```bash
echo '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | node build/server.js
```

## Pull Request Guidelines

1. Build must pass (`npm run build` with zero errors)
2. One purpose per PR
3. Update docs if behavior changes
4. Test MCP server initialization before submitting
