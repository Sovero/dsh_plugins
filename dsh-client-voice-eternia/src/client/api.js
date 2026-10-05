// Связь клиентской половины с host-маршрутами плагина.
//
// Своего RPC-канала у пакета нет: host-половина публикует обычные HTTP-маршруты
// под префиксом `/voice-eternia`, а GUI открыт с того же origin, поэтому ходим
// обычным fetch. Ключи API на хосте остаются на хосте — сюда приходит только
// распознанный текст.

/** Префикс маршрутов пакета. */
const API_PREFIX = '/voice-eternia'

/**
 * Разбирает ответ маршрута.
 *
 * @param {Response} response - ответ fetch.
 * @returns {Promise<object>} разобранное тело либо описание ошибки.
 */
async function parse(response) {
  let payload
  try {
    payload = await response.json()
  } catch {
    return { ok: false, error: { code: 'bad-response', message: `Сервер ответил ${response.status}` } }
  }
  if (payload !== null && typeof payload === 'object') return payload
  return { ok: false, error: { code: 'bad-response', message: 'Пустой ответ сервера.' } }
}

/**
 * Отправляет POST без тела, ожидая ответ маршрута захвата.
 *
 * @param {string} url - адрес маршрута.
 * @param {object} body - тело запроса.
 * @returns {Promise<object>} разобранный ответ.
 */
async function post(url, body) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return await parse(response)
  } catch {
    return { ok: false, error: { code: 'network', message: 'Хост недоступен.' } }
  }
}

/**
 * Просит хост начать запись микрофона.
 *
 * Запись ведёт хост, а не страница: в окне Electron `getUserMedia` отказывает
 * молча, потому что подписанная оболочка не пропускает разрешение `media`.
 * На хосте запись делает внешняя программа, и браузер в процессе не участвует.
 *
 * @returns {Promise<{ ok: boolean, device?: string, maxSeconds?: number, error?: object }>}
 */
export async function startRecording() {
  return post(`${API_PREFIX}/record/start`, {})
}

/**
 * Останавливает запись и забирает WAV.
 *
 * @returns {Promise<{ ok: boolean, audioBase64?: string, bytes?: number, error?: object }>}
 */
export async function stopRecording() {
  return post(`${API_PREFIX}/record/stop`, {})
}

/**
 * Отменяет запись, ничего не возвращая.
 *
 * @returns {Promise<{ ok: boolean }>}
 */
export async function cancelRecording() {
  return post(`${API_PREFIX}/record/cancel`, {})
}

/**
 * Читает состояние записи: идёт ли она и каков уровень сигнала.
 *
 * @returns {Promise<{ ok: boolean, value?: { recording: boolean, level: number, seconds: number }, error?: object }>}
 */
export async function recordingStatus() {
  try {
    const response = await fetch(`${API_PREFIX}/record/status`, { method: 'GET' })
    return await parse(response)
  } catch {
    return { ok: false, error: { code: 'network', message: 'Хост недоступен.' } }
  }
}

/**
 * Читает настройки плагина, заданные в карточке.
 *
 * Клиенту нужны только те, что меняют поведение кнопки: показывать ли запасной
 * путь через браузер и вставлять ли результат автоматически. Остальное
 * (модель, промпт, микрофон) читает хост — он же делает запрос к моделям.
 *
 * @returns {Promise<object|null>} настройки либо null при недоступности.
 */
export async function readConfig() {
  try {
    const response = await fetch(`${API_PREFIX}/config`, { method: 'GET' })
    const payload = await parse(response)
    if (payload.ok !== true || payload.value === null || typeof payload.value !== 'object') return null
    return payload.value
  } catch {
    return null
  }
}

/**
 * Сохраняет настройки плагина.
 *
 * Хост принимает вложенные группы и раскладывает их в свой запасной файл, а
 * `readSettings` перечитывает его на каждый запрос — поэтому правка видна
 * сразу, без перезапуска DSH.
 *
 * @param {object} settings - настройки целиком.
 * @returns {Promise<{ ok: boolean, value?: object, error?: object }>}
 */
export async function writeConfig(settings) {
  try {
    const response = await fetch(`${API_PREFIX}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    return await parse(response)
  } catch {
    return { ok: false, error: { code: 'network', message: 'Хост недоступен.' } }
  }
}

/**
 * Отправляет аудио на распознавание.
 *
 * @param {object} options - параметры.
 * @param {string} options.audioBase64 - WAV в base64.
 * @param {AbortSignal} [options.signal] - отмена.
 * @returns {Promise<{ ok: boolean, text?: string, empty?: boolean, tookMs?: number, error?: object }>} результат.
 */
export async function transcribe({ audioBase64, signal }) {
  try {
    const response = await fetch(`${API_PREFIX}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioBase64 }),
      signal,
    })
    return await parse(response)
  } catch (failure) {
    if (failure instanceof Error && failure.name === 'AbortError') {
      return { ok: false, error: { code: 'aborted', message: 'Распознавание отменено.' } }
    }
    return { ok: false, error: { code: 'network', message: 'Хост недоступен.' } }
  }
}

/**
 * Просит отполировать текст.
 *
 * Полировка — улучшение, а не обязательный шаг: при любой ошибке хост вернёт
 * исходный текст, поэтому вызывающий код обязан смотреть на поле `polished`.
 *
 * @param {object} options - параметры.
 * @param {string} options.text - сырой текст.
 * @param {AbortSignal} [options.signal] - отмена.
 * @returns {Promise<{ ok: boolean, text: string, polished?: boolean }>} результат.
 */
export async function polish({ text, signal }) {
  try {
    const response = await fetch(`${API_PREFIX}/polish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal,
    })
    const payload = await parse(response)
    if (payload.ok === false) return { ok: false, text }
    return { ok: true, text: typeof payload.text === 'string' ? payload.text : text, polished: payload.polished === true }
  } catch {
    return { ok: false, text }
  }
}

/**
 * Спрашивает у хоста адрес того же GUI для обычного браузера.
 *
 * Нужен, когда микрофон заблокирован оболочкой Electron: браузер по этому
 * адресу показывает свой запрос доступа, и диктовка работает. Пустой `webUrl`
 * означает «порт неизвестен» — тогда кнопку открытия не показываем, чтобы не
 * вести пользователя по нерабочей ссылке.
 *
 * @returns {Promise<{ webUrl: string, port: number | null } | null>} адрес либо null.
 */
export async function readEnvironment() {
  try {
    const response = await fetch(`${API_PREFIX}/env`, { method: 'GET' })
    const payload = await parse(response)
    if (payload.ok !== true || payload.value === null || typeof payload.value !== 'object') return null
    return {
      webUrl: typeof payload.value.webUrl === 'string' ? payload.value.webUrl : '',
      port: typeof payload.value.port === 'number' ? payload.value.port : null,
    }
  } catch {
    return null
  }
}

/**
 * Читает список моделей, настроенных в самом DSH.
 *
 * Зачем это нужно. Поле «модель» текстом — плохая просьба: `id` провайдера и
 * точное имя модели человек помнить не обязан, а одна опечатка даёт молчаливый
 * отказ при первой же записи. Хост читает список из профиля DSH — того самого,
 * что виден в разделе «Модели», — и отдаёт его сюда для выпадающего списка.
 *
 * @returns {Promise<Array<object>|null>} модели либо null при недоступности.
 */
export async function readModels() {
  try {
    const response = await fetch(`${API_PREFIX}/models`, { method: 'GET' })
    const payload = await parse(response)
    return payload.ok === true && Array.isArray(payload.models) ? payload.models : null
  } catch {
    return null
  }
}

/**
 * Читает имена записей с ключами доступа.
 *
 * Сами ключи сюда не приходят и прийти не могут: хост отдаёт только имена.
 * Это и есть смысл списка — секрет вводят в хранилище DSH, а плагин лишь
 * ссылается на запись по имени.
 *
 * @returns {Promise<Array<object>|null>} записи либо null при недоступности.
 */
export async function readCredentials() {
  try {
    const response = await fetch(`${API_PREFIX}/credentials`, { method: 'GET' })
    const payload = await parse(response)
    return payload.ok === true && Array.isArray(payload.credentials) ? payload.credentials : null
  } catch {
    return null
  }
}
