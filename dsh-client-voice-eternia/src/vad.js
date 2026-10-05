// Детектор речи по уровню сигнала.
//
// Зачем он нужен. Диктовка работает так: нажал — записал — отправил. Для
// разговора так не выйдет: человек говорит сам, а где кончилась фраза, должен
// решить компьютер. Пока он ждёт, пока человек договорит, он слушает; когда
// наступает тишина — фраза закончена, её можно распознавать и отправлять.
//
// Детектор отвечает на два вопроса по потоку уровней: «звучит ли речь сейчас»
// и «только что произнесённая фраза закончилась».
//
// Про пороги. Порог тишины берётся выше фонового шума пустой комнаты: в
// квартире микрофон выдаёт единицы тысячных, и слишком низкий порог принимал бы
// шум вентилятора за речь — тогда фраза никогда не заканчивалась бы.
// Задержка на паузу отсчитывается ПОСЛЕ последнего громкого отсчёта: короткий
// вздох посреди фразы не должен её разрезать.

/** Порог тишины по умолчанию: заметно выше фона пустой комнаты. */
export const DEFAULT_SILENCE_THRESHOLD = 0.008

/** Пауза, которой фраза считается законченной, мс. */
export const DEFAULT_SILENCE_MS = 1200

/**
 * Сколько непрерывного звука нужно, чтобы признать начало речи, мс.
 *
 * Нужен, чтобы щелчок мыши, стук клавиатуры или скрип стула не начинали фразу.
 */
export const DEFAULT_SPEECH_ONSET_MS = 180

/** Самая короткая фраза, которую вообще стоит распознавать, мс. */
export const DEFAULT_MIN_PHRASE_MS = 400

/**
 * Детектор речи.
 *
 * Работает по вызовам `push`: на каждый приходит уровень сигнала и время.
 * Класс ничего не знает ни о микрофоне, ни о времени извне — поэтому его можно
 * проверить обычным тестом: подать на вход числа и посмотреть на решения.
 */
export class VoiceActivityDetector {
  /**
   * @param {object} [options] - настройки.
   * @param {number} [options.threshold] - порог речи по уровню.
   * @param {number} [options.silenceMs] - пауза, завершающая фразу.
   * @param {number} [options.onsetMs] - звук для подтверждения начала речи.
   * @param {number} [options.minPhraseMs] - короче этой фразы не отправляем.
   */
  constructor(options = {}) {
    this.threshold = typeof options.threshold === 'number' ? options.threshold : DEFAULT_SILENCE_THRESHOLD
    this.silenceMs = typeof options.silenceMs === 'number' ? options.silenceMs : DEFAULT_SILENCE_MS
    this.onsetMs = typeof options.onsetMs === 'number' ? options.onsetMs : DEFAULT_SPEECH_ONSET_MS
    this.minPhraseMs = typeof options.minPhraseMs === 'number' ? options.minPhraseMs : DEFAULT_MIN_PHRASE_MS

    /** Идёт ли сейчас речь. */
    this.speaking = false
    /** Отсчёт тишины подряд, мс. */
    this.silenceRun = 0
    /** Отсчёт звука подряд, мс. — считается до признания речи. */
    this.loudRun = 0
    /**
     * Сколько всего прозвучало речи в текущей фразе, мс.
     *
     * Отдельно от длительности окна: окно включает завершающую паузу, а она
     * не голос. Без этого разделения щелчок в 200 мс, раздутый паузой до
     * полутора секунд, проходил бы проверку минимальной длины и уходил в
     * распознавание, где модель выдумывает слово из стука.
     */
    this.speechMs = 0
    /** Момент последнего отсчёта, на который опирается детектор. */
    this.lastAt = null
    /** Начало текущей фразы по времени отсчётов, мс. */
    this.phraseStartedAt = null
    /** Накопленные байты текущей фразы. */
    this.chunk = []
    /**
     * Звук, накопленный ДО признания речи.
     *
     * Нужен, потому что признание наступает только через onsetMs, а первые
     * отсчёты уже пришли. Если их выбросить, фраза начнётся с середины первого
     * слова — и это был настоящий баг, пойманный тестом на тишину в начале.
     */
    this.pre = []
    /** Сколько всего байт пришло с начала фразы. */
    this.chunkBytes = 0
  }

  /**
   * Подаёт очередной отсчёт уровня.
   *
   * @param {object} sample - отсчёт.
   * @param {number} sample.level - уровень сигнала (RMS, 0..1).
   * @param {number} sample.at - время отсчёта, мс.
   * @param {Buffer} [sample.chunk] - байты звука, пришедшие вместе с отсчётом.
   * @returns {object|null} результат: `{ ended: true, chunk, durationMs }`, когда
   *   фраза только что закончилась, иначе `null`.
   */
  push(sample) {
    const level = typeof sample.level === 'number' ? sample.level : 0
    const at = typeof sample.at === 'number' ? sample.at : (this.lastAt ?? 0) + 50
    // Первый отсчёт тоже длится промежуток между сэмплами. Если принять его за
    // нулевой, весь отсчёт начала фразы сдвинется на шаг — и фраза после
    // ведущей тишины окажется длиннее такой же фразы без неё.
    const step = this.lastAt === null ? 50 : Math.max(0, at - this.lastAt)
    this.lastAt = at

    const loud = level >= this.threshold

    // Байты копятся с начала фразы, а не с начала записи: тишина в начало не
    // должна попадать в распознавание, от неё модель только теряет время.
    if (this.speaking === true) {
      if (sample.chunk !== undefined && sample.chunk !== null) {
        this.chunk.push(sample.chunk)
        this.chunkBytes += sample.chunk.length
      }
      if (loud === true) this.speechMs += step
      this.silenceRun = loud === true ? 0 : this.silenceRun + step
      if (this.silenceRun >= this.silenceMs) return this.close(at)
      return null
    }

    if (loud === true) {
      this.loudRun += step
      this.speechMs += step
      this.silenceRun = 0
      if (sample.chunk !== undefined && sample.chunk !== null) this.pre.push(sample.chunk)
      // Речь признаём только после устойчивого звука, а не по первому щелчку.
      if (this.loudRun >= this.onsetMs) {
        this.speaking = true
        this.phraseStartedAt = at - this.loudRun
        this.chunk = this.pre
        this.pre = []
        for (const part of this.chunk) this.chunkBytes += part.length
      }
      return null
    }

    // Тишина, когда речи не было: забываем незаконченный на onset, иначе скрип
    // стула через полчаса разбудил бы фразу.
    this.silenceRun += step
    if (this.silenceRun >= this.onsetMs) {
      this.loudRun = 0
      // Щелчок, не дотянувший до речи. Время речи обнуляем: этот звук уже не
      // голос, и учитывать его в следующей фразе незачем.
      if (this.speaking === false) this.speechMs = 0
      // Звук, так и не дотянувший до речи, держим на случай, если речь вот-вот
      // подтвердится; иначе буфер растёт впустую.
      if (this.pre.length > 20) this.pre = []
    }
    return null
  }

  /**
   * Закрывает текущую фразу и отдаёт её содержимое.
   *
   * @param {number} at - время закрытия, мс.
   * @returns {object|null} фраза либо null, если она слишком короткая.
   */
  close(at) {
    const startedAt = this.phraseStartedAt ?? (this.lastAt ?? 0)
    const durationMs = Math.max(0, at - startedAt)
    const speechMs = this.speechMs
    const chunk = this.chunk.length === 0 ? null : Buffer.concat(this.chunk)
    this.speaking = false
    this.silenceRun = 0
    this.loudRun = 0
    this.speechMs = 0
    this.phraseStartedAt = null
    this.chunk = []
    this.pre = []
    this.chunkBytes = 0

    // Минимальная длина проверяется по ВРЕМЕНИ РЕЧИ, а не по окну записи: окно
    // включает паузу, которой человек не говорил. Иначе стук мышью в двухстах
    // миллисекундах проходил бы проверку и уходил в модель, которая услышит в
    // нём любое слово.
    if (speechMs < this.minPhraseMs) return null
    if (chunk === null || chunk.length === 0) return null
    return { ended: true, chunk, durationMs, speechMs }
  }

  /**
   * Забывает текущую фразу, не отдавая её.
   *
   * Нужно при остановке записи человеком: невысказанное не отправляется.
   */
  reset() {
    this.speaking = false
    this.silenceRun = 0
    this.loudRun = 0
    this.speechMs = 0
    this.phraseStartedAt = null
    this.chunk = []
    this.pre = []
    this.chunkBytes = 0
  }
}