# Erato Backend Deployment Guide

This guide covers setting up multiple EC2 servers for high availability, automated Supabase backups, and comprehensive monitoring for your Erato backend application.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Multi-Server EC2 Setup](#multi-server-ec2-setup)
3. [Supabase Database Backup Strategy](#supabase-database-backup-strategy)
4. [High Availability Configuration](#high-availability-configuration)
5. [Monitoring and Alerting](#monitoring-and-alerting)
6. [CI/CD Pipeline Setup](#cicd-pipeline-setup)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

### AWS Account Setup
- AWS CLI installed and configured
- Appropriate IAM permissions for EC2, ELB, Auto Scaling, CloudWatch, SSM
- Route 53 hosted zone (optional, for custom domain)

### Required AWS Permissions
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:*",
        "autoscaling:*",
        "elasticloadbalancing:*",
        "cloudwatch:*",
        "ssm:*",
        "iam:*",
        "route53:*",
        "acm:*"
      ],
      "Resource": "*"
    }
  ]
}
```

### Tools and Software
- Docker and Docker Compose
- Node.js 18+
- Git
- curl, wget, jq

## Multi-Server EC2 Setup

### 1. Infrastructure Setup with Terraform

```bash
cd infrastructure

# Initialize Terraform
terraform init

# Copy and configure variables
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

# Plan deployment
terraform plan

# Apply infrastructure
terraform apply
```

### 2. Alternative: Manual AWS Setup

If you prefer manual setup over Terraform:

```bash
# Configure deployment settings
cp deploy-multi.config.example deploy-multi.config
# Edit deploy-multi.config with your AWS settings

# Create and deploy infrastructure
./deploy-ec2-multi.sh create
```

### 3. Infrastructure Components Created

- **VPC** with public and private subnets across multiple AZs
- **Application Load Balancer** with SSL termination
- **Auto Scaling Group** with 2-10 EC2 instances
- **Launch Template** with Docker and monitoring setup
- **Security Groups** for secure access
- **CloudWatch** alarms and dashboards

## Supabase Database Backup Strategy

### 1. Automated Backup Setup

```bash
# Configure backup settings
cp backup.config.example backup.config
# Edit backup.config with your Supabase credentials

# Run initial backup
./supabase-backup.sh

# Schedule automated backups (add to crontab)
# Daily full backup at 2 AM
0 2 * * * /path/to/verro/erato-app/supabase-backup.sh

# Schema-only backup every 6 hours
0 */6 * * * /path/to/verro/erato-app/supabase-backup.sh schema
```

### 2. Backup Retention Policy

- **Daily backups**: 7 days local retention
- **S3 storage**: 30 days retention with automatic cleanup
- **Schema backups**: Kept for 30 days for point-in-time schema recovery

### 3. Point-in-Time Recovery

For Supabase Pro/Team plans:
1. Go to Supabase Dashboard → Database → Backups
2. Select "Point-in-Time Recovery"
3. Choose recovery timestamp
4. Create new database from backup

## High Availability Configuration

### 1. Multi-AZ Deployment Benefits

- **Automatic failover**: If one AZ fails, instances in other AZs continue serving traffic
- **Load distribution**: Traffic automatically balanced across healthy instances
- **Disaster recovery**: Survives AZ-level outages

### 2. Scaling Policies

The setup includes multiple scaling policies:

- **CPU-based scaling**: Scales out when CPU > 70%, scales in when CPU < 30%
- **Request-based scaling**: Scales based on Application Load Balancer request count
- **Target tracking**: Maintains average CPU utilization at 70%

### 3. Health Checks

- **ELB Health Checks**: TCP connection to port 80 every 30 seconds
- **Application Health Checks**: HTTP GET to `/health` endpoint
- **Auto-healing**: Unhealthy instances automatically replaced

## Monitoring and Alerting

### 1. CloudWatch Setup

```bash
# Deploy monitoring infrastructure
cd infrastructure
terraform apply -target=module.monitoring

# Configure monitoring variables
cp monitoring-variables.tf.example monitoring-variables.tf
# Edit with your settings
```

### 2. Application Monitoring

The backend includes built-in monitoring:

- **Performance metrics**: Response times, throughput, error rates
- **System metrics**: CPU, memory, disk usage
- **Database metrics**: Connection count, query performance
- **Health endpoints**: `/health` and `/metrics` (Prometheus format)

### 3. Alert Configuration

Critical alerts configured:
- High CPU utilization (>80%)
- High memory usage (>85%)
- Unhealthy instances detected
- High error rates (5XX > 10 per minute)
- Slow response times (>5 seconds)

## CI/CD Pipeline Setup

### 1. GitHub Actions Setup

```yaml
# Copy deploy-pipeline.yml to .github/workflows/
cp deploy-pipeline.yml .github/workflows/deploy.yml

# Configure repository secrets:
# - AWS_ACCESS_KEY_ID
# - AWS_SECRET_ACCESS_KEY
# - SNYK_TOKEN (optional)
# - SLACK_WEBHOOK_URL (optional)
```

### 2. Deployment Environments

The pipeline supports:
- **Staging**: Automatic deployment on `develop` branch pushes
- **Production**: Automatic deployment on `main` branch pushes
- **Manual rollback**: Workflow dispatch for emergency rollbacks

### 3. Blue-Green Deployment

Production deployments use blue-green strategy:
1. New instances launched with updated code
2. Traffic gradually switched to new instances
3. Old instances terminated after successful deployment
4. Automatic rollback if health checks fail

## Deployment Commands

### Production Deployment

```bash
# Deploy to production
ENVIRONMENT=production ./deploy.sh

# Check deployment health
ENVIRONMENT=production ./deploy.sh health-check

# Rollback if needed
ENVIRONMENT=production ./deploy.sh rollback
```

### Staging Deployment

```bash
# Deploy to staging
ENVIRONMENT=staging ./deploy.sh

# Quick deployment for testing
ENVIRONMENT=staging BUILD_LOCAL=true ./deploy.sh
```

## Troubleshooting

### Common Issues

#### 1. Deployment Failures

**Symptom**: Deployment command fails in AWS Systems Manager

**Solution**:
```bash
# Check command status
aws ssm get-command-invocation \
  --command-id COMMAND_ID \
  --instance-id INSTANCE_ID

# View instance logs
aws logs tail /erato/backend/application --follow
```

#### 2. Health Check Failures

**Symptom**: Load balancer shows instances as unhealthy

**Solution**:
```bash
# Check application health directly
curl http://instance-ip:3000/health

# Check load balancer target health
aws elbv2 describe-target-health \
  --target-group-arn TARGET_GROUP_ARN
```

#### 3. Auto Scaling Issues

**Symptom**: Instances not scaling as expected

**Solution**:
```bash
# Check scaling activities
aws autoscaling describe-scaling-activities \
  --auto-scaling-group-name erato-backend-asg

# Check CloudWatch alarms
aws cloudwatch describe-alarms \
  --alarm-names erato-high-cpu erato-low-cpu
```

#### 4. Database Connection Issues

**Symptom**: Application cannot connect to Supabase

**Solution**:
```bash
# Check Supabase status
curl https://status.supabase.com/

# Verify environment variables
aws ssm get-parameters-by-path \
  --path "/erato/production/" \
  --recursive
```

### Log Analysis

#### Application Logs
```bash
# View recent application logs
aws logs tail /erato/backend/application \
  --since 1h \
  --follow
```

#### Error Logs
```bash
# View error logs
aws logs tail /erato/backend/errors \
  --since 1h
```

#### System Logs
```bash
# View EC2 system logs
aws ec2 get-console-output \
  --instance-id INSTANCE_ID \
  --output text
```

## Cost Optimization

### 1. Auto Scaling Savings
- Scales down during low traffic periods
- Only pay for instances you need

### 2. Reserved Instances
Consider Reserved Instances for baseline capacity:
```bash
# Calculate baseline usage
aws ce get-reservation-purchase-recommendation \
  --service "Amazon Elastic Compute Cloud - Compute"
```

### 3. Monitoring Costs
- CloudWatch logs: ~$0.50/GB ingested
- Custom metrics: $0.30/metric/month
- Alarms: $0.10/alarm/month

## Security Considerations

### 1. Network Security
- Security groups restrict access to necessary ports only
- Load balancer handles SSL termination
- No direct internet access to application instances

### 2. Access Control
- IAM roles for EC2 instances with minimal required permissions
- SSH access restricted to bastion hosts or VPN
- Secrets stored in SSM Parameter Store

### 3. Data Protection
- All data encrypted in transit (SSL/TLS)
- Database backups encrypted at rest
- Regular security updates via automated deployments

## Performance Tuning

### 1. Instance Sizing
- Start with t3.medium for development/staging
- Use t3.large or larger for production based on load testing
- Monitor CloudWatch metrics to determine optimal sizing

### 2. Database Optimization
- Connection pooling implemented in application code
- Query optimization and indexing
- Regular database maintenance and vacuum operations

### 3. Caching Strategy
- Redis for session storage and frequently accessed data
- Application-level caching for expensive operations
- CDN for static assets

## Maintenance Tasks

### Weekly
- Review CloudWatch dashboards and alerts
- Check backup success and storage usage
- Monitor application performance trends

### Monthly
- Update dependencies and security patches
- Review and optimize costs
- Test disaster recovery procedures

### Quarterly
- Full disaster recovery simulation
- Security assessment and penetration testing
- Performance load testing

---

This deployment setup provides a production-ready, highly available infrastructure for your Erato backend with automated scaling, comprehensive monitoring, and reliable backup strategies.