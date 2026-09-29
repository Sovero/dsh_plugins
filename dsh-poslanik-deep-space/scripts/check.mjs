// Проверка перед публикацией: синтаксис обеих половин, версии согласованы,
// тесты зелёные. Сборки нет — клиентская половина пишется руками как обычный
// скрипт, поэтому проверять тут больше нечего.
//
// Запуск: npm run check
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const fail = (message) => {
  console.error(`✗ ${message}`)
  process.exitCode = 1
}
const ok = (message) => console.log(`✓ ${message}`)

for (const file of ['lib/index.js', 'lib/client.js']) {
  const result = spawnSync(process.execPath, ['--check', join(root, file)], { stdio: 'inherit' })
  if (result.status === 0) ok(`синтаксис ${file}`)
  else fail(`синтаксис ${file}`)
}

const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const manifest = JSON.parse(readFileSync(join(root, 'dsh.plugin.json'), 'utf8'))
if (packageJson.version === manifest.version) ok(`версии согласованы: ${manifest.version}`)
else fail(`версии разошлись: package.json ${packageJson.version} ≠ dsh.plugin.json ${manifest.version}`)

if (packageJson.name === manifest.id) ok(`имя совпадает с id: ${manifest.id}`)
else fail(`имя ${packageJson.name} ≠ id ${manifest.id}`)

// pnpm add переписывает package.json, а dsh.client — единственное место, где
// клиентская половина объявляет платформу. Раньше здесь стояла проверка на
// `dsh.client.inject` со значением `@deepseek-ai/dsh-client-ui-slots`: пакет
// такого имени в поставке DSH нет, из-за чего клиентская половина падала при
// импорте, а профиль уходил в safe mode. Теперь проверяем обратное — чтобы
// несуществующая пакетная зависимость не вернулась.
if (packageJson.dsh?.client?.platform === undefined) fail('в package.json нет dsh.client.platform')
else if (packageJson.dsh.client.inject !== undefined) {
  fail('в package.json не должно быть dsh.client.inject: такого пакета нет в поставке DSH')
} else ok('dsh.client без пакетных зависимостей')

if (packageJson.dsh?.bundle?.patch === undefined) fail('в package.json нет dsh.bundle.patch')
else ok('dsh.bundle.patch на месте')

for (const file of [packageJson.main, manifest.client.main, packageJson.dsh.bundle.patch]) {
  try {
    readFileSync(join(root, file))
    ok(`файл на месте: ${file}`)
  } catch {
    fail(`файл не найден: ${file}`)
  }
}

// Обычный `node --test` изолирует каждый файл в отдельном процессе; в
// некоторых окружениях это запрещено, поэтому есть запасной путь.
// Файлы перечисляем сами: каталог node --test в этом Node трактует как модуль,
// а шаблон раскрывает оболочка, которой при spawnSync нет.
const testFiles = readdirSync(join(root, 'tests'))
  .filter((name) => name.endsWith('.test.mjs'))
  .map((name) => join(root, 'tests', name))
if (testFiles.length === 0) fail('тесты не найдены в tests/')

let tests = spawnSync(process.execPath, ['--test', ...testFiles], { cwd: root, stdio: 'inherit' })
if (tests.status !== 0) {
  console.log('повтор с --experimental-test-isolation=none')
  tests = spawnSync(process.execPath, ['--experimental-test-isolation=none', '--test', ...testFiles], {
    cwd: root,
    stdio: 'inherit',
  })
}
if (tests.status === 0) ok('тесты зелёные')
else fail('тесты упали')
