import nodemailer from 'nodemailer'

/**
 * Email utility for sending transactional emails
 * Uses nodemailer (already installed) with environment-based config
 */

// Validate required environment variables
const requiredEnvVars = [
  'EMAIL_FROM',
  'EMAIL_SMTP_HOST',
  'EMAIL_SMTP_PORT',
  'EMAIL_SMTP_USER',
  'EMAIL_SMTP_PASS',
]
const missingEnvVars = requiredEnvVars.filter((v) => !process.env[v])

if (missingEnvVars.length > 0) {
  console.warn(
    `[email] Missing environment variables for email: ${missingEnvVars.join(', ')}. Email sending will not work.`
  )
}

// Create transporter
let transporter = null

function getTransporter() {
  if (transporter) return transporter

  if (
    process.env.NODE_ENV === 'development' &&
    (!process.env.EMAIL_SMTP_HOST || process.env.EMAIL_SMTP_HOST === 'localhost')
  ) {
    // Dev mode: use in-memory transport (doesn't actually send emails)
    transporter = nodemailer.createTransport({
      host: 'localhost',
      port: 1025,
      ignoreTLS: true,
    })
  } else {
    // Production: use real SMTP
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_SMTP_HOST,
      port: parseInt(process.env.EMAIL_SMTP_PORT || '587'),
      secure: process.env.EMAIL_SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_SMTP_USER,
        pass: process.env.EMAIL_SMTP_PASS,
      },
    })
  }

  return transporter
}

/**
 * Send verification email
 * @param {string} email - Recipient email
 * @param {string} verificationUrl - Full URL to verification link
 * @param {string} language - Language code ('es' or 'en')
 * @returns {Promise<Object>} Nodemailer response
 */
export async function sendVerificationEmail(email, verificationUrl, language = 'es') {
  const isSpanish = language === 'es'

  const subject = isSpanish ? 'Verifica tu cuenta en Vialia' : 'Verify your account on Vialia'

  const htmlContent = isSpanish
    ? `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Bienvenido a Vialia</h2>
      <p>Gracias por registrarte. Para completar tu registro, necesitas verificar tu dirección de correo.</p>
      <p>
        <a href="${verificationUrl}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Verificar cuenta
        </a>
      </p>
      <p>O copia y pega este enlace en tu navegador:</p>
      <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
      <p style="color: #999; font-size: 12px;">Este enlace expira en 24 horas.</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;" />
      <p style="color: #999; font-size: 12px;">Si no solicitaste esta cuenta, ignora este correo.</p>
    </div>
  `
    : `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Welcome to Vialia</h2>
      <p>Thank you for signing up. To complete your registration, please verify your email address.</p>
      <p>
        <a href="${verificationUrl}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Verify Account
        </a>
      </p>
      <p>Or copy and paste this link in your browser:</p>
      <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
      <p style="color: #999; font-size: 12px;">This link expires in 24 hours.</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;" />
      <p style="color: #999; font-size: 12px;">If you didn't request this account, please ignore this email.</p>
    </div>
  `

  const plaintext = isSpanish
    ? `Bienvenido a Vialia\n\nGracias por registrarte. Para completar tu registro, necesitas verificar tu dirección de correo.\n\n${verificationUrl}\n\nEste enlace expira en 24 horas.`
    : `Welcome to Vialia\n\nThank you for signing up. To complete your registration, please verify your email address.\n\n${verificationUrl}\n\nThis link expires in 24 hours.`

  try {
    const result = await getTransporter().sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject,
      html: htmlContent,
      text: plaintext,
    })

    return result
  } catch (error) {
    console.error('[email] Failed to send verification email:', error)
    throw error
  }
}

/**
 * Send password reset email
 * @param {string} email - Recipient email
 * @param {string} resetUrl - Full URL to password reset link
 * @param {string} language - Language code ('es' or 'en')
 * @returns {Promise<Object>} Nodemailer response
 */
export async function sendPasswordResetEmail(email, resetUrl, language = 'es') {
  const isSpanish = language === 'es'

  const subject = isSpanish ? 'Restablece tu contraseña en Vialia' : 'Reset your password on Vialia'

  const htmlContent = isSpanish
    ? `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Restablecimiento de contraseña</h2>
      <p>Hemos recibido una solicitud para restablecer tu contraseña. Haz clic en el botón de abajo para crear una nueva contraseña.</p>
      <p>
        <a href="${resetUrl}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Restablecer contraseña
        </a>
      </p>
      <p>O copia y pega este enlace en tu navegador:</p>
      <p style="word-break: break-all; color: #666;">${resetUrl}</p>
      <p style="color: #999; font-size: 12px;">Este enlace expira en 1 hora.</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;" />
      <p style="color: #999; font-size: 12px;">Si no solicitaste restablecer tu contraseña, ignora este correo.</p>
    </div>
  `
    : `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Password Reset</h2>
      <p>We received a request to reset your password. Click the button below to create a new password.</p>
      <p>
        <a href="${resetUrl}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Reset Password
        </a>
      </p>
      <p>Or copy and paste this link in your browser:</p>
      <p style="word-break: break-all; color: #666;">${resetUrl}</p>
      <p style="color: #999; font-size: 12px;">This link expires in 1 hour.</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;" />
      <p style="color: #999; font-size: 12px;">If you didn't request a password reset, please ignore this email.</p>
    </div>
  `

  const plaintext = isSpanish
    ? `Restablecimiento de contraseña\n\nHemos recibido una solicitud para restablecer tu contraseña.\n\n${resetUrl}\n\nEste enlace expira en 1 hora.`
    : `Password Reset\n\nWe received a request to reset your password.\n\n${resetUrl}\n\nThis link expires in 1 hour.`

  try {
    const result = await getTransporter().sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject,
      html: htmlContent,
      text: plaintext,
    })

    return result
  } catch (error) {
    console.error('[email] Failed to send password reset email:', error)
    throw error
  }
}

/**
 * Test email connection
 * @returns {Promise<boolean>} True if connection successful
 */
export async function verifyEmailConnection() {
  try {
    await getTransporter().verify()
    return true
  } catch (error) {
    console.error('[email] Connection verification failed:', error)
    return false
  }
}
