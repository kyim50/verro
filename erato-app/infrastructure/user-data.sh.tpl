#!/bin/bash
# EC2 User Data Script - Runs on instance startup

# Install Docker
yum update -y
amazon-linux-extras install docker -y
systemctl start docker
systemctl enable docker
usermod -a -G docker ec2-user

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Create application directory
mkdir -p /home/ec2-user/erato-app
cd /home/ec2-user/erato-app

# Clone your repository (replace with your repo URL)
# You can also use AWS CodeDeploy or other deployment methods
echo "Cloning repository..."
# git clone https://github.com/yourusername/verro.git .

# For now, we'll assume the application files are copied via other means
# In production, you might want to use AWS CodeDeploy, GitHub Actions, or similar

# Create environment file
cat > .env << EOF
NODE_ENV=production
PORT=3000
SUPABASE_URL=${supabase_url}
SUPABASE_SERVICE_KEY=${supabase_service_key}
SUPABASE_ANON_KEY=${supabase_anon_key}
JWT_SECRET=${jwt_secret}
FRONTEND_URL=${frontend_url}
AWS_ACCESS_KEY_ID=${aws_access_key_id}
AWS_SECRET_ACCESS_KEY=${aws_secret_access_key}
AWS_REGION=${aws_region}
AWS_S3_BUCKET=${aws_s3_bucket}
REDIS_HOST=localhost
REDIS_PORT=6379
EOF

# Create docker-compose.yml for backend only
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    container_name: erato-redis
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - erato-network

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: erato-backend
    ports:
      - "3000:3000"
    env_file:
      - .env
    environment:
      - NODE_ENV=production
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    depends_on:
      redis:
        condition: service_healthy
    volumes:
      - ./backend:/app
      - /app/node_modules
    networks:
      - erato-network
    restart: unless-stopped

volumes:
  redis-data:
    driver: local

networks:
  erato-network:
    driver: bridge
EOF

# Start application with docker-compose
docker-compose up -d

# Install CloudWatch agent for monitoring
wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
rpm -U amazon-cloudwatch-agent.rpm

# Configure CloudWatch agent
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << EOF
{
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/home/ec2-user/erato-app/logs/*.log",
            "log_group_name": "/erato/backend/{instance_id}",
            "log_stream_name": "{hostname}"
          }
        ]
      }
    }
  },
  "metrics": {
    "metrics_collected": {
      "mem": {
        "measurement": [
          "mem_used_percent"
        ]
      },
      "disk": {
        "measurement": [
          "disk_used_percent"
        ],
        "resources": [
          "/"
        ]
      }
    }
  }
}
EOF

# Start CloudWatch agent
systemctl start amazon-cloudwatch-agent
systemctl enable amazon-cloudwatch-agent

# Set up log rotation
cat > /etc/logrotate.d/erato << EOF
/home/ec2-user/erato-app/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 644 ec2-user ec2-user
    postrotate
        docker-compose -f /home/ec2-user/erato-app/docker-compose.yml logs -f backend > /dev/null 2>&1 || true
    endscript
}
EOF

# Create health check script for load balancer
cat > /home/ec2-user/health-check.sh << 'EOF'
#!/bin/bash
# Health check script for load balancer

# Check if backend container is running
if docker ps | grep -q erato-backend; then
    # Check if backend is responding
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        exit 0
    fi
fi
exit 1
EOF

chmod +x /home/ec2-user/health-check.sh

# Set up cron job for log rotation
echo "0 2 * * * /usr/sbin/logrotate /etc/logrotate.d/erato" | crontab -

echo "Setup complete. Application should be running."