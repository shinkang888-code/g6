/**
 * 관리자 배너 이미지 업로드
 * Drive 연동 시 공개 이미지 URL, 미연동 시 data URL 폴백
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminSession";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { uploadBannerImage } from "@/lib/bannerImageUpload";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminSession();
    if ("error" in auth) return auth.error;

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }

    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "파일을 선택하세요." }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    const result = await uploadBannerImage(file, db);

    return NextResponse.json({
      imageUrl: result.imageUrl,
      fileId: result.fileId ?? null,
      name: result.name,
      storageMode: result.storageMode,
      message:
        result.storageMode === "inline"
          ? "Drive 미연동 — 이미지가 인라인으로 저장됩니다. 전체 저장을 눌러 반영하세요."
          : "이미지가 업로드되었습니다.",
    });
  } catch (e) {
    console.error("[banners/upload]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "업로드 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
