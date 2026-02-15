---
name: add-language
version: "1.0"
category: setup
type: composite
metadata:
  triggers:
    - 새 언어 추가
    - 언어 구현 추가
  uses: []
---

# add-language

새로운 프로그래밍 언어로 Distill MCP 서버를 구현한다.

## 사전 조건

- [ ] 해당 언어의 MCP SDK가 존재하는가?
- [ ] 해당 언어의 SQLite 바인딩이 존재하는가?
- [ ] 해당 언어의 HTTP 클라이언트가 존재하는가?

## 절차

### Step 1: 디렉토리 생성

```yaml
path: "{lang}/"
structure:
  - "{lang}/src/" 또는 "{lang}/lib/"
  - store/ (types, metadata, vector, scope)
  - extractor/ (parser, prompts, extractor)
  - tools/ (recall, learn, profile, digest, memory)
```

### Step 2: 기존 구현 참고

```yaml
reference: ts/src/
action: 모든 파일을 읽고 로직을 1:1 포팅
```

### Step 3: 프롬프트 로드

```yaml
source: shared/prompts.md
action: System Prompt와 User Prompt Template을 파싱하여 사용
```

### Step 4: 빌드 검증

```yaml
action: 해당 언어의 빌드/분석 도구로 에러 0 확인
```

### Step 5: MCP 서버 테스트

```yaml
action: |
  JSON-RPC initialize 요청 → 응답 확인
  tools/list 요청 → 5개 tool 등록 확인
```

### Step 6: CLAUDE.md 업데이트

```yaml
action: |
  빌드 & 실행 테이블에 새 언어 행 추가
  contribution.md의 lang 목록에 추가
```
