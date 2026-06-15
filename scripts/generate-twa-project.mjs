/**
 * Bubblewrap TwaGenerator로 Android 프로젝트 생성 (비대화형)
 * 사용: npm run generate:twa-project
 */
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  TwaGenerator,
  TwaManifest,
  ConsoleLog,
} from "@bubblewrap/core";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const twaDir = join(root, "android-twa");
const raw = JSON.parse(await readFile(join(twaDir, "twa-manifest.json"), "utf-8"));
const manifest = new TwaManifest(raw);

const generator = new TwaGenerator();
const log = new ConsoleLog("generate-twa");

await generator.createTwaProject(twaDir, manifest, log);
console.log("TWA Android project generated in android-twa/");
