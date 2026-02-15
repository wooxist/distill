# Distill

> 대화에서 지식을 증류하는 MCP 플러그인

## 프로젝트 구조

| 폴더 | 역할 |
|------|------|
| `ts/` | TypeScript 구현 |
| `python/` | Python 구현 |
| `dart/` | Dart 구현 |
| `shared/` | 공유 리소스 (추출 프롬프트 SSOT) |

## 빌드 & 실행

| 언어 | 빌드 | 실행 |
|------|------|------|
| TypeScript | `cd ts && npm install && npm run build` | `node ts/build/server.js` |
| Python | `cd python && pip install -r requirements.txt` | `python python/src/server.py` |
| Dart | `cd dart && dart pub get` | `dart run dart/bin/server.dart` |

## 아키텍처

```
shared/prompts.md          ← 추출 프롬프트 (SSOT, 3개 언어 공유)
{lang}/store/              ← SQLite 메타데이터 + FTS5 검색
{lang}/extractor/          ← .jsonl 파싱 + Anthropic API 호출
{lang}/tools/              ← 5 MCP Tools (recall, learn, profile, digest, memory)
```

## MCP Tools

| Tool | 설명 |
|------|------|
| `recall(query)` | 시맨틱 지식 검색 |
| `learn(transcript_path)` | 트랜스크립트에서 수동 추출 |
| `profile()` | 축적된 지식 통계 |
| `digest()` | 중복 감지 + 패턴 분석 |
| `memory(action, id)` | 승격/강등/삭제 |

## 스코프

| 스코프 | 경로 | 용도 |
|--------|------|------|
| global | `~/.distill/knowledge/` | 언어/프레임워크 일반 패턴 |
| project | `.distill/knowledge/` | 프로젝트 특화 지식 |

## Rules

→ [.claude/rules/contribution.md](.claude/rules/contribution.md)
