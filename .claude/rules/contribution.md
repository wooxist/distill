# 기여 규칙

## 커밋

```yaml
format: "type(lang): message"
types: [feat, fix, refactor, docs, test, chore]
lang: [ts, python, dart, shared, root]
```

예시:
- `feat(python): add recall tool`
- `fix(ts): handle empty transcript`
- `docs(root): update CLAUDE.md`

## 기능 패리티

- 3개 언어는 동일한 5 MCP Tools를 제공해야 한다
- 새 tool 추가 시 3개 언어 모두 구현 후 커밋
- 추출 프롬프트 수정 시 `shared/prompts.md`만 수정 (SSOT)

## 빌드 확인

커밋 전 해당 언어 빌드 성공 확인:

```yaml
ts: cd ts && npx tsc
python: cd python && python -c "import src.server"
dart: cd dart && dart analyze
```

## 코드 스타일

| 언어 | 스타일 |
|------|--------|
| TypeScript | ESM, strict mode, explicit types |
| Python | PEP 8, type hints, dataclass |
| Dart | dart format, effective dart |

## 스코프 규칙

| 경로 | 스코프 |
|------|--------|
| `~/.distill/knowledge/` | global |
| `.distill/knowledge/` | project |
| `shared/` | 3개 언어 공유 (SSOT) |
