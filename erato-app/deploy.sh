#!/bin/bash

# Erato Backend Deployment Script
# Supports both local deployment and CI/CD pipeline usage

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENVIRONMENT="${ENVIRONMENT:-production}"
DOCKER_IMAGE="${DOCKER_IMAGE:-ghcr.io/yourusername/verro/erato-backend:latest}"

# Load environment-specific configuration
CONFIG_FILE="$SCRIPT_DIR/deploy-$ENVIRONMENT.config"
if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
else
    echo -e "${YELLOW}Warning: $CONFIG_FILE not found, using environment variables${NC}"
fi

# Default values
AWS_REGION="${AWS_REGION:-us-east-1}"
AUTO_SCALING_GROUP="${AUTO_SCALING_GROUP:-erato-backend-asg}"
LOAD_BALANCER_DNS="${LOAD_BALANCER_DNS:-erato-backend-alb-123456789.us-east-1.elb.amazonaws.com}"
HEALTH_CHECK_TIMEOUT="${HEALTH_CHECK_TIMEOUT:-300}"

# Functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}"
}

# Validate prerequisites
validate_prerequisites() {
    log "Validating prerequisites..."

    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        error "AWS CLI is not installed"
        exit 1
    fi

    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        error "AWS credentials are not configured"
        exit 1
    fi

    # Check Docker (for local builds)
    if [ "$BUILD_LOCAL" = "true" ] && ! command -v docker &> /dev/null; then
        error "Docker is not installed"
        exit 1
    fi

    success "Prerequisites validated"
}

# Build Docker image locally (optional)
build_image() {
    if [ "$BUILD_LOCAL" = "true" ]; then
        log "Building Docker image locally..."
        cd "$SCRIPT_DIR/backend"
        docker build -t "$DOCKER_IMAGE" .
        success "Docker image built locally"
    fi
}

# Push image to registry
push_image() {
    if [ "$BUILD_LOCAL" = "true" ]; then
        log "Pushing Docker image to registry..."
        docker push "$DOCKER_IMAGE"
        success "Docker image pushed"
    fi
}

# Update SSM parameters with new image tag
update_ssm_parameters() {
    log "Updating SSM parameters..."

    # Store current tag as previous for rollback
    CURRENT_TAG=$(aws ssm get-parameter \
        --name "/erato/$ENVIRONMENT/image-tag" \
        --query 'Parameter.Value' \
        --output text 2>/dev/null || echo "")

    if [ -n "$CURRENT_TAG" ]; then
        aws ssm put-parameter \
            --name "/erato/$ENVIRONMENT/previous-image-tag" \
            --value "$CURRENT_TAG" \
            --type "String" \
            --overwrite
    fi

    # Update current tag
    aws ssm put-parameter \
        --name "/erato/$ENVIRONMENT/image-tag" \
        --value "$DOCKER_IMAGE" \
        --type "String" \
        --overwrite

    success "SSM parameters updated"
}

# Deploy to EC2 instances via AWS Systems Manager
deploy_to_instances() {
    log "Deploying to EC2 instances..."

    # Get instance IDs from Auto Scaling Group
    INSTANCE_IDS=$(aws autoscaling describe-auto-scaling-groups \
        --auto-scaling-group-names "$AUTO_SCALING_GROUP" \
        --query 'AutoScalingGroups[0].Instances[].InstanceId' \
        --output text)

    if [ -z "$INSTANCE_IDS" ]; then
        error "No instances found in Auto Scaling Group: $AUTO_SCALING_GROUP"
        exit 1
    fi

    log "Found instances: $INSTANCE_IDS"

    # Create deployment script
    cat > /tmp/deploy-script.sh << 'EOF'
#!/bin/bash
set -e

# Get image tag from SSM
IMAGE_TAG=$(aws ssm get-parameter \
    --name "/erato/'$ENVIRONMENT'/image-tag" \
    --query 'Parameter.Value' \
    --output text)

# Update docker-compose.yml with new image
cat > docker-compose.yml << EOF
version: '3.8'

services:
  backend:
    image: $IMAGE_TAG
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV='$ENVIRONMENT'
    env_file:
      - .env
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  redis-data:
EOF

# Pull new images
docker-compose pull

# Deploy with zero downtime
docker-compose up -d

# Wait for health check
sleep 30

# Verify deployment
if curl -f http://localhost:3000/health; then
    echo "Deployment successful"
    exit 0
else
    echo "Deployment failed - health check failed"
    exit 1
fi
EOF

    # Make script executable
    chmod +x /tmp/deploy-script.sh

    # Send deployment command to instances
    COMMAND_ID=$(aws ssm send-command \
        --document-name "AWS-RunShellScript" \
        --instance-ids $INSTANCE_IDS \
        --parameters '{"commands":["cd /home/ec2-user/erato-app && bash /tmp/deploy-script.sh"], "executionTimeout":["600"]}' \
        --query 'Command.CommandId' \
        --output text)

    log "Deployment command sent. Command ID: $COMMAND_ID"

    # Wait for deployment to complete
    log "Waiting for deployment to complete..."
    aws ssm wait command-executed \
        --command-id "$COMMAND_ID" \
        --instance-id "$(echo $INSTANCE_IDS | awk '{print $1}')"

    # Check deployment status
    SUCCESS_COUNT=$(aws ssm get-command-invocation \
        --command-id "$COMMAND_ID" \
        --instance-id "$(echo $INSTANCE_IDS | awk '{print $1}')" \
        --query 'Status' \
        --output text)

    if [ "$SUCCESS_COUNT" != "Success" ]; then
        error "Deployment failed. Check AWS Systems Manager for details."
        exit 1
    fi

    success "Deployment completed successfully"
}

# Health check after deployment
health_check() {
    log "Performing health checks..."

    local start_time=$(date +%s)
    local end_time=$((start_time + HEALTH_CHECK_TIMEOUT))

    while [ $(date +%s) -lt $end_time ]; do
        if curl -f -s "http://$LOAD_BALANCER_DNS/health" > /dev/null; then
            success "Health check passed"
            return 0
        fi

        log "Health check failed, retrying in 10 seconds..."
        sleep 10
    done

    error "Health check failed after $HEALTH_CHECK_TIMEOUT seconds"
    exit 1
}

# Rollback deployment
rollback() {
    log "Rolling back deployment..."

    # Get previous image tag
    PREVIOUS_TAG=$(aws ssm get-parameter \
        --name "/erato/$ENVIRONMENT/previous-image-tag" \
        --query 'Parameter.Value' \
        --output text 2>/dev/null)

    if [ -z "$PREVIOUS_TAG" ]; then
        error "No previous version found for rollback"
        exit 1
    fi

    # Update current tag to previous version
    aws ssm put-parameter \
        --name "/erato/$ENVIRONMENT/image-tag" \
        --value "$PREVIOUS_TAG" \
        --type "String" \
        --overwrite

    # Deploy previous version
    deploy_to_instances
    health_check

    success "Rollback completed successfully"
}

# Main deployment function
main() {
    log "🚀 Starting Erato Backend deployment to $ENVIRONMENT environment"
    log "Docker Image: $DOCKER_IMAGE"

    validate_prerequisites

    case "${1:-deploy}" in
        "deploy")
            build_image
            push_image
            update_ssm_parameters
            deploy_to_instances
            health_check
            success "✅ Deployment completed successfully!"
            ;;
        "rollback")
            rollback
            success "✅ Rollback completed successfully!"
            ;;
        "health-check")
            health_check
            ;;
        *)
            echo "Usage: $0 {deploy|rollback|health-check}"
            exit 1
            ;;
    esac
}

# Handle command line arguments
case "${1:-}" in
    "deploy"|"rollback"|"health-check")
        main "$1"
        ;;
    *)
        main
        ;;
esac