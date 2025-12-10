#!/bin/bash

# Quick Domain Setup Script for EC2
# This script helps set up nginx reverse proxy and SSL for api.verrocio.com

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Domain Setup: api.verrocio.com${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo -e "${YELLOW}This script needs sudo privileges.${NC}"
    echo "Please run with: sudo bash setup-domain.sh"
    exit 1
fi

DOMAIN="api.verrocio.com"

echo -e "${BLUE}Step 1: Installing Nginx...${NC}"
apt update
apt install -y nginx

echo -e "${BLUE}Step 2: Creating Nginx configuration...${NC}"
cat > /etc/nginx/sites-available/${DOMAIN} <<EOF
server {
    listen 80;
    server_name ${DOMAIN};

    # Increase body size for file uploads
    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # WebSocket support for Socket.io
        proxy_set_header X-Forwarded-Host \$server_name;
        proxy_read_timeout 86400;
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/${DOMAIN} /etc/nginx/sites-enabled/

# Remove default if it exists
[ -f /etc/nginx/sites-enabled/default ] && rm /etc/nginx/sites-enabled/default

echo -e "${BLUE}Step 3: Testing Nginx configuration...${NC}"
nginx -t

echo -e "${BLUE}Step 4: Starting Nginx...${NC}"
systemctl enable nginx
systemctl restart nginx

echo -e "${GREEN}✓ Nginx is configured and running${NC}"
echo ""

echo -e "${BLUE}Step 5: Installing Certbot for SSL...${NC}"
apt install -y certbot python3-certbot-nginx

echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Make sure DNS A record is set in Porkbun:"
echo "   Type: A, Host: api, Answer: $(curl -s ifconfig.me)"
echo ""
echo "2. Wait a few minutes for DNS to propagate"
echo ""
echo "3. Run SSL certificate installation:"
echo "   ${GREEN}sudo certbot --nginx -d ${DOMAIN}${NC}"
echo ""
echo "4. Certbot will automatically configure HTTPS"
echo ""
echo -e "${GREEN}Setup complete!${NC}"

