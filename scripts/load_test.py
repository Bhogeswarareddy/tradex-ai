"""
TradeX AI Production Load Testing Script
Simulates 50 concurrent virtual users hitting core transactional and AI endpoints:
- Product Search (/api/v1/search)
- AI Mode / Sourcing Orchestrator (/api/v1/ai-search/orchestrate)
- RFQs Directory (/api/v1/rfqs)
- Orders Directory (/api/v1/orders)
- Health Check (/api/health)
"""

import asyncio
import time
import statistics
import json
from datetime import datetime, timezone
import httpx
from app.core.database import SyncSessionLocal
from app.models.identity import User
from app.core.security import create_access_token
from datetime import timedelta

BASE_URL = "http://localhost:8000"
CONCURRENT_USERS = 50
REQUESTS_PER_USER = 10
TOTAL_REQUESTS = CONCURRENT_USERS * REQUESTS_PER_USER

# Retrieve or create a valid auth token for load testing
db = SyncSessionLocal()
try:
    buyer = db.query(User).filter(User.role == "buyer").first()
    if buyer:
        auth_token = create_access_token(
            {"sub": str(buyer.id), "email": buyer.email, "role": buyer.role},
            expires_delta=timedelta(hours=2)
        )
    else:
        auth_token = create_access_token(
            {"sub": "load-test-buyer", "email": "loadtest@tradex.com", "role": "buyer"},
            expires_delta=timedelta(hours=2)
        )
finally:
    db.close()

HEADERS = {
    "Authorization": f"Bearer {auth_token}",
    "Content-Type": "application/json"
}

ENDPOINTS = [
    {
        "name": "Catalogue Search",
        "method": "GET",
        "url": "/api/v1/products?q=rice&page=1&limit=10",
        "weight": 35,
    },
    {
        "name": "AI Sourcing Search",
        "method": "POST",
        "url": "/api/v1/ai/search",
        "payload": {
            "query": "I need 500 kg basmati rice"
        },
        "weight": 25,
    },
    {
        "name": "RFQs Directory",
        "method": "GET",
        "url": "/api/v1/rfqs?limit=10",
        "weight": 20,
    },
    {
        "name": "Orders Directory",
        "method": "GET",
        "url": "/api/v1/orders?limit=10",
        "weight": 10,
    },
    {
        "name": "Platform Health",
        "method": "GET",
        "url": "/api/health",
        "weight": 10,
    },
]

async def simulate_user(user_id: int, results: list, client: httpx.AsyncClient):
    import random
    choices = [e for e in ENDPOINTS for _ in range(e["weight"])]
    
    for i in range(REQUESTS_PER_USER):
        target = random.choice(choices)
        start = time.perf_counter()
        status = 0
        error = None
        
        try:
            if target["method"] == "GET":
                res = await client.get(
                    f"{BASE_URL}{target['url']}",
                    headers=HEADERS,
                    timeout=30.0
                )
            else:
                res = await client.post(
                    f"{BASE_URL}{target['url']}",
                    headers=HEADERS,
                    json=target.get("payload", {}),
                    timeout=30.0
                )
            status = res.status_code
        except Exception as e:
            error = str(e)
            
        duration = (time.perf_counter() - start) * 1000.0  # ms
        results.append({
            "user_id": user_id,
            "endpoint": target["name"],
            "duration_ms": duration,
            "status": status,
            "error": error
        })
        await asyncio.sleep(0.02)  # realistic think time

async def main():
    print(f"=== Starting TradeX Production Load Test ===")
    print(f"Concurrent Users: {CONCURRENT_USERS}")
    print(f"Requests per user: {REQUESTS_PER_USER}")
    print(f"Target Total Requests: {TOTAL_REQUESTS}")
    print(f"Target URL: {BASE_URL}")
    print("-" * 50)
    
    results = []
    limits = httpx.Limits(max_keepalive_connections=100, max_connections=200)
    
    start_total = time.perf_counter()
    async with httpx.AsyncClient(limits=limits) as client:
        tasks = [simulate_user(u, results, client) for u in range(CONCURRENT_USERS)]
        await asyncio.gather(*tasks)
    total_time = time.perf_counter() - start_total
    
    successful = [r for r in results if 200 <= r["status"] < 400]
    failed = [r for r in results if r["status"] < 200 or r["status"] >= 400]
    durations = [r["duration_ms"] for r in successful]
    
    durations.sort()
    n = len(durations)
    p50 = durations[int(n * 0.50)] if n else 0
    p90 = durations[int(n * 0.90)] if n else 0
    p95 = durations[int(n * 0.95)] if n else 0
    p99 = durations[int(n * 0.99)] if n else 0
    avg_latency = statistics.mean(durations) if n else 0
    rps = len(results) / total_time if total_time > 0 else 0
    
    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "concurrency": CONCURRENT_USERS,
        "total_requests": len(results),
        "successful_requests": len(successful),
        "failed_requests": len(failed),
        "total_duration_seconds": round(total_time, 2),
        "requests_per_second": round(rps, 2),
        "latency_ms": {
            "avg": round(avg_latency, 2),
            "p50": round(p50, 2),
            "p90": round(p90, 2),
            "p95": round(p95, 2),
            "p99": round(p99, 2),
            "min": round(durations[0], 2) if n else 0,
            "max": round(durations[-1], 2) if n else 0,
        },
        "by_endpoint": {}
    }
    
    for ep in ["Catalogue Search", "AI Sourcing Search", "RFQs Directory", "Orders Directory", "Platform Health"]:
        ep_res = [r for r in successful if r["endpoint"] == ep]
        if ep_res:
            ep_durs = sorted([r["duration_ms"] for r in ep_res])
            ep_n = len(ep_durs)
            report["by_endpoint"][ep] = {
                "count": ep_n,
                "avg_ms": round(statistics.mean(ep_durs), 2),
                "p95_ms": round(ep_durs[int(ep_n * 0.95)], 2),
                "min_ms": round(ep_durs[0], 2),
                "max_ms": round(ep_durs[-1], 2),
            }
            
    print(f"\n=== Load Test Results ===")
    print(f"Total Requests: {report['total_requests']}")
    print(f"Success Rate: {round(len(successful)/len(results)*100, 2)}% ({len(successful)} success, {len(failed)} fail)")
    print(f"RPS: {report['requests_per_second']}")
    print(f"Total Test Duration: {report['total_duration_seconds']}s")
    print(f"Latency Distribution:")
    print(f"  Avg: {report['latency_ms']['avg']} ms")
    print(f"  p50: {report['latency_ms']['p50']} ms")
    print(f"  p90: {report['latency_ms']['p90']} ms")
    print(f"  p95: {report['latency_ms']['p95']} ms")
    print(f"  p99: {report['latency_ms']['p99']} ms")
    print("\nPer-Endpoint Breakdown:")
    for ep, stats in report["by_endpoint"].items():
        print(f"  [{ep}]: count={stats['count']}, avg={stats['avg_ms']}ms, p95={stats['p95_ms']}ms")
        
    with open("/tmp/load_test_results.json", "w") as f:
        json.dump(report, f, indent=2)
    print("\nSaved detailed results to /tmp/load_test_results.json")

if __name__ == "__main__":
    asyncio.run(main())
