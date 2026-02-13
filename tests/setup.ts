import dotenv from 'dotenv';

// Load environment variables for tests
dotenv.config({ path: '.env.test' });

// Set test-specific environment variables
process.env.NODE_ENV = 'test';
process.env.DEFAULT_NETWORK = 'devnet';

// Mock console.log for cleaner test output
const originalConsoleLog = console.log;
console.log = (...args) => {
  // Only log in verbose mode or for errors
  if (process.env.VERBOSE_TESTS || args.some(arg => String(arg).includes('Error'))) {
    originalConsoleLog(...args);
  }
};

// Global test timeout
jest.setTimeout(30000);

// Mock fetch for tests that don't need real API calls
(global as any).mockFetch = jest.fn();

// Helper function to create a valid payer address for tests
export const TEST_PAYER = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
export const TEST_TOKEN_ADDRESS = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'; // BONK
export const TEST_PAIR_ADDRESS = 'AVs9TA4nWDzfPJE9gGVNJMVhcQy3V9PGazuz33BfG2RA'; // Example pair