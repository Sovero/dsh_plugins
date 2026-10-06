/**
 * Client-half contract test for dsh-restart-buttons.
 *
 * Dependency-free: React and react-dom/server are resolved from an installed
 * copy on this machine rather than from a local node_modules, so the test needs
 * no npm install.
 *
 * What it proves:
 *   - the bundle has the exact window.__ModuleLoader__.load shape;
 *   - its id and inject list are correct;
 *   - apply() registers exactly one sidebar.footer.action entry with the right
 *     id, order and a thunk label;
 *   - the duplicate-mount guard blocks a second apply();
 *   - a throwing slot registration does NOT propagate out of apply();
 *   - the component renders exactly two buttons with the expected labels.
 *
 * Every assertion prints PASS/FAIL; any failure exits non-zero.
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const bundlePath = join(here, '..', 'lib', 'client.js')

/**
 * Candidate node_modules directories that carry React on this machine. The
 * first one that resolves both modules wins, so the test works regardless of
 * which profile is active.
 */
const REACT_BASES = [
  'C:/Users/Sovero/.dsh/profiles/node_modules/dsh-plugin-desktop/node_modules/',
  'C:/Program Files/DSH Desktop/resources/app.asar.unpacked/node_modules/',
  'C:/Users/Sovero/.dsh/profiles/desktop/node_modules/',
]

let fails = 0

/** Print one assertion result and track failures. */
function check(ok, message) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${message}`)
  if (!ok) fails += 1
  return ok
}

/** Resolve react and react-dom/server from the first working base. */
function loadReact() {
  const errors = []
  for (const base of REACT_BASES) {
    try {
      const require = createRequire(base)
      const React = require('react')
      const { renderToStaticMarkup } = require('react-dom/server')
      if (typeof React.createElement !== 'function' || typeof renderToStaticMarkup !== 'function') {
        errors.push(`${base}: resolved but incomplete`)
        continue
      }
      console.log(`INFO  react ${React.version} resolved from ${base}`)
      return { React, renderToStaticMarkup }
    } catch (error) {
      errors.push(`${base}: ${String(error?.code ?? error)}`)
    }
  }
  throw new Error(`react could not be resolved from any known base:\n  ${errors.join('\n  ')}`)
}

const { React, renderToStaticMarkup } = loadReact()

console.log('\n=== 1. BUNDLE SHAPE ===')
const source = readFileSync(bundlePath, 'utf8')
let captured
// The bundle is plain CJS text that only references `window`, so evaluating it
// with an explicit `window` parameter captures the loader call.
new Function('window', source)({ __ModuleLoader__: { load(spec) { captured = spec } } })
check(captured !== undefined, 'window.__ModuleLoader__.load() was called')
check(captured?.id === 'dsh-restart-buttons', `spec.id === 'dsh-restart-buttons' (got ${String(captured?.id)})`)
check(typeof captured?.factory === 'function', 'spec.factory is a function')

console.log('\n=== 2. FACTORY AND EXPORTS ===')
const fakeRequire = (id) => {
  if (id === 'react') return React
  throw new Error(`unexpected require('${id}')`)
}
const mod = captured.factory(fakeRequire)
check(typeof mod.apply === 'function', 'mod.apply is a function')
check(Array.isArray(mod.inject), 'mod.inject is an array')
check(mod.inject.includes('slots'), `mod.inject contains 'slots' (got ${JSON.stringify(mod.inject)})`)

console.log('\n=== 3. APPLY AGAINST A FAKE CLIENT CONTEXT ===')
const effects = []
const injected = []
const registrations = []
const registeredLocales = []

function makeCtx(overrides = {}) {
  const ctx = {
    effect: (fn) => {
      const dispose = fn()
      effects.push(dispose)
      return dispose
    },
    locale: {
      register: (ns, dicts) => {
        registeredLocales.push([ns, dicts])
        return () => {}
      },
      bind: (ns) => (key) => {
        const entry = registeredLocales.find(([name]) => name === ns)
        return entry?.[1]?.en?.[key] ?? key
      },
    },
    slots: {
      inject: (name, cb) => {
        injected.push(name)
        return cb()
      },
      register: (options, component) => {
        registrations.push({ options, component })
        return () => {}
      },
    },
  }
  return { ...ctx, ...overrides }
}

mod.apply(makeCtx())
check(injected.includes('sidebar.footer.action'), `injected contains 'sidebar.footer.action' (got ${JSON.stringify(injected)})`)
check(registrations.length === 1, `exactly one registration recorded (got ${registrations.length})`)
const reg = registrations[0]
check(reg?.options?.name === 'sidebar.footer.action', `options.name === 'sidebar.footer.action' (got ${String(reg?.options?.name)})`)
check(reg?.options?.id === 'dsh-restart-buttons', `options.id === 'dsh-restart-buttons' (got ${String(reg?.options?.id)})`)
check(typeof reg?.options?.order === 'number', `options.order is a number (got ${typeof reg?.options?.order} = ${String(reg?.options?.order)})`)
check(reg?.options?.order === 100, `options.order === 100 (got ${String(reg?.options?.order)})`)
check(typeof reg?.options?.label === 'function', 'options.label is a thunk')
const labelValue = typeof reg?.options?.label === 'function' ? reg.options.label() : undefined
check(typeof labelValue === 'string' && labelValue !== '', `label() returns a non-empty string (got ${JSON.stringify(labelValue)})`)

console.log('\n=== 4. LOCALE DICTIONARIES ===')
check(registeredLocales.length >= 1, `locale namespace registered (${registeredLocales.length} call(s))`)
const localeEntry = registeredLocales[0]
check(localeEntry?.[0] === 'restart-buttons', `namespace is 'restart-buttons' (got ${String(localeEntry?.[0])})`)
const dicts = localeEntry?.[1] ?? {}
const enKeys = Object.keys(dicts.en ?? {}).sort()
const zhKeys = Object.keys(dicts.zh ?? {}).sort()
check(enKeys.length > 0 && zhKeys.length > 0, `both dictionaries present (en ${enKeys.length}, zh ${zhKeys.length})`)
check(JSON.stringify(enKeys) === JSON.stringify(zhKeys), 'en and zh key sets are identical')

console.log('\n=== 5. DUPLICATE-MOUNT GUARD ===')
const before = registrations.length
mod.apply(makeCtx())
check(registrations.length === before, `second apply() recorded no registration (before ${before}, after ${registrations.length})`)

console.log('\n=== 6. NON-THROWING FAILURE PATH ===')
let threw = false
try {
  // A fresh factory instance: the guard above already claimed the module-level
  // flag, so use a newly evaluated bundle to exercise apply() again.
  let captured2
  new Function('window', source)({ __ModuleLoader__: { load(spec) { captured2 = spec } } })
  const mod2 = captured2.factory(fakeRequire)
  mod2.apply(makeCtx({
    slots: {
      inject: (name, cb) => {
        injected.push(name)
        return cb()
      },
      register: () => {
        throw new Error('simulated slot registration failure')
      },
    },
  }))
} catch (error) {
  threw = true
  console.log(`      unexpected throw: ${String(error)}`)
}
check(!threw, 'a throwing slot registration does not propagate out of apply()')

console.log('\n=== 7. RENDER WITH react-dom/server ===')
const Component = reg.component
const wideHtml = renderToStaticMarkup(React.createElement(Component, { wide: true }))
const narrowHtml = renderToStaticMarkup(React.createElement(Component, { wide: false }))

const buttonCount = (html) => (html.match(/<button/g) ?? []).length
check(wideHtml.includes('data-dsh-plugin="restart-buttons"'), 'wide markup carries data-dsh-plugin="restart-buttons"')
check(buttonCount(wideHtml) === 2, `wide markup has exactly two buttons (got ${buttonCount(wideHtml)})`)
check(wideHtml.includes('data-dsh-restart-action="reload"'), 'wide markup carries the reload action marker')
check(wideHtml.includes('data-dsh-restart-action="restart"'), 'wide markup carries the restart action marker')
check(wideHtml.includes('Reload DSH'), 'wide markup shows the English label "Reload DSH"')
check(wideHtml.includes('Restart app'), 'wide markup shows the English label "Restart app"')
check(wideHtml.includes('<svg'), 'wide markup contains an inline SVG glyph')

check(narrowHtml.includes('data-dsh-plugin="restart-buttons"'), 'narrow markup carries the plugin marker')
check(buttonCount(narrowHtml) === 2, `narrow markup still has exactly two buttons (got ${buttonCount(narrowHtml)})`)
check((narrowHtml.match(/<svg/g) ?? []).length === 2, 'narrow markup keeps both glyphs')
check(!narrowHtml.includes('>Reload DSH<'), 'narrow markup drops the wide text label')
check(narrowHtml.includes('aria-label="Reload the DSH interface and reconnect"'), 'narrow reload button keeps its aria-label')

console.log('\n=== 8. RENDERED HTML EVIDENCE (first 800 chars, wide) ===')
console.log(wideHtml.slice(0, 800))

console.log(`\n${fails === 0 ? 'ALL ASSERTIONS PASSED' : `${fails} ASSERTION(S) FAILED`}`)
process.exit(fails === 0 ? 0 : 1)
