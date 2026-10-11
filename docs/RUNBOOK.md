# TradeX AI: Production Operations Runbook

This runbook provides actionable procedures for operations, incident response, rollbacks, disaster recovery, secret rotation, and pipeline failure drill validations.

---

## 1. Fast-Path Rollback Procedures

If a newly deployed image exhibits degraded performance, memory leaks, or application bugs:

### Method A: Fast-Path Rollback via Jenkins Pipeline (Recommended)
1. Navigate to the `tradex-ai-pipeline` in Jenkins.
2. Click **Build with Parameters**.
3. In the `ROLLBACK_TO` parameter, provide the target previous image tag (e.g. `41-5ef9a9b`).
4. Click **Build**.
5. Jenkins activates the `Rollback Fast-Path` stage, bypassing dependency installation, linting, tests, and image building, and triggers `./scripts/deploy.sh` on EC2 with the rollback tag.

### Method B: Manual CLI Rollback on AWS EC2 (Zero-CI Path)
Connect directly to the production EC2 host via SSH:
```bash
ssh -i ~/.ssh/tradex-deployer.pem ubuntu@api.tradex.ai
cd /opt/tradex-ai

# Check previous tag recorded by deploy.sh
cat .previous_tag

# Trigger instantaneous rollback
IMAGE_TAG=$(cat .previous_tag) ./scripts/deploy.sh
```
`scripts/deploy.sh` re-pulls the previous image, restarts the containers, and verifies the `/api/health` probe.

---

## 2. Disaster Recovery: Database & Documents Restoration

### 2.1 Restoring from Most Recent Local Backup
```bash
cd /opt/tradex-ai
# Automatically finds the newest backup in backups/ and restores database & uploads volume
./scripts/restore.sh
```

### 2.2 Restoring from a Specific Timestamp
```bash
./scripts/restore.sh 20261011_015418
```

### 2.3 Restoring from Amazon S3 Offsite Storage
If the local EC2 storage was destroyed or replaced:
```bash
# 1. Download backup archive from Amazon S3
aws s3 cp s3://tradex-prod-backups/backups/db_20261011_015418.sql.gz ./backups/
aws s3 cp s3://tradex-prod-backups/backups/uploads_20261011_015418.tar.gz ./backups/

# 2. Run restoration script
./scripts/restore.sh 20261011_015418
```

---

## 3. Log Inspection, Container Stats & Monitoring Diagnostics

### 3.1 Live System Resource Usage & Service Logs
Execute the consolidated statistics report script:
```bash
cd /opt/tradex-ai
./scripts/stats-report.sh
```
This prints:
- `docker stats --no-stream` covering CPU %, Memory Usage / Limit, Net I/O, and PIDs for `nginx_proxy`, `fastapi_app`, `react_app`, and `pg_db`.
- The last 50 log lines for each container.

### 3.2 Tail Specific Service Logs in Real-Time
```bash
# Backend FastAPI application logs
docker logs -f --tail 100 fastapi_app

# Nginx reverse proxy access & error logs
docker logs -f --tail 100 nginx_proxy

# PostgreSQL database engine logs
docker logs -f --tail 100 pg_db
```

### 3.3 Prometheus Metrics & Grafana Dashboards
- **Raw Prometheus Metrics**: Scraped via `curl -k https://localhost/metrics`
- **Prometheus UI**: `http://<ec2-host>:9090`
- **Grafana Dashboard**: `http://<ec2-host>:3001` (Credentials: `admin` / `tradex_grafana_admin`). The `TradeX AI Production Dashboard` displays live request rates, p95/p99 latency, 4xx/5xx errors, AI inference calls, and active WebSockets.

---

## 4. Zero-Downtime Secret Rotation

To rotate passwords, API keys, or JWT signing keys without modifying code or storing plaintext secrets on disk:

1. Update the secret in AWS SSM Parameter Store:
   ```bash
   aws ssm put-parameter \
     --name "/tradex/prod/OPENAI_API_KEY" \
     --value "sk-new-production-openai-key-here" \
     --type SecureString \
     --overwrite
   ```

2. SSH to EC2 and re-execute deployment:
   ```bash
   cd /opt/tradex-ai
   ./scripts/deploy.sh
   ```
   `scripts/deploy.sh` fetches the fresh parameter values from SSM, generates a refreshed `.env` file, and executes a rolling container restart.

---

## 5. Pipeline Failure Drills & Remediation

### Drill 1: Deliberately Failing Test Aborts Pipeline Before Build
This drill proves that defective code is caught early and never built or pushed to production.

#### Execution Procedure:
1. In a branch `test-failure-drill`, modify `backend/app/tests/test_health.py` to add an intentional assertion failure:
   ```python
   def test_intentional_failure():
       assert False, "Deliberate test failure for CI pipeline verification"
   ```
2. Commit and push the branch:
   ```bash
   git checkout -b test-failure-drill
   git commit -am "test: deliberate failure drill"
   git push origin test-failure-drill
   ```
3. Trigger the Jenkins build for branch `test-failure-drill`.

#### Expected Observations:
- **Stage 4 (`Unit Tests with Coverage`) fails immediately**.
- Pytest exits with status code 1.
- **Stage 6 (`Build Docker Images`) is NEVER executed**.
- **Stage 7 (`Push to Amazon ECR`) is NEVER executed**.
- **Stage 8 (`Deploy to AWS EC2`) is NEVER executed**.
- Pipeline `post.failure` triggers a Slack notification alerting engineers that the build failed at the test gate.

---

### Drill 2: Deliberately Failing Health Check Triggers Automated Rollback
This drill proves that if a container build passes tests but fails at runtime on EC2, the pipeline automatically detects the health check failure and rolls back to the previous tag.

#### Execution Procedure:
1. Introduce a runtime failure that only surfaces on startup (e.g. invalid database connection port in SSM Parameter Store or health check probe failure).
2. Deploy the build using Jenkins or `./scripts/deploy.sh`.
3. In `scripts/deploy.sh`, the health check probe executes:
   ```bash
   curl -k -f https://localhost/api/health
   ```
4. The curl command times out or returns HTTP 500/503.

#### Expected Observations:
- `scripts/deploy.sh` catches the failed health check after 30 seconds.
- Output: `ERROR: Health check failed! Initiating rollback to previous tag: <previous_tag>`.
- The script automatically executes `IMAGE_TAG=${PREVIOUS_TAG} docker compose up -d`.
- In Jenkins, the `post.failure` block detects the failure and alerts `#tradex-ci-cd`.
- The live production service remains online and intact on `<previous_tag>` with zero sustained downtime.

---

## 6. Common Incidents & Fixes

### 6.1 Database Connection Pool Exhaustion
- **Symptom**: HTTP 500 responses with `asyncpg.exceptions.TooManyConnectionsError: sorry, too many clients already`.
- **Diagnosis**: Run `docker exec pg_db psql -U tradex_user -d tradex -c "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"`.
- **Remedy**:
  1. Restart the FastAPI container: `docker restart fastapi_app`.
  2. Increase `max_connections` in PostgreSQL configuration or reduce Gunicorn worker pool size.

### 6.2 Disk Space Saturation
- **Symptom**: `docker compose up` fails with `No space left on device`.
- **Diagnosis**: `df -h /`.
- **Remedy**:
  1. Prune unused Docker build layers and untagged images:
     ```bash
     docker image prune -af --filter "until=72h"
     docker builder prune -af --filter "until=72h"
     ```
  2. Prune old local backup archives:
     ```bash
     ls -t /opt/tradex-ai/backups/db_*.sql.gz | tail -n +5 | xargs -r rm -f
     ```

### 6.3 TLS Certificate Renewal Failure
- **Symptom**: Browser SSL certificate expiration warning.
- **Diagnosis**: `curl -vI https://localhost/ 2>&1 | grep "expire date"`.
- **Remedy**:
  Execute manual renewal via Certbot:
  ```bash
  cd /opt/tradex-ai
  docker run --rm \
    -v /opt/tradex-ai/certs:/etc/letsencrypt \
    -v /opt/tradex-ai/certbot_www:/var/www/certbot \
    certbot/certbot renew --webroot -w /var/www/certbot
  docker exec nginx_proxy nginx -s reload
  ```
