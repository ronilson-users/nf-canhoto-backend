// src/shared/config/swagger.config.ts
import swaggerJsdoc from 'swagger-jsdoc';
import { env } from '@/shared/config/env';

const swaggerOptions = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Backend API',
      version: '1.0.0',
      description: 'API v1 - Documentação interativa',
      contact: {
        name: 'API Support',
        email: 'support@example.com'
      }
    },
    servers: [
      { url: '/api/v1', description: 'API v1 - Local' },
      ...(env.API_URL ? [{ url: env.API_URL, description: 'API v1 - Production' }] : [])
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
  apis: ['./src/api/**/*.ts', './src/**/*.ts']
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);