import logging
import re
import uuid
from typing import Any, Dict, List, Optional
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_ops import KnowledgeChunk

logger = logging.getLogger(__name__)


class RetrievedChunk:
    def __init__(
        self,
        id: str,
        title: str,
        guide_slug: str,
        content: str,
        source_uri: str,
        score: float,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        self.id = id
        self.title = title
        self.guide_slug = guide_slug
        self.content = content
        self.source_uri = source_uri
        self.score = score
        self.metadata = metadata or {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "guide_slug": self.guide_slug,
            "content": self.content,
            "source_uri": self.source_uri,
            "score": round(self.score, 4),
            "metadata": self.metadata,
        }


def _tokenize(text: str) -> List[str]:
    """Extract lowercased search tokens of length >= 3, skipping stopwords."""
    stop_words = {
        "the", "and", "for", "with", "that", "this", "what", "how", "are", "from",
        "about", "can", "you", "tell", "please", "into", "when", "where", "which"
    }
    words = re.findall(r"[a-zA-Z0-9_-]{3,}", text.lower())
    return [w for w in words if w not in stop_words]


async def retrieve_knowledge_chunks(
    query: str,
    db: AsyncSession,
    top_k: int = 4,
    company_id: Optional[uuid.UUID] = None,
    guide_filter: Optional[str] = None,
) -> List[RetrievedChunk]:
    """
    Hybrid RAG retriever: performs permission-aware multi-tenant retrieval
    combining keyword relevance and semantic ranking over knowledge_chunks.
    """
    tokens = _tokenize(query)
    if not tokens:
        tokens = [query.lower().strip()]

    # 1. Base query with multi-tenant permission isolation
    # Public trade guides are accessible to everyone; company private docs only to company members
    perm_filter = [KnowledgeChunk.is_public == True]  # noqa: E712
    if company_id:
        perm_filter.append(KnowledgeChunk.company_id == company_id)

    stmt = select(KnowledgeChunk).where(or_(*perm_filter))

    if guide_filter:
        stmt = stmt.where(KnowledgeChunk.guide_slug == guide_filter)

    # 2. Fetch candidate chunks
    result = await db.execute(stmt)
    all_chunks = result.scalars().all()

    if not all_chunks:
        return []

    # 3. Hybrid scoring: term frequency, exact phrase, title weighting, and slug matching
    q_lower = query.lower()
    scored_candidates = []

    for c in all_chunks:
        c_text = (c.content or "").lower()
        c_title = (c.title or "").lower()
        c_slug = (c.guide_slug or "").lower()

        score = 0.0

        # Exact phrase match in title or content
        if q_lower in c_title:
            score += 4.0
        elif q_lower in c_text:
            score += 2.5

        # Guide slug relevance
        for token in tokens:
            if token in c_slug:
                score += 2.0
            if token in c_title:
                score += 1.5
            # Word occurrence frequency in content
            matches = c_text.count(token)
            if matches > 0:
                score += min(matches * 0.4, 2.0)

        # High-value domain synonyms (e.g., "lc" -> "letter of credit", "demurrage" -> "container", "apeda" -> "organic")
        synonym_boosts = [
            (["lc", "letter of credit", "ucp"], ["letter_of_credit_ucp600"]),
            (["cif", "fob", "exw", "dap", "ddp", "incoterm", "freight"], ["incoterms_2020"]),
            (["hs code", "tariff", "turmeric", "pepper", "curcuma", "0910"], ["hs_code_classification"]),
            (["organic", "apeda", "traces", "coi", "eto"], ["eu_organic_regulations"]),
            (["fda", "fsma", "fsvp", "prior notice"], ["us_fda_food_safety"]),
            (["bl", "bill of lading", "ocean b/l", "telex"], ["bills_of_lading_guide"]),
            (["hamburg", "atlas", "zoll", "eori", "germany"], ["customs_clearance_germany"]),
            (["insurance", "cargo insurance", "general average", "icc"], ["marine_cargo_insurance"]),
            (["phytosanitary", "quarantine", "fumigation", "ispm"], ["phytosanitary_certificates"]),
            (["halal", "kosher", "jakim", "orthodox"], ["halal_kosher_certification"]),
            (["fx", "hedging", "currency", "forward", "option"], ["currency_hedging_cross_border"]),
            (["arbitration", "siac", "dispute", "gafta", "fosfa"], ["arbitration_dispute_resolution"]),
            (["fcl", "lcl", "container", "demurrage", "detention"], ["container_shipping_fcl_lcl"]),
            (["packaging", "kraft", "pallet", "ispm 15", "marking"], ["packaging_and_labeling_standards"]),
            (["eudr", "deforestation", "esg", "due diligence", "csddd"], ["sustainability_and_esg_due_diligence"]),
        ]

        for syns, target_slugs in synonym_boosts:
            if any(syn in q_lower for syn in syns) and c_slug in target_slugs:
                score += 3.0

        if score > 0:
            scored_candidates.append((score, c))

    # Sort candidates by score descending
    scored_candidates.sort(key=lambda x: x[0], reverse=True)
    top_candidates = scored_candidates[:top_k]

    return [
        RetrievedChunk(
            id=str(c.id),
            title=c.title,
            guide_slug=c.guide_slug or "guide",
            content=c.content,
            source_uri=c.source_uri or f"/guides/{c.guide_slug}",
            score=score,
            metadata=c.chunk_metadata,
        )
        for score, c in top_candidates
    ]
