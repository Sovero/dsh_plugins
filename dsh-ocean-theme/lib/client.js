// Тема «Океан» — браузерная половина локального плагина `dsh-ocean-theme`.
//
// ФОРМА ФАЙЛА. Это не ESM. `dsh-client-modules` читает файл как текст, склеивает
// с соседними бандлами и отдаёт браузеру обычным скриптом. Скрипт на верхнем
// уровне только РЕГИСТРИРУЕТ фабрику; всё её тело выполняется при первом импорте.
// Внутри фабрики — обычный CJS: `require` отдаёт зарегистрированные модули,
// `module.exports` — то, что потом разберёт загрузчик. Поэтому здесь не может
// быть ни `import`, ни `export`, ни JSX.
//
// ЧТО ГДЕ ЖИВЁТ. Сцена — отдельный слой .dsh-ocean-layer с z-index -1, то есть под всем
// интерфейсом: токен `--dsw-alias-bg-base` при этом становится полупрозрачным
// стеклом, и сквозь него видно воду. Сверху лежит только тонкий слой в
// `shell.overlay`: возмущение воды от курсора и мелкая рыбёшка, которая от него
// разбегается. Токены темы переопределяются сразу для светлой и тёмной палитр,
// так что переключатель «Светлая/Тёмная/Системная» в настройках работает штатно.

window.__ModuleLoader__.load({
	id: "dsh-ocean-theme",
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

		/** Ключ настроек темы в localStorage: включение, плотность, яркость. */
		var PREFS_KEY = "dsh-ocean-theme.prefs";

		/** Атрибут, под которым вставляется собственный CSS плагина. */
		var CSS_ATTR = "data-dsh-ocean-theme";

		/** Округление до десятых: координаты SVG не должны тащить длинные числа. */
		function round(n) {
			return Math.round(n * 10) / 10;
		}

		/**
		 * Прочитать сохранённые настройки. Любая поломка — просто значения по умолчанию.
		 * @returns {{ enabled?: boolean, density?: number, tint?: number }} прочитанное.
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
		 *
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

		/** Палитры сцены. Светлая — мель, тёмная — глубина; силуэты общие. */
		var SCHEMES = {
			dark: {
				// Палитра по референсу: от светлой бирюзы на поверхности к глубокому
// синему на дне. Ступеней четыре, а не две — каждая читается отдельно.
surf: "#7fd8ea", beam: "#eafcff", mid: "#2f9dc0", deep: "#14688e", floor: "#0b3550",
band1: "#a6e6f4", band2: "#63c4de", bed: "#062a44", wreck: "#0b3b5c",
				glow: "#5fd3e8", body: "#08202e",
// Рыбы: своя палитра у каждого вида — спина, тело, брюхо, кант.
fish: [
	{ deep: "#1b5f7a", mid: "#3d9cba", belly: "#bfe9f2", edge: "#dcf7ff" },
	{ deep: "#2f5382", mid: "#5b86b8", belly: "#cfe4f5", edge: "#e6f3ff" },
	{ deep: "#5a4f86", mid: "#8d81bb", belly: "#ded4f2", edge: "#f0e9ff" },
		{ deep: "#8a6132", mid: "#c39055", belly: "#f6e2c2", edge: "#fff2dc" },
	{ deep: "#0d7a52", mid: "#2fb380", belly: "#d9f6e2", edge: "#e8fff2" },
	{ deep: "#1a5fa8", mid: "#4e93d8", belly: "#dbeafb", edge: "#eaf3ff" },
	{ deep: "#a8412f", mid: "#e0795a", belly: "#ffe0cf", edge: "#fff0e8" },
	{ deep: "#b8892c", mid: "#e0b463", belly: "#fdeeca", edge: "#fff6e2" }
], body2: "#05283a",
				bell: "#a8e6f7", rim: "#cdf3fb", edge: "#c4f0fa", core: "#7fdcf0", ten: "#a8e6f7", jg: "#6fdcf0",
				weedFar: "#2a8a7a", weedMid: "#2fa06a", weedNear: "#3cbb73", hold: "#1d6b53",
				snow: "#cfeff8", bub: "#bfeaf7", caustic: "#a6ecf8", page: "#04141f"
			},
			light: {
				surf: "#e8f8fc", beam: "#ffffff", mid: "#57bcd6", deep: "#1a7fa0", floor: "#0d5a7d",
band1: "#ffffff", band2: "#9fdfef", bed: "#0b4a66", wreck: "#0a5b7d",
				glow: "#ffffff", body: "#04364d", body2: "#0a5c79",
				bell: "#ffffff", rim: "#0d6a86", edge: "#ffffff", core: "#0d6a86", ten: "#0e6f8c", jg: "#ffffff",
				// Светлая схема: тот же порядок тонов, но пастельнее — вода на светлом
// фоне съедает насыщенность, и тёмный оттенок здесь тонул бы.
fish: [
	{ deep: "#3f93b0", mid: "#6fbcd3", belly: "#e6f7fb", edge: "#ffffff" },
	{ deep: "#4a7fb0", mid: "#7ba5cd", belly: "#eaf3fc", edge: "#ffffff" },
	{ deep: "#8b7fbd", mid: "#aca1d6", belly: "#efe9fb", edge: "#ffffff" },
	{ deep: "#b8742f", mid: "#d99a52", belly: "#fdf0da", edge: "#ffffff" },
	{ deep: "#3fa880", mid: "#71c9a5", belly: "#e3f8ee", edge: "#ffffff" },
	{ deep: "#5f96cf", mid: "#8fb8e2", belly: "#e6f0fb", edge: "#ffffff" },
	{ deep: "#c96a52", mid: "#e79b81", belly: "#fdece2", edge: "#ffffff" },
	{ deep: "#d6a54a", mid: "#ecc484", belly: "#fdf3e0", edge: "#ffffff" }
],
weedFar: "#6fbfb2", weedMid: "#3fa882", weedNear: "#228a64", hold: "#1d6a4f",
				snow: "#ffffff", bub: "#ffffff", caustic: "#ffffff", page: "#0b6a8a"
			}
		};

		/** Токены темы: интерфейс становится стеклом, сквозь которое видно океан. */
		function buildTokens(light) {
			return {
				"--dsw-alias-bg-base": light ? "rgba(214,241,247,0.50)" : "rgba(3,16,26,0.42)",
				"--dsw-alias-bg-layer-1": light ? "rgba(255,255,255,0.76)" : "rgba(9,32,45,0.74)",
				"--dsw-alias-bg-layer-2": light ? "rgba(243,252,253,0.82)" : "rgba(11,40,55,0.80)",
				"--dsw-alias-bg-overlay": light ? "rgba(255,255,255,0.94)" : "rgba(6,26,38,0.94)",
				"--dsw-alias-border-l1": light ? "rgba(11,90,110,0.16)" : "rgba(154,230,244,0.14)",
				"--dsw-alias-border-l2": light ? "rgba(11,90,110,0.30)" : "rgba(154,230,244,0.28)",
				"--dsw-alias-brand-primary": light ? "#0d8ea8" : "#54d3e2",
				"--dsw-alias-label-primary": light ? "#06303d" : "#e8f8fc",
				"--dsw-alias-label-secondary": light ? "#2b6a7a" : "#9cc3d0",
				"--dsw-alias-state-error-primary": light ? "#c0392b" : "#ff7a70",
				"--dsw-alias-state-success-primary": light ? "#1c8a58" : "#4ade80",
				"--dsw-alias-state-warn-primary": light ? "#b8800f" : "#fbbf24",
				"--dsw-specific-sidebar-fill": light ? "rgba(255,255,255,0.55)" : "rgba(5,22,34,0.52)"
			};
		}

		/** Анимации сцены. Всё это CSS внутри SVG-фона, а не JS: движется сам браузер. */
		var SCENE_STYLE =
			"<style>" +
			"@keyframes ln{from{transform:translateX(-400px)}to{transform:translateX(2000px)}}" +
// Второй ход, справа налево. Направление задаёт анимация, а не зеркало
// тела: раньше анимация была одна, а поворот выбирался отдельно, и
// половина тел ехала мордой в одну сторону, а задом в другую.
"@keyframes lnr{from{transform:translateX(2000px)}to{transform:translateX(-400px)}}" +
			"@keyframes sh{from{transform:translateX(-30px)}to{transform:translateX(30px)}}" +
			// Хвост качается вокруг места, где он прирос к телу.
"@keyframes tw{from{transform:rotate(-9deg)}to{transform:rotate(11deg)}}" +
// Плавник — вокруг основания. Точку опоры задаёт fill-box: у SVG по
// умолчанию transform-origin считается от центра viewBox, и без этого
// плавник улетел бы из кадра вместо того, чтобы качнуться.
"@keyframes fd{from{transform:rotate(-5deg)}to{transform:rotate(6deg)}}" +
// Усы-бородка качаются вокруг места выхода изо рта, а не вокруг
// начала координат: иначе нить отрывалась бы от головы.
"@keyframes br{from{transform:rotate(-7deg)}to{transform:rotate(8deg)}}" +
// Бибка удильщика и конёк: оба качаются вокруг своей точки опоры.
"@keyframes lu{from{transform:rotate(-5deg)}to{transform:rotate(6deg)}}" +
"@keyframes sw{from{transform:rotate(-3deg)}to{transform:rotate(3deg)}}" +
// Коралл качается медленнее и слабее водоросли: он жёстче и тяжелее.
"@keyframes wv{from{transform:rotate(-1.6deg)}to{transform:rotate(1.6deg)}}" +
// Крен корпуса: им читается смена курса. Вложен внутрь animateMotion
// отдельной группой — на саму animateMotion его вешать нельзя, CSS-
// перемещение перебило бы движение по пути.
"@keyframes swr{from{transform:rotate(-2.6deg)}to{transform:rotate(2.6deg)}}" +
// Гребок ластами: две ласты в противофазе, как ножницы. Ось поворота —
// пятка, поэтому носок машет, а пятка стоит на месте.
// Зеркальная дорожка: та же траектория справа налево, для водолаза,
// который идёт в другую сторону. Без неё он ехал задом наперёд.
"@keyframes bb{from{transform:translateY(-9px)}to{transform:translateY(9px)}}" +
			"@keyframes tn{from{transform:rotate(-5deg)}to{transform:rotate(5deg)}}" +
			"@keyframes wf{from{transform:scaleY(.82)}to{transform:scaleY(1.12)}}" +
			"@keyframes wv{from{transform:rotate(-5deg)}to{transform:rotate(5deg)}}" +
			"@keyframes wv2{from{transform:rotate(-15deg)}to{transform:rotate(15deg)}}" +
			// Длина хода блика разная у каждого: своя передаётся через --dx, иначе
// эллипсы разного размера возвращались бы с разных краёв кадра.
// ВОДОЛАЗ. Виден примерно половину цикла, остальное за краем кадра:
// момент появления не должен попадать в поле зрения.
// Пузыри от регулятора: поднимаются вдоль тела и гаснут, отсюда шлейф.
			"@keyframes cz{from{transform:translateX(0)}to{transform:translateX(700px)}}" +
			"@keyframes sn{from{transform:translate(0,-40px)}to{transform:translate(-70px,940px)}}" +
			"@keyframes bk{from{transform:translateY(980px)}to{transform:translateY(-90px)}}" +
			"@keyframes bw{from{transform:translateX(-15px)}to{transform:translateX(15px)}}" +
// Пузырь расширяется на подъёме, иначе у поверхности он мельче, чем у дна,
// и до неё доходит незаметно.
"@keyframes bg{from{transform:scale(0.5)}to{transform:scale(1.7)}}" +
// Вспышка у поверхности. Пузырь выходит на неё на 0,916 хода (980 из
// 1070 единиц), и у вспышки тот же период и та же задержка, поэтому
// совпадение точное, а не примерное.
"@keyframes bs{0%,88%{opacity:0;transform:scale(0.2)}92%{opacity:0.5;transform:scale(0.7)}100%{opacity:0;transform:scale(1.6)}}" +
			"@keyframes jp{from{transform:scale(1,1)}to{transform:scale(.87,1.15)}}" +
			"@keyframes jw{from{transform:rotate(-7deg) scale(.97)}to{transform:rotate(7deg) scale(1.04)}}" +
			// Дрейф по глубине. Вложен внутрь движения отдельной группой: у группы
			// с атрибутом transform своя анимация перебила бы само горизонтальное
			// движение, и медуза стояла бы на месте.
			"@keyframes jd{from{transform:translateY(-30px)}to{transform:translateY(30px)}}" +
			".ln{animation:ln linear infinite}" +
".lnr{animation:lnr linear infinite}" +
			// Плоскости глубины. Чем ниже, тем темнее силуэт, мягче контур и
			// гуще тень под телом. Тень и есть объём: без неё силуэт читается
			// как наклейка, а не как тело в воде.
			".pl0{filter:brightness(1.08)}" +
			".pl1{filter:brightness(0.93)}" +
			".pl2{filter:brightness(0.79)}" +
			".pl3{filter:brightness(0.64) blur(0.5px) drop-shadow(0 1px 1.5px rgba(2,20,30,0.45))}" +
			".pl4{filter:brightness(0.49) blur(1.1px) drop-shadow(0 1.6px 2.4px rgba(2,20,30,0.6))}" +
			".sh{animation:sh ease-in-out infinite alternate}" +
".tw{animation:tw ease-in-out infinite alternate;transform-box:fill-box;transform-origin:100% 50%}" +
".fd{animation:fd ease-in-out infinite alternate;transform-box:fill-box;transform-origin:50% 100%}" +
".br{animation:br ease-in-out infinite alternate;transform-box:fill-box;transform-origin:0% 50%}" +
".lu{animation:lu ease-in-out infinite alternate;transform-box:fill-box;transform-origin:100% 100%}" +
".sw{animation:sw ease-in-out infinite alternate;transform-box:fill-box;transform-origin:50% 0%}" +
".wv{animation:wv ease-in-out infinite alternate;transform-box:fill-box;transform-origin:50% 100%}" +
".swr{animation:swr ease-in-out infinite alternate;transform-box:fill-box;transform-origin:50% 50%}" +
			".bb{animation:bb ease-in-out infinite alternate}" +
			".tn{animation:tn ease-in-out infinite alternate}" +
			".wf{animation:wf ease-in-out infinite alternate}" +
			".wv{animation:wv ease-in-out infinite alternate}" +
			".wv2{animation:wv2 ease-in-out infinite alternate}" +
			".dp{animation:dp linear infinite}" +
			".cz{fill:none;stroke-width:2.2;stroke-linecap:round;animation:cz linear infinite}" +
			".sn{animation:sn linear infinite}" +
			".bk{animation:bk linear infinite}" +
".bg{animation:bg linear infinite}" +
".bs{animation:bs linear infinite}" +
			".bw{animation:bw ease-in-out infinite alternate}" +
			".jp{animation:jp ease-in-out infinite alternate}" +
			".jd{animation:jd ease-in-out infinite alternate}" +
			".jw{animation:jw ease-in-out infinite alternate}" +
			"</style>";

		/**
		 * Точка на квадратичной кривой Безье — осевая линия лопасти.
		 * @param {number} t - параметр 0..1.
		 * @param {number} ang - начальный угол отхода от основания.
		 * @param {number} len - длина лопасти.
		 * @param {number} bend - изгиб, радианы.
		 * @returns {[number, number]} точка.
		 */
		function spine(t, ang, len, bend) {
			var mt = 1 - t;
			var c1x = Math.cos(ang) * len * 0.45;
			var c1y = Math.sin(ang) * len * 0.45;
			var c2x = Math.cos(ang + bend) * len;
			var c2y = Math.sin(ang + bend) * len;
			return [2 * mt * t * c1x + t * t * c2x, 2 * mt * t * c1y + t * t * c2y];
		}

		/**
		 * Направление касательной осевой линии: по нему строится сужение лопасти.
		 * @param {number} t - параметр 0..1.
		 * @param {number} ang - начальный угол.
		 * @param {number} len - длина.
		 * @param {number} bend - изгиб.
		 * @returns {number} угол в радианах.
		 */
		function spineTan(t, ang, len, bend) {
			var e = 0.02;
			var a = spine(t - e < 0 ? 0 : t - e, ang, len, bend);
			var b = spine(t + e > 1 ? 1 : t + e, ang, len, bend);
			var dx = b[0] - a[0];
			var dy = b[1] - a[1];
			if (dx === 0 && dy === 0) return ang;
			return Math.atan2(dy, dx);
		}

		/**
		 * Лопасть: полоса вдоль осевой линии, сужающаяся к вершине.
		 *
		 * Именно сужение отличает лист от палки: у палки ширина постоянна, и глаз
		 * читает её как жёсткий стержень.
		 * @param {number} t0 - начало участка.
		 * @param {number} t1 - конец участка.
		 * @param {number} ang - начальный угол.
		 * @param {number} len - длина.
		 * @param {number} bend - изгиб.
		 * @param {number} w - полуширина у основания.
		 * @param {number} n - число сегментов.
		 * @returns {string} путь SVG.
		 */
		function blade(t0, t1, ang, len, bend, w, n) {
			var L = [];
			var R = [];
			var hwTip = 0;
			for (var i = 0; i <= n; i++) {
				var k = i / n;
				var t = t0 + (t1 - t0) * k;
				var p = spine(t, ang, len, bend);
				var ta = spineTan(t, ang, len, bend);
				var nx = -Math.sin(ta);
				var ny = Math.cos(ta);
				var hw = w * (0.22 + 0.78 * Math.sin(Math.PI * Math.pow(k, 0.55)) * (1 - k * 0.25));
				if (i === n) hwTip = hw;
				L.push(round(p[0] + nx * hw) + " " + round(p[1] + ny * hw));
				R.push(round(p[0] - nx * hw) + " " + round(p[1] - ny * hw));
			}
			return "M" + L.join("L") + "A" + round(hwTip) + " " + round(hwTip) + " 0 0 1 " + R[n] + "L" + R.slice(0, n).reverse().join("L") + "Z";
		}

		/**
 * Плавные хвосты и плавники.
 *
 * Каждый силуэт — набор путей в `<defs>`, на сцене стоит только `<use>`.
 * Геометрия намеренно без острых углов: треугольные плавники и клинообразные
 * хвосты в поле из полусотни тел читались как шипы, а не как вода. Хвост —
 * гладкий серп, плавник — дуга, лопасть кита — плавный размах крыла.
 *
 * @param {object} C - цвета схемы.
 * @param {string} body - цвет силуэта.
 * @param {string} body2 - цвет светлых участков.
 * @param {string} e - цвет канта.
 * @returns {string} содержимое `<defs>`.
 */
function buildDefs(C) {
	var b = C.body;
	var b2 = C.body2;
	var e = C.edge;
	// Собственный цвет обломка. Раньше он был заведён в схеме, но набор
	// его не использовал: корпус заливался цветом тела, почти тем же,
	// что и дно, и тонул вместе с ним в одну тёмную массу.
	var w = C.wreck;
	// Палитра каждого вида рыбы: FA, FB, FC, FD.
	var F = C.fish;
	// Горловые складки синего кита: девять штрихов от подбородка назад,
	// расходящихся веером по брюху. Строятся циклом, а не выписаны руками.
	var pleats = "";
	for (var pk = 0; pk < 9; pk++) {
		var off = pk * 2.4;
		pleats += "<path d='M" + round(184 - pk * 2.4) + " " + round(1 + off * 0.16) +
			"C" + round(132 - pk * 7) + " " + round(15 + off) + " " + round(60 - pk * 11) + " " +
			round(19 + off * 1.15) + " " + round(-50 - pk * 5) + " " + round(5 + off * 0.55) +
			"' fill='none' stroke='" + C.rim + "' stroke-width='1.1' stroke-opacity='.26'/>";
	}

		/**
		 * Ветвящаяся ветвь коралла.
		 *
		 * Коралл строится рекурсией, а не выписывается путями: ветвь делится
		 * на две, каждая из них — ещё на две, и так четыре уровня. Лёгкий изгиб
		 * не даёт ветви стать прямой палкой, круглая шапка обводки даёт
		 * округлый кончик, а острый стык читался бы шипом.
		 *
		 * @param {number} x - начало.
		 * @param {number} y - начало.
		 * @param {number} a - направление, радианы.
		 * @param {number} len - длина ветви.
		 * @param {number} wid - толщина обводки.
		 * @param {number} lv - уровень.
		 * @param {number} lvMax - последний уровень.
		 * @param {number} spread - размах ветвления.
		 * @param {string} col - цвет обводки.
		 * @returns {string} набор путей.
		 */
		function limb(x, y, a, len, wid, lv, lvMax, spread, col) {
			if (lv > lvMax) return "";
			var x2 = x + Math.cos(a) * len;
			var y2 = y + Math.sin(a) * len;
			var mx = (x + x2) / 2 + Math.cos(a + 1.57) * len * 0.16;
			var my = (y + y2) / 2 + Math.sin(a + 1.57) * len * 0.16;
			var out =
				"<path d='M" + round(x) + " " + round(y) + "Q" + round(mx) + " " + round(my) +
					" " + round(x2) + " " + round(y2) + "' fill='none' stroke='" + col +
					"' stroke-width='" + round(wid) + "' stroke-opacity='" +
					round(Math.max(0.5, 1 - lv * 0.11)) + "' stroke-linecap='round'/>";
			// Своё дрожание, а не rnd(): та функция объявлена локально в другой
			// части и сюда не видна. И не Math.random: набор силуэтов должен
			// собираться одинаково при каждом вызове, иначе от перерисовки темы
			// кораллы меняли бы форму на ровном месте. Хеш от координат ветви —
			// величина детерминированная, но разная в каждой точке.
			var j1 = Math.sin(x * 12.9898 + y * 78.233 + a * 37.719 + lv * 4.117) * 43758.5453;
			var j2 = Math.sin(x * 39.3468 + y * 11.135 + a * 83.155 + lv * 7.913) * 24634.6345;
			j1 -= Math.floor(j1);
			j2 -= Math.floor(j2);
			var nl = len * (0.7 + j1 * 0.1);
			var nw = wid * 0.66;
			out += limb(x2, y2, a - spread - j2 * spread * 0.5, nl, nw, lv + 1, lvMax, spread, col);
			out += limb(x2, y2, a + spread + j1 * spread * 0.5, nl, nw, lv + 1, lvMax, spread, col);
			if (lv < lvMax - 1) out += limb(x2, y2, a + (j2 - 0.5) * 0.34, nl * 1.08, nw * 1.06, lv + 1, lvMax, spread, col);
			return out;
		}

	/**
	 * Ласта с осью поворота в пятке.
	 *
	 * Ось важна: при повороте от центра носок и пятка идут по дуге, и
	 * ласта отрывается от ноги. От пятки машет только носок, а пятка
	 * стоит на месте.
	 *
	 * @param {string} d - контур ласты.
	 * @param {string} cls - класс анимации.
	 * @param {number} dur - период гребка, секунды.
	 * @param {number} del - сдвиг фазы, секунды.
	 * @returns {string} фрагмент SVG.
	 */
	function fin(d, cls, dur, del) {
		return "<g class='" + cls + "' style='animation-duration:" + round(dur) +
			"s;animation-delay:-" + round(del) + "s'>" +
			"<path d='" + d + "' fill='" + C.body + "'/></g>";
	}

	return (
		// ── кораллы и скалы ──
		// Коралл строится рекурсией функцией limb выше: ветвь делится на две,
		// каждая из них — ещё на две, и так четыре уровня. Отличие коралла от
		// лопасти водоросли именно в структуре, а не в декоре. Округлый
		// кончик даёт круглая шапка обводки, а не острый стык.
		//
		// Три рода, как на листах: толстый вилчатый куст, тонкие рога,
		// пышный веер. Различаются числом уровней, толщиной и размахом.
		// ── затонувший корабль ──
		// Собран заново: набор был съеден чисткой, а ссылки на него остались.
		// Два с пустым набором — это пустой рисунок без единой ошибки.
		"<g id='WS' fill='" + w + "' stroke='" + e + "' stroke-width='1' stroke-opacity='.45'>" +
		"<path d='M-200 -4C-192 -24 -150 -36 -96 -38L84 -38C132 -36 168 -26 186 -10C192 -6 192 4 184 6L-190 6C-198 6 -204 2 -200 -4Z'/>" +
		"<path d='M-40 -38L-33 -60L36 -60L45 -38Z'/>" +
		"<path d='M-142 -38L-134 -53L-96 -53L-91 -38Z'/>" +
		"<path d='M-2.5 -60L-1 -200L2 -200L3.5 -60Z'/>" +
		"<path d='M-62.5 -53L-61 -150L-58.5 -150L-57.5 -53Z'/>" +
		"<path d='M-55 -104L55 -104L55 -98L-55 -98Z'/>" +
		"<path d='M-42 -130L42 -130L42 -125L-42 -125Z'/>" +
		"<path d='M-30 -80L30 -80L30 -76L-30 -76Z'/>" +
		"<path d='M-34 -112L34 -112L34 -107L-34 -107Z'/>" +
		"<path d='M-22 -142L22 -142L22 -138L-22 -138Z'/>" +
		"<path d='M-50 -88L50 -88L50 -84L-50 -84Z'/>" +
		"<path d='M-18 -166L18 -166L18 -162L-18 -162Z'/>" +
		"<path d='M-1 -196L-58 -146M-1 -196L58 -146M0 -150L-61 -58M0 -150L62 -56' fill='none' stroke='" + w + "' stroke-width='1.2' stroke-opacity='.75'/>" +
		"<path d='M186 -8C208 -15 232 -20 256 -18C234 -10 212 -2 190 4Z'/>" +
		"<path d='M214 -13L214 -9L254 -17L254 -18Z'/>" +
		"</g>" +
		"<g id='CO1'>" + limb(0, 0, -1.5708, 58, 15, 0, 3, 0.52, C.hold) + "<ellipse rx='16' ry='7' fill='" + C.hold + "' fill-opacity='.9'/></g>" +
		"<g id='CO2'>" + limb(0, 0, -1.5708, 70, 8, 0, 4, 0.42, C.hold) + "<ellipse rx='11' ry='5' fill='" + C.hold + "' fill-opacity='.9'/></g>" +
		"<g id='CO3'>" + limb(0, 0, -1.5708, 48, 10, 0, 3, 0.92, C.hold) + "<ellipse rx='13' ry='6' fill='" + C.hold + "' fill-opacity='.9'/></g>" +
		// окружность была семьдесят процентов высоты тела и сливалась с ним
		// в одно пятно. Между головой и корпусом — выступ затылка, иначе
		// они и дальше читались бы слитно.

		// Скалы: пологие вершины, срезанные бока, углы скруглены.
		"<g id='RK1' fill='" + C.bed + "'>" +
			"<path d='M-190 0C-180 -34 -140 -58 -92 -64C-56 -68 -34 -52 -6 -46C24 -40 44 -52 74 -56C110 -61 148 -48 186 -12C192 -6 192 0 186 0Z'/>" +
			"<path d='M-70 -64C-52 -96 -18 -110 20 -106C46 -103 62 -90 74 -56C44 -52 24 -40 -6 -46C-34 -52 -56 -68 -92 -64Z' fill='" + C.mid + "' fill-opacity='.5'/>" +
		"</g>" +
		"<g id='RK2' fill='" + C.deep + "'>" +
			"<path d='M-240 0C-228 -28 -180 -48 -120 -52C-70 -55 -40 -40 0 -36C48 -31 84 -44 130 -48C172 -51 210 -36 236 -10C240 -5 240 0 236 0Z'/>" +
		"</g>" +

		// ДОГОВОРЁННОСТЬ: во всех силуэтах нос в +x, хвост в −x.
	// смотреть в +x по ходу движения. У мелкой рыбы это даёт
	// `rotate="auto"`, у крупных тел — знак зеркала, выбранный из той же
	// переменной, что и класс анимации хода.
	//
	// ДОГОВОРЁННОСТЬ: во всех силуэтах нос в +x, хвост в −x. Тело обязано
	// смотреть в +x по ходу движения. У мелкой рыбы это даёт
	// `rotate="auto"`, у крупных тел — знак зеркала, выбранный из той же
	// переменной, что и класс анимации хода.
	//
	// ── рыбы ──
	// ТЕНЬ ВНУТРИ НАБОРА, а не фильтром на особи. Фильтр `drop-shadow` на
	// ста семидесяти анимируемых элементах дорого стоит, а тень в наборе
	// рисуется вместе с телом бесплатно: набор общий на вид, и добавление
	// тени увеличивает его на восемь путей, а не на двести элементов в сцене.
	// Тень — тёмная копия силуэта, сдвинутая вниз-вправо: под водой это не
	// отброшенный контур, а затемнение снизу. Сильная и смещённая тень
	// нарисовала бы второй силуэт.
	//
	// Углы скруглены намеренно. На листе референса у плавников острые
	// вершины, но вы просили без острых углов, и в поле из полутора сотни тел
	// такие вершины читались бы как помехи, а не как рыба.
	//
	// Часть видов в полосу: в референсе это вторая половина пёстрости
	// наравне с цветом. Хвост (tw) вращается вокруг места крепления,
	// спинной плавник (fd) — вокруг основания, усы (br) — вокруг выхода
	// изо рта. Фаза у всех особей вида общая: набор один на всех.
		// Вытянутая с акульим хвостом. Самый частый силуэт на листе.
		"<g id='FA'>" +
		"<g transform='translate(1.6,2.6)' fill='" + C.bed + "' fill-opacity='0.4' stroke='none'>" +
			"<path d='M17 0C17 4.6 9 6.6 1 6.6C-7 6.6 -14 3.8 -17 0C-14 -3.8 -7 -6.6 1 -6.6C9 -6.6 17 -4.6 17 0Z'/>" +
			"<path d='M-16 0C-20 -3 -25 -7 -32 -11.5C-27 -5 -27 5 -32 11.5C-25 7 -20 3 -16 0Z'/>" +
			"<path d='M-3 -6.2C-2 -10.4 1 -13.4 5.4 -14.4C4 -10 8.4 -12 9.4 -7.6C6 -6.2 1 -6.2 -3 -6.2Z'/>" +
			"<path d='M2 6C1 9.4 2.4 12.4 6 14C5 10.4 8 11.4 9 8C6 6 4 6 2 6Z'/>" +
		// Глаз: на всех листах референса он есть у каждой рыбы, и на
		// двадцати пикселях это единственное, что делает рыбу живой.
		// Одноцветный и без блика: блик стоил бы ещё один элемент,
		// а на таком размере его не видно.
		"<circle fill='" + F[0].edge + "' fill-opacity='.92' cx='10' cy='-1.5' r='2.4'/>" +
		"<circle fill='" + F[0].deep + "' cx='10' cy='-1.5' r='1'/>" +
		"</g>" +
		"<path d='M17 0C17 4.6 9 6.6 1 6.6C-7 6.6 -14 3.8 -17 0C-14 -3.8 -7 -6.6 1 -6.6C9 -6.6 17 -4.6 17 0Z' fill='" + F[0].deep + "'/>" +
		"<path d='M-15 -0.4C-14 -3.6 -7 -6.2 1 -6.2C7 -6.2 14 -3.6 16 -0.4C7 -2.4 -7 -2.4 -15 -0.4Z' fill='" + F[0].deep + "' fill-opacity='.85'/>" +
		"<path d='M-15 0C-14 3.6 -7 6.2 1 6.2C7 6.2 14 3.6 16 0C7 2.4 -7 2.4 -15 0Z' fill='" + F[0].belly + "' fill-opacity='.52'/>" +
		"<path d='M6.5 -11C7.9 -5 7.9 5 6.5 11' fill='none' stroke='" + F[0].belly + "' stroke-width='1.6' stroke-opacity='.38' stroke-linecap='round'/>" +
		"<path d='M1 -11C2.4 -5 2.4 5 1 11' fill='none' stroke='" + F[0].belly + "' stroke-width='1.4' stroke-opacity='.38' stroke-linecap='round'/>" +
		"<path d='M17 0C17 4.6 9 6.6 1 6.6C-7 6.6 -14 3.8 -17 0C-14 -3.8 -7 -6.6 1 -6.6C9 -6.6 17 -4.6 17 0Z' fill='none' stroke='" + C.body + "' stroke-width='2.2' stroke-opacity='.6'/>" + 
			"<path d='M17 0C17 4.6 9 6.6 1 6.6C-7 6.6 -14 3.8 -17 0C-14 -3.8 -7 -6.6 1 -6.6C9 -6.6 17 -4.6 17 0Z' fill='none' stroke='" + F[0].edge + "' stroke-width='.9' stroke-opacity='.45'/>" +
		"<g class='tw'>" +
			"<path d='M-16 0C-20 -3 -25 -7 -32 -11.5C-27 -5 -27 5 -32 11.5C-25 7 -20 3 -16 0Z' fill='" + F[0].mid + "' stroke='" + F[0].edge + "' stroke-width='1' stroke-opacity='.42'/>" +
		"</g>" +
		"<g class='fd'>" +
			"<path d='M-3 -6.2C-2 -10.4 1 -13.4 5.4 -14.4C4 -10 8.4 -12 9.4 -7.6C6 -6.2 1 -6.2 -3 -6.2Z' fill='" + F[0].mid + "' stroke='" + F[0].edge + "' stroke-width='1' stroke-opacity='.42'/>" +
			"<path d='M2 6C1 9.4 2.4 12.4 6 14C5 10.4 8 11.4 9 8C6 6 4 6 2 6Z' fill='" + F[0].mid + "' stroke='" + F[0].edge + "' stroke-width='1' stroke-opacity='.42'/>" +
		"</g>" +
		"</g>" +
		// Толстая круглая, хвост-веер, в полосу.
		"<g id='FB'>" +
		"<g transform='translate(1.6,2.6)' fill='" + C.bed + "' fill-opacity='0.4' stroke='none'>" +
			"<path d='M16 0C16 8 10 13 3 13C-4 13 -9 8.5 -9 0C-9 -8.5 -4 -13 3 -13C10 -13 16 -8 16 0Z'/>" +
			"<path d='M-8 0C-13 -4 -19 -7.4 -26 -9.4C-22 -4 -22 4 -26 9.4C-19 7.4 -13 4 -8 0Z'/>" +
			"<path d='M-2 -12.2C-1 -17 2 -20 6 -21C4 -16 8.4 -18 9.4 -12.6C6 -11 1 -12.2 -2 -12.2Z'/>" +
			"<path d='M-2 12.4C-1 16.4 1 19 4 19.4C5 16 8 13 9 10.6C6 12 1 12.6 -2 12.4Z'/>" +
		// Глаз: на всех листах референса он есть у каждой рыбы, и на
		// двадцати пикселях это единственное, что делает рыбу живой.
		// Одноцветный и без блика: блик стоил бы ещё один элемент,
		// а на таком размере его не видно.
		"<circle fill='" + F[1].edge + "' fill-opacity='.92' cx='9' cy='-3' r='3'/>" +
		"<circle fill='" + F[1].deep + "' cx='9' cy='-3' r='1.3'/>" +
		"</g>" +
		"<path d='M16 0C16 8 10 13 3 13C-4 13 -9 8.5 -9 0C-9 -8.5 -4 -13 3 -13C10 -13 16 -8 16 0Z' fill='" + F[1].deep + "'/>" +
		"<path d='M-8.5 -1C-6.5 -8.6 3 -12 11 -5.8C5 -8.4 -3 -8.6 -8.5 -1Z' fill='" + F[1].deep + "' fill-opacity='.85'/>" +
		"<path d='M-8.5 1C-6.5 8.6 3 12 11 5.8C5 8.4 -3 8.6 -8.5 1Z' fill='" + F[1].belly + "' fill-opacity='.52'/>" +
		"<path d='M5 -11C6.4 -5 6.4 5 5 11' fill='none' stroke='" + F[1].belly + "' stroke-width='1.9' stroke-opacity='.38' stroke-linecap='round'/>" +
		"<path d='M-1 -11C0.3999999999999999 -5 0.3999999999999999 5 -1 11' fill='none' stroke='" + F[1].belly + "' stroke-width='1.7' stroke-opacity='.38' stroke-linecap='round'/>" +
		"<path d='M16 0C16 8 10 13 3 13C-4 13 -9 8.5 -9 0C-9 -8.5 -4 -13 3 -13C10 -13 16 -8 16 0Z' fill='none' stroke='" + C.body + "' stroke-width='2.2' stroke-opacity='.6'/>" + 
			"<path d='M16 0C16 8 10 13 3 13C-4 13 -9 8.5 -9 0C-9 -8.5 -4 -13 3 -13C10 -13 16 -8 16 0Z' fill='none' stroke='" + F[1].edge + "' stroke-width='.9' stroke-opacity='.45'/>" +
		"<g class='tw'>" +
			"<path d='M-8 0C-13 -4 -19 -7.4 -26 -9.4C-22 -4 -22 4 -26 9.4C-19 7.4 -13 4 -8 0Z' fill='" + F[1].mid + "' stroke='" + F[1].edge + "' stroke-width='1' stroke-opacity='.42'/>" +
		"</g>" +
		"<g class='fd'>" +
			"<path d='M-2 -12.2C-1 -17 2 -20 6 -21C4 -16 8.4 -18 9.4 -12.6C6 -11 1 -12.2 -2 -12.2Z' fill='" + F[1].mid + "' stroke='" + F[1].edge + "' stroke-width='1' stroke-opacity='.42'/>" +
			"<path d='M-2 12.4C-1 16.4 1 19 4 19.4C5 16 8 13 9 10.6C6 12 1 12.6 -2 12.4Z' fill='" + F[1].mid + "' stroke='" + F[1].edge + "' stroke-width='1' stroke-opacity='.42'/>" +
		"</g>" +
		"</g>" +
		// Высокая, плавники уходят назад нитями.
		"<g id='FC'>" +
		"<g transform='translate(1.6,2.6)' fill='" + C.bed + "' fill-opacity='0.4' stroke='none'>" +
			"<path d='M15 0C15 7 8 10 0 10C-8 10 -14 6 -15 0C-14 -6 -8 -10 0 -10C8 -10 15 -7 15 0Z'/>" +
			"<path d='M-14 0C-18 -3 -23 -6.4 -29 -8.4C-24 -3 -24 3 -29 8.4C-23 6.4 -18 3 -14 0Z'/>" +
			"<path d='M-2 -9.4C-5 -18 -12 -26 -21 -30C-12 -24.5 -7.5 -20 -4.4 -14.2C-2 -18.6 0.6 -22.6 4.4 -25.6C1 -20.4 1.4 -15 2.4 -9.4Z'/>" +
			"<path d='M-2 9.4C-4 17 -8 23 -14 27C-8 23.4 -4.6 20 -2.6 15.6C-1 19 0.4 22 2.4 24.4C1 20 1.4 15 2.4 9.4Z'/>" +
		// Глаз: на всех листах референса он есть у каждой рыбы, и на
		// двадцати пикселях это единственное, что делает рыбу живой.
		// Одноцветный и без блика: блик стоил бы ещё один элемент,
		// а на таком размере его не видно.
		"<circle fill='" + F[2].edge + "' fill-opacity='.92' cx='8' cy='-2' r='2.8'/>" +
		"<circle fill='" + F[2].deep + "' cx='8' cy='-2' r='1.2'/>" +
		"</g>" +
		"<path d='M15 0C15 7 8 10 0 10C-8 10 -14 6 -15 0C-14 -6 -8 -10 0 -10C8 -10 15 -7 15 0Z' fill='" + F[2].deep + "'/>" +
		"<path d='M-13.5 -1C-11 -6.6 -5 -9.6 0 -9.6C5 -9.6 11 -6.6 14 -1C7 -4 -7 -4 -13.5 -1Z' fill='" + F[2].deep + "' fill-opacity='.85'/>" +
		"<path d='M-13.5 1C-11 6.6 -5 9.6 0 9.6C5 9.6 11 6.6 14 1C7 4 -7 4 -13.5 1Z' fill='" + F[2].belly + "' fill-opacity='.52'/>" +
		"<path d='M15 0C15 7 8 10 0 10C-8 10 -14 6 -15 0C-14 -6 -8 -10 0 -10C8 -10 15 -7 15 0Z' fill='none' stroke='" + C.body + "' stroke-width='2.2' stroke-opacity='.6'/>" + 
			"<path d='M15 0C15 7 8 10 0 10C-8 10 -14 6 -15 0C-14 -6 -8 -10 0 -10C8 -10 15 -7 15 0Z' fill='none' stroke='" + F[2].edge + "' stroke-width='.9' stroke-opacity='.45'/>" +
		"<g class='tw'>" +
			"<path d='M-14 0C-18 -3 -23 -6.4 -29 -8.4C-24 -3 -24 3 -29 8.4C-23 6.4 -18 3 -14 0Z' fill='" + F[2].mid + "' stroke='" + F[2].edge + "' stroke-width='1' stroke-opacity='.42'/>" +
		"</g>" +
		"<g class='fd'>" +
			"<path d='M-2 -9.4C-5 -18 -12 -26 -21 -30C-12 -24.5 -7.5 -20 -4.4 -14.2C-2 -18.6 0.6 -22.6 4.4 -25.6C1 -20.4 1.4 -15 2.4 -9.4Z' fill='" + F[2].mid + "' stroke='" + F[2].edge + "' stroke-width='1' stroke-opacity='.42'/>" +
			"<path d='M-2 9.4C-4 17 -8 23 -14 27C-8 23.4 -4.6 20 -2.6 15.6C-1 19 0.4 22 2.4 24.4C1 20 1.4 15 2.4 9.4Z' fill='" + F[2].mid + "' stroke='" + F[2].edge + "' stroke-width='1' stroke-opacity='.42'/>" +
		"</g>" +
		"</g>" +
		// Саблезуб: длинный рострум и высокий серповидный хвост.
		"<g id='FD'>" +
		"<g transform='translate(1.6,2.6)' fill='" + C.bed + "' fill-opacity='0.4' stroke='none'>" +
		"<path d='M11 -1.4C19 -2.2 29 -2.6 39 -2.2C29 -1.4 19 -0.6 11 0.4Z'/>" +
			"<path d='M12 0C12 5 6 7.5 0 7.5C-7 7.5 -13 4.5 -14 0C-13 -4.5 -7 -7.5 0 -7.5C6 -7.5 12 -5 12 0Z'/>" +
			"<path d='M-13 0C-18 -4 -24 -8.4 -32 -12.4C-26 -5 -26 5 -32 12.4C-24 8.4 -18 4 -13 0Z'/>" +
			"<path d='M-4 -7C-3 -12.4 0 -16.4 4.4 -18.4C2 -13.4 6 -14.4 7 -10C4 -7.2 0 -7 -4 -7Z'/>" +
			"<path d='M2 7C1 10.4 2.4 13.4 6 15C5 11.4 8 12.4 9 9C6 7 4 7 2 7Z'/>" +
		// Глаз: на всех листах референса он есть у каждой рыбы, и на
		// двадцати пикселях это единственное, что делает рыбу живой.
		// Одноцветный и без блика: блик стоил бы ещё один элемент,
		// а на таком размере его не видно.
		"<circle fill='" + F[3].edge + "' fill-opacity='.92' cx='7' cy='-1.5' r='2.3'/>" +
		"<circle fill='" + F[3].deep + "' cx='7' cy='-1.5' r='1'/>" +
		"</g>" +
		"<path d='M12 0C12 5 6 7.5 0 7.5C-7 7.5 -13 4.5 -14 0C-13 -4.5 -7 -7.5 0 -7.5C6 -7.5 12 -5 12 0Z' fill='" + F[3].deep + "'/>" +
		"<path d='M11 -1.4C19 -2.2 29 -2.6 39 -2.2C29 -1.4 19 -0.6 11 0.4Z' fill='" + F[3].deep + "'/>" +
		"<path d='M-13 -0.4C-12 -4 -6.5 -7 0 -7C6 -7 11.5 -4 13 -0.4C6 -2.6 -6 -2.6 -13 -0.4Z' fill='" + F[3].deep + "' fill-opacity='.85'/>" +
		"<path d='M-13 0C-12 4 -6.5 7 0 7C6 7 11.5 4 13 0C6 2.6 -6 2.6 -13 0Z' fill='" + F[3].belly + "' fill-opacity='.52'/>" +
		"<path d='M12 0C12 5 6 7.5 0 7.5C-7 7.5 -13 4.5 -14 0C-13 -4.5 -7 -7.5 0 -7.5C6 -7.5 12 -5 12 0Z' fill='none' stroke='" + C.body + "' stroke-width='2.2' stroke-opacity='.6'/>" + 
			"<path d='M12 0C12 5 6 7.5 0 7.5C-7 7.5 -13 4.5 -14 0C-13 -4.5 -7 -7.5 0 -7.5C6 -7.5 12 -5 12 0Z' fill='none' stroke='" + F[3].edge + "' stroke-width='.9' stroke-opacity='.45'/>" +
		"<g class='tw'>" +
			"<path d='M-13 0C-18 -4 -24 -8.4 -32 -12.4C-26 -5 -26 5 -32 12.4C-24 8.4 -18 4 -13 0Z' fill='" + F[3].mid + "' stroke='" + F[3].edge + "' stroke-width='1' stroke-opacity='.42'/>" +
		"</g>" +
		"<g class='fd'>" +
			"<path d='M-4 -7C-3 -12.4 0 -16.4 4.4 -18.4C2 -13.4 6 -14.4 7 -10C4 -7.2 0 -7 -4 -7Z' fill='" + F[3].mid + "' stroke='" + F[3].edge + "' stroke-width='1' stroke-opacity='.42'/>" +
			"<path d='M2 7C1 10.4 2.4 13.4 6 15C5 11.4 8 12.4 9 9C6 7 4 7 2 7Z' fill='" + F[3].mid + "' stroke='" + F[3].edge + "' stroke-width='1' stroke-opacity='.42'/>" +
		"</g>" +
		"<g class='br'>" +
			"<path d='M11 1.4C18 6 26 14 31 24C28 14 22 5 14 -0.4C13 0 12 0.8 11 1.4ZM12 2.4C17 8 22 15 24 22C23 14 19 6.6 13 1.4Z' fill='" + F[3].deep + "' stroke='none'/>" +
		"</g>" +
		"</g>" +
		// Угорь: лента, маленькая голова, хвост в точку.
		"<g id='FE'>" +
		"<g transform='translate(1.6,2.6)' fill='" + C.bed + "' fill-opacity='0.4' stroke='none'>" +
			"<path d='M15 0C15 3.4 7 4.8 1 4.8C-11 4.8 -30 4 -45 2.6C-53 1.8 -58 1 -61 0C-58 -1 -53 -1.8 -45 -2.6C-30 -4 -11 -4.8 1 -4.8C7 -4.8 15 -3.4 15 0Z'/>" +
			"<path d='M-59 0C-64 -1.6 -70 -2.6 -76 -3C-71 -1.4 -71 1.4 -76 3C-70 2.6 -64 1.6 -59 0Z'/>" +
			"<path d='M-6 -4.4C-5 -8 -2 -10.4 1 -11C0 -7.4 3 -8.4 4 -5C2 -4.4 -2 -4.4 -6 -4.4Z'/>" +
		// Глаз: на всех листах референса он есть у каждой рыбы, и на
		// двадцати пикселях это единственное, что делает рыбу живой.
		// Одноцветный и без блика: блик стоил бы ещё один элемент,
		// а на таком размере его не видно.
		"<circle fill='" + F[4].edge + "' fill-opacity='.92' cx='10' cy='-1' r='1.8'/>" +
		"<circle fill='" + F[4].deep + "' cx='10' cy='-1' r='0.8'/>" +
		"</g>" +
		"<path d='M15 0C15 3.4 7 4.8 1 4.8C-11 4.8 -30 4 -45 2.6C-53 1.8 -58 1 -61 0C-58 -1 -53 -1.8 -45 -2.6C-30 -4 -11 -4.8 1 -4.8C7 -4.8 15 -3.4 15 0Z' fill='" + F[4].deep + "'/>" +
		"<path d='M-59 -0.4C-50 -2.4 -28 -4.4 1 -4.4C7 -4.4 14 -3 -14 -3C-30 -3 -50 -1.4 -59 -0.4Z' fill='" + F[4].deep + "' fill-opacity='.85'/>" +
		"<path d='M-59 0.4C-50 2.4 -28 4.4 1 4.4C7 4.4 14 3 14 3C-30 3 -50 1.4 -59 0.4Z' fill='" + F[4].belly + "' fill-opacity='.52'/>" +
		"<path d='M15 0C15 3.4 7 4.8 1 4.8C-11 4.8 -30 4 -45 2.6C-53 1.8 -58 1 -61 0C-58 -1 -53 -1.8 -45 -2.6C-30 -4 -11 -4.8 1 -4.8C7 -4.8 15 -3.4 15 0Z' fill='none' stroke='" + C.body + "' stroke-width='2.2' stroke-opacity='.6'/>" + 
			"<path d='M15 0C15 3.4 7 4.8 1 4.8C-11 4.8 -30 4 -45 2.6C-53 1.8 -58 1 -61 0C-58 -1 -53 -1.8 -45 -2.6C-30 -4 -11 -4.8 1 -4.8C7 -4.8 15 -3.4 15 0Z' fill='none' stroke='" + F[4].edge + "' stroke-width='.9' stroke-opacity='.45'/>" +
		"<g class='tw'>" +
			"<path d='M-59 0C-64 -1.6 -70 -2.6 -76 -3C-71 -1.4 -71 1.4 -76 3C-70 2.6 -64 1.6 -59 0Z' fill='" + F[4].mid + "' stroke='" + F[4].edge + "' stroke-width='1' stroke-opacity='.42'/>" +
		"</g>" +
		"<g class='fd'>" +
			"<path d='M-6 -4.4C-5 -8 -2 -10.4 1 -11C0 -7.4 3 -8.4 4 -5C2 -4.4 -2 -4.4 -6 -4.4Z' fill='" + F[4].mid + "' stroke='" + F[4].edge + "' stroke-width='1' stroke-opacity='.42'/>" +
		"</g>" +
		"</g>" +
		// С усами-бородкой: нити свисают изо рта.
		"<g id='FF'>" +
		"<g transform='translate(1.6,2.6)' fill='" + C.bed + "' fill-opacity='0.4' stroke='none'>" +
			"<path d='M16 0C16 4.6 9 6.6 1 6.6C-7 6.6 -14 3.8 -16 0C-14 -3.8 -7 -6.6 1 -6.6C9 -6.6 16 -4.6 16 0Z'/>" +
			"<path d='M-15 0C-19 -3 -24 -6.4 -31 -9.4C-26 -4 -26 4 -31 9.4C-24 6.4 -19 3 -15 0Z'/>" +
			"<path d='M-3 -6.2C-2 -10.4 1 -13 5 -14C4 -9.6 8 -11.6 9 -7.4C6 -6 1 -6.2 -3 -6.2Z'/>" +
			"<path d='M2 6C1 9.4 2.4 12 6 13.4C5 10 8 11 9 8C6 6 4 6 2 6Z'/>" +
		// Глаз: на всех листах референса он есть у каждой рыбы, и на
		// двадцати пикселях это единственное, что делает рыбу живой.
		// Одноцветный и без блика: блик стоил бы ещё один элемент,
		// а на таком размере его не видно.
		"<circle fill='" + F[5].edge + "' fill-opacity='.92' cx='9' cy='-1.5' r='2.4'/>" +
		"<circle fill='" + F[5].deep + "' cx='9' cy='-1.5' r='1'/>" +
		"</g>" +
		"<path d='M16 0C16 4.6 9 6.6 1 6.6C-7 6.6 -14 3.8 -16 0C-14 -3.8 -7 -6.6 1 -6.6C9 -6.6 16 -4.6 16 0Z' fill='" + F[5].deep + "'/>" +
		"<path d='M-15 -0.4C-14 -3.8 -7 -6.4 1 -6.4C7 -6.4 14 -3.8 16 -0.4C7 -2.4 -7 -2.4 -15 -0.4Z' fill='" + F[5].deep + "' fill-opacity='.85'/>" +
		"<path d='M-15 0C-14 3.8 -7 6.4 1 6.4C7 6.4 14 3.8 16 0C7 2.4 -7 2.4 -15 0Z' fill='" + F[5].belly + "' fill-opacity='.52'/>" +
		"<path d='M5 -11C6.4 -5 6.4 5 5 11' fill='none' stroke='" + F[5].belly + "' stroke-width='1.6' stroke-opacity='.38' stroke-linecap='round'/>" +
		"<path d='M16 0C16 4.6 9 6.6 1 6.6C-7 6.6 -14 3.8 -16 0C-14 -3.8 -7 -6.6 1 -6.6C9 -6.6 16 -4.6 16 0Z' fill='none' stroke='" + C.body + "' stroke-width='2.2' stroke-opacity='.6'/>" + 
			"<path d='M16 0C16 4.6 9 6.6 1 6.6C-7 6.6 -14 3.8 -16 0C-14 -3.8 -7 -6.6 1 -6.6C9 -6.6 16 -4.6 16 0Z' fill='none' stroke='" + F[5].edge + "' stroke-width='.9' stroke-opacity='.45'/>" +
		"<g class='tw'>" +
			"<path d='M-15 0C-19 -3 -24 -6.4 -31 -9.4C-26 -4 -26 4 -31 9.4C-24 6.4 -19 3 -15 0Z' fill='" + F[5].mid + "' stroke='" + F[5].edge + "' stroke-width='1' stroke-opacity='.42'/>" +
		"</g>" +
		"<g class='fd'>" +
			"<path d='M-3 -6.2C-2 -10.4 1 -13 5 -14C4 -9.6 8 -11.6 9 -7.4C6 -6 1 -6.2 -3 -6.2Z' fill='" + F[5].mid + "' stroke='" + F[5].edge + "' stroke-width='1' stroke-opacity='.42'/>" +
			"<path d='M2 6C1 9.4 2.4 12 6 13.4C5 10 8 11 9 8C6 6 4 6 2 6Z' fill='" + F[5].mid + "' stroke='" + F[5].edge + "' stroke-width='1' stroke-opacity='.42'/>" +
		"</g>" +
		"<g class='br'>" +
			"<path d='M15 0.8C19 2.8 22.6 6 25 10C23 6 20 2.4 16 -0.4C15.6 -0.1 15.3 0.3 15 0.8Z M15 1.9C17.8 3.9 20.4 6.4 22.2 9.4C21.4 6 19.2 3.6 15.7 1.5Z' fill='" + F[5].deep + "' stroke='none'/>" +
		"</g>" +
		"</g>" +
		// Рыба-ангел с хвостом-крюком: тело круглое, хвост загибается вбок.
		"<g id='FG'>" +
		"<g transform='translate(1.6,2.6)' fill='" + C.bed + "' fill-opacity='0.4' stroke='none'>" +
			"<path d='M18 0C18 11 10 18 0 18C-10 18 -17 11 -17 0C-17 -11 -10 -18 0 -18C10 -18 18 -11 18 0Z'/>" +
			"<path d='M-16 0C-25 -8 -35 -6 -40 2C-45 10 -40 20 -31 20C-25 20 -22 15 -25 11C-28 7 -33 9 -33 13C-33 16 -29 17 -27 14C-27 18 -32 20 -35 15C-38 9 -32 4 -26 6C-21 8 -19 4 -16 0Z'/>" +
			"<path d='M-4 -16.5C-3 -22 0 -25 4 -25C3 -21 6.4 -22 6.4 -18C4 -16.4 0 -16.5 -4 -16.5Z'/>" +
			"<path d='M-2 17.4C-3 22 -0.6 25 3 24C5 21 7 17 8 13C5 15 0 16.6 -2 17.4Z'/>" +
		// Глаз: на всех листах референса он есть у каждой рыбы, и на
		// двадцати пикселях это единственное, что делает рыбу живой.
		// Одноцветный и без блика: блик стоил бы ещё один элемент,
		// а на таком размере его не видно.
		"<circle fill='" + F[6].edge + "' fill-opacity='.92' cx='10' cy='-5' r='3.2'/>" +
		"<circle fill='" + F[6].deep + "' cx='10' cy='-5' r='1.3'/>" +
		"</g>" +
		"<path d='M18 0C18 11 10 18 0 18C-10 18 -17 11 -17 0C-17 -11 -10 -18 0 -18C10 -18 18 -11 18 0Z' fill='" + F[6].deep + "'/>" +
		"<path d='M-15 -1C-13 -10 1 -16 14 -9C7 -12 -5 -12 -15 -1Z' fill='" + F[6].deep + "' fill-opacity='.85'/>" +
		"<path d='M-15 1C-13 10 1 16 14 9C7 12 -5 12 -15 1Z' fill='" + F[6].belly + "' fill-opacity='.52'/>" +
		"<path d='M18 0C18 11 10 18 0 18C-10 18 -17 11 -17 0C-17 -11 -10 -18 0 -18C10 -18 18 -11 18 0Z' fill='none' stroke='" + C.body + "' stroke-width='2.2' stroke-opacity='.6'/>" + 
			"<path d='M18 0C18 11 10 18 0 18C-10 18 -17 11 -17 0C-17 -11 -10 -18 0 -18C10 -18 18 -11 18 0Z' fill='none' stroke='" + F[6].edge + "' stroke-width='.9' stroke-opacity='.45'/>" +
		"<g class='tw'>" +
			"<path d='M-16 0C-25 -8 -35 -6 -40 2C-45 10 -40 20 -31 20C-25 20 -22 15 -25 11C-28 7 -33 9 -33 13C-33 16 -29 17 -27 14C-27 18 -32 20 -35 15C-38 9 -32 4 -26 6C-21 8 -19 4 -16 0Z' fill='" + F[6].mid + "' stroke='" + F[6].edge + "' stroke-width='1' stroke-opacity='.42'/>" +
		"</g>" +
		"<g class='fd'>" +
			"<path d='M-4 -16.5C-3 -22 0 -25 4 -25C3 -21 6.4 -22 6.4 -18C4 -16.4 0 -16.5 -4 -16.5Z' fill='" + F[6].mid + "' stroke='" + F[6].edge + "' stroke-width='1' stroke-opacity='.42'/>" +
			"<path d='M-2 17.4C-3 22 -0.6 25 3 24C5 21 7 17 8 13C5 15 0 16.6 -2 17.4Z' fill='" + F[6].mid + "' stroke='" + F[6].edge + "' stroke-width='1' stroke-opacity='.42'/>" +
		"</g>" +
		"</g>" +
		
		// ── акулы ──
		// Классический силуэт: длинное тело, острая морда, большие треугольные
		// грудные плавники, высокий спинной, серповидный хвост с вытянутой
		// верхней лопастью. Прежняя была плоским горбатым силуэтом.
		"<g id='SA' fill='" + b + "' stroke='" + e + "' stroke-width='1' stroke-opacity='.42'>" +
		"<path d='M120 0C100 -16 50 -26 0 -20C-30 -16 -56 -8 -70 0C-56 8 -30 16 0 20C50 26 100 16 120 0Z'/>" +
		"<path d='M-10 -20C-6 -46 6 -66 20 -74C28 -56 34 -36 34 -18Z'/>" +
		"<path d='M32 12C36 24 44 32 54 36C48 24 40 16 32 8Z'/>" +
		"<path d='M-24 13C-24 22 -20 28 -13 31C-9 23 -7 18 -9 12Z'/>" +
		"<path d='M-68 0C-84 -6 -100 -22 -108 -42C-101 -23 -93 -7 -85 0C-93 7 -101 23 -108 42C-100 22 -84 6 -68 0Z'/>" +
		"<path d='M44 -14L44 -4M36 -17L36 -7M28 -19L28 -9' fill='none' stroke='" + b2 + "' stroke-width='1.3' stroke-opacity='.5'/>" +
		"</g>" +
		"<g id='SB' fill='" + b + "' stroke='" + e + "' stroke-width='1' stroke-opacity='.42'>" +
		"<path d='M-26 0C-14 -13 4 -15 20 -8C28 -5 32 -2 33 0C32 2 28 5 20 8C4 15 -14 13 -26 0Z'/>" +
		"<path d='M24 -5C30 -16 36 -21 42 -22C48 -22 54 -16 58 -5Z'/>" +
		"<path d='M-25 0C-32 -7 -40 -13 -47 -16C-51 -8 -51 8 -47 16C-40 13 -32 7 -25 0Z'/>" +
		"<path d='M-4 -13C1 -20 6 -24 11 -25C16 -22 20 -18 23 -12Z'/>" +
		"</g>" +
		// ── киты ──
		// Три листа с одиночными силуэтами: косатка, горбатый, синий. Прежние
		// три кита были одним общим силуэтом, отличавшимся только размером, и
		// в воде читались как три одинаковых ковра.
		//
		// У всех трёх та же тень, что у мелкой рыбы: тёмная копия, сдвинутая
		// вниз-вправо. Киты крупные, и тень на них читается как объём.
		//
		// НАС В +x, КАК И У ВСЕГО ОСТАЛЬНОГО.
		// Тело обтекаемое, пропорция семь к одному, самое толстое в
		// передней трети. Спинной плавник крошечный и у самой кормы.
		"<g id='WA' fill='" + b + "' stroke='" + e + "' stroke-width='1' stroke-opacity='.42'>" +
		"<g transform='translate(3,5)' fill='" + C.bed + "' fill-opacity='.4' stroke='none'>" +
			"<path d='M196 0C168 -18 108 -26 34 -24C-6 -23 -48 -17 -74 -8C-82 -3 -82 3 -74 8C-48 17 -6 23 34 24C108 26 168 18 196 0Z'/>" +
			"<path d='M-56 -22C-55 -31 -51 -37 -45 -39C-43 -33 -42 -28 -42 -22Z'/>" +
			"<path d='M74 24C79 42 88 55 100 61C95 42 87 30 80 18Z'/>" +
			"<path d='M-74 0C-88 -7 -100 -24 -106 -43C-100 -24 -91 -8 -84 0C-91 8 -100 24 -106 43C-100 24 -88 7 -74 0Z'/>" +
		"</g>" +
		"<path d='M196 0C168 -18 108 -26 34 -24C-6 -23 -48 -17 -74 -8C-82 -3 -82 3 -74 8C-48 17 -6 23 34 24C108 26 168 18 196 0Z'/>" +
		"<path d='M-56 -22C-55 -31 -51 -37 -45 -39C-43 -33 -42 -28 -42 -22Z'/>" +
		"<path d='M74 24C79 42 88 55 100 61C95 42 87 30 80 18Z'/>" +
		"<path d='M-74 0C-88 -7 -100 -24 -106 -43C-100 -24 -91 -8 -84 0C-91 8 -100 24 -106 43C-100 24 -88 7 -74 0Z'/>" +
		// ГОРЛОВЫЕ СКЛАДКИ — главный признак вида. Идут от подбородка назад
		// по всему брюху и расходятся веером. Три штриха на листе не читались,
		// здесь их девять, и они строятся циклом, а не выписаны руками.
		pleats +
		"<circle fill='" + C.rim + "' fill-opacity='.6' cx='152' cy='-6' r='7'/>" +
		"<circle fill='" + C.rim + "' fill-opacity='.85' cx='152' cy='-6' r='2.6'/>" +
		"</g>" +
		"<g id='WB' fill='" + b + "' stroke='" + e + "' stroke-width='1' stroke-opacity='.42'>" +
		"<g transform='translate(3,5)' fill='" + C.bed + "' fill-opacity='.4' stroke='none'>" +
			"<path d='M130 0C104 -30 44 -46 -30 -40C-60 -37 -86 -20 -100 0C-86 20 -60 37 -30 40C44 46 104 30 130 0Z'/>" +
			"<path d='M56 30C70 70 96 104 130 120C118 82 92 50 68 26Z'/>" +
			"<path d='M-98 0C-112 -12 -126 -34 -136 -58C-126 -34 -114 -12 -106 0C-114 12 -126 34 -136 58C-126 34 -112 12 -98 0Z'/>" +
		"</g>" +
		"<path d='M130 0C104 -30 44 -46 -30 -40C-60 -37 -86 -20 -100 0C-86 20 -60 37 -30 40C44 46 104 30 130 0Z'/>" +
		"<path d='M56 30C70 70 96 104 130 120C118 82 92 50 68 26Z'/>" +
		"<path d='M-44 -38C-40 -50 -34 -58 -26 -60C-24 -52 -22 -44 -22 -36Z'/>" +
		"<path d='M-98 0C-112 -12 -126 -34 -136 -58C-126 -34 -114 -12 -106 0C-114 12 -126 34 -136 58C-126 34 -112 12 -98 0Z'/>" +
		"<g fill='" + b + "'>" +
			"<circle cx='104' cy='-14' r='5'/><circle cx='88' cy='-21' r='5.5'/>" +
			"<circle cx='70' cy='-27' r='5.5'/><circle cx='52' cy='-32' r='5'/>" +
			"<circle cx='34' cy='-35' r='4.5'/>" +
		"</g>" +
		"<path d='M116 8C92 26 46 36 -12 36M100 11C78 27 38 35 -18 34' fill='none' stroke='" + C.rim + "' stroke-width='1.2' stroke-opacity='.3' stroke-linecap='round'/>" +
		"<circle fill='" + C.rim + "' fill-opacity='.75' cx='112' cy='-4' r='3'/>" +
		"</g>" +
		"<g id='WC' fill='" + b + "' stroke='" + e + "' stroke-width='1' stroke-opacity='.42'>" +
		"<g transform='translate(3,5)' fill='" + C.bed + "' fill-opacity='.4' stroke='none'>" +
			"<path d='M120 0C96 -26 40 -40 -30 -34C-56 -31 -78 -16 -92 0C-78 16 -56 31 -30 34C40 40 96 26 120 0Z'/>" +
			"<path d='M-6 -36C-6 -66 0 -90 12 -98C20 -76 24 -52 22 -34Z'/>" +
			"<path d='M46 28C52 50 66 66 84 74C76 50 62 34 52 22Z'/>" +
			"<path d='M-90 0C-104 -10 -118 -30 -128 -52C-118 -30 -106 -10 -98 0C-106 10 -118 30 -128 52C-118 30 -104 10 -90 0Z'/>" +
		"</g>" +
		"<path d='M120 0C96 -26 40 -40 -30 -34C-56 -31 -78 -16 -92 0C-78 16 -56 31 -30 34C40 40 96 26 120 0Z'/>" +
		"<path d='M-6 -36C-6 -66 0 -90 12 -98C20 -76 24 -52 22 -34Z'/>" +
		"<path d='M46 28C52 50 66 66 84 74C76 50 62 34 52 22Z'/>" +
		"<path d='M-90 0C-104 -10 -118 -30 -128 -52C-118 -30 -106 -10 -98 0C-106 10 -118 30 -128 52C-118 30 -104 10 -90 0Z'/>" +
		"<path d='M112 8C88 28 36 38 -24 32C-48 29 -68 18 -80 4C-62 24 -28 34 10 32C50 30 90 20 112 8Z' fill='" + b2 + "' fill-opacity='.5'/>" +
		"<ellipse fill='" + C.rim + "' fill-opacity='.8' cx='86' cy='-9' rx='9' ry='5.5'/>" +
		"<path d='M104 2C92 8 76 10 62 9' fill='none' stroke='" + C.rim + "' stroke-width='1.4' stroke-opacity='.45' stroke-linecap='round'/>" +
		"<circle fill='" + C.rim + "' fill-opacity='.85' cx='100' cy='-4' r='2.8'/>" +
		"</g>" +
		// ── дельфин и манта ──
		"<g id='DA' fill='" + b + "' stroke='" + e + "' stroke-width='1' stroke-opacity='.42'>" +
		"<path d='M28 0C24 -6 12 -9 0 -8C-10 -7 -18 -5 -23 -2C-27 -6 -31 -9 -34 -11C-33 -5 -32 5 -34 11C-31 9 -27 6 -23 2C-18 5 -10 7 0 8C12 9 24 6 28 0Z'/>" +
		"<path d='M24 -1.5C30 -2.2 36 -2.2 40 -2L40 2C36 2.2 30 2.2 24 1.5Z'/>" +
		"<path d='M-4 -7.5C-2 -13 0 -17 2.5 -19C5 -16.5 7.5 -12 9 -6.5Z'/>" +
		"<path d='M6 7C7.5 10 9.5 12 11.5 13C12.5 11 13 9 12.5 6.5Z'/></g>" +
		"<g id='RA' fill='" + b + "' stroke='" + e + "' stroke-width='1' stroke-opacity='.42'>" +
		"<path d='M64 0C50 -32 18 -50 -20 -46C-48 -43 -72 -20 -84 0C-72 20 -48 43 -20 46C18 50 50 32 64 0Z'/>" +
		"<path d='M52 0C40 -18 12 -30 -16 -26C-36 -23 -54 -12 -62 0C-54 12 -36 23 -16 26C12 30 40 18 52 0Z' fill='" + b2 + "' fill-opacity='.55'/>" +
		"<path d='M22 -13C27 -17 33 -17 37 -13M22 13C27 17 33 17 37 13' fill='none' stroke='" + b2 + "' stroke-width='2.4' stroke-opacity='.55' stroke-linecap='round'/>" +
		"<path d='M-80 0C-104 5 -128 4 -152 -3C-176 -10 -196 -6 -210 6' fill='none' stroke='" + b + "' stroke-width='4' stroke-linecap='round'/>" +
		"<path d='M-80 0C-104 5 -128 4 -152 -3C-176 -10 -196 -6 -210 6' fill='none' stroke='" + b + "' stroke-width='1.4' stroke-opacity='.5' stroke-linecap='round' transform='translate(0,-2)'/>" +
		"<path d='M-210 6C-216 2 -216 -6 -212 -12C-208 -5 -206 1 -206 6Z'/>" +
		"</g>" +
		// ── удильщик и морской конёк ──
		// Удильщик живёт у дна: круглое тело, огромная пасть с зубами и бибка
		// на тонком усиле. Свечение бибки — единственное тёплое пятно в
		// нижней части кадра, и благодаря ему дно читается как живое.
		"<g id='AN' fill='" + b + "' stroke='" + e + "' stroke-width='1' stroke-opacity='.42'>" +
		"<path d='M24 4C24 -12 8 -24 -10 -24C-28 -24 -40 -14 -42 -2C-44 8 -38 18 -26 22C-8 28 14 22 22 12Z'/>" +
		"<path d='M-40 -2C-30 5 -8 9 10 6C-4 14 -26 11 -38 4Z'/>" +
		"<path d='M-36 3L-33 8L-30 3L-27 9L-24 4L-21 9L-18 4L-15 8L-12 4L-9 7L-6 3L-3 6' fill='none' stroke='" + b + "' stroke-width='1.6' stroke-linecap='round'/>" +
		"<path d='M-40 -4C-50 -8 -58 -16 -62 -24C-60 -14 -58 -4 -62 6C-58 -2 -50 2 -40 4Z'/>" +
		"<path d='M-6 16C-10 27 -18 33 -28 35C-22 25 -16 19 -12 12Z'/>" +
		"<g class='lu'>" +
			"<path d='M-10 -22C-17 -38 -9 -52 3 -57' fill='none' stroke='" + b + "' stroke-width='1.8' stroke-linecap='round'/>" +
			"<circle fill='" + C.glow + "' fill-opacity='.85' cx='6' cy='-59' r='4.2'/>" +
			"<circle fill='" + C.bell + "' cx='6' cy='-59' r='1.8'/>" +
		"</g>" +
		"</g>" +
		// Конёк стоит вертикально: хвост завит в спираль, морда трубкой.
		"<g id='SE' fill='" + b + "' stroke='" + e + "' stroke-width='1' stroke-opacity='.42'>" +
		"<path d='M40 -20C36 -24 30 -25 25 -24C18 -30 8 -30 3 -24C-2 -18 -1 -10 -2 -4C-3 4 -6 12 -10 20C-14 28 -12 38 -4 42C4 46 12 40 12 32C12 25 6 22 2 25C-2 28 -1 34 3 35C5 35 6 33 5 32C7 33 8 36 6 39C3 42 -3 42 -6 38C-9 34 -7 28 -10 22C-14 14 -12 6 -11 -2C-10 -10 -8 -18 -2 -22C4 -26 14 -26 21 -20C24 -17 25 -12 22 -8C18 -4 12 -6 12 -12C12 -16 16 -18 20 -17Z'/>" +
		"<path d='M-8 -2C-16 -7 -23 -3 -25 6C-20 6 -13 4 -7 2Z'/>" +
		"<path d='M-6 -12C-2 -16 4 -16 8 -13M-7 -4C-2 -8 5 -8 10 -5M-8 4C-3 0 4 0 9 3' fill='none' stroke='" + b2 + "' stroke-width='1.5' stroke-opacity='.5' stroke-linecap='round'/>" +
		"<circle fill='" + b2 + "' fill-opacity='.7' cx='19' cy='-19' r='2.6'/>" +
		"</g>" +
		// ── нарвал, молот-акула, парусник, пила ──
		// Каждый узнаётся одной деталью: длинный бивень, Т-образная голова,
		// огромный парус, зубчатый нос. В толпе мелкой рыбы читается сразу.
		//
		// НАС В +x У ВСЕХ, КАК И У ОСТАЛЬНЫХ: тело смотрит в +x по ходу.
		"<g id='NA' fill='" + b + "' stroke='" + e + "' stroke-width='1' stroke-opacity='.42'>" +
		"<path d='M70 0C56 -22 20 -32 -20 -26C-40 -23 -56 -12 -64 0C-56 12 -40 23 -20 26C20 32 56 22 70 0Z'/>" +
		"<path d='M68 -2.4C92 -4.6 122 -5.4 156 -4.4C122 -2.6 92 -0.8 68 0.6Z'/>" +
		"<path d='M-62 0C-72 -8 -84 -20 -92 -34C-86 -18 -78 -6 -72 0C-78 6 -86 18 -92 34C-84 20 -72 8 -62 0Z'/>" +
		"<path d='M22 20C24 32 30 42 40 48C36 34 30 24 26 16Z'/>" +
		"<circle fill='" + b2 + "' fill-opacity='.7' cx='48' cy='-4' r='3'/>" +
		"</g>" +
		"<g id='HB' fill='" + b + "' stroke='" + e + "' stroke-width='1' stroke-opacity='.42'>" +
		"<path d='M36 0C30 -14 6 -22 -16 -18C-30 -15 -42 -8 -48 0C-42 8 -30 15 -16 18C6 22 30 14 36 0Z'/>" +
		"<path d='M-46 0C-56 -5 -66 -16 -72 -30C-67 -16 -61 -5 -56 0C-61 5 -67 16 -72 30C-66 16 -56 5 -46 0Z'/>" +
		"<path d='M-4 -18C-2 -32 4 -42 12 -46C18 -36 22 -26 22 -16Z'/>" +
		"<path d='M14 13C16 20 22 27 30 30C26 21 21 16 18 10Z'/>" +
		// ШЕЯ. Узкий стебель между корпусом и перекладиной: полувысота 10 при
		// корпусной 22. Без сужения перекладина растёт из тела встык и
		// остаётся плавником. С сужением сбоку читается Т.
		"<path d='M28 -7C36 -10 44 -11 50 -11L50 11C44 11 36 10 28 7Z'/>" +
		// ПЕРЕКЛАДИНА ПО ОБЕ СТОРОНЫ ОТ ОСИ, от -32 до +32, то есть выше
		// корпуса с запасом. Прежняя лежала от -30 до +12, то есть целиком
		// над осью, и читалась как второй плавник.
		"<path d='M48 -11C68 -21 98 -25 120 -21C132 -19 132 7 120 9C98 13 68 11 48 9C43 8 43 -10 48 -11Z'/>" +
		// Рот короткий и толстый, у молота длинного носа нет.
		"<path d='M42 3C50 8 58 7 63 1C57 -2 49 -2 42 0Z'/>" +
		// ГЛАЗА НА КОНЦАХ ПЕРЕКЛАДИНЫ, ВНУТРИ ЕЁ. Прежние стояли на -18 и
		// +16 при перекладине, доходившей вниз лишь до +12, — нижний глаз
		// висел в воде снаружи.
		"<circle fill='" + b2 + "' cx='121' cy='-16' r='3.4'/><circle fill='" + b2 + "' cx='121' cy='6' r='3.4'/>" +
		"<circle fill='" + e + "' fill-opacity='.75' cx='121' cy='-16' r='1.3'/><circle fill='" + e + "' fill-opacity='.75' cx='121' cy='6' r='1.3'/>" +
		"</g>" +
		"<g id='SF' fill='" + b + "' stroke='" + e + "' stroke-width='1' stroke-opacity='.42'>" +
		"<path d='M-20 -16C-14 -50 4 -78 26 -92C21 -62 23 -36 28 -14Z'/>" +
		"<path d='M60 0C46 -12 14 -18 -18 -14C-34 -12 -46 -6 -52 0C-46 6 -34 12 -18 14C14 18 46 12 60 0Z'/>" +
		"<path d='M58 -2.2C80 -3.6 104 -3.8 126 -2.8C104 -1.6 80 -0.8 58 0.8Z'/>" +
		"<path d='M-50 0C-60 -6 -70 -16 -76 -30C-71 -16 -65 -5 -60 0C-65 5 -71 16 -76 30C-70 16 -60 6 -50 0Z'/>" +
		"<path d='M10 12C12 24 18 34 28 40C24 26 18 18 14 8Z'/>" +
		"</g>" +
		"<g id='SW' fill='" + b + "' stroke='" + e + "' stroke-width='1' stroke-opacity='.42'>" +
		"<path d='M50 0C38 -14 8 -20 -16 -16C-30 -14 -42 -8 -46 0C-42 8 -30 14 -16 16C8 20 38 14 50 0Z'/>" +
		"<path d='M48 -3.4C72 -5 100 -5.6 130 -4.6L134 0L130 4.6C100 5.6 72 5 48 3.4Z'/>" +
		"<path d='M60 4.6L64 9L68 4.8M74 5.2L78 9.6L82 5.4M88 5.6L92 10L96 5.8M102 5.8L106 10.2L110 6M116 5.8L120 10L124 5.8' fill='none' stroke='" + b + "' stroke-width='1.6' stroke-opacity='.9' stroke-linecap='round'/>" +
		"<path d='M-44 0C-54 -5 -64 -16 -70 -30C-65 -16 -59 -5 -54 0C-59 5 -65 16 -70 30C-64 16 -54 5 -44 0Z'/>" +
		"<path d='M-2 -16C0 -30 6 -40 14 -44C20 -34 24 -24 24 -14Z'/>" +
		"<path d='M12 12C14 24 20 34 30 40C26 26 20 18 16 8Z'/>" +
		"</g>" +
		// ── дно: крабы и морские звёзды ──
		// Дно было пустым силуэтом рельефа и водорослей и читалось как фон.
		// С этими двумя оно читается как место, где что-то живёт. Звезда с
		// пятью округлыми лучами, а не острыми: раньше вы просили без острых
		// углов, и на дне острые лучи торчали бы как осколки.
		"<g id='CR' fill='" + b + "' stroke='" + e + "' stroke-width='1' stroke-opacity='.42'>" +
		"<path d='M-16 0C-16 -11 -7 -17 0 -17C7 -17 16 -11 16 0C16 10 8 16 0 16C-8 16 -16 10 -16 0Z'/>" +
		"<path d='M-13 -4C-22 -8 -28 -14 -30 -21' fill='none' stroke='" + b + "' stroke-width='2.4' stroke-opacity='.95' stroke-linecap='round'/>" +
		"<path d='M-14 2C-24 2 -30 0 -34 -4' fill='none' stroke='" + b + "' stroke-width='2.4' stroke-opacity='.95' stroke-linecap='round'/>" +
		"<path d='M-13 8C-21 12 -26 17 -27 23' fill='none' stroke='" + b + "' stroke-width='2.4' stroke-opacity='.95' stroke-linecap='round'/>" +
		"<path d='M13 -4C22 -8 28 -14 30 -21' fill='none' stroke='" + b + "' stroke-width='2.4' stroke-opacity='.95' stroke-linecap='round'/>" +
		"<path d='M14 2C24 2 30 0 34 -4' fill='none' stroke='" + b + "' stroke-width='2.4' stroke-opacity='.95' stroke-linecap='round'/>" +
		"<path d='M13 8C21 12 26 17 27 23' fill='none' stroke='" + b + "' stroke-width='2.4' stroke-opacity='.95' stroke-linecap='round'/>" +
		"<path d='M-18 -12C-27 -17 -33 -15 -33 -9C-33 -4 -28 -2 -23 -5C-26 -9 -24 -12 -18 -12Z'/>" +
		"<path d='M18 -12C27 -17 33 -15 33 -9C33 -4 28 -2 23 -5C26 -9 24 -12 18 -12Z'/>" +
		"<circle fill='" + b2 + "' fill-opacity='.6' cx='-6' cy='-6' r='2.2'/><circle fill='" + b2 + "' fill-opacity='.6' cx='6' cy='-6' r='2.2'/>" +
		"</g>" +
		"<g id='ST' fill='" + b + "' stroke='" + e + "' stroke-width='1' stroke-opacity='.42'>" +
		"<path d='M0 -7C2 -16 6 -21 10 -19C14 -17 12 -10 6 -4C12 -6 20 -8 22 -4C24 0 17 4 7 3C14 7 19 13 16 17C13 21 7 16 2 9C2 16 -1 22 -6 21C-11 20 -10 13 -6 5C-10 11 -17 15 -20 11C-23 7 -16 3 -8 2C-16 3 -23 -1 -22 -5C-21 -10 -13 -9 -4 -6C-10 -11 -13 -18 -10 -20C-7 -22 -3 -16 0 -7Z'/>" +
		"<path d='M0 -7C2 -16 6 -21 10 -19C14 -17 12 -10 6 -4C12 -6 20 -8 22 -4C24 0 17 4 7 3C14 7 19 13 16 17C13 21 7 16 2 9C2 16 -1 22 -6 21C-11 20 -10 13 -6 5C-10 11 -17 15 -20 11C-23 7 -16 3 -8 2C-16 3 -23 -1 -22 -5C-21 -10 -13 -9 -4 -6C-10 -11 -13 -18 -10 -20C-7 -22 -3 -16 0 -7Z' fill='none' stroke='" + e + "' stroke-width='1' stroke-opacity='.4'/>" +
		"</g>" +
		// ── моллюски ──
		"<g id='SQ' fill='" + b + "' stroke='" + e + "' stroke-width='1' stroke-opacity='.42'>" +
		"<path d='M28 0C18 -12 -8 -13 -26 -5C-33 -11 -39 -16 -42 -19C-42 -8 -40 8 -42 19C-39 16 -33 11 -26 5C-8 13 18 12 28 0Z'/>" +
		"<path d='M26 2C34 6 40 12 44 22' fill='none' stroke='" + b + "' stroke-width='2' stroke-linecap='round'/>" +
		"<path d='M26 0C36 2 44 6 52 4M26 -2C36 -4 44 -8 50 -12' fill='none' stroke='" + b + "' stroke-width='2.4' stroke-linecap='round'/></g>" +
		"<g id='OC' fill='" + b + "' stroke='" + e + "' stroke-width='1' stroke-opacity='.42'>" +
		"<ellipse cx='0' cy='-10' rx='24' ry='18'/>" +
		"<path d='M-14 -2C-26 6 -34 16 -38 26M-6 4C-12 16 -14 26 -12 32M2 6C2 18 4 26 8 33M10 4C14 16 20 24 26 30M18 0C28 8 36 16 42 24' fill='none' stroke='" + b + "' stroke-width='7' stroke-linecap='round'/></g>" +
		"<g id='SH' fill='" + b + "' stroke='" + e + "' stroke-width='1' stroke-opacity='.42'>" +
		"<path d='M-20 0C-20 -15 -11 -23 0 -23C11 -23 20 -15 20 0Z'/>" +
		"<path d='M0 -23L0 0M-10 -19L-6 0M-16 -11L-10 0M10 -19L6 0M16 -11L10 0' fill='none' stroke='" + b2 + "' stroke-width='1.2' stroke-opacity='.55'/></g>" +
		// ── медузы: три формы колокола ──
		"<g id='J'>" +
			"<ellipse rx='40' ry='34' fill='url(#jg)'/>" +
			"<path d='M-21 0A21 17 0 0 1 21 0Z' fill='" + C.bell + "' fill-opacity='.6'/>" +
			"<path d='M-21 0A21 17 0 0 1 21 0' fill='none' stroke='" + C.rim + "' stroke-opacity='.85' stroke-width='1.9'/>" +
			"<path d='M-21 0q5 5 10.5 0q5 5 10.5 0q5 5 10.5 0q5 5 10.5 0' fill='none' stroke='" + C.rim + "' stroke-opacity='.5' stroke-width='1.2'/>" +
			"<ellipse cx='0' cy='-2' rx='7' ry='4.5' fill='" + C.core + "' fill-opacity='.8'/>" +
			"</g>" +
		"<g id='JT'>" +
			"<g fill='none' stroke='" + C.ten + "' stroke-opacity='.85' stroke-width='2.2' stroke-linecap='round'>" +
			"<path d='M-9 0C-13 16 -6 28 -10 44'/><path d='M0 0C-2 20 3 32 0 52'/><path d='M9 0C13 16 6 28 10 44'/>" +
			"</g>" +
			"<g fill='none' stroke='" + C.ten + "' stroke-opacity='.5' stroke-width='1' stroke-linecap='round'>" +
			"<path d='M-16 1C-22 16 -15 26 -19 38'/><path d='M-4 1C-9 20 -2 34 -6 58'/><path d='M4 1C9 20 2 34 6 54'/>" +
			"<path d='M16 1C22 16 15 26 19 36'/><path d='M-20 2C-28 12 -24 20 -30 28'/><path d='M20 2C28 12 24 20 30 26'/>" +
			"</g></g>" +
		"<g id='JB'>" +
			"<ellipse rx='32' ry='28' fill='url(#jg)'/>" +
			"<path d='M-17 0A17 14 0 0 1 17 0Z' fill='" + C.bell + "' fill-opacity='.58'/>" +
			"<path d='M-17 0A17 14 0 0 1 17 0' fill='none' stroke='" + C.rim + "' stroke-opacity='.8' stroke-width='1.7'/>" +
			"<path d='M-17 0q4 4 8.5 0q4 4 8.5 0q4 4 8.5 0q4 4 8.5 0' fill='none' stroke='" + C.rim + "' stroke-opacity='.46' stroke-width='1.1'/>" +
			"</g>" +
		"<g id='JTB'>" +
			"<g fill='none' stroke='" + C.ten + "' stroke-opacity='.78' stroke-width='4.8' stroke-linecap='round'>" +
			"<path d='M-6 0C-10 12 -4 20 -7 30'/><path d='M0 0C-2 14 3 22 0 34'/><path d='M6 0C10 12 4 20 7 30'/>" +
			"</g>" +
			"<g fill='none' stroke='" + C.ten + "' stroke-opacity='.45' stroke-width='.9' stroke-linecap='round'>" +
			"<path d='M-13 1C-18 10 -13 16 -16 24'/><path d='M-3 1C-7 14 -2 22 -5 34'/><path d='M3 1C7 14 2 22 5 32'/><path d='M13 1C18 10 13 16 16 24'/>" +
			"</g></g>" +
		"<g id='JC'>" +
			"<ellipse rx='24' ry='21' fill='url(#jg)'/>" +
			"<path d='M-13 0A13 11 0 0 1 13 0Z' fill='" + C.bell + "' fill-opacity='.55'/>" +
			"<path d='M-13 0A13 11 0 0 1 13 0' fill='none' stroke='" + C.rim + "' stroke-opacity='.78' stroke-width='1.5'/>" +
			"<path d='M-13 0q2.6 5 5.2 0q2.6 5 5.2 0q2.6 5 5.2 0q2.6 5 5.2 0' fill='none' stroke='" + C.rim + "' stroke-opacity='.5' stroke-width='1.1'/>" +
			"</g>" +
		"<g id='JTC'>" +
			"<g fill='none' stroke='" + C.ten + "' stroke-opacity='.6' stroke-width='1' stroke-linecap='round'>" +
			"<path d='M-11 0C-15 7 -12 12 -14 18'/><path d='M-6 0C-8 8 -5 14 -7 22'/><path d='M0 0C0 9 1 16 0 26'/>" +
			"<path d='M6 0C8 8 5 14 7 22'/><path d='M11 0C15 7 12 12 14 18'/>" +
			"</g></g>"
	);
}

/**
		 * Собрать документ сцены.
		 *
		 * Три слоя глубины: 0–340 самый светлый, 340–620 средний, 620–900 темнота
		 * и дно. Глубину читают не формой, а светом: кусты и моллюски стоят в
		 * нижней трети, медузы и косяки — в верхней.
		 *
		 * Стая строится от головы: несколько шеренг вбок, ряды вниз, общее время
		 * перехода. Члены с разбросом по X — это не стая, это россыпь.
		 *
		 * @param {object} run - живое состояние темы.
		 * @returns {string} готовый документ SVG.
		 */
		function buildOcean(run) {
			var light = run.scheme === "light";
			var C = SCHEMES[light ? "light" : "dark"];
			var t = run.tint;
			var s = [];
			s.push("<svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' viewBox='0 0 1600 900' width='1600' height='900' preserveAspectRatio='xMidYMid slice'>");
			s.push("<defs>");
			s.push("<linearGradient id='w' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='" + C.surf + "'/><stop offset='.32' stop-color='" + C.mid + "'/><stop offset='.7' stop-color='" + C.deep + "'/><stop offset='1' stop-color='" + C.floor + "'/></linearGradient>");
			// Лучи в референсе отчётливо видны и идут далеко вглубь: подъём
			// прозрачности больше, а затухание растянуто до нижней трети кадра.
			// Вся строка: строковый литерал нельзя разбивать переносом.
			s.push("<linearGradient id='sg' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='" + C.beam + "' stop-opacity='0'/><stop offset='.14' stop-color='" + C.beam + "' stop-opacity='" + round(0.4 * t) + "'/><stop offset='.42' stop-color='" + C.beam + "' stop-opacity='" + round(0.19 * t) + "'/><stop offset='.82' stop-color='" + C.beam + "' stop-opacity='" + round(0.05 * t) + "'/><stop offset='1' stop-color='" + C.beam + "' stop-opacity='0'/></linearGradient>");
			s.push("<linearGradient id='fl' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='" + C.floor + "' stop-opacity='0'/><stop offset='1' stop-color='" + C.floor + "' stop-opacity='.45'/></linearGradient>");
			s.push("<radialGradient id='gl'><stop offset='0' stop-color='" + C.glow + "' stop-opacity='" + round(0.4 * t) + "'/><stop offset='1' stop-color='" + C.glow + "' stop-opacity='0'/></radialGradient>");
			// Тело медузы. Пик был 0,34 от t, то есть при ручке по умолчанию 0,8
		// в центре колокола стояло 0,27, к краю — ноль. На пятидесяти семи
		// пикселях от медузы оставался бледный контур, а стоит она в верхней
		// трети кадра, где вода светлее всего, и бледный голубой на светлом
		// голубом не читается. Полупрозрачность остаётся — это её суть, — но
		// форма теперь различима: плотный центр, окрашенный край.
		// Тёмный контур вокруг крупного силуэта. Два тёмных тела, наложенные
		// друг на друга, без контура дают одно пятно, и глаз читает не два
		// тела, а одно.
		//
		// Контур строится фильтром, а не обводкой на путях: заливку задаёт
		// группа набора, и на каждый путь обводка повесилась бы отдельно —
		// вышла бы сетка внутренних линий. Раздуваем альфу, заливаем её
		// тёмным, оставляем заливку внутри и кладём контур ПОД силуэт.
		//
		// Радиус 2,2 единицы на масштабе крупного тела даёт около двух
		// пикселей: хватает, чтобы два тела разошлись границей, и мало,
		// чтобы силуэт не раздулся в кляксу.
		s.push("<filter id='hl' x='-30%' y='-30%' width='160%' height='160%'><feMorphology in='SourceAlpha' operator='dilate' radius='2.2' result='d'/><feFlood flood-color='" + C.body + "' result='c'/><feComposite in='c' in2='d' operator='in' result='o'/><feMerge><feMergeNode in='o'/><feMergeNode in='SourceGraphic'/></feMerge></filter>");
		s.push("<radialGradient id='jg'><stop offset='0' stop-color='" + C.jg + "' stop-opacity='" + round(0.62 * t) + "'/><stop offset='.6' stop-color='" + C.jg + "' stop-opacity='" + round(0.3 * t) + "'/><stop offset='1' stop-color='" + C.jg + "' stop-opacity='.12'/></radialGradient>");
			s.push("<radialGradient id='sc' cx='.5' cy='.26' r='.6'><stop offset='0' stop-color='" + (light ? "#ffffff" : "#00202f") + "' stop-opacity='" + round(0.15 * t) + "'/><stop offset='1' stop-color='" + (light ? "#ffffff" : "#00202f") + "' stop-opacity='0'/></radialGradient>");
			s.push("<radialGradient id='vg' cx='.5' cy='.5' r='.8'><stop offset='.6' stop-color='" + C.deep + "' stop-opacity='0'/><stop offset='1' stop-color='" + C.deep + "' stop-opacity='.3'/></radialGradient>");
			s.push(SCENE_STYLE);
			s.push(buildDefs(C));
			s.push("<g id='SQ' fill='" + C.body + "'><path d='M28 0C18 -12 -8 -13 -26 -5L-40 -18L-36 0L-40 18L-26 5C-8 13 18 12 28 0Z'/><path d='M26 2C34 6 40 12 44 22' fill='none' stroke='" + C.body + "' stroke-width='2' stroke-linecap='round'/><path d='M26 0C36 2 44 6 52 4M26 -2C36 -4 44 -8 50 -12' fill='none' stroke='" + C.body + "' stroke-width='2.4' stroke-linecap='round'/></g>");
			s.push("<g id='OC' fill='" + C.body + "'><ellipse cx='0' cy='-10' rx='24' ry='18'/><path d='M-14 -2C-26 6 -34 16 -38 26M-6 4C-12 16 -14 26 -12 32M2 6C2 18 4 26 8 33M10 4C14 16 20 24 26 30M18 0C28 8 36 16 42 24' fill='none' stroke='" + C.body + "' stroke-width='7' stroke-linecap='round'/></g>");
			s.push("<g id='SH' fill='" + C.body + "'><path d='M-20 0C-20 -15 -11 -23 0 -23C11 -23 20 -15 20 0Z'/><path d='M0 -23L0 0M-10 -19L-6 0M-16 -11L-10 0M10 -19L6 0M16 -11L10 0' fill='none' stroke='" + C.body2 + "' stroke-width='1.2' stroke-opacity='.55'/></g>");
			s.push("</defs>");
						s.push("<rect width='1600' height='900' fill='url(#w)'/>");
			// Слои глубины: в референсе за рыбами видны полосы более светлой
			// воды с волнистым краем. Без них кадр читался как одно полотно.
			for (var bd = 0; bd < 2; bd++) {
				var by = 250 + bd * 150;
				var ba = 26 - bd * 7;
				var seg = 120;
				var dd = "M-120 " + by;
				for (var bi = 0; bi < 14; bi++) {
					dd += " q " + round(seg * 0.4) + " " + round((bi % 2 === 0 ? -ba : ba)) + " " + round(seg) + " 0";
				}
				dd += " L 1760 900 L -120 900 Z";
				s.push("<path d='" + dd + "' fill='" + (bd === 0 ? C.band1 : C.band2) + "' fill-opacity='" + round((0.3 - bd * 0.12) * t) + "'/>");
			}
			// Дно: холмистый силуэт с округлыми вершинами, без острых углов.
			var bed = "M-120 900 L-120 862";
			for (var hb = 0; hb < 9; hb++) {
				var hx = -120 + hb * 215;
				var hh = 806 + Math.sin(hb * 1.7) * 26 + (hb % 3) * 9;
				bed += " C" + round(hx + 70) + " " + round(hh) + " " + round(hx + 145) + " " + round(hh) + " " + round(hx + 215) + " 862";
			}
			bed += " L 1760 900 Z";
									s.push("<path d='" + bed + "' fill='" + C.bed + "'/>");
			// Скалы ставятся сразу за силуэтом дна, то есть ДО рыб: они стоят
			// дальше их по глубине, и на листе общей композиции так же — гряды
			// по краям кадра, рыба перед ними.
			for (var rk = 0; rk < 5; rk++) {
				var far = rk % 2 === 0;
				s.push("<g transform='translate(" + round(60 + rk * 320 + rnd() * 150) + ",900) scale(" +
					round((far ? 0.5 : 0.78) * (0.8 + rnd() * 0.5)) + ") rotate(" +
					round((rnd() - 0.5) * 5) + ")' opacity='" + round(far ? 0.45 : 0.7) + "'>" +
					"<use xlink:href='" + (far ? "#RK2" : "#RK1") + "'/></g>");
			}
			// Корабль стоит после силуэта дна — лежит на нём, а не тонет в нём.
			// Сведение на 13 градусов: нос приподнят, корма ушла в грунт. Ровно
			// лежащий корпус читался бы как ящик, а не как обломок.
			s.push("<g transform='translate(430,856) rotate(-13) scale(0.9)' opacity='0.96'><use xlink:href='#WS'/></g>");
			// Обломок корпуса поодаль — та же деталь, но мельче и бледнее, чтобы
			// читалась вторая глубина.
			s.push("<g transform='translate(1215,872) rotate(-5) scale(0.4)' opacity='0.55'><use xlink:href='#WS'/></g>");
			if (!run.enabled) {
				s.push("<rect width='1600' height='900' fill='url(#sc)'/><rect width='1600' height='900' fill='url(#vg)'/></svg>");
				return s.join("");
			}

			var seed = 20240611;
			function rnd() {
				seed = (seed * 1664525 + 1013904223) % 4294967296;
				return seed / 4294967296;
			}
			/**
			 * Прозрачность: середина кадра остаётся под текст, края видны целиком.
			 * @returns {number} прозрачность 0..1.
			 */
			function op(x, y) {
				var nx = Math.abs(x / 1600 - 0.5) * 2;
				var ny = Math.abs(y / 900 - 0.5) * 2;
				// Середина кадра приглушена под текст, но не вычеркнута: при 0,62
				// центр читался пустым, и живность казалась есть только по краям.
				return round(0.78 + 0.22 * Math.min(1, Math.max(Math.pow(nx, 1.6), Math.pow(ny, 1.7))));
			}
			/**
		 * Время перехода по кадру: чем больше тело и чем спокойнее вид, тем
		 * дольше.
		 *
		 * Ссылка 0,12 — эталонная мелкая рыба. Прежняя ссылка была 8, от
		 * старых масштабов, когда самая большая рыба имела r около 8. При
		 * нынешних 0,06–0,38 член степени давал 0,02–0,11, то есть почти
		 * постоянен, и размер на скорость не влиял вообще: быстрая рыба шла
		 * ровно так же, как медленная.
		 *
		 * @param {number} r - масштаб тела.
		 * @param {number} k - характерный множитель вида.
		 * @returns {number} секунды.
		 */
			function dur(r, k) {
				return round(20 * k * (1 + Math.pow(Math.max(0.03, r) / 0.12, 0.75) * 0.9));
			}
			// Счётчик дорожек одиночных тел.
			var bpN = 0;
			/**
			 * Тело в свободном плавании: своё время, своя дорожка, свой крен.
			 *
			 * Раньше движение было анимацией одного translateX, то есть тело
			 * пересекало кадр строго по горизонтали, на постоянной высоте.
			 * Теперь у него свой путь — волнистая линия, размах тем больше,
			 * чем крупнее тело, — и движение отдано animateMotion, как у косяка.
			 *
			 * Поворот по касательной НЕ включён, и это решение, а не недосмотр:
			 * при rotate="auto" тело, идущее справа налево, разворачивается на
			 * 180 градусов, и светлое брюхо косатки уезжает наверх. Направление
			 * задаёт зеркало — ровно то, на котором уже трижды ломалось
			 * «плывёт хвостом вперёд».
			 *
			 * Смена курса читается по крену: медленное колебание наклона
			 * корпуса, вложенное внутрь animateMotion отдельной группой. Чем
			 * крупнее тело, тем медленнее крен: у кита около двадцати секунд,
			 * у мелкой рыбы около восьми. Тот же закон, что и с ходом.
			 *
			 * @param {string} id - вид.
			 * @param {number} x - прежняя точка входа, ныне только для прозрачности.
			 * @param {number} y - высота дорожки.
			 * @param {number} r - масштаб тела.
			 * @param {number} delay - задержка, секунды.
			 * @param {number} dir - направление хода: 1 вправо, -1 влево.
			 * @param {number} k - характерный множитель вида.
			 * @returns {string} фрагмент SVG.
			 */
			function swim(id, x, y, r, delay, dir, k) {
				var waves = 2 + Math.floor(rnd() * 2);
				var amp = 24 + r * 190;
				var bid = "bp" + bpN++;
				var x0 = dir > 0 ? -400 : 2000;
				var bstep = 2400 / waves;
				var bd = "M" + x0 + " " + round(y);
				var up = 1;
				for (var wi = 0; wi < waves; wi++) {
					bd += " q " + round(bstep * 0.5) + " " + round(up * amp) + " " + round(bstep) + " 0";
					up = -up;
				}
				var big = Math.min(1, r / 0.4);
				return "<g opacity='" + op(x, y) + "'>" +
					"<defs><path id='" + bid + "' d='" + bd + "'/></defs>" +
					"<g>" +
						// Вдвое медленнее, и только здесь: `dur` считается на всех,
						// и косяки идут через `school()` с собственной скоростью.
						// Множитель вынесен в имя, иначе «×2» через полгода
						// будет неотличимо от опечатки в коэффициенте.
						"<animateMotion dur='" + round(dur(r, k) * 2) + "s' begin='-" + round(delay) +
							"s' repeatCount='indefinite'>" +
							"<mpath xlink:href='#" + bid + "'/></animateMotion>" +
						"<g class='swr' style='animation-duration:" + round(7 + big * 14) +
							"s;animation-delay:-" + round(rnd() * 20) + "s'>" +
						"<g transform='scale(" + (dir > 0 ? r : -r) + "," + r + ")'>" +
						"<g class='bb' style='animation-duration:" + round(5 + rnd() * 5) +
							"s;animation-delay:-" + round(rnd() * 6) + "s'>" +
						"<g class='tn' style='animation-duration:" + round(7 + rnd() * 7) +
							"s;animation-delay:-" + round(rnd() * 6) + "s'>" +
						// Решётка обязательна: без неё ссылка ищет элемент с ИМЕНЕМ вида, а
// элемент называется по id, и адрес без решётки — это относительное имя.
// Пустой use не даёт ни ошибки, ни следа: дым проходит, а тела нет.
"<g filter='url(#hl)'><use xlink:href='#" + id + "'/></g></g></g></g></g>" +
					"</g></g>";
			}
			/**
			 * Особь косяка на общей дорожке.
			 *
			 * Движение отдано animateMotion с mpath: рыба едет ровно по пути
			 * косяка, носом по ходу, потому что rotate="auto" поворачивает
			 * наполнение вместе с касательной. Различаются только задержка вдоль
			 * пути и смещение поперёк — то есть строение стаи.
			 *
			 * @param {string} id - вид.
			 * @param {string} path - идентификатор дорожки.
			 * @param {number} course - время полного перехода, секунды.
			 * @param {number} delay - отставание от вожака, секунды.
			 * @param {number} r - масштаб тела.
			 * @param {number} across - смещение поперёк хода, единицы.
			 * @param {number} alpha - прозрачность.
			 * @param {number} plane - номер плоскости глубины.
			 * @param {number} turn - собственный угол наклона особи, градусы.
			 * @param {string} flt - фильтр яркости и мягкости по глубине и
			 * расстоянию до зрителя.
			 * @returns {string} фрагмент SVG.
			 */
			function school(id, path, course, delay, r, across, alpha, plane, turn, flt) {
				// Яркость и мягкость приезжают сюда из плоскости: они уже
				// учли и глубину, и расстояние до зрителя.
				return "<g class='pl" + plane + "' opacity='" + alpha + "' style='" + flt + "'>" +
					"<animateMotion dur='" + course + "s' begin='-" + round(delay) +
						"s' repeatCount='indefinite' rotate='auto'>" +
					"<mpath xlink:href='#" + path + "'/></animateMotion>" +
					"<g transform='translate(0," + round(across) + ")'>" +
					"<g transform='scale(" + Math.round(r * 1000) / 1000 + "," + Math.round(r * 1000) / 1000 + ")'>" +
					"<g transform='rotate(" + round(turn) + ")'>" +
					"<g class='bb' style='animation-duration:" + round(3.4 + rnd() * 2.6) + "s;animation-delay:-" + round(rnd() * 5) + "s'>" +
					"<g class='tn' style='animation-duration:" + round(4.5 + rnd() * 4) + "s;animation-delay:-" + round(rnd() * 5) + "s'>" +
					"<use xlink:href='#" + id + "'/></g></g></g></g></g></g>";
			}

			// ── свет ──
			for (var sh = 0; sh < 6; sh++) {
				var sx = 40 + rnd() * 1520;
				var wBeam = 80 + rnd() * 150;
				var lean = 180 + rnd() * 320;
				s.push("<g class='sh' style='animation-duration:" + round(16 + rnd() * 14) + "s;animation-delay:-" + round(rnd() * 20) + "s'>" +
					"<path d='M" + round(sx) + " 0C" + round(sx + wBeam * 0.2) + " 240 " + round(sx + wBeam * 0.4 + lean * 0.5) + " 500 " + round(sx + wBeam + lean) + " 820C" + round(sx + wBeam * 0.3 + lean * 0.5) + " 500 " + round(sx + wBeam * 0.1) + " 240 " + round(sx) + " 0Z' fill='url(#sg)'/></g>");
			}
			// Блик стартует ровно за левым краем и уходит за правый, поэтому
			// появления в кадре не бывает. Короткий ход у крупного эллипса
			// невозможен: чтобы он был за краем в обоих концах, ход должен
			// быть не меньше ширины кадра плюс два радиуса. Отсюда медленный
			// дрейф через весь кадр — для мягкого свечения незаметно.
			for (var d = 0; d < 4; d++) {
				var grx = 160 + d * 44;
				var gdx = 1600 + 2 * grx;
				var gx = grx;
				var gy = 30 + rnd() * 220;
				s.push("<g transform='translate(" + round(gx) + "," + round(gy) + ")'><g class='dp' style='--dx:" + gdx + "px;animation-duration:" + round(120 + d * 30) + "s;animation-delay:-" + round(d * 37) + "s'>" +
					"<ellipse cx='0' cy='0' rx='" + round(grx) + "' ry='" + round(60 + d * 18) + "' fill='url(#gl)'/></g></g>");
			}
			for (var cz = 0; cz < 6; cz++) {
				var cy = 40 + cz * 58;
				// Полоса перекрывает кадр при любом своём положении. Три
				// условия: начало левее нуля, конец правее 1600, и ход не
				// больше расстояния от начала до левого края. При ходе в 700
				// начало должно быть не правее −700, а длина полосы — от 2300.
				// Стало 2520: запас есть, край полосы в кадр не заходит.
				var path = "M-820 " + cy + " q 70 -18 140 0";
				for (var k = 0; k < 18; k++) path += " t 140 0";
				s.push("<path class='cz' style='animation-duration:" + round(9 + cz * 1.6) + "s;animation-delay:-" + round(cz * 1.7) + "s;opacity:" + round((0.44 - cz * 0.06) * t) + "' d='" + path + "' stroke='" + C.caustic + "'/>");
			}
			for (var sn = 0; sn < 34; sn++) {
				var sny = Math.pow(rnd(), 0.6) * 900;
				s.push("<g class='sn' style='animation-duration:" + round(40 + rnd() * 55) + "s;animation-delay:-" + round(rnd() * 90) + "s'>" +
					"<circle cx='" + round(rnd() * 1700 - 50) + "' cy='0' r='" + round(0.6 + rnd() * 1.8) + "' fill='" + C.snow + "' fill-opacity='" + round(0.1 + rnd() * 0.3 + sny / 900 * 0.2) + "'/></g>");
			}

			// ── дно: ракушки, кусты водорослей ──
			/**
			 * Куст водоросли. Три формы: стеблевая лопасть, широкий лист с
			 * отростками, тонкий кустик. Ризоид у основания, движение
			 * двухсегментное: низ качается широко, верх — втрое сильнее.
			 * @returns {void}
			 */
			function kelp(x, y, scale, fill, holdOp, swayA, plan) {
				s.push("<g transform='translate(" + round(x) + "," + round(y) + ") scale(" + round(scale) + ")' opacity='" + holdOp + "'>");
				s.push("<ellipse rx='10' ry='4' fill='" + C.hold + "' fill-opacity='.9'/>");
				var n = plan === 0 ? 3 + Math.floor(rnd() * 3) : plan === 2 ? 3 + Math.floor(rnd() * 2) : 3 + Math.floor(rnd() * 2);
				for (var i = 0; i < n; i++) {
					var form = rnd();
					var ang = -1.5708 + (rnd() - 0.5) * 1.7;
					var len, bend, w, split, leaf, seg;
					if (form < 0.4) {
						len = 120 + rnd() * 160; bend = (rnd() - 0.5) * 0.9; w = 11 + rnd() * 8;
						split = 0.55; leaf = false; seg = 5;
					} else if (form < 0.75) {
						len = 85 + rnd() * 90; bend = (rnd() - 0.5) * 1.2; w = 20 + rnd() * 12;
						split = 0.5; leaf = true; seg = 5;
					} else {
						len = 60 + rnd() * 70; bend = (rnd() - 0.5) * 1.6; w = 5 + rnd() * 3;
						split = 0.45; leaf = false; seg = 4;
					}
					var tip = spine(split, ang, len, bend);
					var ta = spineTan(split, ang, len, bend);
					var d1 = round(swayA * (0.9 + rnd() * 0.5));
					var d2 = round(d1 * (form < 0.4 ? 0.8 : 0.95));
					s.push("<g fill='" + fill + "' stroke='" + C.edge + "' stroke-width='.6' stroke-opacity='.3'><g class='wv' style='animation-duration:" + d1 + "s;animation-delay:-" + round(rnd() * 9) + "s'>");
					s.push(blade(0, split, ang, len, bend, w, seg));
					if (leaf) s.push(blade(0.2, 0.44, ang, len, bend, w * 1.35, 4));
					s.push("<g transform='translate(" + round(tip[0]) + "," + round(tip[1]) + ") rotate(" + round((ta - ang) * 57.2958) + ")'><g class='wv2' style='animation-duration:" + d2 + "s;animation-delay:-" + round(rnd() * 7) + "s'>");
					s.push(blade(0, 1, 0, len * 0.55, bend * 0.7, w * 0.6, seg - 1));
					s.push("</g></g></g></g>");
				}
				s.push("</g>");
			}

			var kelpN = Math.round(15 * run.density);
			for (var q = 0; q < kelpN; q++) {
				var kx = 20 + rnd() * 1560;
				var ky = 570 + rnd() * 320;
				var plan = q % 3;
				if (plan === 0) kelp(kx, ky, 0.55 + rnd() * 0.3, C.weedFar, round(0.44 + rnd() * 0.16), 7 + rnd() * 4, plan);
				else if (plan === 2) kelp(kx, ky, 1.05 + rnd() * 0.5, C.weedNear, round(0.78 + rnd() * 0.2), 4.5 + rnd() * 2.5, plan);
				else kelp(kx, ky, 0.78 + rnd() * 0.32, C.weedMid, round(0.6 + rnd() * 0.2), 5.5 + rnd() * 3, plan);
			}
			for (var shl = 0; shl < 12; shl++) {
				s.push("<g transform='translate(" + round(20 + rnd() * 1560) + "," + round(860 + rnd() * 30) + ") scale(" + round(0.5 + rnd() * 0.7) + ")' opacity='" + round(0.5 + rnd() * 0.4) + "'><use xlink:href='#SH'/></g>");
			}
			for (var oc = 0; oc < 2; oc++) {
				s.push("<g transform='translate(" + round(200 + rnd() * 1200) + "," + round(852 + rnd() * 20) + ") scale(" + round(0.8 + rnd() * 0.5) + ")' opacity='0.9'><g class='wv' style='animation-duration:" + round(6 + rnd() * 3) + "s;animation-delay:-" + round(rnd() * 6) + "s'><use xlink:href='#OC'/></g></g>");
			}

			/**
			 * Один всплывающий пузырёк.
			 * @returns {string} фрагмент SVG.
			 */
			/**
			 * Пузырь: поднимается, на подъёме растёт и у самой поверхности
			 * оставляет плоский всплеск. Всё держит один период и одна
			 * задержка, поэтому признаки совпадают по фазе, а не примерно.
			 *
			 * @param {number} x - координата по горизонтали.
			 * @param {number} r - радиус у дна.
			 * @param {number} dur2 - время подъёма, секунды.
			 * @param {number} delay - сдвиг фазы, секунды.
			 * @param {number} wob - период покачивания, секунды.
			 * @returns {string} фрагмент SVG.
			 */
			function bubble(x, r, dur2, delay, wob) {
				var beat = 'animation-duration:' + round(dur2) + 's;animation-delay:-' + round(delay) + 's';
				return "<g class='bk' style='" + beat + "'>" +
					"<g class='bg' style='" + beat + "'>" +
					"<g transform='translate(" + round(x) + ",0)'>" +
					"<g class='bw' style='animation-duration:" + round(wob) + "s;animation-delay:-" + round(rnd() * 5) + "s'>" +
					"<circle cx='0' cy='0' r='" + round(r) + "' fill='none' stroke='" + C.bub + "' stroke-opacity='.55' stroke-width='.7'/>" +
					"<circle cx='" + round(-r * 0.32) + "' cy='" + round(-r * 0.34) + "' r='" + round(r * 0.24) + "' fill='" + C.bub + "' fill-opacity='.65'/></g></g></g>" +
					"<g class='bs' style='" + beat + "'><g transform='translate(" + round(x) + ",3)'>" +
					"<ellipse cx='0' cy='0' rx='11' ry='2.4' fill='none' stroke='" + C.bub + "' stroke-opacity='.5' stroke-width='.8'/>" +
					"</g></g></g>";
			}
			for (var b = 0; b < 10; b++) {
				s.push(bubble(rnd() * 1620 - 10, 1 + rnd() * 2.6, 22 + rnd() * 30, rnd() * 45, 3 + rnd() * 3));
			}
			for (var st = 0; st < 10; st++) {
				var bx = rnd() * 1620 - 10;
				var members = 4 + Math.floor(rnd() * 5);
				for (var mm = 0; mm < members; mm++) {
					s.push(bubble(bx + (rnd() - 0.5) * 60, 0.5 + rnd() * 1.3, 18 + rnd() * 18, mm * 2.4 + rnd() * 3, 2.4 + rnd() * 2.2));
				}
			}
			// ПУЗЫРЬКИ ИЗО РТА РЫБ. Стайками по две-четыре, на глубинах, где
			// ходят косяки, и мельче обычного пузыря примерно вдвое: изо рта
			// выходит мелочь, крупный пузырь из рыбы выглядел бы неправдой.
			//
			// Точно привязать пузырь к конкретной рыбе нельзя — сцена статична
			// и пузырь не знает, где в этот момент косяк. Но косяки ходят по
			// всей ширине и по всем глубинам, а пузырьки поднимаются через все
			// эти глубины, и за цикл в двадцать-тридцать секунд они обязательно
			// оказываются рядом с рыбой. Честная привязка стоила бы пересчёта
			// СТОЛБЫ ПУЗЫРЕЙ СО ДНА. Идут от грунта кверху, и пузырьки в столбе
			// разного калибра, причём кверху крупнее — давление падает. Фоновые
			// пузыри шли равномерно по всей высоте и были одного размера, и
			// читались как дождь, а не как выделение газа из грунта.
			for (var vb = 0; vb < 5; vb++) {
				var vbx = 90 + vb * 320 + rnd() * 130;
				var vn = 9 + Math.floor(rnd() * 7);
				for (var vk = 0; vk < vn; vk++) {
					// Кверху пузырь крупнее: столб читается как восходящий поток.
					var grow = 0.5 + (vk / vn) * 1.5;
					s.push(bubble(
						vbx + (rnd() - 0.5) * (26 + vk * 5),
						(0.5 + rnd() * 1.1) * grow,
						30 + rnd() * 22,
						vk * 1.15 + rnd() * 0.6,
						2.6 + rnd() * 2.4
					));
				}
			}
			// пути в каждом кадре.
			for (var fb = 0; fb < 9; fb++) {
				var fpx = 20 + rnd() * 1560;
				var fn2 = 2 + Math.floor(rnd() * 3);
				for (var fk = 0; fk < fn2; fk++) {
					s.push(bubble(
						fpx + (rnd() - 0.5) * 12,
						0.45 + rnd() * 0.85,
						26 + rnd() * 20,
						fk * 1.7 + rnd() * 3,
						2.1 + rnd() * 2.1
					));
				}
			}

			// ── медузы: верхний светлый слой ──
// Схема в четыре группы: горизонталь → положение и размер →
// дрейф по глубине → пульс колокола. Возросла на три закрывающих
// тега, и это единственное место, где её легко сбить.
function jelly(p, r, bell, arms, pd, delay, dir, tilt, lane, bob) {
	s.push("<g opacity='" + round(0.55 + 0.45 * Math.min(1, r / 0.96)) + "'><g class='" +
		(dir > 0 ? "ln" : "lnr") + "' style='animation-duration:" + lane + "s;animation-delay:-" + round(delay) + "s'>" +
		"<g transform='translate(" + round(p[0]) + "," + round(p[1]) + ") scale(" + (dir > 0 ? r : -r) + "," + r + ") rotate(" + tilt + ")'>" +
		"<g class='jd' style='animation-duration:" + bob + "s;animation-delay:-" + round(rnd() * bob) + "s'>" +
			"<g class='jp' style='animation-duration:" + pd + "s;animation-delay:-" + round(rnd() * 4) + "s'>" +
			"<use xlink:href='#" + bell + "'/>" +
			"<g transform='translate(0," + round(11 * (bell === "J" ? 1 : bell === "JB" ? 0.8 : 0.6)) + ")'><g class='jw' style='animation-duration:" + round(pd * 0.92) + "s;animation-delay:-" + round(rnd() * 4) + "s'><use xlink:href='#" + arms + "'/></g></g>" +
			"</g></g></g></g></g>");
}
// Шесть штук, и порог получается сам собой: шесть и есть шесть.
// Разброс размера ровно тройной, 0,32…0,96: мелкая особь около
// семнадцати пикселей, крупная около пятидесяти.
//
// Глубина 70–630, от подповерхности до глубокой воды. Пять плоскостей
// косяков живут в тех же пределах, и медузы теперь ходят с ними в
// одной воде, а не над ними, как было в верхней трети.
var jellN = Math.round(6 * run.density);
for (var j = 0; j < jellN; j++) {
	var jr = 0.32 + rnd() * 0.64;
	var jpd = round(2.2 + rnd() * 2.8);
	var jbell = ["J", "JB", "JC"][j % 3];
	var jarms = jbell === "J" ? "JT" : jbell === "JB" ? "JTB" : "JTC";
	// Дрейф по глубине: своя долгота у каждой, от 22 до 48 секунд.
	var jbob = round(22 + rnd() * 26);
	// Проход вчетверо длиннее прежних 68–120 секунд.
	var jlane = round((55 + jr * 64 + rnd() * 40) * 4);
	// Задержка разведена по всей длине прохода, а не по первым его
	// секундам: при проходу в четыреста секунд сдвиг в сто тридцать
	// собрал бы всех шестерых в первой трети пути.
	jelly(
		[80 + rnd() * 1440, 70 + rnd() * 560],
		jr, jbell, jarms, jpd, rnd() * jlane, rnd() < 0.5 ? 1 : -1,
		round((rnd() - 0.5) * 0.5 * 57.2958), jlane, jbob
	);
}

			// ── кораллы на дне ──
			// Рядом с лопастями водорослей, но формой другие: ветвятся, а не
			// гнутся. Тринадцать кустов трёх родов, вперемешку с водорослями.
			for (var co = 0; co < 13; co++) {
				var ckind = ["CO1", "CO2", "CO3"][co % 3];
				s.push("<g opacity='" + round(0.55 + rnd() * 0.35) + "'>" +
					"<g transform='translate(" + round(50 + co * 118 + rnd() * 90) + ",902) scale(" +
						round(0.6 + rnd() * 0.6) + ") rotate(" + round((rnd() - 0.5) * 16) + ")'>" +
						"<g class='wv' style='animation-duration:" + round(6 + rnd() * 5) + "s;animation-delay:-" + round(rnd() * 6) + "s'>" +
							"<use xlink:href='#" + ckind + "'/></g></g></g>");
			}
			// ── дно: удильщики и коньки ──
			// Отдельными особями, а не в косяке: ни тот, ни другой стаями не ходит.
			// Конёк стоит вертикально и не зеркалится — зеркалить его нечего,
			// хвост завит в одну сторону.
			//
			// Удильщик дрейфует носом по ходу, поэтому при ходе влево
			// тело отражается: иначе он плыл бы задом наперёд.
			for (var an = 0; an < 2; an++) {
				var anr = 0.17 + rnd() * 0.08;
				var adir = an % 2 === 0 ? 1 : -1;
				s.push("<g opacity='" + round(0.5 + 0.3 * anr) + "'><g class='" +
					(adir > 0 ? "ln" : "lnr") + "' style='animation-duration:" + round(150 + an * 60) + "s;animation-delay:-" + round(rnd() * 140) + "s'>" +
					"<g transform='translate(" + round(220 + an * 760 + rnd() * 180) + "," + round(640 + an * 90) + ") scale(" + (adir > 0 ? anr : -anr) + "," + anr + ")'>" +
					"<use xlink:href='#AN'/></g></g></g>");
			}
			for (var se = 0; se < 4; se++) {
				s.push("<g opacity='" + round(0.6 + rnd() * 0.3) + "'>" +
					"<g transform='translate(" + round(120 + se * 380 + rnd() * 200) + "," + round(880) + ") scale(" + round(0.6 + rnd() * 0.3) + ")'>" +
					"<g class='sw' style='animation-duration:" + round(3.6 + rnd() * 3) + "s;animation-delay:-" + round(rnd() * 4) + "s'>" +
					"<use xlink:href='#SE'/></g></g></g>");
			}
			// ── нарвал, молот, парусник, пила ──
			// От 70 до 137 пикселей: много меньше кита, но силуэт узнаваемый,
			// и они читаются как отдельные виды, а не как пятна.
			//
			// Направление и знак зеркала берутся из одной переменной, иначе
			// тело поехало бы мордой в одну сторону, а ход в другую.
			var big = [
				["HB", 0.24 + rnd() * 0.1, 300, 1.05],
				["HB", 0.23 + rnd() * 0.09, 660, 0.95],
				["NA", 0.21 + rnd() * 0.09, 470, 1.0],
				["NA", 0.19 + rnd() * 0.08, 980, 0.92],
				["SF", 0.17 + rnd() * 0.09, 780, 0.8],
				["SW", 0.19 + rnd() * 0.08, 160, 0.85]
			];
			for (var bi = 0; bi < big.length; bi++) {
				var bdir = bi % 2 === 0 ? 1 : -1;
				s.push(swim(big[bi][0], 90 + rnd() * 1420, big[bi][3] > 1 ? 210 + rnd() * 190 : 380 + rnd() * 240, big[bi][1], rnd() * 150, bdir, big[bi][3]));
			}
			// Крабы и звёзды стоят на дне и только чуть покачиваются.
			for (var cb = 0; cb < 5; cb++) {
				s.push("<g opacity='" + round(0.62 + rnd() * 0.3) + "'>" +
					"<g transform='translate(" + round(90 + cb * 300 + rnd() * 190) + ",896) scale(" + round(0.34 + rnd() * 0.22) + ")'>" +
					"<g class='sw' style='animation-duration:" + round(4.4 + rnd() * 3) + "s;animation-delay:-" + round(rnd() * 4) + "s'>" +
					"<use xlink:href='#CR'/></g></g></g>");
			}
			for (var stx = 0; stx < 7; stx++) {
				s.push("<g opacity='" + round(0.5 + rnd() * 0.3) + "'>" +
					"<g transform='translate(" + round(60 + stx * 220 + rnd() * 160) + ",890) scale(" + round(0.4 + rnd() * 0.3) + ")'>" +
					"<use xlink:href='#ST'/></g></g>");
			}
			// ── косяки ──
			//
			// Косяк идёт по одному пути, и направление у группы общее. Поворот плавный,
			// потому что дорожка гладкая: в точке, где волна меняет наклон,
			// касательная горизонтальна, и угол не прыгает.
			//
			// Плоскостей пять. Глубина читается яркостью, размером и
			// расфокусировкой разом, а тень под телом даёт объём.
			//
			// Ни одна особь не смотрит строго по касательной: у каждой свой угол,
			// и чем дальше от вожака, тем сильнее поворот. Ровный строй по нитке
			// читается как схема, а не как косяк. Половина косяков идёт справа
			// налево — иначе весь океан плыл бы в одну сторону.
			/**
			 * Плоскость косяка.
			 *
			 * @param {number} i - индекс косяка.
			 * @returns {object} высота, масштаб, прозрачность и форма дорожки.
			 */
			function plane(i) {
				// ГЛУБИНА — это высота над дном, p от 0 до 4. Чем ниже, тем
				// темнее: это делает водную толщу толстой.
				//
				// РАССТОЯНИЕ — это насколько далеко от зрителя, z от 0 до 1.
				// Чем дальше, тем мельче, медленнее, темнее и мягче: это
				// делает кадр глубоким.
				//
				// Раньше это была одна шкала, и вода читалась как набор
				// горизонтальных полос. Теперь величины независимые, и косяк
				// может быть низко и близко или высоко и далеко.
				var p = i % 5;
				var z = ((i * 2 + Math.floor(i / 5)) % 3) / 2;
				// УЗЕЛ ВИДИМОСТИ. Замер по плоскостям давал произведение
				// прозрачности и яркости от 0,66 на верхней до 0,18 на нижней,
				// да ещё под размывкой почти в два пикселя на теле длиной
				// двадцать пять. На тёмной воде это фон, а не далёкая рыба.
				// Просили приглушить по глубине — приглушили за пределы
				// различимости.
				//
				// Теперь произведение от 0,96 до 0,45: градация осталась и вдвое
				// короче прежней по размаху, но нижний край различим.
				// Верхняя граница 0,9, а не 0,96: на самой верхней плоскости
				// светлый корпус уходит в цвет блика, и тёмный контур перестаёт
				// быть тёмным. Приглушение по глубине осталось.
				var dim = (1 - 0.06 * p) * (1 - 0.15 * z) * 0.94;
				// Размывка урезана с 2,2 до 1,1 пикселя: на двадцатипиксельной
				// рыбе это ещё размытие, дальше — размазывание.
				var soft = z * 0.6 + p * 0.12;
				return {
					y: 130 + p * 128,
					z: z,
					scale: 1.18 - p * 0.15,
					alpha: round((0.96 - p * 0.045) * (1 - 0.1 * z)),
					amp: 120 + p * 22,
					wave: 1.4 + p * 0.5,
					back: i % 2 === 1,
					filter: "filter:brightness(" + round(dim * 100) / 100 + ")" +
						(soft > 0.12 ? " blur(" + round(soft * 10) / 10 + "px)" : "")
				};
			}

			/**
			 * Дорожка косяка: пологая волна через весь кадр.
			 *
			 * В точке, где волна меняет наклон, касательная горизонтальна —
			 * поэтому ручки кубических сегментов симметричны и направление
			 * меняется плавно, без угла.
			 *
			 * @param {string} id - идентификатор пути.
			 * @param {number} y - средняя высота.
			 * @param {number} amp - размах волны.
			 * @param {number} wave - число полуволн.
			 * @param {boolean} back - идти справа налево.
			 * @returns {string} путь для defs.
			 */
			function swimPath(id, y, amp, wave, back) {
				// Встречная дорожка строится справа налево: animateMotion
				// развернёт рыбу по ходу, и косяк пойдёт в другую сторону без
				// зеркала и без отрицательного масштаба.
				var x0 = back ? 2000 : -400;
				var x1 = back ? -400 : 2000;
				var stepX = (x1 - x0) / wave;
				// Ручки на 0,42 шага, а не на 0,55: при 0,55 точки перегиба
				// получались острыми и поворот читался как ломаная. При 0,42 дуга
				// распрямляется и курс меняется без рывка — это и есть инерция.
				var h = stepX * 0.42;
				// Медленный уход по вертикали на всём пути: косяк не только идёт
				// вверх-вниз, но и постепенно смещается к другому слою воды.
				var drift = 70 + rnd() * 90;
				var d = "M" + round(x0) + " " + round(y - drift * 0.5);
				var done = 0;
				for (var i = 0; done < wave; i++) {
					var xa = x0 + done * stepX;
					var xb = xa + stepX;
					var dy = -drift * 0.5 + drift * (done / wave);
					var ya = y + dy + (i % 2 === 0 ? -amp : amp);
					var yb = y + dy + (i % 2 === 0 ? amp : -amp);
					d += "C" + round(xa + h) + " " + round(ya) + " " + round(xb - h) + " " +
						round(yb) + " " + round(xb) + " " + round(yb);
					done += 1;
				}
				return "<path id='" + id + "' d='" + d + "'/>";
			}

			/**
			 * Собственный наклон особи к курсу, градусы.
			 *
			 * Нос у всех силуэтов в +x, и `rotate="auto"` ставит эту ось по
			 * касательной пути. Наклон сверху — небольшое личное отклонение,
			 * не разворот: у края строя оно сильнее, потому что рыба в стае
			 * доворачивает позже косяка. Предел жёсткий, 14 градусов, —
			 * при большем наклоне рыба читается как плывущая боком.
			 *
			 * @param {number} row - номер ряда от вожака.
			 * @returns {number} градусы.
			 */
			function turnOf(row) {
				// Узкий передний конус. Рыба, повёрнутая на 80 градусов, — это
				// рыба, идущая боком, и именно она читалась как «хвостом вперёд».
				// Дальше от вожака доворачивает сильнее, но нос остаётся в
				// передней полусфере, и косяк не разваливается.
				var spread = 5 + row * 2.2;
				var base = (rnd() - 0.5) * 2 * spread;
				// Страховка от будущих правок: нос никогда не встаёт за корму.
				return Math.max(-14, Math.min(14, base));
			}

			var FISH = ["FA", "FB", "FC", "FD", "FE", "FF", "FG"];

// Шесть видов вместо четырёх: в референсе силуэтов заметно больше, и при
// четырёх весь косяк состоял из двух узнаваемых форм.
			// Десять косяков вместо шести: шесть на кадре 1600×900 оставляли
			// половину пустой, и живность читалась полосами от краёв.
			var schools = Math.max(1, Math.round(10 * run.density));
			s.push('<defs>');
			// Размер косяка считается здесь, один раз, и передаётся и дорожке,
			// и особям. Иначе число случайных выборов в построителе разошлось
			// бы с числом особей, и дорожка не совпала бы с косяком.
			//
			// Крупная рыба держит курс дольше: на дорожке меньше полуволн,
			// значит поворот растянут, и сама дорожка проходится медленнее.
			var schSize = [];
			var schGrow = [];
			for (var pd = 0; pd < schools; pd++) {
				var pa = plane(pd);
				var psz = (0.13 + rnd() * 0.08) * pa.scale * (1 - 0.42 * pa.z);
				var pgw = Math.max(0, Math.min(1, (psz - 0.05) / 0.19));
				schSize[pd] = psz;
				schGrow[pd] = pgw;
				s.push(swimPath("sp" + pd, pa.y + rnd() * 30, pa.amp + rnd() * 60,
					(pa.wave + rnd() * 1.4) * (1 - 0.3 * pgw), pa.back));
			}
			s.push('</defs>');

			for (var sk = 0; sk < schools; sk++) {
				var kind = FISH[sk % 7];
				var pl = plane(sk);
				// Рыба уменьшена до фонового размера: 18–30 единиц, то есть
				// 22–36 пикселей на экране. Плоскость масштабирует ещё и его.
				// Размер падает с расстоянием: дальний косяк мельче. Плоскость
				// масштабирует ещё и по глубине.
				var size = schSize[sk];
				var grow = schGrow[sk];
				// Максимальная скорость вдвое ниже прежней: у самой мелкой рыбы
				// время перехода выходит около ста двадцати секунд против
				// шестидесяти. Зависимость от расстояния смягчена с 1,6 до 0,5 —
				// иначе дальний косяк уходил бы за семь минут на проход.
				var course = (dur(size, 1) + rnd() * 5) * 3.6 * (1 + 0.5 * pl.z);
				var count = 8 + Math.floor(rnd() * 5);
				// Скорость дорожки нужна, чтобы перевести отставание в единицы:
				// задержка в секундах — это расстояние, делённое на скорость.
				var pace = 2400 / course;
				// Клин по первому листу референса: впереди крупный вожак, к хвоста
				// кли�� расширяется, и рыба в нём мельче. Прежняя была жёсткой
				// решёткой три в ряд с равными размерами и читалась как схема.
				for (var m = 0; m < count; m++) {
					var row = Math.floor(m / 3);
					var col = m % 3;
					// Шаг назад растёт вместе с поперечным разбросом: клин, а не
					// колонна. И к хвоста клина рыба мельче на семь процентов в ряду.
					var along = row * (24 + row * 4);
					var spread = 10 + row * 4.5;
					var across = (col - 1) * spread + (rnd() - 0.5) * 4;
					var shrink = (1 - row * 0.07) * (m === 0 ? 1.34 : 1);
					s.push(school(
						kind,
						"sp" + sk,
						course,
						// Фаза случайная и равномерная, а не ступенька по номеру:
						// иначе стаи вставали на дорожках друг за другом и в одном
						// месте оказывались две сразу.
						rnd() * course + along / pace + rnd() * 0.04,
						size * shrink * (0.92 + rnd() * 0.16),
						across,
						pl.alpha,
						sk % 5,
						// Крупная рыба почти не отклоняется от дорожки: инерция.
						turnOf(row) * (1 - 0.45 * grow),
						pl.filter
					));
				}
			}

			// ── крупное и моллюски: средний и нижний слои ──
			// Крупные тела снова крупные. Уменьшение в 15 раз, а потом ещё вчетверо
	// сработало и против них: кит стал 75–111 пикселей, дельфин с кальмаром —
	// 5–8, и ниже десяти пикселей силуэт не читается вовсе. Взята середина
	// между прежним и теперешним: кит 300–450 пикселей, то есть в десять
	// с лишним раз больше мелкой рыбы. Мелкая рыба и медузы не тронуты.
	//
	// Все тела уменьшены ещё вчетверо поверх уменьшения в 15 раз. Дельфин,
			// мелкая рыба и кальмар теперь 5–9 пикселей: ниже десяти силуэт уже
			// не читается, это точки. Киты, акулы, манты и медузы узнаваемы.
			//
			// Крупные тела уменьшены в 15 раз: кит 63–93 единицы, акула 37–59,
			// манта 34–48, дельфин 18–27, кальмар 15–23. Мелкая рыба после этого —
			// 18–30 единиц, то есть дельфин с кальмаром сравнялись с ней, а кит
			// стал примерно втрое больше. Размер больше не выражает дистанцию:
			// «крупное» отличается от «мелкого» только силуэтом.
			var sharkN = Math.round(3 * run.density);
			for (var h = 0; h < sharkN; h++) {
				s.push(swim(h % 3 === 0 ? "SB" : "SA", 120 + rnd() * 1360, 300 + rnd() * 280, 0.3 + rnd() * 0.17, rnd() * 140, rnd() < 0.5 ? 1 : -1, 1.15));
			}
			var dolphN = Math.round(4 * run.density);
			for (var dp = 0; dp < dolphN; dp++) {
				s.push(swim("DA", 120 + rnd() * 1360, 250 + rnd() * 260, 0.27 + rnd() * 0.13, rnd() * 150, rnd() < 0.5 ? 1 : -1, 0.6));
			}
			var squidN = Math.round(3 * run.density);
			for (var sq = 0; sq < squidN; sq++) {
				s.push(swim("SQ", 120 + rnd() * 1360, 420 + rnd() * 260, 0.2 + rnd() * 0.1, rnd() * 150, rnd() < 0.5 ? 1 : -1, 0.85));
			}
			// По одному каждого вида: три одинаковых силуэта читались как три
			// одинаковых ковра, а три разных вида показывают, что океан населён.
			// Свой коэффициент у каждого вида: силуэты разной длины, и при
			// общем трёхкратном уменьшении длинный синий вышел бы вдвое
			// крупнее короткой косатки. Здесь все три держатся 60–90 пикселей.
			var whaleN = Math.round(3 * run.density);
			for (var wl = 0; wl < whaleN; wl++) {
				var wr = [0.2 + rnd() * 0.06, 0.25 + rnd() * 0.07, 0.3 + rnd() * 0.08][wl % 3];
				s.push(swim(["WA", "WB", "WC"][wl % 3], 120 + rnd() * 1360, 430 + rnd() * 340, wr, rnd() * 150, rnd() < 0.5 ? 1 : -1, 1.1));
			}
			var rayN = Math.round(2 * run.density);
			for (var ry = 0; ry < rayN; ry++) {
				var rp = [120 + rnd() * 1360, 620 + rnd() * 190];
				var rr = 0.23 + rnd() * 0.13;
				var rdir = rnd() < 0.5 ? 1 : -1;
								s.push("<g opacity='" + op(rp[0], rp[1]) + "'><g class='" +
					(rdir > 0 ? "ln" : "lnr") + "' style='animation-duration:" + dur(rr, 2.3) + "s;animation-delay:-" + round(rnd() * 150) + "s'>" +
					"<g transform='translate(" + round(rp[0]) + "," + round(rp[1]) + ") scale(" + (rdir > 0 ? rr : -rr) + "," + rr + ")'>" +
					"<g class='wf' style='animation-duration:" + round(4 + rnd() * 3) + "s;animation-delay:-" + round(rnd() * 4) + "s'>" +
					"<use xlink:href='#RA'/></g></g></g></g>");
			}

			s.push("<rect width='1600' height='900' fill='url(#sc)'/>");
			s.push("<rect width='1600' height='900' fill='url(#vg)'/>");
			s.push("<rect width='1600' height='900' fill='url(#fl)'/>");
			s.push("</svg>");
			return s.join("");
		}

/** Собственные стили плагина: верхний слой воды и панель настроек. */
		var PLUGIN_CSS =
			".dsh-ocean-surface{position:fixed;inset:0;width:100%;height:100%;display:block;pointer-events:none;z-index:0;}" +
			".dsh-ocean-panel{display:flex;flex-direction:column;gap:10px;min-width:260px;}" +
			".dsh-ocean-row{display:flex;align-items:center;gap:10px;font-size:12px;line-height:1.4;}" +
			".dsh-ocean-name{flex:0 0 128px;color:var(--dsw-alias-label-primary);}" +
			".dsh-ocean-track{flex:1 1 auto;display:flex;align-items:center;gap:8px;min-width:0;}" +
			".dsh-ocean-panel input[type=range]{flex:1 1 auto;min-width:0;accent-color:var(--dsw-alias-brand-primary);}" +
			".dsh-ocean-panel input[type=checkbox]{accent-color:var(--dsw-alias-brand-primary);width:15px;height:15px;}" +
			".dsh-ocean-value{flex:0 0 40px;text-align:right;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;}" +
			".dsh-ocean-mode{color:var(--dsw-alias-label-secondary);}"
			;

		/**
		 * Верхний слой: возмущение воды от курсора и мелкая рыбёшка.
		 *
		 * Сцена живёт под интерфейсом, а возмущение воды по определению происходит
		 * на поверхности — поэтому след и мелочь рисуются здесь. Отвечает только
		 * за реакцию, сцену не дублирует.
		 *
		 * ВОДА, А НЕ КРУГИ. Расходящихся колец здесь нет намеренно: концентрические
		 * окружности читаются как графический примитив, а не как движение воды.
		 * Вместо них — гребни. След от курсора раздваивается по форме Кильвина,
		 * позади тянется мелкая завихрённость, по клику в стороны расходятся
		 * короткие ломаные волны. Ни одна линия здесь не замкнута в кольцо.
		 * @returns {object} элемент React.
		 */
		function Surface(props) {
			var run = props.run;
			var host = React.useState(null);
			var node = host[0];
			var setNode = host[1];

			React.useEffect(function () {
				if (node === null) return;
				var doc = node.ownerDocument;
				if (doc === null || doc === undefined) return;
				var view = doc.defaultView;
				var dpr = view && typeof view.devicePixelRatio === "number" ? view.devicePixelRatio : 1;
				var g = node.getContext("2d");
				if (g === null) return;

				var DT = 1 / 30;
				var LIFE = 2.6;
				var T = 0;
				var W = 0;
				var H = 0;

				function resize() {
					var rect = node.getBoundingClientRect();
					W = rect.width || (view && view.innerWidth) || 1280;
					H = rect.height || (view && view.innerHeight) || 800;
					var scale = Math.max(0.4, Math.min(dpr, 1.25, 1600 / Math.max(1, W)));
					node.width = Math.max(1, Math.round(W * scale));
					node.height = Math.max(1, Math.round(H * scale));
					g.setTransform(scale, 0, 0, scale, 0, 0);
				}
				resize();
				var onResize = function () { resize(); };
				if (view) view.addEventListener("resize", onResize);

				var seed = 771103;
				function rnd() {
					seed = (seed * 1664525 + 1013904223) % 4294967296;
					return seed / 4294967296;
				}

				var darters = [];
				for (var i = 0; i < 16; i++) {
					darters.push({
						x: rnd() * W, y: rnd() * H, a: rnd() * 6.283,
						sp: 10 + rnd() * 15, cur: 12, r: 3.5 + rnd() * 4.5,
						ph: rnd() * 7, alarm: 0
					});
				}

				/**
				 * Возмущения воды. След ориентированный: в нём есть `a` — направление
				 * движения. Всплеск от клика без направления, лучи расходятся в стороны.
				 * @type {Array<{x:number,y:number,a:number,t0:number,s:number,burst:boolean,ph:number}>}
				 */
				// Расходящихся кругов больше нет: осталась только реакция рыбы.
	// Пена: мелкие пузырьки, которые вода поднимает за курсором.
	// @type {Array<{x:number,y:number,r:number,age:number,ph:number}>}
	// След от курсора: короткие открытые гребни, а не кольца.
	var wakes = [];
	var froth = [];
				var pool = { x: 0, y: 0, a: 0 };
				var px = -9999;
				var py = -9999;
				var lastX = -9999;
				var lastY = -9999;
				var lastT = -9;
				var lastA = 0;
				var primed = false;

				function angDiff(to, from) {
					var d = (to - from) % 6.283;
					if (d > 3.14159) d -= 6.283;
					if (d < -3.14159) d += 6.283;
					return d
				}

				/**
				 * Краска слоя для текущей палитры. В светлой теме гребни тёмные:
				 * светлые по светлому стеклу не видны нигде, кроме как над текстом —
				 * ровно тот случай, когда эффект нужен меньше всего.
				 * @returns {object} краска.
				 */
				function ink() {
					return run.scheme === "light"
						? { crest: "rgba(6,64,86,0.44)", crestLit: "rgba(255,255,255,0.8)", body: "#04364d", glow: "rgba(255,255,255,0.85)" }
						: { crest: "rgba(196,244,252,0.58)", crestLit: "rgba(255,255,255,0.45)", body: "#a9e9f7", glow: "rgba(150,232,248,0.34)" };
				}

				/**
				 * Один гребень: ломаная волна, уходящая из точки в направлении `ang`,
				 * с боковым размахом `amp`, который гаснет к концу.
				 *
				 * Вертикаль сжата в 0.55 раза: кадр смотрится чуть сверху, и без
				 * сжатия след расползается по горизонтали и теряет направление.
				 * @returns {void}
				 */
				/**
				 * Круговое возмущение от мыши: расходящиеся кольца на воде.
				 *
				 * Кольца намеренно небольшие и быстрые. Те, что пришлось удалить
				 * в прошлый раз, доходили до 270 единиц радиуса и держались, пока
				 * курсор стоит на месте, — отсюда и было «огромные кольца». Здесь
				 * радиус не превышает сотни единиц, заливки под курсором нет вовсе,
				 * а прозрачность втрое тиже прежней. Кольцо есть, но оно не
				 * перекрывает текст и не спорит с океаном.
				 *
				 * @param {object} n - запись следа.
				 * @param {number} age - возраст в секундах.
				 * @param {number} fade - затухание 0..1.
				 * @param {object} K - краска слоя.
				 * @param {number} power - сила возмущения.
				 * @returns {void}
				 */
				function drawRipple(n, age, fade, K, power) {
					var strength = n.s;
					// Круг расширяется медленно: за две с половиной секунды жизни
					// радиус доходит примерно до сотни единиц, то есть до 120
					// пикселей. Прежние доходили до 270 и держались, пока курсор стоит.
					var reach = 30 * strength;
					var base = 5 + age * 4;
					var rings = n.burst ? 3 : 2;
					// Втрое тише прежних колец и вдвое тише волн, которые заменили.
					var alpha = Math.max(0, fade * strength * 0.1 * power);
					if (alpha <= 0.0015) return;
					g.strokeStyle = K.crestLit;
					g.lineCap = "round";
					for (var k = 0; k < rings; k++) {
						var u = k / rings;
						var rad = base + u * 14 + age * reach;
						// Неровный край: настоящая рябь не бывает идеально круглой.
						// По вертикали круг сплюснут: кадр смотрится чуть сверху.
						g.lineWidth = Math.max(0.5, (1.1 - u * 0.3) * fade);
						g.globalAlpha = Math.max(0, alpha * (1 - u * 0.45));
						g.beginPath();
						for (var t = 0; t <= 40; t++) {
							var th = (t / 40) * 6.283;
							var wob = 1 + 0.05 * Math.sin(th * 3 + n.ph) +
								0.03 * Math.sin(th * 5 - n.ph * 1.3 + age * 1.8);
							var x = n.x + Math.cos(th) * rad * wob;
							var y = n.y + Math.sin(th) * rad * wob * 0.62;
							if (t === 0) g.moveTo(x, y);
							else g.lineTo(x, y);
						}
						g.closePath();
						g.stroke();
					}
				}

				function crest(x, y, ang, len, amp, freq, phase, alpha, width) {
					if (alpha <= 0.004) return;
					g.beginPath();
					var N = 22;
					for (var i = 0; i <= N; i++) {
						var u = i / N;
						var d = u * len;
						var off = Math.sin(u * freq - phase) * amp * (1 - u * 0.3);
						var ca = Math.cos(ang);
						var sa = Math.sin(ang);
						var cx = x + ca * d - sa * off;
						var cy = y + (sa * d + ca * off) * 0.55;
						if (i === 0) g.moveTo(cx, cy);
						else g.lineTo(cx, cy);
					}
					g.lineWidth = width;
					g.globalAlpha = alpha;
					g.stroke();
				}

				/**
				 * Отрисовать одно возмущение.
				 * @param {object} n - запись возмущения.
				 * @param {number} age - возраст в секундах.
				 * @param {number} fade - затухание 0..1.
				 * @param {object} K - краска слоя.
				 * @param {number} power - сила волн, отдельно от общей силы темы.
				 * @returns {void}
				 */


				/**
				 * Мелкая рыбёшка у самой поверхности.
				 * @returns {void}
				 */
				function drawFish(d, alpha) {
					var r = d.r;
					g.save();
					g.translate(d.x, d.y);
					g.rotate(d.a);
					g.globalAlpha = alpha;
					g.fillStyle = ink().body;
					g.beginPath();
					g.ellipse(0, 0, r * 1.3, r * 0.5, 0, 0, 6.283);
					g.fill();
					g.beginPath();
					g.moveTo(-r * 1.15, 0);
					g.lineTo(-r * 2.2, -r * 0.62);
					g.lineTo(-r * 2.2, r * 0.62);
					g.closePath();
					g.fill();
					g.beginPath();
					g.moveTo(-r * 0.1, -r * 0.4);
					g.lineTo(r * 0.35, -r * 1.05);
					g.lineTo(r * 0.75, -r * 0.3);
					g.closePath();
					g.fill();
					g.restore();
				}

				/**
				 * Один кадр верхнего слоя.
				 * @returns {void}
				 */
				function frame() {
					T += DT;
					if (doc.visibilityState === "hidden") return;
					g.clearRect(0, 0, W, H);
					if (!run.enabled) {
						g.globalAlpha = 1;
						return;
					}

					var power = 0.55 + 0.7 * run.tint;
					// Огромных кругов под курсором больше нет. Вздутие и расходящиеся
					// кольца вырезаны: первое держалось, пока курсор стоит, и перекрывало
					// текст, второе доходило до краёв кадра. Из реакции на курсор осталось
					// только то, что не круг по форме: рыбёшка разбегается и пена.
					// След идёт по всему пути мыши и перекрывает текст, поэтому волны
					// гасятся вчетверо против общей силы: гребни должны читаться как
					// движение воды, а не как светящийся след.
					var surge = power * 0.09;
					var K = ink();
					// Кольца от курсора: небольшие, быстрые и тихие.
					for (var i = wakes.length - 1; i >= 0; i--) {
						var n = wakes[i];
						var age = T - n.t0;
						if (age > LIFE) {
							wakes.splice(i, 1);
							continue;
						}
						var k = 1 - age / LIFE;
						drawRipple(n, age, k * k * (3 - 2 * k), K, power);
					}


					g.lineCap = "round";

for (var fb = froth.length - 1; fb >= 0; fb--) {
						var f0 = froth[fb];
						f0.age += DT;
						// Верхний предел — только страховка на случай, если курсор
						// окажется у самого верха. Дальше решает поверхность.
						if (f0.age > 9) { froth.splice(fb, 1); continue; }
						// Дошёл до воды: лопается плоским кольцом, расползающимся
						// по поверхности за полсекунды.
						if (f0.pop === undefined) {
							f0.y -= (16 + f0.r * 15) * DT;
							if (f0.y <= 3) { f0.y = 3; f0.pop = 0; }
						} else {
							f0.pop += DT;
							if (f0.pop > 0.5) { froth.splice(fb, 1); continue; }
							g.strokeStyle = K.crestLit;
							g.lineWidth = 0.7 * (1 - f0.pop / 0.5);
							g.globalAlpha = Math.max(0, (1 - f0.pop / 0.5) * 0.3 * power);
							g.beginPath();
							g.ellipse(f0.x, 2, 3 + f0.pop * 26, 0.8 + f0.pop * 4, 0, 0, 6.283);
							g.stroke();
							g.globalAlpha = 1;
							continue;
						}
						var fx0 = f0.x + Math.sin(f0.age * 2.2 + f0.ph) * 5;
						// На подъёме пузырь растёт: давление падает, и к
						// поверхности он доходит крупнее, чем оторвался.
						var fr0 = f0.r * (1 + Math.min(0.7, (860 - f0.y) / 2600));
						var fd0 = Math.min(1, f0.age * 3.5) * Math.min(1, (900 - f0.y) / 120);
						g.strokeStyle = K.crestLit;
						g.lineWidth = 0.7;
						g.globalAlpha = Math.max(0, fd0 * 0.32 * power);
						g.beginPath();
						g.arc(fx0, f0.y, fr0, 0, 6.283);
						g.stroke();
						// Блик: одна дуга у верхнего края. Без неё пузырь
						// читается как окружность, а с ней — как пузырь.
						g.globalAlpha = Math.max(0, fd0 * 0.4 * power);
						g.beginPath();
						g.arc(fx0 - fr0 * 0.3, f0.y - fr0 * 0.3, fr0 * 0.45, 3.6, 5.1);
						g.stroke();
}

					g.globalAlpha = 1;
					for (var d = 0; d < darters.length; d++) {
						var f = darters[d];
						f.alarm = Math.max(0, f.alarm - DT);
						if (f.alarm > 0) {
							var dx = f.x - px;
							var dy = f.y - py;
							var dist = Math.sqrt(dx * dx + dy * dy);
							if (dist > 0.5 && dist < 360) f.a += angDiff(Math.atan2(dy, dx), f.a) * Math.min(1, DT * 3.4);
						} else {
							f.a += Math.sin(T * 0.35 + f.ph) * DT * 0.55;
						}
						var want = f.sp * (1 + 3.2 * (f.alarm / 1.5));
						f.cur += (want - f.cur) * Math.min(1, DT * 2.4);
						f.x += Math.cos(f.a) * f.cur * DT;
						f.y += Math.sin(f.a) * f.cur * DT;
						if (f.x < -50) d.x = W + 50;
						if (d.x > W + 50) d.x = -50;
						if (d.y < -50) d.y = H + 50;
						if (d.y > H + 50) d.y = -50;
						drawFish(f, (0.2 + 0.6 * (f.alarm / 1.5)) * power);
					}
					g.globalAlpha = 1;
				}

				/**
				 * Оставить возмущение в воде.
				 * @returns {void}
				 */
				/**
				 * Оставить возмущение в воде.
				 *
				 * @param {number} x - координата.
				 * @param {number} y - координата.
				 * @param {number} a - угол движения курсора.
				 * @param {number} s - сила, по скорости движения.
				 * @param {boolean} burst - признак клика.
				 * @returns {void}
				 */
				function disturb(x, y, a, s, burst) {
					var strength = Math.min(1, s);
					if (strength < 0.08) return;
					wakes.push({ x: x, y: y, a: a, t0: T, s: strength, burst: burst === true, ph: T * 11.3 });
					if (wakes.length > 40) wakes.splice(0, wakes.length - 40);
				}

				/**
				 * След, а не набор всплесков: между прошлой и текущей точкой
				 * рассыпается гребень за гребнем, и сила каждого растёт со
				 * скоростью движения мыши.
				 * @returns {void}
				 */
				function onMove(event) {
					if (!run.enabled) return;
					var x = event.clientX;
					var y = event.clientY;
					px = x;
					py = y;
					if (!primed) {
						lastX = x;
						lastY = y;
						lastT = T;
						primed = true;
						return;
					}
					var dx = x - lastX;
					var dy = y - lastY;
					var dist = Math.sqrt(dx * dx + dy * dy);
					if (dist < 2) return;
					var gap = Math.max(0.006, T - lastT);
					var s = Math.min(1, 0.2 + (dist / gap) / 48);
					var steps = Math.min(10, Math.max(1, Math.round(dist / 16)));
					for (var k = 1; k <= steps; k++) {
						var u = k / steps;
						disturb(lastX + dx * u, lastY + dy * u, lastA, s * (0.35 + 0.65 * u), false);
					}
					if (froth.length < 70) {
	for (var fo = 0; fo < 3; fo++) {
		froth.push({ x: x + (rnd() - 0.5) * 14, y: y + 6 + rnd() * 10, r: 0.6 + rnd() * 1.4, age: 0, ph: rnd() * 7 });
	}
}
lastA = Math.atan2(dy, dx);
					pool.x = x;
					pool.y = y;
					pool.a = lastA;
					pool.t0 = T;
					for (var i = 0; i < darters.length; i++) {
						var d = darters[i];
						var ax = d.x - x;
						var ay = d.y - y;
						var dd = ax * ax + ay * ay;
						if (dd < 129600) {
							var level = 0.6 + (1 - Math.sqrt(dd) / 360) * 0.9;
							if (level > d.alarm) d.alarm = level;
						}
					}
					lastX = x;
					lastY = y;
					lastT = T;
				}

				/**
				 * Клик: всплеск во все стороны — тоже гребнями, не кольцом.
				 * @returns {void}
				 */
				function onDown(event) {
					if (!run.enabled) return;
					px = event.clientX;
					py = event.clientY;
					disturb(px, py, lastA, 1, true);
					pool.x = px;
					pool.y = py;
					pool.a = lastA;
					pool.t0 = T;
					for (var i = 0; i < darters.length; i++) {
						var d = darters[i];
						var ax = d.x - px;
						var ay = d.y - py;
						if (ax * ax + ay * ay < 144400) d.alarm = 1.5;
					}
				}

				doc.addEventListener("pointermove", onMove, { passive: true });
				doc.addEventListener("pointerdown", onDown, { passive: true });
				// Здесь обычный браузерный бандл, а не динамический пакет: глобальные
				// доступны, и кадры ведёт requestAnimationFrame — он же синхронизирован
				// с перерисовкой окна, в отличие от таймера с фиксированным шагом.
				var handle = globalThis.requestAnimationFrame(function step() {
					frame();
					handle = globalThis.requestAnimationFrame(step);
				});
				return function () {
					globalThis.cancelAnimationFrame(handle);
					doc.removeEventListener("pointermove", onMove);
					doc.removeEventListener("pointerdown", onDown);
					if (view) view.removeEventListener("resize", onResize);
				};
			}, [node]);

			return React.createElement("canvas", {
				ref: setNode,
				className: "dsh-ocean-surface",
				"aria-hidden": "true"
			});
		}

		/** Панель темы в общих настройках: выключатель и два ползунка. */
		function Controls(props) {
			var run = props.run;
			var saved = React.useState(0);
			var refresh = saved[1];
			/**
			 * Один ползунок панели.
			 * @returns {object} элемент React.
			 */
			function slider(label, value, min, max, onChange) {
				return React.createElement("label", { className: "dsh-ocean-row", key: label },
					React.createElement("span", { className: "dsh-ocean-name" }, label),
					React.createElement("span", { className: "dsh-ocean-track" },
						React.createElement("input", {
							type: "range",
							min: String(min),
							max: String(max),
							step: "5",
							value: String(value),
							onChange: function (event) {
								onChange(Number(event.target.value));
								props.persist();
								props.requestRepaint();
								refresh(function (n) { return n + 1; });
							}
						})
					),
					React.createElement("span", { className: "dsh-ocean-value" }, value + "%")
				);
			}
			return React.createElement("div", { className: "dsh-ocean-panel" },
				React.createElement("label", { className: "dsh-ocean-row" },
					React.createElement("span", { className: "dsh-ocean-name" }, "Океан"),
					React.createElement("span", { className: "dsh-ocean-track" },
						React.createElement("input", {
							type: "checkbox",
							checked: run.enabled,
							onChange: function (event) {
								run.enabled = Boolean(event.target.checked);
								props.persist();
								props.requestRepaint();
								refresh(function (n) { return n + 1; });
							}
						})
					),
					React.createElement("span", { className: "dsh-ocean-value" }, run.enabled ? "вкл" : "выкл")
				),
				slider("Плотность жизни", Math.round(run.density * 100), 0, 100, function (v) { run.density = v / 100; }),
				slider("Яркость воды", Math.round(run.tint * 100), 20, 100, function (v) { run.tint = v / 100; }),
				React.createElement("div", { className: "dsh-ocean-row" },
					React.createElement("span", { className: "dsh-ocean-name dsh-ocean-mode" }, "Палитра"),
					React.createElement("span", { className: "dsh-ocean-track dsh-ocean-mode" },
						run.scheme === "light" ? "мелкая, солнечная" : "глубина, ночная")
				),
					React.createElement("div", { className: "dsh-ocean-row" },
						React.createElement("span", { className: "dsh-ocean-name dsh-ocean-mode" }, "Сборка"),
						React.createElement("span", { className: "dsh-ocean-track dsh-ocean-mode" }, "v61: голова молота вытянута, шия и широкая перекладина")
				)
			);
		}

		/**
		 * Поднять тему: токены, фон документа, верхний слой и панель настроек.
		 * @param {object} ctx - контекст клиентского плагина.
		 * @returns {void}
		 */
		function apply(ctx) {
			// Тема не зависит ни от одного сервиса: сцена и токены поднимаются всегда,
			// а слоты — только если браузерная оболочка их уже объявила.
			var theme = ctx.get("theme");

			var prefs = loadPrefs();
			// Настройки приходят из localStorage сырыми. Раньше отсюда бралось
			// `enabled: false` как есть, и одна стылая запись выключала тему
			// навсегда — снаружи это неотличимо от «плагин сломался». Поэтому
			// значения зажимаются, а выключение вынесено в отдельное поле,
			// которым управляет только панель.
			var storedOff = prefs.turnedOff === true;
			var run = {
				enabled: !storedOff,
				density: clamp01(typeof prefs.density === "number" ? prefs.density : 1, 0.35, 1.6),
				tint: clamp01(typeof prefs.tint === "number" ? prefs.tint : 0.8, 0.2, 1),
				scheme: "dark"
			};
			if (theme !== undefined) {
				try {
					var snap = theme.getTheme();
					if (snap && snap.active && snap.active.colorScheme === "light") run.scheme = "light";
				} catch (error) {
					/* остаёмся на тёмной палитре */
				}
			}

			var repaint = null;
			var repaintTimer = null;

			/** Отложить пересборку сцены: ползунок не должен перерисовывать фон на каждый пиксель. */
			function requestRepaint() {
				if (repaintTimer) repaintTimer();
				if (repaint === null) return;
				repaintTimer = ctx.timeout(function () {
					repaintTimer = null;
					if (repaint) repaint();
				}, 150);
			}

			ctx.effect(function () {
				var dropTokens = null;
				var dropStyle = null;
				var dropLayer = null;
				var LAYER_CLASS = "dsh-ocean-layer";
				/**
				 * Слой картины.
				 *
				 * Отдельным элементом, а не фоном документа: оболочка кладёт
				 * непрозрачный фон на `#root`, и картинка на `html, body` оказывается
				 * за ним — плагин работает, а океана не видно. Слой с z-index -1
				 * внутри изолированного контекста body встаёт между фоном страницы
				 * и содержимым приложения.
				 *
				 * Слоя самого по себе мало: он виден, только если `#root` прозрачен,
				 * а прозрачность задаёт плагин — см. правила слоёв ниже. Пока этого
				 * не было, океан зависел от того, стеклянная ли сейчас тема
				 * оболочки, и пропадал после её обновления.
				 *
				 * @param {string} url - готовая ссылка на сцену.
				 * @param {object} page - документ.
				 * @returns {Function} снятие слоя.
				 */
				// Живой водолаз: холст внутри слоя и его состояние. Объявлено здесь,
				// а не внутри placeLayer, потому что к нему обращается и paint().
				var live = { node: null, stop: null, colors: null };

				function placeLayer(url, page) {
					// Слой переиспользуется, если он уже в документе: оболочка
					// пересобирает содержимое body, и прежняя версия добавляла
					// второй слой поверх, оставляя первый висеть навсегда.
					//
					// Ищем перебором, а не запросом по классу: слой всегда прямой
					// потомок body, обходить ровно один уровень, и код не зависит от
					// того, как оболочка реализует querySelector.
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
					// Холст добавляется один раз и переиспользуется при перерисовке:
					// оболочка пересобирает содержимое body, и второй холст поверх
					// первого означал бы вдвое больше работы и вдвое прозрачнее фон.
					if (el.firstChild === null) {
						live.node = page.createElement("canvas");
						live.node.className = "dsh-ocean-live";
						live.node.setAttribute("aria-hidden", "true");
						el.appendChild(live.node);
					}
					el.style.backgroundImage = url;
					return function () {
						if (el.parentNode) el.parentNode.removeChild(el);
					};
				}
				// ── живой водолаз ──
				//
				// Всё, что здесь, считается по кадрам: маршрут случайный, курс поворачивает
				// по направлению движения, конечности двигаются. Запечённая сцена этого
				// не умеет: у элемента один путь, и он повторяется.
				var PX = 57;
				var MAXD = 3;
				// Модуль не бросает наружу ни на чём. Любая неудача — нет getContext,
				// нулевые размеры, неожиданный хост — даёт освободитель, который
				// ничего не делает, и плагин продолжает жить без водолаза.
				function startLive(colors) {
					try {
					if (live.node === null || live.stop !== null) return;
					var cv = live.node;
					var gc = cv.getContext("2d");
					if (gc === null) return;
					var view = globalThis.document.defaultView;
					var C = colors;
					var lseed = 246813;
					function r() {
						lseed = (lseed * 1664525 + 1013904223) % 4294967296;
						return lseed / 4294967296;
					}
					var W = 0;
					var H = 0;
					function fit() {
						var dpr = view && typeof view.devicePixelRatio === "number" ? view.devicePixelRatio : 1;
						var box = cv.getBoundingClientRect();
						W = box.width || (view && view.innerWidth) || 1280;
						H = box.height || (view && view.innerHeight) || 800;
						cv.width = Math.max(1, Math.round(W * dpr));
						cv.height = Math.max(1, Math.round(H * dpr));
						gc.setTransform(dpr, 0, 0, dpr, 0, 0);
					}
					fit();
					if (view) view.addEventListener("resize", fit);
					// Очередь: в очереди водолаз ещё не выныривал и ждёт своего выхода.
					var q = [];
					for (var qi = 0; qi < MAXD; qi++) {
						q.push({ wait: 6 + r() * 90 });
					}
					var sw = [];
					var last = 0;
					function spawn() {
						return {
							x: -PX * 2.5,
							y: H * (0.22 + r() * 0.6),
							hd: 0,
							sp: PX * (0.8 + r() * 0.9),
							turn: (r() - 0.5) * 0.5,
							tx: 0,
							ty: 0,
							tleft: 0,
							ph: r() * 6.3,
							kick: 0.5 + r() * 0.5,
							up: 0,
							hdTo: 0,
							scale: 0.86 + r() * 0.28
						};
					}
					function limb(gc2, d, ang, ox, oy) {
						gc.save();
						gc.translate(ox, oy);
						gc.rotate(ang);
						gc.translate(-ox, -oy);
						gc.beginPath();
						gc.moveTo(d[0], d[1]);
						gc.bezierCurveTo(d[2], d[3], d[4], d[5], d[6], d[7]);
						gc.bezierCurveTo(d[8], d[9], d[10], d[11], d[0], d[1]);
						gc.fillStyle = C.body;
						gc.fill();
						gc.restore();
					}
					function one(gc2, d) {
						gc.beginPath();
						gc.moveTo(d[0], d[1]);
						gc.bezierCurveTo(d[2], d[3], d[4], d[5], d[6], d[7]);
						gc.bezierCurveTo(d[8], d[9], d[10], d[11], d[0], d[1]);
						gc.fillStyle = C.body;
						gc.fill();
					}
					function draw(dv) {
						var u = (PX * dv.scale) / 74;
						var k = Math.sin(dv.ph);
						gc.save();
						gc.translate(dv.x, dv.y);
						gc.rotate(dv.hd);
						gc.scale(u, u);
						limb(gc, [-16, 3.2, -20, 4.8, -23.4, 7.4, -25.6, 10.2, -23.6, 6.2, -20.6, 3.8, -17.4, 2.2], k * 5, 0, 0);
						limb(gc, [-16, 0.8, -21, 1.2, -26, 1.4, -32, 1.2, -26, 3.4, -21, 3.8, -16, 3.2], -k * 5, 0, 0);
						one(gc, [-2, 5.2, -8, 8.4, -15, 8.4, -19, 5.2, -15, 2.2, -8, 2.2, -2, 5.2]);
						gc.beginPath();
						gc.moveTo(-3, 4.4);
						gc.bezierCurveTo(-7, 6.6, -13, 6.8, -17, 5);
						gc.bezierCurveTo(-13, 2.8, -7, 2.8, -3, 4.4);
						gc.strokeStyle = C.rim;
						gc.globalAlpha = 0.5;
						gc.lineWidth = 0.7;
						gc.stroke();
						gc.globalAlpha = 1;
						limb(gc, [8, 2.6, 13, 3.6, 18, 2.8, 23, 0.4, 21, 4.6, 15, 6.2, 7, 5.4], Math.sin(dv.ph * 0.42) * 9, 0, 0);
						limb(gc, [6, 4.4, 4, 8.4, 0, 11.4, -5, 12.6, -2, 8.6, -0.4, 5, 0.6, 2.4], -Math.sin(dv.ph * 0.42) * 14, 0, 0);
						gc.beginPath();
						gc.moveTo(10, 0);
						gc.bezierCurveTo(10, 3.6, 4, 5.6, -4, 5.6);
						gc.bezierCurveTo(-11, 5.6, -15, 3.4, -18, 1.8);
						gc.bezierCurveTo(-15, -2, -11, -4.4, -4, -4.8);
						gc.bezierCurveTo(4, -5.2, 10, -3.2, 10, 0);
						gc.fillStyle = C.body;
						gc.fill();
						gc.strokeStyle = C.rim;
						gc.globalAlpha = 0.28;
						gc.lineWidth = 0.5;
						gc.stroke();
						gc.globalAlpha = 1;
						gc.save();
						gc.translate(13, -1);
						gc.rotate(Math.sin(dv.ph * 0.5) * 5);
						gc.beginPath();
						gc.arc(1, 0, 3.6, 0, 6.283);
						gc.fillStyle = C.body;
						gc.fill();
						gc.beginPath();
						gc.moveTo(-3, -2.4);
						gc.bezierCurveTo(-0.4, -3.6, 2.6, -3, 3.8, -1.2);
						gc.bezierCurveTo(1.6, -1.6, -0.8, -1.8, -3, -1.6);
						gc.fill();
						gc.beginPath();
						gc.ellipse(3.6, -0.4, 2.6, 2, 0, 0, 6.283);
						gc.fillStyle = C.rim;
						gc.fill();
						gc.restore();
						limb(gc, [-31, 0.6, -38, -0.2, -45, -0.4, -52, 0.4, -45, 2.6, -38, 3.6, -31, 3.2], k * 15, -31, 2);
						limb(gc, [-26, 9.6, -32, 12, -38, 15, -43, 18, -37, 16.4, -31, 14.2, -26, 12.4], -k * 15, -26, 11);
						for (var bi = 0; bi < 3; bi++) {
							var bt = (dv.ph * 0.5 + bi * 0.33) % 1;
							gc.beginPath();
							gc.arc(20 - bt * 16, -9 - bt * 64, 1.7 - bt * 0.7, 0, 6.283);
							gc.fillStyle = C.bub;
							gc.globalAlpha = 0.42 * (1 - bt);
							gc.fill();
						}
						gc.globalAlpha = 1;
						gc.restore();
					}
					function step2(now) {
						// Шаг ограничен сверху: после сворачивания окна первый кадр не должен
						// отыграть минуту хода разом.
						var DT = last === 0 ? 0.033 : Math.min(0.05, (now - last) / 1000);
						last = now;
						for (var i = sw.length - 1; i >= 0; i--) {
							var dv = sw[i];
							dv.ph += dtKick(dv) * DT;
							if (dv.up > 0) {
								dv.hd += (dv.hdTo - dv.hd) * Math.min(1, 1.4 * DT);
								dv.x += Math.cos(dv.hd) * dv.sp * DT;
								dv.y += Math.sin(dv.hd) * dv.sp * DT;
								if (dv.y < -PX * 2.5) {
									q.push({ wait: 30 + r() * 90 });
									sw.splice(i, 1);
									continue;
								}
								continue;
							}
							dv.tleft -= DT;
							if (dv.tleft <= 0) {
								dv.tx = PX * 2 + r() * Math.max(1, W - PX * 4);
								dv.ty = H * (0.12 + r() * 0.74);
								dv.tleft = 3.5 + r() * 5;
							}
							// Блуждание двумя синусами разной частоты плюс подтягивание к точке.
							var tx = Math.cos(dv.tx - dv.x);
							var ty = Math.sin(dv.tx - dv.y);
							var tl = Math.sqrt(tx * tx + ty * ty) || 1;
							var want = Math.atan2(ty / tl, tx / tl);
							var w1 = Math.sin(dv.ph * 0.31) * 0.5;
							var w2 = Math.sin(dv.ph * 0.77 + 1.7) * 0.28;
							dv.hd += (w1 + w2 + dv.turn) * DT;
							dv.hd += (want - dv.hd) * 0.5 * DT;
							// У краёв кадра курс мягко заворачивается внутрь.
							if (dv.x < PX * 2) dv.hd += 0.8 * DT;
							if (dv.x > W - PX * 2) dv.hd -= 0.8 * DT;
							if (dv.y < H * 0.1) dv.hd -= 0.5 * DT;
							if (dv.y > H * 0.88) dv.hd += 0.5 * DT;
							dv.x += Math.cos(dv.hd) * dv.sp * DT;
							dv.y += Math.sin(dv.hd) * dv.sp * DT;
							if (r() < 0.0006) {
								// Решил вынырнуть: курс заворачивает вверх-влево, дальше только
								// ведёт его вверх до самого края.
								dv.up = 1;
								dv.hdTo = -1.82;
							}
							draw(dv);
						}
						if (sw.length < MAXD) {
							for (var k2 = 0; k2 < q.length; k2++) {
								q[k2].wait -= DT;
								if (q[k2].wait <= 0) {
									var nd = spawn();
									sw.push(nd);
									q.splice(k2, 1);
									break;
								}
							}
						}
					}
					function dtKick(dv) {
						return 2.4 * dv.kick;
					}
					// Кадры считает requestAnimationFrame: он синхронизирован с перерисовкой
					// окна и сам останавливается, когда вкладка уходит в фон.
					var hnd = 0;
						// Считаем подряд идущие неудачи: иначе модуль крутился бы и сыпал
						// ошибку в каждом кадре, ничего не рисуя.
						var fails = 0;
					function loop(now) {
						try {
							step2(now);
							fails = 0;
						} catch (err) {
							fails += 1;
							if (fails >= 6) {
								// Стоим и пишем один раз: иначе крутились бы и сыпали ошибку
								// в каждом кадре, ничего не рисуя.
								console.error("[ocean] живой водолаз встал после шести неудачных кадров", err);
								globalThis.cancelAnimationFrame(hnd);
								return;
							}
						}
						hnd = globalThis.requestAnimationFrame(loop);
					}
					hnd = globalThis.requestAnimationFrame(loop);
					return function () {
						globalThis.cancelAnimationFrame(hnd);
						if (view) view.removeEventListener("resize", fit);
					};
					} catch (err) {
						console.error("[ocean] живой водолаз сломался", err);
						return function () {};
					}
				}

				function paint() {
					if (dropTokens) {
						dropTokens();
						dropTokens = null;
					}
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
					// цвета поверх друг друга.
					if (live.stop) {
						live.stop();
						live.stop = null;
					}					var scheme = SCHEMES[run.scheme === "light" ? "light" : "dark"];
					var url = 'url("data:image/svg+xml,' + encodeURIComponent(buildOcean(run)) + '")';
					var page = globalThis.document;
					// Цвет страницы ставится с !important: без него тема оболочки
				// перебивала его обычным правилом и подложка становилась светлой.
				dropStyle = insertStyle("document", "html,body{background-color:" + scheme.page + "!important}");
					if (page !== undefined && page.body !== undefined) {
						dropLayer = placeLayer(url, page);
					// Холст создан placeLayer в этом же вызове, и палитра берётся
					// та же, что и у сцены: на смене темы перерисовка идёт вся.
					// Необязательное последним и под защитой: живой водолаз не имеет
					// права уронить океан. Раньше исключение здесь обрывало
					// инициализацию, а с ней сторож и возврат фона — и океан
					// пропадал навсегда, а не до следующей перерисовки.
					if (live.node !== null) {
						try {
							live.stop = startLive(scheme);
						} catch (err) {
							console.error("[ocean] живой водолаз не запустился", err);
						}
					}
					} else {
						// Запасной путь: полотно на окно целиком, как и в слое. Иначе при
						// отказе слоя обрезка вернётся, и ватерлиня снова уедет за край.
dropStyle = insertStyle("document", "html,body{background-color:" + scheme.page + ";background-image:" + url + ";background-size:100% 100%;background-position:center center;background-repeat:no-repeat;background-attachment:fixed}");
					}
					if (theme !== undefined) {
						var flat = buildTokens(run.scheme === "light");
						var pair = {};
						for (var key in flat) pair[key] = { light: flat[key], dark: flat[key] };
						try {
							dropTokens = theme.overrideTokens("dsh-ocean-theme", pair);
						} catch (error) {
							console.error("[ocean] токены темы не применились", error);
						}
					}
				}
				repaint = paint;
				paint();
				// Сторож фона: при перезагрузке графа хост снимает наш блок стиля.
				// Пока плагин жив, возвращаем фон на место — иначе океан пропадает
				// до самого перезапуска DSH.
				var guard = setInterval(function () {
								if (dropLayer === null && dropStyle === null) return;
								var page = globalThis.document;
							if (page === undefined || typeof page.querySelector !== "function") return;
							if (page.querySelector('[' + CSS_ATTR + '="layer"]') !== null) return;
					if (page.querySelector('style[' + CSS_ATTR + '="document"]') !== null) return;
								paint();
				}, 2500);
				return function () {
					clearInterval(guard);
					if (live.stop) live.stop();
					live.stop = null;
					repaint = null;
					if (dropTokens) dropTokens();
					if (dropStyle) dropStyle();
					if (dropLayer) dropLayer();
				};
			});

			ctx.effect(function () {
				return insertStyle("plugin", PLUGIN_CSS);
			});

			// Порядок слоёв задаём явно: body создаёт контекст наложения,
			// картина встаёт под содержимым, а #root поднимается над ней.
			ctx.effect(function () {
				return insertStyle(
					"layer",
					// Прозрачность `#root` задаёт плагин, а не штатная тема оболочки.
					// Пока прозрачным её делала тема оболочки, океан был виден;
					// обновление оболочки сделало `#root` непрозрачным — и океан
					// пропал при живом плагине и зарегистрированных слотах: его
					// просто закрывали. `!important` перебивает любой неважный стиль
					// оболочки независимо от порядка вставки.
					//
					// Снимается только background-color, а не background целиком: иначе
					// пропали бы стеклянные градиенты панелей, ради которых тема и
					// затевалась. Прозрачной становится сплошная подложка, а
					// изображения и градиенты остаются.
					"body{position:relative;isolation:isolate}" +
					"html,body{background-color:transparent!important}" +
					"#root{position:relative;z-index:10;background-color:transparent!important}" +
					"#root>*{background-color:transparent!important}" +
					// Полотно растягивается ровно на окно, а не вписывается. Правило cover
// обрезает картинку по меньшему из размеров, и на окне шире 16:9 срезает
// верх и низ: ватерлиня (y=3) уезжает за край окна, всплески лопнувших
// пузырей не видно, и пузырь исчезает, не дойдя до воды. С полотном на
// всё окно ватерлиной становится верхний край, сцена видна целиком, и
// ни одно движущееся тело не пересекает невидимый срез.
// Правило собирается ОДНИМ куском. Оно склеено из двух строк, и
// вставка чего-либо между ними уводит объявления второго куска в
// конец следующего правила: слой остаётся без pointer-events:none и
// начинает перехватывать клики по всему экрану. Разрывать склейку
// здесь нечем.
".dsh-ocean-layer{position:fixed;inset:0;z-index:-1;" +
"background-size:100% 100%;background-position:center center;" +
"background-repeat:no-repeat;pointer-events:none}" +
// Живой холст лежит ВНУТРИ слоя, а не в накладке оболочки. Слой при
// z-index −1, значит и холст под интерфейсом. В накладке поверх
// панелей водолаз всплывал бы поверх окон.
".dsh-ocean-live{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}"
				);
			});

			if (theme !== undefined) {
				ctx.on("theme/change", function (snapshot) {
					var next = snapshot && snapshot.active && snapshot.active.colorScheme === "light" ? "light" : "dark";
					if (next !== run.scheme) {
						run.scheme = next;
						requestRepaint();
					}
				});
			}

			// Слотов в apply нет: `ctx.get("slots")` делал весь плагин реактивным
			// к появлению сервиса — и отсюда «океан появился, а потом исчезает»:
			// контекст протухал, эффекты снимались, и apply вызывался заново.
			// Теперь слоты ищет собственный эффект, и океан от их появления
			// не зависит. Раннего выхода нет: пока сервиса нет, эффект ничего
			// не делает и ждёт перезапуска, когда сервис появится.
			ctx.effect(function () {
				var slots = ctx.get("slots");
				if (slots === undefined || slots === null) return;
	// Регистрация слотов — единственное место, где клиентский код может
	// упасть уже после того, как фон вставлен. На пересборке графа слот может
	// быть занят, повторная регистрация с тем же id бросает исключение, а
	// исключение из apply уносит волокно вместе с фоном. Поэтому каждая
	// регистрация стоит в своём try: сбой панели не должен уносить океан.
try {
		slots.inject("shell.overlay", function () {
			return slots.register(
				{ name: "shell.overlay", id: "dsh-ocean", order: -100, label: "Океан" },
				function () {
					return React.createElement(Surface, { run: run });
				}
			);
		});
} catch (error) {
		console.error("[ocean] слой воды не зарегистрирован", error);
}

try {
		slots.inject("settings.general.item", function () {
			return slots.register(
				{ name: "settings.general.item", id: "dsh-ocean", order: 30, label: "Океан" },
				function () {
					return React.createElement(Controls, {
						run: run,
						persist: function () { savePrefs(run); },
						requestRepaint: requestRepaint
					});
				}
			);
		});
} catch (error) {
		console.error("[ocean] панель настроек не зарегистрирована", error);
}
			});
		}
		exports.apply = apply;
		exports.inject = [];
		return module.exports;
	}
});
