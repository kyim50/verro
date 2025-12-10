#!/bin/bash

# Deploy Container to EC2
# This script deploys the Docker container on EC2 without committing/pushing code
# Assumes code is already pushed to GitHub
# Configuration is loaded from deploy.config (create from deploy.config.example)

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/deploy.config"

if [ -f "$CONFIG_FILE" ]; then
    echo -e "${BLUE}Loading configuration from deploy.config...${NC}"
    source "$CONFIG_FILE"
else
    echo -e "${RED}Error: deploy.config not found${NC}"
    echo -e "${YELLOW}Please copy deploy.config.example to deploy.config and fill in your values${NC}"
    exit 1
fi

# Validate required variables
if [ -z "$EC2_USER" ] || [ -z "$EC2_IP" ]; then
    echo -e "${RED}Error: EC2_USER and EC2_IP must be set in deploy.config${NC}"
    exit 1
fi

# Set EC2_HOST if not provided
if [ -z "$EC2_HOST" ]; then
    EC2_HOST="${EC2_USER}@${EC2_IP}"
fi

# Set COMPOSE_FILE if not provided
if [ -z "$COMPOSE_FILE" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
fi

# Use default SSH key if not provided
if [ -z "$EC2_KEY_PATH" ]; then
    EC2_KEY_PATH="${HOME}/.ssh/id_rsa"
fi

# Set health check URL if not provided
if [ -z "$HEALTH_CHECK_URL" ]; then
    HEALTH_CHECK_URL="http://${EC2_IP}:3000/health"
fi

# Set retry settings if not provided
MAX_RETRIES="${MAX_RETRIES:-30}"
RETRY_DELAY="${RETRY_DELAY:-5}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Deploying Container to EC2${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if SSH key exists
if [ ! -f "$EC2_KEY_PATH" ] && [ ! -f "${HOME}/.ssh/id_rsa" ]; then
    echo -e "${RED}Error: SSH key not found at $EC2_KEY_PATH${NC}"
    echo "Please set EC2_KEY_PATH in deploy.config or place key at ~/.ssh/id_rsa"
    exit 1
fi

# Use default SSH key if provided path doesn't exist
if [ ! -f "$EC2_KEY_PATH" ]; then
    EC2_KEY_PATH="${HOME}/.ssh/id_rsa"
fi

echo -e "${YELLOW}Using SSH key: $EC2_KEY_PATH${NC}"
echo -e "${YELLOW}Connecting to: $EC2_HOST${NC}"
echo ""

# Auto-detect project path on EC2
echo -e "${BLUE}Detecting project path on EC2...${NC}"
PROJECT_PATH_DETECTED=$(ssh -i "$EC2_KEY_PATH" -o StrictHostKeyChecking=no "$EC2_HOST" \
    "if [ -d ~/erato-app ]; then echo ~/erato-app; \
     elif [ -d /home/$EC2_USER/erato-app ]; then echo /home/$EC2_USER/erato-app; \
     else find ~ -maxdepth 3 -type d -name 'erato-app' 2>/dev/null | head -1; fi")

if [ -z "$PROJECT_PATH" ]; then
    if [ -z "$PROJECT_PATH_DETECTED" ]; then
        echo -e "${RED}Error: Could not find erato-app directory on EC2${NC}"
        echo -e "${YELLOW}Please set PROJECT_PATH in deploy.config${NC}"
        exit 1
    fi
    PROJECT_PATH="$PROJECT_PATH_DETECTED"
fi

echo -e "${GREEN}Found project at: $PROJECT_PATH${NC}"
echo ""

# Pull latest code
echo -e "${BLUE}Pulling latest code from GitHub...${NC}"
ssh -i "$EC2_KEY_PATH" -o StrictHostKeyChecking=no "$EC2_HOST" << EOF
    cd "$PROJECT_PATH"
    git pull origin main || {
        echo "Warning: Git pull failed, continuing with existing code..."
    }
EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Code pulled successfully${NC}"
else
    echo -e "${YELLOW}⚠ Git pull had issues, continuing anyway...${NC}"
fi
echo ""

# Check if docker-compose.prod.yml exists
echo -e "${BLUE}Checking for docker-compose.prod.yml...${NC}"
if ! ssh -i "$EC2_KEY_PATH" -o StrictHostKeyChecking=no "$EC2_HOST" "[ -f $PROJECT_PATH/$COMPOSE_FILE ]"; then
    echo -e "${RED}Error: docker-compose.prod.yml not found at $PROJECT_PATH/$COMPOSE_FILE${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Found docker-compose.prod.yml${NC}"
echo ""

# Stop and remove old container
echo -e "${BLUE}Stopping old container...${NC}"
ssh -i "$EC2_KEY_PATH" -o StrictHostKeyChecking=no "$EC2_HOST" << EOF
    cd "$PROJECT_PATH"
    docker-compose -f "$COMPOSE_FILE" stop backend 2>/dev/null || true
    docker-compose -f "$COMPOSE_FILE" rm -f backend 2>/dev/null || true
EOF
echo -e "${GREEN}✓ Old container stopped${NC}"
echo ""

# Clean up Docker resources
echo -e "${BLUE}Cleaning up Docker resources...${NC}"
ssh -i "$EC2_KEY_PATH" -o StrictHostKeyChecking=no "$EC2_HOST" << EOF
    docker system prune -af --volumes 2>/dev/null || true
    docker image prune -af 2>/dev/null || true
EOF
echo -e "${GREEN}✓ Docker cleanup complete${NC}"
echo ""

# Rebuild and start container
echo -e "${BLUE}Rebuilding and starting container...${NC}"
ssh -i "$EC2_KEY_PATH" -o StrictHostKeyChecking=no "$EC2_HOST" << EOF
    cd "$PROJECT_PATH"
    docker-compose -f "$COMPOSE_FILE" up -d --build --force-recreate --no-deps backend
EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Container rebuilt and started${NC}"
else
    echo -e "${RED}Error: Failed to rebuild container${NC}"
    exit 1
fi
echo ""

# Wait for container to be ready
echo -e "${BLUE}Waiting for container to be ready...${NC}"
sleep 10

# Health check
echo -e "${BLUE}Performing health check...${NC}"
RETRY_COUNT=0
HEALTHY=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_CHECK_URL" || echo "000")
    
    if [ "$HTTP_CODE" = "200" ]; then
        HEALTHY=true
        break
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo -e "${YELLOW}  Attempt $RETRY_COUNT/$MAX_RETRIES: Service not ready (HTTP $HTTP_CODE)${NC}"
    sleep $RETRY_DELAY
done

echo ""

if [ "$HEALTHY" = true ]; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}   ✓ Deployment Successful!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}Container is running and healthy${NC}"
    echo -e "${GREEN}Health check: $HEALTH_CHECK_URL${NC}"
    
    # Show container status
    echo ""
    echo -e "${BLUE}Container status:${NC}"
    ssh -i "$EC2_KEY_PATH" -o StrictHostKeyChecking=no "$EC2_HOST" \
        "cd $PROJECT_PATH && docker-compose -f $COMPOSE_FILE ps"
else
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}   ✗ Deployment Failed${NC}"
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}Container did not become healthy after ${MAX_RETRIES} attempts${NC}"
    echo ""
    echo -e "${YELLOW}Checking container logs...${NC}"
    ssh -i "$EC2_KEY_PATH" -o StrictHostKeyChecking=no "$EC2_HOST" \
        "cd $PROJECT_PATH && docker-compose -f $COMPOSE_FILE logs --tail=50 backend"
    exit 1
fi

echo ""
echo -e "${BLUE}Deployment complete!${NC}"
