/** Проверка клиентских референсов: убеждаемся, что все внешние импорты разрешены. */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const ALLOWED_EXTERNALS = new Set([
  "preact",
  "preact/hooks",
  "@deepseek-ai/dsh-client-ui-settings",
  "@deepseek-ai/dsh-client-connection",
  "@deepseek-ai/dsh-client-locale",
  "@deepseek-ai/dsh-api-remotes",
  "@deepseek-ai/dsh-api-session-controller",
  "@deepseek-ai/dsh-client-ui-primitives",
  "@deepseek-ai/dsh-client-ui-slots",
  "@deepseek-ai/dsh-client-ui-input-trigger",
  "@deepseek-ai/dsh-llm",
  "@deepseek-ai/dsh-tools",
  "@deepseek-ai/dsh-subagent",
  "@deepseek-ai/dsh-system-prompt",
  "@deepseek-ai/dsh-session",
  "@deepseek-ai/dsh-settings",
  "@deepseek-ai/dsh-typert-protocol",
  "@deepseek-ai/schemastery",
  "react",
  "react-dom",
  "zod",
  "node:fs",
  "node:fs/promises",
  "node:path",
  "node:os",
  "node:url",
  "node:crypto",
  "node:stream/promises",
]);

function checkFile(file) {
  const content = readFileSync(file, "utf-8");
  const imports = content.matchAll(/^import\s+.*\s+from\s+["']([^"']+)["']/gm);
  const errors = [];
  for (const match of imports) {
    const spec = match[1];
    if (spec.startsWith(".") || spec.startsWith("/")) continue; // локальный
    const pkg = spec.split("/")[0] + (spec.startsWith("@") ? "/" + spec.split("/")[1] : "");
    if (!ALLOWED_EXTERNALS.has(pkg) && !ALLOWED_EXTERNALS.has(spec)) {
      errors.push(`${file}: неразрешённый импорт "${spec}"`);
    }
  }
  return errors;
}

async function walk(dir, ext = ".ts") {
  const files = [];
  const { readdirSync } = await import("node:fs");
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
        files.push(...await walk(full, ext));
      }
    } else if (entry.name.endsWith(ext)) {
      files.push(full);
    }
  }
  return files;
}

async function main() {
  const allFiles = [
    ...await walk(join(ROOT, "src"), ".ts"),
    ...await walk(join(ROOT, "src", "client"), ".tsx"),
  ];

  let hasErrors = false;
  for (const file of allFiles) {
    const errors = checkFile(file);
    for (const err of errors) {
      console.error(err);
      hasErrors = true;
    }
  }

  if (hasErrors) {
    console.error("\n[check-client-refs] Найдены неразрешённые импорты");
    process.exit(1);
  } else {
    console.log("[check-client-refs] OK: все импорты разрешены");
  }
}

main();