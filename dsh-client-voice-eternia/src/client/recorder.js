// Управление записью микрофона на стороне клиента.
//
// Запись ведёт ХОСТ, а не страница. Причина не в плагине: окно DSH Desktop —
// это Electron, и подписанный `app.asar` пропускает через
// `canGrantWindowPermission` только `clipboard-sanitized-write` и
// `notifications`. Разрешения `media` в белом списке нет, поэтому `getUserMedia`
// отказывает молча, без системного диалога, и никакой код плагина это не
// обходит.
//
// Белый список относится к ОКНУ, а не к процессу хоста: хост — обычный Node,
// где микрофон пишет внешняя программа (см. `src/capture.js`). Поэтому здесь
// нет ни `getUserMedia`, ни `MediaRecorder`, ни пересэмплирования через Web
// Audio — всё это браузерные обходные пути, которые в приложении не работают.
// Клиент только спрашивает хоста: начать, остановить, где мы сейчас.
//
// Пересэмплирование тоже не нужно: хост пишет сразу 16 кГц mono — ровно тот
// формат, который ждут облачные модели.

import { startRecording, stopRecording, cancelRecording, recordingStatus } from './api.js'
import { defaultTranslate } from './locales.js'

/** Частота, которую ждут модели распознавания. */
export const TARGET_SAMPLE_RATE = 16000

/** Максимальная длительность одной записи, секунды (защита от забытой записи). */
export const MAX_RECORD_SECONDS = 120

/** Класс отказа, понятный человеку. */
export class RecorderError extends Error {
  /**
   * @param {string} kind - категория отказа.
   * @param {string} message - текст для пользователя.
   */
  constructor(kind, message) {
    super(message)
    this.name = 'RecorderError'
    this.kind = kind
  }
}

/**
 * Признак оболочки Electron.
 *
 * Нужен только для выбора текста отказа: в приложении микрофон берёт хост, в
 * обычном браузере — по-прежнему `getUserMedia`, и там отказ означает совсем
 * другое.
 *
 * @returns {boolean} верно ли, что страница открыта в Electron.
 */
export function isDesktopShell() {
  return typeof navigator !== 'undefined' && /electron/i.test(navigator.userAgent ?? '')
}

/**
 * Проверяет, можно ли вести запись в этой среде.
 *
 * Раньше здесь проверялся `navigator.mediaDevices`. Теперь запись идёт через
 * хост, поэтому проверять нечего: если хост на месте — пишем, если нет —
 * отказ придёт от маршрута с понятным текстом. Оставляем функцию, потому что
 * вызывающий код ждёт её ответа, и она же объясняет пользователю случай, когда
 * плагин открыли вообще без хоста.
 *
 * @returns {{ available: boolean, reason: string }} доступность и причина.
 */
export function probeSupport() {
  if (typeof fetch !== 'function') {
    return { available: false, reason: 'offline' }
  }
  return { available: true, reason: '' }
}

/**
 * Читает имя ошибки, не полагаясь на `instanceof`.
 *
 * `instanceof Error` ненадёжен сразу по двум причинам: ошибка может прийти из
 * другого realm (iframe, песочница), где прототип другой. Читаем поле `name`
 * напрямую.
 *
 * @param {unknown} failure - произвольное значение.
 * @returns {{ name: string, message: string }} имя и текст.
 */
export function describeFailure(failure) {
  if (failure === null || typeof failure !== 'object') {
    return { name: '', message: String(failure) }
  }
  const name = typeof failure.name === 'string' ? failure.name : ''
  const message = typeof failure.message === 'string' ? failure.message : ''
  return { name, message }
}

/**
 * Переводит отказ в текст для пользователя.
 *
 * Коды приходят с хоста и уже человекочитаемы, поэтому подробности оракула о
 * них мы сохраняем, а код без разбора отдаём как есть. Подсказка зависит от
 * среды: в браузере отказ почти всегда значит «пользователь закрыл диалог или
 * запретил микрофон в настройках сайта», и это другой совет.
 *
 * @param {unknown} failure - отказ: `RecorderError` или ответ маршрута.
 * @param {(key: string, vars?: object) => string} [t] - переводчик словаря.
 * @returns {RecorderError} ошибка с категорией.
 */
export function classifyFailure(failure, t = defaultTranslate) {
  if (failure instanceof RecorderError) return failure
  const { name, message } = describeFailure(failure)
  const code = typeof failure?.error?.code === 'string' ? failure.error.code : ''
  const detail = typeof failure?.error?.message === 'string' && failure.error.message !== ''
    ? failure.error.message
    : message

  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return new RecorderError(
      'denied',
      t(isDesktopShell() ? 'error.deniedDesktop' : 'error.deniedSite'),
    )
  }
  if (code === 'nodevice' || name === 'NotFoundError' || name === 'OverconstrainedError') {
    return new RecorderError('nodevice', t('error.noDevice'))
  }
  if (code === 'busy' || name === 'NotReadableError') {
    return new RecorderError('busy', t('error.busy'))
  }
  // Код от хоста уже содержит причину («На машине нет ffmpeg…»): переписывать
  // его своим текстом значило бы потерять полезную подробность.
  if (detail !== '') return new RecorderError(code === '' ? 'unknown' : code, detail)
  return new RecorderError('unknown', t('error.unknown'))
}

/**
 * Короткий путь для мест, где нужна только строка сообщения.
 *
 * @param {unknown} failure - отказ.
 * @param {(key: string, vars?: object) => string} [t] - переводчик.
 * @returns {string} текст для пользователя.
 */
export function classifyFailureMessage(failure, t = defaultTranslate) {
  return classifyFailure(failure, t).message
}

/**
 * Кодирует сэмплы в WAV: 16 бит, mono, RIFF-заголовок 44 байта.
 *
 * Запись с микрофона приходит с хоста уже в WAV, поэтому функция нужна для
 * синтетических сэмплов и для проверок формата; на пути диктовки её не
 * вызывают.
 *
 * @param {Float32Array} samples - сэмплы в диапазоне [-1, 1].
 * @returns {Uint8Array} готовый файл.
 */
export function encodeWave(samples) {
  const bytes = new Uint8Array(44 + samples.length * 2)
  const view = new DataView(bytes.buffer)
  const text = (at, value) => {
    for (let i = 0; i < value.length; i += 1) bytes[at + i] = value.charCodeAt(i)
  }
  text(0, 'RIFF')
  view.setUint32(4, bytes.length - 8, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, TARGET_SAMPLE_RATE, true)
  view.setUint32(28, TARGET_SAMPLE_RATE * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i += 1) {
    // Ограничение асимметричное, как требует PCM16: −32768 влезает в знаковый
    // 16-битный тип, а +32768 не влезает и стал бы −32768 — то есть тихий
    // всплеск тихо превратился бы в резкий щелчок в начале сигнала.
    const sample = samples[i]
    const value = sample <= -1 ? -32768 : sample >= 1 ? 32767 : Math.round(sample * 32767)
    view.setInt16(44 + i * 2, value, true)
  }
  return bytes
}

/**
 * Переводит байты в base64 без `btoa` над большим массивом.
 *
 * @param {Uint8Array|Buffer} bytes - данные.
 * @returns {string} base64.
 */
export function toBase64(bytes) {
  let binary = ''
  const step = 0x8000
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + step, bytes.length)))
  }
  return btoa(binary)
}

/**
 * Одна запись с микрофона.
 *
 * Жизненный цикл: `start()` → `stop()` → освобождение. Отмена, сбой и
 * выгрузка плагина ведут в один и тот же `dispose()`, поэтому повторный вызов
 * безопасен: освобождение обязано быть идемпотентным.
 *
 * Уровень сигнала приходит опросом маршрута: поток живёт на хосте, и подписаться
 * на него из страницы нельзя. Опрос идёт четыре раза в секунду — этого хватает
 * для живого индикатора и незаметно для сети.
 */
export class Recording {
  constructor() {
    this.phase = 'idle'
    this.startedAt = 0
    this.maxSeconds = MAX_RECORD_SECONDS
    this.onLevel = null
    this.onFailure = null
    this.levelTimer = 0
    this.disposed = false
    this.seconds = 0
  }

  /**
   * Просит хост начать запись и включает опрос уровня.
   *
   * @param {object} options - параметры.
   * @param {(kind: string, message: string) => void} [options.onFailure] - обработчик обрыва.
   * @param {(level: number) => void} [options.onLevel] - уровень сигнала 0..1.
   */
  async start({ onFailure, onLevel } = {}) {
    this.onLevel = typeof onLevel === 'function' ? onLevel : null
    this.onFailure = typeof onFailure === 'function' ? onFailure : null

    const support = probeSupport()
    if (!support.available) {
      throw new RecorderError('unsupported', 'Хост недоступен — плагин работает только в DSH.')
    }

    const answer = await startRecording()
    if (this.disposed) {
      // Компонент разобрали, пока шёл запрос: запись надо погасить, иначе
      // микрофон останется открытым после выгрузки плагина.
      void cancelRecording()
      return
    }
    if (answer.ok !== true) throw classifyFailure(answer)

    this.phase = 'recording'
    this.startedAt = Date.now()
    if (typeof answer.value?.maxSeconds === 'number') this.maxSeconds = answer.value.maxSeconds
    this.levelTimer = setInterval(() => { void this.poll() }, 250)
  }

  /**
   * Один опрос состояния: обновляет уровень и ловит обрыв записи на хосте.
   *
   * @returns {Promise<void>}
 */
  async poll() {
    if (this.phase !== 'recording') return
    const answer = await recordingStatus()
    if (this.disposed) return
    if (answer.ok !== true) return
    const state = answer.value
    if (state?.recording !== true) {
      // Хост закончил запись сам — например, упёрся в лимит времени. Молчать
      // тут нельзя: пользователь смотрел бы на «идёт запись» вечно.
      this.phase = 'ended'
      this.clearTimer()
      this.onFailure?.('ended', '')
      return
    }
    this.seconds = state.seconds ?? 0
    this.onLevel?.(state.level ?? 0)
  }

  /**
   * Останавливает запись и отдаёт готовое аудио.
   *
   * Base64 не декодируется и не перекодируется: хост уже отдал WAV в base64,
   * ровно в том виде, в каком его принимает маршрат распознавания. Обратное
   * преобразование здесь было бы лишним копированием мегабайта данных.
   *
   * @returns {Promise<{ audioBase64: string, bytes: number }>} аудио для распознавания.
   */
  async stop() {
    if (this.phase === 'stopped') throw new RecorderError('not-recording', 'Запись уже остановлена')
    this.clearTimer()
    const answer = await stopRecording()
    if (answer.ok !== true) throw classifyFailure(answer)
    this.phase = 'stopped'
    if (typeof answer.value?.audioBase64 !== 'string') {
      throw new RecorderError('lost', 'Хост вернул запись без данных.')
    }
    return {
      audioBase64: answer.value.audioBase64,
      bytes: answer.value.bytes ?? 0,
    }
  }

  /** Останавливает таймер опроса, если он идёт. */
  clearTimer() {
    if (this.levelTimer !== 0) {
      clearInterval(this.levelTimer)
      this.levelTimer = 0
    }
  }

  /**
   * Гасит запись: снимает таймер и просит хост прекратить писать.
   *
   * Идемпотентно — к нему обращаются и отмена, и выгрузка плагина.
   *
   * @returns {void}
   */
  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.clearTimer()
    if (this.phase === 'recording') void cancelRecording()
    this.phase = 'idle'
  }
}

/**
 * Перечисляет микрофоны.
 *
 * Функция сохранена ради прежнего контракта: UI больше её не зовёт — захват
 * идёт на хосте и устройство выбирает он, — но плагины, встроившие чужой код
 * с этим импортом, продолжат собираться.
 *
 * @returns {Promise<string[]>} всегда пустой список.
 */
export async function listMicrophones() {
  return []
}