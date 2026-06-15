# 로이고(lawygo) 정기 보안 감사 체크리스트

fireauto security-guard 8개 카테고리 기준. Cursor/CI 또는 수동 점검 시 사용.

---

## CAT-1: 환경변수/시크릿 노출

- [ ] `.env`, `.env.local`, `.env.production` 이 `.gitignore`에 포함되어 있는지
- [ ] 소스코드 내 하드코딩된 API 키·시크릿 검색 (`sk-`, `password\s*=`, `secret\s*=`, `ghp_` 등)
- [ ] `NEXT_PUBLIC_` 접두사로 서버 전용 시크릿이 노출되지 않는지 (예: `NEXT_PUBLIC_SUPABASE_SERVICE`)
- [ ] `getSupabaseAdmin` / `createClient(.*service_role)` 이 API 라우트 내부에서만 사용되는지 (클라이언트 번들 제외)

**심각도:** CRITICAL

---

## CAT-2: 인증/인가

- [ ] `app/api/**/route.ts` 모든 민감 API에서 `getSession` 또는 동등한 인증 체크 존재 여부
- [ ] admin 전용 라우트(`/api/admin/*`)에서 세션·권한 검증 여부
- [ ] middleware가 보호해야 할 경로(`/api/`, `/admin/` 등)를 matcher에 포함하는지 (해당 시)

**심각도:** CRITICAL

---

## CAT-3: Rate Limiting

- [ ] `/api/ai/gemini` POST에 rate limit 적용 여부
- [ ] `/api/auth/login`, `/api/auth/signup`, `/api/auth/password-reset` 에 rate limit 적용 여부
- [ ] `/api/admin/members/import-excel` 에 rate limit 적용 여부

**심각도:** HIGH  
**참고:** 로이고는 `src/lib/rateLimit.ts` 로 인메모리 제한 적용됨. 프로덕션 다중 인스턴스 시 Upstash 등 외부 저장소 권장.

---

## CAT-4: 파일 업로드

- [ ] 업로드 엔드포인트에서 **서버 측** 확장자·MIME/매직 바이트 검증 여부
- [ ] 파일 크기 상한 설정 여부 (회원 엑셀 import: 5MB 등)
- [ ] 위험 확장자 차단 (.exe, .sh, .php, .svg+script 등)
- [ ] 업로드 파일명 살균 (경로 탐색 `../` 방지)

**심각도:** HIGH

---

## CAT-5: 스토리지 보안

- [ ] Supabase Storage 퍼블릭 버킷에 민감 파일 저장 여부
- [ ] 민감 파일은 서명된 URL(signed URL) 사용 여부
- [ ] 스토리지 RLS 정책 존재 여부

**심각도:** MEDIUM~HIGH

---

## CAT-6: Prompt Injection

- [ ] AI(Gemini) 호출 시 시스템 지시와 사용자 입력이 **역할 분리**되어 있는지 (systemInstruction vs contents)
- [ ] 사용자 입력 길이 상한 적용 여부
- [ ] AI 응답이 코드 실행·SQL 등에 직접 사용되지 않는지

**심각도:** MEDIUM

---

## CAT-7: 정보 노출

- [ ] API 에러 응답에 스택 트레이스·내부 경로 노출 여부
- [ ] `next.config` 에 보안 헤더 설정 여부 (X-Frame-Options, X-Content-Type-Options, CSP, Referrer-Policy)
- [ ] 프로덕션에서 디버그 모드·상세 에러 비활성화 여부

**심각도:** MEDIUM

---

## CAT-8: 의존성 취약점

- [ ] `npm audit` 실행 후 critical/high 취약점 개수 확인
- [ ] `package-lock.json` (또는 lock 파일) 존재 여부
- [ ] 주요 보안 관련 패키지 버전이 알려진 CVE 대응 버전인지

**실행 예:** `npm audit --json 2>/dev/null | head -100`

**심각도:** LOW~HIGH

---

## 점검 주기 권장

- **CAT-1, CAT-2:** 커밋 전 또는 PR 시 점검
- **CAT-3~CAT-7:** 스프린트별 또는 월 1회
- **CAT-8:** `npm audit` CI 단계 또는 주 1회

검색 패턴 상세: [patterns.md](./patterns.md)
