import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
// Клиентская часть: панель управления экспертами в UI.
import { h } from "preact";
import { useState, useEffect, useCallback } from "preact/hooks";
export function EkspertPanel(props) {
    const { sendRequest, locale, t } = props;
    const [experts, setExperts] = useState([]);
    const [divisions, setDivisions] = useState([]);
    const [selectedDivision, setSelectedDivision] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [tabs, setTabs] = useState("experts");
    const loadSnapshot = useCallback(async () => {
        try {
            const res = await sendRequest("eksTeamCatalog.snapshot");
            if (res?.experts) {
                setExperts(res.experts);
                setDivisions(res.divisions || []);
            }
        }
        catch (e) {
            console.error("[eks-team] Ошибка загрузки снапшота:", e);
        }
        finally {
            setLoading(false);
        }
    }, [sendRequest]);
    useEffect(() => { loadSnapshot(); }, [loadSnapshot]);
    const filteredExperts = experts.filter((e) => {
        if (selectedDivision && e.division !== selectedDivision)
            return false;
        if (!searchQuery)
            return true;
        const q = searchQuery.toLowerCase();
        return (e.name.toLowerCase().includes(q) ||
            e.slug.toLowerCase().includes(q) ||
            e.description.toLowerCase().includes(q));
    });
    const grouped = filteredExperts.reduce((acc, e) => {
        if (!acc[e.division])
            acc[e.division] = [];
        acc[e.division].push(e);
        return acc;
    }, {});
    const handleToggle = async (slug, enabled) => {
        const current = experts.find((e) => e.slug === slug);
        if (!current)
            return;
        const list = experts.filter((e) => e.slug !== slug).map((e) => e.slug);
        if (enabled)
            list.push(slug);
        try {
            await sendRequest("eksTeamCatalog.setEnabled", list);
            loadSnapshot();
        }
        catch (err) {
            console.error("[eks-team] Ошибка переключения:", err);
        }
    };
    const handleDownload = async (slug) => {
        try {
            const res = await sendRequest("eksTeamCatalog.fetchAssets", slug);
            if (res.status === "ready")
                loadSnapshot();
        }
        catch (err) {
            console.error("[eks-team] Ошибка загрузки ресурсов:", err);
        }
    };
    if (loading)
        return _jsx("div", { className: "eks-panel-loading", children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0430 \u044D\u043A\u0441\u043F\u0435\u0440\u0442\u043E\u0432\u2026" });
    function divisionLabelRu(division) {
        const labels = {
            engineering: "Инженерия",
            design: "Дизайн",
            marketing: "Маркетинг",
            security: "Безопасность",
            finance: "Финансы",
            sales: "Продажи",
            support: "Поддержка",
            research: "Исследования",
            "project-management": "Управление проектами",
            hr: "HR",
            legal: "Юриспруденция",
            healthcare: "Здравоохранение",
            "game-development": "Геймдев",
            gis: "ГИС",
            "spatial-computing": "Пространственные вычисления",
            specialized: "Специализированные",
            "supply-chain": "Цепочки поставок",
            testing: "Тестирование",
            academic: "Образование",
            company: "Компания",
            product: "Продукт",
            "paid-media": "Платные медиа",
            custom: "Своё",
        };
        return labels[division] || division;
    }
    function humanBytes(bytes) {
        const n = Number(bytes) || 0;
        if (n < 1024)
            return `${n} Б`;
        if (n < 1048576)
            return `${Math.max(1, Math.round(n / 1024))} КБ`;
        return `${(n / 1048576).toFixed(1)} МБ`;
    }
    return (_jsxs("div", { className: "eks-panel", children: [_jsxs("div", { className: "eks-tabs", children: [_jsx("button", { className: tabs === "experts" ? "active" : "", onClick: () => setTabs("experts"), children: t(locale, "panel.tabs.experts") }), _jsx("button", { className: tabs === "divisions" ? "active" : "", onClick: () => setTabs("divisions"), children: t(locale, "panel.tabs.divisions") }), _jsx("button", { className: tabs === "skills" ? "active" : "", onClick: () => setTabs("skills"), children: t(locale, "panel.tabs.skills") })] }), tabs === "experts" && (_jsxs("div", { className: "eks-experts-tab", children: [_jsxs("div", { className: "eks-toolbar", children: [_jsxs("select", { value: selectedDivision, onChange: (e) => setSelectedDivision(e.target.value), className: "eks-division-select", children: [_jsx("option", { value: "", children: t(locale, "panel.division.all") }), divisions.map((d) => (_jsx("option", { value: d, children: locale === "ru" ? divisionLabelRu(d) : d }, d)))] }), _jsx("input", { type: "search", placeholder: t(locale, "panel.search.placeholder"), value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), className: "eks-search" })] }), Object.keys(grouped).length === 0 ? (_jsx("div", { className: "eks-empty", children: t(locale, "panel.empty.noExperts") })) : (_jsx("div", { className: "eks-list", children: Object.entries(grouped).map(([division, list]) => (_jsxs("div", { className: "eks-division-group", children: [_jsxs("div", { className: "eks-division-header", children: ["\uD83D\uDCC1 ", locale === "ru" ? divisionLabelRu(division) : division, " (", list.length, ")"] }), list.map((e) => (_jsxs("div", { className: `eks-expert-card ${e.custom ? "custom" : ""} ${e.conflict ? "conflict" : ""}`, children: [_jsxs("label", { className: "eks-expert-row", children: [_jsx("input", { type: "checkbox", checked: true, onChange: () => handleToggle(e.slug, false), className: "eks-toggle" }), _jsx("span", { className: "eks-emoji", children: e.emoji }), _jsx("span", { className: "eks-name", children: e.name }), _jsx("code", { className: "eks-slug", children: e.slug }), e.custom && _jsx("span", { className: "eks-badge-custom", children: t(locale, "common.custom") }), e.conflict && _jsx("span", { className: "eks-badge-conflict", children: t(locale, "panel.expert.conflict") })] }), _jsx("div", { className: "eks-desc", children: e.description }), _jsxs("div", { className: "eks-meta", children: [_jsx("span", { className: "eks-division-badge", children: locale === "ru" ? divisionLabelRu(e.division) : e.division }), e.assets?.status === "pending" && (_jsxs("span", { className: "eks-asset-pending", children: [t(locale, "panel.asset.pending"), " ", t(locale, "panel.asset.size", { size: humanBytes(e.assets.bytes) })] })), e.assets?.status === "missing" && (_jsx("button", { className: "eks-download-btn", onClick: () => handleDownload(e.slug), children: t(locale, "panel.asset.download") })), e.assets?.status === "ready" && (_jsx("span", { className: "eks-asset-ready", children: t(locale, "panel.asset.downloaded") }))] })] }, e.slug)))] }, division))) }))] })), tabs === "divisions" && (_jsx("div", { className: "eks-divisions-tab", children: _jsx("div", { className: "eks-divisions-list", children: divisions.map((d) => (_jsxs("div", { className: "eks-division-item", children: [_jsx("span", { children: locale === "ru" ? divisionLabelRu(d) : d }), _jsx("code", { children: d })] }, d))) }) })), tabs === "skills" && (_jsxs("div", { className: "eks-skills-tab", children: [_jsx("div", { className: "eks-skills-info", children: t(locale, "skills.description") }), _jsx("button", { className: "eks-skills-manage", onClick: () => console.log("[eks-team] Открыть ворота навыков"), children: t(locale, "skills.title") })] }))] }));
}
// Регистрация панели в UI
export function registerEkspertPanel(ctx) {
    if (ctx.ui?.slots?.register) {
        ctx.ui.slots.register("settings:eks-team", {
            render: () => h(EkspertPanel, {
                sendRequest: ctx.connection.sendRequest.bind(ctx.connection),
                locale: ctx.locale,
                t: ctx.t,
            }),
            order: 50,
        });
    }
}
//# sourceMappingURL=panel.js.map