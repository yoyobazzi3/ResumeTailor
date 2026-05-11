/**
 * Shared top navigation bar rendered on all protected pages.
 *
 * Shows the app name (links to /dashboard), nav links to Dashboard and
 * Profile (resume bullets), and a Sign out button. NavLink's isActive callback is used
 * to highlight the current route without manual path comparisons.
 */

import { useNavigate, NavLink } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

export default function Navbar() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const firstName = useAuthStore((s) => s.first_name);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <NavLink to="/dashboard" className="text-lg font-bold text-gray-900 tracking-tight">
        JobLens
      </NavLink>
      <nav className="flex items-center gap-6">
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `text-sm font-medium transition-colors ${isActive ? "text-indigo-600" : "text-gray-500 hover:text-gray-900"}`
          }
        >
          Dashboard
        </NavLink>
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `text-sm font-medium transition-colors ${isActive ? "text-indigo-600" : "text-gray-500 hover:text-gray-900"}`
          }
        >
          Profile
        </NavLink>
        {firstName && (
          <span className="text-sm text-gray-500">Hi, {firstName}</span>
        )}
        <button
          onClick={handleLogout}
          className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
        >
          Sign out
        </button>
      </nav>
    </header>
  );
}
