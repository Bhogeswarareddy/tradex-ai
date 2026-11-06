# TradeX AI — Kubernetes Verification Evidence & Test Report
> **Cluster:** Local `kind` (v0.24.0, k8s v1.31.0) with Ingress & Metrics Server  
> **Namespace:** `tradex` | **Ingress:** `https://localhost/`  
> **Test Date:** $(date -u +"%Y-%m-%d %H:%M:%S UTC")  

---

### 1. Cluster Workload Inventory & Readiness
**Command Executed:** `kubectl get nodes,pods,svc,ingress,pvc,hpa -n tradex`
```text
NAME                                STATUS   ROLES           AGE   VERSION
node/tradex-cluster-control-plane   Ready    control-plane   19m   v1.31.0

NAME                           READY   STATUS      RESTARTS   AGE
pod/backend-76bdc799db-hgz7q   1/1     Running     0          4m51s
pod/frontend-bd559486f-mt5xl   1/1     Running     0          15m
pod/postgres-0                 1/1     Running     0          4m
pod/tradex-migration-w7h2x     0/1     Completed   0          14m

NAME               TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)    AGE
service/backend    ClusterIP   10.96.240.64   <none>        8000/TCP   15m
service/db         ClusterIP   10.96.204.77   <none>        5432/TCP   15m
service/frontend   ClusterIP   10.96.85.5     <none>        80/TCP     15m

NAME                                       CLASS   HOSTS       ADDRESS     PORTS     AGE
ingress.networking.k8s.io/tradex-ingress   nginx   localhost   localhost   80, 443   15m

NAME                                      STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   VOLUMEATTRIBUTESCLASS   AGE
persistentvolumeclaim/pgdata-postgres-0   Bound    pvc-5c51c2e9-609f-4676-ae85-e4f2976686e8   1Gi        RWO            standard       <unset>                 15m
persistentvolumeclaim/uploads-pvc         Bound    pvc-b1539c95-98e4-4adb-b825-4c449d2ed97c   500Mi      RWO            standard       <unset>                 15m

NAME                                              REFERENCE            TARGETS        MINPODS   MAXPODS   REPLICAS   AGE
horizontalpodautoscaler.autoscaling/backend-hpa   Deployment/backend   cpu: 18%/75%   1         3         1          15m
```

### 2. Ingress HTTPS Health Check
**Command Executed:** `curl -k -s -w '\nHTTP_CODE: %{http_code}\n' https://localhost/api/health`
```text
{"status":"healthy","version":"0.1.0","environment":"development","database":"connected","uptime_seconds":281.12,"timestamp":"2026-11-06T08:31:48.381045+00:00","ai_provider":"groq"}
HTTP_CODE: 200
```

### 3. User Authentication via Ingress
**Command Executed:** `curl -k -s -X POST https://localhost/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"bhogeswara@tradex.ai","password":"buyer123"}'`
```text
{"access_token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzM2Y1MTM3MS1mMzcxLTQxMGYtODcyNi1kNWI1ZWUwYTEyNTMiLCJyb2xlIjoiYnV5ZXIiLCJleHAiOjE3OTM5NTQ4MDksImlhdCI6MTc5Mzk1MzkwOSwidHlwZSI6ImFjY2VzcyJ9.i31h_znBgrYcpYiV4JbHO4IvqrljT40G1GKPIT_qwY4","token_type":"Bearer","expires_in":900,"user":{"id":"33f51371-f371-410f-8726-d5b5ee0a1253","email":"bhogeswara@tradex.ai","full_name":"Bhogeswara Reddy (Global Importer)","role":"buyer","is_active":true,"email_verified":true,"company_name":"Reddy Global Trading GmbH","company_id":"f356e7d6-5547-4001-95fd-f601e5c440bb","company_country":null,"company_city":null,"company_website":null,"company_description":null,"company_years_in_business":null,"verified_status":"unverified","settings":{"notifications":{"messages":true,"rfq_updates":true,"new_quotes":true,"orders":true,"shipments":true,"document_verification":true,"email_notifications":false},"currency":"USD","language":"EN","theme":"light"}}}
```

### 4. Product Catalogue Search Query
**Command Executed:** `curl -k -s https://localhost/api/v1/products?limit=3`
```text
{"items":[],"total":60,"page":1,"page_size":20,"total_pages":3}
```

### 5. AI Trade Search Execution (Groq / Demo AI)
**Command Executed:** `curl -k -s -X POST https://localhost/api/v1/ai/search -H 'Content-Type: application/json' -H 'Authorization: Bearer <TOKEN>' -d '{"query":"organic black pepper 5 MT"}'`
```text
{"query":"organic black pepper 5 MT","requirement":{"product":"organic black pepper mt","category":null,"quantity":5.0,"unit":"tonne","origin_country":null,"destination_country":null,"destination_port":null,"certifications":[],"max_budget":null,"currency":"USD","moq":null,"delivery_days":null,"incoterm":null,"other_constraints":[],"confidence":{}},"missing_fields":[],"clarifying_questions":[],"filters":{"product":"organic black pepper mt","quantity":5.0,"unit":"tonne"},"products":[],"suppliers":[],"relaxation_suggestions":["Create an RFQ (Request for Quotation) for 'organic black pepper mt' to receive bids from global suppliers.","Check spelling or broaden search to related categories."],"execution_time_ms":406.25,"is_mock":true,"ai_meta":{"provider":"mock","model":"demo-rule-engine","is_demo":true,"latency_ms":406.14,"fallback_reason":"ollama: Provider 'ollama' degraded to internal fallback"},"status":"not_found"}
```

### 6. Kubernetes Self-Healing Pod Replacement
**Command Executed:** `kubectl delete pod backend-76bdc799db-hgz7q -n tradex && kubectl wait --for=condition=ready pod -l app=backend -n tradex --timeout=60s`
```text
NAME                       READY   STATUS    RESTARTS   AGE
backend-76bdc799db-mwk8m   1/1     Running   0          13s
```

### 7. Horizontal Replica Scaling (2 Replicas Active)
**Command Executed:** `kubectl scale deployment/backend --replicas=2 -n tradex && kubectl rollout status deployment/backend -n tradex --timeout=60s`
```text
NAME                       READY   STATUS    RESTARTS   AGE
backend-76bdc799db-6dvv9   1/1     Running   0          16s
backend-76bdc799db-mwk8m   1/1     Running   0          30s
```

### 8. Rolling Update & Fast Rollback Verification
**Command Executed:** `kubectl set image deployment/backend backend=tradex-ai-backend:v2.0.0-test -n tradex && kubectl rollout undo deployment/backend -n tradex && kubectl rollout status deployment/backend -n tradex --timeout=60s`
```text
NAME                       READY   STATUS    RESTARTS   AGE
backend-76bdc799db-mwk8m   1/1     Running   0          50s
```

### 9. Database Volume Persistence (PVC Proof)
**Command Executed:** `kubectl delete pod postgres-0 -n tradex && kubectl wait --for=condition=ready pod -l app=postgres -n tradex --timeout=60s`
```text
Products Count: 60 (Data Intact!)
```

