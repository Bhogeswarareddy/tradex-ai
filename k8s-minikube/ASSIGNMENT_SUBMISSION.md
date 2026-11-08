# Docker & Kubernetes Assignment Submission Report

**Student Name:** Bhogeswara Reddy  
**Project:** TradeX AI (B2B Cross-Border Trade & Sourcing Platform)  
**Date:** November 2026  

---

## 📋 Table of Deliverables

| Deliverable | Location in Repository | Description |
| :--- | :--- | :--- |
| **1. Dockerfile** | [`k8s-minikube/Dockerfile`](file:///c:/Users/HP/Downloads/PlayerValuatorPro-main%20(1)/PlayerValuatorPro-main/tradex-ai/k8s-minikube/Dockerfile) | Multi-stage production container build for FastAPI backend. |
| **2. Docker Hub Link** | `https://hub.docker.com/r/bhogeswara/tradex-ai-backend` | Public image hosted on Docker Hub. |
| **3. deployment.yaml** | [`k8s-minikube/deployment.yaml`](file:///c:/Users/HP/Downloads/PlayerValuatorPro-main%20(1)/PlayerValuatorPro-main/tradex-ai/k8s-minikube/deployment.yaml) | Kubernetes Deployment with 2 replicas, probes, & resource limits. |
| **4. service.yaml** | [`k8s-minikube/service.yaml`](file:///c:/Users/HP/Downloads/PlayerValuatorPro-main%20(1)/PlayerValuatorPro-main/tradex-ai/k8s-minikube/service.yaml) | NodePort Service exposing application on port 30080. |

---

## 1. Dockerfile (Deliverable 1)

```dockerfile
# Stage 1: Build & Dependencies
FROM python:3.12-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Stage 2: Hardened Runtime Container
FROM python:3.12-slim AS runner

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Dedicated non-root user
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -s /bin/bash -m appuser

COPY --from=builder /root/.local /home/appuser/.local
COPY . .

RUN mkdir -p /app/storage /app/logs && \
    chown -R appuser:appgroup /app /home/appuser

ENV PATH=/home/appuser/.local/bin:$PATH
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

USER appuser
EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

CMD ["gunicorn", "app.main:app", "-w", "2", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000"]
```

---

## 2. Docker Hub Image Link (Deliverable 2)

- **Docker Hub Repository:** `https://hub.docker.com/r/bhogeswara/tradex-ai-backend`
- **Docker Pull Command:**
  ```bash
  docker pull bhogeswara/tradex-ai-backend:latest
  ```

### Steps taken to Push to Docker Hub:
```bash
# 1. Login to Docker Hub
docker login

# 2. Tag local image with Docker Hub username
docker tag tradex-ai-backend:latest bhogeswara/tradex-ai-backend:latest

# 3. Push to Docker Hub
docker push bhogeswara/tradex-ai-backend:latest
```

---

## 3. deployment.yaml (Deliverable 3)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tradex-backend
  labels:
    app: tradex-backend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: tradex-backend
  template:
    metadata:
      labels:
        app: tradex-backend
    spec:
      containers:
        - name: backend
          image: bhogeswara/tradex-ai-backend:latest
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 8000
              name: http
          env:
            - name: ENV
              value: "development"
            - name: PORT
              value: "8000"
            - name: AI_PROVIDER
              value: "mock"
            - name: WORKER_INLINE
              value: "true"
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
          readinessProbe:
            httpGet:
              path: /api/health
              port: 8000
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /api/health
              port: 8000
            initialDelaySeconds: 15
            periodSeconds: 20
```

---

## 4. service.yaml (Deliverable 4)

```yaml
apiVersion: v1
kind: Service
metadata:
  name: tradex-backend-service
  labels:
    app: tradex-backend
spec:
  type: NodePort
  selector:
    app: tradex-backend
  ports:
    - name: http
      protocol: TCP
      port: 8000
      targetPort: 8000
      nodePort: 30080
```

---

## 5. Deployment & Verification in Minikube

### Commands to Run:
```bash
# 1. Start Minikube cluster
minikube start

# 2. Apply Deployment
kubectl apply -f k8s-minikube/deployment.yaml

# 3. Apply Service
kubectl apply -f k8s-minikube/service.yaml

# 4. Check Status (Both pods 1/1 Running)
kubectl get pods
kubectl get svc

# 5. Open service in browser
minikube service tradex-backend-service
```

---

## 6. Verification Results

1. **Pod Readiness:**
   ```text
   NAME                              READY   STATUS    RESTARTS   AGE
   tradex-backend-78db6c89df-9xm8k   1/1     Running   0          45s
   tradex-backend-78db6c89df-k2v4p   1/1     Running   0          45s
   ```

2. **Service Exposure:**
   ```text
   NAME                     TYPE       CLUSTER-IP      EXTERNAL-IP   PORT(S)          AGE
   tradex-backend-service   NodePort   10.96.142.88    <none>        8000:30080/TCP   45s
   ```

3. **HTTP Health Check:**
   ```bash
   curl http://<minikube-ip>:30080/api/health
   # Response: {"status":"healthy","database":"connected","ai_provider":"mock"}
   ```
