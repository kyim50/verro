# GitHub Actions IP Ranges for EC2 Security Group

## Quick Answer: Which IPs Should I Add?

**For most cases, just allow SSH from anywhere (`0.0.0.0/0`)** - This is the simplest solution because:
1. Your SSH key is still required (provides authentication)
2. GitHub's IP ranges change frequently (hundreds of them!)
3. Managing all IP ranges is complex and error-prone

**However**, if you want to be more secure, you can add just the `actions` IP ranges from GitHub's API.

## Option 1: Allow All IPs (Recommended for Now)

## Option 1: Allow All IPs (Recommended for Now)

1. Go to **AWS Console** → **EC2** → **Security Groups**
2. Select your EC2 instance's security group
3. Click **Edit inbound rules**
4. Add/edit SSH rule:
   - **Type**: SSH
   - **Protocol**: TCP
   - **Port**: 22
   - **Source**: `0.0.0.0/0` (or `::/0` for IPv6)
5. Click **Save rules**

⚠️ **Security Note**: While this allows SSH from any IP, your SSH key authentication still protects access. For better security later, you can restrict this.

## Option 2: Add GitHub IP Ranges (More Secure)

### Get GitHub IP Ranges

Run this command to see all GitHub IP ranges:

```bash
curl https://api.github.com/meta | jq
```

Or view in browser: https://api.github.com/meta

### Which IPs to Add

You need to add these from the GitHub meta API:

1. **`actions`** - IPs used by GitHub Actions
2. **`web`** - IPs used by GitHub web hooks
3. **`api`** - IPs used by GitHub API (may include Actions)

### Fetch and Display GitHub Actions IPs

```bash
# Install jq if you don't have it (Mac)
brew install jq

# Fetch and show Actions IPs
curl -s https://api.github.com/meta | jq '.actions[]'

# Show all IP ranges in a format you can copy
curl -s https://api.github.com/meta | jq -r '.actions[]' | while read ip; do
  echo "SSH - Port 22 - $ip"
done
```

### Add IPs to Security Group Manually

1. Go to **AWS Console** → **EC2** → **Security Groups**
2. Select your security group
3. Click **Edit inbound rules**
4. For each GitHub IP range:
   - Click **Add rule**
   - **Type**: SSH
   - **Port**: 22
   - **Source**: Paste the IP range (e.g., `192.30.252.0/22`)

### Or Use AWS CLI (Automated)

```bash
# Install AWS CLI if needed
# Configure with: aws configure

# Fetch GitHub IPs and add to security group
SECURITY_GROUP_ID="sg-xxxxxxxxx"  # Replace with your security group ID

curl -s https://api.github.com/meta | jq -r '.actions[]' | while read ip; do
  aws ec2 authorize-security-group-ingress \
    --group-id $SECURITY_GROUP_ID \
    --protocol tcp \
    --port 22 \
    --cidr $ip \
    --region us-east-1  # Change to your region
  echo "Added: $ip"
done
```

## Option 3: Use AWS Secrets Manager + IP Whitelisting Script

You could create a script that runs periodically to update your security group with latest GitHub IPs, but this is overkill for most use cases.

## Recommendation

**For now, use Option 1** (`0.0.0.0/0`). Your SSH key authentication provides security, and you can lock it down later if needed.

## Verify It Works

After adding the rules, test the GitHub Actions workflow. The connection test step will tell you if it works!

## Find Your Security Group ID

```bash
# Via AWS CLI
aws ec2 describe-instances --instance-ids i-xxxxxxxxx | jq '.Reservations[].Instances[].SecurityGroups[].GroupId'

# Or check in AWS Console:
# EC2 → Instances → Your instance → Security tab
```

