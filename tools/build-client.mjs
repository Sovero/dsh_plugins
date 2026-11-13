/** Сборка клиентской части в форматеDispетчерской (window.__ModuleLoader__). */
import { build } from "esbuild";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

async function main() {
  // Браузерный груз: ленивая фабрика регистрируется через __ModuleLoader__.
  // React приходит из таблицы модулей страницы (require('react')), поэтому
  // он объявлен external и не попадает в бандл вторым комплектом.
  await build({
    entryPoints: [join(ROOT, "src", "client", "entry.js")],
    bundle: true,
    platform: "browser",
    format: "iife",
    outfile: join(ROOT, "lib", "client.js"),
    external: ["react"],
    target: "es2022",
    charset: "utf8",
    sourcemap: true,
    legalComments: "none",
  });

  // Копируем словари (используются хост-половиной и остаются в поставке)
  const localeSrc = join(ROOT, "src", "locale");
  const localeDst = join(ROOT, "lib", "locale");
  if (existsSync(localeSrc)) {
    mkdirSync(localeDst, { recursive: true });
    for (const file of ["ru.json", "en.json"]) {
      if (existsSync(join(localeSrc, file))) {
        copyFileSync(join(localeSrc, file), join(localeDst, file));
      }
    }
  }

  console.log("[build-client] Готово: lib/client.js (формат __ModuleLoader__)");
}

main().catch((e) => { console.error(e); process.exit(1); });
