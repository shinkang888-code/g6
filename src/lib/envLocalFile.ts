/**
 * 로컬 개발 전용 .env.local 읽기/쓰기
 */

import { readFile, writeFile } from "fs/promises";
import { join } from "path";

const ENV_LOCAL = ".env.local";

export async function readEnvLocal(): Promise<Record<string, string>> {
  const envPath = join(process.cwd(), ENV_LOCAL);
  try {
    const content = await readFile(envPath, "utf-8");
    const out: Record<string, string> = {};
    for (const line of content.split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
    return out;
  } catch {
    return {};
  }
}

export async function mergeEnvLocal(updates: Record<string, string>): Promise<void> {
  const envPath = join(process.cwd(), ENV_LOCAL);
  const setKeys = new Set(Object.keys(updates));

  let lines: string[] = [];
  try {
    const content = await readFile(envPath, "utf-8");
    lines = content.split(/\r?\n/);
  } catch {
    // new file
  }

  const updated = lines
    .filter((line) => {
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
      return !match || !setKeys.has(match[1]);
    })
    .concat(
      Object.entries(updates)
        .filter(([, v]) => v.trim().length > 0)
        .map(([k, v]) => `${k}=${v.replace(/\n/g, " ")}`)
    );

  await writeFile(envPath, updated.join("\n") + "\n", "utf-8");
}

export function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return "********";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}
