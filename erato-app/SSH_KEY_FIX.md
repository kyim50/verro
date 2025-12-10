# Quick Fix: SSH Key Passphrase Issue

## Problem
GitHub Actions is prompting for a passphrase because your SSH key has one set. CI/CD workflows cannot handle interactive prompts.

## Solution: Generate a New Key Without Passphrase

### Step 1: Generate New Key (No Passphrase)

```bash
# Generate new key WITHOUT passphrase
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions_deploy -N ""

# The -N "" flag ensures no passphrase is set
```

### Step 2: Add Public Key to EC2

```bash
# Copy the public key to your EC2 instance
cat ~/.ssh/github_actions_deploy.pub | ssh -i ~/.ssh/verro.pem ubuntu@YOUR_EC2_IP "cat >> ~/.ssh/authorized_keys"

# Replace YOUR_EC2_IP with your actual EC2 IP (e.g., 3.18.213.189)
```

### Step 3: Update GitHub Secret

1. Copy the private key:
   ```bash
   cat ~/.ssh/github_actions_deploy
   ```

2. Go to GitHub → Your Repository → **Settings** → **Secrets and variables** → **Actions**

3. Find `EC2_SSH_PRIVATE_KEY` and click **Update**

4. Paste the entire private key (including `-----BEGIN OPENSSH PRIVATE KEY-----` and `-----END OPENSSH PRIVATE KEY-----`)

5. Click **Update secret**

### Step 4: Verify

1. Make a small commit and push to trigger the workflow
2. Check the Actions tab - the SSH setup should now work without passphrase prompts

## Alternative: Remove Passphrase from Existing Key (Not Recommended)

If you want to keep using your existing key:

```bash
# Remove passphrase from existing key
ssh-keygen -p -f ~/.ssh/github_actions_deploy

# When prompted, press ENTER for new passphrase (leave empty)
# Re-enter by pressing ENTER again
```

Then update the GitHub secret with the updated private key.

