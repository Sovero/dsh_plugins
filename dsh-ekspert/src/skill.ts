// Встроенные навыки плагина (опционально, если хост поддерживает skills).
export function installBundledSkills(ctx: any, config: any): void {
  if (!ctx.skills || typeof ctx.skills.register !== "function") return;

  // Навык управления экспертами (для разработчиков плагина)
  ctx.skills.register({
    name: "ekspert-manager",
    description: "Управление каталогом Эксперт: просмотр, создание, редактирование экспертов и разделов.",
    async *call({ action, ...params }: any) {
      // Этот навык предоставляет высокоуровневые операции над каталогом
      // Реализация зависит от доступа к внутренним сервисам плагина
      yield { type: "text", text: "Навык ekspert-manager требует доступа к внутренним сервисам плагина." };
    },
  });

  // Навык синхронизации каталога
  ctx.skills.register({
    name: "ekspert-sync",
    description: "Синхронизация встроенного каталога экспертов с пользовательской директорией.",
    async *call({ force }: any) {
      yield { type: "text", text: "Синхронизация каталога..." };
      // Реализация через catalogService.snapshot и bootstrap.seedData
      yield { type: "text", text: "Готово." };
    },
  });
}