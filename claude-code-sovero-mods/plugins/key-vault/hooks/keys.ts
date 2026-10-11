// Чистые функции «Ключа в сейф»: как узнать ключ в тексте и чем его заменить.
// Без обращений к движку — их проверяет тест.

/**
 * Виды ключей, которые мод узнаёт в сообщении. Только то, что почти наверняка
 * секрет: у каждого вида свой характерный зачин и достаточная длина.
 */
const PATTERNS: readonly RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{20,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{30,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{30,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bAIza[0-9A-Za-z_-]{30,}/g,
  /\bxox[abprs]-[A-Za-z0-9-]{16,}/g,
  /\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}/g,
]

export const ANSWER_STORE = 'Убрать в хранилище'
export const ANSWER_SEND = 'Отправить как есть'
export const ANSWER_DROP = 'Не отправлять'

/** Ключи в тексте, без повторов, в порядке появления. */
export function findKeys(text: string): string[] {
  const found: { at: number; key: string }[] = []

  for (const pattern of PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      if (!found.some(one => one.key === match[0])) {
        found.push({ at: match.index ?? 0, key: match[0] })
      }
    }
  }

  return found.sort((a, b) => a.at - b.at).map(one => one.key)
}

/** Ключ для показа человеку: начало и конец, середина скрыта. */
export function masked(key: string): string {
  return key.length <= 10 ? '…' : `${key.slice(0, 5)}…${key.slice(-3)}`
}

/** Имя файла хранилища для ключа номер index, сохранённого в момент at (мс). */
export function fileName(at: number, index: number): string {
  const stamp = new Date(at).toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)

  return `key-${stamp}-${index + 1}.dpapi`
}

/** Текст сообщения, в котором каждый ключ заменён указанием, где он лежит. */
export function replaced(text: string, places: ReadonlyMap<string, string>): string {
  let next = text

  for (const [key, place] of places) {
    next = next.split(key).join(`[ключ убран в хранилище: ${place}]`)
  }

  return next
}

/**
 * Команда PowerShell, которая читает ключ из стандартного ввода и кладёт его в
 * файл, зашифрованный для этой учётной записи Windows (DPAPI). Ключ не попадает
 * ни в командную строку, ни в открытый файл. Имя файла — только из fileName().
 */
export function storeScript(file: string): string {
  if (!/^key-\d{8}-\d{6}-\d+\.dpapi$/.test(file)) {
    throw new Error('недопустимое имя файла хранилища')
  }

  return [
    '$k = [Console]::In.ReadToEnd().Trim()',
    'if (-not $k) { exit 3 }',
    "$d = Join-Path $env:USERPROFILE '.claude\\key-vault'",
    'New-Item -ItemType Directory -Force $d | Out-Null',
    `$p = Join-Path $d '${file}'`,
    'ConvertTo-SecureString -String $k -AsPlainText -Force | ConvertFrom-SecureString | Set-Content -Encoding ascii $p',
    'Write-Output $p',
  ].join('; ')
}
