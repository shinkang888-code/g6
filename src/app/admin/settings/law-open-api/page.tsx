"use client";

import { LawOpenApiSettingsPanel } from "@/components/admin/LawOpenApiSettingsPanel";
import { PlatformSecretsGate } from "@/components/admin/PlatformSecretsGate";

export default function AdminLawOpenApiSettingsPage() {
  return (
    <PlatformSecretsGate title="국가법령정보 API">
      <LawOpenApiSettingsPanel />
    </PlatformSecretsGate>
  );
}
