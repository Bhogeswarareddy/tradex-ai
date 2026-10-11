# TradeX AI: Docker Multi-Container Architecture & Verification Guide

This document provides complete verification instructions, architecture details, and verification commands for the TradeX AI production multi-container deployment (addressing Problem 20 requirements).

---

## 1. System Architecture & Container Topology

TradeX AI runs as an isolated multi-container stack orchestrated via Docker Compose:

```
                  +----------------------------------------------------+
                  |                   HOST MACHINE                     |
                  |                                                    |
                  |         Ports 80 & 443 Exposed Publicly            |
                  +--------------------------+-------------------------+
                                             |
                                             v
                      +----------------------------------------------+
                      |         nginx_proxy (Alpine Nginx)           |
                      |  - TLS 1.2 & 1.3 termination                 |
                      |  - HTTP -> HTTPS redirection                 |
                      |  - Security headers & Gzip compression       |
                      |  - client_max_body_size 12m                  |
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
                                              |  - Port 5432 NOT exposed host |
                                              |  - Volume: pgdata             |
                                              |  - Resource limit: 1 CPU / 1G |
                                              +-------------------------------+
```

### Network Isolation Guarantee
- **`frontend_net` (Bridge)**: Connects `nginx_proxy`, `react_app`, and `fastapi_app`.
- **`backend_net` (Bridge)**: Connects `fastapi_app` and `pg_db`.
- **Crucial Security Rule**: The PostgreSQL database port `5432` is **never exposed** to the host machine or public internet. Only the backend API container can communicate with the database over `backend_net`.

---

## 2. Prerequisites & Quickstart

### Generate Self-Signed Certificates (Local Development)
```bash
./scripts/gen-self-signed-cert.sh
# Or with make:
make certs
```

### Build & Start the Multi-Container Stack
```bash
docker compose up --build -d
# Or with make:
make up
```

The startup sequence automatically executes:
1. Starts `pg_db` and waits for PostgreSQL readiness.
2. Runs the one-shot `migrate` service (`scripts/migrate-and-seed.sh`) to apply Alembic migrations and seed initial trade/market data.
3. Once migration successfully completes, starts `fastapi_app` and `react_app`.
4. Starts `nginx_proxy` once both upstream containers report healthy.

---

## 3. Verification Commands & Expected Outputs

### 3.1 Container Health & Port Exposure
Run:
```bash
docker compose ps
```
**Expected Output**:
```
NAME          IMAGE                     COMMAND                  SERVICE    CREATED          STATUS                    PORTS
fastapi_app   tradex-ai-backend         "/entrypoint.sh guni…"   backend    10 minutes ago   Up 10 minutes (healthy)   
nginx_proxy   tradex-ai-nginx           "/docker-entrypoint.…"   nginx      10 minutes ago   Up 10 minutes (healthy)   0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
pg_db         pgvector/pgvector:pg16    "docker-entrypoint.s…"   db         10 minutes ago   Up 10 minutes (healthy)   5432/tcp
react_app     tradex-ai-frontend        "/docker-entrypoint.…"   frontend   10 minutes ago   Up 10 minutes (healthy)   
```
*Note*: Notice that only `nginx_proxy` maps host ports (`0.0.0.0:80->80/tcp` and `0.0.0.0:443->443/tcp`). The database `pg_db` shows internal `5432/tcp` with **no host mapping**.

---

### 3.2 Resource Usage (Resource Limits Enforcement)
Run:
```bash
docker stats --no-stream
# Or with make:
make stats
```
**Expected Output**:
```
CONTAINER ID   NAME          CPU %     MEM USAGE / LIMIT     MEM %     NET I/O           BLOCK I/O        PIDS
a1b2c3d4e5f6   fastapi_app   0.15%     185.4MiB / 1GiB       18.11%    1.2MB / 850KB     0B / 12.3MB      5
b2c3d4e5f6a1   react_app     0.01%     14.2MiB / 512MiB      2.77%     450KB / 320KB     0B / 0B          2
c3d4e5f6a1b2   nginx_proxy   0.02%     18.6MiB / 256MiB      7.27%     2.4MB / 1.9MB     0B / 0B          3
d4e5f6a1b2c3   pg_db         0.08%     92.1MiB / 1GiB        8.99%     850KB / 1.2MB     0B / 45.2MB      7
```
Every container operates strictly within its CPU and Memory ceilings configured in `docker-compose.yml`.

---

### 3.3 HTTP to HTTPS Redirection & Security Headers
Run:
```bash
curl -I http://localhost/
```
**Expected Output**:
```http
HTTP/1.1 301 Moved Permanently
Server: nginx
Location: https://localhost/
Connection: keep-alive
```

Run HTTPS request and inspect headers:
```bash
curl -k -I https://localhost/api/health
```
**Expected Output**:
```http
HTTP/1.1 200 OK
Server: nginx
Content-Type: application/json
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; ...
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-XSS-Protection: 1; mode=block
```

---

### 3.4 Non-Root User Security Verification
Verify that the backend container runs strictly as a non-privileged user (`appuser`, UID `10001`):
```bash
docker exec fastapi_app id
```
**Expected Output**:
```
uid=10001(appuser) gid=10001(appuser) groups=10001(appuser)
```

Attempting root actions inside the backend container fails securely:
```bash
docker exec fastapi_app touch /etc/test_file
```
**Expected Output**:
```
touch: cannot touch '/etc/test_file': Permission denied
```

---

### 3.5 Database & Document Persistence Test
Verify that PostgreSQL database and document volumes survive complete container teardown and recreation:

1. Create a verification record via the API or direct DB query:
```bash
docker exec -i pg_db psql -U tradex_user -d tradex -c "CREATE TABLE IF NOT EXISTS _persistence_check (id serial primary key, val text); INSERT INTO _persistence_check (val) VALUES ('verified_persistence_token');"
```

2. Stop and remove all containers:
```bash
docker compose down
```

3. Restart the containers:
```bash
docker compose up -d
```

4. Verify that data persists:
```bash
docker exec -i pg_db psql -U tradex_user -d tradex -c "SELECT * FROM _persistence_check;"
```
**Expected Output**:
```
 id |            val             
----+----------------------------
  1 | verified_persistence_token
(1 row)
```

5. Clean up test table:
```bash
docker exec -i pg_db psql -U tradex_user -d tradex -c "DROP TABLE _persistence_check;"
```

---

### 3.6 Automated Backup and Restore Test
1. Run local backup:
```bash
./scripts/backup.sh
# Or: make backup
```
Outputs:
- `backups/db_<timestamp>.sql.gz`
- `backups/uploads_<timestamp>.tar.gz`

2. Test restoration:
```bash
./scripts/restore.sh
# Or: make restore
```
Verifies that database schema and document files are restored with zero corruption.
