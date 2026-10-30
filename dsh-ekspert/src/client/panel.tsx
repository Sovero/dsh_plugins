// Клиентская часть: панель управления экспертами в UI.
import { h } from "preact";
import { useState, useEffect, useCallback } from "preact/hooks";

export function EkspertPanel(props: { 
  sendRequest: (method: string, ...args: any[]) => Promise<any>;
  locale: string;
  t: (locale: string, key: string, params?: Record<string, string | number>) => string;
}) {
  const { sendRequest, locale, t } = props;
  const [experts, setExperts] = useState<any[]>([]);
  const [divisions, setDivisions] = useState<string[]>([]);
  const [selectedDivision, setSelectedDivision] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [tabs, setTabs] = useState<"experts" | "divisions" | "skills">("experts");

  const loadSnapshot = useCallback(async () => {
    try {
      const res = await sendRequest("eksTeamCatalog.snapshot");
      if (res?.experts) {
        setExperts(res.experts);
        setDivisions(res.divisions || []);
      }
    } catch (e) {
      console.error("[eks-team] Ошибка загрузки снапшота:", e);
    } finally {
      setLoading(false);
    }
  }, [sendRequest]);

  useEffect(() => { loadSnapshot(); }, [loadSnapshot]);

  const filteredExperts = experts.filter((e) => {
    if (selectedDivision && e.division !== selectedDivision) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      e.name.toLowerCase().includes(q) ||
      e.slug.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q)
    );
  });

  const grouped = filteredExperts.reduce((acc: Record<string, any[]>, e) => {
    if (!acc[e.division]) acc[e.division] = [];
    acc[e.division].push(e);
    return acc;
  }, {});

  const handleToggle = async (slug: string, enabled: boolean) => {
    const current = experts.find((e) => e.slug === slug);
    if (!current) return;
    const list = experts.filter((e) => e.slug !== slug).map((e) => e.slug);
    if (enabled) list.push(slug);
    try {
      await sendRequest("eksTeamCatalog.setEnabled", list);
      loadSnapshot();
    } catch (err) {
      console.error("[eks-team] Ошибка переключения:", err);
    }
  };

  const handleDownload = async (slug: string) => {
    try {
      const res = await sendRequest("eksTeamCatalog.fetchAssets", slug);
      if (res.status === "ready") loadSnapshot();
    } catch (err) {
      console.error("[eks-team] Ошибка загрузки ресурсов:", err);
    }
  };

  if (loading) return <div className="eks-panel-loading">Загрузка каталога экспертов…</div>;

  function divisionLabelRu(division: string): string {
    const labels: Record<string, string> = {
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

  function humanBytes(bytes: number) {
    const n = Number(bytes) || 0;
    if (n < 1024) return `${n} Б`;
    if (n < 1048576) return `${Math.max(1, Math.round(n / 1024))} КБ`;
    return `${(n / 1048576).toFixed(1)} МБ`;
  }

  return (
    <div className="eks-panel">
      <div className="eks-tabs">
        <button className={tabs === "experts" ? "active" : ""} onClick={() => setTabs("experts")}>
          {t(locale, "panel.tabs.experts")}
        </button>
        <button className={tabs === "divisions" ? "active" : ""} onClick={() => setTabs("divisions")}>
          {t(locale, "panel.tabs.divisions")}
        </button>
        <button className={tabs === "skills" ? "active" : ""} onClick={() => setTabs("skills")}>
          {t(locale, "panel.tabs.skills")}
        </button>
      </div>

      {tabs === "experts" && (
        <div className="eks-experts-tab">
          <div className="eks-toolbar">
            <select
              value={selectedDivision}
              onChange={(e) => setSelectedDivision(e.target.value)}
              className="eks-division-select"
            >
              <option value="">{t(locale, "panel.division.all")}</option>
              {divisions.map((d) => (
                <option key={d} value={d}>
                  {locale === "ru" ? divisionLabelRu(d) : d}
                </option>
              ))}
            </select>
            <input
              type="search"
              placeholder={t(locale, "panel.search.placeholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="eks-search"
            />
          </div>
          {Object.keys(grouped).length === 0 ? (
            <div className="eks-empty">{t(locale, "panel.empty.noExperts")}</div>
          ) : (
            <div className="eks-list">
              {Object.entries(grouped).map(([division, list]) => (
                <div key={division} className="eks-division-group">
                  <div className="eks-division-header">
                    📁 {locale === "ru" ? divisionLabelRu(division) : division} ({list.length})
                  </div>
                  {list.map((e) => (
                    <div key={e.slug} className={`eks-expert-card ${e.custom ? "custom" : ""} ${e.conflict ? "conflict" : ""}`}>
                      <label className="eks-expert-row">
                        <input
                          type="checkbox"
                          checked={true}
                          onChange={() => handleToggle(e.slug, false)}
                          className="eks-toggle"
                        />
                        <span className="eks-emoji">{e.emoji}</span>
                        <span className="eks-name">{e.name}</span>
                        <code className="eks-slug">{e.slug}</code>
                        {e.custom && <span className="eks-badge-custom">{t(locale, "common.custom")}</span>}
                        {e.conflict && <span className="eks-badge-conflict">{t(locale, "panel.expert.conflict")}</span>}
                      </label>
                      <div className="eks-desc">{e.description}</div>
                      <div className="eks-meta">
                        <span className="eks-division-badge">{locale === "ru" ? divisionLabelRu(e.division) : e.division}</span>
                        {e.assets?.status === "pending" && (
                          <span className="eks-asset-pending">
                            {t(locale, "panel.asset.pending")} {t(locale, "panel.asset.size", { size: humanBytes(e.assets.bytes) })}
                          </span>
                        )}
                        {e.assets?.status === "missing" && (
                          <button className="eks-download-btn" onClick={() => handleDownload(e.slug)}>
                            {t(locale, "panel.asset.download")}
                          </button>
                        )}
                        {e.assets?.status === "ready" && (
                          <span className="eks-asset-ready">{t(locale, "panel.asset.downloaded")}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tabs === "divisions" && (
        <div className="eks-divisions-tab">
          <div className="eks-divisions-list">
            {divisions.map((d) => (
              <div key={d} className="eks-division-item">
                <span>{locale === "ru" ? divisionLabelRu(d) : d}</span>
                <code>{d}</code>
              </div>
            ))}
          </div>
        </div>
      )}

      {tabs === "skills" && (
        <div className="eks-skills-tab">
          <div className="eks-skills-info">{t(locale, "skills.description")}</div>
          <button className="eks-skills-manage" onClick={() => console.log("[eks-team] Открыть ворота навыков")}>
            {t(locale, "skills.title")}
          </button>
        </div>
      )}
    </div>
  );
}

// Регистрация панели в UI
export function registerEkspertPanel(ctx: any) {
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