import { expect, test } from 'claude-code/testing'

import { fileName, findKeys, masked, replaced, storeScript } from './keys'

// Ключи в тестах собраны из частей: в файле нет ни одной строки, похожей на настоящий ключ.
const SAMPLE = `sk-${'Ab3x'.repeat(8)}`
const TOKEN = `ghp_${'Zz9q'.repeat(9)}`

test('ключ находится в сообщении вместе с остальным текстом', () => {
  expect(findKeys(`${SAMPLE} agnes https://example.test/v1 some-model`)).toEqual([SAMPLE])
  expect(findKeys(`сначала ${TOKEN}, потом ${SAMPLE}, и снова ${TOKEN}`)).toEqual([TOKEN, SAMPLE])
})

test('обычный текст ключом не считается', () => {
  for (const text of [
    'продолжи проект',
    'далее',
    'задача sk-12 закрыта',
    'коммит 6f06faf9a3c1d2e4b5a6978877665544332211ff',
    'https://github.com/owner/repo/pull/123',
    '/autopilot full deep',
  ]) {
    expect(findKeys(text)).toEqual([])
  }
})

test('человеку ключ показывается скрытым', () => {
  expect(masked(SAMPLE)).toBe('sk-Ab…b3x')
  expect(masked(SAMPLE).includes(SAMPLE.slice(6, 20))).toBe(false)
  expect(masked('short')).toBe('…')
})

test('в сообщении вместо ключа остаётся указание, где он лежит', () => {
  const text = replaced(`ключ ${SAMPLE} и ещё раз ${SAMPLE}`, new Map([[SAMPLE, 'C:/vault/key-1.dpapi']]))

  expect(text.includes(SAMPLE)).toBe(false)
  expect(text).toBe('ключ [ключ убран в хранилище: C:/vault/key-1.dpapi] и ещё раз [ключ убран в хранилище: C:/vault/key-1.dpapi]')
})

test('ключ не попадает в командную строку, а имя файла — только своё', () => {
  const file = fileName(Date.UTC(2026, 9, 9, 6, 52, 7), 0)

  expect(file).toBe('key-20261009-065207-1.dpapi')
  expect(storeScript(file).includes(file)).toBe(true)
  expect(storeScript(file).includes('[Console]::In.ReadToEnd()')).toBe(true)
  expect(() => storeScript("x'; Remove-Item C:\\ -Recurse; '")).toThrow()
})

test('сообщение без ключа проходит через мод без вопросов и изменений', async ($, on) => {
  const seen: string[] = []

  on('prompt.submit', (_$, e) => {
    seen.push(e.text)

    return { text: e.text }
  })

  const entered = await $.prompt.submit({ text: 'продолжи проект' })

  expect(seen).toEqual(['продолжи проект'])
  expect(entered.text).toBe('продолжи проект')
})
