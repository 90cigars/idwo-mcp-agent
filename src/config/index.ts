import dotenv from 'dotenv';
import { Config } from '../types/index.js';

dotenv.config();

export const config: Config = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
  },
  github: {
    token: process.env.GITHUB_TOKEN || '',
    organization: process.env.GITHUB_ORGANIZATION,
  },
  jira: {
    url: process.env.JIRA_URL || '',
    username: process.env.JIRA_USERNAME || '',
    apiToken: process.env.JIRA_API_TOKEN || '',
  },
  slack: {
    botToken: process.env.SLACK_BOT_TOKEN || '',
    appToken: process.env.SLACK_APP_TOKEN || '',
    signingSecret: process.env.SLACK_SIGNING_SECRET || '',
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/idwo',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
  },
  security: {
    jwtSecret: process.env.JWT_SECRET || '',
    encryptionKey: process.env.ENCRYPTION_KEY || '',
  },
  rateLimiting: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
  circuitBreaker: {
    timeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || '5000', 10),
    threshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || '5', 10),
    resetTimeout: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT || '30000', 10),
  },
};

export function validateConfig(): void {
  const required = [
    'OPENAI_API_KEY',
    'GITHUB_TOKEN',
    'JIRA_URL',
    'JIRA_USERNAME', 
    'JIRA_API_TOKEN',
    'SLACK_BOT_TOKEN',
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}