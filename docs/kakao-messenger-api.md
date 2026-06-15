# 카카오톡 API 연동 및 메신저 발송 가이드

LawyGo 프로젝트에서 **카카오 알림톡(비즈 메시지)** API를 연동하고, 메신저 페이지에서 카카오톡으로 보내는 방법을 정리한 문서입니다.

---

## 1. 카카오 알림톡이란

- **알림톡**: 기업이 사용자에게 **정보성** 카카오톡 메시지를 보내는 서비스입니다.
- 카카오톡 채널과 **친구 추가하지 않은 사용자**에게도 발송 가능합니다.
- **광고성 메시지는 불가**하며, 주문/예약 확인, 결제·배송 안내 등 정보성 메시지만 허용됩니다. 스팸 발송 시 서비스 중단·과태료가 있을 수 있습니다.

**공식 문서**: [Kakao i Connect Message - BizMessage (알림톡)](https://docs.kakaoi.ai/kakao_i_connect_message/bizmessage/)

---

## 2. 사전 준비 (카카오 측)

### 2-1. 카카오 비즈니스 채널·알림톡 계약

1. **카카오 비즈니스**  
   - [카카오 비즈니스](https://business.kakao.com/) 또는 카카오 담당자를 통해 **비즈 메시지(알림톡)** 서비스 신청 및 계약을 합니다.

2. **발신 프로필**  
   - 채널 생성 시 **발신 프로필 키(sender_key)** 를 발급받습니다.  
   - 이 값이 API의 `sender_key` 입니다.

3. **알림톡 템플릿**  
   - 발송할 **메시지 템플릿**을 비즈 사이트에서 등록·승인받습니다.  
   - 각 템플릿마다 **template_code** 가 부여됩니다.  
   - 대부분의 계약에서는 **반드시 승인된 템플릿 코드**로만 발송할 수 있습니다.

4. **발신 전화번호**  
   - **발신 번호(sender_no)** 를 등록해 두어야 합니다. (예: 021112222, 01012345678 등 계약된 번호)

5. **OAuth 2.0 인증 정보**  
   - API 호출 전에 **액세스 토큰**이 필요합니다.  
   - 카카오에서 제공하는 **Client ID**, **Client Secret**으로 [OAuth 2.0 인증 API](https://docs.kakaoi.ai/kakao_i_connect_message/bizmessage/api/api_reference/oauth/)를 호출해 토큰을 발급받습니다.  
   - 토큰 유효 기간이 있으므로, 주기적으로 갱신하거나 자동 갱신 로직을 두는 것이 좋습니다.

---

## 3. LawyGo에서 설정하는 방법

### 3-0. 카카오 연동 서버(게이트웨이) 사용 시

외부 카카오톡 연동 서버(게이트웨이)를 사용하는 경우, **IP**와 **API Key**만 설정하면 됩니다.

1. **관리자** 로그인 → **설정** → **메신저 연동관리** 이동
2. **카카오톡 연동 서버 IP**: 게이트웨이 서버 주소 (예: `121.166.75.165` 또는 `121.166.75.165:8080`)
3. **카카오톡 연동 API Key**: 게이트웨이에서 발급한 API 키
4. **저장** 후 메신저 페이지에서 채널 **카카오톡** 선택 후 발송

환경 변수로 설정할 수도 있습니다.

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `KAKAO_GATEWAY_IP` | 연동 서버 IP (또는 IP:포트) | `121.166.75.165` |
| `KAKAO_GATEWAY_APIKEY` | 연동 서버 API 키 | (게이트웨이 발급 키) |
| `KAKAO_GATEWAY_PATH` | 발송 API 경로 (선택, 기본값 `/send`) | `/send` 또는 `/api/kakao/send` |

게이트웨이 IP·API Key가 설정되어 있으면 **카카오 비즈 알림톡** 설정보다 우선하여 해당 서버로 발송 요청을 보냅니다.

### 3-1. 관리자 설정(DB)에서 입력 (카카오 비즈 알림톡)

1. **관리자**로 로그인 후 **설정** → **메신저 연동관리**로 이동합니다.
2. 다음 값을 입력 후 **저장**합니다.
   - **카카오톡 비즈 액세스 토큰**: OAuth로 발급받은 `access_token`
   - **카카오톡 발신 키**: 비즈 채널의 `sender_key` (발신 프로필 키)

### 3-2. 환경 변수로 설정 (선택)

DB보다 **환경 변수**가 우선 적용됩니다. Vercel이면 프로젝트 Settings → Environment Variables에 넣습니다.

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `KAKAO_BIZ_ACCESS_TOKEN` | OAuth 액세스 토큰 | (카카오 OAuth API로 발급) |
| `KAKAO_BIZ_SENDER_KEY` | 발신 프로필 키 | (비즈 채널에서 발급) |
| `KAKAO_BIZ_SENDER_NO` | 발신 전화번호 (필수) | `021112222` |
| `KAKAO_BIZ_TEMPLATE_CODE` | 알림톡 템플릿 코드 (계약에 따라 필수) | `TEMPLATE_001` |
| `KAKAO_BIZ_CID` | 고객사 정의 메시지 ID (선택, 미설정 시 자동 생성) | `202210181600001` |
| `KAKAO_BIZ_BASE_URL` | API 서버 (기본값 사용 권장) | `https://bizmsg-web.kakaoenterprise.com` |

- **일반 업종**: `bizmsg-web.kakaoenterprise.com`  
- **금융권**: `bizmsg-bank.kakaoenterprise.com`  
- **증권**: `bizmsg-stock.kakaoenterprise.com`  
- **공공기관**: `bizmsg-gov.kakaoenterprise.com`

---

## 4. 액세스 토큰 발급 (OAuth 2.0)

알림톡 발송 API는 **Bearer 토큰**이 필요합니다. 카카오 비즈 메시지 계약 시 받은 **Client ID**, **Client Secret**으로 토큰을 받습니다.

### 4-1. 토큰 발급 API 예시

카카오 문서의 [OAuth 2.0 인증](https://docs.kakaoi.ai/kakao_i_connect_message/bizmessage/api/api_reference/oauth/)을 참고해, 예를 들어 다음과 같이 호출합니다.

```bash
curl -X POST "https://{base_url}/v2/auth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id={client_id}&client_secret={client_secret}&grant_type=client_credentials"
```

- `base_url`: 일반 업종이면 `bizmsg-web.kakaoenterprise.com`
- 응답에 포함된 `access_token` 값을 **카카오톡 비즈 액세스 토큰** 자리에 넣습니다.
- 토큰 만료 전에 같은 방식으로 다시 호출해 갱신한 뒤, DB 또는 환경 변수를 업데이트합니다.

(실제 `client_id`, `client_secret`, base_url은 카카오 비즈 계약·콘솔에서 확인하세요.)

---

## 5. 메신저 페이지에서 카카오톡 보내기

1. 로그인 후 상단 메뉴에서 **메신저** 페이지로 이동합니다.
2. **채널**에서 **카카오톡**을 선택합니다.
3. **수신 번호**를 입력해 블록으로 추가합니다 (최대 5개).
4. **발송 내용**을 입력합니다.  
   - 계약에 따라 **특정 템플릿**만 허용될 수 있으므로, 내용은 해당 템플릿 형식에 맞춥니다.
5. **발송** 버튼을 누르면 `POST /api/messenger/kakao` 가 호출되고, 설정된 액세스 토큰·발신 키·발신 번호·템플릿 코드로 알림톡 발송이 시도됩니다.

---

## 6. API 스펙 요약 (알림톡 발송)

- **URL**: `POST https://bizmsg-web.kakaoenterprise.com/v2/send/kakao` (일반 업종 기준)
- **Header**:  
  - `Authorization: Bearer {access_token}`  
  - `Content-Type: application/json`
- **Body 필수 항목** (카카오 공식 기준):
  - `message_type`: `"AT"` (알림톡)
  - `sender_key`: 발신 프로필 키
  - `cid`: 고객사 정의 메시지 일련번호 (미입력 시 앱에서 자동 생성)
  - `template_code`: 승인된 템플릿 코드 (계약에 따라 필수)
  - `phone_number`: 수신자 전화번호 (국가코드 82 포함, 예: 8201012345678)
  - `sender_no`: 발신 전화번호
  - `message`: 발송할 메시지 본문 (최대 1000자)
  - `fall_back_yn`: `true` / `false` (알림톡 실패 시 대체 문자 발송 여부)

LawyGo의 `/api/messenger/kakao` 는 위 항목을 env/DB 설정과 요청 body(`receivers`, `message`)로 조합해 전송합니다.

---

## 7. 자주 나오는 오류와 확인 사항

| 상황 | 확인할 것 |
|------|------------|
| 503 / 연동 미설정 | 액세스 토큰·발신 키가 DB 또는 env에 들어가 있는지 |
| 400·410 (입력값 오류) | `sender_no`, `template_code`, `phone_number` 형식, 템플릿 승인 여부 |
| 400 (권한 오류) | 토큰 만료 여부, Client ID/Secret·계약 상태 |
| 발송 실패 (510 등) | 템플릿 코드와 실제 `message` 내용이 승인된 템플릿과 일치하는지, 발신 번호·발신 프로필 등록 여부 |

---

## 8. 정리

- **카카오 측**: 비즈 메시지(알림톡) 계약 → 채널·발신 프로필 키(sender_key) · 발신 번호(sender_no) · 템플릿 등록(template_code) · OAuth Client ID/Secret 확인.
- **토큰**: OAuth 2.0으로 `access_token` 발급 후, 주기적으로 갱신해 DB 또는 env에 반영.
- **LawyGo**: 관리자 **메신저 연동관리**에 액세스 토큰·발신 키 저장 (또는 env에 설정) → **메신저** 페이지에서 채널 **카카오톡** 선택 후 수신 번호·내용 입력해 발송.

더 자세한 API 스펙·OAuth 절차·템플릿 가이드는 카카오 공식 문서를 참고하세요.  
- [알림톡 발송 API](https://docs.kakaoi.ai/kakao_i_connect_message/bizmessage/api/api_reference/at/)  
- [OAuth 2.0 인증](https://docs.kakaoi.ai/kakao_i_connect_message/bizmessage/api/api_reference/oauth/)
