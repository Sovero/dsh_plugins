# DSH plugins

Плагины для [DSH Desktop](https://www.deepseek.com/harness/): темы, инструменты,
расширения. Каждый плагин лежит в собственной папке и устанавливается официальной
командой DSH.

| Плагин | Что делает | Версия |
| --- | --- | --- |
| [`dsh-poslanik-deep-space`](dsh-poslanik-deep-space) | Тема «Глубокий космос»: звёзды, туманности, карлики, солнца, чёрные дыры, планеты, корабли со шлейфами, кометы, метеоры. Движение мыши вносит электромагнитное возмущение пространства. Панель настроек двуязычная. | 1.4.0 |

## Установка

Из этого репозитория (указывается подпуть к пагине):

```bash
dsh plugin --profile web add github:Sovero/dsh_plugins#path:dsh-poslanik-deep-space
```

После установки перезапустите DSH Desktop: хост собирает конфигурацию профиля
при старте. Удаление — `dsh plugin --profile web remove <идентификатор плагина>`.

Если подпуть не поддерживается вашей версией DSH, распакуйте архив релиза и
установите из локального пути:

```bash
dsh plugin --profile web add /absolute/path/to/dsh-poslanik-deep-space
```

## Лицензия

MIT — см. [LICENSE](dsh-poslanik-deep-space/LICENSE) рядом с плагином.
