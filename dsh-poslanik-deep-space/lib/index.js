import z from '@deepseek-ai/schemastery'

// DSH сохраняет volatile-поля Config в cordis-патче активного профиля,
// поэтому настройки темы переживают перезапуск хоста.
export const Config = z.object({
  enabled: z.boolean().default(true).description('Космос').volatile(),
  stars: z.boolean().default(true).description('Звёзды и туманности').volatile(),
  ships: z.boolean().default(true).description('Корабли').volatile(),
  comets: z.boolean().default(true).description('Кометы и метеоры').volatile(),
  planets: z.boolean().default(true).description('Планеты').volatile(),
  perturbation: z.boolean().default(true).description('Возмущение от мыши').volatile(),
  underlay: z.boolean().default(false).description('Картина под текстом · Under the text').volatile(),
  suns: z.boolean().default(true).description('Солнца · Suns').volatile(),
  blackholes: z.boolean().default(true).description('Чёрные дыры · Black holes').volatile(),
  language: z.enum(['auto', 'ru', 'en']).default('auto').description('Язык панели · Panel language').volatile(),
  intensity: z.number().min(0.2).max(1.4).default(0.85).description('Яркость · Brightness').volatile(),
})

export function apply(ctx) {
  ctx.inject(['settings'], (child) => {
    if (typeof child.settings.register === 'function') {
      child.settings.register(
        'dsh-poslanik-deep-space',
        z.object({
          enabled: z.boolean().default(true),
          stars: z.boolean().default(true),
          ships: z.boolean().default(true),
          comets: z.boolean().default(true),
          planets: z.boolean().default(true),
          perturbation: z.boolean().default(true),
          underlay: z.boolean().default(false),
          suns: z.boolean().default(true),
          blackholes: z.boolean().default(true),
          language: z.enum(['auto', 'ru', 'en']).default('auto'),
          intensity: z.number().min(0.2).max(1.4).default(0.85),
        }),
      )
    }
  })
}
