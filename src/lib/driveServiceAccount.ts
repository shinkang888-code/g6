/**
 * Google Drive 서비스 계정 JSON 검증·인코딩
 */

export type ServiceAccountKey = {
  type?: string;
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

export type ValidatedServiceAccount = {
  clientEmail: string;
  projectId?: string;
};

function validateParsedKey(parsed: ServiceAccountKey): ValidatedServiceAccount {
  if (parsed.type && parsed.type !== "service_account") {
    throw new Error("서비스 계정(service_account) 키 파일이 아닙니다.");
  }
  const clientEmail = String(parsed.client_email ?? "").trim();
  const privateKey = String(parsed.private_key ?? "").trim();
  if (!clientEmail || !privateKey) {
    throw new Error("client_email 또는 private_key가 없습니다. GCP 서비스 계정 키 JSON을 사용하세요.");
  }
  return {
    clientEmail,
    projectId: parsed.project_id?.trim() || undefined,
  };
}

/** 브라우저·공용: JSON 텍스트 검증 */
export function validateServiceAccountJsonText(text: string): ValidatedServiceAccount {
  let parsed: ServiceAccountKey;
  try {
    parsed = JSON.parse(text) as ServiceAccountKey;
  } catch {
    throw new Error("유효한 JSON 파일이 아닙니다.");
  }
  return validateParsedKey(parsed);
}

/** 서버: JSON 텍스트 → base64 */
export function parseServiceAccountJsonText(text: string): ValidatedServiceAccount & {
  credentialsBase64: string;
} {
  const validated = validateServiceAccountJsonText(text);
  const credentialsBase64 = Buffer.from(text, "utf-8").toString("base64");
  return { ...validated, credentialsBase64 };
}

export function serviceAccountEmailFromBase64(credentialsBase64: string): string | null {
  try {
    const json = Buffer.from(credentialsBase64, "base64").toString("utf-8");
    const parsed = JSON.parse(json) as ServiceAccountKey;
    return parsed.client_email?.trim() || null;
  } catch {
    return null;
  }
}

/** 브라우저: JSON 텍스트 → base64 */
export function encodeServiceAccountJsonForStorage(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}
