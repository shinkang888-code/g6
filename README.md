# LawBoard

**LawBoard 개발용 서브프로젝트** — LawTop GL의 **게시판·공지·상담** 기능을 웹으로 충실히 구현·검증합니다.

> 원본 LawTop GL 바이너리는 [lawtop](https://github.com/shinkang888-code/lawtop) 리포에서 보호하며,  
> 본 프로젝트는 [lawygo](https://github.com/shinkang888-code/lawygo) 코드베이스를 기반으로 합니다.

## 목적

- LawTop 게시판/상세 기능의 웹 구현 가능성 검증
- lawygo 미완성 모듈(공지 localStorage, 상담 mock) Supabase 통합
- Phase별 개발 → 테스트 → 배포 파이프라인 확립

## Phase 1 (완료)

| 항목 | 변경 |
|------|------|
| 공지 `/notices` | localStorage → Supabase `/api/notices` |
| 상담 `/consultation` | mock state → Supabase API |
| 상담실 | `consultation_rooms` 테이블 + API |
| DB | `20260615000000_lawboard_phase1.sql` |

## 기술 스택

Next.js 16 · React 19 · Supabase · G6 게시판 브릿지 · Vercel

## 로컬 실행

```bash
cp .env.local.example .env.local
# Supabase URL/키 입력
npm install
npm run dev
```

## Phase 1 테스트

```bash
npm run test:lawboard-phase1
```

## 배포

```bash
vercel --prod
```

## 로드맵

- **Phase 2**: G6 게시판 안정화, `site_boards` 메타 Supabase화, 댓글 UI
- **Phase 3**: LawTop 메일·세금계산서 웹 대체
- **Phase 4**: lawtop 바이너리 기능 매핑 문서 + E2E
