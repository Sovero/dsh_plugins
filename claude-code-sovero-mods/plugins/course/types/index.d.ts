export type CourseLines = string[]

declare module 'claude-code' {
  interface PluginState {
    course: { lines: string[] }
  }
}
