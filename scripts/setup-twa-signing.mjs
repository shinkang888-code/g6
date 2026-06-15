/**
 * TWA 서명 keystore 생성 + SHA-256 지문 출력 + Vercel env 동기화
 * 사용: npm run setup:twa-signing
 */
import { X509Certificate } from "node:crypto";
import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import forge from "node-forge";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const twaDir = join(root, "android-twa");
const keystoreJks = join(twaDir, "android.keystore");
const keystoreP12 = join(twaDir, "android.p12");
const alias = "lawygo";
const storePass = process.env.TWA_KEYSTORE_PASSWORD || "lawygo-twa-ci-2026";
const keyPass = process.env.TWA_KEY_PASSWORD || storePass;
const packageId = "app.lawygo.twa";

mkdirSync(twaDir, { recursive: true });

function findKeytool() {
  const candidates = [
    process.env.JAVA_HOME && join(process.env.JAVA_HOME, "bin", "keytool"),
    "C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.19.10-hotspot\\bin\\keytool",
    "keytool",
  ].filter(Boolean);
  for (const p of candidates) {
    const exe = `${p}.exe`;
    if (existsSync(exe)) return `"${exe}"`;
    if (existsSync(p)) return `"${p}"`;
  }
  const r = spawnSync("where", ["keytool"], { encoding: "utf-8" });
  if (r.status === 0 && r.stdout.trim()) {
    return `"${r.stdout.trim().split("\n")[0]}"`;
  }
  return null;
}

function fingerprintFromPem(pem) {
  return new X509Certificate(pem).fingerprint256;
}

function createKeystoreWithForge() {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 27);
  const attrs = [
    { name: "commonName", value: "LawyGo" },
    { name: "organizationName", value: "LawyGo" },
    { name: "countryName", value: "KR" },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], storePass, {
    friendlyName: alias,
    generateLocalKeyId: true,
  });
  writeFileSync(keystoreP12, forge.asn1.toDer(p12Asn1).getBytes(), "binary");
  const sha256 = fingerprintFromPem(forge.pki.certificateToPem(cert));
  console.log(`Created ${keystoreP12}`);
  return sha256;
}

let sha256 = "";

if (!existsSync(keystoreJks) && !existsSync(keystoreP12)) {
  const keytool = findKeytool();
  if (keytool) {
    const dname = "CN=LawyGo, OU=Legal, O=LawyGo, L=Seoul, ST=Seoul, C=KR";
    execSync(
      `${keytool} -genkeypair -v -keystore "${keystoreJks}" -alias ${alias} -keyalg RSA -keysize 2048 -validity 10000 -storepass ${storePass} -keypass ${keyPass} -dname "${dname}"`,
      { stdio: "inherit" }
    );
    const out = execSync(
      `${keytool} -list -v -keystore "${keystoreJks}" -alias ${alias} -storepass ${storePass}`,
      { encoding: "utf-8" }
    );
    sha256 = out.match(/SHA256:\s*([0-9A-F:]+)/i)?.[1]?.trim() ?? "";
    console.log(`Created ${keystoreJks}`);
  } else {
    sha256 = createKeystoreWithForge();
  }
} else {
  const keytool = findKeytool();
  const ks = existsSync(keystoreJks) ? keystoreJks : keystoreP12;
  const storeType = ks.endsWith(".p12") ? "-storetype PKCS12" : "";
  if (keytool) {
    const out = execSync(
      `${keytool} -list -v ${storeType} -keystore "${ks}" -alias ${alias} -storepass ${storePass}`,
      { encoding: "utf-8" }
    );
    sha256 = out.match(/SHA256:\s*([0-9A-F:]+)/i)?.[1]?.trim() ?? "";
  }
}

if (!sha256) {
  if (existsSync(keystoreP12)) unlinkSync(keystoreP12);
  sha256 = createKeystoreWithForge();
}

console.log(`\nTWA_ANDROID_SHA256=${sha256}`);
console.log(`TWA_PACKAGE_ID=${packageId}`);

const envLocal = await readFile(join(root, ".env.local"), "utf-8").catch(() => "");
const token =
  process.env.VERCEL_ACCESS_TOKEN ||
  process.env.VERCEL_TOKEN ||
  envLocal.match(/^VERCEL_ACCESS_TOKEN=(.+)$/m)?.[1]?.trim();
const project = JSON.parse(
  await readFile(join(root, ".vercel/project.json"), "utf-8").catch(() => "{}")
);

if (token && project.projectId) {
  const base = `https://api.vercel.com/v10/projects/${project.projectId}/env`;
  const team = project.orgId ? `?teamId=${project.orgId}` : "";
  const targets = ["production", "preview", "development"];

  async function upsert(key, value) {
    const list = await fetch(`${base}${team}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const rows = list.ok ? await list.json() : { envs: [] };
    const existing = (rows.envs || []).find((e) => e.key === key);
    const body = { key, value, type: "encrypted", target: targets };
    const url = existing?.id ? `${base}/${existing.id}${team}` : `${base}${team}`;
    await fetch(url, {
      method: existing?.id ? "PATCH" : "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    console.log(`${existing?.id ? "Updated" : "Created"} Vercel env: ${key}`);
  }

  await upsert("TWA_PACKAGE_ID", packageId);
  await upsert("TWA_ANDROID_SHA256", sha256);
  console.log("\nVercel env synced.");
} else {
  console.log("\n(Vercel token 없음 — npx vercel env add 로 등록 가능)");
}
