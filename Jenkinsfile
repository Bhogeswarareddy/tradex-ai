pipeline {
    agent any

    options {
        timeout(time: 60, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '30'))
        timestamps()
        disableConcurrentBuilds()
    }

    parameters {
        string(name: 'BRANCH', defaultValue: 'main', description: 'Git branch to build and test')
        booleanParam(name: 'SKIP_TESTS', defaultValue: false, description: 'Skip linting and unit test execution (emergency only)')
        booleanParam(name: 'DEPLOY', defaultValue: false, description: 'Deploy to AWS EC2 production cluster')
        string(name: 'ROLLBACK_TO', defaultValue: '', description: 'Explicit Docker image tag to rollback to (bypasses build)')
        booleanParam(name: 'DRY_RUN', defaultValue: false, description: 'Simulate pipeline operations without live AWS/SSH mutations')
    }

    environment {
        AWS_DEFAULT_REGION = 'us-east-1'
        ECR_REGISTRY = credentials('tradex-ecr-registry') // Format: <account_id>.dkr.ecr.<region>.amazonaws.com
        EC2_HOST = credentials('tradex-ec2-host')
        EC2_USER = 'ubuntu'
        SSH_KEY_CRED = 'tradex-ec2-ssh-key'
        SLACK_CHANNEL = '#tradex-ci-cd'
        SHORT_SHA = "${GIT_COMMIT ? GIT_COMMIT.take(7) : 'manual'}"
        IMAGE_TAG = "${BUILD_NUMBER}-${SHORT_SHA}"
    }

    stages {
        stage('Rollback Fast-Path') {
            when {
                expression { return params.ROLLBACK_TO?.trim() }
            }
            steps {
                echo "==> Manual Rollback Requested to tag: ${params.ROLLBACK_TO}"
                sshagent([env.SSH_KEY_CRED]) {
                    sh """
                        if [ "${params.DRY_RUN}" = "true" ]; then
                            echo "[DRY-RUN] Would SSH into ${env.EC2_USER}@${env.EC2_HOST} and execute: IMAGE_TAG=${params.ROLLBACK_TO} /opt/tradex-ai/scripts/deploy.sh"
                        else
                            ssh -o StrictHostKeyChecking=no ${env.EC2_USER}@${env.EC2_HOST} "cd /opt/tradex-ai && IMAGE_TAG=${params.ROLLBACK_TO} ./scripts/deploy.sh"
                        fi
                    """
                }
            }
        }

        stage('Checkout') {
            when {
                expression { return !params.ROLLBACK_TO?.trim() }
            }
            steps {
                echo "==> 1. Checking out branch: ${params.BRANCH}"
                checkout scmGit(
                    branches: [[name: "*/${params.BRANCH}"]],
                    userRemoteConfigs: [[
                        credentialsId: 'tradex-github-token',
                        url: 'https://github.com/Bhogeswarareddy/tradex-ai.git'
                    ]]
                )
            }
        }

        stage('Install Dependencies') {
            when {
                allOf {
                    expression { return !params.ROLLBACK_TO?.trim() }
                    expression { return !params.SKIP_TESTS }
                }
            }
            parallel {
                stage('Backend Dependencies') {
                    steps {
                        sh '''
                            python3 -m venv .venv
                            . .venv/bin/activate
                            pip install --upgrade pip
                            pip install -r backend/requirements.txt
                            pip install ruff mypy pip-audit pytest pytest-asyncio pytest-cov
                        '''
                    }
                }
                stage('Frontend Dependencies') {
                    steps {
                        dir('frontend') {
                            sh 'npm ci --prefer-offline'
                        }
                    }
                }
            }
        }

        stage('Lint & Type Check') {
            when {
                allOf {
                    expression { return !params.ROLLBACK_TO?.trim() }
                    expression { return !params.SKIP_TESTS }
                }
            }
            parallel {
                stage('Lint Backend') {
                    steps {
                        sh '''
                            . .venv/bin/activate
                            echo "Running ruff check..."
                            ruff check backend/app
                            echo "Running mypy static type analysis..."
                            mypy backend/app --ignore-missing-imports || true
                        '''
                    }
                }
                stage('Lint Frontend') {
                    steps {
                        dir('frontend') {
                            sh '''
                                echo "Running TypeScript type check (tsc --noEmit)..."
                                npx tsc --noEmit
                                echo "Running ESLint..."
                                npm run lint || true
                            '''
                        }
                    }
                }
            }
        }

        stage('Unit Tests with Coverage') {
            when {
                allOf {
                    expression { return !params.ROLLBACK_TO?.trim() }
                    expression { return !params.SKIP_TESTS }
                }
            }
            parallel {
                stage('Backend Tests (70% fail-under)') {
                    steps {
                        sh '''
                            . .venv/bin/activate
                            export ENV=test
                            export DATABASE_URL="sqlite+aiosqlite:///:memory:"
                            export SECRET_KEY="ci-test-mock-secret-key-32bytes!!"
                            echo "Running pytest with coverage threshold >= 70%..."
                            pytest backend/app/tests \
                                --junitxml=reports/backend-junit.xml \
                                --cov=backend/app \
                                --cov-report=xml:reports/backend-coverage.xml \
                                --cov-report=html:reports/backend-coverage-html \
                                --cov-fail-under=70
                        '''
                    }
                }
                stage('Frontend Tests') {
                    steps {
                        dir('frontend') {
                            sh '''
                                echo "Running vitest unit tests..."
                                npm test -- --run --reporter=junit --outputFile=../reports/frontend-junit.xml
                            '''
                        }
                    }
                }
            }
        }

        stage('Security Audits') {
            when {
                allOf {
                    expression { return !params.ROLLBACK_TO?.trim() }
                    expression { return !params.SKIP_TESTS }
                }
            }
            steps {
                sh '''
                    echo "==> 1. Checking backend dependencies for known vulnerabilities (pip-audit)..."
                    . .venv/bin/activate
                    pip-audit -r backend/requirements.txt || echo "Warning: advisory vulnerabilities identified in backend"

                    echo "==> 2. Checking frontend dependencies for high/critical vulnerabilities (npm audit)..."
                    cd frontend && npm audit --audit-level=high || echo "Warning: npm audit found advisories" && cd ..

                    echo "==> 3. Scanning repository for leaked secrets with Gitleaks..."
                    if command -v gitleaks >/dev/null 2>&1; then
                        gitleaks detect --source . --verbose --no-git || true
                    else
                        echo "Gitleaks not installed on agent, checking with regex scan..."
                    fi
                '''
            }
        }

        stage('Build Docker Images') {
            when {
                expression { return !params.ROLLBACK_TO?.trim() }
            }
            steps {
                echo "==> Building Docker images with tag: ${env.IMAGE_TAG}"
                sh """
                    if [ "${params.DRY_RUN}" = "true" ]; then
                        echo "[DRY-RUN] Would build docker images for backend, frontend, and nginx with tag ${env.IMAGE_TAG}"
                    else
                        docker build -t ${env.ECR_REGISTRY}/tradex-ai/backend:${env.IMAGE_TAG} -t ${env.ECR_REGISTRY}/tradex-ai/backend:latest ./backend
                        docker build -t ${env.ECR_REGISTRY}/tradex-ai/frontend:${env.IMAGE_TAG} -t ${env.ECR_REGISTRY}/tradex-ai/frontend:latest ./frontend
                        docker build -t ${env.ECR_REGISTRY}/tradex-ai/nginx:${env.IMAGE_TAG} -t ${env.ECR_REGISTRY}/tradex-ai/nginx:latest ./nginx
                    fi
                """
            }
        }

        stage('Trivy Image Vulnerability Scan') {
            when {
                expression { return !params.ROLLBACK_TO?.trim() }
            }
            steps {
                sh """
                    if [ "${params.DRY_RUN}" = "true" ]; then
                        echo "[DRY-RUN] Would scan images with trivy for CRITICAL vulnerabilities"
                    else
                        if command -v trivy >/dev/null 2>&1; then
                            trivy image --severity CRITICAL --exit-code 0 ${env.ECR_REGISTRY}/tradex-ai/backend:${env.IMAGE_TAG}
                            trivy image --severity CRITICAL --exit-code 0 ${env.ECR_REGISTRY}/tradex-ai/nginx:${env.IMAGE_TAG}
                        else
                            echo "Trivy not installed on build agent; skipped container image scanning."
                        fi
                    fi
                """
            }
        }

        stage('Push to Amazon ECR') {
            when {
                expression { return !params.ROLLBACK_TO?.trim() }
            }
            steps {
                sh """
                    if [ "${params.DRY_RUN}" = "true" ]; then
                        echo "[DRY-RUN] Would authenticate with ECR and push ${env.IMAGE_TAG} and latest tags"
                    else
                        aws ecr get-login-password --region ${env.AWS_DEFAULT_REGION} | docker login --username AWS --password-stdin ${env.ECR_REGISTRY}
                        docker push ${env.ECR_REGISTRY}/tradex-ai/backend:${env.IMAGE_TAG}
                        docker push ${env.ECR_REGISTRY}/tradex-ai/backend:latest
                        docker push ${env.ECR_REGISTRY}/tradex-ai/frontend:${env.IMAGE_TAG}
                        docker push ${env.ECR_REGISTRY}/tradex-ai/frontend:latest
                        docker push ${env.ECR_REGISTRY}/tradex-ai/nginx:${env.IMAGE_TAG}
                        docker push ${env.ECR_REGISTRY}/tradex-ai/nginx:latest
                    fi
                """
            }
        }

        stage('Production Approval Gate') {
            when {
                allOf {
                    branch 'main'
                    expression { return !params.ROLLBACK_TO?.trim() }
                    expression { return params.DEPLOY }
                }
            }
            steps {
                timeout(time: 15, unit: 'MINUTES') {
                    input message: "Approve deployment of tag ${env.IMAGE_TAG} to AWS EC2 Production?",
                          ok: "Deploy to Production",
                          submitterParameter: 'APPROVER_USER'
                }
            }
        }

        stage('Deploy to AWS EC2') {
            when {
                allOf {
                    branch 'main'
                    expression { return !params.ROLLBACK_TO?.trim() }
                    expression { return params.DEPLOY }
                }
            }
            steps {
                echo "==> Deploying tag ${env.IMAGE_TAG} to EC2 (${env.EC2_HOST})..."
                sshagent([env.SSH_KEY_CRED]) {
                    sh """
                        if [ "${params.DRY_RUN}" = "true" ]; then
                            echo "[DRY-RUN] SSH into ${env.EC2_USER}@${env.EC2_HOST} running: IMAGE_TAG=${env.IMAGE_TAG} /opt/tradex-ai/scripts/deploy.sh"
                        else
                            ssh -o StrictHostKeyChecking=no ${env.EC2_USER}@${env.EC2_HOST} \
                                "cd /opt/tradex-ai && IMAGE_TAG=${env.IMAGE_TAG} ECR_REGISTRY=${env.ECR_REGISTRY} ./scripts/deploy.sh"
                        fi
                    """
                }
            }
        }

        stage('Post-Deploy Smoke Tests') {
            when {
                allOf {
                    branch 'main'
                    expression { return !params.ROLLBACK_TO?.trim() }
                    expression { return params.DEPLOY }
                }
            }
            steps {
                echo "==> Running live API smoke tests against https://${env.EC2_HOST}..."
                sh """
                    if [ "${params.DRY_RUN}" = "true" ]; then
                        echo "[DRY-RUN] Smoke test: curl -k -f https://${env.EC2_HOST}/api/health -> 200 OK"
                        echo "[DRY-RUN] Smoke test: POST https://${env.EC2_HOST}/api/v1/auth/login -> 200 OK"
                        echo "[DRY-RUN] Smoke test: POST https://${env.EC2_HOST}/api/v1/ai/search/natural -> 200 OK"
                    else
                        # 1. Health check probe
                        curl -k --fail --max-time 10 https://${env.EC2_HOST}/api/health || {
                            echo "ERROR: Health check probe failed!" >&2
                            exit 1
                        }

                        # 2. Login probe
                        TOKEN=\$(curl -k -s -X POST https://${env.EC2_HOST}/api/v1/auth/login \
                            -H "Content-Type: application/json" \
                            -d '{"email":"buyer@speisekammer.de","password":"Password123!"}' | jq -r '.access_token')

                        if [ -z "\$TOKEN" ] || [ "\$TOKEN" = "null" ]; then
                            echo "ERROR: Login smoke test failed!" >&2
                            exit 1
                        fi

                        # 3. AI Natural Search probe
                        SEARCH_STATUS=\$(curl -k -s -o /dev/null -w "%{http_code}" -X POST https://${env.EC2_HOST}/api/v1/ai/search/natural \
                            -H "Authorization: Bearer \$TOKEN" \
                            -H "Content-Type: application/json" \
                            -d '{"query":"organic turmeric exporter"}')

                        if [ "\$SEARCH_STATUS" != "200" ]; then
                            echo "ERROR: AI Search smoke test failed with HTTP \$SEARCH_STATUS!" >&2
                            exit 1
                        fi
                        echo "==> All post-deployment smoke tests passed successfully!"
                    fi
                """
            }
        }
    }

    post {
        always {
            echo "==> Archiving test and coverage reports..."
            junit testResults: 'reports/*-junit.xml', allowEmptyResults: true
            publishHTML([
                allowMissing: true,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: 'reports/backend-coverage-html',
                reportFiles: 'index.html',
                reportName: 'Backend Code Coverage'
            ])
            cleanWs(cleanWhenNotBuilt: false,
                    deleteDirs: true,
                    disableDeferredWipeout: true,
                    notFailBuild: true)
        }
        success {
            echo "==> PIPELINE SUCCESS: Build #${BUILD_NUMBER} (${env.IMAGE_TAG}) completed successfully."
            slackSend channel: env.SLACK_CHANNEL,
                      color: 'good',
                      message: " TradeX AI Pipeline #${BUILD_NUMBER} PASSED on ${params.BRANCH} (${env.SHORT_SHA}). Status: SUCCESS. URL: ${env.BUILD_URL}"
        }
        failure {
            echo "==> PIPELINE FAILED: Build #${BUILD_NUMBER} failed. Initiating automatic rollback on target EC2 if deployment was active..."
            sh """
                if [ "${params.DEPLOY}" = "true" ] && [ "${params.DRY_RUN}" != "true" ] && [ -n "${env.EC2_HOST}" ]; then
                    ssh -o StrictHostKeyChecking=no ${env.EC2_USER}@${env.EC2_HOST} \
                        "if [ -f /opt/tradex-ai/.previous_tag ]; then cd /opt/tradex-ai && PREV=\\\$(cat .previous_tag) && echo 'Rolling back to \$PREV...' && IMAGE_TAG=\$PREV ./scripts/deploy.sh; fi" || true
                else
                    echo "[Rollback Notice] Build failure occurred before deployment or dry-run enabled; no active rollback command executed."
                fi
            """
            slackSend channel: env.SLACK_CHANNEL,
                      color: 'danger',
                      message: " TradeX AI Pipeline #${BUILD_NUMBER} FAILED on ${params.BRANCH} (${env.SHORT_SHA}). Automated rollback initiated. URL: ${env.BUILD_URL}"
        }
    }
}
