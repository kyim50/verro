# Quick Start: Setting Up api.verrocio.com

## Step 1: DNS Configuration in Porkbun

1. Log in to Porkbun
2. Go to **DNS** → **verrocio.com**
3. Add this record:
   - **Type:** `A`
   - **Host:** `api`
   - **Answer:** `3.18.213.189`
   - **TTL:** `600`

✅ This creates: `api.verrocio.com` → `3.18.213.189`

## Step 2: Setup on EC2 (One Command)

SSH into your EC2 instance and run:

```bash
# Copy the setup script to EC2 first, or run commands manually:

# Install Nginx
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx

# Create Nginx config
sudo tee /etc/nginx/sites-available/api.verrocio.com > /dev/null <<'EOF'
server {
    listen 80;
    server_name api.verrocio.com;
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
        proxy_set_header X-Forwarded-Host $server_name;
        proxy_read_timeout 86400;
    }
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/api.verrocio.com /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

# Wait 5-10 minutes for DNS, then get SSL certificate
sudo certbot --nginx -d api.verrocio.com
```

## Step 3: Update AWS Security Group

1. Go to **EC2 Console** → **Security Groups**
2. Select your instance's security group
3. Add inbound rules:
   - **HTTP** (port 80) from `0.0.0.0/0`
   - **HTTPS** (port 443) from `0.0.0.0/0`

## Step 4: Update Backend Environment

On EC2, edit `~/erato-app/backend/.env`:

```bash
nano ~/erato-app/backend/.env
```

Add:
```env
FRONTEND_URL=https://api.verrocio.com,http://localhost:19006
```

Restart backend:
```bash
cd ~/erato-app && docker-compose restart backend
```

## Step 5: Update Frontend

The frontend `app.json` has already been updated to use `https://api.verrocio.com`. 

Rebuild your app:
```bash
cd frontend
npm install  # If needed
npx expo prebuild  # Rebuild native configs
```

## Step 6: Test

```bash
# Test DNS (should show your EC2 IP)
nslookup api.verrocio.com

# Test HTTP
curl http://api.verrocio.com/health

# Test HTTPS (after SSL setup)
curl https://api.verrocio.com/health
```

## Done! 🎉

Your API is now accessible at:
- **HTTP:** `http://api.verrocio.com`
- **HTTPS:** `https://api.verrocio.com`

---

**Need help?** Check `DOMAIN_SETUP.md` for detailed troubleshooting.

