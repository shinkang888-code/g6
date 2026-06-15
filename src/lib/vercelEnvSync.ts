/**
 * Vercel 프로젝트 환경 변수 동기화 (로컬 개발 전용)
 */

import { readFile } from "fs/promises";
import { join } from "path";
import { readEnvLocal } from "@/lib/envLocalFile";

const VERCEL_API = "https://api.vercel.com";

export type VercelProjectLink = {
  projectId: string;
  orgId?: string;
  projectName?: string;
};

export type VercelEnvSyncResult = {
  projectId: string;
  projectName?: string;
  synced: string[];
  skipped: string[];
};

type VercelEnvRow = {
  id: string;
  key: string;
  target?: string[];
};

export async function readVercelProjectLink(): Promise<VercelProjectLink | null> {
  const fromEnvId = process.env.VERCEL_PROJECT_ID?.trim();
  const fromEnvOrg = process.env.VERCEL_ORG_ID?.trim();
  if (fromEnvId) {
    return {
      projectId: fromEnvId,
      orgId: fromEnvOrg || undefined,
      projectName: process.env.VERCEL_PROJECT_NAME?.trim() || undefined,
    };
  }

  try {
    const content = await readFile(join(process.cwd(), ".vercel/project.json"), "utf-8");
    const json = JSON.parse(content) as {
      projectId?: string;
      orgId?: string;
      projectName?: string;
    };
    if (!json.projectId?.trim()) return null;
    return {
      projectId: json.projectId.trim(),
      orgId: json.orgId?.trim() || undefined,
      projectName: json.projectName?.trim() || undefined,
    };
  } catch {
    return null;
  }
}

export async function resolveVercelAccessToken(): Promise<string | null> {
  const fromEnv =
    process.env.VERCEL_TOKEN?.trim() ||
    process.env.VERCEL_ACCESS_TOKEN?.trim() ||
    null;
  if (fromEnv) return fromEnv;

  const local = await readEnvLocal();
  return (
    local.VERCEL_ACCESS_TOKEN?.trim() ||
    local.VERCEL_TOKEN?.trim() ||
    null
  );
}

export type VercelEnvSyncStatus = {
  project: VercelProjectLink | null;
  hasToken: boolean;
  ready: boolean;
  hint: string | null;
};

export async function getVercelEnvSyncStatus(): Promise<VercelEnvSyncStatus> {
  const project = await readVercelProjectLink();
  const hasToken = Boolean(await resolveVercelAccessToken());

  if (!project && !hasToken) {
    return {
      project: null,
      hasToken: false,
      ready: false,
      hint: "프로젝트 연결(`vercel link`)과 Vercel Access Token이 필요합니다.",
    };
  }
  if (!project) {
    return {
      project: null,
      hasToken,
      ready: false,
      hint: "`.vercel/project.json`이 없습니다. 프로젝트 루트에서 `vercel link`를 실행하세요.",
    };
  }
  if (!hasToken) {
    return {
      project,
      hasToken: false,
      ready: false,
      hint: ".env.local에 VERCEL_ACCESS_TOKEN=발급토큰 을 넣거나, 관리자 > 국가법령정보 API 화면에서 저장하세요.",
    };
  }

  return {
    project,
    hasToken: true,
    ready: true,
    hint: null,
  };
}

async function vercelApi(
  token: string,
  path: string,
  options: RequestInit = {},
  teamId?: string
): Promise<Response> {
  const url = new URL(`${VERCEL_API}${path}`);
  if (teamId) url.searchParams.set("teamId", teamId);
  return fetch(url.toString(), {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
}

async function listProjectEnvs(
  token: string,
  project: VercelProjectLink
): Promise<VercelEnvRow[]> {
  const res = await vercelApi(token, `/v9/projects/${project.projectId}/env`, {}, project.orgId);
  const json = (await res.json().catch(() => ({}))) as { envs?: VercelEnvRow[]; error?: { message?: string } };
  if (!res.ok) {
    throw new Error(json.error?.message ?? `Vercel env 목록 조회 실패 (${res.status})`);
  }
  return Array.isArray(json.envs) ? json.envs : [];
}

async function deleteProjectEnv(
  token: string,
  project: VercelProjectLink,
  envId: string
): Promise<void> {
  const res = await vercelApi(
    token,
    `/v9/projects/${project.projectId}/env/${envId}`,
    { method: "DELETE" },
    project.orgId
  );
  if (!res.ok && res.status !== 404) {
    const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(json.error?.message ?? `Vercel env 삭제 실패 (${res.status})`);
  }
}

async function createProjectEnv(
  token: string,
  project: VercelProjectLink,
  key: string,
  value: string
): Promise<void> {
  const res = await vercelApi(
    token,
    `/v10/projects/${project.projectId}/env`,
    {
      method: "POST",
      body: JSON.stringify({
        key,
        value,
        type: "encrypted",
        target: ["production", "preview", "development"],
      }),
    },
    project.orgId
  );
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(json.error?.message ?? `Vercel env 생성 실패: ${key} (${res.status})`);
  }
}

/** 동일 키가 있으면 삭제 후 production·preview·development에 재등록 */
export async function syncEnvVarsToVercel(
  vars: Record<string, string>,
  options?: { excludeKeys?: Set<string> }
): Promise<VercelEnvSyncResult> {
  const project = await readVercelProjectLink();
  if (!project) {
    throw new Error("연결된 Vercel 프로젝트를 찾을 수 없습니다. `vercel link`를 실행하세요.");
  }

  const token = await resolveVercelAccessToken();
  if (!token) {
    throw new Error(
      "Vercel Access Token이 없습니다. Vercel → Settings → Tokens에서 발급 후 VERCEL_ACCESS_TOKEN에 저장하세요."
    );
  }

  const exclude = options?.excludeKeys ?? new Set<string>();
  const entries = Object.entries(vars).filter(
    ([key, value]) => !exclude.has(key) && value.trim().length > 0
  );

  if (entries.length === 0) {
    throw new Error("Vercel에 반영할 환경 변수가 없습니다.");
  }

  const existing = await listProjectEnvs(token, project);
  const synced: string[] = [];

  for (const [key, value] of entries) {
    const matches = existing.filter((row) => row.key === key);
    for (const row of matches) {
      await deleteProjectEnv(token, project, row.id);
    }
    await createProjectEnv(token, project, key, value.trim());
    synced.push(key);
  }

  return {
    projectId: project.projectId,
    projectName: project.projectName,
    synced,
    skipped: [],
  };
}
