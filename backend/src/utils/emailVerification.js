import { randomBytes } from 'crypto';
import { env } from '../config/env.js';

/**
 * Generate a secure verification token
 */
export function generateVerificationToken() {
  return randomBytes(32).toString('hex');
}

/**
 * Get token expiration time (24 hours from now)
 */
export function getTokenExpiration() {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);
  return expiresAt.toISOString();
}

/**
 * Send verification email via Discord webhook
 * (In production, replace with proper email service like SendGrid, AWS SES, etc.)
 */
export async function sendVerificationEmail(email, token, userName) {
  const verificationUrl = `${env.FRONTEND_URL}/verify-email?token=${token}`;
  
  try {
    // For now, send notification to Discord webhook
    // In production, use a proper email service
    const response = await fetch(env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: '📧 Email Verification Required',
          description: `New user registration pending verification`,
          color: 0x5865F2,
          fields: [
            { name: 'Email', value: email, inline: true },
            { name: 'User', value: userName, inline: true },
            { name: 'Verification Link', value: verificationUrl, inline: false }
          ],
          footer: { text: 'Email verification system' },
          timestamp: new Date().toISOString()
        }]
      })
    });

    if (!response.ok) {
      console.error('[EMAIL] Failed to send verification notification');
    }

    // TODO: Replace with actual email sending
    // Example with SendGrid:
    // const sgMail = require('@sendgrid/mail');
    // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    // await sgMail.send({
    //   to: email,
    //   from: 'noreply@astranodes.cloud',
    //   subject: 'Verify your AstraNodes account',
    //   html: `<p>Click to verify: <a href="${verificationUrl}">Verify Email</a></p>`
    // });

    console.log(`[EMAIL] Verification email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('[EMAIL] Error sending verification email:', error.message);
    return false;
  }
}

/**
 * Check if a verification token is valid and not expired
 */
export function isTokenValid(expiresAt) {
  if (!expiresAt) return false;
  const expirationDate = new Date(expiresAt);
  const now = new Date();
  return expirationDate > now;
}
