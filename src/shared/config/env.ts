/**
 * Copyright (c) 2025 RSj-roni
 * Filename: env.ts
 * PATH: src/shared/config/env.ts
 */

import { z } from 'zod';
import dotenv from 'dotenv';

// Carrega .env o mais cedo possível
dotenv.config({ path: '.env' });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  PORT: z.coerce.number().default(3001),

  API_URL: z.string().url().optional(),
  
  
  MONGODB_URI: z.string().min(10, "MONGODB_URI é obrigatória"),
  
  JWT_SECRET: z.string().min(20, "JWT_SECRET deve ter pelo menos 20 caracteres"),
  JWT_EXPIRES_IN: z.string().default('7d'),
  
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

export const env = envSchema.parse(process.env);

console.log('✅ Environment variables loaded successfully!');
console.log(`   NODE_ENV: ${env.NODE_ENV}`);
console.log(`   PORT: ${env.PORT}`);
console.log(`   MONGODB_URI: ${env.MONGODB_URI ? '✅ Loaded' : '❌ Missing'}`);
console.log(`   JWT_SECRET: ${env.JWT_SECRET ? '✅ Loaded' : '❌ Missing'}`);