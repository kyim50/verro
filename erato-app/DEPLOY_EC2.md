# Deploying to EC2 Free Tier (Testing)

This guide will help you deploy your backend to an AWS EC2 free tier instance for testing.

## Prerequisites

- AWS EC2 free tier instance (Ubuntu recommended)
- SSH access to your EC2 instance
- Your backend `.env` file with all environment variables

## Step 1: EC2 Instance Setup

### Launch EC2 Instance

1. Go to AWS Console → EC2 → Launch Instance
2. Choose **Ubuntu Server 22.04 LTS** (free tier eligible)
3. Instance type: **t2.micro** (free tier)
4. Configure Security Group:
   - **SSH (22)**: Your IP only
   - **HTTP (80)**: Your IP or 0.0.0.0/0 for testing
   - **HTTPS (443)**: Your IP or 0.0.0.0/0 for testing
   - **Custom TCP (3000)**: Your IP or 0.0.0.0/0 for testing (backend API)
   - **Custom TCP (6379)**: 127.0.0.1 only (Redis, internal)
5. Create/download a key pair for SSH access
6. Launch instance

### Connect to EC2

```bash
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

## Step 2: Install Docker on EC2

```bash
# Update system
sudo apt update
sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group (avoid sudo)
sudo usermod -aG docker ubuntu

# Install Docker Compose
sudo apt install docker-compose -y

# Log out and back in for group changes to take effect
exit
# SSH back in
```

## Step 3: Transfer Your Files to EC2

### Option A: Using SCP (Recommended)

From your local machine:

```bash
# Navigate to your project root
cd /Users/kimanimcleish/Desktop/Projects/verro

# Copy backend folder
scp -i your-key.pem -r erato-app/backend ubuntu@YOUR_EC2_PUBLIC_IP:~/

# Copy docker-compose file
scp -i your-key.pem erato-app/docker-compose.yml ubuntu@YOUR_EC2_PUBLIC_IP:~/

# Copy .env file (you'll need to create this on EC2 with your values)
```

### Option B: Using Git

```bash
# On EC2
cd ~
git clone YOUR_REPO_URL
cd verro/erato-app
```

## Step 4: Set Up Environment Variables

On EC2, create the backend `.env` file:

```bash
cd ~/backend
nano .env
```

Add all your environment variables:

```env
# Server
NODE_ENV=production
PORT=3000

# Database (Supabase - stays the same, it's cloud)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d

# Frontend URL (your EC2 public IP)
FRONTEND_URL=http://YOUR_EC2_PUBLIC_IP:19006

# Redis (will run in Docker, use service name)
REDIS_HOST=redis
REDIS_PORT=6379

# Optional: Disable rate limiting for testing
DISABLE_RATE_LIMIT=false
```

Save and exit: `Ctrl+X`, then `Y`, then `Enter`

## Step 5: Create Production Docker Compose

Create `docker-compose.prod.yml` on EC2:

```bash
cd ~
nano docker-compose.prod.yml
```

```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    container_name: erato-redis-prod
    ports:
      - "127.0.0.1:6379:6379"  # Only accessible locally
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: erato-backend-prod
    ports:
      - "3000:3000"
    env_file:
      - ./backend/.env
    depends_on:
      redis:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

volumes:
  redis-data:
```

Save and exit.

## Step 6: Start Services

```bash
# Build and start
docker-compose -f docker-compose.prod.yml up -d

# Check logs
docker-compose -f docker-compose.prod.yml logs -f

# Check if containers are running
docker ps
```

## Step 7: Test Backend

```bash
# Test health endpoint
curl http://localhost:3000/health

# From your local machine (test from outside)
curl http://YOUR_EC2_PUBLIC_IP:3000/health
```

## Step 8: Update Frontend

Update your frontend environment variables:

**`erato-app/frontend/app.json`:**

```json
{
  "expo": {
    "extra": {
      "EXPO_PUBLIC_API_URL": "http://YOUR_EC2_PUBLIC_IP:3000/api",
      "EXPO_PUBLIC_SOCKET_URL": "http://YOUR_EC2_PUBLIC_IP:3000"
    }
  }
}
```

Or create/update `.env` file in frontend:

```env
EXPO_PUBLIC_API_URL=http://YOUR_EC2_PUBLIC_IP:3000/api
EXPO_PUBLIC_SOCKET_URL=http://YOUR_EC2_PUBLIC_IP:3000
```

## Step 9: Keep Services Running (Optional)

### Using systemd (Recommended)

Create a systemd service to keep Docker Compose running:

```bash
sudo nano /etc/systemd/system/erato-backend.service
```

```ini
[Unit]
Description=Erato Backend
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/ubuntu
ExecStart=/usr/bin/docker-compose -f /home/ubuntu/docker-compose.prod.yml up -d
ExecStop=/usr/bin/docker-compose -f /home/ubuntu/docker-compose.prod.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable erato-backend
sudo systemctl start erato-backend
sudo systemctl status erato-backend
```

## Useful Commands

```bash
# View logs
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f redis

# Restart services
docker-compose -f docker-compose.prod.yml restart

# Stop services
docker-compose -f docker-compose.prod.yml down

# Rebuild after code changes
docker-compose -f docker-compose.prod.yml up -d --build

# Access backend container shell
docker exec -it erato-backend-prod sh

# Access Redis CLI
docker exec -it erato-redis-prod redis-cli
```

## Security Notes for Testing

⚠️ **This is for testing only!** For production:

1. Use a reverse proxy (Nginx) instead of exposing port 3000 directly
2. Set up HTTPS with Let's Encrypt
3. Use environment variables securely (AWS Secrets Manager)
4. Restrict security groups more strictly
5. Set up proper firewall rules
6. Use a domain name instead of IP address

## Troubleshooting

### Backend not accessible from outside
- Check Security Group allows port 3000 from your IP
- Check EC2 instance firewall: `sudo ufw status`

### Redis connection errors
- Make sure Redis container is healthy: `docker ps`
- Check Redis logs: `docker logs erato-redis-prod`

### Backend crashes
- Check logs: `docker logs erato-backend-prod`
- Verify all environment variables are set correctly
- Check if Supabase credentials are correct

### Port already in use
```bash
# Find what's using port 3000
sudo lsof -i :3000
# Or
sudo netstat -tulpn | grep 3000
```

