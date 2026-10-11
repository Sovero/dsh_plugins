// Кнопки «Далее»: что написано на кнопке и что она отправляет от имени человека.
// Меняются здесь; после правки — /reload-plugins.

export type Step = { key: string; label: string; text: string }

export const STEPS: readonly Step[] = [
  { key: 'go', label: 'Далее', text: 'Далее: продолжай со следующего шага плана.' },
  { key: 'run', label: 'Запусти', text: 'Запусти проект, чтобы я посмотрел результат своими глазами.' },
  { key: 'commit', label: 'Закоммить', text: 'Закоммить сделанное локально, без пуша.' },
]

/** Шаг по ключу кнопки; неизвестный ключ — undefined. */
export function stepOf(key: string): Step | undefined {
  return STEPS.find(step => step.key === key)
}

/** Показывать ли полосу: ход закончен, человек её не скрыл, и поверх нет опроса. */
export function isShown(isIdle: boolean, isHidden: boolean, hasSurvey: boolean): boolean {
  return isIdle && !isHidden && !hasSurvey
}
