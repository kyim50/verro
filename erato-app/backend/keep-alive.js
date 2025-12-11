#!/usr/bin/env node

/**
 * Simple keep-alive script to ping your Render API every 10 minutes
 * This prevents the service from spinning down due to inactivity
 * 
 * Usage: node keep-alive.js
 * 
 * Note: This only works while your computer is running.
 * For 24/7 coverage, use UptimeRobot (see KEEP_ALIVE_SETUP.md)
 */

const https = require('https');

const API_URL = 'https://verro.onrender.com/health';
const PING_INTERVAL = 10 * 60 * 1000; // 10 minutes

function ping() {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] Pinging ${API_URL}...`);
  
  https.get(API_URL, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        console.log(`[${new Date().toLocaleTimeString()}] ✅ Success - Status: ${res.statusCode}, Response: ${response.status}`);
      } catch (e) {
        console.log(`[${new Date().toLocaleTimeString()}] ✅ Success - Status: ${res.statusCode}`);
      }
    });
  }).on('error', (err) => {
    console.error(`[${new Date().toLocaleTimeString()}] ❌ Error: ${err.message}`);
  });
}

console.log('🚀 Keep-Alive Script Started');
console.log(`📡 Pinging ${API_URL} every 10 minutes`);
console.log('💡 Press Ctrl+C to stop\n');

// Ping immediately
ping();

// Then ping every 10 minutes
const interval = setInterval(ping, PING_INTERVAL);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Stopping keep-alive script...');
  clearInterval(interval);
  process.exit(0);
});




