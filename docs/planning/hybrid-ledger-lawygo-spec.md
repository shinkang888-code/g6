# LawyGo 하이브리드 분산 원장(HDL) 반영 기획·개발명세서

> **버전:** v1.0 · 2026-06-14  
> **근거 특허:**  
> - (KR) 외부 앵커링 및 신원 해시 강결합 기반 리플레이 복구형 하이브리드 분산 원장 시스템  
> - (US Provisional) Identity-Bound Hybrid Distributed Ledger Transaction System with External Anchoring (2026-02-26)  
> **목표:** 처리속도(TPS)를 유지하면서, 이용자 신뢰·데이터 보안을 강화할 **최소 침습적** HDL 도입 범위와 구현 설계

---

## 1. 요약 (Executive Summary)

### 1.1 결론 한 줄

LawyGo는 **전체 DB를 블록체인화하지 않고**, **감사·결재·재무·관리자 조작** 등 **신뢰가 법적·경제적으로 중요한 이벤트만** 특허의 **신원-거래 강결합(H_v→H_i) + 비동기 Merkle 블록 + 주기적 외부 앵커 + 리플레이 복구** 파이프라인에 편입하는 것이 최적이다.

### 1.2 설계 원칙

| 원칙 | 내용 |
|------|------|
| **핫패스 분리** | 사용자 요청 처리 경로에는 `INSERT audit + enqueue`만 (< 5ms 목표). Merkle·앵커·Replay는 백그라운드 |
| **선택적 적용** | 일반 CRUD(마감·일정·메모)는 기존 Supabase RLS 유지. HDL 미적용 |
| **기존 감사 확장** | `case_audit_logs` 등을 **폐기하지 않고** HDL 레이어로 **증강** |
| **테넌트 격리** | `management_number` 단위 체인·블록 분리 |
| **외부 앵커 경량화** | 풀노드 블록체인 대신 **OpenTimestamps / 공증 API / 저비용 L2** 우선 |

---

## 2. 특허 기술 구조화 (학습 요약)

### 2.1 핵심 암호학적 수식

```
H_v = SHA-256(UserID ‖ VerificationResult ‖ Timestamp)     // 신원 확인 해시
H_i = SHA-256(H_{i-1} ‖ Trans_Data ‖ H_v)                  // 신원-거래 강결합 해시
R_L = MerkleRoot(H_i[], H_{i+1}[], …)                       // 로컬 블록 머클 루트
R_E = ExternalAnchor(R_L, BH_ext)                           // 외부 앵커 (한국특허: 블록높이 역기록)
Anchor_US = Hash(BlockHash + Timestamp)                       // 미국특허 실시예
```

### 2.2 모듈 ↔ 특허 부호 매핑

| 부호 | 모듈 | 기능 |
|------|------|------|
| **210** | 신원 강결합 해싱 | H_v 생성, 승인(approved) 시에만 유효 H_v (청구항 3) |
| **220** | 계층적 무결성 검증 | 1단계 H_i → 2단계 Merkle/블록 → 3단계 외부앵커 (청구항 10) |
| **230** | 리플레이 복구 | Restore 아님. Last Valid Block 이후 원본 로그 재연산 |
| **240** | 협상 이벤트 체이닝 | E_p(제안) → E_r(수정) → E_a(합의), 참조 해시 포함 |
| **500** | 로컬 원장 DB | 510 원본 로그 + 520 해시체인·Merkle 저장 |

### 2.3 한국 vs 미국 특허 차이

| 항목 | 한국 (개선) | 미국 (Provisional) |
|------|-------------|-------------------|
| H_i에 H_v 포함 | **명시·청구항 1·5** | Detailed Description §5에 명시 |
| 블록높이 역기록 BH_ext | **청구항 8, 도6** | Timestamp 중심 |
| Merkle Path 핀포인트 | **청구항 7** | 블록 단위 위주 |
| Write-Once 물리 구조 | **청구항 4** | Append-only 논리 구조 |
| 협상 모듈 | 240 (협상 기록) | 215 Negotiation module |
| 외부 네트워크 | 이종 블록체인 | 블록체인 + 타임스탬프 + 공증 CA |
| 적용 도메인 예시 | 전자거래 일반 | **commodity, warehouse receipt, financial, digital asset, document verification** |

**LawyGo 관점:** 미국 특허의 *document verification*·*financial transaction* 항목이 **결재·재무·사건감사**와 직접 대응. 한국 특허의 **BH_ext·Merkle Path**는 감사 정밀도·사후 증명력 강화에 우선 반영.

### 2.4 특허가 해결하는 3대 취약점 → LawyGo 현황

| 특허 문제 | LawyGo 현재 | HDL 필요도 |
|-----------|-------------|------------|
| 신원·거래 논리 분리 | `authSession`과 `case_audit_logs.actor_id`가 **참조만** 연결 | **높음** |
| 수동 Restore 한계 | Supabase 백업·PITR만, **재검증 Replay 없음** | 중간 (DR/감사용) |
| 외부 증거력 부재 | 내부 로그만, **제3자 검증 불가** | 중간 (법률·재무 분쟁 대비) |

---

## 3. LawyGo 데이터 영역 현황 (As-Is)

### 3.1 신뢰·감사 관련 저장소

| 영역 | 테이블/모듈 | 기록 내용 | HDL 후보 |
|------|-------------|-----------|----------|
| 사건 감사 | `case_audit_logs`, `caseAuditLog.ts` | create/update/delete, changes JSONB | **Tier-1** |
| 회원·권한 감사 | `user_admin_audit_logs`, `userAdminAudit.ts` | 승인·퇴사·권한변경 | **Tier-1** |
| 전자결재 | `approvals`, `approval_actions` | submit/approve/reject | **Tier-1** (+ 협상 체인) |
| 보안 | `security_events`, `securityEventCollector.ts` | 위협·이상행위 | **Tier-2** |
| 재무 | `finance_entries`, `bank_transactions` | 입출금·매칭 | **Tier-1** |
| 사건 타임라인 | `timeline` | 사건 이벤트 | Tier-2 |
| 법률백과 | `legal_usage_records`, `encyclopedia_artifacts` | AI 학습·산출물 | Tier-3 |
| 인증 | `authSession.ts`, `site_users` | 세션 HMAC | **H_v 소스** |
| 파일 | Google Drive | cases/{id}/files | Tier-2 (해시 메타만) |
| 일반 CRUD | `cases`, `deadlines`, `clients` | 업무 데이터 | **HDL 제외** |

### 3.2 현재 감사 로그 한계 (코드 기준)

`insertCaseAuditLog`는 actor를 세션에서 읽어 **별도 row**로 저장한다. 신원(H_v)과 거래 payload(changes) 사이에 **암호학적 결합이 없다**.

```typescript
// src/lib/caseAuditLog.ts — 현재: 논리적 연결만
const row = {
  actor_id: session?.userId ?? null,
  changes,
  // H_v, H_i, prev_hash 없음
};
```

관리자가 DB에서 `actor_id`만 바꿔도 **해시 체인이 깨지지 않는다** → 특허가 지적한 **내부자 위변조** 취약점과 동일.

---

## 4. 반영 대상 Tier 분류 (핵심 의사결정)

### 4.1 Tier-1 — HDL 필수 (P0)

**기준:** 법적 분쟁·내부 감사·재무 증빙에 직접 쓰이며, **주체 위조** 시 피해가 큰 데이터.

| LawyGo 영역 | Trans_Data 예시 | 특허 모듈 | 동기/비동기 |
|-------------|-----------------|-----------|-------------|
| **로그인·세션 확립** | userId, verifyResult=approved, ts | 210 H_v | **동기** (세션 직후 H_v 캐시) |
| **사건 감사** | action, caseId, changes | 210→220 H_i | 비동기 append |
| **전자결재 액션** | approvalId, action, comment | 210→220 + **240 협상** | 비동기 append |
| **회원·권한 관리** | targetLoginId, action, changes | 210→220 H_i | 비동기 append |
| **재무 기록** | amount, caseId, type, status | 210→220 H_i | 비동기 append |

**처리속도:** API 응답 전 **H_v lookup + ledger queue push**만. 목표 **+3ms 이내**.

### 4.2 Tier-2 — HDL 권장 (P1)

| 영역 | 이유 | 모듈 |
|------|------|------|
| `security_events` | 위변조 탐지와 **220 3단계 검증** 연동 | 220 |
| `timeline` (중요 이벤트만) | 사건 경과 증명 | 220 |
| Drive 파일 메타 | `sha256(file)` + caseId를 Trans_Data로 체인 | 220 |

### 4.3 Tier-3 — 선택 (P2)

| 영역 | 이유 |
|------|------|
| `legal_usage_records` | AI 학습 무결성·출처 증명 (분쟁 시) |
| `encyclopedia_artifacts` | 산출물 버전 고정 |

### 4.4 HDL 명시 제외 (속도·비용)

- `cases`/`deadlines`/`clients` **일반 필드 CRUD** (감사 로그로만 Tier-1 커버)
- `internal_messages` 본문 (용량·TPS. 메타·첨부 해시만 Tier-2)
- `notifications` 읽음 처리
- 벡터 검색·AI 추론 **중간 결과**

---

## 5. 목표 아키텍처 (To-Be)

### 5.1 전체 구성도

```
[User 100] → [LawyGo API / Next.js 200]
                │
                ├─ (동기) Identity Module 210
                │     H_v = hash(userId + approved + ts)
                │     → Redis/Session: last_h_v (TTL 8h)
                │
                ├─ (동기 ~3ms) Ledger Enqueue
                │     INSERT ledger_transactions (pending)
                │     RETURN 200 to user
                │
                └─ (비동기 Worker / Cron)
                      Block Builder 220
                        N건 or T분 → Merkle Root R_L
                      Anchor Module 240
                        R_E → OpenTimestamps / L2
                        BH_ext 역기록
                      Integrity Scanner 220
                        H_i / Merkle / Anchor 3단계
                      Replay Engine 230 (on mismatch)
```

### 5.2 핫패스 vs 콜드패스

| 경로 | 작업 | SLA |
|------|------|-----|
| **핫패스** | H_v 조회, Trans_Data 직렬화, pending row insert | < 5ms p99 |
| **웜패스** | pending → H_i 계산, prev_hash 연결 | 1–5초 배치 |
| **콜드패스** | Merkle block, 외부 앵커 | 5–15분 or 500 tx |
| **DR패스** | Replay 복구 | 수동 트리거 + 감사 알림 |

### 5.3 신원-거래 강결합 (모듈 210) — LawyGo 매핑

**H_v 생성 시점**

1. **로그인 성공** (`/api/auth/login`) — VerificationResult = `approved`
2. **MFA/승인 완료** (향후)
3. **세션 갱신** — 8시간마다 H_v 재발급 (청구항 3: 승인 상태만)

**H_v 저장**

- `identity_verification_hashes` 테이블 (append-only)
- 세션 쿠키에는 `h_v_id` (UUID)만 참조 — H_v 원문은 서버·원장만

**H_i 생성 (비동기 워커)**

```typescript
// src/lib/ledger/hardBindingHash.ts (신규)
H_i = sha256(prev_hash + canonicalJson(trans_data) + h_v)
```

- `trans_data`에 **actor를 중복 포함** (감사 row와 동일 정보)
- `prev_hash`: 테넌트(`management_number`) + `stream`별 체인

**Stream 분리 (체인 폭주 방지)**

| stream | 설명 |
|--------|------|
| `case_audit` | case_audit_logs 연동 |
| `approval` | approval_actions 연동 |
| `user_admin` | user_admin_audit_logs |
| `finance` | finance_entries |
| `security` | security_events (Tier-2) |

### 5.4 협상 이벤트 체이닝 (모듈 240) — 전자결재

LawyGo `approvals` + `approval_actions`를 특허 E_p/E_r/E_a에 매핑:

| 특허 | LawyGo | 해시 |
|------|--------|------|
| E_p 제안 | `action=submit` | H_ep |
| E_r 수정 | 기안 수정·재상신 (metadata.version++) | H_er |
| E_a 합의 | 최종 `approve` 전원 완료 | H_ea = hash(H_ep + H_er[] + finalState) |

- `approval_actions` insert 시 **negotiation stream**에 추가 ledger tx
- 최종 합의 시 `approvals` row에 `agreement_hash` 역기록

### 5.5 계층적 무결성 검증 (모듈 220)

**1단계 — 거래:** `ledger_transactions.hash` vs 재계산 H_i  
**2단계 — 블록:** `ledger_blocks.merkle_root` vs tx hashes  
**3단계 — 외부:** `ledger_anchors.anchor_hash` vs R_L  

불일치 시 → `ledger_integrity_alerts` + Replay 230 트리거 (청구항 10).

**Merkle Path (한국특허):** 블록 내 변조 tx만 `tamper_tx_id`로 특정 — 전체 블록 폐기 불필요.

### 5.6 외부 앵커링 (모듈 240/8)

**1단계 (MVP):** [OpenTimestamps](https://opentimestamps.org/) — Bitcoin OP_RETURN, **비용 ≈ 0**  
**2단계:** Polygon/Base L2 `anchorHash(bytes32)` 컨트랙트  
**3단계:** 공인 타임스탬프(TSA) API — 법원 제출용

**BH_ext 역기록 (한국특허):**

```sql
ledger_anchors (
  block_id,
  merkle_root,
  anchor_hash,
  external_network,      -- 'opentimestamps' | 'polygon'
  external_block_height, -- BH_ext
  external_tx_id,
  anchored_at
)
```

### 5.7 리플레이 복구 (모듈 230)

**트리거:** 3단계 검증 실패, 관리자 수동 DR, 정기 무결성 스캔(주 1회)

**절차 (청구항 9):**

1. 외부 앵커와 일치하는 **Last Valid Block** 탐색  
2. 이후 `ledger_transactions.payload` (원본 로그) 순차 로드  
3. H_v 재조회 (`identity_verification_hashes`)  
4. H_i 재연산 → 기존 hash 대조  
5. 일치 tx만 `rebuilt_state`에 반영; 불일치 tx는 `tamper_report`  

**중요:** Supabase **PITR Restore와 병행** — HDL Replay는 **암호학적 재검증**, PITR는 **물리 복구**.

---

## 6. 데이터베이스 스키마 (신규)

### 6.1 테이블 설계

```sql
-- 신원 확인 해시 (append-only)
CREATE TABLE public.identity_verification_hashes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  verification_result TEXT NOT NULL CHECK (verification_result = 'approved'),
  verified_at TIMESTAMPTZ NOT NULL,
  h_v TEXT NOT NULL,
  session_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 원장 거래 (append-only, Write-Once 정책)
CREATE TABLE public.ledger_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  stream TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id UUID,
  trans_data JSONB NOT NULL,
  h_v_id UUID NOT NULL REFERENCES identity_verification_hashes(id),
  prev_hash TEXT,
  tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','chained','block_assigned','tampered')),
  block_id UUID,
  seq BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Merkle 블록
CREATE TABLE public.ledger_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  stream TEXT NOT NULL,
  block_height BIGINT NOT NULL,
  prev_block_hash TEXT,
  merkle_root TEXT NOT NULL,
  block_hash TEXT NOT NULL,
  tx_count INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, stream, block_height)
);

-- 외부 앵커
CREATE TABLE public.ledger_anchors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id UUID NOT NULL REFERENCES ledger_blocks(id),
  merkle_root TEXT NOT NULL,
  anchor_hash TEXT NOT NULL,
  external_network TEXT NOT NULL,
  external_block_height BIGINT,
  external_tx_id TEXT,
  anchor_proof JSONB,
  anchored_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 무결성 알림·변조 지점
CREATE TABLE public.ledger_integrity_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  tamper_point_tx_id UUID,
  details JSONB,
  replay_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 6.2 RLS·Write-Once 정책

- `ledger_*`, `identity_verification_hashes`: **INSERT only** (service_role + dedicated worker)
- **UPDATE/DELETE 금지** (DB trigger + RLS) — 청구항 4 Append-only 물리화
- `case_audit_logs` 등 기존 테이블은 **유지** — HDL은 병행 증거층

### 6.3 기존 테이블 확장 (최소)

```sql
ALTER TABLE case_audit_logs ADD COLUMN IF NOT EXISTS ledger_tx_id UUID;
ALTER TABLE approval_actions ADD COLUMN IF NOT EXISTS ledger_tx_id UUID;
ALTER TABLE user_admin_audit_logs ADD COLUMN IF NOT EXISTS ledger_tx_id UUID;
ALTER TABLE finance_entries ADD COLUMN IF NOT EXISTS ledger_tx_id UUID;
```

---

## 7. 모듈·파일 구조 (신규)

```
src/lib/ledger/
  identityHash.ts          # 210 H_v
  hardBindingHash.ts       # H_i 산출
  ledgerEnqueue.ts         # 핫패스 enqueue
  merkleTree.ts            # R_L
  blockBuilder.ts          # 배치 블록
  externalAnchor.ts        # OpenTimestamps / L2
  integrityScanner.ts      # 220 3단계
  replayEngine.ts          # 230
  negotiationChain.ts      # 240 결재용
  canonicalJson.ts         # Trans_Data 정규화

src/app/api/cron/ledger/
  chain-worker/route.ts    # pending → H_i
  block-worker/route.ts    # Merkle block
  anchor-worker/route.ts   # 외부 앵커
  integrity-scan/route.ts  # 주기 검증

supabase/migrations/
  YYYYMMDD_hybrid_ledger.sql
```

**기존 파일 수정 (최소 침습):**

| 파일 | 변경 |
|------|------|
| `src/lib/caseAuditLog.ts` | insert 후 `ledgerEnqueue({ stream:'case_audit', ... })` |
| `src/lib/userAdminAudit.ts` | 동일 |
| `src/app/api/approvals/[id]/route.ts` | approve/reject 시 negotiation + ledger |
| `src/app/api/auth/login/route.ts` | H_v 생성 |
| `src/lib/authSession.ts` | SessionPayload에 `h_v_id?` |

---

## 8. 처리속도·비용 영향 분석

### 8.1 예상 부하 (테넌트 50명, 일 500건 Tier-1 이벤트)

| 단계 | CPU | DB | 사용자 체감 |
|------|-----|-----|-------------|
| H_v 캐시 hit | ~0.1ms | 0 | 없음 |
| ledger pending insert | ~2ms | 1 INSERT | **무시 가능** |
| chain worker (500/day) | 배치 | 500 UPDATE | 없음 |
| block (96 blocks/day @5min) | ~50ms/block | 96 INSERT | 없음 |
| OpenTimestamps | 96 API/day | 96 INSERT | 없음 |

**결론:** Tier-1만 적용 시 **TPS 저하 없음**. 병목은 AI·Drive·Supabase 쿼리가 지배적.

### 8.2 HDL 미적용 시 리스크

- 내부 DBAdmin의 `actor_id`·`amount` 조작 **사후 부인 가능**
- 감사 로그만으로는 **외부 제3자 증명 불가**
- PITR 복구 시 **복구 데이터 무결성 미검증**

---

## 9. 이용자 신뢰·보안 효과

| 이해관계자 | 효과 |
|------------|------|
| **로펌 구성원** | 결재·사건 변경·재무 기록의 **주체 위조 불가** 인지 |
| **의뢰인** | (선택) 중요 서면·합의 시점 **타임스탬프 증명** 제공 |
| **감사·Compliance** | Merkle Path로 **변조 1건 특정**, Replay 리포트 |
| **경영진** | OpenTimestamps 등 **저비용 외부 앵커**로 분쟁 대응 |

---

## 10. 구현 로드맵

### Phase 0 — 설계·PoC (2주)

- [ ] `ledger_*` 마이그레이션 (dev)
- [ ] `identityHash` + `hardBindingHash` 단위 테스트
- [ ] `case_audit` stream PoC (10건 체인 검증)

### Phase 1 — Tier-1 핫패스 (3주)

- [ ] 로그인 H_v + case_audit / approval / user_admin / finance enqueue
- [ ] chain-worker Vercel Cron (1분)
- [ ] Admin UI: 체인 상태 read-only

### Phase 2 — Merkle·앵커 (2주)

- [ ] block-worker (500 tx or 15분)
- [ ] OpenTimestamps 연동 + BH_ext
- [ ] integrity-scan 주 1회

### Phase 3 — 결재 협상 체인 (2주)

- [ ] `negotiationChain.ts` + approval agreement_hash
- [ ] 분쟁 대응용 Merkle Proof export API

### Phase 4 — Replay·DR (2주)

- [ ] `replayEngine.ts` + `ledger_integrity_alerts` 알림
- [ ] Runbook 문서화

### Phase 5 — Tier-2/3 (선택)

- [ ] security_events, Drive file hash, legal_usage

---

## 11. 환경 변수·운영

```env
# .env.local / Vercel
LEDGER_ENABLED=true
LEDGER_CHAIN_CRON=* * * * *          # 1분
LEDGER_BLOCK_INTERVAL_MIN=15
LEDGER_BLOCK_TX_THRESHOLD=100
LEDGER_ANCHOR_PROVIDER=opentimestamps
OPENTIMESTAMP_CALENDAR=https://a.pool.opentimestamps.org
# LEDGER_ANCHOR_PROVIDER=polygon
# POLYGON_RPC_URL=
# POLYGON_ANCHOR_CONTRACT=
CRON_SECRET=
```

---

## 12. 비기능 요구사항

| 항목 | 목표 |
|------|------|
| 핫패스 지연 | p99 +5ms 이내 |
| 체인 처리 지연 | 이벤트 후 60초 이내 H_i 확정 |
| 앵커 지연 | 블록 생성 후 30분 이내 |
| 가용성 | ledger worker 실패 시 **업무 API 정상** (queue 적체 알림) |
| 테넌트 격리 | stream + tenant_id 체인 분리 |
| GDPR/개인정보 | H_v에 PII 최소화 (userId UUID, 이메일 미포함) |

---

## 13. 특허 청구항 ↔ LawyGo 구현 추적 매트릭스

| 청구항 | 요약 | LawyGo 구현 | Phase |
|--------|------|-------------|-------|
| 1 | H_v + H_i 강결합 | identityHash + hardBindingHash | 1 |
| 2 | Replay 복구 | replayEngine | 4 |
| 3 | 승인 시만 H_v | login approved only | 1 |
| 4 | Append-only | RLS INSERT-only + trigger | 0 |
| 5 | Atomic H_v+H_i | single worker transaction | 1 |
| 6 | 협상 체인 | negotiationChain + approval | 3 |
| 7 | Merkle Path | merkleTree + tamper_tx_id | 2 |
| 8 | BH_ext 역기록 | ledger_anchors.external_block_height | 2 |
| 9 | Replay 4단계 | replayEngine | 4 |
| 10 | 3단계 탐지 | integrityScanner | 2 |

---

## 14. Go / No-Go 의사결정 요약

| 데이터 | HDL | 이유 |
|--------|-----|------|
| 사건 감사·결재·재무·관리자 | **Go** | 신뢰·법적 증거력 |
| 로그인 세션 | **Go** | H_v 근원 |
| 보안·타임라인·파일해시 | **Later** | ROI 중간 |
| AI usage·백과 | **Optional** | 학습 출처 |
| 일반 CRUD·메신저·알림 | **No-Go** | 속도·비용 |

---

## 15. 참고

- 기존 감사: `src/lib/caseAuditLog.ts`, `src/lib/userAdminAudit.ts`
- 결재: `src/lib/approvalWorkflow.ts`, `approval_actions`
- 인증: `src/lib/authSession.ts`
- 법률백과 (별 특허): `docs/planning/legal-encyclopedia-unified-architecture.md`
- Supabase MCP: 마이그레이션 적용 전 `list_tables`로 충돌 확인

---

*본 문서는 특허 명세 분석 및 LawyGo 코드베이스 As-Is 조사를 바탕으로 한 기획·개발명세이며, 실제 특허 권리 범위 해석은 변리사 검토가 필요합니다.*
