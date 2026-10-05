// Проверки детектора речи.
//
// Детектор решает, где кончилась фраза, и ошибка здесь стоит дорого: слишком
// чувствительный порог разрежет фразу надвое и отправит половину слова, а
// слишком строгий не признает конец никогда и разговор не начнётся. Поэтому
// уровни подаются числами, а не микрофоном: так видно каждое решение.

import test from 'node:test'
import assert from 'node:assert/strict'
import { VoiceActivityDetector, DEFAULT_SILENCE_MS } from '../src/vad.js'

/**
 * Прогоняет детектор по последовательности уровней.
 *
 * @param {number[]} levels - уровни, каждый — отсчёт в 50 мс.
 * @param {object} [options] - настройки детектора.
 * @returns {{phrases: Array<object>, detector: object}} что получилось.
 */
function run(levels, options = {}) {
  const detector = new VoiceActivityDetector(options)
  const phrases = []
  let at = 0
  for (const level of levels) {
    at += 50
    const chunk = level > 0.01 ? Buffer.alloc(3200, 7) : Buffer.alloc(3200, 0)
    const phrase = detector.push({ level, at, chunk })
    if (phrase !== null) phrases.push(phrase)
  }
  return { phrases, detector }
}

/**
 * Строит последовательность уровней: речь, тишина, речь.
 *
 * @param {number} speechMs - сколько длится речь.
 * @param {number} silenceMs - сколько длится тишина.
 * @returns {number[]} уровни.
 */
function speech(speechMs, silenceMs) {
  const speechTicks = Math.round(speechMs / 50)
  const silenceTicks = Math.round(silenceMs / 50)
  return [
    ...new Array(speechTicks).fill(0.2),
    ...new Array(silenceTicks).fill(0.001),
  ]
}

test('речь признаётся после устойчивого звука, а не по щелчку', () => {
  // Два отсчёта — 100 мс, меньше onsetMs.
  const { detector } = run([0.2, 0.2, 0.001, 0.001, 0.001, 0.001])
  assert.equal(detector.speaking, false, 'короткий звук не считается речью')
})

test('фраза закрывается паузой и отдаётся целиком', () => {
  const { phrases } = run(speech(600, DEFAULT_SILENCE_MS + 200))
  assert.equal(phrases.length, 1, 'фраза должна завершиться один раз')
  assert.equal(phrases[0].ended, true)
  assert.ok(phrases[0].durationMs >= 600, 'длительность фразы не короче самой речи')
  assert.ok(phrases[0].chunk.length > 0, 'фраза не должна быть пустой')
})

test('тишина в начале записи не попадает в фразу', () => {
  const lead = new Array(20).fill(0.001)
  const withoutLead = run(speech(600, DEFAULT_SILENCE_MS + 200))
  const withLead = run([...lead, ...speech(600, DEFAULT_SILENCE_MS + 200)])
  assert.equal(withLead.phrases.length, 1)
  assert.equal(withoutLead.phrases.length, 1)
  // Смысл проверки не в конкретном числе: пауза, завершающая фразу, входит в
  // её длительность, и это правильно. Важно, чтобы минута тишины в начале
  // записи НЕ меняла длину фразы — иначе модель получала бы пустые секунды.
  assert.equal(withLead.phrases[0].durationMs, withoutLead.phrases[0].durationMs,
    'ведущая тишина не должна попадать в фразу')
  assert.equal(withLead.phrases[0].chunk.length, withoutLead.phrases[0].chunk.length,
    'ведущая тишина не должна попадать в звук фразы')
})

test('вздох посреди фразы её не разрезает', () => {
  // 800 мс речи, 400 мс паузы (вдвое меньше нужной), снова речь, затем тишина.
  const { phrases } = run([
    ...new Array(16).fill(0.2),
    ...new Array(8).fill(0.001),
    ...new Array(16).fill(0.2),
    ...new Array(40).fill(0.001),
  ])
  assert.equal(phrases.length, 1, 'короткая пауза не должна делить фразу надвое')
})

test('две фразы подряд дают две отправки', () => {
  const { phrases } = run([
    ...speech(600, DEFAULT_SILENCE_MS + 200),
    ...speech(500, DEFAULT_SILENCE_MS + 200),
  ])
  assert.equal(phrases.length, 2, 'после настоящей паузы должна быть новая фраза')
})

test('щелчок короче минимальной фразы не отправляется', () => {
  // 200 мс звука — короче minPhraseMs по умолчанию.
  const { phrases } = run([...new Array(4).fill(0.2), ...new Array(40).fill(0.001)])
  assert.equal(phrases.length, 0, 'слишком короткий звук в распознавание не идёт')
})

test('тишина в комнате не начинает фразу', () => {
  const { phrases, detector } = run(new Array(200).fill(0.002))
  assert.equal(phrases.length, 0, 'фон не должен рождать фразы')
  assert.equal(detector.speaking, false)
})

test('чувствительность настраивается порогом', () => {
  // Тихое бормотание: при низком пороге — речь, при высоком — нет.
  const soft = [0.006, 0.006, 0.006, 0.006, 0.006, 0.006, 0.006, 0.006]
  assert.equal(run(soft, { threshold: 0.004 }).detector.speaking, true, 'тихий голос должен ловиться')
  assert.equal(run(soft, { threshold: 0.05 }).detector.speaking, false, 'порог выше голоса — тишина')
})

test('reset забывает фразу, не отдавая её', () => {
  const detector = new VoiceActivityDetector()
  let at = 0
  for (let i = 0; i < 20; i += 1) {
    at += 50
    detector.push({ level: 0.2, at, chunk: Buffer.alloc(3200, 7) })
  }
  assert.equal(detector.speaking, true)
  detector.reset()
  assert.equal(detector.speaking, false, 'фраза забыта')
  assert.equal(detector.chunkBytes, 0, 'звук сброшен')
})