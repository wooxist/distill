# HANDOFF.md
> 마지막 업데이트: 2026-02-15

## 현재 작업
Phase 1 구현 시작 전. ROADMAP.md의 Step 1부터 순서대로 진행.

## 완료 항목
- [x] TS MVP — 5개 MCP 도구 (learn, recall, profile, digest, memory)
- [x] SQLite + FTS5 저장소 (global/project 이중 스코프)
- [x] "oh-my" prefix 제거 → "distill"
- [x] 추출 기준 리디자인: 양방향 Decision Signals (correction, convergence, selection)
- [x] 한글 예제 제거, 의미 기반 감지 도입
- [x] ROADMAP.md 작성 (Phase 1/2/3)

## 다음 단계 (Phase 1: 룰 생성/진화)

- [ ] Step 1: 추출 프롬프트 맥락 보존
  - `src/extractor/prompts.ts` Rules 섹션 변경 — "content에 WHY 포함" 규칙 추가
  - `shared/prompts.md` SSOT 동기화
- [ ] Step 2: memory 도구에 crystallize action 추가
  - `src/tools/memory.ts` — action enum 확장 + crystallize 로직 (LLM → 룰 파일 생성)
  - `src/extractor/prompts.ts` — `CRYSTALLIZE_SYSTEM_PROMPT` 추가
  - `shared/prompts.md` SSOT 동기화
- [ ] Step 3: 충돌 감지
  - `src/store/types.ts` — KnowledgeType에 `"conflict"` 추가
  - `src/extractor/extractor.ts` — 기존 룰 파일 읽기 + 프롬프트에 `<existing_rules>` 주입
  - `src/extractor/prompts.ts` — conflict 추출 기준 추가
  - `src/tools/learn.ts` — conflict chunk 경고 메시지
  - `shared/prompts.md` SSOT 동기화
- [ ] Step 4: 검증 — `npm run build` + 실제 .jsonl로 E2E 테스트

## 중요 결정사항

| 결정 | 이유 |
|------|------|
| 개인 전용 우선 | 팀 공유 메커니즘은 복잡도 높음. Phase 3에서 확장 |
| Entire 연동 불필요 | `src/hooks/distill-hook.ts`가 이미 Claude Code 이벤트에서 독립 동작 |
| distill 룰만 충돌 감지 (Phase 1) | 사용자 전체 .claude/ 환경 인식은 Phase 2 |
| project scope 룰은 .gitignore | 개인 전용이므로 커밋하지 않음 |

## 참고 파일

| 파일 | 용도 |
|------|------|
| `src/extractor/prompts.ts` | 추출 시스템/유저 프롬프트 (Step 1, 2, 3 모두 수정) |
| `shared/prompts.md` | 프롬프트 SSOT (모든 프롬프트 변경 시 동기화) |
| `src/tools/memory.ts` | memory 도구 — crystallize action 추가 대상 |
| `src/extractor/extractor.ts` | 추출 파이프라인 — 룰 파일 읽기 + 주입 대상 |
| `src/store/types.ts` | 타입 정의 — conflict type 추가 대상 |
| `src/tools/learn.ts` | learn 도구 — conflict 경고 메시지 추가 대상 |
| `src/hooks/distill-hook.ts` | 자동 추출 hook (이미 완성, 수정 불필요) |
| `ROADMAP.md` | 전체 로드맵 (Phase 1/2/3 + 결정 로그) |

## 주의사항

- `shared/prompts.md`는 SSOT — `prompts.ts` 변경 시 반드시 동기화
- crystallize는 Anthropic API 호출 필요 (`ANTHROPIC_API_KEY` 환경변수)
- 룰 파일 경로: global → `~/.claude/rules/distill-{topic}.md`, project → `<project>/.claude/rules/distill-{topic}.md`
