// @ts-check
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

import { homedir } from "node:os";
import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, cpSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import schema from "@deepseek-ai/schemastery";
import { defineTool } from "@deepseek-ai/dsh-tools";

import {
  NS,
  CUSTOM_DIVISION,
  CUSTOM_LIMITS,
  catalogDivisions,
  countExperts,
  customExpertPath,
  divisionOf,
  fileFingerprint,
  groupByDivision,
  isValidDivision,
  isValidSlug,
  loadCatalog,
  localized as localizedExpert,
  mapPool,
  normalizedKey,
  readPersona,
  removeCustomExpert,
  resolveExpert,
  sanitize,
  saveCustomLabel,
  serializeCustomExpert,
  truncate,
  writeFileAtomic,
  type ExpertEntry,
} from "./catalog.js";

// Облачная доставка ресурсов (персона локально, навыки/данные по требованию из OBS).
import {
  annotatePersona,
  assetsState,
  ensureAssets,
  kickoffAssets,
  loadRoster,
  packInfoFor,
  rosterOnce,
  ASSETS_READY,
} from "./fetch-assets.js";

/** Корень плагина (родитель lib/). data/roster.json лежит здесь — манифест «какие пакеты имеют большие вложения»,
 * идёт строго в составе пакета, не читается из пользовательской директории: он описывает поставку, а не правки пользователя. */
const HERE = dirname(dirname(fileURLToPath(import.meta.url)));

// Ворота навыков (2026-09-28 перенесены из dsh-plugin-skill-gate): оборачивают ctx.skills,
// убирая отключённые навыки из модели. Точка входа — динамический inject: если у хоста нет skills сервиса,
// просто теряем эту часть, остальное работает.
import { installSkillGate } from "./skill-gate/install.js";

import {
  NS as I18N_NS,
  readLocale,
  renderList,
  renderSummonResults,
  t,
  toRenderableGroups,
  toRenderableSummonResults,
} from "./i18n.js";

import { seedData } from "./bootstrap.js";
import { installBundledSkills } from "./skill.js";
import { SNAPSHOT_DIR } from "./bootstrap.js";

// Два плагина экспертов могут стоять одновременно и быть включены — хранилище, имена сервисов,
// коды ошибок, источники сообщений полностью изолированы.
import { createUserMessage } from "@deepseek-ai/dsh-llm";

export const name = NS;

/** Статический inject — ТОЛЬКО жёсткие зависимости: без них функционал каталога не работает
 * (таблица инструментов, под-агенты, промпт-сегмент). */
export const inject = ["tools", "subagents", "systemPrompt"];

/** Настройки плагина.
 *
 * Правило: параметры, которые могут отличаться в разных деплоях, должны быть полями Config,
 * чтобы cordis.yml мог их перекрыть. Поэтому лимиты вызова/параллельности/длины задачи/среза
 * описания — здесь. Константы протокола и фиксированные списки — в модуле.
 */
const VOLATILE_WRITE = Symbol.for("cosmokit.volatile.write");

const unwrapVolatile = (value: any) =>
  typeof value === "object" && value !== null && VOLATILE_WRITE in value ? value.get() : value;

const volatileField = (field: any) =>
  typeof field?.volatile === "function" ? field.volatile() : field;

export const Config = schema.object({
  root: schema.string().default(join(homedir(), ".eks-team", "eksperts")),
  zhRoot: schema.string().default(join(homedir(), ".eks-team", "ru")),
  customRoot: schema.string().default(join(homedir(), ".eks-team", "custom")),
  provider: schema.string().default("spawn"),
  divisions: schema.array(schema.string()).default([]),
  maxDepth: schema.natural(),
  maxSummonBatch: schema.natural().min(1).default(8),
  summonConcurrency: schema.natural().min(1).default(4),
  summonTaskMaxChars: schema.natural().min(1).default(8000),
  descriptionLimit: schema.natural().min(1).default(120),
  summonAssetsWaitMs: schema.natural().max(600_000).default(120_000),
  enabled: volatileField(schema.array(schema.string()).default([])),
  enabledSeeded: volatileField(schema.boolean().default(false)),
  enabledSeedVersion: volatileField(schema.number().default(0)),
  enabledSeedRoster: volatileField(schema.array(schema.string()).default([])),
  skillGateStore: schema.string().default(join(homedir(), ".dsh", "skill-gate.json")),
});

export const CATALOG_SERVICE = "eksTeamCatalog";
export const SETTINGS_NAMESPACE = NS;

export const UNKNOWN_SLUG_ERROR_CODE = "eksTeam/unknown-slug";

const ENABLED_SEED_VERSION = 1;

const settingsSchema = schema.object({
  enabled: schema.array(schema.string()).default([]),
  enabledSeeded: schema.boolean().default(false),
  enabledSeedVersion: schema.number().default(0),
  enabledSeedRoster: schema.array(schema.string()).default([]),
});

function logSeedReport(logger: any, seeded: any, dataHome: string) {
  const sample = (list: string[]) =>
    list.length === 0 ? "" : `, например ${list.slice(0, 3).join(", ")}${list.length > 3 ? " и др." : ""}`;
  const mergedKeys = seeded.merged.reduce((sum: number, item: any) => sum + item.keys.length, 0);
  const delivered = seeded.copied.length + seeded.updated.length + mergedKeys;
  const versionNote =
    seeded.previousVersion !== "" && seeded.previousVersion !== seeded.version
      ? ` (внутренний снапшот v${seeded.previousVersion} → v${seeded.version})`
      : "";
  if (delivered > 0 || versionNote !== "") {
    const parts: string[] = [];
    if (seeded.copied.length > 0) parts.push(`новых ${seeded.copied.length}${sample(seeded.copied)}`);
    if (seeded.updated.length > 0) parts.push(`выровнено read-only ${seeded.updated.length}${sample(seeded.updated)}`);
    if (mergedKeys > 0) parts.push(`дополнено ключей ${mergedKeys}${sample(seeded.merged.flatMap((i: any) => i.keys))}`);
    logger?.info?.(`[eks-team] Снапшот каталога синхронизирован в ${dataHome}${versionNote}: ${parts.join("; ") || "без изменений"}`);
  }
  if ((seeded.kept.length > 0 || seeded.stale.length > 0) && seeded.driftChanged) {
    const parts: string[] = [];
    if (seeded.kept.length > 0) parts.push(`${seeded.kept.length} записей отличаются от поставки${sample(seeded.kept)}`);
    if (seeded.stale.length > 0) parts.push(`${seeded.stale.length} записей убраны из поставки${sample(seeded.stale)}`);
    logger?.warn?.(
      `[eks-team] Снапшот каталога имеет ${parts.join(" и ")}; сохранено по принципу «не перезаписываем ваше», перезапись не производилась.` +
        " Если это не ваши правки — удалите соответствующие файлы и перезапустите для повторной синхронизации.",
    );
  }
}

const rosterScaleCache = new Map<string, { experts: number; divisions: number }>();

function rosterScale(root: string) {
  const cached = rosterScaleCache.get(root);
  if (cached !== undefined) return cached;
  const scale = countExperts(root);
  rosterScaleCache.set(root, scale);
  return scale;
}

export function apply(ctx: any, config: any) {
  const locale = () => readLocale(ctx);
  const maxDepth = config.maxDepth;

  // ---- Синхронизация при старте: встроенный снапшот → пользовательская директория ----
  const seeded = seedData({ root: config.root, zhRoot: config.zhRoot });
  logSeedReport(ctx.logger, seeded, dirname(config.root));
  if (!seeded.ok) {
    ctx.logger?.error?.(`[eks-team] Синхронизация снапшота не удалась, продолжаем с имеющимися данными: ${seeded.error}`);
  }

  // ---- Ворота навыков (бывший dsh-plugin-skill-gate) ----
  if (typeof ctx.inject === "function") {
    let installedSkills: any = undefined;
    ctx.inject(["skills"], (scoped: any) => {
      const skillsCtx = scoped ?? ctx;
      const skills = skillsCtx?.skills;
      if (installedSkills === undefined) {
        installedSkills = skills;
        try {
          installSkillGate(skillsCtx, { storePath: config.skillGateStore });
        } catch (error) {
          ctx.logger?.error?.("[eks-team] Ворота навыков не установились (каталог экспертов не затронут):", error);
        }
        return;
      }
      if (skills === installedSkills) return;
      ctx.logger?.warn?.(
        "[eks-team] У хоста сменился экземпляр skills сервиса, ворота навыков всё ещё действуют на старый: " +
          "новые/перезагруженные навыки могут не уважать список отключённых. Перезагрузите плагин Эксперт (или хост) — каталог и вызовы не затронуты.",
      );
    });
  } else {
    ctx.logger?.warn?.("[eks-team] Нет ctx.inject: ворота навыков недоступны (каталог экспертов не затронут).");
  }

  // ---- Настройки (своё пространство имён, не конфликтует с другими плагинами) ----
  let scope: any;
  let settingsService: any;
  let prefsMode = "none";

  if (typeof ctx.inject !== "function") {
    ctx.logger?.warn?.("[eks-team] Нет ctx.inject: не можем дождаться settings, включение/выключение экспертов недоступно.");
  } else {
    ctx.logger?.warn?.("[eks-team] Ожидаем готовность settings сервиса для регистрации настроек; если хост его не даёт — вкладка Эксперт и включение/выключение не будут работать.");
    ctx.inject(["settings"], (scoped: any) => {
      settingsService = scoped.settings ?? scoped.get?.("settings");
      if (typeof settingsService?.register === "function") {
        scope = settingsService.register(SETTINGS_NAMESPACE, settingsSchema, {
          base: { enabled: [], enabledSeeded: false, enabledSeedVersion: 0 },
          applies: "live",
          validate: (value: any) => {
            const list = value?.enabled;
            if (!Array.isArray(list) || list.some((item: any) => typeof item !== "string")) {
              throw new Error("eks-team.enabled должен быть массивом строк");
            }
          },
        });
        prefsMode = "scope";
        return;
      }
      if (typeof settingsService?.mutate === "function") {
        prefsMode = "entry";
        if (typeof settingsService?.configure === "function" && typeof ctx.effect === "function") {
          ctx.effect(() => settingsService.configure({ auto: false }, ctx.fiber), "eks-team: настройка страницы");
        }
        return;
      }
      ctx.logger?.warn?.("[eks-team] У settings нет ни register ни mutate: включение/выключение недоступно (каталог и вызовы работают).");
    });
  }

  const readPrefs = () => {
    if (prefsMode === "scope") return scope?.get?.();
    if (prefsMode === "entry") {
      const source = config ?? {};
      return {
        enabled: unwrapVolatile(source.enabled) as string[],
        enabledSeeded: unwrapVolatile(source.enabledSeeded),
        enabledSeedVersion: unwrapVolatile(source.enabledSeedVersion),
        enabledSeedRoster: unwrapVolatile(source.enabledSeedRoster) as string[],
      };
    }
    return undefined;
  };

  const enabledSet = () => new Set<string>((readPrefs()?.enabled ?? []).filter((v: unknown): v is string => typeof v === "string"));

  const requireSettings = () => {
    if (settingsService === undefined) throw new Error(t(locale(), "error.settingsServiceMissing"));
    return settingsService;
  };

  // ---- Загрузка каталога ----
  let entries: ExpertEntry[] = [];
  let effectiveDivisions = config.divisions.slice();
  let customDivisions: string[] = [];
  let rosterDivisions: string[] = [];
  let customLabels: Record<string, string> = {};
  let divisionLabels: Record<string, { zh: string; en: string }> = {};
  let loaded = false;
  let loading: Promise<void> | null = null;
  let stamp = "";
  let loadError: Error | null = null;
  let sidecarPresent = true;
  let skippedFiles = 0;
  let unreadableDivisions: string[] = [];

  async function fingerprint() {
    const mtimeOf = (path: string) => {
      try {
        return statSync(path).mtimeMs;
      } catch {
        return 0;
      }
    };
    const parts = await Promise.all([
      mtimeOf(config.root),
      mtimeOf(config.zhRoot),
      mtimeOf(join(config.zhRoot, "manual-bodies")),
      mtimeOf(join(dirname(config.root), "source.json")),
      mtimeOf(join(config.zhRoot, "names.json")),
      mtimeOf(join(config.zhRoot, "descriptions.json")),
      mtimeOf(join(config.zhRoot, "divisions.json")),
      mtimeOf(join(config.zhRoot, "manual.json")),
      ...effectiveDivisions.map((division: string) => mtimeOf(join(config.root, division))),
      ...effectiveDivisions.map((division: string) => mtimeOf(join(config.zhRoot, division))),
      ...effectiveDivisions.map((division: string) => mtimeOf(join(config.zhRoot, "manual-bodies", division))),
      mtimeOf(config.customRoot),
      ...customDivisions.map((division: string) => mtimeOf(join(config.customRoot, division))),
      mtimeOf(config.customRoot === undefined || config.customRoot === "" ? "" : join(config.customRoot, "divisions.json")),
    ]);
    return parts.join("|");
  }

  async function load() {
    try {
      const catalog = await loadCatalog(config.root, config.divisions, {
        zhRoot: config.zhRoot,
        customRoot: config.customRoot,
        logger: ctx.logger,
      });
      entries = [...catalog.values()];
      sidecarPresent = catalog.sidecarPresent !== false;
      skippedFiles = typeof catalog.skippedFiles === "number" ? catalog.skippedFiles : 0;
      unreadableDivisions = Array.isArray(catalog.unreadableDivisions) ? catalog.unreadableDivisions : [];
      if (catalog.customDivisions !== undefined) customDivisions = catalog.customDivisions;
      if (catalog.rosterDivisions !== undefined) rosterDivisions = catalog.rosterDivisions;
      customLabels = catalog.customLabels ?? {};
      const discovered = catalogDivisions(catalog);
      if (discovered.length > 0) effectiveDivisions = discovered;
      divisionLabels = catalog.labels ?? {};
      loadError = null;
      loaded = true;
      rosterScaleCache.delete(config.root);
      stamp = await fingerprint();
    } catch (error) {
      loadError = error instanceof Error ? error : new Error(String(error));
      loaded = false;
    }
  }

  async function ensureReady() {
    const now = await fingerprint();
    if (!loaded || now !== stamp) {
      if (loading === null) {
        loading = load().finally(() => { loading = null; });
      }
      await loading;
    }
    if (loadError !== null) throw loadError;
    await pruneStaleEnabled();
    await seedDefaultEnabled();
  }

  async function pruneStaleEnabled() {
    if (settingsService === undefined) return;
    const known = new Set(entries.map((e) => e.slug));
    const list = [...enabledSet()];
    const stale = list.filter((slug) => !known.has(slug));
    if (stale.length === 0) return;
    if (known.size === 0) return;
    try {
      const next = list.filter((slug) => known.has(slug));
      await settingsService.mutate(SETTINGS_NAMESPACE, [{ op: "set", path: ["enabled"], value: next }], revision());
      ctx.logger?.warn?.(`[eks-team] Убрано из включённых ${stale.length} несуществующих в каталоге slug: ${stale.slice(0, 5).join(", ")}${stale.length > 5 ? " …" : ""} (после обновления каталога или удаления своих экспертов)`);
    } catch (error) {
      ctx.logger?.warn?.(`[eks-team] Не удалось очистить устаревшие slug: ${String(error)}`);
    }
  }

  async function seedDefaultEnabled() {
    if (settingsService === undefined) return;
    const state = readPrefs();
    if (state === undefined) return;
    const roster = usable().map((e) => e.slug);
    if (roster.length === 0) return;
    const current = state.enabled ?? [];
    const seen = state.enabledSeedRoster ?? [];
    const baseline = new Set(seen.length > 0 ? seen : current);
    const added = roster.filter((slug) => !baseline.has(slug));
    const upToDate = (state.enabledSeedVersion ?? 0) >= ENABLED_SEED_VERSION;
    if (upToDate && added.length === 0) return;
    const nextEnabled = [...new Set([...current, ...added])];
    try {
      await settingsService.mutate(SETTINGS_NAMESPACE, [
        { op: "set", path: ["enabled"], value: nextEnabled },
        { op: "set", path: ["enabledSeeded"], value: true },
        { op: "set", path: ["enabledSeedVersion"], value: ENABLED_SEED_VERSION },
        { op: "set", path: ["enabledSeedRoster"], value: roster },
      ], revision());
      ctx.logger?.info?.(`[eks-team] Включено ${nextEnabled.length} экспертов (добавлено ${added.length}, в каталоге ${roster.length})`);
    } catch (error) {
      ctx.logger?.warn?.(`[eks-team] Запись автовключения не удалась: ${String(error)}`);
    }
  }

  const usable = () => entries.filter((e) => e.conflict !== true);

  function displayNameOf(query: string, current: string) {
    const text = String(query ?? "").trim();
    if (text === "") return "";
    try {
      return localizedExpert(resolveExpert(usable(), text, current), current).name;
    } catch {
      return text;
    }
  }

  const revision = () => {
    const descriptor = settingsService?.describe?.().find((item: any) => item.ns === SETTINGS_NAMESPACE);
    if (descriptor === undefined) throw new Error(t(locale(), "error.settingsMissing"));
    return descriptor.revision;
  };

  // ---- Сервис каталога для remote ----
  async function snapshot() {
    await ensureReady();
    requireSettings();
    const enabled = enabledSet();
    const roster = await rosterOnce();
    const experts = await Promise.all(usable().map(async (expert) => ({
      slug: expert.slug,
      name: expert.nameZh ?? expert.name,
      nameEn: expert.nameEn,
      description: expert.descriptionZh ?? expert.description,
      descriptionEn: expert.descriptionEn,
      emoji: expert.emoji,
      division: expert.division,
      divisionZh: divisionOf(expert.division, divisionLabels).zh,
      divisionEn: divisionOf(expert.division, divisionLabels).en,
      conflict: expert.conflict === true,
      custom: expert.custom === true,
      hash: expert.custom === true ? await fileFingerprint(expert.personaPath) : "",
      assets: await assetsOf(expert, roster),
    })));
    return { experts, enabled: [...enabled], divisions: effectiveDivisions, customDivisions, customLabels, divisionLabels };
  }

  async function assetsOf(expert: ExpertEntry, roster: any) {
    if (expert.packDir === undefined) return { status: "local" as const };
    const info = packInfoFor(roster, expert.division, expert.slug);
    if (info === undefined) return { status: "local" as const };
    const state = await assetsState(expert.packDir, info);
    if (state === ASSETS_READY) return { status: "ready" as const, bytes: info.bytes };
    if (state === "stale") return { status: "pending" as const, bytes: info.bytes };
    return { status: "missing" as const, bytes: info.bytes };
  }

  async function prompt(expert: ExpertEntry, currentLocale: string) {
    const body = await readPersona(expert, currentLocale);
    return annotatePersona(body, expert, currentLocale);
  }

  async function setEnabled(list: string[], expectedRevision: number) {
    await ensureReady();
    requireSettings();
    const known = new Set(usable().map((e) => e.slug));
    const unknown = list.filter((slug) => !known.has(slug));
    if (unknown.length > 0) {
      const slugs = unknown.slice(0, 5);
      const error = new Error(t(locale(), "error.customUnknownSlug", { slugs: slugs.join(", ") }));
      (error as any).code = UNKNOWN_SLUG_ERROR_CODE;
      (error as any).details = { slugs };
      throw error;
    }
    await settingsService.mutate(SETTINGS_NAMESPACE, [{ op: "set", path: ["enabled"], value: list }], expectedRevision);
    return { enabled: [...enabledSet()], revision: revision() };
  }

  async function createExpert(data: {
    division: string;
    name: string;
    nameEn: string;
    description: string;
    descriptionEn: string;
    emoji: string;
    slug?: string;
    persona: string;
  }) {
    await ensureReady();
    requireSettings();
    const division = data.division.trim();
    if (!isValidDivision(division)) throw new Error(t(locale(), "create.error.invalidDivision"));
    const slug = (data.slug || slugify(data.name)).trim();
    if (!isValidSlug(slug)) throw new Error(t(locale(), "create.error.invalidSlug"));
    if (division.startsWith(CUSTOM_DIVISION + "/")) throw new Error("Нельзя создавать встроенные разделы через этот API");
    const fullDiv = `${CUSTOM_DIVISION}/${division}`;
    const known = new Set(usable().map((e) => `${e.division}/${e.slug}`));
    if (known.has(`${fullDiv}/${slug}`)) throw new Error(t(locale(), "create.error.exists"));
    if (customDivisions.length >= CUSTOM_LIMITS.maxDivisions) throw new Error("Превышен лимит своих разделов");
    const divExperts = usable().filter((e) => e.division === fullDiv).length;
    if (divExperts >= CUSTOM_LIMITS.maxExperts) throw new Error("Превышен лимит экспертов в разделе");

    const path = customExpertPath(config.customRoot, division, slug);
    mkdirSync(dirname(path), { recursive: true });
    const content = serializeCustomExpert({ ...data, division: fullDiv, slug, persona: data.persona });
    writeFileAtomic(path, content);
    saveCustomLabel(config.customRoot, division, data.name);
    return { division: fullDiv, slug, path };
  }

  async function updateExpert(slug: string, division: string, data: Partial<{
    name: string; nameEn: string; description: string; descriptionEn: string; emoji: string; persona: string;
  }>, expectedHash: string) {
    await ensureReady();
    requireSettings();
    const fullDiv = division.startsWith(CUSTOM_DIVISION + "/") ? division : `${CUSTOM_DIVISION}/${division}`;
    const path = customExpertPath(config.customRoot, division.replace(CUSTOM_DIVISION + "/", ""), slug);
    const actualHash = await fileFingerprint(path);
    if (actualHash !== expectedHash) throw new Error("Конфликт параллельного редактирования (hash mismatch)");
    const content = readFileSync(path, "utf-8");
    const fmEnd = content.indexOf("\n---");
    const frontmatter = content.slice(0, fmEnd + 4);
    const body = content.slice(fmEnd + 4);
    const newFm = frontmatter
      .replace(/name: .*/, `name: "${(data.name ?? "").replace(/"/g, '\\"')}"`)
      .replace(/name_en: .*/, `name_en: "${(data.nameEn ?? "").replace(/"/g, '\\"')}"`)
      .replace(/description: .*/, `description: "${(data.description ?? "").replace(/"/g, '\\"')}"`)
      .replace(/description_en: .*/, `description_en: "${(data.descriptionEn ?? "").replace(/"/g, '\\"')}"`)
      .replace(/emoji: .*/, `emoji: "${(data.emoji ?? "").replace(/"/g, '\\"')}"`);
    const newContent = `${newFm}\n${data.persona ?? body}`;
    writeFileAtomic(path, newContent);
    if (data.name) saveCustomLabel(config.customRoot, division, data.name);
    return { division: fullDiv, slug, path, hash: await fileFingerprint(path) };
  }

  async function deleteExpert(slug: string, division: string, expectedHash: string) {
    await ensureReady();
    requireSettings();
    const fullDiv = division.startsWith(CUSTOM_DIVISION + "/") ? division : `${CUSTOM_DIVISION}/${division}`;
    const path = customExpertPath(config.customRoot, division.replace(CUSTOM_DIVISION + "/", ""), slug);
    const actualHash = await fileFingerprint(path);
    if (actualHash !== expectedHash) throw new Error("Конфликт параллельного удаления (hash mismatch)");
    removeCustomExpert(config.customRoot, division.replace(CUSTOM_DIVISION + "/", ""), slug);
    return { ok: true };
  }

  async function createCategory(division: string, label: string, labelEn: string) {
    await ensureReady();
    requireSettings();
    if (!isValidDivision(division)) throw new Error(t(locale(), "create.error.invalidDivision"));
    if (rosterDivisions.includes(division) || customDivisions.includes(division)) throw new Error("Раздел уже существует");
    const labelsPath = join(config.customRoot, "divisions.json");
    let labels: Record<string, string> = {};
    if (existsSync(labelsPath)) labels = JSON.parse(readFileSync(labelsPath, "utf-8"));
    labels[division] = label;
    writeFileAtomic(labelsPath, JSON.stringify(labels, null, 2));
    const zhLabelsPath = join(config.zhRoot, "divisions.json");
    let zhLabels: Record<string, { zh: string; en: string }> = {};
    if (existsSync(zhLabelsPath)) zhLabels = JSON.parse(readFileSync(zhLabelsPath, "utf-8"));
    zhLabels[division] = { zh: label, en: labelEn };
    writeFileAtomic(zhLabelsPath, JSON.stringify(zhLabels, null, 2));
    return { division, label, labelEn };
  }

  async function updateCategory(division: string, label: string, labelEn: string) {
    await ensureReady();
    requireSettings();
    if (!customDivisions.includes(division)) throw new Error("Можно редактировать только свои разделы");
    const labelsPath = join(config.customRoot, "divisions.json");
    let labels: Record<string, string> = {};
    if (existsSync(labelsPath)) labels = JSON.parse(readFileSync(labelsPath, "utf-8"));
    labels[division] = label;
    writeFileAtomic(labelsPath, JSON.stringify(labels, null, 2));
    const zhLabelsPath = join(config.zhRoot, "divisions.json");
    let zhLabels: Record<string, { zh: string; en: string }> = {};
    if (existsSync(zhLabelsPath)) zhLabels = JSON.parse(readFileSync(zhLabelsPath, "utf-8"));
    zhLabels[division] = { zh: label, en: labelEn };
    writeFileAtomic(zhLabelsPath, JSON.stringify(zhLabels, null, 2));
    return { division, label, labelEn };
  }

  async function deleteCategory(division: string) {
    await ensureReady();
    requireSettings();
    if (!customDivisions.includes(division)) throw new Error("Можно удалять только свои разделы");
    const divPath = join(config.customRoot, division);
    const files = readdirSync(divPath).filter((f) => f.endsWith(".md"));
    if (files.length > 0) throw new Error(t(locale(), "division.error.notEmpty"));
    rmSync(divPath, { recursive: true });
    const labelsPath = join(config.customRoot, "divisions.json");
    if (existsSync(labelsPath)) {
      const labels = JSON.parse(readFileSync(labelsPath, "utf-8"));
      delete labels[division];
      writeFileAtomic(labelsPath, JSON.stringify(labels, null, 2));
    }
    return { ok: true };
  }

  const catalogService = {
    snapshot,
    prompt,
    setEnabled,
    root: config.root,
    fetchAssets: async (slug: string) => {
      await ensureReady();
      const expert = usable().find((e) => e.slug === slug);
      if (!expert) throw new Error(`Эксперт не найден: ${slug}`);
      if (expert.packDir === undefined) return { status: "local" as const, bytes: 0, reason: "", root: config.root, dirs: [] };
      const roster = await rosterOnce();
      const info = packInfoFor(roster, expert.division, expert.slug);
      if (!info) return { status: "local" as const, bytes: 0, reason: "", root: config.root, dirs: [] };
      const res = await ensureAssets({ packDir: expert.packDir, roster, info });
      return { status: res.status, bytes: res.bytes ?? info.bytes ?? 0, reason: res.reason ?? "", root: expert.packDir, dirs: info.dirs ?? [] };
    },
    avatars: async () => {
      await ensureReady();
      const out: Record<string, string> = {};
      for (const expert of usable()) {
        const candidates = expert.packDir !== undefined
          ? [join(expert.packDir, "avatars", "avatar.webp")]
          : [join(config.root, expert.division, "avatars", `${expert.slug}.webp`)];
        for (const cand of candidates) {
          try {
            const buf = readFileSync(cand);
            out[expert.slug] = `data:image/webp;base64,${buf.toString("base64")}`;
            break;
          } catch {}
        }
      }
      return out;
    },
    createExpert,
    updateExpert,
    deleteExpert,
    createCategory,
    updateCategory,
    deleteCategory,
  };
  ctx.reflect.provide(CATALOG_SERVICE, catalogService);

  // ---- Вызов экспертов ----
  function humanBytes(bytes: number) {
    const n = Number(bytes) || 0;
    if (n < 1024) return `${n} Б`;
    if (n < 1048576) return `${Math.max(1, Math.round(n / 1024))} КБ`;
    return `${(n / 1048576).toFixed(1)} МБ`;
  }

  const assetsProgress = new Map<string, { received: number; total: number; at: number }>();

  async function ensureAssetsForSummon(expert: ExpertEntry) {
    if (expert.packDir === undefined) return { status: "local" as const };
    const roster = await rosterOnce();
    const info = packInfoFor(roster, expert.division, expert.slug);
    if (!info) return { status: "local" as const };
    if ((await assetsState(expert.packDir, info)) === ASSETS_READY) return { status: "ready" as const, bytes: info.bytes, ms: 0 };
    const started = Date.now();
    const mb = ((info.bytes ?? 0) / 1048576).toFixed(1);
    const onProgress = ({ received, total }: any) => {
      assetsProgress.set(expert.slug, { received, total: total ?? info.bytes ?? 0, at: Date.now() });
    };
    const pending = kickoffAssets({
      packDir: expert.packDir,
      roster,
      info,
      onProgress,
      onDone: () => {
        assetsProgress.delete(expert.slug);
        ctx.logger?.info?.(`[eks-team] ${expert.slug} ресурсы готовы (${mb} МБ, фоновая дозагрузка)`);
      },
      onError: (res) => {
        assetsProgress.delete(expert.slug);
        ctx.logger?.warn?.(`[eks-team] ${expert.slug} загрузка ресурсов не удалась: ${res?.reason ?? res?.status}`);
      },
    });
    let timer: any;
    const result = await Promise.race<{ status: string; reason?: string }>([
      pending,
      new Promise<{ status: string }>((resolve) => { timer = setTimeout(() => resolve({ status: "timeout" }), config.summonAssetsWaitMs); }),
    ]);
    clearTimeout(timer);
    const ms = Date.now() - started;
    if (result?.status === ASSETS_READY) {
      assetsProgress.delete(expert.slug);
      ctx.logger?.info?.(`[eks-team] ${expert.slug} ресурсы готовы (${mb} МБ, ${(ms / 1000).toFixed(1)}с)`);
      return { status: "ready" as const, bytes: info.bytes, ms };
    }
    if (result?.status === "timeout") {
      ctx.logger?.warn?.(`[eks-team] ${expert.slug} ресурсы ${mb} МБ не готовы за ${config.summonAssetsWaitMs / 1000}с, стартуем сессию`);
      return { status: "timeout" as const, bytes: info.bytes, ms };
    }
    assetsProgress.delete(expert.slug);
    ctx.logger?.warn?.(`[eks-team] ${expert.slug} загрузка не удалась: ${result?.reason ?? result?.status}`);
    return { status: "failed" as const, bytes: info.bytes, ms, reason: result?.reason ?? result?.status };
  }

  async function startExpert(query: string, task: string, launch: any) {
    const current = locale();
    requireSettings();
    const taskText = String(task ?? "").trim();
    if (!taskText) throw new Error(t(current, "error.taskEmpty"));
    if ([...taskText].length > config.summonTaskMaxChars) throw new Error(t(current, "error.taskTooLong", { limit: config.summonTaskMaxChars }));
    if (!launch.agent) throw new Error(t(current, "error.summonRequiresAgent"));
    const provider = ctx.subagents.getProvider(config.provider);
    if (!provider) throw new Error(t(current, "error.providerMissing", { provider: config.provider }));
    if (provider.capabilities.persona === false) throw new Error(t(current, "error.providerNoPersona", { provider: config.provider }));
    if (provider.capabilities.toolFilter === false) throw new Error(t(current, "error.providerNoToolFilter", { provider: config.provider }));
    if (maxDepth !== undefined && provider.capabilities.depthLimit !== true) throw new Error(t(current, "error.providerNoMaxDepth", { provider: config.provider }));
    await ensureReady();
    const expert = resolveExpert(usable(), query, current);
    if (!enabledSet().has(expert.slug)) throw new Error(t(current, "error.expertDisabled", { name: localizedExpert(expert, current).name }));
    const assets = await ensureAssetsForSummon(expert);
    const personaBody = await prompt(expert, current);
    const persona = assets.status === "ready" || assets.status === "local" ? personaBody : `${t(current, "summon.assetsPending", { size: humanBytes(assets.bytes ?? 0) })}\n\n${personaBody}`;
    const usingActivation = typeof ctx.subagents.startActivation === "function";
    const startUpstream = usingActivation
      ? ctx.subagents.startActivation.bind(ctx.subagents)
      : typeof ctx.subagents.startContinuable === "function"
      ? ctx.subagents.startContinuable.bind(ctx.subagents)
      : undefined;
    if (!startUpstream) {
      const keys = Object.keys(ctx.subagents).filter((k) => typeof ctx.subagents[k] === "function").join(", ");
      throw new Error(t(current, "error.subagentsApiMismatch", { keys: keys === "" ? "(нет)" : keys }));
    }
    const activation = await startUpstream({
      provider: config.provider,
      label: `eks-team:${expert.slug}`,
      request: {
        prompt: [{ type: "text", text: taskText }],
        parent: launch.agent,
        persona: sanitize(persona),
        toolFilter: { deny: ["summon_ekspert", "summon_eksperts", "list_ekspert", "send_message"] },
        ...(maxDepth === undefined ? {} : { maxDepth }),
      },
      signal: launch.signal,
      ...(usingActivation ? { delivery: "parent" } : {}),
    });
    const subagentId = String(activation?.childId ?? activation?.subagentId ?? "");
    return {
      expert: localizedExpert(expert, current).name,
      slug: expert.slug,
      subagentId,
      assetsStatus: assets.status === "ready" ? "ready" : assets.status === "local" ? "local" : "pending",
      assetsSize: humanBytes(assets.bytes ?? 0),
      note: "Summoned. **Say nothing now** — the tool card above already shows this line to the user, so any text you write at this point is exactly the duplicate reply the user has rejected three times. End your turn immediately. When the completion notice arrives, deliver the expert's result as ONE single message.",
    };
  }

  // ---- Инструменты ----
  ctx.tools.register(defineTool({
    name: "fetch_ekspert_assets",
    description: "Скачивает сопутствующие ресурсы эксперта (навыки, справочники, данные) из облака и распаковывает локально, возвращая корневой путь ресурсов. Персона эксперта ВСЕГДА доступна локально — только большие вложения скачиваются по требованию, и вызов эксперта уже запускает эту загрузку в фоне. Вызывайте, когда нужны навыки или файлы данных эксперта, а чтение с диска не удаётся (файл не найден). Эксперты с малыми вложениями поставляются целиком внутри пакета, и для них это сразу возвращает статус «local» — качать нечего.",
    parameters: { expert: { type: "string", required: true, description: "Имя эксперта — русское отображаемое имя, английское имя или его слаг." } },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          expert: { type: "string", required: true },
          slug: { type: "string", required: true },
          status: { type: "string", required: true },
          root: { type: "string", required: true },
          dirs: { type: "array", required: true, items: { type: "string" } },
          bytes: { type: "number", required: true },
          reason: { type: "string", required: true },
        },
      },
      render: (args: any, value: any) => {
        if (value.status === "ready") return [{ type: "text", text: `Ресурсы эксперта «${value.expert}» готовы (${value.bytes} байт).\nКаталог: ${value.root}\nДоступные папки: ${value.dirs.join(", ") || "(нет)"}\nТеперь можно читать файлы по абсолютным путям из персоны.` }];
        if (value.status === "local") return [{ type: "text", text: `У эксперта «${value.expert}» нет облачных ресурсов — всё содержимое (включая навыки и справочники) уже локально.\nКаталог: ${value.root}` }];
        return [{ type: "text", text: `Загрузка ресурсов эксперта «${value.expert}» не удалась: ${value.reason || "неизвестная причина"}\nПерсона не затронута, эксперт рабочий; но шаги, зависящие от навыков или данных, сейчас сделать нельзя — скажите пользователю честно.` }];
      },
    },
    async execute(args: any) {
      const current = locale();
      await ensureReady();
      const expert = resolveExpert(usable(), args.expert, current);
      const name = localizedExpert(expert, current).name;
      const base = { expert: name, slug: expert.slug, root: expert.packDir ?? config.root, dirs: [] as string[], bytes: 0, reason: "" };
      if (!expert.packDir) return { ...base, status: "local" };
      const roster = await rosterOnce();
      const info = packInfoFor(roster, expert.division, expert.slug);
      if (!info) return { ...base, status: "local" };
      const res = await ensureAssets({ packDir: expert.packDir, roster, info });
      if (res.status === ASSETS_READY) return { ...base, status: "ready", dirs: [...(info.dirs ?? [])], bytes: res.bytes ?? info.bytes ?? 0 };
      return { ...base, status: "failed", reason: res.reason ?? res.status };
    },
  }));

  ctx.tools.register(defineTool({
    name: "list_ekspert",
    description: "Список включённых экспертов Эксперт, сгруппированных по разделам. Без фильтра возвращает названия разделов и количества; передайте раздел, чтобы раскрыть его с именами, слагами и описаниями. Используйте только для ПОИСКА эксперта, когда пользователь не назвал ни одного; если пользователь уже назвал эксперта (чип @Имя в начале или явное имя/слаг), пропустите этот шаг и вызовите summon_ekspert напрямую.",
    parameters: { division: { type: "string", description: "Опциональный ключ раздела для фильтра (напр. engineering, marketing, security, design)." } },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          divisions: { type: "array", required: true, items: { type: "json" } },
          total: { type: "number", required: true },
          locale: { type: "string", required: true },
          query: { type: "string", required: true },
          allDivisions: { type: "array", required: true, items: { type: "string" } },
        },
      },
      render: (args: any, value: any) => [{ type: "text", text: renderList(args, value) }],
    },
    async execute(args: any) {
      await ensureReady();
      const current = locale();
      requireSettings();
      const query = args.division === undefined ? "" : String(args.division).trim();
      const enabled = enabledSet();
      const groups = groupByDivision(usable(), enabled);
      const projection = (list: any[]) => toRenderableGroups(list, current).map((group) => ({
        ...group,
        experts: group.experts.map((e: any) => ({ ...e, description: truncate(e.description, config.descriptionLimit) })),
      }));
      if (!query) {
        return { divisions: projection(groups), total: enabled.size, locale: current, query, allDivisions: effectiveDivisions.slice() };
      }
      const needle = query.toLowerCase();
      const matched = groups.filter((g) => g.division.toLowerCase() === needle || g.label.toLowerCase() === needle || g.labelEn.toLowerCase() === needle);
      return { divisions: projection(matched), total: matched.reduce((s: number, g: any) => s + g.count, 0), locale: current, query, allDivisions: effectiveDivisions.slice() };
    },
  }));

  ctx.tools.register(defineTool({
    name: "summon_ekspert",
    description: "Вызывает одного эксперта Эксперт для выполнения задачи. Специализированный под-агент стартует с полной персоной эксперта и работает в собственном контексте. Этот вызов возвращается СРАЗУ после старта эксперта — он НЕ ждёт ответа. Результат придёт позже как уведомление о завершении, поэтому НЕ пишите никакого подтверждения после этого вызова — завершите ход прямо здесь, без текста. Когда придёт уведомление о завершении, выдайте результат эксперта ОДНИМ ЕДИНСТВЕННЫМ СООБЩЕНИЕМ. Пользователь явно не хочет, чтобы вызов разделялся на подтверждение плюс позже результат. Если пользователь уже назвал эксперта (ведущий чип @ИмяЭксперта или явное имя/слаг где угодно в тексте), вызовите его сразу — поиск через list_ekspert не нужен. Вызывайте list_ekspert только когда эксперт не назван.",
    timeoutMs: 660_000,
    parameters: {
      expert: { type: "string", required: true, description: "Эксперт для вызова — русское отображаемое имя (напр. «Фронтенд-разработчик»), английское имя (напр. «Frontend Developer») или его слаг (напр. engineering-frontend-developer). Имя из чипа @ в компоузере работает как есть; варианты и префикс-эмодзи (напр. «🧠 Психолог») резолвятся в одного эксперта, точного написания не требуется." },
      task: { type: "string", required: true, description: "Полная, самодостаточная задача для эксперта. Включите весь необходимый контекст." },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          expert: { type: "string", required: true },
          slug: { type: "string", required: true },
          subagentId: { type: "string", required: true },
          assetsStatus: { type: "string", required: true },
          assetsSize: { type: "string", required: true },
          note: { type: "string", required: true },
        },
      },
      render: (_args: any, value: any) => [{ type: "text", text: t(locale(), "summon.started", { expert: value.expert, assets: t(locale(), value.assetsStatus === "ready" ? "summon.assetsReady" : value.assetsStatus === "pending" ? "summon.assetsPendingNote" : "summon.assetsLocal", { size: value.assetsSize }) }) }],
    },
    async execute(args: any, exec: any) {
      await ensureReady();
      return startExpert(args.expert, args.task, exec);
    },
  }));

  ctx.tools.register(defineTool({
    name: "summon_eksperts",
    description: `Вызывает несколько экспертов Эксперт параллельно для одной миссии. Одновременно стартует до ${config.maxSummonBatch} экспертов с параллельностью ${config.summonConcurrency}; неудачные запуски сообщаются по отдельности, остальные продолжают работу. Этот вызов возвращается СРАЗУ после старта экспертов — он НЕ ждёт их ответов. Результаты придут позже как уведомления о завершении, поэтому не вызывайте это и не ждите в том же ходе. Каждый эксперт обычно заранее назван вызывающим (чип @ в компоузере или явное @ИмяЭксперта где угодно в тексте — включая сохранённый промпт извне) — если так, вызывайте напрямую без list_ekspert; вызывайте list_ekspert только когда ни один эксперт не назван.`,
    timeoutMs: 660_000,
    parameters: {
      experts: {
        type: "array",
        required: true,
        description: "Эксперты для вызова, у каждого своё имя и задача.",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            expert: { type: "string", required: true, description: "Имя эксперта — русское отображаемое, английское или слаг." },
            task: { type: "string", required: true, description: "Задача этого эксперта." },
          },
        },
      },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          results: { type: "array", required: true, items: { type: "json" } },
          locale: { type: "string", required: true },
        },
      },
      render: (args: any, value: any) => [{ type: "text", text: renderSummonResults(args, value) }],
    },
    async execute(args: any, exec: any) {
      await ensureReady();
      const current = locale();
      const specs = Array.isArray(args.experts) ? args.experts : [];
      if (!specs.length) throw new Error(t(current, "error.specsEmpty"));
      if (specs.length > config.maxSummonBatch) throw new Error(t(current, "error.specsTooMany", { limit: config.maxSummonBatch }));
      specs.forEach((spec: any, i: number) => {
        if (!spec || typeof spec !== "object" || typeof spec.expert !== "string" || typeof spec.task !== "string") {
          throw new Error(t(current, "error.specInvalid", { index: i }));
        }
      });
      const results = await mapPool(specs, config.summonConcurrency, async (spec: any) => {
        try {
          const result = await startExpert(spec.expert, spec.task, exec);
          return { expert: result.expert, ok: true, subagentId: result.subagentId };
        } catch (error) {
          return { expert: displayNameOf(spec.expert, current), ok: false, subagentId: "", error: error instanceof Error ? error.message : String(error) };
        }
      });
      return { results: toRenderableSummonResults(results, current), locale: current };
    },
  }));

  // ---- Системный промпт (только в родительской сессии) ----
  ctx.systemPrompt.section({
    name: "eks-team:experts",
    order: 118,
    text: (context: any) => {
      if (context.agent?.session?.header?.parentSession !== undefined) return "";
      const scale = rosterScale(config.root);
      const scope = scale.experts > 0
        ? `Родительская сессия имеет Эксперт — каталог из ${scale.experts} экспертов в ${scale.divisions} разделах с полной русскоязычной локализацией, доступных как вызываемые предметные эксперты.`
        : "Родительская сессия имеет Эксперт — курируемый каталог предметных экспертов с полной русскоязычной локализацией, доступных как вызываемые под-агенты.";
      return [
        "## Эксперт (Expert) режим экспертов",
        scope,
        "Эксперты включаются/выключаются во вкладке настроек Эксперт; по умолчанию все включены, выключенный эксперт нельзя вызвать.",
        "Выбор в компоузере вставляет одного включённого эксперта как нативный чип-ссылку; остальной текст черновика становится задачей этого эксперта. Чип приходит к вам как обычный текст `@ИмяЭксперта` в начале сообщения пользователя — ЭТО И ЕСТЬ ВЫБОР ПОЛЬЗОВАТЕЛЯ, и имя как написано достаточно (резолвер принимает русское отображаемое имя, английское имя или слаг, и терпит префикс-эмодзи).",
        "Вызов АСИНХРОННЫЙ на этом хосте: `summon_ekspert` / `summon_eksperts` стартуют эксперта и возвращаются сразу с его subagentId — они НЕ возвращают ответ эксперта. Результат приходит позже как уведомление о завершении в этом диалоге. ПОСЛЕ ВЫЗОВА НЕ ОТПРАВЛЯЙТЕ НИКАКОГО ПОДТВЕРЖДЕНИЯ И НЕ ЖДИТЕ: ЗАВЕРШИТЕ ХОД ТИХО ПРЯМО ПОСЛЕ ВЫЗОВА ИНСТРУМЕНТА (карточка инструмента уже показывает вызов). Когда придёт уведомление о завершении, выдайте результат эксперта ОДНИМ ЕДИНСТВЕННЫМ СООБЩЕНИЕМ — никогда не разбивайте вызов на подтверждение плюс позже результат.",
        "Когда сообщение пользователя уже называет эксперта — ведущий чип `@ИмяЭксперта` или явное имя/слаг в тексте — вызывайте `summon_ekspert` ПЕРВЫМ с этим именем. НЕ вызывайте `list_ekspert` для подтверждения или уточнения имени: поиск стоит два лишних круга и не меняет, какой эксперт запустится.",
        `Только когда пользователь НЕ назвал эксперта, найдите одного: вызовите \`list_ekspert()\` для включённых названий разделов и количеств, затем \`list_ekspert(division)\` чтобы раскрыть нужный раздел, затем \`summon_ekspert(эксперт, задача)\` — или \`summon_eksperts\` для параллельной группы (не более ${config.maxSummonBatch} за раз; неудачные запуски сообщаются по отдельности, остальные продолжают работу).`,
      ].join("\n");
    },
  });

  // ---- Встроенные навыки (опционально) ----
  installBundledSkills(ctx, config);
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, "-").replace(/(^-|-$)/g, "").slice(0, 64);
}