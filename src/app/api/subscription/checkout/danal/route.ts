import { NextRequest, NextResponse } from "next/server";
import { canManageCompanyWorkspace } from "@/lib/adminRoles";
import { createDanalMonthlySession, isDanalReady } from "@/lib/danal/danalClient";
import { requireTenantSession } from "@/lib/tenantScope";

export async function POST(request: NextRequest) {
  const auth = await requireTenantSession({ pathname: request.nextUrl.pathname });
  if ("error" in auth) return auth.error;
  const { session, managementNumber } = auth;

  if (!canManageCompanyWorkspace(session, managementNumber)) {
    return NextResponse.json({ error: "사내관리자만 결제를 진행할 수 있습니다." }, { status: 403 });
  }

  if (!isDanalReady()) {
    return NextResponse.json(
      { error: "다날이 설정되지 않았습니다. DANAL_CPID, DANAL_CPPWD를 환경 변수에 추가하세요." },
      { status: 503 }
    );
  }

  const sessionData = createDanalMonthlySession({
    managementNumber,
    payerName: session.name ?? session.loginId,
    payerEmail: session.loginId.includes("@") ? session.loginId : undefined,
  });

  if (!sessionData) {
    return NextResponse.json({ error: "다날 결제 세션 생성에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({
    actionUrl: sessionData.actionUrl,
    formFields: sessionData.formFields,
    orderId: sessionData.orderId,
    amount: sessionData.amount,
  });
}
