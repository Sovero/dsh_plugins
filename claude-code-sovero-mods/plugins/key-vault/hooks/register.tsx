import type { Register } from 'claude-code'

import { ANSWER_DROP, ANSWER_SEND, ANSWER_STORE, fileName, findKeys, masked, replaced, storeScript } from './keys'

// «Ключ в сейф»: если в сообщении человека есть ключ доступа, мод спрашивает,
// что с ним делать, ДО того как сообщение уйдёт модели и ляжет в переписку.
// «Убрать в хранилище» шифрует ключ для этой учётной записи Windows (DPAPI) и
// кладёт в ~/.claude/key-vault; в сообщении остаётся указание, где он лежит.
// В интернет мод ничего не отправляет.

/** От кого сообщения проверяются: только от человека, не от модов и уведомлений. */
const FROM_PERSON: readonly string[] = ['composer', 'bridge', 'sdk']

async function store($: any, key: string, file: string): Promise<string | null> {
  try {
    const ran = await $.process.run(
      ['powershell', '-NoProfile', '-NonInteractive', '-Command', storeScript(file)],
      { stdin: key, timeoutMs: 20_000 },
    )
    const place = String(ran.stdout ?? '').trim()

    return ran.exitCode === 0 && place !== '' ? place : null
  } catch {
    return null
  }
}

export const register: Register = on => {
  on('prompt.submit', async ($, e, next) => {
    const keys = FROM_PERSON.includes(e.origin.kind) ? findKeys(e.text) : []

    if (keys.length === 0) {
      return next(e)
    }

    const shown = keys.map(masked).join(', ')
    let answer: string

    try {
      answer = await $.ui.ask(
        keys.length === 1
          ? `В сообщении похоже на ключ доступа (${shown}). Что с ним сделать?`
          : `В сообщении похоже на ключи доступа (${shown}). Что с ними сделать?`,
        { header: 'Ключ', options: [ANSWER_STORE, ANSWER_SEND, ANSWER_DROP] },
      )
    } catch {
      // Вопрос закрыли, не ответив: ключ никуда не уходит.
      return { drop: 'Сообщение с ключом не отправлено: вопрос закрыт без ответа.' }
    }

    if (answer === ANSWER_SEND) {
      return next(e)
    }

    if (answer !== ANSWER_STORE) {
      return { drop: 'Сообщение с ключом не отправлено.' }
    }

    const at: number = await $.clock.now()
    const places = new Map<string, string>()

    for (const [index, key] of keys.entries()) {
      const place = await store($, key, fileName(at, index))

      if (place === null) {
        return { drop: 'Ключ не удалось убрать в хранилище (нужен Windows с PowerShell). Сообщение не отправлено.' }
      }

      places.set(key, place)
    }

    $.ui.toast(`Ключ убран в хранилище: ${[...places.values()].join(', ')}`, { timeoutMs: 8000 })

    return next({ ...e, text: replaced(e.text, places) })
  }).catch(($, e, next) => next(e))
}
