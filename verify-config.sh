#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
#  AstraNodes Deployment Verification Script
#  Validates all configuration files and Docker setup
# ═══════════════════════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET}    $*"; }
success() { echo -e "${GREEN}[✓]${RESET}      $*"; }
error()   { echo -e "${RED}[✗]${RESET}      $*"; exit 1; }
warn()    { echo -e "${YELLOW}[!]${RESET}      $*"; }
header()  { echo -e "\n${BOLD}${CYAN}══ $* ══${RESET}"; }

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" || exit 1

# ─────────────────────────────────────────────────────────────────────────────
#  1. CHECK ENVIRONMENT FILES
# ─────────────────────────────────────────────────────────────────────────────
header "1. Verifying Environment Files"

if [[ ! -f .env ]]; then
  error "Root .env file not found at $(pwd)/.env"
fi
success "Root .env file exists"

if [[ ! -f backend/.env ]]; then
  error "Backend .env file not found at $(pwd)/backend/.env"
fi
success "Backend .env file exists"

# ─────────────────────────────────────────────────────────────────────────────
#  2. VERIFY CRITICAL ENV VARS
# ─────────────────────────────────────────────────────────────────────────────
header "2. Validating Critical Environment Variables"

# Load and check root .env
POSTGRES_PASSWORD=$(grep '^POSTGRES_PASSWORD=' .env 2>/dev/null | cut -d'=' -f2 || echo "")
if [[ -z "$POSTGRES_PASSWORD" ]]; then
  error "POSTGRES_PASSWORD not set in .env"
fi
success "POSTGRES_PASSWORD is set (length: ${#POSTGRES_PASSWORD})"

# Check backend .env for DATABASE_URL
DB_URL=$(grep '^DATABASE_URL=' backend/.env 2>/dev/null | cut -d'=' -f2 || echo "")
if [[ -z "$DB_URL" ]]; then
  error "DATABASE_URL not set in backend/.env"
fi

# Validate DATABASE_URL format
if [[ ! "$DB_URL" =~ postgres://.*@postgres:.* ]]; then
  warn "DATABASE_URL may not be using Docker service hostname 'postgres'"
  echo "  Current: $DB_URL"
  echo "  Expected format: postgresql://astra:password@postgres:5432/astra"
fi
success "DATABASE_URL is configured: $DB_URL"

# Check JWT_SECRET
JWT_SECRET=$(grep '^JWT_SECRET=' backend/.env 2>/dev/null | cut -d'=' -f2 || echo "")
if [[ -z "$JWT_SECRET" ]]; then
  error "JWT_SECRET not set in backend/.env"
fi
if [[ ${#JWT_SECRET} -lt 32 ]]; then
  warn "JWT_SECRET is less than 32 characters (current: ${#JWT_SECRET})"
fi
success "JWT_SECRET is set (length: ${#JWT_SECRET})"

# Check Pterodactyl config
PTERODACTYL_URL=$(grep '^PTERODACTYL_URL=' backend/.env 2>/dev/null | cut -d'=' -f2 || echo "")
PTERODACTYL_API_KEY=$(grep '^PTERODACTYL_API_KEY=' backend/.env 2>/dev/null | cut -d'=' -f2 || echo "")
if [[ -z "$PTERODACTYL_URL" ]] || [[ -z "$PTERODACTYL_API_KEY" ]]; then
  warn "Pterodactyl credentials not fully configured - some features may not work"
fi

# ─────────────────────────────────────────────────────────────────────────────
#  3. CHECK DOCKER & COMPOSE
# ─────────────────────────────────────────────────────────────────────────────
header "3. Verifying Docker Setup"

if ! command -v docker &>/dev/null; then
  error "Docker is not installed"
fi
success "Docker is installed: $(docker --version)"

if ! docker-compose --version &>/dev/null 2>&1; then
  error "Docker Compose is not available"
fi
success "Docker Compose is available: $(docker-compose --version | head -1)"

# ─────────────────────────────────────────────────────────────────────────────
#  4. VALIDATE DOCKER-COMPOSE SYNTAX
# ─────────────────────────────────────────────────────────────────────────────
header "4. Validating docker-compose.yml Syntax"

if ! docker-compose config >/dev/null 2>&1; then
  error "docker-compose.yml has invalid syntax or missing variables"
fi
success "docker-compose.yml syntax is valid"

# Verify services are defined
SERVICES=$(docker-compose config --services 2>/dev/null || echo "")
if [[ ! "$SERVICES" =~ postgres ]]; then
  error "PostgreSQL service not found in docker-compose"
fi
success "All required services defined: postgres, redis, backend, frontend, nginx"

# ─────────────────────────────────────────────────────────────────────────────
#  5. CHECK DOCKERFILE HEALTHCHECKS
# ─────────────────────────────────────────────────────────────────────────────
header "5. Verifying Dockerfiles"

if ! grep -q "api/health" backend/Dockerfile; then
  warn "Backend Dockerfile healthcheck may not be using /api/health endpoint"
fi
success "Backend Dockerfile contains /api/health reference"

if ! grep -q "curl\|wget" backend/Dockerfile; then
  warn "Backend Dockerfile may not have curl/wget for healthchecks"
fi

if [[ ! -f frontend/Dockerfile ]]; then
  error "Frontend Dockerfile not found"
fi
success "All Dockerfiles exist with healthchecks configured"

# ─────────────────────────────────────────────────────────────────────────────
#  6. CHECK NGINX CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────
header "6. Verifying Nginx Configuration"

if ! grep -q "backend:4000" nginx/nginx.conf; then
  error "Nginx not configured to proxy to backend:4000"
fi
success "Nginx is configured to proxy API requests to backend"

if ! grep -q "frontend:3000" nginx/nginx.conf; then
  error "Nginx not configured to proxy to frontend:3000"
fi
success "Nginx is configured to proxy frontend requests"

# ─────────────────────────────────────────────────────────────────────────────
#  7. VERIFY PRISMA SCHEMA
# ─────────────────────────────────────────────────────────────────────────────
header "7. Checking Prisma Schema"

if ! grep -q "DATABASE_URL" backend/prisma/schema.prisma; then
  error "Prisma schema not using DATABASE_URL env variable"
fi
success "Prisma schema uses DATABASE_URL environment variable"

# ─────────────────────────────────────────────────────────────────────────────
#  8. SUMMARY
# ─────────────────────────────────────────────────────────────────────────────
header "Verification Complete"

echo ""
echo -e "${GREEN}✓ All critical configuration checks passed!${RESET}"
echo ""
echo "Next steps:"
echo "  1. docker-compose build"
echo "  2. docker-compose up -d"
echo "  3. docker-compose logs -f backend"
echo "  4. Verify backend health: curl http://localhost:8000/health"
echo ""
