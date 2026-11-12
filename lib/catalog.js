import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { createHash } from "node:crypto";
export const NS = "eksTeam";
export const CUSTOM_DIVISION = "custom";
export const CUSTOM_LIMITS = { maxExperts: 200, maxDivisions: 20 };
/** Читает frontmatter из .md файла. */
function readFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match)
        return null;
    try {
        const yaml = match[1];
        const data = {};
        for (const line of yaml.split("\n")) {
            const idx = line.indexOf(":");
            if (idx > 0) {
                const key = line.slice(0, idx).trim();
                const value = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
                data[key] = value;
            }
        }
        // Проверяем обязательные поля
        if (!data.name || !data.description)
            return null;
        return data;
    }
    catch {
        return null;
    }
}
/** Генерирует slug из имени. */
function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9а-яё]+/gi, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 64);
}
/** Нормализует ключ для поиска (убирает эмодзи, пробелы, регистр). */
export function normalizedKey(text) {
    return text
        .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
        .replace(/\s+/g, "")
        .toLowerCase();
}
/** Определяет раздел эксперта. */
export function divisionOf(division, labels) {
    const label = labels[division];
    if (label)
        return label;
    return { zh: division, en: division };
}
/** Считает экспертов в корне (не рекурсивно в пакетах). */
export function countExperts(root) {
    if (!existsSync(root))
        return { experts: 0, divisions: 0 };
    let experts = 0;
    let divisions = 0;
    try {
        for (const div of readdirSync(root, { withFileTypes: true })) {
            if (!div.isDirectory())
                continue;
            if (div.name.startsWith("."))
                continue;
            divisions++;
            const divPath = join(root, div.name);
            for (const file of readdirSync(divPath)) {
                if (file.endsWith(".md"))
                    experts++;
            }
        }
    }
    catch {
        return { experts: 0, divisions: 0 };
    }
    return { experts, divisions };
}
/** Группирует экспертов по разделам с учётом включённых. */
export function groupByDivision(entries, enabled) {
    const groups = new Map();
    for (const entry of entries) {
        if (!groups.has(entry.division))
            groups.set(entry.division, []);
        groups.get(entry.division).push(entry);
    }
    const result = [];
    for (const [division, list] of groups) {
        const enabledList = list.filter((e) => enabled.has(e.slug));
        result.push({
            division,
            label: division,
            labelEn: division,
            count: enabledList.length,
            experts: enabledList.map((e) => ({
                slug: e.slug,
                name: e.name,
                nameEn: e.nameEn,
                description: e.description,
                emoji: e.emoji,
                custom: e.custom === true,
                enabled: true,
            })),
        });
    }
    return result;
}
/** Проверяет валидность раздела. */
export function isValidDivision(name) {
    return /^[a-z0-9-]+$/i.test(name) && name.length > 0 && name.length <= 32;
}
/** Проверяет валидность slug. */
export function isValidSlug(slug) {
    return /^[a-z0-9-]+$/.test(slug) && slug.length > 0 && slug.length <= 64;
}
/** Путь к автостроенному эксперту. */
export function customExpertPath(customRoot, division, slug) {
    return join(customRoot, division, `${slug}.md`);
}
/** Отпечаток файла для обнаружения конфликтов. */
export function fileFingerprint(path) {
    return new Promise((resolve, reject) => {
        const hash = createHash("sha256");
        const stream = require("node:fs").createReadStream(path);
        stream.on("data", (chunk) => hash.update(chunk));
        stream.on("end", () => resolve(hash.digest("hex").slice(0, 16)));
        stream.on("error", reject);
    });
}
/** Читает персону эксперта. */
export async function readPersona(entry, locale) {
    const path = locale === "ru" && entry.personaPathZh ? entry.personaPathZh : entry.personaPath;
    return readFileSync(path, "utf-8");
}
/** Санитизирует персону (убираем небезопасные конструкции). */
export function sanitize(text) {
    return text.replace(/```/g, "\\`\\`\\`");
}
/** Усекает текст до лимита. */
export function truncate(text, limit) {
    if (text.length <= limit)
        return text;
    return text.slice(0, limit - 1) + "…";
}
/** Параллельный пул с ограничением concurrency. */
export async function mapPool(items, concurrency, fn) {
    const results = [];
    const executing = [];
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const promise = fn(item, i).then((result) => {
            results[i] = result;
        });
        executing.push(promise);
        if (executing.length >= concurrency) {
            await Promise.race(executing);
            // Удаляем завершённые
            for (let j = executing.length - 1; j >= 0; j--) {
                // Не можем легко проверить завершённость, просто ждём следующую итерацию
            }
        }
    }
    await Promise.all(executing);
    return results;
}
/** Сохраняет метку автостроенного раздела. */
export function saveCustomLabel(customRoot, division, label) {
    const labelsPath = join(customRoot, "divisions.json");
    let labels = {};
    if (existsSync(labelsPath)) {
        try {
            labels = JSON.parse(readFileSync(labelsPath, "utf-8"));
        }
        catch { }
    }
    labels[division] = label;
    writeFileAtomic(labelsPath, JSON.stringify(labels, null, 2));
}
/** Удаляет автостроенного эксперта. */
export function removeCustomExpert(customRoot, division, slug) {
    const path = customExpertPath(customRoot, division, slug);
    if (existsSync(path)) {
        require("node:fs").unlinkSync(path);
    }
    // Чистим пустые директории
    try {
        const divDir = join(customRoot, division);
        if (existsSync(divDir) && readdirSync(divDir).length === 0) {
            require("node:fs").rmdirSync(divDir);
        }
    }
    catch { }
}
/** Сериализует автостроенного эксперта в .md. */
export function serializeCustomExpert(data) {
    return `---
name: "${data.name.replace(/"/g, '\\"')}"
name_en: "${data.nameEn.replace(/"/g, '\\"')}"
description: "${data.description.replace(/"/g, '\\"')}"
description_en: "${data.descriptionEn.replace(/"/g, '\\"')}"
emoji: "${data.emoji}"
division: "${data.division}"
slug: "${data.slug}"
custom: true
---

${data.persona}
`;
}
/** Загружает каталог экспертов. */
export async function loadCatalog(root, configuredDivisions, options) {
    const { zhRoot, customRoot, logger } = options;
    const catalog = new Map();
    catalog.sidecarPresent = true;
    catalog.skippedFiles = 0;
    catalog.unreadableDivisions = [];
    catalog.customDivisions = [];
    catalog.rosterDivisions = [];
    catalog.customLabels = {};
    catalog.labels = {};
    // Загружаем метки разделов
    const labelsPath = join(zhRoot, "divisions.json");
    if (existsSync(labelsPath)) {
        try {
            catalog.labels = JSON.parse(readFileSync(labelsPath, "utf-8"));
        }
        catch { }
    }
    // Загружаем метки автостроенных разделов
    const customLabelsPath = join(customRoot, "divisions.json");
    if (existsSync(customLabelsPath)) {
        try {
            catalog.customLabels = JSON.parse(readFileSync(customLabelsPath, "utf-8"));
        }
        catch { }
    }
    // Определяем разделы для сканирования
    let divisionsToScan = configuredDivisions.length > 0 ? configuredDivisions : [];
    if (divisionsToScan.length === 0) {
        if (existsSync(root)) {
            divisionsToScan = readdirSync(root, { withFileTypes: true })
                .filter((d) => d.isDirectory() && !d.name.startsWith("."))
                .map((d) => d.name);
        }
    }
    // Сканируем основной каталог (только для чтения)
    for (const division of divisionsToScan) {
        const divPath = join(root, division);
        if (!existsSync(divPath)) {
            catalog.unreadableDivisions.push(division);
            continue;
        }
        catalog.rosterDivisions.push(division);
        let files;
        try {
            files = readdirSync(divPath).filter((f) => f.endsWith(".md"));
        }
        catch {
            catalog.unreadableDivisions.push(division);
            continue;
        }
        for (const file of files) {
            const filePath = join(divPath, file);
            const content = readFileSync(filePath, "utf-8");
            const fm = readFrontmatter(content);
            if (!fm) {
                catalog.skippedFiles++;
                logger?.warn?.(`[eks-team] Пропуск ${filePath}: нет frontmatter`);
                continue;
            }
            const slug = fm.slug || slugify(fm.name) || basename(file, ".md");
            const key = `${division}/${slug}`;
            const entry = {
                slug,
                name: fm.name,
                nameEn: fm.name_en || fm.name,
                nameZh: fm.name_zh,
                description: fm.description,
                descriptionEn: fm.description_en || fm.description,
                descriptionZh: fm.description_zh,
                emoji: fm.emoji || "🧠",
                division,
                personaPath: filePath,
                personaPathZh: existsSync(join(zhRoot, division, file)) ? join(zhRoot, division, file) : undefined,
                custom: false,
            };
            if (catalog.has(key)) {
                entry.conflict = true;
                catalog.get(key).conflict = true;
                logger?.warn?.(`[eks-team] Конфликт slug: ${key} (два файла)`);
            }
            catalog.set(key, entry);
        }
    }
    // Сканируем автостроенных экспертов (customRoot)
    if (existsSync(customRoot)) {
        try {
            const customDivs = readdirSync(customRoot, { withFileTypes: true })
                .filter((d) => d.isDirectory() && !d.name.startsWith("."))
                .map((d) => d.name);
            catalog.customDivisions = customDivs;
            for (const division of customDivs) {
                const divPath = join(customRoot, division);
                const files = readdirSync(divPath).filter((f) => f.endsWith(".md"));
                for (const file of files) {
                    const filePath = join(divPath, file);
                    const content = readFileSync(filePath, "utf-8");
                    const fm = readFrontmatter(content);
                    if (!fm) {
                        catalog.skippedFiles++;
                        continue;
                    }
                    const slug = fm.slug || slugify(fm.name) || basename(file, ".md");
                    const key = `${CUSTOM_DIVISION}/${division}/${slug}`;
                    const entry = {
                        slug,
                        name: fm.name,
                        nameEn: fm.name_en || fm.name,
                        nameZh: fm.name_zh,
                        description: fm.description,
                        descriptionEn: fm.description_en || fm.description,
                        descriptionZh: fm.description_zh,
                        emoji: fm.emoji || "🛠️",
                        division: `${CUSTOM_DIVISION}/${division}`,
                        personaPath: filePath,
                        personaPathZh: existsSync(join(zhRoot, division, file)) ? join(zhRoot, division, file) : undefined,
                        custom: true,
                    };
                    if (catalog.has(key)) {
                        entry.conflict = true;
                        catalog.get(key).conflict = true;
                    }
                    catalog.set(key, entry);
                }
            }
        }
        catch (error) {
            logger?.error?.(`[eks-team] Ошибка сканирования custom: ${error}`);
        }
    }
    // Проверяем наличие zh-сайдкара
    catalog.sidecarPresent = existsSync(zhRoot);
    return catalog;
}
/** Возвращает список разделов каталога. */
export function catalogDivisions(catalog) {
    const divisions = new Set();
    for (const entry of catalog.values()) {
        divisions.add(entry.division);
    }
    return Array.from(divisions).sort();
}
/** Разрешает запрос пользователя в запись эксперта. */
export function resolveExpert(entries, query, locale) {
    const text = query.trim();
    if (!text)
        throw new Error("Пустой запрос эксперта");
    const norm = normalizedKey(text);
    const candidates = entries.filter((e) => !e.conflict);
    // Точное совпадение по slug
    let match = candidates.find((e) => e.slug === text);
    if (match)
        return match;
    // Совпадение по имени (с учётом локали)
    match = candidates.find((e) => {
        const name = locale === "ru" && e.nameZh ? e.nameZh : e.name;
        return normalizedKey(name) === norm;
    });
    if (match)
        return match;
    // Совпадение по английскому имени
    match = candidates.find((e) => normalizedKey(e.nameEn) === norm);
    if (match)
        return match;
    // Частичное совпадение
    match = candidates.find((e) => {
        const name = locale === "ru" && e.nameZh ? e.nameZh : e.name;
        return normalizedKey(name).includes(norm) || norm.includes(normalizedKey(name));
    });
    if (match)
        return match;
    throw new Error(`Эксперт не найден: ${text}`);
}
/** Локализует запись эксперта. */
export function localized(entry, locale) {
    if (locale === "ru") {
        return {
            name: entry.nameZh || entry.name,
            description: entry.descriptionZh || entry.description,
        };
    }
    return { name: entry.nameEn, description: entry.descriptionEn };
}
/** Атомарная запись файла. */
export function writeFileAtomic(path, content) {
    const tmp = `${path}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;
    require("node:fs").writeFileSync(tmp, content, "utf-8");
    require("node:fs").renameSync(tmp, path);
}
//# sourceMappingURL=catalog.js.map