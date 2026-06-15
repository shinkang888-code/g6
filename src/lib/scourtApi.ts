/**
 * 대법원 사법정보공유포털(openapi.scourt.go.kr) API 클라이언트
 *
 * 사건번호·당사자명으로 사건진행내역 등을 조회하려면
 * 1) 사법정보공유포털 회원가입 및 API 신청
 * 2) 인증키·엔드포인트 발급 후 .env에 설정
 * 3) 아래 함수의 실제 URL·파라미터를 포털 명세에 맞게 구현
 *
 * @see https://openapi.scourt.go.kr/
 * @see docs/scourt-case-search-integration.md
 */

const BASE_URL = process.env.SCOURT_OPENAPI_BASE ?? "https://openapi.scourt.go.kr";
const API_KEY = process.env.SCOURT_OPENAPI_KEY ?? "";

export interface ScourtCaseSearchParams {
  /** 사건번호 (예: 2026노107) */
  caseNumber: string;
  /** 당사자명 (원고/피고/의뢰인 등) */
  partyName: string;
  /** 관할법원 코드 (포털 명세 참고) */
  courtCode?: string;
}

export interface ScourtCaseResult {
  caseNumber: string;
  caseName?: string;
  court?: string;
  status?: string;
  receivedDate?: string;
  nextDate?: string;
  parties?: string[];
  raw?: unknown;
}

/**
 * 사건조회/사건진행내역 API 호출 (실제 엔드포인트·파라미터는 포털 명세에 따름)
 * API 미승인 시 빈 배열 반환.
 */
export async function fetchCaseFromScourt(params: ScourtCaseSearchParams): Promise<ScourtCaseResult[]> {
  if (!API_KEY) {
    return [];
  }

  try {
    // TODO: 포털에서 발급한 실제 엔드포인트·쿼리 스펙으로 교체
    const query = new URLSearchParams({
      serviceKey: API_KEY,
      caseNo: params.caseNumber,
      partyName: params.partyName,
      ...(params.courtCode && { courtCode: params.courtCode }),
    });
    const url = `${BASE_URL}/api/case/search?${query.toString()}`;
    const res = await fetch(url, { next: { revalidate: 300 } });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    // TODO: 실제 응답 구조에 맞게 매핑
    if (Array.isArray(data.items)) {
      return data.items.map((item: unknown) => ({
        caseNumber: (item as Record<string, string>).caseNo ?? params.caseNumber,
        caseName: (item as Record<string, string>).caseName,
        court: (item as Record<string, string>).courtName,
        status: (item as Record<string, string>).status,
        receivedDate: (item as Record<string, string>).receivedDate,
        nextDate: (item as Record<string, string>).nextDate,
        parties: (item as Record<string, string[]>).parties,
        raw: item,
      }));
    }
    return [];
  } catch {
    return [];
  }
}
