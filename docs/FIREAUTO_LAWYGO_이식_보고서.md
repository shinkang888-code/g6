# fireauto 리포지토리 학습 및 로이고(lawygo) 이식 가능성 보고서

**대상 리포:** [shinkang888-code/fireauto](https://github.com/shinkang888-code/fireauto)  
**작성 목적:** fireauto의 모든 파일을 학습하고, 로이고 프로젝트에 추천·이식할 만한 기능(특히 보안)을 정리한 보고서.

---

## 1. fireauto 리포지토리 개요

### 1.1 구조

| 경로 | 설명 |
|------|------|
| `.claude-plugin/marketplace.json` | Claude Code 플러그인 마켓플레이스 정의 |
| `plugin/.claude-plugin/plugin.json` | 플러그인 메타데이터 및 커맨드 등록 |
| `plugin/commands/` | 사용자 호출 커맨드 정의 (md 기반) |
| `plugin/agents/` | 에이전트 역할 정의 (보안·SEO·리서치·팀 등) |
| `plugin/skills/` | 스킬(방법론) + references (검색 패턴·수정 가이드) |
| `plugin/hooks/` | 훅 설정 및 stop-hook 스크립트 |
| `plugin/scripts/` | loop 등 부가 스크립트 |

### 1.2 제공 기능 요약

| 커맨드 | 역할 | 로이고 추천도 |
|--------|------|----------------|
| **/security-guard** | 코드 보안 8개 카테고리 점검 | ★★★★★ **최우선** |
| **/seo-manager** | SEO 7개 영역 점검 (robots, sitemap, 메타, JSON-LD 등) | ★★★ (대외 공개 페이지 있을 때) |
| /planner | 아이디어 → PRD 문서 | ★ (기획 단계 참고) |
| /researcher | 레딧 리서치·리드 스코어링 | ★ (사업용) |
| /uiux-upgrade | UI/UX 8개 카테고리 감사·자동 수정 | ★★ (개선 시) |
| /designer | DaisyUI 빌드·마이그레이션 | - (로이고는 shadcn/ui 사용) |
| /team, /loop, /video-maker 등 | 팀 에이전트·반복 실행·영상 | 참고용 |

---

## 2. 보안 기능 상세 (이식 최우선)

### 2.1 fireauto 보안 감사 8개 카테고리

fireauto의 **security-guard**는 아래 8개 카테고리로 점검하며,  
실제 SaaS에서 발견된 18개 취약점 패턴을 반영해 설계되어 있음.

| 카테고리 | 점검 내용 | 심각도 |
|----------|-----------|--------|
| **1. 환경변수/시크릿 노출** | .env git 추적, 하드코딩 키, NEXT_PUBLIC_ 오용, service_role 클라이언트 노출 | CRITICAL |
| **2. 인증/인가** | API 라우트 세션 체크 누락, admin 전용 권한 검증, RLS 우회, middleware 보호 범위 | CRITICAL |
| **3. Rate Limiting** | AI·비용 발생·로그인/가입 엔드포인트 rate limit 적용 여부 | HIGH |
| **4. 파일 업로드** | MIME 서버 검증, 크기 제한, 위험 확장자 차단, 파일명 살균 | HIGH |
| **5. 스토리지 보안** | 퍼블릭 버킷, 서명 URL 사용, RLS 정책 | MEDIUM~HIGH |
| **6. Prompt Injection** | 사용자 입력 직접 삽입, 시스템/사용자 메시지 분리, AI 응답 후처리 | MEDIUM |
| **7. 정보 노출** | 에러 스택 노출, CSP·보안 헤더, API 과다 정보 | MEDIUM |
| **8. 의존성 취약점** | npm audit, CVE, lock 파일 | LOW~HIGH |

### 2.2 로이고 현재 상태와 이식 가능 부분

#### (1) 시크릿 노출 (CAT-1)

- **로이고 현황:** `.gitignore`에 `.env*` 포함됨. API 키는 `process.env` 사용. `getSupabaseAdmin`은 서버 전용.
- **이식:** “정기 점검”용 체크리스트로 활용 가능.  
  - 예: `Grep "NEXT_PUBLIC_.*SERVICE\|sk-\|password\s*="` 등 fireauto의 patterns.md 패턴을 로이고 루트에서 주기 실행해 커밋 전 확인.

#### (2) 인증/인가 (CAT-2)

- **로이고 현황:** 대부분 API에서 `getSession()` 사용. admin 라우트는 세션 기반으로 보호.
- **이식:**  
  - “인증 없는 API 라우트” 자동 탐지 스크립트:  
    `app/api/**/route.ts` 목록 수집 후 각 파일에서 `getSession|getUser|auth()` 등 검색해 누락 라우트 리스트 생성.  
  - fireauto의 `security-guard.md` / `security-auditor.md` 절차를 그대로 Cursor/CI용 체크리스트로 복사해 사용 가능.

#### (3) Rate Limiting (CAT-3) — **코드 이식 권장**

- **로이고 현황:** **rate limit 미적용.**  
  - `/api/ai/gemini` (비용·남용 위험),  
  - `/api/auth/login`, `/api/auth/signup`, `/api/auth/password-reset` (브루트포스),  
  - `/api/admin/members/import-excel` (대량 요청) 등이 무제한 호출 가능.
- **이식 방안:**  
  - fireauto는 “점검”만 하지만, **로이고에 직접 적용**할 항목으로 추천.  
  - Upstash Redis 기반 `@upstash/ratelimit` 또는 Next.js middleware에서 메모리/파일 기반 제한 도입.  
  - 우선순위: Gemini API → 로그인/가입/비밀번호 재설정 → 엑셀 import.

#### (4) 파일 업로드 (CAT-4)

- **로이고 현황:** 회원 엑셀 import에서 `.xlsx`/`.xls`만 허용, 확장자 검증 있음. MIME/매직바이트 검증·파일 크기 상한은 없음.
- **이식:**  
  - fireauto의 “MIME 서버 검증, 크기 제한, 화이트리스트” 항목을 **로이고 import-excel API에 반영** 가능.  
  - 예: `file.size` 상한(예: 5MB), `formData`의 file type을 서버에서 한 번 더 검증.

#### (5) 스토리지 보안 (CAT-5)

- **로이고 현황:** Supabase Storage 사용 여부에 따라 상이. 퍼블릭 버킷·서명 URL 사용 여부는 코드베이스 추가 확인 필요.
- **이식:** fireauto의 “퍼블릭 버킷, getPublicUrl vs createSignedUrl” 체크리스트를 그대로 적용해 정기 점검.

#### (6) Prompt Injection (CAT-6)

- **로이고 현황:** Gemini 라우트에서 `systemHint`와 `promptStr`을 하나의 `user` 메시지로 합쳐 전송. 사용자 입력이 곧바로 프롬프트에 포함됨.
- **이식:**  
  - fireauto 권장처럼 “시스템 메시지”와 “사용자 메시지”를 **역할 분리** (system / user)하여 API에 전달.  
  - 선택: 입력 길이 상한, 간단한 지시어 필터(예: “ignore previous” 등) 추가.

#### (7) 정보 노출 (CAT-7)

- **로이고 현황:** `next.config`에 보안 헤더(CSP, X-Frame-Options 등) 미설정. 에러 응답은 대부분 메시지만 반환하나, 일부 `detail` 등으로 상세 노출 가능성 있음.
- **이식:**  
  - fireauto의 “CSP, X-Frame-Options, X-Content-Type-Options” 체크리스트 적용.  
  - `next.config.ts`에 `headers()` 추가해 보안 헤더 설정하는 것을 **직접 이식** 권장.

#### (8) 의존성 (CAT-8)

- **이식:** CI 또는 로컬에서 `npm audit` 실행해 critical/high 수를 리포트에 포함. fireauto와 동일한 판정 기준 사용 가능.

---

## 3. 이식 방식 제안

### 3.1 “도구로만 쓰기” (플러그인/수동 점검)

- **대상:** fireauto 전체를 “학습·참고”만 하고, 로이고 코드는 그대로 두는 경우.
- **방법:**  
  - Claude Code에 fireauto 설치 후 `/security-guard` 실행 → 생성되는 `SECURITY_AUDIT.md` 형식을 로이고용으로 저장.  
  - 또는 fireauto의 `plugin/commands/security-guard.md`, `plugin/agents/security-auditor.md`, `plugin/skills/fireauto-secure/references/patterns.md` 내용을 복사해 로이고 `docs/security/` 등에 “보안 점검 매뉴얼”로 보관하고, Cursor/개발자에게 정기 점검용으로 사용.

### 3.2 “로이고 코드에 반영” (실제 이식)

| 순위 | 항목 | 이식 내용 | 난이도 |
|------|------|-----------|--------|
| 1 | Rate Limiting | AI(Gemini)·로그인·가입·비밀번호 재설정·엑셀 import에 rate limit 도입 | 중 |
| 2 | 보안 헤더 | next.config에 CSP, X-Frame-Options, X-Content-Type-Options 등 추가 | 낮음 |
| 3 | Prompt Injection 완화 | Gemini API에서 system / user 메시지 분리, 입력 길이 제한 | 낮음 |
| 4 | 파일 업로드 강화 | import-excel에 서버측 MIME·크기 제한·화이트리스트 적용 | 낮음 |
| 5 | 정기 감사 | fireauto 스타일의 8개 카테고리 체크리스트를 스크립트 또는 CI로 주기 실행 | 중 |

### 3.3 참고할 fireauto 파일 목록 (보안)

- `plugin/commands/security-guard.md` — 실행 절차, 8단계, 리포트 형식.
- `plugin/agents/security-auditor.md` — 카테고리별 검색 대상·판정 기준.
- `plugin/skills/fireauto-secure/SKILL.md` — 보안 감사 방법론 요약.
- `plugin/skills/fireauto-secure/references/patterns.md` — Grep/Glob 패턴과 판정 기준.

위 파일들을 로이고 `docs/security/` 또는 `.cursor/rules/`에 요약해 두면, “fireauto 방식의 보안 점검”을 그대로 재현할 수 있음.

---

## 4. SEO·UI 관련 (참고)

- **SEO:** 공개용 랜딩·정보 페이지가 있으면 `seo-manager.md`의 7개 영역(robots, sitemap, JSON-LD, 메타, pSEO, 리다이렉트, 성능)을 점검용 체크리스트로 도입 가능. 로이고가 내부 법무 도구 위주라면 우선순위는 낮음.
- **UI/UX:** fireauto의 `/uiux-upgrade`는 8개 카테고리(다크모드, 반응형, 접근성 등) 감사. 로이고는 shadcn/ui 사용이므로 “DaisyUI 마이그레이션”은 해당 없고, “감사 항목”만 참고 가능.

---

## 5. 요약 및 다음 단계

- **fireauto**는 Claude Code 플러그인으로, **보안(security-guard)** 기능이 로이고에 가장 잘 맞고, 실제 코드 이식·정기 점검 모두에 활용 가능.
- **즉시 이식 권장:**  
  1) **Rate Limiting** (Gemini, auth, import-excel),  
  2) **보안 헤더** (next.config),  
  3) **Prompt 구조 개선** (Gemini system/user 분리),  
  4) **엑셀 업로드** 서버 검증 강화.
- **점검용 이식:** fireauto의 보안 8카테고리 절차·패턴을 `docs/security/` 또는 Cursor 규칙으로 복사해 정기 보안 감사에 사용.

이 보고서는 [fireauto](https://github.com/shinkang888-code/fireauto) 리포지토리의 구조와 보안·SEO·기타 기능을 학습한 뒤, 로이고 프로젝트에 한정해 추천·이식 가능한 부분을 정리한 내용입니다.
