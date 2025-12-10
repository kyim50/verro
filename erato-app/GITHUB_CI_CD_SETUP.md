# GitHub Actions CI/CD Setup Guide

This guide will help you set up automated deployments and CI checks using GitHub Actions.

## 🎯 What This Does

### CI (Continuous Integration) - Runs on Every Push/PR
- ✅ Lints backend code
- ✅ Checks for security vulnerabilities
- ✅ Validates package.json and config files
- ✅ Runs tests (if configured)

### CD (Continuous Deployment) - Runs on Push to Main
- ✅ Automatically pulls latest code
- ✅ Rebuilds Docker container
- ✅ Restarts backend service
- ✅ Health checks to verify deployment

## 🔧 Setup Instructions

### Step 1: Generate SSH Key Pair for GitHub Actions

On your local machine, generate a dedicated SSH key for GitHub Actions:

```bash
# Generate new SSH key (don't use your existing one)
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions_deploy

# This creates:
# ~/.ssh/github_actions_deploy (private key - goes to GitHub Secrets)
# ~/.ssh/github_actions_deploy.pub (public key - goes to EC2)
```

### Step 2: Add Public Key to EC2

```bash
# Copy the public key to EC2
cat ~/.ssh/github_actions_deploy.pub | ssh -i ~/.ssh/verro.pem ubuntu@3.18.213.189 "cat >> ~/.ssh/authorized_keys"

# Or manually:
# 1. Copy contents of ~/.ssh/github_actions_deploy.pub
# 2. SSH into EC2
# 3. Run: nano ~/.ssh/authorized_keys
# 4. Paste the key at the end
# 5. Save and exit
```

### Step 3: Add GitHub Secrets

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**

Add these secrets:

1. **`EC2_SSH_PRIVATE_KEY`**
   - Value: Contents of `~/.ssh/github_actions_deploy` (the private key)
   - How to get:
     ```bash
     cat ~/.ssh/github_actions_deploy
     ```
   - Copy the entire output including `-----BEGIN OPENSSH PRIVATE KEY-----` and `-----END OPENSSH PRIVATE KEY-----`

2. **`EC2_IP`**
   - Value: Your EC2 instance IP (e.g., `3.18.213.189`)

3. **`EC2_USER`**
   - Value: `ubuntu` (or your EC2 username)

4. **`API_HEALTH_CHECK_URL`**
   - Value: `https://api.verrocio.com/health` (or `http://YOUR_IP:3000/health` if domain not set up yet)

### Step 4: Verify Setup

1. Make a small change to your code
2. Commit and push to `main` branch:
   ```bash
   git add .
   git commit -m "Test CI/CD pipeline"
   git push origin main
   ```
3. Go to GitHub → **Actions** tab
4. Watch the workflow run!

## 📋 How It Works

### On Push to Main Branch:
1. ✅ Code is checked out
2. ✅ Dependencies installed
3. ✅ Tests/security checks run (non-blocking)
4. ✅ SSH into EC2
5. ✅ Pull latest code from GitHub
6. ✅ Rebuild Docker container
7. ✅ Restart backend service
8. ✅ Health check verifies deployment
9. ✅ Deployment summary posted

### On Pull Requests:
- Only runs CI checks (no deployment)
- Validates code before merge

## 🔒 Security Best Practices

1. **Never commit private keys to git** ✅ (already in `.gitignore`)
2. **Use GitHub Secrets** ✅ (encrypted, only accessible to workflows)
3. **Dedicated SSH key** ✅ (separate from your personal key)
4. **Limit SSH key permissions** (optional but recommended):
   ```bash
   # On EC2, you can restrict the key to only run specific commands
   # by adding to ~/.ssh/authorized_keys:
   command="cd ~/erato-app && git pull" ssh-ed25519 ... github-actions-deploy
   ```

## 🛠️ Customization

### Add Email Notifications

Edit `.github/workflows/deploy.yml` and add after the `deploy` job:

```yaml
      - name: Send email on failure
        if: failure()
        uses: dawidd6/action-send-mail@v3
        with:
          server_address: smtp.gmail.com
          server_port: 465
          username: ${{ secrets.EMAIL_USERNAME }}
          password: ${{ secrets.EMAIL_PASSWORD }}
          subject: Deployment Failed
          to: your-email@example.com
          from: GitHub Actions
          body: Deployment failed for commit ${{ github.sha }}
```

### Add Slack Notifications

```yaml
      - name: Notify Slack
        uses: slackapi/slack-github-action@v1
        with:
          webhook-url: ${{ secrets.SLACK_WEBHOOK }}
          payload: |
            {
              "text": "Deployment ${{ job.status }}: ${{ github.sha }}"
            }
```

### Run Tests Before Deploy

Edit the workflow to fail on test failures:

```yaml
      - name: Run backend tests
        working-directory: ./backend
        run: npm test  # Remove continue-on-error if you want to block deployment on test failures
```

## 📊 Monitoring

- **View workflow runs**: GitHub → Actions tab
- **Check logs**: Click on any workflow run to see detailed logs
- **Deployment history**: All deployments are logged in Actions tab

## 🐛 Troubleshooting

### "Permission denied (publickey)"
- Check that `EC2_SSH_PRIVATE_KEY` secret is set correctly
- Verify public key is in EC2's `~/.ssh/authorized_keys`
- Make sure private key includes headers (`-----BEGIN...`)

### "Connection refused"
- Check EC2 security group allows SSH from GitHub Actions IPs
- Verify EC2 is running
- Check SSH key permissions: `chmod 600 ~/.ssh/github_actions_deploy`

### "Health check failed"
- Backend might not be starting correctly
- Check Docker logs: `docker logs erato-backend-prod`
- Verify health check URL is correct
- Check if port 3000 is accessible

### Workflow not triggering
- Make sure workflow files are in `.github/workflows/` directory
- Check branch name matches (default is `main`)
- Verify files are committed to git (not just staged)

## ✅ Verification Checklist

- [ ] SSH key pair generated
- [ ] Public key added to EC2 `~/.ssh/authorized_keys`
- [ ] All GitHub Secrets configured
- [ ] Workflow files committed to repository
- [ ] Pushed to main branch
- [ ] Workflow appears in Actions tab
- [ ] Deployment succeeds
- [ ] Health check passes

## 🚀 Next Steps

Once CI/CD is working:

1. **Add branch protection** (GitHub → Settings → Branches):
   - Require status checks to pass
   - Require PR reviews
   - Prevent force push

2. **Set up staging environment**:
   - Create `staging` branch
   - Add workflow for staging deployments
   - Test on staging before merging to main

3. **Add monitoring**:
   - Set up error tracking (Sentry)
   - Uptime monitoring (UptimeRobot)
   - Performance monitoring

---

**Your deployments are now fully automated!** 🎉

Just push to main and GitHub will handle the rest.

