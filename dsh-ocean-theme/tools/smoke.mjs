// Проверка клиентской половины без браузера.
//
// Клиентская половина склеивается движком как обычный скрипт, поэтому здесь
// подставляются заглушки окружения, а весь код выполняется как есть: так
// ловится ровно та поломка, из-за которой фон молча не рисуется.
//
// Запуск: node tools/smoke.mjs [путь-к-lib/client.js] [куда-положить-scene.svg]

import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)

const here = fileURLToPath(new URL('.', import.meta.url))
const bundle = resolve(process.argv[2] || new URL('../lib/client.js', new URL(here, '..')).pathname.slice(1))
const sceneOut = process.argv[3] || resolve(here, '../scene.svg')

/**
 * Элемент-заглушка: нужны только те свойства, которые трогает тема.
 */
function makeElement(tag) {
  const el = {
    tagName: String(tag).toUpperCase(),
    style: { setProperty() {}, removeProperty() {} },
    children: [],
    className: '',
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value },
    getAttribute(name) { return this.attributes[name] },
    appendChild(child) { this.children.push(child); child.parentNode = this; return child },
    removeChild(child) {
      const i = this.children.indexOf(child)
      if (i >= 0) this.children.splice(i, 1)
      child.parentNode = null
      return child
    },
    get textContent() { return '' },
    set textContent(_) {},
    querySelector(selector) {
      const attr = /\[([\w-]+)="([^"]+)"\]/.exec(selector)
      if (attr === null) return null
      return this.children.find((child) => child.attributes[attr[1]] === attr[2]) || null
    },
  }
  Object.defineProperty(el, 'parentNode', { value: null, writable: true })
  return el
}

const head = makeElement('head')
const body = makeElement('body')
const registered = []

const document = {
  head,
  body,
  createElement: makeElement,
  querySelector(selector) {
    const attr = /\[([\w-]+)="([^"]+)"\]/.exec(selector)
    for (const el of body.children.concat(head.children)) {
      if (el.attributes[attr[1]] === attr[2]) return el
    }
    return null
  },
}

let captured = null
const win = {
  __ModuleLoader__: { load(mod) { captured = mod } },
  addEventListener() {},
  removeEventListener() {},
  requestAnimationFrame() { return 1 },
  cancelAnimationFrame() {},
  setTimeout() { return 1 },
  clearTimeout() {},
  localStorage: {
    _v: {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this._v, k) ? this._v[k] : null },
    setItem(k, v) { this._v[k] = String(v) },
  },
  document,
  fetch: () => Promise.resolve({ json: () => Promise.resolve({}) }),
  setInterval() { return 1 },
  clearInterval() {},
}
win.window = win

// Тема ищет `globalThis.document` и `globalThis.window`; в Node их нет, но
// ключевые слова разрешаются в глобальную область, поэтому объявляем здесь.
globalThis.window = win
globalThis.document = document
globalThis.requestAnimationFrame = win.requestAnimationFrame
globalThis.cancelAnimationFrame = win.cancelAnimationFrame
globalThis.setInterval = win.setInterval
globalThis.clearInterval = win.clearInterval
globalThis.localStorage = win.localStorage

const effects = []
const listeners = []
// Заглушка темы создаётся ОДИН раз: иначе каждый ctx.get('theme') отдавал бы
// новый объект, и проверка в конце читала бы пустой список слоёв.
const themeStub = {
  // getTheme нужен плагину для чтения схемы, overrideTokens — для стекла.
  // Слои запоминаем, чтобы дым проверял, что в них есть ОБЕ схемы: одна схема
  // означала бы, что при переключении темы панели останутся стеклом прежней воды.
  слои: [],
  getTheme: () => ({ active: { colorScheme: 'dark' } }),
  overrideTokens: (source, tokens) => { themeStub.слои.push({ source, tokens }); return () => {} },
}
const ctx = {
  get(name) {
    if (name === 'theme') return themeStub
    if (name === 'slots') {
      return {
        inject(slot, cb) { cb() },
        register(props, render) { registered.push({ props, render }); return () => {} },
      }
    }
    return undefined
  },
  effect(fn) { const dispose = fn(); effects.push(dispose) },
  on(name, fn) { listeners.push([name, fn]); return () => {} },
  effectScope: null,
}

const source = readFileSync(bundle, 'utf8')
new Function('require', 'module', 'exports', 'window', 'document', source)(require, { exports: {} }, {}, win, document)

if (captured === null) {
  console.error('бандл не зарегистрировался через window.__ModuleLoader__.load')
  process.exit(1)
}
// Фабрика принимает только `require`, а свой `module` держит в замыкании и
// возвращает наружу: разбирать надо возвращённое значение, а не переданное.
const moduleExports = captured.factory(require)
if (moduleExports === undefined || typeof moduleExports.apply !== 'function') {
  console.error('модуль не отдал exports.apply')
  process.exit(1)
}
moduleExports.apply(ctx)

const layer = body.children.find((el) => el.className === 'dsh-ocean-layer')
if (layer === undefined) {
  console.error('слой картины не создан: в body нет элемента dsh-ocean-layer')
  process.exit(1)
}

const url = layer.style.backgroundImage || ''
const match = /url\("data:image\/svg\+xml,([^"]+)"\)/.exec(url)
if (match === null) {
  console.error('у слоя нет фоновой картины')
  process.exit(1)
}
const svg = decodeURIComponent(match[1])
writeFileSync(sceneOut, svg, 'utf8')

const uses = (svg.match(/<use /g) || []).length
console.log('сцена: ' + svg.length + ' байт, тел ' + uses + ', эффектов ' + effects.length + ', слушателей ' + listeners.length)
console.log('слотов зарегистрировано: ' + registered.map((r) => r.props.id).join(', '))
console.log('сцена записана: ' + sceneOut)

// Стекло обязано нести обе схемы: тема выбирает нужную сама, и панели
// следуют за переключением темы, а не замирают на первой заливке.
const слойСтекла = themeStub.слои.find((l) => l.source === 'dsh-ocean-theme')
if (слойСтекла === undefined) {
  console.error('плагин не наложил слой стекла на тему')
  process.exit(1)
}
const значения = Object.entries(слойСтекла.tokens)
const безПары = значения.filter(([, v]) => !v || typeof v !== 'object' || !v.light || !v.dark)
if (безПары.length > 0) {
  console.error('слой стекла без пары светлая/тёмная: ' + безПары.map(([k]) => k).join(', '))
  process.exit(1)
}
const совпали = значения.filter(([, v]) => v.light === v.dark).map(([k]) => k)
if (совпали.length > 0) {
  console.error('светлая и тёмная схемы совпали, тему переключить будет нечем: ' + совпали.join(', '))
  process.exit(1)
}
console.log('стекло: ' + значения.length + ' токенов, обе схемы различаются')
