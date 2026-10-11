import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import {
  OFF_WORDS,
  PLUGIN,
  TEAMS,
  agentDescription,
  agentPrompt,
  agentType,
  delegatedExperts,
  expertOf,
  findTeam,
  sizeOf,
  teamBrief,
} from './teams'
import type { Team } from './teams'

const PANE = 'expert-teams'
const PANE_TITLE = 'Команды экспертов'
const active = atom({ plugin: 'expert-teams', key: 'active' } as const, null)

async function activeTeam($: EngineInterface): Promise<Team | undefined> {
  const id = await read($, active)

  return id === null ? undefined : TEAMS.find(team => team.id === id)
}

/** Включает команду (или выключает, если `team` не задана) и обновляет строку состояния. */
async function choose($: EngineInterface, team: Team | undefined): Promise<void> {
  await update($, active, () => team?.id ?? null)
  $.ui.status(team === undefined ? undefined : `Команда: ${team.title}`)
}

function memberNames(team: Team): string {
  return [team.lead, ...team.members].map(id => expertOf(id).name).join(', ')
}

function roster(current: Team | undefined): string {
  const lines = TEAMS.map(team => {
    const mark = team.id === current?.id ? '●' : '○'

    return `${mark} /team ${team.id} — ${team.title} (${sizeOf(team)}): ${team.summary}\n    ${memberNames(team)}`
  })
  const state =
    current === undefined ? 'Сейчас команда не выбрана.' : `Сейчас включена команда «${current.title}».`

  return [
    state,
    '',
    ...lines,
    '',
    '/team off — выключить. После выбора просто опиши задачу обычным сообщением.',
  ].join('\n')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'team',
      description: 'Выбрать команду экспертов: dev, ux, qa, sec, review или off',
      argumentHint: '[dev|ux|qa|sec|review|off]',
    })

    // Эксперты — субагенты; модели видны только те, кто входит в выбранную команду (agent.offer ниже).
    for (const expert of delegatedExperts()) {
      try {
        await $.agent.register({
          name: expert.id,
          description: agentDescription(expert),
          prompt: agentPrompt(expert),
          ...(expert.tools === undefined ? {} : { tools: expert.tools }),
        })
      } catch (error) {
        $.ui.toast(`expert-teams: не удалось зарегистрировать «${expert.name}»: ${String(error)}`)
      }
    }

    const team = await activeTeam($)
    $.ui.status(team === undefined ? undefined : `Команда: ${team.title}`)

    return next(e)
  })

  on('command.run', { command: 'team' }, async ($, e) => {
    const word = e.args.trim().toLowerCase()
    const current = await activeTeam($)

    if (word === '') {
      try {
        await $.ui.open({ id: PANE, title: PANE_TITLE })
      } catch {
        // Нет поверхности для панели (например, `claude -p`): хватит текста.
      }

      return { text: roster(current) }
    }

    if (word === 'list' || word === 'ls' || word === 'список') {
      return { text: roster(current) }
    }

    if (OFF_WORDS.includes(word)) {
      await choose($, undefined)

      return {
        text: 'Команда экспертов выключена. Работаю в обычном режиме.',
        context: ['Режим команды экспертов выключен командой /team off. Работай в обычном режиме.'],
      }
    }

    const team = findTeam(word)
    if (team === undefined) {
      return { text: `Нет команды «${word}».\n\n${roster(current)}` }
    }

    await choose($, team)

    return {
      text: `Команда «${team.title}» включена: ${memberNames(team)}.\n${team.summary}.\nОпиши задачу обычным сообщением.`,
      context: [
        `Пользователь включил команду экспертов «${team.title}» командой /team ${team.id}. ` +
          'Действуют правила из раздела «Режим команды экспертов» системного промпта.',
      ],
    }
  })

  // Раздел системного промпта: кто в команде и как с ней работать.
  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    const team = await activeTeam($)

    if (team === undefined || e.traits.includes('bare') || e.traits.includes('teammate')) {
      return composed
    }

    return {
      sections: [...composed.sections, { id: `${PLUGIN}:team`, text: teamBrief(team), scope: 'session' }],
    }
  })

  // Субагенты-эксперты предлагаются модели, только пока включена команда, где они состоят.
  on('agent.offer', { agent: /^expert-teams:/ }, async ($, e, next) => {
    const offered = await next(e)

    if (!offered.isOffered) {
      return offered
    }

    const team = await activeTeam($)
    const id = e.agent.slice(agentType('').length)

    return { isOffered: team !== undefined && team.members.includes(id) }
  }).catch(($, e, next) => (next.called ? next(e) : { isOffered: false }))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const team = await activeTeam($)

    if (team === undefined || e.props.hasSurvey) {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)

    return (
      <Box>
        <Text dimColor>
          Команда «{team.title}» · экспертов: {sizeOf(team)} · /team — сменить{' '}
        </Text>
        <Button
          key="off"
          label="Выкл"
          onPress={async () => {
            await choose($, undefined)
            $.ui.toast('Команда экспертов выключена')
          }}
        />
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const current = await activeTeam($)

    return (
      <Box flexDirection="column">
        <Text bold>{PANE_TITLE}</Text>
        <Text dimColor>
          Выбранная команда действует на следующие сообщения. Выключить: /team off.
        </Text>
        {TEAMS.map(team => {
          const isActive = team.id === current?.id

          return (
            <Box flexDirection="column" marginTop={1}>
              <Text bold color={isActive ? 'success' : 'text'}>
                {isActive ? '● ' : '○ '}
                {team.title} ({sizeOf(team)}) · /team {team.id}
              </Text>
              <Text dimColor>{team.summary}</Text>
              <Text>{memberNames(team)}</Text>
              <Box>
                <Button
                  key={`pick-${team.id}`}
                  label={isActive ? 'Включена' : 'Выбрать'}
                  variant={isActive ? 'secondary' : 'primary'}
                  onPress={async () => {
                    await choose($, team)
                    $.ui.toast(`Команда «${team.title}» включена`)
                  }}
                />
              </Box>
            </Box>
          )
        })}
        <Box marginTop={1}>
          <Button
            key="off"
            label="Выключить команду"
            onPress={async () => {
              await choose($, undefined)
              $.ui.toast('Команда экспертов выключена')
            }}
          />
        </Box>
      </Box>
    )
  })
}
