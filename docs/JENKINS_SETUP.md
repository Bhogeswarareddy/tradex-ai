# TradeX AI: Jenkins CI/CD Setup Guide

This guide details the complete configuration of the Jenkins controller, credentials, GitHub webhooks, and multibranch pipeline for TradeX AI.

---

## 1. Quickstart: Launching the Jenkins Controller

The Jenkins controller runs as an isolated multi-tool container including Docker CLI, Git, Node.js 20, Python 3.12, and pre-installed plugins.

### 1.1 Start Jenkins
```bash
cd jenkins
docker compose up -d
```

### 1.2 Unlock Jenkins
1. Retrieve the initial administrator password:
   ```bash
   docker exec jenkins_controller cat /var/jenkins_home/secrets/initialAdminPassword
   ```
2. Open your browser at `http://localhost:8080`.
3. Paste the initial administrator password, create an administrator user, and complete setup.

---

## 2. Credentials Configuration

Navigate to **Manage Jenkins $\rightarrow$ Credentials $\rightarrow$ System $\rightarrow$ Global credentials $\rightarrow$ Add Credentials** and register the following credentials:

| Credential ID | Kind | Description | Value / Scope |
|---|---|---|---|
| `tradex-github-token` | Secret text | GitHub Personal Access Token | Classic token or fine-grained token with `repo` and `admin:repo_hook` scopes |
| `tradex-ecr-registry` | Secret text | AWS ECR Registry URI | e.g. `123456789012.dkr.ecr.us-east-1.amazonaws.com` |
| `tradex-ec2-host` | Secret text | Target AWS EC2 hostname / IP | Public IP or DNS (e.g. `api.tradex.ai`) |
| `tradex-ec2-ssh-key` | SSH Username with private key | EC2 SSH Deployment Key | Username: `ubuntu`, Private Key: contents of `tradex-deployer.pem` |
| `slack-token` | Secret text | Slack Webhook or Bot Token | OAuth token for posting pipeline build status to `#tradex-ci-cd` |

---

## 3. GitHub Webhook Configuration

To trigger automated builds upon commit push and pull request creation:

1. Open your repository on GitHub: `https://github.com/Bhogeswarareddy/tradex-ai`.
2. Go to **Settings $\rightarrow$ Webhooks $\rightarrow$ Add webhook**.
3. Configure the following fields:
   - **Payload URL**: `https://<your-jenkins-domain>/github-webhook/` (e.g. `https://jenkins.tradex.ai/github-webhook/`).
   - **Content type**: `application/json`.
   - **Which events would you like to trigger this webhook?**:
     - Select *"Let me select individual events"*:
       - **Pushes**
       - **Pull requests**
4. Click **Add webhook**. GitHub will send a test ping to verify HTTP 200 OK connectivity.

---

## 4. Multibranch Pipeline Setup

1. In Jenkins dashboard, click **New Item**.
2. Enter item name: `tradex-ai-pipeline` and choose **Multibranch Pipeline**.
3. Under **Branch Sources**, click **Add source $\rightarrow$ GitHub**:
   - **Credentials**: Select `tradex-github-token`.
   - **Repository HTTPS URL**: `https://github.com/Bhogeswarareddy/tradex-ai.git`.
   - **Behaviors**:
     - *Discover branches* (Strategy: Exclude branches that are also filed as PRs).
     - *Discover pull requests from origin* (Strategy: Merging the pull request with the current target branch revision).
4. Under **Build Configuration**:
   - **Mode**: *by Jenkinsfile*.
   - **Script Path**: `Jenkinsfile`.
5. Under **Scan Multibranch Pipeline Triggers**:
   - Check *Periodically if not otherwise run* (Interval: 1 hour).
6. Click **Save**. Jenkins scans the repository, discovers branches, and launches the initial pipeline run on `main`.

---

## 5. Pipeline Parameters Reference

The declarative `Jenkinsfile` accepts the following build parameters:

- `BRANCH` *(string, default: `main`)*: The Git branch or tag to build and evaluate.
- `SKIP_TESTS` *(boolean, default: `false`)*: Bypasses linting and test stages (strictly reserved for critical hotfix emergencies).
- `DEPLOY` *(boolean, default: `false`)*: Deploys to AWS EC2 production. If `true` on branch `main`, prompts the operator for interactive manual approval.
- `ROLLBACK_TO` *(string, default: `""`)*: Fast-path parameter. When specified with an image tag (e.g. `41-3a1b2c3`), bypasses checkout, tests, and build, and rolls back the EC2 production instance immediately.
- `DRY_RUN` *(boolean, default: `false`)*: Simulates all pipeline stages locally without mutative AWS or SSH commands.
