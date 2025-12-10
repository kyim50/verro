#!/bin/bash

# EC2 Security Hardening Script
# Implements free security improvements on your EC2 instance
# Run this on your EC2 instance (via SSH)

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🛡️  EC2 Security Hardening Script${NC}"
echo -e "${BLUE}===================================${NC}"
echo ""

# Check if running as root (we don't want that)
if [ "$EUID" -eq 0 ]; then 
   echo -e "${RED}❌ Please do not run as root. Use sudo when needed.${NC}"
   exit 1
fi

# 1. Install UFW
echo -e "${YELLOW}[1/7] Installing UFW firewall...${NC}"
if ! command -v ufw &> /dev/null; then
    sudo apt update
    sudo apt install -y ufw
    echo -e "${GREEN}✅ UFW installed${NC}"
else
    echo -e "${GREEN}✅ UFW already installed${NC}"
fi

# 2. Configure UFW
echo -e "${YELLOW}[2/7] Configuring UFW firewall...${NC}"
if ! sudo ufw status | grep -q "Status: active"; then
    echo "Setting up firewall rules..."
    
    # Reset UFW to defaults
    echo "y" | sudo ufw --force reset
    
    # Allow SSH (CRITICAL - do this first!)
    sudo ufw allow 22/tcp comment 'SSH'
    echo -e "${GREEN}✅ SSH (22) allowed${NC}"
    
    # Allow HTTP
    sudo ufw allow 80/tcp comment 'HTTP'
    echo -e "${GREEN}✅ HTTP (80) allowed${NC}"
    
    # Allow HTTPS
    sudo ufw allow 443/tcp comment 'HTTPS'
    echo -e "${GREEN}✅ HTTPS (443) allowed${NC}"
    
    # Enable UFW
    echo "y" | sudo ufw --force enable
    echo -e "${GREEN}✅ UFW firewall enabled${NC}"
else
    echo -e "${GREEN}✅ UFW already configured${NC}"
fi

# 3. Install Fail2Ban
echo -e "${YELLOW}[3/7] Installing Fail2Ban...${NC}"
if ! command -v fail2ban-client &> /dev/null; then
    sudo apt install -y fail2ban
    echo -e "${GREEN}✅ Fail2Ban installed${NC}"
else
    echo -e "${GREEN}✅ Fail2Ban already installed${NC}"
fi

# 4. Configure Fail2Ban
echo -e "${YELLOW}[4/7] Configuring Fail2Ban...${NC}"
if [ ! -f /etc/fail2ban/jail.local ]; then
    sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
    
    # Customize settings
    sudo sed -i 's/^bantime = 10m/bantime = 1h/' /etc/fail2ban/jail.local
    sudo sed -i 's/^findtime = 10m/findtime = 10m/' /etc/fail2ban/jail.local
    sudo sed -i 's/^maxretry = 5/maxretry = 3/' /etc/fail2ban/jail.local
    
    echo -e "${GREEN}✅ Fail2Ban configured (bans after 3 failed attempts for 1 hour)${NC}"
else
    echo -e "${GREEN}✅ Fail2Ban already configured${NC}"
fi

# Start and enable Fail2Ban
sudo systemctl enable fail2ban
sudo systemctl restart fail2ban
echo -e "${GREEN}✅ Fail2Ban service started${NC}"

# 5. Configure SSH Security
echo -e "${YELLOW}[5/7] Hardening SSH configuration...${NC}"
SSH_CONFIG="/etc/ssh/sshd_config"
BACKUP_FILE="${SSH_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"

# Backup SSH config
sudo cp "$SSH_CONFIG" "$BACKUP_FILE"
echo -e "${GREEN}✅ SSH config backed up to $BACKUP_FILE${NC}"

# Apply security settings
sudo sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' "$SSH_CONFIG"
sudo sed -i 's/PermitRootLogin yes/PermitRootLogin no/' "$SSH_CONFIG"
sudo sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' "$SSH_CONFIG"
sudo sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' "$SSH_CONFIG"
sudo sed -i 's/#PubkeyAuthentication yes/PubkeyAuthentication yes/' "$SSH_CONFIG"

# Test SSH config
if sudo sshd -t; then
    echo -e "${GREEN}✅ SSH configuration is valid${NC}"
    echo -e "${YELLOW}⚠️  SSH will be restarted. Keep this session open!${NC}"
    read -p "Continue? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sudo systemctl restart sshd
        echo -e "${GREEN}✅ SSH service restarted${NC}"
        echo -e "${GREEN}✅ Root login disabled${NC}"
        echo -e "${GREEN}✅ Password authentication disabled (SSH keys only)${NC}"
    else
        echo -e "${YELLOW}⚠️  SSH changes not applied. Config is backed up.${NC}"
    fi
else
    echo -e "${RED}❌ SSH configuration has errors! Restoring backup...${NC}"
    sudo cp "$BACKUP_FILE" "$SSH_CONFIG"
    exit 1
fi

# 6. Enable Automatic Security Updates
echo -e "${YELLOW}[6/7] Setting up automatic security updates...${NC}"
if ! command -v unattended-upgrades &> /dev/null; then
    sudo apt install -y unattended-upgrades
    echo -e "${GREEN}✅ unattended-upgrades installed${NC}"
fi

# Configure automatic updates
echo 'Unattended-Upgrade::Automatic-Reboot "false";' | sudo tee /etc/apt/apt.conf.d/50unattended-upgrades > /dev/null
echo 'APT::Periodic::Update-Package-Lists "1";' | sudo tee -a /etc/apt/apt.conf.d/20auto-upgrades > /dev/null
echo 'APT::Periodic::Unattended-Upgrade "1";' | sudo tee -a /etc/apt/apt.conf.d/20auto-upgrades > /dev/null

sudo systemctl enable unattended-upgrades
sudo systemctl restart unattended-upgrades
echo -e "${GREEN}✅ Automatic security updates enabled${NC}"

# 7. Secure File Permissions
echo -e "${YELLOW}[7/7] Securing file permissions...${NC}"

# SSH directory
if [ -d ~/.ssh ]; then
    chmod 700 ~/.ssh
    if [ -f ~/.ssh/authorized_keys ]; then
        chmod 600 ~/.ssh/authorized_keys
    fi
    echo -e "${GREEN}✅ SSH directory permissions secured${NC}"
fi

# Summary
echo ""
echo -e "${BLUE}===================================${NC}"
echo -e "${GREEN}🎉 Security Hardening Complete!${NC}"
echo -e "${BLUE}===================================${NC}"
echo ""
echo "✅ Implemented:"
echo "  • UFW firewall enabled"
echo "  • Fail2Ban installed and running"
echo "  • SSH hardened (root disabled, keys only)"
echo "  • Automatic security updates enabled"
echo "  • File permissions secured"
echo ""
echo -e "${YELLOW}📋 Status Check:${NC}"
echo ""
echo "UFW Status:"
sudo ufw status verbose | head -5
echo ""
echo "Fail2Ban Status:"
sudo fail2ban-client status sshd 2>/dev/null || echo "  (No banned IPs yet - this is normal)"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT:${NC}"
echo "1. Update AWS Security Groups to restrict SSH to your IP only"
echo "2. Keep this SSH session open for a few minutes to verify access"
echo "3. Test SSH access from a new terminal before closing this one"
echo ""
echo -e "${GREEN}✅ All done! Your EC2 instance is now more secure.${NC}"

