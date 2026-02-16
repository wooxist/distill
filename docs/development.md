# Development

## Prerequisites

- Node.js 18+
- npm

## Setup

```bash
git clone https://github.com/wooxist/distill.git
cd distill
npm install
```

## Build

```bash
npm run build        # Compile TypeScript
npm run dev          # Watch mode (auto-rebuild on changes)
```

## Test

```bash
npm test             # Run all tests (115 tests)
```

Tests use `node:test` (Node.js native test runner) with `tsx/esm` for TypeScript support.

## Project Structure

```
src/
├── server.ts                # MCP server entry point
├── config.ts                # Config loader (.distill/config.json)
├── tools/                   # 5 MCP tool implementations
│   ├── recall.ts            # Knowledge search
│   ├── learn.ts             # Extraction + auto-crystallize
│   ├── profile.ts           # Statistics
│   ├── digest.ts            # Duplicate detection
│   └── memory.ts            # Promote/demote/delete/crystallize
├── extractor/               # Knowledge extraction pipeline
│   ├── parser.ts            # .jsonl transcript parsing
│   ├── prompts.ts           # LLM prompts (extraction + crystallize)
│   ├── extractor.ts         # Orchestration + MCP sampling call
│   ├── crystallize.ts       # Rule file generation via MCP sampling
│   └── rules-reader.ts      # Read existing distill-*.md rules
├── store/                   # Storage layer
│   ├── types.ts             # Type definitions
│   ├── scope.ts             # Path resolution
│   ├── metadata.ts          # SQLite CRUD + meta key-value
│   └── vector.ts            # FTS5 search
└── hooks/
    ├── pending-learn.ts     # Shared types (PendingLearn, path constants)
    ├── distill-hook.ts      # PreCompact/SessionEnd handler
    └── session-start-hook.ts # SessionStart handler
shared/
└── prompts.md               # Prompt SSOT (must sync with prompts.ts)
tests/
├── helpers/
│   ├── factories.ts         # Test data factories
│   └── mock-server.ts       # Duck-typed MCP Server mock
├── fixtures/
│   └── transcript-basic.jsonl
├── config.test.ts           # Config loading tests
├── extractor.test.ts        # callLlm + parseExtractionResponse tests
├── extract-knowledge.test.ts # extractKnowledge integration tests
├── crystallize.test.ts      # parseCrystallizeResponse + crystallize tests
├── parser.test.ts           # Transcript parsing tests
├── rules-reader.test.ts     # Rules reader tests
├── metadata.test.ts         # SQLite CRUD tests
├── vector.test.ts           # FTS5 search tests
├── distill-hook.test.ts     # PreCompact/SessionEnd hook tests
├── session-start-hook.test.ts # SessionStart hook tests
└── e2e-pipeline.ts          # Mock-only E2E pipeline test
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

## Pull Request Guidelines

1. Build must pass (`npm run build` with zero errors)
2. Tests must pass (`npm test` with zero failures)
3. One purpose per PR
4. Update docs if behavior changes
