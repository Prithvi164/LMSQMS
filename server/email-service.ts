import nodemailer from 'nodemailer';

// Email configuration
let transporter: nodemailer.Transporter;

// Initialize the email service with configuration
export async function initializeEmailService() {
  try {
    // Check if we have environment variables for email configuration
    if (process.env.EMAIL_HOST && process.env.EMAIL_PORT) {
      // Use production configuration
      transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT),
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      });
    } else {
      // For development/testing - create a test account using Ethereal
      const testAccount = await nodemailer.createTestAccount();
      
      console.log('Created test email account:');
      console.log(`- Username: ${testAccount.user}`);
      console.log(`- Password: ${testAccount.pass}`);
      console.log(`- SMTP Host: ${testAccount.smtp.host}`);
      console.log(`- SMTP Port: ${testAccount.smtp.port}`);
      
      transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    }
    
    console.log('Email service initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize email service:', error);
    return false;
  }
}

// Send password reset email
export async function sendPasswordResetEmail(email: string, resetUrl: string, username: string) {
  try {
    if (!transporter) {
      throw new Error('Email service not initialized');
    }
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || '"CloudLMS" <noreply@cloudlms.com>',
      to: email,
      subject: 'Password Reset Instructions',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4f46e5;">Password Reset Request</h2>
          <p>Hello ${username},</p>
          <p>We received a request to reset the password for your CloudLMS account. To reset your password, click on the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Reset Password</a>
          </div>
          <p>If you didn't request a password reset, you can safely ignore this email - your password will not be changed.</p>
          <p>This link will expire in 1 hour for security reasons.</p>
          <p>Thank you,<br>The CloudLMS Team</p>
          <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;">
          <p style="font-size: 12px; color: #666;">If the button doesn't work, copy and paste this URL into your browser: ${resetUrl}</p>
        </div>
      `,
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent successfully');
    console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
    
    return {
      success: true,
      messageId: info.messageId,
      previewUrl: nodemailer.getTestMessageUrl(info),
    };
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}