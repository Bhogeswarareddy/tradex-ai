# ADR 0002: Using pgvector within PostgreSQL for Vector Storage

## Status
Accepted

## Context
TradeX requires semantic similarity search across product descriptions, supplier trade capabilities, and international trade knowledge documents.
We evaluated dedicated vector databases (e.g., Pinecone, Milvus, Qdrant, Weaviate) versus co-locating embeddings within our core relational PostgreSQL database using the `pgvector` extension.

## Decision
We adopted `pgvector` (`pgvector/pgvector:pg16`) running natively inside PostgreSQL as the unified data store for both relational entities and vector embeddings.

Key reasons:
1. **Single Source of Truth & Zero Distributed State**:
   - Storing embeddings in the same database table (`products.embedding`, `knowledge_chunks.embedding`) eliminates the need for two-phase commit, out-of-sync reconciliation jobs, or dual-database failover orchestration.
2. **ACID Transactions**:
   - Product updates, stock modifications, and new listing creations update the relational record and queue re-embedding within the exact same transactional boundary.
3. **Hybrid Relational + Vector Queries**:
   - Enables native SQL filtering on operational constraints (e.g., `verified = TRUE`, `moq <= requested_qty`, `status = 'published'`, `is_demo = FALSE`) simultaneously with vector cosine distance (`<=>`), preventing post-retrieval pagination skew.
4. **Operational Simplicity & Cost**:
   - A single Docker container / RDS instance hosts all application state, reducing container overhead, memory footprint, and maintenance complexity.

## Consequences
### Positive
- Unified backup/restore operations via standard `pg_dump` and `pg_restore`.
- Full relational join capabilities between vector matches and supplier/order entities.
- Low operational complexity in production and local development.

### Negative
- Very large-scale vector datasets (>10M vectors) require careful HNSW / IVFFlat index tuning and work memory allocation in PostgreSQL.
- Heavy vector calculations share CPU resources with transactional OLTP queries, though mitigated by read replicas and async background workers.
