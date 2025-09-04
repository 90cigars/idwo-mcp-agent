import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test timeout globally
jest.setTimeout(30000);

// Mock external services by default
jest.mock('../src/integrations/github.ts');
jest.mock('../src/integrations/jira.ts');
jest.mock('../src/integrations/slack.ts');
jest.mock('../src/agents/openai.ts');

// Global test configuration
global.console = {
  ...console,
  // Suppress console.log during tests unless VERBOSE is set
  log: process.env.VERBOSE ? console.log : jest.fn(),
  debug: process.env.VERBOSE ? console.debug : jest.fn(),
  info: process.env.VERBOSE ? console.info : jest.fn(),
  warn: console.warn,
  error: console.error,
};