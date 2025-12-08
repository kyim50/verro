# Keep Your Render Service Awake (Free Solution)

Your Render service spins down after **15 minutes of inactivity**. This guide shows you how to keep it awake using free tools.

---

## 🎯 Quick Solution: Use UptimeRobot (Recommended - FREE)

### Step 1: Create Free Account
1. Go to https://uptimerobot.com/
2. Sign up for free account (50 monitors free!)

### Step 2: Add Monitor
1. Click **"Add New Monitor"**
2. Select **Monitor Type**: `HTTP(s)`
3. **Friendly Name**: `Verro API Keep Alive`
4. **URL (or IP)**: `https://verro.onrender.com/health`
5. **Monitoring Interval**: `5 minutes` (this will ping every 5 min, keeping it awake)
6. Click **"Create Monitor"**

That's it! UptimeRobot will ping your API every 5 minutes, keeping it awake 24/7. ✅

---

## 🎯 Alternative: Use cron-job.org (Also FREE)

### Step 1: Create Account
1. Go to https://cron-job.org/
2. Sign up (free account allows 3 cron jobs)

### Step 2: Create Cron Job
1. Click **"Create cronjob"**
2. **Title**: `Verro API Keep Alive`
3. **Address**: `https://verro.onrender.com/health`
4. **Schedule**: 
   - Select **"Execute every"** 
   - Choose **10 minutes**
5. Click **"Create cronjob"**

---

## 🎯 Option 3: Run Locally (While Your Computer is On)

If you want to keep it awake while you're actively developing:

```bash
# Install node-cron (one time)
npm install -g node-cron

# Create a simple ping script
```

Create file: `keep-alive.js` in your project root:

```javascript
const https = require('https');

function ping() {
  const url = 'https://verro.onrender.com/health';
  console.log(`[${new Date().toLocaleTimeString()}] Pinging ${url}...`);
  
  https.get(url, (res) => {
    console.log(`[${new Date().toLocaleTimeString()}] ✅ Status: ${res.statusCode}`);
  }).on('error', (err) => {
    console.error(`[${new Date().toLocaleTimeString()}] ❌ Error: ${err.message}`);
  });
}

// Ping immediately
ping();

// Then ping every 10 minutes
setInterval(ping, 10 * 60 * 1000);
```

Run it:
```bash
node keep-alive.js
```

**Note**: This only works while your computer is running. Use UptimeRobot for 24/7 coverage.

---

## ✅ Verify It's Working

1. Wait 15+ minutes
2. Make a request to your API
3. It should respond immediately (no cold start delay)

---

## 🎯 Why Your Service Slept During Testing

Even if you were "actively testing," if there was a **15+ minute gap** between API calls, Render spun it down. For example:
- You tested at 10:00 AM
- Then went to lunch
- Came back at 10:20 AM
- Service was asleep → cold start delay

The ping solution keeps it awake even during gaps!

---

## 💡 Pro Tip

Use **UptimeRobot** (Option 1) - it's free, reliable, and works 24/7 even when you're not developing!

