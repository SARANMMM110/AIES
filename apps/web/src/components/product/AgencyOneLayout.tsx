"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { displayAgencyName } from "./ProductShell";
import { InlineWorkflowRunner } from "./InlineWorkflowRunner";
import type { ClientRow, ProductResource, ProductWorkspace, SetupConfig, WorkflowDef } from "./types";
import { apiFetch } from "@/lib/api";

const EXP_OPTIONS = [
  "Beginner building a first agency",
  "Some freelance or agency experience",
  "Established agency adding AI services",
];

const MODEL_OPTIONS = [
  "Audit plus implementation",
  "Audit and recommendations only",
  "Ongoing enablement retainer",
  "Project-based implementation",
];

const TIME_OPTIONS = ["5 hours or less", "5 to 10 hours", "10 to 20 hours", "20+ hours"];

const RESOURCE_ORDER = [
  "OPERATOR_GUIDE",
  "SALES_PAGE",
  "SALES_COPY",
  "POSITIONING",
  "BUSINESS_STRATEGY",
] as const;

const RESOURCE_LABELS: Record<string, string> = {
  OPERATOR_GUIDE: "Operator Guide",
  SALES_PAGE: "Sales Page",
  SALES_COPY: "Sales Copy",
  POSITIONING: "Positioning",
  BUSINESS_STRATEGY: "Business Strategy",
};

const FEATURES: Array<{ label: string; svg: React.ReactNode }> = [
  {
    label: "Practical AI Opportunities",
    svg: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
        <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      </svg>
    ),
  },
  {
    label: "More Efficient Workflows",
    svg: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <rect x="4" y="12" width="4" height="8" rx="1" />
        <rect x="10" y="7" width="4" height="13" rx="1" />
        <rect x="16" y="10" width="4" height="10" rx="1" />
      </svg>
    ),
  },
  {
    label: "Real Business Improvement",
    svg: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="9" cy="8" r="3.2" />
        <path d="M2.8 20c.6-3.2 3.2-5 6.2-5s5.6 1.8 6.2 5" />
        <circle cx="17.5" cy="9.5" r="2.5" />
        <path d="M15.5 14.6c2.9-.3 5.2 1.3 5.7 4.4" />
      </svg>
    ),
  },
];

type Props = {
  slug: string;
  product: ProductWorkspace;
  setup: SetupConfig;
  aiPlatforms: string[];
  onSetupChange: (s: SetupConfig) => void;
  clients: ClientRow[];
  onClientsChange: (c: ClientRow[]) => void;
};

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function AgencyOneLayout({
  slug,
  product,
  setup,
  aiPlatforms,
  onSetupChange,
  clients,
  onClientsChange,
}: Props) {
  const [ctaInvalid, setCtaInvalid] = useState(false);
  const [fieldErr, setFieldErr] = useState<{ country?: boolean; niche?: boolean }>({});
  const [toast, setToast] = useState<string | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowDef[]>([]);
  const [loadingWf, setLoadingWf] = useState(false);
  const [wfSearch, setWfSearch] = useState("");
  const [activeWfId, setActiveWfId] = useState<string | null>(null);
  const [clientDraft, setClientDraft] = useState({
    name: clients[0]?.name || "",
    industry: clients[0]?.industry || "",
    location: clients[0]?.location || "",
    notes: clients[0]?.goals || "",
  });
  const [selectedClientId, setSelectedClientId] = useState(clients[0]?.id || "");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [activeResourceId, setActiveResourceId] = useState<string | null>(null);

  const wfCount =
    product.workflowCatalog?.definedCount ??
    product.workflowCatalog?.targetCount ??
    product.workflowCount;
  const title = displayAgencyName(product.name);
  const selected = setup.selectedServiceIds || [];
  const eyebrow = product.tagline || "Agency Operating System";

  useEffect(() => {
    setLoadingWf(true);
    void (async () => {
      try {
        const data = await apiFetch<{ workflows: WorkflowDef[] }>(
          `/api/products/${slug}/workflows`
        );
        setWorkflows(data.workflows);
      } catch {
        setWorkflows([]);
      } finally {
        setLoadingWf(false);
      }
    })();
  }, [slug]);

  const serviceMap = useMemo(() => {
    const m = new Map<string, ProductResource>();
    for (const s of product.services) m.set(s.id, s);
    return m;
  }, [product.services]);

  const libraryResources = useMemo(() => {
    const allowed = new Set<string>(RESOURCE_ORDER);
    const library = product.resourceLibrary ?? product.resources ?? [];
    return [...library]
      .filter((r) => r.type !== "SERVICE" && allowed.has(r.type))
      .sort((a, b) => RESOURCE_ORDER.indexOf(a.type as (typeof RESOURCE_ORDER)[number]) - RESOURCE_ORDER.indexOf(b.type as (typeof RESOURCE_ORDER)[number]));
  }, [product.resourceLibrary, product.resources]);

  useEffect(() => {
    if (!activeResourceId && libraryResources[0]) {
      setActiveResourceId(libraryResources[0].id);
    }
  }, [libraryResources, activeResourceId]);

  const menuGroups = useMemo(() => {
    if (selected.length === 0) return [];
    const selectedSet = new Set(selected);
    const q = wfSearch.trim().toLowerCase();
    const filtered = workflows.filter((w) => {
      if (!w.serviceResourceId || !selectedSet.has(w.serviceResourceId)) return false;
      if (!q) return true;
      const hay = `${w.name} ${w.purpose || ""} ${w.description || ""}`.toLowerCase();
      return hay.includes(q);
    });
    const groups: Array<{ serviceId: string; title: string; items: WorkflowDef[] }> = [];
    for (const svc of product.services) {
      if (!selectedSet.has(svc.id)) continue;
      const items = filtered
        .filter((w) => w.serviceResourceId === svc.id)
        .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
      if (items.length) groups.push({ serviceId: svc.id, title: svc.title, items });
    }
    return groups;
  }, [workflows, selected, product.services, wfSearch]);

  const menuTotal = menuGroups.reduce((n, g) => n + g.items.length, 0);
  const activeWf = workflows.find((w) => w.id === activeWfId) || null;
  const activeResource =
    libraryResources.find((r) => r.id === activeResourceId) || libraryResources[0] || null;

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1800);
  }

  function toggleService(id: string) {
    const set = new Set(selected);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onSetupChange({ ...setup, selectedServiceIds: [...set] });
  }

  function allSvc(on: boolean) {
    onSetupChange({
      ...setup,
      selectedServiceIds: on ? product.services.map((s) => s.id) : [],
    });
  }

  async function persistSetup() {
    await apiFetch(`/api/products/${slug}/setup`, {
      method: "PUT",
      body: JSON.stringify(setup),
    });
  }

  async function saveAndFocusWorkflows() {
    const missingCountry = !(setup.country || "").trim();
    const missingNiche = !(setup.targetNiche || "").trim();
    const missingServices = selected.length === 0;
    setFieldErr({ country: missingCountry, niche: missingNiche });
    if (missingCountry || missingNiche || missingServices) {
      setCtaInvalid(true);
      showToast("Fill required fields and select at least one service");
      return;
    }
    setCtaInvalid(false);
    try {
      await persistSetup();
    } catch {
      /* continue */
    }
    scrollToId("workflows");
  }

  async function ensureClientAndProject(): Promise<{ clientId: string; projectId: string }> {
    let clientId = selectedClientId;
    if (!clientId && clientDraft.name.trim()) {
      const created = await apiFetch<{ client: ClientRow }>("/api/clients", {
        method: "POST",
        body: JSON.stringify({
          name: clientDraft.name,
          industry: clientDraft.industry || null,
          location: clientDraft.location || null,
          goals: clientDraft.notes || null,
        }),
      });
      clientId = created.client.id;
      setSelectedClientId(clientId);
      onClientsChange([created.client, ...clients]);
    }
    if (!clientId && clients[0]) clientId = clients[0].id;

    if (!clientId) {
      const created = await apiFetch<{ client: ClientRow }>("/api/clients", {
        method: "POST",
        body: JSON.stringify({
          name: clientDraft.name.trim() || `${title} Client`,
          industry: clientDraft.industry || null,
          location: clientDraft.location || null,
          goals: clientDraft.notes || null,
        }),
      });
      clientId = created.client.id;
      setSelectedClientId(clientId);
      onClientsChange([created.client, ...clients]);
    }

    if (projectId) return { clientId, projectId };
    const createdProject = await apiFetch<{ project: { id: string } }>("/api/projects", {
      method: "POST",
      body: JSON.stringify({
        name: `${product.name} — ${clientDraft.name || "Workspace"}`,
        clientId,
        productId: product.id,
      }),
    });
    setProjectId(createdProject.project.id);
    return { clientId, projectId: createdProject.project.id };
  }

  async function openWorkflow(wf: WorkflowDef) {
    if (!wf.id) {
      showToast("Invalid workflow — missing ID");
      return;
    }
    if (!wf.serviceResourceId || !serviceMap.has(wf.serviceResourceId)) {
      showToast("Invalid Product → Service → Workflow mapping. Cannot open.");
      return;
    }
    try {
      await persistSetup();
    } catch {
      /* continue */
    }
    setActiveWfId(wf.id);
    requestAnimationFrame(() => scrollToId("runner"));
  }

  function closeRunner() {
    setActiveWfId(null);
  }

  return (
    <>
      <header className="top">
        <div className="brand">
          <span>AI ENTERPRISE STUDIO</span>
          <span className="dash" aria-hidden />
        </div>
        <ThemeToggle variant="studio" />
      </header>

      <div className="hero">
        <div className="blob a" />
        <div className="blob b" />
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1 className="title">{title}</h1>
          <p className="lede">
            {product.description ||
              product.shortDescription ||
              "Build and operate a consulting agency with guided workflows and human review."}
          </p>
          <div className="feats">
            {FEATURES.map((f) => (
              <div key={f.label} className="feat">
                <span className="ic">{f.svg}</span>
                <span className="tx">{f.label}</span>
              </div>
            ))}
          </div>
          <div className="btnrow" style={{ marginTop: 22 }}>
            <button type="button" className="btn primary" onClick={() => scrollToId("workflows")}>
              View Workflows <span aria-hidden>↓</span>
            </button>
          </div>
        </div>
        <div className="gen">
          <div className="ghead">
            <span className="chip">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="6" y="6" width="12" height="12" rx="2" />
                <rect x="10" y="10" width="4" height="4" />
                <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />
              </svg>
            </span>
            <h3>GENERATE {wfCount} CUSTOM AGENCY WORKFLOWS</h3>
          </div>
          <p>
            Choose the AI you work with, set up your agency profile and add client context — the
            system builds customized workflows for setup, delivery, reporting and growth.
          </p>
          <div className="rule" />
          <div className="big">
            <b>{wfCount}</b>
            <span>GUIDED WORKFLOWS</span>
          </div>
        </div>
        <div className="deco" />
      </div>

      <div className="card">
        <div className="chead">
          <span className="ic">
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="5" y="4" width="14" height="17" rx="2" />
              <path d="M9 2h6v4H9zM9 11h6M9 15h6" />
            </svg>
          </span>
          <div>
            <h2>Agency Configuration</h2>
            <div className="sub">
              Choose your AI platform and define the agency profile used across every workflow.
            </div>
          </div>
          <div className="right" />
        </div>

        <div className="sect">
          <h4>AI platform</h4>
          <div className="hint">The copy-and-open action on every workflow will match this choice.</div>
          <div className="field mini">
            <label htmlFor="fPlatform">Which AI will you use?</label>
            <select
              id="fPlatform"
              value={setup.aiPlatform || "ChatGPT"}
              onChange={(e) => onSetupChange({ ...setup, aiPlatform: e.target.value })}
              onBlur={() => void persistSetup().catch(() => undefined)}
            >
              {(aiPlatforms.length ? aiPlatforms : ["ChatGPT", "Claude", "Gemini", "Custom / Other"]).map(
                (p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                )
              )}
            </select>
          </div>
        </div>

        <div className="sect">
          <h4>Agency profile</h4>
          <div className="hint">Define the business you want to build and the service menu you want to sell.</div>
          <div className="grid3">
            <div className="field">
              <label htmlFor="fName">Agency name or working name</label>
              <input
                id="fName"
                placeholder="Example: Practical AI Works"
                value={setup.agencyName || ""}
                onChange={(e) => onSetupChange({ ...setup, agencyName: e.target.value || null })}
                onBlur={() => void persistSetup().catch(() => undefined)}
              />
            </div>
            <div className={`field ${fieldErr.country ? "err" : ""}`}>
              <label htmlFor="fCountry">
                Country or operating market <span className="req">*</span>
              </label>
              <input
                id="fCountry"
                placeholder="Example: United States"
                value={setup.country || ""}
                onChange={(e) => onSetupChange({ ...setup, country: e.target.value || null })}
                onBlur={() => void persistSetup().catch(() => undefined)}
              />
            </div>
            <div className={`field ${fieldErr.niche ? "err" : ""}`}>
              <label htmlFor="fNiche">
                Target local-business niche <span className="req">*</span>
              </label>
              <input
                id="fNiche"
                placeholder="Example: professional service businesses"
                value={setup.targetNiche || ""}
                onChange={(e) => onSetupChange({ ...setup, targetNiche: e.target.value || null })}
                onBlur={() => void persistSetup().catch(() => undefined)}
              />
            </div>
            <div className="field">
              <label htmlFor="fArea">Geographic service area</label>
              <input
                id="fArea"
                placeholder="Example: Denver and surrounding counties"
                value={setup.geographicServiceArea || ""}
                onChange={(e) =>
                  onSetupChange({ ...setup, geographicServiceArea: e.target.value || null })
                }
                onBlur={() => void persistSetup().catch(() => undefined)}
              />
            </div>
            <div className="field">
              <label htmlFor="fExp">
                Experience level <span className="req">*</span>
              </label>
              <select
                id="fExp"
                value={setup.experienceLevel || EXP_OPTIONS[0]}
                onChange={(e) => onSetupChange({ ...setup, experienceLevel: e.target.value })}
                onBlur={() => void persistSetup().catch(() => undefined)}
              >
                {EXP_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="fModel">
                Preferred delivery model <span className="req">*</span>
              </label>
              <select
                id="fModel"
                value={setup.preferredDeliveryModel || MODEL_OPTIONS[0]}
                onChange={(e) =>
                  onSetupChange({ ...setup, preferredDeliveryModel: e.target.value })
                }
                onBlur={() => void persistSetup().catch(() => undefined)}
              >
                {MODEL_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="fTime">Weekly time available</label>
              <select
                id="fTime"
                value={setup.weeklyTimeAvailability || TIME_OPTIONS[0]}
                onChange={(e) =>
                  onSetupChange({ ...setup, weeklyTimeAvailability: e.target.value })
                }
                onBlur={() => void persistSetup().catch(() => undefined)}
              >
                {TIME_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="fIncome">Monthly income or client target</label>
              <input
                id="fIncome"
                placeholder="Example: 6 clients or $10,000/month"
                value={setup.monthlyIncomeOrClientTarget || ""}
                onChange={(e) =>
                  onSetupChange({
                    ...setup,
                    monthlyIncomeOrClientTarget: e.target.value || null,
                  })
                }
                onBlur={() => void persistSetup().catch(() => undefined)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="chead">
          <span className="ic sage">
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M20 21a8 8 0 0 0-16 0" />
              <circle cx="12" cy="8" r="4.2" />
            </svg>
          </span>
          <div>
            <h2>
              Client Context{" "}
              <span style={{ fontWeight: 500, fontSize: 14, color: "var(--muted)" }}>
                (optional)
              </span>
            </h2>
            <div className="sub">
              Add the client you are working with — every fulfillment workflow will be customized
              to them. Leave blank to keep outputs reusable.
            </div>
          </div>
        </div>
        <div className="sect">
          <div className="grid3">
            <div className="field">
              <label htmlFor="cName">Client business name</label>
              <input
                id="cName"
                placeholder="Example: Summit Dental Care"
                value={clientDraft.name}
                onChange={(e) => setClientDraft({ ...clientDraft, name: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="cInd">Client industry</label>
              <input
                id="cInd"
                placeholder="Example: dental clinic"
                value={clientDraft.industry}
                onChange={(e) => setClientDraft({ ...clientDraft, industry: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="cLoc">Client location</label>
              <input
                id="cLoc"
                placeholder="Example: Aurora, CO"
                value={clientDraft.location}
                onChange={(e) => setClientDraft({ ...clientDraft, location: e.target.value })}
              />
            </div>
          </div>
          <div className="field" style={{ marginTop: 16 }}>
            <label htmlFor="cNotes">Notes or goals</label>
            <input
              id="cNotes"
              placeholder="Example: 12-person team, wants faster enquiry handling"
              value={clientDraft.notes}
              onChange={(e) => setClientDraft({ ...clientDraft, notes: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="chead">
          <span className="ic sage">
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
              <path d="M12 2l9 5-9 5-9-5 9-5z" />
              <path d="M3 12l9 5 9-5" />
              <path d="M3 17l9 5 9-5" />
            </svg>
          </span>
          <div>
            <h2>Services</h2>
            <div className="sub">
              Select the services you will offer for this product. These filter the workflow menu
              below.
            </div>
          </div>
          <div className="right">
            <span className="countpill">{selected.length} SELECTED</span>
            <button type="button" className="linkbtn" onClick={() => allSvc(true)}>
              Select all
            </button>
            <button type="button" className="linkbtn" onClick={() => allSvc(false)}>
              Clear
            </button>
          </div>
        </div>
        <div className="sect">
          <div className="grid2">
            {product.services.map((svc) => {
              const on = selected.includes(svc.id);
              return (
                <button
                  key={svc.id}
                  type="button"
                  className={on ? "svc on" : "svc"}
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggleService(svc.id)}
                >
                  <span className="box">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </span>
                  <span>{svc.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className={ctaInvalid ? "cta invalid" : "cta"}>
        <span className="ic">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
            <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
            <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
          </svg>
        </span>
        <div>
          <h3>Your {title} Agency workspace is ready.</h3>
          <p>
            Complete your setup, select your services and use the guided workflows below — all in
            one workspace.
          </p>
          <p className="warn">
            Fill the required fields marked * and select at least one service to continue.
          </p>
        </div>
        <button type="button" className="go" onClick={() => void saveAndFocusWorkflows()}>
          Go to Workflows <span aria-hidden>↓</span>
        </button>
      </div>

      <div className="card" id="workflows">
        <div className="chead">
          <span className="ic">
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M8 6h13M8 12h13M8 18h13" />
              <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
            </svg>
          </span>
          <div>
            <h2>Workflows</h2>
            <div className="sub">
              {selected.length === 0
                ? "Select at least one service above to see matching workflows."
                : loadingWf
                  ? "Loading workflows…"
                  : `${menuTotal} guided workflows for your selected services.`}
            </div>
          </div>
        </div>
        <div className="sect">
          <div className="field mini">
            <label htmlFor="wfSearch">Search workflows</label>
            <input
              id="wfSearch"
              placeholder="Filter by name or purpose…"
              value={wfSearch}
              onChange={(e) => setWfSearch(e.target.value)}
              disabled={selected.length === 0}
            />
          </div>
        </div>
        <div>
          {selected.length === 0 ? (
            <p className="hint" style={{ padding: "0 28px 24px" }}>
              Select services in the Services card to unlock your workflow menu.
            </p>
          ) : (
            <>
              {menuGroups.map((group) => (
                <div key={group.serviceId} className="group">
                  <h4>{group.title}</h4>
                  <div className="gcount">
                    {group.items.length} {group.items.length === 1 ? "workflow" : "workflows"}
                  </div>
                  <div className="wfgrid">
                    {group.items.map((w) => {
                      const svcTitle =
                        (w.serviceResourceId && serviceMap.get(w.serviceResourceId)?.title) ||
                        group.title;
                      const wfBadge =
                        typeof w.displayOrder === "number" && w.displayOrder > 0
                          ? ` · Workflow ${w.displayOrder}`
                          : "";
                      return (
                        <div key={w.id} className={activeWfId === w.id ? "wf active" : "wf"}>
                          <span className="catchip" style={{ marginBottom: 8 }}>
                            {svcTitle}
                            {wfBadge}
                          </span>
                          <b>{w.name}</b>
                          <p>{w.purpose || w.description}</p>
                          <button
                            type="button"
                            className="open"
                            onClick={() => void openWorkflow(w)}
                          >
                            Open →
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {!loadingWf && menuTotal === 0 ? (
                <p className="hint" style={{ padding: "0 28px 24px" }}>
                  {wfSearch.trim()
                    ? "No workflows match your search for the selected services."
                    : "No workflows for the selected services."}
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>

      {activeWf ? (
        <InlineWorkflowRunner
          workflow={activeWf}
          productId={product.id}
          productName={product.name}
          serviceTitle={
            (activeWf.serviceResourceId &&
              serviceMap.get(activeWf.serviceResourceId)?.title) ||
            ""
          }
          setup={setup}
          clientDraft={clientDraft}
          ensureClientAndProject={ensureClientAndProject}
          onClose={closeRunner}
          onToast={showToast}
        />
      ) : null}

      <div className="card" id="resources">
        <div className="chead">
          <span className="ic sage">
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </span>
          <div>
            <h2>Resources</h2>
            <div className="sub">
              Operator guides, sales assets and strategy for this product.{" "}
              <Link href="/wiki" className="linkbtn" style={{ display: "inline", padding: 0 }}>
                Open Agency Wiki →
              </Link>
            </div>
          </div>
        </div>
        {libraryResources.length === 0 ? (
          <p className="hint" style={{ padding: "0 28px 24px" }}>
            No library resources for this product yet. Visit the{" "}
            <Link href="/wiki">Agency Wiki</Link> for shared operating notes.
          </p>
        ) : (
          <>
            <div className="sect" style={{ paddingBottom: 8 }}>
              <div className="btnrow" role="tablist" aria-label="Resource types">
                {libraryResources.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    role="tab"
                    aria-selected={activeResource?.id === r.id}
                    className={activeResource?.id === r.id ? "btn primary" : "btn ghost"}
                    onClick={() => setActiveResourceId(r.id)}
                  >
                    {RESOURCE_LABELS[r.type] || r.title}
                  </button>
                ))}
              </div>
            </div>
            {activeResource ? (
              <div className="sect">
                <h4>{activeResource.title}</h4>
                {activeResource.description ? (
                  <div className="hint">{activeResource.description}</div>
                ) : null}
                <ResourcePreview resource={activeResource} productSlug={slug} />
              </div>
            ) : null}
          </>
        )}
      </div>

      <footer className="site">
        <div className="fb">
          <span className="bn">AI ENTERPRISE STUDIO</span>
          <span className="sep" />
          <span>Own the system. Deliver with judgment.</span>
        </div>
      </footer>

      <div className={toast ? "toast show" : "toast"}>{toast}</div>
    </>
  );
}

function ResourcePreview({
  resource,
  productSlug,
}: {
  resource: ProductResource;
  productSlug: string;
}) {
  const content = (resource.content || {}) as Record<string, unknown>;
  if (resource.type === "SALES_PAGE") {
    const html = typeof content.html === "string" && content.html.trim() ? content.html : null;
    if (html) {
      return (
        <iframe
          title={resource.title}
          style={{
            width: "100%",
            minHeight: 420,
            border: "1px solid var(--line)",
            borderRadius: 12,
            background: "#fff",
          }}
          srcDoc={html}
        />
      );
    }
    return (
      <div>
        <p className="hint" style={{ marginBottom: 10 }}>
          Live sales page. Use the header <strong>Sales Page</strong> tab to open it, then download the HTML.
        </p>
        <iframe
          title={resource.title}
          style={{
            width: "100%",
            minHeight: 480,
            border: "1px solid var(--line)",
            borderRadius: 12,
            background: "#fff",
          }}
          src={`/sales/${productSlug}`}
        />
      </div>
    );
  }
  const body = content.body;
  if (body && typeof body === "object") {
    return (
      <div>
        {Object.entries(body as Record<string, unknown>).map(([key, value]) => (
          <div key={key} style={{ marginBottom: 14 }}>
            <h4 style={{ marginBottom: 6 }}>{key.replace(/([A-Z])/g, " $1")}</h4>
            {Array.isArray(value) ? (
              <ul style={{ margin: 0, paddingLeft: 18, color: "var(--muted)" }}>
                {value.map((item) => (
                  <li key={String(item)}>{String(item)}</li>
                ))}
              </ul>
            ) : (
              <p className="hint" style={{ margin: 0 }}>
                {String(value)}
              </p>
            )}
          </div>
        ))}
      </div>
    );
  }
  const nested = content.strategy || content.copy || content.positioning || content;
  return (
    <pre
      className="promptbox"
      style={{ whiteSpace: "pre-wrap", maxHeight: 360, overflow: "auto", fontSize: 13 }}
    >
      {JSON.stringify(nested, null, 2)}
    </pre>
  );
}
