// Ворота навыков: оборачивает ctx.skills, скрывая отключённые навыки от модели.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

interface SkillGateStore {
  disabled: string[];
}

let skillsContext: any = null;
let storePath = "";
let disabledSet = new Set<string>();
let originalSkills: any = null;

/** Устанавливает ворота навыков. */
export function installSkillGate(ctx: any, options: { storePath: string }): void {
  if (skillsContext === ctx.skills) return; // уже установлено на этом контексте

  storePath = options.storePath;
  skillsContext = ctx.skills;
  originalSkills = ctx.skills;

  // Читаем сохранённое состояние
  loadStore();

  // Оборачиваем skills
  const wrapped = new Proxy(ctx.skills, {
    get(target, prop, receiver) {
      // getAll / list / get — фильтруем отключённые
      if (prop === "getAll" || prop === "list" || prop === "get") {
        return (...args: any[]) => {
          const result = Reflect.get(target, prop, receiver).apply(target, args);
          if (prop === "getAll" || prop === "list") {
            return Array.isArray(result) ? result.filter((s: any) => !disabledSet.has(s.name)) : result;
          }
          if (prop === "get") {
            const skill = result;
            return skill && !disabledSet.has(skill.name) ? skill : undefined;
          }
          return result;
        };
      }
      // has — учитываем отключённые
      if (prop === "has") {
        return (name: string) => {
          if (disabledSet.has(name)) return false;
          return Reflect.get(target, prop, receiver).apply(target, [name]);
        };
      }
      // Остальное проксируем напрямую
      return Reflect.get(target, prop, receiver);
    },
  });

  // Заменяем ctx.skills
  ctx.skills = wrapped;

  // Регистрируем инструменты управления воротами
  if (ctx.tools && typeof ctx.tools.register === "function") {
    registerSkillGateTools(ctx);
  }
}

/** Загружает хранилище. */
function loadStore(): void {
  try {
    if (existsSync(storePath)) {
      const content = readFileSync(storePath, "utf-8");
      const data = JSON.parse(content) as SkillGateStore;
      if (Array.isArray(data.disabled)) {
        disabledSet = new Set(data.disabled);
      }
    }
  } catch {
    disabledSet = new Set();
  }
}

/** Сохраняет хранилище. */
function saveStore(): void {
  try {
    const dir = dirname(storePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(storePath, JSON.stringify({ disabled: Array.from(disabledSet) }, null, 2), "utf-8");
  } catch (error) {
    console.error("[eks-team] Не удалось сохранить ворота навыков:", error);
  }
}

/** Регистрирует инструменты управления воротами навыков. */
function registerSkillGateTools(ctx: any): void {
  const { defineTool } = require("@deepseek-ai/dsh-tools");

  ctx.tools.register(defineTool({
    name: "ekspert_skill_gate_list",
    description: "Список всех зарегистрированных навыков с их статусом (включено/выключено).",
    parameters: {},
    output: {
      schema: {
        type: "object",
        properties: {
          skills: { type: "array", items: { type: "object" } },
        },
      },
    },
    async execute() {
      const all = originalSkills.getAll?.() || [];
      return {
        skills: all.map((s: any) => ({
          name: s.name,
          description: s.description,
          enabled: !disabledSet.has(s.name),
        })),
      };
    },
  }));

  ctx.tools.register(defineTool({
    name: "ekspert_skill_gate_toggle",
    description: "Включает или выключает навык по имени.",
    parameters: {
      name: { type: "string", required: true, description: "Имя навыка" },
      enabled: { type: "boolean", required: true, description: "true = включить, false = выключить" },
    },
    output: {
      schema: {
        type: "object",
        properties: {
          name: { type: "string" },
          enabled: { type: "boolean" },
        },
      },
    },
    async execute(args: { name: string; enabled: boolean }) {
      if (args.enabled) {
        disabledSet.delete(args.name);
      } else {
        disabledSet.add(args.name);
      }
      saveStore();
      return { name: args.name, enabled: args.enabled };
    },
  }));

  ctx.tools.register(defineTool({
    name: "ekspert_skill_gate_reset",
    description: "Сбрасывает все навыки в включённое состояние.",
    parameters: {},
    output: {
      schema: { type: "object", properties: { count: { type: "number" } } },
    },
    async execute() {
      const count = disabledSet.size;
      disabledSet.clear();
      saveStore();
      return { count };
    },
  }));
}