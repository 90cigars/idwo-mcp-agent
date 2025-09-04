import dotenv from 'dotenv';

// Load integration test environment variables
dotenv.config({ path: '.env.test' });

// Set longer timeout for integration tests
jest.setTimeout(60000);

// Ensure clean environment for each test
beforeEach(() => {
  // Clear any cached modules
  jest.clearAllMocks();
});

afterEach(() => {
  // Clean up any test artifacts
});

// Global integration test configuration
global.console = {
  ...console,
  // Suppress console.log during tests unless VERBOSE is set
  log: process.env.VERBOSE ? console.log : jest.fn(),
  debug: process.env.VERBOSE ? console.debug : jest.fn(),
  info: process.env.VERBOSE ? console.info : jest.fn(),
  warn: console.warn,
  error: console.error,
};