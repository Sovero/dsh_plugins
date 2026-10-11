export type PulseCall = { id: string; tool: string; label: string; ms: number; isError: boolean }

export type PulseTurn = { ms: number; steps: number }

declare module 'claude-code' {
  interface PluginState {
    pulse: { calls: PulseCall[]; turn: PulseTurn | null }
  }
}
