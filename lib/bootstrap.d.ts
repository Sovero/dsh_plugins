export declare const SNAPSHOT_DIR: string;
/** Русские бумаги локализации, которые тоже должны попасть в Секретный отсек. */
export declare const LOCALE_DIR: string;
export declare const LOCALE_FILES: readonly ["names.json", "descriptions.json", "divisions.json"];
export interface SeedReport {
    ok: boolean;
    error?: string;
    copied: string[];
    updated: string[];
    merged: Array<{
        path: string;
        keys: string[];
    }>;
    kept: string[];
    stale: string[];
    driftChanged: boolean;
    previousVersion: string;
    version: string;
}
/** Синхронизирует встроенный каталог в пользовательскую директорию. */
export declare function seedData(options: {
    root: string;
    zhRoot: string;
}): SeedReport;
//# sourceMappingURL=bootstrap.d.ts.map