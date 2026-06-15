"use client";

import { GoogleOAuthSettingsPanel } from "@/components/admin/GoogleOAuthSettingsPanel";
import { PlatformSecretsGate } from "@/components/admin/PlatformSecretsGate";

export default function GoogleOAuthSettingsPage() {
  return (
    <PlatformSecretsGate title="Google OAuth">
      <GoogleOAuthSettingsPanel showBackLink={false} />
    </PlatformSecretsGate>
  );
}
