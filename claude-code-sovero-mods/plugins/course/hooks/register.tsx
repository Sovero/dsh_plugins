import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { add, band, remove, sanitize, section, storeKey } from './course'

// «Курс»: приоритеты и правила проекта, которые задаёт владелец. Они на виду над
// полем ввода и читаются моделью в начале каждой сессии — чтобы не напоминать.
// Хранятся на этом компьютере, отдельно для каждой папки проекта.

const PANE = 'course'
const lines = atom({ plugin: 'course', key: 'lines' } as const, [])

async function load($: any): Promise<void> {
  const saved = sanitize(await $.store.get(storeKey(await $.session.cwd())))

  await update($, lines, () => saved)
}

async function save($: any, next: string[]): Promise<void> {
  await $.store.set(storeKey(await $.session.cwd()), next)
  await update($, lines, () => next)
}

async function addLine($: any, line: string): Promise<boolean> {
  const before = await read($, lines)
  const next = add(before, line)

  if (next.length === before.length) {
    return false
  }

  await save($, next)

  return true
}

async function removeLine($: any, index: number): Promise<void> {
  await save($, remove(await read($, lines), index))
}

async function openPane($: any): Promise<void> {
  await $.ui.open({ id: PANE, title: 'Курс проекта' })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'course',
      description: 'Курс проекта: /course — открыть список, /course <строка> — добавить приоритет или правило',
      argumentHint: '[новая строка]',
    })
    await load($)

    return next(e)
  })

  on('command.run', { command: 'course' }, async ($, e) => {
    const line = e.args.trim()

    if (line === '') {
      await openPane($)

      return { text: 'Список курса открыт.' }
    }

    return {
      text: (await addLine($, line))
        ? `В курс добавлено: ${line}`
        : 'Не добавлено: такая строка уже есть, она пустая или список полон.',
    }
  })

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    const list = await read($, lines)

    if (list.length === 0) {
      return composed
    }

    return {
      sections: [...composed.sections, { id: 'course:lines', text: section(list), scope: 'session' as const }],
    }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    const list = await read($, lines)

    if (list.length === 0 || e.props.hasSurvey) {
      return below
    }

    const { Box, Button, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        <Box gap={1}>
          <Box flexShrink={1}>
            <Text dimColor wrap="truncate-end">
              {band(list, e.props.bodyColumns ?? 100)}
            </Text>
          </Box>
          <Button key="edit" label="Править" plain onPress={() => openPane($)} />
        </Box>
        {below}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const list = await read($, lines)
    const table = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        <Text dimColor>Приоритеты и правила этого проекта. Claude читает их в начале каждой сессии.</Text>
        {list.length === 0 && <Text>Пока пусто. Добавьте первую строку ниже или командой /course текст.</Text>}
        {list.map((line, index) => (
          <Box gap={1}>
            <Button key={`remove-${index}`} label="убрать" plain onPress={() => removeLine($, index)} />
            <Box flexShrink={1}>
              <Text>
                {index + 1}. {line}
              </Text>
            </Box>
          </Box>
        ))}
        {'Input' in table && (
          <table.Input
            key="new"
            label="Новая строка"
            placeholder="например: клавиши и Steam — в самом конце"
            submitLabel="Добавить"
            onSubmit={(value: string) => addLine($, value)}
          />
        )}
      </Box>
    )
  })
}
