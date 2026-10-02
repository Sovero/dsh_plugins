// Сверка УСТАНОВЛЕННОЙ копии плагина с исходником.
//
// Зачем: плагин живёт в двух местах — исходник (репозиторий) и копия, которую
// хост ставит и из которой грузит клиентскую половину. Правка исходника сама по
// себе в интерфейсе не появляется: браузер получает файл из установленной копии,
// и она обновляется только при переустановке плагина или перезапуске хоста.
// Расхождение однажды стоило получаса: правка была сделана в исходнике, тесты были
// зелёные, а панель в приложении не менялась.
//
// Что делает скрипт: находит установленную копию через поколение профиля и
// сравнивает с исходником по SHA-256. Ноль расхождений — выход 0. Расхождение —
// ненулевой выход и печать того, что разошлось и что делать.
//
// Запуск: node scripts/check-installed.mjs
// Или из корня профиля: node scripts/check-installed.mjs [каталог-исходника]
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const source = resolve(process.argv[2] ?? join(here, '..'))

// Поколение профиля: живая копия лежит в <профиль>/.generations/live/<плагин>+*/.
// Ищем её по имени пакета, а не по номеру версии: имя каталога держит версию на
// момент установки и давно перестаёт совпадать с манифестом.
function findInstalled(profile) {
  const live = join(profile, '.generations', 'live')
  if (!existsSync(live)) return []
  const found = []
  for (const entry of readdirSync(live)) {
    if (!entry.startsWith('dsh-poslanik-deep-space+')) continue
    for (const relative of ['node_modules/dsh-poslanik-deep-space', 'source/dsh-poslanik-deep-space']) {
      const directory = join(live, entry, ...relative.split('/'))
      if (existsSync(join(directory, 'package.json'))) found.push(directory)
    }
  }
  return found
}

function profileOf(start) {
  // От исходника вверх по дереву ищем корень профиля Harness. Он лежит не
  // обязательно на самом верху: репозиторий плагинов — соседняя ветка от
  // profiles/, поэтому проверяем и сам каталог, и profiles/ внутри него.
  let current = start
  for (let step = 0; step < 6; step += 1) {
    for (const candidate of [current, join(current, 'profiles')]) {
      if (existsSync(join(candidate, '.generations', 'live'))) return candidate
    }
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }
  return null
}

const FILES = ['lib/client.js', 'lib/index.js', 'package.json', 'dsh.plugin.json']

const hash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 12)
const fail = (message) => {
  console.error(`✗ ${message}`)
  process.exitCode = 1
}
const ok = (message) => console.log(`✓ ${message}`)

ok(`исходник: ${source}`)
const profile = profileOf(source)
if (profile === null) fail('не найден корень профиля (.generations/live) — проверять нечего')
else {
  const installed = findInstalled(profile)
  if (installed.length === 0) fail(`установленная копия не найдена в ${join(profile, '.generations', 'live')}`)
  for (const directory of installed) {
    const differs = FILES.filter((file) => {
      const from = join(source, file)
      const to = join(directory, file)
      return existsSync(to) ? hash(from) !== hash(to) : true
    })
    if (differs.length === 0) ok(`совпадает: ${directory}`)
    else {
      fail(`расходится: ${directory} — ${differs.join(', ')}`)
      console.error('  установленная копия обновляется при переустановке плагина или при перезапуске хоста;')
      console.error('  правка исходника сама по себе в интерфейсе не появляется.')
    }
  }
}

// Метка времени нужна, чтобы отличать «только что установили» от «давно»:
// копия, синхронизированная месяц назад, выглядит свежей по содержимому.
if (existsSync(join(source, 'lib/client.js'))) {
  const age = Math.round((Date.now() - statSync(join(source, 'lib/client.js')).mtimeMs) / 60000)
  console.log(`исходник менялся ${age} мин назад`)
}