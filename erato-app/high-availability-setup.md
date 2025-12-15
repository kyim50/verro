# High Availability Setup for Erato Backend

This document outlines how to implement high availability (HA) for your Erato backend to ensure your system stays up even when individual components fail.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │────│   Auto Scaling  │
│     (ALB)       │    │     Group       │
└─────────────────┘    └─────────────────┘
                              │
                    ┌─────────┼─────────┐
                    │         │         │
            ┌───────▼───┐ ┌───▼───┐ ┌───▼───┐
            │   EC2      │ │  EC2  │ │  EC2  │
            │ Instance 1 │ │Instance│ │Instance│
            │ (us-east-1a)│ │2      │ │3      │
            └────────────┘ │(us-east-1b)│ └────────────┘
                           └────────────┘    (us-east-1c)
```

## 1. Multi-AZ Deployment

### Terraform Multi-AZ Setup

```hcl
# variables.tf - Add these variables
variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

# main.tf - Update subnets for multi-AZ
resource "aws_subnet" "erato_subnet_a" {
  vpc_id            = aws_vpc.erato_vpc.id
  cidr_block        = "10.0.1.0/24"
  availability_zone = var.availability_zones[0]

  tags = {
    Name        = "erato-subnet-a"
    Environment = "production"
    Application = "erato"
  }
}

resource "aws_subnet" "erato_subnet_b" {
  vpc_id            = aws_vpc.erato_vpc.id
  cidr_block        = "10.0.2.0/24"
  availability_zone = var.availability_zones[1]

  tags = {
    Name        = "erato-subnet-b"
    Environment = "production"
    Application = "erato"
  }
}

resource "aws_subnet" "erato_subnet_c" {
  vpc_id            = aws_vpc.erato_vpc.id
  cidr_block        = "10.0.3.0/24"
  availability_zone = var.availability_zones[2]

  tags = {
    Name        = "erato-subnet-c"
    Environment = "production"
    Application = "erato"
  }
}

# Update Auto Scaling Group to use all subnets
resource "aws_autoscaling_group" "erato_asg" {
  # ... other configuration ...
  vpc_zone_identifier = [
    aws_subnet.erato_subnet_a.id,
    aws_subnet.erato_subnet_b.id,
    aws_subnet.erato_subnet_c.id
  ]

  # ... rest of configuration ...
}
```

## 2. Load Balancer Configuration

### Application Load Balancer (ALB) with Health Checks

```hcl
# main.tf - ALB Configuration
resource "aws_lb" "erato_alb" {
  name               = "erato-backend-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.erato_alb_sg.id]
  subnets            = [
    aws_subnet.erato_subnet_a.id,
    aws_subnet.erato_subnet_b.id,
    aws_subnet.erato_subnet_c.id
  ]

  enable_deletion_protection = true
  enable_cross_zone_load_balancing = true

  tags = {
    Name        = "erato-backend-alb"
    Environment = "production"
    Application = "erato"
  }
}

resource "aws_lb_target_group" "erato_tg" {
  name     = "erato-backend-tg"
  port     = 80
  protocol = "HTTP"
  vpc_id   = aws_vpc.erato_vpc.id

  health_check {
    enabled             = true
    healthy_threshold   = 3
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    path                = "/health"
    matcher             = "200"
    port                = "traffic-port"
  }

  stickiness {
    type            = "lb_cookie"
    cookie_duration = 1800
    enabled         = false  # Disable for API, enable for session-based apps
  }

  tags = {
    Name        = "erato-backend-tg"
    Environment = "production"
    Application = "erato"
  }
}

resource "aws_lb_listener" "erato_listener_https" {
  load_balancer_arn = aws_lb.erato_alb.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-2016-08"
  certificate_arn   = aws_acm_certificate.erato_cert.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.erato_tg.arn
  }
}

# Redirect HTTP to HTTPS
resource "aws_lb_listener" "erato_listener_http" {
  load_balancer_arn = aws_lb.erato_alb.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}
```

### SSL Certificate with ACM

```hcl
resource "aws_acm_certificate" "erato_cert" {
  domain_name       = "api.erato.yourdomain.com"
  validation_method = "DNS"

  subject_alternative_names = [
    "*.erato.yourdomain.com"
  ]

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name        = "erato-backend-cert"
    Environment = "production"
    Application = "erato"
  }
}

# DNS validation
resource "aws_route53_record" "erato_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.erato_cert.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = aws_route53_zone.erato_zone.zone_id
}

resource "aws_acm_certificate_validation" "erato_cert" {
  certificate_arn         = aws_acm_certificate.erato_cert.arn
  validation_record_fqdns = [for record in aws_route53_record.erato_cert_validation : record.fqdn]
}
```

## 3. Auto Scaling and Auto Healing

### Advanced Auto Scaling Policies

```hcl
# main.tf - Enhanced Auto Scaling
resource "aws_autoscaling_policy" "cpu_high" {
  name                   = "erato-cpu-high"
  scaling_adjustment     = 2
  adjustment_type        = "ChangeInCapacity"
  cooldown               = 300
  autoscaling_group_name = aws_autoscaling_group.erato_asg.name
}

resource "aws_autoscaling_policy" "cpu_low" {
  name                   = "erato-cpu-low"
  scaling_adjustment     = -1
  adjustment_type        = "ChangeInCapacity"
  cooldown               = 300
  autoscaling_group_name = aws_autoscaling_group.erato_asg.name
}

# Target tracking scaling policy (more responsive)
resource "aws_autoscaling_policy" "target_cpu" {
  name                   = "erato-target-cpu"
  policy_type            = "TargetTrackingScaling"
  autoscaling_group_name = aws_autoscaling_group.erato_asg.name

  target_tracking_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ASGAverageCPUUtilization"
    }
    target_value = 70.0
  }
}

# Scale based on request count
resource "aws_autoscaling_policy" "request_count" {
  name                   = "erato-request-count"
  policy_type            = "TargetTrackingScaling"
  autoscaling_group_name = aws_autoscaling_group.erato_asg.name

  target_tracking_configuration {
    customized_metric_specification {
      metric_dimension {
        name  = "LoadBalancer"
        value = aws_lb.erato_alb.name
      }
      metric_name = "RequestCountPerTarget"
      namespace   = "AWS/ApplicationELB"
      statistic   = "Sum"
    }
    target_value = 1000.0  # Requests per minute per instance
  }
}
```

### Instance Refresh for Zero-Downtime Updates

```hcl
resource "aws_autoscaling_group" "erato_asg" {
  # ... other configuration ...

  instance_refresh {
    strategy = "Rolling"
    preferences {
      min_healthy_percentage = 50
      instance_warmup        = 300
    }
    triggers = ["tag"]
  }

  # ... rest of configuration ...
}
```

## 4. Database High Availability

### Supabase High Availability Setup

For maximum database availability:

1. **Upgrade to Team/Enterprise Plan**: Provides better SLAs and support
2. **Enable Point-in-Time Recovery**: Allows recovery to any point in time
3. **Set up Read Replicas**: If available on your plan
4. **Multi-Region Setup**: For Enterprise plans

### Database Connection Management

```javascript
// config/database.js - Connection pooling with failover
import { Pool } from 'pg';
import { dbFailover } from './failover.js';

class DatabaseConnectionManager {
  constructor() {
    this.pools = new Map();
    this.currentPool = null;
  }

  async getPool() {
    if (this.currentPool && await this.isPoolHealthy(this.currentPool)) {
      return this.currentPool;
    }

    // Find healthy database
    const healthyDb = await dbFailover.getHealthyDatabase();

    if (!this.pools.has(healthyDb.url)) {
      this.pools.set(healthyDb.url, this.createPool(healthyDb));
    }

    this.currentPool = this.pools.get(healthyDb.url);
    return this.currentPool;
  }

  createPool(database) {
    return new Pool({
      connectionString: database.url,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: { rejectUnauthorized: false },
      // Retry logic
      retryOnExit: true,
      retryDelay: 1000,
      maxRetries: 3
    });
  }

  async isPoolHealthy(pool) {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch (error) {
      console.error('Pool health check failed:', error);
      return false;
    }
  }

  async query(text, params) {
    const pool = await this.getPool();
    return pool.query(text, params);
  }
}

export const dbManager = new DatabaseConnectionManager();
```

## 5. Redis High Availability

### Redis Cluster Setup

For high availability Redis, set up a Redis cluster or use Redis with sentinel:

```yaml
# docker-compose.redis-ha.yml
version: '3.8'

services:
  redis-master:
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
    volumes:
      - redis-master-data:/data
    networks:
      - redis-net
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis-slave-1:
    image: redis:7-alpine
    command: redis-server --slaveof redis-master 6379 --appendonly yes
    depends_on:
      - redis-master
    volumes:
      - redis-slave-1-data:/data
    networks:
      - redis-net

  redis-slave-2:
    image: redis:7-alpine
    command: redis-server --slaveof redis-master 6379 --appendonly yes
    depends_on:
      - redis-master
    volumes:
      - redis-slave-2-data:/data
    networks:
      - redis-net

  redis-sentinel-1:
    image: redis:7-alpine
    command: redis-sentinel /etc/redis/sentinel.conf
    depends_on:
      - redis-master
      - redis-slave-1
      - redis-slave-2
    volumes:
      - ./sentinel.conf:/etc/redis/sentinel.conf
    networks:
      - redis-net

volumes:
  redis-master-data:
  redis-slave-1-data:
  redis-slave-2-data:

networks:
  redis-net:
    driver: bridge
```

### Redis Sentinel Configuration

```conf
# sentinel.conf
sentinel monitor mymaster redis-master 6379 2
sentinel down-after-milliseconds mymaster 5000
sentinel failover-timeout mymaster 10000
sentinel parallel-syncs mymaster 1
```

## 6. CDN and Static Asset Delivery

### CloudFront Distribution for Static Assets

```hcl
resource "aws_cloudfront_distribution" "erato_cdn" {
  origin {
    domain_name = aws_s3_bucket.erato_assets.bucket_regional_domain_name
    origin_id   = "erato-s3-origin"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.erato_oai.cloudfront_access_identity_path
    }
  }

  enabled             = true
  is_ipv6_enabled     = true
  comment             = "Erato CDN for static assets"
  default_root_object = "index.html"

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "erato-s3-origin"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  # API caching
  ordered_cache_behavior {
    path_pattern     = "/api/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "erato-api-origin"

    forwarded_values {
      query_string = true
      headers      = ["Authorization"]
      cookies {
        forward = "all"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn = aws_acm_certificate.erato_cert.arn
    ssl_support_method  = "sni-only"
  }

  tags = {
    Name        = "erato-cdn"
    Environment = "production"
    Application = "erato"
  }
}
```

## 7. Monitoring and Alerting

### CloudWatch Dashboards and Alarms

```hcl
# monitoring.tf
resource "aws_cloudwatch_dashboard" "erato_dashboard" {
  dashboard_name = "erato-backend-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/EC2", "CPUUtilization", "AutoScalingGroupName", aws_autoscaling_group.erato_asg.name]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "EC2 CPU Utilization"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", aws_lb.erato_alb.arn_suffix]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "ALB Request Count"
          period  = 300
        }
      }
    ]
  })
}

# Alarms for critical metrics
resource "aws_cloudwatch_metric_alarm" "erato_health_check" {
  alarm_name          = "erato-health-check-failures"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Maximum"
  threshold           = "1"
  alarm_description   = "ALB health check failures detected"
  alarm_actions       = [aws_sns_topic.erato_alerts.arn]

  dimensions = {
    LoadBalancer = aws_lb.erato_alb.arn_suffix
    TargetGroup  = aws_lb_target_group.erato_tg.arn_suffix
  }
}
```

## 8. Backup and Disaster Recovery

### Automated Backups

```bash
#!/bin/bash
# automated-backup.sh - Run daily via cron

# Database backup
./supabase-backup.sh

# Infrastructure backup (AMI creation)
aws ec2 create-image \
  --instance-id $(aws autoscaling describe-auto-scaling-groups \
    --auto-scaling-group-names erato-backend-asg \
    --query 'AutoScalingGroups[0].Instances[0].InstanceId' \
    --output text) \
  --name "erato-backend-$(date +%Y%m%d)" \
  --description "Automated backup of Erato backend" \
  --no-reboot

# Configuration backup
aws s3 cp ./infrastructure/ s3://erato-backups/infrastructure/$(date +%Y%m%d)/ --recursive
```

### Disaster Recovery Runbook

Create a `disaster-recovery.md` file with step-by-step recovery procedures:

1. **Database Failure**: Restore from Supabase PITR or backup
2. **Instance Failure**: Auto scaling will replace failed instances
3. **AZ Failure**: Multi-AZ setup ensures availability
4. **Region Failure**: Cross-region backup and DNS failover

## Implementation Checklist

- [ ] Set up VPC with multiple availability zones
- [ ] Configure Application Load Balancer with health checks
- [ ] Create Auto Scaling Group with proper scaling policies
- [ ] Set up SSL certificates and HTTPS
- [ ] Configure CloudFront CDN for static assets
- [ ] Implement database connection pooling and failover
- [ ] Set up Redis high availability (if needed)
- [ ] Configure monitoring and alerting
- [ ] Set up automated backups
- [ ] Test failover scenarios
- [ ] Document disaster recovery procedures

This HA setup ensures your Erato backend can handle failures gracefully and maintain service availability.