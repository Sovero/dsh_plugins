// Настройки голосового ввода: страница в общих настройках приложения.
//
// Почему не пункт в левой колонке. Пункт панели и панель `main` — неразлучная
// пара, а отсутствие половины роняет приложение: `layout.selectPanel` бросает
// для незарегистрированной панели («main panel … is not registered»). Так было
// дважды, и оба раза пришлось отключать плагин.
//
// Настройки живут там, где им место по устройству интерфейса: `settings.section`
// — целая страница (так же сделана страница пресетов агента), а
// `settings.general.item` — переключатели прямо в общем разделе. Это те же
// штатные слоты, куда пишут locale и тема оформления, и их риск уже измерили
// другие плагины.

import { readConfig, writeConfig, readModels, readCredentials, readVoices } from './api.js'

/** Идентификатор страницы настроек. */
export const SECTION_ID = 'voice-eternia'

/**
 * Идентификатор пункта в левой панели и ключ его панели.
 */
export const PANEL_ID = 'voice-eternia-panel'

/**
 * Порядок пункта в левой панели.
 *
 * Ниже штатных панелей: настройки плагина не должны вытеснять то, чем человек
 * пользуется каждый день.
 */
export const PANEL_ORDER = 50

/**
 * Порядок страницы среди прочих.
 *
 * Число ниже штатных разделов: настройки плагина не должны вытеснять то, чем
 * человек пользуется каждый день.
 */
export const SECTION_ORDER = 30

/**
 * Поля формы: группа, ключ, подпись, тип, подсказка.
 *
 * Подсказка обязательна у каждого поля. Без неё настройка превращается в
 * загадку: «Insertion target: cursor» ничего не говорит о том, что бывают ещё
 * `captured` и `replace`, а «Leave @file chips alone» — о том, какие именно
 * @файлы и почему их лучше не трогать. Человек не должен угадывать смысл
 * собственных настроек.
 *
 * Тип `model` рисует выпадающий список БЕСПЛАТНЫХ моделей, настроенных в самом
 * DSH: `id` провайдера и точное имя модели человек помнить не обязан, а платные
 * здесь не предлагаются — диктовка и полировка не та задача, ради которой стоит
 * платить. Поле остаётся редактируемым: модель без суффикса `:free` или свой
 * шлюз в списке не появятся, а запрещать их — значит запрещать работать.
 *
 * Модели полировки в списке полей НЕТ намеренно. Полирует текст та же модель,
 * на которой идёт разговор: держать вторую настройку ради того же действия —
 * лишний выбор, который ничего не решает, зато требует внимания.
 */
const FIELDS = [
  // Провайдер — ИМЯ записи с ключом, а не ключ. Список, а не текстовое поле:
  // в поле «провайдер» люди вставляли сам ключ, и он оставался на экране
  // открытым текстом. Значения для списка приходят с хоста (имена записей из
  // хранилища ключей), вписать секрет сюда физически некуда.
  { group: 'asr', key: 'provider', label: 'settings.provider', type: 'credential', hint: 'settings.hintProvider' },
  { group: 'asr', key: 'model', label: 'settings.asrModel', type: 'model', hint: 'settings.hintAsrModel' },
  { group: 'asr', key: 'baseUrl', label: 'settings.baseUrl', type: 'text', hint: 'settings.hintBaseUrl' },
  { group: 'asr', key: 'language', label: 'settings.language', type: 'text', hint: 'settings.hintLanguage' },
  { group: 'polish', key: 'enabled', label: 'settings.polishOn', type: 'bool', hint: 'settings.hintPolishOn' },
  { group: 'polish', key: 'preset', label: 'settings.preset', type: 'preset', hint: 'settings.hintPreset' },
  { group: 'polish', key: 'prompt', label: 'settings.prompt', type: 'area', hint: 'settings.hintPrompt' },
  { group: 'polish', key: 'temperature', label: 'settings.temperature', type: 'number', hint: 'settings.hintTemperature' },
  { group: 'recording', key: 'device', label: 'settings.device', type: 'text', hint: 'settings.hintDevice' },
  { group: 'recording', key: 'maxSeconds', label: 'settings.maxSeconds', type: 'number', hint: 'settings.hintMaxSeconds' },
  { group: 'recording', key: 'inputGain', label: 'settings.inputGain', type: 'number', hint: 'settings.hintInputGain' },
  { group: 'recording', key: 'noiseSuppress', label: 'settings.noise', type: 'bool', hint: 'settings.hintNoise' },
  { group: 'insert', key: 'mode', label: 'settings.insertMode', type: 'select', hint: 'settings.hintInsertMode', options: ['cursor', 'captured', 'replace'] },
  { group: 'insert', key: 'preserveChips', label: 'settings.preserveChips', type: 'bool', hint: 'settings.hintPreserveChips' },
  { group: 'ui', key: 'showBrowserFallback', label: 'settings.browser', type: 'bool', hint: 'settings.hintBrowser' },
  { group: 'ui', key: 'confirmOnInsert', label: 'settings.confirm', type: 'bool', hint: 'settings.hintConfirm' },

  // Разговорный режим: отдельная кнопка в панели ввода. Здесь решается, где
  // кончается фраза и показывать ли вторую кнопку вообще. Без этих чисел
  // микрофон не может отличить «человек договорил» от «человек думает».
  //
  // `enabled` больше НЕ переключает поведение кнопки микрофона: раньше одна
  // кнопка означала то диктовку, то беседу в зависимости от этой настройки, и
  // человек не мог предугадать, что случится по нажатию. Теперь кнопок две, а
  // настройка только разрешает или запрещает кнопку разговора.
  { group: 'conversation', key: 'enabled', label: 'settings.converse', type: 'bool', hint: 'settings.hintConverse' },
  { group: 'conversation', key: 'threshold', label: 'settings.threshold', type: 'number', hint: 'settings.hintThreshold' },
  { group: 'conversation', key: 'silenceMs', label: 'settings.silence', type: 'number', hint: 'settings.hintSilence' },
  { group: 'conversation', key: 'onsetMs', label: 'settings.onset', type: 'number', hint: 'settings.hintOnset' },
  { group: 'conversation', key: 'minPhraseMs', label: 'settings.minPhrase', type: 'number', hint: 'settings.hintMinPhrase' },

  // Голос ответа. Голос выбирается списком с машины: имена вроде
  // «Microsoft Irina Desktop» человек не обязан знать наизусть.
  { group: 'speech', key: 'enabled', label: 'settings.speakOn', type: 'bool', hint: 'settings.hintSpeakOn' },
  { group: 'speech', key: 'voice', label: 'settings.voice', type: 'voice', hint: 'settings.hintVoice' },
  { group: 'speech', key: 'rate', label: 'settings.rate', type: 'number', hint: 'settings.hintRate' },
  { group: 'speech', key: 'volume', label: 'settings.volume', type: 'number', hint: 'settings.hintVolume' },
]

/**
 * Готовые промпты полировки.
 *
 * Смысл набора: у диктовки нет одного «правильного» стиля. Наговорённое на
 * встрече, письмо коллеге и техническая заметка требуют разной обработки, и
 * заставлять человека писать инструкцию редактору с нуля — значит требовать
 * знания промпт-инженерии там, где достаточно выбрать задачу.
 *
 * Текст инструкции здесь НЕ хранится, только ключ словаря: русская строка в
 * коде показывалась бы и в английском интерфейсе, и человек получал бы русскую
 * инструкцию редактору при английском окне.
 *
 * `id` попадает в настройки как `polish.preset`. Пустой `id` означает «своя
 * инструкция»: текст поля не подменяется.
 */
const PRESETS = [
  { id: '', label: 'settings.presetCustom' },
  { id: 'plain', label: 'settings.presetPlain', prompt: 'settings.prompt.plain' },
  { id: 'business', label: 'settings.presetBusiness', prompt: 'settings.prompt.business' },
  { id: 'note', label: 'settings.presetNote', prompt: 'settings.prompt.note' },
  { id: 'meeting', label: 'settings.presetMeeting', prompt: 'settings.prompt.meeting' },
  { id: 'code', label: 'settings.presetCode', prompt: 'settings.prompt.code' },
  { id: 'message', label: 'settings.presetMessage', prompt: 'settings.prompt.message' },
  { id: 'clean', label: 'settings.presetClean', prompt: 'settings.prompt.clean' },
]

/** Группы и их заголовки. */
const COLUMNS = [
  { id: 'dictation', title: 'settings.columnDictation' },
  { id: 'talk', title: 'settings.columnTalk' },
]

const GROUPS = [
  { id: 'asr', title: 'settings.groupAsr', column: 'dictation' },
  { id: 'polish', title: 'settings.groupPolish', column: 'dictation' },
  { id: 'recording', title: 'settings.groupRecording', column: 'dictation' },
  { id: 'insert', title: 'settings.groupInsert', column: 'dictation' },
  { id: 'conversation', title: 'settings.groupConversation', column: 'talk' },
  { id: 'speech', title: 'settings.groupSpeech', column: 'talk' },
  { id: 'ui', title: 'settings.groupUi', column: 'talk' },
]

/**
 * Копирует настройки глубоко.
 *
 * Форма правит вложенные группы по месту, и общий снимок из хоста трогать нельзя:
 * он общий с подпиской, и правка на месте обнулила бы её у всех.
 *
 * @param {object} source - исходные настройки.
 * @returns {object} независимая копия.
 */
function cloneSettings(source) {
  const result = {}
  for (const group of Object.keys(source ?? {})) {
    result[group] = { ...source[group] }
  }
  return result
}

/**
 * Значение поля из снимка настроек.
 *
 * @param {object} settings - настройки.
 * @param {string} id - путь «группа.ключ».
 * @returns {*} значение.
 */
function valueAt(settings, id) {
  const [group, key] = id.split('.')
  return settings?.[group]?.[key]
}

/**
 * Переводит ключ, не выбрасывая его при неудаче.
 *
 * Сырой ключ в интерфейсе недопустим, но и пустая строка ничего не объяснит —
 * ключ хотя бы говорит, чего не хватило.
 *
 * @param {Function} t - переводчик.
 * @param {string} key - ключ словаря.
 * @returns {string} подпись.
 */
function label(t, key) {
  try {
    const value = t(key)
    return typeof value === 'string' && value !== '' ? value : key
  } catch {
    return key
  }
}

/**
 * Рисует поле нужного типа.
 *
 * @param {object} spec - описание поля.
 * @param {*} value - текущее значение.
 * @param {(raw: *) => void} onChange - обработчик правки.
 * @param {Function} t - переводчик.
 * @returns {object} элемент React.
 */
function renderInput(spec, value, onChange, t) {
  const React = require('react')
  const common = {
    id: `vet-${spec.group}-${spec.key}`,
    'aria-label': label(t, spec.label),
    value: value === undefined || value === null ? '' : String(value),
    onChange: (event) => onChange(event.target.value),
  }
  if (spec.type === 'bool') {
    return React.createElement('input', {
      type: 'checkbox',
      checked: value === true,
      'aria-label': label(t, spec.label),
      onChange: (event) => onChange(event.target.checked),
    })
  }
  if (spec.type === 'area') {
    return React.createElement('textarea', Object.assign({}, common, {
      rows: 4,
      placeholder: label(t, 'settings.promptPlaceholder'),
    }))
  }
  if (spec.type === 'credential') {
    const credentials = Array.isArray(spec.credentials) ? spec.credentials : []
    const current = value === undefined || value === null ? '' : String(value)
    const known = credentials.some((item) => item.provider === current)
    return React.createElement('span', { className: 'vet-page__model' },
      React.createElement('select', {
        className: 'vet-page__select',
        'aria-label': label(t, spec.label),
        value: known ? current : '',
        onChange: (event) => onChange(event.target.value),
      },
      React.createElement('option', { value: '' },
        known ? current : label(t, 'settings.credentialPick')),
      credentials.map((item) => React.createElement('option', { key: item.provider, value: item.provider },
        item.keyName === '' ? item.provider : `${item.provider} — ${item.keyName}`,
      )),
      ),
    )
  }
  if (spec.type === 'select') {
    // Строгий выбор из перечисленного: свободный ввод здесь означал бы
    // настройку, которую хост молча отбросит при проверке значения.
    const options = Array.isArray(spec.options) ? spec.options : []
    const current = value === undefined || value === null ? '' : String(value)
    return React.createElement('select', {
      className: 'vet-page__select',
      'aria-label': label(t, spec.label),
      value: options.includes(current) ? current : (options[0] ?? ''),
      onChange: (event) => onChange(event.target.value),
    }, options.map((option) => React.createElement('option', { key: option, value: option },
      label(t, `settings.option.${option}`),
    )))
  }
  if (spec.type === 'voice') {
    // Голос выбирается списком с машины. Если голосов нет — платформа без
    // синтеза (или поломан SAPI), и тогда поле честно говорит об этом, вместо
    // того чтобы показывать пустой список.
    const voices = Array.isArray(spec.voices) ? spec.voices : null
    const current = value === undefined || value === null ? '' : String(value)
    // Пока ответ не пришёл — просто пустое место, а не слова: надпись о
    // недоступности, мигающая при загрузке, сбивала бы с толку.
    if (voices === null) return React.createElement('span', { className: 'vet-page__hint' }, '')
    if (voices === 'missing') {
      return React.createElement('span', { className: 'vet-page__hint' },
        label(t, 'settings.voicesMissing'))
    }
    if (voices.length === 0) {
      return React.createElement('span', { className: 'vet-page__hint' }, label(t, 'settings.noVoices'))
    }
    return React.createElement('select', {
      className: 'vet-page__select',
      'aria-label': label(t, spec.label),
      value: current,
      onChange: (event) => onChange(event.target.value),
    }, voices.map((voice) => React.createElement('option', { key: voice.name, value: voice.name },
      voice.culture === ''
        ? voice.name
        : `${voice.name} — ${voice.culture}`,
    )))
  }
  if (spec.type === 'preset') {
    // Выбор задачи. Текст инструкции подставляется в поле ниже, поэтому набор
    // не запирает человека: выбрав «своя», он пишет что угодно.
    const current = value === undefined || value === null ? '' : String(value)
    return React.createElement('span', { className: 'vet-page__model' },
      React.createElement('select', {
        className: 'vet-page__select',
        'aria-label': label(t, spec.label),
        value: current,
        onChange: (event) => onChange(event.target.value),
      }, PRESETS.map((preset) => React.createElement('option', { key: preset.id, value: preset.id },
        label(t, preset.label),
      ))),
      React.createElement('span', { className: 'vet-page__hint' }, label(t, 'settings.presetNote')),
    )
  }
  if (spec.type === 'model') {
    // Выпадающий список моделей DSH плюс своя строка ввода.
    //
    // Список берётся из профиля, поэтому здесь оказываются именно те модели,
    // что человек видит в разделе «Модели», и бесплатные идут первыми. Свободный
    // ввод сохранён: модель без суффикса `:free` или свой шлюз в списке не
    // появятся, а запрещать их — значит запрещать работать.
    const models = Array.isArray(spec.models) ? spec.models : []
    const current = value === undefined || value === null ? '' : String(value)
    const known = models.some((item) => item.id === current)
    return React.createElement('span', { className: 'vet-page__model' },
      React.createElement('select', {
        className: 'vet-page__select',
        'aria-label': label(t, spec.label),
        value: known ? current : '',
        onChange: (event) => {
          // Пустой пункт — «своё значение»: он не должен затирать уже
          // вписанную модель, иначе выбор исчезнет на полпути.
          if (event.target.value === '') return
          onChange(event.target.value)
        },
      },
      React.createElement('option', { value: '' },
        known ? label(t, 'settings.modelCustom') : (current === '' ? label(t, 'settings.modelPick') : current)),
      models.map((item) => React.createElement('option', { key: `${item.provider}/${item.id}`, value: item.id },
        item.free ? `${item.name} — ${label(t, 'settings.free')}` : item.name,
      )),
      ),
      React.createElement('input', Object.assign({}, common, { type: 'text', className: 'vet-page__modelText' })),
    )
  }
  return React.createElement('input', Object.assign({}, common, {
    type: spec.type === 'number' ? 'number' : 'text',
  }))
}

/**
 * Страница настроек голосового ввода.
 *
 * @param {object} props - свойства ячейки.
 * @returns {object} элемент React.
 */
export function SettingsSection({ t: translate = (key) => key }) {
  const React = require('react')
  // Смена языка интерфейса должна перерисовать страницу целиком, а не только
  // подписи слотов: иначе в русском окне остались бы английские подписи полей.
  useActiveLocale()
  const [draft, setDraft] = React.useState(null)
  const [busy, setBusy] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState('')
  const [saved, setSaved] = React.useState(false)
  const [models, setModels] = React.useState([])
  const [credentials, setCredentials] = React.useState([])
  const [voices, setVoices] = React.useState(null)

  // Перевод нужен внутри обработчика выбора задачи, а он переживает смену языка:
  // держим свежую ссылку, чтобы подставленная инструкция всегда была на том
  // языке, что виден в окне.
  const translateRef = React.useRef(translate)
  translateRef.current = typeof translate === 'function' ? translate : defaultTranslate

  React.useEffect(() => {
    let alive = true
    void readConfig().then((config) => {
      if (!alive) return
      setDraft(config === null ? {} : cloneSettings(config))
      setBusy(false)
    })
    // Модели грузятся отдельно: их отсутствие не должно мешать править
    // остальные настройки, поэтому неудача здесь просто оставляет список пустым,
    // а поля работают как обычные строки ввода.
    void readModels().then((list) => {
      if (!alive || list === null) return
      setModels(list)
    })
    // Имена записей с ключами: сами ключи остаются на хосте.
    void readCredentials().then((list) => {
      if (!alive || list === null) return
      setCredentials(list)
    })
    // Голоса на machine: список нужен для выбора голоса ответа.
    void readVoices().then((list) => {
      if (!alive) return
      setVoices(list)
    })
    return () => { alive = false }
  }, [])

  const set = (id, raw) => {
    const spec = FIELDS.find((item) => `${item.group}.${item.key}` === id)
    if (spec === undefined) return
    setSaved(false)
    setDraft((current) => {
      const next = cloneSettings(current ?? {})
      next[spec.group] = next[spec.group] ?? {}
      // Тип приводится здесь, а не на хосте: текстовое поле для числа должно
      // отдать хосту число, иначе настройка молча отбросится при проверке типа.
      let value = raw
      if (spec.type === 'bool') value = raw === true
      else if (spec.type === 'number') value = Number(raw)
      else value = String(raw)
      next[spec.group][spec.key] = value
      // Выбор задачи подставляет её инструкцию в поле промпта: человек выбирает
      // «Протокол встречи» и сразу видит, что именно уйдёт редактору, — а не
      // получает текстовое поле без объяснений.
      if (spec.type === 'preset') {
        const preset = PRESETS.find((item) => item.id === value)
        // Текст берётся переводом: в поле должен лежать тот же язык, что и в окне.
        if (preset !== undefined && typeof preset.prompt === 'string' && preset.prompt !== '') {
          // Именно .current: label() зовёт переданное как функцию, а сам ref —
          // это объект, и вызов на нём бросает TypeError. Ошибка тихая: label()
          // ловит её и возвращает ключ, поэтому в поле попадал settings.prompt.*
          // вместо текста инструкции.
          next.polish.prompt = label(translateRef.current, preset.prompt)
        }
      }
      return next
    })
  }

  const save = async () => {
    setSaving(true)
    setError('')
    const answer = await writeConfig(draft ?? {})
    setSaving(false)
    if (answer.ok !== true) {
      setError(typeof answer.error?.message === 'string'
        ? answer.error.message
        : label(translate, 'settings.saveFailed'))
      return
    }
    // Подтверждение нужно: значения сохранены, и форма обязана это показать —
    // иначе человек гадает, сработало ли.
    setSaved(true)
  }

  if (busy === true || draft === null) {
    return React.createElement('p', { className: 'vet-page__note' }, label(translate, 'settings.loading'))
  }

  return React.createElement('div', { className: 'vet-page' },
    // Кнопка сохранения стоит вверху, рядом с названием, и повторяет её при
    // прокрутке. Внизу она была бесполезна: до неё ещё нужно было доскроллить,
    // а настройки занимают два экрана, и человек закрывал окно, ни разу не
    // нажав «Сохранить» — а изменения уходили молча.
    React.createElement('header', { className: 'vet-page__head' },
      React.createElement('h2', { className: 'vet-page__title' }, label(translate, 'settings.title')),
      React.createElement('button', {
        type: 'button',
        className: 'vet-page__save',
        'data-primary': 'true',
        disabled: saving === true,
        onClick: () => { void save() },
      }, label(translate, 'settings.save')),
    ),
    // Настройки разделены по смыслу на две колонки: слева диктовка (что
    // записываем и куда вставляем), справа разговор (как режем фразы и каким
    // голосом отвечаем). Это не украшение: человек приходит либо надиктовать,
    // либо поговорить, и обе задачи требуют разного, а смешанный список
    // заставлял искать нужное среди семи групп.
    React.createElement('div', { className: 'vet-page__groups' },
      ...COLUMNS.map((column) => React.createElement('section', { className: 'vet-page__column', key: column.id },
        React.createElement('h2', { className: 'vet-page__columnTitle' }, label(translate, column.title)),
        ...GROUPS.filter((group) => group.column === column.id).map((group) => (
          React.createElement('section', { className: 'vet-page__group', key: group.id },
        React.createElement('h3', { className: 'vet-page__groupTitle' }, label(translate, group.title)),
        ...FIELDS.filter((item) => item.group === group.id).map((item) => {
          const id = `${item.group}.${item.key}`
          // Модели подставляются только в поля-списки: текстовые поля от них
          // не зависят и лишний пропс им ни к чему.
          let spec = item
        if (item.type === 'model') spec = Object.assign({}, item, { models })
        if (item.type === 'credential') spec = Object.assign({}, item, { credentials })
        if (item.type === 'voice') spec = Object.assign({}, item, { voices })
          return React.createElement('label', { className: 'vet-page__field', key: id },
            React.createElement('span', { className: 'vet-page__label' }, label(translate, item.label)),
            renderInput(spec, valueAt(draft, id), (raw) => set(id, raw), translate),
            // Подсказка под полем, а не всплывающая: настройку читают один раз, и
            // объяснение должно быть на виду, а не ждать наведения мышью.
            React.createElement('span', { className: 'vet-page__hint' }, label(translate, item.hint)),
          )
        }),
          ))),
        )),
    ),
    error === ''
      ? null
      : React.createElement('p', { className: 'vet-page__error', role: 'alert', key: 'error' }, error),
    saved === true
      ? React.createElement('p', { className: 'vet-page__saved', role: 'status', key: 'saved' },
        label(translate, 'settings.saved'))
      : null,
  )
}

/**
 * Иконка пункта в левой панели.
 *
 * Только значок: слот рендерится как `renderSlot('sidebar.panellist',
 * { size, active })`, а кнопку вокруг рисует сама панель — её обработчик
 * вызывает `layout.selectPanel(id)`. Своя кнопка внутри чужой перехватила бы
 * клик, и настройки просто не открылись бы.
 *
 * @returns {object} элемент React.
 */
export function PanelIcon() {
  const React = require('react')
  return React.createElement('svg', {
    width: '1em',
    height: '1em',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    'aria-hidden': 'true',
  }, React.createElement('circle', { cx: 12, cy: 12, r: 3.2 }),
  React.createElement('path', {
    d: 'M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8M18.5 18.5l-1.8-1.8M7.3 7.3 5.5 5.5',
  }))
}
