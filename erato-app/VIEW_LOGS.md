# How to View Backend Logs on EC2

## Step 1: Find the Project Directory

On your EC2 instance, run:

```bash
# Find the erato-app directory
find ~ -maxdepth 3 -type d -name "erato-app" 2>/dev/null

# Or check common locations:
ls ~/erato-app
ls /home/ubuntu/erato-app
```

## Step 2: Navigate to Project Directory

```bash
cd ~/erato-app
# OR
cd /home/ubuntu/erato-app
```

## Step 3: View Docker Logs

```bash
# View all backend logs
docker-compose -f docker-compose.prod.yml logs backend

# Follow logs in real-time
docker-compose -f docker-compose.prod.yml logs -f backend

# View last 100 lines
docker-compose -f docker-compose.prod.yml logs --tail=100 backend

# View logs with timestamps
docker-compose -f docker-compose.prod.yml logs -f --timestamps backend
```

## Step 4: Filter for Registration Errors

```bash
# View logs filtered for registration
docker-compose -f docker-compose.prod.yml logs backend | grep -i "regist"

# Or follow and filter
docker-compose -f docker-compose.prod.yml logs -f backend | grep -i "regist"
```

## Quick One-Liner

```bash
# Find and navigate to project, then view logs
cd ~/erato-app && docker-compose -f docker-compose.prod.yml logs -f backend
```

