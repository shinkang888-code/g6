# 로이고 보안 점검

- **체크리스트:** [CHECKLIST.md](./CHECKLIST.md) — 8개 카테고리 정기 점검 항목
- **검색 패턴:** [patterns.md](./patterns.md) — Grep/CI용 패턴 (fireauto 참조)
- **이식 보고서:** [../FIREAUTO_LAWYGO_이식_보고서.md](../FIREAUTO_LAWYGO_이식_보고서.md) — fireauto → 로이고 보안 이식 요약

## 이미 적용된 보안 조치 (보고서 기준)

1. **Rate Limiting** — `src/lib/rateLimit.ts`, Gemini·로그인·가입·비밀번호 재설정·엑셀 import
2. **보안 헤더** — `next.config.ts` (X-Frame-Options, X-Content-Type-Options, CSP, Referrer-Policy)
3. **Prompt Injection 완화** — Gemini `systemInstruction` / 사용자 입력 분리, 입력 길이 상한(32,000자)
4. **파일 업로드** — 회원 엑셀 import: 확장자 화이트리스트, 5MB 상한, 매직 바이트 검증

정기 점검 시 위 체크리스트와 패턴을 Cursor 또는 CI에서 실행해 누락 항목을 보완하면 됩니다.
