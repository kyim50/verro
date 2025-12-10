# Deployment Configuration Setup

## Quick Start

1. Copy the example config file:
   ```bash
   cp deploy.config.example deploy.config
   ```

2. Edit `deploy.config` with your EC2 details:
   ```bash
   nano deploy.config  # or use your preferred editor
   ```

3. Fill in the required values:
   - `EC2_USER`: Usually `"ubuntu"`
   - `EC2_IP`: Your EC2 instance IP address
   - `EC2_KEY_PATH`: Path to your `.pem` SSH key file (optional, defaults to `~/.ssh/id_rsa`)

4. The `deploy.config` file is automatically gitignored and will NOT be committed to GitHub.

## Security

- ✅ `deploy.config` is in `.gitignore` - your sensitive info stays local
- ✅ Only `deploy.config.example` (template) is committed to git
- ✅ Your EC2 IP, SSH keys, and paths remain private

## Required Fields

- `EC2_USER`: SSH username (typically `"ubuntu"`)
- `EC2_IP`: Your EC2 instance IP address (e.g., `"3.18.213.189"`)

## Optional Fields

- `EC2_HOST`: Auto-generated as `${EC2_USER}@${EC2_IP}` if not set
- `EC2_KEY_PATH`: Path to SSH key (defaults to `~/.ssh/id_rsa` if not set)
- `PROJECT_PATH`: Project path on EC2 (auto-detected if not set)
- `COMPOSE_FILE`: Docker Compose file name (defaults to `"docker-compose.prod.yml"`)
- `HEALTH_CHECK_URL`: Auto-generated as `http://${EC2_IP}:3000/health` if not set
- `MAX_RETRIES`: Health check retry attempts (default: 30)
- `RETRY_DELAY`: Seconds between retries (default: 5)

## Usage

After setting up `deploy.config`, you can run the deployment scripts normally:

```bash
# Deploy with commit/push
./deploy-ec2.sh

# Deploy container only (assumes code already pushed)
./deploy-container.sh
```

The scripts will automatically load your configuration from `deploy.config`.

