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
    // Холст фонаря: заглушка обязана отдать контекст, иначе живой слой
    // молча уходит в catch и проверка не увидит, что он вообще создан.
    getContext() {
      return {
        setTransform() {}, clearRect() {}, fillRect() {}, beginPath() {}, arc() {},
        ellipse() {}, fill() {},
        createRadialGradient() { return { addColorStop() {} } },
        createLinearGradient() { return { addColorStop() {} } },
      }
    },
    getBoundingClientRect() { return { width: 1600, height: 900 } },
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
    if (attr === null) return null
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
  devicePixelRatio: 1,
  fetch: () => Promise.resolve({ json: () => Promise.resolve({}) }),
  setInterval() { return 1 },
  clearInterval() {},
}
win.window = win
// `document.defaultView` нужен живому фонарю: он берёт оттуда resize и кадры.
document.defaultView = win

// Тема ищет `globalThis.document` и `globalThis.window`; в Node их нет, но
// ключевые слова разрешаются в глобальную область, поэтому объявляем здесь.
globalThis.window = win
globalThis.document = document
globalThis.requestAnimationFrame = win.requestAnimationFrame
globalThis.cancelAnimationFrame = win.cancelAnimationFrame
globalThis.setInterval = win.setInterval
globalThis.clearInterval = win.clearInterval
globalThis.localStorage = win.localStorage
// Заглушка React. Она обязана быть здесь, а НЕ в `globalThis.React`: фабрика
// берёт React через `require("react")`, и если в дереве рядом с плагином лежит
// настоящий пакет, вызов хука вне рендера бросает «Invalid hook call» — ошибка
// приходит из библиотеки, а не из проверяемого кода, и маскирует настоящую
// поломку. Поэтому `require` подменяется целиком (см. stubRequire ниже).
const reactStub = {
  createElement: (type, props, ...kids) => ({ type, props: props || {}, kids }),
  useState: (initial) => [initial, () => {}],
  useRef: (initial) => ({ current: initial }),
  useEffect: () => {},
  useLayoutEffect: () => {},
  useMemo: (fn) => fn(),
  useCallback: (fn) => fn,
}
globalThis.React = reactStub
/**
 * `require` для фабрики: React отдаётся заглушкой, всё остальное — настоящим
 * резолвером. Без этого шага проверка падает на хуках настоящего React.
 * @param {string} name - имя модуля.
 * @returns {unknown} модуль.
 */
function stubRequire(name) {
  if (name === 'react') return reactStub
  return require(name)
}

const effects = []
const listeners = []
// Заглушка темы создаётся ОДИН раз: иначе каждый ctx.get('theme') отдавал бы
// новый объект, и проверка в конце читала бы пустой список слоёв.
const themeStub = {
  // getTheme нужен плагину для чтения схемы, overrideTokens — для стекла.
  // Слои запоминаем, чтобы дым проверял, что в них есть ОБЕ схемы: одна схема
  // означала бы, что при переключении темы панели останутся стеклом прежней ночи.
  // Схема берётся из DSH_VEIL_SCHEME: так обе палитры проверяются одним и тем
  // же кодом, и светлая сцена не остаётся непроверенной.
  слои: [],
  getTheme: () => ({ active: { colorScheme: process.env.DSH_VEIL_SCHEME === 'light' ? 'light' : 'dark' } }),
  overrideTokens: (source, tokens) => { themeStub.слои.push({ source, tokens }); return () => {} },
}
// Заглушка сервиса локализации. Она повторяет настоящую цепочку отката:
// активный язык -> английский -> сам ключ. Благодаря этому дым ловит главную
// поломку словарей — ключ, который есть в русском, но забыт в английском:
// в интерфейсе он всплыл бы голым именем `page.title`, и заметить это можно
// было бы только глазами.
const localeStub = {
  // Словари по локалям: namespace -> locale -> entries.
  dicts: new Map(),
  // Активный язык: DSH_VEIL_LANG=ru|en, по умолчанию английский.
  active: process.env.DSH_VEIL_LANG === 'ru' ? 'ru' : 'en',
  register(ns, dicts) {
    const target = new Map()
    for (const [locale, entries] of Object.entries(dicts)) target.set(locale, entries)
    localeStub.dicts.set(ns, target)
    return () => localeStub.dicts.delete(ns)
  },
  bind(ns) {
    return (key) => {
      const byLocale = localeStub.dicts.get(ns)
      if (!byLocale) return key
      const text = byLocale.get(localeStub.active)?.[key] ?? byLocale.get('en')?.[key]
      return typeof text === 'string' ? text : key
    }
  },
}

const ctx = {
  get(name) {
    if (name === 'theme') return themeStub
    if (name === 'locale') return localeStub
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
  timeout(fn) { return fn() },
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
const moduleExports = captured.factory(stubRequire)
if (moduleExports === undefined || typeof moduleExports.apply !== 'function') {
  console.error('модуль не отдал exports.apply')
  process.exit(1)
}
moduleExports.apply(ctx)

const layer = body.children.find((el) => el.className === 'dsh-veil-layer')
if (layer === undefined) {
  console.error('слой картины не создан: в body нет элемента dsh-veil-layer')
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

// Сцена обязана быть цельным SVG: разорванная разметка читается браузером как
// пустая картинка, и тема молча исчезает.
if (!svg.startsWith('<svg ') || !svg.endsWith('</svg>')) {
  console.error('сцена не является цельным SVG-документом')
  process.exit(1)
}
// Обещанные слои: небо, луна, мгла, пепел, вороны, тьма, свет окон.
for (const marker of ['vgSky', 'vgHalo', 'vgMoonFace', 'vgMist', 'vgWings', 'vgGloom', 'vg-rise']) {
  if (!svg.includes(marker)) {
    console.error('в сцене нет обязательного элемента: ' + marker)
    process.exit(1)
  }
}
// Крылья ворона обязаны махать вокруг плеча, а не сжиматься целиком: прежний
// баг (`scaleY` на всей фигуре) читался механической игрушкой. Проверяем, что
// анимация — это `rotate`, а не `scaleY`.
if (!svg.includes('vg-wing-r') || !svg.includes('vg-wing-l')) {
  console.error('нет анимаций взмаха крыльев')
  process.exit(1)
}
if (svg.includes('vg-flap')) {
  console.error('в сцене осталась старая анимация vg-flap: крылья сжимаются целиком, птица читается механической')
  process.exit(1)
}
// Свет в окне: ядро и ореол вокруг него. Без ореола окно читалось цветной
// наклейкой на камне.
if (!svg.includes('vgWindowGlow') || !svg.includes('vg-window')) {
  console.error('в сцене нет света окон: ни ореола, ни дыхания')
  process.exit(1)
}

// Сцена едет в data-URL и разбирается как XML. Неизвестный префикс — фатальная
// ошибка: документ не отрисуется целиком, и тема молча исчезнет, хотя `<use>`
// в разметке есть. Проверяем объявление пространства имён.
if (svg.includes('xlink:') && !svg.includes('xmlns:xlink=')) {
  console.error('в сцене есть xlink: без объявления xmlns:xlink — XML не разберётся')
  process.exit(1)
}

const uses = (svg.match(/<use /g) || []).length
console.log('сцена: ' + svg.length + ' байт, воронов ' + uses + ', эффектов ' + effects.length + ', слушателей ' + listeners.length)
// `main` регистрируется ключом, остальные слоты — id: печатаем то, что есть.
console.log(
  'слотов зарегистрировано: ' +
    registered.map((r) => r.props.id || r.props.key).join(', ')
)
console.log('сцена записана: ' + sceneOut)

if (registered.length === 0) {
  console.error('панель настроек не зарегистрирована ни в одном слоте')
  process.exit(1)
}

// Панель левой колонки: оболочка связывает иконку и страницу по совпадению id
// и ключа. Разные значения оставили бы иконку без панели — и это ровно та
// поломка, которую видно только в браузере, поэтому проверяем здесь.
const icon = registered.find((r) => r.props.name === 'sidebar.panellist')
if (icon === undefined) {
  console.error('иконка панели не зарегистрирована в sidebar.panellist')
  process.exit(1)
}
const page = registered.find((r) => r.props.name === 'main')
if (page === undefined) {
  console.error('страница панели не зарегистрирована в main')
  process.exit(1)
}
if (icon.props.id !== page.props.key) {
  console.error(
    'id иконки (' + icon.props.id + ') не совпадает с ключом страницы (' + page.props.key + '): панель не откроется'
  )
  process.exit(1)
}
// Строка в «Настройках» остаётся: переключатель темы ищут и там.
if (registered.find((r) => r.props.name === 'settings.general.item') === undefined) {
  console.error('строка темы не зарегистрирована в settings.general.item')
  process.exit(1)
}
// Иконка обязана отрисоваться: слот отдаёт size, и компонент должен вернуть
// элемент, а не упасть на отсутствующем React.createElement.
try {
  const iconEl = icon.render({ size: 16, active: false })
  if (!iconEl || iconEl.type !== 'svg') {
    console.error('иконка панели не отрисовалась в svg')
    process.exit(1)
  }
  // Якорь оболочки: по нему она связывает иконку с панелью.
  if (iconEl.props['data-dsh-panel-entry'] !== icon.props.id) {
    console.error('иконка без якоря data-dsh-panel-entry, равного id панели')
    process.exit(1)
  }
} catch (error) {
  console.error('иконка панели упала при отрисовке: ' + error.message)
  process.exit(1)
}
// Страница обязана отрисоваться целиком: слот `main` отдаёт ей всю колонку, и
// исключение здесь оставило бы пустую панель без объяснения. Заглушка React не
// рендерит дерево, поэтому элемент страницы — описание компонента: вызываем
// компонент, чтобы выполнилось его тело. Хуки вне настоящего рендера вызывать
// нельзя, поэтому на время вызова подставляем их рабочую заглушку и возвращаем
// настоящую после: иначе падение хука маскировало бы ошибку самой страницы.
const t = (key) => {
  const byLocale = localeStub.dicts.get('dsh-veil-of-ulgard')
  if (!byLocale) return key
  const text = byLocale.get(localeStub.active)?.[key] ?? byLocale.get('en')?.[key]
  return typeof text === 'string' ? text : key
}
try {
  const pageEl = page.render({})
  let tree = pageEl
  if (typeof pageEl.type === 'function') {
    const realUseState = globalThis.React.useState
    globalThis.React.useState = (initial) => [initial, () => {}]
    try {
      tree = pageEl.type({
        run: { enabled: true, density: 1, tint: 0.45, lantern: 0.7 },
        t,
        persist() {},
        requestRepaint() {},
      })
    } finally {
      globalThis.React.useState = realUseState
    }
  }
  if (!tree || tree.type !== 'div' || tree.props.className !== 'dsh-veil-page') {
    console.error('страница панели не отрисовалась в корневой div.dsh-veil-page')
    process.exit(1)
  }
} catch (error) {
  console.error('страница панели упала при отрисовке: ' + error.message)
  process.exit(1)
}
console.log('панель: иконка и страница связаны по ключу ' + page.props.key)

// ── локализация ──
// Словари обязаны быть зарегистрированы: без них панель показала бы английский
// текст при русском интерфейсе.
const nsDicts = localeStub.dicts.get('dsh-veil-of-ulgard')
if (nsDicts === undefined) {
  console.error('словари темы не зарегистрированы в сервисе локализации')
  process.exit(1)
}
// Набор ключей обязан совпадать: ключ, забытый в одном языке, всплывёт в
// интерфейсе голым именем — и заметить это можно было бы только глазами.
const enKeys = Object.keys(nsDicts.get('en') || {}).sort()
const ruKeys = Object.keys(nsDicts.get('ru') || {}).sort()
if (enKeys.length === 0) {
  console.error('английский словарь пуст')
  process.exit(1)
}
const onlyEn = enKeys.filter((k) => !ruKeys.includes(k))
const onlyRu = ruKeys.filter((k) => !enKeys.includes(k))
if (onlyEn.length > 0 || onlyRu.length > 0) {
  console.error(
    'наборы ключей не совпадают: только в en — ' + (onlyEn.join(', ') || 'нет') +
      '; только в ru — ' + (onlyRu.join(', ') || 'нет')
  )
  process.exit(1)
}
// Пустой перевод — это дыра в интерфейсе, а не «почти готово».
const пустые = []
for (const locale of ['en', 'ru']) {
  for (const [key, value] of Object.entries(nsDicts.get(locale) || {})) {
    if (typeof value !== 'string' || value.trim().length === 0) пустые.push(locale + ':' + key)
  }
}
if (пустые.length > 0) {
  console.error('пустые переводы: ' + пустые.join(', '))
  process.exit(1)
}
// Подписи слотов обязаны быть функциями: строка застыла бы на языке, который был
// активен при регистрации, и смена языка её бы не обновила. У `main` подписи нет
// вовсе — этот слот её не принимает, поэтому проверяются только те, где она есть.
for (const r of [icon, registered.find((x) => x.props.name === 'settings.general.item')]) {
  if (typeof r.props.label !== 'function') {
    console.error('подпись слота не является функцией: смена языка её не обновит (' + r.props.name + ')')
    process.exit(1)
  }
}
// Активный язык обязан реально менять текст: сравниваем перевод одной и той же
// подписи на двух языках. Совпадение означало бы, что словарь не подключён.
const sampleKey = 'field.density'
const beforeLang = localeStub.active
localeStub.active = 'en'
const sampleEn = t(sampleKey)
localeStub.active = 'ru'
const sampleRu = t(sampleKey)
localeStub.active = beforeLang
if (sampleEn === sampleKey || sampleRu === sampleKey) {
  console.error('ключ ' + sampleKey + ' не найден ни в одном словаре')
  process.exit(1)
}
if (sampleEn === sampleRu) {
  console.error('перевод ' + sampleKey + ' одинаков на двух языках: словарь не подключён')
  process.exit(1)
}
console.log(
  'локализация: ' + enKeys.length + ' ключей, наборы совпадают; ' +
    sampleKey + ' = «' + sampleEn + '» / «' + sampleRu + '»'
)

// Стекло обязано нести обе схемы: тема выбирает нужную сама, и панели
// следуют за переключением темы, а не замирают на первой заливке.
const слойСтекла = themeStub.слои.find((l) => l.source === 'dsh-veil-of-ulgard')
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

// Фонарь обязан быть живым: холст внутри слоя и слушатель движения.
const liveCanvas = (layer.children || []).find((el) => el.className === 'dsh-veil-live')
if (liveCanvas === undefined) {
  console.error('в слое нет живого холста фонаря')
  process.exit(1)
}
console.log('фонарь: холст живого слоя создан')
