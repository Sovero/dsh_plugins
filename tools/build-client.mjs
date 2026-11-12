/** Сборка клиентской части (panel.tsx → lib/client.js). */
import { build } from "esbuild";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

async function main() {
  // Собираем клиент
  await build({
    entryPoints: [join(ROOT, "src", "client", "index.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: join(ROOT, "lib", "client.js"),
    external: [
      "preact",
      "preact/hooks",
      "@deepseek-ai/dsh-client-ui-settings",
      "@deepseek-ai/dsh-client-connection",
      "@deepseek-ai/dsh-client-locale",
    ],
    target: "node22",
    sourcemap: true,
  });

  // Копируем locale файлы
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

  console.log("[build-client] Готово: lib/client.js");
}

main().catch((e) => { console.error(e); process.exit(1); });