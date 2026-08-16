import { Resend } from 'resend'
import { logger } from './logger.js'

const resendApiKey = process.env.RESEND_API_KEY
const resendFrom = process.env.RESEND_FROM_EMAIL || 'noreply@resonance.com'

if (!resendApiKey) {
  logger.warn({ env: 'RESEND_API_KEY' }, 'Resend API key is not configured. Email sending is disabled.')
}

const resend = resendApiKey ? new Resend(resendApiKey) : null

export async function sendTeamInvite({ to, teamName, inviterName, acceptUrl }) {
  if (!resend) {
    throw new Error('Email service is not configured')
  }

  const html = `
    <div style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
      <h1 style="font-size: 1.5rem;">You're invited to join ${teamName}</h1>
      <p>${inviterName} invited you to join the ${teamName} team on Resonance.</p>
      <p>
        <a href="${acceptUrl}" style="display: inline-block; padding: 12px 20px; background: #2563eb; color: #fff; border-radius: 8px; text-decoration: none;">
          Accept invitation
        </a>
      </p>
      <p>If the button doesn't work, copy and paste the following URL into your browser:</p>
      <p><a href="${acceptUrl}">${acceptUrl}</a></p>
      <p>Welcome aboard!</p>
    </div>
  `

  const subject = `Invitation to join ${teamName} on Resonance`

  try {
    await resend.emails.send({
      from: resendFrom,
      to: [to],
      subject,
      html,
    })
  } catch (error) {
    logger.error({ err: error?.message || error, to, teamName }, 'Failed to send team invite email')
    throw new Error('Email send failed')
  }
}
