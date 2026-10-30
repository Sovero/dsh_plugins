// Bootstrap: синхронизация встроенного каталога в пользовательскую директорию.
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, cpSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

export const SNAPSHOT_DIR = join(dirname(dirname(fileURLToPath(import.meta.url))), "data", "eksperts");

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