// Тема «Покров Ульгарда» — браузерная половина локального плагина
// `dsh-veil-of-ulgard`.
//
// ФОРМА ФАЙЛА. Это не ESM. `dsh-client-modules` читает файл как текст, склеивает
// с соседними бандлами и отдаёт браузеру обычным скриптом. Скрипт на верхнем
// уровне только РЕГИСТРИРУЕТ фабрику; всё её тело выполняется при первом импорте.
// Внутри фабрики — обычный CJS: `require` отдаёт зарегистрированные модули,
// `module.exports` — то, что потом разберёт загрузчик. Поэтому здесь не может
// быть ни `import`, ни `export`, ни JSX.
//
// ЧТО ГДЕ ЖИВЁТ. Сцена — отдельный слой .dsh-veil-layer с z-index -1, то есть под
// всем интерфейсом: токен `--dsw-alias-bg-base` при этом становится
// полупрозрачным стеклом, и сквозь него видна ночь. Внутри слоя — живой холст,
// на котором фонарь идёт за курсором и разгоняет тьму вокруг себя. Токены темы
// переопределяются сразу для светлой и тёмной палитр, так что переключатель
// «Светлая/Тёмная/Системная» в настройках работает штатно.
//
// ПОЧЕМУ СЛОЙ, А НЕ ФОН ДОКУМЕНТА. Оболочка кладёт непрозрачный фон на `#root`,
// и картинка на `html, body` оказывается за ним — плагин работает, а ночи не
// видно. Слой с z-index -1 внутри изолированного контекста body встаёт между
// фоном страницы и содержимым приложения.

window.__ModuleLoader__.load({
	id: "dsh-veil-of-ulgard",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		var React;
		try {
			React = require("react");
		} catch (error) {
			React = globalThis.React;
		}

		/** Ключ настроек темы в localStorage: включение, плотность, яркость, фонарь. */
		var PREFS_KEY = "dsh-veil-of-ulgard.prefs";

		/** Атрибут, под которым вставляется собственный CSS плагина. */
		var CSS_ATTR = "data-dsh-veil-of-ulgard";

		/** Источник слоя токенов: по нему тема снимает прежнее переопределение. */
		var TOKEN_SOURCE = "dsh-veil-of-ulgard";

		/**
		 * Ключ панели в левой колонке.
		 *
		 * Одно и то же значение служит id иконки в `sidebar.panellist` и ключом
		 * страницы в `main`: оболочка связывает их именно по совпадению, и
		 * разные значения оставили бы иконку без панели. Значение своё, не
		 * совпадающее со штатными (`plugins`, `conversation`, `mnemon`):
		 * повтор чужого id встал бы в ЧУЖУЮ ячейку и заменил её.
		 */
		var PANEL_ID = "dsh-veil-of-ulgard";

		/** Пространство имён словарей темы в сервисе локализации оболочки. */
		var NS = "dsh-veil-of-ulgard";

		// ─────────────────────────────────────────────────────────────────────
		// Словари
		// ─────────────────────────────────────────────────────────────────────
		//
		// Английский — источник набора ключей: русский обязан нести те же ключи,
		// иначе часть интерфейса молча осталась бы английской. Баланс словарей
		// проверяет дым (`tools/smoke.mjs`), а не глаз.
		//
		// Ключи с точками: `panel.*` — пункт левой панели, `page.*` — страница,
		// `card.*` — заголовки карточек, `field.*` — подписи настроек,
		// `state.*` и `note.*` — пояснения, `swatch.*` — образец палитры.

		/** Английский словарь (источник набора ключей). */
		var en = {
			"panel.label": "Veil of Ulgard",
			"page.title": "Veil of Ulgard",
			"page.subtitle":
				"A night over a dead city: towers in three planes, a veiled moon, mist, ravens and ash. " +
				"The lantern follows the pointer and drives the darkness back.",
			"card.veil.title": "Veil",
			"field.enabled": "Theme enabled",
			"state.on": "the night of Ulgard",
			"state.off": "the darkness has receded",
			"note.on": "The scene and the lantern are running. Turning the veil off restores the shell's own background.",
			"note.off": "The background is returned to the shell. The settings below are kept and wait for the veil to return.",
			"card.scene.title": "Scene",
			"field.density": "Density",
			"field.gloom": "Gloom",
			"note.scene":
				"“Density” sets how many towers, ravens and ash motes fill the scene. " +
				"“Gloom” sets how deeply the screen edges sink.",
			"card.lantern.title": "Lantern",
			"field.light": "Light",
			"note.lantern": "The light follows the pointer. Ash caught in the pool flares up and drifts toward the lantern.",
			"card.palette.title": "Theme palette",
			"note.palette":
				"The colours follow the shell's scheme: the light and dark palettes carry their own values, " +
				"and the Light/Dark/System switch works as usual.",
			"action.reset": "Restore defaults",
			"hint.storage": "Settings are stored in the browser under dsh-veil-of-ulgard.prefs.",
			"swatch.brand": "accent",
			"swatch.base": "backdrop",
			"swatch.layer1": "layer 1",
			"swatch.layer2": "layer 2",
			"swatch.text": "text",
			"swatch.border": "border",
		};

		/** Русский словарь: тот же набор ключей, что и в английском. */
		var ru = {
			"panel.label": "Покров Ульгарда",
			"page.title": "Покров Ульгарда",
			"page.subtitle":
				"Ночь над мёртвым городом: башни в три плана, луна за покровом, мгла, вороны и пепел. " +
				"Фонарь идёт за курсором и разгоняет тьму.",
			"card.veil.title": "Покров",
			"field.enabled": "Тема включена",
			"state.on": "ночь Ульгарда",
			"state.off": "тьма отступила",
			"note.on": "Сцена и фонарь работают. Выключение возвращает фон оболочке.",
			"note.off": "Фон возвращён оболочке. Настройки ниже сохраняются и ждут возвращения.",
			"card.scene.title": "Сцена",
			"field.density": "Плотность",
			"field.gloom": "Сумрак",
			"note.scene":
				"«Плотность» задаёт число башен, воронов и пепла. " +
				"«Сумрак» — насколько глубоко тонут края экрана.",
			"card.lantern.title": "Фонарь",
			"field.light": "Свет",
			"note.lantern": "Свет идёт за курсором. Пепел, попав в пятно, разгорается и льнёт к фонарю.",
			"card.palette.title": "Палитра темы",
			"note.palette":
				"Цвета следуют схеме оболочки: светлая и тёмная несут свои значения, " +
				"а переключатель «Светлая/Тёмная/Системная» работает штатно.",
			"action.reset": "Вернуть умолчания",
			"hint.storage": "Настройки хранятся в браузере под ключом dsh-veil-of-ulgard.prefs.",
			"swatch.brand": "акцент",
			"swatch.base": "подложка",
			"swatch.layer1": "слой 1",
			"swatch.layer2": "слой 2",
			"swatch.text": "текст",
			"swatch.border": "граница",
		};

		/** Язык по умолчанию, когда сервиса локализации нет. */
		var FALLBACK_LANG = "en";

		/**
		 * Подставить параметры в строку: `{name}` заменяется значением.
		 *
		 * @param {string} text - шаблон.
		 * @param {object} params - значения.
		 * @returns {string} готовая строка.
		 */
		function interpolate(text, params) {
			if (!params || typeof text !== "string") return text;
			return text.replace(/\{(\w+)\}/g, function (match, name) {
				return Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match;
			});
		}

		/**
		 * Язык по языку браузера. Нужен только как запасной путь: пока сервис
		 * локализации жив, выбор делает он, а не догадка.
		 *
		 * @returns {string} "ru" или "en".
		 */
		function detectLang() {
			try {
				var nav = globalThis.navigator;
				var raw = nav && (nav.language || (nav.languages && nav.languages[0]));
				if (typeof raw === "string" && raw.toLowerCase().indexOf("ru") === 0) return "ru";
			} catch (error) {
				/* нет navigator — берём язык по умолчанию */
			}
			return FALLBACK_LANG;
		}

		/**
		 * Собрать переводчик.
		 *
		 * Когда сервис локализации доступен, перевод идёт через него: он сам
		 * выбирает активный язык и держит общую цепочку отката. Свои словари
		 * при этом остаются последним рубежом — если ключа нет в слое сервиса,
		 * показывается наш текст, а не голое имя ключа.
		 *
		 * Без сервиса переводчик работает по языку браузера: плагин обязан
		 * читаться и в урезанной сборке.
		 *
		 * @param {object} locale - сервис локализации или undefined.
		 * @returns {{ t: (key: string, params?: object) => string, bound: boolean }}
		 */
		function makeTranslate(locale) {
			var dicts = { en: en, ru: ru };
			var bound = null;
			if (locale !== undefined && locale !== null && typeof locale.bind === "function") {
				try {
					bound = locale.bind(NS);
				} catch (error) {
					bound = null;
				}
			}
			/**
			 * Перевод с последним рубежом: свои словари.
			 * @param {string} key - ключ.
			 * @param {object} [params] - параметры.
			 * @returns {string} текст.
			 */
			function t(key, params) {
				if (bound !== null) {
					try {
						var text = bound(key, params);
						// Сервис отдаёт сам ключ, когда словаря нет: это видно в
						// интерфейсе как `page.title`, поэтому подменяем своим текстом.
						if (typeof text === "string" && text !== key) return text;
					} catch (error) {
						/* падение словаря не должно уносить панель */
					}
				}
				var dict = dicts[detectLang()] || en;
				var own = Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : en[key];
				if (typeof own !== "string") return key;
				return interpolate(own, params);
			}
			return { t: t, bound: bound !== null };
		}

		/**
		 * Округление до десятых: координаты SVG не должны тащить длинные числа.
		 * @param {number} n - значение.
		 * @returns {number} округлённое.
		 */
		function round(n) {
			return Math.round(n * 10) / 10;
		}

		/**
		 * Округление альфы до сотых: прозрачность в градиенте — дробь с двумя
		 * знаками, и длинные хвосты вроде `0.666666666666` тащат байты на
		 * каждую ступень тьмы.
		 *
		 * @param {number} n - значение.
		 * @returns {number} округлённое.
		 */
		function round2(n) {
			return Math.round(n * 100) / 100;
		}

		/**
		 * Прочитать сохранённые настройки. Любая поломка — просто значения по
		 * умолчанию.
		 * @returns {{ enabled?: boolean, density?: number, tint?: number, lantern?: number }} прочитанное.
		 */
		function loadPrefs() {
			try {
				var raw = globalThis.localStorage.getItem(PREFS_KEY);
				if (!raw) return {};
				var parsed = JSON.parse(raw);
				return parsed && typeof parsed === "object" ? parsed : {};
			} catch (error) {
				return {};
			}
		}

		/**
		 * Зажать число в рабочий диапазон.
		 * @param {number} value - проверенное значение.
		 * @param {number} min - нижняя граница.
		 * @param {number} max - верхняя граница.
		 * @returns {number} число в границах.
		 */
		function clamp01(value, min, max) {
			if (typeof value !== "number" || !isFinite(value)) return (min + max) / 2;
			return Math.min(max, Math.max(min, value));
		}

		/**
		 * Сохранить настройки. Приватный режим браузера может запретить запись —
		 * это не повод ронять тему.
		 * @param {object} prefs - значения настроек.
		 * @returns {void}
		 */
		function savePrefs(prefs) {
			try {
				prefs.turnedOff = run.enabled === false;
				globalThis.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
			} catch (error) {
				/* остаёмся в памяти до конца сессии */
			}
		}

		/**
		 * Вставить или обновить блок CSS плагина.
		 * @param {string} id - идентификатор блока внутри атрибута.
		 * @param {string} css - текст правил.
		 * @returns {() => void} функция, удаляющая блок.
		 */
		function insertStyle(id, css) {
			var head = globalThis.document.head;
			var selector = "style[" + CSS_ATTR + "=" + JSON.stringify(id) + "]";
			var tag = head.querySelector(selector);
			if (tag === null) {
				tag = globalThis.document.createElement("style");
				tag.setAttribute(CSS_ATTR, id);
				head.appendChild(tag);
			}
			tag.textContent = css;
			return function () {
				if (tag.parentNode !== null) tag.parentNode.removeChild(tag);
			};
		}

		/**
		 * Детерминированный генератор: сцена обязана быть одинаковой при каждой
		 * перерисовке, иначе переключение схемы «перетасовывало» бы башни.
		 * @param {number} seed - зерно.
		 * @returns {() => number} генератор в диапазоне [0, 1).
		 */
		function rng(seed) {
			var s = seed >>> 0;
			return function () {
				s = (s * 1664525 + 1013904223) >>> 0;
				return s / 4294967296;
			};
		}

		// ─────────────────────────────────────────────────────────────────────
		// Палитры
		// ─────────────────────────────────────────────────────────────────────

		/**
		 * Палитры сцены. Тёмная — ночь Ульгарда; светлая — серое утро, когда
		 * покров истончился и пепел лежит на камне. Силуэты общие, цвета разные.
		 */
		var SCHEMES = {
			dark: {
				skyTop: "#000103",
				skyMid: "#03050a",
				skyLow: "#070b12",
				horizon: "#0e141d",
				glowWarm: "#22160a",
				moon: "#c4beac",
				moonGlow: "#e2d6b4",
				cloud: "#070b13",
				cloudEdge: "#131b2a",
				spireFar: "#111927",
				spireMid: "#0b1220",
				spireNear: "#070c16",
				gate: "#05080f",
				ground: "#080c14",
				crack: "#121a28",
				window: "#ffb44a",
				ember: "#e8a24a",
				emberHot: "#ffdca6",
				raven: "#060a11",
				mist: "#384154",
				lantern: "#f0c070",
				lanternCore: "#fff2cc",
				page: "#010206",
			},
			light: {
				skyTop: "#a6a194",
				skyMid: "#bcb5a4",
				skyLow: "#cdc5b1",
				horizon: "#dcd2b8",
				glowWarm: "#e0c89a",
				moon: "#fffdf6",
				moonGlow: "#fff6dc",
				cloud: "#c0baac",
				cloudEdge: "#ddd7c9",
				spireFar: "#9a9588",
				spireMid: "#7c7768",
				spireNear: "#403c33",
				gate: "#3a3529",
				ground: "#a6a092",
				crack: "#857f6d",
				window: "#7a4e14",
				ember: "#b06a24",
				emberHot: "#d99a4c",
				raven: "#25231d",
				mist: "#a6a092",
				lantern: "#c99436",
				lanternCore: "#fff6de",
				page: "#c6c0b2",
			},
		};

		/**
		 * Токены темы: стекло панелей, границы, свет фонаря как акцент.
		 *
		 * Стекло полупрозрачно ровно настолько, чтобы сквозь панели читалась
		 * сцена, но текст оставался контрастным. Обе схемы задаются сразу:
		 * тема выбирает нужную сама, и панели следуют за переключателем.
		 *
		 * @param {boolean} light - светлая ли схема.
		 * @returns {Record<string, string>} значения токенов.
		 */
		function buildTokens(light) {
			return {
				"--dsw-alias-bg-base": light ? "rgba(222,214,196,0.52)" : "rgba(5,7,12,0.50)",
				"--dsw-alias-bg-layer-1": light ? "rgba(255,251,240,0.78)" : "rgba(13,17,26,0.76)",
				"--dsw-alias-bg-layer-2": light ? "rgba(246,240,224,0.84)" : "rgba(17,22,33,0.82)",
				"--dsw-alias-bg-overlay": light ? "rgba(255,252,244,0.95)" : "rgba(9,12,19,0.95)",
				"--dsw-alias-border-l1": light ? "rgba(92,74,42,0.18)" : "rgba(206,174,112,0.14)",
				"--dsw-alias-border-l2": light ? "rgba(92,74,42,0.32)" : "rgba(206,174,112,0.28)",
				"--dsw-alias-brand-primary": light ? "#8a5a18" : "#d9a441",
				"--dsw-alias-label-primary": light ? "#2a2418" : "#e8e0d0",
				"--dsw-alias-label-secondary": light ? "#6a5f4a" : "#9a9186",
				"--dsw-alias-state-error-primary": light ? "#a8262a" : "#e05a5a",
				"--dsw-alias-state-success-primary": light ? "#3a6b34" : "#6aa84f",
				"--dsw-alias-state-warn-primary": light ? "#8a6410" : "#e0b040",
				"--dsw-specific-sidebar-fill": light ? "rgba(255,251,240,0.58)" : "rgba(7,10,17,0.56)",
			};
		}

		// ─────────────────────────────────────────────────────────────────────
		// Сцена
		// ─────────────────────────────────────────────────────────────────────

		/**
		 * Анимации сцены. Всё это CSS внутри SVG-фона, а не JS: движется сам
		 * браузер, и сцена не тратит кадры на то, что умеет композитор.
		 */
		var SCENE_STYLE =
			"<style>" +
			// Мгла идёт в две стороны: слои на разной глубине не должны
			// двигаться синхронно, иначе читаются как одна лента.
			"@keyframes vg-mist{from{transform:translateX(-320px)}to{transform:translateX(1920px)}}" +
			"@keyframes vg-mist-back{from{transform:translateX(1920px)}to{transform:translateX(-320px)}}" +
			// Пепел поднимается и гаснет: вверх, в сторону, в ничто.
			"@keyframes vg-rise{0%{transform:translateY(60px);opacity:0}" +
			"12%{opacity:1}70%{opacity:.85}100%{transform:translateY(-820px);opacity:0}}" +
			"@keyframes vg-flick{0%,100%{opacity:.35}50%{opacity:1}}" +
			// Ворон: каждое крыло вращается ВОКРУГ ПЛЕЧА, тело неподвижно.
			//
			// Прежний взмах сжимал по вертикали весь силуэт целиком
			// (`scaleY` на всей фигуре): тело тоже сплющивалось, и птица
			// читалась рычагом механизма, а не живым существом. Здесь крылья —
			// отдельные фигуры, выходящие из начала координат, поэтому
			// `rotate()` без указания центра вращает каждое вокруг собственного
			// плеча (у SVG-элемента `transform-origin` по умолчанию — начало
			// системы координат). Тело и хвост остаются на месте.
			//
			// Левое крыло — зеркало правого, поэтому знак угла обратный: иначе
			// крылья хлопали бы в одну сторону и птица кувыркалась.
			"@keyframes vg-wing-r{0%,100%{transform:rotate(-15deg)}45%{transform:rotate(21deg)}}" +
			"@keyframes vg-wing-l{0%,100%{transform:rotate(15deg)}45%{transform:rotate(-21deg)}}" +
			// Планирование: крылья почти неподвижны, лишь медленно дышат.
			// Половина воронов парит, половина машет — иначе стая выглядит
			// заводной игрушкой, выпущенной одним заводом.
			"@keyframes vg-glide-r{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(-1deg)}}" +
			"@keyframes vg-glide-l{0%,100%{transform:rotate(4deg)}50%{transform:rotate(1deg)}}" +
			"@keyframes vg-cross{from{transform:translateX(-200px)}to{transform:translateX(1800px)}}" +
			"@keyframes vg-cross-back{from{transform:translateX(1800px)}to{transform:translateX(-200px)}}" +
			// Луна за покровом: дыхание света, а не мигание.
			"@keyframes vg-halo{0%,100%{opacity:.55}50%{opacity:.9}}" +
			"@keyframes vg-sway{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}" +
			// Свет в окне: тёплое дыхание, а не ровная заливка. Разные окна
			// дышат вразнобой — одинаковый ритм читался бы гирляндой.
			"@keyframes vg-window{0%,100%{opacity:.72}50%{opacity:1}}" +
			"@keyframes vg-window-slow{0%,100%{opacity:.55}50%{opacity:.92}}" +
			"</style>";

		/**
		 * Изломанная башня: силуэт с рваной вершиной.
		 *
		 * @param {number} x - центр основания.
		 * @param {number} w - ширина.
		 * @param {number} h - высота.
		 * @param {number} base - ордината основания.
		 * @param {string} col - цвет заливки.
		 * @param {() => number} r - генератор.
		 * @returns {string} элемент path.
		 */
		function spire(x, w, h, base, col, r) {
			var top = base - h;
			var half = w / 2;
			var pts = [];
			// Левый склон: ступенчатые заломы, как у осыпавшейся кладки.
			var steps = 4 + Math.floor(r() * 3);
			for (var i = 0; i <= steps; i++) {
				var u = i / steps;
				var px = x - half * (1 - u * 0.28) + (r() - 0.5) * w * 0.16;
				var py = base - h * u;
				pts.push([px, py]);
			}
			// Рваная вершина.
			var crown = 2 + Math.floor(r() * 3);
			for (var c = 1; c <= crown; c++) {
				var t = c / (crown + 1);
				pts.push([x - half * 0.72 + w * 1.44 * t, top + (r() - 0.5) * h * 0.12]);
			}
			// Правый склон.
			for (var j = steps; j >= 0; j--) {
				var v = j / steps;
				pts.push([x + half * (1 - v * 0.28) + (r() - 0.5) * w * 0.16, base - h * v]);
			}
			var d = "M" + round(pts[0][0]) + " " + round(pts[0][1]);
			for (var k = 1; k < pts.length; k++) d += "L" + round(pts[k][0]) + " " + round(pts[k][1]);
			d += "Z";
			return "<path d='" + d + "' fill='" + col + "'/>";
		}

		/**
		 * Крепостная башня: тело с расширением книзу, ярус карниза и конический
		 * шпиль. Читается как архитектура, а не как камень: у силуэта есть
		 * вертикаль, сужение и завершение.
		 *
		 * @param {number} x - центр основания.
		 * @param {number} w - ширина у основания.
		 * @param {number} h - высота тела.
		 * @param {number} base - ордината основания.
		 * @param {string} col - цвет заливки.
		 * @param {string} edge - цвет кромки (свет со стороны луны).
		 * @param {boolean} lit - рисовать ли окна.
		 * @param {string} windowCol - цвет окон.
		 * @param {() => number} r - генератор.
		 * @returns {string} разметка башни.
		 */
		function tower(x, w, h, base, col, edge, lit, windowCol, r) {
			var top = base - h;
			var half = w / 2;
			var waist = half * 0.72;
			// Тело: трапеция с лёгким изломом — стены не бывают идеально прямыми.
			var body =
				"M" + round(x - half) + " " + round(base) +
				"L" + round(x - waist + (r() - 0.5) * 3) + " " + round(top + 14) +
				"L" + round(x + waist + (r() - 0.5) * 3) + " " + round(top + 14) +
				"L" + round(x + half) + " " + round(base) + "Z";
			var out = "<path d='" + body + "' fill='" + col + "'/>";
			// Кромка со стороны луны (луна справа): тонкая светлая грань.
			out +=
				"<path d='M" + round(x + waist) + " " + round(top + 14) +
				"L" + round(x + half) + " " + round(base) +
				"L" + round(x + half - 2.4) + " " + round(base) +
				"L" + round(x + waist - 2.4) + " " + round(top + 14) + "Z' fill='" + edge + "' opacity='.5'/>";
			// Карниз: короткая полка, отделяющая тело от шпиля.
			out +=
				"<rect x='" + round(x - waist - 3) + "' y='" + round(top + 6) + "' width='" + round(waist * 2 + 6) +
				"' height='5' fill='" + col + "'/>";
			// Конический шпиль.
			var sh = 26 + r() * 46;
			out +=
				"<path d='M" + round(x - waist) + " " + round(top + 6) +
				"L" + round(x) + " " + round(top + 6 - sh) +
				"L" + round(x + waist) + " " + round(top + 6) + "Z' fill='" + col + "'/>";
			// Окна: редкие, тёплые, только на средних и ближних башнях.
			//
			// Свет в окне — не прямоугольник, а ДВА слоя: широкий ореол и ядро.
			// Одна заливка читалась цветной наклейкой на камне; ореол вокруг
			// пятна даёт ощущение, что за окном горит огонь, а не светится
			// краска. Ореол рисуется через `filter='url(#vgWindowGlow)'`.
			//
			// Окна дышат вразнобой: у каждого своя длительность и своя задержка.
			// Одинаковый ритм превращал башню в гирлянду.
			if (lit) {
				var rows = Math.max(1, Math.floor(h / 110));
				// Ядро: яркая точка.
				out += "<g fill='" + windowCol + "'>";
				for (var ry = 0; ry < rows; ry++) {
					var wy = top + 44 + ry * (h / (rows + 1)) * 0.66;
					if (wy > base - 28) break;
					var cols = r() < 0.55 ? 1 : 2;
					for (var cx2 = 0; cx2 < cols; cx2++) {
						if (r() < 0.42) continue;
						var wx = x - (cols === 1 ? 0 : 7) + cx2 * 14 + (r() - 0.5) * 3;
						var ww = round(2.6 + r() * 1.4);
						var wh = round(4 + r() * 3);
						// Дыхание: медленное у одних, частое у других.
						var slow = r() < 0.5;
						var wdur = slow ? round(5 + r() * 4) : round(2.4 + r() * 2);
						var wdel = round(-r() * wdur);
						var wanim = slow ? "vg-window-slow" : "vg-window";
						// Ореол: то же пятно, но размытое и крупнее.
						out +=
							"<rect x='" + round(wx - ww) + "' y='" + round(wy - wh) + "' width='" + round(ww * 3) +
							"' height='" + round(wh * 3) + "' filter='url(#vgWindowGlow)' opacity='.5' " +
							"style='animation:" + wanim + " " + wdur + "s ease-in-out infinite;animation-delay:" +
							wdel + "s'/>";
						// Ядро.
						out +=
							"<rect x='" + round(wx) + "' y='" + round(wy) + "' width='" + ww + "' height='" + wh +
							"' style='animation:" + wanim + " " + wdur + "s ease-in-out infinite;animation-delay:" +
							wdel + "s'/>";
					}
				}
				out += "</g>";
			}
			return out;
		}

		/**
		 * Разрушенная арка врат: две опоры, стрельчатый свод и рваная правая
		 * опора.
		 *
		 * Пролом вырезан В САМОМ силуэте, а не наложен светлым пятном поверх:
		 * накладная фигура читалась заплатой, а не дырой в кладке — в светлой
		 * схеме особенно, где она совпадала по цвету с небом и выглядела
		 * графической ошибкой.
		 *
		 * @param {string} col - цвет камня.
		 * @param {string} dark - цвет проёма (небо за воротами).
		 * @returns {string} разметка.
		 */
		function gate(col, dark) {
			// Правая опора обломана ступенями: зубцы идут вниз к проёму.
			var outer =
				"M676 900 L676 700 Q676 610 760 566 Q800 546 800 512 " +
				"Q800 546 840 566 Q900 600 920 660 " +
				"L898 664 L910 700 L884 706 L896 748 L870 754 L880 800 L862 806 L870 900 Z";
			var inner =
				"M754 900 L754 706 Q754 656 800 626 Q846 656 846 706 L846 900 Z";
			var out = "<path d='" + outer + "' fill='" + col + "'/>";
			// Проём: небо за воротами, чуть плотнее фона — это тень свода.
			out += "<path d='" + inner + "' fill='" + dark + "' opacity='.94'/>";
			return out;
		}

		/**
		 * Ворон: тело и два отдельных крыла.
		 *
		 * Крылья выходят из НАЧАЛА КООРДИНАТ — это плечо. Благодаря этому
		 * `rotate()` во взмахе вращает каждое крыло вокруг плеча, а не вокруг
		 * центра фигуры: без этого приёма птица кувыркалась бы целиком.
		 *
		 * Тело рисуется последним, поверх крыльев: плечо оказывается скрыто
		 * тушкой, и стык не виден.
		 *
		 * @returns {{ wings: string, body: string }} разметка частей.
		 */
		function ravenParts() {
			// Правое крыло: от плеча вверх и вбок, с изломом у запястья и
			// расщеплёнными первостепенными перьями на конце.
			var wingR =
				"M0 0 C3 -5 8 -8 15 -9 C19 -9.6 22 -8.4 24 -6.4 " +
				"L26 -7.2 L25.4 -4.6 L27.6 -4.4 L26 -2 L28 -1.2 L25.6 0.6 " +
				"C21 0.2 15 0.6 10 2 C6 3.2 2.6 3.4 0 2.6 Z";
			// Левое крыло — зеркало правого по оси X.
			var wingL =
				"M0 0 C-3 -5 -8 -8 -15 -9 C-19 -9.6 -22 -8.4 -24 -6.4 " +
				"L-26 -7.2 L-25.4 -4.6 L-27.6 -4.4 L-26 -2 L-28 -1.2 L-25.6 0.6 " +
				"C-21 0.2 -15 0.6 -10 2 C-6 3.2 -2.6 3.4 0 2.6 Z";
			// Тушка с головой и хвостом: узкое веретено.
			var body =
				"M0 -3.2 C2.6 -3.2 4.4 -1.4 4.6 1.2 C4.8 3.4 3.6 5.6 1.8 7.4 " +
				"L0 9.6 L-1.8 7.4 C-3.6 5.6 -4.8 3.4 -4.6 1.2 C-4.4 -1.4 -2.6 -3.2 0 -3.2 Z";
			return { wings: "<path d='" + wingR + "'/><path d='" + wingL + "'/>", body: "<path d='" + body + "'/>" };
		}

		/**
		 * Слой тьмы.
		 *
		 * Чёрный прямоугольник с вертикальным градиентом, лёжащий поверх сцены.
		 * Не затемняет экран, а ГАСИТ свет: снизу (где лампы и окна) тянется
		 * мрак, сверху — ночное небо. Без него сцена читалась светлым пятном
		 * посреди оболочки и не давала ощущения глубины ночи.
		 *
		 * @param {boolean} light - светлая ли схема.
		 * @returns {string} разметка слоя.
		 */
		function gloomLayer(light) {
			// В светлой схеме слой тьмы нужен слабее: там утро, а не ночь, и
			// мрак не должен съедать все детали.
			//
			// Тень ложится в НИЗ, а не поверх всего: раньше альфа доходила до
			// 0.86 и глушила башни, окна и пепел — мрак съедал сцену. Теперь
			// уровень подобран так, что силуэты остаются читаемыми, а земля
			// уходит в черноту: мрак обязан быть глубиной, а не пеленой.
			var topAlpha = light ? 0.14 : 0.3;
			var midAlpha = light ? 0.26 : 0.46;
			var botAlpha = light ? 0.34 : 0.62;
			return (
				"<linearGradient id='vgGloom' x1='0' y1='0' x2='0' y2='1'>" +
				"<stop offset='0' stop-color='#000000' stop-opacity='" + topAlpha + "'/>" +
				"<stop offset='.42' stop-color='#000000' stop-opacity='" + midAlpha + "'/>" +
				"<stop offset='.72' stop-color='#000000' stop-opacity='" + botAlpha + "'/>" +
				"<stop offset='1' stop-color='#000000' stop-opacity='" + botAlpha + "'/>" +
				"</linearGradient>"
			);
		}

		/**
		 * Собрать сцену целиком.
		 *
		 * Слои идут от дальнего к ближнему: небо, звёзды, луна, дальняя мгла,
		 * дальние шпили, средняя мгла, средние шпили, врата, ближняя мгла, земля,
		 * вороны, пепел. Порядок и есть глубина — перспективы здесь нет, только
		 * перекрытие и размытие.
		 *
		 * @param {object} run - состояние темы.
		 * @returns {string} текст SVG.
		 */
		function buildScene(run) {
			var light = run.scheme === "light";
			var C = SCHEMES[light ? "light" : "dark"];
			var t = run.tint;
			var d = run.density;
			var r = rng(913377);
			var s = [];

			// Пространство имён xlink объявляется ОБЯЗАТЕЛЬНО: сцена едет в
			// data-URL и разбирается как XML, где неизвестный префикс — фатальная
			// ошибка. Без него весь документ не отрисуется целиком, и тема молча
			// исчезнет, хотя `<use>` в разметке есть.
			s.push(
				"<svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' " +
					"viewBox='0 0 1600 900' width='1600' height='900' " +
					"preserveAspectRatio='none'>"
			);
			s.push(SCENE_STYLE);
			s.push("<defs>");

			// Небо: от черноты зенита к пепельному свечению у горизонта.
			s.push(
				"<linearGradient id='vgSky' x1='0' y1='0' x2='0' y2='1'>" +
					"<stop offset='0' stop-color='" + C.skyTop + "'/>" +
					"<stop offset='.45' stop-color='" + C.skyMid + "'/>" +
					"<stop offset='.78' stop-color='" + C.skyLow + "'/>" +
					"<stop offset='1' stop-color='" + C.horizon + "'/>" +
					"</linearGradient>"
			);
			// Свет луны: ореол в ПЯТЬ ступеней — горячее ядро у диска, мягкий
			// венец и прозрачная периферия. С двумя ступенями ореол читался
			// ровным круговым пятном; пять дают ощущение источника света.
			s.push(
				"<radialGradient id='vgHalo' cx='.5' cy='.5' r='.5'>" +
					"<stop offset='0' stop-color='" + C.moonGlow + "' stop-opacity='.95'/>" +
					"<stop offset='.12' stop-color='" + C.moonGlow + "' stop-opacity='.55'/>" +
					"<stop offset='.34' stop-color='" + C.moonGlow + "' stop-opacity='.18'/>" +
					"<stop offset='.65' stop-color='" + C.moonGlow + "' stop-opacity='.06'/>" +
					"<stop offset='1' stop-color='" + C.moonGlow + "' stop-opacity='0'/>" +
					"</radialGradient>"
			);
			// Сам диск: не ровный круг, а градиент с блеском в левом-верхнем
			// крае. Единственная деталь, по которой диск читается телом.
			s.push(
				"<radialGradient id='vgMoonFace' cx='.38' cy='.32' r='.78'>" +
					"<stop offset='0' stop-color='#ffffff' stop-opacity='.9'/>" +
					"<stop offset='.38' stop-color='" + C.moon + "'/>" +
					"<stop offset='.84' stop-color='" + C.moon + "' stop-opacity='.72'/>" +
					"<stop offset='1' stop-color='" + C.skyLow + "' stop-opacity='.4'/>" +
					"</radialGradient>"
			);
			// Лента мглы: плотная в середине, растворяется по краям.
			s.push(
				"<linearGradient id='vgMist' x1='0' y1='0' x2='1' y2='0'>" +
					"<stop offset='0' stop-color='" + C.mist + "' stop-opacity='0'/>" +
					"<stop offset='.25' stop-color='" + C.mist + "' stop-opacity='.30'/>" +
					"<stop offset='.5' stop-color='" + C.mist + "' stop-opacity='.42'/>" +
					"<stop offset='.75' stop-color='" + C.mist + "' stop-opacity='.30'/>" +
					"<stop offset='1' stop-color='" + C.mist + "' stop-opacity='0'/>" +
					"</linearGradient>"
			);
			// Тёплое свечение у земли: гаснет к краям само, без блюра.
			s.push(
				"<radialGradient id='vgWarm' cx='.5' cy='.5' r='.5'>" +
					"<stop offset='0' stop-color='" + C.glowWarm + "' stop-opacity='.85'/>" +
					"<stop offset='.45' stop-color='" + C.glowWarm + "' stop-opacity='.34'/>" +
					"<stop offset='1' stop-color='" + C.glowWarm + "' stop-opacity='0'/>" +
					"</radialGradient>"
			);
			// Почва: светлая у кромки, чёрная у нижнего края окна.
			s.push(
				"<linearGradient id='vgGround' x1='0' y1='0' x2='0' y2='1'>" +
					"<stop offset='0' stop-color='" + C.ground + "'/>" +
					"<stop offset='.35' stop-color='" + C.ground + "'/>" +
					"<stop offset='1' stop-color='" + C.page + "'/>" +
					"</linearGradient>"
			);
			s.push(
				"<filter id='vgSoft' x='-25%' y='-60%' width='150%' height='220%'>" +
					"<feGaussianBlur stdDeviation='18'/>" +
					"</filter>"
			);
			// Свечение горизонта: отдельный, куда более широкий размыв. Общим
			// `vgSoft` тёплое пятно читалось жёсткой горчичной полосой поперёк
			// всего экрана — свет у земли обязан растворяться, а не лежать плашкой.
			s.push(
				"<filter id='vgGlow' x='-40%' y='-160%' width='180%' height='420%'>" +
					"<feGaussianBlur stdDeviation='64'/>" +
					"</filter>"
			);
			s.push(
				"<filter id='vgCloud' x='-60%' y='-300%' width='220%' height='700%'>" +
					"<feGaussianBlur stdDeviation='34'/>" +
					"</filter>"
			);
			s.push(
				"<filter id='vgHaze' x='-15%' y='-30%' width='130%' height='160%'>" +
					"<feGaussianBlur stdDeviation='7'/>" +
					"</filter>"
			);
			// Свечение окна: широкий мягкий ореол вокруг пятна. Общим `vgSoft`
			// свет окна расплывался бы на пол-башни и читался туманом; здесь
			// радиус подобран под размер окна, чтобы ореол оставался венчиком
			// вокруг огня, а не заливкой стены.
			s.push(
				"<filter id='vgWindowGlow' x='-120%' y='-120%' width='340%' height='340%'>" +
					"<feGaussianBlur stdDeviation='2.6'/>" +
					"</filter>"
			);
			// Градиент тьмы: лёг в самом низу defs, чтобы его видели все слои
			// сцены, идущие ниже.
			s.push(gloomLayer(light));
			// Силуэт ворона собирается из ДВУХ символов: крылья и тело.
			// Крылья обязаны быть отдельной фигурой с плечом в начале
			// координат — только тогда взмах вращает крыло вокруг плеча, а не
			// кувыркает всю птицу. Тело ставится последним, поверх плеча.
			var raven = ravenParts();
			s.push("<g id='vgWings'>" + raven.wings + "</g>");
			s.push("<g id='vgBody'>" + raven.body + "</g>");
			s.push("</defs>");

			// ── небо ──
			s.push("<rect width='1600' height='900' fill='url(#vgSky)'/>");
			// Тёплое свечение у горизонта: за холмом что-то горит — это и даёт
			// глубину, которой не хватало плоской заливке. Радиальный градиент, а
			// не залитый эллипс: сплошное пятно с блюром читалось горчичной
			// полосой поперёк экрана, а градиент гаснет сам и держит свет у земли.
			s.push(
				"<ellipse cx='800' cy='806' rx='620' ry='128' fill='url(#vgWarm)' opacity='" +
					(light ? 0.55 : 0.8) + "'/>"
			);

			// ── звёзды (только в тёмной схеме: днём их нет) ──
			if (!light) {
				var stars = Math.round(150 * d);
				s.push("<g fill='#ffffff'>");
				for (var st = 0; st < stars; st++) {
					var sx = round(r() * 1600);
					var sy = round(r() * 560);
					var sr = round(0.5 + r() * 1.3);
					var so = round(0.25 + r() * 0.6);
					// Тусклее к горизонту: у земли свет размыт мглой.
					var fade = 1 - sy / 640;
					s.push(
						"<circle cx='" + sx + "' cy='" + sy + "' r='" + sr +
							"' opacity='" + round(so * Math.max(0.15, fade)) + "'/>"
					);
				}
				s.push("</g>");
			}

			// ── луна за покровом ──
			// Ореол дышит, диск — нет: свет пульсирует, тело постоянно. Если
			// дышать и диску, луна читается живым существом, а не светилом.
			s.push(
				"<g style='animation:vg-halo 11s ease-in-out infinite'>" +
					"<circle cx='1276' cy='168' r='340' fill='url(#vgHalo)'/>" +
					"</g>"
			);
			// Диск побольше, чем был: 64 → 76. Мелкая луна уходила в угол и
			// читалась блёсткой, крупная становится источником света сцены.
			var MX = 1276;
			var MY = 168;
			var MR = 76;
			s.push(
				"<circle cx='" + MX + "' cy='" + MY + "' r='" + MR + "' fill='url(#vgMoonFace)'/>"
			);
			// Кратеры: тёмные пятна разного размера. Детерминированный
			// генератор, чтобы перерисовка не перетасовывала лунные моря.
			var mr = rng(2971031);
			s.push("<g fill='" + C.skyLow + "' opacity='.5'>");
			// Море Дождей и Большой Кратер: два крупных и несколько мелких.
			var craters = [
				["M" + MX - 22 + " " + (MY - 24) + " a13 10 0 1 0 .1 0 z", 1],
				["M" + (MX + 24) + " " + (MY + 14) + " a17 13 0 1 0 .1 0 z", 1],
				["M" + (MX - 6) + " " + (MY + 30) + " a8 6 0 1 0 .1 0 z", 1],
			];
			for (var ci = 0; ci < craters.length; ci++) {
				s.push("<path d='" + craters[ci][0] + "' opacity='" + craters[ci][1] + "'/>");
			}
			// Мелкая кратерность.
			for (var cm = 0; cm < 14; cm++) {
				var ca = mr() * 6.2832;
				var cd = 12 + mr() * (MR - 18);
				var cpx = MX + Math.cos(ca) * cd;
				var cpy = MY + Math.sin(ca) * cd;
				var csz = 1.6 + mr() * 3.6;
				s.push(
					"<circle cx='" + round(cpx) + "' cy='" + round(cpy) + "' r='" + round(csz) +
						"' opacity='" + round(0.3 + mr() * 0.4) + "'/>"
				);
			}
			s.push("</g>");
			// Канделябр: узкий венец света вокруг диска, обращённый к башням.
			// Отдельным кольцом, а не частью ореола: ореол мягкий и широкий,
			// венец плотный и тонкий — вместе они дают ощущение источника.
			s.push(
				"<circle cx='" + MX + "' cy='" + MY + "' r='" + (MR + 16) +
					"' fill='none' stroke='" + C.moonGlow + "' stroke-width='2.5' opacity='.28'/>"
			);
			// Кромка диска слева-сверху: голубая линия, как у настоящей луны.
			s.push(
				"<path d='M" + (MX - MR + 4) + " " + (MY - 20) + " a" + MR + " " + MR + " 0 0 1 24 -52' " +
					"fill='none' stroke='#ffffff' stroke-width='1.6' opacity='.5' stroke-linecap='round'/>"
			);
			// Покров: редкие перистые полосы, УВЕДЁННЫЕ от диска луны.
			//
			// Пять эллипсов вокруг луны давали концентрические кольца; сплошные
			// тучи — тёмные кляксы: полупрозрачная фигура на градиенте читается
			// своей формой, а не цветом. Поэтому полосы длинные, плоские, низкой
			// прозрачности и стоят ВВЕРХУ: тень оттуда падает как облако, а не
			// как клякса. Их четыре — три лишние сливались с мглой у горизонта.
			s.push("<g filter='url(#vgCloud)' opacity='.36'>");
			for (var cl = 0; cl < 4; cl++) {
				s.push(
					"<ellipse cx='" + round(140 + r() * 900) + "' cy='" + round(90 + r() * 260) +
						"' rx='" + round(240 + r() * 320) + "' ry='" + round(4 + r() * 6) +
						"' fill='" + C.cloudEdge + "'/>"
				);
			}
			s.push("</g>");

			// ── дальняя мгла ──
			s.push(
				"<g filter='url(#vgSoft)'>" +
					"<rect x='-320' y='520' width='2240' height='110' fill='url(#vgMist)' " +
					"style='animation:vg-mist 118s linear infinite'/>" +
					"</g>"
			);

			// ── дальние башни ──
			// Бледные, без окон: расстояние съедает деталь. Стоят на своей линии
			// горизонта, ниже средней гряды — это и есть воздушная перспектива.
			s.push("<g opacity='.55'>");
			var farN = 12;
			for (var f = 0; f < farN; f++) {
				var fx = round(-30 + (f + r() * 0.6) * (1660 / farN));
				var fw = round(30 + r() * 44);
				var fh = round(120 + r() * 200);
				s.push(tower(fx, fw, fh, 706, C.spireFar, C.spireFar, false, C.window, r));
			}
			s.push("</g>");

			// ── средняя мгла ──
			s.push(
				"<g filter='url(#vgSoft)' opacity='.75'>" +
					"<rect x='-320' y='618' width='2240' height='92' fill='url(#vgMist)' " +
					"style='animation:vg-mist-back 92s linear infinite'/>" +
					"</g>"
			);

			// ── средние башни ──
			// Уже с окнами: тёплые точки — единственный признак жизни в городе.
			s.push("<g opacity='.88'>");
			var midN = 8;
			for (var m = 0; m < midN; m++) {
				var mx = round(-50 + (m + r() * 0.7) * (1700 / midN));
				var mw = round(52 + r() * 76);
				var mh = round(210 + r() * 300);
				s.push(tower(mx, mw, mh, 792, C.spireMid, C.spireFar, r() < 0.7, C.window, r));
			}
			s.push("</g>");

			// ── врата ──
			// Стоят по центру и перекрывают часть средних башен: глаз читает их
			// как вход, а не как ещё одну башню.
			s.push("<g opacity='.99'>" + gate(C.gate, C.skyMid) + "</g>");

			// ── ближняя мгла ──
			s.push(
				"<g filter='url(#vgSoft)' opacity='.55'>" +
					"<rect x='-320' y='758' width='2240' height='86' fill='url(#vgMist)' " +
					"style='animation:vg-mist 74s linear infinite'/>" +
					"</g>"
			);

			// ── земля ──
			// Пологая линия, а не полоса: подъём к вратам слева и справа. Кромка
			// земли темнее тела: у самой линии горизонта свет ещё есть, а ниже
			// почва уходит в черноту — без этого земля читалась светлой плашкой
			// и весь низ сцены выглядел выцветшим.
			s.push(
				"<path d='M0 846 Q260 820 470 838 Q700 858 900 840 Q1220 812 1600 836 L1600 900 L0 900 Z' " +
					"fill='url(#vgGround)'/>"
			);
			// Трещины: короткие ломаные, расходящиеся от врат.
			s.push("<g stroke='" + C.crack + "' stroke-width='1.6' fill='none' opacity='.75'>");
			for (var cr = 0; cr < 10; cr++) {
				var cx0 = round(120 + r() * 1360);
				var cy0 = round(848 + r() * 44);
				var seg = 2 + Math.floor(r() * 3);
				var dd = "M" + cx0 + " " + cy0;
				var px2 = cx0;
				var py2 = cy0;
				for (var sg = 0; sg < seg; sg++) {
					px2 = round(px2 + (r() - 0.5) * 140);
					py2 = round(Math.min(898, py2 + r() * 24));
					dd += "L" + px2 + " " + py2;
				}
				s.push("<path d='" + dd + "'/>");
			}
			s.push("</g>");

			// ── вороны ──
			// Половина стаи парит, половина машет. Общий ритм читался бы
			// заводной игрушкой: живые птицы в стае не совпадают по фазе.
			var ravenN = Math.max(1, Math.round(6 * d));
			s.push("<g fill='" + C.raven + "'>");
			for (var v = 0; v < ravenN; v++) {
				var ry = round(140 + r() * 340);
				var rsc = round(0.42 + r() * 0.7);
				var rdur = round(52 + r() * 62);
				var rdel = round(-r() * rdur);
				var back = r() < 0.4;
				// Планирует ли эта птица. Парящие держат крылья почти
				// неподвижно, машущие хлопают с разным периодом.
				var glide = r() < 0.35;
				var flapDur = round(0.62 + r() * 0.55);
				var flapDel = round(-r() * flapDur);
				var wingR = glide ? "vg-glide-r" : "vg-wing-r";
				var wingL = glide ? "vg-glide-l" : "vg-wing-l";
				// Лёгкий крен корпуса: без него птица едет боком, как по рельсу.
				var bank = round((r() - 0.5) * 16);
				s.push(
					"<g style='animation:vg-sway " + round(5 + r() * 5) + "s ease-in-out infinite'>" +
						"<g transform='translate(" + round(r() * 1600) + "," + ry + ")'>" +
						"<g style='animation:" + (back ? "vg-cross-back" : "vg-cross") + " " + rdur +
						"s linear infinite;animation-delay:" + rdel + "s'>" +
						"<g transform='scale(" + rsc + ") rotate(" + bank + ")'>" +
						// Крылья вращаются вокруг плеча (начало координат), каждое
						// в свою сторону: левое — зеркало правого.
						"<use xlink:href='#vgWings' style='animation:" + wingR + " " + flapDur +
						"s ease-in-out infinite;animation-delay:" + flapDel + "s'/>" +
						// Тело поверх плеча, чтобы стык крыльев был скрыт.
						"<use xlink:href='#vgBody'/>" +
						"</g></g></g></g>"
				);
			}
			s.push("</g>");

			// ── пепел ──
			var emberN = Math.round(46 * d);
			s.push("<g>");
			for (var em = 0; em < emberN; em++) {
				var ex = round(r() * 1620 - 10);
				var ey = round(560 + r() * 340);
				var er = round(0.9 + r() * 2.2);
				var edur = round(9 + r() * 12);
				var edel = round(-r() * edur);
				var ecol = r() < 0.25 ? C.emberHot : C.ember;
				s.push(
					"<circle cx='" + ex + "' cy='" + ey + "' r='" + er + "' fill='" + ecol + "' opacity='.9' " +
						"style='animation:vg-rise " + edur + "s linear infinite,vg-flick " +
						round(1.4 + r() * 2.4) + "s ease-in-out infinite;animation-delay:" + edel + "s'/>"
				);
			}
			s.push("</g>");

			// ── слой тьмы ──
			// Последний: лёг поверх всей сцены, включая пепел и воронов. Без
			// него даже самая тёмная палитра читалась светлым пятном на оболочке.
			s.push("<rect width='1600' height='900' fill='url(#vgGloom)'/>");

			s.push("</svg>");
			return s.join("");
		}

		// ─────────────────────────────────────────────────────────────────────
		// Стили плагина
		// ─────────────────────────────────────────────────────────────────────

		var PLUGIN_CSS =
			".dsh-veil-panel{display:flex;flex-direction:column;gap:10px;min-width:264px;}" +
			".dsh-veil-row{display:flex;align-items:center;gap:10px;font-size:12px;line-height:1.4;}" +
			".dsh-veil-name{flex:0 0 132px;color:var(--dsw-alias-label-primary);}" +
			".dsh-veil-track{flex:1 1 auto;display:flex;align-items:center;gap:8px;min-width:0;}" +
			".dsh-veil-panel input[type=range]{flex:1 1 auto;min-width:0;accent-color:var(--dsw-alias-brand-primary);}" +
			".dsh-veil-panel input[type=checkbox]{accent-color:var(--dsw-alias-brand-primary);width:15px;height:15px;}" +
			".dsh-veil-value{flex:0 0 40px;text-align:right;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;}" +
			".dsh-veil-note{color:var(--dsw-alias-label-secondary);}" +
			// ── страница панели ──
			// Каркас повторяет штатные панели: прокручиваемое тело, шапка с
			// заголовком, контент в колонке с отступами. Своя вёрстка нужна
			// потому, что слот `main` отдаёт странице всю центральную колонку, и
			// без собственного `overflow` длинный список настроек уводил бы
			// прокрутку на всю оболочку.
			//
			// `container` объявлен на странице: по её ширине правила ниже
			// перестраивают сетку, а не по ширине окна — панель живёт в колонке,
			// и на узком окне ей нужен другой расклад, чем на широком.
			".dsh-veil-page{box-sizing:border-box;background:var(--dsw-alias-bg-base);" +
			"width:100%;min-width:0;height:100%;min-height:0;color:var(--dsw-alias-label-primary);" +
			"display:flex;flex-direction:column;font-size:13px;overflow:hidden;container:dsh-veil/inline-size;}" +
			".dsh-veil-scroll{flex:1 1 auto;min-height:0;overflow-y:auto;scrollbar-gutter:stable;}" +
			".dsh-veil-content{padding:0 clamp(20px,4vw,44px) 40px;}" +
			// `padding-top` учитывает верхнюю кромку окна на macOS: без переменной
			// заголовок уезжал бы под светофоры.
			".dsh-veil-head{display:flex;flex-wrap:wrap;align-items:center;gap:16px;" +
			"margin-bottom:20px;padding-top:28px;}" +
			"[data-platform=darwin] .dsh-veil-head{padding-top:calc(28px + var(--dsh-frame-top-clearance,0px));}" +
			".dsh-veil-title{margin:0;font-size:20px;font-weight:500;line-height:28px;flex:0 auto;min-width:0;}" +
			".dsh-veil-sub{margin:-14px 0 18px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.6;}" +
			// Карточка настроек: плотная, без «воздуха» ради воздуха.
			".dsh-veil-card{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);" +
			"border-radius:10px;padding:14px 16px;margin-bottom:12px;}" +
			".dsh-veil-card-title{margin:0 0 12px;font-size:13px;font-weight:600;line-height:1.4;}" +
			".dsh-veil-card-note{margin:10px 0 0;color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:1.55;}" +
			// Строка настройки: подпись, ползунок, значение. На узкой колонке
			// подпись уходит наверх, иначе ползунок сжимается в точку.
			".dsh-veil-field{display:flex;align-items:center;gap:12px;padding:7px 0;font-size:12px;line-height:1.4;}" +
			".dsh-veil-field+.dsh-veil-field{border-top:1px solid var(--dsw-alias-border-l1);}" +
			".dsh-veil-field-name{flex:0 0 130px;color:var(--dsw-alias-label-primary);}" +
			".dsh-veil-field-body{flex:1 1 auto;display:flex;align-items:center;gap:10px;min-width:0;}" +
			".dsh-veil-page input[type=range]{flex:1 1 auto;min-width:0;accent-color:var(--dsw-alias-brand-primary);}" +
			".dsh-veil-page input[type=checkbox]{accent-color:var(--dsw-alias-brand-primary);width:15px;height:15px;flex:none;}" +
			".dsh-veil-field-value{flex:0 0 44px;text-align:right;color:var(--dsw-alias-label-secondary);" +
			"font-variant-numeric:tabular-nums;}" +
			"@container dsh-veil (width<=560px){.dsh-veil-field{flex-wrap:wrap;}" +
			".dsh-veil-field-name{flex:1 1 100%;}}" +
			// Кнопки панели: сброс и предпросмотр схемы.
			".dsh-veil-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px;}" +
			".dsh-veil-btn{font:inherit;font-size:12px;cursor:pointer;border-radius:7px;padding:5px 14px;" +
			"border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);" +
			"color:var(--dsw-alias-label-primary);" +
			"transition:border-color var(--ds-transition-duration,.2s) var(--ds-ease-in-out,ease-in-out);}" +
			".dsh-veil-btn:hover{border-color:var(--dsw-alias-label-secondary);}" +
			// Образец палитры: видно, что тема даёт, не выходя из панели.
			".dsh-veil-swatches{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px;}" +
			".dsh-veil-swatch{width:34px;height:22px;border-radius:5px;" +
			"border:1px solid var(--dsw-alias-border-l2);}" +
			".dsh-veil-hint{margin:12px 0 0;color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:1.55;}";

		// ─────────────────────────────────────────────────────────────────────
		// Панель настроек
		// ─────────────────────────────────────────────────────────────────────

		/**
		 * Хук: перерисовать компонент при смене языка.
		 *
		 * Подписи слотов — thunk, и владелец перечитывает их сам, но текст ВНУТРИ
		 * компонента (заголовки карточек, пояснения) так не обновится: React не
		 * знает, что словарь сменился. Поэтому компонент подписывается на смену
		 * языка и форсирует собственный ререндер.
		 *
		 * Без подписки панель осталась бы на прежнем языке до перезагрузки — а это
		 * ровно тот дефект, который в тестах не виден.
		 *
		 * @param {Function} subscribe - подписка на локаль; возвращает отписку.
		 * @returns {number} счётчик ревизий: меняется, когда язык сменился.
		 */
		function useLocaleTick(subscribe) {
			var state = React.useState(0);
			var tick = state[1];
			React.useEffect(function () {
				if (typeof subscribe !== "function") return undefined;
				var drop = null;
				try {
					drop = subscribe(function () {
						tick(function (n) {
							return n + 1;
						});
					});
				} catch (error) {
					return undefined;
				}
				return function () {
					if (typeof drop === "function") {
						try {
							drop();
						} catch (error) {
							/* отписка не должна уносить панель */
						}
					}
				};
			}, []);
			return state[0];
		}

		/**
		 * Короткая строка темы в разделе «Общие».
		 *
		 * @param {object} props - run, persist, requestRepaint, t, subscribeLocale.
		 * @returns {object} элемент React.
		 */
		function Controls(props) {
			var run = props.run;
			var t = props.t;
			var saved = React.useState(0);
			var refresh = saved[1];
			useLocaleTick(props.subscribeLocale);

			/**
			 * Строка со счётчиком и ползунком.
			 * @param {string} label - подпись.
			 * @param {number} value - значение.
			 * @param {number} min - минимум.
			 * @param {number} max - максимум.
			 * @param {number} step - шаг.
			 * @param {(v: number) => void} onChange - реакция.
			 * @returns {object} элемент React.
			 */
			function slider(label, value, min, max, step, onChange) {
				return React.createElement(
					"div",
					{ className: "dsh-veil-row", key: label },
					React.createElement("span", { className: "dsh-veil-name" }, label),
					React.createElement(
						"span",
						{ className: "dsh-veil-track" },
						React.createElement("input", {
							type: "range",
							min: min,
							max: max,
							step: step,
							value: value,
							onChange: function (event) {
								onChange(Number(event.target.value));
								refresh(function (n) {
									return n + 1;
								});
								props.persist();
								props.requestRepaint();
							},
						}),
						React.createElement(
							"span",
							{ className: "dsh-veil-value" },
							step < 1 ? value.toFixed(2) : String(Math.round(value))
						)
					)
				);
			}

			return React.createElement(
				"div",
				{ className: "dsh-veil-panel" },
				React.createElement(
					"div",
					{ className: "dsh-veil-row" },
					React.createElement("span", { className: "dsh-veil-name" }, t("card.veil.title")),
					React.createElement(
						"span",
						{ className: "dsh-veil-track" },
						React.createElement("input", {
							type: "checkbox",
							checked: run.enabled !== false,
							onChange: function (event) {
								run.enabled = event.target.checked;
								refresh(function (n) {
									return n + 1;
								});
								props.persist();
								props.requestRepaint();
							},
						}),
						React.createElement(
							"span",
							{ className: "dsh-veil-note" },
							run.enabled === false ? t("state.off") : t("state.on")
						)
					)
				),
				slider(t("field.density"), run.density, 0.2, 2, 0.05, function (v) {
					run.density = v;
				}),
				slider(t("field.gloom"), run.tint, 0, 1, 0.05, function (v) {
					run.tint = v;
				}),
				slider(t("field.light"), run.lantern, 0, 1, 0.05, function (v) {
					run.lantern = v;
				})
			);
		}

		// ─────────────────────────────────────────────────────────────────────
		// Панель в левой колонке
		// ─────────────────────────────────────────────────────────────────────

		/**
		 * Иконка пункта левой панели.
		 *
		 * Слот `sidebar.panellist` отдаёт размер и признак активности; `size`
		 * обязателен — по нему оболочка выравнивает иконку в ряду.
		 * `data-dsh-panel-entry` с нашим id оболочка читает как якорь: по нему
		 * она связывает иконку с панелью в центральной колонке.
		 *
		 * @param {object} props - `size` и `active` от владельца слота.
		 * @returns {object} элемент React.
		 */
		function VeilPanelIcon(props) {
			var size = props && typeof props.size === "number" ? props.size : 16;
			return React.createElement(
				"svg",
				{
					"data-dsh-panel-entry": PANEL_ID,
					viewBox: "0 0 16 16",
					width: size,
					height: size,
					fill: "none",
					stroke: "currentColor",
					strokeWidth: "1.3",
					strokeLinecap: "round",
					strokeLinejoin: "round",
					"aria-hidden": "true",
				},
				// Стрельчатая арка врат: узнаётся силуэтом и не путается с
				// иконками-документами и списками соседних панелей.
				React.createElement("path", { d: "M4 14V7.4C4 5.3 5.8 3.6 8 2.4c2.2 1.2 4 2.9 4 5V14" }),
				React.createElement("path", { d: "M6.4 14V8.6c0-1.1.7-1.9 1.6-2.5.9.6 1.6 1.4 1.6 2.5V14" }),
				// Луна над аркой: вторая узнаваемая черта темы.
				React.createElement("circle", { cx: "12.4", cy: "4.4", r: "1.5" })
			);
		}

		/**
		 * Строка настройки на странице панели: подпись, ползунок, значение.
		 *
		 * @param {object} props - label, value, min, max, step, onChange, format.
		 * @returns {object} элемент React.
		 */
		function VeilField(props) {
			return React.createElement(
				"div",
				{ className: "dsh-veil-field" },
				React.createElement("span", { className: "dsh-veil-field-name" }, props.label),
				React.createElement(
					"span",
					{ className: "dsh-veil-field-body" },
					React.createElement("input", {
						type: "range",
						min: props.min,
						max: props.max,
						step: props.step,
						value: props.value,
						onChange: function (event) {
							props.onChange(Number(event.target.value));
						},
					}),
					React.createElement(
						"span",
						{ className: "dsh-veil-field-value" },
						props.format ? props.format(props.value) : String(props.value)
					)
				)
			);
		}

		/**
		 * Страница темы в центральной колонке.
		 *
		 * Слот `main` отдаёт странице всю колонку, поэтому она сама отвечает за
		 * прокрутку и шапку. Разметка повторяет штатные панели: заголовок,
		 * карточки настроек, образец палитры.
		 *
		 * @param {object} props - run, persist, requestRepaint, t, subscribeLocale.
		 * @returns {object} элемент React.
		 */
		function VeilPage(props) {
			var run = props.run;
			var t = props.t;
			var saved = React.useState(0);
			var refresh = saved[1];
			useLocaleTick(props.subscribeLocale);

			/**
			 * Перерисовать страницу после изменения настройки.
			 * @param {() => void} mutate - что изменить в run.
			 * @returns {void}
			 */
			function change(mutate) {
				mutate();
				refresh(function (n) {
					return n + 1;
				});
				props.persist();
				props.requestRepaint();
			}

			var swatches = [
				["--dsw-alias-brand-primary", t("swatch.brand")],
				["--dsw-alias-bg-base", t("swatch.base")],
				["--dsw-alias-bg-layer-1", t("swatch.layer1")],
				["--dsw-alias-bg-layer-2", t("swatch.layer2")],
				["--dsw-alias-label-primary", t("swatch.text")],
				["--dsw-alias-border-l2", t("swatch.border")],
			];

			return React.createElement(
				"div",
				{ className: "dsh-veil-page", "data-dsh-veil-view": "" },
				React.createElement(
					"div",
					{ className: "dsh-veil-scroll" },
					React.createElement(
						"div",
						{ className: "dsh-veil-content" },
						React.createElement(
							"div",
							{ className: "dsh-veil-head" },
							React.createElement("h1", { className: "dsh-veil-title" }, t("page.title"))
						),
						React.createElement("p", { className: "dsh-veil-sub" }, t("page.subtitle")),

						// ── карточка «Покров» ──
						React.createElement(
							"div",
							{ className: "dsh-veil-card" },
							React.createElement("h2", { className: "dsh-veil-card-title" }, t("card.veil.title")),
							React.createElement(
								"div",
								{ className: "dsh-veil-field" },
								React.createElement("span", { className: "dsh-veil-field-name" }, t("field.enabled")),
								React.createElement(
									"span",
									{ className: "dsh-veil-field-body" },
									React.createElement("input", {
										type: "checkbox",
										checked: run.enabled !== false,
										onChange: function (event) {
											var next = event.target.checked;
											change(function () {
												run.enabled = next;
											});
										},
									}),
									React.createElement(
										"span",
										{ className: "dsh-veil-note" },
										run.enabled === false ? t("state.off") : t("state.on")
									)
								)
							),
							React.createElement(
								"p",
								{ className: "dsh-veil-card-note" },
								run.enabled === false ? t("note.off") : t("note.on")
							)
						),

						// ── карточка «Сцена» ──
						React.createElement(
							"div",
							{ className: "dsh-veil-card" },
							React.createElement("h2", { className: "dsh-veil-card-title" }, t("card.scene.title")),
							React.createElement(VeilField, {
								label: t("field.density"),
								value: run.density,
								min: 0.2,
								max: 2,
								step: 0.05,
								format: function (v) {
									return v.toFixed(2);
								},
								onChange: function (v) {
									change(function () {
										run.density = v;
									});
								},
							}),
							React.createElement(VeilField, {
								label: t("field.gloom"),
								value: run.tint,
								min: 0,
								max: 1,
								step: 0.05,
								format: function (v) {
									return v.toFixed(2);
								},
								onChange: function (v) {
									change(function () {
										run.tint = v;
									});
								},
							}),
							React.createElement("p", { className: "dsh-veil-card-note" }, t("note.scene"))
						),

						// ── карточка «Фонарь» ──
						React.createElement(
							"div",
							{ className: "dsh-veil-card" },
							React.createElement("h2", { className: "dsh-veil-card-title" }, t("card.lantern.title")),
							React.createElement(VeilField, {
								label: t("field.light"),
								value: run.lantern,
								min: 0,
								max: 1,
								step: 0.05,
								format: function (v) {
									return v.toFixed(2);
								},
								onChange: function (v) {
									change(function () {
										run.lantern = v;
									});
								},
							}),
							React.createElement("p", { className: "dsh-veil-card-note" }, t("note.lantern"))
						),

						// ── карточка «Палитра» ──
						React.createElement(
							"div",
							{ className: "dsh-veil-card" },
							React.createElement("h2", { className: "dsh-veil-card-title" }, t("card.palette.title")),
							React.createElement(
								"div",
								{ className: "dsh-veil-swatches" },
								swatches.map(function (pair) {
									return React.createElement("span", {
										key: pair[0],
										className: "dsh-veil-swatch",
										title: pair[1],
										style: { background: "var(" + pair[0] + ")" },
									});
								})
							),
							React.createElement("p", { className: "dsh-veil-card-note" }, t("note.palette"))
						),

						// ── действия ──
						React.createElement(
							"div",
							{ className: "dsh-veil-actions" },
							React.createElement(
								"button",
								{
									type: "button",
									className: "dsh-veil-btn",
									onClick: function () {
										change(function () {
											run.density = 1;
											run.tint = 0.45;
											run.lantern = 0.7;
											run.enabled = true;
										});
									},
								},
								t("action.reset")
							)
						),
						React.createElement("p", { className: "dsh-veil-hint" }, t("hint.storage"))
					)
				)
			);
		}

		// ─────────────────────────────────────────────────────────────────────
		// Точка входа
		// ─────────────────────────────────────────────────────────────────────

		/**
		 * Включить тему.
		 *
		 * Порядок эффектов важен: сцена и слой ставятся первыми, затем CSS
		 * панели, затем правила прозрачности, затем токены, затем слоты. Слоты
		 * последними — они единственное место, где клиентский код может упасть
		 * уже после того, как фон вставлен, и каждая регистрация завёрнута в свой
		 * try, чтобы сбой панели не уносил ночь.
		 *
		 * @param {object} ctx - контекст клиентского плагина.
		 * @returns {void}
		 */
		function apply(ctx) {
			var prefs = loadPrefs();
			var storedOff = prefs.turnedOff === true;
			var run = {
				scheme: "dark",
				enabled: typeof prefs.enabled === "boolean" ? prefs.enabled : !storedOff,
				density: clamp01(prefs.density, 0.2, 2),
				tint: clamp01(prefs.tint, 0, 1),
				lantern: clamp01(prefs.lantern, 0, 1),
			};
			// Умолчания, когда ключа ещё нет: плотность средняя, сумрак глубокий,
			// фонарь заметный — тема должна читаться сразу после установки.
			if (typeof prefs.density !== "number") run.density = 1;
			if (typeof prefs.tint !== "number") run.tint = 0.45;
			if (typeof prefs.lantern !== "number") run.lantern = 0.7;

			// ── локализация ──
			// Словари регистрируются ДО первого рендера панели: иначе первый кадр
			// показал бы английские подписи при русском интерфейсе, а второй —
			// русские, то есть видимый скачок текста.
			//
			// `register` берёт словари всех локалей одним вызовом: так баланс
			// набора ключей проверяется в одном месте, и пропущенный ключ в
			// русском словаре виден сразу, а не всплывает английской строкой
			// посреди русского интерфейса.
			//
			// Регистрация обёрнута в try: сервис локализации необязателен, и его
			// отсутствие или отказ не должны уносить тему целиком.
			var locale = ctx.get("locale");
			if (locale !== undefined && locale !== null && typeof locale.register === "function") {
				try {
					ctx.effect(function () {
						return locale.register(NS, { en: en, ru: ru });
					}, "veil: dictionaries");
				} catch (error) {
					console.error("[veil] словари не зарегистрированы", error);
				}
			}
			var translated = makeTranslate(locale);
			var t = translated.t;
			// Подписка на смену языка: без неё текст внутри панели остался бы на
			// прежнем языке до перезагрузки, потому что React не знает о смене
			// словаря. Сервис может не отдать `subscribe` — тогда это no-op.
			var subscribeLocale =
				locale !== undefined && locale !== null && typeof locale.subscribe === "function"
					? function (fn) {
							return locale.subscribe(fn);
						}
					: null;

			var repaint = null;
			var repaintTimer = null;

			/**
			 * Перерисовать сцену, схлопывая частые вызовы в один.
			 * @returns {void}
			 */
			function requestRepaint() {
				if (repaint === null) return;
				if (repaintTimer !== null) return;
				repaintTimer = ctx.timeout(function () {
					repaintTimer = null;
					if (repaint !== null) repaint();
				}, 120);
			}

			// ── сцена, слой и живой фонарь ──
			ctx.effect(function () {
				var dropStyle = null;
				var dropLayer = null;
				var LAYER_CLASS = "dsh-veil-layer";
				// Живой фонарь: холст внутри слоя и его состояние. Объявлено здесь,
				// а не внутри placeLayer, потому что к нему обращается и paint().
				var live = { node: null, stop: null, colors: null };

				/**
				 * Слой картины.
				 *
				 * Отдельным элементом, а не фоном документа: оболочка кладёт
				 * непрозрачный фон на `#root`, и картинка на `html, body` оказывается
				 * за ним — плагин работает, а ночи не видно. Слой с z-index -1
				 * внутри изолированного контекста body встаёт между фоном страницы
				 * и содержимым приложения.
				 *
				 * @param {string} url - готовая ссылка на сцену.
				 * @param {object} page - документ.
				 * @returns {Function} снятие слоя.
				 */
				function placeLayer(url, page) {
					// Слой переиспользуется, если он уже в документе: оболочка
					// пересобирает содержимое body, и второй слой поверх первого
					// означал бы вдвое больше работы и вдвое плотнее мглу.
					var el = null;
					var kids = page.body.children || [];
					for (var ki = 0; ki < kids.length; ki++) {
						var name = kids[ki].className;
						if (name === LAYER_CLASS || (name && String(name).split(/\s+/).indexOf(LAYER_CLASS) >= 0)) {
							el = kids[ki];
							break;
						}
					}
					if (el === null) {
						el = page.createElement("div");
						el.className = LAYER_CLASS;
						el.setAttribute(CSS_ATTR, "layer");
						page.body.appendChild(el);
					}
					// Холст добавляется один раз и переиспользуется при перерисовке.
					if (el.firstChild === null || el.firstChild === undefined) {
						live.node = page.createElement("canvas");
						live.node.className = "dsh-veil-live";
						live.node.setAttribute("aria-hidden", "true");
						el.appendChild(live.node);
					}
					el.style.backgroundImage = url;
					return function () {
						if (el.parentNode) el.parentNode.removeChild(el);
					};
				}

				/**
				 * Живой фонарь: свет идёт за курсором и разгоняет тьму.
				 *
				 * Сцена запечена, но фонарь обязан быть живым: он отвечает на
				 * движение, а не повторяет путь. Свет рисуется аддитивно
				 * (`lighter`), поэтому наложение пятен только ярче, и фонарь не
				 * оставляет грязных стыков. Пепел, попадая в пятно, разгорается —
				 * ровно то, ради чего тема и затевалась: искатель несёт свет во тьму.
				 *
				 * @param {object} colors - палитра текущей схемы.
				 * @returns {Function} остановка цикла.
				 */
				function startLantern(colors) {
					var cv = live.node;
					var gc = cv.getContext("2d");
					var view = globalThis.document.defaultView;
					var C = colors;
					var W = 0;
					var H = 0;
					var dpr = 1;
					var px = -9999;
					var py = -9999;
					var tx = -9999;
					var ty = -9999;
					var power = 0;
					var motes = [];
					var lseed = 20261013;
					function r() {
						lseed = (lseed * 1103515245 + 12345) & 0x7fffffff;
						return lseed / 0x7fffffff;
					}
					function fit() {
						dpr = view && typeof view.devicePixelRatio === "number" ? view.devicePixelRatio : 1;
						var box = cv.getBoundingClientRect();
						W = Math.max(1, Math.round(box.width));
						H = Math.max(1, Math.round(box.height));
						cv.width = Math.round(W * dpr);
						cv.height = Math.round(H * dpr);
						gc.setTransform(dpr, 0, 0, dpr, 0, 0);
					}
					fit();
					var onResize = function () {
						fit();
					};
					view.addEventListener("resize", onResize);

					// Пепел в живом слое: поднимается медленно, к фонарю льнёт.
					var moteN = 60;
					for (var i = 0; i < moteN; i++) {
						motes.push({
							x: r() * 1600,
							y: r() * 900,
							vx: (r() - 0.5) * 6,
							vy: -6 - r() * 14,
							ph: r() * 6.283,
							sz: 0.7 + r() * 1.7,
						});
					}

					var last = 0;
					var hnd = 0;
					function loop(now) {
						var dt = last === 0 ? 0.033 : Math.min(0.05, (now - last) / 1000);
						last = now;
						// Сглаживание: свет не должен дёргаться за каждым пикселем.
						if (tx < -9000) {
							tx = px;
							ty = py;
						}
						tx += (px - tx) * Math.min(1, dt * 7);
						ty += (py - ty) * Math.min(1, dt * 7);
						power += ((px > -9000 ? 1 : 0) - power) * Math.min(1, dt * 3);

						gc.clearRect(0, 0, W, H);
						var lx = tx;
						var ly = ty;
						var R = (170 + 130 * run.lantern) * (0.55 + 0.45 * power);

						// Тьма по краям: фонарь в центре внимания, углы тонут.
						//
						// Градиент четырёхступенчатый, а не двух: с двумя тьма
						// ложилась широким блюдом с заметным тиром. Здесь центр
						// чистый, дальний круг ещё светел (там работает ореол
						// фонаря), и только самый край уходит в мрак — тень
						// вырастает из угла, а не накрывает экран.
						if (run.tint > 0.05) {
							var isLight = C === SCHEMES.light;
							var cx2 = lx < -9000 ? W / 2 : lx;
							var cy2 = ly < -9000 ? H / 2 : ly;
							var vg = gc.createRadialGradient(cx2, cy2, R * 0.55, cx2, cy2, Math.max(W, H) * 0.95);
							// Пропорции тьмы: в светлой схеме гасить осторожнее,
							// иначе утро превращалось в сумерки и сцена меркла.
							var deep = isLight ? 0.16 : 0.52;
							var mid = isLight ? 0.3 : 0.7;
							var aDeep = deep * run.tint;
							var aMid = mid * run.tint;
							vg.addColorStop(0, "rgba(0,0,0,0)");
							vg.addColorStop(0.55, "rgba(0,0,0,0)");
							vg.addColorStop(0.72, "rgba(" + (isLight ? "120,112,92" : "0,0,0") + "," + round2(aMid * 0.35) + ")");
							vg.addColorStop(0.88, "rgba(" + (isLight ? "120,112,92" : "0,0,0") + "," + round2(aMid) + ")");
							vg.addColorStop(1, "rgba(" + (isLight ? "90,84,70" : "0,0,0") + "," + round2(aDeep) + ")");
							gc.fillStyle = vg;
							gc.fillRect(0, 0, W, H);
						}

						// Свет фонаря: два наложенных пятна — широкое и ядро.
						if (power > 0.01) {
							gc.globalCompositeOperation = "lighter";
							var halo = gc.createRadialGradient(lx, ly, 0, lx, ly, R * 1.5);
							halo.addColorStop(0, C.lanternCore);
							halo.addColorStop(0.14, C.lantern);
							halo.addColorStop(0.5, "rgba(217,164,65,0.13)");
							halo.addColorStop(1, "rgba(217,164,65,0)");
							gc.globalAlpha = 0.5 * power * (0.4 + 0.6 * run.lantern);
							gc.fillStyle = halo;
							gc.beginPath();
							gc.arc(lx, ly, R * 1.5, 0, 6.2832);
							gc.fill();

							// Язык пламени: узкое вытянутое пятно вверх, как у свечи.
							var core = gc.createRadialGradient(lx, ly, 0, lx, ly, R * 0.42);
							core.addColorStop(0, C.lanternCore);
							core.addColorStop(0.6, "rgba(255,242,204,0.30)");
							core.addColorStop(1, "rgba(255,242,204,0)");
							gc.globalAlpha = 0.75 * power;
							gc.fillStyle = core;
							gc.beginPath();
							gc.ellipse(lx, ly, R * 0.3, R * 0.44, 0, 0, 6.2832);
							gc.fill();
							gc.globalCompositeOperation = "source-over";
							gc.globalAlpha = 1;
						}

						// Пепел: живёт сам, но в свету разгорается и льнёт к фонарю.
						gc.globalCompositeOperation = "lighter";
						for (var k = 0; k < motes.length; k++) {
							var mo = motes[k];
							mo.ph += dt * 0.9;
							mo.y += mo.vy * dt;
							mo.x += (mo.vx + Math.sin(mo.ph) * 5) * dt;
							var dxm = lx - mo.x;
							var dym = ly - mo.y;
							var dm = Math.sqrt(dxm * dxm + dym * dym);
							var near = dm < R * 1.8 ? 1 - dm / (R * 1.8) : 0;
							if (near > 0) {
								mo.x += (dxm / (dm || 1)) * near * 16 * dt;
								mo.y += (dym / (dm || 1)) * near * 16 * dt;
							}
							if (mo.y < -20) {
								mo.y = H + 12;
								mo.x = r() * W;
							}
							if (mo.x < -20) mo.x = W + 12;
							if (mo.x > W + 20) mo.x = -12;
							var bright = 0.18 + 0.82 * near;
							gc.globalAlpha = bright * (0.35 + 0.5 * run.lantern);
							gc.fillStyle = near > 0.5 ? C.emberHot : C.ember;
							gc.beginPath();
							gc.arc(mo.x, mo.y, mo.sz * (1 + near * 0.9), 0, 6.2832);
							gc.fill();
						}
						gc.globalAlpha = 1;
						gc.globalCompositeOperation = "source-over";

						hnd = view.requestAnimationFrame(loop);
					}

					var onMove = function (event) {
						px = event.clientX;
						py = event.clientY;
					};
					view.addEventListener("pointermove", onMove, { passive: true });
					// Курсор ушёл из окна — фонарь гаснет, но не исчезает рывком.
					var onLeave = function () {
						px = -9999;
						py = -9999;
					};
					view.addEventListener("pointerleave", onLeave);

					hnd = view.requestAnimationFrame(loop);
					return function () {
						view.removeEventListener("resize", onResize);
						view.removeEventListener("pointermove", onMove);
						view.removeEventListener("pointerleave", onLeave);
						if (hnd) view.cancelAnimationFrame(hnd);
					};
				}

				/**
				 * Нарисовать сцену заново: снять прежний слой и поставить новый.
				 * @returns {void}
				 */
				function paint() {
					if (dropStyle) {
						dropStyle();
						dropStyle = null;
					}
					if (dropLayer) {
						dropLayer();
						dropLayer = null;
					}
					// Прежний цикл останавливаем: paint() вызывается и при смене
					// темы, и два цикла на одном холсте рисовали бы в разные
					// палитры поверх друг друга.
					if (live.stop) {
						live.stop();
						live.stop = null;
					}

					var scheme = SCHEMES[run.scheme === "light" ? "light" : "dark"];
					var page = globalThis.document;

					if (run.enabled === false) {
						// Тема выключена: фон возвращается оболочке, холст снят.
						dropStyle = insertStyle("document", "html,body{background-color:transparent!important}");
						return;
					}

					var url = 'url("data:image/svg+xml,' + encodeURIComponent(buildScene(run)) + '")';
					// Цвет страницы ставится с !important: без него тема оболочки
					// перебивала его обычным правилом и подложка становилась светлой.
					dropStyle = insertStyle("document", "html,body{background-color:" + scheme.page + "!important}");

					if (page !== undefined && page.body !== undefined) {
						dropLayer = placeLayer(url, page);
						// Холст создан placeLayer в этом же вызове, и палитра берётся
						// та же, что и у сцены: на смене темы перерисовка идёт вся.
						// Необязательное последним и под защитой: фонарь не имеет
						// права уронить сцену.
						if (live.node !== null) {
							try {
								live.stop = startLantern(scheme);
							} catch (err) {
								console.error("[veil] фонарь не запустился", err);
							}
						}
					}
				}

				repaint = paint;
				paint();

				// Сторож фона: при перезагрузке графа хост снимает наш блок стиля.
				// Пока плагин жив, возвращаем фон на место — иначе ночь пропадает
				// до самого перезапуска DSH.
				var guard = setInterval(function () {
					if (dropLayer === null && dropStyle === null) return;
					var page = globalThis.document;
					if (page === undefined || typeof page.querySelector !== "function") return;
					if (page.querySelector("[" + CSS_ATTR + '="layer"]') !== null) return;
					if (page.querySelector("style[" + CSS_ATTR + '="document"]') !== null) return;
					paint();
				}, 2500);

				return function () {
					clearInterval(guard);
					if (live.stop) live.stop();
					live.stop = null;
					repaint = null;
					if (dropStyle) dropStyle();
					if (dropLayer) dropLayer();
				};
			});

			// ── CSS панели ──
			ctx.effect(function () {
				return insertStyle("plugin", PLUGIN_CSS);
			});

			// ── порядок слоёв ──
			// body создаёт контекст наложения, картина встаёт под содержимым, а
			// `#root` поднимается над ней. Прозрачность `#root` задаёт плагин, а не
			// штатная тема оболочки: пока прозрачным его делала тема, ночь была
			// видна; обновление оболочки сделало `#root` непрозрачным — и ночь
			// пропала при живом плагине и зарегистрированных слотах.
			//
			// Снимается только background-color, а не background целиком: иначе
			// пропали бы стеклянные градиенты панелей, ради которых тема и
			// затевалась. Прозрачной становится сплошная подложка, а изображения и
			// градиенты остаются.
			ctx.effect(function () {
				return insertStyle(
					"layer",
					"body{position:relative;isolation:isolate}" +
						"html,body{background-color:transparent!important}" +
						"#root{position:relative;z-index:10;background-color:transparent!important}" +
						"#root input,#root textarea,#root select{backdrop-filter:blur(6px)}" +
						// Правило собирается ОДНИМ куском. Оно склеено из строк, и
						// вставка чего-либо между ними уводит объявления второго
						// куска в конец следующего правила: слой остаётся без
						// pointer-events:none и начинает перехватывать клики.
						".dsh-veil-layer{position:fixed;inset:0;z-index:-1;" +
						"background-size:100% 100%;background-position:center center;" +
						"background-repeat:no-repeat;pointer-events:none}" +
						// Живой холст лежит ВНУТРИ слоя, а не в накладке оболочки.
						// Слой при z-index −1, значит и холст под интерфейсом.
						".dsh-veil-live{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}"
				);
			});

			// ── токены темы ──
			// Слой накладывается ОДИН раз. Перекладывать его на каждое событие
			// `theme/change` нельзя: `overrideTokens` сам публикует `theme/change`,
			// слушатель звал бы его снова, и стекло уходило в бесконечную
			// рекурсию (RangeError: Maximum call stack size exceeded). Работает
			// форма слоя: каждому токену заданы ОБЕ схемы, и тема выбирает нужную
			// сама. На событии остаётся узнать схему и перерисовать сцену.
			ctx.effect(function () {
				var theme = ctx.get("theme");
				if (theme === undefined || theme === null) return;

				/**
				 * Прочитать схему из снимка темы.
				 * @param {object} snapshot - снимок.
				 * @returns {string} "light" или "dark".
				 */
				function schemeOf(snapshot) {
					return snapshot && snapshot.active && snapshot.active.colorScheme === "light" ? "light" : "dark";
				}

				try {
					var scheme = schemeOf(theme.getTheme());
					if (scheme !== run.scheme) {
						run.scheme = scheme;
						// Схема читается до первой отрисовки сцены: со светлой темой
						// пользователь иначе увидел бы первый тёмный кадр, а потом вздрог.
						requestRepaint();
					}
					var dark = buildTokens(false);
					var light = buildTokens(true);
					var pair = {};
					for (var key in dark) pair[key] = { light: light[key], dark: dark[key] };
					theme.overrideTokens(TOKEN_SOURCE, pair);
				} catch (error) {
					// Стекло — украшение. Ошибка темы не должна уносить ночь.
					console.error("[veil] токены темы не применились", error);
				}

				return ctx.on("theme/change", function (snapshot) {
					var next = schemeOf(snapshot);
					if (next === run.scheme) return;
					// Схема сцены меняется, а слой стекла остаётся прежним: обе
					// схемы в нём уже заданы, и тема выбрала нужную сама.
					run.scheme = next;
					requestRepaint();
				});
			});

			// ── слоты ──
			// Слотов в apply нет: `ctx.get("slots")` делал весь плагин реактивным
			// к появлению сервиса — и отсюда «ночь появилась, а потом исчезла»:
			// контекст протухал, эффекты снимались, и apply вызывался заново.
			// Теперь слоты ищет собственный эффект, и ночь от их появления не
			// зависит. Раннего выхода нет: пока сервиса нет, эффект ничего не
			// делает и ждёт перезапуска, когда сервис появится.
			ctx.effect(function () {
				var slots = ctx.get("slots");
				if (slots === undefined || slots === null) return;
				// Регистрация слотов — единственное место, где клиентский код может
				// упасть уже после того, как фон вставлен. На пересборке графа слот
				// может быть занят, повторная регистрация с тем же id бросает
				// исключение, а исключение из apply уносит волокно вместе с фоном.
				// Поэтому каждая регистрация стоит в своём try: сбой панели не
				// должен уносить ночь.
				//
				// Настройки живут в ДВУХ местах, и это не дублирование:
				//   • `sidebar.panellist` + `main` — своя страница в левой панели,
				//     где помещаются пояснения и образец палитры;
				//   • `settings.general.item` — короткая строка в «Настройках»,
				//     чтобы переключатель темы был там, где его ищут.
				// Обе половины читают один и тот же `run`, поэтому расхождению
				// взяться неоткуда.
				//
				// Подписи слотов — ФУНКЦИИ, а не строки: владелец слота перечитывает
				// thunk на каждой проекции, поэтому смена языка обновляет подпись
				// без повторной регистрации. Строка застыла бы на языке, который
				// был активен в момент регистрации.
				try {
					slots.inject("sidebar.panellist", function () {
						return slots.register(
							{
								name: "sidebar.panellist",
								id: PANEL_ID,
								order: 40,
								label: function () {
									return t("panel.label");
								},
							},
							VeilPanelIcon
						);
					});
				} catch (error) {
					console.error("[veil] иконка панели не зарегистрирована", error);
				}

				try {
					slots.inject("main", function () {
						return slots.register({ name: "main", key: PANEL_ID }, function () {
							return React.createElement(VeilPage, {
								run: run,
								t: t,
								subscribeLocale: subscribeLocale,
								persist: function () {
									savePrefs(run);
								},
								requestRepaint: requestRepaint,
							});
						});
					});
				} catch (error) {
					console.error("[veil] страница панели не зарегистрирована", error);
				}

				try {
					slots.inject("settings.general.item", function () {
						return slots.register(
							{
								name: "settings.general.item",
								id: "dsh-veil",
								order: 31,
								label: function () {
									return t("panel.label");
								},
							},
							function () {
								return React.createElement(Controls, {
									run: run,
									t: t,
									subscribeLocale: subscribeLocale,
									persist: function () {
										savePrefs(run);
									},
									requestRepaint: requestRepaint,
								});
							}
						);
					});
				} catch (error) {
					console.error("[veil] строка в настройках не зарегистрирована", error);
				}
			});
		}

		exports.apply = apply;
		// Объявленные сервисы — это не украшение, а условие работы: fiber ждёт их
		// появления, и только после этого ctx.get начинает отдавать живой сервис.
		// С пустым inject эффекты темы и слотов выполнялись один раз, видели
		// «сервиса нет» и больше не перезапускались — стекло не накладывалось,
		// панель настроек не появлялась.
		//
		// `timer` обязателен по той же причине, но с обратной стороны: без него
		// `ctx.timeout` бросает «cannot get property "timer" without inject», а
		// requestRepaint() зовёт ctx.timeout на пересборку сцены.
		//
		// `locale` — жёсткая зависимость, а не `ctx.get`: переводчик нужен обеим
		// половинам панели с первого кадра, и ждать появления сервиса честнее,
		// чем отрисовать английский текст при русском интерфейсе. Сам перевод
		// при этом терпим к отсутствию сервиса — см. makeTranslate.
		exports.inject = ["theme", "slots", "timer", "locale"];
		return module.exports;
	},
});
