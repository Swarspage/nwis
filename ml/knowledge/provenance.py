from datetime import datetime, timezone
from typing import Optional

from .event_schema import Provenance, EventSource

def build_provenance(version: str = "0.1.0") -> Provenance:
    """Builds the standard provenance block for knowledge records."""
    return {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "builder_version": version
    }

def format_event_source(
    document_name: Optional[str] = None,
    document_id: Optional[str] = None,
    source_text: Optional[str] = None,
    original_event_type: Optional[str] = None,
    page: Optional[str] = None,
    section: Optional[str] = None,
    extraction_method: str = "MANUAL"
) -> EventSource:
    """Standardizes the event source documentation block."""
    return {
        "document_id": document_id,
        "document_name": document_name,
        "page": page,
        "section": section,
        "original_event_type": original_event_type,
        "source_text": source_text,
        "extraction_method": extraction_method
    }
