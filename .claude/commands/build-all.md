# /build-all

전체 언어 빌드 및 검증을 실행한다.

## 절차

1. TypeScript 빌드
```bash
cd ts && npx tsc
```

2. Python import 검증
```bash
cd python && python -c "import src.server"
```

3. Dart 분석
```bash
cd dart && dart pub get && dart analyze
```

4. 결과 요약 출력
