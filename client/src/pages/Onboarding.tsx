import { useState, useRef, type DragEvent, type ChangeEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../lib/api";
import { useAuthStore } from "../store/authStore";

type UploadResult = { work_experiences: number; projects: number; education: number } | null;

const steps = ["Welcome", "Set Up Your Resume", "Add Your First Job"];

function ProgressBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-10">
      {steps.map((label, i) => {
        const idx = i + 1;
        const done = idx < current;
        const active = idx === current;
        return (
          <div key={label} className="flex items-center gap-2 flex-1">
            <div className="flex items-center gap-2 flex-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                  done ? "bg-indigo-600 text-white" : active ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-500"
                }`}
              >
                {done ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  idx
                )}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${active ? "text-indigo-600" : done ? "text-gray-500" : "text-gray-400"}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 flex-1 rounded-full mx-2 ${done ? "bg-indigo-600" : "bg-gray-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Step1({ firstName, onNext }: { firstName: string; onNext: () => void }) {
  return (
    <div className="max-w-lg mx-auto text-center">
      <h1 className="text-3xl font-bold text-gray-900 mb-3">Welcome to JobLens, {firstName}!</h1>
      <p className="text-gray-500 mb-10">Let us show you how it works in two minutes.</p>
      <div className="space-y-4 text-left mb-10">
        {[
          { icon: "📄", text: "Upload your resume → Claude extracts your bullets" },
          { icon: "🎯", text: "Add a job + paste the description → Claude tailors your resume" },
          { icon: "📥", text: "Edit, export, and apply with a resume built for that exact job" },
        ].map(({ icon, text }) => (
          <div key={text} className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
            <span className="text-xl">{icon}</span>
            <span className="text-sm text-gray-700">{text}</span>
          </div>
        ))}
      </div>
      <button
        onClick={onNext}
        className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-8 py-3 rounded-lg transition-colors text-sm"
      >
        Get Started
      </button>
    </div>
  );
}

function Step2({ onNext }: { onNext: (result: UploadResult) => void }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    if (!file.type.includes("pdf")) {
      toast.error("Please upload a PDF file");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post("/api/resume/upload", form);
      setResult({
        work_experiences: data.work_experiences ?? 0,
        projects: data.projects ?? 0,
        education: data.education ?? 0,
      });
    } catch {
      toast.error("Failed to parse resume. Try again or set up manually.");
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Set up your resume</h1>
      <p className="text-gray-500 mb-8 text-sm">This is what Claude will tailor for each job you apply to.</p>

      <div className="space-y-4">
        {/* Upload card */}
        <div className="border-2 border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Upload PDF Resume</h3>
              <p className="text-xs text-gray-500">Claude will extract your work experience and projects</p>
            </div>
          </div>

          {!result && !uploading && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                dragging ? "border-indigo-400 bg-indigo-50" : "border-gray-300 hover:border-gray-400"
              }`}
            >
              <p className="text-sm text-gray-500">Drag & drop your PDF here, or <span className="text-indigo-600 font-medium">browse</span></p>
              <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
            </div>
          )}

          {uploading && (
            <div className="flex items-center gap-3 py-4">
              <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-gray-600">Claude is reading your resume...</span>
            </div>
          )}

          {result && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm font-medium text-green-800 mb-1">Resume parsed successfully</p>
              <p className="text-xs text-green-700">
                Found {result.work_experiences} work experience{result.work_experiences !== 1 ? "s" : ""},{" "}
                {result.projects} project{result.projects !== 1 ? "s" : ""},{" "}
                {result.education} education record{result.education !== 1 ? "s" : ""}
              </p>
              <button
                onClick={() => onNext(result)}
                className="mt-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
              >
                Looks good, continue
              </button>
              <button
                onClick={() => onNext(null)}
                className="mt-2 block text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Something looks wrong, I'll set it up manually
              </button>
            </div>
          )}
        </div>

        {/* Manual card */}
        <div className="border-2 border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">I'll set it up manually</h3>
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-4">You can add your experience and projects on the Profile page after setup.</p>
          <button
            onClick={() => onNext(null)}
            className="border border-gray-300 hover:border-gray-400 text-gray-700 text-sm font-medium px-5 py-2 rounded-lg transition-colors"
          >
            Continue
          </button>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-gray-400">You can always update this later on your Profile page</p>
    </div>
  );
}

function Step3({ onSkip }: { onSkip: () => void }) {
  const navigate = useNavigate();
  const setOnboardingCompleted = useAuthStore((s) => s.setOnboardingCompleted);
  const [fields, setFields] = useState({ company: "", role: "", jobUrl: "", jobDescription: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    const next: Record<string, string> = {};
    if (!fields.company.trim()) next.company = "Company is required";
    if (!fields.role.trim()) next.role = "Role is required";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      await api.post("/api/applications", {
        company: fields.company,
        role: fields.role,
        job_url: fields.jobUrl || null,
        job_description: fields.jobDescription || null,
      });
      await api.patch("/api/auth/onboarding-complete");
      setOnboardingCompleted();
      navigate("/dashboard");
      toast.success("Application added! Tailoring your resume in the background...");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Add a job you're applying to</h1>
      <p className="text-gray-500 mb-8 text-sm">
        Paste the job description and Claude will tailor your resume to it automatically.
      </p>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={fields.company}
              onChange={(e) => { setFields((p) => ({ ...p, company: e.target.value })); setErrors((p) => { const n = { ...p }; delete n.company; return n; }); }}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.company ? "border-red-400" : "border-gray-300"}`}
              placeholder="e.g. Stripe"
            />
            {errors.company && <p className="mt-1 text-xs text-red-500">{errors.company}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={fields.role}
              onChange={(e) => { setFields((p) => ({ ...p, role: e.target.value })); setErrors((p) => { const n = { ...p }; delete n.role; return n; }); }}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.role ? "border-red-400" : "border-gray-300"}`}
              placeholder="e.g. Software Engineer"
            />
            {errors.role && <p className="mt-1 text-xs text-red-500">{errors.role}</p>}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Job URL <span className="text-gray-400 font-normal">(optional)</span></label>
          <input
            type="url"
            value={fields.jobUrl}
            onChange={(e) => setFields((p) => ({ ...p, jobUrl: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="https://..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Job Description <span className="text-gray-400 font-normal">(optional but recommended)</span>
          </label>
          <textarea
            value={fields.jobDescription}
            onChange={(e) => setFields((p) => ({ ...p, jobDescription: e.target.value }))}
            rows={6}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            placeholder="Paste the full job description here — the more detail, the better the tailoring"
          />
          <p className="mt-1 text-xs text-gray-400">
            Tip: copy the entire job posting including requirements and responsibilities
          </p>
        </div>
      </div>

      <div className="mt-8 flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-2.5 rounded-lg transition-colors text-sm disabled:opacity-50"
        >
          {loading ? "Adding job…" : "Add Job and Tailor Resume"}
        </button>
        <button
          onClick={onSkip}
          disabled={loading}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors px-2"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { token, first_name, onboarding_completed, setOnboardingCompleted } = useAuthStore();
  const [step, setStep] = useState(1);

  if (!token) return <Navigate to="/login" replace />;
  if (onboarding_completed) return <Navigate to="/dashboard" replace />;

  async function handleSkip() {
    try {
      await api.patch("/api/auth/onboarding-complete");
      setOnboardingCompleted();
      navigate("/dashboard");
    } catch {
      navigate("/dashboard");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-2">
          <span className="text-lg font-bold text-gray-900">JobLens</span>
        </div>
        <p className="text-xs text-gray-400 mb-8">Step {step} of {steps.length}</p>

        <ProgressBar current={step} />

        {step === 1 && (
          <Step1 firstName={first_name || "there"} onNext={() => setStep(2)} />
        )}
        {step === 2 && (
          <Step2 onNext={() => setStep(3)} />
        )}
        {step === 3 && (
          <Step3 onSkip={handleSkip} />
        )}
      </div>
    </div>
  );
}
