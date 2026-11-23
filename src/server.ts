import os from 'os';
import mongoose from 'mongoose';

import app from './app';
import { env } from '@/shared/config/env';
import { connectDatabase } from './infra/database/connection';
import { logger } from '@/shared/utils/logger';

function getLocalIP(): string {
  const interfaces = os.networkInterfaces();

  for (const list of Object.values(interfaces)) {
    for (const iface of list ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }

  return 'localhost';
}

const startServer = async () => {
  try {
    await connectDatabase();

    const networkIP = getLocalIP();

    const server = app.listen(env.PORT, '0.0.0.0', () => {
      logger.info(`🚀 Server running`);
      logger.info(`🌎 Environment: ${env.NODE_ENV}`);
      logger.info(`📍 Local:   http://localhost:${env.PORT}`);
      logger.info(`📍 Network: http://${networkIP}:${env.PORT}`);
      logger.info(`📚 Swagger: http://${networkIP}:${env.PORT}/api/v1/docs`);
      logger.info(`❤️ Health:  http://${networkIP}:${env.PORT}/health`);
    });

    const shutdown = () => {
      logger.info('🛑 Graceful shutdown...');

      server.close(async () => {
        try {
          await mongoose.connection.close();
          logger.info('✅ MongoDB disconnected');
          process.exit(0);
        } catch (err) {
          logger.error({ err }, 'Error closing MongoDB');
          process.exit(1);
        }
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (err) {
    logger.error({ err }, '❌ Failed to start server');
    process.exit(1);
  }
};

if (env.NODE_ENV !== 'test') {
  startServer();
}

export default app;