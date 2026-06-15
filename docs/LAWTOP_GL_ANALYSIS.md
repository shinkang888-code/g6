# LawTop GL 구버전 분석 및 LawyGo 이식 참고

## 1. LawTop GL 설치 구조 (C:\Program Files (x86)\LawTop GL)

### 1.1 확인된 파일·폴더

| 구분 | 경로/파일 | 비고 |
|------|-----------|------|
| 메인 실행 | `Lawtop GL.exe` | WinForms 메인 앱 |
| DB/비즈로직 | `DBAgent.dll`, `LawComp.dll`, `ModelApplication.dll`, `HKFramework.dll` | DB 접근·업무 로직 (바이너리) |
| 설정 | `Bot.ini`, `NoAuto.ini`, `NoAuto2.ini`, `config` (바이너리) | 자동화·봇 설정 |
| 서브 프로그램 | 아래 표 참조 | 수납/메일/결재/세금/리포트 등 |

### 1.2 서브 프로그램 (LawTop GL 모듈 → LawyGo 대응)

| LawTop GL 실행파일 | 역할 추정 | LawyGo 대응 |
|--------------------|-----------|------------|
| LawTopCashReceipt.exe | 수납 처리 | `/finance` 회계/수납 매칭 |
| LawTopProcess.exe | 전자결재 | `/approval` 전자결재 |
| LawTopMail.exe | 메일 | (그누보드/메일 연동) |
| LawTopMailSend.exe | 메일 발송 | (추후) |
| LawTopTaxBill.exe | 세금계산서 | (추후) |
| LawTopFileSend.exe | 파일 전송 | (문서함/전송) |
| Reports.exe | 리포트 | `/stats` 통계/분석 |
| ChatNoti/NotifyTrayIcon.exe | 알림 (SignalR) | 알림 배지·토스트 |
| LawTopParsingBotWV | 파싱 봇 (법원 등) | (추후 크롤링/연동) |
| LawTopFtpZipUpwards.exe | FTP/백업 | (추후) |

### 1.3 설정 파일 내용

- **Bot.ini**: `LawTopParsingBotWV` (파싱봇 식별자)
- **NoAuto.ini / NoAuto2.ini**: `Y` (자동 실행 비활성 등)
- **ChatNoti/Setting.ini**  
  - SignalR URL: `http://chat.lawtop.co.kr:19999`  
  - ConCheckInterval=10, Alarm All=On
- **LawTopParsingBotWV.ini / Parcingbot.ini**: Base64 인코딩 (DB/API 키 추정, 복호화 없이 구조만 참고)
- **config** (확장자 없음): 바이너리 — 메인 DB 연결 정보 추정

> DB 연결 문자열은 메인 앱이 `Lawtop GL.exe.config` 없이 배포된 경우 레지스트리 또는 사용자 AppData에 저장되었을 가능성이 있음.

---

## 2. 송무프로그램 공통 로직 (LawTop GL 웹 정보 + 관례)

### 2.1 업무 흐름

1. **상담관리** → 상담고객, 상담내용, 문서 → 수임 전환
2. **신건등록** → 사건 등록 (대법원 연동, 엑셀 일괄)
3. **진행관리** → 히스토리, 문서, **기일**, 관련사건, 타임시트, 계약, **수납**
4. **종결관리** → 종결일, 소요일/월, 종결형태, 성공여부

### 2.2 LawyGo에 반영한 핵심 엔티티

- **사건 (cases)** — 사건번호, 종류, 법원, 의뢰인, 상대방, 담당/보조, 진행상태, 수임일, 수임료/수납/미수금
- **기일 (deadlines)** — 사건별 기일, 기일종류, 불변기일, D-Day
- **의뢰인/상담 (clients, consultations)** — 상담→수임 전환
- **담당자 (staff)** — 수행/보조, 결재선
- **결재 (approvals)** — 결재선, 청구서/보고서 등
- **수납/회계 (finance)** — 수임료, 입금, 미수금, 매칭
- **타임라인/메모** — 진행 히스토리, 문서 (그누보드 연동)
- **알림** — 기일 임박, 결재 요청 (SignalR → 웹 푸시/토스트)

---

## 3. DB 설정 방식 (LawyGo 권장)

LawTop GL은 Windows 전용 바이너리라 연결 문자열을 직접 확인할 수 없음.  
LawyGo는 **Supabase(PostgreSQL)** 기준으로 스키마를 정의하며, 필요 시 기존 DB 마이그레이션용 뷰/매핑을 추가할 수 있음.

- 연결 정보: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (또는 anon key)
- 스키마: `supabase/migrations/` 참고
- 그누보드 6: `NEXT_PUBLIC_GNUBOARD_API_URL`, `NEXT_PUBLIC_GNUBOARD_API_KEY` 로 게시판/메모 연동

---

## 4. 메뉴 구성 매핑

| LawTop GL (추정) | LawyGo 경로 | 비고 |
|------------------|------------|------|
| 대시보드/업무현황 | `/` | 기일 카드, 내 업무, 결재 대기 |
| 사건관리 | `/cases`, `/cases/[id]`, `/cases/new` | 그리드, 상세, 타임라인, 신건등록 |
| 기일/일정 | `/calendar` | 기일 달력 |
| 전자결재 | `/approval` | 결재선, 청구서/보고서 |
| 수납/회계 | `/finance` | 입금-청구서 매칭 |
| 통계/리포트 | `/stats` | 월별 수임료, 사건/상태/담당자별 |
| 직원관리 | `/staff` | 담당자, 결재 레벨 |
| 알림 | 헤더 배지 + `/notifications` | 기일/결재 알림 |
| 설정 | `/settings` | 그누보드 연동, 권한 등 |

상세 메뉴 트리는 `src/lib/menuConfig.ts` 참고.
