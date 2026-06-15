/**
 * SVG → PNG (192, 512, maskable 512) for PWA / Play Store
 */
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = join(root, "public", "icons");
const svgPath = join(iconsDir, "lawygo-icon.svg");

async function main() {
  const sharp = (await import("sharp")).default;
  const svg = await readFile(svgPath);

  const sizes = [
    { name: "icon-192.png", size: 192 },
    { name: "icon-512.png", size: 512 },
    { name: "icon-512-maskable.png", size: 512, padding: 0.1 },
  ];

  for (const { name, size, padding } of sizes) {
    let pipeline = sharp(svg).resize(size, size);
    if (padding) {
      const inner = Math.round(size * (1 - padding * 2));
      const buf = await sharp(svg).resize(inner, inner).png().toBuffer();
      pipeline = sharp({
        create: {
          width: size,
          height: size,
          channels: 4,
          background: { r: 37, g: 99, b: 235, alpha: 1 },
        },
      }).composite([{ input: buf, gravity: "center" }]);
    }
    await pipeline.png().toFile(join(iconsDir, name));
    console.log(`Wrote ${name}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
