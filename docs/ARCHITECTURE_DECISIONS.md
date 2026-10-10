# Architectural Decision Records (ADR) - TradeX AI

## ADR-001: Multi-Container Architecture with Nginx Ingress
- **Decision**: Deploy using Docker Compose for local development and multi-container deployment on AWS EC2, with Nginx handling SSL termination, static routing, and API forwarding.
- **Rationale**: Isolates backend and frontend runtimes, ensures reproducible builds across staging and production, and provides a clear security perimeter.

## ADR-002: Deterministic AI Fallback Pattern
- **Decision**: Encapsulate all AI and embedding calls in `backend/app/ai` with a deterministic fallback provider.
- **Rationale**: Enables local development, unit testing, and automated CI pipelines to execute successfully without incurring LLM API costs or requiring external API credentials.

## ADR-003: pgvector for Hybrid Search
- **Decision**: Use PostgreSQL 16 with the `pgvector` extension for storing product and supplier embedding vectors alongside relational transactional data.
- **Rationale**: Eliminates operational overhead of running a separate vector database (e.g. Pinecone/Milvus), while retaining ACID transactional consistency for RFQ, orders, and contracts.
