// Чистые функции «Курса»: строки приоритетов и правил проекта, их правка и то,
// как они читаются человеком (полоса) и моделью (раздел системного запроса).

/** Сколько строк держит курс и какой длины строка: курс — памятка, а не документ. */
export const MAX_LINES = 12
export const MAX_LENGTH = 200

/** Строка курса без лишних пробелов и переводов строки, не длиннее предела. */
export function clean(line: string): string {
  return line.replace(/\s+/g, ' ').trim().slice(0, MAX_LENGTH)
}

/** Строки из хранилища: только непустые строки, без повторов, не больше предела. */
export function sanitize(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return []
  }

  const lines: string[] = []

  for (const item of raw) {
    const line = typeof item === 'string' ? clean(item) : ''

    if (line !== '' && !lines.includes(line)) {
      lines.push(line)
    }
  }

  return lines.slice(0, MAX_LINES)
}

/** Курс с новой строкой в конце; пустая, повторная или лишняя сверх предела не добавляется. */
export function add(lines: readonly string[], line: string): string[] {
  const next = clean(line)

  if (next === '' || lines.includes(next) || lines.length >= MAX_LINES) {
    return [...lines]
  }

  return [...lines, next]
}

/** Курс без строки с номером index; номера вне списка ничего не убирают. */
export function remove(lines: readonly string[], index: number): string[] {
  return lines.filter((_, at) => at !== index)
}

/** Ключ хранилища: у каждого проекта (папки) свой курс. */
export function storeKey(cwd: string): string {
  return `lines:${cwd.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()}`
}

/** Раздел системного запроса: что модель читает в начале каждой сессии. */
export function section(lines: readonly string[]): string {
  return [
    'Курс проекта — приоритеты и правила, которые задал владелец проекта. Они действуют во всей сессии:',
    ...lines.map(line => `- ${line}`),
    'Прежде чем выбрать, чем заняться дальше, сверься с этим списком. Если просьба расходится с ним, скажи об этом одной фразой.',
  ].join('\n')
}

/** Полоса над полем ввода: первая строка курса и сколько ещё, в заданную ширину. */
export function band(lines: readonly string[], columns: number): string {
  if (lines.length === 0) {
    return ''
  }

  const more = lines.length > 1 ? ` · ещё ${lines.length - 1}` : ''
  const room = Math.max(12, columns - 'Курс: '.length - more.length - 14)
  const first = lines[0] ?? ''

  return `Курс: ${first.length > room ? `${first.slice(0, room - 1)}…` : first}${more}`
}
