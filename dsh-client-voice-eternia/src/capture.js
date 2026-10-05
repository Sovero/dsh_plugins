// Захват микрофона на стороне хоста.
//
// Зачем это вообще нужно. Кнопка диктовки живёт в окне DSH Desktop, а это
// Electron: подписанный `app.asar` пропускает через `canGrantWindowPermission`
// только `clipboard-sanitized-write` и `notifications`. Разрешения `media` в
// белом списке нет, поэтому `getUserMedia` отказывает молча, без системного
// диалога, и никакой плагин это не обойдёт.
//
// Но белый список относится к ОКНУ, а не к процессу хоста. Хост — обычный Node,
// и записать микрофон можно внешней программой, минуя разрешения оболочки.
// Отсюда и весь этот модуль: `ffmpeg` пишет WAV прямо на диск, браузер в
// процессе не участвует, и кнопка работает там же, где нажата.
//
// Требования к `ffmpeg` намеренно скромные: любой свежий, лишь бы умел `dshow`
// (Windows) или `alsa`/`avfoundation` (прочие системы) и писал 16 кГц mono.

import { spawn, execFile } from 'node:child_process'
import { createWriteStream, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { VoiceActivityDetector } from './vad.js'

/**
 * Сколько готовых фраз ждут отправки, прежде чем начать отбрасывать.
 *
 * Очередь нужна: распознавание идёт по сети и может отставать от человека,
 * который уже говорит следующую фразу. Но расти бесконечно она не должна —
 * иначе память процесса растёт, пока сергей болтает без остановки.
 */
export const MAX_PENDING_PHRASES = 6

/** Частота записи: ровно та, что ждут облачные модели распознавания. */
export const TARGET_SAMPLE_RATE = 16000

/** Каталог для временных WAV: системный временный, не рабочий каталог агента. */
const WORK_DIR = join(tmpdir(), 'dsh-voice-eternia')

/** Максимальная длительность одной записи, секунды. */
export const MAX_RECORD_SECONDS = 120

/**
 * Утилиты, которые пробуем по очереди.
 *
 * ffmpeg идёт первым: он умеет писать готовый WAV и перечислять устройства сам.
 * `sox` — запасной вариант, если ffmpeg не установлен.
 *
 * @type {readonly string[]}
 */
const CANDIDATES = ['ffmpeg', 'ffmpeg.exe', 'sox', 'sox.exe']

/**
 * Ошибка захвата, понятная человеку.
 *
 * Отдельный класс нужен, чтобы маршрут отличал «микрофон недоступен» (ответ
 * клиенту с кодом) от неожиданного сбоя процесса (500 и текст в лог).
 */
export class CaptureError extends Error {
  /**
   * @param {string} code - машиночитаемый код отказа.
   * @param {string} message - текст для пользователя.
   */
  constructor(code, message) {
    super(message)
    this.name = 'CaptureError'
    this.code = code
  }
}

/**
 * Выполняет программу и возвращает её вывод.
 *
 * `ffmpeg -list_devices` всегда завершается с ненулевым кодом — это его
 * обычный способ показать список и выйти, поэтому код возврата здесь не
 * проверяется: важен только вывод.
 *
 * @param {string} bin - исполняемый файл.
 * @param {string[]} args - аргументы.
 * @param {number} timeoutMs - предел ожидания.
 * @returns {Promise<string>} stdout и stderr вместе.
 */
function run(bin, args, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout: timeoutMs, windowsHide: true, maxBuffer: 4 << 20 }, (error, stdout, stderr) => {
      if (error !== null && error.code === 'ENOENT') {
        reject(new CaptureError('no-recorder', `${bin} не найден в PATH`))
        return
      }
      // Код возврата игнорируем: у ffmpeg он ненулевой даже при успехе.
      resolve(`${stdout}${stderr}`)
    })
  })
}

/**
 * Ищет доступную программу записи.
 *
 * @returns {Promise<string|null>} путь к исполняемому файлу либо null.
 */
export async function findRecorder() {
  for (const bin of CANDIDATES) {
    try {
      await run(bin, ['-version'], 4000)
      return bin
    } catch (error) {
      if (error instanceof CaptureError && error.code === 'no-recorder') continue
      // Программа есть, но ответила не так — считаем её годной: версию нам
      // читать не обязательно, важна способность писать звук.
      return bin
    }
  }
  return null
}

/**
 * Перечисляет микрофоны системы.
 *
 * @returns {Promise<string[]>} имена устройств ввода, по порядку вывода ffmpeg.
 */
export async function listMicrophones(bin = 'ffmpeg') {
  let output = ''
  try {
    output = await run(bin, ['-hide_banner', '-f', 'dshow', '-list_devices', 'true', '-i', 'dummy'], 8000)
  } catch {
    return []
  }
  // Строка вида: [dshow @ ..] "Микрофон (Realtek(R) Audio)" (audio)
  const names = []
  const pattern = /"([^"]+)"\s+\(audio\)/g
  let match = pattern.exec(output)
  while (match !== null) {
    names.push(match[1])
    match = pattern.exec(output)
  }
  return names
}

/**
 * Состояние одной незавершённой записи.
 *
 * Держим ровно один активный захват: две одновременные записи с одного
 * микрофона физически невозможны, а разбираться с двумя процессами ffmpeg
 * незачем.
 *
 * @typedef {object} Session
 * @property {import('node:child_process').ChildProcess} child - процесс ffmpeg.
 * @property {string} file - путь к временному файлу сырого PCM.
 * @property {import('node:fs').WriteStream} sink - поток записи в этот файл.
 * @property {number} startedAt - момент старта, мс.
 * @property {number} bytes - сколько байт пришло от ffmpeg.
 * @property {number} level - последний измеренный уровень, 0..1.
 * @property {Promise<void>} closed - обещание, когда поток и процесс завершены.
 */

/** @type {Session|null} текущий захват. */
let current = null

/**
 * Запускает запись.
 *
 * ffmpeg пишет в stdout ПАЙПОМ, а не в файл, и это не стилистический выбор.
 * Проверено: при записи прямо в файл ffmpeg копит данные до конца записи —
 * файл остаётся нулевым все 120 секунд, и по нему нельзя судить ни о уровне,
 * ни о том, что микрофон вообще жив. С `-f s16le` в stdout и флагами
 * `-avioflags direct -fflags nobuffer` поток идёт в реальном времени, и из
 * сэмплов получается честный индикатор громкости.
 *
 * Формат сырой: без заголовка он уходит сразу, без ожидания финализации.
 * WAV-заголовок добавляется уже при остановке.
 *
 * @param {object} options - параметры.
 * @param {string} [options.device] - имя устройства; по умолчанию первое найденное.
 * @param {string} [options.bin] - программа записи.
 * @param {number} [options.maxSeconds] - предел одной записи.
 * @param {number} [options.inputGain] - усиление входа, 1 — без изменений.
 * @param {boolean} [options.noiseSuppress] - убрать низкочастотный гул.
 * @param {boolean} [options.streaming] - разговорный режим: непрерывная запись
 *   с нарезкой на фразы вместо одной записи до нажатия.
 * @param {number} [options.threshold] - порог речи для нарезки.
 * @param {number} [options.silenceMs] - пауза, завершающая фразу.
 * @param {number} [options.onsetMs] - звук для подтверждения начала речи.
 * @param {number} [options.minPhraseMs] - короче не отправляем.
 * @returns {Promise<{ device: string, file: string }>} что запущено.
 */
export async function start({
  device,
  bin = 'ffmpeg',
  maxSeconds = MAX_RECORD_SECONDS,
  inputGain = 1,
  noiseSuppress = true,
  streaming = false,
  threshold,
  silenceMs,
  onsetMs,
  minPhraseMs,
} = {}) {
  if (current !== null) throw new CaptureError('busy', 'Запись уже идёт')

  let target = device
  if (target === undefined || target === '') {
    const devices = await listMicrophones(bin)
    if (devices.length === 0) throw new CaptureError('nodevice', 'Микрофон не найден')
    target = devices[0]
  }

  mkdirSync(WORK_DIR, { recursive: true })
  const file = join(WORK_DIR, `dictate-${randomUUID()}.pcm`)

  // Параметры из карточки настроек. Фильтры применяются к самому потоку, а не
  // после записи: держать в памяти сырой шум ради последующей чистки означало
  // бы платить памятью за каждую секунду диктовки.
  const filters = []
  if (noiseSuppress === true) filters.push('highpass=f=80')
  if (typeof inputGain === 'number' && Number.isFinite(inputGain) && inputGain !== 1) {
    filters.push(`volume=${inputGain}`)
  }
  const limit = streaming === true
    // Разговор не измеряется минутами: человек может говорить полчаса подряд, и
    // обрыв на «страховке» двух минут посреди фразы был бы просто отказом.
    ? 3600
    : (Number.isInteger(maxSeconds) && maxSeconds > 0 ? maxSeconds : MAX_RECORD_SECONDS)

  const child = spawn(bin, [
    '-hide_banner', '-loglevel', 'error',
    '-f', 'dshow', '-i', `audio=${target}`,
    ...(filters.length === 0 ? [] : ['-af', filters.join(',')]),
    '-f', 's16le', '-ar', String(TARGET_SAMPLE_RATE), '-ac', '1',
    '-avioflags', 'direct', '-fflags', 'nobuffer',
    '-t', String(limit),
    '-',
  ], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })

  const sink = createWriteStream(file)
  const session = {
    child,
    file,
    sink,
    startedAt: Date.now(),
    bytes: 0,
    level: 0,
    // Полосы для гистограммы голоса: пусты до первого куска звука.
    bands: new Array(BAND_COUNT).fill(0),
    // Разговорный режим: запись непрерывная, а звук нарезается на фразы.
    streaming: streaming === true,
    detector: streaming === true ? new VoiceActivityDetector({ threshold, silenceMs, onsetMs, minPhraseMs }) : null,
    phrases: [],
    dropped: 0,
  }
  /**
   * Кладёт готовую фразу в очередь.
   *
   * Переполнение не раздувает память: когда очередь полна, фраза отбрасывается
   * и растёт счётчик потерянных. Отбрасывать честнее, чем копить звук до
   * падения процесса — а падать мы не должны.
   *
   * @param {{chunk: Buffer, durationMs: number}} phrase - фраза.
   * @returns {void}
   */
  session.push = (phrase) => {
    if (session.phrases.length >= MAX_PENDING_PHRASES) {
      session.dropped += 1
      return
    }
    session.phrases.push({ pcm: phrase.chunk, durationMs: phrase.durationMs, at: Date.now() })
  }
  const closed = new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      current = null
      resolve()
    }
    child.stdout.on('data', (chunk) => {
      session.bytes += chunk.length
      sink.write(chunk)
      session.level = measureLevel(chunk, session.level)
      session.bands = measureBands(chunk, session.bands)
      // В разговорном режиме решаем, где кончилась фраза. Без этого человек был
      // бы обязан сам нажимать стоп после каждой фразы — это диктовка, а не
      // разговор.
      if (session.detector !== null) {
        const phrase = session.detector.push({ level: session.level, at: Date.now(), chunk })
        if (phrase !== null) session.push(phrase)
      }
    })
    child.stdout.on('end', () => { sink.end(); finish() })
    child.once('error', () => { sink.end(); finish() })
    child.stderr.on('data', (chunk) => {
      session.detail = (session.detail ?? '') + String(chunk)
    })
    child.once('exit', () => {
      sink.end()
      // Даём потоку дописать хвост: 'exit' приходит раньше 'end' stdout.
      setTimeout(finish, 120)
    })
  })
  session.closed = closed

  // Признак жизни — первые байты от микрофона, а не файл на диске.
  try {
    await waitForSignal(session, 6000)
  } catch (failure) {
    stopChild(child)
    await closed
    cleanup(file)
    const detail = (session.detail ?? '').trim().split(/\r?\n/).slice(-1)[0] ?? ''
    throw new CaptureError(
      failure.code ?? 'no-signal',
      detail === '' ? failure.message : `${failure.message} (${detail})`,
    )
  }

  current = session
  return { device: target, file }
}

/**
 * Оценивает громкость по свежему куску сэмплов.
 *
 * Считаем среднеквадратичное: пиковое значение мигает на единичных щелчках и
 * микрофоне в комнате мигает, а RMS растёт вместе с голосом и держится, пока
 * человек говорит. Окно сглаживания — экспоненциальное, иначе индикатор дёргался
 * бы на каждом паузе между словами.
 *
 * @param {Buffer} chunk - свежие байты (16-битные сэмплы LE).
 * @param {number} previous - предыдущее значение уровня, 0..1.
 * @returns {number} новый уровень, 0..1.
 */
function measureLevel(chunk, previous) {
  let sum = 0
  let count = 0
  for (let at = 0; at + 1 < chunk.length; at += 2) {
    const sample = chunk.readInt16LE(at)
    sum += sample * sample
    count += 1
  }
  if (count === 0) return previous
  const rms = Math.sqrt(sum / count) / 32768
  // Пороги подобраны по замеру: в тихой комнате микрофон даёт RMS около 66
  // (0.002 в нормированных единицах) — это шум, а не речь. Уверенная речь
  // даёт 2000…8000, то есть 0.06…0.25. Ниже 0.004 показываем ноль, иначе
  // индикатор всегда слегка подрагивал бы от фонового шума.
  const scaled = Math.max(0, Math.min(1, (rms - 0.004) / 0.12))
  return previous * 0.6 + scaled * 0.4
}

/** Сколько полос в гистограмме голоса. */
export const BAND_COUNT = 24

/**
 * Разворачивает свежий кусок звука в полосы для гистограммы.
 *
 * Зачем это нужно. Один уровень — одно число, и по нему не видно, ЧЕСЛИК тебя
 * слышит: громко это или шелест, хрипнет голос или нет. Полосы показывают
 * огибающую звука во времени, и человек видит свой голос — это и есть разница
 * между «программа записала что-то» и «со мной разговаривают».
 *
 * Полосы — это не спектр: кусок режется на равные куски по времени, и каждый
 * даёт свою амплитуду. Для показа ответа человека этого достаточно, а на
 * настоящее преобразование Фурье в процессе записи нет ни сил, ни смысла.
 *
 * @param {Buffer} chunk - свежие байты (16-битные сэмплы LE).
 * @param {number[]} previous - предыдущие полосы.
 * * @returns {number[]} новые полосы, 0..1, ровно BAND_COUNT штук.
 */
function measureBands(chunk, previous) {
  const samples = Math.floor(chunk.length / 2)
  if (samples === 0) return previous
  const per = Math.max(1, Math.floor(samples / BAND_COUNT))
  const bands = new Array(BAND_COUNT).fill(0)
  for (let band = 0; band < BAND_COUNT; band += 1) {
    const from = band * per
    const to = band + 1 === BAND_COUNT ? samples : Math.min(samples, from + per)
    let sum = 0
    let count = 0
    for (let index = from; index < to; index += 1) {
      const sample = chunk.readInt16LE(index * 2)
      sum += sample * sample
      count += 1
    }
    if (count === 0) continue
    const rms = Math.sqrt(sum / count) / 32768
    const scaled = Math.max(0, Math.min(1, (rms - 0.004) / 0.12))
    // Полосы сглаживаются сильнее общего уровня: иначе столбики дрожали бы так,
    // что глаз не успевал бы читать форму речи.
    const was = previous[band] ?? 0
    bands[band] = was * 0.5 + scaled * 0.5
  }
  return bands
}

/**
 * Дожидается первых байт сигнала.
 *
 * @param {Session} session - текущий захват.
 * @param {number} timeoutMs - предел ожидания.
 * @returns {Promise<void>}
 */
async function waitForSignal(session, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (session.bytes > 0) return
    if (session.child.exitCode !== null) throw new CaptureError('nodevice', 'Устройство не открылось')
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new CaptureError('no-signal', 'Микрофон не открылся')
}

/**
 * Останавливает запись и отдаёт WAV в base64.
 *
 * @returns {Promise<{ audioBase64: string, bytes: number, tookMs: number }>}
 */
export async function stop() {
  const session = current
  if (session === null) throw new CaptureError('not-recording', 'Запись не идёт')
  current = null

  stopChild(session.child)
  await Promise.race([
    session.closed,
    new Promise((resolve) => setTimeout(resolve, 4000)),
  ])

  let raw
  try {
    raw = readFileSync(session.file)
  } catch {
    throw new CaptureError('lost', 'Запись потеряна')
  } finally {
    cleanup(session.file)
  }

  if (raw.length < 3200) throw new CaptureError('empty', 'Запись слишком короткая')

  const wav = wrapWav(raw)
  return {
    audioBase64: wav.toString('base64'),
    bytes: wav.length,
    tookMs: Date.now() - session.startedAt,
  }
}

/**
 * Оборачивает сырой PCM в WAV-заголовок.
 *
 * Сырой поток приходит без заголовка — это и была причина писать его вместо
 * WAV: RIFF требует размер блоков в первых байтах, поэтому ffmpeg обязан ждать
 * конца записи. Здесь размер известен точно, и заголовок дописывается за
 * микросекунды.
 *
 * @param {Buffer} raw - сэмплы 16 бит LE, mono.
 * @returns {Buffer} полноценный WAV.
 */
function wrapWav(raw) {
  const out = Buffer.allocUnsafe(44 + raw.length)
  out.write('RIFF', 0, 'ascii')
  out.writeUInt32LE(36 + raw.length, 4)
  out.write('WAVE', 8, 'ascii')
  out.write('fmt ', 12, 'ascii')
  out.writeUInt32LE(16, 16)
  out.writeUInt16LE(1, 20)
  out.writeUInt16LE(1, 22)
  out.writeUInt32LE(TARGET_SAMPLE_RATE, 24)
  out.writeUInt32LE(TARGET_SAMPLE_RATE * 2, 28)
  out.writeUInt16LE(2, 32)
  out.writeUInt16LE(16, 34)
  out.write('data', 36, 'ascii')
  out.writeUInt32LE(raw.length, 40)
  raw.copy(out, 44)
  return out
}

/**
 * Снимает процесс записи.
 *
 * На Windows `kill` надёжно не работает для дерева процессов, поэтому после
 * попытки пробуем `taskkill`. Отсутствие `taskkill` не считаем ошибкой:
 * первый вызов обычно уже освободил устройство.
 *
 * @param {import('node:child_process').ChildProcess} child - процесс.
 */
function stopChild(child) {
  try {
    child.kill('SIGINT')
  } catch {
    // Процесс уже мёртв — ничего делать не нужно.
  }
  if (process.platform !== 'win32') return
  try {
    spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' })
  } catch {
    // taskkill может отсутствовать в урезанном окружении; это не мешает.
  }
}

/**
 * Отменяет запись и удаляет временный файл.
 *
 * @returns {void}
 */
export function cancel() {
  if (current === null) return
  const session = current
  current = null
  // Разговорный режим: незаконченную фразу не отправляем. Человек нажал
  // «закончить» — значит всё, что он не договорил, он говорить не собирался.
  if (session.detector !== null) session.detector.reset()
  session.phrases.length = 0
  stopChild(session.child)
  // Обещание закрытия называется `closed`: под именем `finished` его нет, и
  // обращение к нему бросало TypeError прямо в отмене — то есть ровно тогда,
  // когда запись нужно погасить (отмена, выгрузка плагина, повторный запуск).
  void session.closed.then(() => cleanup(session.file))
}

/**
 * Состояние записи для индикатора в панели.
 *
 * Уровень настоящий: он измерен по сэмплам, пришедшим от микрофона, а не
 * оценён по времени. Браузерный путь давал уровень из Web Audio, но здесь
 * браузера в процессе нет — сигнал меряется прямо в потоке.
 *
 * @returns {object} состояние записи.
 */
export function status() {
  if (current === null) {
    return {
      recording: false,
      level: 0,
      bytes: 0,
      seconds: 0,
      speaking: false,
      pending: 0,
      dropped: 0,
      bands: new Array(BAND_COUNT).fill(0),
    }
  }
  const samples = Math.floor(current.bytes / 2)
  return {
    recording: true,
    level: Math.round(current.level * 100) / 100,
    bytes: current.bytes,
    seconds: Math.round((samples / TARGET_SAMPLE_RATE) * 10) / 10,
    // Идёт ли речь сейчас: панель показывает это иначе, чем просто запись, и
    // человек видит, что его услышали.
    speaking: current.detector !== null ? current.detector.speaking : true,
    // Сколько фраз ждут отправки — их забирает клиент.
    pending: current.phrases.length,
    dropped: current.dropped,
    // Гистограмма голоса. Значения округлены до сотых: по проводу они идут
    // каждые 50 мс, и точность до тысячных тут никому ничего не даёт.
    bands: current.bands.map((value) => Math.round(value * 100) / 100),
  }
}

/**
 * Забирает следующую готовую фразу и оборачивает её в WAV.
 *
 * Фразы нарезаны детектором речи, поэтому в WAV попадает только речь: тишина
 * между фразами не тащится в модель распознавания и не занимает её время.
 *
 * @returns {{wav: Buffer, durationMs: number}|null} фраза либо null.
 */
export function takePhrase() {
  if (current === null || current.phrases.length === 0) return null
  const phrase = current.phrases.shift()
  return { wav: wrapWav(phrase.pcm), durationMs: phrase.durationMs }
}

/**
 * Удаляет временный файл записи.
 *
 * @param {string} file - путь.
 * @returns {void}
 */
function cleanup(file) {
  try {
    rmSync(file, { force: true })
  } catch {
    // Файл уже удалён или занят — это не повод проваливать выключение.
  }
}