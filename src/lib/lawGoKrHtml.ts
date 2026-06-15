export function formatLawJoCode(articleNo: string | number, articleSub?: string | number): string {
  const main = String(articleNo).replace(/\D/g, "");
  const sub = articleSub != null ? String(articleSub).replace(/\D/g, "") : "0";
  return `00${main.padStart(2, "0")}${sub.padStart(2, "0")}`;
}

export function sanitizeLawHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
