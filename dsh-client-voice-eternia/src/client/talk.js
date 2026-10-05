// Разговорный режим: человек говорит, ответ приходит голосом.
//
// Отличие от диктовки. Диктовка — это «нажал, сказал, посмотрел в поле»:
// человек каждое предложение отправляет руками. Разговор — это когда запись
// идёт непрерывно, а система сама решает, где кончилась фраза, распознаёт её и
// отправляет в беседу. Именно здесь появляется ощущение разговора: пауза вместо
// кнопки.
//
// Задержка складывается из трёх частей и это важно понимать честно:
//   пауза до конца фразы (по умолчанию 1.2 сек) → распознавание (~1 сек) →
//   ответ агента (его дело) → озвучка (локальная, десятки миллисекунд).
// Итого цикл 2–4 секунды. Сократить можно паузой и моделью распознавания, но не
// ценой надёжности: нарезать фразу раньше, чем человек договорил, хуже, чем
// ждать.
//
// Никакого `getUserMedia` здесь нет по той же причине, что и в диктовке:
// окно DSH Desktop — Electron с белым списком разрешений, где нет `media`.
// Всё, что здесь происходит, — опрос хоста и отправка текста.

import { startRecording, takePhrase, cancelRecording, recordingStatus, speak, stopSpeaking } from './api.js'
import { classifyFailure, describeFailure } from './recorder.js'
import { speakable } from '../speakText.js'

/** Как часто опрашиваем состояние, мс. Для гистограммы этого достаточно. */
const POLL_MS = 120

/**
 * Один разговор: запись, нарезка фраз, отправка.
 *
 * Жизненный цикл тот же, что у диктовки: `start()` → работает → `stop()`.
 * Отмена, сбой и выгрузка плагина ведут в один `dispose()`, поэтому повторный
 * вызов безопасен: освобождение обязано быть идемпотентным, иначе микрофон
 * остался бы открытым после выгрузки.
 */
export class Talk {
  /**
   * @param {object} [options] - настройки.
   * @param {object} [options.settings] - настройки плагина.
   * @param {(text: string) => void} [options.onSend] - отправка текста в беседу.
   * @param {(status: object) => void} [options.onState] - смена состояния панели.
   * @param {(bands: number[]) => void} [options.onBands] - гистограмма голоса.
   * @param {(kind: string, message: string) => void} [options.onFailure] - обрыв.
   * @param {(text: string) => void} [options.onPartial] - услышанное текстом.
   */
  constructor(options = {}) {
    this.settings = options.settings ?? {}
    this.onSend = typeof options.onSend === 'function' ? options.onSend : null
    this.onState = typeof options.onState === 'function' ? options.onState : null
    this.onBands = typeof options.onBands === 'function' ? options.onBands : null
    this.onFailure = typeof options.onFailure === 'function' ? options.onFailure : null
    this.onPartial = typeof options.onPartial === 'function' ? options.onPartial : null
    this.recognizer = typeof options.recognize === 'function' ? options.recognize : null

    this.phase = 'idle'
    this.timer = 0
    this.disposed = false
    this.bands = []
    this.speaking = false
    this.pending = 0
    /** Фраза уже в работе: две одновременно нельзя, иначе ответы будут переплетаться. */
    this.busy = false
    /** Что сейчас произносится — нужно, чтобы замолчать на перебивании. */
    this.talking = false
  }

  /**
   * Начинает разговор.
   *
   * @returns {Promise<void>}
   */
  async start() {
    if (this.disposed) throw new Error('разговор уже закрыт')
    if (this.phase !== 'idle') throw new Error('разговор уже идёт')

    const answer = await startRecording({ streaming: true })
    if (this.disposed) {
      // Разобрали, пока шёл запрос: микрофон не должен остаться открытым.
      void cancelRecording()
      return
    }
    if (answer.ok !== true) throw classifyFailure(answer)

    this.phase = 'listening'
    this.emitState()
    this.timer = setInterval(() => { void this.poll() }, POLL_MS)
  }

  /**
   * Один опрос: гистограмма, состояние речи и забор готовых фраз.
   *
   * @returns {Promise<void>}
   */
  async poll() {
    if (this.phase !== 'listening') return
    const answer = await recordingStatus()
    if (this.disposed || answer.ok !== true) return
    const state = answer.value ?? {}

    if (state.recording !== true) {
      // Хост закончил запись сам. Молчать нельзя: человек будет думать, что его
      // слушают, а его уже не слушают.
      this.phase = 'ended'
      this.clearTimer()
      this.emitState()
      this.onFailure?.('ended', '')
      return
    }

    if (Array.isArray(state.bands) && state.bands.length > 0) {
      this.bands = state.bands
      this.onBands?.(state.bands)
    }
    this.speaking = state.speaking === true
    this.pending = typeof state.pending === 'number' ? state.pending : 0

    // Фраза отправляется по одной. Вторая берётся, когда первая ушла: пока
    // распознавание и ответ идут, человек может уже договорить следующую.
    if (this.pending > 0 && this.busy !== true) {
      this.busy = true
      // Пока фраза распознаётся, панель обязана это показать: молчание в
      // несколько секунд человек читает как зависание, хотя сеть работает.
      this.phase = 'recognizing'
      this.emitState()
      void this.takeAndSend()
    }
  }

  /**
   * Забирает фразу, распознаёт и отправляет в беседу.
   *
   * @returns {Promise<void>}
   */
  async takeAndSend() {
    try {
      const answer = await takePhrase()
      if (this.disposed) return
      if (answer.ok !== true || answer.value === null || answer.value === undefined) return
      const audio = answer.value.audioBase64
      if (typeof audio !== 'string' || audio === '') return
      const text = await this.recognize(audio)
      if (this.disposed) return
      const clean = typeof text === 'string' ? text.trim() : ''
      // Пустой результат — это не ошибка: человек выдохнул, а не сказал слова.
      // Отправлять пустоту в беседу нельзя, от неё ломается история диалога.
      if (clean === '') return
      this.onSend?.(clean)
    } catch (failure) {
      if (this.disposed === false) {
        const { message } = describeFailure(failure)
        this.onFailure?.('recognize', message)
      }
    } finally {
      this.busy = false
      // Возвращаемся к слушанию: следующая фраза может прийти в любой момент.
      if (this.disposed === false) {
        this.phase = 'listening'
        this.emitState()
      }
    }
  }

  /**
   * Распознаёт фразу.
   *
   * Распознавание передаётся снаружи: маршрут живёт в другом слое, и знать про
   * него здесь незачем — достаточно знать, что фраза превратится в текст.
   *
   * @param {string} audioBase64 - звук фразы.
   * @returns {Promise<string>} распознанный текст.
   */
  async recognize(audioBase64) {
    if (typeof this.recognizer !== 'function') return ''
    return await this.recognizer(audioBase64)
  }

  /**
   * Произносит ответ агента вслух.
   *
   * Голос берётся из настроек, но если настройка не задана, хост выберет голос
   * системы. Текст очищается от разметки: читать вслух «закрывающая скобка» или
   * имя файла из ссылки — не разговор, а рябь в колонках.
   *
   * @param {string} text - ответ агента.
   * @returns {Promise<boolean>} удалось ли.
   */
  async say(text) {
    const speech = this.settings.speech ?? {}
    if (speech.enabled === false) return false
    const sayable = speakable(text)
    if (sayable === '') return false
    this.talking = true
    this.emitState()
    const done = await speak({
      text: sayable,
      voice: typeof speech.voice === 'string' ? speech.voice : '',
      rate: typeof speech.rate === 'number' ? speech.rate : 0,
      volume: typeof speech.volume === 'number' ? speech.volume : 100,
    })
    this.talking = false
    this.emitState()
    return done
  }

  /**
   * Замолчать.
   *
   * В разговоре это не украшение: человек перебивает голос, чтобы ответ не
   * заглушал его собственную фразу, — иначе приходится ждать конца длинного
   * ответа, чтобы задать вопрос.
   *
   * @returns {Promise<void>}
   */
  async hush() {
    if (this.talking === false) return
    await stopSpeaking()
    this.talking = false
    this.emitState()
  }

  /**
   * Останавливает разговор.
   *
   * @returns {Promise<void>}
   */
  async stop() {
    this.phase = 'stopped'
    this.clearTimer()
    await this.hush()
    void cancelRecording()
    this.emitState()
  }

  /** Останавливает таймер опроса, если он идёт. */
  clearTimer() {
    if (this.timer !== 0) {
      clearInterval(this.timer)
      this.timer = 0
    }
  }

  /** Сообщает панели о состоянии: слушаем, говорит человек или говорит голос. */
  emitState() {
    this.onState?.({
      phase: this.phase,
      speaking: this.speaking,
      talking: this.talking,
      pending: this.pending,
    })
  }

  /**
   * Гасит разговор: снимает таймер, останавливает микрофон и голос.
   *
   * Идемпотентно — к нему обращаются и остановка, и выгрузка плагина.
   *
   * @returns {void}
   */
  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.clearTimer()
    this.phase = 'idle'
    void stopSpeaking()
    void cancelRecording()
  }
}