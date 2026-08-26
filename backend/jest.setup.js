const dotenv = require('dotenv');
dotenv.config();

// Override the DB URL for isolated test execution using the "test" schema.
// Strip any existing schema param and append ?schema=test cleanly.
if (process.env.DATABASE_URL) {
  let url = process.env.DATABASE_URL;
  // Remove any existing schema param
  url = url.replace(/[?&]schema=[^&]*/g, '');
  // Remove trailing ? or & left over
  url = url.replace(/[?&]$/, '');
  // Append schema=test correctly
  url = url + (url.includes('?') ? '&schema=test' : '?schema=test');
  process.env.DATABASE_URL = url;
}

// Disable rate limiting in tests — the shared in-memory store leaks across
// suites when running with --runInBand, exhausting budgets unintentionally.
process.env.DISABLE_RATE_LIMIT = 'true';

// Silence expected errors during tests
process.env.LOG_LEVEL = 'error';
