import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import Question from '@/models/Question'
import FlashcardProgress from '@/models/FlashcardProgress'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(request.url)
    const deck = url.searchParams.get('deck')
    const BATCH_SIZE = 20

    await connectDB()

    const query = { isActive: true }
    if (deck) query['topic_tag.es'] = deck

    // Get cards due for review (spaced repetition)
    const dueProgress = await FlashcardProgress.find({
      userId: tokenData.userId,
      nextReviewDate: { $lte: new Date() },
    })
      .limit(BATCH_SIZE * 2) // Fetch extra to allow filtering by deck
      .select('questionId')

    const dueQuestionIds = dueProgress.map((p) => p.questionId)

    // Fetch full question data for due cards, filtered by deck if specified
    const dueCards = await Question.find({
      _id: { $in: dueQuestionIds },
      ...query,
    })
      .limit(BATCH_SIZE)
      .select('_id question metadata options topic_tag correct_option_idx')

    // Fill remaining with new cards
    const remaining = BATCH_SIZE - dueCards.length
    let newCards = []
    if (remaining > 0) {
      const seenIds = await FlashcardProgress.find({ userId: tokenData.userId }).distinct(
        'questionId'
      )
      newCards = await Question.find({
        ...query,
        _id: { $nin: seenIds },
      })
        .limit(remaining)
        .select('_id question metadata options topic_tag correct_option_idx')
    }

    const cards = [...dueCards, ...newCards]

    return NextResponse.json({ cards, total: cards.length })
  } catch (error) {
    console.error('Flashcard practice error:', error)
    return NextResponse.json({ error: 'Failed to fetch flashcards' }, { status: 500 })
  }
}
