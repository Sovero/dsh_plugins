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

test('настройки темы живут в хосте и выводятся в панель настроек', () => {
  assert.match(client, /createHostSettingsForm\(ctx, PLUGIN_ID\)/u)
  assert.match(client, /ctx\.slots\.inject\('settings\.general\.item'/u)
  assert.match(client, /ctx\.slots\.register\(/u)
  assert.equal(/localStorage/u.test(client), false, 'настройки принадлежат хосту, не браузеру')
})

test('панель настроек двуязычная, язык живёт в хосте', () => {
  assert.match(client, /const STRINGS = Object\.freeze\(\{/u)
  assert.match(client, /en: \{/u)
  assert.match(client, /function translator\(preference\)/u)
  assert.match(client, /language: 'auto'/u)
  assert.match(client, /pds-lang/u)
  assert.match(host, /Language\(\)\.default\('auto'\)/u)
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
  assert.match(client, /text\.planetSpeed\(speedPercent\)/u)
  assert.match(client, /props\.controller\.set\(\{ planetSpeed: Number\(event\.target\.value\) \/ 100 \}\)/u)
  for (const bound of ["min: '10'", "max: '200'", "step: '5'"]) {
    assert.ok(client.includes(bound), `в ползунке скорости планет нет ${bound}`)
  }
  assert.match(host, /planetSpeed: z\.number\(\)\.min\(0\.1\)\.max\(2\)\.default\(1\)/u)
})

test('корабли мелкие, с корпусом, тягой и шлейфом', () => {
  assert.match(client, /function updateShips\(dt, width, height\)/u)
  assert.match(client, /const count = 3 \+ Math\.floor\(Math\.random\(\) \* 2\)/u)
  assert.match(client, /size: 3 \+ depth \* 10/u)
  assert.match(client, /trail\.length > 34/u)
  assert.match(client, /ship\.energy -= 0\.45/u)
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

test('корабли имеют инерцию: курс меняется не мгновенно', () => {
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
  // Нос смотрит по фактической скорости, поэтому на вираже отстаёт от замысла.
  assert.match(client, /ship\.heading = nextAngle/u)
  assert.match(client, /const SHIP_ACCEL = 24/u)
  assert.match(client, /const SHIP_TURN = 0\.55/u)
  // Смена курса меняет замысел, а не траекторию.
  assert.match(client, /ship\.targetHeading \+= rand\(-0\.8, 0\.8\)/u)
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
  assert.match(host, /z\.union\(\[z\.const\('auto'\), z\.const\('ru'\), z\.const\('en'\)\]\)/u)
})

test('host-половина грузится с настоящим schemastery', async (t) => {
  // Статическая проверка всегда: в schemastery 3.18.4 нет z.enum, такое поле
  // роняет загрузку хоста, и плагин пропадает с экрана без единой ошибки в UI.
  assert.equal(/z\.enum\(/u.test(host), false, 'z.enum в schemastery отсутствует — используйте z.union из z.const')
  assert.match(host, /const Language = \(\) => z\.union/u)

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

  // Перечисление собирается через z.union из z.const: значения из панели
  // принимаются, а посторонние отвергаются с внятным сообщением.
  assert.doesNotThrow(() => module.Config({}))
  assert.doesNotThrow(() => module.Config({ language: 'en', underlay: true, intensity: 1.2 }))
  assert.doesNotThrow(() => module.Config({ language: 'ru' }))
  assert.throws(() => module.Config({ language: 'xx' }), /expected .*auto.*ru.*en/su)

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

  for (const field of ['enabled', 'stars', 'ships', 'comets', 'planets', 'perturbation', 'underlay', 'suns', 'blackholes', 'language', 'intensity', 'fps']) {
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
  assert.match(client, /const PLANET_MAX_ACCEL = 5/u)
  assert.match(client, /Math\.min\(PLANET_MAX_ACCEL, /u)
  // Потолок скорости — жёсткая гарантия: разогнаться планете нечем.
  assert.match(client, /const PLANET_MAX_SPEED = 42/u)
  // Потолок урезается множителем дрейфа, иначе гравитация снова вытолкнула бы
  // планету на прежнюю скорость при вдвое медленном режиме.
  assert.match(client, /const limit = PLANET_MAX_SPEED \* planetDriftScale\(\)/u)
  assert.match(client, /const scale = limit \/ speed/u)
  assert.match(client, /planet\.vx \*= scale/u)
  // Стартовая скорость медленная: 5–15 выглядели слишком быстро.
  assert.match(client, /const speed = rand\(4, 11\) \* planet\.depth \* planetDriftScale\(\)/u)
  // Множитель приходит из настроек темы и уважает границы 0.1–2.
  assert.match(client, /function planetDriftScale\(\)/u)
  assert.match(client, /Number\(space\.options\?\.planetSpeed\)/u)
  assert.match(client, /Math\.min\(2, Math\.max\(0\.1, planetSpeed\)\)/u)
  // Закон мягкий: деление на расстояние, а не на квадрат, и большое смягчение.
  assert.match(client, /\(d \+ PLANET_SOFTEN\)/u)
  assert.match(client, /const PLANET_SOFTEN = 400/u)
  assert.match(client, /const d = Math\.max\(1, Math\.hypot\(dx, dy\)\)/u)
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
  const prelude = ['PLANET_G', 'PLANET_SOFTEN', 'PLANET_MAX_ACCEL', 'PLANET_MAX_SPEED', 'PLANET_GAP']
    .map((name) => extractConst(name))
  assert.equal(prelude.every((text) => text !== null), true, 'нет констант гравитации')
  // Модель целиком: масса, притяжение, разделение, появление и шаг кадра.
  const model = client.slice(
    client.indexOf('function planetMass'),
    client.indexOf('function createPlanets'),
  )
  const bind = new Function(
    'space',
    'width',
    'height',
    `${prelude.join('\n')}\n${model}\nreturn { updatePlanets }`,
  )
  // Две планеты, намеренно сближенные: гравитация тут работает на полную.
  const scene = {
    planets: [
      { x: 320, y: 300, vx: 0, vy: 0, radius: 80, laneTop: 0, laneBottom: 0.5, spin: 0 },
      { x: 880, y: 300, vx: 0, vy: 0, radius: 70, laneTop: 0.5, laneBottom: 1, spin: 0 },
    ],
  }
  const limit = Number(extractConst('PLANET_MAX_SPEED').match(/=\s*(\d+)/u)[1])
  const api = bind(scene, 1920, 1080)
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
  // 0.11 при толщине 0.7 тонули в фоновой сыпи, и созвездий не было видно.
  assert.match(client, /rgba\(186, 214, 255, 0\.34\)/u)
  assert.match(client, /rgba\(140, 178, 240, 0\.09\)/u, 'под нитью должно быть мягкое свечение')
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
  assert.match(client, /const SILHOUETTE_ALPHA = 0\.075/u)
  assert.match(client, /const SILHOUETTE_LINE = 0\.1/u)
  // Силуэт идёт ПЕРВЫМ в фигуре, то есть под звёздами и линиями.
  const body = client.slice(
    client.indexOf('function drawConstellations'),
    client.indexOf('function createField'),
  )
  assert.ok(
    body.indexOf('drawSilhouette(') < body.indexOf('const x1 ='),
    'силуэт должен рисоваться раньше линий',
  )
  assert.match(client, /function drawSilhouette\(ctx, figure, ox, oy, size\)/u)
  // Три примитива, а не картинки: своих файлов тема не тянет.
  assert.equal(/kind: 'poly'/u.test(shapes), true)
  assert.equal(/kind: 'disc'/u.test(shapes), true)
  assert.equal(/kind: 'stroke'/u.test(shapes), true)
  // Тумблер есть в хосте, в нормализации и в панели.
  assert.match(host, /constellations: z\.boolean\(\)\.default\(true\)/u)
  assert.match(client, /constellations: value\?\.constellations !== false/u)
  assert.match(client, /switchRow\('constellations', text\.constellations, text\.constellationsHint\)/u)
})
