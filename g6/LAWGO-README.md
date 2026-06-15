# LawGo에서 G6 사용하기

이 폴더는 LawGo 프로젝트의 **전문 게시판** 연동을 위한 그누보드6(G6) 설치 위치입니다.

- **설치·실행·연동 방법**: 프로젝트 루트의 [../docs/g6-install.md](../docs/g6-install.md) 참고
- **Python**: 3.8 ~ 3.13 권장 (3.14는 pydantic-core 미지원으로 `pip install` 실패 가능)
- **실행**: `uvicorn main:app --reload --host 0.0.0.0 --port 8000`  
  → 기본 URL: `http://localhost:8000`  
  → LawGo 환경변수: `NEXT_PUBLIC_GNUBOARD_API_URL=http://localhost:8000/api`
