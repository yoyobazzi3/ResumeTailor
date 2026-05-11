/**
 * Route guard for authenticated pages.
 *
 * Reads the token from authStore (which is initialised from localStorage on load)
 * and renders child routes via <Outlet> if authenticated, or redirects to /login
 * if not. `replace` prevents the login page from being pushed onto the history
 * stack so the browser back button doesn't loop back to a protected route.
 */

import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

export default function ProtectedRoute() {
  const token = useAuthStore((s) => s.token);
  return token ? <Outlet /> : <Navigate to="/login" replace />;
}
