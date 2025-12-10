#!/bin/bash

# Quick EC2 Deployment Script
# Usage: ./QUICK_EC2_DEPLOY.sh YOUR_EC2_IP your-key.pem

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: ./QUICK_EC2_DEPLOY.sh YOUR_EC2_IP your-key.pem"
  exit 1
fi

EC2_IP=$1
KEY_FILE=$2

echo "🚀 Deploying to EC2: $EC2_IP"

# Step 1: Install Docker on EC2 (if not already installed)
echo "📦 Installing Docker on EC2..."
ssh -i "$KEY_FILE" ubuntu@$EC2_IP << 'EOF'
  if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker ubuntu
    sudo apt install docker-compose -y
    echo "✅ Docker installed"
  else
    echo "✅ Docker already installed"
  fi
EOF

# Step 2: Create directory structure
echo "📁 Setting up directory structure..."
ssh -i "$KEY_FILE" ubuntu@$EC2_IP "mkdir -p ~/erato-app/backend"

# Step 3: Copy files
echo "📤 Copying files to EC2..."
scp -i "$KEY_FILE" -r erato-app/backend/* ubuntu@$EC2_IP:~/erato-app/backend/
scp -i "$KEY_FILE" erato-app/docker-compose.prod.yml ubuntu@$EC2_IP:~/erato-app/

# Step 4: Remind about .env file
echo ""
echo "⚠️  IMPORTANT: You need to create the .env file on EC2"
echo "Run this command:"
echo "  ssh -i $KEY_FILE ubuntu@$EC2_IP"
echo "  cd ~/erato-app/backend"
echo "  nano .env"
echo "  (add all your environment variables)"
echo ""
echo "Then run on EC2:"
echo "  cd ~/erato-app"
echo "  docker-compose -f docker-compose.prod.yml up -d --build"
echo ""
echo "✅ Deployment files copied!"

