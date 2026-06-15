# LawyGo ↔ G6(그누보드6) 설치·연동 가이드

LawyGo 리포의 `g6/` 폴더에 [shinkang888-code/g6](https://github.com/shinkang888-code/g6) 포크가 submodule로 포함됩니다.  
**LawyGo(Next.js :3000)** 와 **G6(FastAPI :8000)** 는 같은 리포에 있지만 **별도 프로세스**로 실행합니다.

## 1. 초기 설치

```powershell
# LawyGo 루트
npm run setup:g6
```

- submodule을 포크 리포로 맞춤
- `g6/.venv` 가상환경 + `pip install -r requirements.txt`

## 2. G6 최초 DB 설치

```powershell
npm run dev:g6
```

브라우저에서 `http://127.0.0.1:8000` 접속 → 설치 마법사:

1. 라이선스 동의
2. DB 선택: **SQLite**(로컬) 또는 **PostgreSQL**(Supabase 등)
3. 테이블 접두사: `g6_` (기본값)
4. 관리자 계정 생성 (이 계정을 LawyGo `.env.local`의 `GNUBOARD_API_*`에 사용)

## 3. LawyGo 환경변수

`.env.local`:

```env
NEXT_PUBLIC_GNUBOARD_API_URL=http://localhost:8000
GNUBOARD_API_USERNAME=admin
GNUBOARD_API_PASSWORD=설치시_만든_비밀번호
```

## 4. 동시 실행

```powershell
# 터미널 1
npm run dev:g6

# 터미널 2
npm run dev
```

## 5. LawyGo에서 G6 관리

| 경로 | 용도 |
|------|------|
| `/admin/g6` | G6 관리자 콘솔 바로가기 |
| `/admin/settings/integration` | G6 URL·키 설정 |
| `/board` | 게시판 사용 (LawyGo UI → G6 API) |

## 6. 게시판 ID 매핑

| LawyGo ID | G6 bo_table | 비고 |
|-----------|-------------|------|
| `notice` | `notice` | 기본 설치 포함 |
| `general` | `free` | 자동 매핑 |
| `case_memo` | `case_memo` | G6 관리자에서 **직접 생성** 필요 |

## 7. 연동 테스트

```powershell
npm run test:g6
```

## 8. Vercel 배포

- **LawyGo**: 리포 루트 → `lawygo.vercel.app`
- **G6**: Root Directory `g6` → 별도 Vercel 프로젝트

G6 Vercel 환경변수: `DB_ENGINE`, `SESSION_SECRET_KEY` 등 (`g6/example.env` 참고)
