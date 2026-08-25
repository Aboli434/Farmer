const dotenv = require('dotenv');
dotenv.config();

// Override the DB URL for isolated test execution using the "test" schema
if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace('?schema=public', '?schema=test');
}

// Silence expected errors during tests
process.env.LOG_LEVEL = 'error';
