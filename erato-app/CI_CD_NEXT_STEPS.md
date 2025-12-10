# ✅ CI/CD Setup - Next Steps

## Step 1: ✅ Public Key Added to EC2
Done! Your GitHub Actions public key is now on EC2.

## Step 2: Add GitHub Secrets

Go to your GitHub repository:
**Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these 4 secrets:

### 1. `EC2_SSH_PRIVATE_KEY`
**Value:** The private key content (see command below to get it)

To get the private key, run this on your local machine:
```bash
cat ~/.ssh/github_actions_deploy
```

Copy the ENTIRE output, including:
- `-----BEGIN OPENSSH PRIVATE KEY-----`
- All the lines in between
- `-----END OPENSSH PRIVATE KEY-----`

### 2. `EC2_IP`
**Value:** `3.18.213.189`

### 3. `EC2_USER`
**Value:** `ubuntu`

### 4. `API_HEALTH_CHECK_URL`
**Value:** `https://api.verrocio.com/health`

*(Or use `http://3.18.213.189:3000/health` if domain not set up yet)*

## Step 3: Commit and Push Workflow Files

```bash
git add .github/workflows/
git commit -m "Add GitHub Actions CI/CD automation"
git push origin main
```

## Step 4: Watch It Deploy! 🚀

1. Go to **GitHub** → **Actions** tab
2. You should see "Deploy to EC2" workflow running
3. Click on it to see real-time deployment progress
4. It will:
   - ✅ Install dependencies
   - ✅ Run tests/checks
   - ✅ SSH into EC2
   - ✅ Pull latest code
   - ✅ Rebuild Docker container
   - ✅ Restart backend
   - ✅ Health check

## What Happens Now?

**Every time you push to `main` branch:**
- Automatically deploys to EC2
- No manual SSH needed!
- Deployment history in GitHub Actions

**On Pull Requests:**
- Runs CI checks only (no deployment)
- Validates code before merge

## Testing It

Make a small change to test:
```bash
echo "# Test CI/CD" >> README.md
git add .
git commit -m "Test automated deployment"
git push origin main
```

Watch it deploy automatically in GitHub Actions!

## Troubleshooting

If deployment fails:
1. Check **Actions** tab for error logs
2. Verify all 4 GitHub Secrets are set correctly
3. Check EC2 is running: `./ssh-ec2.sh "docker ps"`
4. Verify health check URL is accessible

---

**You're all set!** Just add the GitHub Secrets and push to main! 🎉

