// Словари интерфейса плагина.
//
// Пространство имён одно на весь пакет: в нём живут и подписи кнопок, и тексты
// ошибок. Ключи плоские, с точками — так их удобно искать и диффать.
//
// Русский — основной язык пакета, поэтому именно он служит источником ключей:
// английский и китайский обязаны покрывать его полностью. Тест пакета сверяет
// наборы ключей, поэтому забытый перевод ломает сборку, а не всплывает в
// интерфейсе сырым «error.noInputActions».

/** Пространство имён словаря пакета. */
export const NAMESPACE = 'voice-eternia'

/** Идентификатор русского языка и его подпись в переключателе. */
export const RUSSIAN = {
  id: 'ru',
  label: 'Русский',
  fallback: 'en',
}

/**
 * Русский словарь — источник ключей.
 *
 * @type {Record<string, string>}
 */
export const ru = {
  // Кнопка и её подписи.
  dictate: 'Диктовка',
  'title.idle': 'Диктовка: записывать и вставить текст',
  'title.busy': 'Идёт распознавание',

  // Строка состояния.
  'status.requesting': 'Запрашиваю микрофон…',
  'status.recording': 'Говорите… нажмите ещё раз, чтобы остановить',
  'status.unavailable': 'Микрофон недоступен',
  'status.recognizing': 'Распознаю…',

  // Подсказка про браузер.

  // Действия.

  // Отказы среды.
  'error.deniedDesktop': 'Микрофон запрещён. Запись ведёт хост — проверьте, что ffmpeg доступен и устройство не занято другим приложением.',
  'error.deniedSite': 'Микрофон запрещён. Разрешите доступ к микрофону в настройках сайта и попробуйте снова.',
  'error.noDevice': 'Микрофон не найден.',
  'error.busy': 'Микрофон занят другой программой.',
  'error.unknown': 'Не удалось получить доступ к микрофону.',
  'error.probeFailed': 'Проверка микрофона не удалась: {message}',
  'error.unsupported': 'Этот браузер не умеет записывать звук — откройте интерфейс в браузере с поддержкой микрофона.',

  // Отказы на пути к записи.
  'error.noInputActions': 'Панель ввода не отдала действия ввода — обновите страницу и попробуйте снова.',
  'error.noSpan': 'Не удалось запомнить позицию курсора: {message}',
  'error.noRecording': 'Не удалось начать запись: {message}',

  // Отказы распознавания и вставки.
  'error.transcribeFailed': 'Не удалось распознать.',
  'error.emptySpeech': 'Речь не распознана — попробуйте ещё раз.',
  'error.insertRejected': 'Черновик изменился — вставка не выполнена, чтобы не затереть набранное.',
  'error.insertFailed': 'Не удалось вставить — скопируйте текст вручную.',
  'error.noInputField': 'Поле ввода недоступно — текст скопируйте.',

  // Отчёты об успехе.
  'notice.copiedAddress': 'Адрес скопирован в буфер обмена.',
  'notice.copiedText': 'Скопировано в буфер обмена.',
  'status.inserted': 'Текст вставлен.',
  'hint.toggle': 'Нажмите микрофон ещё раз, чтобы закончить запись.',
  'hint.close': 'Нажмите микрофон, чтобы закрыть.',
  'meter.label': 'Уровень микрофона',

  'settings.title': 'Настройки голоса',
  'settings.groupAsr': 'Распознавание',
  'settings.groupPolish': 'Полировка текста',
  'settings.groupRecording': 'Микрофон и запись',
  'settings.groupInsert': 'Вставка в поле',
  'settings.groupUi': 'Интерфейс',
  'settings.provider': 'Провайдер (имя записи в credentials)',
  'settings.asrModel': 'Модель распознавания',
  'settings.baseUrl': 'Адрес API (пусто — по умолчанию)',
  'settings.language': 'Язык речи',
  'settings.polishOn': 'Полировать распознанный текст',
  'settings.polishModel': 'Модель полировки',
  'settings.prompt': 'Инструкция редактору',
  'settings.promptPlaceholder': 'Пусто — встроенная инструкция плагина',
  'settings.temperature': 'Температура полировки',
  'settings.device': 'Микрофон (пусто — первый в системе)',
  'settings.maxSeconds': 'Предел записи, секунд',
  'settings.inputGain': 'Усиление микрофона',
  'settings.noise': 'Убрать фоновый гул',
  'settings.insertMode': 'Куда вставлять (cursor / captured / replace)',
  'settings.preserveChips': 'Не трогать @чипы файлов',
  'settings.browser': 'Показывать адрес браузера при отказе',
  'settings.confirm': 'Показывать текст перед вставкой',
  'settings.save': 'Сохранить',
  'settings.cancel': 'Отмена',
  'settings.close': 'Закрыть',
  'settings.loading': 'Загружаю настройки…',
  'settings.saveFailed': 'Не удалось сохранить настройки.',
  'settings.modelPick': 'Выберите модель',
  'settings.modelCustom': 'Своя модель — впишите ниже',
  'settings.free': 'бесплатно',
  'settings.saved': 'Сохранено.',  'result.copyHint': 'Нажмите, чтобы скопировать текст.',
  'settings.hintProvider': 'Имя записи с ключом доступа в хранилище DSH. Ключ вводится в разделе «Модели», а сюда попадает только его имя.',
  'settings.hintAsrModel': 'Модель, которая превращает запись в текст. Показаны только бесплатные из ваших настроенных.',
  'settings.hintBaseUrl': 'Свой адрес API. Пусто — используется адрес выбранного провайдера.',
  'settings.hintLanguage': 'Язык речи: ru, en и так далее. Подсказка модели — на каком языке вы говорите.',
  'settings.hintPolishOn': 'Прогонять распознанный текст через модель, чтобы убрать оговорки и расставить знаки.',
  'settings.hintPreset': 'Готовая задача для полировки. Выбор подставит её инструкцию в поле ниже.',
  'settings.hintPrompt': 'Что именно сделать с текстом. Пусто — встроенная инструкция плагина.',
  'settings.hintTemperature': '0 — строго по тексту, выше — свободнее формулировки. Для диктовки лучше 0.',
  'settings.hintDevice': 'Название микрофона. Пусто — системный по умолчанию, обычно это то, что нужно.',
  'settings.hintMaxSeconds': 'Запись остановится сама. Страховка от забытого микрофона.',
  'settings.hintInputGain': 'Множитель громкости записи. 1 — как есть, 2 — вдвое громче. Помогает на тихом микрофоне.',
  'settings.hintNoise': 'Убирает ровный фон: гул вентилятора, шум улицы. Речь при этом не портится.',
  'settings.hintInsertMode': 'cursor — вставить там, где стоит каретка. captured — куда она стояла до записи. replace — заменить выделенное.',
  'settings.hintPreserveChips': 'Не разрывать @упоминания файлов и сессий: они остаются рабочими ссылками.',
  'settings.hintBrowser': 'При отказе микрофона показать адрес, открыв который в браузере, можно записывать.',
  'settings.hintConfirm': 'Показать распознанный текст до вставки: можно поправить или отказаться.',
  'settings.option.cursor': 'в месте каретки',
  'settings.option.captured': 'где стояла каретка до записи',
  'settings.option.replace': 'заменить выделенное',
  'settings.presetCustom': 'Своя инструкция',
  'settings.preset': 'Задача полировки',
  'settings.presetPlain': 'Обычный текст',
  'settings.presetBusiness': 'Деловое письмо',
  'settings.presetNote': 'Рабочая заметка',
  'settings.presetMeeting': 'Протокол встречи',
  'settings.presetCode': 'Техническая речь',
  'settings.presetMessage': 'Сообщение в чат',
  'settings.presetClean': 'Только орфография',
  'settings.presetNoteLabel': 'Задача',
  'settings.presetHint': 'Выбор подставит готовую инструкцию в поле ниже — её можно править.',
  'settings.credentialPick': 'Выберите запись с ключом',
  'settings.prompt.plain': 'Ты — редактор расшифровки речи. Расставь знаки препинания и заглавные буквы, убери слова-заикания и повторы, не меняя смысл. Ничего не добавляй от себя. Верни только исправленный текст.',
  'settings.prompt.business': 'Ты — редактор деловой переписки. Приведи расшифровку к ясному деловому виду: убери разговорные обороты и воду, расставь знаки препинания, сохрани все факты, числа и имена. Верни только текст письма на языке исходника.',
  'settings.prompt.note': 'Ты — редактор рабочих заметок. Преврати расшифровку в короткую структурированную заметку: заголовок при необходимости, далее пункты списком. Сохрани все факты и имена, ничего не выдумывай. Верни только заметку.',
  'settings.prompt.meeting': 'Ты — секретарь встречи. Преврати расшифровку в протокол: решения, задачи с ответственными и сроками, открытые вопросы. Только то, что прозвучало; если данных для пункта нет — не выдумывай их. Верни только протокол.',
  'settings.prompt.code': 'Ты — редактор технической речи. Приведи расшифровку к техническому виду: имена функций, типов, команд и путей пиши так, как их принято писать в коде, английские термины не переводи. Сохрани смысл и порядок. Верни только текст.',
  'settings.prompt.message': 'Ты — редактор коротких сообщений. Сделай расшифровку коротким сообщением в мессенджер: без приветствий и подписи, одна мысль, живые формулировки, знаки препинания расставлены. Верни только сообщение.',
  'settings.prompt.clean': 'Ты — корректор. Исправь только орфографию, пунктуацию и согласование. Стиль, порядок слов и все формулировки оставь как в исходнике. Верни только исправленный текст.',
}

/**
 * Английский словарь.
 *
 * @type {Record<string, string>}
 */
export const en = {
  dictate: 'Dictation',
  'title.idle': 'Dictation: record and insert text',
  'title.busy': 'Recognising',

  'status.requesting': 'Requesting the microphone…',
  'status.recording': 'Speak… press again to stop',
  'status.unavailable': 'Microphone unavailable',
  'status.recognizing': 'Recognising…',


  'error.deniedDesktop': 'Microphone blocked. The host records audio — check that ffmpeg is available and the device is not busy.',
  'error.deniedSite': 'Microphone blocked. Allow microphone access in the site settings and try again.',
  'error.noDevice': 'No microphone found.',
  'error.busy': 'The microphone is busy in another application.',
  'error.unknown': 'Could not get access to the microphone.',
  'error.probeFailed': 'Microphone check failed: {message}',
  'error.unsupported': 'This browser cannot record audio — open the interface in a browser that supports the microphone.',

  'error.noInputActions': 'The composer provided no input actions — reload the page and try again.',
  'error.noSpan': 'Could not remember the cursor position: {message}',
  'error.noRecording': 'Could not start recording: {message}',

  'error.transcribeFailed': 'Could not recognise the speech.',
  'error.emptySpeech': 'No speech recognised — try again.',
  'error.insertRejected': 'The draft changed, so nothing was inserted to avoid overwriting what you typed.',
  'error.insertFailed': 'Could not insert — copy the text manually.',
  'error.noInputField': 'The input field is unavailable — copy the text.',

  'notice.copiedAddress': 'Address copied to the clipboard.',
  'notice.copiedText': 'Copied to the clipboard.',
  'status.inserted': 'Text inserted.',
  'hint.toggle': 'Press the microphone again to stop recording.',
  'hint.close': 'Press the microphone to close.',
  'meter.label': 'Microphone level',

  'settings.title': 'Voice settings',
  'settings.groupAsr': 'Recognition',
  'settings.groupPolish': 'Text polish',
  'settings.groupRecording': 'Microphone and recording',
  'settings.groupInsert': 'Insertion',
  'settings.groupUi': 'Interface',
  'settings.provider': 'Provider (credentials entry name)',
  'settings.asrModel': 'Recognition model',
  'settings.baseUrl': 'API address (empty — default)',
  'settings.language': 'Speech language',
  'settings.polishOn': 'Polish the recognised text',
  'settings.polishModel': 'Polish model',
  'settings.prompt': 'Editor instruction',
  'settings.promptPlaceholder': 'Empty — built-in plugin instruction',
  'settings.temperature': 'Polish temperature',
  'settings.device': 'Microphone (empty — system default)',
  'settings.maxSeconds': 'Recording limit, seconds',
  'settings.inputGain': 'Microphone gain',
  'settings.noise': 'Remove background rumble',
  'settings.insertMode': 'Insertion target (cursor / captured / replace)',
  'settings.preserveChips': 'Leave @file chips alone',
  'settings.browser': 'Show browser address on failure',
  'settings.confirm': 'Show text before insertion',
  'settings.save': 'Save',
  'settings.cancel': 'Cancel',
  'settings.close': 'Close',
  'settings.loading': 'Loading settings…',
  'settings.saveFailed': 'Could not save the settings.',
  'settings.modelPick': 'Choose a model',
  'settings.modelCustom': 'Custom model — type below',
  'settings.free': 'free',
  'settings.saved': 'Saved.',  'result.copyHint': 'Click to copy the text.',
  'settings.hintProvider': 'Name of the credential record in the DSH store. The key itself is entered in the Models section; only its name belongs here.',
  'settings.hintAsrModel': 'The model that turns the recording into text. Only the free ones from your setup are listed.',
  'settings.hintBaseUrl': 'Your own API address. Empty means the chosen provider\'s address is used.',
  'settings.hintLanguage': 'Speech language: ru, en and so on — a hint to the model about which language you speak.',
  'settings.hintPolishOn': 'Run the recognised text through a model to drop stumbles and place the punctuation.',
  'settings.hintPreset': 'A ready-made task for polishing. Choosing one fills the instruction field below.',
  'settings.hintPrompt': 'What exactly to do with the text. Empty means the plugin\'s built-in instruction.',
  'settings.hintTemperature': '0 keeps strictly to the text, higher gives freer wording. For dictation 0 is better.',
  'settings.hintDevice': 'Microphone name. Empty means the system default, which is usually what you want.',
  'settings.hintMaxSeconds': 'Recording stops on its own. A safeguard against a forgotten microphone.',
  'settings.hintInputGain': 'Recording volume multiplier. 1 is as-is, 2 is twice as loud. Helps on a quiet microphone.',
  'settings.hintNoise': 'Removes steady background: fan hum, street noise. Speech is left intact.',
  'settings.hintInsertMode': 'cursor — insert where the caret is. captured — where it was before recording. replace — overwrite the selection.',
  'settings.hintPreserveChips': 'Keep @file and @session mentions whole: they stay working links.',
  'settings.hintBrowser': 'On microphone failure, show the address that opens recording in a browser.',
  'settings.hintConfirm': 'Show the recognised text before inserting it, so it can be fixed or dropped.',
  'settings.option.cursor': 'at the caret',
  'settings.option.captured': 'where the caret was before recording',
  'settings.option.replace': 'replace the selection',
  'settings.presetCustom': 'Custom instruction',
  'settings.preset': 'Polishing task',
  'settings.presetPlain': 'Plain text',
  'settings.presetBusiness': 'Business letter',
  'settings.presetNote': 'Work note',
  'settings.presetMeeting': 'Meeting minutes',
  'settings.presetCode': 'Technical speech',
  'settings.presetMessage': 'Chat message',
  'settings.presetClean': 'Spelling only',
  'settings.presetNoteLabel': 'Task',
  'settings.presetHint': 'The choice fills the instruction field below — you can still edit it.',
  'settings.credentialPick': 'Choose a credential record',
  'settings.prompt.plain': 'You are a transcript editor. Add punctuation and capital letters, remove filler words and repetitions without changing the meaning. Add nothing of your own. Return only the corrected text.',
  'settings.prompt.business': 'You are a business correspondence editor. Turn the transcript into clear business prose: drop colloquialisms and filler, add punctuation, keep every fact, number and name. Return only the letter, in the language of the source.',
  'settings.prompt.note': 'You are a work-note editor. Turn the transcript into a short structured note: a heading if needed, then bullet points. Keep every fact and name, invent nothing. Return only the note.',
  'settings.prompt.meeting': 'You are a meeting secretary. Turn the transcript into minutes: decisions, tasks with owners and due dates, open questions. Only what was actually said; if there is no data for a point, do not invent it. Return only the minutes.',
  'settings.prompt.code': 'You are a technical speech editor. Turn the transcript into technical prose: write function, type, command and path names the way code does, and do not translate English terms. Keep the meaning and the order. Return only the text.',
  'settings.prompt.message': 'You are a short-message editor. Turn the transcript into a brief chat message: no greetings, no signature, one thought, natural wording, punctuation in place. Return only the message.',
  'settings.prompt.clean': 'You are a proofreader. Fix only spelling, punctuation and agreement. Keep the style, word order and every wording as in the source. Return only the corrected text.',
}

/**
 * Китайский словарь.
 *
 * Он не для Сергея, а для полноты пакета: `zh` — встроенная локаль DSH, и без
 * словаря весь интерфейс при китайском языке показался бы набором ключей.
 *
 * @type {Record<string, string>}
 */
export const zh = {
  dictate: '听写',
  'title.idle': '听写：录音并插入文字',
  'title.busy': '正在识别',

  'status.requesting': '正在请求麦克风…',
  'status.recording': '请说话…再次点击停止',
  'status.unavailable': '麦克风不可用',
  'status.recognizing': '正在识别…',


  'error.deniedDesktop': '麦克风被拒绝。录音由宿主进程完成 — 请检查 ffmpeg 是否可用、设备是否被占用。',
  'error.deniedSite': '麦克风被拒绝。请在站点设置中允许麦克风访问后重试。',
  'error.noDevice': '未找到麦克风。',
  'error.busy': '麦克风被其他程序占用。',
  'error.unknown': '无法获取麦克风访问权限。',
  'error.probeFailed': '麦克风检查失败：{message}',
  'error.unsupported': '此浏览器无法录音 — 请在支持麦克风的浏览器中打开。',

  'error.noInputActions': '输入栏未提供输入操作 — 请刷新页面后重试。',
  'error.noSpan': '无法记住光标位置：{message}',
  'error.noRecording': '无法开始录音：{message}',

  'error.transcribeFailed': '无法识别语音。',
  'error.emptySpeech': '未识别到语音 — 请重试。',
  'error.insertRejected': '草稿已更改，因此未插入，以免覆盖已输入的内容。',
  'error.insertFailed': '无法插入 — 请手动复制文本。',
  'error.noInputField': '输入框不可用 — 请复制文本。',

  'notice.copiedAddress': '地址已复制到剪贴板。',
  'notice.copiedText': '已复制到剪贴板。',
  'status.inserted': '文本已插入。',
  'hint.toggle': '再次点击麦克风结束录音。',
  'hint.close': '点击麦克风关闭。',
  'meter.label': '麦克风音量',

  'settings.title': '语音设置',
  'settings.groupAsr': '识别',
  'settings.groupPolish': '文本润色',
  'settings.groupRecording': '麦克风与录音',
  'settings.groupInsert': '插入位置',
  'settings.groupUi': '界面',
  'settings.provider': '提供方（凭据条目名）',
  'settings.asrModel': '识别模型',
  'settings.baseUrl': 'API 地址（留空为默认）',
  'settings.language': '语音语言',
  'settings.polishOn': '润色识别文本',
  'settings.polishModel': '润色模型',
  'settings.prompt': '编辑指令',
  'settings.promptPlaceholder': '留空则使用插件内置指令',
  'settings.temperature': '润色温度',
  'settings.device': '麦克风（留空为系统默认）',
  'settings.maxSeconds': '录音上限（秒）',
  'settings.inputGain': '麦克风增益',
  'settings.noise': '去除背景嗡鸣',
  'settings.insertMode': '插入位置（cursor / captured / replace）',
  'settings.preserveChips': '不触碰 @文件 标签',
  'settings.browser': '失败时显示浏览器地址',
  'settings.confirm': '插入前显示文本',
  'settings.save': '保存',
  'settings.cancel': '取消',
  'settings.close': '关闭',
  'settings.loading': '正在加载设置…',
  'settings.saveFailed': '无法保存设置。',
  'settings.modelPick': '选择模型',
  'settings.modelCustom': '自定义模型 — 在下方输入',
  'settings.free': '免费',
  'settings.saved': '已保存。',  'result.copyHint': '点击复制文本。',
  'settings.hintProvider': 'DSH 凭据存储中的记录名。密钥在「模型」页填写，这里只填其名称。',
  'settings.hintAsrModel': '把录音转成文字的模型。这里只列出已配置的免费模型。',
  'settings.hintBaseUrl': '自定 API 地址。留空则使用所选提供商的地址。',
  'settings.hintLanguage': '语音语言：ru、en 等，用来提示模型你说的是哪种语言。',
  'settings.hintPolishOn': '用模型处理识别结果，去掉口误并补上标点。',
  'settings.hintPreset': '现成的润色任务。选择后会填入下方指令框。',
  'settings.hintPrompt': '具体要对文本做什么。留空则使用插件内置指令。',
  'settings.hintTemperature': '0 表示严格贴原文，越大措辞越自由。听写建议 0。',
  'settings.hintDevice': '麦克风名称。留空使用系统默认，通常就够了。',
  'settings.hintMaxSeconds': '到时会自动停止录音，防止忘记关闭麦克风。',
  'settings.hintInputGain': '录音音量倍数。1 为原样，2 为两倍。麦克风偏轻时有用。',
  'settings.hintNoise': '去除稳定背景噪声：风扇声、街道噪声，不影响人声。',
  'settings.hintInsertMode': 'cursor 插在光标处；captured 插在开始录音时的位置；replace 覆盖选中内容。',
  'settings.hintPreserveChips': '不拆散 @文件 与 @会话 引用，保持为可用的链接。',
  'settings.hintBrowser': '麦克风失败时显示可在浏览器中录音的地址。',
  'settings.hintConfirm': '插入前先显示识别文本，可以修改或放弃。',
  'settings.option.cursor': '光标处',
  'settings.option.captured': '开始录音时的位置',
  'settings.option.replace': '替换选中内容',
  'settings.presetCustom': '自定义指令',
  'settings.preset': '润色任务',
  'settings.presetPlain': '普通文本',
  'settings.presetBusiness': '商务邮件',
  'settings.presetNote': '工作笔记',
  'settings.presetMeeting': '会议记录',
  'settings.presetCode': '技术用语',
  'settings.presetMessage': '聊天消息',
  'settings.presetClean': '仅改拼写',
  'settings.presetNoteLabel': '任务',
  'settings.presetHint': '选择后会填入下方指令框，仍可自行修改。',
  'settings.credentialPick': '选择凭据记录',
  'settings.prompt.plain': '你是语音转写编辑。加上标点和大小写，去掉口头语与重复，不改变原意，也不要自行添加内容。只返回修改后的文本。',
  'settings.prompt.business': '你是商务函件编辑。把转写整理成明确的商务表达：去掉口语与赘词，补上标点，保留全部事实、数字和人名。只返回函件正文，使用原文语言。',
  'settings.prompt.note': '你是工作笔记编辑。把转写整理成简短的结构化笔记：必要时加标题，其余用项目符号。保留全部事实与人名，不要臆造。只返回笔记。',
  'settings.prompt.meeting': '你是会议记录员。把转写整理成会议纪要：决议、带负责人与期限的任务、待定问题。只写实际说过的内容，材料不足就不要编。只返回纪要。',
  'settings.prompt.code': '你是技术语音编辑。把转写整理成技术表达：函数名、类型名、命令和路径按代码习惯书写，英文术语不翻译。保留含义与顺序。只返回文本。',
  'settings.prompt.message': '你是短消息编辑。把转写整理成一条聊天消息：不要称呼和落款，只表达一个意思，措辞自然，标点齐全。只返回消息。',
  'settings.prompt.clean': '你是校对员。只修正拼写、标点和一致性，风格、语序和所有措辞保持原样。只返回修正后的文本。',
}

/** Все словари по идентификаторам локалей. */
export const DICTIONARIES = { ru, en, zh }

/**
 * Переводчик по умолчанию: русский словарь.
 *
 * Объявлен здесь, а не в потребителях, потому что все модули сборки попадают в
 * один общий scope: два объявления с этим именем роняли бы весь бандл.
 * Нужен там, где настоящий `t` от рантайма ещё не пришёл — вызов из теста или
 * старая ревизия слота.
 *
 * @type {(key: string, vars?: Record<string, unknown>) => string}
 */
export const defaultTranslate = (key, vars) => {
  const text = ru[key]
  if (typeof text !== 'string') return key
  if (vars === undefined || vars === null) return text
  return text.replace(/\{(\w+)\}/g, (match, name) => {
    const value = vars[name]
    return value === undefined || value === null ? match : String(value)
  })
}

/**
 * Собирает переводчик поверх одного словаря.
 *
 * Подстановка `{name}` сделана вручную, а не регуляркой по строке: так
 * значение, содержащее фигурные скобки, не испортит разметку шаблона. Отсутствие
 * значения в `vars` оставляет плейсхолдер как есть — такой текст заметнее, чем
 * пустая строка, и виден в тестах.
 *
 * @param {Record<string, string>} [dict] - словарь (по умолчанию русский).
 * @returns {(key: string, vars?: Record<string, unknown>) => string} переводчик.
 */
export function createTranslate(dict = ru) {
  return (key, vars) => {
    const text = dict[key]
    if (typeof text !== 'string') return key
    if (vars === undefined || vars === null) return text
    return text.replace(/\{(\w+)\}/g, (match, name) => {
      const value = vars[name]
      return value === undefined || value === null ? match : String(value)
    })
  }
}