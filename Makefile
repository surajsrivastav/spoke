.PHONY: help install up down migrate dev test lint typecheck build clean reset logs

help:
	@echo "Spoke — Open source agent control plane"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Setup & Infrastructure:"
	@echo "  install          Install pnpm dependencies"
	@echo "  up               Start Docker services (PostgreSQL, Temporal, etc)"
	@echo "  down             Stop all Docker services"
	@echo "  migrate          Run Prisma database migrations"
	@echo "  reset            Full reset: down, clean volumes, fresh install"
	@echo ""
	@echo "Development:"
	@echo "  dev              Start all dev servers (Operator UI, Orchestrator, Edges)"
	@echo "  logs             Tail live logs from Docker services"
	@echo ""
	@echo "Testing & Quality:"
	@echo "  test             Run all tests"
	@echo "  test-watch       Run tests in watch mode"
	@echo "  lint             Run ESLint on all packages"
	@echo "  typecheck        Run TypeScript type checking"
	@echo "  mutation         Run mutation testing (Stryker)"
	@echo ""
	@echo "Building:"
	@echo "  build            Build all packages for production"
	@echo "  clean            Remove build artifacts and caches"
	@echo ""
	@echo "Utilities:"
	@echo "  db-studio        Open Prisma Studio (visual DB explorer)"
	@echo "  env-setup        Copy .env.example to .env.local"
	@echo ""

# Setup & Infrastructure
install:
	pnpm install

up:
	docker compose -f docker-compose.local.yml up -d
	@echo "✓ Services started. Waiting for health checks..."
	@sleep 5
	docker compose -f docker-compose.local.yml ps

down:
	docker compose -f docker-compose.local.yml down

migrate:
	pnpm migrate

# Development
dev: up migrate
	pnpm dev

logs:
	docker compose -f docker-compose.local.yml logs -f

# Testing & Quality
test:
	pnpm test

test-watch:
	pnpm test -- --watch

lint:
	pnpm lint

typecheck:
	pnpm typecheck

mutation:
	pnpm test:mutation

# Building
build:
	pnpm build

clean:
	pnpm -r exec rm -rf dist build coverage reports .next .turbo .stryker-tmp .stryker-results
	rm -rf node_modules

# Complete reset
reset: down clean
	docker compose -f docker-compose.local.yml down -v
	rm -f .env.local
	cp .env.example .env.local
	pnpm install
	$(MAKE) migrate

# Utilities
db-studio:
	pnpm --filter @spoke/db studio

env-setup:
	@if [ ! -f .env.local ]; then \
		cp .env.example .env.local; \
		echo "✓ Created .env.local from .env.example"; \
	else \
		echo "✓ .env.local already exists"; \
	fi

# Quick start
.DEFAULT_GOAL := help
