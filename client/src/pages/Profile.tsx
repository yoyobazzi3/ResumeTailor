/**
 * Profile: personal info, PDF upload, resume sections (with bullets), and education.
 */

import { useCallback, useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import toast from "react-hot-toast";
import api, { axiosErrorDetail } from "../lib/api";
import Navbar from "../components/Navbar";
import Tooltip from "../components/Tooltip";

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  location: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  university: string | null;
  graduation_year: number | null;
  skills_summary: string | null;
}

interface Bullet {
  id: string;
  content: string;
  category: string | null;
  section_id: string | null;
  created_at: string;
}

interface ResumeSection {
  id: string;
  category_name: string;
  job_title: string | null;
  company_location: string | null;
  start_date: string | null;
  end_date: string | null;
  section_type: string;
  tech_stack: string | null;
  display_order: number;
  bullets: Bullet[];
}

interface EducationRow {
  id: string;
  institution: string;
  degree: string;
  field_of_study: string;
  graduation_year: number;
  graduation_month: string | null;
  gpa: string | null;
  display_order: number;
}

interface UploadResponse {
  work_experience_imported: number;
  projects_imported: number;
  education_imported: number;
  skills_parsed: boolean;
  total_bullets_imported: number;
  skills_summary: string | null;
  preview: {
    work_experience: Array<{ company: string; job_title: string }>;
    projects: Array<{ name: string; tech_stack: string[] }>;
    education: Array<{ institution: string; degree: string; graduation_year: number | null }>;
  };
}

const SECTION_TYPE_LABELS: Record<string, string> = {
  work_experience: "Work Experience",
  experience: "Work Experience",
  project: "Project",
  skills: "Skills",
  other: "Other",
};

const emptySectionForm = {
  category_name: "",
  job_title: "",
  company_location: "",
  start_date: "",
  end_date: "",
  section_type: "work_experience",
  tech_stack: "",
};

const emptyEducationForm = {
  institution: "",
  degree: "",
  field_of_study: "",
  graduation_year: "" as string | number,
  graduation_month: "",
  gpa: "",
};

export default function Profile() {
  const [sections, setSections] = useState<ResumeSection[]>([]);
  const [orphanBullets, setOrphanBullets] = useState<Bullet[]>([]);
  const [education, setEducation] = useState<EducationRow[]>([]);

  const [bulletDrafts, setBulletDrafts] = useState<Record<string, string>>({});
  const [addingSection, setAddingSection] = useState(false);
  const [sectionForm, setSectionForm] = useState(emptySectionForm);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editSectionForm, setEditSectionForm] = useState(emptySectionForm);

  const [addingEducation, setAddingEducation] = useState(false);
  const [eduForm, setEduForm] = useState(emptyEducationForm);
  const [editingEduId, setEditingEduId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileForm, setProfileForm] = useState({
    full_name: "",
    phone: "",
    location: "",
    linkedin_url: "",
    portfolio_url: "",
    university: "",
    graduation_year: "" as string | number,
  });
  const [profileSaving, setProfileSaving] = useState(false);

  const sortedSections = [...sections].sort(
    (a, b) => a.display_order - b.display_order || a.id.localeCompare(b.id)
  );

  async function fetchProfile() {
    try {
      const { data } = await api.get<UserProfile>("/api/auth/me");
      setProfile(data);
      setProfileForm({
        full_name: data.full_name ?? "",
        phone: data.phone ?? "",
        location: data.location ?? "",
        linkedin_url: data.linkedin_url ?? "",
        portfolio_url: data.portfolio_url ?? "",
        university: data.university ?? "",
        graduation_year: data.graduation_year ?? "",
      });
    } catch {
      toast.error("Failed to load profile");
    }
  }

  async function refreshResumeData() {
    try {
      const [secRes, bulletRes, eduRes] = await Promise.all([
        api.get<ResumeSection[]>("/api/resume/sections"),
        api.get<Bullet[]>("/api/resume/bullets"),
        api.get<EducationRow[]>("/api/resume/education"),
      ]);
      setSections(secRes.data);
      setOrphanBullets(bulletRes.data.filter((b) => !b.section_id));
      setEducation(eduRes.data);
    } catch {
      toast.error("Failed to load resume data");
    }
  }

  useEffect(() => {
    fetchProfile();
    refreshResumeData();
  }, []);

  async function handleProfileSave(e: FormEvent) {
    e.preventDefault();
    setProfileSaving(true);
    try {
      const gy =
        profileForm.graduation_year === "" || profileForm.graduation_year === null
          ? null
          : Number(profileForm.graduation_year);
      const { data } = await api.patch<UserProfile>("/api/auth/me", {
        full_name: profileForm.full_name || null,
        phone: profileForm.phone || null,
        location: profileForm.location || null,
        linkedin_url: profileForm.linkedin_url || null,
        portfolio_url: profileForm.portfolio_url || null,
        university: profileForm.university || null,
        graduation_year: Number.isFinite(gy as number) ? gy : null,
      });
      setProfile(data);
      toast.success("Profile updated");
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setProfileSaving(false);
    }
  }

  function pickPdfFile(file: File | undefined) {
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Please choose a PDF file.");
      return;
    }
    setPendingFile(file);
  }

  const onDropZoneDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const onDropZoneDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const onDropZoneDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    pickPdfFile(f);
  }, []);

  async function confirmUpload() {
    if (!pendingFile) return;
    setUploadBusy(true);
    setUploadResult(null);
    setUploadError(null);
    const body = new FormData();
    body.append("file", pendingFile);
    try {
      const { data } = await api.post<UploadResponse>("/api/resume/upload", body);
      setUploadResult(data);
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await Promise.all([refreshResumeData(), fetchProfile()]);
    } catch (err) {
      const msg = axiosErrorDetail(err, "Upload failed");
      setUploadError(msg);
    } finally {
      setUploadBusy(false);
    }
  }

  async function createSection(e: FormEvent) {
    e.preventDefault();
    if (!sectionForm.category_name.trim()) return;
    try {
      await api.post("/api/resume/sections", {
        category_name: sectionForm.category_name.trim(),
        job_title: sectionForm.job_title.trim() || null,
        company_location: sectionForm.company_location.trim() || null,
        start_date: sectionForm.start_date.trim() || null,
        end_date: sectionForm.end_date.trim() || null,
        section_type: sectionForm.section_type || "experience",
        tech_stack: sectionForm.tech_stack.trim() || null,
        display_order: sortedSections.length,
      });
      setSectionForm(emptySectionForm);
      setAddingSection(false);
      await refreshResumeData();
      toast.success("Section added");
    } catch (err) {
      toast.error(axiosErrorDetail(err, "Failed to add section"));
    }
  }

  async function saveSectionEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingSectionId || !editSectionForm.category_name.trim()) return;
    try {
      await api.patch(`/api/resume/sections/${editingSectionId}`, {
        category_name: editSectionForm.category_name.trim(),
        job_title: editSectionForm.job_title.trim() || null,
        company_location: editSectionForm.company_location.trim() || null,
        start_date: editSectionForm.start_date.trim() || null,
        end_date: editSectionForm.end_date.trim() || null,
        section_type: editSectionForm.section_type || "experience",
        tech_stack: editSectionForm.tech_stack.trim() || null,
      });
      setEditingSectionId(null);
      await refreshResumeData();
      toast.success("Section updated");
    } catch (err) {
      toast.error(axiosErrorDetail(err, "Failed to update section"));
    }
  }

  async function deleteSection(id: string) {
    if (!confirm("Delete this section and all of its bullets?")) return;
    try {
      await api.delete(`/api/resume/sections/${id}`);
      await refreshResumeData();
      toast.success("Section deleted");
    } catch {
      toast.error("Failed to delete section");
    }
  }

  async function moveSection(id: string, dir: "up" | "down") {
    const list = sortedSections;
    const i = list.findIndex((s) => s.id === id);
    const j = dir === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= list.length) return;
    const a = list[i];
    const b = list[j];
    try {
      await Promise.all([
        api.patch(`/api/resume/sections/${a.id}`, { display_order: b.display_order }),
        api.patch(`/api/resume/sections/${b.id}`, { display_order: a.display_order }),
      ]);
      await refreshResumeData();
    } catch {
      toast.error("Failed to reorder sections");
    }
  }

  async function addBulletToSection(sectionId: string) {
    const text = (bulletDrafts[sectionId] ?? "").trim();
    if (!text) return;
    try {
      await api.post("/api/resume/bullets", { content: text, section_id: sectionId });
      setBulletDrafts((d) => ({ ...d, [sectionId]: "" }));
      await refreshResumeData();
      toast.success("Bullet added");
    } catch (err) {
      toast.error(axiosErrorDetail(err, "Failed to add bullet"));
    }
  }

  async function deleteBullet(bulletId: string) {
    try {
      await api.delete(`/api/resume/bullets/${bulletId}`);
      await refreshResumeData();
      toast.success("Bullet deleted");
    } catch {
      toast.error("Failed to delete bullet");
    }
  }

  async function addOrphanBullet(e: FormEvent) {
    e.preventDefault();
    const text = (bulletDrafts["__orphan__"] ?? "").trim();
    if (!text) return;
    try {
      await api.post("/api/resume/bullets", { content: text, category: "Other", section_id: null });
      setBulletDrafts((d) => ({ ...d, __orphan__: "" }));
      await refreshResumeData();
      toast.success("Bullet added");
    } catch (err) {
      toast.error(axiosErrorDetail(err, "Failed to add bullet"));
    }
  }

  async function saveEducation(e: FormEvent) {
    e.preventDefault();
    const gy = Number(eduForm.graduation_year);
    if (!eduForm.institution.trim() || !eduForm.degree.trim() || !eduForm.field_of_study.trim() || !Number.isFinite(gy)) {
      toast.error("Fill institution, degree, field of study, and graduation year");
      return;
    }
    const wasEdit = Boolean(editingEduId);
    try {
      const month = eduForm.graduation_month.trim() || null;
      if (editingEduId) {
        await api.patch(`/api/resume/education/${editingEduId}`, {
          institution: eduForm.institution.trim(),
          degree: eduForm.degree.trim(),
          field_of_study: eduForm.field_of_study.trim(),
          graduation_year: gy,
          graduation_month: month,
          gpa: eduForm.gpa.trim() || null,
        });
        setEditingEduId(null);
      } else {
        await api.post("/api/resume/education", {
          institution: eduForm.institution.trim(),
          degree: eduForm.degree.trim(),
          field_of_study: eduForm.field_of_study.trim(),
          graduation_year: gy,
          graduation_month: month,
          gpa: eduForm.gpa.trim() || null,
          display_order: education.length,
        });
        setAddingEducation(false);
      }
      setEduForm(emptyEducationForm);
      await refreshResumeData();
      toast.success(wasEdit ? "Education updated" : "Education added");
    } catch (err) {
      toast.error(axiosErrorDetail(err, "Failed to save education"));
    }
  }

  async function deleteEducation(id: string) {
    try {
      await api.delete(`/api/resume/education/${id}`);
      await refreshResumeData();
      toast.success("Education removed");
    } catch {
      toast.error("Failed to delete education");
    }
  }

  function startEditSection(s: ResumeSection) {
    setEditingSectionId(s.id);
    setEditSectionForm({
      category_name: s.category_name,
      job_title: s.job_title ?? "",
      company_location: s.company_location ?? "",
      start_date: s.start_date ?? "",
      end_date: s.end_date ?? "",
      section_type: s.section_type ?? "work_experience",
      tech_stack: s.tech_stack ?? "",
    });
  }

  function startEditEducation(row: EducationRow) {
    setEditingEduId(row.id);
    setAddingEducation(true);
    setEduForm({
      institution: row.institution,
      degree: row.degree,
      field_of_study: row.field_of_study,
      graduation_year: row.graduation_year,
      graduation_month: row.graduation_month ?? "",
      gpa: row.gpa ?? "",
    });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {profile && !profile.full_name && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            Complete your profile to enable PDF export — at minimum, add your full name.
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Personal Info</h2>
          <p className="text-xs text-gray-400 mb-4">Used as the header in your exported PDF resume.</p>
          <form onSubmit={handleProfileSave} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { label: "Full Name", key: "full_name" as const, placeholder: "Jane Smith" },
                  { label: "Phone", key: "phone" as const, placeholder: "+1 (555) 000-0000" },
                  { label: "Location", key: "location" as const, placeholder: "San Francisco, CA" },
                  { label: "LinkedIn URL", key: "linkedin_url" as const, placeholder: "linkedin.com/in/janesmith" },
                  { label: "Portfolio URL", key: "portfolio_url" as const, placeholder: "janesmith.dev" },
                  { label: "University", key: "university" as const, placeholder: "San José State University" },
                ] as const
              ).map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    value={String(profileForm[key] ?? "")}
                    onChange={(e) => setProfileForm({ ...profileForm, [key]: e.target.value })}
                    placeholder={placeholder}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Graduation Year</label>
                <input
                  type="number"
                  value={profileForm.graduation_year === "" ? "" : profileForm.graduation_year}
                  onChange={(e) =>
                    setProfileForm({
                      ...profileForm,
                      graduation_year: e.target.value === "" ? "" : Number(e.target.value),
                    })
                  }
                  placeholder="2025"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={profileSaving}
                className="bg-indigo-600 text-white text-sm font-medium px-5 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {profileSaving ? "Saving…" : "Save Profile"}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white border border-indigo-100 shadow-sm rounded-xl p-6 space-y-4 ring-1 ring-indigo-50">
          <Tooltip content="Upload your existing resume PDF — Claude extracts your work experience, projects, and education automatically." position="right">
            <h2 className="font-semibold text-gray-900 text-lg cursor-default inline-block">Resume PDF upload</h2>
          </Tooltip>
          <p className="text-sm text-gray-600">
            Import bullets from a PDF. Each category becomes a section; edit titles and dates below.
          </p>
          <input
            id="resume-pdf-input"
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="sr-only"
            aria-label="Choose PDF resume file"
            onChange={(e) => pickPdfFile(e.target.files?.[0])}
          />
          <label
            htmlFor="resume-pdf-input"
            className={`flex items-center justify-center w-full rounded-lg bg-indigo-600 text-white text-sm font-semibold py-3 px-4 cursor-pointer hover:bg-indigo-700 transition-colors ${
              uploadBusy ? "opacity-50 pointer-events-none cursor-not-allowed" : ""
            }`}
          >
            {uploadBusy ? "Reading your resume..." : "Choose PDF resume"}
          </label>
          <button
            type="button"
            disabled={uploadBusy}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={onDropZoneDragOver}
            onDragLeave={onDropZoneDragLeave}
            onDrop={onDropZoneDrop}
            className={`w-full border-2 border-dashed rounded-xl px-4 py-8 text-center text-sm transition-colors ${
              dragActive
                ? "border-indigo-500 bg-indigo-50 text-indigo-800"
                : "border-gray-300 bg-gray-50 text-gray-600 hover:border-indigo-300 hover:bg-indigo-50/40"
            } disabled:opacity-50 disabled:pointer-events-none`}
          >
            {uploadBusy ? (
              <span className="text-gray-700">Reading your resume...</span>
            ) : (
              <>
                <span className="font-medium text-gray-900">Or drag and drop your PDF here</span>
                <span className="block mt-1 text-xs text-gray-500">PDF only</span>
              </>
            )}
          </button>
          <p className="text-xs text-gray-500">Works best with text-based PDFs. Scanned image PDFs are not supported.</p>
          {pendingFile && !uploadBusy && (
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100">
              <span className="text-sm text-gray-700 truncate max-w-[240px]" title={pendingFile.name}>
                {pendingFile.name}
              </span>
              <button
                type="button"
                onClick={confirmUpload}
                className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Import resume
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingFile(null);
                  setUploadResult(null);
                  setUploadError(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            </div>
          )}

          {uploadError && (
            <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
              <p className="font-semibold mb-1">Upload failed</p>
              <p>{uploadError}</p>
            </div>
          )}

          {uploadResult && (
            <div className="mt-3 space-y-3">
              <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3">
                <p className="text-sm font-semibold text-green-800 mb-1">Resume imported successfully</p>
                <p className="text-xs text-green-700">
                  {uploadResult.total_bullets_imported} bullets · {uploadResult.work_experience_imported} work experience · {uploadResult.projects_imported} projects · {uploadResult.education_imported} education
                </p>
              </div>

              {uploadResult.preview.work_experience.length > 0 && (
                <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Work Experience</p>
                  <ul className="space-y-1">
                    {uploadResult.preview.work_experience.map((we, i) => (
                      <li key={i} className="text-sm text-gray-800">
                        <span className="font-medium">{we.company}</span>
                        {we.job_title && <span className="text-gray-500"> — {we.job_title}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {uploadResult.preview.projects.length > 0 && (
                <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Projects</p>
                  <ul className="space-y-2">
                    {uploadResult.preview.projects.map((proj, i) => (
                      <li key={i}>
                        <span className="text-sm font-medium text-gray-800">{proj.name}</span>
                        {proj.tech_stack.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {proj.tech_stack.map((t, j) => (
                              <span key={j} className="bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-full border border-indigo-100">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {uploadResult.preview.education.length > 0 && (
                <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Education</p>
                  <ul className="space-y-1">
                    {uploadResult.preview.education.map((edu, i) => (
                      <li key={i} className="text-sm text-gray-800">
                        <span className="font-medium">{edu.institution}</span>
                        {edu.graduation_year && <span className="text-gray-500"> · {edu.graduation_year}</span>}
                        <p className="text-xs text-gray-500">{edu.degree}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {uploadResult.skills_summary && (
                <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Skills</p>
                  <p className="text-xs text-gray-700 leading-relaxed">{uploadResult.skills_summary}</p>
                </div>
              )}

              <p className="text-xs text-gray-500">Review the sections below and add any missing dates or details.</p>
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold text-gray-900">Resume Sections</h2>
              <p className="text-xs text-gray-400 mt-1">Job title, location, and dates appear on your exported PDF.</p>
            </div>
            <Tooltip content="Create a work experience or project group. Bullets within each section stay grouped together in your exported PDF." position="left">
              <button
                type="button"
                onClick={() => {
                  setAddingSection((v) => !v);
                  setSectionForm(emptySectionForm);
                }}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
              >
                {addingSection ? "Close" : "Add Section"}
              </button>
            </Tooltip>
          </div>

          {addingSection && (
            <form onSubmit={createSection} className="border border-gray-200 rounded-lg p-4 space-y-2 bg-gray-50">
              <div className="grid grid-cols-2 gap-2">
                <input
                  required
                  placeholder="Company / project name (e.g. GoFundMe)"
                  value={sectionForm.category_name}
                  onChange={(e) => setSectionForm({ ...sectionForm, category_name: e.target.value })}
                  className="col-span-2 w-full border rounded px-3 py-2 text-sm"
                />
                <select
                  value={sectionForm.section_type}
                  onChange={(e) => setSectionForm({ ...sectionForm, section_type: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm bg-white"
                >
                  <option value="work_experience">Work Experience</option>
                  <option value="project">Project</option>
                  <option value="other">Other</option>
                </select>
                <input
                  placeholder="Job title (e.g. SWE Intern)"
                  value={sectionForm.job_title}
                  onChange={(e) => setSectionForm({ ...sectionForm, job_title: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
                <input
                  placeholder="Location (e.g. San Francisco, CA)"
                  value={sectionForm.company_location}
                  onChange={(e) => setSectionForm({ ...sectionForm, company_location: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
                <input
                  placeholder="Tech stack (e.g. React, Node, MySQL)"
                  value={sectionForm.tech_stack}
                  onChange={(e) => setSectionForm({ ...sectionForm, tech_stack: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
                <input
                  placeholder="Start (e.g. June 2024)"
                  value={sectionForm.start_date}
                  onChange={(e) => setSectionForm({ ...sectionForm, start_date: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
                <input
                  placeholder="End (e.g. Present)"
                  value={sectionForm.end_date}
                  onChange={(e) => setSectionForm({ ...sectionForm, end_date: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              <button type="submit" className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg">
                Create section
              </button>
            </form>
          )}

          {sortedSections.length === 0 && !addingSection ? (
            <p className="text-sm text-gray-500 text-center py-6">No sections yet. Add a section or import a PDF.</p>
          ) : (
            <div className="space-y-4">
              {sortedSections.map((s, idx) => (
                <div key={s.id} className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <h3 className="font-semibold text-gray-900">{s.category_name}</h3>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          s.section_type === "project"
                            ? "bg-purple-50 text-purple-700 border border-purple-100"
                            : "bg-blue-50 text-blue-700 border border-blue-100"
                        }`}>
                          {SECTION_TYPE_LABELS[s.section_type] ?? s.section_type}
                        </span>
                      </div>
                      {(s.section_type === "work_experience" || s.section_type === "experience") && (
                        <p className="text-xs text-gray-600">
                          {[s.job_title, s.company_location].filter(Boolean).join(" · ") || <span className="text-amber-600 italic">No job title or location — click Edit to add</span>}
                        </p>
                      )}
                      {s.section_type === "project" && s.tech_stack && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {s.tech_stack.split(",").map((t) => t.trim()).filter(Boolean).map((t, i) => (
                            <span key={i} className="bg-purple-50 text-purple-700 text-xs px-2 py-0.5 rounded-full border border-purple-100">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                      {s.section_type === "project" && !s.tech_stack && (
                        <p className="text-xs text-amber-600 italic mt-0.5">No tech stack — click Edit to add</p>
                      )}
                      <p className="text-xs text-gray-500 mt-0.5">
                        {[s.start_date, s.end_date].filter(Boolean).join(" — ") || <span className="text-amber-600 italic">No dates — click Edit to add</span>}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1 shrink-0">
                      <button
                        type="button"
                        aria-label="Move section up"
                        disabled={idx === 0}
                        onClick={() => moveSection(s.id, "up")}
                        className="px-2 py-1 text-xs border rounded disabled:opacity-30"
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        aria-label="Move section down"
                        disabled={idx === sortedSections.length - 1}
                        onClick={() => moveSection(s.id, "down")}
                        className="px-2 py-1 text-xs border rounded disabled:opacity-30"
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        onClick={() => startEditSection(s)}
                        className="px-2 py-1 text-xs text-indigo-600"
                      >
                        Edit
                      </button>
                      <button type="button" onClick={() => deleteSection(s.id)} className="px-2 py-1 text-xs text-red-600">
                        Delete
                      </button>
                    </div>
                  </div>

                  {editingSectionId === s.id && (
                    <form onSubmit={saveSectionEdit} className="border-t pt-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          required
                          placeholder="Company / project name"
                          value={editSectionForm.category_name}
                          onChange={(e) => setEditSectionForm({ ...editSectionForm, category_name: e.target.value })}
                          className="col-span-2 w-full border rounded px-3 py-2 text-sm"
                        />
                        <select
                          value={editSectionForm.section_type}
                          onChange={(e) => setEditSectionForm({ ...editSectionForm, section_type: e.target.value })}
                          className="w-full border rounded px-3 py-2 text-sm bg-white"
                        >
                          <option value="work_experience">Work Experience</option>
                          <option value="experience">Work Experience (legacy)</option>
                          <option value="project">Project</option>
                          <option value="other">Other</option>
                        </select>
                        <input
                          placeholder="Job title"
                          value={editSectionForm.job_title}
                          onChange={(e) => setEditSectionForm({ ...editSectionForm, job_title: e.target.value })}
                          className="w-full border rounded px-3 py-2 text-sm"
                        />
                        <input
                          placeholder="Location"
                          value={editSectionForm.company_location}
                          onChange={(e) => setEditSectionForm({ ...editSectionForm, company_location: e.target.value })}
                          className="w-full border rounded px-3 py-2 text-sm"
                        />
                        <input
                          placeholder="Tech stack (e.g. React, Node, MySQL)"
                          value={editSectionForm.tech_stack}
                          onChange={(e) => setEditSectionForm({ ...editSectionForm, tech_stack: e.target.value })}
                          className="w-full border rounded px-3 py-2 text-sm"
                        />
                        <input
                          placeholder="Start date"
                          value={editSectionForm.start_date}
                          onChange={(e) => setEditSectionForm({ ...editSectionForm, start_date: e.target.value })}
                          className="w-full border rounded px-3 py-2 text-sm"
                        />
                        <input
                          placeholder="End date"
                          value={editSectionForm.end_date}
                          onChange={(e) => setEditSectionForm({ ...editSectionForm, end_date: e.target.value })}
                          className="w-full border rounded px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button type="submit" className="bg-indigo-600 text-white text-sm px-3 py-1.5 rounded">
                          Save
                        </button>
                        <button type="button" onClick={() => setEditingSectionId(null)} className="text-sm text-gray-600">
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}

                  <ul className="space-y-2">
                    {s.bullets.map((b) => (
                      <li
                        key={b.id}
                        className="flex items-start gap-2 text-sm bg-gray-50 rounded-lg px-3 py-2 border border-gray-100"
                      >
                        <span className="flex-1 text-gray-800">{b.content}</span>
                        <button
                          type="button"
                          onClick={() => deleteBullet(b.id)}
                          className="text-gray-400 hover:text-red-500"
                          aria-label="Delete bullet"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-2">
                    <textarea
                      rows={2}
                      placeholder="New bullet…"
                      value={bulletDrafts[s.id] ?? ""}
                      onChange={(e) => setBulletDrafts((d) => ({ ...d, [s.id]: e.target.value }))}
                      className="flex-1 border rounded px-3 py-2 text-sm resize-none"
                    />
                    <button
                      type="button"
                      onClick={() => addBulletToSection(s.id)}
                      className="self-end bg-indigo-600 text-white text-sm px-3 py-2 rounded-lg shrink-0"
                    >
                      Add
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-6 space-y-3">
            <h2 className="font-semibold text-gray-900 text-sm">Uncategorized bullets</h2>
            <p className="text-xs text-gray-500">
              Bullets without a section (legacy imports). Re-add inside a section if you want them grouped on the PDF.
            </p>
            {orphanBullets.map((b) => (
              <div key={b.id} className="flex items-start gap-2 text-sm border rounded-lg px-3 py-2">
                <span className="flex-1">{b.content}</span>
                <button type="button" onClick={() => deleteBullet(b.id)} className="text-gray-400 hover:text-red-500">
                  ×
                </button>
              </div>
            ))}
            <form onSubmit={addOrphanBullet} className="flex gap-2">
              <textarea
                rows={2}
                className="flex-1 border rounded px-3 py-2 text-sm resize-none"
                placeholder="Add bullet without a section…"
                value={bulletDrafts.__orphan__ ?? ""}
                onChange={(e) => setBulletDrafts((d) => ({ ...d, __orphan__: e.target.value }))}
              />
              <button type="submit" className="self-end bg-gray-800 text-white text-sm px-3 py-2 rounded-lg shrink-0">
                Add
              </button>
            </form>
          </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Education</h2>
            <button
              type="button"
              onClick={() => {
                setAddingEducation((v) => !v);
                setEditingEduId(null);
                setEduForm(emptyEducationForm);
              }}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              {addingEducation && !editingEduId ? "Close" : "Add Education"}
            </button>
          </div>
          {(addingEducation || editingEduId) && (
            <form onSubmit={saveEducation} className="border border-gray-200 rounded-lg p-4 space-y-2 bg-gray-50">
              <input
                required
                placeholder="Institution"
                value={eduForm.institution}
                onChange={(e) => setEduForm({ ...eduForm, institution: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
              />
              <input
                required
                placeholder="Degree (e.g. B.S.)"
                value={eduForm.degree}
                onChange={(e) => setEduForm({ ...eduForm, degree: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
              />
              <input
                required
                placeholder="Field of study"
                value={eduForm.field_of_study}
                onChange={(e) => setEduForm({ ...eduForm, field_of_study: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  placeholder="Month (e.g. May)"
                  value={eduForm.graduation_month}
                  onChange={(e) => setEduForm({ ...eduForm, graduation_month: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
                <input
                  required
                  type="number"
                  placeholder="Year (e.g. 2026)"
                  value={eduForm.graduation_year}
                  onChange={(e) => setEduForm({ ...eduForm, graduation_year: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
                <input
                  placeholder="GPA (optional)"
                  value={eduForm.gpa}
                  onChange={(e) => setEduForm({ ...eduForm, gpa: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg">
                  {editingEduId ? "Update" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddingEducation(false);
                    setEditingEduId(null);
                    setEduForm(emptyEducationForm);
                  }}
                  className="text-sm text-gray-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
          <div className="space-y-2">
            {[...education]
              .sort((a, b) => a.display_order - b.display_order)
              .map((row) => (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 border rounded-lg px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-medium text-gray-900">{row.institution}</span>
                    <span className="text-gray-500"> · {row.graduation_month ? `${row.graduation_month} ${row.graduation_year}` : row.graduation_year}</span>
                    <p className="text-xs text-gray-600">
                      {row.degree} in {row.field_of_study}
                      {row.gpa ? ` · GPA ${row.gpa}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button type="button" onClick={() => startEditEducation(row)} className="text-xs text-indigo-600">
                      Edit
                    </button>
                    <button type="button" onClick={() => deleteEducation(row.id)} className="text-xs text-red-600">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </main>
    </div>
  );
}
