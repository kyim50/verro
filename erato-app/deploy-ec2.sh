#!/bin/bash

# EC2 Deployment Script
# This script automates the deployment of backend changes to EC2
# Configuration is loaded from deploy.config (create from deploy.config.example)

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
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

echo -e "${GREEN}🚀 Starting EC2 Deployment${NC}"
echo ""

# Check if we need to commit changes first
if ! git diff --quiet || ! git diff --cached --quiet; then
    echo -e "${YELLOW}⚠️  You have uncommitted changes${NC}"
    read -p "Do you want to commit and push them? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}📝 Committing changes...${NC}"
        git add .
        read -p "Commit message: " commit_msg
        if [ -z "$commit_msg" ]; then
            commit_msg="Deploy to EC2 - $(date +'%Y-%m-%d %H:%M:%S')"
        fi
        git commit -m "$commit_msg"
        echo -e "${YELLOW}📤 Pushing to GitHub...${NC}"
        git push
        echo -e "${GREEN}✅ Changes committed and pushed${NC}"
    else
        echo -e "${RED}❌ Deployment cancelled${NC}"
        exit 1
    fi
fi

# Build SSH command
SSH_CMD="ssh -i $EC2_KEY_PATH -o StrictHostKeyChecking=no $EC2_HOST"

# Auto-detect project path if not set
if [ -z "$PROJECT_PATH" ]; then
    echo -e "${YELLOW}🔍 Auto-detecting project path on EC2...${NC}"
    PROJECT_PATH=$($SSH_CMD "if [ -d ~/erato-app ]; then echo ~/erato-app; elif [ -d /home/$EC2_USER/erato-app ]; then echo /home/$EC2_USER/erato-app; else find ~ /home/$EC2_USER -maxdepth 3 -type d -name 'erato-app' -not -path '*/node_modules/*' -not -path '*/.git/*' 2>/dev/null | head -1; fi")
    if [ -z "$PROJECT_PATH" ]; then
        echo -e "${RED}❌ Could not find erato-app directory on EC2${NC}"
        echo -e "${YELLOW}Please manually set PROJECT_PATH in deploy.config${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Found project at: $PROJECT_PATH${NC}"
fi

echo -e "${YELLOW}📥 Pulling latest changes on EC2...${NC}"
$SSH_CMD "cd $PROJECT_PATH && git pull"

echo -e "${YELLOW}🔨 Rebuilding Docker containers...${NC}"
# Stop and remove old container first to avoid image conflicts
echo -e "${YELLOW}  Stopping old backend container...${NC}"
$SSH_CMD "cd $PROJECT_PATH && docker-compose -f $COMPOSE_FILE stop backend 2>/dev/null || true"
echo -e "${YELLOW}  Removing old backend container...${NC}"
$SSH_CMD "cd $PROJECT_PATH && docker-compose -f $COMPOSE_FILE rm -f backend 2>/dev/null || true"

# Clean up Docker to free space and fix potential issues
echo -e "${YELLOW}  Cleaning up Docker (pruning unused resources)...${NC}"
$SSH_CMD "docker system prune -f --volumes 2>/dev/null || true"

# Build and start with force recreate (no interactive prompts)
echo -e "${YELLOW}  Building and starting new backend container...${NC}"
$SSH_CMD "cd $PROJECT_PATH && docker-compose -f $COMPOSE_FILE up -d --build --force-recreate --no-deps backend"

echo -e "${YELLOW}⏳ Waiting for backend to be healthy...${NC}"
sleep 5

# Set health check URL if not provided
if [ -z "$HEALTH_CHECK_URL" ]; then
    HEALTH_CHECK_URL="http://${EC2_IP}:3000/health"
fi

# Health check
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_CHECK_URL" || echo "000")

if [ "$HEALTH_CHECK" = "200" ]; then
    echo -e "${GREEN}✅ Deployment successful! Backend is healthy.${NC}"
    echo -e "${GREEN}📍 Backend URL: http://${EC2_IP}:3000${NC}"
else
    echo -e "${RED}⚠️  Warning: Health check returned status $HEALTH_CHECK${NC}"
    echo -e "${YELLOW}Check backend logs:${NC}"
    echo "  $SSH_CMD 'cd $PROJECT_PATH && docker-compose -f $COMPOSE_FILE logs backend --tail=50'"
fi

echo ""
echo -e "${GREEN}✨ Deployment complete!${NC}"
