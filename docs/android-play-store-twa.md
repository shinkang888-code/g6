# LawyGo — Play Store 빠른 출시 (PWA + TWA)

웹 앱(https://lawygo.vercel.app)을 **Trusted Web Activity(TWA)** 로 감싸 Google Play에 올리는 절차입니다.

## 1. 사전 조건 (이미 반영됨)

| 항목 | 경로 |
|------|------|
| Web App Manifest | `/manifest.webmanifest` (`src/app/manifest.ts`) |
| Service Worker | `/public/sw.js` |
| 오프라인 안내 | `/public/offline.html` |
| Digital Asset Links | `/.well-known/assetlinks.json` |
| TWA 설정 템플릿 | `android-twa/twa-manifest.json` |

배포 후 확인:

```bash
npm run test:pwa
```

브라우저(Chrome)에서 `lawygo.vercel.app` 접속 → 메뉴 **앱 설치** 또는 주소창 설치 아이콘이 보이면 PWA 준비 완료.

## 2. Vercel 환경 변수 (TWA 검증)

Play Console에 앱을 만든 뒤 **앱 서명 키 SHA-256** 을 등록합니다.

| 변수 | 예시 |
|------|------|
| `TWA_PACKAGE_ID` | `app.lawygo.twa` |
| `TWA_ANDROID_SHA256` | `14:6D:E9:...` (콤마로 여러 지문 가능) |

SHA-256 확인 (Bubblewrap 빌드 후):

```bash
keytool -list -v -keystore android-twa/android.keystore -alias lawygo
```

또는 Play Console → **설정 → 앱 무결성 → 앱 서명** 에서 **SHA-256 인증서 지문** 복사.

배포 후 검증:

https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://lawygo.vercel.app&relation=delegate_permission/common.handle_all_urls

## 3. 서명·assetlinks (완료)

- Keystore: `android-twa/android.p12` (로컬 생성, git 제외)
- 패키지: `app.lawygo.twa`
- SHA-256: `android-twa/SIGNING.md` 참고
- 프로덕션 assetlinks: https://lawygo.vercel.app/.well-known/assetlinks.json ✅

재생성: `npm run setup:twa-signing`

## 4. Android TWA 프로젝트 생성 (Bubblewrap)

**요구:** JDK 17+, Android SDK

```bash
cd android-twa
npx @bubblewrap/cli@latest init --manifest=https://lawygo.vercel.app/manifest.webmanifest
# 또는 로컬 twa-manifest.json 사용:
# npx @bubblewrap/cli@latest init --manifest=./twa-manifest.json
```

초기화 시 keystore 생성 질문에 **새 키 생성** 선택 (Play 업로드 키와 별도로 관리 가능).

빌드:

```bash
npx @bubblewrap/cli@latest build
```

산출물: `app-release-signed.apk` / `app-release-bundle.aab`

### GitHub Actions로 AAB 빌드 ✅

`master` 푸시 시 [Android TWA Build](https://github.com/shinkang888-code/lawygo/actions/workflows/android-twa.yml) 가 Gradle로 `.aab`를 생성합니다.

1. GitHub → **Actions** → **Android TWA Build** → 최신 성공 run
2. **Artifacts** → `lawygo-twa-release` 에서 `.aab` 다운로드
3. Play Console **내부 테스트** 트랙에 업로드

프로젝트 재생성: `npm run generate:twa-project` (manifest 변경 시)

### PWABuilder로 즉시 AAB (대안)

CI 없이 바로 받으려면:

1. https://www.pwabuilder.com 에서 `https://lawygo.vercel.app` 입력
2. **Package for stores** → **Android** → 다운로드
3. 동일 패키지명 `app.lawygo.twa` 및 `android-twa/android.p12` 서명 키 사용 권장

## 5. Play Console 등록

1. [Google Play Console](https://play.google.com/console) → 새 앱
2. **패키지 이름** = `app.lawygo.twa` (twa-manifest와 동일)
3. **내부 테스트** 트랙에 `.aab` 업로드
4. 스토어 리스팅: 앱 이름, 짧은 설명, 스크린샷(휴대폰 2장 이상), 아이콘 512×512
5. **데이터 안전**·**콘텐츠 등급** 설문 완료
6. `assetlinks.json` 검증 통과 후 TWA는 Chrome 주소창 없이 전체 화면 실행

## 6. 스토어용 아이콘

현재 PWA 아이콘은 SVG(`public/icons/lawygo-icon.svg`)입니다. Play 스토어 리스팅용 **512×512 PNG** 는 디자인 에셋으로 교체하는 것을 권장합니다.

## 7. 문제 해결

| 증상 | 조치 |
|------|------|
| 설치 버튼 없음 | HTTPS, manifest, SW(프로덕션) 확인 |
| TWA가 브라우저 탭으로 열림 | assetlinks SHA-256·패키지명 불일치 |
| 로그인 후 세션 끊김 | 쿠키 `SameSite`/`Secure` — Vercel HTTPS면 정상 |
| 오프라인 | 사건 데이터는 온라인 필요 — `offline.html` 안내만 표시 |

## 8. 이후 (네이티브 전환 시)

Capacitor/React Native로 전환해도 동일 도메인·Supabase 세션을 재사용할 수 있습니다. TWA는 **가장 빠른 Play 출시** 경로입니다.
