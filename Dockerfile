# SoulGraph — Multi-stage Docker build
# Stage 1: Build web UI (Node)
# Stage 2: Python API server + built web assets
#
# Usage:
#   docker compose up -d            # Start all services (Redis, ChromaDB, LangFuse, SoulGraph)
#   docker compose logs -f soulgraph  # Watch API logs
#
# The API server serves both the REST/WS endpoints AND the built web UI.
# No separate web server needed — FastAPI handles everything.

# ── Stage 1: Build web UI ──────────────────────────────────────
FROM node:22-slim AS web-builder

WORKDIR /build/web

# Install dependencies first (cache layer)
COPY web/package.json web/package-lock.json ./
RUN npm ci --ignore-scripts

# Copy source and build
COPY web/ ./
RUN npm run build

# ── Stage 2: Python API server ─────────────────────────────────
FROM python:3.12-slim AS runtime

WORKDIR /app

# System dependencies for ChromaDB client + Redis
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies (cache layer)
COPY pyproject.toml ./
RUN pip install --no-cache-dir -e ".[dev]" 2>/dev/null || pip install --no-cache-dir .

# Copy application code
COPY soulgraph/ ./soulgraph/
COPY scripts/ ./scripts/

# Copy built web assets from Stage 1
COPY --from=web-builder /build/web/dist/ ./web/dist/

# Environment defaults (override via docker-compose.yml or .env)
ENV SOULGRAPH_API_HOST=0.0.0.0 \
    SOULGRAPH_API_PORT=8080 \
    SOULGRAPH_LOG_LEVEL=INFO \
    REDIS_URL=redis://redis:6379 \
    CHROMA_HOST=chromadb \
    CHROMA_PORT=8000

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
    CMD curl -f http://localhost:8080/health || exit 1

CMD ["python", "-m", "uvicorn", "soulgraph.api:app", "--host", "0.0.0.0", "--port", "8080"]
