export declare const ASSETS_READY: "ready";
export interface RosterPack {
    division: string;
    slug: string;
    path: string;
    bytes: number;
    rawBytes: number;
    files: number;
    sha256: string;
    dirs: string[];
}
export interface RosterData {
    version: number;
    generatedAt: string;
    baseUrl: string;
    threshold: number;
    packs: Record<string, RosterPack>;
}
export declare function loadRoster(): Promise<RosterData>;
export declare function rosterOnce(): Promise<RosterData>;
export declare function packInfoFor(roster: RosterData, division: string, slug: string): RosterPack | undefined;
/** Аннотирует персону путями к ресурсам. */
export declare function annotatePersona(body: string, expert: any, locale: string): string;
/** Состояние ресурсов. */
export declare function assetsState(packDir: string, info: RosterPack): Promise<string>;
/** Запускает скачивание ресурсов (не ждёт завершения). */
export declare function kickoffAssets(options: {
    packDir: string;
    roster: RosterData;
    info: RosterPack;
    onProgress?: (progress: {
        received: number;
        total?: number;
    }) => void;
    onDone?: () => void;
    onError?: (res: {
        status: string;
        reason?: string;
    }) => void;
}): Promise<{
    status: string;
    bytes?: number;
    reason?: string;
}>;
/** Гарантирует наличие ресурсов (скачивает если нужно). */
export declare function ensureAssets(options: {
    packDir: string;
    roster: RosterData;
    info: RosterPack;
}): Promise<{
    status: string;
    bytes?: number;
    reason?: string;
}>;
//# sourceMappingURL=fetch-assets.d.ts.map