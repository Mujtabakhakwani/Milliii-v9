// config/env.js
const FRONTEND_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((x) => x.trim())
  .filter(Boolean);

module.exports = {
  MONGO_URL: process.env.MONGO_URL,
  DB_NAME: process.env.DB_NAME || 'milliii',
  JWT_SECRET: process.env.JWT_SECRET || 'change_me',
  ENCRYPTION_KEY:
    process.env.ENCRYPTION_KEY || '12345678901234567890123456789012',
  FRONTEND_ORIGINS,
  PORT: process.env.PORT || 4000,
};
