// Таблица стилей пакета.
//
// Цвета берутся из токенов темы DSH, а не задаются константами: иначе светлая
// и тёмная темы разойдутся. Каждое обращение к токену имеет запасное значение —
// имя токена может отличаться между версиями, и без запаса стиль потерял бы
// цвет целиком.

/** Имя таблицы: попадает в data-атрибут узла стиля для уборки и отладки. */
export const STYLE_NAME = 'voice-eternia'

/** Классы, по которым живёт разметка плагина. */
export const CLASSES = {
  actions: 'vet-actions',
  button: 'vet-button',
  panel: 'vet-panel',
  status: 'vet-status',
  dot: 'vet-dot',
  meter: 'vet-meter',
  meterFill: 'vet-meter__fill',
  histo: 'vet-histo',
  histoBar: 'vet-histo__bar',
  error: 'vet-error',
  hint: 'vet-hint',
  address: 'vet-address',
  result: 'vet-result',
  resultText: 'vet-result__text',
}

export const VOICE_ETERNIA_CSS = `
.vet-actions { display: inline-flex; align-items: center; gap: 4px; }

.vet-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-text-secondary, inherit);
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}
.vet-button:hover:not(:disabled) { background: var(--dsw-alias-bg-hover, rgba(127, 127, 127, 0.14)); }
.vet-button:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #4b7bec); outline-offset: 1px; }
.vet-button:disabled { opacity: 0.45; cursor: not-allowed; }
.vet-button[data-active="true"] { color: var(--dsw-alias-brand-primary, #4b7bec); background: var(--dsw-alias-bg-active, rgba(127, 127, 127, 0.2)); }
.vet-button[data-recording="true"] { color: var(--dsw-alias-status-danger, #e5484d); }

.vet-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid var(--dsw-alias-border-secondary, rgba(127, 127, 127, 0.25));
  border-radius: 8px;
  background: var(--dsw-alias-bg-secondary, rgba(127, 127, 127, 0.06));
  color: var(--dsw-alias-text-primary, inherit);
  font-size: 13px;
}
.vet-status { display: flex; align-items: center; gap: 8px; min-width: 0; }
.vet-status span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.vet-dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--dsw-alias-status-danger, #e5484d);
  animation: vet-pulse 1.2s ease-in-out infinite;
}
.vet-panel[data-state="busy"] .vet-dot { animation: none; background: var(--dsw-alias-brand-primary, #4b7bec); }
.vet-panel[data-state="error"] .vet-dot { animation: none; }

.vet-meter {
  height: 3px;
  overflow: hidden;
  border-radius: 2px;
  background: var(--dsw-alias-border-secondary, rgba(127, 127, 127, 0.25));
}
.vet-meter__fill {
  height: 100%;
  width: var(--vet-level, 0%);
  background: var(--dsw-alias-brand-primary, #4b7bec);
  transition: width 80ms linear;
}

/* Гистограмма голоса: полосы растут снизу вверх, как уровень в студии.
   Столбики без промежутков и с закруглением сверху — иначе ряд из двух
   десятков полос читается как сплошная полка, а рисунок голоса пропадает.
   Ширина полосы задана в em, а не в процентах: при 24 полосах процент дал бы
   дробную ширину, которую браузер округлял по-разному на разных экранах. */
.vet-histo {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 30px;
  padding: 0 1px;
}
.vet-histo__bar {
  flex: 1 1 0;
  min-width: 2px;
  height: var(--vet-band, 0%);
  min-height: 2px;
  border-radius: 2px 2px 0 0;
  background: var(--dsw-alias-brand-primary, #4b7bec);
  opacity: 0.85;
  transition: height 90ms linear;
}

.vet-error { margin: 0; color: var(--dsw-alias-status-danger, #e5484d); font-size: 12px; line-height: 1.4; }
.vet-hint { margin: 0; color: var(--dsw-alias-text-secondary, inherit); font-size: 12px; line-height: 1.4; }
/* Адрес обязан читаться и копироваться дословно: моноширинный шрифт, рамка и
   перенос по любому месту — иначе длинный хост режется или съезжает. */
.vet-address {
  display: block;
  margin: 0;
  padding: 4px 7px;
  border: 1px solid var(--dsw-alias-border-secondary, rgba(127, 127, 127, 0.25));
  border-radius: 5px;
  background: var(--dsw-alias-bg-secondary, rgba(127, 127, 127, 0.08));
  color: var(--dsw-alias-text-primary, inherit);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.4;
  overflow-wrap: anywhere;
  user-select: all;
}
.vet-result { display: flex; flex-direction: column; gap: 6px; }
.vet-result__text {
  margin: 0;
  max-height: 84px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 13px;
}


/* Выпадающее окно настроек живёт в верхнем слоре оболочки: затемнение и
   карточка по центру, ширина ограничена, тело прокручивается. */
.vet-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  padding: 18px 20px;
  box-sizing: border-box;
  overflow-y: auto;
}
/* Настройки разделены по смыслу на две колонки: слева диктовка, справа
   разговор. Колонок ровно две, а не «сколько влезет»: auto-fit на широком окне
   разворачивал все группы в один ряд, и карточки сжимались до нечитаемой полосы.
   Ниже 900px остаётся одна колонка — там две уже не помещаются. */
.vet-page__groups {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  align-items: start;
  max-width: 1200px;
}
@media (max-width: 900px) {
  .vet-page__groups { grid-template-columns: minmax(0, 1fr); }
}
/* Колонка — это «Диктовка» или «Разговор». Заголовок заметно крупнее названий
   групп внутри: иначе семь одинаковых подзаголовков читаются как список без
   смысла, и человек не видит, где кончается диктовка и начинается разговор. */
.vet-page__column {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.vet-page__columnTitle {
  margin: 0;
  padding: 0 2px 6px;
  border-bottom: 1px solid var(--vet-border, rgba(128, 128, 128, 0.28));
  font-size: 13px;
  font-weight: 650;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--vet-dim, rgba(128, 128, 128, 1));
}
/* Шапка липкая: настройки занимают два экрана, и кнопка сохранения внизу
   была недостижима, пока человек её не доскроллит. Здесь она всегда на виду.
   Фон обязателен — иначе при прокрутке сквозь шапку просвечивают заголовки
   групп, и рядом с названием появляется чужой текст.

   Отступ справа — не украшение: в правом верхнем углу окна живут кнопки
   свернуть/развернуть/закрыть, и шапка с фоном накрывала их. Именно margin,
   а не padding: отступ внутри элемента окрашивается его фоном и до угла не
   дотягивается — закрывать системные кнопки он перестал бы только визуально,
   продолжая ловить на них щелчки. */
.vet-page__head {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-right: 104px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--dsw-alias-border-secondary, rgba(127, 127, 127, 0.2));
  background: var(--dsw-alias-surface-primary, Canvas);
}
/* Узкое окно: там зона оконных кнопок уже, но освобождать её всё равно нужно —
   на них накладывался не только фон, но и сам клик по кнопке сохранения. */
@media (max-width: 760px) {
  .vet-page__head { margin-right: 84px; }
}
/* Подпись о сохранении живёт под шапкой: кнопка уехала наверх, и если оставить
   подпись на прежнем месте, она оказалась бы под кнопкой, а не под полями, и
   человек не видел бы, что изменения уже записаны. Разбор ошибки — ниже, у
   второго правила того же класса. */
.vet-page__saved {
  margin: 0;
  font-size: 12px;
  opacity: 0.75;
  align-self: flex-start;
}
.vet-page__title { margin: 0; font-size: 16px; font-weight: 600; }
.vet-page__close {
  padding: 6px 14px;
  border: 1px solid var(--dsw-alias-border-secondary, rgba(127, 127, 127, 0.3));
  border-radius: 7px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.vet-page__note { opacity: 0.7; font-size: 13px; }
.vet-page__group {
  padding: 14px 16px;
  border: 1px solid var(--dsw-alias-border-secondary, rgba(127, 127, 127, 0.2));
  border-radius: 10px;
  min-width: 0;
}
.vet-page__groupTitle {
  margin: 0 0 10px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.6;
}
.vet-page__field {
  display: grid;
  /* Подпись слева, значение справа, подсказка — во всю ширину под ними.
     Колонка подписи узкая: в две колонки окна широкая подпись съедала бы поле. */
  grid-template-columns: minmax(120px, 40%) 1fr;
  align-items: start;
  gap: 6px 10px;
  padding: 6px 0;
  font-size: 13px;
  min-width: 0;
}
/* Подсказка идёт третьей строкой и занимает обе колонки: иначе она встала бы
   в колонку значения и сломала выравнивание соседних полей. */
.vet-page__hint { grid-column: 1 / -1; }
.vet-page__label { opacity: 0.85; padding-top: 6px; }
.vet-page__field input[type="text"],
.vet-page__field input[type="number"],
.vet-page__field textarea {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--dsw-alias-border-secondary, rgba(127, 127, 127, 0.35));
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 13px;
  box-sizing: border-box;
}
.vet-page__field textarea { resize: vertical; min-height: 76px; font-family: inherit; }
.vet-page__field input[type="checkbox"] { justify-self: start; width: 16px; height: 16px; margin-top: 7px; }
.vet-page__field input:focus-visible,
.vet-page__field textarea:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary, #4b7bec);
  outline-offset: 1px;
}
.vet-page__error {
  max-width: 640px;
  margin: 0 0 12px;
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(220, 60, 60, 0.12);
  color: #b3261e;
  font-size: 12px;
}
.vet-page__model {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.vet-page__select {
  width: 100%;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid var(--dsh-border, rgba(128, 128, 128, 0.35));
  border-radius: 8px;
  background: var(--dsh-surface, transparent);
  color: inherit;
  font: inherit;
}
.vet-page__modelText {
  font-size: 0.9em;
  opacity: 0.85;
}


/* Подсказка под полем. Мелкая и приглушённая: она объясняет, но не спорит
   с самим значением за внимание. */
.vet-page__hint {
  display: block;
  margin-top: 2px;
  font-size: 0.82em;
  line-height: 1.35;
  opacity: 0.7;
  max-width: 34em;
}

/* Контейнера подвала больше нет: кнопка сохранения переехала в шапку, и пустое
   правило осталось бы в коде вводящим в заблуждение — будто подвал существует. */
.vet-page__save {
  padding: 8px 18px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: var(--dsw-alias-brand-primary, #4b7bec);
  color: #fff;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.vet-page__save:disabled { opacity: 0.55; cursor: default; }
`
