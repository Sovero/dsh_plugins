// Наблюдатель за ответами агента: чтобы голос знал, что именно сказать.
//
// Откуда берётся текст ответа. У плагина нет доступа к потоку агента: клиентские
// слоты отдают состояние беседы, но не текст сообщений, а сервис запросов сессии
// читает сохранённые на диске сессии, а не живую. Прямой путь закрыт, и любая
// попытка вытащить текст из внутренних сторов DSH упрётся в чужой приватный код.
//
// Поэтому наблюдаем за DOM. Это осознанный компромисс, и он не так страшен, как
// кажется: у сообщений человека в чате есть модификатор класса `user`, а у
// ответа агента — нет. Значит «последний абзац без этого класса» — это ответ.
// Наблюдатель молчит, пока не увидит новый текст, и не трогает ничего: он
// только читает.
//
// Что делает с текстом. Ждёт, пока текст перестанет меняться: агент пишет по
// мере генерации, и произносить текст, который ещё дописывается, значит
// прочитать половину предложения и остановиться.

/** Сколько тишины считается концом ответа, мс. */
export const ANSWER_SETTLE_MS = 900

/** Как часто проверяется, что текст перестал меняться, мс. */
const CHECK_MS = 120

/**
 * Селектор области чата в интерфейсе DSH.
 *
 * Атрибут называется `data-conversation-region` — БЕЗ префикса `dsh-`. Ошибка в
 * один префикс стоила разговора целиком: наблюдатель не находил область чата,
 * `start()` возвращал false, и ответ агента не произносился никогда. При этом
 * запись и отправка работали, поэтому выглядело это как «я говорю, а в ответ
 * тишина» — то есть как поломка диалога, а не как неверный селектор.
 */
export const CHAT_REGION = '[data-conversation-region="chat"]'

/**
 * Наблюдатель за чатом.
 *
 * Наблюдение начинается по запросу и снимается по запросу же: держать
 * MutationObserver на странице, когда озвучка выключена, незачем — это лишняя
 * работа браузера в чужом интерфейсе.
 */
export class ReplyWatcher {
  /**
   * @param {object} [options] - параметры.
   * @param {(text: string) => void} [options.onReply] - новый ответ агента.
   */
  constructor(options = {}) {
    this.onReply = typeof options.onReply === 'function' ? options.onReply : null
    this.observer = null
    this.pending = null
    this.timer = 0
    this.lastSeen = ''
    this.armed = false
  }

  /**
   * Начинает наблюдение.
   *
   * @returns {boolean} удалось ли начать.
   */
  start() {
    if (this.observer !== null) return true
    if (typeof MutationObserver !== 'function') return false
    const root = typeof document === 'undefined' ? null : document.querySelector(CHAT_REGION)
    // Области чата может не быть ещё: сессия открывается позже. Тогда ждём
    // появления и тогда включаемся, иначе озвучка молча не работала бы.
    if (root === null) return false
    this.armed = true
    this.observer = new MutationObserver(() => { this.scan(root) })
    this.observer.observe(root, { childList: true, subtree: true, characterData: true })
    this.lastSeen = this.latestReply(root)
    return true
  }

  /**
   * Останавливает наблюдение.
   *
   * @returns {void}
   */
  stop() {
    this.armed = false
    if (this.observer !== null) {
      this.observer.disconnect()
      this.observer = null
    }
    if (this.timer !== 0) {
      clearTimeout(this.timer)
      this.timer = 0
    }
    this.pending = null
  }

  /**
   * Ищет новый ответ агента в области чата.
   *
   * @param {Element} root - область чата.
   * @returns {void}
   */
  scan(root) {
    const text = this.latestReply(root)
    if (text === '' || text === this.lastSeen) return
    this.lastSeen = text
    this.pending = text
    if (this.timer !== 0) clearTimeout(this.timer)
    this.timer = setTimeout(() => { this.settle() }, CHECK_MS)
  }

  /**
   * Проверяет, что ответ перестал меняться.
   *
   * @returns {void}
   */
  settle() {
    this.timer = 0
    if (this.armed === false || this.pending === null) return
    const root = typeof document === 'undefined' ? null : document.querySelector(CHAT_REGION)
    const text = root === null ? this.pending : this.latestReply(root)
    if (text === this.pending) {
      // Текст замер — значит ответ дописан и можно говорить.
      this.onReply?.(text)
      this.pending = null
      return
    }
    // Ещё пишет: ждём дальше.
    this.pending = text
    this.timer = setTimeout(() => { this.settle() }, CHECK_MS)
  }

  /**
   * Достаёт текст последнего ответа агента.
   *
   * @param {Element} root - область чата.
   * @returns {string} текст или пусто.
   */
  latestReply(root) {
    const nodes = root.querySelectorAll('[class*="MessageItem"], [data-message], article, li')
    for (let index = nodes.length - 1; index >= 0; index -= 1) {
      const node = nodes[index]
      if (node === null || node === undefined) continue
      // Сообщение человека — не ответ. Иначе плагин читал бы вслух слова,
      // которые человек только что произнёс, и разговаривал бы сам с собой.
      const classes = typeof node.className === 'string' ? node.className : ''
      if (/(^|\s|\.)user(\s|$)/.test(classes)) continue
      const text = normalize(node.innerText ?? node.textContent ?? '')
      if (text !== '') return text
    }
    return ''
  }
}

/**
 * Приводит текст узла к одной строке без ролей пробелов.
 *
 * @param {string} text - исходный текст.
 * @returns {string} нормализованный текст.
 */
function normalize(text) {
  return String(text).replace(/\s+/g, ' ').trim()
}
