import nodemailer from 'nodemailer'
import { logger } from './logger.js'

const SMTP_HOST = process.env.SMTP_HOST
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587
const SMTP_SECURE = process.env.SMTP_SECURE === 'true'
const SMTP_USER = process.env.SMTP_USER
const SMTP_PASS = process.env.SMTP_PASS
const SMTP_FROM = process.env.SMTP_FROM || 'noreply@resonance.com'

const isConfigured = SMTP_HOST && SMTP_USER && SMTP_PASS

let transporter = null

if (isConfigured) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    pool: true,
    maxConnections: 5,
  })

  // Verify on boot so you see immediately if credentials are wrong
  transporter.verify((err) => {
    if (err) {
      logger.error({ err: err.message }, 'SMTP connection failed — emails will not send')
    } else {
      logger.info('SMTP server ready')
    }
  })
} else {
  logger.warn(
    { missing: ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'].filter((k) => !process.env[k]) },
    'SMTP not configured. Email sending is disabled.'
  )
}

export async function sendEmail({ to, subject, html, text }) {
  if (!transporter) {
    const err = new Error('Email service is not configured')
    err.code = 'EMAIL_NOT_CONFIGURED'
    throw err
  }

  try {
    const info = await transporter.sendMail({
      from: `"Resonance" <${SMTP_FROM}>`,
      to,
      subject,
      html,
      text,
    })
    logger.info({ messageId: info.messageId, to }, 'Email sent')
    return info
  } catch (error) {
    logger.error({ err: error?.message || error, to, subject }, 'Failed to send email')
    const err = new Error(error?.message || 'Email send failed')
    err.code = 'EMAIL_SEND_FAILED'
    err.original = error
    throw err
  }
}

export async function sendTeamInvite({ to, teamName, inviterName, acceptUrl }) {
  const subject = `Invitation to join ${teamName} on Resonance`

  const html = `
    <div style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111; max-width: 480px;">
      <h1 style="font-size: 1.5rem; margin-bottom: 0.5rem;">You're invited to join ${teamName}</h1>
      <p style="color: #444;">${inviterName} invited you to join the <strong>${teamName}</strong> team on Resonance.</p>
      <p style="margin: 1.5rem 0;">
        <a href="${acceptUrl}" style="display: inline-block; padding: 12px 20px; background: #2563eb; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 500;">
          Accept invitation
        </a>
      </p>
      <p style="color: #666; font-size: 0.875rem;">If the button doesn't work, copy and paste this URL into your browser:</p>
      <p style="word-break: break-all; font-size: 0.875rem;"><a href="${acceptUrl}" style="color: #2563eb;">${acceptUrl}</a></p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 1.5rem 0;" />
      <p style="color: #999; font-size: 0.75rem;">Welcome aboard!</p>
    </div>
  `

  const text = `You're invited to join ${teamName}

${inviterName} invited you to join the ${teamName} team on Resonance.

Accept invitation: ${acceptUrl}

Welcome aboard!`

  return sendEmail({ to, subject, html, text })
}