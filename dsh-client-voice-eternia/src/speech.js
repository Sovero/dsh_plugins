// Синтез речи на стороне хоста.
//
// Зачем голос на хосте, а не в странице. Плагину нужно, чтобы ответ агента
// звучал, когда человек говорит, а не когда он переключился на вкладку с
// прочим. Голос Windows (SAPI) даётся бесплатно, работает локально и не ждёт
// сети: задержка до звука — десятки миллисекунд, а не секунды округления до
// облака. Для разговора разница между этими двумя величинами — разница между
// разговором и роботом.
//
// Текст передаётся файлом, а не аргументом командной строки. Причина простая:
// ответ агента может содержать кавычки, обратные слэши, `$` и переносы строк,
// и всё это в командной строке ломается — причём молча, а голос просто не
// звучит.

import { spawn, execFile } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

/** Каталог для временных файлов озвучки. */
const WORK_DIR = join(tmpdir(), 'dsh-voice-eternia')

/**
 * Оболочки, пробуем по очереди.
 *
 * `pwsh` — PowerShell 7; на Windows с установленным Desktop Runtime в нём
 * есть System.Speech. `powershell` — Windows PowerShell 5.1, где SAPI есть
 * всегда. Порядок не случаен: 5.1 надёжнее, но новее может стоять там же, где
 * его поставили, и не искаться в PATH так же надёжно.
 *
 * @type {readonly string[]}
 */
const SHELLS = ['powershell.exe', 'pwsh.exe']

/** Текущий говорящий процесс, если он живой. */
let speaker = null

/**
 * Перечисляет доступные голоса.
 *
 * Нужно, чтобы человек выбрал голос, а не угадывал его имя: без списка поле
 * настройки превратилось бы в требование знать внутренние имена SAPI.
 *
 * @returns {Promise<Array<{name: string, culture: string}>>} голоса.
 */
export async function listVoices() {
  // Голоса возвращаются готовым JSON, а не строками через разделитель.
  // Разделитель — ловушка: экранирование PowerShell («\t» в двойных кавычках
  // не значит табуляцию, а оболочка на Windows и PowerShellCore ведут себя
  // тут по-разному) однажды склеил имя голоса с культурой, и выбор голоса
  // стал бы падать на несуществующем имени.
  const script = [
    'Add-Type -AssemblyName System.Speech',
    '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
    '@($s.GetInstalledVoices() | Where-Object { $_.Enabled } | ForEach-Object {',
    '  [PSCustomObject]@{ name = $_.VoiceInfo.Name; culture = $_.VoiceInfo.Culture.Name }',
    '}) | ConvertTo-Json -Compress',
  ].join('; ')

  for (const shell of SHELLS) {
    const output = await tryRun(shell, script)
    if (output === null) continue
    const trimmed = output.trim()
    if (trimmed === '') continue
    let parsed
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      // Не JSON — этот отклик не годится, пробуем следующую оболочку.
      continue
    }
    const list = Array.isArray(parsed) ? parsed : [parsed]
    const voices = []
    for (const item of list) {
      if (item === null || typeof item !== 'object') continue
      const name = typeof item.name === 'string' ? item.name.trim() : ''
      if (name === '') continue
      voices.push({ name, culture: typeof item.culture === 'string' ? item.culture.trim() : '' })
    }
    if (voices.length > 0) return voices
  }
  return []
}

/**
 * Выполняет команду оболочки и возвращает вывод.
 *
 * @param {string} shell - имя оболочки.
 * @param {string} script - код PowerShell.
 * @returns {Promise<string|null>} вывод либо null, если оболочка не годится.
 */
function tryRun(shell, script) {
  return new Promise((resolve) => {
    execFile(shell, ['-NoProfile', '-NonInteractive', '-Command', script],
      { timeout: 8000, windowsHide: true, maxBuffer: 1 << 20 },
      (error, stdout, stderr) => {
        if (error !== null && stdout === '') {
          resolve(stderr === '' ? null : stderr)
          return
        }
        resolve(`${stdout}`)
      })
  })
}

/**
 * Разговаривает текстом вслух.
 *
 * Новый вызов прерывает предыдущий: в разговоре человек не должен слушать
 * два голоса сразу, а начало нового ответа означает, что старый уже не нужен.
 *
 * @param {object} options - параметры.
 * @param {string} options.text - что сказать.
 * @param {string} [options.voice] - имя голоса из списка.
 * @param {number} [options.rate] - скорость, -10..10.
 * @param {number} [options.volume] - громкость, 0..100.
 * @returns {{ok: boolean, reason?: string}} что вышло.
 */
export function speak({ text, voice, rate, volume } = {}) {
  const clean = typeof text === 'string' ? text.trim() : ''
  if (clean === '') return { ok: false, reason: 'empty' }
  if (speaker !== null) stopSpeaking()

  mkdirSync(WORK_DIR, { recursive: true })
  const file = join(WORK_DIR, `say-${randomUUID()}.txt`)
  // BOM обязателен: без него PowerShell 5.1 читает кириллицу как мусор и
  // голос произносит вместо фразы набор непонятных слов.
  writeFileSync(file, `﻿${clean}`, 'utf8')

  // Голос и темп вставляются в код оболочки, поэтому вставляем безопасные
  // значения, а не то, что прислал человек.
  const voiceName = String(voice ?? '').replace(/[^A-Za-z0-9 ._-]/g, '')
  const rateValue = clampNumber(rate, -10, 10, 0)
  const volumeValue = clampNumber(volume, 0, 100, 100)

  const script = [
    'Add-Type -AssemblyName System.Speech',
    `$t = [System.IO.File]::ReadAllText('${file.replace(/'/g, "''")}')`,
    '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
    voiceName === '' ? '' : `try { $s.SelectVoice('${voiceName}') } catch { }`,
    `$s.Rate = ${rateValue}`,
    `$s.Volume = ${volumeValue}`,
    '$s.Speak($t)',
  ].filter((part) => part !== '').join('; ')

  const shell = SHELLS[0]
  const child = spawn(shell, ['-NoProfile', '-NonInteractive', '-Command', script],
    { windowsHide: true, stdio: 'ignore' })
  speaker = child

  const cleanup = () => {
    if (speaker === child) speaker = null
    try {
      rmSync(file, { force: true })
    } catch {
      // Временный файл не удалился — это не повод прерывать разговор.
    }
  }
  child.once('exit', cleanup)
  child.once('error', cleanup)
  return { ok: true }
}

/**
 * Останавливает текущую озвучку.
 *
 * @returns {void}
 */
export function stopSpeaking() {
  const child = speaker
  speaker = null
  if (child === null || child.killed === true) return
  try {
    child.kill('SIGINT')
  } catch {
    // Процесс уже мёртв.
  }
  if (process.platform !== 'win32') return
  try {
    spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'],
      { windowsHide: true, stdio: 'ignore' })
  } catch {
    // taskkill может отсутствовать; закрытие оболочки уже отправлено.
  }
}

/**
 * Ограничивает число диапазоном.
 *
 * @param {unknown} value - исходное значение.
 * @param {number} min - нижняя граница.
 * @param {number} max - верхняя граница.
 * @param {number} fallback - значение по умолчанию.
 * @returns {number} число в диапазоне.
 */
function clampNumber(value, min, max, fallback) {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.max(min, Math.min(max, Math.round(number)))
}