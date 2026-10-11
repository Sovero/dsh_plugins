# DSH plugins

Плагины для [DSH Desktop](https://www.deepseek.com/harness/): темы, инструменты,
расширения. Каждый плагин лежит в собственной папке и устанавливается официальной
командой DSH.

| Плагин | Что делает | Версия |
| --- | --- | --- |
| [`dsh-poslanik-deep-space`](dsh-poslanik-deep-space) | Тема «Глубокий космос»: звёзды, туманности, карлики, солнца, чёрные дыры, планеты, корабли со шлейфами, кометы, метеоры. Движение мыши вносит электромагнитное возмущение пространства. Панель настроек двуязычная. | 1.4.0 |
| [`dsh-ocean-theme`](dsh-ocean-theme) | Тема «Океан»: косяки мелкой рыбы, киты, акулы, медузы, кельп, кораллы и затонувший корабль на дне. Движение мыши расходится по воде рябью. Тёмная и светлая схемы. | 1.0.1 |
| [`dsh-client-voice-eternia`](dsh-client-voice-eternia) | Голосовой ввод «Голос Этернии»: две кнопки на панели ввода — микрофон для диктовки и кнопка разговора для беседы голосом. Распознавание русской речи, отправка фраз без Enter, озвучка ответа локальным голосом, гистограмма голоса. Три языка интерфейса. | 0.2.1 |
| [`dsh-restart-buttons`](dsh-restart-buttons) | Кнопки «перезагрузка» в подвале боковой панели: перезагрузка интерфейса и полный перезапуск DSH Desktop на Windows через отвязанный воркер. Двухшаговое подтверждение, четырёхсторонний забор безопасности, двуязычные подписи. | 1.0.0 |

## Моды Claude Code

Кроме плагинов DSH, здесь лежит набор модов для Claude Code.

| Набор | Что делает | Версия |
| --- | --- | --- |
| [`claude-code-sovero-mods`](claude-code-sovero-mods) | Маркетплейс `sovero-mods` из пяти модов: `pulse` (чем занят Claude и сколько это длится), `next-step` (кнопки «Далее», «Запусти», «Закоммить»), `course` (приоритеты проекта на виду и в памяти), `key-vault` (ключ из сообщения уходит в зашифрованное хранилище), `expert-teams` (команды экспертов через `/team`). Подключение и подробности — в README набора. | 0.1.0 |

## Установка плагинов DSH

Из этого репозитория (указывается подпуть к пагине):

```bash
dsh plugin --profile web add github:Sovero/dsh_plugins#path:dsh-poslanik-deep-space
dsh plugin --profile web add github:Sovero/dsh_plugins#path:dsh-ocean-theme
dsh plugin --profile web add github:Sovero/dsh_plugins#path:dsh-client-voice-eternia
dsh plugin --profile web add github:Sovero/dsh_plugins#path:dsh-restart-buttons
```

После установки перезапустите DSH Desktop: хост собирает конфигурацию профиля
при старте. Удаление — `dsh plugin --profile web remove <идентификатор плагина>`.

Если подпуть не поддерживается вашей версией DSH, распакуйте архив релиза и
установите из локального пути:

```bash
dsh plugin --profile web add /absolute/path/to/dsh-poslanik-deep-space
dsh plugin --profile web add /absolute/path/to/dsh-ocean-theme
dsh plugin --profile web add /absolute/path/to/dsh-client-voice-eternia
dsh plugin --profile web add /absolute/path/to/dsh-restart-buttons
```

## Лицензия

MIT — см. [LICENSE](dsh-poslanik-deep-space/LICENSE) рядом с плагином.
