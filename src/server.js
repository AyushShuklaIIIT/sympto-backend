import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { connectDB, setupGracefulShutdown } from './config/database.js';
import { initializeSecurity, createSecureServer, getRateLimitConfig } from './utils/securityConfig.js';

// Load environment variables
dotenv.config();

// Initialize security configuration
initializeSecurity();

const app = express();
const PORT = process.env.PORT || 5000;

// When running behind a reverse proxy (Render/Railway/Fly/NGINX), trust X-Forwarded-* headers
if (process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// Request logging and performance monitoring middleware
app.use(performanceMonitor);
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// Import security middleware
import { securityMiddleware } from './middleware/security.js';
import { memoryCache, cacheHeaders, noCache } from './middleware/cache.js';
import { performanceMonitor } from './utils/performance.js';

// Apply comprehensive security middleware
app.use(securityMiddleware);

// Enhanced Helmet configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'none'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" }
}));

// CORS
// - FRONTEND_URL: single origin (e.g. https://your-app.vercel.app)
// - FRONTEND_URLS: comma-separated list of allowed origins (e.g. https://a.vercel.app,https://b.vercel.app)
// - FRONTEND_ORIGIN_REGEX: optional regex string for allowed origins (e.g. ^https:\/\/sympto-.*\\.vercel\\.app$)
// - ALLOW_VERCEL_PREVIEWS: if true, allows any *.vercel.app origin (prefer FRONTEND_ORIGIN_REGEX for tighter control)
const parseCsv = (value) =>
  String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

const allowedOrigins = new Set([
  process.env.FRONTEND_URL,
  ...parseCsv(process.env.FRONTEND_URLS),
].filter(Boolean));

const allowedOriginRegexes = [];
if (process.env.FRONTEND_ORIGIN_REGEX) {
  try {
    allowedOriginRegexes.push(new RegExp(process.env.FRONTEND_ORIGIN_REGEX));
  } catch (e) {
    console.warn('Invalid FRONTEND_ORIGIN_REGEX; ignoring:', e.message);
  }
}
if ((process.env.ALLOW_VERCEL_PREVIEWS || '').toLowerCase() === 'true') {
  allowedOriginRegexes.push(/\.vercel\.app$/i);
}

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser clients (curl/postman) with no Origin header
    if (!origin) return callback(null, true);

    if (allowedOrigins.has(origin)) return callback(null, true);
    if (allowedOriginRegexes.some((regex) => regex.test(origin))) return callback(null, true);

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Rate limiting with configuration from security config
const rateLimitConfig = getRateLimitConfig();
const limiter = rateLimit({
  windowMs: rateLimitConfig.windowMs,
  max: rateLimitConfig.max,
  message: rateLimitConfig.message,
  standardHeaders: rateLimitConfig.standardHeaders,
  legacyHeaders: rateLimitConfig.legacyHeaders,
});

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: rateLimitConfig.windowMs,
  max: rateLimitConfig.authMax,
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again later.',
      timestamp: new Date().toISOString()
    }
  }
});

app.use(limiter);
app.use('/api/auth', authLimiter);

// Body parsing middleware with size limits
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_JSON',
          message: 'Invalid JSON format',
          timestamp: new Date().toISOString()
        }
      });
      throw new Error('Invalid JSON');
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint with caching
app.get('/health', cacheHeaders(60), (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Sympto API is running',
    timestamp: new Date().toISOString()
  });
});

// Import routes
import authRoutes from './routes/auth.js';
import assessmentRoutes from './routes/assessments.js';
import userRoutes from './routes/users.js';
import consentRoutes from './routes/consent.js';

// API routes with caching strategies
app.use('/api/auth', noCache(), authRoutes); // No cache for auth
app.use('/api/assessments', memoryCache(300000), assessmentRoutes); // 5 min cache for assessments
app.use('/api/users', noCache(), userRoutes); // No cache for user data
app.use('/api/consent', memoryCache(600000), consentRoutes); // 10 min cache for consent

// Catch-all for undefined API routes
app.use('/api', (req, res) => {
  res.status(404).json({ 
    success: false,
    error: {
      code: 'ENDPOINT_NOT_FOUND',
      message: 'API endpoint not found',
      timestamp: new Date().toISOString()
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  // Log error details
  console.error(`Error occurred at ${new Date().toISOString()}:`, {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input data',
        details: isDevelopment ? err.message : undefined,
        timestamp: new Date().toISOString()
      }
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_ID',
        message: 'Invalid ID format',
        timestamp: new Date().toISOString()
      }
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE_ENTRY',
        message: 'Resource already exists',
        timestamp: new Date().toISOString()
      }
    });
  }

  // Default error response
  res.status(err.status || 500).json({ 
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: isDevelopment ? err.message : 'Something went wrong!',
      timestamp: new Date().toISOString()
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
      timestamp: new Date().toISOString()
    }
  });
});

// Start server
const startServer = async () => {
  try {
    await connectDB();
    setupGracefulShutdown();

    // Most hosted platforms terminate TLS at the proxy/load balancer.
    // Only run a local HTTPS server when explicitly enabled.
    const useLocalHttps = (process.env.USE_LOCAL_HTTPS || '').toLowerCase() === 'true';

    if (useLocalHttps) {
      const httpsServer = createSecureServer(app);
      if (!httpsServer) {
        console.warn('USE_LOCAL_HTTPS=true but HTTPS_KEY_PATH/HTTPS_CERT_PATH not set or invalid. Falling back to HTTP.');
      } else {
        const httpsPort = process.env.HTTPS_PORT || 5001;
        httpsServer.listen(httpsPort, () => {
          console.log(`🔒 Local HTTPS Server running on port ${httpsPort}`);
          console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        });

        const httpApp = express();
        httpApp.set('trust proxy', app.get('trust proxy'));
        httpApp.use((req, res) => {
          res.redirect(301, `https://${req.get('host')}${req.url}`);
        });

        httpApp.listen(PORT, () => {
          console.log(`🔄 HTTP redirect server running on port ${PORT}`);
        });

        return httpsServer;
      }
    }

    // Default: plain HTTP on PORT (TLS handled by the platform)
    const server = app.listen(PORT, () => {
      console.log(`🌐 HTTP Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    server.on('error', (error) => {
      console.error('Server error:', error);
      process.exit(1);
    });

    return server;
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;