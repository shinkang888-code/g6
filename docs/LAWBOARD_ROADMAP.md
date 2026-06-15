# LawBoard 로드맵 (LawTop GL 웹 대체 검증)

LawBoard는 [lawygo](https://github.com/shinkang888-code/lawygo) 기반 서브프로젝트로, LawTop GL 데스크톱 모듈을 웹(Supabase + Next.js)으로 검증합니다.

## Phase 1 — 공지·상담 (완료)

| LawTop 모듈 | LawBoard | Supabase |
|-------------|----------|----------|
| 공지 | `/notices` | `notices` (+ `attachments`) |
| 상담/회의실 | `/consultation` | `consultations`, `consultation_rooms` |

## Phase 2 — 네이티브 게시판 (완료)

| LawTop 모듈 | LawBoard | Supabase |
|-------------|----------|----------|
| 게시판 | `/board`, `/board/[id]/post/[id]` | `boards`, `board_posts`, `board_comments` |

- G6(그누보드) 대신 Supabase 네이티브 (`boardService`, `boardBridge`)
- 댓글 작성 UI 추가
- API: `/api/board/*`, `/api/admin/boards/*`

## Phase 3 — 메일·세금 (완료)

| LawTop 모듈 | LawBoard | Supabase |
|-------------|----------|----------|
| LawTopMail | `/mail` | `mail_messages` |
| LawTopTaxBill | `/finance` (FinanceTaxDocuments) | `tax_documents` |

- 메일: 초안/수신 기록 CRUD (SMTP/IMAP 실연동은 후속)
- 세금계산서: 발행 초안 API (`/api/finance/tax-documents`)

## Phase 4 — 검증·배포 (완료)

- E2E 스크립트: `npm run test:lawboard`
- Vercel Production 배포
- lawtop 바이너리는 [lawtop](https://github.com/shinkang888-code/lawtop) 리포에 보관

## Supabase

- 프로젝트: `tvyktmwubzsfyfayhark` (lawygo 공유)
- 마이그레이션: `supabase/migrations/20260615010000_lawboard_phase2_4.sql`

## 테스트 계정 (LawBoard 검증용)

| 항목 | 값 |
|------|-----|
| URL | https://lawboard.vercel.app/login |
| 아이디 | `lawboardadmin` |
| 비밀번호 | `LawBoard2026!` |
| 관리번호 | `10000` |

생성: `npm run seed:lawboard-admin` · E2E: `npm run test:lawboard-e2e`

## 후속 (미포함)

- LawTopMail SMTP/IMAP 연동
- 홈택스·팝빌 세금계산서 실발행
- site_boards 테이블로 localStorage 게시판 메타 이전
