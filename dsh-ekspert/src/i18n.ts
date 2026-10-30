// Интернационализация: русский язык по умолчанию, английский как фолбэк.
export const NS = "eksTeam";

const dict: Record<string, Record<string, string>> = {
  ru: {
    // Общие
    "common.enabled": "Включено",
    "common.disabled": "Выключено",
    "common.custom": "Свой",
    "common.builtin": "Встроенный",
    "common.division": "Раздел",
    "common.expert": "Эксперт",
    "common.experts": "Эксперты",
    "common.total": "Всего",
    "common.search": "Поиск",
    "common.filter": "Фильтр",
    "common.clear": "Очистить",
    "common.save": "Сохранить",
    "common.cancel": "Отмена",
    "common.delete": "Удалить",
    "common.edit": "Редактировать",
    "common.create": "Создать",
    "common.name": "Имя",
    "common.description": "Описание",
    "common.emoji": "Эмодзи",
    "common.slug": "Слаг",
    "common.persona": "Персона",
    "common.skills": "Навыки",
    "common.assets": "Ресурсы",
    "common.ready": "Готово",
    "common.pending": "В процессе",
    "common.failed": "Ошибка",
    "common.local": "Локально",
    "common.downloading": "Загрузка",
    "common.error": "Ошибка",
    "common.success": "Успех",
    "common.warning": "Предупреждение",
    "common.info": "Информация",

    // Панель экспертов
    "panel.title": "Эксперты",
    "panel.tabs.experts": "Эксперты",
    "panel.tabs.divisions": "Разделы",
    "panel.tabs.skills": "Навыки",
    "panel.empty.noExperts": "Нет включённых экспертов",
    "panel.empty.enableSome": "Включите экспертов в настройках",
    "panel.empty.noDivision": "В этом разделе нет экспертов",
    "panel.search.placeholder": "Поиск эксперта по имени, слагу или описанию…",
    "panel.division.all": "Все разделы",
    "panel.expert.conflict": "⚠ Конфликт имени",
    "panel.expert.customBadge": "Свой",
    "panel.expert.builtinBadge": "Встроенный",
    "panel.asset.download": "Скачать ресурсы",
    "panel.asset.downloaded": "Ресурсы загружены",
    "panel.asset.pending": "Загрузка…",
    "panel.asset.failed": "Ошибка загрузки",
    "panel.asset.size": "Размер: {{size}}",

    // Настройки
    "settings.title": "Настройки Экспертов",
    "settings.enabled": "Включённые эксперты",
    "settings.enabledDesc": "Список слагов экспертов, доступных для вызова через @ меню и инструменты.",
    "settings.seedVersion": "Версия автовключения",
    "settings.seedRoster": "База автовключения",
    "settings.maxSummonBatch": "Макс. экспертов за раз",
    "settings.summonConcurrency": "Параллельность вызова",
    "settings.summonTaskMaxChars": "Макс. длина задачи",
    "settings.descriptionLimit": "Лимит описания в списке",
    "settings.summonAssetsWaitMs": "Ожидание ресурсов (мс)",
    "settings.skillGateStore": "Хранилище ворот навыков",
    "settings.root": "Корень каталога",
    "settings.zhRoot": "Корень русскоязычного каталога",
    "settings.customRoot": "Корень своих экспертов",
    "settings.provider": "Провайдер под-агентов",
    "settings.divisions": "Разделы (пусто = авто)",
    "settings.maxDepth": "Макс. глубина под-агента",

    // Ошибки
    "error.settingsServiceMissing": "Сервис настроек недоступен — включение/выключение экспертов не работает",
    "error.settingsMissing": "Настройки не найдены (ревизия отсутствует)",
    "error.taskEmpty": "Задача не может быть пустой",
    "error.taskTooLong": "Задача слишком длинная (лимит {{limit}} символов)",
    "error.summonRequiresAgent": "Вызов требует идентификатор агента запуска",
    "error.providerMissing": "Провайдер под-агентов «{{provider}}» не зарегистрирован",
    "error.providerNoPersona": "Провайдер «{{provider}}» не поддерживает персоны",
    "error.providerNoToolFilter": "Провайдер «{{provider}}» не поддерживает фильтрацию инструментов",
    "error.providerNoMaxDepth": "Провайдер «{{provider}}» не поддерживает ограничение глубины",
    "error.expertDisabled": "Эксперт «{{name}}» выключен — включите его в настройках Экспертов",
    "error.customUnknownSlug": "Неизвестные свои эксперты: {{slugs}}",
    "error.specsEmpty": "Список экспертов для вызова пуст",
    "error.specsTooMany": "Слишком много экспертов за раз (лимит {{limit}})",
    "error.specInvalid": "Некорректная спецификация эксперта #{{index}}",
    "error.subagentsApiMismatch": "API под-агентов не совпадает: доступные методы — {{keys}}",
    "error.rootMissing": "Каталог экспертов не найден: {{path}}",

    // Вызов эксперта
    "summon.started": "🚀 Запущен эксперт «{{expert}}»{{assets}}",
    "summon.assetsReady": " (ресурсы {{size}} готовы)",
    "summon.assetsPending": " (ресурсы {{size}} загружаются в фоне)",
    "summon.assetsLocal": " (ресурсов нет — всё локально)",
    "summon.assetsPendingNote": "Ресурсы {{size}} загружаются в фоне",

    // Инструменты
    "tool.list.description": "Список включённых экспертов Эксперт, сгруппированных по разделам. Без фильтра возвращает названия разделов и количества; передайте раздел, чтобы раскрыть его с именами, слагами и описаниями. Используйте только для ПОИСКА эксперта, когда пользователь не назвал ни одного; если пользователь уже назвал эксперта (чип @Имя в начале или явное имя/слаг), пропустите этот шаг и вызовите summon_ekspert напрямую.",
    "tool.summon.description": "Вызывает одного эксперта Эксперт для выполнения задачи. Специализированный под-агент стартует с полной персоной эксперта и работает в собственном контексте. Этот вызов возвращается СРАЗУ после старта эксперта — он НЕ ждёт ответа. Результат придёт позже как уведомление о завершении, поэтому НЕ пишите никакого подтверждения после этого вызова — завершите ход прямо здесь, без текста. Когда придёт уведомление о завершении, выдайте результат эксперта ОДНИМ ЕДИНСТВЕННЫМ СООБЩЕНИЕМ. Пользователь явно не хочет, чтобы вызов разделялся на подтверждение плюс позже результат. Если пользователь уже назвал эксперта (ведущий чип @ИмяЭксперта или явное имя/слаг где угодно в тексте), вызовите его сразу — поиск через list_ekspert не нужен. Вызывайте list_ekspert только когда эксперт не назван.",
    "tool.summon_batch.description": "Вызывает несколько экспертов Эксперт параллельно для одной миссии. Одновременно стартует до {{maxBatch}} экспертов с параллельностью {{concurrency}}; неудачные запуски сообщаются по отдельности, остальные продолжают работу. Этот вызов возвращается СРАЗУ после старта экспертов — он НЕ ждёт их ответов. Результаты придут позже как уведомления о завершении, поэтому не вызывайте это и не ждите в том же ходе. Каждый эксперт обычно заранее назван вызывающим (чип @ в компоузере или явное @ИмяЭксперта где угодно в тексте — включая сохранённый промпт извне) — если так, вызывайте напрямую без list_ekspert; вызывайте list_ekspert только когда ни один эксперт не назван.",
    "tool.fetch_assets.description": "Скачивает сопутствующие ресурсы эксперта (навыки, справочники, данные) из облака и распаковывает локально, возвращая корневой путь ресурсов. Персона эксперта ВСЕГДА доступна локально — только большие вложения скачиваются по требованию, и вызов эксперта уже запускает эту загрузку в фоне. Вызывайте, когда нужны навыки или файлы данных эксперта, а чтение с диска не удаётся (файл не найден). Эксперты с малыми вложениями поставляются целиком внутри пакета, и для них это сразу возвращает статус «local» — качать нечего.",

    // Рендер списка
    "render.list.noEnabled": "Нет включённых экспертов. Включите их в настройках Экспертов.",
    "render.list.divisionHeader": "📁 {{label}} ({{count}})",
    "render.list.expertLine": "  {{emoji}} {{name}} (`{{slug}}`) — {{description}}",
    "render.list.customBadge": " [Свой]",
    "render.list.conflictBadge": " [⚠ Конфликт]",

    // Рендер результатов пакетного вызова
    "render.batch.started": "🚀 Запущено {{count}} экспертов:",
    "render.batch.line.ok": "  ✅ {{expert}} — стартовал (subagent: {{subagentId}})",
    "render.batch.line.fail": "  ❌ {{expert}} — ошибка запуска: {{error}}",

    // Системный промпт
    "system.scope": "Родительская сессия имеет Эксперт — каталог из {{experts}} экспертов в {{divisions}} разделах с полной русскоязычной локализацией, доступных как вызываемые предметные эксперты.",
    "system.enabled": "Эксперты включаются/выключаются во вкладке настроек Эксперт; по умолчанию все включены, выключенный эксперт нельзя вызвать.",
    "system.composer": "Выбор в компоузере вставляет одного включённого эксперта как нативный чип-ссылку; остальной текст черновика становится задачей этого эксперта. Чип приходит к вам как обычный текст `@ИмяЭксперта` в начале сообщения пользователя — ЭТО И ЕСТЬ ВЫБОР ПОЛЬЗОВАТЕЛЯ, и имя как написано достаточно (резолвер принимает русское отображаемое имя, английское имя или слаг, и терпит префикс-эмодзи).",
    "system.async": "Вызов АСИНХРОННЫЙ на этом хосте: `summon_ekspert` / `summon_eksperts` стартуют эксперта и возвращаются сразу с его subagentId — они НЕ возвращают ответ эксперта. Результат приходит позже как уведомление о завершении в этом диалоге. ПОСЛЕ ВЫЗОВА НЕ ОТПРАВЛЯЙТЕ НИКАКОГО ПОДТВЕРЖДЕНИЯ И НЕ ЖДИТЕ: ЗАВЕРШИТЕ ХОД ТИХО ПРЯМО ПОСЛЕ ВЫЗОВА ИНСТРУМЕНТА (карточка инструмента уже показывает вызов). Когда придёт уведомление о завершении, выдайте результат эксперта ОДНИМ ЕДИНСТВЕННЫМ СООБЩЕНИЕМ — никогда не разбивайте вызов на подтверждение плюс позже результат.",
    "system.named": "Когда сообщение пользователя уже называет эксперта — ведущий чип `@ИмяЭксперта` или явное имя/слаг в тексте — вызывайте `summon_ekspert` ПЕРВЫМ с этим именем. НЕ вызывайте `list_ekspert` для подтверждения или уточнения имени: поиск стоит два лишних круга и не меняет, какой эксперт запустится.",
    "system.discovery": "Только когда пользователь НЕ назвал эксперта, найдите одного: вызовите `list_ekspert()` для включённых названий разделов и количеств, затем `list_ekspert(division)` чтобы раскрыть нужный раздел, затем `summon_ekspert(эксперт, задача)` — или `summon_eksperts` для параллельной группы (не более {{maxBatch}} за раз; неудачные запуски сообщаются по отдельности, остальные продолжают работу).",

    // Создание/редактирование эксперта
    "create.title": "Новый свой эксперт",
    "create.division": "Раздел",
    "create.divisionPlaceholder": "Напр. my-ai, my-research…",
    "create.name": "Имя (рус.)",
    "create.nameEn": "Имя (англ.)",
    "create.description": "Описание (рус.)",
    "create.descriptionEn": "Описание (англ.)",
    "create.emoji": "Эмодзи",
    "create.slug": "Слаг (авто из имени)",
    "create.persona": "Персона (системный промпт эксперта)",
    "create.personaPlaceholder": "Полный системный промпт для эксперта…",
    "create.success": "Эксперт создан: {{division}}/{{slug}}",
    "create.error.exists": "Эксперт с таким слагом уже существует",
    "create.error.invalidDivision": "Неверное имя раздела (только буквы, цифры, дефис)",
    "create.error.invalidSlug": "Неверный слаг (только буквы, цифры, дефис)",

    // Редактирование раздела
    "division.create.title": "Новый раздел",
    "division.create.name": "Ключ раздела",
    "division.create.label": "Название (рус.)",
    "division.create.labelEn": "Название (англ.)",
    "division.update.title": "Редактировать раздел",
    "division.delete.title": "Удалить раздел",
    "division.delete.confirm": "Удалить раздел «{{division}}» и всех его экспертов? Это действие необратимо.",
    "division.error.notEmpty": "Раздел не пуст — сначала удалите или перенесите экспертов",
    "division.error.builtin": "Нельзя удалить встроенный раздел",

    // Навыки
    "skills.title": "Ворота навыков",
    "skills.description": "Отключите ненужные навыки, чтобы модели их не видели. Изменения вступают в силу сразу.",
    "skills.empty": "Нет зарегистрированных навыков",
    "skills.toggleOn": "Включить",
    "skills.toggleOff": "Выключить",

    // Загрузка ресурсов
    "assets.fetching": "Загрузка ресурсов эксперта «{{expert}}»…",
    "assets.ready": "Ресурсы эксперта «{{expert}}» готовы ({{bytes}} байт).\nКаталог: {{root}}\nДоступные папки: {{dirs}}",
    "assets.local": "У эксперта «{{expert}}» нет облачных ресурсов — всё содержимое (включая навыки и справочники) уже локально.\nКаталог: {{root}}",
    "assets.failed": "Загрузка ресурсов эксперта «{{expert}}» не удалась: {{reason}}\nПерсона не затронута, эксперт рабочий; но шаги, зависящие от навыков или файлов данных, сейчас сделать нельзя — скажите пользователю честно, не притворяйтесь, что читали эти файлы.",
  },

  en: {
    "common.enabled": "Enabled",
    "common.disabled": "Disabled",
    "common.custom": "Custom",
    "common.builtin": "Built-in",
    "common.division": "Division",
    "common.expert": "Expert",
    "common.experts": "Experts",
    "common.total": "Total",
    "common.search": "Search",
    "common.filter": "Filter",
    "common.clear": "Clear",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.create": "Create",
    "common.name": "Name",
    "common.description": "Description",
    "common.emoji": "Emoji",
    "common.slug": "Slug",
    "common.persona": "Persona",
    "common.skills": "Skills",
    "common.assets": "Assets",
    "common.ready": "Ready",
    "common.pending": "Pending",
    "common.failed": "Failed",
    "common.local": "Local",
    "common.downloading": "Downloading",
    "common.error": "Error",
    "common.success": "Success",
    "common.warning": "Warning",
    "common.info": "Info",

    "panel.title": "Experts",
    "panel.tabs.experts": "Experts",
    "panel.tabs.divisions": "Divisions",
    "panel.tabs.skills": "Skills",
    "panel.empty.noExperts": "No enabled experts",
    "panel.empty.enableSome": "Enable experts in settings",
    "panel.empty.noDivision": "No experts in this division",
    "panel.search.placeholder": "Search expert by name, slug or description…",
    "panel.division.all": "All divisions",
    "panel.expert.conflict": "⚠ Name conflict",
    "panel.expert.customBadge": "Custom",
    "panel.expert.builtinBadge": "Built-in",
    "panel.asset.download": "Download assets",
    "panel.asset.downloaded": "Assets downloaded",
    "panel.asset.pending": "Downloading…",
    "panel.asset.failed": "Download failed",
    "panel.asset.size": "Size: {{size}}",

    "settings.title": "Expert Settings",
    "settings.enabled": "Enabled experts",
    "settings.enabledDesc": "List of expert slugs available for summoning via @ menu and tools.",
    "settings.seedVersion": "Auto-enable version",
    "settings.seedRoster": "Auto-enable baseline",
    "settings.maxSummonBatch": "Max experts per batch",
    "settings.summonConcurrency": "Summon concurrency",
    "settings.summonTaskMaxChars": "Max task length",
    "settings.descriptionLimit": "Description limit in list",
    "settings.summonAssetsWaitMs": "Assets wait timeout (ms)",
    "settings.skillGateStore": "Skill gate store path",
    "settings.root": "Catalog root",
    "settings.zhRoot": "Localized catalog root",
    "settings.customRoot": "Custom experts root",
    "settings.provider": "Subagent provider",
    "settings.divisions": "Divisions (empty = auto)",
    "settings.maxDepth": "Max subagent depth",

    "error.settingsServiceMissing": "Settings service unavailable — expert enable/disable not working",
    "error.settingsMissing": "Settings not found (revision missing)",
    "error.taskEmpty": "Task cannot be empty",
    "error.taskTooLong": "Task too long (limit {{limit}} chars)",
    "error.summonRequiresAgent": "Summon requires launch agent id",
    "error.providerMissing": "Subagent provider «{{provider}}» not registered",
    "error.providerNoPersona": "Provider «{{provider}}» does not support persona",
    "error.providerNoToolFilter": "Provider «{{provider}}» does not support tool filtering",
    "error.providerNoMaxDepth": "Provider «{{provider}}» does not support max depth",
    "error.expertDisabled": "Expert «{{name}}» is disabled — enable it in Expert settings",
    "error.customUnknownSlug": "Unknown custom experts: {{slugs}}",
    "error.specsEmpty": "Expert list for summoning is empty",
    "error.specsTooMany": "Too many experts at once (limit {{limit}})",
    "error.specInvalid": "Invalid expert spec #{{index}}",
    "error.subagentsApiMismatch": "Subagents API mismatch: available methods — {{keys}}",
    "error.rootMissing": "Experts catalog not found: {{path}}",

    "summon.started": "🚀 Started expert «{{expert}}»{{assets}}",
    "summon.assetsReady": " (assets {{size}} ready)",
    "summon.assetsPending": " (assets {{size}} downloading in background)",
    "summon.assetsLocal": " (no assets — all local)",
    "summon.assetsPendingNote": "Assets {{size}} downloading in background",

    "tool.list.description": "List enabled Эксперт domain experts grouped by division. Without a division filter it returns division names and counts; pass a division to expand it with expert names, slugs and descriptions. Use this only to DISCOVER an expert when the user named none; if the user already named one (a leading @Expert chip, or an explicit name/slug), skip this and call summon_ekspert directly.",
    "tool.summon.description": "Summon one Эксперт domain expert to work on a task. A specialist subagent starts with that expert's full persona and works in its own context. This call returns as soon as the expert has started — it does NOT wait for the answer. The expert's result arrives later as a completion notice, so do NOT write any acknowledgement after this call — end your turn right here, without text. When the completion notice arrives, deliver the expert's result as ONE SINGLE MESSAGE. The user explicitly does not want a summon split into an acknowledgement plus a later result. If the user already named the expert (a leading @Expert chip, or an explicit name/slug anywhere in the text), summon it right away — no list_ekspert lookup is needed. Call list_ekspert only when no expert is named.",
    "tool.summon_batch.description": "Summon multiple Эксперт experts in parallel for one mission. At most {{maxBatch}} experts start with concurrency {{concurrency}}; experts that fail to start are reported individually while the rest keep running. This call returns as soon as the experts have started — it does NOT wait for their answers. Results arrive later as completion notices, so do not call this and then idle waiting in the same turn. Each expert is usually pre-named by the caller (a composer @ chip, or an explicit @ExpertName anywhere in the text — including a stored prompt from elsewhere) — when so, summon directly without list_ekspert; only call list_ekspert when no expert is named.",
    "tool.fetch_assets.description": "Download a Эксперт expert's companion assets (its skills, references and data files) from the cloud and unpack them locally, returning the resource root path. The expert's persona is ALWAYS available locally — only large attachments are fetched on demand, and summoning an expert already kicks off that download in the background. Call this when you need an expert's skill or reference files and reading them from disk fails (file not found). Experts whose attachments are small ship entirely inside the package, and for those this returns immediately with status \"local\" — nothing to download.",

    "render.list.noEnabled": "No enabled experts. Enable them in Expert settings.",
    "render.list.divisionHeader": "📁 {{label}} ({{count}})",
    "render.list.expertLine": "  {{emoji}} {{name}} (`{{slug}}`) — {{description}}",
    "render.list.customBadge": " [Custom]",
    "render.list.conflictBadge": " [⚠ Conflict]",

    "render.batch.started": "🚀 Started {{count}} experts:",
    "render.batch.line.ok": "  ✅ {{expert}} — started (subagent: {{subagentId}})",
    "render.batch.line.fail": "  ❌ {{expert}} — start failed: {{error}}",

    "system.scope": "The parent session has Эксперт — a {{experts}}-expert, {{divisions}}-division roster with full Russian localization, exposed as summonable domain experts.",
    "system.enabled": "Experts are enabled/disabled in the Эксперт settings tab; all experts are enabled by default and a disabled expert cannot be summoned.",
    "system.composer": "A composer selection inserts one enabled expert as a native reference chip; the remaining draft text is that expert's task. The chip reaches you as plain text @ExpertName at the head of the user's message — that IS the user's selection, and the name as written is enough (the resolver accepts the Russian display name, the English name or the slug, and tolerates an emoji prefix).",
    "system.async": "Summoning is ASYNCHRONOUS on this host: `summon_ekspert` / `summon_eksperts` start the expert and return immediately with its subagentId — they do NOT return the expert's answer. The result arrives later as a completion notice in this conversation. AFTER A SUMMON, DO NOT SEND ANY ACKNOWLEDGEMENT AND DO NOT IDLE-WAIT: END THE TURN SILENTLY RIGHT AFTER THE TOOL CALL (the tool card itself already shows the summon). When the completion notice arrives, deliver the expert's result as ONE SINGLE MESSAGE — never split a summon into an acknowledgement plus a later result.",
    "system.named": "When the user's message already names the expert — a leading @ExpertName chip, or an explicit name/slug in the text — call `summon_ekspert` FIRST with that name. Do NOT call `list_ekspert` to confirm or spell the name: the lookup costs two extra round trips and does not change which expert runs.",
    "system.discovery": "Only when the user named no expert, discover one first: call `list_ekspert()` for enabled division names and counts, then `list_ekspert(division)` to expand the relevant division, then `summon_ekspert(expert, task)` — or `summon_eksperts` for a parallel group (at most {{maxBatch}} at a time; experts that fail to start are reported individually while the rest keep running).",

    "create.title": "New Custom Expert",
    "create.division": "Division",
    "create.divisionPlaceholder": "e.g. my-ai, my-research…",
    "create.name": "Name (RU)",
    "create.nameEn": "Name (EN)",
    "create.description": "Description (RU)",
    "create.descriptionEn": "Description (EN)",
    "create.emoji": "Emoji",
    "create.slug": "Slug (auto from name)",
    "create.persona": "Persona (expert system prompt)",
    "create.personaPlaceholder": "Full system prompt for the expert…",
    "create.success": "Expert created: {{division}}/{{slug}}",
    "create.error.exists": "Expert with this slug already exists",
    "create.error.invalidDivision": "Invalid division name (letters, digits, dash only)",
    "create.error.invalidSlug": "Invalid slug (letters, digits, dash only)",

    "division.create.title": "New Division",
    "division.create.name": "Division key",
    "division.create.label": "Label (RU)",
    "division.create.labelEn": "Label (EN)",
    "division.update.title": "Edit Division",
    "division.delete.title": "Delete Division",
    "division.delete.confirm": "Delete division «{{division}}» and all its experts? This cannot be undone.",
    "division.error.notEmpty": "Division not empty — delete or move experts first",
    "division.error.builtin": "Cannot delete built-in division",

    "skills.title": "Skill Gates",
    "skills.description": "Disable unused skills so models don't see them. Changes take effect immediately.",
    "skills.empty": "No registered skills",
    "skills.toggleOn": "Enable",
    "skills.toggleOff": "Disable",

    "assets.fetching": "Fetching assets for expert «{{expert}}»…",
    "assets.ready": "Expert «{{expert}}» assets ready ({{bytes}} bytes).\nRoot: {{root}}\nAvailable dirs: {{dirs}}",
    "assets.local": "Expert «{{expert}}» has no cloud assets — all content (including skills and references) is already local.\nRoot: {{root}}",
    "assets.failed": "Expert «{{expert}}» asset fetch failed: {{reason}}\nPersona unaffected, expert still usable; but steps depending on that expert's skills or data files cannot be done right now — tell the user honestly, don't pretend you read those files.",
  },
};

/** Текущий язык (по умолчанию ru). */
let currentLocale = "ru";

/** Устанавливает текущий язык. */
export function setLocale(locale: string): void {
  currentLocale = locale;
}

/** Получает текущий язык. */
export function getLocale(): string {
  return currentLocale;
}

/** Читает язык из контекста Cordis. */
export function readLocale(ctx: { get?: (name: string) => any; locale?: string }): string {
  return ctx.locale || ctx.get?.("locale")?.() || currentLocale;
}

/** Получает перевод. */
export function t(locale: string, key: string, params?: Record<string, string | number | undefined>): string {
  const lang = dict[locale] ? locale : "en";
  let text = dict[lang][key] || dict.en[key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), String(v));
    }
  }
  return text;
}

/** Рендерит список экспертов. */
export function renderList(args: { division?: string }, value: {
  divisions: Array<{ division: string; label: string; labelEn: string; count: number; experts: any[] }>;
  total: number;
  locale: string;
  query: string;
  allDivisions: string[];
}): string {
  const locale = value.locale;
  if (value.total === 0) return t(locale, "render.list.noEnabled");

  const lines: string[] = [];
  for (const group of value.divisions) {
    const label = locale === "ru" ? group.label : group.labelEn;
    lines.push(t(locale, "render.list.divisionHeader", { label, count: group.count }));
    for (const expert of group.experts) {
      let line = t(locale, "render.list.expertLine", {
        emoji: expert.emoji,
        name: expert.name,
        slug: expert.slug,
        description: expert.description,
      });
      if (expert.custom) line += t(locale, "render.list.customBadge");
      if (expert.conflict) line += t(locale, "render.list.conflictBadge");
      lines.push(line);
    }
  }
  return lines.join("\n");
}

/** Рендерит результаты пакетного вызова. */
export function renderSummonResults(args: { experts: any[] }, value: {
  results: Array<{ expert: string; ok: boolean; subagentId: string; error?: string }>;
  locale: string;
}): string {
  const locale = value.locale;
  const lines = [t(locale, "render.batch.started", { count: value.results.length })];
  for (const result of value.results) {
    if (result.ok) {
      lines.push(t(locale, "render.batch.line.ok", { expert: result.expert, subagentId: result.subagentId }));
    } else {
      lines.push(t(locale, "render.batch.line.fail", { expert: result.expert, error: result.error }));
    }
  }
  return lines.join("\n");
}

/** Преобразует группы в рендерируемый формат. */
export function toRenderableGroups(groups: any[], locale: string): any[] {
  return groups.map((group) => ({
    ...group,
    label: locale === "ru" ? group.label : group.labelEn,
    experts: group.experts.map((e: any) => ({
      ...e,
      name: locale === "ru" && e.nameZh ? e.nameZh : e.name,
      description: locale === "ru" && e.descriptionZh ? e.descriptionZh : e.description,
    })),
  }));
}

/** Преобразует результаты вызова в рендерируемый формат. */
export function toRenderableSummonResults(results: any[], locale: string): any[] {
  return results.map((r) => ({
    ...r,
    expert: r.expert,
  }));
}