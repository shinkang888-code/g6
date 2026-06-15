# Google Drive API 연동 설정 가이드

LawyGo에서 사건 자료실·메신저 첨부·결재 자료실 파일을 Google Drive에 저장하기 위한 설정 방법입니다.

---

## 1. GCP 프로젝트 생성

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 상단 프로젝트 선택 → **새 프로젝트** → 이름 입력 후 생성
3. 해당 프로젝트 선택

---

## 2. Google Drive API 사용 설정

1. **API 및 서비스** → **라이브러리**
2. "Google Drive API" 검색 → **사용 설정** 클릭

---

## 3. 서비스 계정 생성

1. **API 및 서비스** → **사용자 인증 정보**
2. **+ 사용자 인증 정보 만들기** → **서비스 계정**
3. 서비스 계정 이름(예: lawygo-drive) 입력 → **만들기**
4. 역할은 생략 가능 → **완료**
5. 생성된 서비스 계정 클릭 → **키** 탭
6. **키 추가** → **새 키 만들기** → **JSON** 선택 → **만들기**
7. JSON 파일이 다운로드됨 (이 파일을 **절대 Git에 커밋하지 마세요**)

---

## 4. 환경 변수 설정

### 4-1. JSON을 base64로 인코딩

**macOS/Linux:**
```bash
base64 -w0 service-account-key.json
```

**PowerShell:**
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("service-account-key.json"))
```

**Node.js:**
```bash
node -e "console.log(require('fs').readFileSync('service-account-key.json').toString('base64'))"
```

### 4-2. .env에 추가

```
GOOGLE_DRIVE_CREDENTIALS_BASE64=<위에서 출력한 base64 문자열>
```

- `.env` 파일은 Git에 포함되지 않으므로 안전합니다.
- Vercel 등 배포 시에는 **환경 변수**에 `GOOGLE_DRIVE_CREDENTIALS_BASE64`를 설정하세요.

---

## 5. 서비스 계정 Drive 사용

- 서비스 계정은 **본인의 Drive**가 없습니다.
- API로 생성한 파일은 **서비스 계정 소유의 Drive**에 저장됩니다.
- 별도의 Google 계정 Drive와 공유하려면:  
  Google Drive 웹에서 해당 폴더를 서비스 계정 이메일(`...@...iam.gserviceaccount.com`)과 공유하면 됩니다.

---

## 6. 확인

1. 서버 재시작 후 `/api/drive/upload` 에 `POST` 요청 시
   - 503 "Google Drive 연동이 설정되지 않았습니다" → env 미설정 또는 base64 오류
   - 그 외 응답 → 연동 성공

2. GCP 콘솔 → **API 및 서비스** → **사용량** 에서 Drive API 호출 현황 확인 가능
