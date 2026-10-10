"""
Structure & Invariant Verification Script for TradeX AI Prompt 1
"""
import os
import sys

REQUIRED_PATHS = [
    # Root files
    ".gitignore",
    ".env.example",
    "Makefile",
    "docker-compose.yml",
    "docker-compose.prod.yml",
    "README.md",
    "ARCHITECTURE.md",
    "RULES.md",
    # Directories
    "frontend",
    "backend",
    "nginx",
    "jenkins",
    "scripts",
    "docs",
    # Backend structure
    "backend/Dockerfile",
    "backend/Dockerfile.dev",
    "backend/requirements.txt",
    "backend/pyproject.toml",
    "backend/app/main.py",
    "backend/app/api/v1/router.py",
    "backend/app/core/config.py",
    "backend/app/core/database.py",
    "backend/app/models/base.py",
    "backend/app/schemas/health.py",
    "backend/app/schemas/pagination.py",
    "backend/app/services/__init__.py",
    "backend/app/repositories/__init__.py",
    "backend/app/ai/provider.py",
    "backend/app/tasks/__init__.py",
    "backend/app/tests/test_health.py",
    "backend/app/tests/test_ai_provider.py",
    # Frontend structure
    "frontend/Dockerfile",
    "frontend/Dockerfile.dev",
    "frontend/package.json",
    "frontend/tsconfig.json",
    "frontend/vite.config.ts",
    "frontend/tailwind.config.js",
    "frontend/index.html",
    "frontend/src/App.tsx",
    "frontend/src/main.tsx",
    "frontend/src/app/routes.tsx",
    "frontend/src/components/LoadingSpinner.tsx",
    "frontend/src/components/EmptyState.tsx",
    "frontend/src/components/ErrorState.tsx",
    "frontend/src/components/SimulatedBadge.tsx",
    "frontend/src/components/Layout.tsx",
    "frontend/src/features/auth/index.ts",
    "frontend/src/features/marketplace/index.ts",
    "frontend/src/features/suppliers/index.ts",
    "frontend/src/features/products/index.ts",
    "frontend/src/features/rfq/index.ts",
    "frontend/src/features/negotiation/index.ts",
    "frontend/src/features/orders/index.ts",
    "frontend/src/features/documents/index.ts",
    "frontend/src/features/copilot/index.ts",
    "frontend/src/features/analytics/index.ts",
    "frontend/src/features/admin/index.ts",
    "frontend/src/features/simulated/index.ts",
    "frontend/src/hooks/useHealth.ts",
    "frontend/src/lib/api/client.ts",
    "frontend/src/lib/api/types.ts",
    "frontend/src/pages/HomePage.tsx",
    "frontend/src/styles/index.css",
    "frontend/src/tests/App.test.ts",
    # Nginx
    "nginx/nginx.conf",
    "nginx/Dockerfile",
    # Jenkins
    "jenkins/Jenkinsfile",
]

def verify():
    missing = []
    for path in REQUIRED_PATHS:
        if not os.path.exists(path):
            missing.append(path)

    if missing:
        print(f"FAILED: Missing {len(missing)} paths:")
        for m in missing:
            print(f"  - {m}")
        sys.exit(1)

    print(f"SUCCESS: All {len(REQUIRED_PATHS)} required paths exist!")

if __name__ == "__main__":
    verify()
