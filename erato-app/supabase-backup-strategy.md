# Supabase Database Backup & High Availability Strategy

## Overview
This document outlines strategies for ensuring your Supabase database has reliable backups and high availability to prevent data loss and minimize downtime.

## Supabase's Built-in Features

### 1. Automatic Backups (Supabase Pro/Team Plans)
Supabase provides automatic daily backups with 7-day retention on Pro plans and 14-day retention on Team plans.

**Key Points:**
- Backups are taken daily at 00:00 UTC
- Point-in-time recovery available within retention period
- Backups stored securely in Supabase's infrastructure

### 2. Point-in-Time Recovery (PITR)
Available on Team plans, allows you to restore your database to any point in time within the last 7 days.

## Enhanced Backup Strategy

### 1. Automated Database Exports
Create automated scripts to export your database schema and data regularly.

```bash
#!/bin/bash
# supabase-backup.sh - Automated Supabase backup script

# Configuration
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_KEY="your-service-role-key"
BACKUP_DIR="/path/to/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "Starting Supabase backup at $TIMESTAMP"

# Export schema only
pg_dump "$SUPABASE_URL/postgres?sslmode=require" \
  -U postgres \
  -h db.your-project.supabase.co \
  -p 5432 \
  --schema-only \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  --verbose \
  --file="$BACKUP_DIR/schema_$TIMESTAMP.sql" \
  --dbname="postgres"

# Export data only (for large databases, consider table-specific exports)
pg_dump "$SUPABASE_URL/postgres?sslmode=require" \
  -U postgres \
  -h db.your-project.supabase.co \
  -p 5432 \
  --data-only \
  --no-owner \
  --no-privileges \
  --verbose \
  --file="$BACKUP_DIR/data_$TIMESTAMP.sql" \
  --dbname="postgres"

# Compress backups
gzip "$BACKUP_DIR/schema_$TIMESTAMP.sql"
gzip "$BACKUP_DIR/data_$TIMESTAMP.sql"

# Upload to S3 for long-term storage
aws s3 cp "$BACKUP_DIR/schema_$TIMESTAMP.sql.gz" s3://your-backup-bucket/supabase/schema/
aws s3 cp "$BACKUP_DIR/data_$TIMESTAMP.sql.gz" s3://your-backup-bucket/supabase/data/

# Clean up local files older than 30 days
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed successfully"
```

### 2. Continuous Data Protection with Read Replicas

#### Option A: Supabase Read Replicas (if available)
- Supabase offers read replicas for high-traffic applications
- Automatic failover in case of primary database issues

#### Option B: External Read Replicas
Set up your own PostgreSQL read replicas for additional protection:

```sql
-- Create publication on primary Supabase database
CREATE PUBLICATION erato_publication FOR ALL TABLES;

-- On replica database, create subscription
CREATE SUBSCRIPTION erato_subscription
    CONNECTION 'host=your-supabase-db-host port=5432 user=postgres dbname=postgres'
    PUBLICATION erato_publication;
```

### 3. Multi-Region Database Setup

For maximum availability, consider a multi-region setup:

#### Option 1: Supabase Multi-Region (Enterprise)
- Supabase Enterprise plans offer multi-region databases
- Automatic cross-region replication

#### Option 2: Database Migration Strategy
If you need to migrate regions:

```bash
#!/bin/bash
# migrate-supabase-region.sh

# Export from current region
pg_dump "postgresql://postgres:[SERVICE_KEY]@db.[PROJECT-REF].supabase.co:5432/postgres" \
  --format=custom \
  --compress=9 \
  --file=backup.dump \
  --verbose

# Create new project in target region via Supabase dashboard/API

# Restore to new region
pg_restore --verbose --clean --no-acl --no-owner \
  --host=db.[NEW-PROJECT-REF].supabase.co \
  --port=5432 \
  --username=postgres \
  --dbname=postgres \
  backup.dump
```

## High Availability Architecture

### 1. Database Connection Pooling
Use connection pooling to handle high traffic and provide automatic failover:

```javascript
// In your backend config/supabase.js
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.SUPABASE_URL,
  max: 20, // Maximum number of connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: {
    rejectUnauthorized: false
  }
});

// Health check function
export const checkDatabaseHealth = async () => {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
};
```

### 2. Circuit Breaker Pattern
Implement circuit breaker to handle database outages gracefully:

```javascript
// middleware/circuitBreaker.js
class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000, monitoringPeriod = 10000) {
    this.threshold = threshold;
    this.timeout = timeout;
    this.monitoringPeriod = monitoringPeriod;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
  }

  async execute(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
    }
  }
}

export const dbCircuitBreaker = new CircuitBreaker();
```

### 3. Database Failover Strategy

```javascript
// config/database.js
const databases = [
  {
    url: process.env.SUPABASE_URL,
    region: 'us-east-1',
    priority: 1
  },
  {
    url: process.env.SUPABASE_URL_SECONDARY, // If you have a secondary
    region: 'us-west-2',
    priority: 2
  }
];

class DatabaseFailover {
  constructor(databases) {
    this.databases = databases.sort((a, b) => a.priority - b.priority);
    this.currentIndex = 0;
    this.healthChecks = new Map();
  }

  async getHealthyDatabase() {
    for (let i = 0; i < this.databases.length; i++) {
      const db = this.databases[this.currentIndex];
      const isHealthy = await this.checkHealth(db);

      if (isHealthy) {
        return db;
      }

      // Move to next database
      this.currentIndex = (this.currentIndex + 1) % this.databases.length;
    }

    throw new Error('No healthy database available');
  }

  async checkHealth(database) {
    const cacheKey = `${database.url}-${database.region}`;
    const now = Date.now();
    const lastCheck = this.healthChecks.get(cacheKey);

    // Cache health checks for 30 seconds
    if (lastCheck && (now - lastCheck.timestamp) < 30000) {
      return lastCheck.healthy;
    }

    try {
      const response = await fetch(`${database.url}/health`, {
        timeout: 5000
      });
      const healthy = response.ok;
      this.healthChecks.set(cacheKey, { healthy, timestamp: now });
      return healthy;
    } catch (error) {
      this.healthChecks.set(cacheKey, { healthy: false, timestamp: now });
      return false;
    }
  }
}

export const dbFailover = new DatabaseFailover(databases);
```

## Monitoring & Alerting

### 1. Database Performance Monitoring
Set up monitoring for database performance metrics:

```javascript
// middleware/databaseMonitor.js
import { performance } from 'perf_hooks';

export const databaseMonitor = (req, res, next) => {
  const start = performance.now();

  // Monkey patch database operations to track performance
  const originalQuery = req.app.locals.supabase?.query;
  if (originalQuery) {
    req.app.locals.supabase.query = async (...args) => {
      const queryStart = performance.now();
      try {
        const result = await originalQuery.apply(this, args);
        const queryDuration = performance.now() - queryStart;

        // Log slow queries
        if (queryDuration > 1000) { // 1 second
          console.warn(`Slow query detected: ${queryDuration}ms`, args[0]);
        }

        return result;
      } catch (error) {
        console.error('Database query error:', error);
        throw error;
      }
    };
  }

  next();
};
```

### 2. Automated Alerting
Set up alerts for database issues:

- Database connection failures
- High query latency
- Disk space usage > 80%
- Replication lag (if using replicas)

## Disaster Recovery Plan

### 1. Recovery Time Objective (RTO) & Recovery Point Objective (RPO)
- **RTO**: Time to restore service (target: < 1 hour)
- **RPO**: Maximum data loss acceptable (target: < 5 minutes)

### 2. Disaster Recovery Steps

#### Automatic Failover:
1. Monitor database health every 30 seconds
2. If primary fails, automatically switch to replica
3. Update DNS/application config
4. Notify team via Slack/email

#### Manual Recovery:
1. Assess the failure
2. Choose appropriate backup (PITR vs. snapshot)
3. Restore to new Supabase project if needed
4. Update application configuration
5. Test thoroughly before going live

### 3. Regular DR Testing
- Monthly automated failover tests
- Quarterly full disaster recovery simulation
- Annual chaos engineering exercises

## Cost Optimization

### Supabase Plan Selection:
- **Pro Plan**: Basic backups, suitable for development/production
- **Team Plan**: PITR, better retention, higher availability
- **Enterprise**: Multi-region, custom SLAs, dedicated support

### Backup Storage Costs:
- S3 Glacier for long-term archival ($0.004/GB/month)
- Automated cleanup policies
- Compression to reduce storage costs

## Implementation Checklist

- [ ] Enable Supabase Pro/Team plan for automatic backups
- [ ] Set up automated export scripts
- [ ] Configure monitoring and alerting
- [ ] Implement circuit breaker pattern
- [ ] Set up database connection pooling
- [ ] Create disaster recovery runbook
- [ ] Test backup restoration process
- [ ] Schedule regular DR drills

This strategy ensures your Supabase database remains highly available with minimal data loss risk.