import { describe, expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const BASE = [{ id: 'base', text: 'Базовый промпт', scope: 'shared' }] as const

/** Низ цепочки: то, что в сессии отвечает движок. Плагин лежит над этими хуками. */
function engine(on: On) {
  const commands: string[] = []
  const agents: string[] = []
  const statuses: (string | undefined)[] = []

  // Вызовы `$` вроде `$.command.register` отвечают объектом `{ value }`.
  on('command.register', (_$, e) => {
    commands.push(e.name)

    return { value: { command: e.name } }
  })
  on('agent.register', (_$, e) => {
    agents.push(e.name)

    return { value: { agent: `expert-teams:${e.name}` } }
  })
  on('ui.status', (_$, e) => {
    statuses.push(e.text)

    return { value: undefined }
  })
  on('ui.toast', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isOpened: true } }) as never)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('prompt.compose', () => ({ sections: BASE }))
  on('agent.offer', () => ({ isOffered: true }))

  return { commands, agents, statuses }
}

const START = { cwd: '/work', surface: 'terminal', isInteractive: true } as const

const COMPOSE = {
  model: 'test-model',
  promptModel: 'test-model',
  surfaces: ['terminal'],
  tools: [],
  outputStyle: null,
  traits: [],
} as const

function offer(agent: string) {
  return {
    agent,
    description: '',
    source: 'plugin',
    provider: { plugin: 'expert-teams', tier: 'user' },
  } as const
}

describe('expert-teams', () => {
  test('на старте регистрирует /team и семь экспертов-субагентов', async ($, on) => {
    const world = engine(on)
    await $.session.start(START)

    expect(world.commands).toEqual(['team'])
    expect(world.agents).toEqual([
      'analyst',
      'architect',
      'fullstack',
      'designer',
      'qa',
      'devops',
      'security',
    ])
  })

  test('без выбранной команды системный промпт не меняется', async ($, on) => {
    engine(on)
    await $.session.start(START)

    const composed = await $.prompt.compose(COMPOSE)

    expect(composed.sections.map(section => section.id)).toEqual(['base'])
  })

  test('/team dev добавляет раздел с составом и правилами, /team off убирает', async ($, on) => {
    const world = engine(on)
    await $.session.start(START)

    const on_ = await $.command.run({ command: 'team', args: 'dev' })
    expect(on_.text).toContain('Разработка')
    expect(world.statuses.at(-1)).toBe('Команда: Разработка')

    const composed = await $.prompt.compose(COMPOSE)
    const section = composed.sections.find(one => one.id === 'expert-teams:team')
    expect(section?.scope).toBe('session')
    expect(section?.text).toContain('Тимлид')
    for (const id of ['analyst', 'architect', 'fullstack', 'designer', 'qa', 'devops', 'security']) {
      expect(section?.text).toContain(`expert-teams:${id}`)
    }

    const off = await $.command.run({ command: 'team', args: 'off' })
    expect(off.text).toContain('выключена')
    expect(world.statuses.at(-1)).toBeUndefined()
    expect((await $.prompt.compose(COMPOSE)).sections.map(one => one.id)).toEqual(['base'])
  })

  test('команду можно выбрать по псевдониму', async ($, on) => {
    engine(on)
    await $.session.start(START)

    const result = await $.command.run({ command: 'team', args: 'Дизайн' })

    expect(result.text).toContain('UI/UX-эксперт')
  })

  test('соло-эксперт работает сам: без субагентов в промпте', async ($, on) => {
    engine(on)
    await $.session.start(START)
    await $.command.run({ command: 'team', args: 'ux' })

    const composed = await $.prompt.compose(COMPOSE)
    const section = composed.sections.find(one => one.id === 'expert-teams:team')

    expect(section?.text).toContain('UI/UX-дизайнер')
    expect(section?.text).not.toContain('subagent_type')
  })

  test('неизвестная команда не включается и подсказывает список', async ($, on) => {
    engine(on)
    await $.session.start(START)

    const result = await $.command.run({ command: 'team', args: 'nope' })

    expect(result.text).toContain('Нет команды')
    expect(result.text).toContain('/team dev')
    expect((await $.prompt.compose(COMPOSE)).sections.map(one => one.id)).toEqual(['base'])
  })

  test('модель видит экспертов только выбранной команды', async ($, on) => {
    engine(on)
    await $.session.start(START)

    expect((await $.agent.offer(offer('expert-teams:analyst'))).isOffered).toBe(false)

    await $.command.run({ command: 'team', args: 'dev' })
    expect((await $.agent.offer(offer('expert-teams:analyst'))).isOffered).toBe(true)

    await $.command.run({ command: 'team', args: 'ux' })
    expect((await $.agent.offer(offer('expert-teams:analyst'))).isOffered).toBe(false)

    await $.command.run({ command: 'team', args: 'review' })
    expect((await $.agent.offer(offer('expert-teams:security'))).isOffered).toBe(true)
    expect((await $.agent.offer(offer('expert-teams:devops'))).isOffered).toBe(false)
  })

  test('чужие агенты хук не трогает', async ($, on) => {
    engine(on)
    await $.session.start(START)

    expect((await $.agent.offer(offer('Explore'))).isOffered).toBe(true)
  })
})

const SURFACES = ['terminal', 'desktop', 'vscode', 'mobile'] as const

const SITE = { scroll: { offset: 0, bodyRows: 20 }, view: {} } as const

const PANE_PROPS = {
  title: 'Команды экспертов',
  isFocused: false,
  bodyColumns: 80,
  placement: 'inline',
  ...SITE,
} as const

const BAND_PROPS = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 6,
  bodyColumns: 80,
  ...SITE,
} as const

describe('expert-teams: экран', () => {
  for (const surface of SURFACES) {
    test(`панель выбора на поверхности ${surface}`, async ($, on) => {
      const world = engine(on)
      await $.session.start(START)

      const ui = await $.ui.mount({
        plugin: 'expert-teams',
        surface,
        component: 'Pane',
        requestId: 'expert-teams',
        props: PANE_PROPS,
      })

      for (const id of ['dev', 'ux', 'qa', 'sec', 'review']) {
        expect(await ui.find({ key: `pick-${id}` })).toBeDefined()
      }

      await ui.press({ key: 'pick-ux' })

      expect(world.statuses.at(-1)).toBe('Команда: UI/UX-эксперт')
      expect((await ui.find({ key: 'pick-ux' }))?.text).toBe('Включена')
      expect((await $.prompt.compose(COMPOSE)).sections.map(one => one.id)).toContain('expert-teams:team')

      await ui.press({ key: 'off' })

      expect(world.statuses.at(-1)).toBeUndefined()
      expect((await $.prompt.compose(COMPOSE)).sections.map(one => one.id)).toEqual(['base'])
      await ui.unmount()
    })
  }

  for (const surface of ['terminal', 'desktop'] as const) {
    test(`полоса над вводом на поверхности ${surface}: показывает команду и выключает её`, async ($, on) => {
      const world = engine(on)
      await $.session.start(START)
      await $.command.run({ command: 'team', args: 'dev' })

      const ui = await $.ui.mount({
        plugin: 'expert-teams',
        surface,
        component: 'AbovePrompt',
        props: BAND_PROPS,
      })

      expect(await ui.find({ type: 'Text', text: /Команда «Разработка»/ })).toBeDefined()

      await ui.press({ key: 'off' })

      expect(world.statuses.at(-1)).toBeUndefined()
      expect((await $.prompt.compose(COMPOSE)).sections.map(one => one.id)).toEqual(['base'])
    })
  }
})
