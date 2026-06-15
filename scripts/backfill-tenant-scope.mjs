/**
 * 기존 사건·고객·기일에 management_number 백필
 * node scripts/backfill-tenant-scope.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");

function loadEnv() {
  const envPath = resolve(root, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    const val = m[2].trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const defaultMgmt = process.env.ADMIN_MANAGEMENT_NUMBER?.trim() || "00000";

if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요");
  process.exit(1);
}

const db = createClient(url, key);

async function backfillTable(table, extraFilter) {
  let updated = 0;
  const pageSize = 500;
  let from = 0;
  while (true) {
    let query = db.from(table).select("id, management_number").range(from, from + pageSize - 1);
    if (extraFilter) query = extraFilter(query);
    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data?.length) break;

    for (const row of data) {
      const current = String(row.management_number ?? "").trim();
      if (current) continue;
      const { error: updErr } = await db.from(table).update({ management_number: defaultMgmt }).eq("id", row.id);
      if (updErr) throw new Error(`${table} update ${row.id}: ${updErr.message}`);
      updated += 1;
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return updated;
}

async function backfillDeadlinesFromCases() {
  let updated = 0;
  const pageSize = 500;
  let from = 0;
  while (true) {
    const { data, error } = await db
      .from("deadlines")
      .select("id, case_id, management_number")
      .or("management_number.is.null,management_number.eq.")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`deadlines: ${error.message}`);
    if (!data?.length) break;

    for (const d of data) {
      if (String(d.management_number ?? "").trim()) continue;
      let mgmt = defaultMgmt;
      if (d.case_id) {
        const { data: c } = await db.from("cases").select("management_number").eq("id", d.case_id).maybeSingle();
        if (c?.management_number) mgmt = String(c.management_number).trim();
      }
      const { error: updErr } = await db.from("deadlines").update({ management_number: mgmt }).eq("id", d.id);
      if (updErr) throw new Error(`deadlines update ${d.id}: ${updErr.message}`);
      updated += 1;
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return updated;
}

async function ensureGroups() {
  const { data: users } = await db.from("site_users").select("management_number").not("management_number", "is", null);
  const numbers = [...new Set((users ?? []).map((u) => String(u.management_number).trim()).filter(Boolean))];
  for (const mgmt of numbers) {
    await db.from("company_groups").upsert(
      { management_number: mgmt, group_name: `법무법인 ${mgmt}`, updated_at: new Date().toISOString() },
      { onConflict: "management_number" }
    );
  }
  console.log(`company_groups: ${numbers.length}건 보장`);
}

const cases = await backfillTable("cases");
const clients = await backfillTable("clients", (q) => q.is("deleted_at", null));
const deadlines = await backfillDeadlinesFromCases();
await ensureGroups();

console.log(`백필 완료 (기본 관리번호: ${defaultMgmt})`);
console.log(`- cases: ${cases}건`);
console.log(`- clients: ${clients}건`);
console.log(`- deadlines: ${deadlines}건`);
