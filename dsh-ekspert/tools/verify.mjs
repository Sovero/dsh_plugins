/** Верификация сборки: проверяем экспорты, манифест, размеры. */
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const REQUIRED_EXPORTS = [
  "lib/index.js",
  "lib/client.js",
  "lib/remote.js",
  "cordis.patch.yml",
  "package.json",
];

const REQUIRED_DATA = [
  "data/roster.json",
  "data/ru/divisions.json",
  "data/ru/names.json",
  "data/ru/descriptions.json",
];

function checkFile(path, desc) {
  const full = join(ROOT, path);
  if (!existsSync(full)) {
    console.error(`[verify] ОТСУТСТВУЕТ ${desc}: ${path}`);
    return false;
  }
  const size = statSync(full).size;
  if (size === 0) {
    console.error(`[verify] ПУСТОЙ ${desc}: ${path}`);
    return false;
  }
  console.log(`[verify] OK ${desc}: ${path} (${size} байт)`);
  return true;
}

function checkPackageJson() {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
  const checks = [
    ["name", "dsh-ekspert"],
    ["version", /^\d+\.\d+\.\d+/],
    ["exports", function(v) { return typeof v === "object" && v !== null; }],
    ["dsh.bundle.patch", "./cordis.patch.yml"],
    ["dsh.client.inject", function(v) { return Array.isArray(v); }],
  ];
  let ok = true;
  for (const [key, expected] of checks) {
    const parts = key.split(".");
    let val = pkg;
    for (const p of parts) val = val?.[p];
    if (val === undefined) {
      console.error(`[verify] package.json: отсутствует ${key}`);
      ok = false;
    } else if (expected instanceof RegExp) {
      if (!expected.test(String(val))) {
        console.error(`[verify] package.json: ${key} не соответствует ${expected}`);
        ok = false;
      }
    } else if (typeof expected === "function") {
      if (!expected(val)) {
        console.error(`[verify] package.json: ${key} не проходит проверку типа`);
        ok = false;
      }
    } else if (val !== expected) {
      console.error(`[verify] package.json: ${key} = ${JSON.stringify(val)}, ожидалось ${JSON.stringify(expected)}`);
      ok = false;
    }
  }
  return ok;
}

function checkIndexExports() {
  const content = readFileSync(join(ROOT, "lib", "index.js"), "utf-8");
  const required = [
    "export const name",
    "export const Config",
    "export const CATALOG_SERVICE",
    "export const SETTINGS_NAMESPACE",
    "export const UNKNOWN_SLUG_ERROR_CODE",
    "export function apply",
  ];
  let ok = true;
  for (const req of required) {
    if (!content.includes(req)) {
      console.error(`[verify] lib/index.js: отсутствует экспорт "${req}"`);
      ok = false;
    }
  }
  return ok;
}

async function main() {
  console.log("[verify] Проверка артефактов...\n");
  
  let allOk = true;
  
  for (const [path, desc] of [
    ["lib/index.js", "host entry"],
    ["lib/client.js", "client entry"],
    ["lib/remote.js", "remote entry"],
    ["cordis.patch.yml", "cordis patch"],
    ["package.json", "package.json"],
  ]) {
    if (!checkFile(path, desc)) allOk = false;
  }
  
  for (const [path, desc] of [
    ["data/roster.json", "roster manifest"],
    ["data/ru/divisions.json", "divisions locale"],
    ["data/ru/names.json", "names locale"],
    ["data/ru/descriptions.json", "descriptions locale"],
  ]) {
    if (!checkFile(path, desc)) allOk = false;
  }
  
  if (!checkPackageJson()) allOk = false;
  if (!checkIndexExports()) allOk = false;
  
  // Проверяем наличие экспертов
  const ekspertsDir = join(ROOT, "data", "eksperts");
  if (existsSync(ekspertsDir)) {
    const { readdirSync, statSync } = await import("node:fs");
    let expertCount = 0;
    for (const div of readdirSync(ekspertsDir, { withFileTypes: true })) {
      if (div.isDirectory()) {
        const files = readdirSync(join(ekspertsDir, div.name)).filter(f => f.endsWith(".md"));
        expertCount += files.length;
        console.log(`[verify] Раздел ${div.name}: ${files.length} экспертов`);
      }
    }
    console.log(`[verify] Всего встроенных экспертов: ${expertCount}`);
  }
  
  console.log(allOk ? "\n[verify] ВСЁ OK" : "\n[verify] ЕСТЬ ОШИБКИ");
  if (!allOk) process.exit(1);
}

main();