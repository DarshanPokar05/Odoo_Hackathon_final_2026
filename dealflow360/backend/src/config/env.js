'use strict';

require('dotenv').config();

/**
 * Central env loader — import this in every file that needs env vars.
 * Throws at startup if any required variable is missing.
 */

const required = [
  'DATABASE_URL',
  'JWT_SECRET',
  'GMAIL_USER',
  'GMAIL_APP_PASSWORD',
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

module.exports = {
  NODE_ENV:            process.env.NODE_ENV || 'development',
  PORT:                parseInt(process.env.PORT || '4000', 10),
  CLIENT_URL:          process.env.CLIENT_URL || 'http://localhost:5173',
  DATABASE_URL:        process.env.DATABASE_URL,
  JWT_SECRET:          process.env.JWT_SECRET,
  JWT_EXPIRES_IN:      process.env.JWT_EXPIRES_IN || '7d',
  GMAIL_USER:          process.env.GMAIL_USER,
  GMAIL_APP_PASSWORD:  process.env.GMAIL_APP_PASSWORD,
  RAZORPAY_KEY_ID:     process.env.RAZORPAY_KEY_ID || '',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
};
