// Russian-localized DSH Agency Agents Plugin
// Entry point for @michengai/dsh-agency-agents-ru

// Locale will be loaded by the DSH framework
// This file registers the Russian-language plugin

// Export locale configuration for DSH framework
const ruLocale = {
  panel: {
    title: "Эксперты",
    tabs: {
      experts: "Эксперты",
      divisions: "Разделы",
      skills: "Навыки"
    },
    empty: {
      noExperts: "Нет включённых экспертов",
      enableSome: "Включите экспертов в настройках",
      noDivision: "В этом разделе нет экспертов"
    },
    search: {
      placeholder: "Поиск эксперта по имени, слагу или описанию…"
    },
    division: {
      all: "Все разделы"
    },
    expert: {
      conflict: "⚠ Конфликт имени",
      customBadge: "Свой",
      builtinBadge: "Встроенный"
    },
    asset: {
      download: "Скачать ресурсы",
      downloaded: "Ресурсы загружены",
      pending: "Загрузка…",
      failed: "Ошибка загрузки",
      size: "Размер: {{size}}"
    }
  },
  
  common: {
    enabled: "Включено",
    disabled: "Выключено",
    custom: "Свой",
    builtin: "Встроенный"
  },
  
  settings: {
    title: "Настройки Экспертов",
    enabled: "Включённые эксперты"
  },
  
  skills: {
    title: "Ворота навыков",
    description: "Отключите ненужные навыки, чтобы модели их не видели. Изменения вступают в силу сразу."
  },
  
  // 22 раздела
  divisions: {
    engineering: "Инженерия",
    design: "Дизайн",
    marketing: "Маркетинг",
    paid_media: "Платные медиа",
    sales: "Продажи",
    company: "Компания",
    finance: "Финансы",
    hr: "HR",
    legal: "Юриспруденция",
    supply_chain: "Снабжение",
    product: "Продукт",
    project_management: "Проектное управление",
    testing: "Тестирование",
    support: "Поддержка",
    security: "Безопасность",
    spatial_computing: "Пространственный вычисления",
    game_development: "Гейм-разработка",
    academic: "Академия",
    gis: "Геоинформационные системы",
    healthcare: "Медицина",
    research: "Исследования"
  },
  
  // 5 команд
  teams: {
    product_solution_review: "Команда по оценке продуктовых решений",
    technical_solution_review: "Команда по оценке технических решений",
    content_selection: "Команда по планированию контента",
    data_analysis: "Команда по диагностике данных",
    research: "Команда специалистов по исследованию"
  },
  
  // Статусы
  expert: {
    builtin: "Встроенный",
    custom: "Свой",
    enabled: "Включен",
    disabled: "Выключен"
  },
  
  batch_actions: {
    enable_filter: "Включить фильтр (N)",
    disable_filter: "Выключить фильтр (M)",
    enable_all: "Включить всех (331)",
    disable_all: "Выключить всех"
  },
  
  // Создание
  create_expert: "Создание эксперта",
  create_expert_team: "Создание экспертной команды",
  expert_name: "Имя эксперта",
  expert_slug: "Slug эксперта",
  expert_description: "Описание эксперта",
  expert_category: "Категория",
  expert_team: "Команда",
  
  // Действия
  save: "Сохранить",
  cancel: "Отмена",
  delete: "Удалить",
  edit: "Редактировать",
  copy: "Копировать",
  search_placeholder: "Поиск…",
  no_results: "Результаты не найдены",
  loading: "Загрузка",
  error_occurred: "Произошла ошибка",
  successfully_saved: "Успешно сохранено",
  confirm_delete: "Вы уверены, что хотите удалить?",
  are_you_sure: "Вы уверены?",
  
  // Ерайтинг режим
  create_with_ai: "Создать с помощью ИИ",
  expert_prompt_prefix: "Я хочу создать эксперта, специализирующийся на",
  team_prompt_prefix: "Помогите мне сформировать экспертную команду с задачей",
  
  // Название сессий (USER.md)
  session_name_format: "Иконка — 3–4 слова",
  session_name_placeholder: "Например: 'База radar-график'"
};

// Экспортируем для использования DSH framework
module.exports = ruLocale;