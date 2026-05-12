import { useState, type FormEvent, type ChangeEvent } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../lib/api";
import { useAuthStore } from "../store/authStore";

function getPasswordStrength(password: string): { label: string; color: string; width: string } {
  if (password.length === 0) return { label: "", color: "", width: "0%" };
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const variety = [hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
  if (password.length >= 12 && variety >= 2) return { label: "Strong", color: "bg-green-500", width: "100%" };
  if (password.length >= 8 && variety >= 1) return { label: "Fair", color: "bg-yellow-400", width: "66%" };
  return { label: "Weak", color: "bg-red-500", width: "33%" };
}

const EyeIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const EyeOffIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.477 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
  </svg>
);

const BenefitLine = ({ text }: { text: string }) => (
  <div className="flex items-start gap-3">
    <svg className="w-5 h-5 text-indigo-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
    <span className="text-slate-300 text-sm">{text}</span>
  </div>
);

export default function Register() {
  const navigate = useNavigate();
  const { setAuth, token } = useAuthStore();

  const [fields, setFields] = useState({ firstName: "", lastName: "", email: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  if (token) return <Navigate to="/dashboard" replace />;

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFields((prev) => ({ ...prev, [name]: value }));

    if (name === "confirmPassword" || name === "password") {
      const pw = name === "password" ? value : fields.password;
      const cpw = name === "confirmPassword" ? value : fields.confirmPassword;
      if (cpw && pw !== cpw) {
        setErrors((prev) => ({ ...prev, confirmPassword: "Passwords do not match" }));
      } else {
        setErrors((prev) => { const next = { ...prev }; delete next.confirmPassword; return next; });
      }
    } else {
      setErrors((prev) => { const next = { ...prev }; delete next[name]; return next; });
    }
  }

  function validate() {
    const next: Record<string, string> = {};
    if (!fields.firstName.trim()) next.firstName = "First name is required";
    if (!fields.lastName.trim()) next.lastName = "Last name is required";
    if (!fields.email.trim()) next.email = "Enter a valid email address";
    if (fields.password.length < 8) next.password = "Password must be at least 8 characters";
    if (fields.password !== fields.confirmPassword) next.confirmPassword = "Passwords do not match";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const { data } = await api.post("/api/auth/register", {
        first_name: fields.firstName,
        last_name: fields.lastName,
        email: fields.email,
        password: fields.password,
        confirm_password: fields.confirmPassword,
      });
      setAuth(data.access_token, data.first_name, false);
      navigate("/onboarding");
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (detail === "Email already registered") {
        setErrors((prev) => ({ ...prev, email: "This email is already registered" }));
      } else if (Array.isArray(detail)) {
        toast.error(detail.map((d: any) => d.msg).join(", "));
      } else {
        toast.error(detail ?? "Registration failed");
      }
    } finally {
      setLoading(false);
    }
  }

  const strength = getPasswordStrength(fields.password);

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      {/* Left branding panel */}
      <div className="hidden md:flex flex-col justify-center px-12 bg-[#0f172a]">
        <div className="mb-10">
          <span className="text-2xl font-bold text-white tracking-tight">JobLens</span>
          <p className="mt-3 text-slate-400 text-sm leading-relaxed">
            Land your next job faster with AI-powered resume tailoring.
          </p>
        </div>
        <div className="space-y-4">
          <BenefitLine text="AI tailors your resume to every job description" />
          <BenefitLine text="Track every application in one place" />
          <BenefitLine text="Export ATS-friendly PDFs in one click" />
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 bg-white">
        <div className="max-w-sm w-full mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <Link to="/" className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Back to home">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-2xl font-semibold text-gray-900">Create your account</h1>
          </div>
          <p className="text-sm text-gray-500 mb-8">
            Already have an account?{" "}
            <Link to="/login" className="text-indigo-600 hover:underline">Sign in</Link>
          </p>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* First + Last name row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <input
                  name="firstName"
                  type="text"
                  value={fields.firstName}
                  onChange={handleChange}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.firstName ? "border-red-400" : "border-gray-300"}`}
                />
                {errors.firstName && <p className="mt-1 text-xs text-red-500">{errors.firstName}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <input
                  name="lastName"
                  type="text"
                  value={fields.lastName}
                  onChange={handleChange}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.lastName ? "border-red-400" : "border-gray-300"}`}
                />
                {errors.lastName && <p className="mt-1 text-xs text-red-500">{errors.lastName}</p>}
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                name="email"
                type="email"
                value={fields.email}
                onChange={handleChange}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.email ? "border-red-400" : "border-gray-300"}`}
              />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={fields.password}
                  onChange={handleChange}
                  className={`w-full border rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.password ? "border-red-400" : "border-gray-300"}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {fields.password && (
                <div className="mt-2">
                  <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${strength.color}`} style={{ width: strength.width }} />
                  </div>
                  <p className={`mt-1 text-xs ${strength.color === "bg-green-500" ? "text-green-600" : strength.color === "bg-yellow-400" ? "text-yellow-600" : "text-red-500"}`}>
                    {strength.label}
                  </p>
                </div>
              )}
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <div className="relative">
                <input
                  name="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  value={fields.confirmPassword}
                  onChange={handleChange}
                  className={`w-full border rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.confirmPassword ? "border-red-400" : "border-gray-300"}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {errors.confirmPassword && <p className="mt-1 text-xs text-red-500">{errors.confirmPassword}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors mt-2"
            >
              {loading ? "Creating account…" : "Create Account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
