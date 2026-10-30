/** Smoke-тест рендера: проверяем, что клиентский entry существует и экспортирует setupClient. */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function main() {
  try {
    // Проверяем, что файл существует и содержит экспорт setupClient
    const clientPath = join(ROOT, "lib", "client.js");
    const content = readFileSync(clientPath, "utf-8");
    if (!content.includes("setupClient") || !content.includes("export")) {
      throw new Error("setupClient не экспортирован из lib/client.js");
    }
    console.log("[render-smoke] OK: lib/client.js существует, setupClient экспортирован");
  } catch (e) {
    console.error("[render-smoke] Ошибка:", e.message);
    process.exit(1);
  }
}

main();