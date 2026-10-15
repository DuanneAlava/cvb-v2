const nodemailer = require('nodemailer');

/*
 * SENDING EMAIL - used for one thing: the "reset your password" link
 * (controllers/authController.js).
 *
 * The mail goes out through an SMTP server the school already has - its
 * Google Workspace or Microsoft 365 account, say - set in the server's
 * settings (see .env.example):
 *
 *   SMTP_HOST, SMTP_PORT  the mail server, e.g. smtp.gmail.com and 465
 *   SMTP_SECURE           "true" for port 465 (TLS from the start); leave it
 *                         unset for 587, which upgrades with STARTTLS
 *   SMTP_USER, SMTP_PASS  the account it sends as - for Google, an "app
 *                         password", not the account's normal one
 *   MAIL_FROM             the sender people see, e.g.
 *                         "CampusVoiceBox <no-reply@ollcf.edu.ph>"
 *
 * WITHOUT SMTP_HOST
 * - While developing, nothing is sent: the message is printed in the
 *   server's console instead, so the reset link can still be followed.
 * - In production (NODE_ENV=production) that would print other people's
 *   reset links into the logs, so it refuses instead - the person is still
 *   told "check your email", and the server logs that mail is not set up
 *   (server.js also warns about it at start-up).
 *
 * WHAT YOU'LL MEET IN THIS FILE
 * - nodemailer  The usual Node package for sending email over SMTP.
 *   createTransport() is given the server's address and login once;
 *   sendMail() then sends one message through it.
 */

const configured = Boolean(process.env.SMTP_HOST);
const isProduction = process.env.NODE_ENV === 'production';

const transport = configured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    })
  : null;

const FROM = process.env.MAIL_FROM || process.env.SMTP_USER || 'CampusVoiceBox <no-reply@localhost>';

// Send one plain-text message. Rejects if it could not be handed to the
// mail server.
async function sendMail({ to, subject, text }) {
  if (transport) {
    await transport.sendMail({ from: FROM, to, subject, text });
    return;
  }
  if (isProduction) {
    throw new Error('Email is not set up (SMTP_HOST is empty), so the message was not sent.');
  }
  console.log(`\n--- Email (not sent: SMTP_HOST is not set) ---\nTo: ${to}\nSubject: ${subject}\n\n${text}\n---\n`);
}

module.exports = { sendMail, mailConfigured: configured };
