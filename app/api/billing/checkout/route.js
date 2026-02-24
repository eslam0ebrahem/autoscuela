import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import User from '@/models/User'
import stripe from '@/lib/stripe'
import { getCurrentUser } from '@/lib/auth'

export async function POST(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()
    const user = await User.findById(tokenData.userId)

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Create or retrieve Stripe customer
    let customerId = user.subscription?.stripeCustomerId
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user._id.toString() },
      })
      customerId = customer.id
      await User.findByIdAndUpdate(user._id, {
        'subscription.stripeCustomerId': customerId,
      })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/dashboard?subscription=success`,
      cancel_url: `${appUrl}/dashboard?subscription=cancelled`,
      metadata: { userId: user._id.toString() },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
