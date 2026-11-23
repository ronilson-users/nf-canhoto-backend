import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Backend API',
      version: '1.0.0',
      description: 'API v1 Documentation',
    },
    servers: [{ url: '/api/v1', description: 'API v1' }],
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

export const swaggerSpec = swaggerJsdoc(options);