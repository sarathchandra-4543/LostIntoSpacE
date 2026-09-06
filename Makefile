# Common tasks for LostIntoSpacE.
#
# `make` is not available on a stock Windows install; every target below is a
# thin wrapper over a command you can also run directly, and the underlying
# command is written out in docs and in scripts/dev/test_all.py so nothing here
# is load-bearing.
#
# PY points at the project virtualenv rather than whatever `python` resolves to,
# because the interpreter that has the dependencies is the one in apps/api/venv.

PY ?= apps/api/venv/bin/python
VENV_WIN := apps/api/venv/Scripts/python.exe
ifeq ($(OS),Windows_NT)
	PY := $(VENV_WIN)
endif

.DEFAULT_GOAL := help
.PHONY: help install install-py install-web test test-py test-api test-web \
	lint lint-py typecheck-web build dev-api dev-web db-upgrade db-sql up down

help: ## Show this help
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  %-16s %s
", $$1, $$2}'

install: install-py install-web ## Install every dependency

install-py: ## Install the pinned Python environment
	$(PY) -m pip install -r requirements.txt

install-web: ## Install the npm workspaces (root, apps/web, packages/*)
	npm install

test: test-py test-web ## Run every test suite

test-py: ## Run all four Python suites (1845 tests)
	$(PY) scripts/dev/test_all.py

test-api: ## Run only the apps/api suite
	cd apps/api && ../../$(PY) -m pytest

test-web: ## Run the frontend suite
	npm run test --workspace @lostintospace/web

lint: lint-py typecheck-web ## Lint and type-check everything that has a checker

lint-py: ## ruff + mypy over apps/api
	cd apps/api && ../../$(PY) -m ruff check src tests
	cd apps/api && ../../$(PY) -m mypy

typecheck-web: ## tsc over the web app and the engine it pulls in
	npm run build --workspace @lostintospace/web

build: typecheck-web ## Produce the production frontend bundle

dev-api: ## Run the API with reload on :8000
	cd apps/api && PYTHONPATH=$$PWD ../../$(PY) -m uvicorn src.main:app --reload --port 8000

dev-web: ## Run the Vite dev server on :3000 (proxies /api to :8000)
	npm run dev --workspace @lostintospace/web

db-upgrade: ## Apply all migrations to DATABASE_URL
	cd database && ../$(PY) -m alembic upgrade head

db-sql: ## Print the full schema DDL without touching a server
	cd database && ../$(PY) -m alembic upgrade head --sql

up: ## Start PostgreSQL + API in Docker
	docker compose up --build

down: ## Stop the Docker stack
	docker compose down
