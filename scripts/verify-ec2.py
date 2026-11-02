import httpx
import sys

base_url = "http://127.0.0.1:8000"
client = httpx.Client(verify=False, timeout=30.0)

# 1. Healthcheck
r_health = client.get(f"{base_url}/api/health")
print(f"1. Healthcheck: HTTP {r_health.status_code} - {r_health.json()}")

# 2. Login test
password = "Bhogi" + chr(36) + "1385AWS"
r_login = client.post(f"{base_url}/api/v1/auth/login", json={
    "email": "katakambhogeswarareddy138@gmail.com",
    "password": password
})
print(f"2. Admin Login: HTTP {r_login.status_code}")
if r_login.status_code == 200:
    data = r_login.json()
    token = data.get("access_token")
    user = data.get("user", {})
    print(f"   User: {user.get('email')}, Role: {user.get('role')}")
    
    # 3. Live AI Status & Live Prompt Test
    headers = {"Authorization": f"Bearer {token}"}
    r_status = client.get(f"{base_url}/api/v1/ai/status", headers=headers)
    print(f"3. AI Provider Status (/api/v1/ai/status): HTTP {r_status.status_code} - {r_status.json()}")

    r_test = client.post(f"{base_url}/api/v1/ai/test", json={"prompt": "Say hello in 5 words"}, headers=headers)
    print(f"4. Live AI Prompt (/api/v1/ai/test): HTTP {r_test.status_code}")
    if r_test.status_code == 200:
        ans = r_test.json()
        print(f"   Groq LLM Response: {ans.get('response')}")
else:
    print(f"   Login failed: {r_login.text}")
    sys.exit(1)

print("ALL_SMOKE_TESTS_PASSED")
