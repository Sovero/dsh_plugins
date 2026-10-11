// Чистые функции «Пульса»: подпись шага и запись времени. Без обращений к движку —
// их проверяет тест.

/** Сколько длится шаг, после которого о его конце сообщается отдельно. */
export const LONG_MS = 60_000

/** Сколько последних шагов помнит панель. */
export const KEPT = 12

/** «4:07» из миллисекунд; час и больше — «1:04:07». */
export function span(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = String(total % 60).padStart(2, '0')

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${minutes}:${seconds}`
}

function short(text: string, limit: number): string {
  const line = text.replace(/\s+/g, ' ').trim()

  return line.length > limit ? `${line.slice(0, limit - 1)}…` : line
}

function fileName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path
}

/**
 * Что делает шаг, одной короткой строкой: у команды — её описание или начало,
 * у работы с файлом — имя файла, у остального — название инструмента.
 */
export function label(tool: string, input: Record<string, unknown>): string {
  const pick = (key: string): string | undefined =>
    typeof input[key] === 'string' && input[key] !== '' ? String(input[key]) : undefined
  const about = pick('description') ?? pick('command') ?? pick('pattern') ?? pick('query') ?? pick('prompt')
  const file = pick('file_path') ?? pick('path')

  if (about !== undefined) {
    return `${tool} · ${short(about, 56)}`
  }

  return file !== undefined ? `${tool} · ${short(fileName(file), 56)}` : tool
}

export type Running = { label: string; startedAt: number }

/**
 * Строка состояния: самый давний из идущих шагов и сколько их ещё; между шагами —
 * сколько длится ход; когда ничего не идёт — ничего.
 */
export function line(running: readonly Running[], turnStartedAt: number, now: number): string | undefined {
  if (running.length > 0) {
    const oldest = running.reduce((a, b) => (a.startedAt <= b.startedAt ? a : b))
    const more = running.length > 1 ? ` · ещё ${running.length - 1}` : ''

    return `⏵ ${oldest.label} · ${span(now - oldest.startedAt)}${more}`
  }

  return turnStartedAt > 0 ? `… думаю · ход ${span(now - turnStartedAt)}` : undefined
}
