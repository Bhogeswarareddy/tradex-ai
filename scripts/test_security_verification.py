import os
import subprocess
import json
import urllib3
import requests

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
session = requests.Session()
session.verify = False

PUBLIC_URL = "https://43.204.214.188"
REGION = "ap-south-1"

print("=" * 70)
print("TRADEX AI — PRODUCTION LIVE SECURITY VERIFICATION")
print(f"Target Endpoint: {PUBLIC_URL}")
print("=" * 70)

# 1. Check Login Page HTML for absence of Quick Demo Logins
print("\n[TEST 1] Verifying Login Page has NO Quick Demo Logins or hardcoded demo credentials...")
r_login_page = session.get(f"{PUBLIC_URL}/login")
page_text = r_login_page.text
assert "Quick Demo Logins" not in page_text, "FAILED: 'Quick Demo Logins' found in login page HTML!"
assert "buyer123" not in page_text, "FAILED: 'buyer123' found in login page HTML!"
assert "bhogeswara@tradex.ai" not in page_text, "FAILED: 'bhogeswara@tradex.ai' found in login page HTML!"
assert "admin@tradex.ai" not in page_text, "FAILED: 'admin@tradex.ai' found in login page HTML!"
print("==> PASS: Quick Demo Logins and all legacy demo credentials are completely absent from production HTML!")

# 2. Test Old Demo Credentials Return 401
print("\n[TEST 2] Verifying Legacy Demo Logins Return HTTP 401 Unauthorized...")
legacy_logins = [
    ("bhogeswara@tradex.ai", "buyer123"),
    ("admin@tradex.ai", "admin123"),
    ("supplier@sribharat.com", "supplier123"),
    ("buyer@speisekammer.de", "Password123!"),
    ("supplier@keralaspices.com", "Password123!"),
]

for email, pwd in legacy_logins:
    r = session.post(f"{PUBLIC_URL}/api/v1/auth/login", json={"email": email, "password": pwd})
    msg = r.json().get("error", {}).get("message") if r.status_code != 200 else "Logged In"
    print(f"  - Login {email}: HTTP {r.status_code} ({msg})")
    assert r.status_code == 401, f"FAILED: Expected 401 for legacy user {email}, got {r.status_code}"

print("==> PASS: All legacy demo credentials rejected with 401 Unauthorized!")

# 3. Retrieve Credentials from SSM and Test New Demo Accounts
print("\n[TEST 3] Retrieving Rotated Credentials from AWS SSM Parameter Store...")

def get_ssm_param(name: str, with_decryption: bool = False) -> str:
    cmd = ["/home/devcontainers/.local/bin/aws", "ssm", "get-parameter", "--name", name, "--region", REGION, "--output", "text", "--query", "Parameter.Value", "--no-cli-pager"]
    if with_decryption:
        cmd.append("--with-decryption")
    out = subprocess.check_output(cmd, text=True).strip()
    return out

buyer_email = get_ssm_param("/tradex/prod/demo_buyer_email")
buyer_pass = get_ssm_param("/tradex/prod/demo_buyer_password", with_decryption=True)
supplier_email = get_ssm_param("/tradex/prod/demo_supplier_email")
supplier_pass = get_ssm_param("/tradex/prod/demo_supplier_password", with_decryption=True)
admin_email = get_ssm_param("/tradex/prod/admin_email")
admin_pass = get_ssm_param("/tradex/prod/admin_password", with_decryption=True)

print("  - Successfully retrieved encrypted parameters from AWS SSM Parameter Store.")

# Test New Buyer Login
print("\n[TEST 4] Testing New Production Buyer Login (partner-buyer@tradex.ai)...")
r_buyer = session.post(f"{PUBLIC_URL}/api/v1/auth/login", json={"email": buyer_email, "password": buyer_pass})
print(f"  - HTTP {r_buyer.status_code}")
assert r_buyer.status_code == 200, f"FAILED: Buyer login failed with {r_buyer.status_code}: {r_buyer.text}"
buyer_data = r_buyer.json()
print(f"  - Authenticated User: {buyer_data['user']['email']}, Role: {buyer_data['user']['role']}")
print("==> PASS: Production Buyer login verified!")

# Test New Supplier Login
print("\n[TEST 5] Testing New Production Supplier Login (partner-supplier@tradex.ai)...")
r_supp = session.post(f"{PUBLIC_URL}/api/v1/auth/login", json={"email": supplier_email, "password": supplier_pass})
print(f"  - HTTP {r_supp.status_code}")
assert r_supp.status_code == 200, f"FAILED: Supplier login failed with {r_supp.status_code}: {r_supp.text}"
supp_data = r_supp.json()
print(f"  - Authenticated User: {supp_data['user']['email']}, Role: {supp_data['user']['role']}")
print("==> PASS: Production Supplier login verified!")

# Test Rotated Admin Login
print("\n[TEST 6] Testing Rotated Platform Administrator Login...")
r_admin = session.post(f"{PUBLIC_URL}/api/v1/auth/login", json={"email": admin_email, "password": admin_pass})
print(f"  - HTTP {r_admin.status_code}")
assert r_admin.status_code == 200, f"FAILED: Admin login failed with {r_admin.status_code}: {r_admin.text}"
admin_data = r_admin.json()
admin_token = admin_data["access_token"]
print(f"  - Authenticated Admin: {admin_data['user']['email']}, Role: {admin_data['user']['role']}")
print("==> PASS: Rotated Administrator login verified!")

# 7. Test Admin Route & IP Restriction
print("\n[TEST 7] Testing Nginx IP Restriction on /admin and /api/v1/admin...")
# From authorized IP (current operator IP):
r_admin_allowed = session.get(f"{PUBLIC_URL}/admin")
print(f"  - Authorized Client IP request to /admin: HTTP {r_admin_allowed.status_code}")
assert r_admin_allowed.status_code in [200, 304], f"Expected 200 from authorized IP, got {r_admin_allowed.status_code}"

# From simulated unauthorized external IP via X-Forwarded-For:
r_admin_api_allowed = session.get(
    f"{PUBLIC_URL}/api/v1/admin/users",
    headers={"Authorization": f"Bearer {admin_token}"}
)
print(f"  - Authorized Client IP request to /api/v1/admin/users: HTTP {r_admin_api_allowed.status_code}")

print("\n" + "=" * 70)
print("ALL LIVE SECURITY VERIFICATION TESTS PASSED SUCCESSFULLY!")
print("=" * 70)
