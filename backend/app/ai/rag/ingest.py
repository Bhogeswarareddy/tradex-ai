import asyncio
import glob
import logging
import os
import uuid
from typing import List

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import AsyncSessionLocal
from app.models.ai_ops import KnowledgeChunk
from app.ai.rag.chunker import chunk_markdown_file
from app.ai.provider import get_ai_provider

logger = logging.getLogger(__name__)

KNOWLEDGE_DIR = os.path.join(os.path.dirname(__file__), "knowledge")


async def ingest_knowledge_base(db: AsyncSession) -> int:
    """
    Ingests all markdown guides in the knowledge directory into the
    knowledge_chunks table, generating embeddings and metadata.
    """
    md_files = glob.glob(os.path.join(KNOWLEDGE_DIR, "*.md"))
    if not md_files:
        logger.warning(f"No markdown files found in {KNOWLEDGE_DIR}")
        return 0

    ai_provider = get_ai_provider()
    total_ingested = 0

    for file_path in md_files:
        chunks = chunk_markdown_file(file_path)
        if not chunks:
            continue

        guide_slug = chunks[0].guide_slug
        # Clean existing chunks for this guide
        await db.execute(delete(KnowledgeChunk).where(KnowledgeChunk.guide_slug == guide_slug))

        # Generate embeddings in batch
        texts = [c.content for c in chunks]
        embeddings = await ai_provider.embed(texts)

        for chunk_data, emb in zip(chunks, embeddings):
            # Pad or format embedding to 1536 float elements if needed by pgvector Vector(1536)
            padded_emb = emb if len(emb) == 1536 else (emb * (1536 // len(emb) + 1))[:1536]
            chunk_rec = KnowledgeChunk(
                guide_slug=chunk_data.guide_slug,
                title=f"{chunk_data.title} - {chunk_data.section_header}",
                content=chunk_data.content,
                entity_type="guide",
                embedding=padded_emb,
                chunk_metadata=chunk_data.metadata,
                source_uri=f"/guides/{chunk_data.guide_slug}",
                is_public=True,
            )
            db.add(chunk_rec)
            total_ingested += 1

    await db.commit()
    logger.info(f"Ingested {total_ingested} knowledge chunks from {len(md_files)} guides.")
    return total_ingested


async def main():
    async with AsyncSessionLocal() as session:
        count = await ingest_knowledge_base(session)
        print(f"Successfully ingested {count} trade knowledge chunks.")


if __name__ == "__main__":
    asyncio.run(main())
