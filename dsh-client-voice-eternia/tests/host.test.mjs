// Тесты host-половины: разбор ключей, чистка ответа модели, настройки и маршруты.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  cleanTranscript,
  describeEnvironment,
  inject,
  isTrustedCaller,
  parseProviderModels,
  readCredentialRefs,
  readProviderModels,
  readSettings,
  resolveApiKey,
  writeSettings,
  DEFAULT_SETTINGS,
  API_PREFIX,
} from '../src/index.js'

/** Создаёт временный DSH_HOME. */
function makeHome(files = {}) {
  const home = mkdtempSync(join(tmpdir(), 'vet-'))
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(home, name), content, 'utf8')
  }
  return home
}

const CREDENTIALS = `version: 1
records:
  some-record:
    kind: grant
    payload:
      version: 1
      secret: should-not-be-read
refs:
  OR_API_KEY: test-or-value
  AGNES_API_KEY: test-agnes-value
`

test('префикс маршрутов не совпадает с чужими', () => {
  assert.equal(API_PREFIX, '/voice-eternia')
  // Чужие префиксы, занятые в этом профиле: столкновение роняет строку плагина.
  for (const taken of ['/plugins', '/voice-input', '/speech', '/we-sync']) {
    assert.notEqual(API_PREFIX, taken)
  }
})

test('ключи читаются из секции refs и не путаются с records', () => {
  const home = makeHome({ '.credentials.yaml': CREDENTIALS })
  const refs = readCredentialRefs(home)
  assert.equal(refs.OR_API_KEY, 'test-or-value')
  assert.equal(refs.AGNES_API_KEY, 'test-agnes-value')
  assert.equal(refs.secret, undefined, 'секрет из records не должен попасть в карту ключей')
  assert.equal(refs.version, undefined, 'служебные поля не должны попасть в карту')
})

test('отсутствие файла ключей не роняет чтение', () => {
  const home = makeHome()
  assert.deepEqual(readCredentialRefs(home), {})
})

test('ключ разрешается по имени провайдера', () => {
  const refs = { OR_API_KEY: 'a', AGNES_API_KEY: 'b' }
  assert.equal(resolveApiKey(refs, 'or'), 'a')
  assert.equal(resolveApiKey(refs, 'agnes'), 'b')
  assert.equal(resolveApiKey(refs, 'unknown'), undefined)
})

test('чистка ответа снимает кавычки, блок кода и заголовок', () => {
  assert.equal(cleanTranscript('«Привет, мир»'), 'Привет, мир')
  assert.equal(cleanTranscript('"Привет"'), 'Привет')
  assert.equal(cleanTranscript('```\nПривет, мир\n```'), 'Привет, мир')
  assert.equal(cleanTranscript('```text\nПривет\n```'), 'Привет')
  assert.equal(cleanTranscript('Расшифровка: Привет, мир'), 'Привет, мир')
  assert.equal(cleanTranscript('  Привет  '), 'Привет')
})

test('служебный маркер отсутствия речи превращается в пустую строку', () => {
  assert.equal(cleanTranscript('ПУСТО'), '')
  assert.equal(cleanTranscript('пусто'), '')
  assert.equal(cleanTranscript('Пусто.'), 'Пусто.', 'маркер со знаком — это уже текст')
})

test('чистка устойчива к неожидаемым типам', () => {
  assert.equal(cleanTranscript(undefined), '')
  assert.equal(cleanTranscript(null), '')
  assert.equal(cleanTranscript(42), '')
})

test('настройки по умолчанию — русский язык и полировка выключена', () => {
  const home = makeHome()
  const settings = readSettings(home)
  assert.deepEqual(settings, DEFAULT_SETTINGS)
  assert.equal(settings.asr.language, 'ru')
  assert.equal(settings.polish.enabled, false, 'полировка по умолчанию выключена: это улучшение, а не базовый путь')
  // Плоская форма больше не используется: она осталась бы в коде мёртвой и
  // вводила бы в заблуждение при чтении настроек.
  assert.equal(settings.asrModel, undefined)
  assert.equal(settings.polishModel, undefined)
})

test('конфиг из карточки настроек главнее файла', () => {
  // Файл — запасной источник для настроек, сделанных до карточки. Но если
  // человек поменял модель в интерфейсе, побеждает именно она.
  const home = makeHome({
    'voice-eternia.json': JSON.stringify({ asrModel: 'старая-модель', polish: true }),
  })
  const settings = readSettings(home, { asr: { model: 'новая-модель' } })
  assert.equal(settings.asr.model, 'новая-модель')
  // Поле, которого в конфиге нет, берётся из файла, а не сбрасывается.
  assert.equal(settings.polish.enabled, true)
})

test('старый плоский файл всё ещё читается', () => {
  // Обратная совместимость: настройки, записанные до появления карточки,
  // обязаны пережить её появление, иначе человек молча потеряет модель.
  const home = makeHome({
    'voice-eternia.json': JSON.stringify({
      asrProvider: 'or', asrModel: 'старый', language: 'en',
      polish: true, polishModel: 'редактор', polishPrompt: 'Правь кратко.',
    }),
  })
  const settings = readSettings(home)
  assert.equal(settings.asr.provider, 'or')
  assert.equal(settings.asr.model, 'старый')
  assert.equal(settings.asr.language, 'en')
  assert.equal(settings.polish.enabled, true)
  assert.equal(settings.polish.model, 'редактор')
  assert.equal(settings.polish.prompt, 'Правь кратко.')
})

test('настройки сохраняются и переживают перезапись', () => {
  const home = makeHome()
  writeSettings(home, { polish: { enabled: true }, asr: { language: 'ru' } })
  const saved = readSettings(home)
  assert.equal(saved.polish.enabled, true)
  assert.equal(saved.asr.language, 'ru')
  // В файле остаётся плоская форма: её читает код, запущенный без карточки.
  const raw = JSON.parse(readFileSync(join(home, 'voice-eternia.json'), 'utf8'))
  assert.equal(raw.polish, true)
  assert.equal(raw.language, 'ru')
})

test('битые настройки откатываются к значениям по умолчанию', () => {
  const home = makeHome({ 'voice-eternia.json': '{ это не json' })
  assert.deepEqual(readSettings(home), DEFAULT_SETTINGS)
})

test('чужие типы в настройках не подменяют значения по умолчанию', () => {
  const home = makeHome({ 'voice-eternia.json': JSON.stringify({ language: 42, polish: 'да' }) })
  const settings = readSettings(home)
  assert.equal(settings.asr.language, 'ru', 'число вместо строки должно быть отброшено')
  assert.equal(settings.polish.enabled, false, 'строка вместо булева должна быть отброшена')
  // То же и в конфиге: чужая подмена обязана остаться незамеченной, а не тихо
  // сломать разбор ответа модели.
  const fromConfig = readSettings(makeHome(), { polish: { enabled: 'да' }, asr: { model: 42 } })
  assert.equal(fromConfig.polish.enabled, false)
  assert.equal(fromConfig.asr.model, DEFAULT_SETTINGS.asr.model)
})

test('схема настроек покрывает то, чем плагин пользуется', async () => {
  const { Config, DEFAULT_SETTINGS: defaults } = await import('../src/index.js')
  const parsed = Config(undefined)
  for (const group of Object.keys(parsed)) {
    assert.ok(group in defaults, `группа ${group} есть в схеме, но не в настройках`)
  }
  // Промпт полировки и выбор модели — то, ради чего карточка и делается.
  assert.equal(typeof parsed.polish.prompt, 'string', 'промпт редактору должен настраиваться')
  assert.equal(typeof parsed.polish.model, 'string', 'модель полировки должна выбираться')
  assert.equal(typeof parsed.asr.model, 'string', 'модель распознавания должна выбираться')
  assert.equal(typeof parsed.recording.device, 'string', 'микрофон должен выбираться')
  assert.ok(parsed.asr.language !== undefined, 'язык речи должен настраиваться')
})

test('доверенным считается только локальный вызов', () => {
  assert.equal(isTrustedCaller({ socket: { remoteAddress: '127.0.0.1' } }), true)
  assert.equal(isTrustedCaller({ socket: { remoteAddress: '::1' } }), true)
  assert.equal(isTrustedCaller({ socket: { remoteAddress: '::ffff:127.0.0.1' } }), true)
  assert.equal(isTrustedCaller({ socket: { remoteAddress: '192.168.1.5' } }), false)
  assert.equal(isTrustedCaller({ socket: {} }), false)
  assert.equal(isTrustedCaller({}), false)
})

test('корень DSH берётся из окружения, а при его отсутствии — из домашнего каталога', async () => {
  const { resolveDshHome } = await import('../src/index.js')
  assert.equal(resolveDshHome({ DSH_HOME: 'C:\\h' }), 'C:\\h')
  assert.equal(resolveDshHome({ DSH_HOME: '  C:\\h  ' }), 'C:\\h', 'пробелы обрезаются')
  // Пустое значение не должно приводить к записи в корень диска.
  const fallback = resolveDshHome({})
  assert.match(fallback, /\.dsh$/)
  assert.notEqual(fallback, '')
})

test('без сервиса webServer плагин предупреждает, а не падает', async () => {
  const warnings = []
  const ctx = {
    get: () => undefined,
    effect: () => () => {},
    inject: () => {},
    logger: { warn: (message) => warnings.push(message), info: () => {} },
  }
  const { apply } = await import('../src/index.js')
  assert.doesNotThrow(() => apply(ctx, { dshHome: 'C:\\tmp' }))
  assert.match(warnings.join(' '), /webServer/)
})

test('сервисы объявлены в inject — маршруты не поднимаются на раннем такте', () => {
  // Без этого объявления загрузчик вызовет apply до готовности webServer,
  // ctx.get вернёт undefined, и плагин молча останется без маршрутов.
  assert.ok(Array.isArray(inject), 'inject обязан быть массивом имён сервисов')
  assert.ok(inject.includes('webServer'), 'webServer — обязательный сервис пакета')
  for (const name of inject) {
    assert.doesNotMatch(name, /[/@]/, `«${name}» похоже на имя пакета, а не сервиса`)
  }
})

/**
 * Поддельный сервис `connection`: подписывает адрес ровно так, как это делает
 * настоящий, — добавляет токен запуска процесса.
 *
 * @param {string} token - значение токена.
 * @returns {object} сервис с единственным нужным методом.
 */
const connectionWith = (token) => ({
  authenticatedUrl: (base) => `${base}?token=${token}`,
})

test('адрес для браузера собирается из заголовка Host', () => {
  // Заголовок отражает реальное соединение, поэтому он приоритетнее окружения.
  const request = { headers: { host: '127.0.0.1:43129' } }
  const env = describeEnvironment(request, { env: { DSH_WEB_PORT: '1' } }, connectionWith('TOK'))
  assert.equal(env.webUrl, 'http://127.0.0.1:43129?token=TOK')
  assert.equal(env.port, 43129)
})

test('адрес подписывается токеном запуска — иначе браузер ответит 401', () => {
  // Регрессия: кнопка «Открыть в браузере» вела на голый адрес без токена, и
  // `dsh web` отвечал «authentication required; reopen the URL printed by dsh
  // web». Ссылка с токеном — единственная рабочая.
  const env = describeEnvironment({ headers: { host: '127.0.0.1:58046' } }, {}, connectionWith('secret42'))
  assert.match(env.webUrl, /\?token=secret42$/)
})

test('без сервиса connection ссылка пуста, а не мёртвая', () => {
  // Кнопка с адресом без токена гарантированно отдаст 401. Лучше не показывать
  // её вовсе: клиент скрывает кнопку, когда webUrl пуст.
  const env = describeEnvironment({ headers: { host: '127.0.0.1:58046' } }, {}, null)
  assert.equal(env.webUrl, '', 'без подписи ссылка не должна показываться')
  assert.equal(env.port, 58046, 'порт при этом известен и может быть полезен')
})

test('упавший сервис connection не роняет маршрут', () => {
  const broken = { authenticatedUrl() { throw new Error('нет токена') } }
  const env = describeEnvironment({ headers: { host: '127.0.0.1:58046' } }, {}, broken)
  assert.equal(env.webUrl, '', 'сбой подписи даёт пустую ссылку, а не исключение наружу')
  assert.doesNotThrow(() => describeEnvironment({ headers: { host: '127.0.0.1:1' } }, {}, { authenticatedUrl: 42 }))
})

test('сервис connection не объявлен в inject — плагин переживает его отсутствие', () => {
  // Обязательный `inject` не даст плагину стартовать без `connection`. А он
  // необязателен: без него всё работает, кроме кнопки браузера. Поэтому сервис
  // берётся императивно на каждый запрос.
  assert.equal(inject.includes('connection'), false,
    'connection не должен быть в inject: его отсутствие не должно ронять плагин')
  assert.ok(inject.includes('webServer'), 'webServer остаётся обязательным')
})

test('без заголовка порт берётся из окружения', () => {
  const env = describeEnvironment({ headers: {} }, { env: { DSH_WEB_PORT: '49711' } }, connectionWith('TOK'))
  assert.equal(env.webUrl, 'http://127.0.0.1:49711?token=TOK')
})

test('явный адрес из конфигурации перекрывает всё', () => {
  const request = { headers: { host: '127.0.0.1:1' } }
  const env = describeEnvironment(request, { webUrl: 'http://127.0.0.1:9000', env: {} }, connectionWith('TOK'))
  assert.equal(env.webUrl, 'http://127.0.0.1:9000?token=TOK')
})

test('плагин сам регистрирует страницу настроек — иначе карточки нет', async () => {
  // Регрессия против молчаливой потери настроек: схема `Config` присутствовала,
  // Inspect показывал status: schema с пятью группами, а в интерфейсе карточки
  // не было. Сервис `settings` показывает только то, что плагин сам
  // зарегистрировал через `configure()`; без этого вызова форма не создаётся.
  const { apply } = await import('../src/index.js')
  const configured = []
  const ctx = {
    inject: (names, callback) => {
      assert.deepEqual(names, ['settings'], 'страница настроек требует сервиса settings')
      callback({
        effect: (fn) => fn(),
        settings: { configure: (policy, owner) => { configured.push({ policy, owner }) } },
      })
    },
    get: () => ({ register: () => {} }),
    effect: (fn) => fn(),
    logger: { warn: () => {}, info: () => {} },
    fiber: 'FIBER-1',
  }
  apply(ctx, { dshHome: 'C:\\tmp' }, {})
  assert.equal(configured.length, 1, 'плагин обязан зарегистрировать страницу настроек')
  assert.equal(configured[0].policy.auto, false, 'страница не должна появляться сама по себе')
  assert.equal(configured[0].owner, 'FIBER-1', 'политика принадлежит волокну плагина')
})

test('страница настроек регистрируется даже без маршрутов', async () => {
  // Раньше отсутствие webServer обрывало apply до регистрации страницы: человек
  // получал плагин вообще без настроек и не мог починить его из интерфейса.
  const { apply } = await import('../src/index.js')
  const configured = []
  const ctx = {
    inject: (names, callback) => callback({
      effect: (fn) => fn(),
      settings: { configure: () => { configured.push(1) } },
    }),
    get: () => undefined,
    effect: (fn) => fn(),
    logger: { warn: () => {}, info: () => {} },
    fiber: 'FIBER-2',
  }
  apply(ctx, { dshHome: 'C:\\tmp' }, {})
  assert.equal(configured.length, 1, 'настройки должны быть доступны и при сломанных маршрутах')
})

test('неизвестный порт даёт пустой адрес, а не угаданный', () => {
  // Кнопка с нерабочей ссылкой хуже отсутствующей кнопки.
  for (const options of [{ env: {} }, { env: { DSH_WEB_PORT: 'не число' } }, { env: { DSH_WEB_PORT: '99999' } }]) {
    const env = describeEnvironment({ headers: {} }, options, connectionWith('TOK'))
    assert.equal(env.webUrl, '', `ожидался пустой адрес для ${JSON.stringify(options)}`)
    assert.equal(env.port, null)
  }
})

test('нулевой и отрицательный порт отбрасываются', () => {
  const c = connectionWith('TOK')
  assert.equal(describeEnvironment({ headers: {} }, { env: { DSH_WEB_PORT: '0' } }, c).webUrl, '')
  assert.equal(describeEnvironment({ headers: {} }, { env: { DSH_WEB_PORT: '-1' } }, c).webUrl, '')
})

test('все файлы хоста на месте — иначе плагин падает на импорте', async () => {
  // Регрессия: `src/index.js` импортирует `./capture.js`, но сборщик копировал
  // в `lib` только `index.js`. Node падал с ERR_MODULE_NOT_FOUND, и из-за
  // одного отсутствующего файла не поднимались даже маршруты распознавания.
  const { existsSync, readFileSync } = await import('node:fs')
  const { fileURLToPath } = await import('node:url')
  const { dirname, join } = await import('node:path')
  const lib = join(dirname(fileURLToPath(import.meta.url)), '..', 'lib')
  for (const file of ['index.js', 'capture.js', 'client.js']) {
    assert.ok(existsSync(join(lib, file)), `нет lib/${file} — запусти npm run build`)
  }
  assert.match(readFileSync(join(lib, 'index.js'), 'utf8'), /from '\.\/capture\.js'/,
    'хост импортирует модуль захвата: он обязан попадать в lib при сборке')
})

test('маршруты захвата подняты вместе с префиксом', async () => {
  const paths = []
  const ctx = {
    get: (name) => (name === 'webServer'
      ? { register: (route) => { paths.push(route.path) } }
      : undefined),
    effect: (fn) => fn(),
    inject: () => {},
    logger: { warn: () => {}, info: () => {} },
  }
  const { apply } = await import('../src/index.js')
  apply(ctx, { dshHome: 'C:\\tmp' })
  assert.deepEqual(paths, [API_PREFIX], 'префикс маршрутов должен подниматься один раз')
  // Маршруты захвата живут внутри обработчика префикса, поэтому проверяем их
  // наличие в исходнике: отдельной регистрации у них нет.
  const { readFileSync } = await import('node:fs')
  const source = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8')
  for (const path of ['/record/devices', '/record/start', '/record/status', '/record/stop', '/record/cancel']) {
    assert.ok(source.includes(`'${path}'`), `в хосте нет маршрута ${path}`)
  }
})

test('браузерный захват из пакета вырезан полностью', async () => {
  // Регрессия против прежней архитектуры: запись велась через `getUserMedia` в
  // странице, и в окне Electron она отказывала молча — без единой записи в
  // логах. Теперь запись ведёт хост, поэтому в клиентском бандле не должно
  // остаться ни одного обращения к браузерным API записи.
  const { readFileSync } = await import('node:fs')
  const { fileURLToPath } = await import('node:url')
  const { dirname, join } = await import('node:path')
  const client = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'client.js'), 'utf8')
  // Комментарии оставляем: там объясняется, ПОЧЕМУ этих вызовов нет. Проверять
  // надо исполняемый код, иначе тест ругался бы на собственную документацию.
  const code = client.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
  for (const forbidden of ['getUserMedia', 'MediaRecorder', 'OfflineAudioContext', 'AudioContext']) {
    assert.equal(code.includes(forbidden), false,
      `${forbidden} в окне Electron не работает — запись ведёт хост`)
  }
  assert.match(client, /record\/start/, 'клиент обязан звать маршрут захвата хоста')
  assert.match(client, /record\/stop/, 'клиент обязан звать маршрут остановки хоста')
  assert.match(client, /record\/status/, 'клиент обязан опрашивать состояние записи')
})

test('модели читаются из профиля DSH, а не вписываются вручную', () => {
  // Поле «модель» текстом требует помнить id провайдера и точное имя: одна
  // опечатка — и запись молча откажет. Список берём оттуда, где он уже описан.
  const text = [
    'providers:',
    '  or:',
    '    displayName: or',
    '    models:',
    '      - id: a/one:free',
    '        name: "One (free)"',
    '      - id: b/two',
    '        name: "Two"',
    '    apiKeyEnv: KEY',
    '  second:',
    '    models:',
    '      - id: c/three',
    '        name: "Three"',
  ].join('\n')
  const models = parseProviderModels(text)
  assert.equal(models.length, 3, 'все три модели найдены')
  assert.deepEqual([...new Set(models.map((m) => m.provider))], ['or', 'second'],
    'провайдеры различаются: models не должен становиться именем провайдера')
  assert.equal(models[0].name, 'One (free)', 'подпись берётся из name, а не из id')
  assert.equal(models[0].free, true, 'суффикс :free помечает модель бесплатной')
  assert.equal(models[1].free, false, 'остальные — нет')
  assert.equal(models.some((m) => m.id === 'KEY'), false, 'чужие ключи моделью не считаются')
})

test('парсер моделей не падает на пустом и мусорном входе', () => {
  assert.deepEqual(parseProviderModels(''), [])
  assert.deepEqual(parseProviderModels('привет\nмир'), [])
  assert.deepEqual(parseProviderModels('   \n\n'), [])
})

test('из настроенного профиля приходят только осмысленные модели', () => {
  // Живая проверка на профиле этой машины: если профиль недоступен, тест
  // не должен падать — он просто нечего не проверит.
  const models = readProviderModels(process.env)
  for (const model of models) {
    assert.equal(typeof model.id === 'string' && model.id !== '', true, 'id непустой')
    assert.equal(typeof model.name === 'string' && model.name !== '', true, 'подпись непустая')
    assert.equal(typeof model.provider === 'string' && model.provider !== '', true, 'провайдер указан')
  }
  const free = models.filter((m) => m.free)
  if (free.length > 1) {
    assert.equal(models[0].free, true, 'бесплатные идут первыми: их и ищут')
  }
})

test('в списке моделей только бесплатные', () => {
  // Диктовка и полировка — не та задача, ради которой стоит платить, а платная
  // модель в списке была бы ловушкой: человек выбрал бы её не заметив.
  const text = [
    'providers:',
    '  or:',
    '    models:',
    '      - id: a/free-one:free',
    '        name: "Free One"',
    '      - id: b/paid-one',
    '        name: "Paid One"',
  ].join('\n')
  const models = parseProviderModels(text)
  assert.equal(models.length, 2, 'парсер видит обе модели')
  const onlyFree = models.filter((m) => m.free)
  assert.equal(onlyFree.length, 1, 'бесплатная ровно одна')
  assert.equal(onlyFree[0].name, 'Free One')
})

test('бесплатность определяется суффиксом :free, а не подписью', () => {
  // Подпись — текст для человека, её может не быть вовсе. Признак берётся из id.
  const text = [
    'providers:',
    '  or:',
    '    models:',
    '      - id: x/paid-with-free-word',
    '        name: "Free in name only"',
    '      - id: x/free-no-name:free',
  ].join('\n')
  const models = parseProviderModels(text)
  assert.equal(models.find((m) => m.id === 'x/paid-with-free-word').free, false,
    'слово free в подписи ничего не значит')
  assert.equal(models.find((m) => m.id === 'x/free-no-name:free').free, true,
    'признак берётся из id, даже когда подписи нет')
})

test('каждый импорт хоста имеет файл в lib', async () => {
  // Сборщик копировал в lib три файла поимённо, пока хост не стал импортировать
  // speech.js и vad.js. Node падал на импорте, плагин не грузился — и ронял всё
  // приложение, причём виноват оказался код, дописанный раньше всех.
  const root = new URL('../', import.meta.url)
  const src = readdirSync(new URL('src/', root)).filter((n) => n.endsWith('.js'))
  for (const name of src) {
    const text = readFileSync(new URL('src/' + name, root), 'utf8')
    for (const match of text.matchAll(/from\s+'(\.\/[^']+)'/g)) {
      const target = match[1].replace(/^\.\//, '')
      const copied = new URL('lib/' + target, root)
      assert.equal(existsSync(copied), true,
        `lib/${name} требует lib/${target}, а такого файла нет — плагин упадёт при загрузке`)
    }
  }
})

test('плагин грузится как его грузит DSH', async () => {
  // Не проверка функций, а самого факта загрузки точки входа: именно на этом
  // шаге Node бросает ERR_MODULE_NOT_FOUND и приложение падает.
  const entry = new URL('lib/index.js', new URL('../', import.meta.url)).href
  const loaded = await import(entry)
  assert.equal(typeof loaded.apply, 'function', 'нужен apply')
  assert.equal(typeof loaded.inject, 'object', 'нужен inject')
  assert.ok(loaded.inject.includes('webServer'), 'плагин ждёт сервис веб-сервера')
})

/**
 * Прогоняет один маршрут плагина через поддельный webServer и отдаёт ответ.
 *
 * Смысл: до этого тесты видели маршруты только глазами — по именам и строкам.
 * Опечатка в вызове внутри обработчика (\`readJson\` вместо \`readJsonBody\`)
 * прошла все проверки и всплыла у человека: кнопка микрофона показала
 * «reason is not defined», а маршрут отвечал 500 с пустым телом.
 *
 * @param {string} method - HTTP-метод.
 * @param {string} path - путь запроса.
 * @param {object} [body] - тело запроса.
 * @returns {Promise<{status: number, payload: object|null, raw: string}>} ответ.
 */
async function callRoute(method, path, body) {
  // Регистрация у плагина одна: webServer.register({ kind, path, handler }).
  let handler
  const webServer = {
    register(spec) { handler = spec.handler },
  }
  const ctx = {
    get: (name) => (name === 'webServer' ? webServer : undefined),
    effect: (fn) => { fn(); return () => {} },
    inject: () => {},
    logger: { warn: () => {}, info: () => {} },
  }
  const mod = await import('../src/index.js')
  mod.apply(ctx, { dshHome: 'C:\\tmp' })
  assert.equal(typeof handler, 'function', 'плагин обязан зарегистрировать обработчик')

  const chunks = []
  const response = {
    statusCode: 0,
    headers: {},
    setHeader(name, value) { this.headers[name] = value },
    writeHead(status) { this.statusCode = status },
    write(chunk) { chunks.push(String(chunk)) },
    end(chunk) { if (chunk !== undefined) chunks.push(String(chunk)) },
    writableEnded: false,
  }
  const raw = JSON.stringify(body ?? {})
  const request = {
    method,
    url: path,
    headers: { host: '127.0.0.1:43129' },
    socket: { remoteAddress: '127.0.0.1' },
  }
  request[Symbol.asyncIterator] = async function* () { yield Buffer.from(raw) }
  await handler(request, response)
  const text = chunks.join('')
  let payload = null
  try { payload = JSON.parse(text) } catch { payload = null }
  return { status: response.statusCode, payload, raw: text }
}

test('маршрут состояния записи отвечает без опечаток', async () => {
  // Самый дешёвый маршрут: не трогает микрофон, но проходит весь путь через
  // обработчик — то есть ловит необъявленные имена внутри него.
  const answer = await callRoute('GET', '/voice-eternia/record/status')
  assert.equal(answer.status, 200, 'маршрут обязан ответить 200, а не упасть')
  assert.equal(answer.payload?.ok, true, 'ответ обязан быть разобранным JSON с ok:true')
})

test('маршруты, читающие тело, не падают на разборе запроса', async () => {
  // Здесь и жила опечатка: обработчик звал readJson, а функция называется
  // readJsonBody. Тело читается ДО try, поэтому исключение улетало мимо
  // перехвата, маршрут отвечал 500 с пустым телом, а человек видел в панели
  // «reason is not defined» вместо причины.
  const voices = await callRoute('GET', '/voice-eternia/voices')
  assert.equal(voices.status, 200, 'список голосов обязан отвечать')
  assert.equal(voices.payload?.ok, true)
})
