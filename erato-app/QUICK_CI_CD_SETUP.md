# Quick CI/CD Setup (5 Minutes)

## Fast Setup Steps

### 1. Generate SSH Key (1 minute)
```bash
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions_deploy -N ""
```

### 2. Add Public Key to EC2 (1 minute)
```bash
# Replace with your actual key path and EC2 IP
cat ~/.ssh/github_actions_deploy.pub | ./ssh-ec2.sh "cat >> ~/.ssh/authorized_keys"
```

### 3. Add GitHub Secrets (2 minutes)

Go to: **GitHub Repo → Settings → Secrets and variables → Actions → New repository secret**

Add these 4 secrets:

| Secret Name | Value | How to Get |
|------------|-------|------------|
| `EC2_SSH_PRIVATE_KEY` | Private key content | `cat ~/.ssh/github_actions_deploy` |
| `EC2_IP` | Your EC2 IP | `3.18.213.189` |
| `EC2_USER` | EC2 username | `ubuntu` |
| `API_HEALTH_CHECK_URL` | Health check URL | `https://api.verrocio.com/health` |

### 4. Test It (1 minute)
```bash
# Make a small change and push
echo "# CI/CD Test" >> README.md
git add .github/workflows/
git commit -m "Add CI/CD automation"
git push origin main
```

Check **GitHub → Actions** tab to see it deploy! 🚀

## What Happens Now?

✅ **Every push to `main`** → Automatically deploys to EC2  
✅ **Every PR** → Runs CI checks (linting, security)  
✅ **No more manual deployment!**

## Need Help?

See `GITHUB_CI_CD_SETUP.md` for detailed instructions and troubleshooting.

