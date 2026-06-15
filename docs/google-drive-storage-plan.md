# Google Drive API 연동 저장소 기획

사건관리 메모·자료실, 메신저 기록·첨부파일 등 **용량이 큰 파일**을 Google Drive에 저장하기 위한 단계별 기획입니다.

---

## 1. 현황 정리

| 구역 | 데이터 | 현재 저장소 | 용량 이슈 |
|------|--------|-------------|------------|
| **사건관리 좌하단** | 메모 기록 | localStorage (`lawygo_case_memos`) | 텍스트 위주 → 상대적으로 작음 |
| **사건관리 우하단** | 자료실 파일·폴더 | localStorage (`lawygo_case_files`, `lawygo_case_folders`) | 파일을 base64/data URL로 저장 시 **용량·한계 심함** |
| **결재관리** | 자료실(폴더·파일) | localStorage (`lawygo_approval_archives`) | 동일 |
| **사내 메신저** | 메시지 + 첨부 | localStorage (`lawygo_internal_messages`) | `attachmentData` base64 → **용량 부담 큼** |

**목표**: 위 파일(바이너리·대용량)만 **Google Drive**에 올리고, 메타정보(메모 텍스트, 파일 목록·경로 등)는 기존처럼 DB/localStorage 또는 Drive 메타만 사용.

---

## 2. Google Drive 연동 전제

- **GCP 프로젝트** 생성 후 **Google Drive API** 사용 설정
- **OAuth 2.0** (또는 서비스 계정) 클라이언트 ID/Secret 발급
- **저장 주체**: 팀 단위 1개 Drive 계정 vs 사용자별 Drive
  - **팀 단위**: 서비스 계정 또는 단일 Google 계정의 Drive에 “LawyGo” 전용 폴더
  - **사용자별**: 각 사용자 Google 로그인 후 본인 Drive에 “LawyGo” 앱 데이터 폴더  
→ 기획 1단계에서 **팀 단위(서비스 계정 또는 단일 계정)** 로 시작하는 것을 권장.

---

## 3. Drive 폴더 구조 제안

```
LawyGo/                          # 루트 앱 폴더
├── Cases/                       # 사건관리
│   └── {caseId}/                # 사건번호 또는 id
│       ├── memos/               # (선택) 메모를 파일로 백업할 경우
│       └── files/               # 자료실 파일
│           └── {fileId}.{ext}
├── Messenger/                   # 사내 메신저
│   └── attachments/
│       └── {messageId}_{index}_{filename}
└── Approval/                    # 결재관리 자료실
    └── {approvalDocId}/
        └── {fileId}.{ext}
```

- 실제 구현 시 `caseId`는 사건번호 또는 내부 ID 중 하나로 통일.
- 메모는 텍스트만 있으므로 **메모 본문은 DB/localStorage 유지**, Drive에는 “파일”만 두는 구분을 권장.

---

## 4. 단계별 진행 제안

### Phase 0: 사전 준비 (1~2일)

| 순서 | 작업 | 추천 내용 |
|------|------|-----------|
| 0-1 | GCP 프로젝트 | [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트 생성 |
| 0-2 | Drive API 사용 | API 및 서비스 → 라이브러리 → “Google Drive API” 사용 설정 |
| 0-3 | 인증 정보 | OAuth 2.0 클라이언트 ID(웹 앱) 또는 서비스 계정 키 생성. **서비스 계정**이면 “팀 공용 Drive” 구성이 단순함 |
| 0-4 | 환경 변수 | `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, (서비스 계정 시) `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON` 등 `.env`에 추가 |
| 0-5 | 패키지 | `googleapis` 등 Drive API 클라이언트 설치 |

**산출물**: GCP 프로젝트, Drive API 활성화, 인증 정보·env 정리.

---

### Phase 1: Drive 인프라 및 공통 레이어 (3~5일)

| 순서 | 작업 | 추천 내용 |
|------|------|-----------|
| 1-1 | 서버 전용 Drive 클라이언트 | `src/lib/googleDriveClient.ts` (또는 `server/googleDrive.ts`)에서 **서버에서만** 호출하는 Drive API 래퍼 구현. OAuth 토큰 또는 서비스 계정으로 초기화 |
| 1-2 | 루트 폴더 확보 | “LawyGo” 루트 폴더가 없으면 생성, 있으면 ID 조회. 이후 모든 폴더/파일은 이 루트 하위에 생성 |
| 1-3 | 폴더 생성 유틸 | `Cases/{caseId}/files`, `Messenger/attachments`, `Approval/{docId}` 등 **경로 → folderId** 생성/조회 함수 (중복 생성 방지) |
| 1-4 | API 라우트 스켈레톤 | 예: `POST /api/drive/upload`, `GET /api/drive/files/:id`, `GET /api/drive/download/:id` 등. 내부적으로 1-1~1-3 호출 |
| 1-5 | 권한·에러 처리 | Drive API 오류 시 4xx/5xx 및 클라이언트 메시지 정리. (선택) 로깅·모니터링 |

**산출물**: Drive 클라이언트, 루트/하위 폴더 생성 로직, 업로드/다운로드용 API 스켈레톤.

**진행 추천**: 이 단계가 끝나야 “파일 하나 올리기/받기”가 서버 경유로 동작함. 여기까지 완료 후 Phase 2로.

---

### Phase 2: 사건관리 우하단 자료실 → Drive (5~7일)

| 순서 | 작업 | 추천 내용 |
|------|------|-----------|
| 2-1 | 저장소 추상화 | `caseScopedStorage` 또는 별도 `caseFileStorage.ts`에서 **저장소 타입**: `local` | `google_drive`. 환경/설정에 따라 분기 |
| 2-2 | 업로드 플로우 | 자료실 “파일 추가” 시: (1) 기존처럼 클라이언트에서 파일 선택 (2) `FormData`로 `POST /api/drive/upload` 호출 (3) 응답으로 `fileId`, `webViewLink` 등 저장 |
| 2-3 | 메타만 localStorage/DB | `lawygo_case_files`에는 **파일명, 크기, mimeType, driveFileId, (선택) webViewLink**만 저장. base64/data URL 제거 |
| 2-4 | 다운로드/미리보기 | 목록 클릭 시 `GET /api/drive/download/:id` 또는 `webViewLink`로 열기. 필요 시 signed URL 또는 서버 프록시 |
| 2-5 | 폴더 구조 반영 | 사건별 폴더 `Cases/{caseId}/files` 사용. 폴더 UI가 있으면 Drive 쪽에도 동일 구조로 서브폴더 생성 |
| 2-6 | 기존 데이터 이전 | 기존 localStorage에 base64로 있던 파일은 “한 번에 이전” 스크립트/UI로 Drive 업로드 후 메타만 남기거나, “다음부터만 Drive” 정책으로 신규만 Drive 사용 |

**산출물**: 사건 자료실의 “파일”이 Drive에 저장되고, 앱에서는 메타·다운로드 링크만 사용.

**진행 추천**: 사건관리가 가장 구조가 명확하고 사용 빈도가 높으므로 **첫 적용 구간**으로 추천.

---

### Phase 3: 사내 메신저 첨부파일 → Drive (3~5일)

| 순서 | 작업 | 추천 내용 |
|------|------|-----------|
| 3-1 | 메시지 저장 분리 | `internalMessengerStorage`: `attachmentData`(base64) 대신 **driveFileId 목록** 저장. 본문·발신자 등은 기존처럼 localStorage 또는 추후 DB로 |
| 3-2 | 발송 시 업로드 | 메신저 “전송” 시 첨부가 있으면 먼저 `POST /api/drive/upload` (경로: `Messenger/attachments/`) 호출 → 받은 `fileId`를 메시지에 포함해 저장 |
| 3-3 | 수신/채팅에서 다운로드 | “받기” 클릭 시 `GET /api/drive/download/:id` 또는 미리보기 URL 사용 |
| 3-4 | 용량 제한·정책 | 업로드 API에서 파일 크기 상한 (예: 20MB), 확장자 화이트리스트 적용. 메신저 전용이라 동일 정책 재사용 가능 |

**산출물**: 메신저 첨부가 Drive에만 저장되고, 메시지 JSON은 가벼워짐.

**진행 추천**: Phase 2와 동일한 Drive 클라이언트/API를 재사용하므로, Phase 2 완료 후 진행하면 빠름.

---

### Phase 4: 결재관리 자료실 → Drive (3~4일)

| 순서 | 작업 | 추천 내용 |
|------|------|-----------|
| 4-1 | approval archives 메타 | `lawygo_approval_archives` 구조 유지하되, “파일” 항목에 **driveFileId** (및 필요 시 webViewLink) 추가. 기존 displayName, folderId 등 유지 |
| 4-2 | 드래그 추가 시 업로드 | 결재 문서를 자료실로 드래그할 때 파일이 있으면 Drive 업로드 후 메타만 저장 |
| 4-3 | 폴더 구조 | `Approval/{approvalDocId}/` 또는 관리번호 기반 폴더. 내부 정책에 맞게 이름 규칙 통일 |

**산출물**: 결재관리 자료실 파일도 Drive 저장, 메타는 기존 스토리지 유지.

---

### Phase 5: 사건관리 좌하단 메모 (선택)

| 순서 | 작업 | 추천 내용 |
|------|------|-----------|
| 5-1 | 정책 결정 | 메모는 **텍스트**라 localStorage만으로도 용량 부담이 적음. “백업/동기화” 목적이면 Drive에 텍스트 파일로 저장하는 옵션 추가 |
| 5-2 | 구현 | 메모 저장 시 (선택) `Cases/{caseId}/memos/` 에 `{memoId}.txt` 또는 JSON 업로드. 주 기능은 기존 localStorage 유지하고, “Drive 백업” 버튼 정도로 제한해도 됨 |

**진행 추천**: 우선순위는 낮게 두고, Phase 2~4 안정화 후 필요 시 도입.

---

## 5. 공통 권장 사항

- **저장소 추상화**: “파일 저장소 = localStorage vs Drive”를 한 레이어에서 분기하도록 두면, 나중에 다른 스토리지(S3 등)로 바꾸기 쉬움.
- **에러·권한**: Drive API 할당량·권한 오류 시 사용자에게 “Google Drive 연결을 확인해 주세요” 등 메시지 노출.
- **보안**: 업로드/다운로드 API는 **로그인 세션 검사** 후 호출. Drive 쪽은 서비스 계정 또는 전용 계정만 사용하고, 클라이언트에 키 노출 금지.
- **환경 분리**: 개발/스테이징용 GCP 프로젝트(또는 폴더)를 두고, 프로덕션과 구분해 테스트.

---

## 6. 요약 체크리스트

| Phase | 내용 | 우선순위 |
|-------|------|----------|
| 0 | GCP·Drive API·인증·env | 필수 |
| 1 | Drive 클라이언트, 루트/폴더, 업/다운 API | 필수 |
| 2 | 사건관리 자료실 파일 → Drive | 1순위 |
| 3 | 메신저 첨부 → Drive | 2순위 |
| 4 | 결재관리 자료실 → Drive | 3순위 |
| 5 | 메모 Drive 백업 (선택) | 선택 |

위 순서대로 진행하면, 용량이 큰 파일부터 단계적으로 Google Drive로 이전할 수 있습니다.
