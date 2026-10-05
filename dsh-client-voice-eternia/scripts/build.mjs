// Сборка бандла «Голоса Этернии».
//
// DSH грузит клиентскую половину через `window.__ModuleLoader__.load(...)`,
// поэтому на выходе обязан быть самодостаточный модуль: ни одного `import`,
// ни одного `export`, ни JSX. Исходники написаны как обычный ESM, а этот
// скрипт снимает обёртки, склеивает модули в порядке зависимостей и
// оборачивает в фабрику. Внешних зависимостей у пакета нет, поэтому
// полноценный бандлер (esbuild, rollup) здесь не нужен — ровно как в
// соседнем dsh-client-heman-golden-dawn.

import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

const PLUGIN_ID = 'dsh-client-voice-eternia'

/** Модули в порядке зависимостей: каждый следующий может звать предыдущие. */
/**
 * Модули, которые рантайм отдаёт фабрике через `require`.
 *
 * Список взят из таблицы фронтенда (`WS()` в dsh-web-frontend). Сверка с ним на
 * сборке ловит опечатку в имени пакета за секунду, а не в браузере.
 */
const SEED_MODULES = new Set([
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
])

const MODULES = [
  'src/client/theme.css.js',
  // Словари идут первыми: recorder.js создаёт переводчик по умолчанию на
  // верхнем уровне модуля, и при другой очередности сборки тот увидел бы
  // ещё не объявленную функцию.
  'src/client/locales.js',
  // Очистка текста к озвучке живёт вне каталога клиента: ею пользуется и хост,
  // и страница, а правило «что произносить» должно быть одно. Поэтому путь
  // от клиента к нему идёт через `../` — сборщик такие импорты тоже убирает.
  'src/speakText.js',
  'src/client/api.js',
  'src/client/recorder.js',
  // Разговор идёт после api и recorder: он зовёт их на верхнем уровне не
  // раньше, чем те объявлены. Настройки и кнопка — после них, потому что
  // пользуются обоими.
  'src/client/talk.js',
  'src/client/echo.js',
  'src/client/settingsPanel.js',
  'src/client/dictate.js',
  // Кнопка разговора — отдельная ячейка слота; без неё в бандле она просто
  // не появится в панели ввода, и разговор останется недоступным.
  'src/client/talkButton.js',
  'src/client/index.js',
]

/**
 * Локальные модули: всё, что лежит рядом с исходниками плагина.
 *
 * Проверка нужна потому, что список `MODULES` задан вручную. Модуль, который
 * забыли в него вписать, не роняет сборку — он просто молча выпадает из
 * бандла, и его функции в интерфейсе просто нет.
 */
function localModulesUnder(dir) {
  const base = join(root, dir)
  const found = []
  for (const name of existsSync(base) ? readdirSync(base) : []) {
    if (name.endsWith('.js') === false) continue
    found.push(`${dir}/${name}`)
  }
  return found
}

/**
 * Убирает `export ` в начале строки объявления, сохраняя `async`.
 *
 * `async` обязан остаться на месте: `export async function f()` без него
 * превратилось бы в обычную функцию с `await` внутри — синтаксическая ошибка,
 * которую видно только в браузере. Поэтому заменяем ровно слово `export`
 * с последующими пробелами, не трогая остаток строки.
 */
function unexport(source) {
  return source.replace(/^export\s+(?=(?:async\s+)?(?:const|function|class|let|var)\b)/gm, '')
}

/** Убирает списки реэкспорта: их присваивает вручную фабрика бандла. */
function dropExportLists(source) {
  return source.replace(/^export\s*\{[^}]*\}(?:\s*from\s*'[^']*')?\s*;?\s*$/gm, '')
}

/**
 * Превращает импорты внешних пакетов в вызовы `require`.
 *
 * Рантайм отдаёт фабрике единственную функцию `require`, именующую модули из
 * таблицы фронтенда (`WS()` в dsh-web-frontend). Собрать внешний импорт в
 * `require` нужно ДО удаления локальных импортов: иначе удаление проглотит и
 * его тоже, а модуль молча останется без зависимости.
 *
 * @param {string} source - тело модуля.
 * @returns {string} то же с `var {...} = require('...')`.
 */
function rewriteExternalImports(source) {
  return source.replace(
    /^import\s+\{([^}]*)\}\s+from\s+'([^']+)'\s*;?\s*$/gm,
    (_match, names, specifier) => {
      // Относительный путь — это наш собственный модуль: его тело уже склеено
      // выше, и импорт должен исчезнуть вместе со строкой. Превращать его в
      // `require('./…')` нельзя: бандл стал бы требовать сам себя.
      if (specifier.startsWith('./') || specifier.startsWith('../')) return _match
      return `var {${names}} = require('${specifier}');`
    },
  )
}

/** Убирает локальные импорты — тела этих модулей уже склеены выше. */
function dropLocalImports(source) {
  // Важно: строка целиком, без `[\s\S]`. С ленивым переходом через строки
  // регулярка съедала соседний ВНЕШНИЙ импорт, доскакивая до ближайшего
  // `from './…'`, — модуль терял зависимость без единой ошибки сборки.
  // Шаблон покрывает и `../`: разговор берёт очистку текста из общей папки,
  // и такой импорт тоже должен исчезнуть, а не упасть проверкой на экспорт.
  return source.replace(/^import\s+[^\n]*from\s*'\.\.?\/[^']*'\s*;?\s*$/gm, '')
}

/** Сдвигает каждую строку на указанное число табов. */
function indent(text, levels) {
  const pad = '\t'.repeat(levels)
  return text
    .split('\n')
    .map((line) => (line.length > 0 ? pad + line : line))
    .join('\n')
}

function moduleBody(path) {
  const text = dropExportLists(dropLocalImports(rewriteExternalImports(unexport(readFileSync(join(root, path), 'utf8')))))
  if (/^\s*(import|export)\s/m.test(text)) {
    throw new Error(`${path}: в бандле остались import/export — бандл обязан быть самодостаточным`)
  }
  // Внешняя зависимость, до которой не дошла таблица фронтенда, упала бы в
  // браузере при загрузке бандла — и по виду не отличалась бы от любой другой
  // ошибки загрузки плагина. Поэтому сверяемся с таблицей уже на сборке.
  for (const match of text.matchAll(/require\('([^']+)'\)/g)) {
    if (!SEED_MODULES.has(match[1])) {
      throw new Error(`${path}: внешний модуль '${match[1]}' отсутствует в таблице фронтенда — бандл упадёт в браузере`)
    }
  }
  return text
}

const parts = MODULES.map((path) => `\n// ── ${path} ${'─'.repeat(Math.max(0, 60 - path.length))}\n${moduleBody(path)}`)

// Модуль, забытый в списке, не ломает сборку — он молча выпадает из бандла, и
// его функций в интерфейсе просто нет. Такое уже случалось дважды: разговор и
// наблюдатель за ответом были написаны, проверены по отдельности и не доехали
// до бандла, потому что список дописывали отдельно от кода.
const bundled = new Set(MODULES)
// Проверяются только клиентские модули: всё из `src/client` обязано попасть в
// бандл. Файлы верхнего уровня (`src/index.js`, `capture.js`, `speech.js`,
// `vad.js`) живут на хосте, и требовать их в бандле было бы ошибкой. Всё, что
// клиент тянет из верхнего уровня через `../`, — а это очистка текста к
// озвучке — попадает в бандл и потому тоже проверяется.
const upper = existsSync(join(root, 'src')) ? readdirSync(join(root, 'src')) : []
const upperNames = new Set(upper.filter((name) => name.endsWith('.js')))
const clientSources = [
  ...localModulesUnder('src/client'),
  // Из верхнего уровня в бандл берутся только те, что явно помечены как общие
  // для клиента и хоста; остальное — код хоста.
  ...[...bundled].filter((path) => path.startsWith('src/') && !path.startsWith('src/client/')),
]
const missing = clientSources.filter((path) => bundled.has(path) === false)
// Файл из `src`, на который клиент ссылается через `../`, обязан быть в
// бандле — иначе импорт не исчезнет и сборка упадёт на проверке экспортов.
for (const name of upperNames) {
  if (bundled.has(`src/${name}`) === false && MODULES.some((p) => p.startsWith('src/client/'))) {
    const referenced = MODULES.some((p) => readFileSync(join(root, p), 'utf8').includes(`'../${name}'`))
    if (referenced) missing.push(`src/${name} (на него ссылается клиент через ../)`)
  }
}
if (missing.length > 0) {
  console.error(`МОДУЛИ НЕ В БАНДЛЕ: ${missing.join(', ')} — их функции не появятся в интерфейсе`)
  process.exitCode = 1
}

// Фабрика заканчивается присваиваниями: рантайм читает `apply` и `inject`
// именно из экспортов модуля, а не из замыкания.
//
// `styleSeat` — необязательный второй аргумент фабрики: браузерная половина
// рантайма передаёт `styles` аргументом в своё замыкание, а фабрика модуля
// замыканием рантайма не является. Кто позовёт фабрику с ним — получит сиденье
// стилей прямо здесь; кто не позовёт — код откатится к `document.head`.
const bundle = `// Generated by scripts/build.mjs — do not edit. Source: src/client/.
// DSH грузит клиентские бандлы через window.__ModuleLoader__, поэтому файл
// самодостаточен: ни одного внешнего импорта, только присваивания в exports.
window.__ModuleLoader__.load({ id: '${PLUGIN_ID}', factory: (require, styleSeat) => {
var module = { exports: {} };
var exports = module.exports;
// React берётся ИМЕННО через require('react'): в области видимости фабрики нет
// свободной переменной React, и обращение к ней в строгом режиме бросило бы
// ReferenceError при ПЕРВОМ ЖЕ рендере компонента. Рантайм роняет такую ячейку
// слота (active: false), и кнопка не появляется — без единой записи в консоли
// на стороне хоста. Соседний рабочий плагин dsh-workbuddy-connect делает так же.
var React = require('react');
if (typeof styleSeat !== 'undefined' && styleSeat !== null) {
	globalThis.__VOICE_ETERNIA_STYLES__ = styleSeat;
}
${indent(parts.join('\n'), 1)}
exports.SLOT_ID = SLOT_ID;
exports.SLOT_ORDER = SLOT_ORDER;
exports.STYLE_NAME = STYLE_NAME;
exports.CLASSES = CLASSES;
exports.VOICE_ETERNIA_CSS = VOICE_ETERNIA_CSS;
exports.DictateButton = DictateButton;
exports.Recording = Recording;
exports.encodeWave = encodeWave;
exports.toBase64 = toBase64;
exports.probeSupport = probeSupport;
exports.classifyFailure = classifyFailure;
exports.classifyFailureMessage = classifyFailureMessage;
exports.describeFailure = describeFailure;
exports.isDesktopShell = isDesktopShell;
exports.listMicrophones = listMicrophones;
exports.TARGET_SAMPLE_RATE = TARGET_SAMPLE_RATE;
// Словари интерфейса: русский, английский и встроенный китайский.
exports.NAMESPACE = NAMESPACE;
exports.RUSSIAN = RUSSIAN;
exports.DICTIONARIES = DICTIONARIES;
exports.createTranslate = createTranslate;
exports.defaultTranslate = defaultTranslate;
// inject объявляет ИМЕНА СЕРВИСОВ (slots). Соседний рабочий плагин
// dsh-client-heman-golden-dawn объявляет так же, а имена пакетов для клиента
// живут отдельно — в package.json → dsh.client.inject.
exports.inject = inject;
exports.apply = apply;
return module.exports;
} });
`

mkdirSync(join(root, 'lib'), { recursive: true })
writeFileSync(join(root, 'lib/client.js'), bundle, 'utf8')

// Host-половина копируется в lib как есть: её грузит Node, а не браузер, и
// самодостаточность здесь не нужна. Без этого файла loader не находит точку
// входа из поля `main` и падает с ERR_MODULE_NOT_FOUND.
//
// Копируются ВСЕ модули верхнего уровня, а не перечисленные поимённо. Список
// из трёх файла однажды разошёлся с кодом: хост стал импортировать `speech.js`
// и `vad.js`, а копировал только `index.js` и `capture.js`. Node падал на
// импорте, плагин не грузился — и вместе с собой ронял всё приложение, причём
// виноват был не тот код, который писался последним, а тот, что дописвался
// раньше всех. Импорт `./…` от такого не защищает: он лежит уже в lib.
const hostModules = existsSync(join(root, 'src'))
  ? readdirSync(join(root, 'src')).filter((name) => name.endsWith('.js'))
  : []
const hostSizes = []
for (const name of hostModules) {
  const text = readFileSync(join(root, 'src', name), 'utf8')
  writeFileSync(join(root, 'lib', name), text, 'utf8')
  hostSizes.push(`lib/${name} — ${Buffer.byteLength(text, 'utf8')} байт`)
}

console.log(`built lib/client.js — ${Buffer.byteLength(bundle, 'utf8')} bytes, ${MODULES.length} modules`)
for (const line of hostSizes) console.log(`copied ${line}`)

// Проверка обязательных файлов хоста. Импорт `./capture.js` из `index.js`
// не виден сборщику, а его отсутствие обрушивает плагин уже в Node — поэтому
// отсутствие файла надо назвать здесь, а не в логе хоста часом позже.
for (const required of ['lib/index.js', 'lib/client.js']) {
  if (!existsSync(join(root, required))) {
    console.error(`ОТСУТСТВУЕТ ${required} — плагин не запустится`)
    process.exitCode = 1
  }
}

// Проверка импортов хоста. Каждый `import … from './x.js'` в модулях `src`
// обязан иметь файл рядом в `lib`: иначе Node падает на импорте, плагин не
// грузится, и вместе с ним падает приложение. Именно так уронил его сборщик,
// копировавший три файла поимённо и забывший про новые.
for (const name of hostModules) {
  const text = readFileSync(join(root, 'src', name), 'utf8')
  for (const match of text.matchAll(/from\s+'(\.\/[^']+)'/g)) {
    const target = match[1].replace(/^\.\//, '')
    if (existsSync(join(root, 'lib', target))) continue
    console.error(`ИМПОРТ БЕЗ ФАЙЛА: lib/${name} требует lib/${target}, а такого файла нет — плагин упадёт при загрузке`)
    process.exitCode = 1
  }
}
