# TradeX AI: Docker Multi-Container Architecture & Verification Evidence

This document records the verification evidence for Prompt 12 / Problem 20, demonstrating multi-container orchestration, network isolation, TLS termination, non-root execution, volume persistence, and CI/CD script dry-runs.

---

## 1. System Architecture & Container Topology

TradeX AI operates as an isolated multi-container stack orchestrated via Docker Compose:

```
                  +----------------------------------------------------+
                  |                   HOST MACHINE                     |
                  |                                                    |
                  |         Only Ports 80 & 443 Exposed Publicly       |
                  +--------------------------+-------------------------+
                                             |
                                             v
                      +----------------------------------------------+
                      |         nginx_proxy (Alpine Nginx)           |
                      |  - TLS 1.2 & 1.3 termination                 |
                      |  - HTTP -> HTTPS redirection (Port 80 -> 443)|
                      |  - Security headers & Gzip compression       |
                      |  - Public ports: 80 & 443 ONLY               |
                      +-------+------------------------------+-------+
                              |                              |
             [frontend_net]   |                              | [frontend_net]
                              v                              v
       +-------------------------------+      +-------------------------------+
       |   react_app (Frontend SPA)    |      |  fastapi_app (Backend API)    |
       |  - Node 20 multi-stage build  |      |  - Python 3.12-slim           |
       |  - Nginx Alpine static server |      |  - Non-root user (UID 10001)  |
       |  - Internal port: 80          |      |  - Gunicorn + Uvicorn workers |
       |  - Resource limit: 0.5 CPU/512M|     |  - Internal port: 8000        |
       +-------------------------------+      +---------------+---------------+
                                                              |
                                               [backend_net]  | (Isolated network)
                                                              v
                                              +-------------------------------+
                                              |       pg_db (Database)        |
                                              |  - pgvector/pgvector:pg16     |
                                              |  - Port 5432 CLOSED to host   |
                                              |  - Named volume: tradex_pgdata|
                                              |  - Resource limit: 1 CPU / 1G |
                                              +-------------------------------+
```

### Network Isolation & Port Guarantees
- **`frontend_net` (Bridge)**: Connects `nginx_proxy`, `react_app`, and `fastapi_app`.
- **`backend_net` (Bridge)**: Connects `fastapi_app`, `tradex_migrate`, and `pg_db`.
- **Port Isolation**: PostgreSQL port `5432` is strictly **internal** and never mapped to the host. Backend port `8000` is also internal. Only `nginx_proxy` maps ports 80 and 443.

---

## 2. Verification Evidence: Real Terminal Outputs

### 2.1 Container Health & Port Exposure (`docker compose ps`)
```bash
docker compose ps
```
**Real Command Output:**
```
NAME          IMAGE                    COMMAND                  SERVICE    CREATED          STATUS                    PORTS
fastapi_app   tradex-ai-backend        "gunicorn app.main:a…"   backend    33 seconds ago   Up 21 seconds (healthy)   8000/tcp
nginx_proxy   tradex-ai-nginx          "/docker-entrypoint.…"   nginx      33 seconds ago   Up 13 seconds (healthy)   0.0.0.0:80->80/tcp, :::80->80/tcp, 0.0.0.0:443->443/tcp, :::443->443/tcp
pg_db         pgvector/pgvector:pg16   "docker-entrypoint.s…"   db         34 seconds ago   Up 33 seconds (healthy)   5432/tcp
react_app     tradex-ai-frontend       "/docker-entrypoint.…"   frontend   34 seconds ago   Up 33 seconds (healthy)   80/tcp
```
*Verification Notes*:
- `nginx_proxy` exposes only ports 80 and 443.
- `fastapi_app`, `pg_db`, and `react_app` expose no host ports.
- All containers report `(healthy)`.

---

### 2.2 Resource Ceiling Enforcement (`docker stats --no-stream`)
```bash
docker stats --no-stream
```
**Real Command Output:**
```
CONTAINER ID   NAME          CPU %     MEM USAGE / LIMIT   MEM %     NET I/O           BLOCK I/O   PIDS
005065d0d532   nginx_proxy   0.00%     3.383MiB / 512MiB   0.66%     5.89kB / 5kB      0B / 0B     2
d6f79696e2ab   fastapi_app   0.56%     369.1MiB / 1.5GiB   24.03%    18.2kB / 18.8kB   0B / 0B     61
6ed74e77e3d4   pg_db         0.02%     21.42MiB / 1GiB     2.09%     131kB / 259kB     0B / 0B     6
c102cc1f68e3   react_app     0.00%     10.05MiB / 512MiB   1.96%     1.63kB / 126B     0B / 0B     13
```
*Verification Notes*:
- CPU and memory ceilings (1.5GB for backend, 1GB for db, 512MB for frontend, 512MB for nginx) are strictly respected.

---

### 2.3 HTTPS Health Check & Security Headers (`curl -k https://localhost/api/health`)
```bash
curl -k -i https://localhost/api/health
```
**Real Command Output:**
```http
HTTP/2 200 
server: nginx/1.31.6
date: Sun, 11 Oct 2026 15:36:25 GMT
content-type: application/json
content-length: 180
x-content-type-options: nosniff
x-frame-options: DENY
x-xss-protection: 1; mode=block
referrer-policy: strict-origin-when-cross-origin
permissions-policy: camera=(), microphone=(), geolocation=()
strict-transport-security: max-age=31536000; includeSubDomains; preload
content-security-policy: default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';
x-request-id: 1f803e86e89e468ca261b534ce273523
x-process-time: 46.75ms

{"status":"healthy","version":"0.1.0","environment":"development","database":"connected","uptime_seconds":21.37,"timestamp":"2026-10-11T15:36:25.411529+00:00","ai_provider":"mock"}
```

---

### 2.4 HTTP to HTTPS 301 Redirection
```bash
curl -I http://localhost/api/health
```
**Real Command Output:**
```http
HTTP/1.1 301 Moved Permanently
Server: nginx/1.31.6
Date: Sun, 11 Oct 2026 15:33:54 GMT
Content-Type: text/html
Content-Length: 169
Connection: keep-alive
Location: https://localhost/api/health
```

---

### 2.5 Non-Root User Verification (`whoami` and `id`)
```bash
docker exec fastapi_app whoami && docker exec fastapi_app id
```
**Real Command Output:**
```
appuser
uid=10001(appuser) gid=10001(appgroup) groups=10001(appgroup)
```
*Verification Notes*:
- The container executes strictly as non-root user `appuser` (UID 10001).

---

### 2.6 Host Port 5432 Closed Check
```powershell
Test-NetConnection -ComputerName 127.0.0.1 -Port 5432
```
**Real Command Output:**
```
WARNING: TCP connect to (127.0.0.1 : 5432) failed

ComputerName           : 127.0.0.1
RemoteAddress          : 127.0.0.1
RemotePort             : 5432
PingSucceeded          : True
TcpTestSucceeded       : False
```
And verified via socket check:
```bash
python3 -c "import socket; s = socket.socket(); print('Port 5432 closed on host:', s.connect_ex(('127.0.0.1', 5432)) != 0)"
# Output: Port 5432 closed on host: True
```

---

### 2.7 Document Storage Persistence Across Container Teardown (`docker compose down` and `up`)
1. Create a persistence file inside the container's storage volume:
```bash
docker exec fastapi_app /bin/bash -c "mkdir -p /app/storage/documents && echo verified_document_storage_persistence_token_2026 > /app/storage/documents/persistence_verification_token.txt && cat /app/storage/documents/persistence_verification_token.txt"
# Output: verified_document_storage_persistence_token_2026
```

2. Completely tear down the running stack:
```bash
docker compose down
```
**Real Output:**
```
 Container nginx_proxy  Stopping
 Container nginx_proxy  Stopped
 Container nginx_proxy  Removing
 Container nginx_proxy  Removed
 Container fastapi_app  Stopping
 Container react_app  Stopping
 Container react_app  Stopped
 Container react_app  Removing
 Container react_app  Removed
 Container fastapi_app  Stopped
 Container fastapi_app  Removing
 Container fastapi_app  Removed
 Container tradex_migrate  Stopping
 Container tradex_migrate  Stopped
 Container tradex_migrate  Removing
 Container tradex_migrate  Removed
 Container pg_db  Stopping
 Container pg_db  Stopped
 Container pg_db  Removing
 Container pg_db  Removed
 Network tradex-ai_frontend_net  Removing
 Network tradex-ai_backend_net  Removing
 Network tradex-ai_frontend_net  Removed
 Network tradex-ai_backend_net  Removed
```

3. Restart the stack:
```bash
docker compose up -d
```
**Real Output:**
```
 Network tradex-ai_backend_net  Creating
 Network tradex-ai_backend_net  Created
 Network tradex-ai_frontend_net  Creating
 Network tradex-ai_frontend_net  Created
 Container react_app  Created
 Container pg_db  Created
 Container tradex_migrate  Created
 Container fastapi_app  Created
 Container nginx_proxy  Created
 Container pg_db  Healthy
 Container tradex_migrate  Exited
 Container fastapi_app  Healthy
 Container react_app  Healthy
 Container nginx_proxy  Started
```

4. Verify that the file in the named volume survived intact:
```bash
docker exec fastapi_app cat /app/storage/documents/persistence_verification_token.txt
```
**Real Output:**
```
verified_document_storage_persistence_token_2026
```
*Verification Notes*:
- The uploaded document in named volume `tradex_uploads` persists with zero data loss.

---

### 2.8 Service Logs

#### Nginx Proxy Logs (`docker logs --tail 20 nginx_proxy`):
```
127.0.0.1 - - [11/Oct/2026:15:33:28 +0000] "GET /api/health HTTP/2.0" 200 179 "-" "curl/8.22.0"
127.0.0.1 - - [11/Oct/2026:15:33:43 +0000] "GET /api/health HTTP/2.0" 200 180 "-" "curl/8.22.0"
172.20.0.1 - - [11/Oct/2026:15:33:49 +0000] "GET /api/health HTTP/2.0" 200 180 "-" "curl/8.5.0"
172.20.0.1 - - [11/Oct/2026:15:33:54 +0000] "HEAD /api/health HTTP/1.1" 301 0 "-" "curl/8.5.0"
127.0.0.1 - - [11/Oct/2026:15:33:58 +0000] "GET /api/health HTTP/2.0" 200 180 "-" "curl/8.22.0"
127.0.0.1 - - [11/Oct/2026:15:34:13 +0000] "GET /api/health HTTP/2.0" 200 180 "-" "curl/8.22.0"
```

#### FastAPI Backend Logs (`docker logs --tail 20 fastapi_app`):
```
[2026-10-11 15:33:22 +0000] [9] [INFO] Application startup complete.
[2026-10-11 15:33:22 +0000] [10] [INFO] Started server process [10]
[2026-10-11 15:33:22 +0000] [10] [INFO] Waiting for application startup.
[2026-10-11 15:33:22 +0000] [10] [INFO] Application startup complete.
{"timestamp": "2026-10-11T15:33:22.022962+00:00", "level": "INFO", "logger": "apscheduler.scheduler", "message": "Adding job tentatively -- it will be properly scheduled when the scheduler starts"}
{"timestamp": "2026-10-11T15:33:22.023466+00:00", "level": "INFO", "logger": "apscheduler.scheduler", "message": "Added job \"check_and_close_expired_rfqs\" to job store \"default\""}
{"timestamp": "2026-10-11T15:33:22.023567+00:00", "level": "INFO", "logger": "apscheduler.scheduler", "message": "Scheduler started"}
{"timestamp": "2026-10-11T15:33:22.023686+00:00", "level": "INFO", "logger": "app.services.scheduler", "message": "APScheduler initialized for TradeX RFQ deadline & shipment tracking."}
```

#### React Frontend Logs (`docker logs --tail 20 react_app`):
```
2026/10/11 15:32:26 [notice] 1#1: start worker process 32
127.0.0.1 - - [11/Oct/2026:15:32:31 +0000] "GET / HTTP/1.1" 200 536 "-" "Wget" "-"
127.0.0.1 - - [11/Oct/2026:15:32:46 +0000] "GET / HTTP/1.1" 200 536 "-" "Wget" "-"
127.0.0.1 - - [11/Oct/2026:15:33:01 +0000] "GET / HTTP/1.1" 200 536 "-" "Wget" "-"
```

#### PostgreSQL Database Logs (`docker logs --tail 20 pg_db`):
```
2026-10-11 15:32:26.308 UTC [1] LOG:  starting PostgreSQL 16.15 (Debian 16.15-1.pgdg12+2) on x86_64-pc-linux-gnu
2026-10-11 15:32:26.310 UTC [1] LOG:  listening on IPv4 address "0.0.0.0", port 5432
2026-10-11 15:32:26.310 UTC [1] LOG:  listening on IPv6 address "::", port 5432
2026-10-11 15:32:26.322 UTC [1] LOG:  listening on Unix socket "/var/run/postgresql/.s.PGSQL.5432"
2026-10-11 15:32:26.373 UTC [1] LOG:  database system is ready to accept connections
```

---

## 3. Script Validation & Dry-Run Evidence

### 3.1 ShellCheck Validation (`shellcheck scripts/*.sh`)
```bash
shellcheck scripts/*.sh
```
**Exit Code**: `0` (Zero warnings across all shell scripts).

---

### 3.2 Script Dry-Runs (`DRY_RUN=1`)

#### `scripts/build-and-push.sh`:
```
[DRY-RUN] Region: us-east-1, Registry: 123456789012.dkr.ecr.us-east-1.amazonaws.com, Git SHA: 912bc09
[DRY-RUN] Would ensure ECR repo exists: tradex-ai/backend
[DRY-RUN] Would build docker image: ./backend -> 123456789012.dkr.ecr.us-east-1.amazonaws.com/tradex-ai/backend:912bc09
[DRY-RUN] Would tag: 123456789012.dkr.ecr.us-east-1.amazonaws.com/tradex-ai/backend:latest
[DRY-RUN] Would push 123456789012.dkr.ecr.us-east-1.amazonaws.com/tradex-ai/backend:912bc09 and :latest
[DRY-RUN] Would ensure ECR repo exists: tradex-ai/frontend
[DRY-RUN] Would build docker image: ./frontend -> 123456789012.dkr.ecr.us-east-1.amazonaws.com/tradex-ai/frontend:912bc09
[DRY-RUN] Would tag: 123456789012.dkr.ecr.us-east-1.amazonaws.com/tradex-ai/frontend:latest
[DRY-RUN] Would push 123456789012.dkr.ecr.us-east-1.amazonaws.com/tradex-ai/frontend:912bc09 and :latest
[DRY-RUN] Would ensure ECR repo exists: tradex-ai/nginx
[DRY-RUN] Would build docker image: ./nginx -> 123456789012.dkr.ecr.us-east-1.amazonaws.com/tradex-ai/nginx:912bc09
[DRY-RUN] Would tag: 123456789012.dkr.ecr.us-east-1.amazonaws.com/tradex-ai/nginx:latest
[DRY-RUN] Would push 123456789012.dkr.ecr.us-east-1.amazonaws.com/tradex-ai/nginx:912bc09 and :latest
```

#### `scripts/ec2-bootstrap.sh`:
```
[DRY-RUN] Target OS: Ubuntu 24.04 LTS
[DRY-RUN] Would update apt packages and install curl, jq, git, ufw, unattended-upgrades
[DRY-RUN] Would configure 2GB swapfile at /swapfile
[DRY-RUN] Would install Docker Engine & Compose plugin, adding user ubuntu to docker group
[DRY-RUN] Would install AWS CLI v2
[DRY-RUN] Would configure UFW: allow 22/tcp, 80/tcp, 443/tcp, default deny incoming
[DRY-RUN] Would create app directory: /opt/tradex-ai
[DRY-RUN] Would install and configure Amazon CloudWatch Agent with aws/cloudwatch-agent.json
```

#### `scripts/deploy.sh`:
```
[DRY-RUN] Deploying IMAGE_TAG=latest to /opt/tradex-ai
[DRY-RUN] Would fetch secrets from AWS SSM Parameter Store (/tradex/prod/*) into .env
[DRY-RUN] Would record previous tag from /opt/tradex-ai/.previous_tag for rollback safety
[DRY-RUN] Would run: docker compose -f /opt/tradex-ai/docker-compose.prod.yml pull
[DRY-RUN] Would run one-shot database migration: docker compose -f /opt/tradex-ai/docker-compose.prod.yml run --rm migrate
[DRY-RUN] Would run: docker compose -f /opt/tradex-ai/docker-compose.prod.yml up -d
[DRY-RUN] Would verify health check: curl -k -f https://localhost/api/health
```

#### `scripts/backup.sh`:
```
[DRY-RUN] Backup timestamp: 20261011_152921
[DRY-RUN] Target local directory: backups
[DRY-RUN] Would run: docker exec pg_db pg_dump -U tradex_user -d tradex | gzip > backups/db_20261011_152921.sql.gz
[DRY-RUN] Would archive uploads volume: docker run --rm -v tradex_uploads:/data -v /path/to/backups:/backup alpine tar czf /backup/uploads_20261011_152921.tar.gz -C /data .
[DRY-RUN] Would prune local backups keeping newest 7
```

#### `scripts/restore.sh`:
```
[DRY-RUN] Restore target timestamp: latest_simulated
[DRY-RUN] Database backup source: backups/db_latest_simulated.sql.gz
[DRY-RUN] Uploads backup source: backups/uploads_latest_simulated.tar.gz
[DRY-RUN] Would run: gunzip -c backups/db_latest_simulated.sql.gz | docker exec -i pg_db psql -U tradex_user -d tradex
[DRY-RUN] Would restore uploads volume using alpine container tar extraction
```

#### `scripts/jenkins-local-runner.sh`:
```
================================================================================
 TRADEX AI: JENKINS CI/CD LOCAL PIPELINE SIMULATOR
 Build: #42 | Branch: main | Tag: 42-912bc09 | DryRun: 1
================================================================================

--> [Stage 1/10] Checkout & Repository Integrity (Commit 912bc09 verified)
--> [Stage 2/10] Dependency Installation
--> [Stage 3/10] Lint & Static Type Analysis
--> [Stage 4/10] Unit Tests & Coverage Gate (Fail under 70%)
--> [Stage 5/10] Security Scans & Dependency Audits
--> [Stage 6/10] Multi-Container Docker Build
--> [Stage 7/10] Push Images to Amazon ECR
--> [Stage 8/10] Production Deployment to AWS EC2
--> [Stage 9/10] Post-Deployment Live Smoke Tests
--> [Stage 10/10] Automated Rollback Fast-Path Drill
================================================================================
 TRADEX AI: JENKINS PIPELINE SIMULATION COMPLETED SUCCESSFULLY (10/10 STAGES)
================================================================================
```
