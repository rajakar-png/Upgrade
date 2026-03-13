# Frontend Environment & Domain Configuration

## Quick Summary

If your frontend cannot connect to the backend API after deploying with a domain:

```bash
# 1. Set your domain
./scripts/deploy.sh --sync-env
# Enter: example.com

# 2. Quick fix
bash scripts/quick-fix-domain.sh

# 3. Check frontend is using correct API URL
curl http://your-domain:8000
# Should load HTML without CORS/API errors in console
```

---

## How Frontend Finds the API

The frontend needs to know where to call the API. There are 3 places this is configured:

### 1. Server-Side (Next.js Server Component / API Routes)
Uses `API_INTERNAL_URL` environment variable:
```env
API_INTERNAL_URL=http://backend:4000
```
Set in `docker-compose.yml` → only available on the server.

### 2. Client-Side (Browser / React Components)
The frontend should detect the API URL from the browser's location:
```javascript
// Good - dynamically uses where frontend is loaded from
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
// OR
const API_URL = window.location.origin + '/api';
```

### 3. Build-Time (Environment Variables During Docker Build)
If frontend build requires API URL, pass it via `docker-compose.yml`:
```yaml
frontend:
  build:
    context: ./frontend
    args:
      NEXT_PUBLIC_API_URL: ${FRONTEND_URL}
```

---

## Common Frontend API Issues

### Issue 1: "Cannot POST /api/..." (404)
**Cause**: Frontend is calling `/api` directly instead of proxying through nginx.

**Solution**: Ensure nginx has this location block:
```nginx
location /api/ {
    proxy_pass http://backend:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```
✓ Already configured in your `nginx/nginx.conf`

### Issue 2: CORS Error (Cross-Origin Request Blocked)
**Cause**: Frontend origin doesn't match API origin.

**Symptoms**:
```
Access to XMLHttpRequest at 'http://localhost:4000/api/auth' from origin 'http://domain.com:8000' 
has been blocked by CORS policy
```

**Solution**: Frontend must call API through same domain (via nginx proxy):
```javascript
// WRONG - direct backend call (CORS error)
fetch('http://backend:4000/api/auth')

// CORRECT - goes through nginx proxy (no CORS)
fetch('/api/auth')  // Relative path
// OR
fetch('http://domain.com:8000/api/auth')
```

The nginx reverse proxy **masks** the backend, so browser sees API as same-origin.

### Issue 3: Frontend Shows But API Calls Fail
**Cause**: Frontend loaded from correct domain but using wrong API URL.

**Debug**:
1. Open browser DevTools (F12)
2. Network tab → check API request URLs
3. Should be: `http://your-domain:8000/api/...`
4. NOT: `http://localhost:4000/api/...`

### Issue 4: Frontend Not Loading at All
**Cause**: nginx not serving frontend correctly.

**Debug**:
```bash
# Test nginx serves the frontend
curl http://your-domain:8000

# Should return HTML, not error

# If error, check nginx logs
docker-compose logs nginx | tail -50
```

---

## Proper Setup Checklist

- [ ] `SITE_DOMAIN=your-domain.com` in `.env`
- [ ] `FRONTEND_URL=https://your-domain.com` in `.env`  
- [ ] Frontend container built with `docker-compose build frontend`
- [ ] `API_INTERNAL_URL=http://backend:4000` in docker-compose (should be default)
- [ ] Nginx is running and has correct config
- [ ] Nginx can reach both `backend:4000` and `frontend:3000`
- [ ] Frontend uses **relative paths** for API calls: `fetch('/api/...')`
- [ ] DNS is propagated (if using domain name)

---

## Configuration by Deployment Type

### Development (localhost)
```env
SITE_DOMAIN=localhost
FRONTEND_URL=http://localhost:3000
```
Frontend calls API: `fetch('http://localhost:4000/api/...')`
Access at: `http://localhost:8000` → proxied to frontend:3000

### Production (with domain, HTTP-only)
```env
SITE_DOMAIN=example.com
FRONTEND_URL=http://example.com:8000
```
Frontend calls API: `fetch('/api/...')` (relative path through nginx proxy)
Access at: `http://example.com:8000`

### Production (with domain, HTTPS)
```env
SITE_DOMAIN=example.com
FRONTEND_URL=https://example.com
```
Frontend calls API: `fetch('/api/...')` (relative path through nginx proxy)
Access at: `https://example.com` (nginx handles SSL)

---

## Frontend Environment Variables

| Variable | Where Used | Example | Notes |
|----------|-----------|---------|-------|
| `API_INTERNAL_URL` | Server-side only | `http://backend:4000` | For Next.js server components |
| `NEXT_PUBLIC_API_URL` | Client-side | `http://example.com:8000` | Prefix `NEXT_PUBLIC_` makes it available in browser |
| `FRONTEND_URL` | System config | `https://example.com` | Used by backend for redirects/emails |

### To Use Client-Side API URL in Frontend

In your frontend code (e.g., `src/lib/api.ts`):
```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

export async function fetchAPI(endpoint: string) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    credentials: 'include', // Important for cookies
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return response.json();
}
```

Then pass via build args in `docker-compose.yml`:
```yaml
frontend:
  build:
    context: ./frontend
    args:
      NEXT_PUBLIC_API_URL: ${FRONTEND_URL}  # Will be https://example.com
```

---

## Testing Frontend Connectivity

```bash
# 1. Check frontend container is running
docker-compose ps frontend

# 2. Check frontend logs
docker-compose logs frontend

# 3. Check nginx can reach frontend
docker-compose exec nginx curl http://frontend:3000 -I

# 4. Check you can access frontend through nginx
curl http://localhost:8000 -I
# Should return 200 OK, not 502 Bad Gateway

# 5. Check frontend can reach backend (from inside frontend container)
docker-compose exec frontend curl http://backend:4000/api/health

# 6. Full chain test
curl -v http://your-domain:8000/api/health
# Should route through nginx → backend
```

---

## Rebuilding Frontend with New Configuration

After changing domain/environment:

```bash
# Rebuild frontend image with new env vars
docker-compose build --no-cache frontend

# Restart frontend container
docker-compose up -d frontend

# Check it restarted successfully
docker-compose ps frontend

# Verify it loads
curl http://your-domain:8000
```

---

## If Frontend Still Has Issues

Check these in order:

1. **Is frontend container running?**
   ```bash
   docker-compose ps frontend
   ```

2. **Are there build errors?**
   ```bash
   docker-compose build frontend 2>&1 | tail -50
   ```

3. **Are there runtime errors?**
   ```bash
   docker-compose logs frontend | tail -50
   ```

4. **Can nginx reach it?**
   ```bash
   docker-compose exec nginx curl http://frontend:3000
   ```

5. **Is nginx config correct?**
   ```bash
   docker-compose exec nginx nginx -t
   ```

6. **What doesn't load?**
   - If HTML page loads but no styling: check static files at `/public`
   - If page loads but API fails: check `/api` proxy configuration
   - If page doesn't load at all: check backend or network connectivity

---

## Quick Restart All Frontend Infrastructure

```bash
# Stop everything
docker-compose down

# Rebuild with fresh build
docker-compose build frontend

# Start everything
docker-compose up -d

# Check
docker-compose ps
docker-compose logs -f frontend
```
