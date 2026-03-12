#!/usr/bin/env bash
set -euo pipefail

# ══════════════════════════════════════════════════════════════════════════════
#  AstraNodes — Production Deployment Script
#
#  Features:
#    • .env sync          — auto-detects missing vars from .env.example
#    • Cloudflare DNS     — creates/updates A records for domain + wildcard
#    • Automatic SSL      — CF origin cert / certbot / self-signed fallback
#    • SQLite → Postgres  — detects SQLite databases and migrates data
#    • Rolling deploy     — backup, build, migrate, restart, health check
#    • Git hooks          — post-merge hook for auto-migration on git pull
#
#  Usage:
#    ./scripts/deploy.sh              # Full deployment
#    ./scripts/deploy.sh --init       # First-time setup (interactive)
#    ./scripts/deploy.sh --sync-env   # Only sync .env
#    ./scripts/deploy.sh --dns        # Only setup Cloudflare DNS
#    ./scripts/deploy.sh --ssl        # Only setup SSL
#    ./scripts/deploy.sh --migrate-sqlite [/path/to/db.sqlite]
#    ./scripts/deploy.sh --setup-hooks # Install git post-merge hook
# ══════════════════════════════════════════════════════════════════════════════

# ── Configuration ──────────────────────────────────────────────────────────────
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
HEALTH_URL="${HEALTH_URL:-http://localhost/health}"
HEALTH_RETRIES=10
HEALTH_DELAY=5
SSL_DIR="./ssl"
ENV_FILE="./backend/.env"
ENV_EXAMPLE="./backend/.env.example"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Colors ─────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; }
info() { echo -e "${CYAN}[INFO]${NC} $1"; }
step() { echo -e "\n${BLUE}══ $1 ══${NC}"; }

# ── Helpers ────────────────────────────────────────────────────────────────────
cd "$PROJECT_ROOT"

require_cmd() {
    if ! command -v "$1" &>/dev/null; then
        err "$1 is not installed. Please install it first."
        exit 1
    fi
}

read_env_value() {
    local key="$1"
    local file="${2:-$ENV_FILE}"
    grep "^${key}=" "$file" 2>/dev/null | tail -1 | cut -d'=' -f2-
}

# Write/update a key=value in .env (creates if missing, updates if exists)
set_env_value() {
    local key="$1"
    local value="$2"
    local file="${3:-$ENV_FILE}"
    if grep -q "^${key}=" "$file" 2>/dev/null; then
        # Replace line matching ^KEY= with KEY=value (preserves position)
        awk -v k="${key}=" -v line="${key}=${value}" '{if(index($0,k)==1) print line; else print}' "$file" > "${file}.tmp"
        mv "${file}.tmp" "$file"
        chmod 600 "$file"
    else
        echo "${key}=${value}" >> "$file"
    fi
}

# Prompt user for a value. Usage: prompt_value "VAR_NAME" "description" "default" "required(y/n)"
prompt_value() {
    local key="$1"
    local desc="$2"
    local default="${3:-}"
    local required="${4:-n}"

    local current
    current=$(read_env_value "$key")

    # If already has a real value, skip
    if [[ -n "$current" ]]; then
        return 0
    fi

    echo ""
    if [[ -n "$default" ]]; then
        echo -en "${CYAN}  ${desc}${NC} [${GREEN}${default}${NC}]: "
    else
        echo -en "${CYAN}  ${desc}${NC}: "
    fi

    local input
    read -r input </dev/tty || input=""
    input="${input:-$default}"

    if [[ "$required" == "y" && -z "$input" ]]; then
        err "  $key is required!"
        echo -en "${CYAN}  ${desc}${NC}: "
        read -r input </dev/tty || input=""
        if [[ -z "$input" ]]; then
            err "  Cannot continue without $key."
            exit 1
        fi
    fi

    if [[ -n "$input" ]]; then
        set_env_value "$key" "$input"
    fi
}

# Generate a random secret
generate_secret() {
    openssl rand -base64 48 2>/dev/null | tr -d '/+=' | head -c 48
}

# Export POSTGRES_* vars from .env so docker-compose can use them
load_env_for_compose() {
    if [[ -f "$ENV_FILE" ]]; then
        local val
        val=$(read_env_value "POSTGRES_USER")
        [[ -n "$val" ]] && export POSTGRES_USER="$val"
        val=$(read_env_value "POSTGRES_PASSWORD")
        [[ -n "$val" ]] && export POSTGRES_PASSWORD="$val"
        val=$(read_env_value "POSTGRES_DB")
        [[ -n "$val" ]] && export POSTGRES_DB="$val"
    fi
    # Ensure POSTGRES_PASSWORD is set (docker-compose requires it)
    if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
        err "POSTGRES_PASSWORD is not set. Run: ./scripts/deploy.sh --sync-env"
        exit 1
    fi
}

# ══════════════════════════════════════════════════════════════════════════════
#  STEP 1: .env Sync — Interactive Setup
# ══════════════════════════════════════════════════════════════════════════════
sync_env() {
    step "Syncing Environment Variables"

    if [[ ! -f "$ENV_EXAMPLE" ]]; then
        err "Missing $ENV_EXAMPLE — cannot sync."
        exit 1
    fi

    local is_new=false

    # ── Create .env from example if missing ────────────────────────────────
    if [[ ! -f "$ENV_FILE" ]]; then
        log "No .env found. Creating from .env.example..."
        cp "$ENV_EXAMPLE" "$ENV_FILE"
        chmod 600 "$ENV_FILE"
        is_new=true
    fi

    # ── Sync: add any keys from .env.example that are missing in .env ──────
    local added=0
    local new_keys=()

    while IFS= read -r line || [[ -n "$line" ]]; do
        [[ -z "${line}" || "${line}" =~ ^[[:space:]]*# ]] && continue
        local key="${line%%=*}"
        key="$(echo "$key" | xargs)"
        [[ -z "$key" ]] && continue

        if ! grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
            # Find section comment above this key
            local comment_line=""
            local line_num
            line_num=$(grep -n "^${key}=" "$ENV_EXAMPLE" | tail -1 | cut -d: -f1)
            if [[ -n "$line_num" && "$line_num" -gt 1 ]]; then
                local prev_line
                prev_line=$(sed -n "$((line_num - 1))p" "$ENV_EXAMPLE")
                if [[ "$prev_line" =~ ^[[:space:]]*# ]]; then
                    comment_line="$prev_line"
                fi
            fi

            echo "" >> "$ENV_FILE"
            [[ -n "$comment_line" ]] && echo "$comment_line" >> "$ENV_FILE"
            echo "$line" >> "$ENV_FILE"
            new_keys+=("$key")
            added=$((added + 1))
        fi
    done < "$ENV_EXAMPLE"

    if [[ $added -gt 0 ]]; then
        log "Added $added missing variable(s) to $ENV_FILE:"
        for k in "${new_keys[@]}"; do
            info "  + $k"
        done
    else
        log ".env is in sync with .env.example."
    fi

    # ── Auto-fill & prompt for required values ─────────────────────────────
    log "Checking required variables..."
    echo ""
    echo -e "${BLUE}  ┌──────────────────────────────────────────────────────┐${NC}"
    echo -e "${BLUE}  │  Fill in missing values (press Enter to keep default)│${NC}"
    echo -e "${BLUE}  │  Values already set in .env will be kept as-is      │${NC}"
    echo -e "${BLUE}  └──────────────────────────────────────────────────────┘${NC}"

    # ── PostgreSQL ─────────────────────────────────────────────────────────
    echo ""
    echo -e "${YELLOW}  ── PostgreSQL ──${NC}"
    prompt_value "POSTGRES_USER" "PostgreSQL username" "astra" "n"
    prompt_value "POSTGRES_DB" "PostgreSQL database name" "astra" "n"

    # Auto-generate password if empty
    local pg_pass
    pg_pass=$(read_env_value "POSTGRES_PASSWORD")
    if [[ -z "$pg_pass" ]]; then
        local gen_pass
        gen_pass=$(generate_secret | head -c 32)
        echo ""
        echo -en "${CYAN}  PostgreSQL password${NC} [${GREEN}auto-generate${NC}]: "
        local input_pass
        read -r input_pass </dev/tty || input_pass=""
        if [[ -z "$input_pass" ]]; then
            input_pass="$gen_pass"
            log "  Auto-generated PostgreSQL password."
        fi
        set_env_value "POSTGRES_PASSWORD" "$input_pass"
    fi

    # Auto-build DATABASE_URL from parts
    local pg_user pg_password pg_db
    pg_user=$(read_env_value "POSTGRES_USER")
    pg_password=$(read_env_value "POSTGRES_PASSWORD")
    pg_db=$(read_env_value "POSTGRES_DB")
    pg_user="${pg_user:-astra}"
    pg_db="${pg_db:-astra}"

    local db_url="postgresql://${pg_user}:${pg_password}@postgres:5432/${pg_db}"
    set_env_value "DATABASE_URL" "$db_url"
    log "  DATABASE_URL auto-configured."

    # ── JWT ────────────────────────────────────────────────────────────────
    echo ""
    echo -e "${YELLOW}  ── JWT ──${NC}"
    local jwt_secret
    jwt_secret=$(read_env_value "JWT_SECRET")
    if [[ -z "$jwt_secret" || "$jwt_secret" == "change-me"* ]]; then
        local gen_jwt
        gen_jwt=$(generate_secret)
        set_env_value "JWT_SECRET" "$gen_jwt"
        log "  JWT_SECRET auto-generated."
    else
        log "  JWT_SECRET already set."
    fi

    # ── Frontend URL ───────────────────────────────────────────────────────
    echo ""
    echo -e "${YELLOW}  ── App ──${NC}"
    local frontend_url
    frontend_url=$(read_env_value "FRONTEND_URL")
    if [[ -z "$frontend_url" || "$frontend_url" == "http://localhost"* ]]; then
        prompt_value "FRONTEND_URL" "Frontend URL (e.g. https://yourdomain.com)" "http://localhost:3000" "n"
    fi

    # ── Pterodactyl (REQUIRED) ─────────────────────────────────────────────
    echo ""
    echo -e "${YELLOW}  ── Pterodactyl (required) ──${NC}"
    local ptero_url ptero_key
    ptero_url=$(read_env_value "PTERODACTYL_URL")
    ptero_key=$(read_env_value "PTERODACTYL_API_KEY")

    if [[ -z "$ptero_url" || "$ptero_url" == "https://panel.example.com" ]]; then
        set_env_value "PTERODACTYL_URL" ""
        prompt_value "PTERODACTYL_URL" "Pterodactyl panel URL (e.g. https://panel.example.com)" "" "y"
    else
        log "  PTERODACTYL_URL: $ptero_url"
    fi

    if [[ -z "$ptero_key" || "$ptero_key" == "ptla_xxx" ]]; then
        set_env_value "PTERODACTYL_API_KEY" ""
        prompt_value "PTERODACTYL_API_KEY" "Pterodactyl Application API key (ptla_...)" "" "y"
    else
        log "  PTERODACTYL_API_KEY: set"
    fi

    local ptero_client
    ptero_client=$(read_env_value "PTERODACTYL_CLIENT_KEY")
    if [[ -z "$ptero_client" || "$ptero_client" == "ptlc_xxx" ]]; then
        set_env_value "PTERODACTYL_CLIENT_KEY" ""
        prompt_value "PTERODACTYL_CLIENT_KEY" "Pterodactyl Client API key (ptlc_..., or leave blank)" "" "n"
    fi

    # ── OAuth Callback ─────────────────────────────────────────────────────
    echo ""
    echo -e "${YELLOW}  ── OAuth (optional) ──${NC}"
    local oauth_url
    oauth_url=$(read_env_value "OAUTH_CALLBACK_URL")
    if [[ -z "$oauth_url" || "$oauth_url" == "http://localhost:4000" ]]; then
        local fe_url
        fe_url=$(read_env_value "FRONTEND_URL")
        local suggested_oauth="${fe_url:-http://localhost:4000}"
        # Replace frontend port with backend port for callback
        suggested_oauth=$(echo "$suggested_oauth" | sed 's|:3000|:4000|g')
        prompt_value "OAUTH_CALLBACK_URL" "OAuth callback URL (backend URL)" "$suggested_oauth" "n"
    fi

    prompt_value "GOOGLE_CLIENT_ID" "Google OAuth Client ID (blank to skip)" "" "n"
    prompt_value "GOOGLE_CLIENT_SECRET" "Google OAuth Client Secret (blank to skip)" "" "n"
    prompt_value "DISCORD_CLIENT_ID" "Discord OAuth Client ID (blank to skip)" "" "n"
    prompt_value "DISCORD_CLIENT_SECRET" "Discord OAuth Client Secret (blank to skip)" "" "n"

    # ── Cloudflare (optional) ──────────────────────────────────────────────
    echo ""
    echo -e "${YELLOW}  ── Cloudflare (optional — for DNS & SSL) ──${NC}"
    prompt_value "CLOUDFLARE_API_TOKEN" "Cloudflare API Token (blank to skip)" "" "n"

    local cf_token
    cf_token=$(read_env_value "CLOUDFLARE_API_TOKEN")
    if [[ -n "$cf_token" ]]; then
        prompt_value "CLOUDFLARE_ZONE_ID" "Cloudflare Zone ID" "" "y"
        prompt_value "CLOUDFLARE_DOMAIN" "Your domain (e.g. astranodes.cloud)" "" "y"
    fi

    # ── Admin Email ────────────────────────────────────────────────────────
    echo ""
    echo -e "${YELLOW}  ── Admin ──${NC}"
    prompt_value "ADMIN_EMAIL" "Admin email (for SSL certificate)" "" "n"

    # ── Summary ────────────────────────────────────────────────────────────
    echo ""
    echo -e "${BLUE}  ┌──────────────────────────────────────────────────────┐${NC}"
    echo -e "${BLUE}  │           Configuration Summary                     │${NC}"
    echo -e "${BLUE}  └──────────────────────────────────────────────────────┘${NC}"

    local summary_keys=(
        "NODE_ENV" "PORT" "FRONTEND_URL"
        "POSTGRES_USER" "POSTGRES_DB"
        "PTERODACTYL_URL"
        "CLOUDFLARE_DOMAIN"
    )
    for k in "${summary_keys[@]}"; do
        local v
        v=$(read_env_value "$k")
        if [[ -n "$v" ]]; then
            echo -e "  ${GREEN}✓${NC} $k = $v"
        else
            echo -e "  ${YELLOW}○${NC} $k = (empty)"
        fi
    done

    # Show secrets as masked
    for k in "POSTGRES_PASSWORD" "JWT_SECRET" "PTERODACTYL_API_KEY"; do
        local v
        v=$(read_env_value "$k")
        if [[ -n "$v" ]]; then
            echo -e "  ${GREEN}✓${NC} $k = ****"
        else
            echo -e "  ${RED}✗${NC} $k = (MISSING)"
        fi
    done

    echo ""
    log "Environment configured. File: $ENV_FILE"
}

# ══════════════════════════════════════════════════════════════════════════════
#  STEP 2: Cloudflare DNS Setup
# ══════════════════════════════════════════════════════════════════════════════
setup_cloudflare_dns() {
    step "Cloudflare DNS Configuration"

    local cf_token cf_zone_id cf_domain
    cf_token=$(read_env_value "CLOUDFLARE_API_TOKEN")
    cf_zone_id=$(read_env_value "CLOUDFLARE_ZONE_ID")
    cf_domain=$(read_env_value "CLOUDFLARE_DOMAIN")

    if [[ -z "$cf_token" || -z "$cf_zone_id" || -z "$cf_domain" ]]; then
        warn "Cloudflare credentials not configured (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID, CLOUDFLARE_DOMAIN)."
        warn "Skipping DNS setup."
        return 0
    fi

    # Verify the API token works
    local verify_resp
    verify_resp=$(curl -sf -X GET "https://api.cloudflare.com/client/v4/user/tokens/verify" \
        -H "Authorization: Bearer $cf_token" \
        -H "Content-Type: application/json" 2>/dev/null || echo '{"success":false}')

    if ! echo "$verify_resp" | grep -q '"success":true'; then
        warn "Cloudflare API token verification failed. Skipping DNS setup."
        return 0
    fi

    # Detect public IP
    local server_ip
    server_ip=$(curl -sf --max-time 10 https://api.ipify.org 2>/dev/null \
             || curl -sf --max-time 10 https://ifconfig.me 2>/dev/null \
             || curl -sf --max-time 10 https://icanhazip.com 2>/dev/null)

    if [[ -z "$server_ip" ]]; then
        warn "Could not detect public IP. Skipping DNS setup."
        return 0
    fi
    log "Server public IP: $server_ip"

    # ── Upsert DNS record ──────────────────────────────────────────────────
    upsert_dns_record() {
        local name="$1" type="$2" content="$3" proxied="${4:-true}"

        # Look up existing record
        local existing
        existing=$(curl -sf -X GET \
            "https://api.cloudflare.com/client/v4/zones/${cf_zone_id}/dns_records?type=${type}&name=${name}" \
            -H "Authorization: Bearer $cf_token" \
            -H "Content-Type: application/json" 2>/dev/null || echo '{"result":[]}')

        local record_id
        record_id=$(echo "$existing" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

        local data
        data="{\"type\":\"${type}\",\"name\":\"${name}\",\"content\":\"${content}\",\"proxied\":${proxied},\"ttl\":1}"

        if [[ -n "$record_id" ]]; then
            local update_resp
            update_resp=$(curl -sf -X PUT \
                "https://api.cloudflare.com/client/v4/zones/${cf_zone_id}/dns_records/${record_id}" \
                -H "Authorization: Bearer $cf_token" \
                -H "Content-Type: application/json" \
                --data "$data" 2>/dev/null || echo '{"success":false}')
            if echo "$update_resp" | grep -q '"success":true'; then
                log "Updated DNS: $name -> $content (proxied=$proxied)"
            else
                warn "Failed to update DNS record for $name"
            fi
        else
            local create_resp
            create_resp=$(curl -sf -X POST \
                "https://api.cloudflare.com/client/v4/zones/${cf_zone_id}/dns_records" \
                -H "Authorization: Bearer $cf_token" \
                -H "Content-Type: application/json" \
                --data "$data" 2>/dev/null || echo '{"success":false}')
            if echo "$create_resp" | grep -q '"success":true'; then
                log "Created DNS: $name -> $content (proxied=$proxied)"
            else
                warn "Failed to create DNS record for $name"
            fi
        fi
    }

    # Root domain A record (proxied through Cloudflare)
    upsert_dns_record "$cf_domain" "A" "$server_ip" "true"

    # Wildcard A record (not proxied — CF free plan doesn't proxy wildcards)
    upsert_dns_record "*.${cf_domain}" "A" "$server_ip" "false"

    # Set Cloudflare SSL mode to "full" for origin encryption
    log "Setting Cloudflare SSL mode to Full..."
    local ssl_resp
    ssl_resp=$(curl -sf -X PATCH \
        "https://api.cloudflare.com/client/v4/zones/${cf_zone_id}/settings/ssl" \
        -H "Authorization: Bearer $cf_token" \
        -H "Content-Type: application/json" \
        --data '{"value":"full"}' 2>/dev/null || echo '{"success":false}')
    if echo "$ssl_resp" | grep -q '"success":true'; then
        log "Cloudflare SSL mode set to Full."
    else
        warn "Could not set SSL mode. Set it manually: Cloudflare dashboard -> SSL/TLS -> Full."
    fi

    # Enable Always Use HTTPS
    curl -sf -X PATCH \
        "https://api.cloudflare.com/client/v4/zones/${cf_zone_id}/settings/always_use_https" \
        -H "Authorization: Bearer $cf_token" \
        -H "Content-Type: application/json" \
        --data '{"value":"on"}' > /dev/null 2>&1 || true

    log "Cloudflare DNS setup complete!"
}

# ══════════════════════════════════════════════════════════════════════════════
#  STEP 3: Automatic SSL Certificate
# ══════════════════════════════════════════════════════════════════════════════
setup_ssl() {
    step "SSL Certificate Setup"
    load_env_for_compose

    local cf_domain
    cf_domain=$(read_env_value "CLOUDFLARE_DOMAIN")

    if [[ -z "$cf_domain" ]]; then
        warn "CLOUDFLARE_DOMAIN not set. Skipping SSL setup."
        return 0
    fi

    local cert_dir="$SSL_DIR/live/$cf_domain"
    local cert_file="$cert_dir/fullchain.pem"
    local key_file="$cert_dir/privkey.pem"

    # Check if valid certificate already exists
    if [[ -f "$cert_file" && -f "$key_file" ]]; then
        local expiry_epoch remaining_days
        expiry_epoch=$(openssl x509 -enddate -noout -in "$cert_file" 2>/dev/null \
            | sed 's/notAfter=//' \
            | xargs -I{} date -d "{}" +%s 2>/dev/null || echo "0")
        if [[ "$expiry_epoch" -gt 0 ]]; then
            remaining_days=$(( (expiry_epoch - $(date +%s)) / 86400 ))
            if [[ $remaining_days -gt 30 ]]; then
                log "SSL certificate valid for $remaining_days more days. Skipping."
                ensure_nginx_ssl "$cf_domain"
                return 0
            fi
            log "SSL certificate expires in $remaining_days days. Renewing..."
        fi
    fi

    mkdir -p "$cert_dir"

    local cf_token cf_zone_id
    cf_token=$(read_env_value "CLOUDFLARE_API_TOKEN")
    cf_zone_id=$(read_env_value "CLOUDFLARE_ZONE_ID")

    # ── Strategy 1: Cloudflare Origin Certificate ──────────────────────────
    if [[ -n "$cf_token" && -n "$cf_zone_id" ]]; then
        log "Requesting Cloudflare Origin Certificate..."
        local origin_resp
        origin_resp=$(curl -sf -X POST \
            "https://api.cloudflare.com/client/v4/certificates" \
            -H "Authorization: Bearer $cf_token" \
            -H "Content-Type: application/json" \
            --data "{
                \"hostnames\": [\"${cf_domain}\", \"*.${cf_domain}\"],
                \"requested_validity\": 5475,
                \"request_type\": \"origin-rsa\"
            }" 2>/dev/null || echo '{"success":false}')

        if echo "$origin_resp" | grep -q '"success":true'; then
            echo "$origin_resp" | python3 -c "
import sys, json
data = json.load(sys.stdin)
cert = data['result']['certificate']
key = data['result']['private_key']
with open('$cert_file', 'w') as f: f.write(cert)
with open('$key_file', 'w') as f: f.write(key)
" 2>/dev/null

            if [[ -f "$cert_file" && -s "$cert_file" ]]; then
                chmod 600 "$key_file"
                chmod 644 "$cert_file"
                log "Cloudflare Origin Certificate obtained (valid 15 years)!"
                ensure_nginx_ssl "$cf_domain"
                return 0
            fi
        fi
        warn "Cloudflare Origin Certificate failed. Trying certbot..."
    fi

    # ── Strategy 2: Certbot with Cloudflare DNS challenge ──────────────────
    if [[ -n "$cf_token" ]] && command -v docker &>/dev/null; then
        log "Attempting SSL via certbot (Cloudflare DNS challenge)..."

        local cf_ini="$SSL_DIR/cloudflare.ini"
        echo "dns_cloudflare_api_token = $cf_token" > "$cf_ini"
        chmod 600 "$cf_ini"

        local admin_email
        admin_email=$(read_env_value "ADMIN_EMAIL")
        [[ -z "$admin_email" ]] && admin_email="admin@${cf_domain}"

        if docker run --rm \
            -v "$(pwd)/$SSL_DIR:/etc/letsencrypt" \
            certbot/dns-cloudflare certonly \
            --dns-cloudflare \
            --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
            -d "$cf_domain" \
            -d "*.${cf_domain}" \
            --non-interactive \
            --agree-tos \
            --email "$admin_email" \
            --preferred-challenges dns-01 2>/dev/null; then

            rm -f "$cf_ini"
            chmod 600 "$SSL_DIR/live/$cf_domain/privkey.pem" 2>/dev/null || true
            log "Let's Encrypt certificate obtained!"

            # Setup auto-renewal cron (daily at 3am)
            if ! crontab -l 2>/dev/null | grep -q "certbot-renew"; then
                log "Setting up SSL auto-renewal cron..."
                (crontab -l 2>/dev/null || true; echo "0 3 * * * cd $(pwd) && docker run --rm -v $(pwd)/$SSL_DIR:/etc/letsencrypt certbot/dns-cloudflare renew --quiet && docker compose -f $COMPOSE_FILE restart nginx > /dev/null 2>&1 # certbot-renew") | crontab -
            fi

            ensure_nginx_ssl "$cf_domain"
            return 0
        fi

        rm -f "$cf_ini"
        warn "Certbot failed. Falling back to self-signed certificate."
    fi

    # ── Strategy 3: Self-signed (works with Cloudflare "Full" mode) ────────
    log "Generating self-signed SSL certificate for origin..."
    openssl req -x509 -nodes -days 3650 \
        -newkey rsa:2048 \
        -keyout "$key_file" \
        -out "$cert_file" \
        -subj "/CN=${cf_domain}" \
        -addext "subjectAltName=DNS:${cf_domain},DNS:*.${cf_domain}" \
        2>/dev/null

    chmod 600 "$key_file"
    chmod 644 "$cert_file"
    log "Self-signed certificate generated (valid 10 years, use with Cloudflare Full mode)."

    ensure_nginx_ssl "$cf_domain"
}

# ── Generate SSL-enabled nginx config ─────────────────────────────────────────
ensure_nginx_ssl() {
    local domain="$1"
    local cert_dir="$SSL_DIR/live/$domain"

    if [[ ! -f "$cert_dir/fullchain.pem" || ! -f "$cert_dir/privkey.pem" ]]; then
        return 0
    fi

    log "Writing SSL-enabled nginx configuration..."

    cat > nginx/nginx.conf << NGINXEOF
upstream backend {
    server backend:4000;
}

upstream frontend {
    server frontend:3000;
}

# Rate limiting zones
limit_req_zone \$binary_remote_addr zone=api:10m rate=30r/s;
limit_req_zone \$binary_remote_addr zone=auth:10m rate=5r/m;

# ── HTTP -> HTTPS redirect ─────────────────────────────────────────────────
server {
    listen 80;
    server_name ${domain} *.${domain};

    # Health check over HTTP (for internal Docker healthchecks)
    location /health {
        proxy_pass http://backend;
        access_log off;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

# ── HTTPS server ───────────────────────────────────────────────────────────
server {
    listen 443 ssl http2;
    server_name ${domain} *.${domain};

    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    # SSL hardening
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;

    # Request size limits
    client_max_body_size 10m;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 1024;

    # API routes -> backend
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://backend;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 30s;
        proxy_connect_timeout 5s;
    }

    # Auth routes — stricter rate limit
    location /api/auth/ {
        limit_req zone=auth burst=3 nodelay;
        proxy_pass http://backend;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Uploads — static files served by backend
    location /uploads/ {
        proxy_pass http://backend;
        proxy_set_header Host \$host;
        proxy_cache_valid 200 1h;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Content-Disposition "attachment" always;
    }

    # Health check (no rate limit)
    location /health {
        proxy_pass http://backend;
        access_log off;
    }

    # WebSocket support for Socket.IO
    location /socket.io/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    # Everything else -> frontend
    location / {
        proxy_pass http://frontend;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINXEOF

    log "SSL nginx config written to nginx/nginx.conf"
}

# ══════════════════════════════════════════════════════════════════════════════
#  STEP 4: SQLite -> PostgreSQL Migration
# ══════════════════════════════════════════════════════════════════════════════
migrate_sqlite_to_postgres() {
    local sqlite_file="${1:-}"

    step "SQLite -> PostgreSQL Migration"

    # Auto-detect SQLite files if none specified
    if [[ -z "$sqlite_file" ]]; then
        local found_files=()
        while IFS= read -r -d '' f; do
            found_files+=("$f")
        done < <(find "$PROJECT_ROOT" -maxdepth 3 \
            \( -name "*.sqlite" -o -name "*.sqlite3" -o -name "*.db" \) \
            ! -path "*/node_modules/*" \
            ! -path "*/.git/*" \
            ! -name "*.migrated.bak" \
            -print0 2>/dev/null)

        if [[ ${#found_files[@]} -eq 0 ]]; then
            log "No SQLite database files found. Skipping migration."
            return 0
        fi

        log "Found SQLite database(s):"
        for f in "${found_files[@]}"; do
            info "  -> $f"
        done
        sqlite_file="${found_files[0]}"
        log "Using: $sqlite_file"
    fi

    if [[ ! -f "$sqlite_file" ]]; then
        warn "SQLite file not found: $sqlite_file"
        return 0
    fi

    # Verify it's a real SQLite database
    if ! file "$sqlite_file" 2>/dev/null | grep -qi "sqlite"; then
        warn "$sqlite_file is not a SQLite database. Skipping."
        return 0
    fi

    log "Starting SQLite -> PostgreSQL data migration..."
    load_env_for_compose

    # Ensure PostgreSQL is running
    docker compose -f "$COMPOSE_FILE" up -d postgres redis
    log "Waiting for PostgreSQL to be ready..."
    local retries=0
    while ! docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U "${POSTGRES_USER:-astra}" &>/dev/null; do
        retries=$((retries + 1))
        if [[ $retries -gt 30 ]]; then
            err "PostgreSQL did not become ready."
            return 1
        fi
        sleep 2
    done

    # Run Prisma migrations to ensure schema exists
    log "Ensuring PostgreSQL schema is up to date..."
    docker compose -f "$COMPOSE_FILE" run --rm backend npx prisma migrate deploy 2>/dev/null || true

    # Get DB credentials from .env / compose defaults
    local pg_user pg_db
    pg_user="${POSTGRES_USER:-astra}"
    pg_db="${POSTGRES_DB:-astra}"

    # Extract data from SQLite and generate PostgreSQL-compatible SQL
    log "Extracting data from SQLite database..."

    export SQLITE_PATH="$sqlite_file"
    local migration_sql
    migration_sql=$(python3 << 'PYEOF'
import sqlite3
import sys
import os

sqlite_path = os.environ.get("SQLITE_PATH", "")
if not sqlite_path:
    sys.exit(0)

conn = sqlite3.connect(sqlite_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

# Get all user tables (skip SQLite & Prisma internals)
cursor.execute("""
    SELECT name FROM sqlite_master
    WHERE type='table'
      AND name NOT LIKE 'sqlite_%'
      AND name NOT LIKE '_prisma_%'
    ORDER BY name;
""")
tables = [row[0] for row in cursor.fetchall()]

if not tables:
    print("-- No tables found in SQLite database")
    sys.exit(0)

# Known boolean columns (from Prisma schema @@map analysis)
BOOLEAN_COLUMNS = {
    "flagged", "active", "is_admin", "is_automatic",
    "limited_stock", "one_time_purchase", "popular",
    "maintenance_mode", "discord_popup_enabled",
    "email_verified", "enabled", "discord_bot_enabled",
    "discord_claim_required", "ad_blocker_detection",
    "require_ad_view", "show_once",
}

print("-- SQLite -> PostgreSQL Migration")
print("-- Auto-generated by deploy.sh")
print("BEGIN;")
print()
print("-- Disable FK triggers during import")
print("SET session_replication_role = 'replica';")
print()

for table in tables:
    cursor.execute(f'PRAGMA table_info("{table}")')
    columns_info = cursor.fetchall()
    if not columns_info:
        continue

    col_names = [col[1] for col in columns_info]
    col_types = {col[1]: col[2].upper() for col in columns_info}

    cursor.execute(f'SELECT * FROM "{table}"')
    rows = cursor.fetchall()

    if not rows:
        continue

    print(f"-- Table: {table} ({len(rows)} rows)")

    cols_str = ", ".join(f'"{c}"' for c in col_names)

    for row in rows:
        values = []
        for i, val in enumerate(row):
            cname = col_names[i]
            ctype = col_types.get(cname, "")

            if val is None:
                values.append("NULL")
            elif isinstance(val, bytes):
                hex_str = val.hex()
                values.append(f"'\\x{hex_str}'")
            elif isinstance(val, bool):
                values.append("TRUE" if val else "FALSE")
            elif isinstance(val, int):
                if cname in BOOLEAN_COLUMNS or ctype in ("BOOLEAN", "BOOL"):
                    values.append("TRUE" if val else "FALSE")
                else:
                    values.append(str(val))
            elif isinstance(val, float):
                values.append(str(val))
            else:
                escaped = str(val).replace("'", "''")
                values.append(f"'{escaped}'")

        vals_str = ", ".join(values)
        print(f'INSERT INTO "{table}" ({cols_str}) VALUES ({vals_str}) ON CONFLICT DO NOTHING;')

    print()

# Reset auto-increment sequences
print("-- Reset sequences")
for table in tables:
    cursor.execute(f'PRAGMA table_info("{table}")')
    columns_info = cursor.fetchall()
    for col in columns_info:
        if col[1] == "id" and col[5] == 1:  # pk flag
            print(f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), COALESCE((SELECT MAX(id) FROM \"{table}\"), 1));")

print()
print("SET session_replication_role = 'origin';")
print("COMMIT;")

conn.close()
PYEOF
)
    unset SQLITE_PATH

    if [[ -z "$migration_sql" || "$migration_sql" == *"No tables found"* ]]; then
        warn "No data found in SQLite database."
        return 0
    fi

    # Write SQL and import into PostgreSQL
    local sql_file="/tmp/sqlite_migration_$$.sql"
    echo "$migration_sql" > "$sql_file"

    local row_count
    row_count=$(grep -c "^INSERT" "$sql_file" 2>/dev/null || echo "0")
    local table_count
    table_count=$(grep -c "^-- Table:" "$sql_file" 2>/dev/null || echo "0")
    log "Migrating $row_count rows across $table_count tables..."

    # Copy SQL into postgres container and execute
    local pg_container
    pg_container=$(docker compose -f "$COMPOSE_FILE" ps -q postgres)

    docker cp "$sql_file" "${pg_container}:/tmp/migration.sql"

    if docker compose -f "$COMPOSE_FILE" exec -T postgres \
        psql -U "$pg_user" -d "$pg_db" -f /tmp/migration.sql -q 2>&1 | tail -5; then
        log "SQLite -> PostgreSQL migration completed!"
        log "Migrated $row_count rows from $table_count tables."

        # Rename SQLite file to prevent re-migration
        mv "$sqlite_file" "${sqlite_file}.migrated.bak"
        log "Renamed source to ${sqlite_file}.migrated.bak"
    else
        err "Migration had errors. Check the output above."
        warn "SQL preserved at: $sql_file"
        return 1
    fi

    # Cleanup
    rm -f "$sql_file"
    docker compose -f "$COMPOSE_FILE" exec -T postgres rm -f /tmp/migration.sql 2>/dev/null || true
}

# ══════════════════════════════════════════════════════════════════════════════
#  STEP 5: Database Backup
# ══════════════════════════════════════════════════════════════════════════════
backup_database() {
    step "Database Backup"
    load_env_for_compose

    mkdir -p "$BACKUP_DIR"
    local backup_file="$BACKUP_DIR/db-$(date +%Y%m%d-%H%M%S).sql.gz"

    if docker compose -f "$COMPOSE_FILE" ps postgres --status running -q 2>/dev/null | grep -q .; then
        docker compose -f "$COMPOSE_FILE" exec -T postgres \
            pg_dump -U "${POSTGRES_USER:-astra}" "${POSTGRES_DB:-astra}" | gzip > "$backup_file"
        log "Backup saved: $backup_file"
    else
        warn "PostgreSQL not running, skipping backup."
    fi
}

# ══════════════════════════════════════════════════════════════════════════════
#  STEP 6: Build & Deploy
# ══════════════════════════════════════════════════════════════════════════════
deploy() {
    step "Building & Deploying"
    load_env_for_compose

    log "Building Docker images..."
    docker compose -f "$COMPOSE_FILE" build --parallel

    log "Starting PostgreSQL and Redis..."
    docker compose -f "$COMPOSE_FILE" up -d postgres redis
    sleep 5

    log "Running database migrations..."
    docker compose -f "$COMPOSE_FILE" run --rm backend npx prisma migrate deploy

    log "Starting backend..."
    docker compose -f "$COMPOSE_FILE" up -d --no-deps backend
    sleep 3

    log "Starting frontend..."
    docker compose -f "$COMPOSE_FILE" up -d --no-deps frontend
    sleep 3

    log "Starting nginx..."
    docker compose -f "$COMPOSE_FILE" up -d --no-deps nginx
}

# ══════════════════════════════════════════════════════════════════════════════
#  STEP 7: Health Check
# ══════════════════════════════════════════════════════════════════════════════
health_check() {
    step "Health Check"

    for i in $(seq 1 $HEALTH_RETRIES); do
        if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
            log "Health check passed!"
            return 0
        fi
        if [ "$i" -eq "$HEALTH_RETRIES" ]; then
            err "Health check failed after $HEALTH_RETRIES attempts."
            warn "Check logs: docker compose -f $COMPOSE_FILE logs --tail=50"
            exit 1
        fi
        log "Attempt $i/$HEALTH_RETRIES — retrying in ${HEALTH_DELAY}s..."
        sleep "$HEALTH_DELAY"
    done
}

# ══════════════════════════════════════════════════════════════════════════════
#  STEP 8: Cleanup Old Backups
# ══════════════════════════════════════════════════════════════════════════════
cleanup_backups() {
    local backup_count
    backup_count=$(find "$BACKUP_DIR" -name "db-*.sql.gz" 2>/dev/null | wc -l)
    if [ "$backup_count" -gt 10 ]; then
        log "Cleaning old backups (keeping last 10)..."
        find "$BACKUP_DIR" -name "db-*.sql.gz" -printf '%T@ %p\n' \
            | sort -n | head -n -10 | awk '{print $2}' | xargs rm -f
    fi
}

# ══════════════════════════════════════════════════════════════════════════════
#  Git Hooks: Auto-Migration on Pull
# ══════════════════════════════════════════════════════════════════════════════
setup_git_hooks() {
    step "Git Hooks Setup"

    local hooks_dir="$PROJECT_ROOT/.git/hooks"
    if [[ ! -d "$PROJECT_ROOT/.git" ]]; then
        warn "Not a git repository. Skipping hooks setup."
        return 0
    fi

    mkdir -p "$hooks_dir"

    cat > "$hooks_dir/post-merge" << 'HOOKEOF'
#!/usr/bin/env bash
set -euo pipefail

# ── AstraNodes Post-Merge Hook ──────────────────────────────────────────────
# Runs automatically after `git pull` to handle migrations and deployments.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$SCRIPT_DIR"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[POST-MERGE]${NC} $1"; }
warn() { echo -e "${YELLOW}[POST-MERGE]${NC} $1"; }

log "Git pull detected. Running post-merge tasks..."

# ── 1. Sync .env with any new variables ────────────────────────────────────
if [[ -f "backend/.env" && -f "backend/.env.example" ]]; then
    log "Checking for new environment variables..."
    added=0
    while IFS= read -r line || [[ -n "$line" ]]; do
        [[ -z "${line}" || "${line}" =~ ^[[:space:]]*# ]] && continue
        key="${line%%=*}"
        key="$(echo "$key" | xargs)"
        [[ -z "$key" ]] && continue
        if ! grep -q "^${key}=" "backend/.env" 2>/dev/null; then
            echo "" >> "backend/.env"
            echo "$line" >> "backend/.env"
            warn "Added new env var: $key"
            added=$((added + 1))
        fi
    done < "backend/.env.example"
    if [[ $added -gt 0 ]]; then
        warn "$added new variable(s) added to backend/.env — please review!"
    fi
fi

# ── 2. Detect & migrate SQLite databases ──────────────────────────────────
sqlite_files=()
while IFS= read -r -d '' f; do
    sqlite_files+=("$f")
done < <(find . -maxdepth 3 \( -name "*.sqlite" -o -name "*.sqlite3" -o -name "*.db" \) \
    ! -path "*/node_modules/*" ! -path "*/.git/*" ! -name "*.migrated.bak" \
    -print0 2>/dev/null)

if [[ ${#sqlite_files[@]} -gt 0 ]]; then
    log "SQLite database(s) detected after pull!"
    for f in "${sqlite_files[@]}"; do
        log "  -> $f"
    done
    log "Running SQLite -> PostgreSQL migration..."
    bash scripts/deploy.sh --migrate-sqlite "${sqlite_files[0]}"
fi

# ── 3. Run Prisma migrations if schema changed ────────────────────────────
if git diff --name-only HEAD@{1} HEAD 2>/dev/null | grep -q "prisma/"; then
    log "Prisma schema changes detected. Running migrations..."
    docker compose up -d postgres redis
    sleep 5
    docker compose run --rm backend npx prisma migrate deploy
    log "Database migrations applied."
fi

# ── 4. Rebuild if Docker/dependency files changed ─────────────────────────
if git diff --name-only HEAD@{1} HEAD 2>/dev/null | grep -qE "(Dockerfile|docker-compose|package\.json)"; then
    log "Docker or dependency changes detected. Rebuilding..."
    docker compose build --parallel
    docker compose up -d
    log "Services rebuilt and restarted."
else
    log "Restarting services to pick up code changes..."
    docker compose up -d --no-deps backend frontend
fi

log "Post-merge tasks complete!"
HOOKEOF

    chmod +x "$hooks_dir/post-merge"
    log "Git post-merge hook installed at .git/hooks/post-merge"
    log "On every 'git pull', it will:"
    info "  1. Sync new .env variables"
    info "  2. Detect & migrate SQLite databases"
    info "  3. Run Prisma migrations if schema changed"
    info "  4. Rebuild & restart services if needed"
}

# ══════════════════════════════════════════════════════════════════════════════
#  Pre-flight Checks
# ══════════════════════════════════════════════════════════════════════════════
preflight() {
    require_cmd docker
    require_cmd curl

    if [ ! -f "$COMPOSE_FILE" ]; then
        err "Compose file not found: $COMPOSE_FILE"
        exit 1
    fi
}

# ══════════════════════════════════════════════════════════════════════════════
#  CLI Entry Point
# ══════════════════════════════════════════════════════════════════════════════
case "${1:-}" in
    --init)
        preflight
        sync_env
        setup_cloudflare_dns
        setup_ssl
        migrate_sqlite_to_postgres
        deploy
        health_check
        setup_git_hooks
        cleanup_backups
        echo ""
        log "=== Initial setup complete! ==="
        docker compose -f "$COMPOSE_FILE" ps
        ;;

    --sync-env)
        sync_env
        ;;

    --dns)
        sync_env
        setup_cloudflare_dns
        ;;

    --ssl)
        sync_env
        setup_ssl
        ;;

    --migrate-sqlite)
        preflight
        if [[ -z "${2:-}" ]]; then
            migrate_sqlite_to_postgres
        else
            migrate_sqlite_to_postgres "$2"
        fi
        ;;

    --setup-hooks)
        setup_git_hooks
        ;;

    --help|-h)
        echo "AstraNodes Deployment Script"
        echo ""
        echo "Usage: $0 [OPTION]"
        echo ""
        echo "Options:"
        echo "  (none)              Full deployment (sync, backup, build, migrate, deploy)"
        echo "  --init              First-time setup (DNS, SSL, SQLite migration, hooks)"
        echo "  --sync-env          Only sync .env with .env.example"
        echo "  --dns               Only setup Cloudflare DNS"
        echo "  --ssl               Only setup SSL certificates"
        echo "  --migrate-sqlite [FILE]  Migrate SQLite database to PostgreSQL"
        echo "  --setup-hooks       Install git post-merge hook"
        echo "  --help              Show this help"
        ;;

    *)
        # Default: full deployment
        preflight
        sync_env
        backup_database
        deploy
        health_check
        cleanup_backups
        echo ""
        log "=== Deployment complete! ==="
        docker compose -f "$COMPOSE_FILE" ps
        ;;
esac
