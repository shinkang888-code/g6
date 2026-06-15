/**
 * pdfjs-dist v6+ 는 DOMMatrix 등 브라우저 API를 모듈 로드 시점에 참조한다.
 * Node.js(Next.js API Route)에서는 import 전에 최소 polyfill을 주입해야 한다.
 */

import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

let polyfilled = false;

/** getTextContent용 최소 DOMMatrix — canvas 렌더링은 하지 않음 */
class DOMMatrixPolyfill {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;

  constructor(init?: string | number[]) {
    if (Array.isArray(init) && init.length >= 6) {
      [this.a, this.b, this.c, this.d, this.e, this.f] = init;
    }
  }

  multiply(): this {
    return this;
  }

  inverse(): this {
    return this;
  }

  translate(): this {
    return this;
  }

  scale(): this {
    return this;
  }

  rotate(): this {
    return this;
  }

  transformPoint<T extends { x: number; y: number }>(point: T): T {
    return point;
  }

  static fromMatrix(): DOMMatrixPolyfill {
    return new DOMMatrixPolyfill();
  }
}

export function ensurePdfjsNodePolyfills(): void {
  if (polyfilled) return;
  if (typeof globalThis.DOMMatrix === "undefined") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).DOMMatrix = DOMMatrixPolyfill;
  }
  polyfilled = true;
}

/** Node.js에서 pdf.worker.mjs 경로 설정 */
export function configurePdfjsWorker(GlobalWorkerOptions: { workerSrc: string }): void {
  if (GlobalWorkerOptions.workerSrc) return;
  const require = createRequire(import.meta.url);
  const workerPath = require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
  GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
}
