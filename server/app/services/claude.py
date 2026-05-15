"""Anthropic API integration.

All Claude calls are isolated here so prompt logic never bleeds into routers
or other services. Three functions:
  tailor_resume     — full resume rewrite + analysis
  calculate_match_score — lightweight 0-100 score
  parse_resume      — structured JSON extraction from raw resume text
"""

import anthropic
import json
import logging
from app.config import settings

_logger = logging.getLogger(__name__)

# Module-level client so the connection pool is shared across requests rather
# than creating a new client (and a new TCP connection) on every call.
client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)


async def tailor_resume(bullets: list[str], job_description: str) -> dict:
    """Rewrite resume bullets to match a job description and return a full analysis.

    Prompt strategy: the model acts as a senior technical recruiter who knows
    both what hiring managers want to see and what the job description signals.
    The output is constrained to a JSON object so it can be parsed and stored
    without any post-processing.

    Key prompt rules and why they exist:
    - "Preserve all numbers and percentages exactly": candidates cannot claim
      a metric they didn't earn; the original numbers are the only defensible ones.
    - "Mirror the language from the JD": ATS systems keyword-match against the
      exact tokens in the JD; paraphrasing loses those matches.
    - "Return exactly N bullets": the tailored list maps 1:1 with the original
      so the UI can render them side by side without index alignment issues.
    - "JSON only, no markdown": json.loads will raise on any surrounding text,
      making format failures immediately visible rather than silently corrupting data.

    Args:
        bullets: The user's original resume bullet points.
        job_description: The full text of the target job description.

    Returns:
        A dict with keys: tailored_bullets, missing_keywords, match_score, reasoning.

    Raises:
        json.JSONDecodeError: If Claude returns non-JSON output (should not happen
            given the prompt constraints, but callers should handle it).
        anthropic.APIError: On network or API-level failures.
    """
    prompt = f"""You are an expert resume writer and ATS optimization specialist. Rewrite the resume bullets below to maximize match with the job description.

Core rules:
- Preserve ALL numbers, percentages, and quantified achievements exactly as written — never round, estimate, or omit them
- Mirror the exact language and keywords from the job description — ATS systems match tokens verbatim
- Do not invent, fabricate, or exaggerate claims — only reframe existing experience using JD language
- Return exactly {len(bullets)} tailored bullets, one for each input bullet
- Respond with JSON only, no markdown, no explanation

Tailoring strategy:
- Front-load the most important JD keywords in the first 5–8 words of each bullet where natural
- Use strong action verbs that appear in the JD when possible (e.g. if JD says "architected", prefer "Architected" over "Built")
- For each required skill or technology, use the exact phrase from the JD verbatim in at least one bullet (e.g. if JD says "distributed systems", use "distributed systems" not "large-scale systems")
- Do not pad bullets with generic soft-skill filler ("collaborated with cross-functional teams", "drove impact") unless directly mirrored from the JD
- Be surgical — only add language that directly maps to a stated JD requirement

Skill matching rules:
- Job descriptions often list alternatives: "JavaScript or TypeScript", "React or Vue or Angular", "Python or Java"
- If the candidate's bullets contain ANY ONE of the alternatives, that requirement is fully satisfied — do NOT add any of the alternatives to missing_keywords
- When rewriting bullets, prefer to use the exact alternative from the JD that matches what the candidate already has
- Only add a skill to missing_keywords if the candidate satisfies NONE of the alternatives for that requirement
- Common equivalences: "JS" = "JavaScript", "TS" = "TypeScript", "Node" = "Node.js", "Postgres" = "PostgreSQL", "k8s" = "Kubernetes"

Missing keywords rules:
- Distinguish required skills (explicitly stated as required/must-have/essential) from preferred skills (preferred/nice-to-have/bonus/plus)
- Return at most 8 missing keywords, prioritizing required gaps over preferred ones
- Prefix each with [required] or [preferred] — e.g. "[required] Go", "[preferred] Kubernetes"
- Do not list the same concept twice under different names

Match Score Rubric (use this exact scale):
- 85-100: Nearly all required skills present; bullets use JD's exact language and terminology; strong keyword density throughout
- 70-84: Most required skills covered; good keyword mirroring with minor gaps in language or coverage
- 50-69: Core skills present but several required keywords missing or language not well aligned
- 30-49: Significant gaps in required skills; JD terminology not reflected in bullets
- 0-29: Poor alignment; major required skills absent or role is a strong mismatch

Job Description:
{job_description}

Resume Bullets:
{json.dumps(bullets)}

Return this exact JSON shape:
{{
  "tailored_bullets": [...],
  "missing_keywords": [...],
  "match_score": <integer 0-100 using the rubric above>,
  "reasoning": "<one sentence explaining the score, citing the most impactful gap or strength>"
}}"""

    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )

    # Strip markdown fences in case the model wraps its JSON in ```json ... ```.
    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

    # json.loads is used directly rather than asking for tool_use / structured output
    # because the anthropic SDK's structured output requires defining a JSON schema
    # upfront. The prompt-based approach is simpler here and the JSON shape is stable.
    return json.loads(raw)


async def calculate_match_score(bullets: list[str], job_description: str) -> int:
    """Return a 0–100 integer score for how well the bullets match the job description.

    This is a lighter call than tailor_resume — it skips rewriting and just
    scores, so max_tokens is kept very small to reduce latency and cost.

    Args:
        bullets: Resume bullet points to evaluate.
        job_description: The job description to score against.

    Returns:
        An integer from 0 to 100.

    Raises:
        json.JSONDecodeError: If Claude returns non-JSON output.
        KeyError: If the response JSON is missing the match_score key.
    """
    prompt = f"""Score how well these resume bullets match this job description.
Return a single JSON object: {{"match_score": <integer 0-100>}}
No explanation, no markdown.

Job Description: {job_description}
Bullets: {json.dumps(bullets)}"""

    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=64,
        messages=[{"role": "user", "content": prompt}],
    )

    return json.loads(message.content[0].text)["match_score"]


async def extract_job_info_from_text(page_text: str, url: str) -> dict:
    """Extract structured job info from raw page text scraped from a job posting URL.

    Uses Claude to identify and pull out the job description, company name, and
    role title from whatever text was on the page. This handles the wide variety
    of layouts across Greenhouse, Lever, company career pages, etc.

    Returns a dict with keys: job_description (str), company (str|None), role (str|None).

    Raises:
        ValueError: If Claude cannot find a meaningful job description in the text.
    """
    prompt = f"""You are parsing raw text scraped from a job posting page. Extract the job information and return it as JSON.

Return ONLY a valid JSON object with these exact keys:
{{
  "job_description": "The complete job description — include all responsibilities, qualifications, requirements, and any other relevant details. Preserve formatting with newlines. Do not summarize — extract everything relevant to the role.",
  "company": "The company name hiring for this role, or null if unclear",
  "role": "The exact job title as written, or null if unclear"
}}

No markdown. No explanation. Just the JSON object.

Source URL: {url}

Page text:
{page_text}"""

    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

    try:
        result = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError("Could not parse job info from the page.") from exc

    jd = result.get("job_description", "")
    if not jd or len(jd) < 100:
        raise ValueError(
            "Couldn't find a job description on that page. "
            "The page may require JavaScript to render. Try pasting the job description manually."
        )

    return {
        "job_description": jd,
        "company": result.get("company") or None,
        "role": result.get("role") or None,
    }


async def parse_resume(resume_text: str) -> dict:
    """Parse raw resume text into a fully structured dict via Claude.

    Returns a dict with keys: work_experience, projects, education, skills.
    Each work_experience item: company, job_title, location, start_date, end_date, bullets.
    Each project item: name, tech_stack (list), start_date, end_date, bullets.
    Each education item: institution, degree, field_of_study, graduation_year, gpa.
    skills: dict with languages, frontend, backend, databases, tools (each a list).

    Raises ValueError if Claude returns non-JSON output.
    """
    prompt = f"""You are a resume parser. I will give you the raw text extracted from a PDF resume. Your job is to parse it into a structured JSON object.

The resume may contain these section types: work experience, projects, skills, and education. Parse each one separately.

Return ONLY a valid JSON object. No markdown. No backticks. No explanation. Just the raw JSON.

The JSON must follow this exact shape:

{{
  "work_experience": [
    {{
      "company": "string — the company or organization name",
      "job_title": "string — the exact job title, e.g. Software Engineer Intern",
      "location": "string or null — city and state if present, null if not found",
      "start_date": "string or null — e.g. June 2024, Summer 2024, Jan 2023. null if not found",
      "end_date": "string or null — e.g. August 2024, Present. null if not found",
      "bullets": ["string", "string"]
    }}
  ],
  "projects": [
    {{
      "name": "string — the project name",
      "tech_stack": ["string", "string"],
      "start_date": "string or null",
      "end_date": "string or null",
      "bullets": ["string", "string"]
    }}
  ],
  "education": [
    {{
      "institution": "string — full university name",
      "degree": "string — e.g. Bachelor of Science",
      "field_of_study": "string — e.g. Software Engineering, Computer Science",
      "graduation_year": 2026,
      "graduation_month": "string or null — the month name e.g. May, December. null if not found",
      "gpa": "string or null — e.g. 3.8, null if not listed"
    }}
  ],
  "skills": {{
    "languages": ["string"],
    "frontend": ["string"],
    "backend": ["string"],
    "databases": ["string"],
    "tools": ["string"]
  }}
}}

Rules you must follow exactly:
1. Work experience means real jobs or internships at companies — GoFundMe, Digital Nest, any company someone was employed at
2. Projects means personal or academic projects the person built themselves — not internship work
3. If a section is missing from the resume return an empty array for it
4. Never mix work experience bullets into projects or vice versa
5. For tech_stack in projects: read the bullet points carefully and extract every technology mentioned. Look for words like React, Node.js, TypeScript, Python, MySQL, Docker, Firebase, Redis, Flask, Arduino, JWT, AWS, GCP and any other tool or language mentioned
6. Preserve every number, percentage, and metric in bullets exactly as written — do not round, summarize, or rephrase
7. If dates are not explicitly written on the resume but can be inferred from context, use null — do not guess
8. For education parse the full institution name, not abbreviations — if you see SJSU write San Jose State University
9. Skills section: only include a technology under one category. If React appears under frontend do not also put it under tools
10. Return nothing except the JSON object. If you return anything else the parser will crash.

Resume text:
{resume_text}"""

    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()
    _logger.info("parse_resume raw_response_first_200=%s", raw[:200])

    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

    try:
        result = json.loads(raw)
    except json.JSONDecodeError as exc:
        _logger.error("parse_resume invalid_json raw=%s", raw[:500])
        raise ValueError(f"Claude returned invalid JSON. Raw response: {raw[:500]}") from exc

    _logger.info(
        "parse_resume work_experience=%d projects=%d education=%d",
        len(result.get("work_experience", [])),
        len(result.get("projects", [])),
        len(result.get("education", [])),
    )
    return result
