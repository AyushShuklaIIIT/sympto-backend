import nodemailer from 'nodemailer';

const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp.gmail.com';
const EMAIL_PORT = process.env.EMAIL_PORT || 587;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@sympto.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const EMAIL_ENABLED = (process.env.EMAIL_ENABLED || '').toLowerCase() === 'true';
const EMAIL_TIMEOUT_MS = parseInt(process.env.EMAIL_TIMEOUT_MS, 10) || 10000;

// Create transporter
const createTransporter = () => {
  // By default, disable SMTP in production unless explicitly enabled.
  // Many hosts (including Render free tiers) can block outbound SMTP or cause long timeouts.
  if (process.env.NODE_ENV === 'production' && !EMAIL_ENABLED) {
    return null;
  }

  // If credentials are missing, fall back to "no-op" mode.
  if (!EMAIL_USER || !EMAIL_PASS) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Email credentials not configured. Using test mode.');
    }
    return null;
  }

  return nodemailer.createTransport({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    secure: EMAIL_PORT === 465, // true for 465, false for other ports
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
    connectionTimeout: EMAIL_TIMEOUT_MS,
    greetingTimeout: EMAIL_TIMEOUT_MS,
    socketTimeout: EMAIL_TIMEOUT_MS,
    tls: {
      rejectUnauthorized: false // Allow self-signed certificates in development
    }
  });
};

/**
 * Send email verification email
 * @param {string} email - User email
 * @param {string} firstName - User first name
 * @param {string} verificationToken - Email verification token
 */
export const sendVerificationEmail = async (email, firstName, verificationToken) => {
  const transporter = createTransporter();
  
  if (!transporter) {
    console.log(`[DEV MODE] Email verification would be sent to: ${email}`);
    console.log(`[DEV MODE] Verification link: ${FRONTEND_URL}/verify-email?token=${verificationToken}`);
    return;
  }

  const verificationUrl = `${FRONTEND_URL}/verify-email?token=${verificationToken}`;
  
  const mailOptions = {
    from: `"Sympto Health" <${EMAIL_FROM}>`,
    to: email,
    subject: 'Verify Your Sympto Account',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c5aa0;">Welcome to Sympto, ${firstName}!</h2>
        <p>Thank you for creating your Sympto account. To get started, please verify your email address by clicking the button below:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="background-color: #2c5aa0; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Verify Email Address
          </a>
        </div>
        
        <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
        
        <p style="margin-top: 30px; font-size: 14px; color: #666;">
          This verification link will expire in 24 hours. If you didn't create a Sympto account, you can safely ignore this email.
        </p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">
          © 2024 Sympto Health. All rights reserved.
        </p>
      </div>
    `,
    text: `
      Welcome to Sympto, ${firstName}!
      
      Thank you for creating your Sympto account. To get started, please verify your email address by visiting this link:
      
      ${verificationUrl}
      
      This verification link will expire in 24 hours. If you didn't create a Sympto account, you can safely ignore this email.
      
      © 2024 Sympto Health. All rights reserved.
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Verification email sent to: ${email}`);
  } catch (error) {
    console.error('Failed to send verification email:', error);
    throw new Error('Failed to send verification email');
  }
};

/**
 * Send password reset email
 * @param {string} email - User email
 * @param {string} firstName - User first name
 * @param {string} resetToken - Password reset token
 */
export const sendPasswordResetEmail = async (email, firstName, resetToken) => {
  const transporter = createTransporter();
  
  if (!transporter) {
    console.log(`[DEV MODE] Password reset email would be sent to: ${email}`);
    console.log(`[DEV MODE] Reset link: ${FRONTEND_URL}/reset-password?token=${resetToken}`);
    return;
  }

  const resetUrl = `${FRONTEND_URL}/reset-password?token=${resetToken}`;
  
  const mailOptions = {
    from: `"Sympto Health" <${EMAIL_FROM}>`,
    to: email,
    subject: 'Reset Your Sympto Password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c5aa0;">Password Reset Request</h2>
        <p>Hello ${firstName},</p>
        <p>We received a request to reset your Sympto account password. Click the button below to create a new password:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="background-color: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Reset Password
          </a>
        </div>
        
        <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${resetUrl}</p>
        
        <p style="margin-top: 30px; font-size: 14px; color: #666;">
          This password reset link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
        </p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">
          © 2024 Sympto Health. All rights reserved.
        </p>
      </div>
    `,
    text: `
      Password Reset Request
      
      Hello ${firstName},
      
      We received a request to reset your Sympto account password. Visit this link to create a new password:
      
      ${resetUrl}
      
      This password reset link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
      
      © 2024 Sympto Health. All rights reserved.
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Password reset email sent to: ${email}`);
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
};