# 보안 감사 검색 패턴 (fireauto 참조)

로이고 코드베이스에서 아래 패턴으로 점검 시 사용. `rg`(ripgrep) 또는 IDE 검색.

---

## CAT-1: 시크릿 노출

```bash
# .env 파일이 git에 추적되는지
git ls-files .env*

# 하드코딩 시크릿 패턴 (소스에서)
# Grep: "sk-", "sk_live", "sk_test", "AKIA", "ghp_"
# Grep: password\s*=\s*['\"], secret\s*=\s*['\"]
# Grep: NEXT_PUBLIC_.*KEY, NEXT_PUBLIC_.*SECRET, NEXT_PUBLIC_SUPABASE_SERVICE
```

**판정:** .env가 git에 있거나, API 키가 소스에 있으면 CRITICAL.

---

## CAT-2: 인증/인가

```bash
# API 라우트 목록
# Glob: src/app/api/**/route.ts

# 각 라우트에서 인증 함수 존재 여부
# Grep: getSession, getUser, auth(), cookies(), getServerSession
# Grep: supabaseAdmin, createServiceRoleClient (위치는 API 라우트 내부여야 함)
```

**판정:** 민감 API에 인증 없음 → CRITICAL; admin 라우트 권한 검증 누락 → HIGH.

---

## CAT-3: Rate Limiting

```bash
# Rate limit 사용 여부
# Grep: ratelimit, rateLimiter, RateLimit, checkRateLimit

# AI 호출 위치
# Grep: openai, anthropic, gemini, generativelanguage

# 인증 관련
# Grep: auth/login, auth/signup, auth/password-reset
```

**판정:** AI·auth 엔드포인트에 rate limit 없음 → HIGH.

---

## CAT-4: 파일 업로드

```bash
# 업로드 처리
# Grep: formData, multipart, upload, arrayBuffer

# 검증 여부
# Grep: maxSize, sizeLimit, MAX_FILE_SIZE, mimetype, magic
```

**판정:** MIME/크기 검증 없음 → HIGH; 위험 확장자 미차단 → HIGH.

---

## CAT-5: 스토리지

```bash
# Grep: public.*bucket, getPublicUrl, createSignedUrl
# Grep: storage.from
```

**판정:** 민감 파일이 퍼블릭 버킷 → HIGH.

---

## CAT-6: Prompt Injection

```bash
# Grep: systemInstruction, role.*system
# Grep: content.*\$\{, contents.*user
```

**판정:** 사용자 입력이 시스템 프롬프트에 직접 삽입 → MEDIUM.

---

## CAT-7: 정보 노출

```bash
# Grep: error.stack, err.message (API 응답에서 반환하는지)
# Grep: Content-Security-Policy, X-Frame-Options, X-Content-Type-Options
# Read: next.config.ts (headers 설정)
```

**판정:** 스택 트레이스 노출 → MEDIUM; 보안 헤더 전무 → MEDIUM.

---

## CAT-8: 의존성

```bash
npm audit --json 2>/dev/null
```

**판정:** critical → HIGH; high → MEDIUM.
