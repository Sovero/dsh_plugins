# 🗂️ Этап 2. Каталог умений с фасетной навигацией

> Применение `skill-catalog`. Инвентаризация снята по причалам борта, дублей не найдено.

## 2.1 — Инвентаризация причалов

| Ранг | Причал | Путь | Что нашли |
|---|---|---|---|
| 100 | проектный DSH | `C:\Projects\Python\dsh-pl\.dsh\skills` | не существует |
| 200 | проектный агентов | `C:\Projects\Python\dsh-pl\.agents\skills` | не существует |
| 300 | особый | `customSkillDirs` пресета | `skills/` при пресете `white-wolf`: 2 умения |
| **400** | **пользовательский DSH** | `C:\Users\savchenkosv\.dsh\skills` | `graphflow` + **6 новых** |
| 500 | пользовательский агентов | `C:\Users\savchenkosv\.agents\skills` | 51 умение, замок `.skill-lock.json` |

На причале 500 каталог не правим: там чужие грузы с замком. На причале 400 до выгрузки
лежал ровно один `graphflow` — он и доказал, что причал читается диспетчерской.
Проверка дублей: шесть имён Плаща отсутствовали на всех пяти причалах. ✅

## 2.2 — Таблица каталога (новая запись и соседи)

| название | описание (сокр.) | категория | теги | связанные умения | статус | причал | источник паттерна |
|---|---|---|---|---|---|---|---|
| `skill-catalog` | Каталог умений с фасетной навигацией | `hermes` | каталог, фасеты, инвентаризация | skill-lessons, skill-creator | на борту | 400 | ai.engineer/talks, craft-anything |
| `skill-lessons` | Урок → этапы → шаги с критериями | `обучение` | урок, этап, шаг, гейт | skill-progress, skill-qc | на борту | 400 | Protocol Explorer |
| `skill-progress` | Прогресс между вылетами в `progress.json` | `обучение` | прогресс, возобновление | skill-lessons, skill-qc | на борту | 400 | Protocol Explorer |
| `skill-media` | Статья, слайды, диаграммы, ссылки | `media` | статья, слайды, SVG | skill-license, skill-qc | на борту | 400 | ai.engineer/talks |
| `skill-license` | `LICENSES.csv` + `CREDITS.txt` | `web` | лицензия, кредиты, SHA-256 | skill-media | на борту | 400 | cinecode |
| `skill-qc` | Измеримые пороги, гейты, гард-хуки | `software-development` | пороги, гейт, валидация | skill-progress, все | на борту | 400 | cinecode, craft-anything |
| `skill-creator` | Стандарт оформления `SKILL.md` | `hermes` | оформление, eval | все шесть | на борту | 500 | внутренний стандарт |
| `agent-experience` | Культура трёх слоёв загрузки | `hermes` | контекст, discoverability | все шесть | на борту | дистрибутив | внутренний стандарт |
| `graphflow` | Карта ветров: графовый контекст | `software-development` | граф, контекст | — | на борту | 400 / 500 | внешний |
| `dsh-ekspert-playbook` | **Плейбук Плаща, применённый к dsh-ekspert** | `обучение` | инжест, урок, QC, лицензии | все шесть | **на борту** | полигон | dsh-ekspert + Плащ |

**Счётчик:** 10 строк. ✅ Пустых полей нет. ✅

## 2.3 — Фасеты

| Умение | Домен | Ярус | Связность |
|---|---|---|---|
| `skill-catalog` | `hermes` | 0 | → skill-lessons, skill-creator |
| `skill-lessons` | `обучение` | 0 | → skill-progress, skill-qc |
| `skill-progress` | `обучение` | 0 | → skill-qc, skill-media |
| `skill-media` | `media` | 1 | → skill-license, skill-qc |
| `skill-license` | `web` | 2 | → skill-qc |
| `skill-qc` | `software-development` | 0 | → все |
| `dsh-ekspert-playbook` | `обучение` | 3 (оценка) | → все шесть |

Ярус `0` выставлен умениям, которые по плейбуку вызываются на каждом этапе;
`3 (оценка)` — новая запись без накопленной статистики вызовов. ✅

## 2.4 — Разрез по доменам

| Домен | Умения | Число |
|---|---|---|
| `hermes` | skill-catalog, skill-creator, agent-experience | 3 |
| `обучение` | skill-lessons, skill-progress, dsh-ekspert-playbook | 3 |
| `media` | skill-media | 1 |
| `web` | skill-license | 1 |
| `software-development` | skill-qc, graphflow | 2 |

Итого: 10. ✅

## 2.5 — Разрез по ярусам

| Ярус | Умения | Число |
|---|---|---|
| 0 | skill-catalog, skill-lessons, skill-progress, skill-qc | 4 |
| 1 | skill-media | 1 |
| 2 | skill-license | 1 |
| 3 | dsh-ekspert-playbook | 1 |
| не оценён | skill-creator, agent-experience, graphflow | 3 |

Итого: 10. ✅ Счётчики сошлись в обоих разрезах.

## Итог этапа 2

- [x] Инвентаризация причалов сохранена
- [x] Новая запись внесена со всеми полями
- [x] Три фасета проставлены
- [x] Оба разреза обновлены
- [x] Счётчики сходятся

Гейт пройден → переход к этапу 3 (`skill-lessons`).
