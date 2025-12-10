# Free Tier EC2 Security Improvements

All of these security enhancements are **completely free** and can be implemented on AWS EC2 free tier!

## 🛡️ Security Layers

### ✅ Already Implemented
- ✅ HTTPS (Certbot/Let's Encrypt)
- ✅ CORS configuration
- ✅ Rate limiting (Express middleware)
- ✅ Helmet.js security headers
- ✅ Bot protection (Nginx blocking)

### 🆕 Free Improvements You Can Add

## 1. AWS Security Groups (FREE) 🔒

**Most Important!** Tighten your security groups to only allow necessary traffic.

**Current typical setup** (too open):
- SSH: 0.0.0.0/0 (from anywhere)
- HTTP/HTTPS: 0.0.0.0/0 (from anywhere)

**Recommended**:
- SSH: Only your IP (or a small range)
- HTTP: 0.0.0.0/0 (needed for Let's Encrypt)
- HTTPS: 0.0.0.0/0 (needed for your API)

**How to update**:
```bash
# Via AWS Console:
# 1. EC2 → Security Groups
# 2. Find your instance's security group
# 3. Edit inbound rules:
#    - SSH (22): Change to "My IP" only
#    - HTTP (80): Keep 0.0.0.0/0 (for Let's Encrypt)
#    - HTTPS (443): Keep 0.0.0.0/0 (for your API)
# 4. Save rules
```

## 2. UFW Firewall on EC2 (FREE) 🔥

Additional firewall layer directly on your EC2 instance.

**Benefits**:
- Blocks unwanted traffic even if Security Group allows it
- Defense in depth
- Can rate-limit connection attempts

**Install & Configure**:
```bash
# On your EC2 instance:
sudo apt update
sudo apt install ufw -y

# Allow SSH (IMPORTANT - do this first!)
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable UFW
sudo ufw enable

# Check status
sudo ufw status
```

## 3. Fail2Ban (FREE) 🚫

Prevents brute force attacks on SSH and other services.

**Benefits**:
- Automatically bans IPs after failed login attempts
- Protects SSH from brute force
- Can protect HTTP endpoints too
- Free and lightweight

**Install**:
```bash
# On EC2:
sudo apt install fail2ban -y

# Copy default config
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local

# Edit config (optional - defaults are good)
sudo nano /etc/fail2ban/jail.local

# Start service
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Check status
sudo fail2ban-client status
```

## 4. Disable Root Login (FREE) 🔐

Prevent direct root access via SSH.

**Benefits**:
- Forces use of `sudo` (audit trail)
- Reduces attack surface
- Best practice

**Configure**:
```bash
# On EC2:
sudo nano /etc/ssh/sshd_config

# Find and set:
PermitRootLogin no
PasswordAuthentication no  # Only allow SSH keys

# Restart SSH (CAREFUL - test in new terminal first!)
sudo systemctl restart sshd
```

## 5. SSH Key-Only Authentication (FREE) 🔑

Disable password authentication (you should already have this).

**Check current setup**:
```bash
# On EC2:
sudo grep -E "^(PasswordAuthentication|PubkeyAuthentication)" /etc/ssh/sshd_config
```

**Should show**:
```
PasswordAuthentication no
PubkeyAuthentication yes
```

## 6. Automatic Security Updates (FREE) 🔄

Keep your system patched automatically.

**Enable**:
```bash
# On EC2:
sudo apt install unattended-upgrades -y
sudo dpkg-reconfigure -plow unattended-upgrades
# Select "Yes" when prompted
```

## 7. AWS CloudWatch Logs (FREE Tier: 5GB/month) 📊

Monitor your application logs (basic tier is free).

**Benefits**:
- Centralized logging
- Alert on errors
- Free for first 5GB/month
- Monitor security events

**Setup**: Use AWS Systems Manager or install CloudWatch agent (optional, may be overkill for now).

## 8. Regular Security Audits (FREE) 🔍

**Weekly check**:
```bash
# Check failed login attempts
sudo grep "Failed password" /var/log/auth.log | tail -20

# Check UFW status
sudo ufw status verbose

# Check Fail2Ban banned IPs
sudo fail2ban-client status sshd

# Check for updates
sudo apt list --upgradable
```

## 9. Restrict File Permissions (FREE) 📁

Ensure sensitive files are protected.

```bash
# Protect SSH keys
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
chmod 600 ~/.ssh/id_rsa  # Your private key (local)

# Protect deployment config
chmod 600 deploy.config

# Protect Nginx configs
sudo chmod 644 /etc/nginx/sites-available/api.verrocio.com
```

## 10. AWS Systems Manager Session Manager (FREE) 🎯

**Alternative to SSH** (more secure, audited).

**Benefits**:
- No need to open SSH port
- All sessions logged
- IAM-based access control
- Free tier eligible

**Setup**: Requires SSM Agent (usually pre-installed) and IAM roles.

## 🎯 Priority Order

1. **Security Groups** - Restrict SSH to your IP (5 min)
2. **UFW Firewall** - Enable on EC2 (5 min)
3. **Fail2Ban** - Install and enable (10 min)
4. **Disable Root/Password Auth** - Harden SSH (5 min)
5. **Auto Updates** - Enable unattended-upgrades (5 min)

## 📋 Quick Implementation Script

I've created a script that implements most of these automatically. Run:
```bash
./harden-ec2.sh
```

## ⚠️ Important Notes

- **Test SSH access** before making changes to SSH config
- **Keep a terminal open** when restarting SSH service
- **Backup configs** before making changes
- **Security Groups** are the most important layer
- **UFW + Fail2Ban** provide defense in depth

## 🚀 Next Steps

1. Start with Security Groups (AWS Console)
2. Run the hardening script
3. Enable auto-updates
4. Monitor logs weekly

All of these are **FREE** and work great on free tier! 🎉

