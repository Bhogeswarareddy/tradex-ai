# TradeX AI — Production Demo Account Access

This guide explains how to retrieve credentials for the isolated production demo accounts (one Buyer, one Supplier) to test the live platform.

> [!IMPORTANT]
> In accordance with zero-trust production security, passwords are generated cryptographically on the server and stored strictly as encrypted `SecureString` parameters in AWS Systems Manager (SSM) Parameter Store. They are never written to source code, chat, logs, or git.

---

## 1. Retrieve Demo Account Credentials via AWS CLI

Run the following commands in your authenticated terminal to retrieve the current credentials:

### A. Demo Buyer Account
```bash
# Retrieve Buyer Email
aws ssm get-parameter \
  --name "/tradex/prod/demo_buyer_email" \
  --query "Parameter.Value" \
  --output text \
  --region ap-south-1

# Retrieve Buyer Password
aws ssm get-parameter \
  --name "/tradex/prod/demo_buyer_password" \
  --with-decryption \
  --query "Parameter.Value" \
  --output text \
  --region ap-south-1
```

### B. Demo Supplier Account
```bash
# Retrieve Supplier Email
aws ssm get-parameter \
  --name "/tradex/prod/demo_supplier_email" \
  --query "Parameter.Value" \
  --output text \
  --region ap-south-1

# Retrieve Supplier Password
aws ssm get-parameter \
  --name "/tradex/prod/demo_supplier_password" \
  --with-decryption \
  --query "Parameter.Value" \
  --output text \
  --region ap-south-1
```

---

## 2. Accessing the Live Platform

1. Navigate to the live production endpoint:
   **[https://43.204.214.188/login](https://43.204.214.188/login)**
2. Enter the retrieved email and decrypted password into the standard sign-in form.
3. Test buyer procurement features, catalog discovery, AI Mode negotiation, or supplier order fulfillment.
