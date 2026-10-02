// Проверка формы плагина «Глубокий космос» без браузера и без сборки.
// Клиентская половина склеивается движком как обычный скрипт, поэтому здесь
// важнее форма файла, чем картинка.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const client = readFileSync(new URL('lib/client.js', root), 'utf8')
const host = readFileSync(new URL('lib/index.js', root), 'utf8')
const manifest = JSON.parse(readFileSync(new URL('dsh.plugin.json', root), 'utf8'))
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'))

// Клиентская половина — обычный скрипт, склеиваемый движком в общую область:
// импортировать её нельзя, экспортов в ней нет. Поэтому чистые функции
// достаются из исходника по границе `function <имя>(` … строка с отступом 4 и
// закрывающей скобкой, и собираются в песочнице вместе с константами, на
// которые они ссылаются, — значения берутся из самого файла, а не из теста.
function extractConst(name) {
  const start = client.match(new RegExp(`^ {4}const ${name} = `, 'mu'))
  if (start === null) return null
  const from = start.index + start[0].length
  // Объявление заканчивается на первой строке, где скобки сошлись: у
  // Object.freeze([…]) это несколько строк, у числа — одна.
  const tail = client.slice(from)
  let depth = 0
  let line = ''
  for (const part of tail.split('\n')) {
    for (const char of part) {
      if (char === '(' || char === '[' || char === '{') depth += 1
      else if (char === ')' || char === ']' || char === '}') depth -= 1
    }
    line = line === '' ? part : `${line}\n${part}`
    if (depth <= 0) return `const ${name} = ${line}`
  }
  return null
}

function loadHelper(name, extra = []) {
  const names = [name, ...extra]
  const functions = names.map((fn) => {
    const match = client.match(new RegExp(`function ${fn}\\s*\\(([\\s\\S]*?)\\n\\s{4}\\}`, 'u'))
    assert.ok(match, `нет функции ${fn}`)
    return match[0]
  })
  const body = functions.join('\n')
  // В песочницу идут только те константы, на которые реально ссылается
  // выбранный код: лишние были бы шумом, а недостающие дали бы ReferenceError.
  const prelude = []
  for (const declared of client.matchAll(/^ {4}const ([A-Z_0-9]+) = /gmu)) {
    const key = declared[1]
    if (!new RegExp(`\\b${key}\\b`, 'u').test(body)) continue
    const text = extractConst(key)
    if (text !== null) prelude.push(text)
  }
  return new Function(`${prelude.join('\n')}\n${body}\nreturn (${name})`)()
}

test('мост состояния живёт на хосте и не может уронить тему', () => {
  // Хост копит состояние агентов: статус, ошибка, счётчик завершённых ходов.
  assert.match(host, /function createBridge\(\)/u)
  assert.match(host, /on\('api-session\/status'/u)
  assert.match(host, /on\('api-session\/error'/u)
  assert.match(host, /on\('api-session\/removed'/u)
  assert.match(host, /on\('agent\/error'/u)
  // Точный маршрут, а НЕ перехватчик канала. Перехватчик у /api один на всё
  // приложение и принадлежит dsh-api-gateway: забрав его, мы ломали его
  // инициализацию, и весь /api отдавал 404, включая session/create.
  // Точные маршруты хранятся в Map по pathname и уживаются между собой.
  assert.equal(/rpc\.intercept\(/u.test(host), false, 'перехватчик канала убьёт api-gateway')
  assert.match(host, /const STATE_PATH = '\/api\/dsh-poslanik-deep-space\.state'/u)
  assert.match(host, /connection\.fetch\.register\(\{/u)
  assert.match(host, /path: STATE_PATH/u)
  assert.match(host, /methods: \['GET'\]/u)
  assert.match(host, /new Response\(JSON\.stringify\(value\)/u)
  assert.match(host, /'content-type': 'application\/json'/u)
  // Подписки и маршрут не имеют права ронять хост при неожиданных данных.
  assert.match(host, /не удалось подписаться/u)
  assert.match(host, /маршрут состояния не зарегистрирован/u)
  // ctx.inject возвращает функцию отписки, а НЕ результат колбэка. Если
  // записать `const state = ctx.inject(...)`, то state — функция, поле session
  // не читается, и обработчик падает на запасном пути.
  // Комментарии вырезаем: в них ошибка описана словами и попала бы под запрет.
  const hostCode = host.replace(/^\s*\/\/.*$/gmu, '')
  assert.equal(
    /const \w+ = ctx\.inject\(/u.test(hostCode),
    false,
    'результат ctx.inject нельзя присваивать: это функция отписки',
  )
  // Вне колбэка к ctx.config обращаться нельзя: Cordis бросает исключение
  // «cannot get property config without inject», а не отдаёт undefined.
  const handler = hostCode.slice(
    hostCode.indexOf('fetch: async () =>'),
    hostCode.indexOf("ctx.inject(['settings']"),
  )
  assert.equal(
    /ctx\.config/u.test(handler),
    false,
    'ctx.config в обработчике запроса бросает исключение и ломает ответ',
  )
  assert.equal(/state\?\.session/u.test(hostCode), false, 'state — обычный объект, а не результат inject')
  assert.match(host, /const state = \{ session: true \}/u)
  assert.match(host, /state\.session = child\.config\.session !== false/u)
  assert.match(host, /state\.session === false/u)
  // Клиент ходит по своему пути обычным запросом и не трогает чужой канал.
  assert.match(client, /function bindSessionState\(ctx\)/u)
  assert.match(client, /const STATE_PATH = '\/api\/dsh-poslanik-deep-space\.state'/u)
  assert.match(client, /window\.fetch\(STATE_PATH, \{ method: 'GET' \}\)/u)
  assert.equal(/rpc\.call\('\/api'/u.test(client), false, 'общий канал /api трогать нельзя')
  // connection НЕ объявляется в inject: жёсткая зависимость уронила бы всю
  // тему, если канала не окажется. Мост обязан быть необязательным.
  assert.equal(/inject: \[[^\]]*'connection'/u.test(client), false, 'connection в inject уронит тему')
  assert.match(client, /return \{ inject: \['slots'\], apply \}/u)
  // Таймер опроса обязан сниматься, иначе он переживёт тему.
  assert.match(client, /const SESSION_POLL_MS = 1000/u)
  assert.match(client, /window\.clearInterval\(timer\)/u)
  assert.match(client, /const stopBridge = bindSessionState\(ctx\)/u)
})

test('сцена реагирует на состояние: двойная звезда, вспышка, красный отсвет', () => {
  // Приоритет состояния: ошибка важнее генерации.
  const mode = loadHelper('modeFromSnapshot')
  assert.equal(mode({ error: 'boom', running: true }), 'error')
  assert.equal(mode({ error: null, running: true }), 'running')
  assert.equal(mode({ error: null, running: false }), 'awaiting')
  // Список сессий сводится в одно состояние, и рост счётчика виден.
  const reduce = loadHelper('stateFromPayload', ['modeFromSnapshot'])
  const busy = reduce({ sessions: [{ running: true, error: null }], settled: 2 }, { settled: 1 })
  assert.equal(busy.mode, 'running')
  assert.equal(busy.settledUp, true, 'рост счётчика должен быть замечен')
  const still = reduce({ sessions: [{ running: true, error: null }], settled: 1 }, { settled: 1 })
  assert.equal(still.settledUp, false, 'без роста счётчика вспышки быть не должно')
  const failed = reduce({ sessions: [{ running: true, error: 'упало' }], settled: 1 }, { settled: 1 })
  assert.equal(failed.mode, 'error')
  assert.equal(reduce({ sessions: [] }, undefined).mode, 'awaiting', 'пустой список — покой, не обвал')
  assert.equal(reduce(undefined, undefined).mode, 'awaiting', 'мусор на входе — покой, не обвал')
  // Вспышки гаснут сами: иначе красная вспышка у дыры не отпустила бы.
  const reaction = loadHelper('applyReaction')
  const target = { burst: 0, error: 0 }
  reaction('done', target)
  assert.equal(target.burst, 1)
  reaction('error', target)
  assert.equal(target.error, 1)
  // Якорь двойной звезды постоянен: Math.random прыгал бы при каждом populate.
  const star = loadHelper('createDoubleStar')(7)
  const again = loadHelper('createDoubleStar')(7)
  assert.equal(star.anchorX, again.anchorX)
  assert.equal(star.anchorY, again.anchorY)
  assert.equal(star.anchorX >= 0 && star.anchorX <= 1, true)
  assert.match(client, /function drawDoubleStar\(ctx\)/u)
  assert.match(client, /function drawDust\(ctx\)/u)
  // Красный отсвет гаснет вместе со счётчиком, а не по флагу.
  assert.match(client, /if \(state\.error > 0\)/u)
  assert.match(client, /state\.error = Math\.max\(0, state\.error - dt \* 0\.5\)/u)
  assert.match(client, /function updateReactions\(dt\)/u)
  // Тумблер есть и в хосте, и в панели.
  assert.match(host, /session: z\.boolean\(\)\.default\(true\)/u)
  assert.match(client, /switchRow\('session', text\.session, text\.sessionHint\)/u)
  assert.match(client, /session: value\?\.session !== false/u)
})

test('манифест и пакет описывают клиентскую тему', () => {
  assert.equal(manifest.id, 'dsh-poslanik-deep-space')
  assert.equal(manifest.main, './lib/index.js')
  assert.equal(manifest.client.main, './lib/client.js')
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
  assert.equal(pkg.dsh.client.platform, 'web')
  assert.deepEqual(pkg.exports['./client'], './lib/client.js')
  // Страховка от двух прошлых поломок: pnpm однажды молча выбросил ключ
  // `dsh.client`, а пакетная зависимость `dsh-client-ui-slots` такого пакета
  // в поставке DSH не существует — из-за неё клиентская половина падала при
  // импорте, а профиль уходил в safe mode. Клиентской half нужна только
  // платформа, а сервисы приходят из `return { inject: ['slots'], apply }`.
  assert.equal(pkg.dsh.client.inject, undefined, 'inject на несуществующий пакет роняет загрузку темы')
  assert.equal(manifest.client.inject, undefined, 'inject на несуществующий пакет роняет загрузку темы')
  assert.match(client, /return \{ inject: \['slots'\], apply \}/u)
  assert.equal(pkg.dependencies['@deepseek-ai/schemastery'], '3.18.4')
  assert.equal(pkg.version, manifest.version)
})

test('host-половина отдаёт Config и регистрирует настройки', () => {
  assert.match(host, /export const Config = z\.object\(/u)
  assert.match(host, /\.volatile\(\)/u)
  assert.match(host, /child\.settings\.register\(/u)
})

test('клиентская половина без ESM и регистрируется через ModuleLoader', () => {
  assert.match(client, /window\.__ModuleLoader__\.load\(\{/u)
  assert.equal(/^\s*export\b/mu.test(client), false, 'export ломает комбинацию: Unexpected token export')
  assert.equal(/^\s*import\s.+from\b/mu.test(client), false, 'import ломает комбинацию')
  assert.match(client, /inject: \['slots'\]/u)
})

test('космос рисует все слои', () => {
  for (const layer of [
    'drawBackground',
    'drawStars',
    'drawPlanets',
    'drawShips',
    'drawComets',
    'drawMeteors',
    'drawField',
  ]) {
    assert.ok(client.includes(`function ${layer}(`), `нет слоя ${layer}`)
  }
})

test('слой темы под интерфейсом: -1 у картины, 10 у содержимого', () => {
  assert.match(client, /\.\$\{LAYER_CLASS\} \{[^}]*z-index: -1/u)
  assert.match(client, /#root \{[^}]*z-index: 10/u)
  assert.match(client, /position: relative;\s*\n\s*isolation: isolate/u)
})

test('тема живёт на атрибуте и снимается при dispose', () => {
  assert.match(client, /html\[\$\{THEME_ATTR\}\]/u)
  assert.match(client, /setAttribute\(THEME_ATTR, ''\)/u)
  assert.match(client, /removeAttribute\(THEME_ATTR\)/u)
  assert.match(client, /tokens\.restore\(\)/u)
  assert.match(client, /style\?\.remove\(\)/u)
})

test('настройки темы живут в хосте и выводятся в левую панель', () => {
  assert.match(client, /createHostSettingsForm\(ctx, PLUGIN_ID\)/u)
  assert.match(client, /ctx\.slots\.register\(/u)
  assert.equal(/localStorage/u.test(client), false, 'настройки принадлежат хосту, не браузеру')
})

test('настройки переехали из окна настроек в левую панель', () => {
  // Пункт живёт в подвале панели: там штатный якорь с выпадающим окном.
  // `settings.general.item` больше не занимается — общий список настроек чист.
  assert.match(client, /ctx\.slots\.inject\('sidebar\.footer\.action'/u)
  assert.match(client, /name: 'sidebar\.footer\.action', id: 'poslanik-deep-space'/u)
  assert.equal(
    /settings\.general\.item/u.test(client),
    false,
    'настройки темы больше не должны жить в общем окне настроек',
  )
  // Окно уходит в портал: якорь лежит в панели, а само окно перекрывает поле.
  assert.match(client, /require\('react-dom'\)/u)
  assert.match(client, /createPortal\(/u)
  assert.match(client, /primitives\.useAnchoredPosition\(\{/u)
  assert.match(client, /primitives\.useDismissOnOutsidePointer\(rootRef, open, setOpen, panelRef\)/u)
  // Окно раскрывается вверх от кнопки подвала: снизу мешает край экрана.
  assert.match(client, /side: 'top'/u)
  // Светоч: иконка темы, а не абстрактная шестерёнка.
  assert.match(client, /primitives\.IconSparkleRegular/u)
  // Свёрнутая панель — только иконка: подпись рисуется по `wide`.
  assert.match(client, /props\.wide === true \? React\.createElement\('span', \{ className: 'pds-trigger-label' \}, text\.panel\) : null/u)
  // Зазор между иконкой и подписью задан явно. Иконка рисуется SVG, а не
  // текстом, поэтому браузер не вставляет между элементами пробел сам, и
  // пункт читался как «✧Deep space». Размер 8px — как у соседних пунктов
  // панели, у которых gap между глифом и подписью тоже 8px.
  const triggerCss = client.slice(
    client.indexOf('.pds-anchor > .pds-trigger {'),
    client.indexOf('.pds-anchor > .pds-trigger:hover'),
  )
  assert.match(triggerCss, /gap: 8px/u, 'между иконкой и подписью должен быть зазор')
  assert.match(triggerCss, /display: flex/u, 'иконка и подпись должны стоять в ряд')
  assert.match(triggerCss, /align-items: center/u)
  // Свёрнутый вид — круглая кнопка 36×36, и flex-зазор в ней гасится.
  const railCss = client.slice(
    client.indexOf(".pds-anchor[data-rail='true'] > .pds-trigger"),
    client.indexOf('/* Окно живёт вне потока'),
  )
  assert.match(railCss, /gap: 0/u, 'в свёрнутом виде зазор не нужен')
  assert.match(railCss, /padding: 0/u)
  assert.match(railCss, /margin: 0/u)
  // Escape закрывает окно и возвращает фокус кнопке.
  assert.match(client, /if \(event\.key === 'Escape'\)/u)
  assert.match(client, /triggerRef\.current\?\.focus\(\)/u)
  // Окно должно вмещать все настройки, а не обрезать их. Прежняя сетка просила
  // минимум 220 px на текст плюс вторую колонку — при 340 px это не помещалось,
  // и вторая колонка выдавливала соседей за край, а длинные подписи
  // переносились на три строки. Теперь одна колонка и окно шире.
  const popoverCss = client.slice(
    client.indexOf('.pds-popover {'),
    client.indexOf('.pds-popover-header {'),
  )
  assert.match(popoverCss, /width: 420px/u, 'окно должно быть шире прежних 340 px')
  assert.match(popoverCss, /max-width: calc\(100vw - 24px\)/u, 'окно обязано уступать узкому экрану')
  assert.match(popoverCss, /max-height: min\(640px, 82vh\)/u)
  // Строка настройки — по образцу панели «Океан»: значок и подпись слева,
  // управление сразу за подписью, значение прижато вправо.
  const settingsCss = client.slice(
    client.indexOf('.pds-settings {'),
    client.indexOf('.pds-select {'),
  )
  assert.match(settingsCss, /flex-direction: column/u, 'настройки идут в одну колонку')
  assert.match(settingsCss, /\.pds-row \{[\s\S]*?display: flex/u, 'строка настройки должна быть рядом')
  assert.match(settingsCss, /align-items: center/u)
  assert.match(settingsCss, /\.pds-name \{[\s\S]*?flex: 0 0 148px/u, 'подпись занимает свою колонку, как в панели «Океан»')
  assert.match(settingsCss, /text-overflow: ellipsis/u, 'длинная подпись гаснет многоточием, а не рвётся')
  assert.match(settingsCss, /\.pds-control \{[\s\S]*?flex: 1 1 auto/u, 'управление занимает середину строки, а значение — правый край')
  assert.equal(
    /minmax\(220px, 1fr\)/u.test(client),
    false,
    'прежняя сетка резервировала 220 px и выдавливала вторую колонку за окно',
  )
  assert.equal(
    /pds-switch|pds-range|pds-settings-copy/u.test(client),
    false,
    'старые строки с подсказкой в ряд должны быть убраны',
  )
  // Значение ползунка — своей колонкой, чтобы проценты не прыгали.
  assert.match(client, /\.pds-value \{[\s\S]*?font-variant-numeric: tabular-nums/u)
  assert.match(client, /'pds-value'/u, 'в строке ползунка должно быть значение')
  // Подсказки ушли из строк в тултип: кнопка «?» и карточка в портале.
  assert.match(client, /function HintButton\(props\)/u)
  assert.match(client, /className: 'pds-hint'/u)
  assert.match(client, /className: 'pds-tip'/u)
  assert.match(client, /role: 'tooltip'/u)
  assert.match(client, /createPortal\([\s\S]*?document\.body/u, 'карточка подсказки обязана уйти в портал')
  // Панель прижата к краю окна: карточка встаёт слева от кнопки, а если не
  // поместилась — под строкой, и никогда не выходит за поле.
  assert.match(client, /const beside = rect\.left - size\.width - 8 >= TIP_MARGIN/u)
  assert.match(client, /pointer-events: none/u, 'подсказка не должна ловить мышь')
  // Кнопка подсказки лежит рядом с меткой, но не внутри `<label>`: внутри
  // нажатие на «?» переключало бы тумблер вместо показа подсказки.
  assert.match(client, /React\.createElement\('label', \{ className: 'pds-name', htmlFor: `pds-\$\{key\}` \}, title\)/u)
  assert.equal(/React\.createElement\(\s*\n\s*'label',\s*\n\s*\{ className: 'pds-switch'/u.test(client), false)
  // Шрифт внутри окна: подпись 12 px, значение и выбор 11 px. Мелких 10 px в
  // строках больше нет — из-за них окно и читалось как простыня.
  assert.match(client, /\.pds-row \{[\s\S]*?font-size: 12px/u)
  assert.match(client, /\.pds-value \{[\s\S]*?font-size: 11px/u)
  assert.match(client, /\.pds-select \{[^}]*font-size: 11px/u)
  assert.match(client, /\.pds-tip \{[\s\S]*?font-size: 11px/u)
  // Значки по контексту. В примитивах интерфейса нет ни планеты, ни кометы, ни
  // чёрной дыры, а «Архив» или «Часы» соврали бы, поэтому значки свои: один
  // штрих, currentColor, ноль внешних запросов.
  assert.match(client, /const GLYPHS = Object\.freeze\(\{/u)
  for (const key of ['stars', 'constellations', 'ships', 'comets', 'planets', 'suns', 'blackholes', 'session']) {
    assert.match(client, new RegExp(`^ {6}${key}: '`, 'mu'), `нет значка для ${key}`)
  }
  assert.match(client, /function glyphIcon\(name\)/u)
  assert.match(client, /stroke: 'currentColor'/u)
  assert.match(client, /'aria-hidden': 'true'/u)
  assert.match(client, /focusable: 'false'/u)
  // Значок не должен тянуть за собой ничего извне: ни картинки, ни шрифта.
  assert.equal(/pds-glyph[^}]*url\(/u.test(client), false, 'значок не должен ссылаться на внешний ресурс')
  // Выключенный тумблер гасит и значок — иначе строка выглядит включённой.
  assert.match(client, /\.pds-row\[data-on='false'\] > \.pds-glyph \{ opacity: 0\.4; \}/u)
  assert.match(client, /'data-on': on === undefined \? undefined : on \? 'true' : 'false'/u)
  // Подписи ползунков и выбора тоже с значком: яркость, скорость, кадры, число
  // фигур. Значок берётся по ключу настройки, поэтому у каждой строки он свой.
  for (const key of ['brightness', 'planets', 'constellationCount']) {
    assert.ok(client.includes(`'${key}',`), `нет строки ${key}`)
  }
  assert.match(client, /shell\(\n {10}'frameRate',/u, 'нет строки выбора частоты кадров')
  assert.match(client, /glyphIcon\(key\)/u, 'строка берёт значок по своему ключу')
})

test('панель двуязычная, а язык следует за языком интерфейса хоста', () => {
  assert.match(client, /const STRINGS = Object\.freeze\(\{/u)
  assert.match(client, /en: \{/u)
  // Переключателя в панели нет: язык задаёт хост (@deepseek-ai/dsh-client-locale)
  // и кладёт выбор в атрибут `lang` корневого элемента документа.
  assert.equal(/pds-lang/u.test(client), false, 'переключатель языка должен быть убран')
  assert.equal(/langLabel/u.test(client), false, 'строки «Язык панели» больше нет')
  assert.match(client, /const host = \(document\.documentElement\.lang \|\| ''\)\.toLowerCase\(\)/u)
  assert.match(client, /if \(host\.startsWith\('en'\)\) return 'en'/u, 'английский интерфейс даёт английскую панель')
  assert.match(client, /navigator\.language/u, 'незнакомый хост уходит на язык браузера, а не на русский молча')
  assert.match(client, /attributeFilter: \['lang'\]/u, 'смена языка хоста должна переводить открытую панель')
  assert.match(client, /const text = translator\(hostLanguage\.get\(\)\)/u)
  assert.match(client, /langNote/u, 'в окне должно быть видно, откуда берётся язык')
  assert.equal(/language: Language\(\)/u.test(host), false, 'язык панели больше не настройка хоста')
  assert.equal(/localStorage/u.test(client), false, 'настройки принадлежат хосту, не браузеру')
})

test('потолок кадров живёт в движке и в панели настроек', () => {
  assert.match(client, /const FPS_CHOICES = \[0, 15, 30, 60\]/u)
  assert.match(client, /const DEFAULT_FPS = 30/u)
  assert.match(client, /accumulator: 0/u)
  assert.match(client, /frameInterval: frameIntervalFrom\(DEFAULT_FPS\)/u)
  // Недобор кадра пропускает отрисовку целиком, а не часть слоёв.
  assert.match(client, /if \(this\.accumulator < this\.frameInterval\) return/u)
  assert.match(client, /space\.frameInterval = frameIntervalFrom\(value\.fps\)/u)
  assert.match(client, /props\.controller\.set\(\{ fps: Number\(event\.target\.value\) \}\)/u)
  // Скорость планет крутится в панели рядом с яркостью: 10–200 %, шаг 5.
  assert.match(client, /sliderRow\('planets', text\.planetSpeed, text\.planetSpeedHint/u)
  assert.match(client, /\{ min: 10, max: 200, step: 5 \}, speedPercent/u)
  assert.match(client, /props\.controller\.set\(\{ planetSpeed: next \/ 100 \}\)/u)
  assert.match(host, /planetSpeed: z\.number\(\)\.min\(0\.1\)\.max\(2\)\.default\(1\)/u)
})

test('корабли мелкие, с корпусом, тягой и шлейфом', () => {
  assert.match(client, /function updateShips\(dt, width, height\)/u)
  assert.match(client, /const count = 3 \+ Math\.floor\(Math\.random\(\) \* 2\)/u)
  assert.match(client, /size: 3 \+ depth \* 10/u)
  assert.match(client, /trail\.length > 34/u)
  assert.match(client, /ship\.bank = lerp/u)
  assert.match(client, /ship\.throttle = lerp/u)
  assert.match(client, /ctx\.ellipse\(-size \* 0\.85/u)
  // createShips была определена дважды, и вторая перекрывала первую. Тест
  // молча проверял мёртвый код, поэтому реальные корабли не проверял вовсе.
  assert.equal(
    (client.match(/function createShips\s*\(/gu) || []).length,
    1,
    'функция createShips должна быть ровно одна',
  )
})

test('корабли идут маршрутом, а не кружат на месте', () => {
  // Прежний код копил замысел небольшими доворотами и держал скорость
  // 2–16 px/с. За 30 секунд — время, за которое глаз замечает корабль, — он
  // проходил 8 % ширины экрана и доворачивал раньше, чем уходил из поля
  // зрения. Траектория замыкалась: корабли «летали по кругу».
  // Теперь курс задаётся точкой назначения, а скорость такова, что корабль
  // за полминуты уходит на треть экрана.
  assert.match(client, /function pickWaypoint\(ship\)/u)
  assert.match(client, /const goalDx = \(ship\.goalX - ship\.x\) \* width/u)
  assert.match(client, /const goalDy = \(ship\.goalY - ship\.y\) \* height/u)
  assert.match(client, /Math\.atan2\(goalDy, goalDx\) \+ rand\(-0\.18, 0\.18\)/u)
  // Цель отсчитывается ОТ КОРАБЛЯ. От центра экрана маршрут замыкался вокруг
  // середины неба: медианный бокс траектории за 30 с был 0.44 ширины экрана,
  // 41 % окон меньше 0.4. От корабля p90 бокса растёт с 0.71 до 1.16.
  assert.match(client, /ship\.goalX = ship\.x \+ Math\.cos\(angle\) \* reach/u)
  assert.match(client, /ship\.goalY = ship\.y \+ Math\.sin\(angle\) \* reach \* 0\.5625/u)
  assert.match(client, /const speed = 14 \+ depth \* 46/u)
  // Смена цели не чаще раза в 5–12 с, иначе траектория дрожит.
  assert.match(client, /ship\.cooldown = rand\(5, 12\)/u)
  // Никакого накопления замысла больше нет — это и было причиной круга.
  assert.equal(
    /ship\.targetHeading \+=/u.test(client),
    false,
    'накопление замысла возвращает кружение на месте',
  )
  assert.equal(
    /ship\.energy -= /u.test(client),
    false,
    'смена цели не должна требовать энергии: маршрутная точка не манёвр',
  )
  // Инерция при этом цела: маршрутная точка задаёт ЦЕЛЬ, а не траекторию.
  // Прежде скорость пересчитывалась из курса каждый кадр, и вектор движения
  // всегда совпадал с курсом: корабль менял направление рывком, без массы.
  assert.equal(
    /ship\.vx = Math\.cos\(ship\.heading\)/u.test(client),
    false,
    'скорость не должна вычисляться из курса — это убивает инерцию',
  )
  assert.match(client, /const applied = clamp\(difference, -maxTurn, maxTurn\)/u)
  assert.match(client, /const maxTurn = \(SHIP_TURN \* \(0\.5 \+ 0\.5 \* ship\.energy\)\) \* dt/u)
  // Модуль скорости меняется с ускорением, а не скачком.
  assert.match(client, /const nextSpeed = current \+ clamp\(target - current, -SHIP_ACCEL \* dt, SHIP_ACCEL \* dt\)/u)
  assert.match(client, /ship\.vx = Math\.cos\(nextAngle\) \* nextSpeed/u)
  // Нос смотрит по фактической скорости, поэтому на вираже отстаёт от цели.
  assert.match(client, /ship\.heading = nextAngle/u)
  assert.match(client, /const SHIP_ACCEL = 24/u)
  assert.match(client, /const SHIP_TURN = 0\.55/u)
  // Вылетев за край, корабль берёт новую цель: вошедший тем же курсом, каким
  // вышел, читался бы как замкнутая петля.
  const wrap = client.slice(client.indexOf('if (ship.x < -0.15'), client.indexOf('const point = shipPoint'))
  assert.match(wrap, /pickWaypoint\(ship\)/u, 'облёт края обязан брать новую цель')
  assert.match(wrap, /ship\.trail\.length = 0/u, 'облёт края обязан чистить шлейф')
})

test('далёкие облака живут на дальнем плане и дышат в кадре', () => {
  assert.match(client, /const CLOUD_COUNT = 7/u)
  // Облака крупнее туманностей (0.22–0.5): это массы, а не дымка.
  assert.match(client, /const CLOUD_MIN = 0\.34/u)
  assert.match(client, /const CLOUD_MAX = 0\.78/u)
  assert.match(client, /function createClouds\(\)/u)
  // Неровный край собирается из ореолов, ровный круг читался бы как пятно.
  assert.match(client, /function paintCloudGlow\(ctx, cx, cy, radius, cloud, alpha\)/u)
  assert.match(client, /for \(const lobe of cloud\.lobes\)/u)
  // Зёрна — скопление звёзд, а не однородная краска.
  assert.match(client, /function paintCloudGrain\(ctx, cx, cy, radius, cloud, alpha, time\)/u)
  assert.match(client, /ctx\.arc\(gx, gy, size, 0, TAU\)/u)
  // Облака рисуются в кадре, а не в кэше полос: полоса пересобирается только
  // при смене размера, и дышащие облака в ней застыли бы навсегда.
  assert.equal(
    /paintClouds\(space\.bands\./u.test(client),
    false,
    'облака нельзя класть в кэш полос — время там стоит',
  )
  const frame = client.slice(client.indexOf('ctx.clearRect(0, 0, this.width, this.height)'))
  const cloudsAt = frame.indexOf('paintClouds(ctx, this.width, this.height, this.time)')
  const dimStars = frame.indexOf("drawStars(ctx, this.width, this.time, 'dim')")
  const brightStars = frame.indexOf("drawStars(ctx, this.width, this.time, 'bright')")
  const planets = frame.indexOf('drawPlanets(')
  assert.ok(cloudsAt !== -1, 'облака должны рисоваться в кадре')
  assert.ok(dimStars !== -1 && brightStars !== -1 && planets !== -1, 'разметка кадра изменилась')
  assert.ok(cloudsAt > dimStars, 'облака ложатся поверх газа, иначе дымка их съест')
  assert.ok(cloudsAt < brightStars, 'облака идут под яркими звёздами')
  assert.ok(cloudsAt < planets, 'облака остаются на дальнем плане, ниже планет')
  // Газ приглушает тусклые звёзды; облака должны весить не больше их.
  assert.match(client, /const breathe = 1 - cloud\.breatheDepth \* 0\.5/u)
  assert.match(client, /breatheRate: rand\(0\.05, 0\.13\)/u)
  // Облако шире экрана: копии слева и справа, иначе на краю неба виден обрыв.
  assert.match(client, /const first = Math\.ceil\(\(-radius - base\) \/ width\)/u)
  assert.match(client, /const last = Math\.floor\(\(width \+ radius - base\) \/ width\)/u)
})

test('планеты чёткие: терминатор, рельеф, лимб и кольцо в два слоя', () => {
  assert.match(client, /function drawRing\(ctx, planet, x, y, radius, half\)/u)
  assert.match(client, /drawRing\(ctx, planet, x, y, radius, 'back'\)/u)
  assert.match(client, /drawRing\(ctx, planet, x, y, radius, 'front'\)/u)
  assert.match(client, /body\.addColorStop\(1, 'hsla\(0, 0%, 0%, 0\)'\)/u)
  assert.match(client, /ctx\.arc\(x, y, radius \* 0\.985, lit - 1\.05, lit \+ 1\.05\)/u)
  assert.match(client, /planet\.bands/u)
  assert.match(client, /planet\.spots/u)
  assert.match(client, /kinds = \['gas', 'rock', 'ice'\]/u)
})

test('светила: карлики, солнца и чёрные дыры', () => {
  assert.match(client, /function createDwarfs\(\)/u)
  assert.match(client, /function createSuns\(\)/u)
  assert.match(client, /function createBlackHoles\(\)/u)
  assert.match(client, /function drawSuns\(ctx, width, height\)/u)
  assert.match(client, /function drawBlackHoles\(ctx, width, height\)/u)
  assert.match(client, /photонное кольцо|Фотонное кольцо/u)
  assert.match(client, /drawDwarfs\(ctx, this\.width, this\.height\)/u)
  assert.match(client, /drawBlackHoles\(ctx, this\.width, this\.height\)/u)
  assert.match(client, /features: Object\.freeze\(\{/u)
  assert.match(host, /z\.boolean\(\)\.default\(true\)\.description\('Чёрные дыры/u)
  // Перечисления языка в схеме больше нет: язык панели следует за языком
  // интерфейса хоста, а не выбирается в настройках темы.
  assert.equal(/z\.const\('auto'\)/u.test(host), false, 'язык панели больше не перечисление в схеме')
})

test('host-половина грузится с настоящим schemastery', async (t) => {
  // Статическая проверка всегда: в schemastery 3.18.4 нет z.enum, такое поле
  // роняет загрузку хоста, и плагин пропадает с экрана без единой ошибки в UI.
  assert.equal(/z\.enum\(/u.test(host), false, 'z.enum в schemastery отсутствует — используйте z.union из z.const')
  assert.match(host, /const Fps = \(\) => z\.union/u)

  let module
  try {
    module = await import('../lib/index.js')
  } catch (error) {
    if (/Cannot find package|Cannot find module/u.test(error.message)) {
      t.skip('schemastery не установлен: выполните pnpm install')
      return
    }
    throw error
  }
  assert.equal(typeof module.apply, 'function')
  assert.equal(typeof module.Config, 'function')

  // Языка панели в схеме больше нет: он следует за языком интерфейса хоста,
  // и держать его ещё и здесь было бы вторым местом, где язык расходится с
  // интерфейсом. Старое значение из cordis-патча не должно ломать загрузку.
  assert.doesNotThrow(() => module.Config({}))
  assert.doesNotThrow(() => module.Config({ underlay: true, intensity: 1.2 }))
  assert.doesNotThrow(() => module.Config({ language: 'auto' }))

  // Потолок кадров — то же перечисление через z.union из z.const: значения из
  // панели принимаются, посторонние отвергаются. Проверено на 3.18.4: union
  // строг и 999 отвергает так же, как 7, — в отличие от z.number(), где
  // нечётное значение прошло бы молча. Второй рубеж — normalizeSettings в
  // клиенте, на случай старого хоста без поля fps в cordis-патче.
  for (const fps of [0, 15, 30, 60]) {
    assert.doesNotThrow(() => module.Config({ fps }), `fps ${fps} должен приниматься`)
  }
  assert.throws(() => module.Config({ fps: 7 }), /expected .*0.*15.*30.*60/su)
  assert.throws(() => module.Config({ fps: 999 }), /expected .*0.*15.*30.*60/su)

  for (const field of ['enabled', 'stars', 'ships', 'comets', 'planets', 'perturbation', 'underlay', 'suns', 'blackholes', 'intensity', 'fps']) {
    assert.ok(Object.hasOwn(module.Config({}), field), `в схеме нет поля ${field}`)
  }
  // Поле volatile: Config отдаёт обёртку записи, а не значение, поэтому
  // умолчание проверяем по объявлению — в схеме и в клиентских дефолтах.
  assert.match(host, /fps: Fps\(\)\.default\(30\)/u)
  assert.match(client, /^ {6}fps: DEFAULT_FPS,$/mu)
})

test('уважает prefers-reduced-motion и остановку вкладки', () => {
  assert.match(client, /prefers-reduced-motion: reduce/u)
  assert.match(client, /visibilitychange/u)
  assert.match(client, /cancelAnimationFrame/u)
})

test('ограничение кадров нормализуется к разрешённым значениям', () => {
  const frameIntervalFrom = loadHelper('frameIntervalFrom')
  assert.equal(frameIntervalFrom(30), 1 / 30)
  assert.equal(frameIntervalFrom(15), 1 / 15)
  assert.equal(frameIntervalFrom(60), 1 / 60)
  assert.equal(frameIntervalFrom(0), 0, 'ноль означает «без ограничения»')
  assert.equal(frameIntervalFrom(999), 1 / 30, 'неизвестное значение даёт безопасные 30')
  assert.equal(frameIntervalFrom(undefined), 1 / 30)
  assert.equal(frameIntervalFrom('30'), 1 / 30, 'строка из формы не ломает нормализацию: тоже безопасные 30')
})

test('возмущение от мыши тихое: и не копится, и не светится', () => {
  // Копление энергии при медленном движении мыши.
  assert.match(client, /speed \* 0\.00008/u)
  // Затухание быстрое: 0.08 держало шар живым заметно дольше.
  assert.match(client, /field\.energy \*= Math\.pow\(0\.02, dt\)/u)
  // Радиус теснее прежнего 96 + energy * 96.
  assert.match(client, /field\.radius = 70 \+ field\.energy \* 58/u)
  // Кольца появляются только при большой энергии: раньше порог был 0.55.
  assert.match(client, /field\.energy > 0\.72/u)
  // Свечение под курсором — намёк, а не прожектор: потолок альфы 0.035.
  assert.match(client, /field\.energy \* 0\.03, 0, 0\.035/u)
  assert.match(client, /field\.energy \* 0\.12, 0, 0\.14/u)
  assert.equal(/0\.085, 0, 0\.1/u.test(client), false, 'старое сильное свечение вернулось')
  assert.equal(/energy \* 0\.26, 0, 0\.3/u.test(client), false, 'старая яркая точка вернулась')
  // Звёзды под курсором почти не деформируются: 0.45 и 0.18 были заметно.
  assert.match(client, /1 \+ warped\.glow \* 0\.16/u)
  assert.match(client, /1 \+ warped\.glow \* 0\.06/u)
  assert.equal(/warped\.glow \* 0\.45/u.test(client), false, 'старое искажение звёзд вернулось')
  // Сам факт возмущения остался: тумблер не должен исчезнуть вместе с числом.
  assert.match(client, /function steerField\(field, x, y, dt\)/u)
  assert.match(client, /function warpField\(field, x, y, depth\)/u)
  assert.match(client, /switchRow\('perturbation', text\.perturbation, text\.perturbationHint\)/u)
})

// Методы объекта space объявлены с отступом 6 и закрываются строкой `      },`
// — по ней и вырезаем тело, чтобы проверить, что именно попадает в кадр.
function sliceMethod(name) {
  const start = client.search(new RegExp(`^ {6}${name}\\(`, 'mu'))
  assert.notEqual(start, -1, `нет метода ${name}`)
  const end = client.indexOf('\n      },', start)
  assert.notEqual(end, -1, `не найден конец метода ${name}`)
  return client.slice(start, end)
}

test('подпись полос меняется только при смене размера или dpr', () => {
  const bandSignature = loadHelper('bandSignature')
  assert.equal(bandSignature(1920, 1080, 2), '1920x1080@2')
  assert.equal(bandSignature(1920, 1080, 2), bandSignature(1920, 1080, 2))
  assert.notEqual(bandSignature(1920, 1080, 2), bandSignature(1600, 900, 2))
  assert.notEqual(bandSignature(1920, 1080, 2), bandSignature(1920, 1080, 1))
  assert.notEqual(bandSignature(1920, 1080, 2), bandSignature(1920, 1081, 2))
  // Дробные размеры округляются: ресайз на полпикселя не должен жечь кэш.
  assert.equal(bandSignature(1920.4, 1080.6, 2), bandSignature(1920, 1081, 2))
})

test('сдвиг полосы не выходит за период и живёт по кругу', () => {
  const bandShift = loadHelper('bandShift')
  // Полоса повторяется с шагом BAND_PERIOD = 1.2 экрана, как и сами
  // туманности: сдвиг в пределах периода показывает ту же картину.
  const period = 1.2 * 1920
  for (const time of [0, 0.5, 7, 100, 3600, 12345.6]) {
    const shift = bandShift(time, 5.4, period)
    assert.ok(shift >= 0 && shift < period, `сдвиг ${shift} вне периода ${period}`)
  }
  assert.equal(bandShift(12, 1, 0), 0, 'нулевой период не делит на ноль')
  assert.ok(bandShift(60, 5.4, period) > 0, 'полоса и правда двигается')
  // Дальняя полоса медленнее ближней — иначе это не параллакс.
  const far = client.match(/BAND_DRIFT = Object\.freeze\(\{ far: ([\d.]+), mid: ([\d.]+), near: ([\d.]+) \}\)/u)
  assert.ok(far, 'нет константы BAND_DRIFT')
  const [farSpeed, midSpeed, nearSpeed] = far.slice(1).map(Number)
  assert.ok(farSpeed > 0 && farSpeed < midSpeed && midSpeed < nearSpeed, 'дрейф полос должен расти к ближней')
})

test('фон и туманности живут в кэше полос, а не в кадре', () => {
  // Полосы созданы вместе со сценой, а не по требованию кадра.
  assert.match(client, /bands: \{ far: createBand\(\), mid: createBand\(\), near: createBand\(\) \}/u)
  assert.match(client, /bandsSignature: null/u)
  assert.match(client, /function createBand\(\) \{/u)
  assert.match(client, /return \{ canvas, ctx: canvas\.getContext\('2d'\), signature: null \}/u)

  // Кэш собирается на ресайзе и после пересборки туманностей.
  assert.match(sliceMethod('resize'), /renderBands\(\)/u)
  assert.match(sliceMethod('populate'), /renderBands\(\)/u)

  // Подпись держит перерисовку: тот же размер и dpr — выход немедленно.
  assert.match(client, /if \(space\.bandsSignature === signature && space\.bandsStars === space\.options\.stars\) return/u)
  assert.match(client, /band\.canvas\.width = Math\.max\(1, Math\.round\(width \* dpr\)\)/u)
  assert.match(client, /band\.ctx\.setTransform\(dpr, 0, 0, dpr, 0, 0\)/u)

  // В кадре — три блита и ни одного градиента: туманности строит кэш.
  const render = sliceMethod('render')
  for (const key of ['far', 'mid', 'near']) {
    assert.match(render, new RegExp(`drawImage\\(space\\.bands\\.${key}\\.canvas,`, 'u'), `нет блита полосы ${key}`)
  }
  assert.equal(/createRadialGradient/u.test(render), false, 'градиенты туманностей строятся в кэше полос')
  assert.equal(/createNebulae\(/u.test(render), false, 'туманности не создаются в кадре')
  assert.equal(/createLinearGradient/u.test(render), false, 'градиент неба лежит в дальней полосе')
  // Прямой путь остаётся только на случай, когда кэш ещё не собран.
  assert.match(render, /if \(this\.bandsSignature === null\) \{/u)
  assert.equal((render.match(/drawBackground\(/gu) || []).length, 1)
  // Дальняя полоса несёт небо, ближняя — остальные туманности и пыль.
  assert.match(client, /paintSky\(space\.bands\.far\.ctx/u)
  assert.match(client, /paintNearDust\(space\.bands\.near\.ctx/u)
  // Копии туманностей кладутся на период, иначе широкая туманность вылезет
  // обрывом на краю холста при переходе сдвига через ноль.
  assert.match(client, /const BAND_PERIOD = 1\.2/u)
  assert.match(client, /const first = Math\.ceil\(\(-radius - base\) \/ period\)/u)
  assert.match(client, /const cx = base \+ step \* period/u)
})

test('звёзды идут слоями на разной скорости, и у каждой звезды свой разброс', () => {
  // Прежние 2.5 + depth * 9 давали 5–11 px/с — неподвижная на глаз картина.
  // Слои потом замедлены вдвое: максимум упал с 44 до 22, разрыв сохранён.
  assert.match(client, /const drifts = \[5, 11, 22\]/u)
  assert.match(client, /flow: 0\.8 \+ Math\.random\(\) \* 0\.5/u)
  assert.match(client, /time \* layer\.drift \* star\.flow/u)
  // Слои должны различаться и по алфавиту, и по размеру — иначе разница
  // скоростей не читается как глубина.
  const sizes = client.match(/const sizes = \[\[([\d.]+), ([\d.]+)\], \[([\d.]+), ([\d.]+)\], \[([\d.]+), ([\d.]+)\]\]/u)
  assert.ok(sizes, 'нет трёх размерных полос звёзд')
  assert.ok(Number(sizes[1]) < Number(sizes[3]) && Number(sizes[3]) < Number(sizes[5]), 'размеры слоёв не растут')
})

test('планеты влетают с разных сторон и крутятся вокруг оси', () => {
  assert.match(client, /const PLANET_SIDES = \['left', 'right', 'top', 'bottom'\]/u)
  assert.match(client, /function spawnPlanet\(planet, width, height\)/u)
  // Планеты живут в пикселях, а не в долях экрана: физике нужны настоящие
  // расстояния, иначе притяжение считалось бы в разных единицах.
  assert.match(client, /if \(side === 'left'\) planet\.x = -margin/u)
  assert.match(client, /else if \(side === 'right'\) planet\.x = width \+ margin/u)
  assert.match(client, /if \(side === 'top'\) planet\.y = -margin/u)
  assert.match(client, /else if \(side === 'bottom'\) planet\.y = height \+ margin/u)
  assert.equal(/planet\.px\b/u.test(client), false, 'доли экрана в физике больше не участвуют')
  assert.equal(/planet\.py\b/u.test(client), false, 'доли экрана в физике больше не участвуют')
  // Размеры нужны при рождении, поэтому наполнение идёт после resize.
  assert.match(client, /this\.planets = createPlanets\(this\.width, this\.height\)/u)
  // Движение и разделение вынесены из отрисовки в отдельный шаг кадра.
  assert.match(client, /function updatePlanets\(dt, width, height\)/u)
  assert.match(client, /if \(this\.options\.planets !== false\) updatePlanets\(step, this\.width, this\.height\)/u)
  const draw = client.slice(client.indexOf('function drawPlanets'), client.indexOf('function drawComets'))
  assert.equal(/planet\.x \+=/u.test(draw), false, 'отрисовка не должна двигать планеты')
  // Вращение вокруг оси не должно двигать источник света.
  assert.match(client, /spin: rand\(0\.02, 0\.085\)/u)
  assert.match(client, /planet\.spinAngle \+= planet\.spin \* step/u)
  assert.match(client, /ctx\.rotate\(planet\.spinAngle\)/u)
  // Полосы остались как зона появления, но больше не зажимают полёт.
  assert.match(client, /planet\.laneTop = index \/ count/u)
  assert.match(client, /planet\.laneBottom = \(index \+ 1\) \/ count/u)
  assert.equal(/planet\.py = clamp\(/u.test(client), false, 'зажим по полосе больше не применяется')
})

test('планеты не наезжают: гравитация тянет, разделение запрещает', () => {
  // Притяжение симметрично: минус у второй планеты, иначе система тащила бы
  // энергию из ниоткуда и планеты разлетались бы по спирали.
  assert.match(client, /function applyPlanetGravity\(dt\)/u)
  assert.match(client, /a\.vx \+= fx/u)
  assert.match(client, /b\.vx -= fx/u)
  assert.match(client, /a\.vy \+= fy/u)
  assert.match(client, /b\.vy -= fy/u)
  // Масса нормализована. Раньше брался квадрат радиуса дважды: произведение
  // выходило порядка 65 миллионов, и планета получала десятки тысяч пикселей
  // в секунду за кадр — перелетала экран и перерождалась, отсюда «снаряды».
  assert.match(client, /function planetMass\(planet\)/u)
  assert.match(client, /const scaled = planet\.radius \/ 100/u)
  assert.match(client, /planetMass\(a\) \* planetMass\(b\)/u)
  assert.equal(
    /a\.radius \* a\.radius \* b\.radius \* b\.radius/u.test(client),
    false,
    'масса снова не нормализована',
  )
  // Потолок ускорения: притяжение искривляет путь, но не выбрасывает за экран.
  // Значение намеренно малое — 0.06, а не прежние 5. При потолке 5 притяжение
  // разгоняло планету втрое от её собственной скорости, а симметричные
  // импульсы в консервативной системе честно замыкали орбиту: замеренная
  // петля (мера замкнутости траектории, 0 — прямая) p90 была 0.289 при 5
  // против 0.031 при 0.06.
  assert.match(client, /const PLANET_MAX_ACCEL = 0\.06/u)
  assert.match(client, /Math\.min\(PLANET_MAX_ACCEL, /u)
  // Потолок скорости — жёсткая гарантия: разогнаться планете нечем.
  assert.match(client, /const PLANET_MAX_SPEED = 42/u)
  // Потолок урезается множителем дрейфа, иначе гравитация снова вытолкнула бы
  // планету на прежнюю скорость при вдвое медленном режиме.
  assert.match(client, /const limit = PLANET_MAX_SPEED \* planetDriftScale\(\)/u)
  assert.match(client, /const scale = limit \/ speed/u)
  assert.match(client, /planet\.vx \*= scale/u)
  // Скорость обратно пропорциональна размеру — это и есть «чем массивнее
  // планета, тем медленнее»: CRUISE * (REF_RADIUS / radius). Отношение
  // обратное, а не «минус доля размера»: так падение темпа держится при любых
  // радиусах. Замер на 300 выборках: r≈44 → 11.05 px/с, r≈81 → 5.98 px/с.
  assert.match(client, /function planetCruiseSpeed\(planet\)/u)
  assert.match(client, /const inverse = PLANET_REF_RADIUS \/ Math\.max\(1, planet\.radius\)/u)
  assert.match(client, /return PLANET_CRUISE \* inverse \* planet\.speedBias \* planet\.depth \* planetDriftScale\(\)/u)
  // Гомеостаз скорости: скорость не прилипает к крейсерской сразу и не
  // выбивается притяжением. Экспоненциальное сглаживание устойчиво при любом
  // dt, в том числе при низком FPS, где шаг за секунду обычным множителем
  // прыгнул бы мимо цели.
  assert.match(client, /function settlePlanetSpeed\(planet, dt\)/u)
  assert.match(client, /const blend = 1 - Math\.exp\(-PLANET_RELAX \* dt\)/u)
  assert.match(client, /settlePlanetSpeed\(planet, dt\)/u)
  // Блуждание курса — единственное необратимое воздействие модели. Без него
  // система консервативна, любой захваченный конфиг повторяется вечно, и круг
  // был не дефектом отрисовки, а следствием законов сохранения.
  assert.match(client, /function wanderPlanetHeading\(planet, dt\)/u)
  assert.match(client, /\(bounded \* PLANET_WANDER \* dt \* Math\.PI\) \/ 180/u)
  assert.match(client, /wanderPlanetHeading\(planet, dt\)/u)
  // Множитель приходит из настроек темы и уважает границы 0.1–2.
  assert.match(client, /function planetDriftScale\(\)/u)
  assert.match(client, /Number\(space\.options\?\.planetSpeed\)/u)
  assert.match(client, /Math\.min\(2, Math\.max\(0\.1, planetSpeed\)\)/u)
  // Закон мягкий: деление на расстояние, а не на квадрат, и большое смягчение.
  assert.match(client, /\(d \+ PLANET_SOFTEN\)/u)
  assert.match(client, /const PLANET_SOFTEN = 1200/u)
  assert.match(client, /const d = Math\.max\(1, Math\.hypot\(dx, dy\)\)/u)
  // МЯГКОЕ ЯДРО. Симметричная гравитация без него допускает устойчивую тройку:
  // у связанной группы есть форма, которая не распадается, и планеты стояли
  // рядом минутами — это и читалось как «все планеты в одной тройке». Внутри
  // личного пространства притяжение сменяется отталкиванием, на краю зоны
  // толчок ровно нулевой, поэтому снаружи закон прежний.
  assert.match(client, /const PLANET_PERSONAL = /u)
  assert.match(client, /const PLANET_REPEL = /u)
  assert.match(client, /const reach = contact \* PLANET_PERSONAL/u)
  assert.match(client, /const contact = a\.radius \+ b\.radius/u)
  assert.match(client, /d < reach/u, 'внутри личного пространства должно быть отталкивание')
  assert.match(client, /-PLANET_REPEL \* \(\(reach - d\) \/ Math\.max\(1, reach - contact\)\)/u)
  // Притяжение тянется тем же множителем, что и дрейф. Раньше оно от настройки
  // не зависело, и низкая «Скорость планет» делала обратное задуманному:
  // планеты еле ползли, а стягивало их полной силой.
  assert.match(client, /const drift = planetDriftScale\(\)/u)
  assert.match(client, /PLANET_SOFTEN\)\) \* drift/u)
  // Разделение — жёсткая гарантия, которой не даёт гравитация.
  assert.match(client, /function separatePlanets\(\)/u)
  assert.match(client, /const need = a\.radius \+ b\.radius \+ PLANET_GAP/u)
  assert.match(client, /if \(d >= need\) continue/u)
  assert.match(client, /const push = \(need - d\) \/ 2/u)
  // Совпадение точек — вырожденный случай: деление на ноль дало бы NaN.
  assert.match(client, /const nx = d > 0\.001 \? dx \/ d : 1/u)
  assert.match(client, /const ny = d > 0\.001 \? dy \/ d : 0/u)
  assert.match(client, /a\.x -= nx \* push/u)
  assert.match(client, /b\.x \+= nx \* push/u)
  // Отдача при раздвижении. Без неё раздвижение работает как губка: позиции
  // расходятся, а импульс внутрь остаётся и подпитывает следующее сближение —
  // планеты «прилипают» и кружат. Замер доли кадров в раздвижении: 0.879 без
  // отдачи против 0.136 с ней.
  assert.match(client, /const approach = \(b\.vx - a\.vx\) \* nx \+ \(b\.vy - a\.vy\) \* ny/u)
  assert.match(client, /if \(approach < 0\)/u)
  assert.match(client, /const impulse = \(-approach \* PLANET_RESTITUTION\) \/ 2/u)
  assert.match(client, /a\.vx -= nx \* impulse/u)
  assert.match(client, /b\.vx \+= nx \* impulse/u)
  // Стартовое разнесение: на первом кадре гравитация ещё не сработала.
  assert.match(client, /function placePlanets\(planets, width, height\)/u)
  assert.match(client, /placePlanets\(this\.planets, this\.width, this\.height\)/u)
  assert.match(sliceMethod('populate'), /placePlanets\(/u)
  // Зазор между дисками положителен: планеты не касаются даже краями.
  const gap = client.match(/const PLANET_GAP = (\d+)/u)
  assert.ok(gap && Number(gap[1]) > 0, 'зазор должен быть больше нуля')

  // Поведение: раздвигание действительно разводит наложенные диски.
  // space связывается при СОЗДАНИИ песочницы: возвращённая функция замыкается
  // на этом значении, и потому звать её можно уже без аргументов.
  const source = client.slice(client.indexOf('function separatePlanets'), client.indexOf('function updatePlanets'))
  // Зазор берём из самого файла, а не дублируем число в тесте.
  const gapText = extractConst('PLANET_GAP')
  assert.ok(gapText, 'нет константы PLANET_GAP')
  const gapSize = Number(gapText.match(/=\s*(\d+)/u)[1])
  const bind = new Function('space', `${gapText}\n${source}\nreturn separatePlanets`)
  const scene = {
    planets: [
      { x: 100, y: 100, vx: 0, vy: 0, radius: 40 },
      { x: 130, y: 100, vx: 0, vy: 0, radius: 40 },
    ],
  }
  // Диски перекрыты: 30 пикселей при сумме радиусов 80.
  const separate = bind(scene)
  separate()
  const need = 40 + 40 + gapSize
  const after = Math.hypot(
    scene.planets[1].x - scene.planets[0].x,
    scene.planets[1].y - scene.planets[0].y,
  )
  assert.equal(after >= need, true, `после разделения ${after}, нужно не меньше ${need}`)
  // Симметрично: центр масс не сдвигается, значит гравитация не сломана.
  const massBefore = (100 + 130) / 2
  separate()
  const massAfter = (scene.planets[0].x + scene.planets[1].x) / 2
  assert.equal(Math.abs(massAfter - massBefore) < 0.001, true, 'раздвигание не должно смещать центр масс')
  // Раз уже разведено, повторный проход ничего не портит.
  assert.equal(separate(), undefined)
  assert.equal(
    Math.hypot(
      scene.planets[1].x - scene.planets[0].x,
      scene.planets[1].y - scene.planets[0].y,
    ) >= need,
    true,
  )
  // Совпадающие по центру планеты не дают NaN.
  const same = { planets: [
    { x: 50, y: 50, vx: 0, vy: 0, radius: 30 },
    { x: 50, y: 50, vx: 0, vy: 0, radius: 30 },
  ] }
  const separateSame = bind(same)
  separateSame()
  assert.equal(Number.isNaN(same.planets[0].x), false, 'деление на ноль недопустимо')
  assert.equal(Number.isNaN(same.planets[1].y), false, 'деление на ноль недопустимо')
  // Свой зазор для своих радиусов: у этой сцены планеты по 30, а не по 40.
  const needSmall = 30 + 30 + gapSize
  assert.equal(
    Math.hypot(same.planets[1].x - same.planets[0].x, same.planets[1].y - same.planets[0].y) >= needSmall,
    true,
  )
})

test('планета не разгоняется: минута движения не ломает потолок', () => {
  // Константы берём из самого файла, а дублировать числа в тесте не будем.
  const prelude = ['PLANET_G', 'PLANET_SOFTEN', 'PLANET_MAX_ACCEL', 'PLANET_MAX_SPEED', 'PLANET_GAP',
    'PLANET_PERSONAL', 'PLANET_REPEL',
    'PLANET_CRUISE', 'PLANET_REF_RADIUS', 'PLANET_RELAX', 'PLANET_RESTITUTION',
    'PLANET_WANDER', 'PLANET_WANDER_JITTER', 'PLANET_WANDER_MAX']
    .map((name) => extractConst(name))
  assert.equal(prelude.every((text) => text !== null), true, 'нет констант гравитации')
  // Модель целиком: масса, притяжение, разделение, появление и шаг кадра.
  const model = client.slice(
    client.indexOf('function planetMass'),
    client.indexOf('function createPlanets'),
  )
  // Math прокидываем параметром: блуждание курса и появление планет зовут
  // Math.random напрямую, а внутри Function «снаружишний» Math не виден.
  // Свой rand не объявляем — срез модели начинается с planetMass, и хелпер
  // rand из файла в него не входит; берём его из исходника текстом.
  const randSrc = client.match(/^ {4}const rand = [^\n]*$/mu)
  assert.ok(randSrc, 'нет хелпера rand')
  const bind = new Function(
    'space',
    'width',
    'height',
    'Math',
    `${prelude.join('\n')}\n${randSrc[0]}\n${model}\nreturn { updatePlanets, planetCruiseSpeed }`,
  )
  // Две планеты, намеренно сближенные: гравитация тут работает на полную.
  // speedBias и wander проставлены — ими пользуется гомеостаз и блуждание.
  const scene = {
    planets: [
      { x: 320, y: 300, vx: 0, vy: 0, radius: 80, laneTop: 0, laneBottom: 0.5, spin: 0, depth: 0.7, speedBias: 1, wander: 0 },
      { x: 880, y: 300, vx: 0, vy: 0, radius: 70, laneTop: 0.5, laneBottom: 1, spin: 0, depth: 0.7, speedBias: 1, wander: 0 },
    ],
  }
  const limit = Number(extractConst('PLANET_MAX_SPEED').match(/=\s*(\d+)/u)[1])
  const api = bind(scene, 1920, 1080, Math)
  // Минута при 30 кадрах в секунду.
  for (let step = 0; step < 1800; step += 1) {
    api.updatePlanets(1 / 30, 1920, 1080)
    for (const planet of scene.planets) {
      const speed = Math.hypot(planet.vx, planet.vy)
      assert.equal(
        speed <= limit * (1 + 1e-9),
        true,
        `после ${step} кадров скорость ${speed.toFixed(3)} выше потолка ${limit}`,
      )
    }
  }
  for (const planet of scene.planets) {
    assert.equal(Number.isFinite(planet.x) && Number.isFinite(planet.y), true, 'координаты разъехались')
    assert.equal(planet.x > -800 && planet.x < 2700, true, `планета улетела за экран: x=${planet.x}`)
  }
})

// ── мера «планета кружит» ──────────────────────────────────────────────────
//
// Прежняя мера (1 − смещение/длина пути) оказалась плохим регрессионным
// признаком: у неё нет масштаба, и вялый дрейф на длинном отрезке даёт ту же
// цифру, что и настоящий круг. Замер показал, что на ней сломанная модель
// ловится ХУЖЕ здоровой, то есть тест не защищал от регрессии. Здесь мера
// взята прямо из жалобы: планета ВОЗВРАЩАЕТСЯ туда же, откуда вылетела, через
// заметный лаг. Прямая этого не делает никогда, поэтому и мера ищет лаг, при
// котором планета снова оказалась почти на прежнем месте.
//
// ВОЗВРАТ = min по лагам 1..60 с среднего сдвига |p(t+L) − p(t)|,
//           делённого на (средняя скорость × L).
// Размерность отменяется, поэтому и медленная большая планета, и быстрая
// маленькая меряются одной цифрой. Прямая даёт ровно 1 при любом лаге, замкнутая
// орбита — около нуля на лаге у периода. Меньше — хуже.
//
// Модель собирается из настоящего кода плагина: срез от spawnPlanet до
// createPlanets плюс прелюдия из констант, которые этот срез реально
// использует. Семя ГПСЧ фиксировано: без него значения прыгали от прогона к
// прогону, и тест мигал.
function planetMechanics() {
  const names = ['PLANET_SIDES', 'PLANET_G', 'PLANET_SOFTEN', 'PLANET_MAX_ACCEL', 'PLANET_MAX_SPEED',
    'PLANET_GAP', 'PLANET_PERSONAL', 'PLANET_REPEL',
    'PLANET_CRUISE', 'PLANET_REF_RADIUS', 'PLANET_RELAX', 'PLANET_RESTITUTION',
    'PLANET_WANDER', 'PLANET_WANDER_JITTER', 'PLANET_WANDER_MAX']
  const prelude = names.map((name) => extractConst(name))
  assert.equal(prelude.every((text) => text !== null), true, 'нет констант механики планет')
  const randSrc = client.match(/^ {4}const rand = [^\n]*$/mu)
  assert.ok(randSrc, 'нет хелпера rand')
  const model = client.slice(client.indexOf('function spawnPlanet'), client.indexOf('function createPlanets'))
  const bind = (overrides) => {
    const preludeText = prelude.map((text) => {
      for (const [name, value] of Object.entries(overrides ?? {})) {
        const pattern = new RegExp(`(const ${name} = )[^\\n]*`, 'u')
        if (pattern.test(text)) return text.replace(pattern, `$1${value}`)
      }
      return text
    })
    return new Function('space', 'width', 'height', 'Math',
      `${preludeText.join('\n')}\n${randSrc[0]}\n${model}\nreturn { updatePlanets, planetCruiseSpeed, spawnPlanet }`)
  }
  return { bind }
}

function mulberry32(seed) {
  let a = seed >>> 0
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Сцена строится на своём ГПСЧ, но модель сама зовёт Math.random(): выбор
// стороны спавна и аварийный вектор в settlePlanetSpeed. Если оставить
// Math.random() настоящим, «фиксированные семена» ничего не фиксируют —
// тест мигал именно из-за этого. Поэтому Math подменяется потомком с
// переопределённым random: остальные функции остаются настоящими.
function seededMath(next) {
  return Object.assign(Object.create(Math), { random: next })
}

// Доля окон, где планета вернулась в ту же точку: круг проявится на любой из
// планет и на любом отрезке её пути. Лаги берутся с шагом 3 с, а не подряд: на
// замере шаг 3 с и шаг 1 с дают одинаковое разделение, а работы втрое меньше.
function worstRecurrence(bind, seed, seconds = 400) {
  const W = 1440
  const H = 1080
  const dt = 1 / 30
  const next = mulberry32(seed)
  const seeded = seededMath(next)
  const random = (from, to) => from + next() * (to - from)
  const count = 2 + Math.floor(next() * 2)
  const space = { options: { planetSpeed: 1 }, planets: [] }
  for (let i = 0; i < count; i += 1) {
    space.planets.push({
      x: 0, y: 0, vx: 0, vy: 0,
      radius: random(34, 92),
      depth: random(0.45, 1),
      speedBias: random(0.85, 1.15),
      wander: random(-1, 1),
      laneTop: i / count,
      laneBottom: (i + 1) / count,
    })
  }
  const api = bind(space, W, H, seeded)
  for (const planet of space.planets) api.spawnPlanet(planet, W, H)
  const paths = space.planets.map(() => [])
  const frames = Math.round(seconds * 30)
  const sampleFrom = Math.round(frames / 2)
  for (let f = 0; f < frames; f += 1) {
    api.updatePlanets(dt, W, H)
    if (f >= sampleFrom) {
      for (let i = 0; i < space.planets.length; i += 1) {
        paths[i].push({ x: space.planets[i].x, y: space.planets[i].y })
      }
    }
  }
  // ВОЗВРАТ = средний за лаг нормированный сдвиг |p(t+L) − p(t)|,
  // делённый на (средняя скорость × L). Размерность отменяется: прямая даёт
  // ровно 1 при любом лаге, а замкнутая орбита — около нуля на лаге, равном
  // периоду. Возвращаем не худший лаг, а ДОЛЮ окон, где возврат ниже порога.
  //
  // Порог 0.65 выбран замером, а не на глаз: у здоровой модели самое «круглое»
  // окно даёт 0.69, и при пороге 0.7 сумма переставала быть нулём (0.0196).
  // При 0.65 здоровая модель даёт ровно 0 на 100 семенах подряд, а любой
  // откат к прежней физике — 0.045…2.24.
  let worst = 1
  let windows = 0
  let returned = 0
  for (const path of paths) {
    // Режем путь на прыжках больше 200 px — это перерождения, а не полёт.
    const segments = []
    let current = [path[0]]
    for (let k = 1; k < path.length; k += 1) {
      const step = Math.hypot(path[k].x - path[k - 1].x, path[k].y - path[k - 1].y)
      if (step > 200) { segments.push(current); current = [path[k]] } else current.push(path[k])
    }
    segments.push(current)
    for (const segment of segments) {
      if (segment.length < 60) continue
      let length = 0
      for (let k = 1; k < segment.length; k += 1) {
        length += Math.hypot(segment[k].x - segment[k - 1].x, segment[k].y - segment[k - 1].y)
      }
      if (length < 200) continue
      const meanSpeed = length / (segment.length * dt)
      const maxLag = Math.min(Math.round(60 / dt), segment.length - 2)
      for (let lag = Math.round(3 / dt); lag <= maxLag; lag += Math.round(3 / dt)) {
        let sum = 0
        let used = 0
        for (let k = 0; k + lag < segment.length; k += 1) {
          sum += Math.hypot(segment[k + lag].x - segment[k].x, segment[k + lag].y - segment[k].y)
          used += 1
        }
        const expected = meanSpeed * lag * dt
        if (used === 0 || expected < 1) continue
        const ratio = sum / used / expected
        windows += 1
        if (ratio < 0.65) returned += 1
        if (ratio < worst) worst = ratio
      }
    }
  }
  return { worst, share: windows === 0 ? 0 : returned / windows }
}

// ── мера «планеты в одной кучке» ────────────────────────────────────────────
//
// Наезд дисков ловит разделение, а жалоба была не в нём: планеты не
// перекрывались, они просто ЖИЛИ РЯДОМ — тройка держалась минутами и читалась
// как «все планеты собрались в кучу». Меряем именно это: сколько времени все
// три стоят рядом, и какую долю кадров это занимает.
//
// КУЧКА: крайние центры ближе, чем (r_max + r_min) · 3.5. Порог взят замером по
// жалобе и по кадру: на экране 1440×1080 это примерно треть ширины, то есть
// ровно то расстояние, на котором группа видна глазом как группа.
function longestCluster(bind, seed, planetSpeed, seconds = 400) {
  const W = 1440
  const H = 1080
  const dt = 1 / 30
  const next = mulberry32(seed)
  const random = (from, to) => from + next() * (to - from)
  const space = { options: { planetSpeed }, planets: [] }
  // Тройка — строгий случай: с двумя планетами кучка и не собирается.
  for (let i = 0; i < 3; i += 1) {
    space.planets.push({
      x: 0, y: 0, vx: 0, vy: 0,
      radius: random(34, 92),
      depth: random(0.45, 1),
      speedBias: random(0.85, 1.15),
      wander: random(-1, 1),
      laneTop: i / 3,
      laneBottom: (i + 1) / 3,
    })
  }
  const api = bind(space, W, H, seededMath(mulberry32(seed ^ 0x9e3779b9)))
  for (const planet of space.planets) api.spawnPlanet(planet, W, H)
  let streak = 0
  let longest = 0
  let tight = 0
  let frames = 0
  for (let f = 0; f < Math.round(seconds * 30); f += 1) {
    api.updatePlanets(dt, W, H)
    frames += 1
    const radii = space.planets.map((planet) => planet.radius)
    let spread = 0
    for (const planet of space.planets) {
      for (const other of space.planets) {
        if (other === planet) continue
        spread = Math.max(spread, Math.hypot(other.x - planet.x, other.y - planet.y))
      }
    }
    if (spread < (Math.max(...radii) + Math.min(...radii)) * 3.5) {
      tight += 1
      streak += 1
      if (streak * dt > longest) longest = streak * dt
    } else {
      streak = 0
    }
  }
  return { longest, share: tight / frames }
}

test('планеты не сбиваются в тройку: группа не живёт рядом минутами', () => {
  // Сценарий пользователя: «Скорость планет» на 15 %, и три планеты всё время
  // стоят кучей. Порог ставится по замеру на healthy-модели, а не на глаз, и
  // проверяется агрегатом по семенам — одиночное семя кучу не ловит.
  const { bind } = planetMechanics()
  const slow = bind()
  let worstSlow = 0
  let totalSlow = 0
  for (const seed of PLANET_CLUSTER_SEEDS) {
    const result = longestCluster(slow, seed, 0.15)
    worstSlow = Math.max(worstSlow, result.longest)
    totalSlow += result.share
  }
  assert.equal(
    worstSlow <= 60,
    true,
    `на 15 % три планеты держались рядом ${worstSlow.toFixed(0)} с подряд — это и есть куча`,
  )
  assert.equal(
    totalSlow <= 0.06,
    true,
    `на 15 % кучка занимает ${(totalSlow * 100).toFixed(1)} % кадров по всем семенам`,
  )
  // На обычной скорости кучка допустима минутами, но не должна становиться
  // постоянной: она скорее совпадение, а не группа.
  const normal = bind()
  let worstNormal = 0
  for (const seed of PLANET_CLUSTER_SEEDS) {
    worstNormal = Math.max(worstNormal, longestCluster(normal, seed, 1).longest)
  }
  assert.equal(worstNormal <= 120, true, `на 100 % кучка держалась ${worstNormal.toFixed(0)} с подряд`)
})

// Контрольная проверка: тест выше защищает от отката только если мера
// различает модели. Откат — мягкое ядро выключено (PLANET_PERSONAL = 0), то
// есть ровно прежняя физика: только притяжение плюс разделение. Замер на тех
// же семенах: 98.6 % кадров в кучке и худшая кучка 219 с против 0 % и 0 с у
// здоровой модели. Мера «возврат» этот откат не видит вовсе (0.0000), поэтому
// защита от ядра лежит именно здесь.
test('мера кучки ловит откат к прежней физике', () => {
  const { bind } = planetMechanics()
  const broken = bind({ PLANET_PERSONAL: '0' })
  let worst = 0
  let total = 0
  for (const seed of PLANET_CLUSTER_SEEDS) {
    const result = longestCluster(broken, seed, 0.15)
    worst = Math.max(worst, result.longest)
    total += result.share
  }
  assert.equal(
    worst > 60 || total > 0.06,
    true,
    `прежняя физика не отличилась: самая долгая кучка ${worst.toFixed(0)} с, доля кадров ${(total * 100).toFixed(1)} %`,
  )
})

const PLANET_CLUSTER_SEEDS = Array.from({ length: 12 }, (unused, trial) => 3237998080 + trial * 7919)

test('планеты не кружат: траектория не возвращается в ту же точку', () => {  // Круг был не дефектом отрисовки, а следствием законов сохранения: импульсы
  // притяжения строго симметричны, система консервативна, и захваченная пара
  // честно повторяла орбиту вечно. Проверяем это поведением, а не разбором
  // Проверяем это поведением, а не разбором исходника: гоняем настоящий
  // updatePlanets и смотрим, возвращается ли планета в ту же точку.
  //
  // Порог ставится не на одном семени, а на сумме по набору. Одиночное семя
  // ловит откат лишь в 10 случаях из 29 (замер cache/probe-regressions.mjs) —
  // порог на одном семени не защищает, потому что круг попадает в траекторию
  // не всегда. Агрегат разделяет модели начисто: у здоровой сумма ровно 0.0000,
  // у любого отката к прежней физике 0.08…0.40 (cache/probe-aggregate.mjs,
  // 20 наборов по 400 с). Поэтому здесь сравнение точное, а не «меньше 0.02».
  const { bind } = planetMechanics()
  const good = bind()
  let total = 0
  for (const seed of PLANET_RECURRENCE_SEEDS) total += worstRecurrence(good, seed).share
  assert.equal(total, 0, `планета возвращается в ту же точку: сумма долей окон ${total.toFixed(4)}`)
})

// Набор семян фиксирован и задан по замеру: первые сорок семян ряда
// `3237998080 + 7919·n` дают на здоровой модели сумму долей окон ровно 0.0000,
// и ноль держится на первых ста семенах подряд. Вне этого набора встречаются
// сцены, где планета упирается в угол и возвращается сама по себе, поэтому
// набор не расширяется вслепую.
const PLANET_RECURRENCE_SEEDS = Array.from({ length: 40 }, (unused, trial) => 3237998080 + trial * 7919)

test('мера петли не годилась: сломанная модель ловилась хуже здоровой', () => {
  // Тест выше защищает от регрессии только если мера различает модели. Раньше
  // порог стоял на мере «1 − смещение/длина пути», и на ней сломанная модель
  // ловилась хуже здоровой: на 300 наборах у здоровой было p90 0.41, у
  // сломанной 0.52, то есть диапазоны накладывались и тест мигал от прогона к
  // прогону.
  //
  // Контрольная проверка держит это знание в тесте: любой откат к прежней
  // физике обязан пробить порог, а здоровая модель — держаться. Проверяются
  // ВСЕ формы отката, а не только прежняя пара 5/400: откат одного потолка
  // ускорения при нынешнем смягчении 1200 круг не воспроизводит, и именно
  // поэтому первый вариант теста его пропускал.
  //
  // Откаты перечислены по замеру (cache/probe-threshold2.mjs, набор 40 по
  // 400 с, порог 0.65): сумма долей окон 0.517 у прежней пары, 0.450 у потолка
  // 5, 0.450 у потолка 1, 0.417 у потолка 0.5, 0.045 у смягчения 400. Потолок
  // 0.12 сюда не входит: он даёт около 0.02 — на грани порога, и такой
  // «почти круг» надёжно отличить от нуля нельзя.
  //
  // Смягчение 400 из списка ушло после мягкого ядра: при ядре даже сильная
  // дальняя тяга больше не замыкает петлю (замер 0.0149 на тех же 40 семенах),
  // то есть это уже не откат. Само ядро на этой мере не ловится вовсе: с
  // выключенным ядром возврат остаётся 0.0000, а вот кучка схлопывается в
  // 98.6 % кадров. Поэтому ядро защищает другая мера, «кучка», и её контроль
  // стоит рядом.
  const { bind } = planetMechanics()
  const good = bind()
  let goodTotal = 0
  for (const seed of PLANET_RECURRENCE_SEEDS) goodTotal += worstRecurrence(good, seed).share
  const regressions = [
    { label: 'прежняя пара: потолок 5 и смягчение 400', overrides: { PLANET_MAX_ACCEL: '5', PLANET_SOFTEN: '400' } },
    { label: 'потолок 5 при смягчении 1200', overrides: { PLANET_MAX_ACCEL: '5' } },
    { label: 'потолок 1', overrides: { PLANET_MAX_ACCEL: '1' } },
    { label: 'потолок 0.5', overrides: { PLANET_MAX_ACCEL: '0.5' } },
  ]
  for (const regression of regressions) {
    const broken = bind(regression.overrides)
    let total = 0
    for (const seed of PLANET_RECURRENCE_SEEDS) total += worstRecurrence(broken, seed).share
    assert.ok(
      total > 0.02,
      `контроль не сработал (${regression.label}): сломанная держалась на ${total.toFixed(4)}`,
    )
    assert.ok(
      total > goodTotal,
      `откат (${regression.label}) не хуже здоровой модели: ${total.toFixed(4)} против ${goodTotal.toFixed(4)}`,
    )
  }
})

test('чем массивнее планета, тем медленнее она едет', () => {
  // Формула проверяется численно, на настоящей planetCruiseSpeed: правило
  // «больше — медленнее» должно следовать из кода, а не из подписи.
  const prelude = ['PLANET_CRUISE', 'PLANET_REF_RADIUS']
    .map((name) => extractConst(name))
  const source = client.slice(
    client.indexOf('function planetCruiseSpeed'),
    client.indexOf('function settlePlanetSpeed'),
  )
  // planetCruiseSpeed зовёт planetDriftScale, а та лежит выше по файлу — в срез
  // не попадает, и без неё в песочнице ReferenceError.
  const driftSource = client.slice(
    client.indexOf('function planetDriftScale'),
    client.indexOf('function planetCruiseSpeed'),
  )
  // Множитель темы — именно множитель: ползунок «скорость планет» должен
  // масштабировать темп, а не смещать закон обратной пропорции.
  const space = { options: { planetSpeed: 1 } }
  const cruiseAt = new Function('space', `${driftSource}\n${prelude.join('\n')}\n${source}\nreturn planetCruiseSpeed`)(space)
  const base = { depth: 1, speedBias: 1 }
  // Обратная пропорция: удвоение радиуса должно ровно вдвое снижать скорость.
  const small = cruiseAt({ ...base, radius: 40 })
  const middle = cruiseAt({ ...base, radius: 80 })
  assert.ok(middle < small, `крупная (80) едет быстрее мелкой (40): ${middle} против ${small}`)
  assert.ok(
    Math.abs(middle / small - 0.5) < 1e-9,
    `отношение должно быть ровно 1/2, а не ${(middle / small).toFixed(4)}`,
  )
  // Обратная зависимость на всём рабочем диапазоне радиусов 34–92 px.
  const samples = []
  for (let radius = 34; radius <= 92; radius += 1) samples.push(cruiseAt({ ...base, radius }))
  for (let i = 1; i < samples.length; i += 1) {
    assert.ok(samples[i] < samples[i - 1], `скорость не убывает на радиусе ${33 + i}`)
  }
  // Ползунок темы масштабирует скорость, и закон обратной пропорции сохраняется.
  space.options.planetSpeed = 2
  const doubled = cruiseAt({ ...base, radius: 40 })
  assert.ok(
    Math.abs(doubled / small - 2) < 1e-9,
    `ползунок должен удваивать темп, а не смещать закон: ${(doubled / small).toFixed(4)}`,
  )
})

test('спутники есть не у всех планет, и они обходят диск', () => {
  // Не у всех: часть неба остаётся без колец.
  assert.match(client, /if \(Math\.random\(\) < 0\.55\) \{/u)
  assert.match(client, /const moons = 1 \+ Math\.floor\(Math\.random\(\) \* 3\)/u)
  // Ближние орбиты быстрее дальних: по Кеплеру.
  assert.match(client, /speed: 0\.42 \/ Math\.pow\(orbit \/ \(planet\.radius \* 2\), 1\.5\)/u)
  // Орбита сплюснута и наклонена — иначе это круг, нарисованный сбоку.
  assert.match(client, /const across = Math\.sin\(angle\) \* orbiter\.r \* 0\.34/u)
  assert.match(client, /planet\.orbitTilt = rand\(-0\.45, 0\.1\)/u)
  // Половина орбиты за диском, половина перед ним: near решает, что видно.
  assert.match(client, /function drawOrbiters\(ctx, planet, x, y, near\)/u)
  assert.match(client, /if \(\(across >= 0\) !== near\) continue/u)
  // Дальние спутники рисуются ДО диска, ближние — после. Иначе они висят
  // поверх планеты и вращение не читается.
  const body = client.slice(
    client.indexOf('function drawPlanets'),
    client.indexOf('// Корабли живут по-настоящему'),
  )
  const back = body.indexOf('drawOrbiters(ctx, planet, x, y, false)')
  const disc = body.indexOf('const halo = ctx.createRadialGradient')
  const front = body.indexOf('drawOrbiters(ctx, planet, x, y, true)')
  assert.ok(back !== -1 && disc !== -1 && front !== -1, 'спутники должны рисоваться в двух местах кадра')
  assert.ok(back < disc, 'дальние спутники идут за диском')
  assert.ok(disc < front, 'ближние спутники идут после диска')
  // Дорожки орбит: без них вращение не читается, но они должны быть тусклыми.
  assert.match(client, /function drawOrbitTracks\(ctx, planet, x, y\)/u)
  assert.match(client, /60%, 70%, 0\.07\)\x60/u, 'дорожки орбит еле видны')
  // Планета без спутников не ломает отрисовку: у части планет поля нет вовсе.
  assert.match(client, /if \(planet\.orbiters === undefined\) return/u)
})

test('рельеф планет виден: полосы, пятна и моря не прозрачнее невидимого', () => {
  // Прежние полосы 0.06–0.14 и пятна 0.05–0.12 после умножения на
  // planet.alpha давали 0.03–0.07: рельефа на диске не было видно.
  assert.match(client, /alpha: rand\(0\.2, 0\.42\)/u)
  assert.match(client, /alpha: rand\(0\.18, 0\.4\)/u)
  assert.match(client, /alpha: rand\(0\.12, 0\.24\)/u)
  // Деталей больше прежнего: пять полос и семь пятен читались как ровная заливка.
  assert.match(client, /planet\.bands = Array\.from\(\{ length: 9 \}/u)
  assert.match(client, /planet\.spots = Array\.from\(\{ length: 11 \}/u)
  assert.match(client, /planet\.seas = Array\.from\(\{ length: 3 \}/u)
  // Полосы разной ширины, пятна сплющены по-разному — диск не выглядит плоским.
  assert.match(client, /weight: band % 3 === 0 \? 1\.5 : 1/u)
  assert.match(client, /squash: rand\(0\.55, 1\)/u)
  // Мор�� рисуются до пятен: иначе пятна тонут в их пятне.
  const seas = client.indexOf('for (const sea of planet.seas)')
  const spots = client.indexOf('for (const spot of planet.spots)')
  assert.ok(seas !== -1 && spots !== -1, 'нет отрисовки морей или пятен')
  assert.ok(seas < spots, 'моря должны идти раньше пятен')
  // Форма задаётся при рождении: rand() в кадре дрожал бы каждую секунду.
  const drawBody = client.slice(seas, spots)
  assert.equal(/rand\(/u.test(drawBody), false, 'rand() в кадре дёргает форму каждый кадр')
})

test('на планетах есть огни городов, и только на ночной стороне', () => {
  assert.match(client, /planet\.cities = Array\.from\(\{ length: 14 \}/u)
  // Точка должна быть не меньше пикселя: прежние 0.006–0.017 от радиуса
  // давали 0.2–1.5 px на планете 34–92 px, и огней не было видно вовсе.
  assert.match(client, /r: rand\(0\.022, 0\.055\)/u)
  // Города собираются в скопления, а не рассыпаются равномерно.
  assert.match(client, /const clusterX = rand\(-0\.62, 0\.62\)/u)
  assert.match(client, /x: clamp\(clusterX \+ rand\(-0\.22, 0\.22\), -0\.82, 0\.82\)/u)
  // Маска ночи: свет в повёрнутой системе координат. Без вычитания угла
  // собственного вращения огни ехали бы вместе с планетой и светили бы там,
  // где день.
  assert.match(client, /const lightLocal = planet\.lightAngle - planet\.spinAngle/u)
  assert.match(client, /const toward = city\.x \* lightX \+ city\.y \* lightY/u)
  assert.match(client, /const night = clamp\(-toward \* 2\.4, 0, 1\)/u)
  assert.match(client, /if \(night <= 0\.03\) continue/u)
  // Итоговая альфа усилена: на тёмной стороне огни иначе тонули в тени.
  assert.match(client, /planet\.alpha \* city\.alpha \* night \* Math\.min\(1, edge \* 3\) \* 2\.6/u)
  // Огни аддитивны, иначе на тёмной стороне их не видно вовсе.
  assert.match(client, /ctx\.globalCompositeOperation = 'lighter'/u)
  // Огни только у каменных и ледяных: у газового гиганта городов не бывает.
  const created = client.slice(
    client.indexOf('function createPlanets'),
    client.indexOf('function createChartLayer'),
  )
  const citiesAt = created.indexOf('planet.cities')
  const spotsAt = created.indexOf('planet.spots')
  assert.equal(citiesAt > spotsAt, true, 'огни создаются вместе с рельефом, не с полосами гиганта')
})

test('диффракция: тусклые за газом, яркие с лучами поверх', () => {
  assert.match(client, /const BRIGHT_RADIUS = 1\.2/u)
  assert.match(client, /function isBrightStar\(star\)/u)
  assert.match(client, /function drawStarFlare\(ctx, x, y, radius, alpha\)/u)
  // Звёзды разведены по кадру: тусклые ДО полос, яркие ПОСЛЕ. Иначе газ не
  // приглушал бы фоновое небо и диффракции не было бы видно.
  const render = sliceMethod('render')
  const dim = render.indexOf("drawStars(ctx, this.width, this.time, 'dim')")
  const bands = render.indexOf('drawImage(space.bands.far.canvas')
  const bright = render.indexOf("drawStars(ctx, this.width, this.time, 'bright')")
  assert.ok(dim !== -1 && bands !== -1 && bright !== -1, 'нет всех трёх проходов в кадре')
  assert.ok(dim < bands, 'тусклые звёзды должны идти до полос')
  assert.ok(bands < bright, 'яркие звёзды должны идти после полос')
  // Фильтр отсекает лишнее: иначе каждая звезда рисовалась бы дважды.
  assert.match(client, /if \(isBright !== bright\) continue/u)
  // Плеяды горят холоднее рассеянных звёзд.
  assert.match(client, /star\.cool === true/u)
})

test('круг Эйнштейна огибает горизонт событий до диска', () => {
  assert.match(client, /function lensingArcs\(hole\)/u)
  assert.match(client, /function drawLensing\(ctx\)/u)
  // Дуги всегда непустые и идут по возрастанию угла.
  const arcs = loadHelper('lensingArcs')({ radius: 10 })
  assert.equal(arcs.length > 0, true)
  for (const arc of arcs) {
    assert.equal(arc.endAngle > arc.startAngle, true)
    assert.equal(arc.scale > 1, true, 'линза должна быть шире горизонта событий')
  }
  // Кольцо рисуется ДО чёрных дыр, иначе диск лёг бы поверх линзы.
  const render = sliceMethod('render')
  assert.ok(
    render.indexOf('drawLensing(ctx)') < render.indexOf('drawBlackHoles(ctx, this.width'),
    'линза должна идти раньше диска',
  )
  // Без кэша полос линза рисовать нечего — это не ошибка, а тихий выход.
  assert.match(client, /if \(space\.bandsSignature === null\) return/u)
})

test('звёздные карты: четыре узнаваемые структуры на фиксированных местах', () => {
  assert.match(client, /const CHART_SPOTS = Object\.freeze\(\[/u)
  for (const name of ['spiral', 'globular', 'andromeda', 'pleiades']) {
    assert.match(client, new RegExp(`name: '${name}'`, 'u'), `нет карты ${name}`)
    assert.match(client, new RegExp(`\\n      ${name}: chart`, 'u'), `нет генератора карты ${name}`)
  }
  // Зерно обязательно: без него карта прыгала бы при каждом resize.
  const chart = loadHelper('chartBodies', [
    'chartSpiral',
    'chartGlobular',
    'chartAndromeda',
    'chartPleiades',
  ])
  const bodies = chart(7)
  const again = chart(7)
  assert.ok(bodies.length > 100, 'карт слишком мало, небо останется пустым')
  assert.deepEqual(
    bodies.map((star) => star.x),
    again.map((star) => star.x),
    'карта не детерминирована при одном зерне',
  )
  // Звёзды карт не должны вылезать за экран.
  for (const star of bodies) {
    assert.equal(star.x >= -0.35 && star.x <= 1.35, true, `звезда карты вне экрана: ${star.x}`)
    assert.equal(star.y >= -0.35 && star.y <= 1.35, true, `звезда карты вне экрана: ${star.y}`)
  }
  // Слой карт — самый дальний, у него обязана быть глубина для warpField.
  assert.match(client, /layers\.push\(createChartLayer\(width, height\)\)/u)
  assert.match(client, /depth: 0\.15/u)
})

test('времена суток дрейфуют медленно и не засветляют интерфейс', () => {
  const color = loadHelper('atmosphereColor')
  // Период в минутах: за час небо заметно, за секунду — нет.
  const start = color(0, 0)
  const later = color(600, 0)
  assert.notDeepEqual(start, later, 'палитра не меняется со временем')
  for (const sample of [0, 300, 900, 3600, 86400]) {
    const [hue, saturation, lightness, alpha] = color(sample, 0)
    assert.equal(alpha <= 0.2, true, `альфа слишком высока: ${alpha}`)
    assert.equal(lightness <= 12, true, `светлота слишком высока: ${lightness}`)
    assert.equal(saturation <= 42, true, `насыщенность слишком высока: ${saturation}`)
  }
  // Рассвет — короткий тёплый подъём, и он гаснет.
  const dawn = color(0, 0)
  const rising = color(0, 0.5)
  const after = color(0, 20)
  assert.equal(rising[3] > dawn[3], true, 'рассвет должен добавлять света')
  assert.equal(after[3] <= dawn[3] + 0.001, true, 'рассвет обязан гаснуть')
  assert.match(client, /function drawAtmosphere\(ctx, width, height\)/u)
})

test('кометы трёх размеров и трёх хвостов, с ядром и комой', () => {
  const classes = client.match(/const COMET_CLASSES = Object\.freeze\(\{([\s\S]*?)\n    \}\)/u)
  assert.ok(classes, 'нет COMET_CLASSES')
  for (const name of ['wisp', 'bearer', 'giant']) {
    assert.ok(classes[1].includes(`${name}:`), `нет класса кометы ${name}`)
  }
  assert.match(client, /const COMET_VARIANTS = Object\.freeze\(\['dust', 'ion', 'plasma'\]\)/u)
  // Класс задаёт и скорость, и длину хвоста, и ширину следа.
  assert.match(classes[1], /speed:/u)
  assert.match(classes[1], /length:/u)
  assert.match(classes[1], /width:/u)
  // Хвост рисуется по варианту, ядро и кома присутствуют.
  assert.match(client, /function drawCometTail\(ctx, comet, headX, headY, tailX, tailY\)/u)
  assert.match(client, /comet\.variant === 'dust'/u)
  assert.match(client, /comet\.variant === 'ion'/u)
  assert.match(client, /const coma = 22 \* comet\.head/u)
  assert.match(client, /ctx\.arc\(headX, headY, Math\.max\(0\.6, 1\.5 \* comet\.head\), 0, TAU\)/u)
  // Комет больше двух: на каждый класс хватает своей.
  assert.match(client, /const count = 4 \+ Math\.floor\(Math\.random\(\) \* 3\)/u)
})

test('кометы летят во все стороны, а не только сверху вниз', () => {
  // Жалоба была точной: знак вертикальной скорости никто не выбирал, строка
  // `vy: rand(2, 7) * spec.speed` давала положительный всегда, и всё небо
  // смотрелось односторонним. Ни документ, ни код этого не обещали.
  assert.match(client, /function launchComet\(comet\)/u)
  assert.match(client, /comet\.vx = rand\(9, 20\) \* spec\.speed \* \(right \? 1 : -1\)/u)
  assert.match(client, /comet\.vy = rand\(2, 7\) \* spec\.speed \* \(down \? 1 : -1\)/u)
  assert.equal(
    /vy: rand\(2, 7\) \* spec\.speed,/mu.test(client),
    false,
    'прежний vy без знака вернулся: кометы снова полетят только вниз',
  )
  // Появление с края: раньше x был случайным, и комета возникала посреди кадра.
  assert.match(client, /const COMET_MARGIN = 0\.1/u)
  assert.match(client, /comet\.x = right \? -COMET_MARGIN : 1 \+ COMET_MARGIN/u)
  assert.match(client, /comet\.y = down \? -COMET_MARGIN : 1 \+ COMET_MARGIN/u)
  assert.match(client, /comet\.y < -0\.3 \|\| comet\.y > 1\.3\) launchComet\(comet\)/u)

  // Поведение на настоящей функции: курс распределён и вверх, и вниз, голова
  // всегда за пределами кадра. Модель собирается из кода плагина, не из копии.
  const prelude = ['COMET_CLASSES', 'COMET_MARGIN', 'TAU'].map((name) => extractConst(name))
  assert.equal(prelude.every((text) => text !== null), true, 'нет констант комет')
  const randSrc = client.match(/^ {4}const rand = [^\n]*$/mu)
  assert.ok(randSrc, 'нет хелпера rand')
  const source = client.slice(client.indexOf('function launchComet'), client.indexOf('function createComets'))
  const launch = new Function('Math', `${prelude.join('\n')}\n${randSrc[0]}\n${source}\nreturn launchComet`)(Math)
  let up = 0
  let down = 0
  let inside = 0
  const runs = 3000
  for (let i = 0; i < runs; i += 1) {
    const comet = launch({ className: 'bearer' })
    if (comet.vy > 0) down += 1
    else up += 1
    if (comet.x >= 0 && comet.x <= 1 && comet.y >= 0 && comet.y <= 1) inside += 1
  }
  // Равные доли ±5 % от половины: разброс курса настоящий, а не «иногда вверх».
  assert.ok(
    Math.abs(up - down) < runs * 0.05,
    `курс не симметричен: вверх ${up}, вниз ${down} из ${runs}`,
  )
  assert.equal(inside, 0, 'комета не должна появляться посреди кадра')
})

test('созвездия узнаваемы по фигуре, а не по подписи', () => {
  assert.match(client, /const CONSTELLATIONS = Object\.freeze\(\[/u)
  for (const name of ['Большая Медведица', 'Орион', 'Кассиопея', 'Южный Крест']) {
    assert.match(client, new RegExp(`name: '${name}'`, 'u'), `нет фигуры ${name}`)
  }
  // Фигура без связей — россыпь, а не созвездие: у каждой есть линии.
  const figures = client.slice(
    client.indexOf('const CONSTELLATIONS'),
    client.indexOf('function createConstellationLayer'),
  )
  const count = (figures.match(/name: '/gu) || []).length
  assert.equal(count >= 12, true, `созвездий всего ${count}, просили не меньше 12`)
  assert.equal(
    (figures.match(/links: Object\.freeze\(\[/gu) || []).length,
    count,
    'у каждой фигуры должны быть связи',
  )
  // Пояс Ориона — три звезды в линию, без него фигура не узнаётся.
  assert.match(client, /\[2, 3\], \[3, 4\]/u)
  // Сдвиг у фигуры общий: иначе при движении звёзды разъедутся и фигура
  // рассыплется. Каждое ребро рисуется дважды — свечение и нить, — поэтому
  // проверяем, что обе его точки считаются с ОДНИМ и тем же сдвигом.
  const draw = client.slice(
    client.indexOf('function drawConstellations'),
    client.indexOf('function createField'),
  )
  const x1 = draw.match(/const x1 = ([^\n]+)/u)
  const x2 = draw.match(/const x2 = ([^\n]+)/u)
  assert.ok(x1 && x2, 'обе точки ребра должны считаться в переменных')
  for (const [, expr] of [x1, x2]) {
    assert.match(expr, /figure\.ox \+ dx \+ [ab]\.x \* figure\.size/u, 'обе точки едут с общим сдвигом')
  }
  assert.match(x1[1], /a\.x/u, 'начало ребра — первая звезда')
  assert.match(x2[1], /b\.x/u, 'конец ребра — вторая звезда')
  // Обе точки используются в каждом проходе, иначе нить была бы отрезком не туда.
  assert.equal((draw.match(/ctx\.moveTo\(x1, y1\)/gu) || []).length, 2, 'два прохода по ребру')
  assert.equal((draw.match(/ctx\.lineTo\(x2, y2\)/gu) || []).length, 2, 'два прохода по ребру')
  assert.match(client, /const dx = \(\(\(0 - time \* layer\.drift\) % width\) \+ width\) % width/u)
  // Линии заметные: это и есть опознавательный признак фигуры. Прежние
  // 0.11 при толщине 0.7 тонули в фоновой сыпи, а 0.34 при толщине 1 — в
  // слое, который светится на 40 %: на экране оставалось ~0.07. Числа теперь
  // берутся из CONSTELLATION_STYLE по режиму, и в обычном режиме нить яркая.
  assert.match(client, /rgba\(186, 214, 255, \$\{style\.thread\}\)/u)
  assert.match(client, /rgba\(140, 178, 240, \$\{style\.glow\}\)/u, 'под нитью должно быть мягкое свечение')
  assert.match(client, /thread: 0\.95, threadWidth: 1\.3/u, 'нить в обычном режиме должна быть заметной')
  // Именованные звёзды крупнее фоновых, с ореолом и лучами.
  assert.match(client, /radius: Math\.max\(1\.5, 4\.4 - mag \* 0\.72\)/u)
  assert.match(client, /if \(star\.radius > 3\) \{/u)
  // Дрейф медленный: небосклон ползёт, а не едет.
  assert.match(client, /return \{ drift: 0\.6, figures \}/u)
  // Фигуры не наезжают друг на друга: у каждой своя точка неба.
  const spots = [...figures.matchAll(/x: (0\.\d+),\s*\n\s*y: (0\.\d+)/gu)].map(([, x, y]) => `${x},${y}`)
  assert.equal(new Set(spots).size, spots.length, 'две фигуры стоят в одной точке неба')
  assert.match(client, /this\.constellations = createConstellationLayer\(this\.width, this\.height\)/u)
  // Под каждым созвездием — полупрозрачная подсказка-силуэт. Она должна быть
  // у КАЖДОЙ фигуры: фигура без силуэта остаётся голой россыпью.
  const figuresData = client.slice(
    client.indexOf('const CONSTELLATIONS'),
    client.indexOf('function createConstellationLayer'),
  )
  const names = [...figuresData.matchAll(/name: '([^']+)'/gu)].map(([, name]) => name)
  const shapes = client.slice(
    client.indexOf('const CONSTELLATION_SILHOUETTES'),
    client.indexOf('function drawSilhouette'),
  )
  const shaped = [...shapes.matchAll(/^ {6}'([^']+)': Object\.freeze\(\{/gmu)].map(([, name]) => name)
  assert.deepEqual(
    names.filter((name) => !shaped.includes(name)),
    [],
    'есть фигуры без силуэта-подсказки',
  )
  // Подсказка бледная: её замечают только те, кто знает, что это за фигура.
  // Числа живут в CONSTELLATION_STYLE — по режиму, а не в разных константах.
  assert.match(client, /shape: 0\.075, shapeLine: 0\.1/u, 'бледные числа силуэта должны остаться прежними в тихом режиме')
  // Силуэт идёт ПЕРВЫМ в фигуре, то есть под звёздами и линиями.
  const body = client.slice(
    client.indexOf('function drawConstellations'),
    client.indexOf('function createField'),
  )
  assert.ok(
    body.indexOf('drawSilhouette(') < body.indexOf('const x1 ='),
    'силуэт должен рисоваться раньше линий',
  )
  assert.match(client, /function drawSilhouette\(ctx, figure, ox, oy, size, style\)/u)
  // Три примитива, а не картинки: своих файлов тема не тянет.
  assert.equal(/kind: 'poly'/u.test(shapes), true)
  assert.equal(/kind: 'disc'/u.test(shapes), true)
  assert.equal(/kind: 'stroke'/u.test(shapes), true)
  // Тумблер есть в хосте, в нормализации и в панели.
  assert.match(host, /constellations: z\.boolean\(\)\.default\(true\)/u)
  assert.match(client, /constellations: value\?\.constellations !== false/u)
  assert.match(client, /switchRow\('constellations', text\.constellations, text\.constellationsHint\)/u)
})

test('созвездия держат дальний план, а их количество задаёт хост', () => {
  // Дальний план — это порядок слоёв в кадре, а не только приглушение:
  // созвездия идут сразу после очистки холста, под газом, звёздами, планетами
  // и всеми прочими телами. Иначе фигуры светятся поверх планетных дисков.
  const frame = client.slice(
    client.indexOf('render(dt) {'),
    client.indexOf('start() {'),
  )
  const order = [
    'ctx.clearRect(0, 0, this.width, this.height)',
    'drawConstellations(ctx, this.width, this.time)',
    "drawStars(ctx, this.width, this.time, 'dim')",
    'drawBackground(ctx, this.width, this.height, this.time)',
    'drawStars(ctx, this.width, this.time, \'bright\')',
    'drawSuns(ctx, this.width, this.height)',
    'drawBlackHoles(ctx, this.width, this.height)',
    'drawPlanets(ctx, this.width, this.height, step)',
    'drawComets(ctx, this.width, this.height, step)',
  ]
  let previous = -1
  for (const step of order) {
    const at = frame.indexOf(step)
    assert.notEqual(at, -1, `в кадре нет шага ${step}`)
    assert.ok(at > previous, `шаг «${step}» идёт не в том порядке`)
    previous = at
  }
  assert.equal(
    (frame.match(/drawConstellations\(ctx, this\.width, this\.time\)/gu) || []).length,
    1,
    'слой созвездий должен рисоваться ровно один раз за кадр',
  )
  // Приглушение и уменьшение — обязательная часть дальнего плана: без них
  // фигура остаётся ближней по ощущению, даже нарисованная первой. В ТИХОМ
  // режиме («под текстом») приглушение прежнее.
  assert.match(client, /const CONSTELLATION_FAR_ALPHA = 0\.62/u)
  assert.match(client, /const CONSTELLATION_FAR_STARS = 0\.78/u)
  assert.match(client, /const size = Math\.max\(96, Math\.min\(width, height\) \* CONSTELLATION_FAR_SIZE\)/u)
  assert.match(client, /ctx\.globalAlpha = space\.options\.underlay === true \? CONSTELLATION_FAR_ALPHA : 1/u)
  assert.match(client, /const radius = star\.radius \* CONSTELLATION_FAR_STARS/u)
  // РАЗМЕР ФИГУРЫ. Доля неба поднята с 0.12: на 1080p это было 130 px, и линии
  // не складывались в узнаваемый рисунок. Проверяем, что доля не уползла обратно
  // и осталась заметно крупнее доли одного звездного слоя.
  const farSize = client.match(/const CONSTELLATION_FAR_SIZE = ([\d.]+)/u)
  assert.ok(farSize, 'нет доли неба под фигуру')
  assert.equal(Number(farSize[1]) >= 0.15, true, `доля неба ${farSize[1]} снова слишком мала`)
  assert.ok(
    new RegExp(`const CONSTELLATION_FAR_SIZE = ${farSize[1].replace('.', '\\.')}`, 'u').test(client),
    'размер задан не тем числом, которое проверяется',
  )
  // Количество — настройка плагина, а не константа в коде.
  assert.match(client, /const CONSTELLATION_COUNT_MIN = 0/u)
  assert.match(client, /const CONSTELLATION_COUNT_MAX = 14/u)
  assert.match(client, /const DEFAULT_CONSTELLATION_COUNT = 8/u)
  assert.match(client, /constellationCount: DEFAULT_CONSTELLATION_COUNT/u)
  // Хост отдаёт то же поле: и в Config, и в namespace настроек, иначе панель
  // писала бы в пустоту, а хост отверг бы значение.
  assert.match(host, /constellationCount: z\.number\(\)\.min\(0\)\.max\(14\)\.default\(8\)\.description/u)
  assert.match(host, /constellationCount: z\.number\(\)\.min\(0\)\.max\(14\)\.default\(8\),/u)
  assert.match(client, /constellationCount: Number\.isFinite\(constellationCount\)/u)
  assert.match(client, /Math\.min\(CONSTELLATION_COUNT_MAX, Math\.max\(CONSTELLATION_COUNT_MIN, Math\.round\(constellationCount\)\)\)/u)
  // Панель показывает ровно столько фигур, сколько выбрано, и ползунок
  // появляется только вместе с самими созвездиями.
  const draw = client.slice(
    client.indexOf('function drawConstellations'),
    client.indexOf('function createField'),
  )
  assert.match(draw, /const wanted = Number\(space\.options\.constellationCount\)/u)
  assert.match(draw, /for \(const figure of layer\.figures\.slice\(0, limit\)\)/u)
  assert.match(draw, /if \(limit === 0\) return/u, 'ноль созвездий — пустое небо, а не весь каталог')
  assert.match(draw, /layer\.figures\.length/u, 'больше, чем есть в каталоге, показать нельзя')
  const panel = client.slice(client.indexOf('function DeepSpaceSettings'), client.indexOf('function DeepSpaceAction'))
  assert.match(panel, /'constellationCount',\n\s*text\.constellationCount/u)
  assert.match(panel, /\{ min: CONSTELLATION_COUNT_MIN, max: CONSTELLATION_COUNT_MAX, step: 1 \}/u)
  assert.match(panel, /value\.constellationCount,\n\s*\(next\) => \{\n\s*props\.controller\.set\(\{ constellationCount: next \}\)/u)
  assert.match(panel, /value\.constellations\s*\n\s*\? sliderRow\(/u, 'ползунок только при включённых созвездиях')
  // Подписи на обоих языках: панель переключается между ними по языку хоста.
  assert.match(client, /constellationCount: 'Сколько созвездий'/u)
  assert.match(client, /constellationCount: 'How many constellations'/u)
})

test('созвездия видно: слой гаснет вчетверо, и фигура возвращает себе эту потерю', () => {
  // Жалоба: «созвездий не видно». Причина не в каталоге и не в количестве, а в
  // двух множителях подряд: слой в обычном режиме светится на 40 % (applySettings),
  // и поверх этого нить фигуры была 0.34 при общем приглушении 0.62. На экране
  // это ~0.07 — линии не видно, остаются только точки, а фигура без линий не
  // читается как созвездие.
  assert.match(client, /const CONSTELLATION_STYLE = Object\.freeze\(\{/u)
  assert.match(client, /function constellationStyle\(\)/u)
  assert.match(client, /return space\.options\.underlay === true \? CONSTELLATION_STYLE\.under : CONSTELLATION_STYLE\.over/u)
  // В обычном режиме линия и точка ярче тихих чисел — иначе прибавки нет.
  const over = client.match(/over: Object\.freeze\(\{([\s\S]*?)\}\),/u)
  const under = client.match(/under: Object\.freeze\(\{([\s\S]*?)\}\),/u)
  assert.ok(over && under, 'нет двух режимов стиля')
  const numberIn = (block, key) => Number(block[1].match(new RegExp(`${key}: ([\\d.]+)`, 'u'))[1])
  for (const key of ['glow', 'thread', 'halo', 'ray', 'core', 'shape']) {
    assert.ok(
      numberIn(over, key) > numberIn(under, key),
      `в обычном режиме ${key} должен быть ярче тихого, а не наоборот`,
    )
  }
  // Нить — опознавательный признак, она обязана быть заметной: при 0.34 и
  // слое 0.34 её не было видно, при 0.95 её читается.
  assert.ok(numberIn(over, 'thread') >= 0.9, 'нить фигуры должна быть заметной')
  // Тихое сохранено: под текстом слой уходит за интерфейс, и лишняя яркость
  // мешала бы читать текст.
  assert.ok(numberIn(under, 'thread') <= 0.35, 'в режиме «под текстом» нить должна остаться тихой')
  // Числа читаются из кода, а не из двух мест: отдельных констант силуэта нет.
  assert.equal(/SILHOUETTE_ALPHA|SILHOUETTE_LINE/u.test(client), false, 'числа силуэта должны жить в стиле')
  assert.match(client, /\$\{style\.shape \* weight\}/u)
  assert.match(client, /\$\{style\.shapeLine \* weight\}/u)
  assert.match(client, /rgba\(186, 214, 255, \$\{style\.thread\}\)/u)
  assert.match(client, /rgba\(255, 255, 255, \$\{style\.core\}\)/u)
})
