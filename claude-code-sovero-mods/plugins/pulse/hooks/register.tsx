import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { PulseCall, PulseTurn } from '../types'
import { KEPT, LONG_MS, label, line, span } from './pulse'
import type { Running } from './pulse'

// «Пульс»: чем Claude занят прямо сейчас и сколько это уже длится. Ничего не
// меняет в работе: только смотрит на шаги и показывает их.

const PANE = 'pulse'
const calls = atom({ plugin: 'pulse', key: 'calls' } as const, [])
const turn = atom({ plugin: 'pulse', key: 'turn' } as const, null)

const running = new Map<string, Running>()
let turnStartedAt = 0
let steps = 0
let timer: { cancel: () => void } | null = null

async function paint($: any): Promise<void> {
  $.ui.status(line([...running.values()], turnStartedAt, await $.clock.now()))
}

function tick($: any, isOn: boolean): void {
  if (isOn && timer === null) {
    timer = $.clock.every(1000, () => void paint($))
  }

  if (!isOn && timer !== null) {
    timer.cancel()
    timer = null
  }
}

async function finish($: any, call: PulseCall): Promise<void> {
  running.delete(call.id)
  await update($, calls, list => [...list, call].slice(-KEPT))

  if (call.ms >= LONG_MS) {
    $.ui.toast(`${call.isError ? "С ошибкой" : "Готово"} за ${span(call.ms)}: ${call.label}`, { timeoutMs: 8000 })
  }

  void paint($)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'pulse',
      description: 'Пульс: последние шаги Claude и сколько занял каждый',
    })

    return next(e)
  })

  on('command.run', { command: 'pulse' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Пульс' })

    return { text: 'Панель «Пульс» открыта.' }
  })

  on('prompt.submit', async ($, e, next) => {
    turnStartedAt = await $.clock.now()
    steps = 0
    tick($, true)
    void paint($)

    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    const startedAt: number = await $.clock.now()
    const id = String(e.tool_use_id)
    const text = label(String(e.tool), e as unknown as Record<string, unknown>)

    running.set(id, { label: text, startedAt })
    steps += 1
    tick($, true)
    void paint($)

    try {
      const ran = await next(e)
      const isError = ran.deny !== undefined || ran.isError === true
      await finish($, { id, tool: String(e.tool), label: text, ms: (await $.clock.now()) - startedAt, isError })

      return ran
    } catch (error) {
      await finish($, { id, tool: String(e.tool), label: text, ms: (await $.clock.now()) - startedAt, isError: true })
      throw error
    }
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const done: PulseTurn = { ms: turnStartedAt > 0 ? (await $.clock.now()) - turnStartedAt : 0, steps }

    turnStartedAt = 0
    running.clear()
    tick($, false)
    await update($, turn, () => done)
    $.ui.status(done.ms > 0 ? `✓ ход занял ${span(done.ms)} · шагов ${done.steps}` : undefined)

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const list = await read($, calls)
    const last = await read($, turn)
    const room = Math.max(1, (e.viewport?.rows ?? 24) - 5)

    return (
      <Box flexDirection="column">
        {last !== null && (
          <Text>
            Прошлый ход: {span(last.ms)}, шагов {last.steps}
          </Text>
        )}
        {list.length === 0 && <Text dimColor>Шагов пока не было.</Text>}
        {list.slice(-room).map(call => (
          <Text color={call.isError ? 'red' : undefined} dimColor={!call.isError}>
            {call.isError ? '✗' : '✓'} {span(call.ms)} {call.label}
          </Text>
        ))}
      </Box>
    )
  })
}
