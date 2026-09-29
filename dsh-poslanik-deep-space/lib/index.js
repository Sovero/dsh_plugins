import z from '@deepseek-ai/schemastery'

// schemastery не знает z.enum: перечисление собирается через z.union из z.const.
// Проверено на 3.18.4 — z.enum здесь отсутствует и роняет загрузку хоста.
const Language = () => z.union([z.const('auto'), z.const('ru'), z.const('en')])

// Потолок кадров: 0 — без ограничения, остальное — частота отрисовки.
// Число, а не строка, чтобы клиент сразу считал интервал кадра; посторонние
// значения (7, 144) отвергаются, а не проходят молча, как при z.number().
const Fps = () => z.union([z.const(0), z.const(15), z.const(30), z.const(60)])

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
  language: Language().default('auto').description('Язык панели · Panel language').volatile(),
  // Космос откликается на работу агента. Выключатель здесь, а не только в
  // клиенте, потому что мост живёт на хосте: если он начнёт мешать, его можно
  // погасить одним переключателем, не снимая тему.
  session: z.boolean().default(true).description('Отклик на работу агента').volatile(),
  constellations: z.boolean().default(true).description('Созвездия').volatile(),
  intensity: z.number().min(0.2).max(1.4).default(0.85).description('Яркость · Brightness').volatile(),
  fps: Fps().default(30).description('Частота кадров · Frame rate (0 — без ограничения)').volatile(),
})

// Состояние агентов для клиента. Клиент не знает текущую сессию и не может
// её угадать: ни один сервис ядра не отдаёт «текущую», а sessions.binding(id)
// требует id снаружи. Поэтому состояние собирает хост и отдаёт его по своему
// точному маршруту — не через перехватчик общего канала, который один на всё
// приложение и принадлежит dsh-api-gateway.
const STATE_PATH = '/api/dsh-poslanik-deep-space.state'

function createBridge() {
  const sessions = new Map()
  // Счётчик завершённых ходов: клиент видит, что он вырос, и вспыхивает.
  let settled = 0
  let revision = 0

  const touch = () => {
    revision += 1
  }

  return {
    onStatus(sessionId, running) {
      const previous = sessions.get(sessionId)
      if (previous !== undefined && previous.running === running) return
      if (previous === undefined) {
        sessions.set(sessionId, { id: sessionId, running, error: null, settled: 0 })
        touch()
        return
      }
      // Уход в покой после работы — это завершившийся ход.
      if (running === false && previous.running === true) {
        settled += 1
        previous.settled = settled
      }
      previous.running = running
      touch()
    },
    onError(sessionId, message) {
      const entry = sessions.get(sessionId)
      if (entry === undefined) {
        sessions.set(sessionId, { id: sessionId, running: false, error: message, settled })
      } else {
        entry.error = message
      }
      touch()
    },
    onRemoved(sessionId) {
      if (sessions.delete(sessionId)) touch()
    },
    // Ошибку хода снимаем, как только агент снова берётся за работу: иначе
    // красная вспышка не гасла бы до перезапуска сессии.
    clearError() {
      for (const entry of sessions.values()) entry.error = null
    },
    snapshot() {
      return {
        revision,
        settled,
        sessions: Array.from(sessions.values(), (entry) => ({
          id: entry.id,
          running: entry.running,
          error: entry.error,
          settled: entry.settled,
        })),
      }
    },
  }
}

export function apply(ctx) {
  const bridge = createBridge()
  const state = ctx.inject(['config'], (child) => child.config ?? ctx.config)

  // Подписки на события агента. Каждая обёрнута: неизвестное событие или
  // неожиданная форма полезной нагрузки не должны ронять хост.
  const on = (event, handler) => {
    try {
      ctx.on(event, handler)
    } catch (error) {
      console.warn(`[poslanik-deep-space] не удалось подписаться на ${event}`, error)
    }
  }

  on('api-session/status', function (sessionId, running) {
    if (running === true) bridge.clearError()
    bridge.onStatus(String(sessionId), running === true)
  })
  on('api-session/added', function (summary) {
    if (summary === undefined || summary === null) return
    if (summary.running === true) bridge.onStatus(String(summary.id), true)
  })
  on('api-session/removed', (sessionId) => bridge.onRemoved(String(sessionId)))
  on('api-session/error', (sessionId, message) => {
    bridge.onError(String(sessionId), String(message))
  })
  on('agent/error', function (payload) {
    const agent = payload?.agent
    if (agent === undefined) return
    const sessionId = agent.session?.id ?? agent.sessionId
    if (sessionId === undefined) return
    bridge.onError(String(sessionId), 'Ошибка шага')
  })

  // Ответ клиенту — ТОЧНЫЙ маршрут, а не перехватчик канала.
  //
  // Почему так: у канала `/api` перехватчик может быть только один
  // (`connection: shared RPC channel "/api" already has an interceptor`), и он
  // принадлежит dsh-api-gateway. Забрав его, мы ломали инициализацию
  // api-gateway, и весь `/api` отдавал 404 — включая session/create.
  // Точные маршруты, наоборот, хранятся в Map по pathname и прекрасно
  // уживаются: `createSharedFetchHandler` проверяет их ПЕРВОДМИ и только потом
  // обращается к перехватчику. Так же сделан dsh-i18n.
  ctx.inject(['connection'], (child) => {
    const connection = child.get('connection') ?? child.connection
    if (connection === undefined || connection.fetch === undefined) return
    try {
      connection.fetch.register({
        path: STATE_PATH,
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: async () => {
          // Отключатель уважается на стороне хоста: выключил — мост молчит,
          // клиент получит пустое состояние и просто не будет реагировать.
          // Значение читается в момент запроса, а не при подписке, иначе
          // тумблер в панели настроек не подействовал бы без перезапуска.
          const current = state?.session ?? ctx.config?.session
          const value = current === false ? { sessions: [], settled: 0, revision: 0 } : bridge.snapshot()
          return new Response(JSON.stringify(value), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        },
      })
    } catch (error) {
      console.warn('[poslanik-deep-space] маршрут состояния не зарегистрирован', error)
    }
  })

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
          language: Language().default('auto'),
          intensity: z.number().min(0.2).max(1.4).default(0.85),
          fps: Fps().default(30),
          session: z.boolean().default(true),
          constellations: z.boolean().default(true),
        }),
      )
    }
  })
}
