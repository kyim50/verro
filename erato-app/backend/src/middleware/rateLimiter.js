import rateLimit from 'express-rate-limit';

// Check if we're in development mode
// On Render, NODE_ENV is usually 'production', so check for explicit dev mode env var
const isDevelopment = process.env.NODE_ENV !== 'production' || !process.env.NODE_ENV;
const isDevMode = process.env.DISABLE_RATE_LIMIT === 'true' || 
                  process.env.RATE_LIMIT_DEV_MODE === 'true' ||
                  process.env.RELAXED_RATE_LIMITS === 'true' ||
                  isDevelopment;

// Log rate limit mode (helpful for debugging)
if (isDevMode) {
  console.log('🔓 Rate limiting: Development mode (lenient limits)');
} else {
  console.log('🔒 Rate limiting: Production mode (strict limits)');
}

// Development: Much more lenient limits or disabled
// Production: Strict limits
export const rateLimiter = isDevMode
  ? rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 1 * 60 * 1000, // 1 minute in dev
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000, // 1000 requests per minute in dev
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => {
        // Skip rate limiting for health checks in dev
        return req.path === '/health';
      },
    })
  : rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
    });

export const authLimiter = isDevMode
  ? rateLimit({
      windowMs: 1 * 60 * 1000, // 1 minute in dev
      max: 50, // 50 attempts in dev
      message: 'Too many authentication attempts, please try again later.',
      skipSuccessfulRequests: true,
    })
  : rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 attempts
      message: 'Too many authentication attempts, please try again later.',
      skipSuccessfulRequests: true,
    });
