/**
 * 클라이언트 세션에서 작업 관리번호 읽기 (이력·로컬 저장 테넌트 키)
 */

export function getSessionManagementNumber(): string {
  if (typeof window === "undefined") return "";
  try {
    const cookie = document.cookie.split(";").find((c) => c.trim().startsWith("lawygo_session="));
    if (!cookie) return "";
    const payload = cookie.split("=")[1]?.split(".")[0];
    if (!payload) return "";
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as {
      activeManagementNumber?: string;
      managementNumber?: string;
    };
    return (decoded.activeManagementNumber ?? decoded.managementNumber ?? "").trim();
  } catch {
    return "";
  }
}

export function getSessionAccountLabel(): string {
  if (typeof window === "undefined") return "관리자";
  try {
    const cookie = document.cookie.split(";").find((c) => c.trim().startsWith("lawygo_session="));
    if (!cookie) return "관리자";
    const payload = cookie.split("=")[1]?.split(".")[0];
    if (!payload) return "관리자";
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as {
      name?: string;
      loginId?: string;
    };
    return decoded.name ?? decoded.loginId ?? "관리자";
  } catch {
    return "관리자";
  }
}
