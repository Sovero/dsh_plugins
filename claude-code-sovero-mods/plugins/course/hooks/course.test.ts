import { expect, test } from 'claude-code/testing'

import { MAX_LENGTH, MAX_LINES, add, band, clean, remove, sanitize, section, storeKey } from './course'

test('строка курса чистится и ограничена длиной', () => {
  expect(clean('  клавиши \n —  в   конце  ')).toBe('клавиши — в конце')
  expect(clean('я'.repeat(500)).length).toBe(MAX_LENGTH)
  expect(clean('   ')).toBe('')
})

test('в курс не попадают пустые, повторные и лишние строки', () => {
  expect(add([], 'сначала мир и герои')).toEqual(['сначала мир и герои'])
  expect(add(['сначала мир и герои'], '  сначала мир и   герои ')).toEqual(['сначала мир и герои'])
  expect(add(['a'], '   ')).toEqual(['a'])

  let lines: string[] = []

  for (let index = 0; index < MAX_LINES + 5; index += 1) {
    lines = add(lines, `правило ${index}`)
  }

  expect(lines).toHaveLength(MAX_LINES)
})

test('строка убирается по номеру, чужой номер ничего не трогает', () => {
  expect(remove(['a', 'b', 'c'], 1)).toEqual(['a', 'c'])
  expect(remove(['a', 'b'], 7)).toEqual(['a', 'b'])
  expect(remove([], 0)).toEqual([])
})

test('мусор из хранилища не ломает курс', () => {
  expect(sanitize(null)).toEqual([])
  expect(sanitize('строка')).toEqual([])
  expect(sanitize(['a', 5, '', '  a ', { x: 1 }, 'b'])).toEqual(['a', 'b'])
})

test('у каждой папки проекта свой курс, а запись пути не важна', () => {
  expect(storeKey('D:\\Projects\\Home\\gsteam\\')).toBe(storeKey('d:/projects/home/gsteam'))
  expect(storeKey('D:/Projects/one')).not.toBe(storeKey('D:/Projects/two'))
})

test('модель читает курс списком, человек — одной строкой', () => {
  const lines = ['сейчас: мир, герои, окружение', 'клавиши и Steam — в самом конце', 'прыжок не выше роста героя']
  const text = section(lines)

  for (const line of lines) {
    expect(text.includes(`- ${line}`)).toBe(true)
  }

  expect(band([], 100)).toBe('')
  expect(band(lines, 100)).toBe('Курс: сейчас: мир, герои, окружение · ещё 2')
  expect(band(['одна строка'], 100)).toBe('Курс: одна строка')
  expect(band(['очень длинная строка курса, которая не помещается в узкую полосу над вводом'], 40).length).toBeLessThan(40)
})
