/**
 * Card component representing a single job application in the Dashboard list.
 *
 * Props:
 * - app: ApplicationResponse shape including company, role, status, match_score,
 *        applied_at, and created_at.
 *
 * Clicking the card navigates to /applications/:id.
 * The match score pill is color-coded: green ≥70, yellow 40–69, red <40.
 */

import { useNavigate } from "react-router-dom";

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

const STATUS_COLORS: Record<string, string> = {
  saved: "bg-gray-100 text-gray-600",
  applied: "bg-blue-100 text-blue-700",
  phone_screen: "bg-yellow-100 text-yellow-700",
  technical: "bg-orange-100 text-orange-700",
  offer: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-600",
};

const STATUS_LABELS: Record<string, string> = {
  saved: "Saved",
  applied: "Applied",
  phone_screen: "Phone Screen",
  technical: "Technical",
  offer: "Offer",
  rejected: "Rejected",
};

function scoreColor(score: number) {
  if (score >= 70) return "bg-green-100 text-green-700";
  if (score >= 40) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-600";
}

/** Return a human-readable relative time string for display on cards. */
function daysSince(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export default function ApplicationCard({ app }: { app: Application }) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/applications/${app.id}`)}
      className="bg-white border border-gray-200 rounded-xl p-5 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate">{app.company}</p>
          <p className="text-sm text-gray-500 truncate">{app.role}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {app.is_tailoring ? (
            <span className="animate-pulse text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600">
              Tailoring…
            </span>
          ) : app.match_score != null ? (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${scoreColor(app.match_score)}`}>
              {app.match_score}%
            </span>
          ) : null}
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[app.status] ?? "bg-gray-100 text-gray-600"}`}>
            {STATUS_LABELS[app.status] ?? app.status}
          </span>
        </div>
      </div>
      {/* Prefer applied_at (user-set date) over created_at (system timestamp) for relevance. */}
      <div className="mt-3 text-xs text-gray-400">
        {app.applied_at
          ? `Applied ${daysSince(app.applied_at)}`
          : `Added ${daysSince(app.created_at)}`}
      </div>
    </div>
  );
}
