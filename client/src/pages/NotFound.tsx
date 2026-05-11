/**
 * Catch-all 404 page rendered for any route that doesn't match a defined path.
 * Wired as path="*" in main.tsx so it only activates after all other routes fail.
 */

import { useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
      <p className="text-6xl font-bold text-gray-200">404</p>
      <p className="text-lg font-medium text-gray-700">Page not found</p>
      <button
        onClick={() => navigate("/dashboard")}
        className="mt-2 text-sm text-indigo-600 hover:underline"
      >
        Back to Dashboard
      </button>
    </div>
  );
}
