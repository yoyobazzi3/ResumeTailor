"""Job posting scraper.

Fetches a public job posting URL, strips HTML noise, then delegates to Claude
to extract the structured job info. All network I/O is async via httpx.
"""

import logging
import httpx
from bs4 import BeautifulSoup
from app.services.claude import extract_job_info_from_text

_logger = logging.getLogger(__name__)

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

# Tags that never contain job description content.
_NOISE_TAGS = ["script", "style", "nav", "header", "footer", "aside", "noscript", "iframe"]

_MAX_TEXT_CHARS = 12_000  # ~3 000 tokens — enough for any JD, cheap for Claude


async def fetch_job_info(url: str) -> dict:
    """Fetch a job posting URL and return extracted job info.

    Returns a dict with keys: job_description (str), company (str|None), role (str|None).

    Raises:
        ValueError: With a user-readable message on any failure (bad URL, blocked,
            LinkedIn, not enough text, Claude parse failure).
    """
    if "linkedin.com" in url:
        raise ValueError(
            "LinkedIn requires login to view job postings and cannot be fetched automatically. "
            "Copy the job description text and paste it manually."
        )

    _logger.info("scraper fetch url=%s", url)

    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=15.0,
            headers=_HEADERS,
        ) as client:
            resp = await client.get(url)
            resp.raise_for_status()
    except httpx.TimeoutException:
        raise ValueError("The page took too long to load. Try again or paste the job description manually.")
    except httpx.HTTPStatusError as exc:
        raise ValueError(
            f"The page returned a {exc.response.status_code} error. "
            "Make sure the URL is publicly accessible."
        )
    except httpx.RequestError:
        raise ValueError("Could not reach that URL. Check the link and try again.")

    soup = BeautifulSoup(resp.text, "html.parser")
    for tag in soup(_NOISE_TAGS):
        tag.decompose()

    raw_text = soup.get_text(separator="\n", strip=True)
    lines = [line for line in raw_text.splitlines() if line.strip()]
    clean_text = "\n".join(lines)[:_MAX_TEXT_CHARS]

    _logger.info("scraper extracted_chars=%d url=%s", len(clean_text), url)

    if len(clean_text) < 200:
        raise ValueError(
            "Not enough text could be extracted from that page. "
            "The site may require JavaScript to render. Try pasting the job description manually."
        )

    return await extract_job_info_from_text(clean_text, url)
