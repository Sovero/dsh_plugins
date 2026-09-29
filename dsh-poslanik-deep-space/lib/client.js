// Тема «Глубокий космос» для DSH — клиентская половина.
//
// Файл отдаётся движком как обычный скрипт и склеивается с client.js других
// плагинов в одну комбинацию. Поэтому: (1) ESM-синтаксис недопустим,
// (2) любой top-level идентификатор попадёт в общую область и может столкнуться
// с чужим — всё живёт внутри factory, (3) плагин регистрируется через
// window.__ModuleLoader__.load, иначе загрузчик считает файл неактивным.
//
// Разметка приложения не трогается. Слой темы — один div с канвасом на
// z-index: -1, а содержимое интерфейса поднимает наш CSS через #root.

window.__ModuleLoader__.load({
  id: 'dsh-poslanik-deep-space',
  factory: function (require) {
    const PLUGIN_ID = 'dsh-poslanik-deep-space'
    const THEME_ATTR = 'data-poslanik-deep-space'
    const STYLE_SELECTOR = `style[data-plugin-css="${PLUGIN_ID}/theme.css"]`
    const TAU = Math.PI * 2
    const LAYER_CLASS = 'pds-space'

    const rand = (min, max) => min + Math.random() * (max - min)
    const clamp = (value, min, max) => (value < min ? min : value > max ? max : value)
    const lerp = (from, to, share) => from + (to - from) * share

    // ── палитра и токены ───────────────────────────────────────────────────
    const TOKENS = Object.freeze({
      '--dsw-alias-bg-base': '#04060f',
      '--dsw-alias-bg-layer-1': '#070a1a',
      '--dsw-alias-bg-layer-2': '#0a0e20',
      '--dsw-alias-bg-layer-3': '#0d1226',
      '--dsw-alias-bg-module-platform': '#0b1020',
      '--dsw-alias-bg-overlay': '#0c1122',
      '--dsw-alias-bg-mask-1': 'rgba(3, 5, 12, 0.72)',
      '--dsw-alias-bg-mask-2': 'rgba(5, 8, 18, 0.5)',
      '--dsw-alias-border-l1': 'rgba(190, 214, 255, 0.12)',
      '--dsw-alias-border-l2': 'rgba(200, 220, 255, 0.2)',
      '--dsw-alias-border-l3': 'rgba(214, 230, 255, 0.3)',
      '--dsw-alias-brand-primary': '#eaf2ff',
      '--dsw-alias-brand-text': '#eef4ff',
      '--dsw-alias-label-primary': '#e8eeff',
      '--dsw-alias-label-primary-inverted': '#0a0e20',
      '--dsw-alias-label-secondary': '#b7c4dd',
      '--dsw-alias-label-tertiary': '#8593ad',
      '--dsw-alias-label-caption': '#93a1b8',
      '--dsw-alias-interactive-bg-hover': 'rgba(180, 205, 250, 0.1)',
      '--dsw-alias-interactive-bg-active': 'rgba(190, 212, 250, 0.16)',
      '--dsw-alias-scrollbar-bg-l1': '#1b2338',
      '--dsw-alias-scrollbar-bg-l2': '#26304a',
      '--dsw-alias-scrollbar-hover-l1': '#3c4a68',
      '--dsw-alias-scrollbar-hover-l2': '#4d5f80',
      '--dsw-alias-tooltip-bg': '#0f1426',
      '--dsw-alias-toast-bg': '#0f1426',
      '--dsw-specific-bubble': 'rgba(10, 14, 30, 0.88)',
      '--dsw-specific-bubble-highlight': 'rgba(22, 30, 54, 0.92)',
      '--dsw-specific-sidebar-fill': '#060a16',
    })

    // CSS по образцу официальной темы: слой снизу, содержимое интерфейса — над ним.
    const THEME_CSS = String.raw`
html[${THEME_ATTR}] {
  color-scheme: dark !important;
  background: transparent !important;
}

html[${THEME_ATTR}] body {
  position: relative;
  isolation: isolate;
  min-height: 100vh;
  color: var(--dsw-alias-label-primary);
  background: transparent !important;
}

/* Слой живёт прямо в <html>, а не в <body>: загрузчик интерфейса в конце
   старта перерисовывает содержимое body, и слой внутри него исчезал бы вместе
   с этим. Фон рисует сам канвас, поэтому html и body прозрачны.
   Ниже — базовая подложка под содержимым; рабочий режим переопределён ниже
   через mix-blend-mode: screen. */
html[${THEME_ATTR}] .${LAYER_CLASS} {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
}

/* Диагностическая точка удалена вместе с её разметкой: плагин проверен. */

html[${THEME_ATTR}] #root {
  position: relative;
  z-index: 10;
  min-height: 100vh;
  background: transparent !important;
}

html[${THEME_ATTR}] .${LAYER_CLASS} {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 2147483646;
  overflow: hidden;
  pointer-events: none;
  mix-blend-mode: screen;
  opacity: 0.34;
}

html[${THEME_ATTR}][data-pds-underlay] .${LAYER_CLASS} {
  z-index: -1;
  mix-blend-mode: normal;
  opacity: 1;
}

html[${THEME_ATTR}][data-pds-disabled] .${LAYER_CLASS} {
  display: none;
}

html[${THEME_ATTR}] #root > * {
  background-color: transparent !important;
  background-image: none !important;
}

html[${THEME_ATTR}] [class*='frame'],
html[${THEME_ATTR}] [class*='centerCol'],
html[${THEME_ATTR}] main,
html[${THEME_ATTR}] [class*='viewArea'] [class*='_scroll'],
html[${THEME_ATTR}] [class*='home'],
html[${THEME_ATTR}] [class*='Home'],
html[${THEME_ATTR}] [class*='welcome'],
html[${THEME_ATTR}] [class*='Welcome'] {
  background-color: transparent !important;
  background-image: none !important;
}

html[${THEME_ATTR}] [class*='_markdown_'],
html[${THEME_ATTR}] [class*='flowItem'],
html[${THEME_ATTR}] [class*='_bubble_'] {
  text-shadow: 0 1px 5px rgba(2, 4, 12, 0.8), 0 0 14px rgba(2, 4, 12, 0.5);
}

html[${THEME_ATTR}] pre,
html[${THEME_ATTR}] .md-code-block {
  color: #e8f0ff !important;
  background: linear-gradient(145deg, rgba(14, 19, 38, 0.86), rgba(6, 9, 20, 0.92)) !important;
  border: 1px solid rgba(200, 218, 255, 0.14) !important;
  border-radius: 14px;
}

html[${THEME_ATTR}] .pds-settings {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) auto;
  gap: 12px 20px;
  align-items: center;
  width: 100%;
  min-width: 0;
  padding: 16px 0;
  border-top: 1px solid rgba(190, 214, 255, 0.14);
}

html[${THEME_ATTR}] .pds-settings-copy { display: grid; gap: 4px; }
html[${THEME_ATTR}] .pds-settings-copy strong { color: #eef4ff; font-size: 14px; }
html[${THEME_ATTR}] .pds-settings-copy span { color: rgba(195, 208, 230, 0.82); font-size: 12px; }
html[${THEME_ATTR}] .pds-switch { display: inline-flex; align-items: center; gap: 8px; color: #e5eeff; cursor: pointer; }
html[${THEME_ATTR}] .pds-switch input { width: 16px; height: 16px; accent-color: #b9d4f7; }
html[${THEME_ATTR}] .pds-range { display: grid; grid-column: 1 / -1; gap: 8px; }
html[${THEME_ATTR}] .pds-range span { color: rgba(195, 208, 230, 0.82); font-size: 12px; }
html[${THEME_ATTR}] .pds-range input { width: min(360px, 100%); accent-color: #b9d4f7; }
html[${THEME_ATTR}] .pds-select {
  width: min(360px, 100%);
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid rgba(190, 214, 255, 0.22);
  background: rgba(16, 22, 40, 0.75);
  color: #d8e6ff;
  font-size: 12px;
  cursor: pointer;
}
html[${THEME_ATTR}] .pds-select:disabled { opacity: 0.5; cursor: default; }
html[${THEME_ATTR}] .pds-lang-row { display: flex; gap: 8px; flex-wrap: wrap; }
html[${THEME_ATTR}] .pds-lang {
  padding: 5px 12px;
  border-radius: 8px;
  border: 1px solid rgba(190, 214, 255, 0.22);
  background: rgba(16, 22, 40, 0.6);
  color: #d8e6ff;
  font-size: 12px;
  cursor: pointer;
}
html[${THEME_ATTR}] .pds-lang[aria-pressed='true'] {
  border-color: rgba(160, 200, 255, 0.55);
  background: rgba(32, 48, 84, 0.85);
  color: #eaf3ff;
}
html[${THEME_ATTR}] .pds-lang:disabled { opacity: 0.5; cursor: default; }
`

    // ── язык интерфейса темы ───────────────────────────────────────────────
    // Русский и английский равноправны: выбор хранит хост вместе с остальными
    // настройками, поэтому переживает перезапуск и не зависит от локали хоста.
    const STRINGS = Object.freeze({
      ru: {
        langLabel: 'Язык панели',
        enabled: 'Включена',
        enabledHint: 'Космос поверх интерфейса.',
        stars: 'Звёзды и туманности',
        starsHint: 'Три слоя глубины, мерцание.',
        ships: 'Корабли',
        shipsHint: 'Шлейф, смена курса, огонь навигации.',
        comets: 'Кометы и метеоры',
        cometsHint: 'Хвосты комет и пролетающие метеоры.',
        session: 'Отклик на работу агента',
        sessionHint: 'Двойная звезда при генерации, вспышка по завершении, красный отсвет при ошибке.',
        constellations: 'Созвездия',
        constellationsHint: 'Узнаваемые фигуры: Медведица, Орион, Кассиопея, Южный Крест.',
        planets: 'Планеты',
        planetsHint: 'Медленный дрейф с терминатором и кольцом.',
        perturbation: 'Возмущение от мыши',
        perturbationHint: 'Пространство закручивается вокруг курсора.',
        underlay: 'Под текстом',
        underlayHint: 'Картина уходит под интерфейс. Выключено — светится поверх, текст читается.',
        suns: 'Солнца',
        sunsHint: 'Светила с короной, гранулами и протуберанцами.',
        blackholes: 'Чёрные дыры',
        blackholesHint: 'Тень, фотонное кольцо и раскручивающийся диск.',
        intensity: (percent) => `Яркость ${percent}%`,
        frameRate: 'Частота кадров',
        frameRateHint: 'Потолок отрисовки. «Выкл» — частота экрана.',
        frameRateOff: 'Выкл',
        saveFailed: 'Не удалось сохранить настройку.',
        saveOffline: 'Настройка не сохранена: нет связи с хостом.',
      },
      en: {
        langLabel: 'Panel language',
        enabled: 'Enabled',
        enabledHint: 'Deep space over the interface.',
        stars: 'Stars and nebulae',
        starsHint: 'Three depth layers, twinkling.',
        ships: 'Ships',
        shipsHint: 'Trails, course changes, navigation light.',
        comets: 'Comets and meteors',
        cometsHint: 'Comet tails and passing meteors.',
        session: 'Reacts to the agent',
        sessionHint: 'A binary star while it works, a flash when it finishes, a red flare on error.',
        constellations: 'Constellations',
        constellationsHint: 'Recognisable figures: the Bear, Orion, Cassiopeia, the Southern Cross.',
        planets: 'Planets',
        planetsHint: 'Slow drift with terminator and ring.',
        perturbation: 'Pointer perturbation',
        perturbationHint: 'Space swirls around the cursor.',
        underlay: 'Under the text',
        underlayHint: 'The scene moves behind the interface. Off — it glows on top and text stays readable.',
        suns: 'Suns',
        sunsHint: 'Stars with a corona, granulation and prominences.',
        blackholes: 'Black holes',
        blackholesHint: 'Shadow, photon ring and a spinning accretion disc.',
        intensity: (percent) => `Brightness ${percent}%`,
        frameRate: 'Frame rate',
        frameRateHint: 'Render cap. “Off” — the display refresh rate.',
        frameRateOff: 'Off',
        saveFailed: 'Could not save the setting.',
        saveOffline: 'Setting not saved: the host is unreachable.',
      },
    })

    function detectLanguage() {
      const lang = document.documentElement.lang || navigator.language || 'ru'
      return lang.toLowerCase().startsWith('en') ? 'en' : 'ru'
    }

    function translator(preference) {
      if (preference === 'ru' || preference === 'en') return STRINGS[preference]
      return STRINGS[detectLanguage()]
    }

    // ── настройки хоста ────────────────────────────────────────────────────
    // Потолок кадров: 0 — рисовать каждый кадр монитора, остальное — потолок.
    // Числа совпадают с перечислением в схеме хоста, неизвестное значение
    // молча уходит в безопасные 30, а не в полное отсутствие ограничения.
    const FPS_CHOICES = [0, 15, 30, 60]
    const DEFAULT_FPS = 30

    function frameIntervalFrom(fps) {
      if (!FPS_CHOICES.includes(fps)) return 1 / DEFAULT_FPS
      return fps === 0 ? 0 : 1 / fps
    }

    const DEFAULT_SETTINGS = Object.freeze({
      enabled: true,
      stars: true,
      ships: true,
      comets: true,
      planets: true,
      perturbation: true,
      underlay: false,
      suns: true,
      blackholes: true,
      language: 'auto',
      intensity: 0.85,
      fps: DEFAULT_FPS,
      session: true,
      constellations: true,
    })

    function normalizeSettings(value) {
      const intensity = Number(value?.intensity)
      const language = ['ru', 'en', 'auto'].includes(value?.language) ? value.language : 'auto'
      return Object.freeze({
        enabled: value?.enabled !== false,
        stars: value?.stars !== false,
        ships: value?.ships !== false,
        comets: value?.comets !== false,
        planets: value?.planets !== false,
        perturbation: value?.perturbation !== false,
        underlay: value?.underlay === true,
        suns: value?.suns !== false,
        blackholes: value?.blackholes !== false,
        language,
        intensity: Number.isFinite(intensity) ? Math.min(1.4, Math.max(0.2, intensity)) : DEFAULT_SETTINGS.intensity,
        fps: FPS_CHOICES.includes(value?.fps) ? value.fps : DEFAULT_FPS,
        session: value?.session !== false,
        constellations: value?.constellations !== false,
      })
    }

    // Хост владеет хранением: чужую форму не засеваем и дефолты не пишем.
    function createHostSettingsForm(ctx, entryId) {
      const listeners = new Set()
      const forms = new Map()
      const unavailable = Object.freeze({ status: 'unavailable', mode: 'host', writable: false })
      const current = () => forms.get('configForms') ?? forms.get('settingsScope')
      const notify = () => {
        for (const listener of listeners) listener()
      }
      const disposers = ['configForms', 'settingsScope'].map((service) =>
        ctx.inject([service], (child) => {
          child.effect(() => {
            const form =
              service === 'configForms' ? child.configForms.get(entryId) : child.settingsScope.bind({ namespace: entryId })
            forms.set(service, form)
            const off = form.subscribe(notify)
            notify()
            return () => {
              off()
              forms.delete(service)
              notify()
            }
          })
        }),
      )
      return {
        getSnapshot: () => current()?.getSnapshot() ?? unavailable,
        subscribe: (listener) => {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
        mutate: (ops) => current()?.mutate(ops) ?? Promise.resolve(false),
        destroy: () => {
          listeners.clear()
          return Promise.all(disposers.map((fiber) => fiber.dispose()))
        },
      }
    }

    function createSettingsController(form) {
      const listeners = new Set()
      let saving = false
      let generation = 0
      let preview
      let error = ''
      let disposed = false
      let snapshot
      const sync = () => {
        if (disposed) return
        const host = form.getSnapshot()
        const ready = host.status === 'ready' && host.value !== undefined
        const value = preview ?? normalizeSettings(ready ? host.value : DEFAULT_SETTINGS)
        // Сообщения об ошибке переводим тем же языком, что выбран для панели.
        const text = translator(value.language)
        snapshot = Object.freeze({
          value,
          text,
          ready,
          // Новые тумблеры появляются только когда хост уже знает их схему:
          // до перезапуска хоста писать в них нечего.
          features: Object.freeze({
            suns: ready && Object.hasOwn(host.value, 'suns'),
            blackholes: ready && Object.hasOwn(host.value, 'blackholes'),
          }),
          editable: ready && host.mode === 'host' && host.writable,
          saving,
          error: error === '' ? '' : text[error],
        })
        for (const listener of listeners) listener()
      }
      const unsubscribe = form.subscribe(sync)
      sync()
      return {
        get: () => snapshot,
        subscribe: (listener) => {
          listeners.add(listener)
          return () => {
            listeners.delete(listener)
          }
        },
        set: async (update) => {
          if (disposed || !snapshot.editable) return false
          const fields = Object.keys(DEFAULT_SETTINGS).filter((field) => Object.hasOwn(update, field))
          if (fields.length === 0) return false
          preview = normalizeSettings({ ...snapshot.value, ...update })
          const ops = fields.map((field) => ({ op: 'set', path: [field], value: preview[field] }))
          const current = ++generation
          saving = true
          error = ''
          sync()
          try {
            const accepted = await form.mutate(ops)
            if (!accepted && current === generation) error = 'saveFailed'
            return accepted
          } catch {
            if (current === generation) error = 'saveOffline'
            return false
          } finally {
            if (current === generation) {
              preview = undefined
              saving = false
              sync()
            }
          }
        },
        destroy: () => {
          disposed = true
          unsubscribe()
          listeners.clear()
        },
      }
    }

    // ── космос: генераторы ─────────────────────────────────────────────────
    function createNebulae() {
      const count = 4 + Math.floor(Math.random() * 3)
      const hues = [214, 258, 196, 28, 320]
      return Array.from({ length: count }, (_, index) => ({
        x: Math.random(),
        y: Math.random(),
        radius: rand(0.22, 0.5),
        hue: hues[index % hues.length],
        alpha: rand(0.05, 0.11),
        drift: rand(0.0008, 0.0022),
      }))
    }

    function createStars(width, height) {
      const area = width * height
      const depths = [0.35, 0.65, 1]
      const densities = [0.00016, 0.0001, 0.00005]
      const sizes = [[0.35, 0.75], [0.7, 1.25], [1.1, 2.1]]
      const alphas = [[0.22, 0.45], [0.35, 0.65], [0.5, 0.9]]
      // Слои разведены по скорости: дальний еле ползёт, ближний идёт быстрее
      // всех. Максимум опущен с 44 до 22 — на 30 кадрах небо не «бежит», а
      // разрыв между слоями сохранён, иначе параллакс перестаёт читаться.
      const drifts = [5, 11, 22]
      const layers = depths.map((depth, layer) => ({
        depth,
        drift: drifts[layer],
        // Внутри слоя звёзды тоже идут не в ногу: у каждой своя скорость,
        // см. поле flow. Разброс убирает ощущение общего потока.
        stars: Array.from({ length: Math.max(24, Math.round(area * densities[layer])) }, () => ({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: rand(sizes[layer][0], sizes[layer][1]),
          alpha: rand(alphas[layer][0], alphas[layer][1]),
          phase: Math.random() * TAU,
          twinkle: rand(0.4, 1.5),
          flow: 0.8 + Math.random() * 0.5,
        })),
      }))
      // Звёздные карты — самый дальний слой: они почти не сдвигаются и лежат
      // под остальными, иначе структуры расползлись бы вместе с равномерной сыпью.
      layers.push(createChartLayer(width, height))
      return layers
    }

    // ── светила ─────────────────────────────────────────────────────────────
    // Карлики: мелкие звёзды разной величины и цвета — от бурого до голубого.
    function createDwarfs() {
      const kinds = [
        { hue: 12, size: 0.7 },
        { hue: 28, size: 0.95 },
        { hue: 45, size: 1.05 },
        { hue: 205, size: 1.25 },
        { hue: 265, size: 1.1 },
      ]
      const count = 4 + Math.floor(Math.random() * 3)
      return Array.from({ length: count }, () => {
        const kind = kinds[Math.floor(Math.random() * kinds.length)]
        return {
          x: Math.random(),
          y: rand(0.06, 0.94),
          radius: rand(1.5, 4.2) * kind.size,
          hue: kind.hue + Math.floor(rand(-6, 6)),
          alpha: rand(0.35, 0.85),
          twinkle: rand(0.6, 2.2),
          phase: Math.random() * TAU,
          drift: rand(0.1, 0.5) * (Math.random() < 0.5 ? -1 : 1),
        }
      })
    }

    // Солнца: полноценные светила с короной, гранулами и протуберанцами.
    function createSuns() {
      const count = 1 + Math.floor(Math.random() * 2)
      return Array.from({ length: count }, () => ({
        x: rand(0.06, 0.94),
        y: rand(0.1, 0.9),
        radius: rand(7, 16),
        hue: rand(36, 52),
        pulse: rand(0.35, 1.1),
        phase: Math.random() * TAU,
        drift: rand(0.15, 0.6),
        granules: Array.from({ length: 6 }, () => ({
          x: rand(-0.6, 0.6),
          y: rand(-0.6, 0.6),
          r: rand(0.12, 0.3),
        })),
      }))
    }

    // Чёрные дыры: тень, фотонное кольцо и раскручивающийся аккреционный диск.
    function createBlackHoles() {
      if (Math.random() < 0.5) return []
      return Array.from({ length: 1 }, () => ({
        x: rand(0.14, 0.86),
        y: rand(0.16, 0.84),
        radius: rand(9, 17),
        disc: rand(2.3, 3.4),
        tilt: rand(-0.62, -0.24),
        spin: rand(0.5, 1.3),
        phase: Math.random() * TAU,
        drift: rand(-0.3, 0.3),
      }))
    }

    // Времена суток: один атмосферный слой, который очень медленно дрейфует
    // по палитре. Период — в минутах, альфа держится низкой, чтобы небесный
    // свет никогда не засветлял интерфейс.
    const ATMO_ALPHA = 0.16
    const ATMO_PERIOD = 900

    // Возвращает [hue, saturation, lightness, alpha] для фоновой дымки.
    // Рассвет держится на подъёме яркости первые секунды сессии.
    function atmosphereColor(time, dawn) {
      const phase = (time / ATMO_PERIOD) * TAU
      const hue = 222 + Math.sin(phase) * 18
      const saturation = 32 + Math.sin(phase * 0.5) * 6
      const lightness = 6 + (Math.cos(phase) * 0.5 + 0.5) * 3
      // Рассвет — короткий тёплый подъём, гаснущий примерно за 8 секунд.
      const dawnLift = dawn === undefined || dawn <= 0 ? 0 : Math.max(0, 1 - dawn / 8)
      const alpha = ATMO_ALPHA + dawnLift * 0.1
      return [hue, saturation, lightness + dawnLift * 3, alpha]
    }

    function drawAtmosphere(ctx, width, height) {
      const [hue, saturation, lightness, alpha] = atmosphereColor(
        space.time,
        space.dawn === undefined ? 0 : space.dawn,
      )
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }

    function drawDwarfs(ctx, width, height) {
      if (space.options.stars === false) return
      ctx.save()
      for (const dwarf of space.dwarfs) {
        const x = (((dwarf.x + space.time * dwarf.drift * 0.0004) % 1.2) - 0.1) * width
        const y = dwarf.y * height
        const blink = 0.65 + 0.35 * Math.sin(space.time * dwarf.twinkle + dwarf.phase)
        const alpha = dwarf.alpha * blink
        const radius = dwarf.radius

        const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 6)
        glow.addColorStop(0, `hsla(${dwarf.hue}, 95%, 82%, ${alpha})`)
        glow.addColorStop(0.3, `hsla(${dwarf.hue}, 90%, 68%, ${alpha * 0.35})`)
        glow.addColorStop(1, `hsla(${dwarf.hue}, 90%, 60%, 0)`)
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(x, y, radius * 6, 0, TAU)
        ctx.fill()

        ctx.fillStyle = `hsla(${dwarf.hue}, 100%, 90%, ${alpha})`
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, TAU)
        ctx.fill()

        // У более ярких карликов — короткие лучи: так читается разная величина.
        if (dwarf.alpha > 0.6) {
          const ray = radius * (3 + 2 * blink)
          ctx.strokeStyle = `hsla(${dwarf.hue}, 95%, 80%, ${alpha * 0.3})`
          ctx.lineWidth = 0.8
          ctx.beginPath()
          ctx.moveTo(x - ray, y)
          ctx.lineTo(x + ray, y)
          ctx.moveTo(x, y - ray * 0.6)
          ctx.lineTo(x, y + ray * 0.6)
          ctx.stroke()
        }
      }
      ctx.restore()
    }

    function drawSuns(ctx, width, height) {
      if (space.options.suns === false) return
      ctx.save()
      for (const sun of space.suns) {
        const x = (((sun.x + space.time * sun.drift * 0.0004) % 1.2) - 0.1) * width
        const y = sun.y * height
        const breath = 1 + 0.05 * Math.sin(space.time * sun.pulse + sun.phase)
        const radius = sun.radius * breath

        // Корона: широкая, медленно «дышащая».
        const corona = ctx.createRadialGradient(x, y, radius * 0.9, x, y, radius * 7)
        corona.addColorStop(0, `hsla(${sun.hue}, 100%, 74%, 0.5)`)
        corona.addColorStop(0.22, `hsla(${sun.hue + 6}, 100%, 66%, 0.18)`)
        corona.addColorStop(1, `hsla(${sun.hue + 10}, 100%, 60%, 0)`)
        ctx.fillStyle = corona
        ctx.beginPath()
        ctx.arc(x, y, radius * 7, 0, TAU)
        ctx.fill()

        // Диск: ядро почти белое, к краю уходит в цвет звезды.
        const disc = ctx.createRadialGradient(x, y, 0, x, y, radius)
        disc.addColorStop(0, 'rgba(255, 255, 248, 0.95)')
        disc.addColorStop(0.55, `hsla(${sun.hue}, 100%, 78%, 0.8)`)
        disc.addColorStop(1, `hsla(${sun.hue - 6}, 100%, 66%, 0.5)`)
        ctx.fillStyle = disc
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, TAU)
        ctx.fill()

        // Гранулы: мелкие светлые пятна на поверхности.
        ctx.save()
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, TAU)
        ctx.clip()
        for (const granule of sun.granules) {
          const wobble = 0.6 + 0.4 * Math.sin(space.time * 0.8 + granule.x * 9)
          ctx.fillStyle = `hsla(${sun.hue + 10}, 100%, 88%, ${0.1 * wobble})`
          ctx.beginPath()
          ctx.arc(x + granule.x * radius, y + granule.y * radius, radius * granule.r, 0, TAU)
          ctx.fill()
        }
        ctx.restore()

        // Протуберанцы: короткие дуги на краю, живут своей жизнью.
        for (let index = 0; index < 2; index += 1) {
          const flick = 0.5 + 0.5 * Math.sin(space.time * (1.6 + index * 0.7) + sun.phase + index)
          const angle = sun.phase + index * 2.2 + space.time * 0.12
          ctx.strokeStyle = `hsla(${sun.hue + 14}, 100%, 72%, ${0.18 + 0.3 * flick})`
          ctx.lineWidth = Math.max(0.7, radius * 0.1)
          ctx.beginPath()
          ctx.arc(x, y, radius * (1 + 0.08 * flick), angle, angle + 0.5 + 0.3 * flick)
          ctx.stroke()
        }
      }
      ctx.restore()
    }

    // Круг Эйнштейна: настоящего преломления пикселей здесь нет — вместо
    // него дуги дальней полосы, повёрнутые вокруг горизонта событий. Дёшево
    // и узнаваемо: у чёрной дыры появляется оправа из искажённого неба.
    function lensingArcs(hole) {
      return [
        { startAngle: Math.PI * 0.82, endAngle: Math.PI * 1.18, scale: 1.72 },
        { startAngle: Math.PI * 1.82, endAngle: Math.PI * 2.18, scale: 1.94 },
      ]
    }

    function drawLensing(ctx) {
      if (space.options.blackholes === false) return
      if (space.bandsSignature === null) return
      const band = space.bands.far.canvas
      if (band === undefined || band.width === 0) return
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      for (const hole of space.blackHoles) {
        const x = (((hole.x + space.time * hole.drift * 0.0005) % 1.2) - 0.1) * space.width
        const y = hole.y * space.height
        for (const arc of lensingArcs(hole)) {
          // Кусок дальнего неба, повёрнутый и сжатый в кольцо вокруг тени.
          ctx.save()
          ctx.translate(x, y)
          ctx.rotate(arc.startAngle)
          ctx.globalAlpha = 0.3
          const size = hole.radius * arc.scale * 2
          ctx.drawImage(
            band,
            0,
            0,
            band.width,
            band.height,
            0,
            -size / 2,
            size,
            size,
          )
          ctx.restore()
        }
        // Тонкий светящийся обод тени: без него оправа не читается как линза.
        const ring = ctx.createRadialGradient(x, y, hole.radius * 0.92, x, y, hole.radius * 1.9)
        ring.addColorStop(0, 'rgba(255, 236, 200, 0.3)')
        ring.addColorStop(1, 'rgba(255, 190, 120, 0)')
        ctx.fillStyle = ring
        ctx.beginPath()
        ctx.arc(x, y, hole.radius * 1.9, 0, TAU)
        ctx.fill()
      }
      ctx.restore()
    }

    function drawBlackHoles(ctx, width, height) {
      if (space.options.blackholes === false) return
      ctx.save()
      for (const hole of space.blackHoles) {
        const x = (((hole.x + space.time * hole.drift * 0.0005) % 1.2) - 0.1) * width
        const y = hole.y * height
        const r = hole.radius
        const inner = r * 1.45
        const outer = r * hole.disc

        // Ошибка агента вспыхивает у ближайшей дыры красным. Гаснет сама:
        // яркость берётся из затухающего счётчика, а не из флага.
        if (state.error > 0) {
          const flare = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 3.4)
          flare.addColorStop(0, `rgba(255, 90, 70, ${clamp(state.error * 0.34, 0, 1)})`)
          flare.addColorStop(0.45, `rgba(220, 60, 50, ${clamp(state.error * 0.14, 0, 1)})`)
          flare.addColorStop(1, 'rgba(180, 40, 40, 0)')
          ctx.save()
          ctx.globalCompositeOperation = 'lighter'
          ctx.fillStyle = flare
          ctx.beginPath()
          ctx.arc(x, y, r * 3.4, 0, TAU)
          ctx.fill()
          ctx.restore()
        }

        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(hole.tilt)
        ctx.scale(1, 0.2)

        // Вещество падает к тени: белое ядро, затем охра, затем темнота.
        const disc = ctx.createRadialGradient(0, 0, inner * 0.55, 0, 0, outer)
        disc.addColorStop(0, 'rgba(255, 248, 230, 0.95)')
        disc.addColorStop(0.22, 'rgba(255, 210, 140, 0.62)')
        disc.addColorStop(0.62, 'rgba(255, 140, 70, 0.2)')
        disc.addColorStop(1, 'rgba(170, 55, 30, 0)')
        ctx.fillStyle = disc
        ctx.beginPath()
        ctx.arc(0, 0, outer, 0, TAU)
        ctx.arc(0, 0, inner * 0.82, 0, TAU, true)
        ctx.fill()

        // Спиральные рукава диска: короткие дуги, бегущие с разной скоростью.
        for (let index = 0; index < 3; index += 1) {
          const radius = r * (1.7 + index * 0.55)
          const angle = space.time * hole.spin * (index % 2 === 0 ? 1 : -1) + hole.phase + index
          ctx.strokeStyle = `rgba(255, ${208 - index * 26}, ${150 - index * 38}, ${0.3 - index * 0.06})`
          ctx.lineWidth = r * 0.17
          ctx.beginPath()
          ctx.arc(0, 0, radius, angle, angle + 0.85)
          ctx.stroke()
        }
        ctx.restore()

        // Фотонное кольцо: тонкая яркая окружность на границе тени.
        ctx.strokeStyle = 'rgba(255, 240, 205, 0.9)'
        ctx.lineWidth = Math.max(0.7, r * 0.085)
        ctx.beginPath()
        ctx.arc(x, y, r, 0, TAU)
        ctx.stroke()
        ctx.strokeStyle = 'rgba(255, 200, 140, 0.35)'
        ctx.lineWidth = Math.max(0.5, r * 0.04)
        ctx.beginPath()
        ctx.arc(x, y, r * 1.06, 0, TAU)
        ctx.stroke()

        // Сама тень ничего не закрашивает: режим screen не умеет темнеть.
      }
      ctx.restore()
    }

    // Планеты живут в пикселях и подчиняются взаимной гравитации.
    //
    // Прежние «полосы неба» зажимали только вертикаль, и на общей границе двух
    // полос обе планеты оказывались в одной точке — так они и наезжали. Полосы
    // остались только как зона появления. Настоящее разделение теперь жёсткое:
    // если две планеты всё же сблизились, они раздвигаются симметрично.
    const PLANET_SIDES = ['left', 'right', 'top', 'bottom']
    // Гравитационная постоянная подобрана так, чтобы притяжение было заметно
    // (траектории искривляются), но планета за минуту не улетела в центр.
    const PLANET_G = 900
    // Смягчение: без него притяжение на малых расстояниях даёт разрыв по скорости.
    const PLANET_SOFTEN = 260
    // Зазор между дисками: планеты не должны касаться даже краями.
    const PLANET_GAP = 26

    function spawnPlanet(planet, width, height) {
      const side = PLANET_SIDES[Math.floor(Math.random() * PLANET_SIDES.length)]
      planet.side = side
      // Угол внутрь кадра: от стороны отмеряем небольшой разброс, чтобы
      // траектории не шли строго по нормали.
      const spread = rand(-0.45, 0.45)
      const aim = { left: 0, right: Math.PI, top: Math.PI / 2, bottom: -Math.PI / 2 }[side]
      const angle = aim + spread
      const speed = rand(5, 15) * planet.depth
      planet.vx = Math.cos(angle) * speed
      planet.vy = Math.sin(angle) * speed * 0.55
      // Старт — за границей кадра на своей стороне, чтобы появление читалось.
      const margin = planet.radius + 60
      if (side === 'left') planet.x = -margin
      else if (side === 'right') planet.x = width + margin
      else planet.x = Math.random() * width
      if (side === 'top') planet.y = -margin
      else if (side === 'bottom') planet.y = height + margin
      else planet.y = planet.laneTop * height + (planet.laneBottom - planet.laneTop) * height * rand(0.15, 0.85)
      return planet
    }

    // Стартовое разнесение: планета ставится в своей полосе, но не ближе
    // суммы радиусов к уже стоящим. Это гарантия на первый кадр, когда
    // гравитация ещё ничего не успела развести.
    function placePlanets(planets, width, height) {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        let fits = true
        for (let index = 0; index < planets.length; index += 1) {
          const planet = planets[index]
          for (let other = 0; other < index; other += 1) {
            const neighbour = planets[other]
            const need = planet.radius + neighbour.radius + PLANET_GAP
            if (Math.hypot(planet.x - neighbour.x, planet.y - neighbour.y) < need) {
              fits = false
            }
          }
        }
        if (fits) return
        // Не подошло — сдвигаем по очереди: крайние уходят за экран, а те,
        // что уже на экране, разводятся по своей полосе.
        for (let index = 0; index < planets.length; index += 1) {
          const planet = planets[index]
          if (planet.x > -planet.radius && planet.x < width + planet.radius) {
            planet.x = rand(0, width)
          }
          if (planet.y > -planet.radius && planet.y < height + planet.radius) {
            const top = planet.laneTop * height + planet.radius
            const bottom = planet.laneBottom * height - planet.radius
            planet.y = top < bottom ? rand(top, bottom) : rand(0, height)
          }
        }
      }
    }

    // Взаимное притяжение. Импульс симметричен: минус у второй планеты, иначе
    // система тащила бы энергию из ниоткуда.
    function applyPlanetGravity(dt) {
      const planets = space.planets
      for (let i = 0; i < planets.length; i += 1) {
        for (let j = i + 1; j < planets.length; j += 1) {
          const a = planets[i]
          const b = planets[j]
          const dx = b.x - a.x
          const dy = b.y - a.y
          const soft = PLANET_SOFTEN
          const d2 = dx * dx + dy * dy + soft * soft
          const d = Math.sqrt(d2)
          // Масса растёт как квадрат радиуса: большая планета тянет сильнее.
          const force = (PLANET_G * a.radius * a.radius * b.radius * b.radius) / d2
          const fx = (dx / d) * force * dt
          const fy = (dy / d) * force * dt
          a.vx += fx
          a.vy += fy
          b.vx -= fx
          b.vy -= fy
        }
      }
    }

    // Жёсткое разделение. Гравитация сама по себе лишь искривляет путь и при
    // малых скоростях сводит планеты в точку, поэтому наезд пресекается здесь:
    // при пересечении дисков обе планеты получают одинаковый толчок наружу.
    function separatePlanets() {
      const planets = space.planets
      for (let i = 0; i < planets.length; i += 1) {
        for (let j = i + 1; j < planets.length; j += 1) {
          const a = planets[i]
          const b = planets[j]
          const dx = b.x - a.x
          const dy = b.y - a.y
          const need = a.radius + b.radius + PLANET_GAP
          const d = Math.hypot(dx, dy)
          if (d >= need) continue
          // Совпадение точек — случай вырожденный: берём фиксированное
          // направление, иначе деление на ноль даст NaN и планету выбросит.
          const nx = d > 0.001 ? dx / d : 1
          const ny = d > 0.001 ? dy / d : 0
          const push = (need - d) / 2
          a.x -= nx * push
          a.y -= ny * push
          b.x += nx * push
          b.y += ny * push
        }
      }
    }

    function updatePlanets(dt, width, height) {
      for (const planet of space.planets) {
        planet.x += planet.vx * dt
        planet.y += planet.vy * dt
        const margin = planet.radius + 60
        if (planet.x < -margin || planet.x > width + margin) spawnPlanet(planet, width, height)
        else if (planet.y < -margin || planet.y > height + margin) spawnPlanet(planet, width, height)
      }
      applyPlanetGravity(dt)
      separatePlanets()
    }

    function createPlanets(width, height) {
      const count = 2 + Math.floor(Math.random() * 2)
      const kinds = ['gas', 'rock', 'ice']
      const baseHue = { gas: 28, rock: 18, ice: 198 }
      return Array.from({ length: count }, (_, index) => {
        const kind = kinds[index % kinds.length]
        const hue = baseHue[kind] + Math.floor(rand(-8, 8))
        const planet = {
          depth: rand(0.45, 1),
          radius: rand(34, 92),
          hue,
          kind,
          lightAngle: rand(-2.6, -0.5),
          // Вращение вокруг оси: медленное и в разные стороны, знак задаёт
          // видимое направление. Углов наклон не путает с lightAngle — это
          // другая ось, она продолжает задавать освещение.
          spin: rand(0.02, 0.085) * (Math.random() < 0.5 ? -1 : 1),
          spinAngle: Math.random() * TAU,
          ring: kind === 'gas' && index % 2 === 0,
          tilt: rand(-0.5, -0.2),
          alpha: kind === 'gas' ? 0.5 : 0.42,
        }
        // Каждая планета получает свою полосу неба, и py зажат в неё, поэтому
        // две планеты физически не могут оказаться рядом ни при рождении, ни
        // на лету. Полосы делят высоту экрана, а небо — ваньки-встаньку: сосед
        // сверху или снизу всё равно далеко по вертикали.
        planet.laneTop = index / count
        planet.laneBottom = (index + 1) / count
        if (kind === 'gas') {
          // Полосы газового гиганта: их больше и они контрастнее прежних
          // 0.06–0.14, которые после умножения на alpha планеты давали 0.03 —
          // рельефа не было видно вовсе.
          planet.bands = Array.from({ length: 9 }, (_, band) => ({
            offset: rand(-0.72, 0.72),
            height: rand(0.035, 0.1),
            hue: hue + Math.floor(rand(-22, 22)),
            alpha: rand(0.2, 0.42),
            // Полосы разной ширины: тонкие и толстые, иначе диск выглядит
            // ровно покрашенным.
            weight: band % 3 === 0 ? 1.5 : 1,
          }))
        } else {
          // Пятна и кратеры: часть вытянута, часть круглая, альфа заметная.
          planet.spots = Array.from({ length: 11 }, () => ({
            x: rand(-0.78, 0.78),
            y: rand(-0.78, 0.78),
            r: rand(0.05, 0.17),
            squash: rand(0.55, 1),
            hue: hue + Math.floor(rand(-30, 30)),
            alpha: rand(0.18, 0.4),
          }))
          // Спутники заводятся не у всех планет: пустому небу кольца не нужны.
          // У части планет по одному–три, у каждого своя орбита и своя скорость.
          if (Math.random() < 0.55) {
            const moons = 1 + Math.floor(Math.random() * 3)
            planet.orbitTilt = rand(-0.45, 0.1)
            planet.orbiters = Array.from({ length: moons }, (_, index) => {
              const orbit = planet.radius * (1.85 + index * 0.8 + rand(0, 0.35))
              return {
                r: orbit,
                // Ближние орбиты быстрее дальних — так и ведёт себя Кеплер,
                // и глаз это считывает как движение, а не как вращение диска.
                speed: 0.42 / Math.pow(orbit / (planet.radius * 2), 1.5) * rand(0.8, 1.25),
                phase: Math.random() * TAU,
                size: Math.max(0.9, planet.radius * rand(0.05, 0.115)),
                hue: 206 + Math.floor(rand(-24, 24)),
                alpha: rand(0.5, 0.9),
              }
            })
          }
          // Тёмные моря — крупные низкопрозрачные пятна, дающие масштаб.
          planet.seas = Array.from({ length: 3 }, () => ({
            x: rand(-0.6, 0.6),
            y: rand(-0.6, 0.6),
            r: rand(0.2, 0.42),
            squash: rand(0.6, 1),
            hue: hue + Math.floor(rand(-40, -10)),
            alpha: rand(0.12, 0.24),
          }))
          // Огни городов. Живут на НОЧНОЙ стороне: точка гаснет на светлой
          // стороне, тускнеет к терминатору и прижимается к краю диска. У
          // земного облика города собраны в скопления, а не рассыпаны.
          planet.cities = Array.from({ length: 14 }, () => {
            // Скопление: сперва выбирается центр, потом точка рядом с ним.
            const clusterX = rand(-0.62, 0.62)
            const clusterY = rand(-0.62, 0.62)
            return {
              x: clamp(clusterX + rand(-0.22, 0.22), -0.82, 0.82),
              y: clamp(clusterY + rand(-0.22, 0.22), -0.82, 0.82),
              // Размер считается от радиуса планеты. Прежние 0.006–0.017 при
              // радиусе 34–92 px давали 0.2–1.5 пикселя — точка меньше
              // пикселя не рисуется вовсе, и городов просто не было видно.
              r: rand(0.022, 0.055),
              hue: 38 + Math.floor(rand(-6, 8)),
              alpha: rand(0.6, 1),
            }
          })
        }
        return spawnPlanet(planet, width, height)
      })
    }

    // Кометы: три размера и три типа хвоста. Маленькие быстрые с коротким
    // пылевым хвостом, средние — самые обычные, крупные медленные с длинным
    // ионовым. Скорость задаётся базой, помноженной на класс, а размер внутри
    // класса — глубиной, поэтому дальняя большая всё равно мельче ближней.
    const COMET_CLASSES = Object.freeze({
      wisp: Object.freeze({ head: 0.55, speed: 1.65, length: 0.5, width: 1.5 }),
      bearer: Object.freeze({ head: 1, speed: 1, length: 1, width: 2.4 }),
      giant: Object.freeze({ head: 1.9, speed: 0.55, length: 1.7, width: 3.6 }),
    })

    // dust — широкий тусклый пылевой, ion — узкий яркий и резкий,
    // plasma — двуцветный с коротким противотоком.
    const COMET_VARIANTS = Object.freeze(['dust', 'ion', 'plasma'])

    function createComets() {
      const names = Object.keys(COMET_CLASSES)
      const count = 4 + Math.floor(Math.random() * 3)
      return Array.from({ length: count }, (_, index) => {
        const name = names[index % names.length]
        const spec = COMET_CLASSES[name]
        const depth = rand(0.4, 1)
        return {
          className: name,
          variant: COMET_VARIANTS[index % COMET_VARIANTS.length],
          depth,
          head: spec.head * depth,
          lineWidth: spec.width * depth,
          length: rand(160, 320) * spec.length,
          x: Math.random(),
          y: rand(0.1, 0.7),
          vx: rand(9, 20) * spec.speed * (Math.random() < 0.5 ? -1 : 1),
          vy: rand(2, 7) * spec.speed,
          alpha: rand(0.35, 0.6),
          wobble: Math.random() * TAU,
        }
      })
    }

    // Звёздные карты: узнаваемые структуры на фиксированных местах неба
    // вместо равномерной сыпи. Каждая — детерминированный генератор от
    // зерна, поэтому при перезапуске окна карта не прыгает.
    const CHART_SPOTS = Object.freeze([
      Object.freeze({ name: 'spiral', x: 0.18, y: 0.24, scale: 1, tilt: -0.32 }),
      Object.freeze({ name: 'globular', x: 0.79, y: 0.71, scale: 0.85, tilt: 0 }),
      Object.freeze({ name: 'andromeda', x: 0.52, y: 0.9, scale: 1.25, tilt: -0.5 }),
      Object.freeze({ name: 'pleiades', x: 0.88, y: 0.18, scale: 0.7, tilt: 0.18 }),
    ])

    // Логарифмическая спираль с ветвлением: рукава отходят от ядра плавно.
    function chartSpiral(seed, spot) {
      const stars = []
      const arms = 2
      const steps = 130
      const reach = 0.11 * spot.scale
      for (let step = 0; step < steps; step += 1) {
        const t = step / steps
        const radius = reach * Math.pow(t, 1.7)
        for (let arm = 0; arm < arms; arm += 1) {
          const angle = t * 5.2 + (arm / arms) * TAU + spot.tilt
          const jitter = ((seed * 9301 + step * 49297 + arm * 233) % 233280) / 233280
          stars.push({
            x: spot.x + Math.cos(angle) * radius + (jitter - 0.5) * 0.004,
            y: spot.y + Math.sin(angle) * radius * 0.72 + (jitter - 0.5) * 0.004,
            radius: 0.4 + t * 0.9,
            alpha: 0.16 + (1 - t) * 0.4,
            twinkle: 0.4 + jitter,
            phase: jitter * TAU,
          })
        }
      }
      // Ядро — плотное скопление в центре.
      for (let index = 0; index < 26; index += 1) {
        const jitter = ((seed * 7919 + index * 104729) % 104729) / 104729
        const angle = jitter * TAU
        const radius = 0.018 * spot.scale * Math.sqrt(jitter)
        stars.push({
          x: spot.x + Math.cos(angle) * radius,
          y: spot.y + Math.sin(angle) * radius * 0.72,
          radius: 0.5 + jitter * 0.5,
          alpha: 0.5,
          twinkle: 0.6,
          phase: jitter * TAU,
        })
      }
      return stars
    }

    // Шаровое скопление: плотное ядро и разреженная кромка.
    function chartGlobular(seed, spot) {
      const stars = []
      const count = 190
      for (let index = 0; index < count; index += 1) {
        const jitter = ((seed * 15485863 + index * 32452843) % 999983) / 999983
        const angle = jitter * TAU
        // Кубический закон: центр забит, край пустеет.
        const radius = 0.075 * spot.scale * Math.pow(jitter, 0.42)
        stars.push({
          x: spot.x + Math.cos(angle) * radius,
          y: spot.y + Math.sin(angle) * radius,
          radius: 0.35 + (1 - Math.pow(jitter, 0.42)) * 0.75,
          alpha: 0.22 + (1 - Math.pow(jitter, 0.6)) * 0.5,
          twinkle: 0.4 + jitter * 0.9,
          phase: jitter * TAU,
        })
      }
      return stars
    }

    // Андромеда: наклонённый эллипс с ядром и разреженной пылью.
    function chartAndromeda(seed, spot) {
      const stars = []
      for (let index = 0; index < 150; index += 1) {
        const jitter = ((seed * 49979687 + index * 67867967) % 1000003) / 1000003
        const spread = Math.pow(jitter, 0.6)
        const angle = jitter * TAU
        const along = Math.cos(angle) * 0.14 * spot.scale * spread
        const across = Math.sin(angle) * 0.032 * spot.scale * spread
        stars.push({
          x: spot.x + along * Math.cos(spot.tilt) - across * Math.sin(spot.tilt),
          y: spot.y + along * Math.sin(spot.tilt) + across * Math.cos(spot.tilt),
          radius: 0.3 + spread * 0.7,
          alpha: 0.12 + spread * 0.42,
          twinkle: 0.3 + jitter * 0.7,
          phase: jitter * TAU,
        })
      }
      for (let index = 0; index < 40; index += 1) {
        const jitter = ((seed * 86028121 + index * 179424673) % 1000033) / 1000033
        const angle = jitter * TAU
        const along = Math.cos(angle) * 0.2 * spot.scale
        const across = Math.sin(angle) * 0.07 * spot.scale
        stars.push({
          x: spot.x + along * Math.cos(spot.tilt) - across * Math.sin(spot.tilt),
          y: spot.y + along * Math.sin(spot.tilt) + across * Math.cos(spot.tilt),
          radius: 0.28,
          alpha: 0.1,
          twinkle: 0.5,
          phase: jitter * TAU,
        })
      }
      return stars
    }

    // Плеяды: сцепленная группа из семи ярких звёзд с ореолом — их холодный
    // синий отлив отличает скопление от рассеянной пыли.
    function chartPleiades(seed, spot) {
      const stars = []
      for (let index = 0; index < 7; index += 1) {
        const jitter = ((seed * 32452843 + index * 49979687) % 999983) / 999983
        const angle = jitter * TAU
        const radius = 0.038 * spot.scale * (0.4 + jitter)
        stars.push({
          x: spot.x + Math.cos(angle) * radius,
          y: spot.y + Math.sin(angle) * radius * 0.85,
          radius: 1.1 + jitter * 0.7,
          alpha: 0.72 + jitter * 0.28,
          twinkle: 0.5 + jitter * 0.8,
          phase: jitter * TAU,
          cool: true,
        })
      }
      for (let index = 0; index < 60; index += 1) {
        const jitter = ((seed * 86028121 + index * 32452843) % 1000033) / 1000033
        const angle = jitter * TAU
        const radius = 0.07 * spot.scale * Math.sqrt(jitter)
        stars.push({
          x: spot.x + Math.cos(angle) * radius,
          y: spot.y + Math.sin(angle) * radius * 0.85,
          radius: 0.3 + jitter * 0.4,
          alpha: 0.1 + jitter * 0.2,
          twinkle: 0.4 + jitter,
          phase: jitter * TAU,
          cool: true,
        })
      }
      return stars
    }

    const CHART_BUILDERS = Object.freeze({
      spiral: chartSpiral,
      globular: chartGlobular,
      andromeda: chartAndromeda,
      pleiades: chartPleiades,
    })

    // Собирает все карты в плоский список звёзд. Зерно обязательно: без него
    // карта пересобиралась бы заново при каждом resize и дёргалась бы.
    function chartBodies(seed) {
      const stars = []
      CHART_SPOTS.forEach((spot, index) => {
        stars.push(...CHART_BUILDERS[spot.name](seed + index * 7919, spot))
      })
      return stars
    }

    function createChartLayer(width, height) {
      const drift = 1.1
      return {
        // Глубина обязательна: warpField берёт её у слоя, и без неё возмущение
        // от курсора посчиталось бы по undefined.
        depth: 0.15,
        drift,
        stars: chartBodies(20260928).map((star) => ({
          x: star.x * width,
          y: star.y * height,
          radius: star.radius,
          alpha: star.alpha,
          twinkle: star.twinkle,
          phase: star.phase,
          flow: 0.8 + Math.random() * 0.5,
          cool: star.cool === true,
        })),
      }
    }

    // Созвездия: узнаваемые фигуры из настоящих ярких звёзд. Координаты
    // заданы внутри квадрата фигуры (0…1) и переносятся в точку неба.
    //
    // Главное правило: все звёзды фигуры смещаются ОДНИМ и тем же сдвигом.
    // Иначе фигура расползлась бы и перестала быть узнаваемой.
    const CONSTELLATIONS = Object.freeze([
      Object.freeze({
        name: 'Большая Медведица',
        x: 0.06,
        y: 0.74,
        scale: 1,
        // Медведица: ковш. mag — видимая величина, 1 самая яркая.
        stars: Object.freeze([
          [0.97, 0.06, 1.8], [0.79, 0.19, 2.2], [0.61, 0.3, 1.8],
          [0.44, 0.26, 3.3], [0.29, 0.44, 2.4], [0.11, 0.4, 2.4], [0.07, 0.18, 1.8],
        ]),
        links: Object.freeze([[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]]),
      }),
      Object.freeze({
        name: 'Орион',
        x: 0.3,
        y: 0.04,
        scale: 0.92,
        stars: Object.freeze([
          [0.04, 0.12, 1.6], [0.31, 0.05, 2.1], [0.41, 0.4, 2.4],
          [0.5, 0.44, 2.2], [0.59, 0.48, 2.6], [0.44, 0.88, 2.5], [0.74, 0.92, 0.4],
        ]),
        // Пояс Ориона — три звезды в линию, главный его признак.
        links: Object.freeze([
          [0, 2], [1, 4], [2, 3], [3, 4], [4, 6], [2, 5], [0, 1],
        ]),
      }),
      Object.freeze({
        name: 'Кассиопея',
        x: 0.62,
        y: 0.36,
        scale: 0.86,
        // Буква W — её узнают мгновенно.
        stars: Object.freeze([
          [0.03, 0.52, 2.4], [0.24, 0.18, 2.2], [0.46, 0.62, 2.5],
          [0.68, 0.18, 2.5], [0.94, 0.58, 3.4],
        ]),
        links: Object.freeze([[0, 1], [1, 2], [2, 3], [3, 4]]),
      }),
      Object.freeze({
        name: 'Южный Крест',
        x: 0.9,
        y: 0.6,
        scale: 0.8,
        stars: Object.freeze([
          [0.5, 0.03, 1.3], [0.5, 0.97, 1.7], [0.22, 0.38, 2.8],
          [0.78, 0.6, 2.7], [0.86, 0.12, 3.1],
        ]),
        // Два конца креста и его перекладина.
        links: Object.freeze([[0, 1], [2, 3], [0, 4]]),
      }),
      Object.freeze({
        name: 'Лев',
        x: 0.02,
        y: 0.32,
        scale: 0.9,
        // Серп и треугольник хвоста — фигура читается сразу.
        stars: Object.freeze([
          [0.1, 0.62, 2.6], [0.2, 0.4, 2.4], [0.36, 0.24, 2.7],
          [0.58, 0.18, 2.5], [0.8, 0.26, 2.3], [0.84, 0.52, 2.6],
          [0.66, 0.68, 3.3], [0.42, 0.6, 3.4], [0.16, 0.82, 1.4],
        ]),
        links: Object.freeze([
          [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0], [7, 8],
        ]),
      }),
      Object.freeze({
        name: 'Скорпион',
        x: 0.28,
        y: 0.56,
        scale: 0.88,
        // Длинное изогнутое тело и жало; Антарес — красная звезда в поясе.
        stars: Object.freeze([
          [0.06, 0.2, 2.9], [0.16, 0.34, 2.6], [0.3, 0.45, 2.7],
          [0.45, 0.5, 1.1], [0.6, 0.48, 2.5], [0.72, 0.38, 2.8],
          [0.8, 0.22, 2.6], [0.88, 0.08, 2.9], [0.96, 0.2, 3.2],
        ]),
        links: Object.freeze([[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [6, 8]]),
      }),
      Object.freeze({
        name: 'Близнецы',
        x: 0.44,
        y: 0.06,
        scale: 0.8,
        // Две параллельные цепочки и головы — «близнецы» читаются по схожести.
        stars: Object.freeze([
          [0.12, 0.12, 1.6], [0.2, 0.4, 1.6], [0.12, 0.66, 1.6], [0.08, 0.86, 1.9],
          [0.62, 0.1, 1.2], [0.56, 0.38, 1.6], [0.7, 0.64, 1.6], [0.62, 0.86, 2.3],
          [0.34, 0.28, 2.8], [0.4, 0.52, 2.8],
        ]),
        links: Object.freeze([[0, 1], [1, 2], [2, 3], [4, 5], [5, 6], [6, 7], [0, 4], [8, 9]]),
      }),
      Object.freeze({
        name: 'Орел',
        x: 0.74,
        y: 0.5,
        scale: 0.78,
        // Треугольник-крылья и звезда под ними — тело на согнутых крыльях.
        stars: Object.freeze([
          [0.04, 0.12, 2.7], [0.5, 0.3, 0.8], [0.96, 0.12, 2.7],
          [0.5, 0.82, 3.1], [0.26, 0.46, 3.4], [0.76, 0.46, 3.5],
        ]),
        links: Object.freeze([[0, 1], [1, 2], [0, 2], [1, 3], [0, 4], [2, 5]]),
      }),
      Object.freeze({
        name: 'Дракон',
        x: 0.52,
        y: 0.66,
        scale: 0.94,
        // Зигзаг: голова, шея, тело и хвост вниз.
        stars: Object.freeze([
          [0.06, 0.08, 3.1], [0.22, 0.16, 2.8], [0.4, 0.12, 2.7],
          [0.58, 0.22, 3.0], [0.7, 0.4, 2.6], [0.62, 0.58, 2.8],
          [0.44, 0.64, 2.9], [0.26, 0.6, 3.0], [0.12, 0.72, 3.1], [0.06, 0.9, 2.8],
        ]),
        links: Object.freeze([[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9]]),
      }),
      Object.freeze({
        name: 'Лебедь',
        x: 0.36,
        y: 0.3,
        scale: 0.82,
        // Северный крест: длинное крыло, поперечная перекладина, голова.
        stars: Object.freeze([
          [0.5, 0.02, 1.8], [0.5, 0.5, 2.2], [0.5, 0.98, 2.5],
          [0.18, 0.42, 2.6], [0.84, 0.56, 2.7], [0.5, 0.78, 3.2],
        ]),
        links: Object.freeze([[0, 1], [1, 2], [3, 1], [1, 4]]),
      }),
      Object.freeze({
        name: 'Центавр',
        x: 0.66,
        y: 0.86,
        scale: 0.9,
        // Гигант рядом с Южным Крестом; здесь та же длинная вытянутость.
        stars: Object.freeze([
          [0.06, 0.24, 2.6], [0.3, 0.3, 2.4], [0.56, 0.4, 1.1],
          [0.78, 0.5, 2.5], [0.92, 0.66, 2.3], [0.5, 0.78, 2.6],
          [0.26, 0.7, 2.7],
        ]),
        links: Object.freeze([[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [5, 6], [6, 1]]),
      }),
      Object.freeze({
        name: 'Пёс Большой',
        x: 0.06,
        y: 0.9,
        scale: 0.86,
        // Сириус — самая яркая звезда неба, нос собаки.
        stars: Object.freeze([
          [0.06, 0.78, 0.4], [0.22, 0.66, 2.2], [0.42, 0.52, 2.6],
          [0.64, 0.38, 1.8], [0.84, 0.24, 2.1], [0.7, 0.12, 2.5],
          [0.46, 0.16, 3.0],
        ]),
        links: Object.freeze([[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]]),
      }),
      Object.freeze({
        name: 'Лира',
        x: 0.7,
        y: 0.2,
        scale: 0.7,
        // Маленький параллелограмм с Вегой — крошечная, но узнаваемая.
        stars: Object.freeze([
          [0.14, 0.16, 0.3], [0.2, 0.62, 3.6], [0.66, 0.72, 3.3],
          [0.82, 0.26, 3.2], [0.52, 0.1, 4.2],
        ]),
        links: Object.freeze([[0, 1], [1, 2], [2, 3], [3, 0], [0, 4]]),
      }),
      Object.freeze({
        name: 'Персей',
        x: 0.82,
        y: 0.86,
        scale: 0.84,
        // Изогнутая цепочка к Мирафу — фигура «подплывает» к Южному Кресту.
        stars: Object.freeze([
          [0.08, 0.86, 2.2], [0.22, 0.66, 2.4], [0.4, 0.52, 2.8],
          [0.62, 0.4, 2.2], [0.84, 0.24, 2.3], [0.7, 0.12, 2.9],
        ]),
        links: Object.freeze([[0, 1], [1, 2], [2, 3], [3, 4], [3, 5]]),
      }),
    ])

    // Силуэты-подсказки. Не иллюстрация, а намёк: полупрозрачная форма,
    // наложенная на фигуру, чтобы тот, кто знает созвездие, угадал, а остальные
    // ничего не заметили. Поэтому они еле видны и лежат ПОД звёздами.
    //
    // Три примитива, чтобы не тащить в проект графику:
    //   poly   — замкнутая область,
    //   stroke — линия переменной толщины (лапы, хвост, шея),
    //   disc   — круг (голова, глаз).
    // Все координаты — в той же системе 0…1, что и звёзды фигуры.
    const SILHOUETTE_ALPHA = 0.075
    const SILHOUETTE_LINE = 0.1

    const CONSTELLATION_SILHOUETTES = Object.freeze({
      'Большая Медведица': Object.freeze({
        // Медведь: тело вдоль ковша, голова у морды, четыре лапы, короткий хвост.
        marks: Object.freeze([
          { kind: 'poly', points: Object.freeze([[0.14, 0.26], [0.5, 0.18], [0.66, 0.34], [0.5, 0.54], [0.2, 0.5]]) },
          { kind: 'disc', x: 0.1, y: 0.19, r: 0.11, alpha: 1.15 },
          { kind: 'poly', points: Object.freeze([[0.02, 0.14], [0.1, 0.08], [0.13, 0.2], [0.05, 0.22]]) },
          { kind: 'stroke', width: 0.035, points: Object.freeze([[0.22, 0.5], [0.2, 0.66]]) },
          { kind: 'stroke', width: 0.035, points: Object.freeze([[0.34, 0.54], [0.33, 0.7]]) },
          { kind: 'stroke', width: 0.035, points: Object.freeze([[0.5, 0.54], [0.5, 0.7]]) },
          { kind: 'stroke', width: 0.035, points: Object.freeze([[0.62, 0.44], [0.66, 0.58]]) },
          { kind: 'stroke', width: 0.02, points: Object.freeze([[0.66, 0.3], [0.8, 0.16], [0.9, 0.24]]) },
        ]),
      }),
      'Орион': Object.freeze({
        // Охотник: голова, плечи, туловище, ПОЯС поперёк и сабля вниз.
        marks: Object.freeze([
          { kind: 'disc', x: 0.17, y: 0.08, r: 0.075, alpha: 1.15 },
          { kind: 'poly', points: Object.freeze([[0.03, 0.14], [0.3, 0.05], [0.4, 0.36], [0.3, 0.46], [0.1, 0.34]]) },
          { kind: 'poly', alpha: 1.5, points: Object.freeze([[0.37, 0.4], [0.63, 0.46], [0.62, 0.54], [0.36, 0.48]]) },
          { kind: 'stroke', width: 0.04, points: Object.freeze([[0.1, 0.16], [0.24, 0.36]]) },
          { kind: 'stroke', width: 0.04, points: Object.freeze([[0.3, 0.08], [0.34, 0.3]]) },
          { kind: 'stroke', width: 0.05, points: Object.freeze([[0.42, 0.5], [0.44, 0.88]]) },
          { kind: 'stroke', width: 0.05, points: Object.freeze([[0.6, 0.54], [0.74, 0.9]]) },
          { kind: 'stroke', width: 0.03, alpha: 1.3, points: Object.freeze([[0.49, 0.5], [0.52, 0.72]]) },
        ]),
      }),
      'Кассиопея': Object.freeze({
        // Царица на троне: изгиб W — её сидящая поза, сверху корона.
        marks: Object.freeze([
          { kind: 'poly', points: Object.freeze([[0.1, 0.62], [0.3, 0.28], [0.5, 0.66], [0.7, 0.28], [0.9, 0.6], [0.86, 0.8], [0.14, 0.8]]) },
          { kind: 'disc', x: 0.46, y: 0.42, r: 0.08, alpha: 1.15 },
          { kind: 'poly', alpha: 1.3, points: Object.freeze([[0.36, 0.32], [0.56, 0.3], [0.54, 0.2], [0.38, 0.22]]) },
          { kind: 'stroke', width: 0.03, points: Object.freeze([[0.5, 0.5], [0.26, 0.24]]) },
          { kind: 'stroke', width: 0.03, points: Object.freeze([[0.5, 0.5], [0.72, 0.24]]) },
        ]),
      }),
      'Южный Крест': Object.freeze({
        marks: Object.freeze([
          { kind: 'poly', alpha: 1.3, points: Object.freeze([[0.45, 0.06], [0.55, 0.06], [0.55, 0.94], [0.45, 0.94]]) },
          { kind: 'poly', alpha: 1.3, points: Object.freeze([[0.24, 0.4], [0.76, 0.58], [0.74, 0.68], [0.22, 0.5]]) },
        ]),
      }),
      'Лев': Object.freeze({
        // Голова льва у когтя Регула, грива дугой, хвост уходит вверх.
        marks: Object.freeze([
          { kind: 'disc', x: 0.16, y: 0.8, r: 0.13, alpha: 1.1 },
          { kind: 'poly', alpha: 0.8, points: Object.freeze([[0.02, 0.6], [0.3, 0.54], [0.32, 0.96], [0.04, 0.98]]) },
          { kind: 'poly', points: Object.freeze([[0.1, 0.7], [0.24, 0.68], [0.26, 0.9], [0.1, 0.92]]) },
          { kind: 'stroke', width: 0.03, points: Object.freeze([[0.3, 0.56], [0.5, 0.26]]) },
          { kind: 'stroke', width: 0.025, points: Object.freeze([[0.78, 0.28], [0.88, 0.1], [0.96, 0.18]]) },
        ]),
      }),
      'Скорпион': Object.freeze({
        // Изогнутое тело, клешни у головы и жало на конце хвоста.
        marks: Object.freeze([
          { kind: 'stroke', width: 0.07, points: Object.freeze([[0.1, 0.22], [0.3, 0.45], [0.5, 0.5], [0.72, 0.4], [0.86, 0.2]]) },
          { kind: 'poly', points: Object.freeze([[0.04, 0.16], [0.16, 0.2], [0.1, 0.3], [0.02, 0.24]]) },
          { kind: 'poly', points: Object.freeze([[0.06, 0.36], [0.18, 0.34], [0.12, 0.46], [0.02, 0.44]]) },
          { kind: 'stroke', width: 0.04, points: Object.freeze([[0.86, 0.2], [0.97, 0.16], [0.93, 0.3]]) },
        ]),
      }),
      'Близнецы': Object.freeze({
        // Две фигуры рядом: у каждой голова, торс и две ноги.
        marks: Object.freeze([
          { kind: 'disc', x: 0.12, y: 0.1, r: 0.06, alpha: 1.15 },
          { kind: 'poly', points: Object.freeze([[0.06, 0.18], [0.2, 0.16], [0.22, 0.58], [0.04, 0.6]]) },
          { kind: 'stroke', width: 0.03, points: Object.freeze([[0.09, 0.6], [0.08, 0.86]]) },
          { kind: 'stroke', width: 0.03, points: Object.freeze([[0.18, 0.58], [0.2, 0.86]]) },
          { kind: 'disc', x: 0.6, y: 0.08, r: 0.06, alpha: 1.15 },
          { kind: 'poly', points: Object.freeze([[0.54, 0.16], [0.68, 0.14], [0.7, 0.56], [0.52, 0.58]]) },
          { kind: 'stroke', width: 0.03, points: Object.freeze([[0.57, 0.58], [0.56, 0.86]]) },
          { kind: 'stroke', width: 0.03, points: Object.freeze([[0.66, 0.56], [0.68, 0.86]]) },
        ]),
      }),
      'Орел': Object.freeze({
        // Раскинутые крылья — широкий треугольник, тело и голова в центре.
        marks: Object.freeze([
          { kind: 'poly', points: Object.freeze([[0.03, 0.1], [0.5, 0.3], [0.97, 0.1], [0.74, 0.44], [0.5, 0.34], [0.26, 0.44]]) },
          { kind: 'poly', points: Object.freeze([[0.42, 0.26], [0.58, 0.26], [0.56, 0.8], [0.44, 0.8]]) },
          { kind: 'disc', x: 0.5, y: 0.22, r: 0.06, alpha: 1.15 },
        ]),
      }),
      'Дракон': Object.freeze({
        // Голова, длинное тело по зигзагу и хвост вниз.
        marks: Object.freeze([
          { kind: 'poly', points: Object.freeze([[0.03, 0.05], [0.2, 0.03], [0.24, 0.16], [0.08, 0.18]]) },
          { kind: 'stroke', width: 0.06, points: Object.freeze([[0.14, 0.14], [0.4, 0.12], [0.62, 0.24], [0.66, 0.46], [0.44, 0.64], [0.2, 0.6]]) },
          { kind: 'stroke', width: 0.04, points: Object.freeze([[0.2, 0.6], [0.1, 0.74], [0.06, 0.92]]) },
        ]),
      }),
      'Лебедь': Object.freeze({
        // Длинная шея вдоль канала Креста, крылья по бокам.
        marks: Object.freeze([
          { kind: 'stroke', width: 0.06, points: Object.freeze([[0.5, 0.06], [0.5, 0.9]]) },
          { kind: 'poly', points: Object.freeze([[0.5, 0.4], [0.2, 0.34], [0.24, 0.6], [0.5, 0.56]]) },
          { kind: 'poly', points: Object.freeze([[0.5, 0.4], [0.8, 0.48], [0.76, 0.7], [0.5, 0.6]]) },
          { kind: 'disc', x: 0.5, y: 0.05, r: 0.05, alpha: 1.2 },
          { kind: 'stroke', width: 0.025, points: Object.freeze([[0.54, 0.04], [0.64, 0.02]]) },
        ]),
      }),
      'Центавр': Object.freeze({
        // Человеческая часть справа, вытянутое тело лошади и четыре ноги.
        marks: Object.freeze([
          { kind: 'poly', points: Object.freeze([[0.62, 0.2], [0.78, 0.22], [0.8, 0.46], [0.64, 0.48]]) },
          { kind: 'disc', x: 0.7, y: 0.14, r: 0.055, alpha: 1.15 },
          { kind: 'poly', points: Object.freeze([[0.1, 0.28], [0.6, 0.3], [0.62, 0.52], [0.14, 0.5]]) },
          { kind: 'stroke', width: 0.03, points: Object.freeze([[0.2, 0.5], [0.18, 0.74]]) },
          { kind: 'stroke', width: 0.03, points: Object.freeze([[0.32, 0.52], [0.3, 0.76]]) },
          { kind: 'stroke', width: 0.03, points: Object.freeze([[0.46, 0.52], [0.48, 0.76]]) },
          { kind: 'stroke', width: 0.03, points: Object.freeze([[0.56, 0.5], [0.58, 0.74]]) },
        ]),
      }),
      'Пёс Большой': Object.freeze({
        // Собака вдоль диагонали: морда у Сириуса, спина, лапы, хвост.
        marks: Object.freeze([
          { kind: 'poly', points: Object.freeze([[0.26, 0.66], [0.62, 0.4], [0.72, 0.56], [0.36, 0.8]]) },
          { kind: 'disc', x: 0.18, y: 0.74, r: 0.08, alpha: 1.1 },
          { kind: 'poly', points: Object.freeze([[0.08, 0.66], [0.2, 0.7], [0.16, 0.86], [0.06, 0.82]]) },
          { kind: 'stroke', width: 0.03, points: Object.freeze([[0.36, 0.8], [0.34, 0.94]]) },
          { kind: 'stroke', width: 0.03, points: Object.freeze([[0.58, 0.66], [0.6, 0.8]]) },
          { kind: 'stroke', width: 0.03, points: Object.freeze([[0.66, 0.54], [0.86, 0.3], [0.94, 0.36]]) },
        ]),
      }),
      'Лира': Object.freeze({
        // Лира: рама из двух плавных стоек и звукосборной коробки.
        marks: Object.freeze([
          { kind: 'poly', points: Object.freeze([[0.22, 0.26], [0.78, 0.26], [0.7, 0.7], [0.3, 0.7]]) },
          { kind: 'stroke', width: 0.05, points: Object.freeze([[0.2, 0.64], [0.18, 0.26], [0.5, 0.1], [0.82, 0.26], [0.8, 0.64]]) },
          { kind: 'stroke', width: 0.015, alpha: 0.7, points: Object.freeze([[0.32, 0.66], [0.68, 0.66]]) },
        ]),
      }),
      'Персей': Object.freeze({
        // Фигура с поднятой рукой — Мираф держит над головой меч.
        marks: Object.freeze([
          { kind: 'disc', x: 0.42, y: 0.34, r: 0.06, alpha: 1.15 },
          { kind: 'poly', points: Object.freeze([[0.34, 0.42], [0.52, 0.4], [0.56, 0.66], [0.32, 0.68]]) },
          { kind: 'stroke', width: 0.035, points: Object.freeze([[0.34, 0.46], [0.18, 0.3], [0.12, 0.16]]) },
          { kind: 'stroke', width: 0.03, points: Object.freeze([[0.36, 0.68], [0.26, 0.88]]) },
          { kind: 'stroke', width: 0.03, points: Object.freeze([[0.52, 0.66], [0.62, 0.84]]) },
          { kind: 'stroke', width: 0.025, alpha: 1.3, points: Object.freeze([[0.16, 0.14], [0.08, 0.04]]) },
        ]),
      }),
    })

    // Фигуры собираются один раз в пикселях холста. Сдвиг у всех один:
    // координаты хранятся относительно сдвинутого начала фигуры.
    function createConstellationLayer(width, height) {
      // Фигура занимает заметную долю неба: прежний 0.22 и крошечные точки
      // терялись среди сотен фоновых звёзд, и фигуру нельзя было узнать.
      const size = Math.max(120, Math.min(width, height) * 0.17)
      const figures = CONSTELLATIONS.map((figure) => ({
        name: figure.name,
        ox: figure.x * width,
        oy: figure.y * height,
        size: size * figure.scale,
        // Звёзды приводятся к экранным координатам на месте: dx/dy прибавляются
        // в момент отрисовки, и вся фигура едет как одно целое.
        stars: figure.stars.map(([sx, sy, mag]) => ({
          x: sx,
          y: sy,
          // Ярчесть превращается в радиус: mag 1 — самая большая точка.
          // Именованные звёзды крупнее фоновых, иначе фигура тонет в сыпи.
          radius: Math.max(1.5, 4.4 - mag * 0.72),
        })),
        links: figure.links,
      }))
      // Дрейф медленный: небосклон ползёт, а не едет. 0.6 px/с — фигура за
      // минуту смещается на треть экрана и не отвлекает от работы.
      return { drift: 0.6, figures }
    }

    // Силуэт рисуется первым, под звёздами и линиями. Он настолько бледный,
    // что виден только тем, кто уже знает, что это за фигура.
    function drawSilhouette(ctx, figure, ox, oy, size) {
      const shape = CONSTELLATION_SILHOUETTES[figure.name]
      if (shape === undefined) return
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      for (const mark of shape.marks) {
        const weight = mark.alpha === undefined ? 1 : mark.alpha
        if (mark.kind === 'poly') {
          ctx.beginPath()
          for (let index = 0; index < mark.points.length; index += 1) {
            const [px, py] = mark.points[index]
            if (index === 0) ctx.moveTo(ox + px * size, oy + py * size)
            else ctx.lineTo(ox + px * size, oy + py * size)
          }
          ctx.closePath()
          ctx.fillStyle = `rgba(126, 168, 235, ${SILHOUETTE_ALPHA * weight})`
          ctx.fill()
        } else if (mark.kind === 'disc') {
          ctx.beginPath()
          ctx.arc(ox + mark.x * size, oy + mark.y * size, Math.max(0.5, mark.r * size), 0, TAU)
          ctx.fillStyle = `rgba(126, 168, 235, ${SILHOUETTE_ALPHA * weight})`
          ctx.fill()
        } else {
          ctx.beginPath()
          for (let index = 0; index < mark.points.length; index += 1) {
            const [px, py] = mark.points[index]
            if (index === 0) ctx.moveTo(ox + px * size, oy + py * size)
            else ctx.lineTo(ox + px * size, oy + py * size)
          }
          ctx.strokeStyle = `rgba(150, 190, 250, ${SILHOUETTE_LINE * weight})`
          ctx.lineWidth = Math.max(0.6, mark.width * size)
          ctx.stroke()
        }
      }
      ctx.restore()
    }

    // Фигуры рисуются одним сдвигом на небо. Линии заметные: они и есть
    // опознавательный признак — без них фигура не читается как созвездие.
    function drawConstellations(ctx, width, time) {
      if (space.options.constellations === false) return
      const layer = space.constellations
      if (layer === undefined) return
      const dx = (((0 - time * layer.drift) % width) + width) % width
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      for (const figure of layer.figures) {
        // Подсказка идёт первой: силуэт лежит под звёздами и линиями.
        drawSilhouette(ctx, figure, figure.ox + dx, figure.oy, figure.size)
        for (const [from, to] of figure.links) {
          const a = figure.stars[from]
          const b = figure.stars[to]
          if (a === undefined || b === undefined) continue
          const x1 = figure.ox + dx + a.x * figure.size
          const y1 = figure.oy + a.y * figure.size
          const x2 = figure.ox + dx + b.x * figure.size
          const y2 = figure.oy + b.y * figure.size
          // Два прохода: широкое бледное свечение и тонкая яркая нить поверх.
          // Одной нити на тёмном небе почти не видно.
          ctx.strokeStyle = 'rgba(140, 178, 240, 0.09)'
          ctx.lineWidth = 3.2
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.stroke()
          ctx.strokeStyle = 'rgba(186, 214, 255, 0.34)'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.stroke()
        }
        for (const star of figure.stars) {
          const x = figure.ox + dx + star.x * figure.size
          const y = figure.oy + star.y * figure.size
          const halo = ctx.createRadialGradient(x, y, 0, x, y, star.radius * 3.4)
          halo.addColorStop(0, 'rgba(226, 240, 255, 0.5)')
          halo.addColorStop(0.35, 'rgba(180, 212, 255, 0.24)')
          halo.addColorStop(1, 'rgba(140, 180, 255, 0)')
          ctx.fillStyle = halo
          ctx.beginPath()
          ctx.arc(x, y, star.radius * 3.4, 0, TAU)
          ctx.fill()
          // Крестообразный луч у самых ярких — те же лучи, что у диффракции.
          if (star.radius > 3) {
            const len = star.radius * 3.6
            ctx.strokeStyle = 'rgba(220, 236, 255, 0.28)'
            ctx.lineWidth = 0.9
            ctx.beginPath()
            ctx.moveTo(x - len, y)
            ctx.lineTo(x + len, y)
            ctx.moveTo(x, y - len)
            ctx.lineTo(x, y + len)
            ctx.stroke()
          }
          ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
          ctx.beginPath()
          ctx.arc(x, y, star.radius, 0, TAU)
          ctx.fill()
        }
      }
      ctx.restore()
    }

    function createField() {
      return { x: -9999, y: -9999, targetX: -9999, targetY: -9999, energy: 0, radius: 190, rings: [], cooldown: 0, seeded: false }
    }

    // ── космос: поле курсора ───────────────────────────────────────────────
    // Возмущение держится рядом с курсором: радиус небольшой, закручивание
    // слабое, свечение тихое — поле заметно, но не перетягивает внимание.
    function steerField(field, x, y, dt) {
      const dx = x - field.targetX
      const dy = y - field.targetY
      const speed = Math.hypot(dx, dy) / Math.max(dt, 0.001)
      if (Number.isFinite(speed)) field.energy = clamp(field.energy + speed * 0.00008, 0, 1)
      field.targetX = x
      field.targetY = y
      if (!field.seeded) {
        field.x = x
        field.y = y
        field.seeded = true
      }
    }

    function updateField(field, dt) {
      field.x = lerp(field.x, field.targetX, 1 - Math.pow(0.0015, dt))
      field.y = lerp(field.y, field.targetY, 1 - Math.pow(0.0015, dt))
      // Поле гаснет быстрее прежнего и держится теснее: возмущение от мыши —
      // тонкий намёк, а не светящийся шар под курсором.
      field.energy *= Math.pow(0.02, dt)
      if (field.energy < 0.002) field.energy = 0
      field.radius = 70 + field.energy * 58
      field.cooldown -= dt
      if (field.energy > 0.72 && field.cooldown <= 0) {
        field.rings.push({ age: 0, life: 0.9 + field.energy * 0.5 })
        field.cooldown = 0.5 - field.energy * 0.18
      }
      field.rings = field.rings.filter((ring) => {
        ring.age += dt
        return ring.age < ring.life
      })
    }

    function warpField(field, x, y, depth) {
      if (field.energy <= 0) return null
      const dx = x - field.x
      const dy = y - field.y
      const distance = Math.hypot(dx, dy)
      if (distance > field.radius) return null
      const sigma = field.radius * 0.42
      const falloff = Math.exp(-(distance * distance) / (2 * sigma * sigma)) * field.energy * (0.35 + depth * 0.65)
      const angle = falloff * 0.42
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      const rx = dx * cos - dy * sin
      const ry = dx * sin + dy * cos
      const push = falloff * 11 * (1 - distance / field.radius)
      return { x: x + rx * 0.09 + push * 0.35, y: y + ry * 0.09 + push * 0.15, glow: falloff }
    }

    // ── космос: отрисовка ──────────────────────────────────────────────────
    // Прямой путь: небо и все туманности одним махом, без кэша. Обычный кадр
    // сюда не ходит — он берёт готовые полосы. Остался на случай, когда кэш
    // ещё не собран (нулевой размер слоя, сломанный getContext).
    function drawBackground(ctx, width, height, time) {
      paintSky(ctx, width, height, 0)
      if (space.options.stars === false) return
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      for (const nebula of space.nebulae) {
        const cx = (((nebula.x + time * nebula.drift) % 1.2) - 0.1) * width
        const cy = nebula.y * height
        const radius = nebula.radius * Math.max(width, height)
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
        glow.addColorStop(0, `hsla(${nebula.hue}, 70%, 62%, ${nebula.alpha})`)
        glow.addColorStop(0.55, `hsla(${nebula.hue}, 70%, 50%, ${nebula.alpha * 0.35})`)
        glow.addColorStop(1, 'hsla(0, 0%, 0%, 0)')
        ctx.fillStyle = glow
        ctx.fillRect(0, 0, width, height)
      }
      ctx.restore()
    }

    // ── космос: кэшированные полосы параллакса ─────────────────────────────
    // Небо и туманности прежде перерисовывались каждый кадр: одна заливка
    // неба плюс четыре-шесть радиальных градиентов на весь экран. Теперь они
    // живут в трёх канвасах-полосах и пересобираются только при смене размера
    // или dpr, а в кадре остаётся три блита.
    //
    // Движение сохранено. Полоса сдвигается вправо на доли экрана в секунду
    // (дальняя медленнее ближней), а картина в ней повторяется с шагом
    // BAND_PERIOD — ровно с тем, с каким ходят сами туманности. Поэтому
    // сдвиг в пределах периода показывает ту же картину: ни края, ни стыка.
    const BAND_PERIOD = 1.2
    const BAND_DRIFT = Object.freeze({ far: 1.6, mid: 3, near: 5.4 })
    const BAND_DUST = 110

    function bandSignature(width, height, dpr) {
      return `${Math.round(width)}x${Math.round(height)}@${dpr}`
    }

    function createBand() {
      const canvas = document.createElement('canvas')
      return { canvas, ctx: canvas.getContext('2d'), signature: null }
    }

    // Сдвиг полосы по кругу шириной периода: содержимое полосы повторяется с
    // этим шагом, поэтому возврат на ноль не виден глазу.
    function bandShift(time, speed, period) {
      if (!(period > 0)) return 0
      const raw = time * speed
      return ((raw % period) + period) % period
    }

    // Пыль и далёкое зерно ставятся по индексу, а не случайно: иначе пересборка
    // полосы на ресайзе переставляла бы картину.
    function hash01(seed) {
      const value = Math.sin(seed * 12.9898) * 43758.5453
      return value - Math.floor(value)
    }

    function paintSky(ctx, width, height, period) {
      const sky = ctx.createLinearGradient(0, 0, 0, height)
      sky.addColorStop(0, '#04060f')
      sky.addColorStop(0.55, '#070a1a')
      sky.addColorStop(1, '#0a0c1e')
      ctx.fillStyle = sky
      // Заливка на окно [−period, width + period]: столько нужно, чтобы полоса
      // осталась непрозрачной при любом сдвиге. Градиент вертикальный, по
      // горизонтали цвет тот же, поэтому лишнее не видно.
      ctx.fillRect(-period, 0, width + period * 2, height)
    }

    // Срез туманностей [from, to) в полосу: те же радиальные градиенты, тот же
    // lighter и тот же дрейф, что и в прямом пути. Копии кладутся ровно на
    // период — с ними сдвиг полосы не меняет картину, а значит не бывает ни
    // обрыва на краю холста, ни щелчка на переходе через ноль.
    function paintNebulae(ctx, width, height, period, from, to) {
      if (space.options.stars === false || to <= from) return
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      const reach = Math.max(width, height)
      for (let index = from; index < to; index += 1) {
        const nebula = space.nebulae[index]
        if (nebula === undefined) continue
        const base = (((nebula.x + space.time * nebula.drift) % 1.2) - 0.1) * width
        const cy = nebula.y * height
        const radius = nebula.radius * reach
        const first = Math.ceil((-radius - base) / period)
        const last = Math.floor((width + period + radius - base) / period)
        for (let step = first; step <= last; step += 1) {
          const cx = base + step * period
          const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
          glow.addColorStop(0, `hsla(${nebula.hue}, 70%, 62%, ${nebula.alpha})`)
          glow.addColorStop(0.55, `hsla(${nebula.hue}, 70%, 50%, ${nebula.alpha * 0.35})`)
          glow.addColorStop(1, 'hsla(0, 0%, 0%, 0)')
          ctx.fillStyle = glow
          // Вне круга градиент прозрачен, поэтому заливаем только его
          // прямоугольник — картинка та же, а работы заметно меньше.
          ctx.fillRect(-period, cy - radius, width + period * 2, radius * 2)
        }
      }
      ctx.restore()
    }

    // Ближняя пыль у самой камеры. Намеренно слабая: полоса должна добавить
    // глубины, а не поменять картину. Раскладывается сразу по всему окну
    // отрисовки, копии ей не нужны — у пыли нет жёсткого края.
    function paintNearDust(ctx, width, height, period) {
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.fillStyle = 'rgb(214, 226, 255)'
      for (let index = 0; index < BAND_DUST; index += 1) {
        const x = -period + hash01(index * 7 + 1) * (width + period * 2)
        const y = hash01(index * 13 + 5) * height
        const radius = 0.5 + hash01(index * 29 + 11) * 1.7
        ctx.globalAlpha = 0.025 + hash01(index * 31 + 3) * 0.045
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, TAU)
        ctx.fill()
      }
      ctx.restore()
    }

    function renderBands() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const width = space.width
      const height = space.height
      const signature = bandSignature(width, height, dpr)
      // Пока размер, dpr и режим звёзд те же — перерисовки нет вовсе.
      if (space.bandsSignature === signature && space.bandsStars === space.options.stars) return
      // Без 2d-контекста кэша нет: подпись не ставим, кадр уйдёт в прямой путь.
      if (space.bands.far.ctx === null || space.bands.mid.ctx === null || space.bands.near.ctx === null) {
        space.bandsSignature = null
        return
      }
      space.bandsSignature = signature
      space.bandsStars = space.options.stars
      const period = Math.max(1, BAND_PERIOD * width)
      for (const key of ['far', 'mid', 'near']) {
        const band = space.bands[key]
        band.canvas.width = Math.max(1, Math.round(width * dpr))
        band.canvas.height = Math.max(1, Math.round(height * dpr))
        band.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        band.signature = signature
      }
      const count = space.nebulae.length
      const far = Math.ceil(count / 3)
      const mid = Math.ceil((count - far) / 2)
      // Дальняя полоса несёт небо — она непрозрачна и кладётся первой,
      // средняя и ближняя добавляют своё поверх через lighter.
      paintSky(space.bands.far.ctx, width, height, period)
      paintNebulae(space.bands.far.ctx, width, height, period, 0, far)
      paintNebulae(space.bands.mid.ctx, width, height, period, far, far + mid)
      paintNebulae(space.bands.near.ctx, width, height, period, far + mid, count)
      paintNearDust(space.bands.near.ctx, width, height, period)
    }

    // Порог яркой звезды: всё крупнее считается пробивающим газ и рисуется
    // поверх туманностей, остальное тонет в её дымке.
    const BRIGHT_RADIUS = 1.2

    function isBrightStar(star) {
      return star.radius >= BRIGHT_RADIUS
    }

    // Крестообразные лучи яркой звезды: короткие, тонкие и только у самых
    // крупных. Именно они читаются как дифракция на подсвеченном газе.
    function drawStarFlare(ctx, x, y, radius, alpha) {
      const len = radius * 5.5
      const width = Math.max(0.6, radius * 0.35)
      ctx.globalCompositeOperation = 'lighter'
      ctx.strokeStyle = `rgba(226, 240, 255, ${clamp(alpha * 0.5, 0, 1)})`
      ctx.lineWidth = width
      ctx.beginPath()
      ctx.moveTo(x - len, y)
      ctx.lineTo(x + len, y)
      ctx.moveTo(x, y - len)
      ctx.lineTo(x, y + len)
      ctx.stroke()
    }

    // Фильтр mode разводит звёзды по слоям кадра: 'dim' уходят за газ и
    // туманность их приглушает, 'bright' идут поверх и дают лучи.
    function drawStars(ctx, width, time, mode) {
      if (space.options.stars === false) return
      const bright = mode === 'bright'
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      for (const layer of space.stars) {
        for (const star of layer.stars) {
          const isBright = isBrightStar(star)
          if (isBright !== bright) continue
          const drifted = (((star.x - time * layer.drift * star.flow) % width) + width) % width
          const twinkle = 0.72 + 0.28 * Math.sin(time * star.twinkle + star.phase)
          const warped = space.options.perturbation ? warpField(space.field, drifted, star.y, layer.depth) : null
          const x = warped === null ? drifted : warped.x
          const y = warped === null ? star.y : warped.y
          const alpha = star.alpha * twinkle * (warped === null ? 1 : 1 + warped.glow * 0.16)
          const radius = star.radius * (warped === null ? 1 : 1 + warped.glow * 0.06)
          // Плеяды горят холоднее: синеватый отлив отличает скопление от
          // рассеянных звёзд вокруг.
          ctx.fillStyle = star.cool === true
            ? `rgba(196, 222, 255, ${clamp(alpha, 0, 1)})`
            : `rgba(226, 236, 255, ${clamp(alpha, 0, 1)})`
          ctx.beginPath()
          ctx.arc(x, y, radius, 0, TAU)
          ctx.fill()
          if (bright && radius > 1.5) drawStarFlare(ctx, x, y, radius, alpha)
        }
      }
      ctx.restore()
    }

    // Кольцо рисуется двумя половинами: дальняя — до диска, ближняя — после.
    // Между половинами остаётся тонкий зазор — кольцо читается как объёмное.
    function drawRing(ctx, planet, x, y, radius, half) {
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(planet.tilt)
      ctx.scale(1, 0.16)
      const from = half === 'back' ? Math.PI : 0
      const to = half === 'back' ? TAU : Math.PI
      for (const ring of [
        { r: radius * 1.42, w: radius * 0.11, a: 0.9 },
        { r: radius * 1.62, w: radius * 0.07, a: 0.6 },
      ]) {
        const glow = ctx.createLinearGradient(-ring.r, 0, ring.r, 0)
        glow.addColorStop(0, `hsla(${planet.hue}, 45%, 80%, ${planet.alpha * ring.a * 0.25})`)
        glow.addColorStop(0.5, `hsla(${planet.hue + 10}, 55%, 88%, ${planet.alpha * ring.a})`)
        glow.addColorStop(1, `hsla(${planet.hue}, 45%, 80%, ${planet.alpha * ring.a * 0.25})`)
        ctx.strokeStyle = glow
        ctx.lineWidth = ring.w
        ctx.beginPath()
        ctx.arc(0, 0, ring.r, from, to)
        ctx.stroke()
      }
      ctx.restore()
    }

    // Спутники. Половина орбиты — за планетой, половина — перед ней, поэтому
    // они рисуются в двух местах кадра: near решает, какая половина сейчас
    // на экране. Орбита сплюснута по вертикали — так она читается как
    // наклонённая, а не как круг, нарисованный сбоку.
    function drawOrbiters(ctx, planet, x, y, near) {
      if (planet.orbiters === undefined) return
      const tilt = planet.orbitTilt ?? 0
      const cos = Math.cos(tilt)
      const sin = Math.sin(tilt)
      for (const orbiter of planet.orbiters) {
        const angle = orbiter.phase + space.time * orbiter.speed
        const along = Math.cos(angle) * orbiter.r
        const across = Math.sin(angle) * orbiter.r * 0.34
        if ((across >= 0) !== near) continue
        const ox = x + along * cos - across * sin
        const oy = y + along * sin + across * cos
        const halo = ctx.createRadialGradient(ox, oy, 0, ox, oy, orbiter.size * 3.2)
        halo.addColorStop(0, `hsla(${orbiter.hue}, 85%, 88%, ${orbiter.alpha * 0.5})`)
        halo.addColorStop(0.4, `hsla(${orbiter.hue}, 80%, 72%, ${orbiter.alpha * 0.22})`)
        halo.addColorStop(1, `hsla(${orbiter.hue}, 80%, 66%, 0)`)
        ctx.fillStyle = halo
        ctx.beginPath()
        ctx.arc(ox, oy, orbiter.size * 3.2, 0, TAU)
        ctx.fill()
        ctx.fillStyle = `hsla(${orbiter.hue}, 70%, 92%, ${orbiter.alpha})`
        ctx.beginPath()
        ctx.arc(ox, oy, orbiter.size, 0, TAU)
        ctx.fill()
      }
    }

    // Дорожки орбит — очень тусклые: по ним и видно, что спутник летит, а не
    // просто висит. Без них вращение не читается.
    function drawOrbitTracks(ctx, planet, x, y) {
      if (planet.orbiters === undefined) return
      const tilt = planet.orbitTilt ?? 0
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      for (const orbiter of planet.orbiters) {
        ctx.beginPath()
        ctx.ellipse(
          x,
          y,
          orbiter.r,
          orbiter.r * 0.34,
          tilt,
          0,
          TAU,
        )
        ctx.strokeStyle = `hsla(${orbiter.hue}, 60%, 70%, 0.07)`
        ctx.lineWidth = 0.7
        ctx.stroke()
      }
      ctx.restore()
    }

    function drawPlanets(ctx, width, height, step) {
      if (space.options.planets === false) return
      ctx.save()
      for (const planet of space.planets) {
        // Движение и разделение живут в updatePlanets: здесь только картинка.
        planet.spinAngle += planet.spin * step
        const x = planet.x
        const y = planet.y
        const radius = planet.radius
        const lx = Math.cos(planet.lightAngle)
        const ly = Math.sin(planet.lightAngle)

        // Дальние спутники идут за диском: иначе они проплывали бы поверх.
        drawOrbiters(ctx, planet, x, y, false)
        drawOrbitTracks(ctx, planet, x, y)
        if (planet.ring) drawRing(ctx, planet, x, y, radius, 'back')

        // Тонкий ободок атмосферы со стороны света.
        const halo = ctx.createRadialGradient(x, y, radius * 0.9, x, y, radius * 1.3)
        halo.addColorStop(0, `hsla(${planet.hue}, 80%, 72%, ${planet.alpha * 0.42})`)
        halo.addColorStop(1, 'hsla(0, 0%, 0%, 0)')
        ctx.fillStyle = halo
        ctx.beginPath()
        ctx.arc(x, y, radius * 1.3, 0, TAU)
        ctx.fill()

        ctx.save()
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, TAU)
        ctx.clip()

        // Светотень. Слой рисуется с mix-blend-mode: screen, поэтому «тьма» —
        // это незакрашенная область: гасим градиентом в прозрачный, а не чёрный.
        const body = ctx.createLinearGradient(
          x + lx * radius * 1.15,
          y + ly * radius * 1.15,
          x - lx * radius * 1.2,
          y - ly * radius * 1.2,
        )
        body.addColorStop(0, `hsla(${planet.hue}, 90%, 82%, ${clamp(planet.alpha * 2.1, 0, 1)})`)
        body.addColorStop(0.34, `hsla(${planet.hue}, 74%, 64%, ${planet.alpha * 1.1})`)
        body.addColorStop(0.6, `hsla(${planet.hue}, 62%, 50%, ${planet.alpha * 0.3})`)
        body.addColorStop(0.78, `hsla(${planet.hue}, 60%, 44%, ${planet.alpha * 0.05})`)
        body.addColorStop(1, 'hsla(0, 0%, 0%, 0)')
        ctx.fillStyle = body
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)

        // Рельеф: у газовых гигантов — полосы, у каменных и ледяных — пятна.
        // Полосы параллельны экватору и не поворачиваются вместе с диском: их
        // вращение читается по бегущим бликам вдоль экватора. Пятна лежат на
        // поверхности, поэтому вращаются вместе с осью.
        if (planet.kind === 'gas') {
          for (const band of planet.bands) {
            ctx.fillStyle = `hsla(${band.hue}, 80%, 72%, ${planet.alpha * band.alpha})`
            ctx.beginPath()
            ctx.ellipse(
              x,
              y + band.offset * radius,
              radius * 1.02,
              radius * band.height * band.weight,
              0,
              0,
              TAU,
            )
            ctx.fill()
            // Блик, обегающий полосу: смещение по синусу даёт равномерный
            // обход диска, а у краёв блик гаснет — как на настоящем шаре.
            const travel = Math.sin(planet.spinAngle + band.offset * 4)
            const streakX = x + travel * radius * 0.62
            const edge = Math.abs(travel)
            const fade = (1 - edge * edge) * 0.5
            ctx.fillStyle = `hsla(${band.hue + 18}, 90%, 88%, ${planet.alpha * band.alpha * fade})`
            ctx.beginPath()
            ctx.ellipse(
              streakX,
              y + band.offset * radius,
              radius * 0.34 * (0.4 + 0.6 * (1 - edge)),
              radius * band.height * 0.7,
              0,
              0,
              TAU,
            )
            ctx.fill()
          }
        } else {
          ctx.save()
          ctx.translate(x, y)
          ctx.rotate(planet.spinAngle)
          // Сначала тёмные моря: они лежат под поверхностью и дают масштаб,
          // поэтому рисуются до пятен, иначе пятна тонут в их пятне.
          for (const sea of planet.seas) {
            ctx.fillStyle = `hsla(${sea.hue}, 45%, 30%, ${planet.alpha * sea.alpha})`
            ctx.beginPath()
            ctx.ellipse(
              sea.x * radius,
              sea.y * radius,
              radius * sea.r,
              radius * sea.r * sea.squash,
              0,
              0,
              TAU,
            )
            ctx.fill()
          }
          for (const spot of planet.spots) {
            ctx.fillStyle = `hsla(${spot.hue}, 70%, 82%, ${planet.alpha * spot.alpha})`
            ctx.beginPath()
            ctx.ellipse(
              spot.x * radius,
              spot.y * radius,
              radius * spot.r,
              radius * spot.r * spot.squash,
              0,
              0,
              TAU,
            )
            ctx.fill()
          }
          // Огни городов видны только там, где ночь. Направление на свет в
          // повёрнутой системе координат — это угол освещения минус угол
          // собственного вращения, иначе маска ехала бы вместе с планетой.
          const lightLocal = planet.lightAngle - planet.spinAngle
          const lightX = Math.cos(lightLocal)
          const lightY = Math.sin(lightLocal)
          ctx.save()
          ctx.globalCompositeOperation = 'lighter'
          for (const city of planet.cities) {
            // Проекция на направление света: минус — глубокая ночь.
            const toward = city.x * lightX + city.y * lightY
            const night = clamp(-toward * 2.4, 0, 1)
            if (night <= 0.03) continue
            // У самого края диска город сжимается и бледнеет: сферическое
            // искажение, без него точки вылезали бы за силуэт планеты.
            const edge = Math.sqrt(Math.max(0, 1 - city.x * city.x - city.y * city.y))
            // Итоговая альфа усилена: на тёмной стороне иначе огни тонули в
            // градиенте тени, и диск выглядел пустым.
            const alpha = clamp(
              planet.alpha * city.alpha * night * Math.min(1, edge * 3) * 2.6,
              0,
              1,
            )
            if (alpha <= 0.01) continue
            ctx.fillStyle = `hsla(${city.hue}, 92%, 72%, ${alpha})`
            ctx.beginPath()
            ctx.ellipse(
              city.x * radius,
              city.y * radius,
              radius * city.r * (0.35 + 0.65 * edge),
              radius * city.r * 0.75 * (0.35 + 0.65 * edge),
              0,
              0,
              TAU,
            )
            ctx.fill()
          }
          ctx.restore()
          ctx.restore()
        }
        ctx.restore()

        // Лимб: тонкая светящаяся дуга там, где диск ловит свет.
        // Силуэт: тонкая окружность по всему диску задаёт резкий контур,
        // дуга по освещённому краю — блик лимба.
        ctx.strokeStyle = `hsla(${planet.hue}, 70%, 70%, ${planet.alpha * 0.3})`
        ctx.lineWidth = Math.max(0.5, radius * 0.01)
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, TAU)
        ctx.stroke()

        const lit = Math.atan2(ly, lx)
        ctx.strokeStyle = `hsla(${planet.hue}, 96%, 90%, ${planet.alpha * 1.5})`
        ctx.lineWidth = Math.max(0.6, radius * 0.022)
        ctx.beginPath()
        ctx.arc(x, y, radius * 0.985, lit - 1.05, lit + 1.05)
        ctx.stroke()
        ctx.strokeStyle = `hsla(${planet.hue + 12}, 100%, 94%, ${planet.alpha * 0.8})`
        ctx.lineWidth = Math.max(0.5, radius * 0.009)
        ctx.beginPath()
        ctx.arc(x, y, radius * 0.985, lit - 0.35, lit + 0.35)
        ctx.stroke()

        if (planet.ring) drawRing(ctx, planet, x, y, radius, 'front')
        // Ближние спутники идут после диска — эта половина орбиты впереди.
        drawOrbiters(ctx, planet, x, y, true)
      }
      ctx.restore()
    }

    // Корабли живут по-настоящему: их положение интегрируется по кадрам,
    // поэтому у них есть и шлейф, и запас энергии на поворот. Держатся мелкими
    // и неспешными — это дальний план, а не перехват внимания.
    function createShips() {
      const count = 3 + Math.floor(Math.random() * 2)
      return Array.from({ length: count }, () => {
        const depth = rand(0.25, 1)
        const heading = Math.random() * TAU
        const speed = 2.2 + depth * 14
        return {
          x: Math.random(),
          y: rand(0.1, 0.9),
          depth,
          size: 3 + depth * 10,
          speed,
          vx: Math.cos(heading) * speed,
          vy: Math.sin(heading) * speed,
          heading,
          targetHeading: heading,
          energy: rand(0.3, 1),
          cooldown: rand(0.4, 2.4),
          navPhase: Math.random() * TAU,
          navRate: rand(0.6, 1.6),
          throttle: 1,
          bank: 0,
          turning: false,
          trail: [],
        }
      })
    }

    // Положение корабля с лёгким покачиванием: физика считается в x/y, а рисуется
    // он с небольшим боковым смещением, поэтому шлейф и корпус остаются едиными.
    function shipPoint(ship, width, height) {
      return {
        x: ship.x * width,
        y: ship.y * height + Math.sin(space.time * 0.35 + ship.navPhase) * 2.5 * ship.depth,
      }
    }

    // Инерция корабля. Раньше вектор скорости пересчитывался из курса каждый
    // кадр (`vx = cos(heading) * speed`), то есть скорость всегда совпадала с
    // курсом и корабль менял направление мгновенно. Теперь скорость — это
    // состояние: она поворачивается с ограничением по углу, её модуль тянется
    // к тяге с ограничением по ускорению, и на вираже тяга проседает.
    const SHIP_ACCEL = 24
    const SHIP_TURN = 0.55

    function updateShips(dt, width, height) {
      for (const ship of space.ships) {
        // Энергия восстанавливается сама и тратится на смену курса.
        ship.energy = Math.min(1, ship.energy + 0.16 * dt)
        ship.cooldown -= dt
        if (ship.cooldown <= 0 && ship.energy > 0.45) {
          // Меняется замысел, а не траектория: корпус догонит его сам.
          ship.targetHeading += rand(-0.8, 0.8)
          ship.energy -= 0.45
          ship.cooldown = rand(1.8, 4)
        }

        // Куда корабль летит СЕЙЧАС, а не куда собирается.
        const current = Math.hypot(ship.vx, ship.vy)
        const currentAngle = current > 0.0001 ? Math.atan2(ship.vy, ship.vx) : ship.heading
        const difference = ((ship.targetHeading - currentAngle + Math.PI * 3) % TAU) - Math.PI
        ship.turning = Math.abs(difference) > 0.02

        // Поворот ограничен по углу: чем больше энергии, тем маневреннее корабль.
        // Ограничение и есть инерция — резко сменить направление он не может.
        const maxTurn = (SHIP_TURN * (0.5 + 0.5 * ship.energy)) * dt
        const applied = clamp(difference, -maxTurn, maxTurn)
        const nextAngle = currentAngle + applied

        // Тяга дышит сама и сбавляется на вираже — так движение выглядит живым.
        const wanted = ship.turning ? 0.66 : 0.9 + 0.16 * Math.sin(space.time * 0.6 + ship.navPhase)
        ship.throttle = lerp(ship.throttle, wanted, 1 - Math.pow(0.25, dt))
        // Модуль скорости не прыгает: он разгоняется и тормозит с ускорением.
        const target = ship.speed * ship.throttle
        const nextSpeed = current + clamp(target - current, -SHIP_ACCEL * dt, SHIP_ACCEL * dt)

        ship.vx = Math.cos(nextAngle) * nextSpeed
        ship.vy = Math.sin(nextAngle) * nextSpeed
        // Нос смотрит туда, куда корабль реально летит, и потому на вираже
        // отстаёт от замысла — инерция видна глазом, без разрывов пути.
        ship.heading = nextAngle
        // Крен следует за фактической скоростью поворота и сглаживается.
        const rate = applied / Math.max(dt, 0.001)
        ship.bank = lerp(ship.bank, clamp(rate * 0.55, -0.6, 0.6), 1 - Math.pow(0.08, dt))

        ship.x += (ship.vx * dt) / width
        ship.y += (ship.vy * dt) / height
        if (ship.x < -0.15 || ship.x > 1.15 || ship.y < -0.15 || ship.y > 1.15) {
          // Улетел за край — возвращается с противоположной стороны, шлейф чистый.
          ship.x = ((ship.x % 1.2) + 1.2) % 1.2 - 0.1
          ship.y = rand(0.1, 0.9)
          ship.trail.length = 0
        }

        const point = shipPoint(ship, width, height)
        const last = ship.trail[ship.trail.length - 1]
        if (last === undefined || Math.hypot(point.x - last.x, point.y - last.y) > Math.max(4, ship.size * 0.7)) {
          ship.trail.push(point)
          if (ship.trail.length > 34) ship.trail.shift()
        }
      }
    }

    function drawShips(ctx, width, height) {
      if (space.options.ships === false) return

      // Шлейфы рисуем первыми, поверх «screen»-смешивания они дают мягкий след.
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.lineCap = 'round'
      for (const ship of space.ships) {
        const trail = ship.trail
        for (let index = 1; index < trail.length; index += 1) {
          const from = trail[index - 1]
          const to = trail[index]
          const share = index / trail.length
          ctx.strokeStyle = `rgba(140, 190, 255, ${(0.2 * share * ship.depth).toFixed(3)})`
          ctx.lineWidth = Math.max(0.4, ship.size * 0.55 * share)
          ctx.beginPath()
          ctx.moveTo(from.x, from.y)
          ctx.lineTo(to.x, to.y)
          ctx.stroke()
        }
      }
      ctx.restore()

      for (const ship of space.ships) {
        const point = shipPoint(ship, width, height)
        const size = ship.size
        const alpha = 0.16 + ship.depth * 0.22
        // Крен подмешивается в поворот корпуса: на вираже корабль слегка «ложится».
        const bank = ship.bank * 0.22

        ctx.save()
        ctx.translate(point.x, point.y)
        ctx.rotate(ship.heading + bank)
        ctx.scale(ship.depth, ship.depth * (1 - Math.abs(ship.bank) * 0.18))

        // След двигателя тянется назад по курсу и дышит вместе с тягой.
        const plume = size * (1.1 + ship.throttle * 0.5)
        const thrust = ctx.createRadialGradient(-size * 0.8, 0, 0, -size * 0.8, 0, plume)
        thrust.addColorStop(0, `rgba(170, 210, 255, ${alpha * 0.85 * ship.throttle})`)
        thrust.addColorStop(0.4, `rgba(120, 175, 255, ${alpha * 0.3 * ship.throttle})`)
        thrust.addColorStop(1, 'rgba(80, 140, 255, 0)')
        ctx.fillStyle = thrust
        ctx.beginPath()
        ctx.ellipse(-size * 0.85, 0, plume * 0.9, plume * 0.34, 0, 0, TAU)
        ctx.fill()

        // Корпус: узкий фюзеляж, стреловидные крылья, два двигателя в хвосте.
        ctx.fillStyle = `rgba(206, 220, 244, ${alpha})`
        ctx.beginPath()
        ctx.moveTo(size, 0)
        ctx.lineTo(size * 0.18, -size * 0.15)
        ctx.lineTo(-size * 0.42, -size * 0.5)
        ctx.lineTo(-size * 0.6, -size * 0.2)
        ctx.lineTo(-size * 0.78, -size * 0.1)
        ctx.lineTo(-size * 0.78, size * 0.1)
        ctx.lineTo(-size * 0.6, size * 0.2)
        ctx.lineTo(-size * 0.42, size * 0.5)
        ctx.lineTo(size * 0.18, size * 0.15)
        ctx.closePath()
        ctx.fill()

        // Кокпит — слабая искра у носа.
        ctx.fillStyle = `rgba(190, 225, 255, ${alpha * 0.7})`
        ctx.beginPath()
        ctx.ellipse(size * 0.42, 0, size * 0.16, size * 0.07, 0, 0, TAU)
        ctx.fill()

        // Двигатели: две точки выхлопа в хвосте.
        ctx.fillStyle = `rgba(230, 240, 255, ${alpha * ship.throttle})`
        for (const side of [-1, 1]) {
          ctx.beginPath()
          ctx.arc(-size * 0.8, side * size * 0.12, Math.max(0.5, size * 0.08), 0, TAU)
          ctx.fill()
        }

        const blink = 0.5 + 0.5 * Math.sin(space.time * ship.navRate * 2 + ship.navPhase)
        ctx.fillStyle = `rgba(255, 120, 110, ${alpha * blink})`
        ctx.beginPath()
        ctx.arc(size * 0.55, -size * 0.1, Math.max(0.5, size * 0.06), 0, TAU)
        ctx.fill()

        // Дуга запаса энергии: видна, только когда корабль реально поворачивает.
        if (ship.turning && ship.energy > 0.05) {
          ctx.strokeStyle = `rgba(255, 214, 140, ${(0.16 * ship.energy * ship.depth).toFixed(3)})`
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.arc(0, 0, size * 1.8, -Math.PI / 2, -Math.PI / 2 + TAU * ship.energy)
          ctx.stroke()
        }

        ctx.restore()
      }
    }

    // Хвост рисуется по варианту кометы: пылевой широкий и тусклый, ионовый
    // узкий и резкий, плазменный двуцветный с коротким противотоком. Все три
    // работают через один и тот же вектор скорости, поэтому комета всегда
    // «смотрит» туда, куда летит.
    function drawCometTail(ctx, comet, headX, headY, tailX, tailY) {
      if (comet.variant === 'dust') {
        const tail = ctx.createLinearGradient(tailX, tailY, headX, headY)
        tail.addColorStop(0, 'rgba(120, 190, 255, 0)')
        tail.addColorStop(0.7, `rgba(150, 205, 255, ${comet.alpha * 0.22})`)
        tail.addColorStop(1, `rgba(230, 245, 255, ${comet.alpha * 0.5})`)
        ctx.strokeStyle = tail
        ctx.lineWidth = comet.lineWidth * 1.6
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(tailX, tailY)
        ctx.lineTo(headX, headY)
        ctx.stroke()
        return
      }

      if (comet.variant === 'ion') {
        // Два луча слегка расходятся: раствор хвоста на кончике уже головы.
        const half = comet.length * 0.04
        for (const skew of [-1, 1]) {
          const tipX = tailX - (headY - tailY) * half * skew * 0.02
          const tipY = tailY + (headX - tailX) * half * skew * 0.02
          const tail = ctx.createLinearGradient(tipX, tipY, headX, headY)
          tail.addColorStop(0, 'rgba(90, 150, 255, 0)')
          tail.addColorStop(0.6, `rgba(130, 190, 255, ${comet.alpha * 0.42})`)
          tail.addColorStop(1, 'rgba(245, 252, 255, 0.9)')
          ctx.strokeStyle = tail
          ctx.lineWidth = comet.lineWidth * 0.7
          ctx.lineCap = 'round'
          ctx.beginPath()
          ctx.moveTo(tipX, tipY)
          ctx.lineTo(headX, headY)
          ctx.stroke()
        }
        return
      }

      // plasma: широкий тёплый след позади и узкий холодный впереди.
      const warm = ctx.createLinearGradient(tailX, tailY, headX, headY)
      warm.addColorStop(0, 'rgba(255, 150, 90, 0)')
      warm.addColorStop(0.65, `rgba(255, 186, 120, ${comet.alpha * 0.3})`)
      warm.addColorStop(1, `rgba(255, 236, 210, ${comet.alpha * 0.55})`)
      ctx.strokeStyle = warm
      ctx.lineWidth = comet.lineWidth * 1.35
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(tailX, tailY)
      ctx.lineTo(headX, headY)
      ctx.stroke()

      // Противоток: короткий выброс по другую сторону головы.
      const antiX = headX + (headX - tailX) * 0.12
      const antiY = headY + (headY - tailY) * 0.12
      const anti = ctx.createLinearGradient(headX, headY, antiX, antiY)
      anti.addColorStop(0, `rgba(190, 225, 255, ${comet.alpha * 0.4})`)
      anti.addColorStop(1, 'rgba(190, 225, 255, 0)')
      ctx.strokeStyle = anti
      ctx.lineWidth = comet.lineWidth * 0.8
      ctx.beginPath()
      ctx.moveTo(headX, headY)
      ctx.lineTo(antiX, antiY)
      ctx.stroke()
    }

    function drawComets(ctx, width, height, dt) {
      if (space.options.comets === false) return
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      for (const comet of space.comets) {
        comet.x += (comet.vx * dt) / width
        comet.y += (comet.vy * dt) / height
        comet.wobble += dt * 0.6
        if (comet.x < -0.25 || comet.x > 1.25 || comet.y < -0.3 || comet.y > 1.3) {
          comet.x = Math.random()
          comet.y = rand(0.1, 0.7)
          const spec = COMET_CLASSES[comet.className]
          comet.vx = rand(9, 20) * spec.speed * (Math.random() < 0.5 ? -1 : 1)
          comet.vy = rand(2, 7) * spec.speed
        }

        const headX = comet.x * width
        const headY = comet.y * height + Math.sin(comet.wobble) * 6
        const speed = Math.hypot(comet.vx, comet.vy) || 1
        const tailX = headX - (comet.vx / speed) * comet.length
        const tailY = headY - (comet.vy / speed) * comet.length

        drawCometTail(ctx, comet, headX, headY, tailX, tailY)

        // Комa — ореол вокруг ядра, радиус зависит от класса.
        const coma = 22 * comet.head
        const glow = ctx.createRadialGradient(headX, headY, 0, headX, headY, coma)
        glow.addColorStop(0, `rgba(240, 250, 255, ${comet.alpha})`)
        glow.addColorStop(0.35, `rgba(160, 210, 255, ${comet.alpha * 0.5})`)
        glow.addColorStop(1, 'rgba(120, 180, 255, 0)')
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(headX, headY, coma, 0, TAU)
        ctx.fill()

        // Ядро: маленькая плотная точка, чтобы комета не выглядела каплей.
        ctx.fillStyle = `rgba(255, 255, 255, ${clamp(comet.alpha * 1.2, 0, 1)})`
        ctx.beginPath()
        ctx.arc(headX, headY, Math.max(0.6, 1.5 * comet.head), 0, TAU)
        ctx.fill()
      }
      ctx.restore()
    }

    function drawMeteors(ctx, width, dt) {
      if (space.options.comets === false) return
      space.meteorTimer -= dt
      if (space.meteorTimer <= 0) {
        space.meteorTimer = rand(2.5, 9)
        const angle = rand(0.1, 0.5) * (Math.random() < 0.5 ? 1 : -1)
        const speed = rand(700, 1300)
        space.meteors.push({
          x: Math.random() * width,
          y: -20,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: rand(0.45, 0.9),
          duration: 0.9,
        })
      }
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      for (const meteor of space.meteors) {
        meteor.life -= dt
        meteor.x += meteor.vx * dt
        meteor.y += meteor.vy * dt
        const share = clamp(meteor.life / meteor.duration, 0, 1)
        const trailX = meteor.x - meteor.vx * 0.12
        const trailY = meteor.y - meteor.vy * 0.12
        const trail = ctx.createLinearGradient(trailX, trailY, meteor.x, meteor.y)
        trail.addColorStop(0, 'rgba(255, 220, 170, 0)')
        trail.addColorStop(1, `rgba(255, 236, 200, ${0.75 * share})`)
        ctx.strokeStyle = trail
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.moveTo(trailX, trailY)
        ctx.lineTo(meteor.x, meteor.y)
        ctx.stroke()
      }
      space.meteors = space.meteors.filter((meteor) => meteor.life > 0)
      ctx.restore()
    }

    // ── отклик на работу агента ───────────────────────────────────────────
    // Состояние приходит с хоста: клиент не знает текущую сессию и угадать
    // её не может. Порядок проверок важен — ошибка важнее генерации.
    const SESSION_POLL_MS = 1000
    const STATE_PATH = '/api/dsh-poslanik-deep-space.state'

    function modeFromSnapshot(snapshot) {
      if (snapshot.error !== null && snapshot.error !== undefined) return 'error'
      if (snapshot.running === true) return 'running'
      return 'awaiting'
    }

    // Сводит список сессий в одно состояние сцены: генерация важнее покоя,
    // ошибка важнее генерации, а завершившийся ход замечен по счётчику.
    function stateFromPayload(payload, previous) {
      const list = Array.isArray(payload?.sessions) ? payload.sessions : []
      const busy = list.filter((entry) => entry.running === true)
      const failed = list.filter((entry) => entry.error !== null && entry.error !== undefined)
      const reference = failed[0] ?? busy[0] ?? list[0]
      const settled = typeof payload?.settled === 'number' ? payload.settled : 0
      return {
        mode: reference === undefined ? 'awaiting' : modeFromSnapshot(reference),
        settled,
        // Рост счётчика означает, что ход только что закончился.
        settledUp: previous !== undefined && settled > previous.settled,
        busy: busy.length,
        failed: failed.length,
      }
    }

    function applyReaction(reaction, state) {
      if (reaction === 'done') state.burst = 1
      if (reaction === 'error') state.error = 1
      return state
    }

    function bindSessionState(ctx) {
      state.sessionId = null
      state.failures = 0
      // Маршрут свой собственный, а не вызов общего канала: канал /api
      // принадлежит dsh-api-gateway и перехватчик у него один. Ходить по
      // своему пути безопаснее, чем претендовать на чужой.
      const request = () => window.fetch(STATE_PATH, { method: 'GET' }).then((response) => {
        if (!response.ok) throw new Error(`состояние недоступно: ${response.status}`)
        return response.json()
      })
      let stopped = false
      const timer = window.setInterval(() => {
        if (stopped || space.options.session === false) return
        // Отвечает не сразу и может умереть вместе с соединением, поэтому
        // любая ошибка — тихий отказ: тема продолжает рисоваться как раньше.
        request()
          .then((payload) => {
            if (stopped) return
            const next = stateFromPayload(payload, state)
            if (next.settledUp && next.mode !== 'running') applyReaction('done', state)
            if (next.mode === 'error') applyReaction('error', state)
            state.mode = next.mode
            state.busy = next.busy
            state.failed = next.failed
            state.settled = next.settled
            state.connected = true
          })
          .catch(() => {
            state.failures += 1
            state.connected = false
          })
      }, SESSION_POLL_MS)
      return () => {
        stopped = true
        window.clearInterval(timer)
      }
    }

    // Состояние сцены живёт отдельно от настроек: его пишет мост с хоста.
    const state = {
      mode: 'awaiting',
      settled: 0,
      busy: 0,
      failed: 0,
      connected: false,
      failures: 0,
      reason: null,
      sessionId: null,
      burst: 0,
      error: 0,
    }

    // Двойная звезда при генерации. Якорь выводится из зерна, а не из
    // Math.random, иначе звезда прыгала бы при каждом populate.
    function createDoubleStar(seed) {
      const at = (step) => ((seed * 9301 + step * 49297) % 233280) / 233280
      return {
        anchorX: 0.18 + at(1) * 0.64,
        anchorY: 0.16 + at(2) * 0.3,
        phase: at(3) * TAU,
        orbit: 0.4 + at(4) * 0.3,
        // Звёзды разного цвета: пара читается как система, а не как две точки.
        warm: 30 + Math.floor(at(5) * 20),
        cool: 200 + Math.floor(at(6) * 30),
      }
    }

    function updateReactions(dt) {
      // Вспышки гаснут сами: иначе красная вспышка у дыры не отпустила бы.
      state.burst = Math.max(0, state.burst - dt * 0.7)
      state.error = Math.max(0, state.error - dt * 0.5)
    }

    function drawDoubleStar(ctx) {
      if (state.mode !== 'running') return
      const star = space.doubleStar
      const x = star.anchorX * space.width
      const y = star.anchorY * space.height
      // Одна звезда даёт опорный свет, вторая обращается вокруг неё.
      const breath = 0.5 + 0.5 * Math.sin(space.time * 2.1 + star.phase)
      const spin = space.time * star.orbit + star.phase
      const partnerX = x + Math.cos(spin) * 26
      const partnerY = y + Math.sin(spin) * 10
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      const glowAt = (cx, cy, radius, hue, alpha) => {
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
        glow.addColorStop(0, `hsla(${hue}, 90%, 88%, ${alpha})`)
        glow.addColorStop(0.4, `hsla(${hue}, 90%, 70%, ${alpha * 0.45})`)
        glow.addColorStop(1, `hsla(${hue}, 90%, 60%, 0)`)
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, TAU)
        ctx.fill()
      }
      const base = 0.35 + breath * 0.35
      glowAt(x, y, 34 + breath * 10, star.warm, base)
      glowAt(partnerX, partnerY, 20 + breath * 7, star.cool, base * 0.8)
      ctx.restore()
    }

    // Вспышка по завершении хода: расходящееся кольцо светящейся пыли.
    function drawDust(ctx) {
      if (state.burst <= 0) return
      const x = space.width * 0.5
      const y = space.height * 0.42
      const life = 1 - state.burst
      const radius = 40 + life * Math.max(space.width, space.height) * 0.28
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.strokeStyle = `rgba(190, 220, 255, ${clamp(state.burst * 0.5, 0, 1)})`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, TAU)
      ctx.stroke()
      // Частицы по кольцу: точка за точкой расходятся от вспышки.
      for (let index = 0; index < 18; index += 1) {
        const angle = (index / 18) * TAU + space.doubleStar.phase
        const drift = radius + (index % 3) * 14
        const px = x + Math.cos(angle) * drift
        const py = y + Math.sin(angle) * drift * 0.7
        ctx.fillStyle = `rgba(214, 234, 255, ${clamp(state.burst * 0.7, 0, 1)})`
        ctx.beginPath()
        ctx.arc(px, py, 1.6, 0, TAU)
        ctx.fill()
      }
      ctx.restore()
    }

    function drawField(ctx) {
      if (space.options.perturbation === false) return
      const field = space.field
      if (field.energy <= 0 && field.rings.length === 0) return
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      if (field.energy > 0) {
        const radius = field.radius
        const glow = ctx.createRadialGradient(field.x, field.y, 0, field.x, field.y, radius)
        glow.addColorStop(0, `rgba(120, 180, 255, ${clamp(field.energy * 0.03, 0, 0.035)})`)
        glow.addColorStop(0.4, `rgba(90, 140, 255, ${clamp(field.energy * 0.012, 0, 0.018)})`)
        glow.addColorStop(1, 'rgba(60, 110, 255, 0)')
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(field.x, field.y, radius, 0, TAU)
        ctx.fill()

        ctx.strokeStyle = `rgba(140, 190, 255, ${clamp(field.energy * 0.05, 0, 0.06)})`
        ctx.lineWidth = 1
        for (let index = 0; index < 2; index += 1) {
          const ringRadius = radius * (0.4 + index * 0.26)
          ctx.beginPath()
          ctx.arc(field.x, field.y, ringRadius, field.energy * 2 + index, field.energy * 2 + index + Math.PI * 1.1)
          ctx.stroke()
        }

        ctx.fillStyle = `rgba(220, 238, 255, ${clamp(field.energy * 0.12, 0, 0.14)})`
        ctx.beginPath()
        ctx.arc(field.x, field.y, 1.2 + field.energy * 1.2, 0, TAU)
        ctx.fill()
      }
      for (const ring of field.rings) {
        const share = 1 - ring.age / ring.life
        ctx.strokeStyle = `rgba(150, 200, 255, ${clamp(share * 0.05, 0, 0.06)})`
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.arc(field.x, field.y, field.radius * (0.5 + (1 - share) * 1.5), 0, TAU)
        ctx.stroke()
      }
      ctx.restore()
    }

    // ── движок ─────────────────────────────────────────────────────────────
    const space = {
      canvas: null,
      context: null,
      width: 0,
      height: 0,
      time: 0,
      lastFrame: 0,
      running: false,
      frame: 0,
      drawn: false,
      reducedMotion: false,
      // Отсчёт рассвета: сцена стартует на пике, затем свет гаснет за ~8с.
      dawn: 0,
      dawnSince: 0,
      doubleStar: createDoubleStar(7),
      // Потолок кадров: frameInterval — минимальный интервал между
      // отрисованными кадрами, 0 значит «каждый кадр монитора».
      accumulator: 0,
      frameInterval: frameIntervalFrom(DEFAULT_FPS),
      options: normalizeSettings(),
      nebulae: [],
      // Кэш фона: три полосы параллакса. Пересобираются только при смене
      // размера, dpr или режима звёзд, в кадре с них берутся три блита.
      bands: { far: createBand(), mid: createBand(), near: createBand() },
      bandsSignature: null,
      bandsStars: true,
      stars: [],
      planets: [],
      ships: [],
      comets: [],
      meteors: [],
      meteorTimer: 2,
      field: createField(),

      resize() {
        if (this.canvas === null) return
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        // Размер берём у самого слоя: окно на старте может быть ещё не готово.
        const rect = this.layer?.getBoundingClientRect()
        this.width = Math.max(1, Math.round(rect?.width ?? window.innerWidth))
        this.height = Math.max(1, Math.round(rect?.height ?? window.innerHeight))
        this.canvas.width = Math.round(this.width * dpr)
        this.canvas.height = Math.round(this.height * dpr)
        this.canvas.style.width = `${this.width}px`
        this.canvas.style.height = `${this.height}px`
        this.context.setTransform(dpr, 0, 0, dpr, 0, 0)
        this.stars = createStars(this.width, this.height)
        this.constellations = createConstellationLayer(this.width, this.height)
        renderBands()
      },

      populate() {
        this.nebulae = createNebulae()
        this.planets = createPlanets(this.width, this.height)
        // Стартовое разнесение: на первом кадре гравитация ещё ничего не
        // успела развести, поэтому наезд исключается заранее.
        placePlanets(this.planets, this.width, this.height)
        this.dwarfs = createDwarfs()
        this.suns = createSuns()
        this.blackHoles = createBlackHoles()
        this.ships = createShips()
        this.comets = createComets()
        this.meteors = []
        this.meteorTimer = rand(1.5, 4)
        // Туманности только что пересобраны — кэш полос устарел, перерисовываем.
        this.bandsSignature = null
        renderBands()
      },

      render(dt) {
        if (this.context === null) return
        // Потолок кадров: копим время и пропускаем кадр целиком, а не часть
        // слоёв, — иначе на 15 кадрах в секунду картина мерцала бы наполовину.
        //
        // Важно: и время сцены, и интегрирование движений идут по
        // НАКОПЛЕННОМУ шагу. Иначе при потолке 30 на 60-герцевом экране слои,
        // считающие по space.time, спешили бы вдвое, а корабли, кометы и метеоры,
        // считающие по dt, наоборот, ползли бы вдвое медленнее.
        let step = dt
        if (this.frameInterval > 0) {
          this.accumulator += dt
          if (this.accumulator < this.frameInterval) return
          step = this.accumulator
          this.accumulator -= this.frameInterval
        }
        this.time += step
        updateField(this.field, step)
        const ctx = this.context
        // Слой мог получить размер позже, чем первый кадр: ловим это здесь.
        if (this.layer !== undefined && this.layer !== null && this.width > 0) {
          const rect = this.layer.getBoundingClientRect()
          if (rect.width > 0 && Math.abs(rect.width - this.width) > 2) this.resize()
        }
        if (!this.drawn) {
          this.drawn = true
          trace('первый кадр отрисован', `качественная=${this.reducedMotion} прозрачность=${this.options.enabled}`)
        }
        ctx.clearRect(0, 0, this.width, this.height)
        // Тусклые звёзды рисуются ДО полос: газ над ними и есть дымка, которая
        // их приглушает. Яркие идут после и свет сквозь газ пробивается.
        drawStars(ctx, this.width, this.time, 'dim')
        // Фон и туманности больше не строятся в кадре: три блита из кэша
        // полос вместо семи полноэкранных заливок. Прямой путь остаётся
        // только на случай, когда кэш ещё не собран.
        if (this.bandsSignature === null) {
          drawBackground(ctx, this.width, this.height, this.time)
        } else {
          const width = this.width
          const height = this.height
          const period = Math.max(1, BAND_PERIOD * width)
          ctx.drawImage(space.bands.far.canvas, bandShift(this.time, BAND_DRIFT.far, period), 0, width, height)
          // Средняя и ближняя полосы сложены поверх дальней аддитивно, как их
          // рисовали с lighter по кадру.
          ctx.globalCompositeOperation = 'lighter'
          ctx.drawImage(space.bands.mid.canvas, bandShift(this.time, BAND_DRIFT.mid, period), 0, width, height)
          ctx.drawImage(space.bands.near.canvas, bandShift(this.time, BAND_DRIFT.near, period), 0, width, height)
          ctx.globalCompositeOperation = 'source-over'
        }
        drawStars(ctx, this.width, this.time, 'bright')
        // Созвездия идут вместе со звёздами: яркие точки и тусклые линии между
        // ними — одна картинка, а не два наложенных слоя.
        drawConstellations(ctx, this.width, this.time)
        // Атмосфера ложится поверх газа, но под звёздами: это дымка неба, а не
        // вуаль поверх сцены. Подъём при первом содержательном ходе — рассвет.
        if (this.dawn === undefined) this.dawn = 0
        if (this.time - this.dawnSince < 0.0001) this.dawnSince = this.time
        this.dawn = this.time - this.dawnSince
        drawAtmosphere(ctx, this.width, this.height)
        // Линзы идут до дисков: кольцо Эйнштейна огибает горизонт событий
        // и не должно ложиться поверх аккреционного диска.
        drawLensing(ctx)
        drawDwarfs(ctx, this.width, this.height)
        drawSuns(ctx, this.width, this.height)
        drawBlackHoles(ctx, this.width, this.height)
        if (this.options.planets !== false) updatePlanets(step, this.width, this.height)
        drawPlanets(ctx, this.width, this.height, step)
        drawComets(ctx, this.width, this.height, step)
        drawMeteors(ctx, this.width, step)
        if (this.options.ships !== false) updateShips(step, this.width, this.height)
        drawShips(ctx, this.width, this.height)
        updateReactions(step)
        drawDoubleStar(ctx)
        drawDust(ctx)
        drawField(ctx)
      },

      start() {
        if (this.running || this.canvas === null) return
        this.running = true
        this.lastFrame = performance.now()
        if (this.reducedMotion) {
          this.render(0.016)
          return
        }
        const tick = (timestamp) => {
          const dt = clamp((timestamp - this.lastFrame) / 1000, 0, 0.05)
          this.lastFrame = timestamp
          this.render(dt)
          this.frame = window.requestAnimationFrame(tick)
        }
        this.frame = window.requestAnimationFrame(tick)
      },

      stop() {
        if (!this.running) return
        this.running = false
        window.cancelAnimationFrame(this.frame)
      },
    }

    // ── установка темы ─────────────────────────────────────────────────────
    function installStyle() {
      const existing = document.querySelector(STYLE_SELECTOR)
      if (existing !== null) return existing
      const style = document.createElement('style')
      style.dataset.plugin = PLUGIN_ID
      style.dataset.pluginCss = `${PLUGIN_ID}/theme.css`
      style.textContent = THEME_CSS
      document.head.append(style)
      return style
    }

    function installTokens() {
      const targets = [document.documentElement, document.body]
      const previous = new Map()
      const applyTokens = () => {
        for (const target of targets) {
          for (const [name, value] of Object.entries(TOKENS)) {
            const key = `${target === document.body ? 'body' : 'root'}:${name}`
            if (!previous.has(key)) {
              previous.set(key, {
                target,
                name,
                value: target.style.getPropertyValue(name),
                priority: target.style.getPropertyPriority(name),
              })
            }
            target.style.setProperty(name, value)
          }
        }
      }
      applyTokens()
      return {
        restore: () => {
          for (const item of previous.values()) item.target.style.setProperty(item.name, item.value, item.priority)
        },
      }
    }

    function installLayer() {
      const layer = document.createElement('div')
      layer.className = LAYER_CLASS
      layer.setAttribute('aria-hidden', 'true')
      const canvas = document.createElement('canvas')
      canvas.style.cssText = 'display:block;width:100%;height:100%;'
      layer.append(canvas)
      // Вне body: загрузчик интерфейса не должен иметь доступа к этому узлу.
      document.documentElement.insertBefore(layer, document.body)
      return { layer, canvas }
    }

    function DeepSpaceRow(props) {
      const React = require('react')
      const state = React.useSyncExternalStore(props.controller.subscribe, props.controller.get, props.controller.get)
      const value = state.value
      const text = state.text
      const message = state.error
      const percent = Math.round(value.intensity * 100)
      const switchRow = (key, title, hint) =>
        React.createElement(
          'label',
          { className: 'pds-switch' },
          React.createElement('input', {
            type: 'checkbox',
            disabled: !state.editable,
            checked: value[key],
            onChange: (event) => {
              props.controller.set({ [key]: event.target.checked })
            },
          }),
          React.createElement('span', null, title),
          React.createElement('div', { className: 'pds-settings-copy' }, React.createElement('span', null, hint)),
        )
      const languageButton = (code, label) =>
        React.createElement(
          'button',
          {
            type: 'button',
            className: 'pds-lang',
            'aria-pressed': value.language === code,
            disabled: !state.editable,
            onClick: () => {
              props.controller.set({ language: code })
            },
          },
          label,
        )
      return React.createElement(
        'section',
        { className: 'pds-settings', 'data-pds-settings': '' },
        message
          ? React.createElement('div', { role: 'alert', style: { gridColumn: '1 / -1' } }, message)
          : null,
        React.createElement(
          'div',
          { className: 'pds-range' },
          React.createElement('span', null, text.langLabel),
          React.createElement(
            'div',
            { className: 'pds-lang-row' },
            languageButton('auto', 'Auto'),
            languageButton('ru', 'Русский'),
            languageButton('en', 'English'),
          ),
        ),
        switchRow('enabled', text.enabled, text.enabledHint),
        React.createElement(
          'div',
          { className: 'pds-range' },
          React.createElement('span', null, text.intensity(percent)),
          React.createElement('input', {
            type: 'range',
            min: '20',
            max: '140',
            step: '1',
            value: percent,
            disabled: !value.enabled || !state.editable,
            onChange: (event) => {
              props.controller.set({ intensity: Number(event.target.value) / 100 })
            },
          }),
        ),
        React.createElement(
          'div',
          { className: 'pds-range' },
          React.createElement('span', null, text.frameRate),
          React.createElement('div', { className: 'pds-settings-copy' }, React.createElement('span', null, text.frameRateHint)),
          React.createElement(
            'select',
            {
              className: 'pds-select',
              disabled: !value.enabled || !state.editable,
              value: String(value.fps),
              onChange: (event) => {
                props.controller.set({ fps: Number(event.target.value) })
              },
            },
            FPS_CHOICES.map((choice) =>
              React.createElement('option', { key: choice, value: String(choice) }, choice === 0 ? text.frameRateOff : String(choice)),
            ),
          ),
        ),
        switchRow('stars', text.stars, text.starsHint),
        state.features.suns ? switchRow('suns', text.suns, text.sunsHint) : null,
        state.features.blackholes ? switchRow('blackholes', text.blackholes, text.blackholesHint) : null,
        switchRow('ships', text.ships, text.shipsHint),
        switchRow('comets', text.comets, text.cometsHint),
        switchRow('planets', text.planets, text.planetsHint),
        switchRow('perturbation', text.perturbation, text.perturbationHint),
        switchRow('underlay', text.underlay, text.underlayHint),
        switchRow('session', text.session, text.sessionHint),
        switchRow('constellations', text.constellations, text.constellationsHint),
      )
    }

    // Диагностические маяки: хост переносит их в logs/harness.log, поэтому путь
    // плагина читается без доступа к экрану.
    function trace(step, detail) {
      try {
        console.error(`[pds] ${step}${detail === undefined ? '' : ` ${detail}`}`)
      } catch {}
    }

    function isOpaqueBackground(computed) {
      if (computed.backgroundImage !== 'none') return true
      const color = computed.backgroundColor
      if (color === '' || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') return false
      const match = /rgba?\(([^)]+)\)/u.exec(color)
      if (match === null) return true
      const parts = match[1].split(',').map((part) => Number.parseFloat(part.trim()))
      return parts.length < 4 || parts[3] > 0.02
    }

    // Список селекторов у официальной темы неполон для этой сборки интерфейса:
    // фон держит контейнер, который ни одним из них не ловится. Поэтому ищем
    // его сами — но только фон. Ни position, ни z-index чужим узлам не трогаем:
    // именно это раньше уводило интерфейс в пустоту.
    function clearOpaqueBackdrops(state) {
      const width = window.innerWidth
      const height = window.innerHeight
      const found = []
      const visit = (element, depth) => {
        if (depth > 4) return
        for (const child of element.children) {
          if (child === state.layer) continue
          const rect = child.getBoundingClientRect()
          if (rect.width >= width * 0.85 && rect.height >= height * 0.85) {
            if (isOpaqueBackground(window.getComputedStyle(child))) found.push(child)
          }
          visit(child, depth + 1)
        }
      }
      if (document.body !== null) visit(document.body, 0)
      for (const element of found) {
        if (state.remembered.has(element)) continue
        state.remembered.set(element, element.style.background)
        element.style.background = 'transparent'
      }
      return found.length
    }

    function apply(ctx) {
      trace('apply вызван', `слоты=${typeof ctx.slots}`)
      if (typeof document === 'undefined') return

      ctx.effect(() => {
        trace('эффект начат')
        const style = installStyle()
        const tokens = installTokens()
        const { layer, canvas } = installLayer()
        document.documentElement.setAttribute(THEME_ATTR, '')

        space.canvas = canvas
        space.context = canvas.getContext('2d', { alpha: true })
        space.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
        space.resize()
        space.populate()
        trace('канвас готов', `${canvas.width}x${canvas.height} слойВDom=${layer.isConnected}`)

        // Подложки проходятся несколько раз: интерфейс дорисовывает их уже
        // после старта, когда первый проход ещё ничего не видел.
        const remembered = new Map()
        const state = { layer, remembered }
        const clearBackdrops = () => clearOpaqueBackdrops(state)
        clearBackdrops()
        const timers = [600, 2000, 5000, 12000].map((delay) => window.setTimeout(clearBackdrops, delay))

        const form = createHostSettingsForm(ctx, PLUGIN_ID)
        const controller = createSettingsController(form)
        const applySettings = () => {
          const value = controller.get().value
          space.options = value
          // Полосы кэша хранят туманности, значит галочка «звёзды» меняет их
          // содержимое. bandsStars здесь НЕ трогаем: renderBands сам увидит
          // расхождение с space.options.stars и пересоберёт полосы, а при
          // неизменных настройках выйдет немедленно.
          renderBands()
          // Потолок кадров живёт в движке, а не в настройках: пересчитываем
          // интервал из нормализованной частоты, чтобы движок не знал о схеме.
          space.frameInterval = frameIntervalFrom(value.fps)
          layer.toggleAttribute('data-disabled', value.enabled === false)
          layer.style.opacity = String(value.underlay === true ? value.intensity : value.intensity * 0.4)
          // Режим «под текстом» ставит слой на z-index: -1; режим по умолчанию
          // оставляет картину поверх, но с blend: screen — так её видно всегда.
          document.documentElement.toggleAttribute('data-pds-underlay', value.underlay === true)
          if (value.enabled === false) space.stop()
          else space.start()
        }
        applySettings()
        const unsubscribe = controller.subscribe(applySettings)
        trace('настройки получены', JSON.stringify(controller.get().value))

        const onPointerMove = (event) => {
          if (space.options.perturbation === false) return
          steerField(space.field, event.clientX, event.clientY, 0.016)
        }
        const onResize = () => {
          space.resize()
          clearBackdrops()
        }
        const onVisibility = () => {
          if (document.hidden) space.stop()
          else space.start()
        }
        window.addEventListener('pointermove', onPointerMove, { passive: true })
        window.addEventListener('resize', onResize, { passive: true })
        document.addEventListener('visibilitychange', onVisibility)

        ctx.slots.inject('settings.general.item', () =>
          ctx.slots.register(
            { name: 'settings.general.item', id: 'poslanik-deep-space', order: 19, inject: () => ({ controller }) },
            DeepSpaceRow,
          ),
        )
        trace('слот настроек зарегистрирован')

        // Мост к хосту включается последним: к этому моменту сцена уже
        // работает, и если канала не будет, тема просто останется спокойной.
        const stopBridge = bindSessionState(ctx)
        trace('мост состояния', state.connected ? 'отвечает' : `ждёт: ${state.reason ?? 'первый ответ'}`)

        return () => {
          space.stop()
          stopBridge()
          for (const timer of timers) window.clearTimeout(timer)
          for (const [element, previous] of remembered) element.style.background = previous
          unsubscribe()
          controller.destroy()
          form.destroy()
          window.removeEventListener('pointermove', onPointerMove)
          window.removeEventListener('resize', onResize)
          document.removeEventListener('visibilitychange', onVisibility)
          layer.remove()
          tokens.restore()
          style?.remove()
          document.documentElement.removeAttribute(THEME_ATTR)
        }
      }, 'poslanik-deep-space: stars, ships, comets, planets and pointer field')
    }

    return { inject: ['slots'], apply }
  },
})
