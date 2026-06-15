/**
 * 배너 이미지 업로드 — Google Drive 우선, 실패 시 data URL 폴백
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getDriveClient, uploadFile } from "./googleDriveClient";

const MAX_SIZE = 5 * 1024 * 1024;
const BANNER_FOLDER = "site/banners";

export type BannerImageUploadResult = {
  imageUrl: string;
  storageMode: "drive" | "inline";
  fileId?: string;
  name: string;
};

export function buildDriveImageUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

/** Drive 파일을 링크 공개(읽기)로 설정 — img 태그에서 표시 가능 */
export async function makeDriveFilePublic(
  drive: NonNullable<Awaited<ReturnType<typeof getDriveClient>>>,
  fileId: string
): Promise<void> {
  try {
    await drive.permissions.create({
      fileId,
      requestBody: { role: "reader", type: "anyone" },
      supportsAllDrives: true,
    });
  } catch (e) {
    console.warn("[banner/drive] permission create:", e);
  }
}

export async function uploadBannerImage(
  file: File,
  _db?: SupabaseClient | null
): Promise<BannerImageUploadResult> {
  if (!file.type.startsWith("image/")) {
    throw new Error("이미지 파일만 업로드 가능합니다.");
  }
  if (file.size > MAX_SIZE) {
    throw new Error("5MB 이하 이미지만 가능합니다.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "image/png";
  const fileName = file.name || `banner-${Date.now()}.png`;

  const drive = await getDriveClient();
  if (drive) {
    try {
      const result = await uploadFile(drive, BANNER_FOLDER, fileName, buffer, mimeType);
      if (result?.fileId) {
        await makeDriveFilePublic(drive, result.fileId);
        const imageUrl = buildDriveImageUrl(result.fileId);
        return {
          imageUrl,
          storageMode: "drive",
          fileId: result.fileId,
          name: result.name ?? fileName,
        };
      }
    } catch (e) {
      console.error("[banner/drive] upload failed:", e);
    }
  }

  const imageUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;
  return {
    imageUrl,
    storageMode: "inline",
    name: fileName,
  };
}
