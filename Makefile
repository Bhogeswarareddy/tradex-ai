.PHONY: help demo build up down restart logs ps stats backup restore seed test test-backend test-frontend lint clean certs ai-check reindex

help:
	@echo "TradeX AI Production Management Commands"
	@echo "----------------------------------------"
	@echo "make demo          - One-click launch & seed complete demo with credentials"
	@echo "make certs         - Generate self-signed TLS certificates for local HTTPS"
	@echo "make build         - Build all multi-container production images"
	@echo "make up            - Start all services with docker compose"
	@echo "make down          - Stop all services"
	@echo "make restart       - Restart all services"
	@echo "make logs          - Tail container logs"
	@echo "make ps            - Check service status and health"
	@echo "make stats         - Show container resource usage (CPU, memory)"
	@echo "make backup        - Create compressed database & uploads backup"
	@echo "make restore       - Restore database & uploads from backup archive"
	@echo "make seed          - Run database migrations and seed script"
	@echo "make test          - Run full backend and frontend test suites"
	@echo "make clean         - Tear down containers, networks, and volumes"

certs:
	@bash scripts/gen-self-signed-cert.sh

build: certs
	docker compose build

up: certs
	docker compose up -d

demo: certs
	@echo "================================================================================"
	@echo " BOOTING TRADEX AI PRODUCTION DEMO ENVIRONMENT..."
	@echo "================================================================================"
	@if [ ! -f .env ]; then cp .env.example .env; fi
	docker compose up -d --build
	@echo "Waiting for services to become healthy..."
	@sleep 5
	docker compose run --rm migrate
	@echo ""
	@echo "================================================================================"
	@echo "  TRADEX AI PLATFORM IS LIVE & READY FOR DEMONSTRATION!"
	@echo "================================================================================"
	@echo ""
	@echo "  Platform Web UI:      https://localhost (Accept self-signed certificate)"
	@echo "  Backend API Docs:     https://localhost/api/health | https://localhost/docs"
	@echo "  Prometheus Metrics:   https://localhost/metrics"
	@echo "  Grafana Dashboard:    http://localhost:3001 (admin / tradex_grafana_admin)"
	@echo ""
	@echo "  ----------------------------------------------------------------------------"
	@echo "  ROLE          EMAIL                           PASSWORD       PERSONA"
	@echo "  ----------------------------------------------------------------------------"
	@echo "  Buyer         buyer@speisekammer.de          Password123!   Speisekammer GmbH (Germany)"
	@echo "  Supplier      supplier@keralaspices.com      Password123!   Kerala Spices Exports (India)"
	@echo "  Admin         admin@tradex.ai                Password123!   TradeX Platform Administrator"
	@echo "  ----------------------------------------------------------------------------"
	@echo ""
	@echo "  Canonical AI Search prompt:"
	@echo "  'Looking for 20 MT organic turmeric powder with curcumin > 5% for shipment to Hamburg'"
	@echo "================================================================================"

down:
	docker compose down

restart:
	docker compose restart

logs:
	docker compose logs -f

ps:
	docker compose ps

stats:
	docker stats --no-stream

backup:
	@bash scripts/backup.sh

restore:
	@bash scripts/restore.sh

seed:
	docker compose exec backend python -m app.seed
	docker compose exec backend python -m app.services.market_data

test: test-backend test-frontend

test-backend:
	docker compose exec backend pytest app/tests/ -v

test-frontend:
	cd frontend && npm test

clean:
	docker compose down -v --remove-orphans

ai-check:
	docker compose exec backend python -m app.cli ai-check

reindex:
	docker compose exec backend python -m app.cli reindex

