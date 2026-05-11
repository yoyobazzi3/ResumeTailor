/**
 * Hook encapsulating all tailored-resume state and side effects for ApplicationDetail.
 *
 * Responsibilities:
 * - Fetch the most recent tailored resume for the given application on mount.
 * - Debounce-save edited bullets (1 s after the user stops typing).
 * - Export the resume as a PDF via a browser blob download.
 * - Reset an individual bullet back to Claude's original output.
 *
 * Using a ref for the tailored resume ID inside callbacks avoids stale-closure
 * issues when tailoredResume state updates after a successful save.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import api from "../lib/api";

export interface TailoredResume {
  id: string;
  application_id: string;
  original_bullets: string[];
  tailored_bullets: string[];
  edited_bullets: string[] | null;
  missing_keywords: string[] | null;
  match_score: number | null;
  reasoning: string | null;
  created_at: string;
}

export type SavingStatus = "idle" | "saving" | "saved";

export function useTailoredResume(applicationId: string) {
  const [tailoredResume, setTailoredResume] = useState<TailoredResume | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [savingStatus, setSavingStatus] = useState<SavingStatus>("idle");

  // Refs allow saveBullets and exportPDF to remain stable (no re-creation on state updates).
  const tailoredResumeRef = useRef<TailoredResume | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the ref in sync with state so callbacks always have the current value.
  useEffect(() => {
    tailoredResumeRef.current = tailoredResume;
  }, [tailoredResume]);

  const fetchTailored = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get<TailoredResume>(`/api/resume/tailored/${applicationId}`);
      setTailoredResume(data);
      tailoredResumeRef.current = data;
    } catch {
      // No tailored resume yet — that's fine; the caller shows an empty state.
    } finally {
      setIsLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    fetchTailored();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, [fetchTailored]);

  /** Debounce-save the full bullets array; called on every keystroke. */
  const saveBullets = useCallback((bullets: string[]) => {
    if (!tailoredResumeRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      const id = tailoredResumeRef.current?.id;
      if (!id) return;
      setSavingStatus("saving");
      try {
        const { data } = await api.patch<TailoredResume>(`/api/resume/tailored/${id}`, {
          edited_bullets: bullets,
        });
        setTailoredResume(data);
        tailoredResumeRef.current = data;
        setSavingStatus("saved");
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => setSavingStatus("idle"), 2000);
      } catch {
        setSavingStatus("idle");
        toast.error("Failed to save edits");
      }
    }, 1000);
  }, []);

  /** Download the resume PDF as a file via a temporary blob URL. */
  const exportPDF = useCallback(async () => {
    const id = tailoredResumeRef.current?.id;
    if (!id) return;
    try {
      // Warm profile data used by the PDF generator (sections + education) so a stale
      // session fails here with a clear toast instead of mid-download.
      await Promise.all([api.get("/api/resume/sections"), api.get("/api/resume/education")]);

      const response = await api.get(`/api/resume/export/${id}`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data as Blob);
      const link = document.createElement("a");
      link.href = url;
      const disposition = (response.headers["content-disposition"] as string) ?? "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      link.download = match ? match[1] : "resume.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      localStorage.setItem("exported_pdf", "true");
    } catch {
      toast.error("Failed to export PDF");
    }
  }, []);

  /** Return the original Claude-generated bullet for the given index. */
  const resetBullet = useCallback((index: number): string | undefined => {
    return tailoredResumeRef.current?.tailored_bullets[index];
  }, []);

  return {
    tailoredResume,
    setTailoredResume,
    isLoading,
    savingStatus,
    saveBullets,
    exportPDF,
    resetBullet,
    refetch: fetchTailored,
  };
}
