#!/bin/bash

# EC2 Deployment Script
# This script automates the deployment of backend changes to EC2

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration - UPDATE THESE VALUES
EC2_USER="ubuntu"
EC2_IP="3.18.213.189"
EC2_KEY_PATH="/Users/kimanimcleish/Desktop/Projects/verro/erato-app/verro.pem"  # Path to your .pem key file (leave empty to use SSH config)
PROJECT_PATH="~/erato-app"  # Path to project on EC2 (adjust if different)
COMPOSE_FILE="docker-compose.prod.yml"

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
if [ -z "$EC2_KEY_PATH" ]; then
    SSH_CMD="ssh $EC2_USER@$EC2_IP"
else
    SSH_CMD="ssh -i $EC2_KEY_PATH $EC2_USER@$EC2_IP"
fi

echo -e "${YELLOW}📥 Pulling latest changes on EC2...${NC}"
$SSH_CMD "cd $PROJECT_PATH && git pull"

echo -e "${YELLOW}🔨 Rebuilding Docker containers...${NC}"
$SSH_CMD "cd $PROJECT_PATH && docker-compose -f $COMPOSE_FILE up -d --build backend"

echo -e "${YELLOW}⏳ Waiting for backend to be healthy...${NC}"
sleep 5

# Health check
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://$EC2_IP:3000/health || echo "000")

if [ "$HEALTH_CHECK" = "200" ]; then
    echo -e "${GREEN}✅ Deployment successful! Backend is healthy.${NC}"
    echo -e "${GREEN}📍 Backend URL: http://$EC2_IP:3000${NC}"
else
    echo -e "${RED}⚠️  Warning: Health check returned status $HEALTH_CHECK${NC}"
    echo -e "${YELLOW}Check backend logs:${NC}"
    echo "  $SSH_CMD 'cd $PROJECT_PATH && docker-compose -f $COMPOSE_FILE logs backend --tail=50'"
fi

echo ""
echo -e "${GREEN}✨ Deployment complete!${NC}"

