#!/bin/bash

# Script to add bot protection rules to Nginx config on EC2

set -e

# Load config
if [ ! -f "deploy.config" ]; then
    echo "❌ Error: deploy.config not found"
    echo "Please create deploy.config from deploy.config.example"
    exit 1
fi

source deploy.config

echo "🔒 Adding bot protection to Nginx config on EC2..."

# SSH into EC2 and update Nginx config
ssh -i "$EC2_KEY_PATH" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_IP" << 'ENDSSH'
    set -e
    
    echo "📋 Finding Nginx config file..."
    
    # Find the active Nginx config for api.verrocio.com
    NGINX_CONFIG="/etc/nginx/sites-available/api.verrocio.com"
    
    if [ ! -f "$NGINX_CONFIG" ]; then
        # Try sites-enabled
        NGINX_CONFIG="/etc/nginx/sites-enabled/api.verrocio.com"
    fi
    
    if [ ! -f "$NGINX_CONFIG" ]; then
        # Try nginx.conf
        NGINX_CONFIG="/etc/nginx/nginx.conf"
    fi
    
    if [ ! -f "$NGINX_CONFIG" ]; then
        echo "❌ Error: Could not find Nginx config file"
        echo "Tried:"
        echo "  /etc/nginx/sites-available/api.verrocio.com"
        echo "  /etc/nginx/sites-enabled/api.verrocio.com"
        echo "  /etc/nginx/nginx.conf"
        exit 1
    fi
    
    echo "✅ Found config: $NGINX_CONFIG"
    
    # Backup the config
    BACKUP_FILE="${NGINX_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
    sudo cp "$NGINX_CONFIG" "$BACKUP_FILE"
    echo "💾 Backup created: $BACKUP_FILE"
    
    # Check if blocking rules already exist
    if sudo grep -q "location ~ ^/(SDK|admin|wp-admin)" "$NGINX_CONFIG"; then
        echo "⚠️  Bot protection rules already exist in config"
        echo "Skipping update (to force update, remove existing rules first)"
        exit 0
    fi
    
    echo "➕ Adding bot protection rules..."
    
    # Create a temporary file with the blocking rules
    TEMP_RULES=$(mktemp)
    cat > "$TEMP_RULES" << 'EOFRULES'
    # Block common bot/scanner paths before they hit the backend
    # These paths are commonly probed by bots looking for vulnerabilities
    location ~ ^/(SDK|admin|wp-admin|phpmyadmin|\.env|config|debug|test|api/v1|v1/api) {
        return 444; # Close connection without response
        access_log off; # Don't log these requests
    }

    # Block requests with suspicious query parameters (SQL injection attempts)
    if ($query_string ~* "(union.*select|insert.*into|delete.*from|drop.*table)") {
        return 444;
    }

    # Block requests with suspicious user agents (common bots/scanners)
    if ($http_user_agent ~* "(bot|crawler|spider|scanner|hack|exploit)") {
        return 444;
    }

EOFRULES
    
    # Insert the rules before the main location / block
    # We'll use Python to do this safely
    sudo python3 << PYTHON_SCRIPT
import sys
import re

config_file = "$NGINX_CONFIG"
rules_file = "$TEMP_RULES"

# Read the config
with open(config_file, 'r') as f:
    content = f.read()

# Check if rules already exist
if "location ~ ^/(SDK|admin|wp-admin)" in content:
    print("Rules already exist, skipping")
    sys.exit(0)

# Read the rules to insert
with open(rules_file, 'r') as f:
    rules = f.read()

# Find the location / block and insert rules before it
# Look for "location /" that's not already inside another location block
pattern = r'(\s+)(location\s+/\s*\{)'
match = re.search(pattern, content)

if match:
    indent = match.group(1)
    # Adjust indent for rules
    adjusted_rules = '\n'.join([indent + line if line.strip() else line for line in rules.split('\n')])
    # Insert rules before location /
    replacement = adjusted_rules + match.group(0)
    content = content.replace(match.group(0), replacement, 1)
    
    # Write back
    with open(config_file, 'w') as f:
        f.write(content)
    print("✅ Bot protection rules added successfully")
else:
    print("⚠️  Could not find 'location /' block, appending rules at end of server block")
    # Fallback: append before the closing brace of the server block
    pattern = r'(\s+)(\})'
    match = re.search(pattern, content)
    if match:
        indent = match.group(1)
        adjusted_rules = '\n'.join([indent + line if line.strip() else line for line in rules.split('\n')])
        replacement = adjusted_rules + match.group(0)
        content = content.replace(match.group(0), replacement, 1)
        
        with open(config_file, 'w') as f:
            f.write(content)
        print("✅ Bot protection rules added at end of server block")

PYTHON_SCRIPT
    
    # Clean up temp file
    rm -f "$TEMP_RULES"
    
    # Test Nginx config
    echo "🧪 Testing Nginx configuration..."
    if sudo nginx -t; then
        echo "✅ Nginx config test passed"
        
        # Reload Nginx
        echo "🔄 Reloading Nginx..."
        sudo systemctl reload nginx
        echo "✅ Nginx reloaded successfully"
        echo ""
        echo "🎉 Bot protection rules are now active!"
        echo "Suspicious requests will be blocked at the Nginx level."
    else
        echo "❌ Nginx config test failed!"
        echo "Restoring backup..."
        sudo cp "$BACKUP_FILE" "$NGINX_CONFIG"
        echo "Backup restored. Please check the config manually."
        exit 1
    fi
ENDSSH

echo ""
echo "✅ Bot protection added successfully!"
echo ""
echo "The following requests will now be blocked:"
echo "  - /SDK/* paths"
echo "  - /admin, /wp-admin, /phpmyadmin, etc."
echo "  - SQL injection attempts in query strings"
echo "  - Requests from suspicious user agents"
echo ""
echo "These requests will return 444 (connection closed) and won't be logged."

