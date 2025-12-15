// middleware/monitoring.js - Application Performance Monitoring
import { performance } from 'perf_hooks';
import os from 'os';
import { createLogger, transports, format } from 'winston';
import 'winston-daily-rotate-file';

// Custom metrics collector
class MetricsCollector {
  constructor() {
    this.metrics = {
      httpRequestsTotal: 0,
      httpRequestsDuration: [],
      activeConnections: 0,
      databaseQueriesTotal: 0,
      databaseQueryDuration: [],
      cacheHits: 0,
      cacheMisses: 0,
      errorsTotal: 0,
      memoryUsage: [],
      cpuUsage: []
    };

    // Collect system metrics every 30 seconds
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);
  }

  incrementHttpRequests(method, statusCode) {
    this.metrics.httpRequestsTotal++;
    // Could send to CloudWatch or monitoring service
  }

  recordHttpDuration(duration) {
    this.metrics.httpRequestsDuration.push(duration);
    // Keep only last 1000 measurements
    if (this.metrics.httpRequestsDuration.length > 1000) {
      this.metrics.httpRequestsDuration.shift();
    }
  }

  incrementActiveConnections() {
    this.metrics.activeConnections++;
  }

  decrementActiveConnections() {
    this.metrics.activeConnections = Math.max(0, this.metrics.activeConnections - 1);
  }

  incrementDatabaseQueries() {
    this.metrics.databaseQueriesTotal++;
  }

  recordDatabaseQueryDuration(duration) {
    this.metrics.databaseQueryDuration.push(duration);
    if (this.metrics.databaseQueryDuration.length > 1000) {
      this.metrics.databaseQueryDuration.shift();
    }
  }

  incrementCacheHit() {
    this.metrics.cacheHits++;
  }

  incrementCacheMiss() {
    this.metrics.cacheMisses++;
  }

  incrementError() {
    this.metrics.errorsTotal++;
  }

  collectSystemMetrics() {
    // Memory usage
    const memUsage = process.memoryUsage();
    this.metrics.memoryUsage.push({
      rss: memUsage.rss,
      heapTotal: memUsage.heapTotal,
      heapUsed: memUsage.heapUsed,
      external: memUsage.external,
      timestamp: Date.now()
    });

    // CPU usage
    const cpuUsage = process.cpuUsage();
    this.metrics.cpuUsage.push({
      user: cpuUsage.user,
      system: cpuUsage.system,
      timestamp: Date.now()
    });

    // Keep only last 100 measurements
    if (this.metrics.memoryUsage.length > 100) {
      this.metrics.memoryUsage.shift();
    }
    if (this.metrics.cpuUsage.length > 100) {
      this.metrics.cpuUsage.shift();
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem()
    };
  }

  getHealthStatus() {
    const metrics = this.getMetrics();
    const avgResponseTime = metrics.httpRequestsDuration.length > 0
      ? metrics.httpRequestsDuration.reduce((a, b) => a + b, 0) / metrics.httpRequestsDuration.length
      : 0;

    const memoryUsagePercent = (metrics.memoryUsage[metrics.memoryUsage.length - 1]?.heapUsed / metrics.totalMemory) * 100 || 0;

    return {
      status: 'healthy', // Could be 'healthy', 'warning', 'critical'
      timestamp: new Date().toISOString(),
      uptime: metrics.uptime,
      memoryUsage: memoryUsagePercent,
      averageResponseTime: avgResponseTime,
      activeConnections: metrics.activeConnections,
      totalRequests: metrics.httpRequestsTotal,
      errorRate: metrics.httpRequestsTotal > 0 ? (metrics.errorsTotal / metrics.httpRequestsTotal) * 100 : 0,
      cacheHitRate: (metrics.cacheHits + metrics.cacheMisses) > 0
        ? (metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)) * 100
        : 0
    };
  }
}

// Global metrics collector
export const metricsCollector = new MetricsCollector();

// Winston logger with CloudWatch integration
export const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: { service: 'erato-backend' },
  transports: [
    // Console logging for development
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    }),

    // Daily rotating file for application logs
    new transports.DailyRotateFile({
      filename: 'logs/application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      format: format.combine(
        format.timestamp(),
        format.json()
      )
    }),

    // Separate error log
    new transports.DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '30d',
      format: format.combine(
        format.timestamp(),
        format.json()
      )
    })
  ]
});

// Performance monitoring middleware
export const performanceMonitor = (req, res, next) => {
  const start = performance.now();
  const startTime = Date.now();

  // Track active connections
  metricsCollector.incrementActiveConnections();

  // Log request start
  logger.info('Request started', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.id || Math.random().toString(36).substr(2, 9)
  });

  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = performance.now() - start;

    // Record metrics
    metricsCollector.recordHttpDuration(duration);
    metricsCollector.incrementHttpRequests(req.method, res.statusCode);
    metricsCollector.decrementActiveConnections();

    // Log request completion
    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration.toFixed(2)}ms`,
      contentLength: res.get('Content-Length'),
      requestId: req.id || 'unknown'
    });

    // Log slow requests
    if (duration > 5000) { // 5 seconds
      logger.warn('Slow request detected', {
        method: req.method,
        url: req.url,
        duration: `${duration.toFixed(2)}ms`,
        statusCode: res.statusCode
      });
    }

    // Call original end
    originalEnd.apply(this, args);
  };

  next();
};

// Error monitoring middleware
export const errorMonitor = (err, req, res, next) => {
  metricsCollector.incrementError();

  logger.error('Application error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userId: req.user?.id,
    requestId: req.id || 'unknown'
  });

  next(err);
};

// Database query monitoring
export const databaseMonitor = (query, duration) => {
  metricsCollector.incrementDatabaseQueries();
  metricsCollector.recordDatabaseQueryDuration(duration);

  // Log slow queries
  if (duration > 1000) { // 1 second
    logger.warn('Slow database query', {
      query: query.substring(0, 500), // Truncate long queries
      duration: `${duration.toFixed(2)}ms`
    });
  }

  logger.debug('Database query executed', {
    duration: `${duration.toFixed(2)}ms`,
    query: process.env.NODE_ENV === 'development' ? query : '[REDACTED]'
  });
};

// Cache monitoring
export const cacheMonitor = (operation, key, hit = null) => {
  if (operation === 'get' && hit !== null) {
    if (hit) {
      metricsCollector.incrementCacheHit();
    } else {
      metricsCollector.incrementCacheMiss();
    }
  }

  logger.debug('Cache operation', {
    operation,
    key: key.substring(0, 100), // Truncate long keys
    hit
  });
};

// Health check endpoint
export const healthCheck = (req, res) => {
  const healthStatus = metricsCollector.getHealthStatus();

  // Determine HTTP status based on health
  let statusCode = 200;
  if (healthStatus.status === 'critical') {
    statusCode = 503; // Service Unavailable
  } else if (healthStatus.status === 'warning') {
    statusCode = 200; // Still OK, but warn
  }

  res.status(statusCode).json({
    ...healthStatus,
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV,
    database: {
      status: 'unknown' // Would need to be checked separately
    },
    redis: {
      status: 'unknown' // Would need to be checked separately
    }
  });
};

// Metrics endpoint for Prometheus/monitoring systems
export const metricsEndpoint = (req, res) => {
  const metrics = metricsCollector.getMetrics();

  // Format as Prometheus metrics
  let prometheusMetrics = '# HELP erato_http_requests_total Total number of HTTP requests\n';
  prometheusMetrics += '# TYPE erato_http_requests_total counter\n';
  prometheusMetrics += `erato_http_requests_total ${metrics.httpRequestsTotal}\n\n`;

  prometheusMetrics += '# HELP erato_active_connections Number of active connections\n';
  prometheusMetrics += '# TYPE erato_active_connections gauge\n';
  prometheusMetrics += `erato_active_connections ${metrics.activeConnections}\n\n`;

  prometheusMetrics += '# HELP erato_memory_usage_heap_used Heap memory used in bytes\n';
  prometheusMetrics += '# TYPE erato_memory_usage_heap_used gauge\n';
  prometheusMetrics += `erato_memory_usage_heap_used ${metrics.memoryUsage[metrics.memoryUsage.length - 1]?.heapUsed || 0}\n\n`;

  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.send(prometheusMetrics);
};