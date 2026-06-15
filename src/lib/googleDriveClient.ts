/**
 * Google Drive API 클라이언트 (서버 전용)
 * 사건 자료실, 메신저 첨부, 결재 자료실 파일 저장
 */

import { Readable } from "stream";
import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { getAppBaseUrl } from "@/lib/appUrl";
import { createDriveOAuthClient } from "@/lib/driveOAuth";
import { getDriveSettings } from "./driveSettings";

const SCOPES = ["https://www.googleapis.com/auth/drive"];

type DriveAuthClient = InstanceType<typeof google.auth.GoogleAuth> | OAuth2Client;

let auth: DriveAuthClient | null = null;
let authKey = "";

async function getAuth(): Promise<DriveAuthClient | null> {
  const settings = await getDriveSettings();
  if (!settings.enabled) return null;

  const oauthToken = settings.oauthRefreshToken?.trim();
  const cacheKey = oauthToken
    ? `oauth:${oauthToken.slice(0, 16)}`
    : settings.credentialsBase64
      ? `sa:${settings.credentialsBase64.slice(0, 32)}`
      : "";

  if (!cacheKey) return null;
  if (auth && authKey === cacheKey) return auth;

  try {
    if (oauthToken) {
      const oauthClient = await createDriveOAuthClient(getAppBaseUrl(), oauthToken);
      if (!oauthClient) return null;
      auth = oauthClient;
      authKey = cacheKey;
      return auth;
    }

    if (!settings.credentialsBase64) return null;
    const json = Buffer.from(settings.credentialsBase64, "base64").toString("utf-8");
    const credentials = JSON.parse(json) as { client_email?: string; private_key?: string };
    if (!credentials.client_email || !credentials.private_key) return null;

    auth = new google.auth.GoogleAuth({
      credentials,
      scopes: SCOPES,
    });
    authKey = cacheKey;
    return auth;
  } catch {
    auth = null;
    authKey = "";
    return null;
  }
}

export function resetDriveAuthCache() {
  auth = null;
  authKey = "";
}

export async function getDriveClient() {
  const authClient = await getAuth();
  if (!authClient) return null;
  return google.drive({ version: "v3", auth: authClient });
}

const ROOT_NAME = "LawBoard";

/** 루트 폴더 ID 조회/생성 */
export async function getOrCreateRootFolder(
  drive: Awaited<ReturnType<typeof getDriveClient>>
): Promise<string | null> {
  if (!drive) return null;

  const settings = await getDriveSettings();
  if (settings.rootFolderId) return settings.rootFolderId;

  const { data } = await drive.files.list({
    q: `name='${ROOT_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    spaces: "drive",
    fields: "files(id,name)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  if (data.files?.length) return data.files[0].id ?? null;

  const { data: created } = await drive.files.create({
    requestBody: {
      name: ROOT_NAME,
      mimeType: "application/vnd.google-apps.folder",
    },
    fields: "id",
    supportsAllDrives: true,
  });
  return created.id ?? null;
}

/** 경로별 폴더 ID 조회/생성 (예: cases/{caseId}/files) */
export async function getOrCreateFolder(
  drive: Awaited<ReturnType<typeof getDriveClient>>,
  path: string
): Promise<string | null> {
  if (!drive) return null;

  const rootId = await getOrCreateRootFolder(drive);
  if (!rootId) return null;

  const segments = path.split("/").filter(Boolean);
  let parentId = rootId;

  for (const segment of segments) {
    const safeName = segment.replace(/'/g, "\\'");
    const { data } = await drive.files.list({
      q: `name='${safeName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      spaces: "drive",
      fields: "files(id,name)",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    let folderId = data.files?.[0]?.id;
    if (!folderId) {
      const { data: created } = await drive.files.create({
        requestBody: {
          name: segment,
          mimeType: "application/vnd.google-apps.folder",
          parents: [parentId],
        },
        fields: "id",
        supportsAllDrives: true,
      });
      folderId = created.id ?? null;
    }
    if (!folderId) return null;
    parentId = folderId;
  }
  return parentId;
}

export interface DriveUploadResult {
  fileId: string;
  name: string;
  mimeType: string;
  size?: number;
  webViewLink?: string;
}

/** 파일 업로드 (버퍼) */
export async function uploadFile(
  drive: Awaited<ReturnType<typeof getDriveClient>>,
  folderPath: string,
  fileName: string,
  buffer: Buffer,
  mimeType: string
): Promise<DriveUploadResult | null> {
  if (!drive) return null;

  const settings = await getDriveSettings();
  if (!settings.rootFolderId?.trim()) {
    throw new DriveUploadError(
      "STORAGE_QUOTA_SETUP",
      "Google Drive 업로드용 루트 폴더가 설정되지 않았습니다. 본인 Drive에 LawBoard 폴더를 만들고 서비스 계정을 편집자로 공유한 뒤, 관리자 > Google Drive 설정에서 루트 폴더 ID를 입력하세요."
    );
  }

  const parentId = await getOrCreateFolder(drive, folderPath);
  if (!parentId) return null;

  try {
    const { data } = await drive.files.create({
      requestBody: {
        name: sanitizeFileName(fileName),
        parents: [parentId],
      },
      media: {
        mimeType: mimeType || "application/octet-stream",
        body: Readable.from(buffer),
      },
      fields: "id,name,mimeType,size,webViewLink",
      supportsAllDrives: true,
    });

    if (!data.id) return null;
    return {
      fileId: data.id,
      name: data.name ?? fileName,
      mimeType: data.mimeType ?? mimeType,
      size: data.size ? Number(data.size) : undefined,
      webViewLink: data.webViewLink ?? undefined,
    };
  } catch (e) {
    const msg = extractDriveErrorMessage(e);
    if (isStorageQuotaError(msg)) {
      throw new DriveUploadError(
        "STORAGE_QUOTA",
        "서비스 계정 Drive에는 저장 공간이 없습니다. shinkang888@gmail.com Google Drive에 LawBoard 폴더를 공유하고, 관리자 > Google Drive에서 「업로드 권한 연결(OAuth)」을 완료하세요."
      );
    }
    throw e;
  }
}

export class DriveUploadError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function extractDriveErrorMessage(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: string }).message);
  return "";
}

function isStorageQuotaError(msg: string): boolean {
  return /storage quota|storageQuotaExceeded|do not have storage quota/i.test(msg);
}

/** 파일 다운로드용 버퍼 */
export async function getFileBuffer(
  drive: Awaited<ReturnType<typeof getDriveClient>>,
  fileId: string
): Promise<{ buffer: Buffer; mimeType?: string; fileName?: string } | null> {
  if (!drive) return null;

  const { data: meta } = await drive.files
    .get({
      fileId,
      fields: "name,mimeType",
      supportsAllDrives: true,
    })
    .catch(() => ({ data: null }));

  const res = await drive.files
    .get({ fileId, alt: "media", supportsAllDrives: true }, { responseType: "stream" })
    .catch(() => null);

  if (!res?.data) return null;

  const chunks: Buffer[] = [];
  const stream = res.data as Readable;
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return {
    buffer: Buffer.concat(chunks),
    mimeType: meta?.mimeType ?? undefined,
    fileName: meta?.name ?? undefined,
  };
}

function sanitizeFileName(name: string): string {
  return (name || "file")
    .replace(/[/\\:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .trim() || "file";
}

export async function isDriveAvailable(): Promise<boolean> {
  const drive = await getDriveClient();
  if (!drive) return false;
  try {
    const settings = await getDriveSettings();
    if (!settings.rootFolderId?.trim()) return false;
    if (!settings.oauthRefreshToken?.trim()) return false;

    const { data } = await drive.files.get({
      fileId: settings.rootFolderId.trim(),
      fields: "id,capabilities/canAddChildren",
      supportsAllDrives: true,
    });
    return Boolean(data.id && data.capabilities?.canAddChildren);
  } catch {
    return false;
  }
}

export async function getDriveServiceAccountEmail(): Promise<string | null> {
  const settings = await getDriveSettings();
  if (!settings.credentialsBase64) return null;
  try {
    const json = Buffer.from(settings.credentialsBase64, "base64").toString("utf-8");
    const credentials = JSON.parse(json) as { client_email?: string };
    return credentials.client_email ?? null;
  } catch {
    return null;
  }
}

export type DriveFileEntry = {
  fileId: string;
  name: string;
  mimeType: string;
  size?: number;
  webViewLink?: string;
  webContentLink?: string;
  createdTime?: string;
  modifiedTime?: string;
  parents?: string[];
  isFolder: boolean;
};

/** 폴더 내 직계 파일·폴더 목록 */
export async function listFilesInFolder(
  drive: NonNullable<Awaited<ReturnType<typeof getDriveClient>>>,
  folderId: string,
  options?: { pageToken?: string; pageSize?: number }
): Promise<{ files: DriveFileEntry[]; nextPageToken?: string }> {
  const { data } = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    spaces: "drive",
    fields: "nextPageToken, files(id,name,mimeType,size,webViewLink,webContentLink,createdTime,modifiedTime,parents)",
    pageSize: options?.pageSize ?? 100,
    pageToken: options?.pageToken,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    orderBy: "folder,name",
  });

  const files: DriveFileEntry[] = (data.files ?? []).map((f) => ({
    fileId: String(f.id),
    name: String(f.name ?? ""),
    mimeType: String(f.mimeType ?? ""),
    size: f.size ? Number(f.size) : undefined,
    webViewLink: f.webViewLink ?? undefined,
    webContentLink: f.webContentLink ?? undefined,
    createdTime: f.createdTime ?? undefined,
    modifiedTime: f.modifiedTime ?? undefined,
    parents: f.parents ?? undefined,
    isFolder: f.mimeType === "application/vnd.google-apps.folder",
  }));

  return { files, nextPageToken: data.nextPageToken ?? undefined };
}

/** 경로 하위 모든 파일 재귀 수집 (폴더 제외) */
export async function listAllFilesUnderPath(
  drive: NonNullable<Awaited<ReturnType<typeof getDriveClient>>>,
  folderPath: string,
  maxFiles = 500
): Promise<{ files: DriveFileEntry[]; basePath: string }> {
  const folderId = await getOrCreateFolder(drive, folderPath);
  if (!folderId) return { files: [], basePath: folderPath };

  const collected: DriveFileEntry[] = [];
  const queue: { id: string; relPath: string }[] = [{ id: folderId, relPath: "" }];

  while (queue.length > 0 && collected.length < maxFiles) {
    const current = queue.shift()!;
    let pageToken: string | undefined;
    do {
      const { files, nextPageToken } = await listFilesInFolder(drive, current.id, { pageToken });
      pageToken = nextPageToken;
      for (const f of files) {
        const rel = current.relPath ? `${current.relPath}/${f.name}` : f.name;
        if (f.isFolder) {
          queue.push({ id: f.fileId, relPath: rel });
        } else {
          collected.push({ ...f, name: rel });
        }
        if (collected.length >= maxFiles) break;
      }
    } while (pageToken && collected.length < maxFiles);
  }

  return { files: collected, basePath: folderPath };
}

/** 파일 메타 조회 */
export async function getFileMetadata(
  drive: NonNullable<Awaited<ReturnType<typeof getDriveClient>>>,
  fileId: string
): Promise<DriveFileEntry | null> {
  const { data } = await drive.files
    .get({
      fileId,
      fields: "id,name,mimeType,size,webViewLink,webContentLink,createdTime,modifiedTime,parents",
      supportsAllDrives: true,
    })
    .catch(() => ({ data: null }));

  if (!data?.id) return null;
  return {
    fileId: String(data.id),
    name: String(data.name ?? ""),
    mimeType: String(data.mimeType ?? ""),
    size: data.size ? Number(data.size) : undefined,
    webViewLink: data.webViewLink ?? undefined,
    webContentLink: data.webContentLink ?? undefined,
    createdTime: data.createdTime ?? undefined,
    modifiedTime: data.modifiedTime ?? undefined,
    parents: data.parents ?? undefined,
    isFolder: data.mimeType === "application/vnd.google-apps.folder",
  };
}

/** 파일 휴지통 이동(삭제) */
export async function trashDriveFile(
  drive: NonNullable<Awaited<ReturnType<typeof getDriveClient>>>,
  fileId: string
): Promise<boolean> {
  try {
    await drive.files.update({
      fileId,
      requestBody: { trashed: true },
      supportsAllDrives: true,
    });
    return true;
  } catch {
    return false;
  }
}

/** 파일명 변경 */
export async function renameDriveFile(
  drive: NonNullable<Awaited<ReturnType<typeof getDriveClient>>>,
  fileId: string,
  newName: string
): Promise<DriveFileEntry | null> {
  const safeName = sanitizeFileName(newName);
  if (!safeName || safeName === "file") return null;

  try {
    const { data } = await drive.files.update({
      fileId,
      requestBody: { name: safeName },
      fields: "id,name,mimeType,size,webViewLink,webContentLink,createdTime,modifiedTime,parents",
      supportsAllDrives: true,
    });
    if (!data?.id) return null;
    return {
      fileId: String(data.id),
      name: String(data.name ?? safeName),
      mimeType: String(data.mimeType ?? ""),
      size: data.size ? Number(data.size) : undefined,
      webViewLink: data.webViewLink ?? undefined,
      webContentLink: data.webContentLink ?? undefined,
      createdTime: data.createdTime ?? undefined,
      modifiedTime: data.modifiedTime ?? undefined,
      parents: data.parents ?? undefined,
      isFolder: data.mimeType === "application/vnd.google-apps.folder",
    };
  } catch {
    return null;
  }
}

/** 폴더 링크 공유(읽기) — 동일 회사 구성원 Drive 새 탭 열기용 */
export async function shareFolderWithCompanyLink(
  drive: NonNullable<Awaited<ReturnType<typeof getDriveClient>>>,
  folderId: string
): Promise<void> {
  try {
    await drive.permissions.create({
      fileId: folderId,
      requestBody: { role: "reader", type: "anyone" },
      supportsAllDrives: true,
    });
  } catch {
    /* 이미 공유됨 */
  }
}

export function buildDriveFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

export function buildDriveImagePreviewUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}
