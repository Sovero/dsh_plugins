// Кнопка микрофона: диктовка на панели ввода.
//
// Место в слоте `conversation.input.right` — список компактных контролов перед
// кнопкой отправки. Свой `id` обязателен: слот листовой, и повтор чужого id
// заменил бы соседа вместо добавления новой кнопки.
//
// Текст вставляется через `inputActions.insertText`, а НЕ `setDraft`: вставка
// ложится ровно в позицию каретки и не трогает ссылки-чипы (`@файл`), которые
// `setDraft` разворачивает простым текстом, уничтожая их. По той же причине
// запись, сделанная поверх уже набранного, не вставляется автоматически: текст
// появляется карточкой, где решение принимает человек.

import { CLASSES } from './theme.css.js'
import { Recording, probeSupport, describeFailure, classifyFailureMessage, isDesktopShell } from './recorder.js'
import { transcribe, polish, readEnvironment, readConfig } from './api.js'
import { defaultTranslate } from './locales.js'

/** Ключ ячейки слота. Менять нельзя: по нему владелец обращается к кнопке. */
export const SLOT_ID = 'voice-eternia-dictate'

/** Позиция в слоте. `workbuddy-probe` занял 10 — встаём после него. */
export const SLOT_ORDER = 20

/** Иконка микрофона. */
function MicIcon() {
  return React.createElement('svg', {
    width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
    'aria-hidden': 'true',
  },
    React.createElement('path', { d: 'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z' }),
    React.createElement('path', { d: 'M19 10v2a7 7 0 0 1-14 0v-2' }),
    React.createElement('line', { x1: 12, y1: 19, x2: 12, y2: 22 }),
  )
}

/**
 * Кнопка диктовки со своей машиной состояний.
 *
 * Позиция каретки снимается ДО старта записи: во время диктовки пользователь
 * вправе двигать курсор, и вернуть его после — уже некуда. Вставка идёт туда,
 * где стоял каретка, поэтому не затирает то, что напечатано позже.
 *
 * @param {object} props - пропсы слота.
 * @returns {object} элемент React.
 */
export function DictateButton({ inputActions, currentModel, t: translate }) {
  // Рантайм передаёт `t`, когда ячейка объявила `locale`. Если по какой-то
  // причине не передал (старая ревизия слота, ручной вызов из теста),
  // откатываемся на русский словарь: сырые ключи в интерфейсе недопустимы.
  const t = typeof translate === 'function' ? translate : defaultTranslate
  const [phase, setPhase] = React.useState('idle')
  const [message, setMessage] = React.useState('')
  const [level, setLevel] = React.useState(0)
  const [pending, setPending] = React.useState('')
  const [browserUrl, setBrowserUrl] = React.useState('')
  // По умолчанию вставка автоматическая: человек сказал — текст встал. Карточка
  // с кнопками требовала бы подтверждения, которого он не просил.
  const [confirmOnInsert, setConfirmOnInsert] = React.useState(false)
  const recording = React.useRef(null)
  const span = React.useRef(null)
  const generation = React.useRef(0)
  const mounted = React.useRef(true)

  React.useEffect(() => () => {
    mounted.current = false
    generation.current += 1
    if (recording.current !== null) recording.current.dispose()
  }, [])

  // Настройки приходят маршрутом хоста: единственный источник правды о том,
  // показывать ли запасной путь через браузер и вставлять ли автоматически.
  // Запрашиваем один раз и только в оболочке Electron: в браузере браузерный
  // адрес не нужен, а лишний запрос при каждом монтировании панели ввода — шум
  // в логах хоста.
  const [showBrowserFallback, setShowBrowserFallback] = React.useState(false)
  React.useEffect(() => {
    if (!isDesktopShell()) return
    let alive = true
    void readConfig().then((config) => {
      if (!alive || !mounted.current || config === null) return
      if (typeof config.ui?.showBrowserFallback === 'boolean') {
        setShowBrowserFallback(config.ui.showBrowserFallback)
      }
      if (typeof config.insert?.confirmOnInsert === 'boolean') {
        setConfirmOnInsert(config.insert.confirmOnInsert)
      }
    })
    return () => { alive = false }
  }, [])

  // Адрес браузерной версии того же GUI нужен только вместе с переключателем
  // выше: без него полоса отказа остаётся пустой и лишней строкой.
  React.useEffect(() => {
    if (!isDesktopShell()) return
    let alive = true
    void readEnvironment().then((env) => {
      if (alive && mounted.current && env !== null && env.webUrl !== '') setBrowserUrl(env.webUrl)
    })
    return () => { alive = false }
  }, [])

  /** Возвращает интерфейс в исходное состояние и глушит запись. */
  const reset = () => {
    generation.current += 1
    if (recording.current !== null) {
      recording.current.dispose()
      recording.current = null
    }
    setPhase('idle')
    setMessage('')
    setLevel(0)
  }

  /** Отменяет запись и не показывает результата. */
  const cancel = () => {
    const active = recording.current
    recording.current = null
    if (active !== null) active.dispose()
    generation.current += 1
    setPhase('idle')
    setMessage('')
    setLevel(0)
    setPending('')
  }

  /** Отдаёт распознанный текст в позицию, занятую до старта записи. */
  const deliver = (text) => {
    // Человек просил подтверждения — не вставляем сами, показываем текст.
    if (confirmOnInsert === true) {
      setPending(text)
      setPhase('result')
      return
    }
    const captured = span.current
    if (captured === null) {
      setPending(text)
      setPhase('result')
      setMessage(t('error.noInputField'))
      return
    }
    const placed = inputActions.insertText(text, captured)
    if (placed) {
      reset()
      return
    }
    // Вставка отклонена: вероятно, черновик изменился (пользователь что-то
    // напечатал). Текст НЕ теряем и НЕ вставляем силой — показываем его в
    // полоске, откуда его можно скопировать одним кликом.
    setPending(text)
    setPhase('result')
    setMessage(t('error.insertRejected'))
  }

  /** Останавливает запись, распознаёт и вставляет текст. */
  const finish = async () => {
    const active = recording.current
    if (active === null) return
    const run = generation.current
    setPhase('busy')
    setMessage(t('status.recognizing'))
    try {
      // Запись ведёт хост и отдаёт готовый WAV в base64 — перекодировать его в
      // странице незачем: хост уже пишет 16 кГц mono, ровно то, что ждёт модель.
      const answer = await active.stop()
      recording.current = null
      if (!mounted.current || run !== generation.current) return
      const result = await transcribe({ audioBase64: answer.audioBase64 })
      if (!mounted.current || run !== generation.current) return
      if (result.ok !== true) {
        setPhase('error')
        setMessage(result.error?.message ?? t('error.transcribeFailed'))
        return
      }
      if (result.empty === true || result.text === '') {
        setPhase('error')
        setMessage(t('error.emptySpeech'))
        return
      }
      // Полирует та же модель, на которой идёт разговор: отдельной настройки
      // для неё нет намеренно. Не удалось узнать — передаём пусто, и хост берёт
      // модель из своих настроек.
      const model = typeof currentModel === 'function' ? currentModel() : null
      const polished = await polish(model === null
        ? { text: result.text }
        : { text: result.text, model: model.model, provider: model.provider })
      if (!mounted.current || run !== generation.current) return
      deliver(polished.ok === true && polished.text !== '' ? polished.text : result.text)
    } catch (failure) {
      if (!mounted.current || run !== generation.current) return
      recording.current = null
      setPhase('error')
      setMessage(classifyFailureMessage(failure, t))
    }
  }

  /** Запрашивает микрофон и начинает запись. */
  const start = async () => {
    if (phase !== 'idle' && phase !== 'error') return

    // Обработчик зовёт start через void, поэтому исключение уходит в консоль,
    // а интерфейс выглядит как «кнопка не нажимается». Весь путь до первого
    // setState обязан быть под защитой: иначе любой отказ — хоть отсутствие
    // inputActions, хоть сбой проверки среды — останется невидимым.
    let support
    try {
      support = probeSupport()
    } catch (error) {
      setPhase('error')
      setMessage(t('error.probeFailed', { message: describeFailure(error).message }))
      return
    }
    if (!support.available) {
      setPhase('error')
      setMessage(t('error.unsupported'))
      return
    }

    // Проп слота может не прийти: тогда вставлять текст некуда, и честнее
    // сказать об этом прямо, чем молча записать и потерять результат.
    if (inputActions === undefined || typeof inputActions.captureInsertion !== 'function') {
      setPhase('error')
      setMessage(t('error.noInputActions'))
      return
    }

    try {
      // Позицию текущей каретки запоминаем заранее: за время записи каретка
      // уедет, и вернуть её после — некуда.
      span.current = inputActions.captureInsertion()
    } catch (error) {
      setPhase('error')
      setMessage(t('error.noSpan', { message: describeFailure(error).message }))
      return
    }

    let active
    try {
      active = new Recording()
    } catch (error) {
      setPhase('error')
      setMessage(t('error.noRecording', { message: describeFailure(error).message }))
      return
    }

    recording.current = active
    setMessage('')
    setPending('')
    setLevel(0)
    setPhase('requesting')
    try {
      await active.start({
        onLevel: (value) => {
          if (mounted.current && recording.current === active) setLevel(value)
        },
        onFailure: (kind, text) => {
          if (!mounted.current || recording.current !== active) return
          recording.current = null
          active.dispose()
          setPhase('error')
          setMessage(text)
        },
      })
      if (!mounted.current || recording.current !== active) return
      setPhase('recording')
    } catch (failure) {
      recording.current = null
      active.dispose()
      setPhase('error')
      setMessage(classifyFailureMessage(failure, t))
    }
  }

  const busy = phase === 'busy'
  const active = phase === 'recording' || phase === 'requesting'

  // Микрофон — единственный орган управления. Нажал: запись пошла. Нажал
  // ещё раз: запись кончилась и текст встал в поле. Нажал, когда полоска уже
  // открыта с ошибкой или готовым текстом: полоска просто закрылась.
  //
  // Отдельных кнопок «Готово» и «Отмена» нет намеренно: они дублировали одну
  // и ту же кнопку и предлагали человеку выбор, которого он не делал. Решение
  // всегда одно — сказать или не сказать.
  const open = phase !== 'idle'

  const button = React.createElement('button', {
    type: 'button',
    className: CLASSES.button,
    'data-recording': active ? 'true' : 'false',
    'data-open': open ? 'true' : 'false',
    disabled: busy,
    title: t(busy ? 'title.busy' : 'title.idle'),
    'aria-label': t('dictate'),
    'aria-pressed': open ? 'true' : 'false',
    onClick: () => {
      if (busy) return
      if (active) {
        void finish()
        return
      }
      // Полоска открыта, но запись не идёт: это ошибка или готовый текст.
      // Повторное нажатие закрывает её, не начиная новую запись.
      if (open) {
        cancel()
        return
      }
      void start()
    },
  }, React.createElement(MicIcon))

  if (phase === 'idle') return button

  const statusText = phase === 'requesting'
    ? t('status.requesting')
    : phase === 'recording'
      ? t('status.recording')
      : phase === 'busy'
        ? t('status.recognizing')
        : phase === 'error'
          ? t('status.unavailable')
          : t('status.inserted')

  const children = [
    React.createElement('div', { className: CLASSES.status, key: 'status' },
      React.createElement('span', { className: CLASSES.dot, 'aria-hidden': 'true' }),
      React.createElement('span', null, statusText),
    ),
  ]

  if (phase === 'recording') {
    children.push(React.createElement('div', {
      className: CLASSES.meter,
      key: 'meter',
      role: 'progressbar',
      'aria-label': t('meter.label'),
      'aria-valuemin': 0,
      'aria-valuemax': 100,
      'aria-valuenow': Math.round(level * 100),
    }, React.createElement('div', {
      className: CLASSES.meterFill,
      style: { '--vet-level': `${Math.round(level * 100)}%` },
    })))
  }

  // Распознанный текст, который не вставлен сам. Полоса объявлена кнопкой:
  // она копирует текст по клику, поэтому недоступная по клавиатуре полоса
  // обманывала бы и скринридер, и того, кто печатает не мышью.
  if (phase === 'result' && pending !== '') {
    const copy = () => {
      void navigator.clipboard?.writeText(pending).catch(() => {})
      setMessage(t('notice.copiedText'))
    }
    children.push(React.createElement('div', {
      key: 'pending',
      className: CLASSES.result,
      role: 'button',
      tabIndex: 0,
      title: t('result.copyHint'),
      onClick: copy,
      onKeyDown: (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        // Без preventDefault пробел прокрутит страницу, и человек потеряет
        // позицию в разговоре, а не просто не скопирует текст.
        event.preventDefault()
        copy()
      },
    }, React.createElement('p', { className: CLASSES.resultText }, pending)))
    if (message !== '') {
      children.push(React.createElement('p', { className: CLASSES.error, key: 'error', role: 'alert' }, message))
    }
  }

  if (phase === 'error') {
    children.push(React.createElement('p', { className: CLASSES.error, key: 'error', role: 'alert' }, message))
    // Браузер — запасной путь, а не кнопка записи. Показываем его только если
    // человек сам оставил переключатель: по умолчанию микрофон берёт хост, и
    // лишняя кнопка в полоске только мешает.
    if (showBrowserFallback && browserUrl !== '') {
      children.push(React.createElement('code', { className: CLASSES.address, key: 'address' }, browserUrl))
    }
  }

  children.push(React.createElement('p', { className: CLASSES.hint, key: 'hint' },
    phase === 'error' || phase === 'result' ? t('hint.close') : t('hint.toggle')))


  // Панель — полоска без кнопок. Всё управление живёт на самом микрофоне:
  // нажал — пишет, нажал ещё раз — закончило.
  const panel = React.createElement('div', {
    key: 'panel-wrap',
    style: { position: 'absolute', bottom: '100%', right: 0, width: 'min(420px, 90vw)', marginBottom: 6, zIndex: 40 },
  }, React.createElement('div', {
    className: CLASSES.panel,
    'data-state': phase === 'recording' || phase === 'requesting' ? 'recording' : phase === 'error' ? 'error' : 'busy',
    role: 'status',
    'aria-label': t('dictate'),
    'aria-live': 'polite',
  }, ...children))

  return React.createElement('span', {
    style: { position: 'relative', display: 'inline-flex' },
  }, button, panel)
}