/**
 * Detail page for a single job application.
 *
 * Features:
 * - Inline status edit + status timeline
 * - Auto-saving job description
 * - AI tailoring with original vs tailored side-by-side view
 * - Word-level diff highlighting (toggle)
 * - Per-bullet edit / reset / copy
 * - ATS PDF export
 */

import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../lib/api";
import Navbar from "../components/Navbar";
import { BulletSkeleton } from "../components/Skeleton";
import Tooltip from "../components/Tooltip";
import { useTailoredResume } from "../hooks/useTailoredResume";
import type { TailoredResume } from "../hooks/useTailoredResume";

interface StatusHistoryItem {
  id: string;
  status: string;
  changed_at: string;
}

interface Application {
  id: string;
  company: string;
  role: string;
  status: string;
  match_score: number | null;
  applied_at: string | null;
  created_at: string;
  job_description: string | null;
  notes: string | null;
  status_history: StatusHistoryItem[];
}

interface UserProfile {
  full_name: string | null;
}

const STATUSES = ["saved", "applied", "phone_screen", "technical", "offer", "rejected"];
const STATUS_LABELS: Record<string, string> = {
  saved: "Saved", applied: "Applied", phone_screen: "Phone Screen",
  technical: "Technical", offer: "Offer", rejected: "Rejected",
};
const STATUS_COLORS: Record<string, string> = {
  saved: "bg-gray-100 text-gray-600",
  applied: "bg-blue-50 text-blue-700",
  phone_screen: "bg-yellow-50 text-yellow-700",
  technical: "bg-orange-50 text-orange-700",
  offer: "bg-emerald-50 text-emerald-700",
  rejected: "bg-rose-50 text-rose-600",
};

function scoreColor(s: number) {
  if (s >= 70) return { text: "text-emerald-600", ring: "stroke-emerald-500", bg: "bg-emerald-50" };
  if (s >= 40) return { text: "text-yellow-600", ring: "stroke-yellow-400", bg: "bg-yellow-50" };
  return { text: "text-rose-500", ring: "stroke-rose-400", bg: "bg-rose-50" };
}

async function copyText(text: string, label = "Copied!") {
  await navigator.clipboard.writeText(text);
  toast.success(label);
}

// ── Match score ring ──────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const colors = scoreColor(score);
  return (
    <div className={`relative inline-flex items-center justify-center w-20 h-20 rounded-full ${colors.bg}`}>
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="4" className="text-gray-200" />
        <circle
          cx="32" cy="32" r={r} fill="none"
          strokeWidth="4"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={`${colors.ring} transition-all duration-700`}
        />
      </svg>
      <span className={`text-lg font-bold ${colors.text}`}>{score}%</span>
    </div>
  );
}

// ── Auto-resize textarea ──────────────────────────────────────────────────────

function AutoResizeTextarea({ value, onChange, className }: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = `${ref.current.scrollHeight}px`;
    }
  }, [value]);
  return (
    <textarea
      ref={ref} rows={1} value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      style={{ overflow: "hidden", resize: "none" }}
    />
  );
}

// ── Word-level diff ───────────────────────────────────────────────────────────
// Highlights tokens in `tailored` that are new relative to `original`.
// Splits on whitespace boundaries so punctuation stays attached to words.

function wordDiff(original: string, tailored: string) {
  const origTokens = new Set(
    original.toLowerCase().split(/\s+/).map((w) => w.replace(/[^a-z0-9]/g, "")).filter(Boolean)
  );
  const tokens = tailored.split(/(\s+)/);
  return tokens.map((token) => {
    if (/^\s+$/.test(token)) return { token, isNew: false };
    const clean = token.toLowerCase().replace(/[^a-z0-9]/g, "");
    return { token, isNew: clean.length > 2 && !origTokens.has(clean) };
  });
}

function DiffBullet({ original, tailored }: { original: string; tailored: string }) {
  const tokens = wordDiff(original, tailored);
  return (
    <p className="text-sm text-gray-800 leading-relaxed">
      {tokens.map((t, i) =>
        t.isNew ? (
          <mark key={i} className="bg-green-100 text-green-900 rounded px-0.5 not-italic">
            {t.token}
          </mark>
        ) : (
          <span key={i}>{t.token}</span>
        )
      )}
    </p>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [app, setApp] = useState<Application | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [tailoring, setTailoring] = useState(false);
  const [bullets, setBullets] = useState<{ id: string; content: string }[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [editedBullets, setEditedBullets] = useState<string[]>([]);
  const [showDiff, setShowDiff] = useState(false);

  const {
    tailoredResume, isLoading: tailoredLoading,
    savingStatus, saveBullets, exportPDF, resetBullet, refetch: refetchTailored,
  } = useTailoredResume(id!);

  useEffect(() => {
    if (tailoredResume) {
      setEditedBullets(
        (tailoredResume.edited_bullets as string[] | null) ??
          (tailoredResume.tailored_bullets as string[])
      );
    }
  }, [tailoredResume?.id]);

  async function fetchApp() {
    const { data } = await api.get(`/api/applications/${id}`);
    setApp(data);
    return data as Application;
  }

  useEffect(() => {
    Promise.all([
      api.get(`/api/applications/${id}`),
      api.get("/api/resume/bullets"),
      api.get<UserProfile>("/api/auth/me"),
    ])
      .then(([appRes, bulletsRes, profileRes]) => {
        const a: Application = appRes.data;
        setApp(a);
        setJobDescription(a.job_description ?? "");
        setBullets(bulletsRes.data);
        setUserProfile(profileRes.data);
      })
      .catch(() => {
        toast.error("Failed to load application");
        navigate("/dashboard");
      });
  }, [id]);

  async function handleStatusChange(newStatus: string) {
    try {
      const { data } = await api.patch(`/api/applications/${id}`, { status: newStatus });
      setApp(data);
      toast.success(`Status → ${STATUS_LABELS[newStatus]}`);
    } catch {
      toast.error("Failed to update status");
    }
  }

  async function handleJdBlur() {
    try {
      await api.patch(`/api/applications/${id}`, { job_description: jobDescription });
    } catch {
      toast.error("Failed to save job description");
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete ${app?.company} – ${app?.role}? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/applications/${id}`);
      toast.success("Application deleted");
      navigate("/dashboard");
    } catch {
      toast.error("Failed to delete application");
    }
  }

  async function handleTailor() {
    if (!jobDescription.trim()) { toast.error("Paste a job description first"); return; }
    if (bullets.length === 0) { toast.error("Add resume bullets in your Profile first"); return; }
    setTailoring(true);
    try {
      await api.patch(`/api/applications/${id}`, { job_description: jobDescription });
      const { data } = await api.post<TailoredResume>("/api/resume/tailor", { application_id: id });
      await refetchTailored();
      const fresh = await fetchApp();
      setApp(fresh);
      toast.success(`Tailored! Match score: ${data.match_score}%`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? "Tailoring failed");
    } finally {
      setTailoring(false);
    }
  }

  function handleBulletChange(index: number, value: string) {
    const next = [...editedBullets];
    next[index] = value;
    setEditedBullets(next);
    saveBullets(next);
  }

  function handleResetBullet(index: number) {
    const original = resetBullet(index);
    if (original === undefined) return;
    const next = [...editedBullets];
    next[index] = original;
    setEditedBullets(next);
    saveBullets(next);
  }

  const profileIncomplete = !userProfile?.full_name;

  if (!app) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-5xl mx-auto px-6 py-16 text-center text-gray-400">Loading…</div>
      </div>
    );
  }

  const origBullets = tailoredResume?.original_bullets as string[] | undefined;
  const tailoredB = tailoredResume?.tailored_bullets as string[] | undefined;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* ── Sub-header ─────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        <button onClick={() => navigate("/dashboard")} className="text-sm text-gray-400 hover:text-gray-700 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Dashboard
        </button>
        <span className="text-gray-200">/</span>
        <span className="font-semibold text-gray-800 text-sm">{app.company}</span>
        <span className="text-gray-300">—</span>
        <span className="text-sm text-gray-500">{app.role}</span>
        <div className="ml-auto flex items-center gap-3">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[app.status]}`}>
            {STATUS_LABELS[app.status]}
          </span>
          <button onClick={handleDelete} className="text-sm text-red-400 hover:text-red-600 transition-colors">
            Delete
          </button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-5">

        {/* ── Overview card ──────────────────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="flex items-center gap-5 flex-wrap">
              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Status</label>
                <select
                  value={app.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              </div>

              {/* Applied date */}
              {(app.applied_at || app.created_at) && (
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Added</label>
                  <p className="text-sm text-gray-700">
                    {new Date(app.applied_at ?? app.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>
              )}

              {/* Notes */}
              {app.notes && (
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Notes</label>
                  <p className="text-sm text-gray-700 max-w-xs">{app.notes}</p>
                </div>
              )}
            </div>

            {/* Match score ring */}
            {app.match_score != null && (
              <Tooltip content="AI-generated score (0–100) based on keyword overlap between your resume and this job. Higher = better fit." position="left">
                <div className="text-center cursor-default">
                  <ScoreRing score={app.match_score} />
                  <p className="text-xs text-gray-400 mt-1">Match</p>
                </div>
              </Tooltip>
            )}
          </div>
        </div>

        {/* ── Job description ────────────────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Job Description</h3>
              <p className="text-xs text-gray-400">Auto-saves when you click away.</p>
            </div>
            {jobDescription.trim() && (
              <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
                {jobDescription.trim().split(/\s+/).length} words
              </span>
            )}
          </div>
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            onBlur={handleJdBlur}
            rows={8}
            placeholder="Paste the full job description here — the more complete, the better the tailoring…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y text-gray-700"
          />
        </div>

        {/* ── Resume Tailor ──────────────────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">

          {/* Header row */}
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div>
              <h3 className="font-semibold text-gray-900">AI Resume Tailor</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {bullets.length} bullet{bullets.length !== 1 ? "s" : ""} in your profile
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {tailoredResume && (
                <span className={`text-xs transition-opacity ${savingStatus === "idle" ? "opacity-0" : "opacity-100"} ${savingStatus === "saving" ? "text-gray-400" : "text-emerald-600"}`}>
                  {savingStatus === "saving" ? "Saving…" : "✓ Saved"}
                </span>
              )}

              {/* Diff toggle */}
              {tailoredResume && (
                <Tooltip content="Highlight word-level changes between your original and tailored bullets. Green = new words added." position="top">
                  <button
                    onClick={() => setShowDiff((v) => !v)}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                      showDiff
                        ? "bg-green-50 border-green-200 text-green-700"
                        : "bg-white border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600"
                    }`}
                  >
                    {showDiff ? "✦ Diff on" : "Show diff"}
                  </button>
                </Tooltip>
              )}

              {tailoredResume && (
                <button
                  onClick={() => {
                    const text = editedBullets.map((b) => `• ${b}`).join("\n");
                    copyText(text, "All bullets copied!");
                  }}
                  className="text-sm font-medium px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                >
                  Copy all
                </button>
              )}

              {tailoredResume && (
                <Tooltip
                  content={profileIncomplete ? "Add your full name in Profile to enable export" : "Download a clean, single-page ATS-optimized PDF using your tailored bullets."}
                  position="top"
                >
                  <button
                    onClick={exportPDF}
                    disabled={profileIncomplete}
                    className="text-sm font-medium px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Export PDF
                  </button>
                </Tooltip>
              )}

              <Tooltip content="Claude rewrites your resume bullets to match this job's language and keywords. Paste the full job description first for best results." position="top">
              <button
                onClick={handleTailor}
                disabled={tailoring}
                className="bg-indigo-600 text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
              >
                {tailoring ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Claude is tailoring…
                  </>
                ) : tailoredResume ? "Re-tailor" : "Tailor Resume"}
              </button>
              </Tooltip>
            </div>
          </div>

          {/* Bullets area */}
          {tailoring || tailoredLoading ? (
            <BulletSkeleton />
          ) : tailoredResume && origBullets && tailoredB ? (
            <div className="space-y-6">

              {/* Column headers */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Original</h4>
                </div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wide">Tailored</h4>
                  {showDiff && (
                    <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">
                      green = new words
                    </span>
                  )}
                </div>
              </div>

              {/* Side-by-side bullets */}
              <div className="space-y-3">
                {origBullets.map((orig, i) => {
                  const tailoredText = tailoredB[i] ?? "";
                  const currentText = editedBullets[i] ?? tailoredText;
                  const isEdited = currentText !== tailoredText;

                  return (
                    <div key={i} className="grid grid-cols-2 gap-4 items-start">
                      {/* Original */}
                      <div className="bg-gray-50 border border-gray-100 rounded-xl p-3.5">
                        {showDiff ? (
                          <DiffBullet original={orig} tailored={tailoredText} />
                        ) : (
                          <p className="text-sm text-gray-600 leading-relaxed">{orig}</p>
                        )}
                      </div>

                      {/* Tailored */}
                      <div className={`relative bg-indigo-50 border rounded-xl p-3.5 ${isEdited ? "border-amber-200" : "border-indigo-100"}`}>
                        {/* Actions row */}
                        <div className="flex items-center gap-1.5 mb-2">
                          {isEdited && (
                            <span className="text-xs font-semibold bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5 leading-none">
                              edited
                            </span>
                          )}
                          <Tooltip content="Revert this bullet to Claude's original tailoring, discarding your edits." position="top">
                            <button
                              onClick={() => handleResetBullet(i)}
                              className={`text-xs text-gray-400 hover:text-indigo-600 transition-colors leading-none ${!isEdited ? "invisible" : ""}`}
                            >
                              Reset
                            </button>
                          </Tooltip>
                          <button
                            onClick={() => copyText(currentText, "Bullet copied!")}
                            className="ml-auto text-xs font-medium text-indigo-400 hover:text-indigo-600 bg-white border border-indigo-200 rounded px-1.5 py-0.5 leading-none transition-colors"
                          >
                            Copy
                          </button>
                        </div>
                        <AutoResizeTextarea
                          value={currentText}
                          onChange={(v) => handleBulletChange(i, v)}
                          className="w-full text-sm text-gray-800 bg-transparent leading-relaxed focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom info row */}
              <div className="flex items-start gap-8 pt-2 flex-wrap">
                {tailoredResume.match_score != null && (
                  <div className="flex items-center gap-3">
                    <ScoreRing score={tailoredResume.match_score} />
                    <div>
                      <p className="text-xs text-gray-400 font-medium">AI Match Score</p>
                      {tailoredResume.reasoning && (
                        <p className="text-xs text-gray-500 italic mt-0.5 max-w-xs">{tailoredResume.reasoning}</p>
                      )}
                    </div>
                  </div>
                )}

                {tailoredResume.missing_keywords && tailoredResume.missing_keywords.length > 0 && (
                  <div>
                    <Tooltip content="Keywords found in the job description but not in your resume. Adding them can improve ATS ranking." position="right">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 cursor-default inline-block">Missing keywords</p>
                    </Tooltip>
                    <div className="flex flex-wrap gap-1.5">
                      {tailoredResume.missing_keywords.map((kw) => (
                        <span key={kw} className="text-xs bg-rose-50 text-rose-600 border border-rose-100 rounded-full px-2.5 py-1 font-medium">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-14 text-gray-400">
              <svg className="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <p className="font-medium text-gray-500 text-sm">
                {bullets.length === 0
                  ? "Upload your resume in Profile to get started."
                  : "Paste a job description above, then click Tailor Resume."}
              </p>
            </div>
          )}
        </div>

        {/* ── Status timeline ────────────────────────────────────────────── */}
        {app.status_history.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="font-semibold text-gray-900 mb-5 text-sm">Status Timeline</h3>
            <ol className="relative border-l-2 border-gray-100 space-y-4 ml-2">
              {[...app.status_history].reverse().map((h, i) => (
                <li key={h.id} className="pl-6 relative">
                  <span className={`absolute left-[-9px] top-0.5 h-4 w-4 rounded-full border-2 border-white shadow-sm ${
                    i === 0 ? "bg-indigo-500" : "bg-gray-300"
                  }`} />
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      STATUS_COLORS[h.status] ?? "bg-gray-100 text-gray-600"
                    }`}>
                      {STATUS_LABELS[h.status] ?? h.status}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(h.changed_at).toLocaleString("en-US", {
                        month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                      })}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </main>
    </div>
  );
}
