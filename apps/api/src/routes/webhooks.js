import { Router } from 'express'
import express from 'express'
import { Webhook } from 'svix'
import { prisma } from '../lib/db.js'

const router = Router()

// Clerk sends webhooks to this endpoint
// Must use express.raw() for webhook signature verification
router.post('/clerk', express.raw({ type: 'application/json' }), async (req, res) => {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    return res.status(500).json({ error: 'Webhook secret not configured' })
  }

  const payload = req.body
  const headers = req.headers

  const wh = new Webhook(WEBHOOK_SECRET)
  let evt

  try {
    evt = wh.verify(payload, headers)
  } catch (err) {
    return res.status(400).json({ error: 'Invalid webhook signature' })
  }

  const { type, data } = evt

  try {
    switch (type) {
      case 'user.created':
      case 'user.updated': {
        const primaryEmail = data.email_addresses?.find(e => e.id === data.primary_email_address_id)?.email_address
          || data.email_addresses?.[0]?.email_address

        await prisma.user.upsert({
          where: { clerkId: data.id },
          update: {
            email: primaryEmail || `user-${data.id}@clerk.dev`,
            name: `${data.first_name || ''} ${data.last_name || ''}`.trim() || data.username || 'User',
            avatar: data.image_url,
          },
          create: {
            clerkId: data.id,
            email: primaryEmail || `user-${data.id}@clerk.dev`,
            name: `${data.first_name || ''} ${data.last_name || ''}`.trim() || data.username || 'User',
            avatar: data.image_url,
            tier: 'free',
          },
        })
        break
      }

      case 'user.deleted': {
        await prisma.user.deleteMany({
          where: { clerkId: data.id }
        })
        break
      }

      default:
        console.log(`Unhandled webhook type: ${type}`)
    }

    res.json({ success: true })
  } catch (err) {
    console.error('Webhook processing error:', err)
    res.status(500).json({ error: 'Failed to process webhook' })
  }
})

export default router