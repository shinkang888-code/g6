# 수동 실행 스크립트

## add-role-column-manual.sql

`site_users` 테이블에 **role(권한)** 컬럼이 없을 때 사용합니다.

**에러가 났을 때:**  
`Could not find the 'role' column of 'site_users' in the schema cache`

**실행 방법 (둘 중 하나):**

1. **Supabase 대시보드**
   - [Supabase](https://supabase.com/dashboard) → 프로젝트 선택 → **SQL Editor**
   - `add-role-column-manual.sql` 내용을 붙여넣고 **Run** 실행

2. **Supabase CLI**
   - 터미널에서: `supabase db push` 또는 `supabase migration up`
   - 새 마이그레이션 `20260309100000_site_users_role_ensure.sql` 이 적용됩니다.

실행 후 회원 등록/편집 시 권한(관리자, 변호사, 직원 등)이 DB에 저장됩니다.
