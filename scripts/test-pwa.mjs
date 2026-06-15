/**
 * PWA / TWA 배포 전 점검
 * 사용: npm run test:pwa [baseUrl]
 */
const base = (process.argv[2] || process.env.PWA_BASE_URL || "http://localhost:3000").replace(/\/$/, "");

const checks = [
  { path: "/manifest.webmanifest", type: "manifest" },
  { path: "/sw.js", type: "sw" },
  { path: "/offline.html", type: "html" },
  { path: "/icons/lawygo-icon.svg", type: "icon" },
  { path: "/icons/icon-512.png", type: "icon" },
  { path: "/.well-known/assetlinks.json", type: "assetlinks" },
];

let failed = 0;

for (const { path, type } of checks) {
  const url = `${base}${path}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`FAIL ${path} → HTTP ${res.status}`);
      failed++;
      continue;
    }
    if (type === "manifest") {
      const json = await res.json();
      if (!json.name || !json.start_url) {
        console.error(`FAIL manifest missing name/start_url`);
        failed++;
      } else {
        console.log(`OK   manifest name="${json.name}" display=${json.display}`);
      }
    } else if (type === "assetlinks") {
      const json = await res.json();
      if (!Array.isArray(json) || !json[0]?.target?.package_name) {
        console.error(`FAIL assetlinks invalid shape`);
        failed++;
      } else {
        const fp = json[0].target.sha256_cert_fingerprints?.[0] ?? "";
        const placeholder = fp.includes("REPLACE");
        console.log(
          `OK   assetlinks package=${json[0].target.package_name}${placeholder ? " (SHA placeholder — Vercel env 설정 필요)" : ""}`
        );
      }
    } else {
      console.log(`OK   ${path}`);
    }
  } catch (e) {
    console.error(`FAIL ${path} → ${e.message}`);
    failed++;
  }
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nAll PWA checks passed.");
