// Клиентский entry point: регистрирует панель настроек и компоузер-меню.
import { registerEkspertPanel } from "./panel.js";

export function setupClient(ctx: any) {
  // Регистрируем панель в настройках
  registerEkspertPanel(ctx);

  // Регистрируем провайдер для @ меню в компоузере
  if (ctx.composer?.registerExpertProvider) {
    ctx.composer.registerExpertProvider("eks-team", {
      label: "Эксперт",
      async getExperts() {
        try {
          const res = await ctx.connection.sendRequest("eksTeamCatalog.snapshot");
          return (res?.experts || []).map((e: any) => ({
            name: e.name,
            slug: e.slug,
            description: e.description,
            emoji: e.emoji,
            division: e.division,
            custom: e.custom,
          }));
        } catch {
          return [];
        }
      },
    });
  }
}

export default setupClient;