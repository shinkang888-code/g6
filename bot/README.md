# LawyGo 파싱봇 (대법원 나의사건검색)

LawTop GL 의 `LawTopParsingBotWV` 방식을 재구현한 **브라우저 자동화 + 캡차 OCR + HTML 파싱** 봇입니다.
웹앱(Next.js)과 분리된 독립 Node.js 서비스이며, 자체 `package.json` 을 가집니다.

## LawTop GL ↔ 본 봇 대응

| LawTop GL | 본 봇 | 파일 |
|-----------|-------|------|
| WebView2 내장 브라우저 | Playwright(Chromium) | `src/bot.ts` |
| Detect.dll + SELVAS AI(캡차 OCR) | OcrProvider (Tesseract/CLOVA/Vision) | `src/ocr.ts` |
| HtmlAgilityPack(결과 파싱) | cheerio | `src/parser.ts` |
| court.htm 의 cmd 생성/검증 로직 | 포팅 | `src/saGubun.ts` |
| WV1/2/3.exe 병렬 | 컨텍스트 풀 | `src/pool.ts` |
| DBAgent.dll(SQL Server) | Supabase(Postgres) | `src/store.ts` |
| CaseBasicData.txt(라벨\|값) | `toRawLine` / `parseRawLine` | `src/parser.ts` |

## 설치

```bash
cd bot
npm install          # postinstall 에서 Playwright Chromium 자동 설치
cp .env.example .env # 값 채우기 (특히 OCR / Supabase)
```

## 사용법

```bash
# 단일 조회
npm run search -- --court "대구지방법원" --year 2025 --gubun 노 --serial 5285 --party 이선아

# 결과를 Supabase 에 저장 (환경변수 설정 시)
npm run search -- --court "대구지방법원" --year 2025 --gubun 노 --serial 5285 --party 이선아 --save

# 배치 조회 (jobs.json = SearchParams 배열)
npm run search -- --file jobs.json --out results.json --save
```

`jobs.json` 예시:

```json
[
  { "courtName": "대구지방법원", "year": "2025", "gubun": "노", "serial": "5285", "partyName": "이선아", "matchCaseId": "uuid-옵션" },
  { "courtName": "서울중앙지방법원", "year": "2024", "gubun": "가단", "serial": "289445", "partyName": "홍길동" }
]
```

## LawyGo 웹앱 연동 — Supabase 작업 큐 (권장, Railway 불필요)

Playwright/OCR 은 **Vercel 서버리스에서 실행할 수 없습니다.** Railway 없이도
**Supabase 테이블(`scourt_search_jobs`)을 작업 큐**로 쓰면 Vercel과 로컬 봇을 연결할 수 있습니다.

```
[lawygo.vercel.app]  POST /api/court-case  →  scourt_search_jobs INSERT (pending)
        ↓
[로컬 PC]  npm run queue  →  pending job claim  →  Playwright + ddddocr
        ↓
Supabase UPDATE (done/failed)  →  UI GET 폴링 (/api/court-case?jobId=...)
```

### 1) Supabase · Vercel 환경변수

**Vercel Production** (또는 `.env.local`):

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<Dashboard → Settings → API → service_role>
# SCOURT_BOT_URL 은 설정하지 않으면 자동으로 큐 모드
```

**bot/.env** (로컬 큐 워커):

```env
NEXT_PUBLIC_SUPABASE_URL=<Vercel과 동일>
SUPABASE_SERVICE_ROLE_KEY=<Vercel과 동일>
OCR_PROVIDER=ddddocr
DDDDOCR_URL=http://127.0.0.1:8000
DDDDOCR_CHARSETS=0123456789
```

### 2) 로컬에서 큐 워커 실행 (2터미널)

```powershell
# 터미널 1 — OCR 사이드카
python bot/ddddocr_server.py

# 터미널 2 — Supabase 큐 폴링
cd bot
npm run queue
```

> 사무실 PC에서 `npm run queue` 가 **상시 실행** 중이어야 프로덕션(`lawygo.vercel.app`)의
> 「봇으로 자동 조회」가 동작합니다.

### 3) 사용

LawyGo 로그인 → `/cases/scourt-search` → 법원·사건번호·당사자명 → **「봇으로 자동 조회」**.

DB 마이그레이션: `supabase/migrations/20260608000000_scourt_search_jobs.sql`  
관련 코드: `src/lib/scourtQueue.ts`, `bot/src/queueWorker.ts`

---

## LawyGo 웹앱 연동 — HTTP 워커 (선택)

공개 URL로 봇을 직접 노출할 수 있는 호스트(Railway/Fly/VM)가 있을 때만 사용합니다.
`SCOURT_BOT_URL` 이 설정되면 큐보다 **HTTP 워커가 우선**됩니다.

```
[브라우저] → POST /api/court-case → callScourtBot() → POST {BOT_URL}/search
```

```bash
cd bot
npm run serve         # 기본 :8787, GET /health · POST /search
```

```env
SCOURT_BOT_URL=https://bot.example.com
SCOURT_BOT_TOKEN=<bot/.env 의 BOT_API_TOKEN 과 동일>
```

> 공개 인터넷에 직접 노출하지 말고, 토큰 인증(`BOT_API_TOKEN`)을 반드시 켜세요.

## 동작 흐름

```
form 페이지 로드 → 법원/연도/구분/일련번호/당사자명 자동 입력
  → 캡차 있으면 캡처 → OCR 해독 → 입력
  → 제출(SearchSano) → 결과 HTML
  → 캡차 오류면 재시도(최대 CAPTCHA_MAX_RETRY)
  → cheerio 파싱 → CaseBasicData(라벨|값)
  → (옵션) Supabase cases/timeline/deadlines 저장
```

## OCR 프로바이더 선택 (`.env` 의 `OCR_PROVIDER`)

| 값 | 비용 | 캡차 정확도 | 비고 |
|---|---|---|---|
| **`ddddocr`** (기본·권장) | **무료** | ★★★★☆ | 캡차 특화 오픈소스(MIT, ONNX). HTTP 사이드카 필요 |
| `tesseract` | 무료 | ★☆☆☆☆ | 설치 불필요하나 캡차엔 약함(폴백용) |
| `clova` | 유료 | ★★★★★ | Naver CLOVA OCR. 최상 정확도 |
| `vision` | 부분무료 | ★★★☆☆ | Google Vision(월 1000건 무료) |

### ddddocr 사이드카 실행 (무료, 권장)

`ddddocr`(sml2h3/ddddocr, GitHub 14k★)는 캡차 전용으로 학습된 무료 OCR 로,
영숫자·노이즈 캡차에서 Tesseract 대비 30%+ 높은 정확도(통상 90%대)를 보입니다.
Python 라이브러리라 HTTP 사이드카로 띄워 봇이 호출합니다.

동봉된 경량 사이드카(`bot/ddddocr_server.py`, 표준 라이브러리만 사용 · 추가 웹 의존성 없음)를 띄웁니다.

```bash
pip install ddddocr          # onnxruntime 등 자동 설치
python ddddocr_server.py     # 기본 :8000, GET / · POST /ocr
# 포트 변경: python ddddocr_server.py 9000
```

그다음 봇 `.env`:

```env
OCR_PROVIDER=ddddocr
DDDDOCR_URL=http://127.0.0.1:8000
# ssgo 캡차는 6자리 숫자 전용 → 숫자 제한으로 정확도 향상(권장)
DDDDOCR_CHARSETS=0123456789
```

> **실측(2026-06):** ssgo 캡차는 **6자리 숫자**이며, ddddocr 인식 정확도가 매우 높아
> (샘플 4/4 정답) 보통 1회 시도로 통과합니다. 봇은 OCR 결과가 6자리 숫자가 아니면
> 제출하지 않고 캡차만 새로고침해 재시도합니다.

### 그 외 무료 대안 (참고)

- **ppllocr** / **AntiCAP**: ddddocr 대항 ONNX 캡차 OCR. 슬라이더·회전 등 복합 캡차 지원.
- **EasyOCR / PaddleOCR**: 범용 한글 OCR(문서용). 캡차엔 ddddocr 가 더 적합.

## 대상 사이트 (중요)

- LawTop 이 쓰던 레거시 **`safind.scourt.go.kr` 은 폐지**되어 DNS 해석조차 안 됩니다.
- 현행 나의사건검색은 **`ssgo.scourt.go.kr/ssgo/index.on`** (WebSquare 기반)로 운영되며,
  본 봇의 `src/selectors.ts` 는 2026-06 라이브 페이지에서 확인한 실제 ID 로 맞춰져 있습니다.
- 폼 필드/캡차/조회버튼 ID 는 라이브에서 확인 완료:
  - 법원 `sbx_cortCd` · 년도 `sbx_csYr` · 사건구분 `sbx_csDvsCd`
  - 일련번호 `ibx_csSerial` · 당사자명 `ibx_btprNm`
  - 캡차 이미지 `img_captcha`(blob) · 캡차 입력 `ibx_answer` · 새로고침 `btn_reloadCaptcha`
  - 사건검색 버튼 `btn_srchCs`
- **판정은 사이트 alert(dialog) 메시지 기반**(실측):
  - 캡차 오답 → `자동입력 방지문자가 일치하지 않습니다…`
  - 사건 없음 → `사건이 존재하지 않습니다.`
  - 에러 dialog 없음 → 캡차 통과 + 결과 렌더 성공
  - (폼 페이지 HTML 에는 "자동입력방지문자 도입" 등 안내문이 상시 포함되어 HTML 텍스트만으로는
    오탐이 발생하므로, `src/parser.ts` 의 `isCaptchaError`/`isNotFound` 는 dialog 메시지 전용입니다.)
- **결과 파서 확정(실데이터):** `src/parser.ts` 는 WebSquare 결과 표의 `<caption>` 으로 표를 식별합니다.
  - 기본정보 표(caption 에 `재판부`+`접수일`) → th(라벨)→td(값): 사건번호·피고인명·재판부·접수일·종국결과·형제번호
  - 기일 표(caption 에 `기일구분`/`기일장소`) → 헤더 매핑: 일자·시각·기일구분·기일장소·결과
  - 숨김 노드(`aria-hidden`/`display:none`) 제거로 `[전자]` 배지 등 오염 방지, 재판부 `(전화:…)` 잡음 제거.
  - 라이브 실사건(대구지방법원 2025노5285)으로 기본정보 + 기일 4건 추출 검증 완료.

## Railway / Fly.io 프로덕션 배포 (Vercel 연동)

Playwright+ddddocr 봇은 Vercel에서 실행할 수 없습니다. **Railway(권장)** 또는 **Fly.io**에 Docker로 상시 호스팅한 뒤, LawyGo(Vercel) 환경변수로 연결합니다.

```
[lawygo.vercel.app] → POST /api/court-case
  → SCOURT_BOT_URL (Railway 공개 URL)
  → bot worker /search (x-bot-token 인증)
  → Playwright + ddddocr → ssgo 조회
```

### A) Railway (권장, 원클릭 스크립트)

```powershell
# 1) Railway 로그인 (브라우저 1회)
npx @railway/cli login

# 2) bot/ 에서 배포 + Vercel env + 재배포
cd bot
.\scripts\deploy-railway.ps1
```

수동 배포:

```bash
cd bot
npx @railway/cli init --name lawygo-bot
npx @railway/cli variables set BOT_API_TOKEN=<임의-긴-시크릿>
npx @railway/cli variables set HEADLESS=true
npx @railway/cli variables set OCR_PROVIDER=ddddocr
npx @railway/cli variables set DDDDOCR_URL=http://127.0.0.1:8000
npx @railway/cli variables set DDDDOCR_CHARSETS=0123456789
npx @railway/cli up
npx @railway/cli domain          # → https://xxx.up.railway.app
```

### B) Fly.io (대안)

```bash
cd bot
fly auth login
fly launch --no-deploy    # fly.toml 사용, 리전 nrt(도쿄) 권장
fly secrets set BOT_API_TOKEN=<임의-긴-시크릿>
fly deploy
fly certs show            # → https://lawygo-bot.fly.dev
```

### C) Vercel 환경변수 (워커 URL 확보 후)

```bash
# 프로젝트 루트(lawygo/)에서
vercel env add SCOURT_BOT_URL production --value "https://xxx.up.railway.app" --yes
vercel env add SCOURT_BOT_TOKEN production --value "<BOT_API_TOKEN과 동일>" --yes --sensitive
vercel deploy --prod
```

| Vercel 변수 | 값 |
|---|---|
| `SCOURT_BOT_URL` | Railway/Fly 공개 URL (끝 `/` 없음) |
| `SCOURT_BOT_TOKEN` | `bot` 워커의 `BOT_API_TOKEN` 과 **동일** |

> Railway Hobby 플랜은 Playwright+Chromium에 **최소 1GB RAM** 권장. `/health` 로 상태 확인.

## ⚠️ 법적 고지

이 방식은 대법원 사이트의 **자동입력방지(캡차)를 OCR 로 우회**하며, 사이트 이용약관 위반·자동화 차단·법적 리스크가 있습니다.
상용·외부 서비스로는 **사법정보공유포털 연계 API**(openapi.scourt.go.kr) 가 정공법입니다.
본 봇은 내부/학습 목적의 재현 구현입니다. 사용 책임은 운영자에게 있습니다.
