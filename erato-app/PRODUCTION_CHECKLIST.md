# Production Readiness Checklist

## ✅ Already Done
- Docker containerization with health checks
- Rate limiting (Redis-backed)
- Authentication & JWT tokens
- Error handling middleware
- Security headers (Helmet)
- Performance monitoring
- Redis caching
- Database indexing
- Auto-restart on crash (`restart: unless-stopped`)

## 🔒 Security (High Priority)

### 1. HTTPS Setup (Critical)
Currently using HTTP, which is insecure. For production:
- Get a domain name (e.g., `api.yourapp.com`)
- Set up SSL certificate (use Let's Encrypt - free)
- Update frontend to use `https://` URLs
- Remove `NSAllowsArbitraryLoads` from iOS app

**Quick Setup with Certbot:**
```bash
# On EC2
sudo apt update
sudo apt install certbot
sudo certbot certonly --standalone -d api.yourapp.com
# Then configure nginx or update your app to use the cert
```

### 2. CORS Configuration
On EC2, ensure `FRONTEND_URL` in backend `.env` is set to your actual frontend URL:
```bash
FRONTEND_URL=https://yourapp.com  # or specific IP if using that
```
Avoid using `*` in production - be specific.

### 3. EC2 Security Group Review
Ensure only necessary ports are open:
- ✅ Port 3000 (backend API)
- ✅ Port 22 (SSH)
- ❌ Close unnecessary ports
- Consider restricting SSH to your IP only

### 4. Environment Variables Security
- Never commit `.env` files to git (already in `.gitignore` ✓)
- Use AWS Secrets Manager or Parameter Store for sensitive values
- Rotate JWT_SECRET periodically

## 📊 Monitoring & Logging

### 1. Set Up Logging
Currently using `console.log` - consider:
- CloudWatch Logs (AWS native)
- Or a logging service (e.g., LogRocket, Sentry)

```bash
# On EC2, view logs easily:
docker logs erato-backend-prod -f --tail 100
```

### 2. Set Up Monitoring
- **Uptime monitoring**: UptimeRobot (free) or AWS CloudWatch
- **Error tracking**: Sentry (free tier available)
- **Performance monitoring**: Already have middleware, but consider APM tools

### 3. Health Check Endpoint
✅ Already have `/health` endpoint - set up monitoring to ping this:
```bash
# Test from monitoring service
curl http://3.18.213.189:3000/health
```

## 💾 Backup & Recovery

### 1. Database Backups
- Supabase handles automated backups
- Verify backup retention policy in Supabase dashboard
- Document restore procedure

### 2. Redis Data
- Current setup has Redis persistence (`appendonly yes`) ✓
- Redis data stored in Docker volume
- Consider regular volume backups if critical data in Redis

### 3. Environment Configuration Backup
- Keep a secure backup of `.env` files (encrypted)
- Document all required environment variables

## 🚀 Performance & Scalability

### 1. Load Testing
Test your API under load:
```bash
# Install Apache Bench
sudo apt install apache2-utils

# Test
ab -n 1000 -c 10 http://3.18.213.189:3000/health
```

### 2. Auto-Scaling (Future)
- Consider AWS Auto Scaling Groups for multiple instances
- Use Application Load Balancer (ALB) for load distribution
- Set up horizontal scaling with Docker Swarm or Kubernetes

### 3. CDN for Static Assets
- Already using Supabase Storage ✓
- Consider CloudFront for faster global delivery

## 🔧 Operational

### 1. Domain Name (Optional but Recommended)
- Get a domain (e.g., `yourapp.com`)
- Point A record to EC2 IP: `3.18.213.189`
- Update DNS records for subdomains (api.yourapp.com)

### 2. Systemd Service (Already Documented)
Ensure Docker services auto-start on reboot (see previous setup)

### 3. Regular Updates
```bash
# On EC2, schedule regular updates:
sudo apt update && sudo apt upgrade -y
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

### 4. Resource Monitoring
Monitor EC2 resources:
```bash
# CPU, Memory usage
htop
# Disk usage
df -h
# Docker resource usage
docker stats
```

## 📱 Mobile App

### 1. App Store Preparation
- Remove `NSAllowsArbitraryLoads` before App Store submission
- Use HTTPS endpoints
- Add proper app metadata
- Test on multiple devices

### 2. Environment Variables
- Remove hardcoded EC2 IP from code
- Use proper environment variable loading
- Consider separate staging/production configs

## 🧪 Testing

### 1. End-to-End Testing
- Test critical user flows
- Test on physical devices (not just simulators)
- Test with poor network conditions

### 2. API Testing
- Document your API (Swagger/OpenAPI)
- Create Postman/Insomnia collection
- Write integration tests

## 📝 Documentation

### 1. API Documentation
- Document all endpoints
- Include request/response examples
- Add authentication requirements

### 2. Deployment Guide
- Document deployment process
- Include rollback procedures
- Document environment setup

## 🎯 Priority Actions (Do These First)

1. **Set up HTTPS** - Critical for production
2. **Set up monitoring/alerting** - Know when things break
3. **Secure CORS** - Restrict to your frontend URL
4. **Backup verification** - Ensure backups are working
5. **Remove hardcoded URLs** - Use environment variables properly

## 🆘 Emergency Procedures

### If Backend Goes Down:
```bash
# SSH into EC2
ssh ubuntu@3.18.213.189

# Check containers
docker ps

# Restart if needed
cd ~/verro/erato-app
docker-compose -f docker-compose.prod.yml restart

# View logs
docker logs erato-backend-prod -f
```

### If High Traffic:
- Check EC2 instance type (free tier t2.micro may be limiting)
- Enable CloudWatch metrics
- Consider upgrading instance or adding more instances

---

**Current Status**: Good for testing/staging. For production, prioritize HTTPS and monitoring.


