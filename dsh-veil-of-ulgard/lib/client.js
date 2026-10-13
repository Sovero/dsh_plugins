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
		 * Округление до десятых: координаты SVG не должны тащить длинные числа.
		 * @param {number} n - значение.
		 * @returns {number} округлённое.
		 */
		function round(n) {
			return Math.round(n * 10) / 10;
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
				skyTop: "#02040a",
				skyMid: "#060a12",
				skyLow: "#0b1018",
				horizon: "#141b26",
				glowWarm: "#2e2210",
				moon: "#ded8c4",
				moonGlow: "#f2e6c4",
				cloud: "#0d121b",
				cloudEdge: "#1a2230",
				spireFar: "#151d2a",
				spireMid: "#0b111b",
				spireNear: "#04070d",
				gate: "#03050a",
				ground: "#05080e",
				crack: "#0d121b",
				window: "#e8a24a",
				ember: "#e8a24a",
				emberHot: "#ffdca6",
				raven: "#03050a",
				mist: "#4a5468",
				lantern: "#f0c070",
				lanternCore: "#fff2cc",
				page: "#02040a",
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
			// Ворон: взмах задаётся сжатием крыла по вертикали.
			"@keyframes vg-flap{0%,100%{transform:scaleY(1)}50%{transform:scaleY(.42)}}" +
			"@keyframes vg-cross{from{transform:translateX(-200px)}to{transform:translateX(1800px)}}" +
			"@keyframes vg-cross-back{from{transform:translateX(1800px)}to{transform:translateX(-200px)}}" +
			// Луна за покровом: дыхание света, а не мигание.
			"@keyframes vg-halo{0%,100%{opacity:.55}50%{opacity:.9}}" +
			"@keyframes vg-sway{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}" +
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
			if (lit) {
				var rows = Math.max(1, Math.floor(h / 120));
				out += "<g fill='" + windowCol + "'>";
				for (var ry = 0; ry < rows; ry++) {
					var wy = top + 46 + ry * (h / (rows + 1)) * 0.62;
					if (wy > base - 30) break;
					var cols = r() < 0.55 ? 1 : 2;
					for (var cx2 = 0; cx2 < cols; cx2++) {
						if (r() < 0.45) continue;
						var wx = x - (cols === 1 ? 0 : 7) + cx2 * 14 + (r() - 0.5) * 3;
						out +=
							"<rect x='" + round(wx) + "' y='" + round(wy) + "' width='3.4' height='" +
							round(5 + r() * 3) + "' opacity='" + round(0.35 + r() * 0.5) + "'/>";
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
		 * Ворон — силуэт в размахе. Крылья сходятся в теле, хвост оттянут.
		 * @returns {string} путь.
		 */
		function ravenPath() {
			return "M-13 0 C-9 -7 -4 -9 0 -4 C4 -9 9 -7 13 0 C8 -2 4 -1 0 3 C-4 -1 -8 -2 -13 0 Z";
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
			// Свет луны: широкий ореол, гаснущий к краям.
			s.push(
				"<radialGradient id='vgHalo' cx='.5' cy='.5' r='.5'>" +
					"<stop offset='0' stop-color='" + C.moonGlow + "' stop-opacity='.85'/>" +
					"<stop offset='.35' stop-color='" + C.moonGlow + "' stop-opacity='.28'/>" +
					"<stop offset='1' stop-color='" + C.moonGlow + "' stop-opacity='0'/>" +
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
			// Силуэты переиспользуются: шпили и вороны ставятся через <use>.
			s.push("<g id='vgRaven'><path d='" + ravenPath() + "'/></g>");
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
			s.push(
				"<g style='animation:vg-halo 11s ease-in-out infinite'>" +
					"<circle cx='1276' cy='168' r='300' fill='url(#vgHalo)'/>" +
					"</g>"
			);
			s.push(
				"<circle cx='1276' cy='168' r='64' fill='" + C.moon + "' opacity='" + (light ? 0.92 : 0.86) + "'/>"
			);
			// Покров: тонкие перистые полосы в левой части неба. Пять эллипсов
			// вокруг луны давали концентрические кольца, сплошные тучи — тёмные
			// кляксы: полупрозрачная фигура на градиенте читается своей формой, а
			// не цветом. Поэтому полосы длинные, плоские и уведены от диска луны,
			// чтобы не спорить с ним; свет они гасят, а не подкрашивают.
			s.push("<g filter='url(#vgCloud)' opacity='.5'>");
			for (var cl = 0; cl < 5; cl++) {
				s.push(
					"<ellipse cx='" + round(120 + r() * 880) + "' cy='" + round(70 + r() * 300) +
						"' rx='" + round(190 + r() * 300) + "' ry='" + round(5 + r() * 9) +
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
			var ravenN = Math.max(1, Math.round(7 * d));
			s.push("<g fill='" + C.raven + "'>");
			for (var v = 0; v < ravenN; v++) {
				var ry = round(150 + r() * 330);
				var rsc = round(0.5 + r() * 0.75);
				var rdur = round(46 + r() * 54);
				var rdel = round(-r() * rdur);
				var back = r() < 0.4;
				s.push(
					"<g style='animation:vg-sway " + round(4 + r() * 4) + "s ease-in-out infinite'>" +
						"<g transform='translate(" + round(r() * 1600) + "," + ry + ")'>" +
						"<g style='animation:" + (back ? "vg-cross-back" : "vg-cross") + " " + rdur +
						"s linear infinite;animation-delay:" + rdel + "s'>" +
						"<g transform='scale(" + rsc + ")' style='animation:vg-flap " +
						round(0.5 + r() * 0.5) + "s ease-in-out infinite;transform-box:fill-box;transform-origin:center'>" +
						"<use xlink:href='#vgRaven'/>" +
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
			".dsh-veil-note{color:var(--dsw-alias-label-secondary);}";

		// ─────────────────────────────────────────────────────────────────────
		// Панель настроек
		// ─────────────────────────────────────────────────────────────────────

		/**
		 * Панель настроек темы в разделе «Общие».
		 *
		 * @param {object} props - run, persist, requestRepaint.
		 * @returns {object} элемент React.
		 */
		function Controls(props) {
			var run = props.run;
			var saved = React.useState(0);
			var refresh = saved[1];

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
					React.createElement("span", { className: "dsh-veil-name" }, "Покров"),
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
							run.enabled === false ? "тьма отступила" : "ночь Ульгарда"
						)
					)
				),
				slider("Плотность", run.density, 0.2, 2, 0.05, function (v) {
					run.density = v;
				}),
				slider("Сумрак", run.tint, 0, 1, 0.05, function (v) {
					run.tint = v;
				}),
				slider("Фонарь", run.lantern, 0, 1, 0.05, function (v) {
					run.lantern = v;
				})
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
						if (run.tint > 0.05) {
							var vg = gc.createRadialGradient(
								lx < -9000 ? W / 2 : lx,
								ly < -9000 ? H / 2 : ly,
								R * 0.6,
								lx < -9000 ? W / 2 : lx,
								ly < -9000 ? H / 2 : ly,
								Math.max(W, H) * 0.92
							);
							var a = (C === SCHEMES.light ? 0.05 : 0.42) * run.tint;
							vg.addColorStop(0, "rgba(0,0,0,0)");
							vg.addColorStop(1, C === SCHEMES.light ? "rgba(120,112,92," + a + ")" : "rgba(0,0,0," + a + ")");
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
				try {
					slots.inject("settings.general.item", function () {
						return slots.register(
							{ name: "settings.general.item", id: "dsh-veil", order: 31, label: "Покров Ульгарда" },
							function () {
								return React.createElement(Controls, {
									run: run,
									persist: function () {
										savePrefs(run);
									},
									requestRepaint: requestRepaint,
								});
							}
						);
					});
				} catch (error) {
					console.error("[veil] панель настроек не зарегистрирована", error);
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
		exports.inject = ["theme", "slots", "timer"];
		return module.exports;
	},
});
