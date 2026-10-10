.PHONY: help build up down restart logs ps test test-backend test-frontend lint clean

help:
	@echo "TradeX AI Development Commands"
	@echo "-------------------------------"
	@echo "make build         - Build all docker containers"
	@echo "make up            - Start all services with docker compose"
	@echo "make down          - Stop all services"
	@echo "make restart       - Restart all services"
	@echo "make logs          - Tail container logs"
	@echo "make ps            - Check service status"
	@echo "make test          - Run backend and frontend tests"
	@echo "make test-backend  - Run backend pytest suite"
	@echo "make test-frontend - Run frontend test suite"
	@echo "make lint          - Lint frontend and backend code"
	@echo "make clean         - Remove caches and build artifacts"

build:
	docker compose build

up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose restart

logs:
	docker compose logs -f

ps:
	docker compose ps

test: test-backend test-frontend

test-backend:
	docker compose run --rm backend pytest

test-frontend:
	docker compose run --rm frontend npm test

lint:
	docker compose run --rm backend ruff check .
	docker compose run --rm frontend npm run lint

clean:
	docker compose down -v --remove-orphans
