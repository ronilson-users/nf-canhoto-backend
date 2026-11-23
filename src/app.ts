import express, { Application } from 'express';
import path from 'path';

import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

import routes from './api/v1';
import { env } from './shared/config/env';
import { logger, httpLogger } from './shared/utils/logger';
import { requestId } from './shared/middleware/requestId';
import { errorHandler } from './shared/middleware/errorHandler';

const app: Application = express();

/* ==================================
 * Static Files
 * ==================================*/

app.use(
  '/images',
  express.static(path.join(process.cwd(), 'public/images'))
);

/* ==================================
 * Security
 * ================================== */

app.use(helmet());

app.use(cors({
  origin:
    env.CORS_ORIGIN === '*'
      ? true
      : env.CORS_ORIGIN.split(',').map(origin => origin.trim()),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

/* ==================================
 * Performance
 * ================================== */

app.use(compression({
  level: 6,
  threshold: 1024
}));

/* ============================================================
 * Body Parser
 * ============================================================ */

app.use(express.json({
  limit: '10mb'
}));

app.use(express.urlencoded({
  extended: true
}));

/* ============================================================
 * Observability
 * ============================================================ */

app.use(requestId);
app.use(httpLogger);

/* ==================================
 * Health Check
 * ================================== */

app.get('/health', (_, res) => {
  res.json({
    success: true,
    status: 'UP',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV
  });
});

/* ============================================================
 * Rate Limit
 * ============================================================ */

const apiLimiter = rateLimit({
  windowMs: Number(env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(env.RATE_LIMIT_MAX_REQUESTS) || 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests. Please try again later.'
  },
  skip: req => req.path === '/health'
});

app.use('/api/v1', apiLimiter);

/* ============================================================
 * API
 * ============================================================ */

app.use('/api/v1', routes);

/* ============================================================
 * Swagger
 * ============================================================ */

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Backend API',
      version: '1.0.0',
      description: 'REST API'
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}/api/v1`,
        description: 'Development'
      }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    }
  },
  apis: ['./src/**/*.ts']
});

app.use(
  '/api/v1/docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true
  })
);

// http://localhost:3001/api/v1/docs

/* ============================================================
 * 404
 * ============================================================ */

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: `Endpoint '${req.originalUrl}' not found`
    },
    timestamp: new Date().toISOString()
  });
});

/* ============================================================
 * Error Handler
 * ============================================================ */

app.use(errorHandler);

logger.info('✅ Express application configured');

export default app;