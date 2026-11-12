// src/client/panel.tsx
import { h } from "preact";
import { useState, useEffect, useCallback } from "preact/hooks";
import { jsx, jsxs } from "preact/jsx-runtime";
function EkspertPanel(props) {
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
    } catch (e) {
      console.error("[eks-team] \u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u0441\u043D\u0430\u043F\u0448\u043E\u0442\u0430:", e);
    } finally {
      setLoading(false);
    }
  }, [sendRequest]);
  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);
  const filteredExperts = experts.filter((e) => {
    if (selectedDivision && e.division !== selectedDivision) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return e.name.toLowerCase().includes(q) || e.slug.toLowerCase().includes(q) || e.description.toLowerCase().includes(q);
  });
  const grouped = filteredExperts.reduce((acc, e) => {
    if (!acc[e.division]) acc[e.division] = [];
    acc[e.division].push(e);
    return acc;
  }, {});
  const handleToggle = async (slug, enabled) => {
    const current = experts.find((e) => e.slug === slug);
    if (!current) return;
    const list = experts.filter((e) => e.slug !== slug).map((e) => e.slug);
    if (enabled) list.push(slug);
    try {
      await sendRequest("eksTeamCatalog.setEnabled", list);
      loadSnapshot();
    } catch (err) {
      console.error("[eks-team] \u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F:", err);
    }
  };
  const handleDownload = async (slug) => {
    try {
      const res = await sendRequest("eksTeamCatalog.fetchAssets", slug);
      if (res.status === "ready") loadSnapshot();
    } catch (err) {
      console.error("[eks-team] \u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u0440\u0435\u0441\u0443\u0440\u0441\u043E\u0432:", err);
    }
  };
  if (loading) return /* @__PURE__ */ jsx("div", { className: "eks-panel-loading", children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0430 \u044D\u043A\u0441\u043F\u0435\u0440\u0442\u043E\u0432\u2026" });
  function divisionLabelRu(division) {
    const labels = {
      engineering: "\u0418\u043D\u0436\u0435\u043D\u0435\u0440\u0438\u044F",
      design: "\u0414\u0438\u0437\u0430\u0439\u043D",
      marketing: "\u041C\u0430\u0440\u043A\u0435\u0442\u0438\u043D\u0433",
      security: "\u0411\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E\u0441\u0442\u044C",
      finance: "\u0424\u0438\u043D\u0430\u043D\u0441\u044B",
      sales: "\u041F\u0440\u043E\u0434\u0430\u0436\u0438",
      support: "\u041F\u043E\u0434\u0434\u0435\u0440\u0436\u043A\u0430",
      research: "\u0418\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u044F",
      "project-management": "\u0423\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u043F\u0440\u043E\u0435\u043A\u0442\u0430\u043C\u0438",
      hr: "HR",
      legal: "\u042E\u0440\u0438\u0441\u043F\u0440\u0443\u0434\u0435\u043D\u0446\u0438\u044F",
      healthcare: "\u0417\u0434\u0440\u0430\u0432\u043E\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0435",
      "game-development": "\u0413\u0435\u0439\u043C\u0434\u0435\u0432",
      gis: "\u0413\u0418\u0421",
      "spatial-computing": "\u041F\u0440\u043E\u0441\u0442\u0440\u0430\u043D\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0435 \u0432\u044B\u0447\u0438\u0441\u043B\u0435\u043D\u0438\u044F",
      specialized: "\u0421\u043F\u0435\u0446\u0438\u0430\u043B\u0438\u0437\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0435",
      "supply-chain": "\u0426\u0435\u043F\u043E\u0447\u043A\u0438 \u043F\u043E\u0441\u0442\u0430\u0432\u043E\u043A",
      testing: "\u0422\u0435\u0441\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435",
      academic: "\u041E\u0431\u0440\u0430\u0437\u043E\u0432\u0430\u043D\u0438\u0435",
      company: "\u041A\u043E\u043C\u043F\u0430\u043D\u0438\u044F",
      product: "\u041F\u0440\u043E\u0434\u0443\u043A\u0442",
      "paid-media": "\u041F\u043B\u0430\u0442\u043D\u044B\u0435 \u043C\u0435\u0434\u0438\u0430",
      custom: "\u0421\u0432\u043E\u0451"
    };
    return labels[division] || division;
  }
  function humanBytes(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return `${n} \u0411`;
    if (n < 1048576) return `${Math.max(1, Math.round(n / 1024))} \u041A\u0411`;
    return `${(n / 1048576).toFixed(1)} \u041C\u0411`;
  }
  return /* @__PURE__ */ jsxs("div", { className: "eks-panel", children: [
    /* @__PURE__ */ jsxs("div", { className: "eks-tabs", children: [
      /* @__PURE__ */ jsx("button", { className: tabs === "experts" ? "active" : "", onClick: () => setTabs("experts"), children: t(locale, "panel.tabs.experts") }),
      /* @__PURE__ */ jsx("button", { className: tabs === "divisions" ? "active" : "", onClick: () => setTabs("divisions"), children: t(locale, "panel.tabs.divisions") }),
      /* @__PURE__ */ jsx("button", { className: tabs === "skills" ? "active" : "", onClick: () => setTabs("skills"), children: t(locale, "panel.tabs.skills") })
    ] }),
    tabs === "experts" && /* @__PURE__ */ jsxs("div", { className: "eks-experts-tab", children: [
      /* @__PURE__ */ jsxs("div", { className: "eks-toolbar", children: [
        /* @__PURE__ */ jsxs(
          "select",
          {
            value: selectedDivision,
            onChange: (e) => setSelectedDivision(e.target.value),
            className: "eks-division-select",
            children: [
              /* @__PURE__ */ jsx("option", { value: "", children: t(locale, "panel.division.all") }),
              divisions.map((d) => /* @__PURE__ */ jsx("option", { value: d, children: locale === "ru" ? divisionLabelRu(d) : d }, d))
            ]
          }
        ),
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "search",
            placeholder: t(locale, "panel.search.placeholder"),
            value: searchQuery,
            onChange: (e) => setSearchQuery(e.target.value),
            className: "eks-search"
          }
        )
      ] }),
      Object.keys(grouped).length === 0 ? /* @__PURE__ */ jsx("div", { className: "eks-empty", children: t(locale, "panel.empty.noExperts") }) : /* @__PURE__ */ jsx("div", { className: "eks-list", children: Object.entries(grouped).map(([division, list]) => /* @__PURE__ */ jsxs("div", { className: "eks-division-group", children: [
        /* @__PURE__ */ jsxs("div", { className: "eks-division-header", children: [
          "\u{1F4C1} ",
          locale === "ru" ? divisionLabelRu(division) : division,
          " (",
          list.length,
          ")"
        ] }),
        list.map((e) => /* @__PURE__ */ jsxs("div", { className: `eks-expert-card ${e.custom ? "custom" : ""} ${e.conflict ? "conflict" : ""}`, children: [
          /* @__PURE__ */ jsxs("label", { className: "eks-expert-row", children: [
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "checkbox",
                checked: true,
                onChange: () => handleToggle(e.slug, false),
                className: "eks-toggle"
              }
            ),
            /* @__PURE__ */ jsx("span", { className: "eks-emoji", children: e.emoji }),
            /* @__PURE__ */ jsx("span", { className: "eks-name", children: e.name }),
            /* @__PURE__ */ jsx("code", { className: "eks-slug", children: e.slug }),
            e.custom && /* @__PURE__ */ jsx("span", { className: "eks-badge-custom", children: t(locale, "common.custom") }),
            e.conflict && /* @__PURE__ */ jsx("span", { className: "eks-badge-conflict", children: t(locale, "panel.expert.conflict") })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "eks-desc", children: e.description }),
          /* @__PURE__ */ jsxs("div", { className: "eks-meta", children: [
            /* @__PURE__ */ jsx("span", { className: "eks-division-badge", children: locale === "ru" ? divisionLabelRu(e.division) : e.division }),
            e.assets?.status === "pending" && /* @__PURE__ */ jsxs("span", { className: "eks-asset-pending", children: [
              t(locale, "panel.asset.pending"),
              " ",
              t(locale, "panel.asset.size", { size: humanBytes(e.assets.bytes) })
            ] }),
            e.assets?.status === "missing" && /* @__PURE__ */ jsx("button", { className: "eks-download-btn", onClick: () => handleDownload(e.slug), children: t(locale, "panel.asset.download") }),
            e.assets?.status === "ready" && /* @__PURE__ */ jsx("span", { className: "eks-asset-ready", children: t(locale, "panel.asset.downloaded") })
          ] })
        ] }, e.slug))
      ] }, division)) })
    ] }),
    tabs === "divisions" && /* @__PURE__ */ jsx("div", { className: "eks-divisions-tab", children: /* @__PURE__ */ jsx("div", { className: "eks-divisions-list", children: divisions.map((d) => /* @__PURE__ */ jsxs("div", { className: "eks-division-item", children: [
      /* @__PURE__ */ jsx("span", { children: locale === "ru" ? divisionLabelRu(d) : d }),
      /* @__PURE__ */ jsx("code", { children: d })
    ] }, d)) }) }),
    tabs === "skills" && /* @__PURE__ */ jsxs("div", { className: "eks-skills-tab", children: [
      /* @__PURE__ */ jsx("div", { className: "eks-skills-info", children: t(locale, "skills.description") }),
      /* @__PURE__ */ jsx("button", { className: "eks-skills-manage", onClick: () => console.log("[eks-team] \u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0432\u043E\u0440\u043E\u0442\u0430 \u043D\u0430\u0432\u044B\u043A\u043E\u0432"), children: t(locale, "skills.title") })
    ] })
  ] });
}
function registerEkspertPanel(ctx) {
  if (ctx.ui?.slots?.register) {
    ctx.ui.slots.register("settings:eks-team", {
      render: () => h(EkspertPanel, {
        sendRequest: ctx.connection.sendRequest.bind(ctx.connection),
        locale: ctx.locale,
        t: ctx.t
      }),
      order: 50
    });
  }
}

// src/client/index.ts
function setupClient(ctx) {
  registerEkspertPanel(ctx);
  if (ctx.composer?.registerExpertProvider) {
    ctx.composer.registerExpertProvider("eks-team", {
      label: "\u042D\u043A\u0441\u043F\u0435\u0440\u0442",
      async getExperts() {
        try {
          const res = await ctx.connection.sendRequest("eksTeamCatalog.snapshot");
          return (res?.experts || []).map((e) => ({
            name: e.name,
            slug: e.slug,
            description: e.description,
            emoji: e.emoji,
            division: e.division,
            custom: e.custom
          }));
        } catch {
          return [];
        }
      }
    });
  }
}
var index_default = setupClient;
export {
  index_default as default,
  setupClient
};
//# sourceMappingURL=client.js.map
