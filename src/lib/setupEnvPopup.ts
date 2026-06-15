export const SETUP_ENV_POPUP_NAME = "lawygo-setup-env";

export function openSetupEnvPopup(): void {
  if (typeof window === "undefined") return;
  const w = 520;
  const h = 720;
  const left = Math.max(0, (window.screen.width - w) / 2);
  const top = Math.max(0, (window.screen.height - h) / 2);
  window.open(
    "/login/setup-env?popup=1",
    SETUP_ENV_POPUP_NAME,
    `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`
  );
}
