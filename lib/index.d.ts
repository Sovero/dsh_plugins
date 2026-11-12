/** Эксперт — плагин для DeepSeek Harness: каталог предметных экспертов на русском языке, вызываемых как под-агенты через @ меню.
 *
 * Предоставляет:
 * - Инструменты list_ekspert / summon_ekspert / summon_eksperts / fetch_ekspert_assets
 * - Настройку eks-team (enabled: включённые слаги экспертов)
 * - Системный промпт (только в родительской сессии: семантика @ вызова и правила инструментов)
 * - Сервис eksTeamCatalog (remote сервисы читают каталог и персоны)
 *
 * Совместимость с другими эксперт-плагинами: имена инструментов, пространства настроек,
 * имена сервисов, remote service names — все уникальны (префикс eksTeam).
 */
import schema from "@deepseek-ai/schemastery";
export declare const name = "eksTeam";
/** Статический inject — ТОЛЬКО жёсткие зависимости: без них функционал каталога не работает
 * (таблица инструментов, под-агенты, промпт-сегмент). */
export declare const inject: string[];
export declare const Config: schema<Schemastery.ObjectS<NoInfer<{
    root: schema<string, string, "defined">;
    zhRoot: schema<string, string, "defined">;
    customRoot: schema<string, string, "defined">;
    provider: schema<string, string, "defined">;
    divisions: schema<string[], string[], "defined">;
    maxDepth: schema<number, number, "plain">;
    maxSummonBatch: schema<number, number, "defined">;
    summonConcurrency: schema<number, number, "defined">;
    summonTaskMaxChars: schema<number, number, "defined">;
    descriptionLimit: schema<number, number, "defined">;
    summonAssetsWaitMs: schema<number, number, "defined">;
    enabled: any;
    enabledSeeded: any;
    enabledSeedVersion: any;
    enabledSeedRoster: any;
    skillGateStore: schema<string, string, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    root: schema<string, string, "defined">;
    zhRoot: schema<string, string, "defined">;
    customRoot: schema<string, string, "defined">;
    provider: schema<string, string, "defined">;
    divisions: schema<string[], string[], "defined">;
    maxDepth: schema<number, number, "plain">;
    maxSummonBatch: schema<number, number, "defined">;
    summonConcurrency: schema<number, number, "defined">;
    summonTaskMaxChars: schema<number, number, "defined">;
    descriptionLimit: schema<number, number, "defined">;
    summonAssetsWaitMs: schema<number, number, "defined">;
    enabled: any;
    enabledSeeded: any;
    enabledSeedVersion: any;
    enabledSeedRoster: any;
    skillGateStore: schema<string, string, "defined">;
}>>, "plain">;
export declare const CATALOG_SERVICE = "eksTeamCatalog";
export declare const SETTINGS_NAMESPACE = "eksTeam";
export declare const UNKNOWN_SLUG_ERROR_CODE = "eksTeam/unknown-slug";
export declare function apply(ctx: any, config: any): void;
//# sourceMappingURL=index.d.ts.map