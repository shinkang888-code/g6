/**
 * Android TWA Digital Asset Links
 * Vercel 환경 변수:
 *   TWA_PACKAGE_ID=app.lawygo.twa
 *   TWA_ANDROID_SHA256=AA:BB:CC:... (Play 서명 키 SHA-256, 콤마로 여러 개 가능)
 */

import { NextResponse } from "next/server";

export async function GET() {
  const packageName = process.env.TWA_PACKAGE_ID?.trim() || "app.lawygo.twa";
  const raw = process.env.TWA_ANDROID_SHA256?.trim() ?? "";
  const fingerprints = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (fingerprints.length === 0) {
    return NextResponse.json(
      [
        {
          relation: ["delegate_permission/common.handle_all_urls"],
          target: {
            namespace: "android_app",
            package_name: packageName,
            sha256_cert_fingerprints: ["REPLACE_WITH_PLAY_SIGNING_SHA256"],
          },
        },
      ],
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300",
        },
      }
    );
  }

  return NextResponse.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: packageName,
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ],
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300",
      },
    }
  );
}
