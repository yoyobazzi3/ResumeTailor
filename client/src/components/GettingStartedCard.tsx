import { Link } from "react-router-dom";

interface Props {
  hasResume: boolean;
  hasApplications: boolean;
  hasTailored: boolean;
  onDismiss: () => void;
}

interface CheckItem {
  label: string;
  done: boolean;
  link?: string;
  linkLabel?: string;
}

export default function GettingStartedCard({ hasResume, hasApplications, hasTailored, onDismiss }: Props) {
  const hasExported = localStorage.getItem("exported_pdf") === "true";

  const items: CheckItem[] = [
    { label: "Created your account", done: true },
    { label: "Set up your resume", done: hasResume, link: "/profile", linkLabel: "Go to Profile →" },
    { label: "Added your first application", done: hasApplications },
    { label: "Tailored a resume", done: hasTailored },
    { label: "Exported a PDF", done: hasExported },
  ];

  const completed = items.filter((i) => i.done).length;
  const allDone = completed === items.length;

  if (allDone) return null;

  const pct = Math.round((completed / items.length) * 100);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Getting started</h3>
          <p className="text-xs text-gray-400">{completed} of {items.length} complete</p>
        </div>
        <button
          onClick={onDismiss}
          className="text-gray-300 hover:text-gray-500 transition-colors text-lg leading-none"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>

      {/* Checklist */}
      <div className="space-y-2.5 mb-4">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            {item.done ? (
              <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ) : (
              <div className="w-5 h-5 rounded-full border-2 border-gray-300 shrink-0" />
            )}
            <span className={`text-sm flex-1 ${item.done ? "line-through text-gray-400" : "text-gray-700"}`}>
              {item.label}
            </span>
            {!item.done && item.link && (
              <Link
                to={item.link}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors shrink-0"
              >
                {item.linkLabel}
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
