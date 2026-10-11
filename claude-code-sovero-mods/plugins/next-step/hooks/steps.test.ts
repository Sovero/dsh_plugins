import { expect, test } from 'claude-code/testing'

import { STEPS, isShown, stepOf } from './steps'

test('у каждой кнопки свой ключ, короткая подпись и полная просьба', () => {
  const keys = STEPS.map(step => step.key)

  expect(new Set(keys).size).toBe(STEPS.length)
  expect(STEPS[0]?.label).toBe('Далее')

  for (const step of STEPS) {
    expect(step.label.length).toBeLessThan(14)
    expect(step.text.length).toBeGreaterThan(step.label.length)
    expect(stepOf(step.key)).toEqual(step)
  }

  expect(stepOf('нет такой')).toBe(undefined)
})

test('полоса видна только когда ход закончен и её не скрыли', () => {
  expect(isShown(true, false, false)).toBe(true)
  expect(isShown(false, false, false)).toBe(false)
  expect(isShown(true, true, false)).toBe(false)
  expect(isShown(true, false, true)).toBe(false)
})

test('чужой запрос проходит через мод без изменений', async ($, on) => {
  const seen: string[] = []

  on('prompt.submit', (_$, e) => {
    seen.push(e.text)

    return { text: e.text }
  })

  const entered = await $.prompt.submit({ text: 'что дальше?' })

  expect(seen).toEqual(['что дальше?'])
  expect(entered.text).toBe('что дальше?')
})
