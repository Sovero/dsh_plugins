// Проверки разговорного режима и подготовки текста к озвучке.
//
// Здесь важна не строка, а порядок: что сначала приносит фраза, что с ней
// происходит и что человек успевает увидеть между «я сказал» и «ты ответил».

import test from 'node:test'
import assert from 'node:assert/strict'
import { speakable, chunks } from '../src/speakText.js'
import { Talk } from '../src/client/talk.js'

test('из текста убирается разметка, а слова остаются', () => {
  assert.equal(
    speakable('Смотри `код` и **важно**, блок:\n```js\nlet x = 1\n```\nВсё.'),
    'Смотри код и важно, блок: Всё.',
  )
})

test('ссылка произносится текстом, а не адресом', () => {
  assert.equal(
    speakable('Смотри [документ](https://example.com/a/b?c=1) сейчас'),
    'Смотри документ сейчас',
  )
})

test('служебные метки инструментов не попадают в голос', () => {
  assert.equal(speakable('Готово. <tool:call name="pwsh"> вывод </tool:call> Дальше.').includes('tool:call'), false)
})

test('таблицы и разделители не читаются вслух', () => {
  assert.equal(speakable('Итог:\n| колонка | значение |\n| --- | --- |\n| а | б |\n---').includes('колонка'), false)
})

test('заголовок читается без решёток', () => {
  assert.equal(speakable('## Итог\nГотово'), 'Итог Готово')
})

test('пустой и нестроковый текст дают пустоту, а не «undefined»', () => {
  assert.equal(speakable(''), '')
  assert.equal(speakable(null), '')
  assert.equal(speakable(undefined), '')
})

test('длинный ответ делится по концам фраз', () => {
  const long = `${'Это предложение про работу. '.repeat(40)}Конец.`
  const parts = chunks(long, 200)
  assert.ok(parts.length > 1, 'длинный ответ должен делиться')
  assert.equal(parts.join(' ').replace(/\s+/g, ' '), long.replace(/\s+/g, ' '), 'ни одно слово не теряется')
  for (const part of parts) assert.ok(part.length <= 200, 'часть не должна быть длиннее лимита')
})

test('короткий ответ остаётся одной частью', () => {
  assert.deepEqual(chunks('Привет.'), ['Привет.'])
})

/**
 * Подмена сетевых вызовов разговора.
 *
 * Разговор ходит на хост по маршрутам, а тестам нужен полный контроль над тем,
 * что хост «сказал». Поэтому глобальный `fetch` заменяется: проверяется логика
 * нарезки и отправки, а не работа сети.
 *
 * @param {object} script - что отвечает хост: полосы, фразы, распознавание.
 * @returns {object} состояние замены.
 */
function stubFetch(script) {
  const calls = { start: 0, phrase: 0, cancel: 0 }
  globalThis.fetch = async (url) => {
    const path = String(url)
    if (path.endsWith('/record/start')) {
      calls.start += 1
      return json({ ok: true, value: { device: 'test', bands: 24 } })
    }
    if (path.endsWith('/record/phrase')) {
      calls.phrase += 1
      const next = script.phrases.shift()
      return json(next === undefined
        ? { ok: true, value: null }
        : { ok: true, value: { audioBase64: next, durationMs: 1000 } })
    }
    if (path.endsWith('/record/cancel')) {
      calls.cancel += 1
      return json({ ok: true })
    }
    if (path.endsWith('/record/status')) {
      return json({
        ok: true,
        value: {
          recording: true,
          level: 0.3,
          seconds: 1,
          speaking: script.speaking === true,
          pending: script.pending ?? 0,
          dropped: 0,
          bands: script.bands ?? [0.1, 0.5, 0.9],
        },
      })
    }
    if (path.endsWith('/speak')) return json({ ok: true })
    if (path.endsWith('/stop-speaking')) return json({ ok: true })
    return json({ ok: false })
  }
  return calls
}

/**
 * Ответ маршрута.
 *
 * @param {object} body - тело.
 * @returns {object} ответ `fetch`.
 */
function json(body) {
  return { ok: true, json: async () => body, status: 200 }
}

test('разговор берёт фразу, распознаёт и отправляет её в беседу', async () => {
  const sent = []
  const recognized = []
  stubFetch({ phrases: ['BASE64'], pending: 1, speaking: true })
  const talk = new Talk({
    settings: { conversation: {}, speech: {} },
    onSend: (text) => sent.push(text),
    recognize: async (audio) => {
      recognized.push(audio)
      return '  привет, это фраза  '
    },
  })

  await talk.start()
  await talk.poll()
  // poll() ставит отправку в очередь; ждём её выполнения.
  await new Promise((resolve) => setTimeout(resolve, 20))
  await talk.poll()
  await new Promise((resolve) => setTimeout(resolve, 20))

  assert.deepEqual(recognized, ['BASE64'], 'на распознавание ушла ровно одна фраза')
  assert.deepEqual(sent, ['привет, это фраза'], 'в беседу ушёл очищенный текст')
  talk.dispose()
})

test('пустая фраза в беседу не уходит', async () => {
  const sent = []
  stubFetch({ phrases: ['BASE64'], pending: 1 })
  const talk = new Talk({
    onSend: (text) => sent.push(text),
    recognize: async () => '   ',
  })
  await talk.start()
  await talk.poll()
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.deepEqual(sent, [], 'выдох без слов — не сообщение')
  talk.dispose()
})

test('гистограмма приходит полосами, а не одним числом', async () => {
  const seen = []
  stubFetch({ phrases: [], bands: [0.2, 0.4, 0.8] })
  const talk = new Talk({ onBands: (bands) => seen.push(bands) })
  await talk.start()
  await talk.poll()
  assert.deepEqual(seen[0], [0.2, 0.4, 0.8], 'гистограмма — это полосы')
  assert.equal(typeof seen[0], 'object')
  talk.dispose()
})

test('перебивание останавливает голос', async () => {
  const stops = []
  stubFetch({ phrases: [] })
  const original = globalThis.fetch
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('/stop-speaking')) {
      stops.push(url)
      return json({ ok: true })
    }
    return original(url)
  }
  const talk = new Talk({ settings: { speech: {} } })
  talk.talking = true
  await talk.hush()
  assert.equal(stops.length, 1, 'голос должен быть остановлен один раз')
  assert.equal(talk.talking, false)
  talk.dispose()
})

test('озвучка пропускается, когда она выключена в настройках', async () => {
  stubFetch({ phrases: [] })
  const talk = new Talk({ settings: { speech: { enabled: false } } })
  const said = await talk.say('Ответ агента')
  assert.equal(said, false, 'при выключенной озвучке голос не будится')
  talk.dispose()
})