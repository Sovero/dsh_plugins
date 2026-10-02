import z from '@deepseek-ai/schemastery'

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
  // Языка панели в настройках нет: он следует за языком интерфейса хоста
  // (@deepseek-ai/dsh-client-locale), поэтому расходиться с ним негде.
  // Космос откликается на работу агента. Выключатель здесь, а не только в
  // клиенте, потому что мост живёт на хосте: если он начнёт мешать, его можно
  // погасить одним переключателем, не снимая тему.
  session: z.boolean().default(true).description('Отклик на работу агента').volatile(),
  constellations: z.boolean().default(true).description('Созвездия').volatile(),
  // Сколько фигур держим на небе. Созвездия лежат на дальнем плане, за газом и
  // звёздами, поэтому их чтение зависит от числа: 0 — пустое небо, 14 — весь
  // каталог. Верхняя граница совпадает с длиной CONSTELLATIONS в клиенте.
  constellationCount: z.number().min(0).max(14).default(8).description('Сколько созвездий · How many').volatile(),
  intensity: z.number().min(0.2).max(1.4).default(0.85).description('Яркость · Brightness').volatile(),
  // Множитель дрейфа планет: 1 — как задумано, 0.5 — вдвое медленнее.
  // Вращение дисков и орбиты спутников не затрагиваются.
  planetSpeed: z.number().min(0.1).max(2).default(1).description('Скорость планет · Planet drift').volatile(),
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

  // Отключатель моста хранится в обычном объекте, который наполняет колбэк
  // inject. Раньше здесь стояло `const state = ctx.inject(...)` — но inject
  // возвращает функцию отписки, а НЕ результат колбэка, поэтому state всегда
  // был функцией, state.session не читался, и обработчик запроса падал на
  // запасном пути `ctx.config`, который бросает «cannot get property config
  // without inject». Ошибка сыпалась каждый опрос клиента.
  //
  // Вне колбэка к ctx.config обращаться нельзя: Cordis не подменяет
  // несвойственные поля на undefined, а бросает исключение.
  const state = { session: true }
  ctx.inject(['config'], (child) => {
    try {
      if (child.config !== undefined) state.session = child.config.session !== false
    } catch (error) {
      console.warn('[poslanik-deep-space] настройка отклика недоступна, мост остаётся включён', error)
    }
  })

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
          // Читается ТОЛЬКО state: ctx.config здесь бросает исключение.
          const value = state.session === false
            ? { sessions: [], settled: 0, revision: 0 }
            : bridge.snapshot()
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
          intensity: z.number().min(0.2).max(1.4).default(0.85),
          planetSpeed: z.number().min(0.1).max(2).default(1),
          fps: Fps().default(30),
          session: z.boolean().default(true),
          constellations: z.boolean().default(true),
          constellationCount: z.number().min(0).max(14).default(8),
        }),
      )
    }
  })
}
