/** Синхронизация данных: проверка/генерация roster.json и локализованных файлов. */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const EXPERTS_DIR = join(ROOT, "data", "eksperts");
const ROSTER_PATH = join(ROOT, "data", "roster.json");

function sha256File(path) {
  const content = readFileSync(path);
  return createHash("sha256").update(content).digest("hex");
}

function scanExperts() {
  const packs = {};
  if (!existsSync(EXPERTS_DIR)) return packs;
  
  for (const div of readdirSync(EXPERTS_DIR, { withFileTypes: true })) {
    if (!div.isDirectory()) continue;
    const divPath = join(EXPERTS_DIR, div.name);
    for (const file of readdirSync(divPath)) {
      if (!file.endsWith(".md")) continue;
      const filePath = join(divPath, file);
      const stats = statSync(filePath);
      const slug = basename(file, ".md");
      // Для встроенных экспертов пакетов нет — оставляем пустым
      packs[`${div.name}/${slug}`] = {
        division: div.name,
        slug,
        path: `packs/${div.name}/${slug}.tar.gz`,
        bytes: stats.size,
        rawBytes: stats.size,
        files: 1,
        sha256: sha256File(filePath),
        dirs: [],
      };
    }
  }
  return packs;
}

function generateRoster(checkOnly = false) {
  const packs = scanExperts();
  const roster = {
    version: 1,
    generatedAt: new Date().toISOString(),
    baseUrl: "https://example.com/ekspert-assets",
    threshold: 51200,
    packs,
  };
  
  const newContent = JSON.stringify(roster, null, 2);
  
  if (checkOnly) {
    if (!existsSync(ROSTER_PATH)) {
      console.error("[sync-data] roster.json отсутствует");
      return false;
    }
    const current = readFileSync(ROSTER_PATH, "utf-8");
    // Сравниваем без generatedAt, так как он меняется каждый раз
    const currentParsed = JSON.parse(current);
    const newParsed = JSON.parse(newContent);
    delete currentParsed.generatedAt;
    delete newParsed.generatedAt;
    if (JSON.stringify(currentParsed) !== JSON.stringify(newParsed)) {
      console.error("[sync-data] roster.json устарел (запустите без --check для обновления)");
      return false;
    }
    console.log("[sync-data] roster.json актуален");
    return true;
  }
  
  writeFileSync(ROSTER_PATH, newContent, "utf-8");
  console.log(`[sync-data] roster.json обновлён: ${Object.keys(packs).length} записей`);
  return true;
}

function syncLocales(checkOnly = false) {
  // divisions.json уже созданы вручную, names/descriptions можно генерировать из .md
  const names = {};
  const descriptions = {};
  
  if (existsSync(EXPERTS_DIR)) {
    for (const div of readdirSync(EXPERTS_DIR, { withFileTypes: true })) {
      if (!div.isDirectory()) continue;
      const divPath = join(EXPERTS_DIR, div.name);
      for (const file of readdirSync(divPath)) {
        if (!file.endsWith(".md")) continue;
        const content = readFileSync(join(divPath, file), "utf-8");
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!fmMatch) continue;
        const fm = {};
        for (const line of fmMatch[1].split("\n")) {
          const idx = line.indexOf(":");
          if (idx > 0) {
            const key = line.slice(0, idx).trim();
            const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
            fm[key] = val;
          }
        }
        const slug = fm.slug || basename(file, ".md");
        const key = `${div.name}/${slug}`;
        if (fm.name_zh) names[key] = fm.name_zh;
        else if (fm.name) names[key] = fm.name;
        if (fm.description_zh) descriptions[key] = fm.description_zh;
        else if (fm.description) descriptions[key] = fm.description;
      }
    }
  }
  
  const namesPath = join(ROOT, "data", "ru", "names.json");
  const descPath = join(ROOT, "data", "ru", "descriptions.json");
  
  const newNames = JSON.stringify(names, null, 2);
  const newDescs = JSON.stringify(descriptions, null, 2);
  
  if (checkOnly) {
    let ok = true;
    if (existsSync(namesPath)) {
      if (readFileSync(namesPath, "utf-8") !== newNames) {
        console.error("[sync-data] names.json устарел");
        ok = false;
      }
    }
    if (existsSync(descPath)) {
      if (readFileSync(descPath, "utf-8") !== newDescs) {
        console.error("[sync-data] descriptions.json устарел");
        ok = false;
      }
    }
    if (ok) console.log("[sync-data] Локализованные файлы актуальны");
    return ok;
  }
  
  writeFileSync(namesPath, newNames, "utf-8");
  writeFileSync(descPath, newDescs, "utf-8");
  console.log(`[sync-data] Локализованные файлы обновлены: ${Object.keys(names).length} имён, ${Object.keys(descriptions).length} описаний`);
  return true;
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  console.log(`[sync-data] ${checkOnly ? "Проверка" : "Синхронизация"} данных...`);
  
  const rosterOk = generateRoster(checkOnly);
  const localeOk = syncLocales(checkOnly);
  
  if (rosterOk && localeOk) {
    console.log("[sync-data] Готово");
  } else {
    console.error("[sync-data] Есть расхождения");
    process.exit(1);
  }
}

main();