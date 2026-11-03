# TradeX AI — Admin Bootstrap, Role System & Security Architecture

This document outlines the security architecture, role model, administrative bootstrap CLI, account lockout policies, and Multi-Factor Authentication (MFA) enforcement implemented for **TradeX AI**.

---

## 1. Role Model & Deny-by-Default Authorization

TradeX AI enforces exactly three canonical platform roles:
1. **`ADMIN`**: Platform oversight, user status & role management, audit inspections, system settings.
2. **`SUPPLIER`**: Product catalogue management, RFQ quotation response, order fulfillment.
3. **`BUYER`**: Catalog discovery, RFQ creation, quote acceptance, order placement & payment.

### Deny-by-Default Policy
- Implemented in `backend/app/core/permissions.py`.
- Any protected route must explicitly declare required roles via FastAPI dependency:
  ```python
  @router.get("/admin/users", dependencies=[Depends(require_roles("admin"))])
  async def list_users(...):
      ...
  ```
- Any access to an entity belonging to a user/tenant must enforce resource ownership using `assert_owns(user, resource)`:
  ```python
  assert_owns(current_user, rfq, id_field="buyer_id", custom_error="Access forbidden to this RFQ")
  ```
- Public self-registration (`POST /api/v1/auth/register`) rejects any payload attempting to assign the `ADMIN` role with HTTP 422 Unprocessable Entity.

---

## 2. Secure Admin Bootstrap CLI

TradeX AI does **not** hardcode administrative credentials into source code, migration scripts, or production seed data.

### CLI Command
Bootstrap an administrator securely using:
```bash
python -m app.cli create-admin [OPTIONS]
```

### Options & Flags
- `--email <EMAIL>`: Target administrative email. If omitted, reads `$ADMIN_BOOTSTRAP_EMAIL` or prompts interactively.
- `--password <PASSWORD>`: Password meeting complexity requirements. If omitted, reads `$ADMIN_BOOTSTRAP_PASSWORD` or prompts securely via `getpass`.
- `--full-name <NAME>`: Full name for the admin user (default: `"System Administrator"`).
- `--force`: Force bootstrap even if an active `ADMIN` account already exists. Without `--force`, duplicate runs are rejected with an exit code of `1`.

### Example Usages

#### A. Automated Environment Bootstrap (e.g. CI/CD or Initial Cloud Init)
```bash
export ADMIN_BOOTSTRAP_EMAIL="ops-lead@tradex.ai"
export ADMIN_BOOTSTRAP_PASSWORD="SuperSecurePassword2026!#"

python -m app.cli create-admin
```

#### B. Interactive Terminal Bootstrap
```bash
python -m app.cli create-admin
# Enter admin email: root@tradex.ai
# Enter full name [System Administrator]: TradeX Ops
# Enter admin password: ********************
# Confirm admin password: ********************
```

#### C. Enforced Singleton Check
If an admin already exists:
```bash
python -m app.cli create-admin --email newadmin@tradex.ai
# Output:
# [!] Error: An admin account already exists (ops-lead@tradex.ai). Use --force to proceed.
# Exit code: 1
```

---

## 3. Production Seed Guard

- In `backend/app/seed.py`, seeding demo admin credentials (`admin@tradex.ai`) is permitted **only** when `ENV=demo` or `ENV=development`.
- In `ENV=production`, attempting to run the demo seed script that creates or references `admin@tradex.ai` triggers an explicit security panic:
  ```python
  if is_production and "admin@tradex.ai" in seed_identities:
      raise RuntimeError("CRITICAL SECURITY ERROR: Demo admin (admin@tradex.ai) is prohibited in production!")
  ```

---

## 4. Brute-Force Rate Limiting & Account Lockout

- **Lockout Threshold**: 5 consecutive failed login attempts.
- **Lockout Duration**: 15 minutes (`900` seconds).
- **Behavior**:
  - Each invalid password increments `failed_login_attempts`.
  - On the 5th failed attempt, `locked_until` is set to `UTC_NOW + 15 minutes` and an `ACCOUNT_LOCKED` security audit entry is committed.
  - Subsequent login attempts while locked return `HTTP 401 Unauthorized` with:
    ```json
    {
      "detail": "Account temporarily locked due to excessive failed attempts. Please retry in 895 seconds."
    }
    ```
  - A successful authentication resets `failed_login_attempts = 0` and clears `locked_until`.

---

## 5. Multi-Factor Authentication (MFA / TOTP)

Admins can enroll in Time-based One-Time Password (TOTP) MFA compatible with Google Authenticator, 1Password, or Authy.

### Configuration
Set the following environment variable to enforce MFA for all admin logins:
```bash
ADMIN_REQUIRE_MFA=true
```

### Enrolment Flow
1. **Initiate Setup**:
   `POST /api/v1/admin/mfa/setup` (Admin JWT required)
   Returns:
   - `secret`: TOTP base32 secret.
   - `otpauth_url`: QR code enrollment URI (`otpauth://totp/TradeX:admin@tradex.ai?secret=...`).
   - `recovery_codes`: Set of emergency 10-character recovery codes.

2. **Verify & Activate**:
   `POST /api/v1/admin/mfa/verify`
   Payload:
   ```json
   {
     "code": "123456"
   }
   ```
   Validates the code against the secret using `pyotp.TOTP` (allowing ±1 time step drift). Upon success, sets `mfa_enabled = True` and writes an audit log.

3. **Login Enforcement**:
   When `mfa_enabled = True` (or `ADMIN_REQUIRE_MFA = true`), the standard login endpoint requires the 6-digit TOTP code passed via:
   - Header: `X-MFA-Code: 123456`
   - or JSON payload: `"mfa_code": "123456"`
   If omitted or invalid, login is rejected with `HTTP 401 Unauthorized`.

---

## 6. Audit Trail

All sensitive administrative actions are written to an append-only audit table (`audit_logs`):
- `ADMIN_BOOTSTRAP`: Execution of the CLI bootstrap tool.
- `ADMIN_LOGIN_SUCCESS` / `ADMIN_LOGIN_FAILURE`: Administrative authentication tracking.
- `ACCOUNT_LOCKED`: Automatic account lockout due to failed password attempts.
- `USER_ROLE_CHANGE`: Administrative promotion or demotion of tenant accounts.
- `ADMIN_MFA_ENABLED`: Successful activation of 2FA.
