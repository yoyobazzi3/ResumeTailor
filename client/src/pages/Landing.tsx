import { Link, Navigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

const steps = [
  {
    num: "1",
    title: "Upload your resume",
    desc: "Paste your resume once. Claude extracts your bullets automatically.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    num: "2",
    title: "Paste the job description",
    desc: "Add any job you're applying to and paste the description.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    num: "3",
    title: "Get your tailored resume",
    desc: "Claude rewrites your bullets to match the job, scores the fit, and flags missing keywords.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
];

const features = [
  {
    title: "AI Resume Tailoring",
    desc: "Your bullets rewritten to match the job description's exact language and keywords.",
  },
  {
    title: "Match Score",
    desc: "Know how well your resume fits before you apply. See what keywords you're missing.",
  },
  {
    title: "Application Tracker",
    desc: "Track every application through every stage with a full status timeline.",
  },
  {
    title: "ATS-Ready PDF Export",
    desc: "One-click export to a clean, single-page PDF that passes ATS scanners.",
  },
];

export default function Landing() {
  const token = useAuthStore((s) => s.token);
  if (token) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero */}
      <section className="bg-[#0f172a] text-white">
        <div className="max-w-4xl mx-auto px-6 py-24 text-center">
          <div className="mb-8">
            <span className="text-2xl font-bold tracking-tight text-white">JobLens</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-6">
            Tailor your resume to every job.{" "}
            <span className="text-indigo-400">Automatically.</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
            JobLens uses AI to rewrite your resume bullets to match any job description, scores the match, and exports an ATS-ready PDF — so you apply smarter, not harder.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/register"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-8 py-3 rounded-lg transition-colors text-sm"
            >
              Get Started Free
            </Link>
            <Link
              to="/login"
              className="border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white font-medium px-8 py-3 rounded-lg transition-colors text-sm"
            >
              Sign In
            </Link>
          </div>
          <p className="mt-4 text-slate-500 text-xs">No credit card required</p>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-white py-20">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-12">Three steps to a tailored resume</h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {steps.map((s) => (
              <div key={s.num} className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 mb-4">
                  {s.icon}
                </div>
                <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-1">Step {s.num}</div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-12">
            Everything you need to apply with confidence
          </h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {features.map((f) => (
              <div key={f.title} className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                <h3 className="text-base font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Start tailoring your resume today</h2>
          <Link
            to="/register"
            className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-8 py-3 rounded-lg transition-colors text-sm"
          >
            Create Your Free Account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-200 py-6">
        <div className="max-w-4xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm text-gray-500">JobLens — Built by Youssef Bazzi</span>
          <div className="flex gap-6">
            <Link to="/login" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Sign In</Link>
            <Link to="/register" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
