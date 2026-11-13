/** Smoke-тест рендера: проверяем формат клиентского грузаDispетчерской. */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function main() {
  try {
    const content = readFileSync(join(ROOT, "lib", "client.js"), "utf-8");
    const checks = [
      ["фабрика __ModuleLoader__", content.includes("__ModuleLoader__.load")],
      ["id пакета dsh-ekspert", content.includes("dsh-ekspert")],
      ["Слот настроек", content.includes("settings.section")],
      ["Слот левой панели", content.includes("conversation.input.left")],
      ["кнопка Эксперты", content.includes("Эксперты")],
    ];
    const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
    if (failed.length > 0) {
      throw new Error("Клиентский груз неполон: " + failed.join(", "));
    }
    console.log("[render-smoke] OK: __ModuleLoader__, оба Слота, кнопка Эксперты на месте");
  } catch (e) {
    console.error("[render-smoke] Ошибка:", e.message);
    process.exit(1);
  }
}

main();
