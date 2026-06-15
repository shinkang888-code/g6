"use client";

import SecurityCommandCenter from "@/components/admin/security/SecurityCommandCenter";
import { PlatformSecretsGate } from "@/components/admin/PlatformSecretsGate";

export default function AdminSecurityPage() {
  return (
    <PlatformSecretsGate title="보안 관제 (SOC)">
      <SecurityCommandCenter />
    </PlatformSecretsGate>
  );
}
