// Кнопка разговора: отдельная ячейка рядом с микрофоном.
//
// Почему отдельная кнопка, а не переключатель в настройках. Раньше кнопка была
// одна, и что именно произойдёт по нажатию, решала настройка «Отправлять
// сразу». Человек этого не видит: он нажимает микрофон, ожидая диктовку, а
// начинается беседа — или наоборот, и тогда его слова уходят в поле ввода,
// хотя он ждал ответа. Две кнопки убирают догадку: микрофон — диктовка,
// вторая кнопка — разговор. Режим виден до нажатия, а не после.
//
// Место в слоте то же, рядом с микрофоном: `conversation.input.right`.

import { CLASSES } from './theme.css.js'
import { Talk } from './talk.js'
import { ReplyWatcher, CHAT_REGION } from './echo.js'
import { transcribe, readConfig } from './api.js'
import { defaultTranslate } from './locales.js'
import { classifyFailureMessage } from './recorder.js'
import { useActiveLocale } from './index.js'

/** Ключ ячейки. Отличается от ключа микрофона: это другая кнопка. */
export const TALK_SLOT_ID = 'voice-eternia-talk'

/** Позиция в слоте: сразу после микрофона (`voice-eternia-dictate`, order 20). */
export const TALK_SLOT_ORDER = 21

/**
 * Иконка разговора: микрофон, от которого расходятся звуковые волны.
 *
 * Отличается от иконки микрофона нарочно. Две одинаковые иконки рядом человек
 * не различит, и кнопки снова станут загадкой — только теперь их две.
 *
 * @returns {object} элемент React.
 */
function TalkIcon() {
  return React.createElement('svg', {
    width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
    'aria-hidden': 'true',
  },
    React.createElement('path', { d: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z' }),
    React.createElement('path', { d: 'M6.5 11a5.5 5.5 0 0 0 11 0' }),
    React.createElement('line', { x1: 12, y1: 16.5, x2: 12, y2: 20 }),
    React.createElement('path', { d: 'M3 8.5a3 3 0 0 0 0 5' }),
    React.createElement('path', { d: 'M21 8.5a3 3 0 0 1 0 5' }),
  )
}

/**
 * Кнопка разговора.
 *
 * Нажатие начинает слушать и отправлять фразы в беседу; повторное — заканчивает.
 * Ответ агента читается вслух, если это разрешено в настройках.
 *
 * @param {object} props - свойства ячейки слота.
 * @param {object} props.inputActions - действия поля ввода: черновик и отправка.
 * @param {(key: string, vars?: object) => string} [props.t] - переводчик.
 * @returns {object} элемент React.
 */
export function TalkButton({ inputActions, t: translate }) {
  const React = require('react')
  const t = typeof translate === 'function' ? translate : defaultTranslate
  // Смена языка интерфейса обязана перерисовать кнопку вместе с её подписью.
  useActiveLocale()
  const mounted = React.useRef(true)
  const talk = React.useRef(null)
  const watcher = React.useRef(null)
  const [phase, setPhase] = React.useState('idle')
  const [bands, setBands] = React.useState([])
  const [speaking, setSpeaking] = React.useState(false)
  const [talking, setTalking] = React.useState(false)
  const [message, setMessage] = React.useState('')
  const [settings, setSettings] = React.useState(null)

  React.useEffect(() => {
    mounted.current = true
    let alive = true
    void readConfig().then((config) => {
      if (!alive || !mounted.current || config === null) return
      setSettings(config)
    })
    return () => {
      alive = false
      mounted.current = false
      if (watcher.current !== null) watcher.current.stop()
      if (talk.current !== null) talk.current.dispose()
    }
  }, [])

  /** Начинает разговор. */
  const start = async () => {
    if (talk.current !== null) return
    setMessage('')
    setBands([])
    setPhase('requesting')
    const active = new Talk({
      settings: settings ?? {},
      // Отправка в беседу: черновик и отправка. Именно эта пара действий, а не
      // вставка в поле, отличает разговор от диктовки.
      onSend: (text) => {
        if (mounted.current === false) return
        try {
          inputActions.setDraft(text)
          inputActions.submit()
          setMessage(t('status.sent'))
        } catch {
          setMessage(t('error.noSpan'))
        }
      },
      onBands: (edges) => { if (mounted.current) setBands(edges) },
      onState: (state) => {
        if (mounted.current === false) return
        setSpeaking(state.speaking === true)
        setTalking(state.talking === true)
        // Фаза разговора приходит из Talk: слушаю / распознаю / отвечаю.
        setPhase(state.phase === 'recognizing' ? 'recognizing' : 'listening')
      },
      onFailure: (kind, text) => {
        if (!mounted.current) return
        if (kind === 'ended') {
          talk.current?.dispose()
          talk.current = null
          setPhase('idle')
          setMessage(t('status.closed'))
          return
        }
        setMessage(text)
      },
      // Распознавание тем же маршрутом, что и у диктовки: разговор отличается
      // отправкой, а не моделью.
      recognize: async (audioBase64) => {
        const recognized = await transcribe({ audioBase64 })
        return recognized.ok === true && typeof recognized.text === 'string' ? recognized.text : ''
      },
    })
    talk.current = active
    try {
      await active.start()
      if (!mounted.current || talk.current !== active) {
        active.dispose()
        return
      }
      setPhase('listening')
      // Наблюдатель за ответом. Если области чата ещё нет в документе, он
      // честно скажет об этом: молчащая кнопка хуже кнопки с объяснением.
      const replyWatcher = new ReplyWatcher({
        onReply: (text) => { void active.say(text) },
      })
      if (replyWatcher.start()) {
        watcher.current = replyWatcher
      } else {
        setMessage(t('error.noChatRegion'))
      }
    } catch (failure) {
      active.dispose()
      talk.current = null
      setPhase('error')
      setMessage(classifyFailureMessage(failure, t))
    }
  }

  /** Заканчивает разговор. */
  const stop = async () => {
    const active = talk.current
    talk.current = null
    if (watcher.current !== null) {
      watcher.current.stop()
      watcher.current = null
    }
    if (active !== null) await active.stop()
    setPhase('idle')
    setSpeaking(false)
    setTalking(false)
    setBands([])
    setMessage(t('status.closed'))
  }

  const open = phase !== 'idle'
  const busy = phase === 'requesting'
  const button = React.createElement('button', {
    type: 'button',
    className: CLASSES.button,
    'data-recording': phase === 'listening' ? 'true' : 'false',
    'data-open': open ? 'true' : 'false',
    'data-converse': 'true',
    disabled: busy,
    title: t(busy ? 'title.busy' : 'title.talk'),
    'aria-label': t('talk'),
    'aria-pressed': open ? 'true' : 'false',
    onClick: () => {
      if (busy) return
      if (open) void stop()
      else void start()
    },
  }, React.createElement(TalkIcon))

  if (phase !== 'listening') {
    // Полоса появляется только при разговоре: в покое кнопка не занимает место
    // и не мешает соседям по панели ввода.
    return button
  }

  const status = phase === 'recognizing'
    ? t('status.recognizing')
    : talking === true
      ? t('status.answering')
      : (speaking === true ? t('status.hearing') : t('status.waiting'))

  return React.createElement('span', {
    // Панель обязана быть absolute и висеть НАД кнопкой. В потоке она растянула
    // бы ячейку слота на всю ширину панели ввода и накрыла соседей — в том числе
    // микрофон, по которому после этого нельзя щёлкнуть: клик попадал в чужую
    // панель. Ровно так и выглядела жалоба «кнопка микрофона не нажимается».
    style: { position: 'relative', display: 'inline-flex' },
  },
    button,
    React.createElement('div', {
      key: 'panel-wrap',
      style: {
        position: 'absolute',
        bottom: '100%',
        right: 0,
        width: 'min(360px, 90vw)',
        marginBottom: 6,
        zIndex: 40,
      },
    }, React.createElement('div', {
      className: CLASSES.panel,
      'data-state': 'listening',
      role: 'status',
      'aria-label': t('talk'),
      'aria-live': 'polite',
    },
      React.createElement('div', { className: CLASSES.status },
        React.createElement('span', { className: CLASSES.dot, 'aria-hidden': 'true' }),
        React.createElement('span', null, status),
      ),
      Array.isArray(bands) && bands.length > 0
        ? React.createElement('div', {
          className: CLASSES.histo,
          role: 'img',
          'aria-label': t('histo.label'),
        }, bands.map((value, index) => React.createElement('span', {
          key: index,
          className: CLASSES.histoBar,
          style: { '--vet-band': `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` },
        })))
        : null,
      message === '' ? null : React.createElement('p', { className: CLASSES.hint }, message),
      React.createElement('p', { className: CLASSES.hint }, t('hint.talk')),
    )),
  )
}
