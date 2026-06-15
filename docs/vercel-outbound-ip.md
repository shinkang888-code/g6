# Vercel 배포 시 아웃바운드 IP 확인 및 알리고 발송 IP 등록

알리고 등 IP 허용 목록(allowlist)이 필요한 서비스를 Vercel에서 호출할 때, **어디서 IP를 확인하고 어떻게 등록하는지** 단계별로 정리한 문서입니다.

---

## 1. 기본 동작 (Hobby 플랜 포함)

**기본적으로 Vercel의 Serverless Function은 고정 아웃바운드 IP를 갖지 않습니다.**

- 배포·호출 시점에 따라 **동적(dynamic) IP**로 나갑니다.
- IP 대역 목록이 공개되어 있지 않고, 바뀔 수 있어 **미리 화이트리스트에 넣어 두는 방식은 불가능**합니다.
- 따라서 **Hobby 플랜만 사용 중이면**, Vercel에서 나가는 요청의 “고정 IP”를 알리고에 등록하는 것은 **원천적으로 불가**합니다.

---

## 2. 해결 방법 요약

| 방법 | 플랜 | 설명 |
|------|------|------|
| **Static IPs** | Pro / Enterprise | 지역별 고정 IP 쌍 사용. 대시보드에서 IP 확인 후 알리고에 등록. |
| **Secure Compute** | Enterprise | 전용 VPC + 전용 고정 IP. 영업 문의 필요. |
| **프록시/릴레이** | 무관 | 고정 IP가 있는 다른 서버(예: VPS)에서 알리고 API 호출. |
| **다른 환경에서만 발송** | 무관 | Vercel 대신 로컬/다른 호스팅에서만 문자 발송. |

실제로 “Vercel에서 나가는 IP”를 알리고에 등록하려면 **Static IPs(Pro 이상)** 또는 **Secure Compute(Enterprise)** 를 켜야 합니다.

---

## 3. Static IPs 사용 시 IP 찾는 방법 (Pro / Enterprise)

Static IPs를 사용하면 **지역(region)마다 고정된 IP 쌍**이 부여되고, 이 IP를 알리고 “발송 IP”에 등록하면 됩니다.

### 3-1. 사전 조건

- 팀/프로젝트가 **Pro** 또는 **Enterprise** 플랜이어야 합니다.
- Static IPs 기능이 활성화되어 있어야 합니다.

### 3-2. 대시보드에서 IP 확인하는 절차

1. **Vercel 대시보드 접속**  
   - [https://vercel.com](https://vercel.com) 로그인

2. **팀/프로젝트 선택**  
   - 상단에서 해당 팀 선택 후, 해당 프로젝트(예: lawygo) 클릭

3. **Connectivity(연결) 설정으로 이동**  
   - 상단 메뉴: **Settings**  
   - 왼쪽 사이드바에서 **Connectivity** 탭 클릭  
   - 또는 직접 URL:  
     `https://vercel.com/[팀이름]/[프로젝트이름]/settings/connectivity`

4. **Static IPs 섹션 확인**  
   - **Static IPs** 항목이 보이면 사용 가능한 상태입니다.  
   - **Manage Active Regions** (활성 지역 관리)를 클릭합니다.

5. **지역 선택 및 IP 확인**  
   - 사용할 **Region**을 선택합니다 (최대 3개).  
     - 예: `Washington, D.C., USA (iad1)`, `Seoul` 등  
   - 지역을 켜면 해당 지역에 대한 **Static IP 주소 쌍**이 표시됩니다.  
   - 화면에 나온 **두 개의 IP 주소**를 복사합니다.

6. **알리고에 등록**  
   - 알리고 관리자 페이지 → **연동형 API** → **발송 IP** 메뉴로 이동  
   - 위에서 복사한 **두 IP를 모두** 발송 IP로 등록합니다.

### 3-3. 참고 사항 (Static IPs)

- **지역별로 IP가 다릅니다.**  
  - 함수가 실행되는 지역과 Static IPs에서 선택한 지역이 맞아야, 그 지역의 IP로 나갑니다.  
  - 알리고는 한국 서비스이므로, 가능하면 **동아시아/한국 리전**을 쓰고, 그 리전의 Static IP를 등록하는 것이 좋습니다.
- **Middleware / Edge** 트래픽은 Static IP를 타지 않습니다.  
  - 문자 발송처럼 **Serverless Function(API Route)** 에서만 나가는 요청만 Static IP를 사용합니다.
- **빌드 시 외부 호출**도 같은 IP로 나가게 하려면,  
  - Connectivity 설정에서 **“Use Static IPs for builds”** 를 켜면 됩니다 (선택 사항).

---

## 4. Secure Compute 사용 시 (Enterprise)

- **Enterprise** 플랜에서만 제공됩니다.
- 전용 VPC에 **전용 고정 IP 쌍**이 부여됩니다.
- 설정 절차는 팀 설정의 **Connectivity** → **Secure Compute**에서:
  1. Private Network 생성 (리전 선택)
  2. 표시되는 **전용 IP 쌍** 복사
  3. 해당 프로젝트를 이 네트워크에 연결
  4. 복사한 IP를 알리고 발송 IP에 등록

자세한 단계는 Vercel 문서의 [Secure Compute](https://vercel.com/docs/connectivity/secure-compute), [How to allowlist deployment IP](https://vercel.com/kb/guide/how-to-allowlist-deployment-ip-address)를 참고하면 됩니다.

---

## 5. Hobby 플랜일 때 할 수 있는 것

- Vercel에서는 **고정 아웃바운드 IP를 제공하지 않으므로**,  
  “Vercel의 IP 대역”을 알리고에 등록하는 것은 **불가능**합니다.
- 대신 다음 같은 방법을 쓸 수 있습니다.
  1. **로컬/고정 IP 서버에서만 발송**  
     - 개발 PC나 고정 IP가 있는 서버에서만 알리고 API를 호출하고, 해당 IP만 알리고에 등록.
  2. **프록시 서버 사용**  
     - Vercel API Route는 “고정 IP를 가진 다른 서버”를 호출하고, 그 서버가 알리고 API를 호출.  
     - 그 서버의 IP만 알리고에 등록.
  3. **Pro로 업그레이드 후 Static IPs 사용**  
     - 위 3번처럼 설정 후, 표시되는 IP를 알리고에 등록.

---

## 6. 정리

- **Vercel의 아웃바운드 IP**를 쓰려면:
  - **Pro/Enterprise + Static IPs** → 프로젝트 **Settings → Connectivity** 에서 지역 선택 후 **표시되는 IP 쌍**을 복사해 알리고 발송 IP에 등록.
  - **Enterprise + Secure Compute** → 전용 네트워크 생성 후 **대시보드에 표시되는 전용 IP 쌍**을 알리고에 등록.
- **Hobby** 또는 Static IPs를 쓰지 않으면, Vercel에서 나가는 요청의 “고정 IP”를 알리고에 등록하는 방법은 없고, **다른 환경(로컬/프록시/고정 IP 서버)** 에서만 발송하거나, **Pro 이상 + Static IPs** 를 사용해야 합니다.

**공식 문서:**

- [Static IPs](https://vercel.com/docs/connectivity/static-ips)
- [Static IPs Getting Started](https://vercel.com/docs/connectivity/static-ips/getting-started)
- [How to allowlist deployment IP address](https://vercel.com/kb/guide/how-to-allowlist-deployment-ip-address)
- [Can I get a fixed IP address for my Vercel deployments?](https://vercel.com/kb/guide/can-i-get-a-fixed-ip-address)
