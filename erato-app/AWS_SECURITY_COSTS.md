# AWS Security & Cost Guide

## 🔒 Security Concerns

### **You DO need to be aware of security**

While AWS has good default security, you're still responsible for:

#### ✅ What AWS Handles:
- Physical infrastructure security
- Network DDoS protection (basic level)
- Compliance and data center security

#### ⚠️ What YOU Need to Handle:

1. **EC2 Instance Security:**
   - Keep your instance updated: `sudo apt update && sudo apt upgrade -y`
   - Use SSH keys (not passwords) - ✅ You're likely already doing this
   - Restrict SSH access to your IP in Security Groups (optional but recommended)

2. **Application Security:**
   - Keep dependencies updated
   - Don't expose sensitive data in logs
   - Use strong passwords in your `.env` files
   - Regular security patches for Node.js, Docker images

3. **Network Security:**
   - Only open necessary ports (22 for SSH, 3000 for API)
   - Don't expose database ports publicly
   - Use Security Groups properly ✅ (Redis is already localhost-only)

4. **Common Attack Vectors:**
   - **Brute force SSH attacks** - Use SSH keys (not passwords)
   - **DDoS attacks** - Free tier has limited protection, may need AWS Shield for serious protection
   - **Misconfigured Security Groups** - Make sure Redis (port 6379) isn't public ✅
   - **Unpatched vulnerabilities** - Keep system updated

### Quick Security Checklist:
- [ ] Use SSH keys (not password authentication)
- [ ] Only open necessary ports in Security Groups
- [ ] Keep system updated regularly
- [ ] Don't commit `.env` files to git ✅
- [ ] Use HTTPS in production (not just HTTP)
- [ ] Set up basic monitoring to detect anomalies

**Bottom line**: For testing with low traffic, your current setup is reasonably secure. For production with real users, prioritize HTTPS, monitoring, and regular updates.

---

## 💰 AWS Free Tier & Costs

### AWS Free Tier (First 12 Months)

#### EC2 Free Tier:
- **750 hours/month** of t2.micro or t3.micro instance time
- Your instance type: Check with `aws ec2 describe-instances` or AWS Console
- **If you're using t2.micro/t3.micro**: Free for 750 hours/month (essentially one instance running 24/7)
- **If you're using a larger instance**: You'll pay the difference

#### What's Always Free:
- Data transfer OUT: **100 GB/month** (after that, ~$0.09/GB)
- Data transfer IN: Free
- Elastic IP: Free if attached to running instance

### 💵 Cost Breakdown (After Free Tier or If You Exceed)

#### **Current Setup Estimate:**

**Per Month:**
- **EC2 t2.micro instance**: ~$7-9/month (if free tier expires)
- **EC2 t3.micro instance**: ~$7-9/month (if free tier expires)
- **EBS Storage (8GB free, 30GB standard)**: 
  - First 30GB: Free
  - Additional: ~$0.10/GB/month
- **Data Transfer OUT**:
  - First 100GB: Free
  - 100GB - 1TB: ~$0.09/GB (~$9 per 100GB extra)
- **Elastic IP**: Free if instance is running

#### **Realistic Monthly Cost Estimate:**

**During Free Tier (First 12 Months):**
- **$0/month** if:
  - Using t2.micro or t3.micro ✅
  - Stay under 750 hours/month (one instance = ~720 hours/month) ✅
  - Data transfer under 100GB/month ✅
  - Storage under 30GB ✅

**After Free Tier Expires:**
- **Minimum: ~$7-9/month** (just the instance)
- **With moderate usage (500GB data transfer): ~$45-50/month**
- **With high usage (1TB+ data transfer): $100+/month**

#### **Cost Scenarios:**

1. **Current Testing Setup:**
   - EC2 t2.micro: $0 (free tier)
   - Data transfer (low): $0 (under 100GB)
   - **Total: $0/month** ✅

2. **After Free Tier (Light Production):**
   - EC2 t2.micro: $8/month
   - Data transfer (200GB): ~$9/month (100GB free + 100GB paid)
   - **Total: ~$17/month**

3. **After Free Tier (Moderate Production):**
   - EC2 t3.micro: $9/month
   - Data transfer (500GB): ~$36/month
   - **Total: ~$45/month**

4. **After Free Tier (High Traffic):**
   - EC2 t3.micro: $9/month
   - Data transfer (1TB): ~$81/month
   - **Total: ~$90/month**

### 🎯 Cost Optimization Tips

1. **Use Reserved Instances** (if committing for 1-3 years):
   - Can save 30-60% vs On-Demand pricing
   - Only if you're certain you'll run for a year+

2. **Monitor Data Transfer:**
   - Use CloudWatch to track data usage
   - Optimize API responses (compression is already enabled ✅)
   - Consider CloudFront CDN for static assets (has free tier too)

3. **Stop Instance When Not Needed:**
   - If testing, stop the instance when not in use
   - You'll only pay for EBS storage (~$1/month for 30GB)

4. **Use Spot Instances** (for non-critical workloads):
   - Can save 70-90% but can be terminated with short notice
   - Not recommended for production

### 📊 How to Monitor Costs

1. **Set Up Billing Alerts:**
   ```
   AWS Console → Billing → Budgets → Create Budget
   ```
   - Set alert at $10, $25, $50 thresholds

2. **Check Current Usage:**
   ```
   AWS Console → Cost Explorer
   ```
   - View current month's charges
   - Check if you're within free tier

3. **Check Instance Type:**
   ```bash
   # On EC2 instance
   curl -s http://169.254.169.254/latest/meta-data/instance-type
   ```
   Or in AWS Console: EC2 → Instances → Select instance → Details tab

### 🚨 Important Notes

1. **Free Tier Expiration:**
   - Starts from when you create your AWS account
   - Valid for 12 months
   - After that, charges apply immediately

2. **Data Transfer Costs:**
   - Transfer TO AWS is free
   - Transfer OUT costs money after 100GB
   - Inter-AZ (different regions) also costs

3. **Storage Costs:**
   - EBS volumes persist even if instance is stopped
   - Snapshots cost extra (~$0.05/GB/month)

4. **Unexpected Charges:**
   - Elastic IP not attached to instance: ~$0.005/hour
   - Snapshots: ~$0.05/GB/month
   - Load balancers: ~$16-22/month (not using ✅)

### 💡 Recommended Setup

For your current testing/staging:
- **Keep using free tier** ✅
- **Set billing alerts** at $10, $25
- **Monitor data transfer** in AWS Console
- **Stop instance** when not actively testing to save hours

For production (when ready):
- **Upgrade to t3.small** if you need more CPU/memory (~$15/month)
- **Set up CloudFront** for CDN (has free tier, reduces data transfer costs)
- **Use Reserved Instance** if committed for 1+ year
- **Set strict billing alerts** ($50, $100, $200)

---

## 📝 Summary

### Security:
- **For testing**: Current setup is reasonably secure
- **Take basic precautions**: SSH keys, keep updated, monitor logs
- **For production**: Add HTTPS, better monitoring, regular security audits

### Costs:
- **Current (Free Tier)**: **$0/month** ✅
- **After Free Tier (Light usage)**: **~$15-20/month**
- **After Free Tier (Moderate)**: **~$40-50/month**
- **After Free Tier (High traffic)**: **$100+/month**

**Action Items:**
1. Set up billing alerts in AWS Console
2. Check your instance type (make sure it's t2.micro or t3.micro)
3. Monitor data transfer usage monthly
4. Consider stopping instance when not testing to save free tier hours

---

**You're safe for now with free tier, but set up those billing alerts to avoid surprises!** 🎯


