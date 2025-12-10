# Bot Protection Guide

## What You're Seeing

Those suspicious requests like `/SDK/duckyisafaggot` are **external bot/scanner traffic** - this is completely normal for any public-facing server. Bots automatically scan the internet looking for:
- Vulnerable endpoints
- Common admin panels
- SDK/documentation paths
- Security holes

**This is NOT something you created** - it's automated traffic hitting your EC2 instance.

## Current Protection

Your backend already has:
- ✅ **Helmet.js** - Security headers
- ✅ **Rate limiting** - Limits request frequency
- ✅ **CORS** - Restricts origins

## Recommended: Add Nginx-Level Blocking

Since Nginx sits in front of your backend, it's more efficient to block suspicious requests there before they even reach your Node.js server.

### Option 1: Quick Fix (Update Nginx Config)

1. **SSH into your EC2 instance**
2. **Edit your Nginx config**:
   ```bash
   sudo nano /etc/nginx/sites-available/api.verrocio.com
   ```
   (Or wherever your config is)

3. **Add blocking rules** before the main `location /` block:
   ```nginx
   # Block common bot/scanner paths
   location ~ ^/(SDK|admin|wp-admin|phpmyadmin|\.env|config|debug|test|api/v1|v1/api) {
       return 444; # Close connection silently
       access_log off; # Don't log these
   }
   ```

4. **Test and reload**:
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

### Option 2: More Comprehensive Blocking

The `nginx.conf.example` file has been updated with:
- Blocking common bot paths
- SQL injection attempt blocking
- Suspicious user agent blocking
- Rate limiting zone (optional)

### Option 3: Just Ignore It (Simplest)

If you don't want to block these, you can:
- Filter logs to ignore 404s:
  ```bash
  # View only real errors (not 404s from bots)
  docker-compose logs -f backend | grep -v "404"
  ```

- These requests are harmless (just return 404)
- Your backend is protected by Helmet and rate limiting

## Monitoring

To see what's actually hitting your server:
```bash
# View access logs
sudo tail -f /var/log/nginx/access.log

# View only suspicious requests
docker-compose logs backend | grep -E "(SDK|admin|wp-|php)"
```

## Bottom Line

**This is normal and harmless** - bots scan every public server. Your server is already protected. The blocking rules are optional but recommended to reduce log noise.

