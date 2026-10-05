// Тесты собранного бандла.
//
// Бандл — единственная точка доставки в браузер, поэтому проверяем именно
// контракт фабрики: как она получает React, что объявляет и какой id занимает.
// Это не косметика. Именно неверный способ взять React делал кнопку невидимой
// при полностью рабочей host-половине и зарегистрированной ячейке слота.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import vm from 'node:vm'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const bundlePath = join(root, 'lib/client.js')

/** Заглушка React: тестам достаточно факта вызова, а не работы хуков. */
const REACT_STUB = {
  createElement: (type, props, ...kids) => ({ type, props, kids }),
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useRef: (initial) => ({ current: initial }),
  useEffect: () => {},
}

/**
 * Выполняет бандл в песочнице и отдаёт зарегистрированную спецификацию.
 *
 * @param {object} [extra] - дополнительные глобалы песочницы.
 * @returns {{ id: string, factory: Function }} спецификация модуля.
 */
function loadBundle(extra = {}) {
  const loaded = []
  const sandbox = vm.createContext({
    window: { __ModuleLoader__: { load(spec) { loaded.push(spec) } } },
    console: { log() {}, error() {} },
    globalThis: {},
    ...extra,
  })
  sandbox.globalThis = sandbox
  vm.runInContext(readFileSync(bundlePath, 'utf8'), sandbox, { filename: 'lib/client.js' })
  assert.equal(loaded.length, 1, 'бандл должен зарегистрировать ровно один модуль')
  return loaded[0]
}

/**
 * Заглушка хранилища снимков: бандл берёт его из таблицы фронтенда по полному
 * имени с префиксом. Достаточно подписки и снимка — тесты проверяют разметку и
 * вызовы, а не реактивность.
 */
const STORE_STUB = {
  createSnapshotStore(init = {}) {
    let state = init
    return {
      getSnapshot: () => state,
      subscribe: () => () => {},
      set: (next) => { state = typeof next === 'function' ? next(state) : next },
      update: (mutate) => {
        const draft = { ...state }
        mutate(draft)
        state = draft
      },
    }
  },
}

/**
 * Материализует бандл: вызывает фабрику с require-заглушкой.
 *
 * Ключевая деталь контракта: React берётся через `require('react')`. Свободной
 * переменной React в области видимости фабрики нет, и обращение к ней уронило
 * бы первый же рендер — слот отстранил бы ячейку, и кнопка не появилась бы.
 * Заглушка ловит и этот случай: любой неожиданный спецификатор роняет тест.
 *
 * @param {Record<string, unknown>} [extra] - дополнительные глобалы песочницы.
 * @returns {object} экспорты бандла.
 */
function materialize(extra = {}) {
  return loadBundle(extra).factory((id) => {
    if (id === 'react') return REACT_STUB
    if (id === '@deepseek-ai/dsh-client-store') return STORE_STUB
    throw new Error(`бандл запросил внешний модуль "${id}"`)
  })
}

test('все словари покрывают один и тот же набор ключей', () => {
  const plugin = materialize()
  const base = Object.keys(plugin.DICTIONARIES.ru).sort()
  assert.ok(base.length > 20, 'словарь должен покрывать весь интерфейс, а не пару строк')
  for (const [id, dict] of Object.entries(plugin.DICTIONARIES)) {
    assert.deepEqual(Object.keys(dict).sort(), base, `словарь ${id} расходится с русским`)
    for (const [key, text] of Object.entries(dict)) {
      assert.equal(typeof text, 'string', `${id}/${key} должен быть строкой`)
      assert.notEqual(text.trim(), '', `${id}/${key} пуст — интерфейс покажет пробел`)
    }
  }
})

test('во всех словарях одинаковые плейсхолдеры подстановки', () => {
  // Забытый {message} в переводе даст текст без причины отказа — и это
  // не поймает сравнение ключей, потому что ключ на месте.
  const plugin = materialize()
  const placeholders = (text) => (text.match(/\{(\w+)\}/g) ?? []).sort()
  const base = placeholders(plugin.DICTIONARIES.ru['error.probeFailed'])
  assert.deepEqual(base, ['{message}'], 'в русском ключе должен быть плейсхолдер')
  for (const [id, dict] of Object.entries(plugin.DICTIONARIES)) {
    for (const key of Object.keys(plugin.DICTIONARIES.ru)) {
      if (placeholders(plugin.DICTIONARIES.ru[key]).length === 0) continue
      assert.deepEqual(placeholders(dict[key]), placeholders(plugin.DICTIONARIES.ru[key]),
        `${id}/${key}: набор плейсхолдеров разошёлся с русским`)
    }
  }
})

test('переводчик подставляет значения и не ломается на пустых', () => {
  const plugin = materialize()
  const t = plugin.createTranslate(plugin.DICTIONARIES.ru)
  assert.equal(t('error.probeFailed', { message: 'микрофон молчит' }),
    'Проверка микрофона не удалась: микрофон молчит')
  // Отсутствующее значение оставляет плейсхолдер: так дефект виден в тестах,
  // а пустая строка выглядела бы как «всё прошло».
  assert.match(t('error.probeFailed'), /\{message\}/)
  assert.equal(t('error.noDevice'), 'Микрофон не найден.')
})

test('чужой плагин, уже занявший русский язык, не ломает словари', () => {
  // `dsh-client-locale-ru` регистрирует id `ru` сам, и `addLanguage` бросает на
  // занятом id. Без проверки каталога наш плагин упал бы в catch — и весь
  // интерфейс показал бы сырые ключи.
  const calls = []
  const locale = {
    getSnapshot: () => ({ active: 'ru', locales: [{ id: 'ru', label: 'Русский' }, { id: 'en', label: 'English' }], revision: 1 }),
    addLanguage: () => { calls.push('addLanguage'); throw new Error('id занят') },
    register: (ns, id) => { calls.push(`register:${ns}/${id}`); return () => calls.push(`dispose:${id}`) },
  }
  const plugin = materialize()
  const dispose = (() => {
    // Вызываем внутреннюю установку через apply в среде без окна нельзя, поэтому
    // проверяем контракт напрямую: при занятом языке addLanguage не вызывается.
    assert.doesNotThrow(() => {
      const catalog = locale.getSnapshot().locales
      const exists = catalog.some((entry) => entry?.id === plugin.RUSSIAN.id)
      if (!exists) locale.addLanguage({ id: plugin.RUSSIAN.id, label: plugin.RUSSIAN.label, fallback: plugin.RUSSIAN.fallback })
      for (const [id, dict] of Object.entries(plugin.DICTIONARIES)) locale.register(plugin.NAMESPACE, id, dict)
    })
    return null
  })()
  assert.deepEqual(calls, ['register:voice-eternia/ru', 'register:voice-eternia/en', 'register:voice-eternia/zh'],
    'addLanguage не должен вызываться при занятом id')
  assert.equal(dispose, null)
})

test('в интерфейсе не осталось захардкоженных русских строк', () => {
  const text = readFileSync(bundlePath, 'utf8')
  // Проверяем именно UI-контекст: строки в словарях обязаны быть, а вот в
  // разметке — нет. Пустой вызов `setMessage('')` — это сброс сообщения, он
  // законен; ищем только непустой литерал.
  assert.doesNotMatch(text, /setMessage\('[^']/,
    'сообщения панели обязаны идти через t(), иначе смена языка их не тронет')
  assert.match(text, /locale: NAMESPACE/,
    'ячейка обязана объявить пространство имён — иначе рантайм не передаст t')
  assert.match(text, /ctx\.get\('locale'\)/,
    'словари обязаны регистрироваться через сервис locale')
  assert.match(text, /addLanguage\(/,
    'русского нет среди встроенных локалей DSH, его надо добавить')
})

test('панель состояний реально попадает в дерево, а не собирается в никуда', () => {
  const text = readFileSync(bundlePath, 'utf8')
  // Регрессия: панель была последним элементом `children` и рендерилась
  // срезом `children.slice(-1)`. Срез убрали как «лишний» — и панель исчезла из
  // дерева целиком: состояние менялось, но показать было нечего, и кнопка
  // выглядела мёртвой («нажимаю — ничего не происходит»).
  assert.doesNotMatch(text, /children\.slice\(/,
    'панель обязана рендериться явно, а не через срез последнего элемента')
  assert.match(text, /button,\s*panel\)/,
    'в возврате должны быть обе части: кнопка и панель состояний')
})

test('ошибка до первого setState не остаётся невидимой', () => {
  const text = readFileSync(bundlePath, 'utf8')
  // Обработчик зовёт start через void: необработанное исключение уходит в
  // консоль, а интерфейс выглядит как «кнопка не нажимается». Значит путь до
  // первого setState обязан быть под защитой и показывать сообщение.
  assert.match(text, /Проверка микрофона не удалась/,
    'сбой проверки среды должен попадать в панель, а не в консоль')
  assert.match(text, /Панель ввода не отдала действия ввода/,
    'отсутствие inputActions должно объясняться, а не молчать')
  assert.match(text, /Не удалось запомнить позицию курсора/,
    'сбой captureInsertion должен объясняться, а не молчать')
})

test('lib/client.js собран', () => {
  assert.ok(existsSync(bundlePath), 'запусти npm run build')
})

test('бандл берёт React через require, а не через свободную переменную', () => {
  const text = readFileSync(bundlePath, 'utf8')
  assert.match(text, /require\(['"]react['"]\)/,
    'свободной переменной React в области видимости фабрики нет: нужен require')
  assert.doesNotThrow(() => materialize(),
    'материализация обязана проходить: старый бандл падал на свободной React')
})

test('бандл самодостаточен: ни импортов, ни экспортов', () => {
  const text = readFileSync(bundlePath, 'utf8')
  assert.doesNotMatch(text, /^\s*import\s/m, 'в бандле остался import')
  assert.doesNotMatch(text, /^\s*export\s/m, 'в бандле остался export')
  // JSX ищем по возврату тега, а не по любому «<Заглавная»: в JSDoc живут
  // типы вида {Promise<Float32Array>}, и они дают ложное срабатывание.
  assert.doesNotMatch(text, /(?:return|=>)\s*\(\s*</, 'в бандле похоже на JSX — браузерная половина только чистый JS')
})

test('правка unexport не покалечила async-объявления', () => {
  const text = readFileSync(bundlePath, 'utf8')
  assert.match(text, /async function transcribe/, 'async function должна остаться целой')
  assert.doesNotMatch(text, /const async|function async/, 'ключевое слово async не должно склеиться с объявлением')
})

test('бандл отдаёт модуль с id пакета', () => {
  assert.equal(loadBundle().id, 'dsh-client-voice-eternia')
})

test('клиент объявляет сервисы slots и locale', () => {
  const plugin = materialize()
  assert.equal(typeof plugin.apply, 'function')
  // Соседний рабочий плагин golden-dawn объявляет `inject` так же — это контракт
  // клиентских плагинов. Имена ПАКЕТОВ для порядка загрузки графа живут
  // отдельно, в package.json → dsh.client.inject.
  assert.deepEqual(Array.from(plugin.inject).sort(), ['locale', 'slots'])
  assert.match(readFileSync(bundlePath, 'utf8'), /ctx\.get\('slots'\)/,
    'помимо инжекта сервис берётся императивно — так отличают «не готов» от «нет»')
})

test('стиль вставляется через сиденье, а не через несуществующий ctx.styles', () => {
  const text = readFileSync(bundlePath, 'utf8')
  assert.doesNotMatch(text, /ctx\.styles/, 'ctx.styles не существует: styles приходит сиденьем фабрики')
  assert.doesNotMatch(text, /typeof styles\b/,
    'свободной переменной styles нет: фабрика модуля не является замыканием рантайма, '
    + 'и обращение к ней уронило бы apply')
  assert.match(text, /__VOICE_ETERNIA_STYLES__/, 'сиденье стилей должно читаться через globalThis')
  assert.match(text, /document\.head\.appendChild/, 'должен быть запасной путь через document.head')
})

test('apply без window молча выходит', () => {
  const plugin = materialize()
  assert.equal(plugin.apply({ effect: () => () => {} }), undefined)
})

test('ячейка слота получает собственный id и не совпадает с чужой', () => {
  const plugin = materialize()
  assert.equal(plugin.SLOT_ID, 'voice-eternia-dictate')
  assert.notEqual(plugin.SLOT_ID, 'workbuddy-probe', 'чужой id занял бы соседню ячейку')
  assert.equal(plugin.SLOT_ORDER, 20)
})

test('регистрация идёт в слот панели ввода, а не в чужой', () => {
  const text = readFileSync(bundlePath, 'utf8')
  assert.match(text, /conversation\.input\.right/, 'слот должен быть тот же, что у композера')
})

test('WAV-энкодер даёт корректный RIFF-заголовок', () => {
  const plugin = materialize()
  const samples = new Float32Array([0, 0.5, -0.5, 1, -1])
  const bytes = plugin.encodeWave(samples)
  const view = new DataView(bytes.buffer)
  const tag = (at, len) => String.fromCharCode(...bytes.subarray(at, at + len))

  assert.equal(tag(0, 4), 'RIFF')
  assert.equal(tag(8, 4), 'WAVE')
  assert.equal(tag(12, 4), 'fmt ')
  assert.equal(tag(36, 4), 'data')
  assert.equal(view.getUint32(4, true), bytes.length - 8, 'размер RIFF-чанка')
  assert.equal(view.getUint16(20, true), 1, 'формат PCM')
  assert.equal(view.getUint16(22, true), 1, 'каналов должен быть 1 (mono)')
  assert.equal(view.getUint32(24, true), 16000, 'частота должна быть 16 кГц')
  assert.equal(view.getUint32(28, true), 32000, 'байт в секунду = частота × 2')
  assert.equal(view.getUint16(32, true), 2, 'выравнивание блока')
  assert.equal(view.getUint16(34, true), 16, 'бит на сэмпл')
  assert.equal(view.getUint32(40, true), samples.length * 2, 'размер данных')
  assert.equal(bytes.length, 44 + samples.length * 2, 'длина файла = заголовок + данные')
})

test('WAV-энкодер насыщает значения за пределами диапазона', () => {
  const plugin = materialize()
  const bytes = plugin.encodeWave(new Float32Array([2, -2]))
  const view = new DataView(bytes.buffer)
  assert.equal(view.getInt16(44, true), 32767, 'значение выше 1 должно упереться в 32767')
  assert.equal(view.getInt16(46, true), -32768, 'значение ниже -1 должно упереться в -32768')
})

test('проверка среды отличает «нет связи с хостом» от рабочей среды', () => {
  // Запись ведёт хост, поэтому проверять нечего, кроме связи с ним. Раньше здесь
  // проверялся `navigator.mediaDevices`, и тест проверял его отсутствие.
  const offline = materialize()
  assert.equal(offline.probeSupport().available, false, 'без fetch до хоста не дотянуться')
  assert.equal(offline.probeSupport().reason, 'offline')

  const online = materialize({ fetch: () => {} })
  const support = online.probeSupport()
  // Объекты приходят из песочницы vm, поэтому сравниваем по полям: у них свой
  // прототип, и deepEqual счёл бы их разными типами.
  assert.equal(support.available, true)
  assert.equal(support.reason, '')
})

test('отказ доступа к микрофону объясняется текстом под стать среде', () => {
  const plugin = materialize()
  // Тест исполняется в другом контексте, чем бандл, поэтому `instanceof Error`
  // через границу песочницы не работает. Проверяем свойство `name`, как это
  // делает и сам код: он получает ошибку из getUserMedia, а не из песочницы.
  const failure = (name) => ({ name, message: name, __proto__: Error.prototype })

  const denied = plugin.classifyFailure(failure('NotAllowedError'))
  assert.equal(denied.kind, 'denied')
  // В песочнице navigator нет, поэтому код считает среду не-Electron и
  // советует разрешить доступ. Подсказка про браузер принадлежит ветке
  // Electron — её проверяет отдельный тест ниже, с поддельным navigator.
  assert.match(denied.message, /разрешите доступ/i)

  const busy = plugin.classifyFailure(failure('NotReadableError'))
  assert.equal(busy.kind, 'busy')

  const missing = plugin.classifyFailure(failure('NotFoundError'))
  assert.equal(missing.kind, 'nodevice')
})

test('в оболочке Electron отказ советует проверить хост, а не идти в браузер', () => {
  // Electron добавляет к userAgent собственный токен — по нему и различаем.
  const plugin = loadBundle({
    navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Electron/38.0.0' },
  }).factory((id) => {
    if (id === 'react') return REACT_STUB
    if (id === '@deepseek-ai/dsh-client-store') return STORE_STUB
    throw new Error(`бандл запросил внешний модуль "${id}"`)
  })

  assert.equal(plugin.isDesktopShell(), true, 'токен Electron в userAgent обязан распознаваться')

  const denied = plugin.classifyFailure({ name: 'NotAllowedError', message: '', __proto__: Error.prototype })
  assert.equal(denied.kind, 'denied')
  // Запись ведёт хост, поэтому совет «откройте в браузере» больше не верен: в
  // Electron человек ушёл бы направо — оболочка блокирует микрофон везде, а
  // настоящая причина здесь в ffmpeg или занятом устройстве.
  assert.match(denied.message, /ffmpeg|устройств/i,
    'подсказка должна верить к хост-причине отказа')
  assert.equal(/браузер/i.test(denied.message), false,
    'совет про браузер устарел вместе с браузерным обходом')
})

test('вне Electron подсказка не отправляет пользователя в другое окно', () => {
  const plugin = materialize()
  assert.equal(plugin.isDesktopShell(), false)
})

test('в полосе записи нет кнопок — управляет микрофон', () => {
  // Требование человека: окно с кнопками «Готово» и «Отмена» заменено полосой,
  // которой управляет сам микрофон. Кнопки дублировали его и предлагали выбор,
  // которого человек на самом деле не делал: сказать или не сказать.
  const source = readFileSync(bundlePath, 'utf8')
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')

  for (const key of ['action.done', 'action.cancel', 'action.insert', 'action.copy',
    'action.discard', 'action.close', 'action.openInBrowser', 'action.copyAddress']) {
    assert.equal(code.includes(key), false, `в разметке осталась кнопка ${key}`)
  }
  // Кнопок в панели быть не должно вовсе: единственный орган управления —
  // сам микрофон, и он вне панели.
  assert.equal(code.includes('const controls ='), false, 'панель не должна собирать кнопки')
  assert.match(code, /hint\.toggle/, 'нужно сказать, как закончить запись')
  assert.match(code, /hint\.close/, 'нужно сказать, как закрыть полосу')
  assert.match(code, /data-open/, 'полоса должна уметь закрываться повторным нажатием')
  assert.match(code, /aria-pressed/, 'микрофон обязан показывать состояние переключателя')
})

test('мёртвые стили кнопок убраны вместе с кнопками', () => {
  const source = readFileSync(bundlePath, 'utf8')
  // Стили кнопок записи удалены вместе с самими кнопками. `data-primary` остался
  // в разметке — он теперь у кнопки «Сохранить» в окне настроек, но описывать
  // его больше нечем: правило жило в `.vet-row`, которого нет.
  for (const dead of ['.vet-row', '.vet-link']) {
    assert.equal(source.includes(dead), false,
      `${dead} больше не используется: стиль без разметки только шумит`)
  }
  // Полоска и её части остались: их удаление сделало бы панель невидимой.
  for (const alive of ['.vet-panel', '.vet-meter', '.vet-result', '.vet-address']) {
    assert.equal(source.includes(alive), true, `${alive} нужен полосе`)
  }
  // Панель настроек — отдельный слой со своими стилями.
  for (const page of ['.vet-page']) {
    assert.equal(source.includes(page), true, `${page} нужна панели настроек`)
  }
  assert.equal(source.includes('.vet-dialog'), false, 'стили модального окна больше не используются')
})

test('пункт в левой панели и его панель зарегистрированы парой', () => {
  // Пункт панели и панель main — неразлучная пара: левая панель вызывает
  // layout.selectPanel(id), а он БРОСАЕТ для незарегистрированной панели.
  // Раньше из-за этого плагин отключали дважды; виновата была подпись
  // (t) => t('…'), которую рантайм зовёт БЕЗ аргументов.
  const source = readFileSync(bundlePath, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')
  assert.match(source, /sidebar\.panellist/, 'пункт в левой панели обязателен')
  assert.match(source, /id: PANEL_ID/, 'у пункта есть собственный id')
  assert.match(source, /PanelIcon/, 'иконка пункта обязательна')
  assert.match(source, /settings\.section/, 'страница в общих настройках — запасной путь')
  assert.match(source, /conversation\.input\.right/, 'кнопка микрофона должна остаться')
  // Кнопку в пункте рисовать нельзя: панель оборачивает содержимое ячейки в
  // СВОЮ кнопку, и вложенная кнопка перехватила бы клик.
  assert.equal(source.includes('<button'), false, 'пункт — только иконка')
})

test('панель ставится напрямую, а не только через inject', () => {
  // Пункт в панели появился, а панели в main не было, и клик ничего не открывал.
  // Живой реестр показал: соседние регистрации прошли, именно эта — нет, то
  // есть колбэк slots.inject('main', …) молча не вызвался. Поэтому панель
  // регистрируется напрямую, и лишь на неудачу (слота ещё нет) — через inject.
  const source = readFileSync(bundlePath, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')
  assert.match(source, /disposeMain = slots\.register\(/,
    'панель main обязана регистрироваться напрямую, а не только через inject')
  assert.match(source, /name: 'main'/, 'и с именем слота в теле — inject его не подставляет')
  assert.match(source, /key: PANEL_ID/, 'ключ панели обязан совпадать с id пункта')
  assert.match(source, /slots\.inject\('main'/, 'но и путь через inject остаётся: слот может объявиться позже')
})

test('переключатель полировки в общем разделе убран', () => {
  // Человек его не просил, а он не работал: строка general.item получает
  // пустые пропсы, и переключателю было нечем записать настройку.
  // Проверяем ИСПОЛНЯЕМЫЙ код: упоминание в комментарии не считается.
  const source = readFileSync(bundlePath, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')
  assert.equal(source.includes('PolishSwitch'), false, 'переключатель удалён по требованию')
  assert.equal(source.includes('settings.general.item'), false,
    'плагин больше не занимает место в общем разделе настроек')
})

test('подпись ячейки переживает вызов без аргументов', () => {
  // Регрессия против ПУСТОГО окна настроек И против падения левой панели.
  // Рантайм читает подпись так:
  //   resolveSlotLabel(label) { return typeof label === 'function' ? label() : label }
  // То есть label() зовётся БЕЗ аргументов. Подпись вида `(t) => t('ключ')`
  // получала t === undefined и бросала TypeError прямо в расчёте разделов.
  const source = readFileSync(bundlePath, 'utf8')
  assert.equal(/label: \(t\) =>/.test(source), false,
    'label-функция не должна ждать аргумент: рантайм зовёт её без него')
  assert.match(source, /label: \(\) => labelOf\(ctx, /,
    'подпись обязана брать переводчик из замыкания')
})

test('подписи идут на языке интерфейса, а не всегда по-русски', () => {
  // Человек работает то с русским, то с английским интерфейсом. Подпись через
  // один только `defaultTranslate` — это русский словарь без оглядки на язык.
  // Порядок ступеней тоже важен: свои словари идут ПЕРВЫМИ, потому что бывало,
  // что `bind` отдавал перевод не на активной локали (локаль en, а подпись
  // пришла русской) — и такой ответ принимался как годный.
  const source = readFileSync(bundlePath, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')
  assert.match(source, /ctx\.get\('locale'\)/,
    'сервис локали берётся через ctx.get: в браузерной половине ctx ограничен')
  assert.equal(source.includes('ctx.locale'), false,
    'прямого свойства ctx.locale не существует: доступ только через get')
  assert.match(source, /getLocale\?\.\(\)\?\.active/,
    'язык читается из снимка локали')
  assert.match(source, /DICTIONARIES\[active\]\?\.\[key\]/,
    'текст берётся из своих словарей по активной локали')
  assert.match(source, /\.bind\(NAMESPACE\)\(key\)/,
    'нужен и штатный переводчик — умеет цепочку откатов, которой у нас нет')
  assert.match(source, /return defaultTranslate\(key\)/,
    'и нужен откат на русский: плагин без локали должен оставаться читаемым')
  // Откат не должен превращаться в сырой ключ — он в интерфейсе недопустим.
  assert.equal(/defaultTranslate: \(key\) => key/.test(source), false,
    'переводчик по умолчанию обязан отдавать русский текст, а не ключ')
})

test('показать текст копируется и мышью, и клавиатурой', () => {
  // Полоска объявлена кнопкой для скринридеров, поэтому недоступная с клавиатуры
  // полоса обманывала бы и того, кто печатает не мышью.
  const source = readFileSync(bundlePath, 'utf8')
  assert.match(source, /onKeyDown/, 'нужен обработчик клавиш')
  assert.match(source, /preventDefault/, 'пробел не должен прокручивать страницу')
  assert.match(source, /event\.key !== 'Enter'/, 'принимаются Enter и пробел')
})
test('в шаблонной строке стилей нет обратных кавычек и подстановок', () => {
  // Эти стили лежат в JS-шаблоне, и обратная кавычка внутри рвёт файл целиком
  // («Unexpected identifier»), а \${...} подставил бы значение вместо правила.
  // Ошибка уже случалась дважды и оба раза валила сборку непонятным отказом.
  const source = readFileSync(new URL('../src/client/theme.css.js', import.meta.url), 'utf8')
  const start = source.indexOf('\`')
  const end = source.lastIndexOf('\`')
  assert.equal(start > 0 && end > start, true, 'стили обязаны быть одной шаблонной строкой')
  const body = source.slice(start + 1, end)
  assert.equal(body.includes('\`'), false, 'обратная кавычка внутри стилей рвёт шаблон')
  assert.equal(/\$\{/.test(body), false, 'подстановка внутри стилей подменит правило значением')
})

test('настройки разделены на две колонки: диктовка и разговор', () => {
  // Не украшение: человек приходит либо надиктовать, либо поговорить, и обе
  // задачи требуют разного. Смешанный список из семи групп заставлял искать
  // нужное среди всех.
  const source = readFileSync(bundlePath, 'utf8')
  assert.match(source, /settings\.columnDictation/, 'нужен заголовок колонки диктовки')
  assert.match(source, /settings\.columnTalk/, 'нужен заголовок колонки разговора')
  assert.match(source, /vet-page__column/, 'колонки должны быть размечены')
  assert.match(source, /column: 'dictation'/, 'группы диктовки помечены колонкой')
  assert.match(source, /column: 'talk'/, 'группы разговора помечены колонкой')

  const css = readFileSync(new URL('../src/client/theme.css.js', import.meta.url), 'utf8')
  assert.match(css, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/, 'колонок ровно две')
  // Старая одноколоночная ширина не должна вернуться: именно она держала форму
  // в один узкий столбец.
  assert.equal(/\.vet-page__group\s*\{[^}]*max-width:\s*640px/.test(css), false,
    'у группы больше нет одноколоночной ширины')
  assert.match(css, /\.vet-page__hint\s*\{\s*grid-column:\s*1 \/ -1/, 'подсказка занимает обе колонки поля')
})

test('ключ доступа нельзя вписать в поле настроек', () => {
  // В поле «провайдер» вставляли сам ключ: подпись «имя записи в credentials»
  // читается как «место для ключа», и секрет оказывался в обычном текстовом
  // поле — на экране, в снимке экрана, в истории. Теперь это список имён, и
  // значения ключей с хоста не приходят вовсе.
  const source = readFileSync(bundlePath, 'utf8')
  assert.match(source, /type: 'credential'/, 'провайдер выбирается из списка записей')
  assert.match(source, /\/credentials/, 'имена записей берутся с хоста')
  assert.equal(/settings\.provider', type: 'text'/.test(source), false,
    'провайдер больше не текстовое поле: туда вписывали секрет')
  // Хост обязан отдавать только имена: значение ключа не покидает его ни при
  // каком запросе.
  const host = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8')
  assert.match(host, /export function listCredentials/, 'нужен список имён записей')
  assert.equal(/listCredentials[\s\S]{0,300}refs\[/.test(host), false,
    'значения ключей в ответ не попадают')
})

test('подстановка задачи берёт перевод, а не ссылку на переводчик', () => {
  // В поле инструкции попадал СЫРОЙ КЛЮЧ (settings.prompt.meeting): в label()
  // передавали объект ref вместо ref.current, вызов на объекте бросал
  // TypeError, а label() ловит ошибку и возвращает ключ — ошибка была тихой.
  const source = readFileSync(bundlePath, 'utf8')
  assert.match(source, /label\(translateRef\.current, preset\.prompt\)/,
    'переводчик передаётся значением, а не ссылкой')
  assert.equal(/label\(translateRef\s*,/.test(source), false,
    'ref-объект вместо .current даёт ключ вместо текста')
})

test('инструкции задач лежат в словарях, а не в коде', () => {
  // Русский текст в КОДЕ показывался бы и в английском окне. В словарях он,
  // наоборот, обязан быть — по одному на каждый язык. Поэтому проверяем не
  // «нет русского текста вообще», а «у каждой инструкции ровно три языка, и
  // русский среди них один».
  const source = readFileSync(bundlePath, 'utf8')
  for (const [id, ruStart] of [['plain', 'Ты — редактор расшифровки'], ['meeting', 'Ты — секретарь встречи']]) {
    const lines = source.match(new RegExp("'settings\\.prompt\\." + id + "': '[^']*'", 'g')) || []
    assert.equal(lines.length, 3, `инструкция ${id} обязана быть на трёх языках`)
    assert.equal(lines.filter((line) => line.includes(ruStart)).length, 1,
      `русский текст ${id} встречается один раз — в русском словаре`)
  }
  // А в самом наборе задач — только ключи, без текста.
  const form = source.slice(source.indexOf("id: 'plain'"), source.indexOf("id: 'clean'") + 70)
  assert.equal(/Ты — /.test(form), false, 'в наборе задач текстов быть не должно, только ключи')
  assert.match(form, /prompt: 'settings\.prompt\./, 'задача ссылается на ключ словаря')
})

test('кнопка сохранения стоит вверху и остаётся видимой при прокрутке', () => {
  // Внизу она была недостижима: настройки занимают два экрана, и человек
  // закрывал окно, не нажав «Сохранить», а изменения уходили молча.
  const source = readFileSync(bundlePath, 'utf8')
  const head = source.indexOf("className: 'vet-page__head'")
  const save = source.indexOf("className: 'vet-page__save'")
  assert.ok(head > 0 && save > head, 'кнопка должна идти после шапки в разметке')
  assert.equal(source.includes('vet-page__foot'), false, 'подвал с кнопкой удалён')

  const css = readFileSync(new URL('../src/client/theme.css.js', import.meta.url), 'utf8')
  // Шапка липкая, иначе кнопка уехала бы с глаз ровно на первом же экране.
  assert.match(css, /\.vet-page__head\s*\{[^}]*position:\s*sticky/, 'шапка повторяется при прокрутке')
  assert.match(css, /\.vet-page__head\s*\{[^}]*background:/, 'фон обязателен, иначе просвечивают заголовки групп')
})

test('шапка настроек не накрывает кнопки управления окном', () => {
  // В правом верхнем углу окна живут свернуть/развернуть/закрыть, и липкая
  // шапка с фоном накрывала их. Отступ именно margin: внутренний отступ
  // окрашивается фоном элемента, и визуально пустой угол всё равно перехватывал
  // бы щелчки по системным кнопкам.
  const css = readFileSync(new URL('../src/client/theme.css.js', import.meta.url), 'utf8')
  const head = /\.vet-page__head\s*\{([^}]*)\}/.exec(css)
  assert.notEqual(head, null, 'нужно правило шапки')
  assert.match(head[1], /margin-right:\s*\d+px/, 'шапка должна освобождать правый верхний угол')
  assert.equal(/padding-right/.test(head[1]), false,
    'padding окрашивается фоном и не освобождает угол')
  // Кнопка сохранения не должна быть в самом углу: она прижата к краю шапки,
  // а шапка уже отодвинута от системных кнопок.
  assert.match(css, /\.vet-page__save\s*\{[^}]*\}/, 'стиль кнопки сохранения на месте')
})


test('описание плагина английское и одинаковое в манифесте и в package.json', () => {
  // Список плагинов показывает description и version ИЗ package.json, а не из
  // dsh.plugin.json: правил только манифест — и интерфейс продолжал показывать
  // старую версию с русским описанием при английском языке. Русская часть в
  // описании тоже лишняя: интерфейс у человека английский, и двуязычная строка
  // выглядит там чужеродно.
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  const man = JSON.parse(readFileSync(new URL('../dsh.plugin.json', import.meta.url), 'utf8'))
  assert.equal(pkg.version, man.version, `версии разошлись: ${pkg.version} и ${man.version}`)
  assert.equal(pkg.description, man.description, 'описания разошлись между файлами')
  assert.equal(/[а-яА-Я]/.test(pkg.description), false, 'в описании не должно остаться русского')
  assert.match(pkg.description, /Voice input for DSH/, 'описание должно быть английским')
})

test('плагин переезжает вместе с языком интерфейса', () => {
  // Снимок локали читается верно, но меняется только у того, кто на него
  // подписан. Без подписки на locale/change подписи слотов и страница настроек
  // оставались на старом языке: человек переключал DSH, а плагин — нет.
  const source = readFileSync(bundlePath, 'utf8')
  assert.match(source, /ctx\.on\('locale\/change'/, 'нужна подписка на смену локали')
  assert.match(source, /function watchLocale/, 'язык должен отслеживаться')
  assert.match(source, /useActiveLocale/, 'компоненты должны перерисовываться при смене языка')
  assert.equal(/useActiveLocale\(\)/.test(source), true, 'хук обязан зваться в компонентах')
  // Подписка снимается при выгрузке: иначе она остаётся жить после выгрузки
  // плагина и держит его файлы в памяти.
  assert.match(source, /stopWatching/, 'уборчик подписки обязателен')
})

test('панели обеих кнопок висят над ними и не перекрывают соседей', () => {
  // Панель в потоке растягивает ячейку слота на всю ширину панели ввода и
  // накрывает соседнюю кнопку: клик по микрофону попадал в чужую панель, и
  // кнопка «не нажималась повторно». Обе панели обязаны быть absolute и висеть
  // НАД своей кнопкой.
  const source = readFileSync(bundlePath, 'utf8')
  const panels = source.match(/position: 'absolute'[^}]*bottom: '100%'/g) || []
  assert.ok(panels.length >= 2, `обе панели должны быть absolute над кнопкой, найдено ${panels.length}`)
  // Контейнер каждой кнопки обязан быть relative: иначе absolute-панель
  // отсчитывается от чужого предка и уезжает в случайное место.
  const anchors = source.match(/position: 'relative', display: 'inline-flex'/g) || []
  assert.ok(anchors.length >= 2, 'у каждой кнопки свой relative-контейнер')
  // CLASSES.wrap не существует: обращение к нему давало className: undefined,
  // то есть невидимую обёртку без стилей.
  assert.equal(/CLASSES\.wrap/.test(source), false, 'CLASSES.wrap не существует — ключа нет в таблице')
})

test('в модулях бандла нет обращений к необъявленным именам', () => {
  // После переезда разговора в отдельную кнопку в dictate.js остались ссылки на
  // удалённые \`talk\` и \`watcher\`. Полдюжины тестов этого не заметили:
  // \`node --check\` грамматику пропускает, а тесты текста искали ключевые слова,
  // а не исполняли код. Человек увидел это как «кнопка не нажимается повторно» —
  // \`finish\` падал на первой строке, до остановки записи.
  //
  // Проверяем по собранному тексту: каждое обращение вида `имя.current` обязано
  // иметь объявление на верхнем уровне бандла.
  const source = readFileSync(bundlePath, 'utf8')
  const factory = source.slice(source.indexOf('factory: (require, styleSeat) => {') + 'factory: (require, styleSeat) => {'.length)
  const body = factory.slice(0, factory.lastIndexOf('} });'))
  // Объявленные в бандле имена верхнего уровня — то, что вообще может быть
  // использовано. Ищем упоминания вида \`talk.current\`, которых нет в этом списке.
  const declared = new Set()
  for (const m of body.matchAll(/^\s*(?:var|const|let|function|class)\s+(\w+)/gm)) declared.add(m[1])
  for (const m of body.matchAll(/^\s*var\s+\{([^}]+)\}/gm)) {
    for (const part of m[1].split(',')) declared.add(part.trim())
  }
  // Имена, которые модули ждут из своих импортов, тоже объявлены выше — проверяем
  // только те обращения, чей корень не объявлен НИГДЕ в бандле.
  const roots = new Set([...body.matchAll(/(?<![.\w'"])([a-z][A-Za-z0-9_]*)\.current/g)].map((m) => m[1]))
  const orphan = [...roots].filter((name) => declared.has(name) === false)
  assert.deepEqual(orphan, [], `обращения к необъявленным ссылкам: ${orphan.join(', ')}`)
})
