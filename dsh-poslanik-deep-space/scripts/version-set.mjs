// Единая точка правды для версии: package.json и dsh.plugin.json расходятся
// легко, а DSH читает обе. Скрипт правит их вместе и проверяет формат.
//
// Запуск: npm run version:set -- 1.2.0
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const next = process.argv[2]

if (next === undefined) {
  const manifest = JSON.parse(readFileSync(join(root, 'dsh.plugin.json'), 'utf8'))
  console.error(`текущая версия: ${manifest.version}\nзапуск: npm run version:set -- 1.2.0`)
  process.exit(1)
}

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(next)) {
  console.error(`не похоже на версию: ${next}`)
  process.exit(1)
}

// Пишем без BOM: DSH и Node спотыкаются о BOM в JSON как о битой файле.
const write = (file, value) => writeFileSync(join(root, file), value, 'utf8')

const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
packageJson.version = next
write('package.json', `${JSON.stringify(packageJson, null, 2)}\n`)

const manifest = JSON.parse(readFileSync(join(root, 'dsh.plugin.json'), 'utf8'))
manifest.version = next
write('dsh.plugin.json', `${JSON.stringify(manifest, null, 2)}\n`)

console.log(`версия выставлена: ${next} (package.json + dsh.plugin.json)`)
