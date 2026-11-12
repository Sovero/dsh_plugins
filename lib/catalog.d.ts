export declare const NS = "eksTeam";
export declare const CUSTOM_DIVISION = "custom";
export declare const CUSTOM_LIMITS: {
    maxExperts: number;
    maxDivisions: number;
};
/** Структура одной записи эксперта в каталоге. */
export interface ExpertEntry {
    slug: string;
    name: string;
    nameEn: string;
    nameZh?: string;
    description: string;
    descriptionEn: string;
    descriptionZh?: string;
    emoji: string;
    division: string;
    personaPath: string;
    personaPathZh?: string;
    packDir?: string;
    custom?: boolean;
    conflict?: boolean;
}
/** Результат загрузки каталога. */
export interface CatalogResult extends Map<string, ExpertEntry> {
    sidecarPresent: boolean;
    skippedFiles: number;
    unreadableDivisions: string[];
    customDivisions: string[];
    rosterDivisions: string[];
    customLabels: Record<string, string>;
    labels: Record<string, {
        zh: string;
        en: string;
    }>;
}
/** Нормализует ключ для поиска (убирает эмодзи, пробелы, регистр). */
export declare function normalizedKey(text: string): string;
/** Определяет раздел эксперта. */
export declare function divisionOf(division: string, labels: Record<string, {
    zh: string;
    en: string;
}>): {
    zh: string;
    en: string;
};
/** Считает экспертов в корне (не рекурсивно в пакетах). */
export declare function countExperts(root: string): {
    experts: number;
    divisions: number;
};
/** Группирует экспертов по разделам с учётом включённых. */
export declare function groupByDivision(entries: ExpertEntry[], enabled: Set<string>): Array<{
    division: string;
    label: string;
    labelEn: string;
    count: number;
    experts: Array<{
        slug: string;
        name: string;
        nameEn: string;
        description: string;
        emoji: string;
        custom: boolean;
        enabled: boolean;
    }>;
}>;
/** Проверяет валидность раздела. */
export declare function isValidDivision(name: string): boolean;
/** Проверяет валидность slug. */
export declare function isValidSlug(slug: string): boolean;
/** Путь к автостроенному эксперту. */
export declare function customExpertPath(customRoot: string, division: string, slug: string): string;
/** Отпечаток файла для обнаружения конфликтов. */
export declare function fileFingerprint(path: string): Promise<string>;
/** Читает персону эксперта. */
export declare function readPersona(entry: ExpertEntry, locale: string): Promise<string>;
/** Санитизирует персону (убираем небезопасные конструкции). */
export declare function sanitize(text: string): string;
/** Усекает текст до лимита. */
export declare function truncate(text: string, limit: number): string;
/** Параллельный пул с ограничением concurrency. */
export declare function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]>;
/** Сохраняет метку автостроенного раздела. */
export declare function saveCustomLabel(customRoot: string, division: string, label: string): void;
/** Удаляет автостроенного эксперта. */
export declare function removeCustomExpert(customRoot: string, division: string, slug: string): void;
/** Сериализует автостроенного эксперта в .md. */
export declare function serializeCustomExpert(data: {
    name: string;
    nameEn: string;
    description: string;
    descriptionEn: string;
    emoji: string;
    division: string;
    slug: string;
    persona: string;
}): string;
/** Загружает каталог экспертов. */
export declare function loadCatalog(root: string, configuredDivisions: string[], options: {
    zhRoot: string;
    customRoot: string;
    logger?: {
        info?: (msg: string) => void;
        warn?: (msg: string) => void;
        error?: (msg: string) => void;
    };
}): Promise<CatalogResult>;
/** Возвращает список разделов каталога. */
export declare function catalogDivisions(catalog: CatalogResult): string[];
/** Разрешает запрос пользователя в запись эксперта. */
export declare function resolveExpert(entries: ExpertEntry[], query: string, locale: string): ExpertEntry;
/** Локализует запись эксперта. */
export declare function localized(entry: ExpertEntry, locale: string): {
    name: string;
    description: string;
};
/** Атомарная запись файла. */
export declare function writeFileAtomic(path: string, content: string): void;
//# sourceMappingURL=catalog.d.ts.map