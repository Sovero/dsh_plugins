"use strict";
(() => {
  // src/client/entry.js
  window.__ModuleLoader__.load({
    id: "dsh-ekspert",
    factory(require2) {
      const React = require2("react");
      const h = React.createElement;
      const { useState, useEffect, useMemo, useRef } = React;
      const SNAPSHOT = "eksTeamCatalog.snapshot";
      const CSS = `
.eks-btn{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border:1px solid var(--border-color,rgba(127,127,127,.35));border-radius:8px;background:transparent;color:inherit;font:inherit;cursor:pointer;white-space:nowrap}
.eks-btn:hover{background:var(--hover-bg,rgba(127,127,127,.12))}
.eks-pop{position:fixed;z-index:9999;width:320px;max-height:420px;overflow:auto;padding:8px;border:1px solid var(--border-color,rgba(127,127,127,.35));border-radius:12px;background:var(--panel-bg,#1e1e1e);color:inherit;box-shadow:0 12px 32px rgba(0,0,0,.35)}
.eks-search{width:100%;box-sizing:border-box;padding:6px 8px;margin-bottom:8px;border:1px solid var(--border-color,rgba(127,127,127,.35));border-radius:8px;background:transparent;color:inherit;font:inherit}
.eks-row{display:flex;align-items:flex-start;gap:8px;width:100%;padding:6px 8px;border:0;border-radius:8px;background:transparent;color:inherit;text-align:left;cursor:pointer;font:inherit}
.eks-row:hover{background:var(--hover-bg,rgba(127,127,127,.12))}
.eks-row-emoji{flex:none;font-size:16px;line-height:1.3}
.eks-row-name{font-weight:600}
.eks-row-div{opacity:.65;font-size:11px}
.eks-row-desc{opacity:.8;font-size:12px;line-height:1.35}
.eks-empty{opacity:.7;padding:10px;font-size:13px}
.eks-section{padding:16px}
.eks-section h2{margin:0 0 12px;font-size:18px}
.eks-grid{display:grid;gap:8px}
.eks-card{display:flex;gap:10px;padding:10px;border:1px solid var(--border-color,rgba(127,127,127,.28));border-radius:10px}
.eks-card-name{font-weight:600}
.eks-card-desc{opacity:.8;font-size:13px}
`;
      function useExperts(ctx) {
        const [items, setItems] = useState([]);
        const [error, setError] = useState("");
        useEffect(() => {
          let alive = true;
          const send = ctx.connection && ctx.connection.sendRequest ? ctx.connection.sendRequest.bind(ctx.connection) : null;
          if (!send) {
            setError("Радиомаяк каталога недоступен");
            return () => {
              alive = false;
            };
          }
          send(SNAPSHOT).then((res) => {
            if (!alive) return;
            const list = res && res.experts || [];
            setItems(list.map((e) => ({
              name: e.name || e.slug,
              slug: e.slug,
              description: e.description || "",
              division: e.division || "",
              emoji: e.emoji || "🧠"
            })));
          }).catch((e) => {
            if (alive) setError(String(e && e.message || e));
          });
          return () => {
            alive = false;
          };
        }, [ctx]);
        return { items, error };
      }
      function insertChip(ctx, expert) {
        const chip = "@" + expert.name;
        const input = ctx.input || ctx.composer || ctx.conversationInput;
        if (input && typeof input.insertText === "function") {
          input.insertText(chip);
          return;
        }
        if (input && typeof input.insertReference === "function") {
          input.insertReference({ type: "expert", label: expert.name, text: chip, slug: expert.slug });
          return;
        }
        if (ctx.composer && typeof ctx.composer.insertText === "function") {
          ctx.composer.insertText(chip);
          return;
        }
        if (ctx.composer && typeof ctx.composer.insertReference === "function") {
          ctx.composer.insertReference({ type: "expert", label: expert.name, text: chip, slug: expert.slug });
          return;
        }
        try {
          navigator.clipboard && navigator.clipboard.writeText(chip);
        } catch (_) {
        }
      }
      function ExpertLauncher(props) {
        const ctx = props.ctx;
        const { items, error } = useExperts(ctx);
        const [open, setOpen] = useState(false);
        const [query, setQuery] = useState("");
        const [pos, setPos] = useState({ top: 0, left: 0 });
        const btnRef = useRef(null);
        const filtered = useMemo(() => {
          const q = query.trim().toLowerCase();
          if (!q) return items;
          return items.filter((e) => e.name.toLowerCase().includes(q) || e.slug.toLowerCase().includes(q) || (e.description || "").toLowerCase().includes(q) || (e.division || "").toLowerCase().includes(q));
        }, [items, query]);
        const toggle = () => {
          if (!open && btnRef.current) {
            const r = btnRef.current.getBoundingClientRect();
            setPos({ top: Math.max(8, r.top - 430), left: Math.max(8, r.left) });
          }
          setOpen((v) => !v);
          setQuery("");
        };
        return h(
          React.Fragment,
          null,
          h("style", null, CSS),
          h("button", {
            ref: btnRef,
            type: "button",
            className: "eks-btn",
            title: "Эксперты — каталог предметных специалистов",
            onClick: toggle
          }, "🧠 ", "Эксперты (", items.length, ")"),
          open && h(
            "div",
            {
              className: "eks-pop",
              style: { top: pos.top + "px", left: pos.left + "px" },
              role: "dialog"
            },
            h("input", {
              className: "eks-search",
              autoFocus: true,
              placeholder: "Поиск эксперта по имени, слагу или описанию…",
              value: query,
              onChange: (ev) => setQuery(ev.target.value)
            }),
            error && h("div", { className: "eks-empty" }, "⚠ ", error),
            !error && filtered.length === 0 && h("div", { className: "eks-empty" }, "Никого не нашлось"),
            filtered.map((e) => h(
              "button",
              {
                key: e.slug,
                type: "button",
                className: "eks-row",
                title: e.description,
                onClick: () => {
                  insertChip(ctx, e);
                  setOpen(false);
                }
              },
              h("span", { className: "eks-row-emoji" }, e.emoji),
              h(
                "span",
                null,
                h("div", { className: "eks-row-name" }, e.name),
                h("div", { className: "eks-row-div" }, e.division, " · ", e.slug),
                h("div", { className: "eks-row-desc" }, (e.description || "").slice(0, 110))
              )
            ))
          )
        );
      }
      function ExpertSection(props) {
        const ctx = props.ctx;
        const { items, error } = useExperts(ctx);
        const [query, setQuery] = useState("");
        const filtered = useMemo(() => {
          const q = query.trim().toLowerCase();
          if (!q) return items;
          return items.filter((e) => e.name.toLowerCase().includes(q) || (e.description || "").toLowerCase().includes(q));
        }, [items, query]);
        return h(
          "div",
          { className: "eks-section" },
          h("style", null, CSS),
          h("h2", null, "🧠 Эксперты"),
          h(
            "div",
            { className: "eks-row-desc", style: { marginBottom: "12px" } },
            "Каталог предметных специалистов: ",
            items.length,
            " экспертов. ",
            "Вызовите через @ меню или кнопку слева от поля ввода."
          ),
          h("input", {
            className: "eks-search",
            placeholder: "Поиск эксперта…",
            value: query,
            onChange: (ev) => setQuery(ev.target.value)
          }),
          error && h("div", { className: "eks-empty" }, "⚠ ", error),
          h(
            "div",
            { className: "eks-grid" },
            filtered.map((e) => h(
              "div",
              { key: e.slug, className: "eks-card" },
              h("span", { className: "eks-row-emoji" }, e.emoji),
              h(
                "div",
                null,
                h("div", { className: "eks-card-name" }, e.name, " ", h("code", null, e.slug)),
                h("div", { className: "eks-card-desc" }, e.description)
              )
            ))
          )
        );
      }
      return {
        inject: ["slots"],
        apply(ctx) {
          ctx.slots.inject("settings.section", () => ctx.slots.register({
            name: "settings.section",
            id: "dsh-ekspert",
            order: 18,
            label: "Эксперты",
            icon: "🧠"
          }, (props) => h(ExpertSection, { ...props, ctx })));
          ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
            name: "conversation.input.left",
            id: "dsh-ekspert",
            order: 12,
            label: "Эксперты"
          }, (props) => h(ExpertLauncher, { ...props, ctx })));
        }
      };
    }
  });
})();
//# sourceMappingURL=client.js.map
