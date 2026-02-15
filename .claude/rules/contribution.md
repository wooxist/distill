# Contribution Rules

## Commit

```yaml
format: "type(scope): message"
types: [feat, fix, refactor, docs, test, chore]
```

Examples:
- `feat(tools): add tag filtering to recall`
- `fix(extractor): handle empty transcript`
- `docs: update configuration guide`

## Build Check

Build must pass before commit:

```bash
npm run build
```

## Code Style

- ESM modules, TypeScript strict mode, explicit types
- No default exports

## Prompt Changes

Extraction prompt SSOT: `shared/prompts.md`
Inline prompts in `src/extractor/prompts.ts` must stay in sync.
