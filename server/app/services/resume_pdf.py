"""ATS-friendly resume PDF using WeasyPrint.

Layout mirrors a standard professional resume:
  - Name + contact centered at top
  - Grouped section headers: EXPERIENCE / PROJECTS / TECHNICAL SKILLS / EDUCATION
  - Experience: job title bold-left + date right, company italic-left + location right
  - Projects: "Name | Tech Stack" bold-left + date right
  - Skills: flat bullet lines
  - Education: institution bold-left + location right, degree italic-left + date right

All text is HTML-escaped. Unicode dashes are normalised to ASCII hyphens so
the PDF is readable by every ATS text-extraction pass.
"""

from __future__ import annotations

import html
from typing import Any

from weasyprint import HTML


# ── helpers ──────────────────────────────────────────────────────────────────

def _esc(s: str | None) -> str:
    if not s:
        return ""
    t = str(s).replace("—", "-").replace("–", "-").replace("−", "-")
    return html.escape(t, quote=True)


_TYPE_ORDER = ("work_experience", "experience", "project", "skills", "other")
_TYPE_LABEL = {
    "work_experience": "EXPERIENCE",
    "experience": "EXPERIENCE",
    "project": "PROJECTS",
    "skills": "TECHNICAL SKILLS",
    "other": "OTHER",
}

# Both "work_experience" and "experience" render as experience-style entries.
_EXPERIENCE_TYPES = {"work_experience", "experience"}


# ── public API ────────────────────────────────────────────────────────────────

def generate_resume_pdf(user: Any, sections: list[dict], education: list[Any]) -> bytes:
    """Render a single-column ATS-safe resume PDF.

    Args:
        user: User ORM with full_name, email, phone, location, linkedin_url,
              portfolio_url fields.
        sections: list of dicts — keys: category_name, job_title, company_location,
                  start_date, end_date, section_type, tech_stack, bullets.
        education: list of Education ORM rows ordered by display_order.
    """
    parts: list[str] = [_styles()]

    # ── Header (centered) ────────────────────────────────────────────────────
    name = _esc(user.full_name or user.email)
    contact_parts = [p for p in (
        user.email, user.phone, user.location,
        user.linkedin_url, user.portfolio_url,
    ) if p]
    contact_html = " | ".join(_esc(p) for p in contact_parts)

    parts.append(f'<div class="name">{name}</div>')
    if contact_html:
        parts.append(f'<div class="contact">{contact_html}</div>')

    # ── Experience / Projects / Skills (grouped) ──────────────────────────────
    # Normalise: "work_experience" and "experience" collapse into one group.
    grouped: dict[str, list[dict]] = {t: [] for t in _TYPE_ORDER}
    for sec in sections:
        t = sec.get("section_type") or "experience"
        if t in _EXPERIENCE_TYPES:
            grouped["work_experience"].append(sec)
        else:
            grouped.setdefault(t, []).append(sec)

    emitted_labels: set[str] = set()
    for stype in _TYPE_ORDER:
        group = grouped.get(stype, [])
        if not group:
            continue
        label = _TYPE_LABEL.get(stype, stype.upper())
        if label not in emitted_labels:
            parts.append(f'<div class="group-header">{label}</div>')
            emitted_labels.add(label)
        for sec in group:
            parts.extend(_render_section(sec, stype))

    # ── Technical Skills (from user.skills_summary) ───────────────────────────
    skills_summary = getattr(user, "skills_summary", None)
    if skills_summary:
        parts.append('<div class="group-header">TECHNICAL SKILLS</div>')
        parts.extend(_render_skills_from_summary(skills_summary))

    # ── Education ────────────────────────────────────────────────────────────
    if education:
        parts.append('<div class="group-header">EDUCATION</div>')
        for edu in education:
            parts.extend(_render_education(edu))

    parts.append("</body></html>")
    return HTML(string="".join(parts)).write_pdf()


# ── CSS ───────────────────────────────────────────────────────────────────────

def _styles() -> str:
    return """<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
@page { size: letter; margin: 0; }
body {
  font-family: "DejaVu Sans", Helvetica, Arial, sans-serif;
  font-size: 10px;
  margin: 0.5in 0.6in 0.5in 0.6in;
  color: #111;
  line-height: 1.3;
}

/* ── Header ── */
.name {
  font-size: 20px;
  font-weight: bold;
  text-align: center;
  margin: 0 0 3px 0;
  letter-spacing: 0.02em;
}
.contact {
  font-size: 9px;
  text-align: center;
  margin: 0 0 6px 0;
  color: #333;
}

/* ── Section group header ── */
.group-header {
  font-size: 10.5px;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-bottom: 0.75px solid #111;
  margin: 7px 0 3px 0;
  padding-bottom: 1px;
}

/* ── Experience layout ── */
.exp-entry { margin: 2px 0 4px 0; }
.exp-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 4px;
}
.exp-title  { font-weight: bold; font-size: 10px; }
.exp-date   { font-size: 9.5px; white-space: nowrap; color: #222; }
.exp-company { font-style: italic; font-size: 9.5px; }
.exp-loc    { font-style: italic; font-size: 9.5px; white-space: nowrap; }

/* ── Project layout ── */
.proj-entry { margin: 2px 0 4px 0; }
.proj-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 4px;
}
.proj-name  { font-weight: bold; font-size: 10px; }
.proj-date  { font-size: 9.5px; white-space: nowrap; color: #222; }

/* ── Shared bullets ── */
ul.bullets {
  margin: 2px 0 0 1.1em;
  padding: 0;
  list-style-type: disc;
}
ul.bullets li {
  font-size: 9.5px;
  line-height: 1.35;
  margin: 1px 0;
}

/* ── Education ── */
.edu-entry { margin: 2px 0 4px 0; }
.edu-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 4px;
}
.edu-inst   { font-weight: bold; font-size: 10px; }
.edu-loc    { font-size: 9.5px; white-space: nowrap; }
.edu-degree { font-style: italic; font-size: 9.5px; }
.edu-year   { font-size: 9.5px; white-space: nowrap; }
.edu-gpa    { font-size: 9.5px; }
</style></head><body>"""


# ── Section renderers ─────────────────────────────────────────────────────────

def _render_section(sec: dict, stype: str) -> list[str]:
    if stype == "project":
        return _render_project(sec)
    if stype == "skills":
        return _render_skills(sec)
    return _render_experience(sec)  # handles work_experience and experience


def _render_experience(sec: dict) -> list[str]:
    title = _esc(sec.get("job_title") or "")
    company = _esc(sec.get("category_name") or "")
    loc = _esc(sec.get("company_location") or "")
    dates = _date_range(sec)
    bullets = sec.get("bullets") or []

    out = ['<div class="exp-entry">']
    # Row 1: job title (bold) left | date right
    out.append('<div class="exp-row">')
    out.append(f'<span class="exp-title">{title}</span>')
    out.append(f'<span class="exp-date">{dates}</span>')
    out.append('</div>')
    # Row 2: company (italic) left | location right
    if company or loc:
        out.append('<div class="exp-row">')
        out.append(f'<span class="exp-company">{company}</span>')
        out.append(f'<span class="exp-loc">{loc}</span>')
        out.append('</div>')
    # Bullets
    if bullets:
        out.append('<ul class="bullets">')
        for b in bullets:
            out.append(f"<li>{_esc(b)}</li>")
        out.append("</ul>")
    out.append("</div>")
    return out


def _render_project(sec: dict) -> list[str]:
    name = _esc(sec.get("category_name") or "")
    stack = _esc(sec.get("tech_stack") or "")
    dates = _date_range(sec)
    bullets = sec.get("bullets") or []

    # "Project Name | React, Flask, C"
    name_stack = f"{name} | {stack}" if stack else name

    out = ['<div class="proj-entry">']
    out.append('<div class="proj-row">')
    out.append(f'<span class="proj-name">{name_stack}</span>')
    out.append(f'<span class="proj-date">{dates}</span>')
    out.append('</div>')
    if bullets:
        out.append('<ul class="bullets">')
        for b in bullets:
            out.append(f"<li>{_esc(b)}</li>")
        out.append("</ul>")
    out.append("</div>")
    return out


def _render_skills(sec: dict) -> list[str]:
    bullets = sec.get("bullets") or []
    if not bullets:
        return []
    out = ['<ul class="bullets" style="margin-top:3px">']
    for b in bullets:
        out.append(f"<li>{_esc(b)}</li>")
    out.append("</ul>")
    return out


def _render_skills_from_summary(summary: str) -> list[str]:
    """Render skills_summary string as a bullet list.

    Expects the format: "Languages: JS, TS | Frontend: React | Backend: Node"
    Each pipe-separated segment becomes one bullet line.
    """
    lines = [seg.strip() for seg in summary.split("|") if seg.strip()]
    if not lines:
        return []
    out = ['<ul class="bullets" style="margin-top:3px">']
    for line in lines:
        out.append(f"<li>{_esc(line)}</li>")
    out.append("</ul>")
    return out


def _render_education(edu: Any) -> list[str]:
    inst = _esc(edu.institution)
    loc = _esc(getattr(edu, "location", ""))
    degree = _esc(f"{edu.degree} in {edu.field_of_study}")
    month = getattr(edu, "graduation_month", None)
    year_str = f"{month} {edu.graduation_year}" if month else str(edu.graduation_year)
    year = _esc(year_str)
    gpa_html = f' | GPA: {_esc(edu.gpa)}' if edu.gpa else ""

    out = ['<div class="edu-entry">']
    out.append('<div class="edu-row">')
    out.append(f'<span class="edu-inst">{inst}</span>')
    out.append(f'<span class="edu-loc">{loc}</span>')
    out.append('</div>')
    out.append('<div class="edu-row">')
    out.append(f'<span class="edu-degree">{degree}{gpa_html}</span>')
    out.append(f'<span class="edu-year">{year}</span>')
    out.append('</div>')
    out.append('</div>')
    return out


def _date_range(sec: dict) -> str:
    start = _esc(sec.get("start_date") or "")
    end = _esc(sec.get("end_date") or "")
    if start and end:
        return f"{start} - {end}"
    return start or end


# ── group_bullets_for_pdf ─────────────────────────────────────────────────────

def group_bullets_for_pdf(ordered_bullets: list[Any], export_texts: list[str]) -> list[dict]:
    """Map tailored/edited bullet strings back onto their original sections.

    Args:
        ordered_bullets: ResumeBullet ORM instances in profile order with
                         .section relationship loaded.
        export_texts: Tailored or edited strings, same length as ordered_bullets.

    Returns:
        Ordered list of section dicts for generate_resume_pdf().
    """
    n = min(len(ordered_bullets), len(export_texts))
    if n == 0:
        return []

    def key(b: Any) -> tuple:
        return ("sec", str(b.section_id)) if b.section_id else ("cat", b.category or "Other")

    def meta(b: Any) -> dict:
        if b.section_id and b.section is not None:
            s = b.section
            return {
                "category_name": s.category_name,
                "job_title": s.job_title,
                "company_location": s.company_location,
                "start_date": s.start_date,
                "end_date": s.end_date,
                "section_type": getattr(s, "section_type", "experience"),
                "tech_stack": getattr(s, "tech_stack", None),
            }
        return {
            "category_name": b.category or "Other",
            "job_title": None, "company_location": None,
            "start_date": None, "end_date": None,
            "section_type": "other", "tech_stack": None,
        }

    out: list[dict] = []
    i = 0
    while i < n:
        b = ordered_bullets[i]
        k = key(b)
        m = meta(b)
        chunk: list[str] = []
        while i < n and key(ordered_bullets[i]) == k:
            chunk.append(export_texts[i])
            i += 1
        out.append({**m, "bullets": chunk})
    return out
