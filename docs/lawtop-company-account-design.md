# LawTop GL 회사 계정 설계 분석 → LawyGo 테넌트 격리

## LawTop GL 바이너리 분석 요약

`Lawtop GL.exe` / `LawComp.dll` 문자열 및 기존 LawyGo 로그인 흐름 기준:

| 개념 | LawTop | LawyGo 매핑 |
|------|--------|-------------|
| **관리번호** | 회사(법인) 단위 테넌트 키. 로그인 시 필수 | `site_users.management_number` |
| **회원번호** | 개인 로그인 ID (회원) | `site_users.login_id` |
| **그룹** | 관리번호 하위 조직(그룹코드·그룹명·대표자) | `company_groups` + 동일 `management_number` |
| **소속** | 변호사/팀 소속 | `site_users.department` |
| **권한세트** | 메뉴·기능 권한 묶음 | `permission_role_id` / `app_settings.roles` |
| **공유범위** | 사건·일정·자료 그룹 내 공유 | 동일 `management_number` 데이터 공유 |
| **격리** | 타 회사 데이터 비접근 | `management_number` API·DB 필터 |

## LawyGo 구현 원칙

1. 로그인: 아이디 + 비밀번호 + **관리번호** (기존 유지)
2. 세션에 `managementNumber` 저장 → 모든 API가 동일 번호만 조회
3. 사건·고객·기일 INSERT 시 자동으로 세션 관리번호 부여
4. 관리자도 **자기 회사** 데이터만 전체 조회 (타 회사 접근 불가)
5. 회사 그룹 화면에서 관리번호별 구성원·사건 수 확인

## 마이그레이션

`supabase/migrations/20260611000000_company_tenant_scope.sql` 실행 후:

```bash
node scripts/backfill-tenant-scope.mjs
npm run test:tenant-scope
```
