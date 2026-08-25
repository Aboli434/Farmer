require('dotenv').config();
const { execSync } = require('child_process');

process.env.DATABASE_URL = process.env.DATABASE_URL.replace('?schema=public', '?schema=test');

console.log('Pushing to test schema:', process.env.DATABASE_URL);

try {
  execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit', env: process.env });
} catch (e) {
  console.error('Failed to push schema', e);
}
