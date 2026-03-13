#!/usr/bin/env bash

# ══════════════════════════════════════════════════════════════════════════════
#  Docker & Docker Compose Diagnostic Script
#  Checks for Docker and Docker Compose installations and fixes issues
# ══════════════════════════════════════════════════════════════════════════════

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET}    $*"; }
success() { echo -e "${GREEN}[OK]${RESET}      $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}    $*"; }
error()   { echo -e "${RED}[ERROR]${RESET}   $*" >&2; }
header()  { echo -e "\n${BOLD}${CYAN}══ $* ══${RESET}"; }

header "Docker & Docker Compose Diagnostic"

# ─────────────────────────────────────────────────────────────────────────────
#  CHECK DOCKER
# ─────────────────────────────────────────────────────────────────────────────
header "1. Checking Docker Installation"

DOCKER_CMD=""
DOCKER_FOUND=false

# Check common Docker paths
for docker_path in /usr/bin/docker /usr/local/bin/docker /snap/bin/docker /opt/docker/bin/docker; do
  if [[ -x "$docker_path" ]]; then
    DOCKER_CMD="$docker_path"
    DOCKER_FOUND=true
    info "Found Docker at: $docker_path"
    break
  fi
done

# Fallback to command lookup
if ! $DOCKER_FOUND && command -v docker &>/dev/null; then
  DOCKER_CMD="$(command -v docker)"
  DOCKER_FOUND=true
  info "Found Docker in PATH: $DOCKER_CMD"
fi

if $DOCKER_FOUND; then
  # Test Docker works
  if $DOCKER_CMD --version >/dev/null 2>&1; then
    VERSION=$($DOCKER_CMD --version)
    success "✓ Docker is working: $VERSION"
  else
    error "✗ Docker binary found but not working"
    echo ""
    echo "  Possible issues:"
    echo "  1. Docker service not running: sudo systemctl start docker"
    echo "  2. Permission denied: sudo usermod -aG docker \$USER"
    echo "  3. Then log out and back in, or run: newgrp docker"
    DOCKER_FOUND=false
  fi
else
  error "✗ Docker not found in any standard location"
  echo ""
  echo "  Docker locations checked:"
  echo "  - /usr/bin/docker"
  echo "  - /usr/local/bin/docker"
  echo "  - /snap/bin/docker"
  echo "  - \$PATH"
  echo ""
  echo "  Installation options:"
  echo "  - Ubuntu/Debian: sudo apt-get update && sudo apt-get install docker.io"
  echo "  - Snap: sudo snap install docker"
  echo "  - Official: https://docs.docker.com/engine/install/ubuntu/"
  echo ""
fi

# ─────────────────────────────────────────────────────────────────────────────
#  CHECK DOCKER COMPOSE
# ─────────────────────────────────────────────────────────────────────────────
header "2. Checking Docker Compose Installation"

COMPOSE_CMD=""
COMPOSE_FOUND=false

if [[ "$DOCKER_FOUND" == true ]]; then
  # Try integrated docker compose
  if $DOCKER_CMD compose version >/dev/null 2>&1; then
    COMPOSE_CMD="$DOCKER_CMD compose"
    COMPOSE_FOUND=true
    VERSION=$($DOCKER_CMD compose version | head -1)
    success "✓ Docker Compose (integrated): $VERSION"
  fi
fi

# Try standalone docker-compose
if ! $COMPOSE_FOUND && command -v docker-compose &>/dev/null; then
  COMPOSE_CMD="docker-compose"
  COMPOSE_FOUND=true
  VERSION=$(docker-compose --version)
  success "✓ Docker Compose (standalone): $VERSION"
fi

if ! $COMPOSE_FOUND; then
  error "✗ Docker Compose not found"
  echo ""
  echo "  Installation options:"
  echo "  - Ubuntu/Debian: sudo apt-get install docker-compose"
  echo "  - pip: pip3 install docker-compose"
  echo "  - Snap: sudo snap install docker"
  echo "  - Official: https://docs.docker.com/compose/install/"
  echo ""
  
  # Offer to auto-install if pip is available
  if command -v pip3 &>/dev/null || command -v pip &>/dev/null; then
    echo -en "${YELLOW}?${RESET} Attempt auto-install docker-compose? [y/N]: "
    read -r AUTO_INSTALL
    if [[ "${AUTO_INSTALL,,}" == "y" ]]; then
      if command -v pip3 &>/dev/null; then
        info "Installing docker-compose via pip3..."
        if pip3 install --user docker-compose >/dev/null 2>&1; then
          success "✓ Docker Compose installed"
          COMPOSE_FOUND=true
        else
          error "Installation failed. Try: pip3 install --user docker-compose"
        fi
      elif command -v pip &>/dev/null; then
        info "Installing docker-compose via pip..."
        if pip install --user docker-compose >/dev/null 2>&1; then
          success "✓ Docker Compose installed"
          COMPOSE_FOUND=true
        else
          error "Installation failed. Try: pip install --user docker-compose"
        fi
      fi
    fi
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
#  CHECK DOCKER DAEMON
# ─────────────────────────────────────────────────────────────────────────────
header "3. Checking Docker Daemon Status"

if [[ "$DOCKER_FOUND" == true ]]; then
  if $DOCKER_CMD ps >/dev/null 2>&1; then
    success "✓ Docker daemon is running and accessible"
  else
    error "✗ Docker daemon is not running or not accessible"
    echo ""
    echo "  To start Docker daemon:"
    echo "  - systemd: sudo systemctl start docker"
    echo "  - Manual: dockerd"
    echo ""
    echo "  To fix permission issues:"
    echo "  - Add to docker group: sudo usermod -aG docker \$USER"
    echo "  - Apply group: newgrp docker"
    echo "  - Or use sudo: sudo docker ps"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
#  CHECK DOCKER IMAGES
# ─────────────────────────────────────────────────────────────────────────────
header "4. Checking Docker Images"

if [[ "$DOCKER_FOUND" == true ]] && $DOCKER_CMD ps >/dev/null 2>&1; then
  IMAGE_COUNT=$($DOCKER_CMD images -q | wc -l)
  if [[ "$IMAGE_COUNT" -gt 0 ]]; then
    success "✓ Docker has $IMAGE_COUNT images available"
  else
    warn "⚠ No Docker images found yet (normal for new installation)"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
#  FINAL STATUS & RECOMMENDATIONS
# ─────────────────────────────────────────────────────────────────────────────
header "5. Summary"

if [[ "$DOCKER_FOUND" == true && "$COMPOSE_FOUND" == true ]]; then
  echo ""
  echo -e "${GREEN}✓ Everything is ready!${RESET}"
  echo ""
  echo "  You can now run:"
  echo "  ${CYAN}bash scripts/deploy.sh${RESET}"
  echo ""
elif [[ "$DOCKER_FOUND" == true ]]; then
  echo ""
  echo -e "${YELLOW}✓ Docker is ready, but Docker Compose needs fixing${RESET}"
  echo ""
  echo "  Fix it with:"
  echo "  ${CYAN}pip3 install docker-compose${RESET}"
  echo "  or"
  echo "  ${CYAN}apt-get install docker-compose${RESET}"
  echo ""
else
  echo ""
  echo -e "${RED}✗ Docker is not properly installed${RESET}"
  echo ""
  echo "  Install Docker:"
  echo "  ${CYAN}sudo apt-get update && sudo apt-get install docker.io docker-compose${RESET}"
  echo ""
  echo "  Then manage Docker as non-root user:"
  echo "  ${CYAN}sudo usermod -aG docker \$USER${RESET}"
  echo "  ${CYAN}newgrp docker${RESET}"
  echo ""
fi

# ─────────────────────────────────────────────────────────────────────────────
#  EXTRA TROUBLESHOOTING
# ─────────────────────────────────────────────────────────────────────────────
header "Troubleshooting Tips"

echo ""
echo "  1. Verify Docker works:"
echo "     ${CYAN}docker --version${RESET}"
echo "     ${CYAN}docker ps${RESET}"
echo ""
echo "  2. Verify Docker Compose works:"
echo "     ${CYAN}docker compose version${RESET}"
echo "     or"
echo "     ${CYAN}docker-compose --version${RESET}"
echo ""
echo "  3. If 'Permission denied' error:"
echo "     ${CYAN}sudo usermod -aG docker \$USER${RESET}"
echo "     Then log out and back in."
echo ""
echo "  4. If Docker Compose conflicts:"
echo "     Remove old version: ${CYAN}sudo apt-get remove docker-compose${RESET}"
echo "     Install new version: ${CYAN}pip3 install docker-compose${RESET}"
echo ""
echo "  5. Run this diagnostic again after fixing:"
echo "     ${CYAN}bash scripts/docker-detect.sh${RESET}"
echo ""
