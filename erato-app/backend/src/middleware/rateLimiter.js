import rateLimit from 'express-rate-limit';

// Check if rate limiting should be completely disabled
const isDisabled = process.env.DISABLE_RATE_LIMIT === 'true';

// Check if we're in development mode
// On Render, NODE_ENV is usually 'production', so check for explicit dev mode env var
const isDevelopment = process.env.NODE_ENV !== 'production' || !process.env.NODE_ENV;
const isDevMode = process.env.RATE_LIMIT_DEV_MODE === 'true' ||
                  process.env.RELAXED_RATE_LIMITS === 'true' ||
                  isDevelopment;

// Log rate limit mode (helpful for debugging)
if (isDisabled) {
  console.log('🚫 Rate limiting: DISABLED');
} else if (isDevMode) {
  console.log('🔓 Rate limiting: Development mode (very lenient limits)');
} else {
  console.log('🔒 Rate limiting: Production mode (relaxed limits)');
}

// Create a no-op middleware for when rate limiting is disabled
const noOpLimiter = (req, res, next) => next();

// Development: Much more lenient limits
// Production: Relaxed limits for testing
export const rateLimiter = isDisabled
  ? noOpLimiter
  : isDevMode
  ? rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 1 * 60 * 1000, // 1 minute in dev
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 10000, // 10,000 requests per minute in dev
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/health';
      },
    })
  : rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 2000, // 2000 requests per 15 minutes (very relaxed)
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/health';
      },
    });

export const authLimiter = isDisabled
  ? noOpLimiter
  : isDevMode
  ? rateLimit({
      windowMs: 1 * 60 * 1000, // 1 minute in dev
      max: 500, // 500 attempts per minute in dev (very lenient)
      message: 'Too many authentication attempts, please try again later.',
      skipSuccessfulRequests: true,
    })
  : rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // 100 attempts per 15 minutes (very relaxed)
      message: 'Too many authentication attempts, please try again later.',
      skipSuccessfulRequests: true,
    });
