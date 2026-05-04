import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'

/**
 * GET /api/health
 * Health check endpoint for deployment monitoring.
 * Returns DB connectivity status and uptime.
 */
export async function GET() {
  const start = Date.now()

  try {
    await connectDB()
    const { default: mongoose } = await import('mongoose')
    const dbState = mongoose.connection.readyState

    const healthy = dbState === 1

    return NextResponse.json(
      {
        status: healthy ? 'healthy' : 'degraded',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        db: {
          connected: healthy,
          state: ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] ?? 'unknown',
        },
        latencyMs: Date.now() - start,
      },
      { status: healthy ? 200 : 503 }
    )
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        db: { connected: false, error: error.message },
        latencyMs: Date.now() - start,
      },
      { status: 503 }
    )
  }
}
