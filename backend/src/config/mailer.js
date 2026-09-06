'use strict';

const nodemailer = require('nodemailer');
const { GMAIL_USER, GMAIL_APP_PASSWORD } = require('./env');

// Single reusable transport. Module-specific templates live in each module.
const transport = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD,
  },
});

/**
 * Send an email.
 *
 * @param {{ to: string, subject: string, html: string, attachments?: object[] }} opts
 * @returns {Promise<object>} nodemailer info object
 */
async function sendMail({ to, subject, html, attachments = [] }) {
  const info = await transport.sendMail({
    from: `"DealFlow360" <${GMAIL_USER}>`,
    to,
    subject,
    html,
    attachments,
  });
  return info;
}

module.exports = { sendMail, transport };
