import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../lib/api";
import Navbar from "../components/Navbar";
import { CardSkeleton } from "../components/Skeleton";
import Tooltip from "../components/Tooltip";
import DashboardTour from "../components/DashboardTour";
import GettingStartedCard from "../components/GettingStartedCard";

interface Application {
  id: string;
  company: string;
  role: string;
  status: string;
  match_score: number | null;
  applied_at: string | null;
  created_at: string;
  is_tailoring: boolean;
}

const ALL_STATUSES = ["saved", "applied", "phone_screen", "technical", "offer", "rejected"];

const STATUS_LABELS: Record<string, string> = {
  saved: "Saved", applied: "Applied", phone_screen: "Phone Screen",
  technical: "Technical", offer: "Offer", rejected: "Rejected",
};

const STATUS_COLORS: Record<string, { col: string; badge: string; drop: string; dot: string }> = {
  saved:        { col: "border-t-gray-400",   badge: "bg-gray-100 text-gray-600",     drop: "bg-gray-50 border-gray-300",   dot: "bg-gray-400" },
  applied:      { col: "border-t-blue-500",   badge: "bg-blue-50 text-blue-700",      drop: "bg-blue-50 border-blue-400",   dot: "bg-blue-500" },
  phone_screen: { col: "border-t-yellow-400", badge: "bg-yellow-50 text-yellow-700",  drop: "bg-yellow-50 border-yellow-400", dot: "bg-yellow-400" },
  technical:    { col: "border-t-orange-500", badge: "bg-orange-50 text-orange-700",  drop: "bg-orange-50 border-orange-400", dot: "bg-orange-500" },
  offer:        { col: "border-t-emerald-500",badge: "bg-emerald-50 text-emerald-700",drop: "bg-emerald-50 border-emerald-400", dot: "bg-emerald-500" },
  rejected:     { col: "border-t-rose-400",   badge: "bg-rose-50 text-rose-600",      drop: "bg-rose-50 border-rose-400",   dot: "bg-rose-400" },
};

function scoreColor(s: number) {
  return s >= 70 ? "text-emerald-600 bg-emerald-50" : s >= 40 ? "text-yellow-600 bg-yellow-50" : "text-rose-500 bg-rose-50";
}

function relativeDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return "today";
  if (d === 1) return "1 day ago";
  if (d < 30) return `${d} days ago`;
  const w = Math.floor(d / 7);
  if (w < 8) return `${w}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

// ── Kanban compact card ───────────────────────────────────────────────────────

function KanbanCard({
  app,
  onDragStart,
  isDragging,
}: {
  app: Application;
  onDragStart: (e: React.DragEvent, id: string) => void;
  isDragging: boolean;
}) {
  const navigate = useNavigate();
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, app.id)}
      onClick={() => navigate(`/applications/${app.id}`)}
      className={`bg-white border border-gray-200 rounded-xl p-3.5 cursor-grab active:cursor-grabbing select-none transition-all duration-150 hover:shadow-md hover:border-indigo-200 group ${isDragging ? "opacity-40 scale-95" : ""}`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="font-semibold text-gray-900 text-sm leading-tight line-clamp-1 group-hover:text-indigo-700 transition-colors">
          {app.company}
        </span>
        {app.is_tailoring ? (
          <Tooltip content="Claude is tailoring your resume in the background. Check back in a few seconds." position="top">
            <span className="shrink-0 text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full animate-pulse font-medium cursor-default">AI…</span>
          </Tooltip>
        ) : app.match_score != null ? (
          <Tooltip content="AI match score — how well your resume fits this job. Ranges 0–100." position="top">
            <span className={`shrink-0 text-xs font-bold px-1.5 py-0.5 rounded-full cursor-default ${scoreColor(app.match_score)}`}>
              {app.match_score}%
            </span>
          </Tooltip>
        ) : null}
      </div>
      <p className="text-xs text-gray-500 line-clamp-1 mb-2">{app.role}</p>
      <p className="text-xs text-gray-400">{relativeDate(app.applied_at ?? app.created_at)}</p>
    </div>
  );
}

// ── Kanban column ─────────────────────────────────────────────────────────────

function KanbanColumn({
  status,
  apps,
  draggingId,
  dragOverStatus,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  status: string;
  apps: Application[];
  draggingId: string | null;
  dragOverStatus: string | null;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent, status: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, status: string) => void;
}) {
  const colors = STATUS_COLORS[status];
  const isOver = dragOverStatus === status;

  return (
    <div className="flex flex-col min-w-[240px] max-w-[240px]">
      {/* Column header */}
      <div className={`flex items-center justify-between px-3 py-2 rounded-t-xl border-t-[3px] border-x border-gray-200 bg-white ${colors.col}`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            {STATUS_LABELS[status]}
          </span>
        </div>
        <span className="text-xs font-bold text-gray-500 bg-gray-100 rounded-full px-2 py-0.5 min-w-[20px] text-center">
          {apps.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => onDragOver(e, status)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, status)}
        className={`flex-1 min-h-[480px] rounded-b-xl border border-t-0 border-gray-200 p-2 space-y-2 transition-colors duration-150 ${
          isOver ? `${colors.drop} border-dashed border-2` : "bg-gray-50"
        }`}
      >
        {apps.map((app) => (
          <KanbanCard
            key={app.id}
            app={app}
            onDragStart={onDragStart}
            isDragging={draggingId === app.id}
          />
        ))}
        {apps.length === 0 && (
          <div className={`h-20 rounded-lg flex items-center justify-center transition-colors ${isOver ? "border-2 border-dashed border-current opacity-40" : "opacity-0"}`}>
            <span className="text-xs font-medium">Drop here</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "kanban">(() =>
    (localStorage.getItem("dashboard_view") as "list" | "kanban") || "list"
  );
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [form, setForm] = useState({
    company: "", role: "", job_url: "", status: "saved", applied_at: "", notes: "", job_description: "",
  });
  const [showTour, setShowTour] = useState(false);
  const [checklistDismissed, setChecklistDismissed] = useState(
    localStorage.getItem("checklist_dismissed") === "true"
  );
  const [hasResume, setHasResume] = useState(false);
  const [extracting, setExtracting] = useState(false);

  async function fetchApps() {
    try {
      const { data } = await api.get("/api/applications/");
      setApps(data);
    } catch {
      toast.error("Failed to load applications");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchApps();
    api.get("/api/resume/bullets").then((r) => setHasResume(r.data.length > 0)).catch(() => {});
    if (!localStorage.getItem("tour_seen")) {
      setTimeout(() => setShowTour(true), 500);
    }
  }, []);

  function handleDismissChecklist() {
    localStorage.setItem("checklist_dismissed", "true");
    setChecklistDismissed(true);
  }

  function switchView(mode: "list" | "kanban") {
    setViewMode(mode);
    localStorage.setItem("dashboard_view", mode);
  }

  async function handleFetchJD() {
    if (!form.job_url) return;
    setExtracting(true);
    try {
      const { data } = await api.post("/api/applications/extract-jd", { url: form.job_url });
      setForm((f) => ({
        ...f,
        job_description: data.job_description ?? f.job_description,
        company: data.company && !f.company ? data.company : f.company,
        role: data.role && !f.role ? data.role : f.role,
      }));
      toast.success("Job description extracted");
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? "Couldn't fetch that URL");
    } finally {
      setExtracting(false);
    }
  }

  async function handleAdd(e: { preventDefault(): void }) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/api/applications/", {
        ...form,
        job_url: form.job_url || null,
        applied_at: form.applied_at || null,
        notes: form.notes || null,
        job_description: form.job_description || null,
      });
      toast.success(
        form.job_description.trim()
          ? "Application added — tailoring your resume in the background"
          : "Application added"
      );
      setShowForm(false);
      setForm({ company: "", role: "", job_url: "", status: "saved", applied_at: "", notes: "", job_description: "" });
      fetchApps();
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? "Failed to add application");
    } finally {
      setSubmitting(false);
    }
  }

  const stats = useMemo(() => {
    const responded = apps.filter((a) =>
      ["phone_screen", "technical", "offer", "rejected"].includes(a.status)
    ).length;
    const totalActive = apps.filter((a) => a.status !== "saved").length;
    const withScores = apps.filter((a) => a.match_score != null);
    const avgScore = withScores.length
      ? Math.round(withScores.reduce((s, a) => s + a.match_score!, 0) / withScores.length)
      : null;
    const active = apps.filter((a) => !["offer", "rejected"].includes(a.status)).length;
    const pipeline = ALL_STATUSES.map((s) => ({
      status: s,
      count: apps.filter((a) => a.status === s).length,
    }));
    return { total: apps.length, responseRate: totalActive > 0 ? Math.round((responded / totalActive) * 100) : null, avgScore, active, pipeline };
  }, [apps]);

  const visible = filter === "all" ? apps : apps.filter((a) => a.status === filter);

  const handleDragStart = useCallback((e: React.DragEvent, appId: string) => {
    e.dataTransfer.setData("text/plain", appId);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(appId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, status: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverStatus(status);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverStatus(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const appId = e.dataTransfer.getData("text/plain");
    setDraggingId(null);
    setDragOverStatus(null);
    const app = apps.find((a) => a.id === appId);
    if (!app || app.status === newStatus) return;
    setApps((prev) => prev.map((a) => a.id === appId ? { ...a, status: newStatus } : a));
    try {
      await api.patch(`/api/applications/${appId}`, { status: newStatus });
      toast.success(`Moved to ${STATUS_LABELS[newStatus]}`);
    } catch {
      toast.error("Failed to update status");
      fetchApps();
    }
  }, [apps]);

  const appsByStatus = useMemo(() => {
    const m: Record<string, Application[]> = {};
    ALL_STATUSES.forEach((s) => { m[s] = apps.filter((a) => a.status === s); });
    return m;
  }, [apps]);

  const statCards = [
    {
      label: "Total Applications",
      value: apps.length,
      tooltip: "Total job applications you've created across all stages",
      icon: (
        <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      sub: "tracked",
    },
    {
      label: "Response Rate",
      value: stats.responseRate != null ? `${stats.responseRate}%` : "—",
      tooltip: "Percentage of applications that moved past 'Saved' status — phone screen or beyond",
      icon: (
        <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      sub: "phone screen or beyond",
    },
    {
      label: "Avg Match Score",
      value: stats.avgScore != null ? `${stats.avgScore}%` : "—",
      tooltip: "Average AI match score across all tailored applications. Run tailoring on an application to see a score.",
      icon: (
        <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ),
      sub: "AI resume alignment",
    },
    {
      label: "Active Pipeline",
      value: stats.active,
      tooltip: "Applications not yet rejected or offered — still in active consideration",
      icon: (
        <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      sub: "in progress",
    },
  ];

  const hasTailored = apps.some((a) => a.match_score != null);

  return (
    <div className="min-h-screen bg-gray-50">
      {showTour && <DashboardTour onClose={() => setShowTour(false)} />}
      <Navbar />

      <main className="max-w-6xl mx-auto px-6 py-8">

        {/* ── Stats row ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {statCards.map(({ label, value, icon, sub, tooltip }) => (
            <Tooltip key={label} content={tooltip} position="bottom" className="block">
              <div className="w-full bg-white border border-gray-200 rounded-xl px-5 py-4 hover:shadow-sm transition-shadow cursor-default">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
                  {icon}
                </div>
                <p className="text-3xl font-bold text-gray-900">{value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
              </div>
            </Tooltip>
          ))}
        </div>

        {/* ── Getting Started checklist ─────────────────────────────────── */}
        {!checklistDismissed && (
          <GettingStartedCard
            hasResume={hasResume}
            hasApplications={apps.length > 0}
            hasTailored={hasTailored}
            onDismiss={handleDismissChecklist}
          />
        )}

        {/* ── Pipeline bar ───────────────────────────────────────────────── */}
        {apps.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 mb-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Application Pipeline</p>
            <div className="flex items-stretch gap-0">
              {stats.pipeline.map((p, i) => {
                const colors = STATUS_COLORS[p.status];
                return (
                  <div key={p.status} className="flex items-center flex-1">
                    <button
                      onClick={() => { setFilter(p.status); switchView("list"); }}
                      className={`flex-1 rounded-lg px-3 py-2.5 text-center transition-all hover:brightness-95 ${colors.badge}`}
                    >
                      <p className="text-lg font-bold leading-none">{p.count}</p>
                      <p className="text-xs mt-0.5 font-medium opacity-80">{STATUS_LABELS[p.status]}</p>
                    </button>
                    {i < stats.pipeline.length - 1 && (
                      <svg className="w-4 h-4 text-gray-300 shrink-0 mx-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Toolbar ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {viewMode === "list" && (
              <Tooltip content="Filter applications by stage" position="bottom">
                <div className="flex gap-1 flex-wrap">
                  {["all", ...ALL_STATUSES].map((s) => (
                    <button
                      key={s}
                      onClick={() => setFilter(s)}
                      className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                        filter === s
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "bg-white border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600"
                      }`}
                    >
                      {s === "all" ? "All" : STATUS_LABELS[s]}
                      {s !== "all" && (
                        <span className="ml-1 opacity-60">{apps.filter((a) => a.status === s).length}</span>
                      )}
                    </button>
                  ))}
                </div>
              </Tooltip>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Tooltip content="Switch between list and Kanban board views" position="bottom">
              <div className="flex bg-white border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => switchView("list")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                    viewMode === "list" ? "bg-indigo-600 text-white" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  List
                </button>
                <button
                  onClick={() => switchView("kanban")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors border-l border-gray-200 ${
                    viewMode === "kanban" ? "bg-indigo-600 text-white" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                  </svg>
                  Board
                </button>
              </div>
            </Tooltip>

            <Tooltip content="Add a new job application. Paste the job description to auto-tailor your resume." position="bottom">
              <button
                onClick={() => setShowForm((v) => !v)}
                className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
              >
                {showForm ? "Cancel" : "+ Add"}
              </button>
            </Tooltip>
          </div>
        </div>

        {/* ── Add form ───────────────────────────────────────────────────── */}
        {showForm && (
          <form onSubmit={handleAdd} className="bg-white border border-gray-200 rounded-xl p-6 mb-5 shadow-sm space-y-4">
            <h3 className="font-semibold text-gray-900">New Application</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Company *", key: "company", type: "text", required: true },
                { label: "Role *", key: "role", type: "text", required: true },
                { label: "Date Applied", key: "applied_at", type: "date", required: false },
              ].map(({ label, key, type, required }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    type={type}
                    required={required}
                    value={(form as any)[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job URL</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={form.job_url}
                    onChange={(e) => setForm({ ...form, job_url: e.target.value })}
                    placeholder="https://..."
                    className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    disabled={!form.job_url || extracting}
                    onClick={handleFetchJD}
                    className="shrink-0 text-sm font-medium px-3 py-2 rounded-lg border border-indigo-300 text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                  >
                    {extracting ? (
                      <span className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        Fetching…
                      </span>
                    ) : "Fetch JD"}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-400">Paste a Greenhouse, Lever, or company career page URL</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Recruiter contact, referral, etc."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Job Description <span className="text-gray-400 font-normal">(paste to auto-tailor resume in background)</span>
              </label>
              <textarea
                rows={4}
                value={form.job_description}
                onChange={(e) => setForm({ ...form, job_description: e.target.value })}
                placeholder="Paste the full job description here…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="bg-indigo-600 text-white text-sm font-medium px-5 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? "Saving…" : "Save Application"}
              </button>
            </div>
          </form>
        )}

        {/* ── Content ────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="grid gap-3">
            {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
          </div>
        ) : viewMode === "kanban" ? (
          <div
            className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1"
            onDragEnd={() => { setDraggingId(null); setDragOverStatus(null); }}
          >
            {ALL_STATUSES.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                apps={appsByStatus[status]}
                draggingId={draggingId}
                dragOverStatus={dragOverStatus}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              />
            ))}
          </div>
        ) : (
          visible.length === 0 ? (
            <div className="text-center py-24 text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-base font-medium text-gray-500">
                {filter === "all" ? "No applications yet" : `No ${STATUS_LABELS[filter]} applications`}
              </p>
              {filter === "all" && (
                <p className="text-sm mt-1">Click <strong>+ Add</strong> to track your first application.</p>
              )}
            </div>
          ) : (
            <div className="grid gap-3">
              {visible.map((app) => {
                const colors = STATUS_COLORS[app.status];
                return (
                  <a
                    key={app.id}
                    href={`/applications/${app.id}`}
                    className="block bg-white border border-gray-200 rounded-xl px-5 py-4 hover:shadow-md hover:border-indigo-200 transition-all group"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-1.5 h-10 rounded-full shrink-0 ${colors.dot}`} />
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors truncate">
                            {app.company}
                          </p>
                          <p className="text-sm text-gray-500 truncate">{app.role}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {app.is_tailoring ? (
                          <Tooltip content="Claude is tailoring your resume in the background. Check back in a few seconds." position="top">
                            <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-1 rounded-full animate-pulse font-medium cursor-default">
                              Tailoring…
                            </span>
                          </Tooltip>
                        ) : app.match_score != null ? (
                          <Tooltip content="AI match score — how well your resume fits this job. Ranges 0–100." position="top">
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full cursor-default ${scoreColor(app.match_score)}`}>
                              {app.match_score}% match
                            </span>
                          </Tooltip>
                        ) : null}
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${colors.badge}`}>
                          {STATUS_LABELS[app.status]}
                        </span>
                        <span className="text-xs text-gray-400 hidden sm:block">
                          {relativeDate(app.applied_at ?? app.created_at)}
                        </span>
                        <svg className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )
        )}
      </main>
    </div>
  );
}
