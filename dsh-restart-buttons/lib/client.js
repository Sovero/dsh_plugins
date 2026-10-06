/**
 * dsh-restart-buttons — browser half.
 *
 * A hand-written CommonJS-style bundle in the exact shape the DSH client module
 * loader consumes: `window.__ModuleLoader__.load({ id, factory })`, where the
 * factory receives a `require` and returns `{ apply, inject }`.
 *
 * A client plugin whose `apply` THROWS fails the whole web shell boot, so every
 * independent step below is wrapped in its own try/catch that logs and
 * continues. Nothing here is allowed to take the GUI down.
 *
 * The buttons live in the root-scoped list slot `sidebar.footer.action`, beside
 * the shipped Cordis badge and directly above the settings / "More" row.
 */
window.__ModuleLoader__.load({
  id: 'dsh-restart-buttons',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const React = require('react')

    /** Locale namespace owned by this plugin. */
    const NS = 'restart-buttons'

    /** English dictionary — the default UI copy and the fallback. */
    const EN = {
      'button.reload': 'Reload DSH',
      'button.reload.tooltip': 'Reload the DSH interface and reconnect',
      'button.restart': 'Restart app',
      'button.restart.tooltip': 'Quit and relaunch DeepSeek Harness',
      'button.restart.confirm': 'Confirm restart?',
      'button.restart.tooltipConfirm': 'Click again to quit and relaunch the app',
      'button.restart.busy': 'Restarting…',
      'button.restart.failed': 'Restart could not be scheduled',
      'button.restart.disabled': 'Restart is available in the desktop app only',
    }

    /** Chinese dictionary — same key set as {@link EN}, checked by the tests. */
    const ZH = {
      'button.reload': '重新加载 DSH',
      'button.reload.tooltip': '重新加载 DSH 界面并重新连接',
      'button.restart': '重启应用',
      'button.restart.tooltip': '退出并重新启动 DeepSeek Harness',
      'button.restart.confirm': '确认重启？',
      'button.restart.tooltipConfirm': '再次点击以退出并重启应用',
      'button.restart.busy': '正在重启…',
      'button.restart.failed': '无法安排重启',
      'button.restart.disabled': '仅桌面应用支持重启',
    }

    /**
     * Active translator, installed by `apply`.
     *
     * Kept at module scope so the component resolves strings at RENDER time:
     * a language switch changes the labels without re-registering the slot.
     */
    let translate = null

    /** Translate one key through the live locale, falling back to English. */
    function t(key) {
      try {
        if (typeof translate === 'function') {
          const value = translate(key)
          if (typeof value === 'string' && value !== '') return value
        }
      } catch {
        // A locale failure must never break a render.
      }
      return EN[key] ?? key
    }

    /** Duplicate-mount guard: one sidebar entry per page lifetime. */
    let claimed = false

    /** Whether this module instance may mount. First claim wins. */
    function claim() {
      if (claimed) return false
      claimed = true
      return true
    }

    /** Log without ever throwing. */
    function warn(message, detail) {
      try {
        if (detail === undefined) console.warn(`[dsh-restart-buttons] ${message}`)
        else console.warn(`[dsh-restart-buttons] ${message}`, detail)
      } catch {
        // console may be unavailable; that is not a reason to fail.
      }
    }

    /** Base inline style shared by both buttons, matching the sidebar metrics. */
    function buttonStyle(wide) {
      return {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: wide ? 'flex-start' : 'center',
        gap: '6px',
        minWidth: '28px',
        height: '28px',
        padding: wide ? '0 8px' : '0',
        border: '1px solid var(--dsw-alias-border-secondary, rgba(128,128,128,.28))',
        borderRadius: '6px',
        background: 'transparent',
        color: 'inherit',
        cursor: 'pointer',
        font: 'inherit',
        fontSize: '12px',
        lineHeight: '1',
        whiteSpace: 'nowrap',
      }
    }

    /** The reload glyph: a circular arrow. */
    function reloadGlyph() {
      return React.createElement(
        'svg',
        {
          viewBox: '0 0 16 16',
          width: 16,
          height: 16,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: '1.3',
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
          'data-dsh-panel-entry': 'restart-buttons',
        },
        React.createElement('path', { d: 'M13.4 8a5.4 5.4 0 1 1-1.58-3.82' }),
        React.createElement('path', { d: 'M13.4 2.4v3.2h-3.2' }),
      )
    }

    /** The restart glyph: a power symbol. */
    function restartGlyph() {
      return React.createElement(
        'svg',
        {
          viewBox: '0 0 16 16',
          width: 16,
          height: 16,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: '1.3',
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
        },
        React.createElement('path', { d: 'M8 2.2v5.6' }),
        React.createElement('path', { d: 'M4.55 4.3a4.6 4.6 0 1 0 6.9 0' }),
      )
    }

    /**
     * The sidebar-foot action component.
     * @param props - the slot's owner props; `wide` is false in the 56px rail.
     */
    function RestartButtons(props) {
      const wide = props === undefined || props === null ? true : props.wide !== false
      const [armed, setArmed] = React.useState(false)
      const [busy, setBusy] = React.useState(false)
      const [errorText, setErrorText] = React.useState('')
      // Default true until the probe answers, so the button never flash-disables.
      const [restartAvailable, setRestartAvailable] = React.useState(true)
      const timerRef = React.useRef(null)

      // Capability probe: relative URL, because the desktop shell forwards
      // relative requests from its own app origin.
      React.useEffect(() => {
        let cancelled = false
        try {
          fetch('/dsh-restart-buttons/status')
            .then((response) => (response && response.ok ? response.json() : null))
            .then((data) => {
              if (cancelled || data === null || data === undefined) return
              setRestartAvailable(data.electron === true)
            })
            .catch(() => {
              // Keep the default: a failed probe is not proof of absence.
            })
        } catch {
          // fetch may be unavailable in a test sandbox; keep the default.
        }
        return () => {
          cancelled = true
        }
      }, [])

      // Clear the arming timer when the component unmounts.
      React.useEffect(() => () => {
        if (timerRef.current !== null) {
          clearTimeout(timerRef.current)
          timerRef.current = null
        }
      }, [])

      const onReload = (event) => {
        try {
          event.stopPropagation()
        } catch {
          // A synthetic event without stopPropagation is still usable.
        }
        try {
          window.location.reload()
        } catch (reason) {
          warn('reload failed', reason)
        }
      }

      const onRestart = (event) => {
        try {
          event.stopPropagation()
        } catch {
          // Same as above.
        }
        if (busy || !restartAvailable) return

        if (!armed) {
          // First click arms the button for 5 seconds.
          setArmed(true)
          if (timerRef.current !== null) clearTimeout(timerRef.current)
          timerRef.current = setTimeout(() => {
            timerRef.current = null
            setArmed(false)
          }, 5000)
          return
        }

        // Second click fires.
        if (timerRef.current !== null) {
          clearTimeout(timerRef.current)
          timerRef.current = null
        }
        setArmed(false)
        setBusy(true)
        setErrorText('')
        try {
          // The host answers 200 BEFORE any process is killed, so a resolved
          // fetch is the SCHEDULE ACKNOWLEDGEMENT, not the restart itself.
          fetch('/dsh-restart-buttons/restart', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: '{}',
          })
            .then((response) => {
              if (!response || !response.ok) {
                throw new Error(`HTTP ${response === undefined || response === null ? 'none' : String(response.status)}`)
              }
            })
            .catch((reason) => {
              setBusy(false)
              setErrorText(t('button.restart.failed'))
              warn('restart scheduling failed', reason)
            })
        } catch (reason) {
          setBusy(false)
          setErrorText(t('button.restart.failed'))
          warn('restart request threw', reason)
        }
      }

      const reloadLabel = t('button.reload')
      const reloadTooltip = t('button.reload.tooltip')
      const restartLabel = busy
        ? t('button.restart.busy')
        : (armed ? t('button.restart.confirm') : t('button.restart'))
      const restartTooltip = !restartAvailable
        ? t('button.restart.disabled')
        : (errorText !== ''
            ? errorText
            : (busy ? t('button.restart.busy') : (armed ? t('button.restart.tooltipConfirm') : t('button.restart.tooltip'))))

      const reloadStyle = { ...buttonStyle(wide), ...(wide ? {} : { padding: '0' }) }
      const restartStyle = {
        ...buttonStyle(wide),
        ...(armed
          ? { background: 'var(--dsw-alias-state-warning-primary, rgba(214,138,0,.18))' }
          : {}),
        ...(!restartAvailable ? { opacity: '0.5', cursor: 'not-allowed' } : {}),
      }

      const reloadButton = React.createElement(
        'button',
        {
          type: 'button',
          'data-dsh-restart-action': 'reload',
          'aria-label': reloadTooltip,
          title: reloadTooltip,
          style: reloadStyle,
          onClick: onReload,
        },
        reloadGlyph(),
        wide ? React.createElement('span', null, reloadLabel) : null,
      )

      const restartButton = React.createElement(
        'button',
        {
          type: 'button',
          'data-dsh-restart-action': 'restart',
          'aria-label': restartTooltip,
          title: restartTooltip,
          style: restartStyle,
          disabled: !restartAvailable || busy,
          'aria-busy': busy ? 'true' : 'false',
          onClick: onRestart,
        },
        restartGlyph(),
        wide ? React.createElement('span', null, restartLabel) : null,
      )

      return React.createElement(
        'div',
        {
          'data-dsh-plugin': 'restart-buttons',
          style: {
            display: 'flex',
            gap: '4px',
            alignItems: 'center',
            width: '100%',
            justifyContent: wide ? 'flex-start' : 'center',
            color: 'var(--dsw-alias-label-primary)',
          },
        },
        reloadButton,
        restartButton,
      )
    }

    /** The slot service is the only dependency of the browser half. */
    const inject = ['slots']

    /**
     * Mount the sidebar action.
     * @param ctx - client root context (services: slots, locale, effect).
     */
    function apply(ctx) {
      if (!claim()) {
        warn('apply skipped: already claimed in this page lifetime')
        return
      }

      // Release the claim on unload so a hot-reloaded bundle can re-claim
      // instead of being silently dropped.
      try {
        ctx.effect(() => () => {
          claimed = false
        }, 'restart-buttons: apply claim')
      } catch (reason) {
        warn('claim release could not be registered', reason)
      }

      // Locale dictionaries: both shipped locale ids, same key set.
      try {
        ctx.effect(() => {
          const dispose = ctx.locale.register(NS, { zh: ZH, en: EN })
          translate = typeof ctx.locale.bind === 'function' ? ctx.locale.bind(NS) : null
          return () => {
            translate = null
            try {
              dispose()
            } catch (reason) {
              warn('locale disposer failed', reason)
            }
          }
        }, 'restart-buttons: locale')
      } catch (reason) {
        warn('locale registration failed; falling back to English', reason)
      }

      // Slot registration. Declaration-aware injection: the callback runs only
      // once the sidebar entry declares the seat, so load order does not matter
      // and a shell without the seat simply leaves the buttons absent.
      try {
        const dispose = ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
          name: 'sidebar.footer.action',
          id: 'dsh-restart-buttons',
          order: 100,
          label: () => t('button.reload'),
        }, RestartButtons))
        ctx.effect(() => () => {
          try {
            dispose()
          } catch (reason) {
            warn('slot disposer failed', reason)
          }
        }, 'restart-buttons: slot')
      } catch (reason) {
        warn('slot registration failed', reason)
      }
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})
