// Remote сервис: предоставляет каталог и персоны для Typert/gateway.
// Использует простой объект вместо defineService для совместимости.

export const eksTeamRemote = {
  name: "eksTeam",
  version: 1,
  methods: {
    /** Возвращает снапшот каталога для клиента. */
    snapshot: {
      input: {},
      output: {
        experts: "array",
        enabled: "array",
        divisions: "array",
        customDivisions: "array",
        customLabels: "object",
        divisionLabels: "object",
      },
      async handler(ctx: any) {
        const catalog = ctx.services.eksTeamCatalog;
        return catalog.snapshot();
      },
    },

    /** Возвращает персону эксперта для под-агента. */
    prompt: {
      input: { slug: "string", locale: "string" },
      output: "string",
      async handler(ctx: any, { slug, locale }: { slug: string; locale: string }) {
        const catalog = ctx.services.eksTeamCatalog;
        const experts = await catalog.snapshot();
        const expert = experts.experts.find((e: any) => e.slug === slug);
        if (!expert) throw new Error(`Эксперт не найден: ${slug}`);
        return catalog.prompt(expert, locale ?? "ru");
      },
    },

    /** Включает/выключает экспертов. */
    setEnabled: {
      input: { list: "array" },
      output: { enabled: "array", revision: "number" },
      async handler(ctx: any, { list }: { list: string[] }) {
        const catalog = ctx.services.eksTeamCatalog;
        return catalog.setEnabled(list, 0);
      },
    },

    /** Скачивает ресурсы эксперта. */
    fetchAssets: {
      input: { slug: "string" },
      output: { status: "string", bytes: "number", reason: "string", root: "string", dirs: "array" },
      async handler(ctx: any, { slug }: { slug: string }) {
        const catalog = ctx.services.eksTeamCatalog;
        return catalog.fetchAssets(slug);
      },
    },

    /** Возвращает аватары экспертов. */
    avatars: {
      input: {},
      output: "object",
      async handler(ctx: any) {
        const catalog = ctx.services.eksTeamCatalog;
        return catalog.avatars();
      },
    },

    /** Создаёт своего эксперта. */
    createExpert: {
      input: {
        division: "string",
        name: "string",
        nameEn: "string",
        description: "string",
        descriptionEn: "string",
        emoji: "string",
        slug: "string?",
        persona: "string",
      },
      output: { division: "string", slug: "string", path: "string" },
      async handler(ctx: any, data: any) {
        const catalog = ctx.services.eksTeamCatalog;
        return catalog.createExpert(data);
      },
    },

    /** Обновляет своего эксперта. */
    updateExpert: {
      input: {
        slug: "string",
        division: "string",
        name: "string?",
        nameEn: "string?",
        description: "string?",
        descriptionEn: "string?",
        emoji: "string?",
        persona: "string?",
        expectedHash: "string",
      },
      output: { division: "string", slug: "string", path: "string", hash: "string" },
      async handler(ctx: any, data: any) {
        const catalog = ctx.services.eksTeamCatalog;
        return catalog.updateExpert(data.slug, data.division, data, data.expectedHash);
      },
    },

    /** Удаляет своего эксперта. */
    deleteExpert: {
      input: { slug: "string", division: "string", expectedHash: "string" },
      output: { ok: "boolean" },
      async handler(ctx: any, data: any) {
        const catalog = ctx.services.eksTeamCatalog;
        return catalog.deleteExpert(data.slug, data.division, data.expectedHash);
      },
    },

    /** Создаёт свой раздел. */
    createCategory: {
      input: { division: "string", label: "string", labelEn: "string" },
      output: { division: "string", label: "string", labelEn: "string" },
      async handler(ctx: any, data: any) {
        const catalog = ctx.services.eksTeamCatalog;
        return catalog.createCategory(data.division, data.label, data.labelEn);
      },
    },

    /** Обновляет свой раздел. */
    updateCategory: {
      input: { division: "string", label: "string", labelEn: "string" },
      output: { division: "string", label: "string", labelEn: "string" },
      async handler(ctx: any, data: any) {
        const catalog = ctx.services.eksTeamCatalog;
        return catalog.updateCategory(data.division, data.label, data.labelEn);
      },
    },

    /** Удаляет свой раздел. */
    deleteCategory: {
      input: { division: "string" },
      output: { ok: "boolean" },
      async handler(ctx: any, data: any) {
        const catalog = ctx.services.eksTeamCatalog;
        return catalog.deleteCategory(data.division);
      },
    },
  },
};

export default eksTeamRemote;