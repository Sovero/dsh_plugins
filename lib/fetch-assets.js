// Облачная доставка ресурсов экспертов (навыки, справочники, данные).
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createWriteStream } from "node:fs";
const HERE = dirname(dirname(fileURLToPath(import.meta.url)));
const ROSTER_PATH = join(HERE, "data", "roster.json");
export const ASSETS_READY = "ready";
let rosterCache = null;
let rosterLoadError = null;
export async function loadRoster() {
    if (rosterCache)
        return rosterCache;
    if (rosterLoadError)
        throw rosterLoadError;
    try {
        const content = readFileSync(ROSTER_PATH, "utf-8");
        rosterCache = JSON.parse(content);
        return rosterCache;
    }
    catch (error) {
        rosterLoadError = error instanceof Error ? error : new Error(String(error));
        throw rosterLoadError;
    }
}
export async function rosterOnce() {
    return loadRoster();
}
export function packInfoFor(roster, division, slug) {
    const key = `${division}/${slug}`;
    return roster.packs[key];
}
/** Аннотирует персону путями к ресурсам. */
export function annotatePersona(body, expert, locale) {
    if (!expert.packDir)
        return body;
    // Заменяем относительные пути skills/... на абсолютные
    return body.replace(/skills\//g, `${expert.packDir}/skills/`);
}
/** Состояние ресурсов. */
export async function assetsState(packDir, info) {
    const marker = join(packDir, ".assets-ready");
    if (!existsSync(marker))
        return "missing";
    try {
        const content = readFileSync(marker, "utf-8");
        const data = JSON.parse(content);
        if (data.sha256 === info.sha256 && data.bytes === info.bytes)
            return ASSETS_READY;
    }
    catch { }
    return "stale";
}
/** Запускает скачивание ресурсов (не ждёт завершения). */
export function kickoffAssets(options) {
    const { packDir, roster, info, onProgress, onDone, onError } = options;
    // Формируем URL загрузки
    const url = `${roster.baseUrl}/${info.path}`;
    return (async () => {
        try {
            if (!existsSync(packDir))
                mkdirSync(packDir, { recursive: true });
            const response = await fetch(url);
            if (!response.ok)
                throw new Error(`HTTP ${response.status}`);
            const total = Number(response.headers.get("content-length") || info.bytes);
            let received = 0;
            const tarballPath = join(packDir, `.download.${Date.now()}.tar.gz`);
            const writer = createWriteStream(tarballPath);
            if (response.body) {
                const reader = response.body.getReader();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done)
                        break;
                    received += value.length;
                    writer.write(value);
                    onProgress?.({ received, total });
                }
            }
            writer.end();
            await new Promise((resolve, reject) => {
                writer.on("finish", () => resolve());
                writer.on("error", reject);
            });
            // Распаковываем tar.gz (динамический импорт)
            const tarMod = await import("tar");
            await tarMod.extract({ file: tarballPath, cwd: packDir, strip: 1 });
            rmSync(tarballPath);
            // Пишем маркер готовности
            writeFileSync(join(packDir, ".assets-ready"), JSON.stringify({
                sha256: info.sha256,
                bytes: info.bytes,
                at: Date.now(),
            }), "utf-8");
            onDone?.();
            return { status: ASSETS_READY, bytes: info.bytes };
        }
        catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            onError?.({ status: "failed", reason });
            return { status: "failed", reason };
        }
    })();
}
/** Гарантирует наличие ресурсов (скачивает если нужно). */
export async function ensureAssets(options) {
    const { packDir, roster, info } = options;
    const state = await assetsState(packDir, info);
    if (state === ASSETS_READY)
        return { status: ASSETS_READY, bytes: info.bytes };
    // Синхронное скачивание с прогрессом
    return new Promise((resolve) => {
        kickoffAssets({
            packDir,
            roster,
            info,
            onDone: () => resolve({ status: ASSETS_READY, bytes: info.bytes }),
            onError: (res) => resolve(res),
        });
    });
}
//# sourceMappingURL=fetch-assets.js.map