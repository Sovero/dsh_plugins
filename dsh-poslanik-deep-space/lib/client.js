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
      return depths.map((depth, layer) => ({
        depth,
        drift: 2.5 + depth * 9,
        stars: Array.from({ length: Math.max(24, Math.round(area * densities[layer])) }, () => ({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: rand(sizes[layer][0], sizes[layer][1]),
          alpha: rand(alphas[layer][0], alphas[layer][1]),
          phase: Math.random() * TAU,
          twinkle: rand(0.4, 1.5),
        })),
      }))
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

    function drawBlackHoles(ctx, width, height) {
      if (space.options.blackholes === false) return
      ctx.save()
      for (const hole of space.blackHoles) {
        const x = (((hole.x + space.time * hole.drift * 0.0005) % 1.2) - 0.1) * width
        const y = hole.y * height
        const r = hole.radius
        const inner = r * 1.45
        const outer = r * hole.disc

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

    function createPlanets() {
      const count = 2 + Math.floor(Math.random() * 2)
      const kinds = ['gas', 'rock', 'ice']
      const baseHue = { gas: 28, rock: 18, ice: 198 }
      return Array.from({ length: count }, (_, index) => {
        const kind = kinds[index % kinds.length]
        const hue = baseHue[kind] + Math.floor(rand(-8, 8))
        const planet = {
          x: Math.random(),
          y: rand(0.12, 0.88),
          radius: rand(34, 92),
          hue,
          kind,
          lightAngle: rand(-2.6, -0.5),
          speed: rand(0.6, 2.2) * (Math.random() < 0.5 ? -1 : 1),
          ring: kind === 'gas' && index % 2 === 0,
          tilt: rand(-0.5, -0.2),
          alpha: kind === 'gas' ? 0.5 : 0.42,
        }
        if (kind === 'gas') {
          planet.bands = Array.from({ length: 5 }, () => ({
            offset: rand(-0.55, 0.55),
            height: rand(0.04, 0.12),
            hue: hue + Math.floor(rand(-14, 14)),
            alpha: rand(0.06, 0.14),
          }))
        } else {
          planet.spots = Array.from({ length: 7 }, () => ({
            x: rand(-0.7, 0.7),
            y: rand(-0.7, 0.7),
            r: rand(0.04, 0.13),
            hue: hue + Math.floor(rand(-20, 20)),
            alpha: rand(0.05, 0.12),
          }))
        }
        return planet
      })
    }

    function createShips() {
      const count = 5 + Math.floor(Math.random() * 4)
      return Array.from({ length: count }, () => {
        const depth = rand(0.2, 1)
        return {
          x: Math.random(),
          y: rand(0.08, 0.92),
          depth,
          size: 5 + depth * 22,
          speed: (3 + depth * 26) * (Math.random() < 0.5 ? -1 : 1),
          navPhase: Math.random() * TAU,
          navRate: rand(0.6, 1.6),
          heading: Math.random() < 0.5 ? 0 : Math.PI,
        }
      })
    }

    function createComets() {
      return Array.from({ length: 1 + Math.floor(Math.random() * 2) }, () => ({
        x: Math.random(),
        y: rand(0.1, 0.7),
        vx: rand(9, 20) * (Math.random() < 0.5 ? -1 : 1),
        vy: rand(2, 7),
        length: rand(160, 320),
        alpha: rand(0.35, 0.6),
        wobble: Math.random() * TAU,
      }))
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
      if (Number.isFinite(speed)) field.energy = clamp(field.energy + speed * 0.00024, 0, 1)
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
      field.energy *= Math.pow(0.08, dt)
      if (field.energy < 0.002) field.energy = 0
      field.radius = 96 + field.energy * 96
      field.cooldown -= dt
      if (field.energy > 0.55 && field.cooldown <= 0) {
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
    function drawBackground(ctx, width, height, time) {
      const sky = ctx.createLinearGradient(0, 0, 0, height)
      sky.addColorStop(0, '#04060f')
      sky.addColorStop(0.55, '#070a1a')
      sky.addColorStop(1, '#0a0c1e')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, width, height)
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

    function drawStars(ctx, width, time) {
      if (space.options.stars === false) return
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      for (const layer of space.stars) {
        for (const star of layer.stars) {
          const drifted = (((star.x - time * layer.drift) % width) + width) % width
          const twinkle = 0.72 + 0.28 * Math.sin(time * star.twinkle + star.phase)
          const warped = space.options.perturbation ? warpField(space.field, drifted, star.y, layer.depth) : null
          const x = warped === null ? drifted : warped.x
          const y = warped === null ? star.y : warped.y
          const alpha = star.alpha * twinkle * (warped === null ? 1 : 1 + warped.glow * 0.45)
          const radius = star.radius * (warped === null ? 1 : 1 + warped.glow * 0.18)
          ctx.fillStyle = `rgba(226, 236, 255, ${clamp(alpha, 0, 1)})`
          ctx.beginPath()
          ctx.arc(x, y, radius, 0, TAU)
          ctx.fill()
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

    function drawPlanets(ctx, width, height) {
      if (space.options.planets === false) return
      ctx.save()
      for (const planet of space.planets) {
        const x = (((planet.x + space.time * planet.speed * 0.002) % 1.2) - 0.1) * width
        const y = planet.y * height
        const radius = planet.radius
        const lx = Math.cos(planet.lightAngle)
        const ly = Math.sin(planet.lightAngle)

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
        if (planet.kind === 'gas') {
          for (const band of planet.bands) {
            ctx.fillStyle = `hsla(${band.hue}, 80%, 72%, ${planet.alpha * band.alpha})`
            ctx.beginPath()
            ctx.ellipse(x, y + band.offset * radius, radius * 1.02, radius * band.height, 0, 0, TAU)
            ctx.fill()
          }
        } else {
          for (const spot of planet.spots) {
            ctx.fillStyle = `hsla(${spot.hue}, 70%, 80%, ${planet.alpha * spot.alpha})`
            ctx.beginPath()
            ctx.arc(x + spot.x * radius, y + spot.y * radius, radius * spot.r, 0, TAU)
            ctx.fill()
          }
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

    function updateShips(dt, width, height) {
      for (const ship of space.ships) {
        // Энергия восстанавливается сама и тратится на смену курса.
        ship.energy = Math.min(1, ship.energy + 0.16 * dt)
        ship.cooldown -= dt
        if (ship.cooldown <= 0 && ship.energy > 0.45) {
          ship.targetHeading += rand(-0.8, 0.8)
          ship.energy -= 0.45
          ship.cooldown = rand(1.8, 4)
        }

        // Поворот идёт тем быстрее, чем больше энергии; на нуле корабль держит курс.
        const difference = ((ship.targetHeading - ship.heading + Math.PI * 3) % TAU) - Math.PI
        const turn = (0.25 + 0.9 * ship.energy) * dt
        ship.turning = Math.abs(difference) > 0.02
        if (ship.turning) ship.heading += clamp(difference, -turn, turn)
        // Крен следует за поворотом и сглаживается: на вираже корабль «ложится» набок.
        ship.bank = lerp(ship.bank, clamp(difference * 1.4, -0.6, 0.6), 1 - Math.pow(0.08, dt))
        // Тяга дышит сама и сбавляется на вираже — так движение выглядит живым.
        const wanted = ship.turning ? 0.7 : 0.88 + 0.18 * Math.sin(space.time * 0.6 + ship.navPhase)
        ship.throttle = lerp(ship.throttle, wanted, 1 - Math.pow(0.25, dt))
        const current = ship.speed * ship.throttle
        ship.vx = Math.cos(ship.heading) * current
        ship.vy = Math.sin(ship.heading) * current

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
          comet.vx = rand(9, 20) * (Math.random() < 0.5 ? -1 : 1)
          comet.vy = rand(2, 7)
        }

        const headX = comet.x * width
        const headY = comet.y * height + Math.sin(comet.wobble) * 6
        const speed = Math.hypot(comet.vx, comet.vy) || 1
        const tailX = headX - (comet.vx / speed) * comet.length
        const tailY = headY - (comet.vy / speed) * comet.length

        const tail = ctx.createLinearGradient(tailX, tailY, headX, headY)
        tail.addColorStop(0, 'rgba(120, 190, 255, 0)')
        tail.addColorStop(0.7, `rgba(150, 205, 255, ${comet.alpha * 0.28})`)
        tail.addColorStop(1, `rgba(230, 245, 255, ${comet.alpha * 0.6})`)
        ctx.strokeStyle = tail
        ctx.lineWidth = 2.4
        ctx.beginPath()
        ctx.moveTo(tailX, tailY)
        ctx.lineTo(headX, headY)
        ctx.stroke()

        const glow = ctx.createRadialGradient(headX, headY, 0, headX, headY, 22)
        glow.addColorStop(0, `rgba(240, 250, 255, ${comet.alpha})`)
        glow.addColorStop(0.35, `rgba(160, 210, 255, ${comet.alpha * 0.5})`)
        glow.addColorStop(1, 'rgba(120, 180, 255, 0)')
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(headX, headY, 22, 0, TAU)
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

    function drawField(ctx) {
      if (space.options.perturbation === false) return
      const field = space.field
      if (field.energy <= 0 && field.rings.length === 0) return
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      if (field.energy > 0) {
        const radius = field.radius
        const glow = ctx.createRadialGradient(field.x, field.y, 0, field.x, field.y, radius)
        glow.addColorStop(0, `rgba(120, 180, 255, ${clamp(field.energy * 0.085, 0, 0.1)})`)
        glow.addColorStop(0.4, `rgba(90, 140, 255, ${clamp(field.energy * 0.035, 0, 0.05)})`)
        glow.addColorStop(1, 'rgba(60, 110, 255, 0)')
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(field.x, field.y, radius, 0, TAU)
        ctx.fill()

        ctx.strokeStyle = `rgba(140, 190, 255, ${clamp(field.energy * 0.12, 0, 0.15)})`
        ctx.lineWidth = 1
        for (let index = 0; index < 2; index += 1) {
          const ringRadius = radius * (0.4 + index * 0.26)
          ctx.beginPath()
          ctx.arc(field.x, field.y, ringRadius, field.energy * 2 + index, field.energy * 2 + index + Math.PI * 1.1)
          ctx.stroke()
        }

        ctx.fillStyle = `rgba(220, 238, 255, ${clamp(field.energy * 0.26, 0, 0.3)})`
        ctx.beginPath()
        ctx.arc(field.x, field.y, 1.2 + field.energy * 1.2, 0, TAU)
        ctx.fill()
      }
      for (const ring of field.rings) {
        const share = 1 - ring.age / ring.life
        ctx.strokeStyle = `rgba(150, 200, 255, ${clamp(share * 0.12, 0, 0.14)})`
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
      options: normalizeSettings(),
      nebulae: [],
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
      },

      populate() {
        this.nebulae = createNebulae()
        this.planets = createPlanets()
        this.dwarfs = createDwarfs()
        this.suns = createSuns()
        this.blackHoles = createBlackHoles()
        this.ships = createShips()
        this.comets = createComets()
        this.meteors = []
        this.meteorTimer = rand(1.5, 4)
      },

      render(dt) {
        if (this.context === null) return
        this.time += dt
        updateField(this.field, dt)
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
        drawBackground(ctx, this.width, this.height, this.time)
        drawStars(ctx, this.width, this.time)
        drawDwarfs(ctx, this.width, this.height)
        drawSuns(ctx, this.width, this.height)
        drawBlackHoles(ctx, this.width, this.height)
        drawPlanets(ctx, this.width, this.height)
        drawComets(ctx, this.width, this.height, dt)
        drawMeteors(ctx, this.width, dt)
        if (this.options.ships !== false) updateShips(dt, this.width, this.height)
        drawShips(ctx, this.width, this.height)
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
        switchRow('stars', text.stars, text.starsHint),
        state.features.suns ? switchRow('suns', text.suns, text.sunsHint) : null,
        state.features.blackholes ? switchRow('blackholes', text.blackholes, text.blackholesHint) : null,
        switchRow('ships', text.ships, text.shipsHint),
        switchRow('comets', text.comets, text.cometsHint),
        switchRow('planets', text.planets, text.planetsHint),
        switchRow('perturbation', text.perturbation, text.perturbationHint),
        switchRow('underlay', text.underlay, text.underlayHint),
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

        return () => {
          space.stop()
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
