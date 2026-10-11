.PHONY: help build up down restart logs ps stats backup restore seed test test-backend test-frontend lint clean certs

help:
	@echo "TradeX AI Production Management Commands"
	@echo "----------------------------------------"
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

