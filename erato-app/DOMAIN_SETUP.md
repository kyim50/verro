# Domain Setup Guide: api.verrocio.com

This guide will help you set up your domain `api.verrocio.com` to point to your EC2 API instance.

## Step 1: DNS Configuration in Porkbun

1. Log in to your Porkbun account
2. Go to **DNS** → **Your Domain** (verrocio.com)
3. Add the following DNS record:

   **Type:** `A`  
   **Host:** `api`  
   **Answer:** `3.18.213.189`  
   **TTL:** `600` (or default)

   This will create: `api.verrocio.com` → `3.18.213.189`

4. Wait for DNS propagation (can take 5 minutes to 48 hours, usually ~15 minutes)

## Step 2: Install Nginx on EC2 (Reverse Proxy)

SSH into your EC2 instance and run:

```bash
# Update package list
sudo apt update

# Install Nginx
sudo apt install -y nginx

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Check status
sudo systemctl status nginx
```

## Step 3: Configure Nginx Reverse Proxy

Create the Nginx configuration file:

```bash
sudo nano /etc/nginx/sites-available/api.verrocio.com
```

Add this configuration:

```nginx
server {
    listen 80;
    server_name api.verrocio.com;

    # Increase body size for file uploads
    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # WebSocket support for Socket.io
        proxy_set_header X-Forwarded-Host $server_name;
        proxy_read_timeout 86400;
    }
}
```

Enable the site:

```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/api.verrocio.com /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

## Step 4: Install SSL Certificate (Let's Encrypt)

Install Certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
```

Get SSL certificate:

```bash
sudo certbot --nginx -d api.verrocio.com
```

Follow the prompts:
- Enter your email address
- Agree to terms
- Choose whether to redirect HTTP to HTTPS (recommended: Yes)

Certbot will automatically configure Nginx with SSL.

## Step 5: Update Backend Configuration

On your EC2 instance, update the backend `.env` file:

```bash
cd ~/erato-app/backend
nano .env
```

Add/update:

```env
FRONTEND_URL=https://api.verrocio.com
DOMAIN=api.verrocio.com
PORT=3000
```

## Step 6: Update Security Group

In AWS Console → EC2 → Security Groups:

1. Find your EC2 instance's security group
2. Add inbound rules:
   - **Type:** HTTP (port 80)
   - **Source:** 0.0.0.0/0
   - **Type:** HTTPS (port 443)
   - **Source:** 0.0.0.0/0

## Step 7: Update Frontend Configuration

Update `frontend/app.json`:

```json
{
  "expo": {
    "extra": {
      "EXPO_PUBLIC_API_URL": "https://api.verrocio.com/api",
      "EXPO_PUBLIC_SOCKET_URL": "https://api.verrocio.com"
    }
  }
}
```

## Step 8: Test

1. **Test DNS propagation:**
   ```bash
   nslookup api.verrocio.com
   # or
   dig api.verrocio.com
   ```

2. **Test HTTP:**
   ```bash
   curl http://api.verrocio.com/health
   ```

3. **Test HTTPS:**
   ```bash
   curl https://api.verrocio.com/health
   ```

4. **Update frontend and test from app**

## Step 9: Auto-renewal for SSL

SSL certificates expire every 90 days. Certbot sets up auto-renewal, but verify:

```bash
# Test renewal
sudo certbot renew --dry-run

# Check renewal timer
sudo systemctl status certbot.timer
```

## Troubleshooting

### Domain not resolving?
- Check DNS propagation: https://dnschecker.org/
- Verify DNS record in Porkbun
- Wait up to 48 hours for full propagation

### Connection refused?
- Check Nginx is running: `sudo systemctl status nginx`
- Check backend is running: `docker ps`
- Check security group allows ports 80 and 443

### SSL errors?
- Verify Certbot ran successfully
- Check Nginx config: `sudo nginx -t`
- Check certificate: `sudo certbot certificates`

### 502 Bad Gateway?
- Backend might not be running: `cd ~/erato-app && docker-compose ps`
- Check backend logs: `docker-compose logs backend`

## Verification Checklist

- [ ] DNS A record added in Porkbun
- [ ] Nginx installed and running
- [ ] Nginx configuration created and enabled
- [ ] SSL certificate installed via Certbot
- [ ] Security group allows HTTP/HTTPS
- [ ] Backend .env updated
- [ ] Frontend app.json updated
- [ ] DNS propagation complete (check with nslookup)
- [ ] HTTP works: `curl http://api.verrocio.com/health`
- [ ] HTTPS works: `curl https://api.verrocio.com/health`

