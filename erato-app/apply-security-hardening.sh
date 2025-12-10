#!/bin/bash

# Script to run security hardening on EC2 via SSH

set -e

# Load config
if [ ! -f "deploy.config" ]; then
    echo "❌ Error: deploy.config not found"
    echo "Please create deploy.config from deploy.config.example"
    exit 1
fi

source deploy.config

echo "🛡️  Applying security hardening to EC2 instance..."
echo ""

# Copy hardening script to EC2 and run it
scp -i "$EC2_KEY_PATH" -o StrictHostKeyChecking=no \
    erato-app/harden-ec2.sh \
    "$EC2_USER@$EC2_IP:/tmp/harden-ec2.sh"

# Run the hardening script
ssh -i "$EC2_KEY_PATH" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_IP" << 'ENDSSH'
    chmod +x /tmp/harden-ec2.sh
    /tmp/harden-ec2.sh
    rm /tmp/harden-ec2.sh
ENDSSH

echo ""
echo "✅ Security hardening applied!"
echo ""
echo "📋 Next steps:"
echo "1. Update AWS Security Groups (restrict SSH to your IP)"
echo "2. Test SSH access from a new terminal"
echo "3. Monitor logs with: sudo fail2ban-client status sshd"

