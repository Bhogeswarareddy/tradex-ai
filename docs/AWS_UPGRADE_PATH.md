# TradeX AI: AWS Enterprise Scaling & Upgrade Path

This document outlines the architectural roadmap for transitioning TradeX AI from a single-node EC2 multi-container stack to a highly available, enterprise-grade, auto-scaling AWS cloud infrastructure.

---

## 1. Upgrade Architecture Topology

```
                                 [Global End Users]
                                         |
                                         v
                            [Amazon Route 53 DNS]
                                         |
                                         v
                            [Amazon CloudFront CDN]
                         (Edge Caching & DDoS Shield)
                                 /                \
                       Static Assets            /api & /ws
                             /                      \
                            v                        v
             [S3 Static Website Bucket]   [AWS Application Load Balancer (ALB)]
               (React 19 SPA Build)       (ACM TLS Certificate & AWS WAF Rules)
                                                     |
                                                     v
                                          [AWS ECS Fargate Service]
                                        (FastAPI Backend Auto-Scaling)
                                         /            \
                       Vector Search & Data          Object Storage
                                       /                \
                                      v                  v
                  [Amazon Aurora PostgreSQL]     [Amazon S3 Bucket]
                  (pgvector, Multi-AZ Cluster)   (Trade Documents & Encrypted Storage)
```

---

## 2. Phase 1: Managed Database (Amazon Aurora / RDS PostgreSQL with pgvector)

### Objectives
- Move database hosting off the EC2 instance to eliminate single-point-of-failure risks.
- Benefit from automated Multi-AZ failover, automated point-in-time recovery (PITR), and automated maintenance.

### Step-by-Step Migration Plan
1. **Provision RDS PostgreSQL 16 or Aurora Serverless v2**:
   - Engine: PostgreSQL 16.2+
   - Instance Class: `db.r6g.large` (Memory Optimized) or Aurora Serverless v2 (`0.5 - 16 ACUs`).
   - Enable Multi-AZ deployment across two Availability Zones.
   - Attach custom parameter group with:
     ```
     shared_preload_libraries = 'vector'
     ```
   - Enable AWS KMS storage encryption.

2. **Zero-Data-Loss Migration**:
   ```bash
   # 1. Put platform in brief maintenance mode or drain ingress
   # 2. Dump schema and data from existing container:
   docker exec pg_db pg_dump -U tradex_user -d tradex -Fc -f /tmp/tradex_dump.dump

   # 3. Restore to Amazon RDS:
   pg_restore -h tradex-prod-db.xxxxxx.us-east-1.rds.amazonaws.com \
              -U tradex_admin \
              -d tradex \
              -v /tmp/tradex_dump.dump

   # 4. Verify vector extension:
   psql -h tradex-prod-db.xxxxxx.us-east-1.rds.amazonaws.com -U tradex_admin -d tradex \
        -c "CREATE EXTENSION IF NOT EXISTS vector;"
   ```

3. **Update SSM Parameter Store**:
   ```bash
   aws ssm put-parameter --name "/tradex/prod/DATABASE_URL" \
     --value "postgresql+asyncpg://tradex_admin:P@ssword@tradex-prod-db.xxxxxx.us-east-1.rds.amazonaws.com:5432/tradex" \
     --type SecureString --overwrite
   ```

4. **Decommission `pg_db` Container**:
   Remove the `db` service block from `docker-compose.prod.yml` and point the backend directly to RDS.

---

## 3. Phase 2: Cloud Object Storage (Amazon S3 via StorageBackend)

### Objectives
- Replace the local Docker volume `tradex_uploads` with infinitely scalable Amazon S3 storage.
- Provide secure document sharing using short-lived S3 Presigned URLs.

### Implementation Architecture
TradeX AI was engineered from day one with the `StorageBackend` abstraction in `backend/app/services/storage.py`:

```python
class StorageBackend(ABC):
    @abstractmethod
    async def upload(self, file_data: bytes, filename: str, content_type: str) -> str: ...
    @abstractmethod
    async def download(self, file_path: str) -> bytes: ...
    @abstractmethod
    async def delete(self, file_path: str) -> bool: ...
```

### Migration Steps
1. **Create S3 Bucket**:
   ```bash
   aws s3api create-bucket --bucket tradex-prod-documents --region us-east-1
   aws s3api put-bucket-encryption --bucket tradex-prod-documents \
     --server-side-encryption-configuration '{"Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]}'
   aws s3api put-public-access-block --bucket tradex-prod-documents \
     --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
   ```

2. **Migrate Existing Files**:
   ```bash
   docker run --rm -v tradex_uploads:/data amazon/aws-cli s3 sync /data s3://tradex-prod-documents/
   ```

3. **Switch Environment Configuration**:
   Update SSM Parameter Store:
   ```bash
   aws ssm put-parameter --name "/tradex/prod/STORAGE_BACKEND" --value "s3" --type String --overwrite
   aws ssm put-parameter --name "/tradex/prod/S3_BUCKET_NAME" --value "tradex-prod-documents" --type String --overwrite
   ```
   The backend automatically activates `S3StorageBackend` without code modifications.

---

## 4. Phase 3: Application Load Balancer (ALB) & AWS Certificate Manager (ACM)

### Objectives
- Offload TLS termination and certificate lifecycle management from Nginx to AWS ALB.
- Integrate AWS WAF (Web Application Firewall) for managed DDoS and OWASP Top 10 threat mitigation.

### Configuration
1. **ACM Certificate**: Request a public certificate in AWS Certificate Manager for `tradex.yourdomain.com` with DNS validation via Route 53.
2. **ALB Target Groups**:
   - Target Group 1: `FastAPI-TG` (Port 8000, Health check on `/api/health`).
   - Target Group 2: `Frontend-TG` (Port 80, Health check on `/`).
3. **Listener Rules**:
   - Rule 1: Path `/api/*` or `/ws` -> Forward to `FastAPI-TG`.
   - Default Rule: Forward to `Frontend-TG`.
4. **AWS WAF Web ACL**:
   - Enable AWS-managed rule sets: `AWSManagedRulesCommonRuleSet`, `AWSManagedRulesSQLiRuleSet`, and `AWSManagedRulesKnownBadInputsRuleSet`.
   - Configure rate limiting rule (e.g. max 1,000 requests per 5 minutes per IP).

---

## 5. Phase 4: Amazon CloudFront CDN & Global Edge Caching

### Objectives
- Deliver the React SPA with sub-50ms latency globally.
- Offload 95%+ of static web traffic from application servers.

### Configuration
1. **Static Build S3 Bucket**: Host frontend build outputs in a private S3 bucket (`tradex-frontend-static`).
2. **CloudFront Origins**:
   - Origin 1 (Default `/*`): S3 static bucket via Origin Access Control (OAC).
   - Origin 2 (`/api/*`, `/ws`): AWS Application Load Balancer with zero caching (`Cache-Control: no-cache, no-store`).
3. **Route 53 Alias**: Point `tradex.yourdomain.com` directly to CloudFront distribution.

---

## 6. Phase 5: Container Orchestration with AWS ECS Fargate

### Objectives
- Eliminate EC2 virtual machine management, OS patching, and capacity planning.
- Automatically scale backend containers up and down based on CPU, memory, and concurrent RFQ/Quotation load.

### Transition Steps
1. Create an ECS Cluster: `tradex-production-cluster`.
2. Define Task Definition `tradex-backend-task`:
   - Task CPU: 1 vCPU (1024), Memory: 2 GB (2048).
   - Container Image: `${ECR_REGISTRY}/tradex-ai/backend:latest`.
   - Logging: AWS CloudWatch Logs (`/ecs/tradex-backend`).
   - Secrets: SSM Parameter Store mappings for environment variables.
3. Configure Auto Scaling Policy:
   - Target Tracking Scaling on Average CPU Utilization (target: 65%).
   - Minimum tasks: 2 (across multiple Availability Zones).
   - Maximum tasks: 15.

---

## 7. Operational Readiness Matrix

| Feature / Requirement | EC2 Docker Compose (Current) | Enterprise AWS Architecture (Target) |
|---|---|---|
| **High Availability** | Single node (Self-healing containers) | Multi-AZ across 3 Availability Zones |
| **Database Storage** | Docker volume on EBS | Amazon Aurora Serverless v2 (pgvector) |
| **Object Storage** | Docker volume (`tradex_uploads`) | Amazon S3 with SSE-AES256 & Presigned URLs |
| **TLS Management** | Let's Encrypt / Certbot in container | AWS Certificate Manager (ACM) on ALB/CloudFront |
| **Frontend Delivery** | Nginx Alpine Container | Amazon CloudFront Global Edge Network (450+ PoPs) |
| **Auto Scaling** | Fixed container resource limits | ECS Fargate Dynamic Auto-Scaling (2 to 15 tasks) |
| **Firewall & Security** | Host UFW (22, 80, 443) | AWS WAF + Security Groups + IAM Instance Profiles |
