/** Идентификатор команды: `dev`, `ux`, `qa`, `sec`, `review`. */
export type TeamId = string

declare module 'claude-code' {
  interface PluginState {
    'expert-teams': {
      /** Выбранная команда; null, когда команда не выбрана. */
      active: TeamId | null
    }
  }
}
