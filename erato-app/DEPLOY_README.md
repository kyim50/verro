# EC2 Deployment Guide

## Quick Deploy Script

Use the automated deployment script:

```bash
cd erato-app
./deploy-ec2.sh
```

### First-Time Setup

1. **Configure the script** - Edit `deploy-ec2.sh` and update:
   - `EC2_USER`: Your EC2 username (usually "ubuntu")
   - `EC2_IP`: Your EC2 instance IP address
   - `EC2_KEY_PATH`: Path to your `.pem` key file (or leave empty to use SSH config)
   - `PROJECT_PATH`: Path to your project on EC2 (default: `~/erato-app`)

2. **Make the script executable**:
   ```bash
   chmod +x deploy-ec2.sh
   ```

3. **Set up SSH key** (if not using SSH config):
   ```bash
   chmod 400 /path/to/your-key.pem
   ```

### What the Script Does

1. Checks for uncommitted changes and optionally commits/pushes them
2. Pulls latest code from GitHub on EC2
3. Rebuilds and restarts the backend Docker container
4. Checks backend health status

### Manual Deployment

If you prefer to deploy manually:

```bash
# 1. Commit and push changes
git add .
git commit -m "Your commit message"
git push

# 2. SSH into EC2
ssh -i /path/to/your-key.pem ubuntu@3.18.213.189

# 3. Pull latest code
cd ~/erato-app
git pull

# 4. Rebuild and restart backend
docker-compose -f docker-compose.prod.yml up -d --build backend

# 5. Check logs (optional)
docker-compose -f docker-compose.prod.yml logs backend --tail=50
```

### Troubleshooting

**Backend not starting:**
```bash
# Check container status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs backend

# Restart all services
docker-compose -f docker-compose.prod.yml restart
```

**Health check failing:**
```bash
# Test health endpoint directly
curl http://3.18.213.189:3000/health
```

