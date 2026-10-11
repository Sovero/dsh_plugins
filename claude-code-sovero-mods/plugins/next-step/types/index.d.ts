export type NextStepFlag = boolean

declare module 'claude-code' {
  interface PluginState {
    'next-step': { isIdle: boolean; isHidden: boolean }
  }
}
