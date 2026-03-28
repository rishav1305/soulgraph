.PHONY: ci lint type test web-ci web-typecheck web-test web-build infra-up infra-down clean install

# Full CI check — matches what GitHub Actions runs.
ci: lint type test

# ─── Web UI CI ────────────────────────────────────────────────
# Runs: TypeScript strict check → Vitest unit/integration tests → Vite production build.
# Fail-fast: any step failure stops the pipeline.
web-ci: web-typecheck web-test web-build
	@echo "Web CI passed."

web-typecheck:
	cd web && npx tsc --noEmit

web-test:
	cd web && npx vitest run

web-build:
	cd web && npx vite build

install:
	pip install -e ".[dev]"

# Linting with ruff.
lint:
	ruff check soulgraph/ tests/
	ruff format --check soulgraph/ tests/

# Type checking with mypy.
type:
	mypy soulgraph/

# Run all tests.
test:
	pytest

# Run tests with coverage report.
test-cov:
	pytest --cov=soulgraph --cov-report=html

# Start infrastructure (Redis + ChromaDB).
infra-up:
	docker compose up -d
	@echo "Waiting for services to be healthy..."
	@sleep 5
	@docker compose ps

# Stop infrastructure.
infra-down:
	docker compose down

# Clean build artifacts.
clean:
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "htmlcov" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	find . -type f -name ".coverage" -delete 2>/dev/null || true
