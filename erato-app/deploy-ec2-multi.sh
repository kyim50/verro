#!/bin/bash

# Multi-Server EC2 Deployment Script for Erato Backend
# This script deploys your Dockerized Node.js backend to multiple EC2 instances

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/deploy-multi.config"

# Load configuration
if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
else
    echo -e "${RED}Error: deploy-multi.config not found${NC}"
    echo -e "${YELLOW}Please create deploy-multi.config with your AWS and deployment settings${NC}"
    exit 1
fi

# Validate required variables
validate_config() {
    required_vars=("AWS_REGION" "EC2_INSTANCE_TYPE" "EC2_AMI_ID" "KEY_PAIR_NAME" "SECURITY_GROUP_ID" "SUBNET_IDS" "TARGET_GROUP_ARN" "AUTO_SCALING_GROUP_NAME" "LAUNCH_TEMPLATE_NAME")
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            echo -e "${RED}Error: $var must be set in deploy-multi.config${NC}"
            exit 1
        fi
    done
}

# Create launch template
create_launch_template() {
    echo -e "${BLUE}Creating launch template: $LAUNCH_TEMPLATE_NAME${NC}"

    # Create user data script for EC2 instances
    cat > /tmp/user-data.sh << 'EOF'
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

# Clone your repository (replace with your repo)
# git clone https://github.com/yourusername/verro.git .
# OR copy files via AWS Systems Manager or other method

# Create environment file
cat > .env << EOF
NODE_ENV=production
PORT=3000
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
JWT_SECRET=${JWT_SECRET}
FRONTEND_URL=${FRONTEND_URL}
AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
AWS_REGION=${AWS_REGION}
AWS_S3_BUCKET=${AWS_S3_BUCKET}
REDIS_HOST=localhost
REDIS_PORT=6379
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
EOF

    # Create launch template
    aws ec2 create-launch-template \
        --launch-template-name "$LAUNCH_TEMPLATE_NAME" \
        --launch-template-data "{
            \"ImageId\": \"$EC2_AMI_ID\",
            \"InstanceType\": \"$EC2_INSTANCE_TYPE\",
            \"KeyName\": \"$KEY_PAIR_NAME\",
            \"SecurityGroupIds\": [\"$SECURITY_GROUP_ID\"],
            \"UserData\": \"$(base64 -w 0 /tmp/user-data.sh)\",
            \"Monitoring\": {
                \"Enabled\": true
            },
            \"TagSpecifications\": [{
                \"ResourceType\": \"instance\",
                \"Tags\": [
                    {\"Key\": \"Name\", \"Value\": \"erato-backend\"},
                    {\"Key\": \"Environment\", \"Value\": \"production\"},
                    {\"Key\": \"Application\", \"Value\": \"erato\"}
                ]
            }]
        }" \
        --region "$AWS_REGION"

    echo -e "${GREEN}Launch template created successfully${NC}"
}

# Create auto scaling group
create_auto_scaling_group() {
    echo -e "${BLUE}Creating auto scaling group: $AUTO_SCALING_GROUP_NAME${NC}"

    # Get subnet IDs as array
    IFS=',' read -ra SUBNET_ARRAY <<< "$SUBNET_IDS"

    aws autoscaling create-auto-scaling-group \
        --auto-scaling-group-name "$AUTO_SCALING_GROUP_NAME" \
        --launch-template "LaunchTemplateName=$LAUNCH_TEMPLATE_NAME,Version=\$Latest" \
        --min-size 2 \
        --max-size 10 \
        --desired-capacity 3 \
        --target-group-arns "$TARGET_GROUP_ARN" \
        --vpc-zone-identifier "${SUBNET_ARRAY[0]}" \
        --health-check-type ELB \
        --health-check-grace-period 300 \
        --region "$AWS_REGION"

    echo -e "${GREEN}Auto scaling group created successfully${NC}"
}

# Set up scaling policies
setup_scaling_policies() {
    echo -e "${BLUE}Setting up scaling policies${NC}"

    # Scale out policy (increase instances)
    aws autoscaling put-scaling-policy \
        --auto-scaling-group-name "$AUTO_SCALING_GROUP_NAME" \
        --policy-name "erato-scale-out" \
        --scaling-adjustment 1 \
        --adjustment-type ChangeInCapacity \
        --cooldown 300 \
        --region "$AWS_REGION"

    # Scale in policy (decrease instances)
    aws autoscaling put-scaling-policy \
        --auto-scaling-group-name "$AUTO_SCALING_GROUP_NAME" \
        --policy-name "erato-scale-in" \
        --scaling-adjustment -1 \
        --adjustment-type ChangeInCapacity \
        --cooldown 300 \
        --region "$AWS_REGION"

    # CPU utilization alarm for scale out
    aws cloudwatch put-metric-alarm \
        --alarm-name "erato-high-cpu" \
        --alarm-description "Scale out when CPU > 70%" \
        --metric-name CPUUtilization \
        --namespace AWS/EC2 \
        --statistic Average \
        --period 300 \
        --threshold 70 \
        --comparison-operator GreaterThanThreshold \
        --dimensions Name=AutoScalingGroupName,Value="$AUTO_SCALING_GROUP_NAME" \
        --evaluation-periods 2 \
        --alarm-actions $(aws autoscaling describe-policies --auto-scaling-group-name "$AUTO_SCALING_GROUP_NAME" --policy-types SimpleScaling --query 'ScalingPolicies[?PolicyName==`erato-scale-out`].PolicyARN' --output text --region "$AWS_REGION") \
        --region "$AWS_REGION"

    # CPU utilization alarm for scale in
    aws cloudwatch put-metric-alarm \
        --alarm-name "erato-low-cpu" \
        --alarm-description "Scale in when CPU < 30%" \
        --metric-name CPUUtilization \
        --namespace AWS/EC2 \
        --statistic Average \
        --period 300 \
        --threshold 30 \
        --comparison-operator LessThanThreshold \
        --dimensions Name=AutoScalingGroupName,Value="$AUTO_SCALING_GROUP_NAME" \
        --evaluation-periods 2 \
        --alarm-actions $(aws autoscaling describe-policies --auto-scaling-group-name "$AUTO_SCALING_GROUP_NAME" --policy-types SimpleScaling --query 'ScalingPolicies[?PolicyName==`erato-scale-in`].PolicyARN' --output text --region "$AWS_REGION") \
        --region "$AWS_REGION"

    echo -e "${GREEN}Scaling policies configured successfully${NC}"
}

# Main deployment function
main() {
    echo -e "${BLUE}🚀 Starting multi-server EC2 deployment for Erato Backend${NC}"

    validate_config
    create_launch_template
    create_auto_scaling_group
    setup_scaling_policies

    echo -e "${GREEN}✅ Multi-server deployment completed successfully!${NC}"
    echo -e "${YELLOW}Your backend is now running on multiple EC2 instances with auto-scaling${NC}"
    echo -e "${YELLOW}Load balancer endpoint: $LOAD_BALANCER_DNS${NC}"
}

# Handle command line arguments
case "${1:-}" in
    "create")
        main
        ;;
    "update")
        echo -e "${BLUE}Updating existing deployment...${NC}"
        # Add update logic here
        ;;
    "destroy")
        echo -e "${RED}Destroying deployment...${NC}"
        aws autoscaling delete-auto-scaling-group \
            --auto-scaling-group-name "$AUTO_SCALING_GROUP_NAME" \
            --force-delete \
            --region "$AWS_REGION"
        aws ec2 delete-launch-template \
            --launch-template-name "$LAUNCH_TEMPLATE_NAME" \
            --region "$AWS_REGION"
        echo -e "${GREEN}Deployment destroyed${NC}"
        ;;
    *)
        echo "Usage: $0 {create|update|destroy}"
        echo "  create  - Create new multi-server deployment"
        echo "  update  - Update existing deployment"
        echo "  destroy - Destroy deployment"
        exit 1
        ;;
esac