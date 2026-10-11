import { expect, mock, test } from 'claude-code/testing'

import { label, line, span } from './pulse'

test('время шага читается как минуты и секунды', () => {
  expect(span(0)).toBe('0:00')
  expect(span(7_400)).toBe('0:07')
  expect(span(252_000)).toBe('4:12')
  expect(span(3_847_000)).toBe('1:04:07')
  expect(span(-5)).toBe('0:00')
})

test('подпись шага: описание команды, имя файла или название инструмента', () => {
  expect(label('Bash', { command: 'npm   test\n--watch', description: 'Run the tests' })).toBe('Bash · Run the tests')
  expect(label('Bash', { command: 'git status' })).toBe('Bash · git status')
  expect(label('Read', { file_path: 'D:\\Projects\\game\\hooks\\register.tsx' })).toBe('Read · register.tsx')
  expect(label('TaskStop', {})).toBe('TaskStop')
  expect(label('Bash', { command: 'x'.repeat(200) }).length).toBeLessThan(70)
})

test('строка состояния показывает самый давний шаг, а между шагами — ход', () => {
  expect(line([], 0, 10_000)).toBe(undefined)
  expect(line([], 4_000, 10_000)).toBe('… думаю · ход 0:06')
  expect(line([{ label: 'Bash · гейт', startedAt: 1_000 }], 500, 253_000)).toBe('⏵ Bash · гейт · 4:12')
  expect(
    line(
      [
        { label: 'Read · b.ts', startedAt: 9_000 },
        { label: 'Bash · гейт', startedAt: 1_000 },
      ],
      500,
      11_000,
    ),
  ).toBe('⏵ Bash · гейт · 0:10 · ещё 1')
})

test('мод только смотрит: шаг доходит до движка и возвращается без изменений', async ($, on) => {
  const clock = mock.clock(on)
  const seen: string[] = []

  on('tool.call', async (_$, e) => {
    seen.push(String((e as { command?: string }).command))
    await clock.advance(90_000)

    return { result: { stdout: 'done', stderr: '' }, text: 'done' } as never
  })

  const ran = await $.tool.call({ tool: 'Bash', command: 'npm test', description: 'Run the tests' } as never)

  expect(seen).toEqual(['npm test'])
  expect((ran as { text?: string }).text).toBe('done')
})
