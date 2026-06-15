/**
 * API 라우트용 테넌트·작성자 컨텍스트
 */

import type { SessionPayload } from "@/lib/authSession";
import type { BridgeContext } from "@/lib/boardBridge";

export function getTenantManagementNumber(session?: SessionPayload | null): string {
  if (!session) return "";
  return (
    session.activeManagementNumber?.trim() ||
    session.managementNumber?.trim() ||
    ""
  );
}

export function bridgeContextFromSession(session: SessionPayload): BridgeContext {
  return {
    managementNumber: getTenantManagementNumber(session),
    authorName: session.name || session.loginId || "관리자",
    authorLoginId: session.loginId,
  };
}
