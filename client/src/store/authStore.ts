import { create } from "zustand";

interface AuthState {
  token: string | null;
  first_name: string | null;
  onboarding_completed: boolean;
  setAuth: (token: string, firstName: string | null, onboardingCompleted: boolean) => void;
  setOnboardingCompleted: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem("token"),
  first_name: localStorage.getItem("first_name") || null,
  onboarding_completed: localStorage.getItem("onboarding_completed") === "true",

  setAuth: (token, firstName, onboardingCompleted) => {
    localStorage.setItem("token", token);
    localStorage.setItem("first_name", firstName ?? "");
    localStorage.setItem("onboarding_completed", String(onboardingCompleted));
    set({ token, first_name: firstName, onboarding_completed: onboardingCompleted });
  },

  setOnboardingCompleted: () => {
    localStorage.setItem("onboarding_completed", "true");
    set({ onboarding_completed: true });
  },

  logout: () => {
    localStorage.clear();
    set({ token: null, first_name: null, onboarding_completed: false });
  },
}));
