/**
 * LawyGo 전문 게시판 설정 (G6 게시판 ID 매핑 + AI·문서 엔진)
 * API와 프론트에서 동일한 목록 사용
 */

export interface BoardItem {
  id: string;
  name: string;
  description?: string;
}

/** G6 연동 게시판 (general→free, notice→notice, case_memo는 G6 관리자에서 생성 필요) */
export const BOARD_LIST: BoardItem[] = [
  { id: "case_memo", name: "사건 메모", description: "사건별 메모·진행 기록 (G6 bo_table: case_memo)" },
  { id: "notice", name: "공지사항", description: "사무소 공지 (G6 기본 notice)" },
  { id: "general", name: "자유게시판", description: "업무·자료 공유 (G6 free 게시판)" },
];

/** AI·문서 엔진 기능 (Gemini 연동) */
export interface AiFeatureItem {
  id: string;
  name: string;
  description: string;
  systemPrompt?: string; // Gemini 시스템 프롬프트 요약
}

export const AI_FEATURES: AiFeatureItem[] = [
  {
    id: "legal_encyclopedia",
    name: "로이고법률백과",
    description: "특허 기반 AI 딥러닝·순위화·온라인 법률정보사전·모범답안 (다면적 프레임 UI)",
    systemPrompt: "온톨로지·자질값·의미벡터·순위화·문자열사전·모범답안",
  },
  { id: "case_search", name: "판례 자동 추천", description: "현재 사건과 유사한 판례 검색·쟁점 파악", systemPrompt: "판례 검색 및 유사 판례 추천" },
  { id: "doc_summary", name: "판결문 PDF·이미지 요약", description: "PDF·스캔 이미지 OCR 후 구조화된 포맷으로 빠르게 요약", systemPrompt: "판결문 요약" },
  { id: "doc_draft", name: "법률문서 자동작성", description: "법률문서 형식에 맞도록 검증된 초안 작성", systemPrompt: "법률 서면 초안 작성" },
  { id: "law_search", name: "법률검색", description: "법령·조문 검색", systemPrompt: "법령·조문 검색 및 해석" },
  { id: "ai_search", name: "AI 검색", description: "자연어 질의 검색", systemPrompt: "법률·판례 통합 검색" },
];
