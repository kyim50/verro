// Performance monitoring middleware
// Logs slow requests and adds timing headers

export const performanceMonitor = (req, res, next) => {
  const startTime = Date.now();
  
  // Capture original end function
  const originalEnd = res.end;
  
  res.end = function(...args) {
    const duration = Date.now() - startTime;
    const route = `${req.method} ${req.path}`;
    
    // Log slow requests (>1000ms)
    if (duration > 1000) {
      console.warn(`🐌 Slow request: ${route} took ${duration}ms`);
    } else if (duration > 500) {
      console.info(`⚠️  Moderate request: ${route} took ${duration}ms`);
    }
    
    // Add timing header for monitoring tools
    res.setHeader('X-Response-Time', `${duration}ms`);
    
    // Call original end
    originalEnd.apply(this, args);
  };
  
  next();
};

// Performance stats tracker (optional, for metrics)
export const performanceStats = {
  requests: 0,
  totalTime: 0,
  slowRequests: 0,
  
  record(duration) {
    this.requests++;
    this.totalTime += duration;
    if (duration > 1000) {
      this.slowRequests++;
    }
  },
  
  getAverage() {
    return this.requests > 0 ? this.totalTime / this.requests : 0;
  },
  
  getStats() {
    return {
      totalRequests: this.requests,
      averageResponseTime: this.getAverage(),
      slowRequests: this.slowRequests,
      slowRequestPercentage: this.requests > 0 
        ? (this.slowRequests / this.requests * 100).toFixed(2) + '%'
        : '0%',
    };
  },
};




