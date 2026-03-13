# Docker Detection & Installation Guide

## Quick Verification

**Before running `deploy.sh`, verify Docker is installed:**

```bash
bash scripts/docker-detect.sh
```

This script will:
✅ Check for Docker installation  
✅ Check for Docker Compose installation  
✅ Verify Docker daemon is running  
✅ Auto-install Docker Compose if needed  
✅ Provide exact fix instructions if anything is wrong  

---

## What's Improved in deploy.sh

The new `deploy.sh` has **automatic Docker detection** that:

### 1. **Searches Multiple Locations**
- `/usr/bin/docker`
- `/usr/local/bin/docker`
- `/snap/bin/docker`
- `/opt/docker/bin/docker`
- Your `$PATH`

### 2. **Detects Docker Compose Variations**
- Modern: `docker compose` (integrated)
- Traditional: `docker-compose` (standalone)
- Auto-installs via pip if needed

### 3. **Clear Error Messages**
If Docker is not found, shows:
- Exact installation commands for your OS
- Steps to add user to docker group
- Tests to verify it's working

### 4. **Handles Permission Issues**
If Docker is installed but can't connect:
- Suggests adding user to docker group
- Explains how to apply group changes
- Shows alternative with `sudo`

---

## Installation Shortcuts

### Ubuntu/Debian
```bash
# Install Docker and Docker Compose in one command
sudo apt-get update
sudo apt-get install docker.io docker-compose

# Add your user to docker group (so you don't need sudo)
sudo usermod -aG docker $USER

# Apply group changes (log out/in, or run this)
newgrp docker

# Verify
docker --version
docker-compose --version
```

### Or use the diagnostic script (auto-installs!)
```bash
bash scripts/docker-detect.sh
# When prompted, choose "y" to auto-install docker-compose
```

### Snap (works on any Linux)
```bash
sudo snap install docker
```

---

## Troubleshooting

### "docker: command not found"
✅ Run: `bash scripts/docker-detect.sh`  
✅ Follow the installation instructions for your OS  
✅ Verify with: `docker --version`

### "docker-compose: command not found"
✅ Run: `bash scripts/docker-detect.sh`  
✅ Choose auto-install when prompted  
✅ Or manual: `pip3 install docker-compose`

### "Permission denied" when running docker
✅ Add user to docker group:
```bash
sudo usermod -aG docker $USER
newgrp docker
```
✅ Verify: `docker ps`

### "Cannot connect to Docker daemon"
✅ Start Docker service:
```bash
sudo systemctl start docker
sudo systemctl enable docker  # Auto-start on reboot
```

### Old docker-compose conflicts with pip version
```bash
# Remove system version
sudo apt-get remove docker-compose

# Install pip version
pip3 install docker-compose

# Verify new version
docker-compose --version
```

---

## Full Docker Detection Flow in deploy.sh

```
1. Look for docker binary in standard locations
   ↓
2. If found, test with "docker --version"
   ↓
3. If working, look for docker compose (integrated)
   ↓
4. If not found, look for standalone docker-compose
   ↓
5. If not found, auto-install via pip3/pip
   ↓
6. Create wrapper function for compatibility
   ↓
7. Verify everything works
   ↓
8. Continue deployment
```

---

## After docker-detect.sh Fixes

Once you see ✓ at all checks:

```bash
bash scripts/deploy.sh
```

The deploy script will work normally with:
- Automatic Docker detection
- Auto-installation of missing Docker Compose
- Fallback between `docker compose` and `docker-compose`

---

## Docker Compose Compatibility

The new deploy.sh supports **both** versions:

### Modern (Integrated with Docker)
```bash
docker compose ps
docker compose up -d
docker compose logs
```

### Traditional (Standalone)
```bash
docker-compose ps
docker-compose up -d
docker-compose logs
```

The script automatically uses whichever version you have! ✨

---

## Helpful Commands

```bash
# Check Docker is working
docker ps
docker --version

# Check Docker Compose
docker compose version
docker-compose --version  # Alternative

# Start/stop Docker service
sudo systemctl start docker
sudo systemctl stop docker
sudo systemctl status docker

# Run diagnostic again
bash scripts/docker-detect.sh

# Deploy (once Docker is ready)
bash scripts/deploy.sh
```

---

## Why do we need docker-detect.sh?

Some VPS/Linux environments:
- Install Docker in non-standard paths
- Use snap instead of apt packages
- Don't automatically add docker to your PATH
- Have permission issues with existing installations

The diagnostic script handles all these cases and gives you **exact commands to fix your specific setup**.

---

## Next Steps

1. **Run diagnostic:**
   ```bash
   bash scripts/docker-detect.sh
   ```

2. **Fix any issues** (follow the script's instructions)

3. **Verify again:**
   ```bash
   bash scripts/docker-detect.sh
   ```

4. **Deploy when ready:**
   ```bash
   bash scripts/deploy.sh
   ```

That's it! Easy as 1-2-3. 🚀
