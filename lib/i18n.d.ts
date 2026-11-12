export declare const NS = "eksTeam";
/** Устанавливает текущий язык. */
export declare function setLocale(locale: string): void;
/** Получает текущий язык. */
export declare function getLocale(): string;
/** Читает язык из контекста Cordis. */
export declare function readLocale(ctx: {
    get?: (name: string) => any;
    locale?: string;
}): string;
/** Получает перевод. */
export declare function t(locale: string, key: string, params?: Record<string, string | number | undefined>): string;
/** Рендерит список экспертов. */
export declare function renderList(args: {
    division?: string;
}, value: {
    divisions: Array<{
        division: string;
        label: string;
        labelEn: string;
        count: number;
        experts: any[];
    }>;
    total: number;
    locale: string;
    query: string;
    allDivisions: string[];
}): string;
/** Рендерит результаты пакетного вызова. */
export declare function renderSummonResults(args: {
    experts: any[];
}, value: {
    results: Array<{
        expert: string;
        ok: boolean;
        subagentId: string;
        error?: string;
    }>;
    locale: string;
}): string;
/** Преобразует группы в рендерируемый формат. */
export declare function toRenderableGroups(groups: any[], locale: string): any[];
/** Преобразует результаты вызова в рендерируемый формат. */
export declare function toRenderableSummonResults(results: any[], locale: string): any[];
//# sourceMappingURL=i18n.d.ts.map