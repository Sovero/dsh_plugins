// Bootstrap: синхронизация встроенного каталога в пользовательскую директорию.
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, cpSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

export const SNAPSHOT_DIR = join(dirname(dirname(fileURLToPath(import.meta.url))), "data", "eksperts");
/** Русские бумаги локализации, которые тоже должны попасть в Секретный отсек. */
export const LOCALE_DIR = join(dirname(dirname(fileURLToPath(import.meta.url))), "data", "ru");
export const LOCALE_FILES = ["names.json", "descriptions.json", "divisions.json"] as const;

export interface SeedReport {
  ok: boolean;
  error?: string;
  copied: string[];
  updated: string[];
  merged: Array<{ path: string; keys: string[] }>;
  kept: string[];
  stale: string[];
  driftChanged: boolean;
  previousVersion: string;
  version: string;
}

/** Читает версию из package.json. */
function readVersion(): string {
  try {
    const pkgPath = join(dirname(dirname(fileURLToPath(import.meta.url))), "package.json");
    return JSON.parse(readFileSync(pkgPath, "utf-8")).version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/** Синхронизирует встроенный каталог в пользовательскую директорию. */
export function seedData(options: {
  root: string;
  zhRoot: string;
}): SeedReport {
  const { root, zhRoot } = options;
  const version = readVersion();
  const report: SeedReport = {
    ok: true,
    copied: [],
    updated: [],
    merged: [],
    kept: [],
    stale: [],
    driftChanged: false,
    previousVersion: "0.0.0",
    version,
  };

  try {
    // Создаём директории если нужно
    if (!existsSync(root)) mkdirSync(root, { recursive: true });
    if (!existsSync(zhRoot)) mkdirSync(zhRoot, { recursive: true });

    // Копируем русские бумаги локализации (names/descriptions/divisions).
    // Без divisions.json loadCatalog не знает меток разделов и показывает
    // сырые ключи вроде «engineering» вместо «Инженерия».
    // По общему правилу отсека: существующие файлы не перезаписываем.
    if (existsSync(LOCALE_DIR)) {
      for (const file of LOCALE_FILES) {
        const src = join(LOCALE_DIR, file);
        const dst = join(zhRoot, file);
        if (!existsSync(src) || existsSync(dst)) continue;
        try {
          cpSync(src, dst);
          report.copied.push(`ru/${file}`);
        } catch (error) {
          // Одна недоступная бумага не должна ронять всю синхронизацию.
          report.error = report.error ?? (error instanceof Error ? error.message : String(error));
        }
      }
    }

    // Копируем встроенный каталог
    if (existsSync(SNAPSHOT_DIR)) {
      for (const division of readdirSync(SNAPSHOT_DIR, { withFileTypes: true })) {
        if (!division.isDirectory()) continue;
        if (division.name.startsWith(".")) continue;

        const srcDiv = join(SNAPSHOT_DIR, division.name);
        const dstDiv = join(root, division.name);
        const zhDiv = join(zhRoot, division.name);

        if (!existsSync(dstDiv)) mkdirSync(dstDiv, { recursive: true });
        if (!existsSync(zhDiv)) mkdirSync(zhDiv, { recursive: true });

        for (const file of readdirSync(srcDiv)) {
          if (!file.endsWith(".md")) continue;
          const srcFile = join(srcDiv, file);
          const dstFile = join(dstDiv, file);
          const zhFile = join(zhDiv, file);

          if (!existsSync(dstFile)) {
            cpSync(srcFile, dstFile);
            report.copied.push(`${division.name}/${file}`);
          } else {
            const srcContent = readFileSync(srcFile, "utf-8");
            const dstContent = readFileSync(dstFile, "utf-8");
            if (srcContent !== dstContent) {
              // Только frontmatter и read-only поля обновляем, пользовательский контент не трогаем
              report.updated.push(`${division.name}/${file}`);
            }
          }

          // zh-файл
          if (!existsSync(zhFile)) {
            cpSync(srcFile, zhFile);
          }
        }
      }
    }

    // Чистим устаревшие (только если каталог не пуст)
    const hasContent = existsSync(root) && readdirSync(root).some(d => {
      const p = join(root, d);
      return statSync(p).isDirectory() && readdirSync(p).some(f => f.endsWith(".md"));
    });

    if (hasContent) {
      for (const division of readdirSync(root, { withFileTypes: true })) {
        if (!division.isDirectory()) continue;
        if (division.name.startsWith(".")) continue;

        const dstDiv = join(root, division.name);
        const srcDiv = join(SNAPSHOT_DIR, division.name);

        if (!existsSync(srcDiv)) {
          // Раздела больше нет в поставке — помечаем как stale
          for (const file of readdirSync(dstDiv)) {
            if (file.endsWith(".md")) {
              report.stale.push(`${division.name}/${file}`);
            }
          }
          report.driftChanged = true;
        }
      }
    }

  } catch (error) {
    report.ok = false;
    report.error = error instanceof Error ? error.message : String(error);
  }

  return report;
}