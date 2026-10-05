// dsh-client-voice-eternia — голосовой ввод на русском языке.
//
// Что делает пакет: ставит на панель ввода кнопку микрофона. Нажатие просит
// микрофон, пишет звук, отправляет его на host-маршрут распознавания и
// вставляет полученный русский текст в поле ввода в позицию каретки.
//
// Как он устроен:
//   • `inject` объявляет ИМЕНА СЕРВИСОВ (`slots`), а не имена пакетов. Пакеты
//     перечислены в `package.json` → `dsh.client.inject`. Путать списки нельзя:
//     рантайм выдаёт сервис только тому, кто объявил его здесь. Сервис достаётся
//     и декларативно (инжект), и императивно (`ctx.get` с проверкой) — второй
//     путь нужен, чтобы отличить «сервис ещё не готов» от «сервиса нет».
//   • Своя ячейка слота получает СВОЙ `id`: слот листовой, и повтор чужого id
//     заменил бы соседа вместо добавления новой кнопки.
//   • Весь побочный эффект собран в одном `ctx.effect`: выгрузка или
//     переприменение плагина обязаны убрать стиль, ячейку и подписки. Иначе
//     после перезагрузки остались бы невидимые узлы и горящий микрофон.

import { CLASSES, STYLE_NAME, VOICE_ETERNIA_CSS } from './theme.css.js'
import { DictateButton, SLOT_ID, SLOT_ORDER } from './dictate.js'
import { NAMESPACE, RUSSIAN, DICTIONARIES, defaultTranslate } from './locales.js'
import { SettingsSection, PanelIcon, SECTION_ID, SECTION_ORDER, PANEL_ID, PANEL_ORDER } from './settingsPanel.js'

/**
 * Сервисы, без которых плагин не работает: место в слоте панели ввода и
 * словарь интерфейса.
 */
export const inject = ['slots', 'locale']

/** Плагин осмыслен только в браузере: host-половина этот файл не исполняет. */
function isBrowser() {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

/**
 * Вставляет таблицу стилей и возвращает уборщик.
 *
 * `styles` — сиденье браузерной половины (наряду с `React`, `host`, `console`),
 * а не сервис: рантайм передаёт его аргументом в замыкание. Если сиденья нет,
 * ставим тег сами — кнопка без CSS остаётся нажимаемой.
 *
 * @param {string} css - содержимое таблицы.
 * @returns {() => void} уборщик.
 */
function insertStyle(css) {
  // Сиденье стилей приходит ТРЕТЬИМ аргументом фабрики модуля, а не как
  // свободная переменная: фабрика замыканием рантайма не является. Сборщик
  // кладёт его в `globalThis.__VOICE_ETERNIA_STYLES__`. Свободная переменная
  // `styles` здесь недоступна — обращение к ней в строгом режиме бросило бы
  // ReferenceError и уронило `apply` целиком, поэтому её не используем.
  const seat = typeof globalThis !== 'undefined' ? globalThis.__VOICE_ETERNIA_STYLES__ : undefined
  if (seat !== undefined && seat !== null && typeof seat.insert === 'function') {
    return seat.insert(css)
  }
  if (typeof document === 'undefined') return () => {}
  const node = document.createElement('style')
  node.dataset.pluginCss = STYLE_NAME
  node.textContent = css
  document.head.appendChild(node)
  return () => node.remove()
}

/**
 * Регистрирует русский язык и словари интерфейса.
 *
 * Русского нет среди встроенных локалей DSH — там только `zh` и `en`, — поэтому
 * язык приходится добавлять отдельно, с откатом на английский. Словари же
 * регистрируются по одной локали за вызов: типизированная форма требует ровно
 * встроенные `zh` и `en`, а русский в неё не входит.
 *
 * Возвращает уборщик: и язык, и словари обязаны сниматься вместе с плагином,
 * иначе после перезагрузки в каталоге локалей останется чужое пространство имён.
 *
 * @param {object} ctx - клиентский контекст Cordis.
 * @returns {() => void} уборщик.
 */
function installLocale(ctx) {
  const locale = ctx.get('locale')
  if (locale === undefined) {
    console.error('voice-eternia: сервис locale недоступен — интерфейс останется на ключах')
    return () => {}
  }
  try {
    // Русский может быть уже занят — например, его регистрирует пакет
    // `dsh-client-locale-ru`. `addLanguage` бросает на занятом id, и тогда
    // словари плагина не зарегистрировались бы вовсе, а интерфейс показал
    // сырые ключи. Поэтому сначала смотрим каталог: язык добавляем только если
    // его там действительно нет, и тогда же мы вправе его снять.
    const catalog = typeof locale.getSnapshot === 'function' ? locale.getSnapshot().locales : []
    const exists = Array.isArray(catalog) && catalog.some((entry) => entry?.id === RUSSIAN.id)
    const disposeLanguage = exists ? null : locale.addLanguage({
      id: RUSSIAN.id,
      label: RUSSIAN.label,
      fallback: RUSSIAN.fallback,
    })

    // Словари идут после языка: у `ru` откат на `en`, и `en` обязан существовать
    // уже к моменту проверки определения.
    const disposers = Object.entries(DICTIONARIES).map(
      ([id, dict]) => locale.register(NAMESPACE, id, dict),
    )
    console.log(`voice-eternia: словари ${NAMESPACE} на ${Object.keys(DICTIONARIES).length} языках (язык ru ${exists ? 'уже был в каталоге' : 'добавлен'})`)

    return () => {
      for (const dispose of disposers.reverse()) {
        try {
          dispose()
        } catch (error) {
          console.error(`voice-eternia: снятие словаря ${NAMESPACE} не удалось`, error)
        }
      }
      if (disposeLanguage === null) return
      try {
        disposeLanguage()
      } catch (error) {
        console.error('voice-eternia: снятие языка ru не удалось', error)
      }
    }
  } catch (error) {
    console.error(`voice-eternia: словари интерфейса не зарегистрированы (${NAMESPACE})`, error)
    return () => {}
  }
}

/**
 * Регистрирует кнопку в слоте панели ввода.
 *
 * Свежий `id` добавляется рядом с чужими ячейками (там уже есть
 * `workbuddy-probe`), поэтому ни одна из них не заменяется. Поле `locale`
 * объявляет словарь ячейки: по нему рантайм сам передаёт компоненту `t`.
 *
 * @param {object} ctx - клиентский контекст Cordis.
 * @returns {() => void} уборщик.
 */
function installSlot(ctx) {
  try {
    const slots = ctx.get('slots')
    if (slots === undefined) {
      console.error('voice-eternia: сервис slots недоступен — кнопка не поставлена')
      return () => {}
    }
    return slots.inject('conversation.input.right', () => {
      // Две ячейки — две кнопки. Раньше кнопка была одна, и её поведение
      // зависело от настройки: человек нажимал микрофон в ожидании диктовки, а
      // попадал в разговор — или наоборот. Теперь режим виден до нажатия:
      // микрофон пишет и вставляет текст, вторая кнопка ведёт беседу.
      const disposers = [
        slots.register({
          name: 'conversation.input.right',
          id: SLOT_ID,
          order: SLOT_ORDER,
          // Thunk: текст перечитывается на каждой проекции, поэтому смена языка
          // подхватывается без перерегистрации ячейки.
          label: () => labelOf(ctx, 'dictate'),
          locale: NAMESPACE,
          // Модель сессии ищется тем же сервисом, что рисует селектор модели в
          // панели ввода: одна модель — один источник правды. Полировка идёт
          // именно ею, поэтому отдельной настройки для неё в форме нет.
          inject: (sessionId) => ({ currentModel: () => readSessionModel(ctx, sessionId) }),
        }, DictateButton),
        slots.register({
          name: 'conversation.input.right',
          id: TALK_SLOT_ID,
          order: TALK_SLOT_ORDER,
          label: () => labelOf(ctx, 'talk'),
          locale: NAMESPACE,
          inject: (sessionId) => ({ currentModel: () => readSessionModel(ctx, sessionId) }),
        }, TalkButton),
      ]
      console.log(`voice-eternia: ячейки «${SLOT_ID}» и «${TALK_SLOT_ID}» зарегистрированы в панели ввода`)
      return () => { for (const dispose of disposers) dispose() }
    })
  } catch (error) {
    console.error('voice-eternia: не удалось занять место в слоте панели ввода', error)
    return () => {}
  }
}


/**
 * Узнаёт модель, выбранную в текущей сессии.
 *
 * Зачем это нужно. Полировка текста — то же действие, что и сам разговор, и
 * держать для него отдельную настройку значит просить человека дважды выбирать
 * одно и то же. Поэтому полирует та модель, на которой идёт беседа: она уже
 * видна в панели ввода, и её же показывает селектор модели.
 *
 * Источник — сервис `modelDirectories`, владелец выбора модели по сессиям. Он
 * необязателен: если его нет (другая сборка, урезанный профиль), возвращаем
 * null, и хост берёт модель из своих настроек — молчаливой поломки не будет.
 *
 * @param {object} ctx - клиентский контекст.
 * @param {string} [sessionId] - идентификатор сессии из пропсов ячейки.
 * @returns {{provider: string, model: string} | null} выбор либо null.
 */
function readSessionModel(ctx, sessionId) {
  try {
    const directories = ctx.get('modelDirectories')
    if (directories === undefined || typeof directories.directoryFor !== 'function') return null
    const directory = directories.directoryFor(sessionId)
    const snapshot = directory?.store?.getSnapshot?.()
    const current = snapshot?.current
    if (current === null || current === undefined) return null
    const provider = typeof current.provider === 'string' ? current.provider : ''
    const model = typeof current.model === 'string'
      ? current.model
      : (typeof current.model?.id === 'string' ? current.model.id : '')
    if (provider === '' || model === '') return null
    return { provider, model }
  } catch {
    return null
  }
}

/**
 * Подпись на ТЕКУЩЕМ языке интерфейса.
 *
 * Раньше здесь стоял `defaultTranslate` — русский словарь без оглядки на язык.
 * На английском интерфейсе пункт назывался бы «Настройки голоса», что выглядит
 * поломкой перевода, а не переводом. Правильный путь — `locale.bind(ns)`:
 * он отдаёт строку на активной локали и сам перечитывает её при смене языка.
 *
 * Сервис берётся через `ctx.get('locale')`, а не как `ctx.locale`: в браузерной
 * половине контекст ОГРАНИЧЕН — у него есть только `get`, `on`, `provide` и
 * `effect`, и прямого свойства `locale` не существует вовсе.
 *
 * @param {object} ctx - клиентский контекст.
 * @param {string} key - ключ словаря.
 * @returns {string} подпись для интерфейса.
 */
/**
 * Активный язык интерфейса, о котором плагин знает сам.
 *
 * Зачем своя копия, если есть `getLocale().active`. Снимок локали читается
 * верно, но он меняется только у того, кто на него подписан: без подписки
 * подпись в слоте остаётся на старом языке, пока интерфейс DSH уже переключили.
 * Человек видел бы русский пункт в английском окне — и наоборот.
 *
 * Сервис `locale` сам предлагает для этого событие `locale/change` (в
 * `installLocale` есть только в будущем, в слотах его нет), поэтому подписка
 * идёт на событие. Значение хранится здесь, а не в состоянии компонента:
 * подписи слотов вызываются рантаймом без доступа к React.
 *
 * @type {string | undefined}
 */
let activeContext

let watchedLocale

/**
 * Читает активный язык один раз и следит за его сменой.
 *
 * @param {object} ctx - клиентский контекст.
 * @returns {void}
 */
function watchLocale(ctx) {
  activeContext = ctx
  watchedLocale = readActiveLocale(ctx)
  // Клиентский контекст ОГРАНИЧЕН: из всех подписок доступен `on`. Возвращает
  // ли он отписку — неизвестно, поэтому уборщик пробует оба способа, а при
  // отсутствии обоих полагается на `ctx.effect`, который снимает всё сам.
  let off
  try {
    off = ctx.on('locale/change', () => { watchedLocale = readActiveLocale(ctx) })
  } catch {
    // Событие может не поддерживаться — тогда текст просто останется на том
    // языке, который был при загрузке. Это заметно, но не ломает ничего.
  }
  if (typeof off === 'function') return off
  return undefined
}

/**
 * Активный язык из снимка локали.
 *
 * @param {object} ctx - клиентский контекст.
 * @returns {string | undefined} код языка либо undefined.
 */
function readActiveLocale(ctx) {
  try {
    const active = ctx.get('locale')?.getLocale?.()?.active
    return typeof active === 'string' ? active : undefined
  } catch {
    return undefined
  }
}

function labelOf(ctx, key) {
  // Ступень 1: язык берём из снимка локали, текст — из своих таблиц.
  //
  // Свои словари ставятся ПЕРВЫМИ не из скромности: это источник истины. Если
  // сначала спросить `bind`, а рантайм по какой-то причине отдаст перевод не
  // на том языке (у меня это случилось: локаль en, а подпись пришла русской), то
  // подпись будет принята как годная, и человек увидит «Настройки голоса» в
  // английском окне.
  try {
    const active = watchedLocale ?? readActiveLocale(ctx)
    const own = active === undefined ? undefined : DICTIONARIES[active]?.[key]
    if (typeof own === 'string' && own !== '') return own
  } catch {
    // Снимок локали недоступен — идём дальше.
  }
  // Ступень 2: штатный переводчик. Умеет цепочку откатов, которых у нас нет.
  try {
    const value = ctx.get('locale').bind(NAMESPACE)(key)
    if (typeof value === 'string' && value !== '' && value !== key) return value
  } catch {
    // `bind` может отсутствовать или бросить — идём к запасному пути.
  }
  // Ступень 3: русский. Сырой ключ в интерфейсе недопустим, а плагин без
  // локали должен оставаться читаемым.
  return defaultTranslate(key)
}

/**
 * Ставит пункт настроек в левую панели и страницу в общих настройках.
 *
 * Пункт и его панель — пара: `sidebar.panellist` даёт метаданные `id`/`order`/
 * `label` и иконку, кнопку вокруг рисует сама левая панель, а её обработчик
 * вызывает `layout.selectPanel(id)`. Без панели `main` с тем же ключом этот
 * вызов БРОСАЕТ, и клик роняет приложение.
 *
 * Три регистрации, все штатные:
 *   • `sidebar.panellist` — пункт в левой колонке (то, что просил человек);
 *   • `main` — панель, которую пункт открывает;
 *   • `settings.section` — та же страница в общих настройках, запасной путь.
 *
 * Раньше это падало, и виноват был не слот, а ПОДПИСЬ: `resolveSlotLabel`
 * вызывает `label()` без аргументов, а подпись вида `(t) => t('ключ')` на этом
 * бросала TypeError прямо в расчёте панелей сайдбара.
 *
 * @param {object} ctx - клиентский контекст Cordis.
 * @returns {() => void} уборщик.
 */
function installSettings(ctx) {
  try {
    const slots = ctx.get('slots')
    if (slots === undefined) {
      console.error('voice-eternia: сервис slots недоступен — настройки не поставлены')
      return () => {}
    }

    // Пункт левой панели. Компонент — ТОЛЬКО иконка: кнопку рисует панель.
    const disposePanel = slots.inject('sidebar.panellist', () => slots.register({
      name: 'sidebar.panellist',
      id: PANEL_ID,
      // Ниже штатных панелей беседы и задач: настройки плагина не должны
      // вытеснять то, чем человек пользуется каждый день.
      order: PANEL_ORDER,
      locale: NAMESPACE,
      label: () => labelOf(ctx, 'settings.title'),
    }, PanelIcon))

    // Панель, которую пункт открывает. Ключ обязан совпадать с id пункта.
    //
    // Слот `main` особенный: он объявлен как дочерний у корневой записи, и на
    // `slots.inject('main', …)` колбэк НЕ приходил — пункт в панели появился,
    // а панели в `main` не было, и клик по пункту ничего не открывал. Проверено
    // через живой реестр: соседние регистрации прошли, эта — нет.
    //
    // Поэтому панель ставится напрямую, а на неудачу (слота ещё нет) — через
    // inject, и тогда уже с ИМЕНЕМ слота в теле: колбэк inject не обязан его
    // подставлять за нас.
    const panelOptions = () => ({
      name: 'main',
      key: PANEL_ID,
      locale: NAMESPACE,
      inject: () => ({
        // Закрытие через layout, а не через slots: `layout.selectPanel(null)`
        // — единственный путь, которым пользуется сама левая панель.
        close: () => {
          const layout = ctx.get('layout')
          if (typeof layout?.selectPanel === 'function') layout.selectPanel(null)
        },
      }),
    })
    let disposeMain
    try {
      disposeMain = slots.register(panelOptions(), SettingsSection)
    } catch {
      disposeMain = slots.inject('main', () => slots.register(panelOptions(), SettingsSection))
    }

    const disposeSection = slots.inject('settings.section', () => slots.register({
      name: 'settings.section',
      id: SECTION_ID,
      order: SECTION_ORDER,
      locale: NAMESPACE,
      label: () => labelOf(ctx, 'settings.title'),
    }, SettingsSection))

    console.log(`voice-eternia: пункт «${PANEL_ID}», его панель и страница настроек готовы`)
    return () => {
      disposeSection()
      disposeMain()
      disposePanel()
    }
  } catch (error) {
    console.error('voice-eternia: не удалось поставить настройки', error)
    return () => {}
  }
}

/**
 * Подключает плагин к интерфейсу.
 *
 * @param {object} ctx - клиентский контекст Cordis.
 */
export function apply(ctx) {
  if (!isBrowser()) return

  ctx.effect(() => {
    let removeStyle = () => {}
    let removeSlot = () => {}
    let removeSettings = () => {}
    let removeLocale = () => {}
    let stopWatching = () => {}
    try {
      // Словари идут первыми: ячейка ссылается на пространство имён, и пустая
      // подписка показала бы сырые ключи в первый же кадр.
      removeLocale = installLocale(ctx)
      // Смена языка интерфейса ловится здесь: человек переключает DSH на
      // русский — и плагин обязан поехать вместе с ним, а не остаться в
      // английском окне русским текстом.
      stopWatching = watchLocale(ctx) ?? (() => {})
      removeStyle = insertStyle(VOICE_ETERNIA_CSS)
      removeSlot = installSlot(ctx)
      removeSettings = installSettings(ctx)
    } catch (error) {
      console.error(`voice-eternia: кнопка не поднялась (${STYLE_NAME})`, error)
    }

    return () => {
      try {
        removeSettings()

        stopWatching()
        removeSlot()
        removeStyle()
        removeLocale()
      } catch (error) {
        console.error('voice-eternia: уборка прошла с ошибкой', error)
      }
    }
  }, 'voice-eternia: кнопка диктовки')

  console.log(`voice-eternia: кнопка диктовки подключена (${CLASSES.button})`)
}

export { SLOT_ID, SLOT_ORDER, DictateButton }

/**
 * Активный язык интерфейса для компонентов.
 *
 * Подписи слотов получают язык сами (через `labelOf`), а компоненты читают его
 * здесь: без подписки React не перерисует страницу настроек после смены языка,
 * и человек увидит русские поля в английском окне — то есть ровно то, что
 * требовал убрать.
 *
 * @returns {string | undefined} код языка либо undefined.
 */
export function useActiveLocale() {
  const React = require('react')
  const [active, setActive] = React.useState(watchedLocale)
  React.useEffect(() => {
    // Снимок на момент подписки: язык мог смениться между рендером и эффектом.
    setActive(watchedLocale)
    const ctx = activeContext
    if (ctx === undefined) return
    let off
    try {
      off = ctx.on('locale/change', () => { setActive(watchedLocale) })
    } catch {
      return
    }
    return () => {
      if (typeof off === 'function') off()
    }
  }, [])
  return active
}
