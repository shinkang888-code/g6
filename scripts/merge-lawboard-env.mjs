#!/usr/bin/env node
/**
 * bot/.env + G6 + Vercel development vars → .env.local 병합
 */
import crypto from "crypto";
import { readFileSync, existsSync, writeFileSync } from "fs";
import path from "path";

const root = process.cwd();

function parseEnvFile(filePath) {
  const out = {};
  if (!existsSync(filePath)) return out;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (val) out[key] = val;
  }
  return out;
}

function mergeEnvLocal(updates) {
  const file = path.join(root, ".env.local");
  const existing = parseEnvFile(file);
  const merged = { ...existing, ...updates };
  const lines = Object.entries(merged)
    .filter(([, v]) => String(v).trim())
    .map(([k, v]) => `${k}=${String(v).replace(/\n/g, " ")}`);
  writeFileSync(file, lines.join("\n") + "\n", "utf8");
  console.log("OK: .env.local 병합 완료 —", Object.keys(updates).join(", "));
}

const bot = parseEnvFile(path.join(root, "bot", ".env"));
const dev = parseEnvFile(path.join(root, ".env.local"));

const updates = {
  NEXT_PUBLIC_SUPABASE_URL: bot.NEXT_PUBLIC_SUPABASE_URL || dev.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: bot.SUPABASE_SERVICE_ROLE_KEY || dev.SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: dev.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SESSION_SECRET: dev.SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
  ENABLE_DEMO_LOGIN: dev.ENABLE_DEMO_LOGIN || "true",
  LEDGER_ENABLED: "false",
  NEXT_PUBLIC_GNUBOARD_API_URL: "http://localhost:8000",
  GNUBOARD_API_USERNAME: "lawygo",
  GNUBOARD_API_PASSWORD: "lawygo1234!",
  BOARD_BRIDGE_PREFER: process.env.BOARD_BRIDGE_PREFER || "hybrid",
};

mergeEnvLocal(updates);
