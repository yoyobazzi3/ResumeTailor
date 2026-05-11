"""PDF text extraction for resume ingestion.

Uses pypdf to pull plain text so downstream steps work on deterministic input.
"""


from pypdf import PdfReader
from io import BytesIO


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract all page text from a PDF held in memory.

    We flatten the document to raw text before sending it to Claude instead of
    passing the PDF bytes directly because: (1) vision-capable parsing of arbitrary
    resume layouts would be heavier, costlier, and less predictable than structuring
    from text; (2) pypdf gives us searchable, copy-pasteable text for typical
    text-based PDFs; (3) separating extraction from intelligence keeps retries and
    debugging simpler—bad OCR or layout quirks surface as empty or noisy text early.

    Args:
        file_bytes: Full PDF file contents read into memory.

    Returns:
        All page texts joined with newline characters into one string (no extra page markers).
    """
    reader = PdfReader(BytesIO(file_bytes))
    parts: list[str] = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            parts.append(text)
    return "\n".join(parts)
