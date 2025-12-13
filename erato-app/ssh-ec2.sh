#!/bin/bash

# SSH to EC2 Instance
# This script connects to your EC2 instance using configuration from deploy.config

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/deploy.config"

if [ -f "$CONFIG_FILE" ]; then
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

# Use default SSH key if not provided
if [ -z "$EC2_KEY_PATH" ]; then
    EC2_KEY_PATH="${HOME}/.ssh/id_rsa"
fi

# Check if SSH key exists
if [ ! -f "$EC2_KEY_PATH" ]; then
    echo -e "${RED}Error: SSH key not found at $EC2_KEY_PATH${NC}"
    echo -e "${YELLOW}Please set EC2_KEY_PATH in deploy.config or place key at ~/.ssh/id_rsa${NC}"
    exit 1
fi

# Build SSH command
SSH_CMD="ssh -i $EC2_KEY_PATH -o StrictHostKeyChecking=no"

# Check if any arguments were passed (for commands to run on EC2)
if [ $# -gt 0 ]; then
    # Run command on remote server
    echo -e "${BLUE}Running command on ${EC2_HOST}...${NC}"
    echo ""
    $SSH_CMD "$EC2_HOST" "$@"
else
    # Interactive SSH session
    echo -e "${BLUE}Connecting to ${EC2_HOST}...${NC}"
    echo -e "${YELLOW}Using SSH key: $EC2_KEY_PATH${NC}"
    echo ""
    $SSH_CMD "$EC2_HOST"
fi






