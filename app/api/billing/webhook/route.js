import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import User from '@/models/User'
import stripe from '@/lib/stripe'

export async function POST(request) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  let event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  await connectDB()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      const userId = session.metadata?.userId
      if (userId) {
        await User.findByIdAndUpdate(userId, {
          'subscription.status': 'active',
          'subscription.stripeSubscriptionId': session.subscription,
        })
      }
      break
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object
      const sub = await stripe.subscriptions.retrieve(invoice.subscription)
      const userId = sub.metadata?.userId || (await findUserByCustomer(sub.customer))
      if (userId) {
        await User.findByIdAndUpdate(userId, {
          'subscription.status': 'active',
          'subscription.currentPeriodEnd': new Date(sub.current_period_end * 1000),
        })
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object
      const userId = await findUserByCustomer(invoice.customer)
      if (userId) {
        await User.findByIdAndUpdate(userId, { 'subscription.status': 'past_due' })
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object
      const userId = await findUserByCustomer(sub.customer)
      if (userId) {
        await User.findByIdAndUpdate(userId, { 'subscription.status': 'inactive' })
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}

async function findUserByCustomer(customerId) {
  const user = await User.findOne({ 'subscription.stripeCustomerId': customerId }).select('_id')
  return user?._id?.toString()
}
