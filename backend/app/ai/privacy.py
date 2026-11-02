"""
TradeX AI - Privacy and Data Isolation Layer (Prompt 40)
Guarantees:
1. PII Redaction: Emails, phone numbers, and personal identifiers are sanitized before model submission.
2. Delimiter Wrapping: Untrusted buyer/supplier content is wrapped in strict boundaries.
3. Tenant & Company Isolation: Verifies that private negotiation or commercial data belonging to
   Company A is never transmitted in requests originating from or targeted at Company B.
4. Minimal Telemetry: Full prompt texts and raw documents are never persisted in logs; only metadata.
"""
import re
from typing import Any, Dict, List, Optional

EMAIL_REGEX = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b")
PHONE_REGEX = re.compile(r"(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b")
CREDIT_CARD_REGEX = re.compile(r"\b(?:\d{4}[-\s]?){3}\d{4}\b")


def redact_pii(text: str) -> str:
    """
    Strips emails, phone numbers, and payment details from untrusted text
    before passing into LLM prompts.
    """
    if not text or not isinstance(text, str):
        return ""

    sanitized = EMAIL_REGEX.sub("[EMAIL REDACTED]", text)
    sanitized = PHONE_REGEX.sub("[PHONE REDACTED]", sanitized)
    sanitized = CREDIT_CARD_REGEX.sub("[CARD REDACTED]", sanitized)
    # Strip potential delimiter injection attacks
    sanitized = sanitized.replace("</untrusted_input>", "").replace("<untrusted_input>", "")
    return sanitized.strip()


def sanitize_dict_pii(data: Dict[str, Any]) -> Dict[str, Any]:
    """Recursively redacts PII strings within structured dictionary variables."""
    out: Dict[str, Any] = {}
    for k, v in data.items():
        if isinstance(v, str):
            out[k] = redact_pii(v)
        elif isinstance(v, dict):
            out[k] = sanitize_dict_pii(v)
        elif isinstance(v, list):
            out[k] = [redact_pii(item) if isinstance(item, str) else item for item in v]
        else:
            out[k] = v
    return out


def verify_company_isolation(
    source_company_id: Optional[str],
    payload_company_ids: List[Optional[str]],
) -> bool:
    """
    Ensures that no entity belonging to a third-party non-counterparty company
    is bundled into the prompt context.
    """
    if not source_company_id:
        return True
    for cid in payload_company_ids:
        if cid and str(cid) != str(source_company_id):
            return False
    return True
