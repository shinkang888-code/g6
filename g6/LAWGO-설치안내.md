# LawGo ↔ G6 연동용 설치 안내

- **공식 설치 매뉴얼**: https://sir.kr/manual/g6/install/
- **Python**: 3.8 이상 권장 (3.10 또는 3.11 권장. 3.14 사용 시 일부 패키지 빌드 오류 가능)

## Vercel 배포 (그누보드6)

- **프로덕션 URL**: https://g6-jet.vercel.app
- 배포 후 Vercel 대시보드 → 프로젝트 **g6** → **Settings → Environment Variables** 에서 DB 등 환경 변수 설정 필요 (예: `DB_ENGINE`, `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `SESSION_SECRET_KEY` 등). 설정 후 재배포하면 브라우저에서 `/install` 로 접속해 DB·관리자 설정을 진행할 수 있습니다.

## 빠른 실행 (이미 소스 클론됨, 로컬)

```powershell
# 가상환경 생성 (Python 3.10/3.11 권장)
python -m venv venv
.\venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt

# 실행 후 브라우저에서 http://127.0.0.1:8000 접속
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

처음 접속 시 브라우저에서 DB 설정(MySQL/PostgreSQL/SQLite) 및 관리자 계정 설정을 진행하면 됩니다.
