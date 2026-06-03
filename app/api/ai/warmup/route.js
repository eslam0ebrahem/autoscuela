import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getUserSkillProfile } from '@/lib/user-skill'
import { callJsonTask, FAST_MODEL, hashKey } from '@/lib/services/ai/provider'
import { withCache } from '@/lib/services/ai/cache'
import connectDB from '@/lib/db'

const WARMUP_PROMPT = `You are a friendly DGT driving theory coach.
The student is about to start an exam.
Give them a quick, fun, "Did you know?" fact or a mnemonic related to their weakest topic to warm up their brain.
Keep it extremely short (1-2 sentences max).

Return ONLY valid JSON:
{
  "fact": "Did you know...? / Mnemonic...",
  "topic": "The topic being covered",
  "emoji": "🚗"
}`

export async function GET(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const lang = searchParams.get('lang') || 'es'

    await connectDB()
    const skillProfile = await getUserSkillProfile(tokenData.userId)
    
    // Find weakest topic
    const weakTopics = (skillProfile?.topics || [])
      .filter((t) => (t.accuracy ?? 0) < 75)
      .sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0))
    
    let targetTopic = null
    if (weakTopics.length > 0) {
      targetTopic = weakTopics[0].tag
    } else {
      targetTopic = 'General Traffic Rules'
    }

    // Add a random variation (0 to 9) to the cache key to ensure we don't always show the exact same tip
    const variation = Math.floor(Math.random() * 10)
    const cacheKey = `warmup_${hashKey(lang + '_' + targetTopic + '_' + variation)}`

    const fallback = {
      fact: lang === 'es' ? 'Recuerda leer atentamente cada pregunta antes de responder.' : 'Remember to read each question carefully before answering.',
      topic: targetTopic,
      emoji: '💡',
      _fallback: true
    }

    const result = await withCache(cacheKey, async () => {
      return callJsonTask({
        label: 'getWarmupFact',
        model: FAST_MODEL,
        maxTokens: 150,
        defaults: fallback,
        messages: [
          { role: 'system', content: WARMUP_PROMPT },
          { role: 'user', content: `Language: ${lang}\nTarget Topic: ${targetTopic}` }
        ]
      })
    }, 86400) // Cache the fun fact for 24 hours per topic/lang

    return NextResponse.json(result)
  } catch (error) {
    console.error('[ai-warmup] Error:', error)
    return NextResponse.json({ error: 'Failed to generate warmup' }, { status: 500 })
  }
}
