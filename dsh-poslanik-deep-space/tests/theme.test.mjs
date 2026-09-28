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

test('манифест и пакет описывают клиентскую тему', () => {
  assert.equal(manifest.id, 'dsh-poslanik-deep-space')
  assert.equal(manifest.main, './lib/index.js')
  assert.equal(manifest.client.main, './lib/client.js')
  assert.deepEqual(manifest.client.inject, ['@deepseek-ai/dsh-client-ui-slots'])
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
  assert.equal(pkg.dsh.client.platform, 'web')
  assert.deepEqual(pkg.exports['./client'], './lib/client.js')
  // Страховка от pnpm add: он однажды молча выбросил этот ключ при переписывании
  // package.json, и клиентская половина перестала подключаться.
  assert.deepEqual(pkg.dsh.client.inject, ['@deepseek-ai/dsh-client-ui-slots'])
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

test('корабли мелкие, с корпусом, тягой и шлейфом', () => {
  assert.match(client, /function updateShips\(dt, width, height\)/u)
  assert.match(client, /const count = 3 \+ Math\.floor\(Math\.random\(\) \* 2\)/u)
  assert.match(client, /size: 3 \+ depth \* 10/u)
  assert.match(client, /trail\.length > 34/u)
  assert.match(client, /ship\.energy -= 0\.45/u)
  assert.match(client, /ship\.bank = lerp/u)
  assert.match(client, /ship\.throttle = lerp/u)
  assert.match(client, /ctx\.ellipse\(-size \* 0\.85/u)
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

  for (const field of ['enabled', 'stars', 'ships', 'comets', 'planets', 'perturbation', 'underlay', 'suns', 'blackholes', 'language', 'intensity']) {
    assert.ok(Object.hasOwn(module.Config({}), field), `в схеме нет поля ${field}`)
  }
})

test('уважает prefers-reduced-motion и остановку вкладки', () => {
  assert.match(client, /prefers-reduced-motion: reduce/u)
  assert.match(client, /visibilitychange/u)
  assert.match(client, /cancelAnimationFrame/u)
})
