import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { STEPS, isShown, stepOf } from './steps'

// «Далее»: когда ход закончен, над полем ввода стоят кнопки следующего шага.
// Нажатие отправляет готовую просьбу от имени человека — вместо набора «продолжай».

const isIdle = atom({ plugin: 'next-step', key: 'isIdle' } as const, false)
const isHidden = atom({ plugin: 'next-step', key: 'isHidden' } as const, false)

async function send($: any, key: string): Promise<void> {
  const step = stepOf(key)

  if (step === undefined) {
    return
  }

  await update($, isIdle, () => false)
  void $.prompt.submit({ text: step.text, asUser: true })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'next-step',
      description: 'Далее: показать или скрыть кнопки следующего шага над полем ввода',
    })

    return next(e)
  })

  on('command.run', { command: 'next-step' }, async $ => {
    const hidden = await read($, isHidden)
    await update($, isHidden, () => !hidden)

    return { text: hidden ? 'Кнопки «Далее» включены.' : 'Кнопки «Далее» скрыты до следующего ответа.' }
  })

  on('prompt.submit', async ($, e, next) => {
    await update($, isIdle, () => false)

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    await update($, isIdle, () => true)
    await update($, isHidden, () => false)

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)

    if (!isShown(await read($, isIdle), await read($, isHidden), Boolean(e.props.hasSurvey))) {
      return below
    }

    const { Box, Button } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        <Box gap={1}>
          {STEPS.map((step, index) => (
            <Button
              key={step.key}
              label={step.label}
              variant={index === 0 ? 'primary' : undefined}
              onPress={() => send($, step.key)}
            />
          ))}
          <Button key="hide" label="Скрыть" plain onPress={() => update($, isHidden, () => true)} />
        </Box>
        {below}
      </Box>
    )
  })
}
